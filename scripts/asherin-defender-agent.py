#!/usr/bin/env python3
"""
asherin.defender — device agent.

WHAT THIS IS
A browser tab can only ever measure a browser tab. This agent is the other
half of asherin.defender: you run it on your own machine, with your own
permissions, and it reads what the tab cannot — disks, firewall, updates,
processes, installed apps, browser profiles and extensions, wireless state,
peripherals, accounts, backups, remote-access exposure.

WHAT IT WILL NOT DO
  • it never changes a setting, kills a process, or touches a file. read only.
  • it never uploads file contents, file names, credentials, or message bodies.
    it uploads findings: a check id, a state, and one sentence of observation.
  • it never asks for a password. anything needing elevation is reported as
    unmeasured with the exact reason.

USAGE
    python3 asherin-defender-agent.py --token <pairing-token> [--once]

The pairing token is generated in asherin.defender → agent, and is shown to you
once. The server only ever stores its sha-256 digest.
"""

from __future__ import annotations

import argparse
import glob
import json
import os
import platform
import shutil
import socket
import subprocess
import sys
import time
import urllib.error
import urllib.request

AGENT_VERSION = "1.0.0"
ENDPOINT = os.environ.get(
    "ASHERIN_DEFENDER_ENDPOINT",
    "https://xpgxgzqbtrrrbtjcemci.supabase.co/functions/v1/asherin-defender-agent",
)
INTERVAL_S = 900
CMD_TIMEOUT = 12

SYS = platform.system()  # Darwin | Windows | Linux
findings: list[dict] = []


def emit(check_id: str, state: str, observed: str, action: str | None = None) -> None:
    findings.append(
        {"id": check_id, "state": state, "observed": observed[:400], "action": (action or None)}
    )


def unmeasured(check_id: str, why: str) -> None:
    emit(check_id, "unmeasured", why)


def run(cmd: list[str]) -> tuple[int, str]:
    """read-only shell out with a hard timeout and no shell interpolation."""
    if not shutil.which(cmd[0]) and not os.path.exists(cmd[0]):
        return 127, ""
    try:
        p = subprocess.run(cmd, capture_output=True, text=True, timeout=CMD_TIMEOUT)
        return p.returncode, (p.stdout or "") + (p.stderr or "")
    except Exception as exc:  # timeout, permission, missing binary
        return 1, f"__error__ {exc}"


# ── device and firmware ──────────────────────────────────────────────────────
def check_device() -> None:
    emit("dev.os-patch-level", "pass", f"{platform.system()} {platform.release()} ({platform.machine()})")
    emit("upd.reboot-pending", "pass", uptime_text())

    if SYS == "Darwin":
        rc, out = run(["csrutil", "status"])
        if rc == 0:
            on = "enabled" in out.lower()
            emit("dev.secure-boot", "pass" if on else "fail",
                 f"system integrity protection is {'enabled' if on else 'disabled'}",
                 None if on else "re-enable SIP from recovery; with it off, signed system files can be replaced")
        else:
            unmeasured("dev.secure-boot", "csrutil is not available on this machine")
        rc, out = run(["fdesetup", "status"])
        if rc == 0:
            on = "On" in out
            emit("disk.encryption", "pass" if on else "fail",
                 f"filevault is {'on' if on else 'off'}",
                 None if on else "turn filevault on — without it the disk reads plainly in another machine")
        else:
            unmeasured("disk.encryption", "filevault status needs an interactive session")
    elif SYS == "Windows":
        rc, out = run(["powershell", "-NoProfile", "-Command",
                       "(Confirm-SecureBootUEFI) 2>$null"])
        if rc == 0 and out.strip():
            on = "True" in out
            emit("dev.secure-boot", "pass" if on else "warn",
                 f"uefi secure boot is {'on' if on else 'off'}")
        else:
            unmeasured("dev.secure-boot", "secure boot state needs an elevated shell")
        rc, out = run(["manage-bde", "-status", "C:"])
        if rc == 0:
            on = "Protection On" in out
            emit("disk.encryption", "pass" if on else "fail",
                 f"bitlocker on C: is {'on' if on else 'off'}",
                 None if on else "turn bitlocker on for the system volume")
        else:
            unmeasured("disk.encryption", "bitlocker status needs an elevated shell")
        rc, out = run(["powershell", "-NoProfile", "-Command",
                       "(Get-Tpm).TpmPresent"])
        if rc == 0 and out.strip():
            emit("dev.tpm", "pass" if "True" in out else "warn",
                 f"tpm present: {out.strip()}")
        else:
            unmeasured("dev.tpm", "tpm query needs an elevated shell")
    else:
        rc, out = run(["lsblk", "-o", "NAME,TYPE"])
        if rc == 0:
            on = "crypt" in out
            emit("disk.encryption", "pass" if on else "fail",
                 "an encrypted block device is mounted" if on else "no luks/crypt device is mounted",
                 None if on else "encrypt the root volume — an unencrypted disk reads plainly elsewhere")
        else:
            unmeasured("disk.encryption", "lsblk is not available here")
        if os.path.exists("/sys/firmware/efi"):
            rc, out = run(["mokutil", "--sb-state"])
            if rc == 0:
                emit("dev.secure-boot", "pass" if "enabled" in out.lower() else "warn", out.strip()[:120])
            else:
                unmeasured("dev.secure-boot", "mokutil is not installed")
        else:
            unmeasured("dev.secure-boot", "this machine booted without uefi")


