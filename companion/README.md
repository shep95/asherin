# Asherin Sentinel — desktop companion

The browser room (`/dashboard/sentinel`) listens only while its page is open. This companion is
the part that legitimately extends that reach: its own process, its own microphone grant, a tray
presence, and an opt-in start-at-login item.

What it does:

- records while the machine is awake and signed in, with no browser open
- resumes automatically after a reboot when "start at login" is on
- buffers segments on disk (`userData/pending`, mode 0600) and retries until the account accepts them
- pauses on system sleep, marks the device `sleeping`, resumes on wake

What it does not do, and will not claim:

- record while the machine is powered off, asleep or hibernating — no user-space process can
- record covertly: the tray icon stays visible and the OS microphone indicator is never suppressed

## Pair it

1. Open `asherin.com → dashboard → asherin.sentinel → devices` and generate a pairing code
   (valid ten minutes, one use).
2. Launch the companion and type the code. It exchanges the code for a device token, stored only
   on this machine and hashed in the account. Revoke it any time from the same panel.

## Bluetooth environment scanning

The companion also runs a passive BLE bridge on `ws://127.0.0.1:8769`, bound to loopback and
restricted to the dashboard origins. The environment tab in `asherin.sentinel` connects to it
automatically and starts reading advertisement packets — the real hardware address, address type,
manufacturer payload and service data, none of which a browser tab can see.

- scan only: it never connects, pairs, reads a characteristic or writes one
- macOS hides the MAC and hands out a per-host uuid; the bridge reports that as
  `addressIsHardware: false` instead of printing a uuid as though it were hardware
- Linux needs `sudo setcap cap_net_raw+eip $(eval readlink -f $(which node))` for scanning
- the scanner module is optional; without it the bridge says so instead of showing an empty room

## Build

```bash
cd companion
npm install
npm start                 # build renderer + run
npm run package:mac       # or package:win / package:linux
```

The renderer imports the audio pipeline directly from `../src/lib/sentinel/audio/*`, so there is
one implementation of the VAD, sound tagging and voiceprint code — not a copy that drifts.
