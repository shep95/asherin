/**
 * CIPHER — Sovereign Data Operations Toolkit
 * Inspired by intelligence-grade data analysis tools.
 * Encoding, hashing, encryption, format conversion, recipe chaining.
 * All operations run client-side — zero data leaves the browser.
 */
import { useState, useCallback, useMemo } from "react";
import {
  Hash, Lock, Unlock, Code2, ArrowRightLeft, Plus, Trash2, Play,
  Copy, Download, Upload, ChevronDown, ChevronUp, GripVertical,
  Shield, FileText, Binary, Globe, Fingerprint, RefreshCw, Layers,
  AlertTriangle, Check, X, Search, Zap
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import EncryptionBadge from "@/components/dashboard/EncryptionBadge";

// ─── OPERATION DEFINITIONS ───
interface CipherOperation {
  id: string;
  name: string;
  category: string;
  icon: React.ElementType;
  description: string;
  execute: (input: string, params?: Record<string, string>) => Promise<string>;
  params?: { key: string; label: string; type: "text" | "select"; options?: string[]; default?: string }[];
}

// ─── RECIPE STEP ───
interface RecipeStep {
  id: string;
  operationId: string;
  params: Record<string, string>;
  enabled: boolean;
}

// ─── UTILITY FUNCTIONS ───
function hexEncode(str: string): string {
  return Array.from(new TextEncoder().encode(str)).map(b => b.toString(16).padStart(2, "0")).join(" ");
}
function hexDecode(hex: string): string {
  const bytes = hex.trim().split(/\s+/).map(h => parseInt(h, 16));
  return new TextDecoder().decode(new Uint8Array(bytes));
}
function rot13(str: string): string {
  return str.replace(/[a-zA-Z]/g, c => {
    const base = c <= "Z" ? 65 : 97;
    return String.fromCharCode(((c.charCodeAt(0) - base + 13) % 26) + base);
  });
}
function xorCipher(str: string, key: string): string {
  if (!key) return str;
  return Array.from(str).map((c, i) =>
    String.fromCharCode(c.charCodeAt(0) ^ key.charCodeAt(i % key.length))
  ).join("");
}
function defangUrl(url: string): string {
  return url.replace(/\./g, "[.]").replace(/http/g, "hxxp").replace(/:\/\//g, "[://]");
}
function refangUrl(url: string): string {
  return url.replace(/\[\.\]/g, ".").replace(/hxxp/g, "http").replace(/\[:\/\/\]/g, "://");
}
function extractUrls(text: string): string {
  const matches = text.match(/https?:\/\/[^\s<>"{}|\\^`\[\]]+/g);
  return matches ? matches.join("\n") : "(no URLs found)";
}
function extractEmails(text: string): string {
  const matches = text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g);
  return matches ? [...new Set(matches)].join("\n") : "(no emails found)";
}
function extractIPs(text: string): string {
  const matches = text.match(/\b(?:\d{1,3}\.){3}\d{1,3}\b/g);
  return matches ? [...new Set(matches)].join("\n") : "(no IPs found)";
}
function entropy(str: string): string {
  if (!str) return "0";
  const freq: Record<string, number> = {};
  for (const c of str) freq[c] = (freq[c] || 0) + 1;
  const len = str.length;
  let ent = 0;
  for (const k in freq) {
    const p = freq[k] / len;
    ent -= p * Math.log2(p);
  }
  return `Shannon Entropy: ${ent.toFixed(4)} bits/char\nMax possible: ${Math.log2(Object.keys(freq).length).toFixed(4)} bits/char\nLength: ${len} chars\nUnique chars: ${Object.keys(freq).length}`;
}
function charFrequency(str: string): string {
  const freq: Record<string, number> = {};
  for (const c of str) freq[c] = (freq[c] || 0) + 1;
  return Object.entries(freq)
    .sort((a, b) => b[1] - a[1])
    .map(([ch, count]) => `${ch === " " ? "SP" : ch === "\n" ? "NL" : ch === "\t" ? "TAB" : ch}: ${count}`)
    .join("\n");
}

async function sha256(str: string): Promise<string> {
  const data = new TextEncoder().encode(str);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, "0")).join("");
}
async function sha512(str: string): Promise<string> {
  const data = new TextEncoder().encode(str);
  const hash = await crypto.subtle.digest("SHA-512", data);
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, "0")).join("");
}
async function sha1(str: string): Promise<string> {
  const data = new TextEncoder().encode(str);
  const hash = await crypto.subtle.digest("SHA-1", data);
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, "0")).join("");
}