def uptime_text() -> str:
    try:
        if SYS == "Linux":
            with open("/proc/uptime", encoding="utf-8") as fh:
                secs = float(fh.read().split()[0])
        elif SYS == "Darwin":
            rc, out = run(["sysctl", "-n", "kern.boottime"])
            secs = time.time() - float(out.split("sec = ")[1].split(",")[0]) if rc == 0 else 0
        else:
            secs = 0
        return f"{int(secs // 86400)}d {int((secs % 86400) // 3600)}h since last boot" if secs else "boot time unavailable"
    except Exception:
        return "boot time unavailable"


# ── storage and files ────────────────────────────────────────────────────────
def check_disk() -> None:
    try:
        usage = shutil.disk_usage(os.path.expanduser("~"))
        free_pct = usage.free / usage.total * 100
        emit("disk.free-space", "warn" if free_pct < 10 else "pass",
             f"{free_pct:.0f}% free of {usage.total / 1e9:.0f} gb",
             "free space — updates and snapshots fail silently on a full disk" if free_pct < 10 else None)
    except Exception:
        unmeasured("disk.free-space", "the home volume could not be read")

    home = os.path.expanduser("~")
    world_readable = 0
    sensitive = 0
    scanned = 0
    for base in ("Documents", "Downloads", "Desktop", ".ssh", ".aws", ".config"):
        root = os.path.join(home, base)
        if not os.path.isdir(root):
            continue
        for dirpath, dirnames, filenames in os.walk(root):
            dirnames[:] = dirnames[:40]
            for name in filenames[:400]:
                scanned += 1
                if scanned > 20000:
                    break
                path = os.path.join(dirpath, name)
                low = name.lower()
                if low.endswith((".pem", ".key", ".p12", ".kdbx", ".env")) or low in ("id_rsa", "id_ed25519", "credentials"):
                    sensitive += 1
                    try:
                        if SYS != "Windows" and (os.stat(path).st_mode & 0o077):
                            world_readable += 1
                    except OSError:
                        pass
            if scanned > 20000:
                break
    emit("file.dotenv-exposure", "warn" if sensitive > 20 else "pass",
         f"{sensitive} key/credential-shaped files under the home folder ({scanned} files walked)",
         "move keys into a keychain or vault rather than loose files" if sensitive > 20 else None)
    if SYS != "Windows":
        emit("file.ssh-key-perms", "fail" if world_readable else "pass",
             f"{world_readable} private key file(s) readable by other accounts on this machine",
             "chmod 600 those files" if world_readable else None)
    dl = os.path.join(home, "Downloads")
    if os.path.isdir(dl):
        installers = [p for p in glob.glob(os.path.join(dl, "*")) if p.lower().endswith((".dmg", ".exe", ".msi", ".pkg", ".apk", ".appimage"))]
        emit("file.suspicious-exec", "warn" if len(installers) > 5 else "pass",
             f"{len(installers)} installer package(s) sitting in downloads",
             "delete old installers — they are a favourite place to hide a swapped binary" if len(installers) > 5 else None)


