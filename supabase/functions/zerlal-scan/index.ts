import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

async function fetchGitHubContent(url: string): Promise<string> {
  // Convert github.com URL to raw content or API URL
  let apiUrl = url;
  
  if (url.includes("github.com")) {
    // https://github.com/owner/repo -> https://api.github.com/repos/owner/repo/contents
    const match = url.match(/github\.com\/([^\/]+)\/([^\/]+)/);
    if (match) {
      const [, owner, repo] = match;
      const cleanRepo = repo.replace(/\.git$/, "");
      // Get repo tree
      const treeResp = await fetch(`https://api.github.com/repos/${owner}/${cleanRepo}/git/trees/HEAD?recursive=1`, {
        headers: { "Accept": "application/vnd.github.v3+json", "User-Agent": "ZERLAL-Scanner" },
      });
      
      if (!treeResp.ok) {
        const errText = await treeResp.text();
        throw new Error(`GitHub API error (${treeResp.status}): ${errText}`);
      }
      
      const treeData = await treeResp.json();
      const codeExtensions = [".ts", ".tsx", ".js", ".jsx", ".py", ".go", ".rs", ".java", ".c", ".cpp", ".h", ".php", ".rb", ".swift", ".kt", ".cs", ".sh", ".sql", ".yaml", ".yml", ".json", ".toml", ".tf", ".dockerfile", ".env", ".vue", ".svelte"];
      const skipPaths = ["node_modules/", ".git/", "dist/", "build/", "__pycache__/", ".next/", "vendor/", "package-lock.json", "yarn.lock", "bun.lock"];
      
      const codeFiles = (treeData.tree || [])
        .filter((f: any) => {
          if (f.type !== "blob") return false;
          if (f.size > 50000) return false; // skip large files
          if (skipPaths.some(skip => f.path.includes(skip))) return false;
          return codeExtensions.some(ext => f.path.endsWith(ext));
        })
        .sort((a: any, b: any) => {
          // Prioritize security-relevant files
          const securityFiles = ["auth", "login", "password", "token", "session", "crypto", "encrypt", "middleware", "api", "route", "handler", "config", "env"];
          const aScore = securityFiles.filter(s => a.path.toLowerCase().includes(s)).length;
          const bScore = securityFiles.filter(s => b.path.toLowerCase().includes(s)).length;
          return bScore - aScore;
        })
        .slice(0, 50); // Top 50 most relevant files
      
      let allContent = "";
      for (const file of codeFiles) {
        try {
          const rawUrl = `https://raw.githubusercontent.com/${owner}/${cleanRepo}/HEAD/${file.path}`;
          const fileResp = await fetch(rawUrl);
          if (fileResp.ok) {
            const text = await fileResp.text();
            allContent += `\n--- FILE: ${file.path} ---\n${text}\n`;
          }
        } catch { /* skip failed files */ }
        
        if (allContent.length > 80000) break; // Cap total content
      }
      
      return allContent || "No code files found in repository";
    }
  }
  
  throw new Error("Invalid GitHub URL format");
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false },
    });

    // Extract user from JWT
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userErr } = await supabase.auth.getUser(token);
    if (userErr || !user) throw new Error("Unauthorized");

    const { project_id, scan_profile, code_content, file_name, github_url } = await req.json();
    if (!project_id) throw new Error("project_id is required");

    console.log("[ZERLAL] Starting scan for project:", project_id, "profile:", scan_profile);

    // Fetch code from GitHub if URL provided and no direct content
    let codeToAnalyze = code_content || "";
    if (!codeToAnalyze && github_url) {
      console.log("[ZERLAL] Fetching code from GitHub:", github_url);
      codeToAnalyze = await fetchGitHubContent(github_url);
    }

    if (!codeToAnalyze || codeToAnalyze.length < 10) {
      throw new Error("No code content to analyze. Upload files or provide a valid GitHub URL.");
    }

    // Create scan record
    const { data: scan, error: scanErr } = await supabase
      .from("zerlal_scans")
      .insert({
        user_id: user.id,
        project_id,
        scan_profile: scan_profile || "security-audit",
        status: "running",
        started_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (scanErr) {
      console.error("[ZERLAL] Failed to create scan record:", scanErr);
      throw scanErr;
    }

    console.log("[ZERLAL] Scan record created:", scan.id, "Code size:", codeToAnalyze.length);

    // Use Lovable AI Gateway (preferred) or Gemini
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const GEMINI_KEY = Deno.env.get("GEMINI_API_KEY_APP") || Deno.env.get("GEMINI_API_KEY");
    const useLovableGateway = !!LOVABLE_API_KEY;
    if (!useLovableGateway && !GEMINI_KEY) throw new Error("No AI API key configured");

    // Load active brains for intelligence context
    let brainsContext = "";
    try {
      const { data: brains } = await supabase
        .from("axrlen_brains")
        .select("name, content")
        .eq("is_active", true)
        .order("created_at", { ascending: true });
      if (brains && brains.length > 0) {
        brainsContext = brains.map((b: { name: string; content: string }) => `[BRAIN: ${b.name}]\n${b.content}`).join("\n\n");
        console.log("[ZERLAL] Loaded", brains.length, "active brains");
      }
    } catch (e) {
      console.log("[ZERLAL] Brains load skipped:", e);
    }


    // Cap code at 50K chars to stay within edge function time limits
    const truncatedCode = codeToAnalyze.substring(0, 50000);

    const analysisPrompt = `You are ZERLAL, an elite vulnerability intelligence engine built for government-grade security auditing. You operate with the precision of a nation-state red team.

=== ZERLAL INTELLIGENCE KNOWLEDGE BASE ===

How To Stop Hackers Files:

The provided Vault 7 dossiers, ExpressLane v3.1.1, HTTPBrowser, and Protego, offer a declassified blueprint into the operational methodologies of intelligence agencies. These documents reveal a profound understanding of system architecture, exploiting every conceivable layer from the deepest hardware to the most superficial user interface. Their thinking is not merely "hacking" but total system subversion.

Executive Summary: The Nexus of Ancient & Modern Exploitation Elite adversaries, whether nation-state intelligence or sophisticated criminal organizations, fuse ancient principles of deception, physical infiltration, and psychological manipulation with bleeding-edge technological prowess. They target vulnerabilities across the entire digital and physical attack surface, treating software, hardware, networks, and human trust as integrated components in a single, exploitable system. The goal is covert, persistent access and data exfiltration, with robust self-preservation and deniability mechanisms.

1. Adversary Operational Calculus: Exploitation Archetypes
To understand how software is exploited, one must adopt the adversary's Zero-Point Perspective: every component is a potential point of failure or leverage. The operational methodology revealed in these documents highlights several archetypal exploitation vectors, blending historical and modern techniques.

1.1. Initial Access & Infiltration (The Trojan Horse Reborn)
The initial breach is often the most critical, leveraging either human trust or systemic vulnerabilities.

Vector: Physical Insertion / Social Engineering (ExpressLane)

Method: The ExpressLane v3.1.1 tool is delivered via a USB drive. An "OTS officer" acts as the Installer, using the cover of "upgrading biometric software" with "liaison services." This is a classic Trojan horse, where a seemingly benign or helpful update carries a hidden malicious payload.
Old Way: Ancient Greek siege tactics of presenting a gift (Trojan horse) to gain entry.
New/Current Way: Leveraging physical access to deploy malware, often disguised as legitimate IT tools or updates, exploiting the human tendency to trust authorized personnel or familiar branding.
Look For:
Frontend: Any installation routine that bypasses standard security prompts or requires elevated privileges without explicit, granular user consent. Unsigned executables or executables with misleading names (MOBS_Upgrade.exe).
Backend/Code: Lack of strong code signing enforcement; reliance on Autorun.inf or similar deprecated features; vulnerabilities in USB stack drivers allowing covert partition access without re-insertion.
Supply Chain: Compromised software distribution channels or insider threats enabling physical delivery.
Vector: DLL Side-Loading / Masquerading (HTTPBrowser)

Method: The HTTPBrowser RAT uses a "self-extracting zip file" that contains a "legitimate executable associated with a Citrix Single Sign-On product." This legitimate executable is then used to "side-load the attackers initial DLL," which "XOR decode and load API's and the HTTPBrowser RAT." This exploits how Windows applications search for and load dynamic-link libraries.
Old Way: Masquerading, where a wolf wears sheep's clothing.
New/Current Way: Exploiting the Windows DLL search order or manifest misconfigurations to load a malicious DLL instead of a legitimate one, often from the same directory as a trusted executable.
Look For:
Code: Applications that do not specify full paths for DLLs, or that load DLLs from insecure locations (e.g., current working directory).
Backend: Lack of application whitelisting policies (e.g., AppLocker, Windows Defender Application Control) that prevent unauthorized executables/DLLs from running.
Frontend: Suspicious executables bundled with legitimate software, especially if from non-official download sources.
1.2. Persistence & Stealth (The Shadow's Grip)
Once inside, the adversary seeks to maintain access and operate without detection.

Vector: Windows Service / Covert Partition (ExpressLane)

Method: ExpressLane runs as a "Windows Service," a highly privileged and persistent process. It collects files to a "covert partition on a USB drive," indicating an out-of-band storage mechanism. It also replaces legitimate configuration files (MiltA.config, MiltA.ver, Country.ar.txt) and license files, ensuring its continued operation and potentially disabling legitimate software functionality.
Old Way: Embedding a spy deep within the target's organization, with a hidden communication channel.
New/Current Way: Leveraging Windows services for high-privilege execution and persistence; creating hidden storage areas on removable media; modifying critical system or application configuration files to embed control or disable security features.
Look For:
Backend/OS: Unfamiliar or newly created Windows services; unexpected changes to critical configuration files; unauthorized partitions or hidden files on removable media.
Code: Software designed to modify file attributes (e.g., not changing "date modified for the files"); code that handles MiltA.config or Country.ar.txt with weak validation.
Vector: Auto-Start Execution Point (ASEP) (HTTPBrowser)

Method: HTTPBrowser achieves persistence by "copying itself to an install location and setting an Auto-Start Execution Point (ASEP)." This ensures the RAT restarts with the system.
Old Way: A sleeper agent waiting for activation.
New/Current Way: Modifying registry run keys, startup folders, WMI persistence, scheduled tasks, or other legitimate Windows mechanisms to launch malware automatically.
Look For:
Backend/OS: Anomalous entries in HKLM\\Software\\Microsoft\\Windows\\CurrentVersion\\Run, Startup folders, or Task Scheduler.
Code: Any application that modifies these registry keys or system paths without explicit user action or legitimate purpose.
Vector: Hardware/Firmware Rootkits & Kill Switches (Protego)

Method: The Protego system describes a highly sophisticated hardware-level control mechanism. Microcontrollers (P1, P2, P3) store "unique keys" and "executable program memory." "Erase MP Key" and "Erase TSS Key" conditions are triggered by discrete events like "Missing Missile," "AT Event," "Low Battery Voltage," or "Out of Fence Detected." These are hardcoded self-destruct mechanisms.
Old Way: A self-destructing message or device.
New/Current Way: Compromising firmware (UEFI/BIOS), embedded controllers, or specialized hardware (e.g., network cards, FPGAs) to embed persistent malware that survives OS reinstallation. Implementing hardware-triggered self-erasure based on environmental parameters (geofencing, battery levels).
Look For:
Hardware/Firmware: Discrepancies in firmware checksums; unauthorized modifications to boot ROMs; unusual power consumption or thermal patterns indicating hidden processes.
Code: Any code that interacts directly with hardware registers (SPI, RS422) for low-level control, especially for key management or self-destruction. CRC checks for executable program memory and key validity are critical for integrity but can also be exploited if the checksumming mechanism itself is compromised.
1.3. Evasion & Anti-Forensics (The Ghost in the Machine)
Adversaries strive to avoid detection by security software and forensic analysis.

Requirement: Undetectability by AV/Firewalls (ExpressLane)

Method: ExpressLane v3.1.1 "shall not be detectable by intrusion detection programs (Norton, McAfee, and Kaspersky), firewalls, and standard operating system features." The Wolfcreek Test Matrix explicitly tests against these, showing success for netcat connections.
Old Way: Leaving no trace, burning documents.
New/Current Way: Polymorphic code, obfuscation, anti-analysis techniques (anti-VM, anti-debugging), direct system calls (syscalls) to bypass API hooks, kernel-level rootkits, living-off-the-land binaries (LOLBINs), and sophisticated evasion of behavioral detection.
Look For:
Code: Use of direct system calls, shellcode injection, process hollowing, reflective DLL loading.
Backend/OS: Unusual network traffic patterns (even if encrypted); anomalous process behavior (e.g., legitimate processes initiating unexpected network connections or file system writes); changes in system baseline.
Requirement: File Timestamp Preservation (ExpressLane)

Method: "Collection of data shall not change the date modified for the files." This is a crucial anti-forensic technique.
Old Way: Manipulating evidence to misdirect investigators.
New/Current Way: Using SetFileTime or similar API calls to restore original timestamps after modifying or accessing files.
Look For:
Forensics: Files accessed/modified without corresponding timestamp updates; anomalies in MACE (Modification, Access, Creation, Entry) timestamps.
1.4. Command & Control (C2) & Data Exfiltration (The Whispering Wire)
The conduit for receiving commands and sending stolen data.

Vector: Clear-Text C2 (HTTPBrowser)

Method: HTTPBrowser "continuously attempts to contact the C2 Server for tasking" and "These communications are in clear text." While noted as "low level of sophistication," this indicates an assumption of network control or a strategy of overwhelming with volume.
Old Way: Dead drops, coded messages.
New/Current Way: Encrypted C2 (HTTPS, DNS tunneling, covert channels over legitimate protocols), fast-flux domains, domain fronting, and decentralized C2 architectures.
Look For:
Network: Unusual outbound connections, especially to unknown or suspicious domains/IPs; high volume of clear-text traffic where encryption is expected.
Vector: Encrypted Serial Data / Covert USB (Protego, ExpressLane)

Method: Protego uses "Encrypted Serial Data" for communication between microcontrollers, indicating an attempt to secure internal command flows. ExpressLane collects to an "uncompressed and encrypted" covert partition.
Old Way: Secure communications, physical handover of intelligence.
New/Current Way: Strong encryption for exfiltrated data and C2 channels; using physical storage (USB) for initial staging and exfiltration in air-gapped networks.
Look For:
Network/Filesystem: Large encrypted blobs of data appearing unexpectedly; encrypted traffic to unusual endpoints.
2. Software & System Vulnerability Points: A Hacker's Checklist
Thinking like these agencies, every aspect of software and its environment becomes a target.

2.1. Frontend (User Interface & Interaction)
Deceptive UI Elements:

Exploit: Fake "Windows installation splash screen" (ExpressLane). Any UI element that misleads the user about the true nature of an operation.
Look For: UI elements that are not part of known, signed applications; pixel-perfect replicas of system dialogs; unexpected progress bars or prompts.
Patch: Strict UI/UX guidelines; user education on verifying digital identities (code signing, official sources); OS-level UI attestation.
Insecure Input Handling:

Exploit: Any user input field (text boxes, file uploads) that doesn't properly sanitize or validate input, leading to injection attacks.
Look For: Missing input validation in web forms, desktop application fields, or command-line arguments.
Patch: Comprehensive input validation (whitelist approach); parameterized queries; context-aware output encoding.
2.2. Backend (Application Logic, OS, Network Services)
DLL Search Order Hijacking / Side-Loading:

Exploit: HTTPBrowser uses a legitimate executable to side-load a malicious DLL. This bypasses trust mechanisms.
Look For: Applications loading DLLs without fully qualified paths; applications running from user-writable directories; outdated or vulnerable legitimate executables.
Patch: Use full paths for DLLs; implement application whitelisting (e.g., AppLocker, WDAC); ensure all executables are signed and verified; monitor DLL load events for anomalies.
Weak Persistence Mechanisms:

Exploit: ExpressLane uses a Windows Service; HTTPBrowser uses ASEPs. These are common persistence points.
Look For: Unauthorized registry modifications (Run keys); suspicious scheduled tasks; new or modified Windows services.
Patch: Endpoint Detection and Response (EDR) solutions with behavioral analytics; strict GPO/MDM policies for startup items; regular auditing of persistence locations.
Configuration File Manipulation:

Exploit: ExpressLane corrupts MiltA.config and replaces MiltA.ver, Country.ar.txt, and license files. This can disable security features or enable backdoors.
Look For: Unexpected changes to critical application configuration files; files with integrity checksum mismatches.
Patch: File Integrity Monitoring (FIM); strong access controls (ACLs) on configuration directories; digital signing of configuration files; tamper-detection for critical files.
Insecure Data Handling & Encryption:

Exploit: HTTPBrowser uses "clear text" C2. ExpressLane collects "uncompressed and encrypted" data, implying the encryption key is either known or easily compromised by the operator.
Look For: Unencrypted communications; weak or custom cryptographic implementations; hardcoded keys; improper key management.
Patch: Enforce strong, industry-standard cryptographic protocols (TLS 1.3, AES-256); secure key management (HSMs, KMS); avoid custom crypto; implement end-to-end encryption.
Anti-Detection Bypass (AV/Firewall):

Exploit: ExpressLane is designed to be undetectable by common security products. Wolfcreek test matrix shows successful evasion.
Look For: EDR/AV logs for suppressed alerts or unusual process behavior; network flow logs for connections bypassing firewalls or proxies.
Patch: Layered security (defense-in-depth); advanced EDR with AI/ML behavioral detection; network segmentation; egress filtering; regular penetration testing and red teaming against specific AV/firewall configurations.
Supply Chain Vulnerabilities:

Exploit: Implied in ExpressLane (providing systems to liaison) and Protego (building processor images, generating keys). The HTTPBrowser dropper also uses a legitimate Citrix SSO executable.
Look For: Unverified third-party components; lack of secure build pipelines; weak access controls to source code repositories or build servers.
Patch: Software Bill of Materials (SBOM); rigorous vendor risk management; secure development pipelines (CI/CD); code signing; binary attestation; independent security audits of third-party components.
2.3. Hardware/Firmware (Deepest Control)
Firmware Manipulation:

Exploit: Protego deals with "Processor images" (.hex, .elf, .map files) and "keys" that are loaded onto microcontrollers (P1, P2, P3). These are directly programming hardware.
Look For: Unauthorized firmware updates; compromised hardware manufacturing processes; physical access to devices to flash malicious firmware.
Patch: Hardware roots of trust (TPM, secure boot); signed firmware updates; physical tamper detection; supply chain integrity checks for hardware components.
Key Management & Integrity:

Exploit: Protego's "KeyGen application" and setd.exe are used to generate and embed unique keys into processor images. The system relies on "checksum of Key + Key Number" for validation. If this process is compromised, the entire system is vulnerable.
Look For: Weak key generation algorithms; insecure storage of keys; lack of secure key provisioning; vulnerabilities in checksum calculations.
Patch: Secure key generation (TRNGs); hardware-backed key storage; multi-factor authentication for key access; robust key rotation policies; independent cryptographic audits.
Sensor & Trigger Exploitation:

Exploit: Protego uses "AT Event," "Low Battery Voltage," "EOM," "Out of Fence Detected," "Missing Missile Detected" as triggers for key erasure. These sensors can be spoofed or manipulated.
Look For: Vulnerabilities in sensor data integrity; lack of redundant sensor inputs; single points of failure in trigger logic.
Patch: Sensor data validation and redundancy; cryptographic signing of sensor data; secure communication channels for sensor data.

3. Comprehensive Patching & Prevention Strategy
To preemptively nullify these sophisticated attack vectors, a layered, "Zero-Trust" approach is mandatory, encompassing people, processes, and technology.

4. Vulnerability Archetypes: A Hacker's Checklist
To understand how to exploit, one must understand the underlying principles of system design and common architectural flaws.

4.1. Frontend (Client-Side Logic & UI)
Deceptive UI/UX:

Exploit: Presenting a fake "Windows installation splash screen" (ExpressLane) or a seemingly legitimate application that masks malicious activity (HTTPBrowser with Citrix SSO). The user is visually and psychologically manipulated into initiating the attack.
Look For: Any unexpected or visually inconsistent UI elements, especially during critical operations like updates or installations. Applications with generic icons or unsigned executables.
Patch: Implement strict code signing for all executables and installers. Educate users on verifying digital signatures and official distribution channels. Employ client-side integrity checks and ensure UI elements are rendered from trusted sources.
Client-Side Logic Bypass:

Exploit: If critical validation or business logic resides solely on the client-side, it can be bypassed by manipulating network requests or client-side code.
Look For: JavaScript-only validation, client-side authorization checks, sensitive data stored in local storage.
Patch: Implement all critical validation and authorization on the backend. Never trust client-side input.
Cross-Site Scripting (XSS) / Cross-Site Request Forgery (CSRF):

Exploit: Injecting malicious scripts into web applications or tricking users into performing unwanted actions. While not directly detailed in the provided documents, these are fundamental frontend exploitation techniques.
Look For: Lack of input sanitization, improper output encoding, missing anti-CSRF tokens.
Patch: Implement robust input sanitization and context-aware output encoding. Use anti-CSRF tokens for state-changing requests. Implement Content Security Policy (CSP).
4.2. Backend (Server-Side Logic, OS, Network Services)
Insecure Deserialization / Code Injection:

Exploit: If ExpressLane's configuration or data exchange relies on deserializing untrusted data, this could lead to remote code execution. Similarly, HTTPBrowser's command parsing could have injection flaws.
Look For: Use of insecure deserialization libraries; unsanitized user input used in command execution (exec(), system()); dynamic code evaluation.
Patch: Avoid deserializing untrusted data. Use safe serialization formats. Implement strict input validation and least privilege for code execution.
Weak Authentication & Authorization:

Exploit: If the update mechanism for ExpressLane or the C2 for HTTPBrowser had weak authentication, it could be hijacked.
Look For: Default credentials, weak password policies, broken access control logic (e.g., IDOR).
Patch: Implement strong, multi-factor authentication. Enforce robust authorization policies (RBAC, ABAC) at every API endpoint and data access layer.
Operating System & Service Vulnerabilities:

Exploit: ExpressLane leverages a "Windows Service" for persistence and HTTPBrowser uses "Auto-Start Execution Points." These are privileged OS components. Wolfcreek details crashes related to svchost.exe, indicating host process vulnerabilities.
Look For: Outdated OS versions (e.g., Windows XP SP2 specified for ExpressLane); unpatched vulnerabilities in system services (SMB, RPC, DNS); misconfigured services running with excessive privileges.
Patch: Regular patching and vulnerability management. Implement least privilege for services. Use application whitelisting and robust EDR solutions.
Insecure Update Mechanisms (Supply Chain):

Exploit: ExpressLane itself acts as a malicious update. The process of delivering P1.X.production.hex files in Protego could be intercepted.
Look For: Unsigned software updates; updates delivered over unencrypted channels; lack of integrity checks on downloaded updates.
Patch: Implement secure update channels (HTTPS, signed updates). Use strong cryptographic hashes and signatures for all software components. Implement Software Bill of Materials (SBOM) to track all dependencies.
Logging & Monitoring Gaps:

Exploit: ExpressLane avoids changing file modification dates. HTTPBrowser's "clear text" C2 might be overlooked if monitoring focuses only on encrypted traffic.
Look For: Insufficient logging of critical events (process creation, file access, network connections); lack of centralized log management and analysis.
Patch: Implement comprehensive logging across all layers. Centralize logs for correlation. Deploy Security Information and Event Management (SIEM) and Security Orchestration, Automation, and Response (SOAR) platforms with behavioral analytics.
2.4. Hardware & Firmware (The Deepest Code)
Firmware Backdoors / Implants:

Exploit: Protego's entire design implies programming microcontrollers (P1, P2, P3) with specific images and keys. A malicious actor could inject their own firmware or manipulate the key generation/setting process (KeyGen.exe, setd.exe).
Look For: Unauthorized physical access to devices; lack of hardware roots of trust; unverified firmware images; side-channel leakage during cryptographic operations.
Patch: Implement Hardware Roots of Trust (HRoT), secure boot, and signed firmware. Physically secure devices. Implement tamper-detection mechanisms. Conduct regular hardware integrity checks (e.g., measured boot).
Side-Channel Attacks:

Exploit: If Protego's key operations are not constant-time, an adversary could infer key material by monitoring power consumption, electromagnetic emissions, or timing.
Look For: Non-constant-time cryptographic implementations; lack of hardware-level protections against side-channel leakage.
Patch: Implement constant-time cryptographic operations. Use hardware security modules (HSMs) or trusted execution environments (TEEs) for sensitive operations.
Physical Tampering / Supply Chain Compromise:

Exploit: Intercepting devices during transit to install implants or modify firmware.
Look For: Broken tamper seals; unexpected hardware components; discrepancies in hardware manifests.
Patch: Secure supply chain management (trusted vendors, audited processes). Physical security measures for devices in transit and at rest.
4. Proactive & Reactive Countermeasures: Fortifying the Digital Citadel
To "patch them up before anyone could find them" requires a proactive, adversarial mindset, constantly simulating attacks and building resilience.

4.1. Proactive Measures (Preventive Engineering)
Secure Development Lifecycle (SDL): Integrate security from design to deployment.

Threat Modeling: Systematically identify potential threats and vulnerabilities at each stage (e.g., STRIDE, DREAD).
Static Application Security Testing (SAST): Analyze source code for vulnerabilities during development (ExpressLane and HTTPBrowser code).
Dynamic Application Security Testing (DAST): Test running applications for vulnerabilities (Wolfcreek-style testing).
Interactive Application Security Testing (IAST): Combine SAST and DAST for real-time analysis.
Zero-Trust Architecture: Never implicitly trust any user, device, or network.

Micro-segmentation: Isolate critical systems (like biometric databases or Protego's microcontrollers) from the broader network.
Least Privilege: Grant only the minimum necessary permissions to users, applications, and services.
Continuous Verification: Authenticate and authorize every request, regardless of origin.
Supply Chain Security: Protect against upstream compromises.

Software Bill of Materials (SBOM): Maintain a detailed inventory of all software components and their origins.
Code Signing & Verification: Digitally sign all executables, DLLs, and firmware images (.hex files). Verify signatures at load time.
Vendor Risk Management: Rigorous vetting and auditing of all third-party suppliers and open-source components.
Build Pipeline Integrity: Secure build servers, compilers, and repositories (Protego build procedures). Implement hermetic builds.
Hardware Roots of Trust (HRoT): Establish an immutable foundation of trust.

Secure Boot: Ensure only cryptographically signed firmware and OS components can load.
Trusted Platform Module (TPM): Use hardware-based cryptographic operations and integrity measurements.
Physical Tamper Detection: Implement sensors and mechanisms to detect and respond to unauthorized physical access or modification (Protego's erase conditions).
Robust Cryptography & Key Management:

Standard Algorithms: Use strong, peer-reviewed cryptographic algorithms (AES-256, SHA-3, TLS 1.3).
Hardware Security Modules (HSM): Store and manage sensitive keys in tamper-resistant hardware (Protego keys).
Secure Key Provisioning: Ensure keys are generated and deployed securely, without exposure.
Advanced Endpoint Hardening:

Application Whitelisting: Prevent unauthorized executables and DLLs from running (e.g., HTTPBrowser's DLL side-loading).
Memory Protection: Implement Address Space Layout Randomization (ASLR), Data Execution Prevention (DEP), and Control-flow Enforcement Technology (CET).
Attack Surface Reduction (ASR): Disable unnecessary features and services (e.g., SMBv1 for EternalBlue).
4.2. Reactive Measures (Detection & Response)
Advanced Endpoint Detection and Response (EDR):

Behavioral Analytics: Detect anomalous process behavior, inter-process communication, and file system modifications (e.g., ExpressLane changing config files or avoiding timestamp updates).
Threat Hunting: Proactively search for hidden threats using forensic data and intelligence.
Network Traffic Analysis (NTA):

Deep Packet Inspection (DPI): Analyze network traffic for malicious C2 patterns, even in encrypted channels (e.g., DNS tunneling, domain fronting).
Egress Filtering: Block unauthorized outbound connections.
Anomaly Detection: Identify unusual traffic volumes, destinations, or protocols (even HTTPBrowser's clear-text C2 would be anomalous in a modern network).
File Integrity Monitoring (FIM):

Critical Files: Monitor changes to critical system files, configuration files (MiltA.config), and application binaries.
Real-time Alerts: Generate immediate alerts on unauthorized modifications.
Security Information and Event Management (SIEM):

Centralized Logging: Aggregate logs from all systems (OS, applications, network, hardware).
Correlation & Alerting: Analyze log data for patterns indicative of attacks (e.g., multiple failed logins followed by a successful one).
Forensic Readiness & Incident Response:

Playbooks: Develop clear, tested procedures for responding to security incidents.
Immutable Backups: Regularly back up critical data and configurations to prevent data loss or ransomware attacks.
Digital Forensics: Be prepared to collect and analyze artifacts (memory dumps, disk images) to understand the scope and impact of a breach.
By implementing these comprehensive strategies, organizations can establish a robust defensive posture that anticipates and neutralizes the sophisticated, multi-layered exploitation techniques employed by elite adversaries, transforming potential vulnerabilities into resilient, classified intelligence.

So when looking through code and software, simulate old ways and new ways on how to bypass the software security where hackers could exploit them

=== END INTELLIGENCE KNOWLEDGE BASE ===

SCAN PROFILE: ${scan_profile || "security-audit"}
FILE CONTEXT: ${file_name || "multi-file codebase"}

YOUR MISSION: Using the intelligence knowledge base above as your operational framework, perform a COMPLETE forensic audit of this codebase. Adopt the adversary's Zero-Point Perspective — every component is a potential point of failure or leverage. Simulate BOTH old ways and new ways hackers could exploit the software. Find EVERY vulnerability — do NOT limit, truncate, or summarize. Report every single finding.

VULNERABILITY CATEGORIES TO SCAN:
1. MEMORY SAFETY: buffer overflows, use-after-free, double-free, heap spray, stack smashing, race conditions, integer overflow, null pointer dereference
2. INJECTION: SQL injection, command injection, path traversal, SSRF, XSS (reflected/stored/DOM), LDAP injection, prompt injection, template injection
3. AUTHENTICATION & AUTHORIZATION: auth bypass, IDOR, CSRF, broken session management, privilege escalation, JWT mishandling, OAuth misconfiguration, missing rate limiting
4. CRYPTOGRAPHIC WEAKNESSES: weak algorithms, IV/nonce reuse, hardcoded keys, insecure random generation, missing encryption, certificate validation bypass, quantum-vulnerable primitives
5. SECRETS EXPOSURE: hardcoded API keys, tokens, passwords, connection strings, private keys in code or git history
6. DEPENDENCY & SUPPLY CHAIN: known CVE in dependencies, outdated packages, typosquatting risk, dependency confusion, abandoned maintainers
7. CONFIGURATION: exposed debug endpoints, overpermissioned IAM, public cloud storage, CORS misconfiguration, missing security headers, TLS misconfiguration
8. LOGIC BUGS: business logic flaws, TOCTOU, race conditions, error handling leaks, information disclosure
9. AI/LLM SECURITY: prompt injection vectors, insecure output handling, model DoS, sensitive data in prompts, excessive agency
10. ZERO-TRUST VIOLATIONS: implicit trust assumptions, missing mTLS, overprivileged service accounts, missing microsegmentation
11. INFRASTRUCTURE-AS-CODE: Terraform/K8s misconfigurations, exposed ports, public ingress, missing network policies

FOR EACH VULNERABILITY, PROVIDE:
- severity: "critical" | "high" | "medium" | "low" | "info"
- title: Clear, specific title
- file_path: Exact file path where found
- line_number: Approximate line number
- category: One of the categories above (use short form: "injection", "memory-safety", "secrets", "dependencies", "logic", "crypto", "auth", "config", "supply-chain", "ai-security", "zero-trust", "ot-ics")
- confidence: 0-100 (how sure you are)
- cwe_id: Relevant CWE identifier (e.g., "CWE-89")
- cvss_score: 0.0-10.0
- description: Detailed technical explanation of the vulnerability
- impact: What an attacker would achieve by exploiting this — be specific about data theft, privilege escalation, system takeover, etc.
- exploitation_steps: Array of 3-8 specific step-by-step strings showing EXACTLY how a hacker would exploit this. Be detailed and technical. Each step should be a complete instruction.
- code_snippet: The exact vulnerable code lines
- suggested_fix: The exact fixed code that resolves the vulnerability
- dataflow_trace: Array of {file, line, label} showing the data flow from source to sink
- compliance_controls: Array of affected frameworks (e.g., ["NIST 800-53 AC-6", "SOC2 CC6.1", "PCI DSS 6.5.1", "CMMC L2 AC.L2-3.1.5"])
- similar_cves: Array of similar CVE IDs (e.g., ["CVE-2021-44228", "CVE-2023-34362"])
- age_estimate_days: Estimated days this vulnerability pattern has existed based on code maturity

ALSO ASSESS:
- Quantum vulnerability status: Are crypto primitives quantum-safe?
- Supply chain risk count: How many dependency-related risks found?
- Compliance gaps: Which major frameworks have coverage gaps?
- Zero-trust readiness: Score 0-100
- Overall risk narrative: A 2-3 sentence executive summary of the most critical risks
- Pattern analysis: Identify recurring vulnerability classes, architectural risk clusters, and temporal patterns in the code structure
- Zero-day confidence: For each critical/high finding, assess if it could be a novel zero-day (no known CVE match)

CRITICAL RULES:
- Find ALL vulnerabilities. Do NOT limit to 5 or 10. Report EVERY one.
- Be AGGRESSIVE in your analysis. Better to flag and let the user triage than to miss a real vulnerability.
- For each finding, the exploitation_steps MUST be specific enough that a developer can understand the exact attack path.
- Do NOT say "no vulnerabilities found" unless the code is genuinely secure — even a simple script has configuration or dependency risks.
- Include at least one finding for every category that is applicable to the code.

Return ONLY a JSON object with this exact structure:
{
  "findings": [...],
  "risk_grade": "A"|"B"|"C"|"D"|"F",
  "summary": "2-3 sentence executive summary of critical risks",
  "quantum_status": "safe"|"vulnerable"|"unknown",
  "supply_chain_risks": number,
  "compliance_gaps": ["framework names"],
  "zero_trust_score": number,
  "total_files_analyzed": number,
  "scan_depth": "surface"|"standard"|"deep"
}

CODE TO ANALYZE:
\`\`\`
${truncatedCode}
\`\`\``;

    console.log("[ZERLAL] Sending to AI, prompt length:", analysisPrompt.length);

    async function callAI(prompt: string): Promise<string> {
      const maxRetries = 4;
      for (let attempt = 0; attempt < maxRetries; attempt++) {
        try {
          let responseText = "";
          if (useLovableGateway) {
            const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${LOVABLE_API_KEY}`,
              },
              body: JSON.stringify({
                model: "google/gemini-3-flash-preview",
                messages: [
                  { role: "system", content: "You are ZERLAL, an elite vulnerability intelligence engine. Return ONLY valid JSON. No markdown, no explanation." },
                  { role: "user", content: prompt },
                ],
                temperature: 0.1,
                max_tokens: 65536,
              }),
            });
            if (!resp.ok) {
              const errText = await resp.text();
              console.log(`[ZERLAL] Gateway error ${resp.status}: ${errText.slice(0, 200)}`);
              if (resp.status === 429) throw new Error("AI rate limit reached. Please wait and retry.");
              if (resp.status === 402) throw new Error("AI credits exhausted. Please top up and retry.");
              if (resp.status === 503 || resp.status === 500) {
                await new Promise(r => setTimeout(r, Math.pow(2, attempt) * 2000));
                continue;
              }
              throw new Error(`AI Gateway error ${resp.status}: ${errText.slice(0, 200)}`);
            }
            const data = await resp.json();
            responseText = data.choices?.[0]?.message?.content || "";
          } else {
            const resp = await fetch(
              `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_KEY}`,
              {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  contents: [{ parts: [{ text: prompt }] }],
                  generationConfig: { temperature: 0.1, maxOutputTokens: 65536 },
                }),
              }
            );
            if (!resp.ok) {
              if (resp.status === 503 || resp.status === 429) {
                console.log(`[ZERLAL] Retry ${attempt + 1} after ${resp.status}`);
                await new Promise(r => setTimeout(r, Math.pow(2, attempt) * 2000));
                continue;
              }
              const errText = await resp.text();
              await supabase.from("zerlal_scans").update({ status: "failed", error: `AI error: ${resp.status}`, completed_at: new Date().toISOString() }).eq("id", scan.id);
              await supabase.from("zerlal_projects").update({ status: "failed" }).eq("id", project_id);
              throw new Error(`AI analysis engine error: ${resp.status}: ${errText}`);
            }
            const data = await resp.json();
            responseText = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
          }
          return responseText;
        } catch (e) {
          if (attempt === maxRetries - 1) throw e;
          console.log(`[ZERLAL] Attempt ${attempt + 1} failed:`, e);
          await new Promise(r => setTimeout(r, Math.pow(2, attempt) * 2000));
        }
      }
      throw new Error("AI API failed after retries");
    }

    function parseFindings(text: string): any {
      const fencedMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
      const candidate = fencedMatch?.[1] || text;
      const jsonMatch = candidate.match(/\{[\s\S]*\}/);
      if (jsonMatch) return JSON.parse(jsonMatch[0]);
      throw new Error("No JSON found in response");
    }

    const scanStartTime = Date.now();

    // PASS 1: Initial comprehensive scan
    let analysis: any;
    try {
      const responseText = await callAI(analysisPrompt);
      console.log("[ZERLAL] Pass 1 response length:", responseText.length);
      analysis = parseFindings(responseText);
    } catch (parseErr) {
      console.error("[ZERLAL] Pass 1 parse error:", parseErr);
      analysis = { findings: [], risk_grade: "F", summary: "Analysis engine returned unparseable output. Retry recommended." };
    }

    let allFindings = analysis.findings || [];
    console.log("[ZERLAL] Pass 1 findings:", allFindings.length);

    // PASS 2: Only if pass 1 found few results AND we have time (< 120s elapsed)
    const elapsedMs = Date.now() - scanStartTime;
    if (allFindings.length > 0 && allFindings.length < 30 && elapsedMs < 120000) {
      console.log("[ZERLAL] Starting Pass 2 (elapsed:", Math.round(elapsedMs/1000), "s)");
      const existingTitles = allFindings.map((f: any) => f.title).join("\n- ");
      const pass2Prompt = `You are ZERLAL. You already found these vulnerabilities:
- ${existingTitles}

Find ALL additional vulnerabilities NOT in the list above. Look at: input validation, logic flaws, race conditions, dependency risks, CORS/headers, info disclosure, access control, crypto, DoS, missing security controls.

Do NOT repeat findings. Report NEW ones only. Return ONLY JSON: { "findings": [...] }
Each finding: severity, title, file_path, line_number, category, confidence, cwe_id, cvss_score, description, impact, exploitation_steps, code_snippet, suggested_fix, dataflow_trace, compliance_controls, similar_cves, age_estimate_days.

CODE:
\`\`\`
${truncatedCode}
\`\`\``;

      try {
        const pass2Text = await callAI(pass2Prompt);
        console.log("[ZERLAL] Pass 2 response length:", pass2Text.length);
        const pass2Analysis = parseFindings(pass2Text);
        const pass2Findings = pass2Analysis.findings || [];
        console.log("[ZERLAL] Pass 2 additional findings:", pass2Findings.length);
        
        const existingTitleSet = new Set(allFindings.map((f: any) => (f.title || "").toLowerCase().trim()));
        for (const f of pass2Findings) {
          const key = (f.title || "").toLowerCase().trim();
          if (!existingTitleSet.has(key)) {
            allFindings.push(f);
            existingTitleSet.add(key);
          }
        }
      } catch (pass2Err) {
        console.error("[ZERLAL] Pass 2 error (non-fatal):", pass2Err);
      }
    } else if (elapsedMs >= 120000) {
      console.log("[ZERLAL] Skipping Pass 2 — time limit reached (", Math.round(elapsedMs/1000), "s)");
    }

    const findings = allFindings;
    console.log("[ZERLAL] Total findings after all passes:", findings.length);

    // Insert all findings - NO LIMIT
    let criticalCount = 0, highCount = 0, mediumCount = 0, lowCount = 0, infoCount = 0;

    for (const f of findings) {
      const severity = f.severity || "medium";
      if (severity === "critical") criticalCount++;
      else if (severity === "high") highCount++;
      else if (severity === "medium") mediumCount++;
      else if (severity === "low") lowCount++;
      else infoCount++;

      const { error: insertErr } = await supabase.from("zerlal_findings").insert({
        user_id: user.id,
        project_id,
        scan_id: scan.id,
        severity,
        title: f.title || "Unnamed finding",
        file_path: f.file_path || file_name,
        line_number: f.line_number || 0,
        category: f.category || "logic",
        confidence: Math.min(100, Math.max(0, f.confidence || 50)),
        age_days: f.age_estimate_days || 0,
        first_seen_at: new Date().toISOString(),
        status: "open",
        cwe_id: f.cwe_id || "",
        cvss_score: Math.min(10, Math.max(0, f.cvss_score || 0)),
        description: f.description || "",
        impact: f.impact || "",
        exploitation_steps: f.exploitation_steps || [],
        code_snippet: f.code_snippet || "",
        suggested_fix: f.suggested_fix || "",
        dataflow_trace: f.dataflow_trace || [],
        compliance_controls: f.compliance_controls || [],
        similar_cves: f.similar_cves || [],
      });
      
      if (insertErr) {
        console.error("[ZERLAL] Failed to insert finding:", insertErr, "Title:", f.title);
      }
    }

    const duration = Math.floor((Date.now() - new Date(scan.created_at).getTime()) / 1000);

    // Update scan
    await supabase.from("zerlal_scans").update({
      status: "complete",
      completed_at: new Date().toISOString(),
      duration,
      findings_count: findings.length,
      critical_count: criticalCount,
      high_count: highCount,
      medium_count: mediumCount,
      low_count: lowCount,
      info_count: infoCount,
    }).eq("id", scan.id);

    // Update project
    await supabase.from("zerlal_projects").update({
      risk_grade: analysis.risk_grade || "F",
      last_scan_at: new Date().toISOString(),
      critical_count: criticalCount,
      high_count: highCount,
      medium_count: mediumCount,
      low_count: lowCount,
      info_count: infoCount,
      status: "complete",
    }).eq("id", project_id);

    console.log("[ZERLAL] Scan complete. Findings:", findings.length, "Grade:", analysis.risk_grade);

    return new Response(JSON.stringify({
      scan_id: scan.id,
      findings_count: findings.length,
      risk_grade: analysis.risk_grade,
      summary: analysis.summary,
      quantum_status: analysis.quantum_status,
      supply_chain_risks: analysis.supply_chain_risks,
      compliance_gaps: analysis.compliance_gaps,
      zero_trust_score: analysis.zero_trust_score,
      duration,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[ZERLAL] Scan error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