// ─── ALL OPERATIONS ───
const OPERATIONS: CipherOperation[] = [
  // ENCODING
  { id: "base64-encode", name: "Base64 Encode", category: "Encoding", icon: Code2, description: "Encode text to Base64",
    execute: async (input) => btoa(unescape(encodeURIComponent(input))) },
  { id: "base64-decode", name: "Base64 Decode", category: "Encoding", icon: Code2, description: "Decode Base64 to text",
    execute: async (input) => { try { return decodeURIComponent(escape(atob(input.trim()))); } catch { return "[Error: Invalid Base64]"; } } },
  { id: "url-encode", name: "URL Encode", category: "Encoding", icon: Globe, description: "Percent-encode for URLs",
    execute: async (input) => encodeURIComponent(input) },
  { id: "url-decode", name: "URL Decode", category: "Encoding", icon: Globe, description: "Decode percent-encoded strings",
    execute: async (input) => { try { return decodeURIComponent(input); } catch { return "[Error: Invalid URL encoding]"; } } },
  { id: "hex-encode", name: "Hex Encode", category: "Encoding", icon: Binary, description: "Convert text to hexadecimal",
    execute: async (input) => hexEncode(input) },
  { id: "hex-decode", name: "Hex Decode", category: "Encoding", icon: Binary, description: "Convert hexadecimal to text",
    execute: async (input) => { try { return hexDecode(input); } catch { return "[Error: Invalid hex]"; } } },
  { id: "html-encode", name: "HTML Encode", category: "Encoding", icon: Code2, description: "Escape HTML entities",
    execute: async (input) => input.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#039;") },
  { id: "html-decode", name: "HTML Decode", category: "Encoding", icon: Code2, description: "Unescape HTML entities",
    execute: async (input) => { const el = document.createElement("textarea"); el.innerHTML = input; return el.value; } },
  { id: "unicode-escape", name: "Unicode Escape", category: "Encoding", icon: Code2, description: "Convert to \\uXXXX notation",
    execute: async (input) => Array.from(input).map(c => "\\u" + c.charCodeAt(0).toString(16).padStart(4, "0")).join("") },
  { id: "binary-encode", name: "Binary Encode", category: "Encoding", icon: Binary, description: "Convert text to binary",
    execute: async (input) => Array.from(new TextEncoder().encode(input)).map(b => b.toString(2).padStart(8, "0")).join(" ") },

  // HASHING
  { id: "sha256", name: "SHA-256", category: "Hashing", icon: Fingerprint, description: "SHA-256 cryptographic hash",
    execute: async (input) => sha256(input) },
  { id: "sha512", name: "SHA-512", category: "Hashing", icon: Fingerprint, description: "SHA-512 cryptographic hash",
    execute: async (input) => sha512(input) },
  { id: "sha1", name: "SHA-1", category: "Hashing", icon: Fingerprint, description: "SHA-1 hash (deprecated for security)",
    execute: async (input) => sha1(input) },
  { id: "hash-all", name: "All Hashes", category: "Hashing", icon: Fingerprint, description: "Compute SHA-1, SHA-256, SHA-512",
    execute: async (input) => {
      const [s1, s256, s512] = await Promise.all([sha1(input), sha256(input), sha512(input)]);
      return `SHA-1:   ${s1}\nSHA-256: ${s256}\nSHA-512: ${s512}`;
    } },

  // ENCRYPTION
  { id: "rot13", name: "ROT13", category: "Encryption", icon: Lock, description: "Simple letter substitution cipher",
    execute: async (input) => rot13(input) },
  { id: "xor", name: "XOR Cipher", category: "Encryption", icon: Lock, description: "XOR with a key string",
    execute: async (input, params) => {
      const key = params?.key || "aureon";
      const result = xorCipher(input, key);
      return btoa(result);
    },
    params: [{ key: "key", label: "XOR Key", type: "text", default: "aureon" }] },
  { id: "xor-decrypt", name: "XOR Decrypt", category: "Encryption", icon: Unlock, description: "Decrypt XOR (Base64 input)",
    execute: async (input, params) => {
      const key = params?.key || "aureon";
      try { return xorCipher(atob(input.trim()), key); } catch { return "[Error: Invalid Base64 input]"; }
    },
    params: [{ key: "key", label: "XOR Key", type: "text", default: "aureon" }] },
  { id: "aes-encrypt", name: "AES-256-GCM Encrypt", category: "Encryption", icon: Lock, description: "Encrypt with AES-256-GCM (Web Crypto)",
    execute: async (input, params) => {
      const password = params?.password || "default-key";
      const enc = new TextEncoder();
      const keyMaterial = await crypto.subtle.importKey("raw", enc.encode(password), "PBKDF2", false, ["deriveKey"]);
      const salt = crypto.getRandomValues(new Uint8Array(16));
      const key = await crypto.subtle.deriveKey({ name: "PBKDF2", salt, iterations: 100000, hash: "SHA-256" }, keyMaterial, { name: "AES-GCM", length: 256 }, false, ["encrypt"]);
      const iv = crypto.getRandomValues(new Uint8Array(12));
      const ct = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, enc.encode(input));
      const combined = new Uint8Array(salt.length + iv.length + new Uint8Array(ct).length);
      combined.set(salt, 0);
      combined.set(iv, salt.length);
      combined.set(new Uint8Array(ct), salt.length + iv.length);
      return btoa(String.fromCharCode(...combined));
    },
    params: [{ key: "password", label: "Password", type: "text", default: "" }] },
  { id: "aes-decrypt", name: "AES-256-GCM Decrypt", category: "Encryption", icon: Unlock, description: "Decrypt AES-256-GCM ciphertext",
    execute: async (input, params) => {
      try {
        const password = params?.password || "default-key";
        const enc = new TextEncoder();
        const raw = Uint8Array.from(atob(input.trim()), c => c.charCodeAt(0));
        const salt = raw.slice(0, 16);
        const iv = raw.slice(16, 28);
        const ct = raw.slice(28);
        const keyMaterial = await crypto.subtle.importKey("raw", enc.encode(password), "PBKDF2", false, ["deriveKey"]);
        const key = await crypto.subtle.deriveKey({ name: "PBKDF2", salt, iterations: 100000, hash: "SHA-256" }, keyMaterial, { name: "AES-GCM", length: 256 }, false, ["decrypt"]);
        const pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, ct);
        return new TextDecoder().decode(pt);
      } catch { return "[Error: Decryption failed — wrong password or corrupted data]"; }
    },
    params: [{ key: "password", label: "Password", type: "text", default: "" }] },

  // DATA FORMAT
  { id: "json-prettify", name: "JSON Prettify", category: "Data Format", icon: FileText, description: "Format JSON with indentation",
    execute: async (input) => { try { return JSON.stringify(JSON.parse(input), null, 2); } catch { return "[Error: Invalid JSON]"; } } },
  { id: "json-minify", name: "JSON Minify", category: "Data Format", icon: FileText, description: "Remove whitespace from JSON",
    execute: async (input) => { try { return JSON.stringify(JSON.parse(input)); } catch { return "[Error: Invalid JSON]"; } } },
  { id: "csv-to-json", name: "CSV → JSON", category: "Data Format", icon: ArrowRightLeft, description: "Convert CSV to JSON array",
    execute: async (input) => {
      const lines = input.trim().split("\n");
      if (lines.length < 2) return "[Error: Need header + at least 1 row]";
      const headers = lines[0].split(",").map(h => h.trim().replace(/^"|"$/g, ""));
      const rows = lines.slice(1).map(line => {
        const vals = line.split(",").map(v => v.trim().replace(/^"|"$/g, ""));
        const obj: Record<string, string> = {};
        headers.forEach((h, i) => { obj[h] = vals[i] || ""; });
        return obj;
      });
      return JSON.stringify(rows, null, 2);
    } },
  { id: "json-to-csv", name: "JSON → CSV", category: "Data Format", icon: ArrowRightLeft, description: "Convert JSON array to CSV",
    execute: async (input) => {
      try {
        const arr = JSON.parse(input);
        if (!Array.isArray(arr) || arr.length === 0) return "[Error: Input must be a non-empty JSON array]";
        const headers = Object.keys(arr[0]);
        const rows = arr.map((obj: Record<string, unknown>) => headers.map(h => `"${String(obj[h] ?? "").replace(/"/g, '""')}"`).join(","));
        return [headers.join(","), ...rows].join("\n");
      } catch { return "[Error: Invalid JSON]"; }
    } },

  // NETWORK / OSINT
  { id: "defang-url", name: "Defang URL", category: "Network", icon: Shield, description: "Defang URLs for safe sharing",
    execute: async (input) => defangUrl(input) },
  { id: "refang-url", name: "Refang URL", category: "Network", icon: Shield, description: "Restore defanged URLs",
    execute: async (input) => refangUrl(input) },
  { id: "extract-urls", name: "Extract URLs", category: "Network", icon: Search, description: "Extract all URLs from text",
    execute: async (input) => extractUrls(input) },
  { id: "extract-emails", name: "Extract Emails", category: "Network", icon: Search, description: "Extract all email addresses",
    execute: async (input) => extractEmails(input) },
  { id: "extract-ips", name: "Extract IPs", category: "Network", icon: Search, description: "Extract all IPv4 addresses",
    execute: async (input) => extractIPs(input) },
  { id: "defang-iocs", name: "Defang All IOCs", category: "Network", icon: Shield, description: "Defang URLs, IPs, and domains",
    execute: async (input) => input
      .replace(/\./g, "[.]")
      .replace(/https?/g, m => m.replace("http", "hxxp"))
      .replace(/:\/\//g, "[://]") },

  // STRING
  { id: "reverse", name: "Reverse String", category: "String", icon: RefreshCw, description: "Reverse character order",
    execute: async (input) => [...input].reverse().join("") },
  { id: "uppercase", name: "Uppercase", category: "String", icon: Code2, description: "Convert to uppercase",
    execute: async (input) => input.toUpperCase() },
  { id: "lowercase", name: "Lowercase", category: "String", icon: Code2, description: "Convert to lowercase",
    execute: async (input) => input.toLowerCase() },
  { id: "line-sort", name: "Sort Lines", category: "String", icon: Code2, description: "Sort lines alphabetically",
    execute: async (input) => input.split("\n").sort().join("\n") },
  { id: "unique-lines", name: "Unique Lines", category: "String", icon: Code2, description: "Remove duplicate lines",
    execute: async (input) => [...new Set(input.split("\n"))].join("\n") },
  { id: "line-count", name: "Count Lines/Words", category: "String", icon: Code2, description: "Count lines, words, and characters",
    execute: async (input) => {
      const lines = input.split("\n").length;
      const words = input.trim().split(/\s+/).filter(Boolean).length;
      const chars = input.length;
      return `Lines: ${lines}\nWords: ${words}\nCharacters: ${chars}`;
    } },
  { id: "regex-extract", name: "Regex Extract", category: "String", icon: Search, description: "Extract matches using regex",
    execute: async (input, params) => {
      try {
        const pattern = params?.pattern || ".+";
        const re = new RegExp(pattern, "gm");
        const matches = input.match(re);
        return matches ? matches.join("\n") : "(no matches)";
      } catch (e) { return `[Error: ${e instanceof Error ? e.message : "Invalid regex"}]`; }
    },
    params: [{ key: "pattern", label: "Regex Pattern", type: "text", default: ".+" }] },

  // ANALYSIS
  { id: "entropy", name: "Entropy Analysis", category: "Analysis", icon: Zap, description: "Calculate Shannon entropy",
    execute: async (input) => entropy(input) },
  { id: "char-freq", name: "Character Frequency", category: "Analysis", icon: Zap, description: "Count character occurrences",
    execute: async (input) => charFrequency(input) },
  { id: "diff-check", name: "Magic Bytes Check", category: "Analysis", icon: Zap, description: "Detect file type from first bytes (paste hex)",
    execute: async (input) => {
      const hex = input.trim().replace(/\s+/g, "").toLowerCase();
      const sigs: [string, string][] = [
        ["25504446", "PDF Document"], ["504b0304", "ZIP/DOCX/XLSX Archive"],
        ["89504e47", "PNG Image"], ["ffd8ff", "JPEG Image"],
        ["47494638", "GIF Image"], ["52494646", "RIFF (WEBP/WAV/AVI)"],
        ["4d5a", "PE Executable (EXE/DLL)"], ["7f454c46", "ELF Executable (Linux)"],
        ["cafebabe", "Java Class File"], ["d0cf11e0", "OLE2 (DOC/XLS/PPT)"],
        ["1f8b08", "GZIP Archive"], ["377abcaf", "7-Zip Archive"],
        ["53514c69", "SQLite Database"],
      ];
      for (const [sig, name] of sigs) {
        if (hex.startsWith(sig)) return `✓ Detected: ${name}\n  Signature: ${sig}`;
      }
      return `✗ Unknown file signature\n  First bytes: ${hex.slice(0, 16)}`;
    } },
];

const CATEGORIES = [...new Set(OPERATIONS.map(o => o.category))];

const categoryIcons: Record<string, React.ElementType> = {
  Encoding: Code2, Hashing: Fingerprint, Encryption: Lock,
  "Data Format": ArrowRightLeft, Network: Globe, String: Code2, Analysis: Zap,
};

// ─── MAIN COMPONENT ───
const CipherView = () => {
  const [input, setInput] = useState("");
  const [output, setOutput] = useState("");
  const [recipe, setRecipe] = useState<RecipeStep[]>([]);
  const [activeCategory, setActiveCategory] = useState("Encoding");
  const [searchQuery, setSearchQuery] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [mode, setMode] = useState<"single" | "recipe">("single");

  const filteredOps = useMemo(() => {
    let ops = OPERATIONS;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      ops = ops.filter(o => o.name.toLowerCase().includes(q) || o.description.toLowerCase().includes(q));
    } else {
      ops = ops.filter(o => o.category === activeCategory);
    }
    return ops;
  }, [activeCategory, searchQuery]);

  // Execute single operation
  const executeSingle = useCallback(async (op: CipherOperation, params?: Record<string, string>) => {
    if (!input) { toast.error("Input is empty"); return; }
    setIsProcessing(true);
    try {
      const result = await op.execute(input, params);
      setOutput(result);
      toast.success(`${op.name} complete`);
    } catch (e) {
      setOutput(`[Error: ${e instanceof Error ? e.message : "Operation failed"}]`);
    }
    setIsProcessing(false);
  }, [input]);

  // Execute recipe chain
  const executeRecipe = useCallback(async () => {
    if (!input) { toast.error("Input is empty"); return; }
    if (recipe.length === 0) { toast.error("Recipe is empty"); return; }
    setIsProcessing(true);
    let current = input;
    for (const step of recipe) {
      if (!step.enabled) continue;
      const op = OPERATIONS.find(o => o.id === step.operationId);
      if (!op) continue;
      try {
        current = await op.execute(current, step.params);
      } catch (e) {
        current = `[Error at ${op.name}: ${e instanceof Error ? e.message : "failed"}]`;
        break;
      }
    }
    setOutput(current);
    setIsProcessing(false);
    toast.success("Recipe executed");
  }, [input, recipe]);

  const addToRecipe = (opId: string) => {
    const op = OPERATIONS.find(o => o.id === opId);
    if (!op) return;
    const defaultParams: Record<string, string> = {};
    op.params?.forEach(p => { defaultParams[p.key] = p.default || ""; });
    setRecipe(prev => [...prev, { id: crypto.randomUUID(), operationId: opId, params: defaultParams, enabled: true }]);
    setMode("recipe");
  };

  const removeFromRecipe = (id: string) => setRecipe(prev => prev.filter(s => s.id !== id));
  const toggleRecipeStep = (id: string) => setRecipe(prev => prev.map(s => s.id === id ? { ...s, enabled: !s.enabled } : s));
  const updateRecipeParam = (stepId: string, key: string, value: string) =>
    setRecipe(prev => prev.map(s => s.id === stepId ? { ...s, params: { ...s.params, [key]: value } } : s));

  const copyOutput = () => { navigator.clipboard.writeText(output); toast.success("Copied to clipboard"); };
  const downloadOutput = () => {
    const blob = new Blob([output], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "cipher-output.txt"; a.click();
    URL.revokeObjectURL(url);
  };
  const swapInputOutput = () => { setInput(output); setOutput(input); };

  return (
    <div className="flex flex-col h-full bg-background/50">
      {/* HEADER */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-border/30">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
            <Shield className="h-4 w-4 text-primary" />
          </div>
          <div>
            <h1 className="text-base font-light tracking-wider">CIPHER</h1>
            <p className="text-[10px] text-muted-foreground font-extralight tracking-widest">SOVEREIGN DATA OPERATIONS</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <EncryptionBadge variant="pill" />
          <Badge variant="outline" className="text-[9px] font-extralight tracking-wider border-emerald-500/20 text-emerald-500/80">
            CLIENT-SIDE ONLY
          </Badge>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* OPERATIONS PANEL */}
        <div className="w-72 border-r border-border/20 flex flex-col overflow-hidden">
          <div className="p-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/50" />
              <Input
                placeholder="Search operations..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="pl-9 h-8 text-xs bg-secondary/20 border-border/20"
              />
            </div>
          </div>

          {/* Category tabs */}
          {!searchQuery && (
            <div className="px-3 flex flex-wrap gap-1 pb-2">
              {CATEGORIES.map(cat => {
                const Icon = categoryIcons[cat] || Code2;
                return (
                  <button
                    key={cat}
                    onClick={() => setActiveCategory(cat)}
                    className={`flex items-center gap-1 px-2 py-1 rounded text-[9px] font-extralight tracking-wider transition-all ${
                      activeCategory === cat
                        ? "bg-primary/20 text-primary border border-primary/30"
                        : "bg-secondary/10 text-muted-foreground hover:bg-secondary/20 border border-transparent"
                    }`}
                  >
                    <Icon className="h-3 w-3" />
                    {cat}
                  </button>
                );
              })}
            </div>
          )}

          {/* Operation list */}
          <div className="flex-1 overflow-y-auto px-3 pb-3 space-y-1">
            {filteredOps.map(op => (
              <div
                key={op.id}
                className="group p-2 rounded-lg border border-border/10 hover:border-primary/30 hover:bg-primary/5 transition-all cursor-pointer"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 min-w-0">
                    <op.icon className="h-3.5 w-3.5 text-muted-foreground/60 flex-shrink-0" />
                    <span className="text-[11px] font-light truncate">{op.name}</span>
                  </div>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => executeSingle(op)}
                      className="p-1 rounded hover:bg-primary/20"
                      title="Execute"
                    >
                      <Play className="h-3 w-3 text-primary" />
                    </button>
                    <button
                      onClick={() => addToRecipe(op.id)}
                      className="p-1 rounded hover:bg-primary/20"
                      title="Add to recipe"
                    >
                      <Plus className="h-3 w-3 text-muted-foreground" />
                    </button>
                  </div>
                </div>
                <p className="text-[9px] text-muted-foreground/50 font-extralight mt-0.5 truncate">{op.description}</p>
                {/* Inline params for single-shot mode */}
                {op.params && (
                  <div className="mt-1.5 space-y-1">
                    {op.params.map(p => (
                      <Input
                        key={p.key}
                        placeholder={p.label}
                        defaultValue={p.default}
                        className="h-6 text-[10px] bg-secondary/10 border-border/10"
                        onKeyDown={e => {
                          if (e.key === "Enter") {
                            const params: Record<string, string> = {};
                            op.params?.forEach(param => {
                              const el = e.currentTarget.parentElement?.querySelector(`input[placeholder="${param.label}"]`) as HTMLInputElement;
                              params[param.key] = el?.value || param.default || "";
                            });
                            executeSingle(op, params);
                          }
                        }}
                      />
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* MAIN AREA */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Mode toggle + Recipe panel */}
          {mode === "recipe" && recipe.length > 0 && (
            <div className="border-b border-border/20 p-3 max-h-48 overflow-y-auto">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Layers className="h-3.5 w-3.5 text-primary" />
                  <span className="text-[10px] font-light tracking-wider text-primary">RECIPE ({recipe.length} steps)</span>
                </div>
                <div className="flex gap-1">
                  <Button size="sm" variant="ghost" className="h-6 text-[9px]" onClick={() => setRecipe([])}>
                    <Trash2 className="h-3 w-3 mr-1" /> Clear
                  </Button>
                  <Button size="sm" className="h-6 text-[9px]" onClick={executeRecipe} disabled={isProcessing}>
                    <Play className="h-3 w-3 mr-1" /> Bake
                  </Button>
                </div>
              </div>
              <div className="space-y-1">
                {recipe.map((step, i) => {
                  const op = OPERATIONS.find(o => o.id === step.operationId);
                  if (!op) return null;
                  return (
                    <div key={step.id} className={`flex items-center gap-2 p-1.5 rounded border transition-all ${step.enabled ? "border-border/20 bg-secondary/5" : "border-border/10 bg-secondary/3 opacity-50"}`}>
                      <GripVertical className="h-3 w-3 text-muted-foreground/30" />
                      <span className="text-[9px] text-muted-foreground/50 w-4">{i + 1}</span>
                      <op.icon className="h-3 w-3 text-muted-foreground/60" />
                      <span className="text-[10px] font-light flex-1">{op.name}</span>
                      {op.params?.map(p => (
                        <Input
                          key={p.key}
                          placeholder={p.label}
                          value={step.params[p.key] || ""}
                          onChange={e => updateRecipeParam(step.id, p.key, e.target.value)}
                          className="h-5 w-24 text-[9px] bg-secondary/10 border-border/10"
                        />
                      ))}
                      <button onClick={() => toggleRecipeStep(step.id)} className="p-0.5 rounded hover:bg-secondary/20">
                        {step.enabled ? <Check className="h-3 w-3 text-emerald-500" /> : <X className="h-3 w-3 text-muted-foreground/40" />}
                      </button>
                      <button onClick={() => removeFromRecipe(step.id)} className="p-0.5 rounded hover:bg-destructive/20">
                        <Trash2 className="h-3 w-3 text-muted-foreground/40" />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Input / Output */}
          <div className="flex-1 flex overflow-hidden">
            {/* INPUT */}
            <div className="flex-1 flex flex-col border-r border-border/20">
              <div className="flex items-center justify-between px-4 py-2 border-b border-border/10">
                <span className="text-[10px] font-extralight tracking-widest text-muted-foreground">INPUT</span>
                <div className="flex gap-1">
                  <Button size="sm" variant="ghost" className="h-6 text-[9px]" onClick={() => { const el = document.createElement("input"); el.type="file"; el.onchange=()=>{ const f=el.files?.[0]; if(f){f.text().then(t=>setInput(t));} }; el.click(); }}>
                    <Upload className="h-3 w-3 mr-1" /> Load
                  </Button>
                  <Button size="sm" variant="ghost" className="h-6 text-[9px]" onClick={() => setInput("")}>
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </div>
              <Textarea
                value={input}
                onChange={e => setInput(e.target.value)}
                placeholder="Paste input data here..."
                className="flex-1 resize-none border-0 rounded-none bg-transparent text-xs font-mono focus-visible:ring-0 focus-visible:ring-offset-0"
              />
            </div>

            {/* CENTER CONTROLS */}
            <div className="flex flex-col items-center justify-center gap-2 px-2">
              <Button size="sm" variant="ghost" onClick={swapInputOutput} className="h-7 w-7 p-0" title="Swap">
                <ArrowRightLeft className="h-3.5 w-3.5 text-muted-foreground" />
              </Button>
            </div>

            {/* OUTPUT */}
            <div className="flex-1 flex flex-col">
              <div className="flex items-center justify-between px-4 py-2 border-b border-border/10">
                <span className="text-[10px] font-extralight tracking-widest text-muted-foreground">OUTPUT</span>
                <div className="flex gap-1">
                  <Button size="sm" variant="ghost" className="h-6 text-[9px]" onClick={copyOutput} disabled={!output}>
                    <Copy className="h-3 w-3 mr-1" /> Copy
                  </Button>
                  <Button size="sm" variant="ghost" className="h-6 text-[9px]" onClick={downloadOutput} disabled={!output}>
                    <Download className="h-3 w-3 mr-1" /> Save
                  </Button>
                </div>
              </div>
              <Textarea
                value={output}
                readOnly
                placeholder="Output will appear here..."
                className="flex-1 resize-none border-0 rounded-none bg-transparent text-xs font-mono focus-visible:ring-0 focus-visible:ring-offset-0 text-emerald-400/90"
              />
            </div>
          </div>

          {/* Footer status */}
          <div className="flex items-center justify-between px-4 py-1.5 border-t border-border/10 bg-secondary/5">
            <div className="flex items-center gap-3">
              <span className="text-[9px] text-muted-foreground/40 font-extralight">
                {input.length > 0 ? `${input.length} chars input` : "Ready"}
              </span>
              {output && (
                <span className="text-[9px] text-emerald-500/40 font-extralight">
                  → {output.length} chars output
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-3 w-3 text-amber-500/40" />
              <span className="text-[8px] text-muted-foreground/30 font-extralight">All operations execute locally — zero network traffic</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CipherView;