# ── network ──────────────────────────────────────────────────────────────────
def check_network() -> None:
    if SYS == "Darwin":
        rc, out = run(["/usr/libexec/ApplicationFirewall/socketfilterfw", "--getglobalstate"])
        if rc == 0:
            on = "enabled" in out.lower()
            emit("net.firewall", "pass" if on else "fail", f"application firewall is {'on' if on else 'off'}",
                 None if on else "turn the firewall on in system settings → network")
        else:
            unmeasured("net.firewall", "the firewall state needs an elevated shell")
    elif SYS == "Windows":
        rc, out = run(["netsh", "advfirewall", "show", "allprofiles", "state"])
        if rc == 0:
            off = out.lower().count("off")
            emit("net.firewall", "fail" if off else "pass",
                 f"{off} firewall profile(s) are off" if off else "all firewall profiles are on",
                 "enable the firewall for every profile" if off else None)
        else:
            unmeasured("net.firewall", "netsh could not be read")
    else:
        rc, out = run(["ufw", "status"])
        if rc == 0:
            on = "active" in out.lower()
            emit("net.firewall", "pass" if on else "warn", f"ufw is {'active' if on else 'inactive'}")
        else:
            rc2, out2 = run(["nft", "list", "ruleset"])
            if rc2 == 0 and out2.strip():
                emit("net.firewall", "pass", "nftables ruleset present")
            else:
                unmeasured("net.firewall", "no readable firewall front-end on this machine")

    listeners = []
    if SYS == "Windows":
        rc, out = run(["netstat", "-ano", "-p", "TCP"])
        if rc == 0:
            listeners = [l for l in out.splitlines() if "LISTENING" in l and "0.0.0.0:" in l]
    else:
        rc, out = run(["lsof", "-nP", "-iTCP", "-sTCP:LISTEN"])
        if rc != 0:
            rc, out = run(["ss", "-ltn"])
        if rc == 0:
            listeners = [l for l in out.splitlines()[1:] if l.strip() and "127.0.0.1" not in l and "[::1]" not in l]
    if listeners:
        emit("net.listening-ports", "warn" if len(listeners) > 3 else "pass",
             f"{len(listeners)} service(s) listening on a non-loopback address",
             "close what you do not recognise — every listener is a door" if len(listeners) > 3 else None)
    else:
        emit("net.listening-ports", "pass", "nothing is listening outside loopback")

    try:
        resolvers = []
        if SYS == "Windows":
            rc, out = run(["powershell", "-NoProfile", "-Command",
                           "(Get-DnsClientServerAddress -AddressFamily IPv4).ServerAddresses"])
            resolvers = [l.strip() for l in out.splitlines() if l.strip()] if rc == 0 else []
        elif os.path.exists("/etc/resolv.conf"):
            with open("/etc/resolv.conf", encoding="utf-8") as fh:
                resolvers = [l.split()[1] for l in fh if l.startswith("nameserver")]
        elif SYS == "Darwin":
            rc, out = run(["scutil", "--dns"])
            resolvers = sorted({l.split(":")[1].strip() for l in out.splitlines() if "nameserver[" in l}) if rc == 0 else []
        if resolvers:
            emit("net.dns-server", "pass", f"resolvers in use: {', '.join(resolvers[:4])}")
        else:
            unmeasured("net.dns-server", "the resolver list could not be read")
    except Exception:
        unmeasured("net.dns-server", "the resolver list could not be read")

    proxy_env = [k for k in ("http_proxy", "https_proxy", "all_proxy", "HTTP_PROXY", "HTTPS_PROXY") if os.environ.get(k)]
    emit("net.proxy-config", "warn" if proxy_env else "pass",
         f"proxy variables set: {', '.join(proxy_env)}" if proxy_env else "no proxy is configured for this session",
         "confirm you set that proxy yourself — a proxy sees everything unencrypted" if proxy_env else None)

    if os.path.exists("/etc/hosts") or SYS == "Windows":
        path = r"C:\Windows\System32\drivers\etc\hosts" if SYS == "Windows" else "/etc/hosts"
        try:
            with open(path, encoding="utf-8", errors="ignore") as fh:
                lines = [l.strip() for l in fh if l.strip() and not l.startswith("#")]
            odd = [l for l in lines if not l.split()[0].startswith(("127.", "::1", "255.255", "fe80"))]
            emit("net.hosts-file", "warn" if odd else "pass",
                 f"{len(odd)} non-loopback override(s) in the hosts file" if odd else f"{len(lines)} loopback entries only",
                 "an override can point a real domain at an attacker's server" if odd else None)
        except OSError:
            unmeasured("net.hosts-file", "the hosts file could not be read with these permissions")

    try:
        socket.setdefaulttimeout(4)
        socket.getaddrinfo("asherin.com", 443)
        emit("net.traffic-volume", "pass", "outbound dns and routing are working")
    except Exception:
        emit("net.traffic-volume", "warn", "outbound resolution failed from this machine")


# ── wireless and bluetooth ───────────────────────────────────────────────────
def check_wireless() -> None:
    if SYS == "Darwin":
        rc, out = run(["/usr/sbin/system_profiler", "SPAirPortDataType"])
        if rc == 0 and out:
            secure = "WPA3" in out or "WPA2" in out
            emit("wifi.encryption", "pass" if secure else "warn",
                 "the joined network reports wpa2/wpa3" if secure else "no wpa2/wpa3 network is joined",
                 None if secure else "avoid open wireless; use a tunnel if you must")
            emit("wifi.saved-networks", "pass", f"{out.count('Network Information')} wireless interface record(s) read")
        else:
            unmeasured("wifi.encryption", "the wireless profile could not be read")
        rc, out = run(["/usr/sbin/system_profiler", "SPBluetoothDataType"])
        if rc == 0:
            emit("bt.paired-inventory", "pass", f"bluetooth profile read; {out.lower().count('connected: yes')} device(s) connected")
        else:
            unmeasured("bt.paired-inventory", "the bluetooth profile could not be read")
    elif SYS == "Windows":
        rc, out = run(["netsh", "wlan", "show", "interfaces"])
        if rc == 0 and "Authentication" in out:
            auth = [l.split(":", 1)[1].strip() for l in out.splitlines() if "Authentication" in l]
            secure = any("WPA2" in a or "WPA3" in a for a in auth)
            emit("wifi.encryption", "pass" if secure else "warn", f"authentication: {', '.join(auth) or 'unknown'}")
        else:
            unmeasured("wifi.encryption", "no wireless interface reported")
        rc, out = run(["netsh", "wlan", "show", "profiles"])
        if rc == 0:
            emit("wifi.saved-networks", "pass", f"{out.count('All User Profile')} saved wireless profile(s)")
    else:
        rc, out = run(["nmcli", "-t", "-f", "ACTIVE,SSID,SECURITY", "dev", "wifi"])
        if rc == 0 and out.strip():
            active = [l for l in out.splitlines() if l.startswith("yes")]
            secure = any("WPA" in l for l in active)
            emit("wifi.encryption", "pass" if secure else "warn",
                 f"active wireless security: {active[0].split(':')[-1] if active else 'none'}")
        else:
            unmeasured("wifi.encryption", "nmcli is not available here")
        rc, out = run(["bluetoothctl", "devices"])
        if rc == 0:
            emit("bt.paired-inventory", "pass", f"{len(out.strip().splitlines())} paired bluetooth device(s)")
        else:
            unmeasured("bt.paired-inventory", "bluetoothctl is not available here")


# ── browsers, apps, processes ────────────────────────────────────────────────
BROWSER_EXT_DIRS = {
    "Darwin": [
        "~/Library/Application Support/Google/Chrome/*/Extensions",
        "~/Library/Application Support/BraveSoftware/Brave-Browser/*/Extensions",
        "~/Library/Application Support/Microsoft Edge/*/Extensions",
        "~/Library/Application Support/Firefox/Profiles/*/extensions",
    ],
    "Linux": [
        "~/.config/google-chrome/*/Extensions",
        "~/.config/chromium/*/Extensions",
        "~/.mozilla/firefox/*/extensions",
    ],
    "Windows": [
        r"~\AppData\Local\Google\Chrome\User Data\*\Extensions",
        r"~\AppData\Local\Microsoft\Edge\User Data\*\Extensions",
        r"~\AppData\Roaming\Mozilla\Firefox\Profiles\*\extensions",
    ],
}


def check_browsers() -> None:
    total = 0
    profiles = 0
    for pattern in BROWSER_EXT_DIRS.get(SYS, []):
        for path in glob.glob(os.path.expanduser(pattern)):
            profiles += 1
            try:
                total += len([e for e in os.listdir(path) if not e.startswith(".")])
            except OSError:
                pass
    if profiles:
        emit("ext.inventory", "warn" if total > 15 else "pass",
             f"{total} extension(s) across {profiles} browser profile(s)",
             "remove extensions you do not use — each one reads every page you open" if total > 15 else None)
        emit("br.installed-browsers", "pass", f"{profiles} browser profile(s) on this device")
    else:
        unmeasured("ext.inventory", "no browser profile directory was found for this user")

    running = process_names()
    browsers = [p for p in running if any(b in p.lower() for b in ("chrome", "firefox", "safari", "brave", "edge", "opera"))]
    emit("br.background-processes", "pass", f"{len(browsers)} browser process(es) running: {', '.join(sorted(set(browsers))[:5]) or 'none'}")


def process_names() -> list[str]:
    if SYS == "Windows":
        rc, out = run(["tasklist", "/fo", "csv", "/nh"])
        return [l.split(",")[0].strip('"') for l in out.splitlines() if "," in l] if rc == 0 else []
    rc, out = run(["ps", "-Ao", "comm"])
    return [l.strip() for l in out.splitlines()[1:] if l.strip()] if rc == 0 else []


REMOTE_TOOLS = ("teamviewer", "anydesk", "screenconnect", "vnc", "logmein", "splashtop", "rustdesk", "chrome remote")


def check_processes() -> None:
    names = process_names()
    if not names:
        unmeasured("proc.inventory", "the process list could not be read")
        return
    emit("proc.inventory", "pass", f"{len(names)} processes running, {len(set(names))} distinct")
    remote = sorted({n for n in names if any(t in n.lower() for t in REMOTE_TOOLS)})
    emit("srv.remote-session", "fail" if remote else "pass",
         f"remote-control software running: {', '.join(remote)}" if remote else "no remote-control software is running",
         "if you did not start that session, disconnect the network now" if remote else None)

    if SYS == "Darwin":
        rc, out = run(["launchctl", "list"])
        if rc == 0:
            emit("proc.autostart", "pass", f"{len(out.splitlines()) - 1} launch agents/daemons registered for this user")
        agents = glob.glob(os.path.expanduser("~/Library/LaunchAgents/*.plist"))
        emit("proc.launch-agents", "warn" if len(agents) > 8 else "pass",
             f"{len(agents)} user launch agent(s)",
             "review your login items — persistence lives here" if len(agents) > 8 else None)
    elif SYS == "Windows":
        rc, out = run(["powershell", "-NoProfile", "-Command",
                       "(Get-CimInstance Win32_StartupCommand).Count"])
        if rc == 0 and out.strip().isdigit():
            emit("proc.autostart", "pass", f"{out.strip()} startup command(s) registered")
        else:
            unmeasured("proc.autostart", "startup commands could not be enumerated")
    else:
        units = glob.glob(os.path.expanduser("~/.config/systemd/user/*.service"))
        emit("proc.launch-agents", "pass", f"{len(units)} user systemd unit(s)")


def check_apps() -> None:
    if SYS == "Darwin":
        apps = glob.glob("/Applications/*.app") + glob.glob(os.path.expanduser("~/Applications/*.app"))
        emit("app.inventory", "pass", f"{len(apps)} installed applications")
        unsigned = 0
        for app in apps[:60]:
            rc, out = run(["codesign", "-dv", app])
            if rc != 0 or "Authority" not in out:
                unsigned += 1
        emit("app.unsigned", "warn" if unsigned else "pass",
             f"{unsigned} of the first {min(len(apps), 60)} applications have no readable signature",
             "verify unsigned applications before trusting them" if unsigned else None)
    elif SYS == "Windows":
        rc, out = run(["powershell", "-NoProfile", "-Command",
                       "(Get-ItemProperty HKLM:\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*).DisplayName"])
        if rc == 0:
            names = [l for l in out.splitlines() if l.strip()]
            emit("app.inventory", "pass", f"{len(names)} installed programs in the machine registry")
        else:
            unmeasured("app.inventory", "the uninstall registry could not be read")
        rc, out = run(["powershell", "-NoProfile", "-Command",
                       "(Get-MpComputerStatus).RealTimeProtectionEnabled"])
        if rc == 0 and out.strip():
            on = "True" in out
            emit("upd.antivirus-defs", "pass" if on else "fail",
                 f"defender real-time protection is {'on' if on else 'off'}",
                 None if on else "turn real-time protection back on")
    else:
        rc, out = run(["dpkg-query", "-f", "${binary:Package}\n", "-W"])
        if rc != 0:
            rc, out = run(["rpm", "-qa"])
        if rc == 0:
            emit("app.inventory", "pass", f"{len(out.strip().splitlines())} installed packages")
        else:
            unmeasured("app.inventory", "no supported package manager responded")


# ── updates, accounts, backups, power ────────────────────────────────────────
def check_updates() -> None:
    if SYS == "Darwin":
        rc, out = run(["softwareupdate", "-l"])
        if rc == 0:
            pending = "No new software available" not in out
            emit("upd.pending-critical", "warn" if pending else "pass",
                 "operating system updates are waiting" if pending else "the operating system is current",
                 "install pending updates" if pending else None)
        else:
            unmeasured("upd.pending-critical", "the update service did not answer")
        rc, out = run(["defaults", "read", "/Library/Preferences/com.apple.SoftwareUpdate", "AutomaticCheckEnabled"])
        if rc == 0:
            emit("upd.auto-update", "pass" if out.strip() == "1" else "warn",
                 f"automatic update checks are {'on' if out.strip() == '1' else 'off'}")
    elif SYS == "Windows":
        rc, out = run(["powershell", "-NoProfile", "-Command",
                       "(Get-HotFix | Sort-Object InstalledOn -Descending | Select-Object -First 1).InstalledOn"])
        if rc == 0 and out.strip():
            emit("upd.pending-critical", "pass", f"most recent patch installed {out.strip()}")
        else:
            unmeasured("upd.pending-critical", "the patch history could not be read")
    else:
        rc, out = run(["apt-get", "-s", "upgrade"])
        if rc == 0:
            count = out.count("Inst ")
            emit("upd.pending-critical", "warn" if count else "pass",
                 f"{count} package upgrade(s) pending" if count else "packages are current",
                 "run your package upgrade" if count else None)
        else:
            unmeasured("upd.pending-critical", "no supported package manager responded")


def check_accounts() -> None:
    if SYS == "Darwin":
        rc, out = run(["dscl", ".", "-list", "/Users"])
        if rc == 0:
            users = [u for u in out.split() if not u.startswith("_")]
            emit("acct.unknown-users", "warn" if len(users) > 4 else "pass",
                 f"{len(users)} local accounts: {', '.join(users[:6])}",
                 "remove accounts nobody uses" if len(users) > 4 else None)
        rc, out = run(["dscl", ".", "-read", f"/Groups/admin", "GroupMembership"])
        if rc == 0:
            admins = out.split()[1:]
            emit("acct.admin-count", "warn" if len(admins) > 2 else "pass",
                 f"{len(admins)} administrator account(s): {', '.join(admins[:5])}",
                 "day-to-day work should not run as an administrator" if len(admins) > 2 else None)
    elif SYS == "Windows":
        rc, out = run(["net", "localgroup", "administrators"])
        if rc == 0:
            body = out.split("---")[-1]
            admins = [l.strip() for l in body.splitlines() if l.strip() and "command completed" not in l.lower()]
            emit("acct.admin-count", "warn" if len(admins) > 2 else "pass",
                 f"{len(admins)} local administrator(s)")
        else:
            unmeasured("acct.admin-count", "the administrators group could not be read")
    else:
        try:
            with open("/etc/passwd", encoding="utf-8") as fh:
                users = [l.split(":")[0] for l in fh if int(l.split(":")[2]) >= 1000 and "nologin" not in l]
            emit("acct.unknown-users", "pass", f"{len(users)} interactive local account(s)")
        except Exception:
            unmeasured("acct.unknown-users", "the account list could not be read")
        rc, out = run(["getent", "group", "sudo"])
        if rc == 0:
            emit("acct.admin-count", "pass", f"sudo members: {out.strip().split(':')[-1] or 'none'}")

    ssh_dir = os.path.expanduser("~/.ssh")
    if os.path.isdir(ssh_dir):
        keys = [k for k in os.listdir(ssh_dir) if k.startswith("id_") and not k.endswith(".pub")]
        emit("data.token-storage", "warn" if len(keys) > 3 else "pass",
             f"{len(keys)} private ssh key(s) on disk",
             "retire keys you no longer use" if len(keys) > 3 else None)
        auth = os.path.join(ssh_dir, "authorized_keys")
        if os.path.exists(auth):
            with open(auth, encoding="utf-8", errors="ignore") as fh:
                lines = [l for l in fh if l.strip() and not l.startswith("#")]
            emit("acct.ssh-authorized-keys", "warn" if lines else "pass",
                 f"{len(lines)} key(s) may log into this machine",
                 "remove any authorized key you cannot name" if lines else None)


def check_backups() -> None:
    if SYS == "Darwin":
        rc, out = run(["tmutil", "latestbackup"])
        ok = rc == 0 and out.strip() and "__error__" not in out
        emit("data.backup-recent", "pass" if ok else "warn",
             f"latest time machine backup: {out.strip()[:80]}" if ok else "no time machine backup was found",
             None if ok else "attach a backup destination — ransomware is only survivable with backups")
    elif SYS == "Windows":
        rc, out = run(["wbadmin", "get", "versions"])
        emit("data.backup-recent", "pass" if rc == 0 and "Backup time" in out else "warn",
             "windows backup history present" if rc == 0 and "Backup time" in out else "no windows backup history was found")
    else:
        candidates = [p for p in ("/var/backups", os.path.expanduser("~/backups")) if os.path.isdir(p)]
        emit("data.backup-recent", "pass" if candidates else "warn",
             f"backup directories present: {', '.join(candidates)}" if candidates else "no local backup directory was found")


def check_power() -> None:
    if SYS == "Darwin":
        rc, out = run(["pmset", "-g", "batt"])
        if rc == 0 and "%" in out:
            pct = out.split("\t")[-1].split("%")[0].split(";")[0].strip()
            emit("pwr.battery-health", "pass", f"battery reads {pct}% · {'charging' if 'AC Power' in out else 'on battery'}")
    elif SYS == "Linux" and glob.glob("/sys/class/power_supply/BAT*/capacity"):
        path = glob.glob("/sys/class/power_supply/BAT*/capacity")[0]
        with open(path, encoding="utf-8") as fh:
            emit("pwr.battery-health", "pass", f"battery reads {fh.read().strip()}%")
    else:
        unmeasured("pwr.battery-health", "no battery is reported on this machine")


def check_peripherals() -> None:
    if SYS == "Darwin":
        rc, out = run(["/usr/sbin/system_profiler", "SPUSBDataType"])
        if rc == 0:
            emit("per.usb-inventory", "pass", f"{out.count('Product ID:')} usb device(s) attached")
        else:
            unmeasured("per.usb-inventory", "the usb tree could not be read")
    elif SYS == "Windows":
        rc, out = run(["powershell", "-NoProfile", "-Command",
                       "(Get-PnpDevice -Class USB -Status OK).Count"])
        if rc == 0 and out.strip().isdigit():
            emit("per.usb-inventory", "pass", f"{out.strip()} usb device(s) attached")
        else:
            unmeasured("per.usb-inventory", "the usb tree could not be read")
    else:
        rc, out = run(["lsusb"])
        if rc == 0:
            emit("per.usb-inventory", "pass", f"{len(out.strip().splitlines())} usb device(s) attached")
        else:
            unmeasured("per.usb-inventory", "lsusb is not installed")


def collect() -> dict:
    findings.clear()
    started = time.time()
    for fn in (check_device, check_disk, check_network, check_wireless, check_browsers,
               check_processes, check_apps, check_updates, check_accounts, check_backups,
               check_power, check_peripherals):
        try:
            fn()
        except Exception as exc:  # one broken probe never stops the sweep
            emit(f"agent.{fn.__name__}", "unmeasured", f"probe failed: {exc}"[:200])
    return {
        "meta": {
            "hostname": socket.gethostname(),
            "platform": f"{platform.system()} {platform.release()}",
            "release": platform.version()[:100],
            "arch": platform.machine(),
            "agent_version": AGENT_VERSION,
            "duration_ms": int((time.time() - started) * 1000),
        },
        "findings": findings.copy(),
    }


def post(token: str, payload: dict) -> None:
    body = json.dumps({"token": token, **payload}).encode("utf-8")
    req = urllib.request.Request(ENDPOINT, data=body, headers={"Content-Type": "application/json"}, method="POST")
    try:
        with urllib.request.urlopen(req, timeout=25) as resp:
            print(f"[asherin.defender] {resp.status} {resp.read().decode()[:200]}")
    except urllib.error.HTTPError as exc:
        print(f"[asherin.defender] rejected {exc.code}: {exc.read().decode()[:200]}", file=sys.stderr)
    except Exception as exc:
        print(f"[asherin.defender] could not reach asherin: {exc}", file=sys.stderr)


def main() -> None:
    ap = argparse.ArgumentParser(description="asherin.defender device agent (read only)")
    ap.add_argument("--token", default=os.environ.get("ASHERIN_DEFENDER_TOKEN", ""), help="pairing token from asherin.defender")
    ap.add_argument("--once", action="store_true", help="scan once and exit")
    ap.add_argument("--print", action="store_true", dest="print_only", help="print the report instead of sending it")
    args = ap.parse_args()

    if not args.print_only and len(args.token) < 24:
        ap.error("a pairing token is required — generate one in asherin.defender → agent")

    while True:
        payload = collect()
        measured = [f for f in payload["findings"] if f["state"] != "unmeasured"]
        print(f"[asherin.defender] {len(payload['findings'])} checks, {len(measured)} measured, "
              f"{len([f for f in payload['findings'] if f['state'] == 'fail'])} failing")
        if args.print_only:
            print(json.dumps(payload, indent=2))
        else:
            post(args.token, payload)
        if args.once or args.print_only:
            return
        time.sleep(INTERVAL_S)


if __name__ == "__main__":
    main()
