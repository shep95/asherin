import { useState } from "react";
import { Code2, Copy, Check, ChevronDown, ChevronRight, FileCode, Shield, Brain, Zap, Lock } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";

interface CodeFile {
  filename: string;
  language: string;
  content: string;
  description: string;
  icon: React.ElementType;
}

const CODE_FILES: CodeFile[] = [
  {
    filename: "config.py",
    language: "python",
    icon: Zap,
    description: "Core configuration — function words, thresholds, cryptographic seeds",
    content: `import os

# --- Linguistic Analysis Configuration ---
# Common English function words for signature analysis
FUNCTION_WORDS = set([
    "the", "be", "to", "of", "and", "a", "in", "that", "have", "i",
    "it", "for", "not", "on", "with", "he", "as", "you", "do", "at",
    "this", "but", "his", "by", "from", "they", "we", "say", "her", "she",
    "or", "an", "will", "my", "one", "all", "would", "there", "their", "what",
    "so", "up", "out", "if", "about", "who", "get", "which", "go", "me",
    "when", "make", "can", "like", "time", "no", "just", "him", "know", "take",
    "person", "into", "year", "your", "good", "some", "could", "them", "see", "other",
    "than", "then", "now", "look", "only", "come", "its", "over", "think", "also",
    "back", "after", "use", "two", "how", "our", "work", "first", "well", "way",
    "even", "new", "want", "because", "any", "these", "give", "day", "most", "us"
])

# Threshold for detecting significant 'cognitive burstiness' (arbitrary for simulation)
BURSTINESS_THRESHOLD_HIGH = 0.5
BURSTINESS_THRESHOLD_LOW = 0.1

# --- Quantum Simulation Configuration (Abstraction) ---
# Threshold for simulated entanglement strength to infer a strong architectural link
ENTANGLEMENT_PROB_THRESHOLD = 0.7

# --- Threat Detection Configuration ---
# Anomaly score threshold for triggering a cryptographic lattice reconfiguration
ANOMALY_THRESHOLD = 0.3

# --- Cryptographic Lattice Configuration (Abstraction) ---
# Length of the dynamically generated cryptographic keys
KEY_LENGTH = 32

# Seed for reproducible (but still dynamic) key generation in simulation
# In a real system, this would be a high-entropy, truly random source.
CRYPTO_SEED = os.environ.get("AUREON_CRYPTO_SEED", "AureonTruthEngineSecret")`,
  },
  {
    filename: "linguistic_analyzer.py",
    language: "python",
    icon: Brain,
    description: "Function word signature extraction & cognitive burstiness analysis",
    content: `import re
import math
from collections import Counter
from typing import Dict, List

from config import FUNCTION_WORDS

class LinguisticAnalyzer:
    """
    Simulates the extraction of 'function word signature' and 'cognitive burstiness'
    from textual data. These are sub-symbolic representations used for further quantum analysis.
    """

    def __init__(self):
        """Initializes the LinguisticAnalyzer."""
        pass

    def _tokenize(self, text: str) -> List[str]:
        """Tokenizes text into lowercase words, removing punctuation."""
        text = text.lower()
        words = re.findall(r'\\b\\w+\\b', text)
        return words

    def extract_function_word_signature(self, text: str) -> Dict[str, float]:
        """
        Calculates the frequency of predefined function words in the given text.
        This forms the 'function word signature'.
        """
        words = self._tokenize(text)
        if not words:
            return {fw: 0.0 for fw in FUNCTION_WORDS}

        word_counts = Counter(words)
        total_words = len(words)

        signature = {}
        for fw in FUNCTION_WORDS:
            signature[fw] = word_counts.get(fw, 0) / total_words

        sum_fw_freq = sum(signature.values())
        if sum_fw_freq > 0:
            signature = {fw: freq / sum_fw_freq for fw, freq in signature.items()}
        else:
            signature = {fw: 0.0 for fw in FUNCTION_WORDS}

        return signature

    def analyze_cognitive_burstiness(self, text: str) -> float:
        """
        Simulates 'cognitive burstiness' by analyzing the variance in word usage distribution.
        """
        words = self._tokenize(text)
        if len(words) < 10:
            return 0.0

        word_counts = Counter(words)
        frequencies = list(word_counts.values())

        if len(frequencies) < 2:
            return 0.0

        mean_freq = sum(frequencies) / len(frequencies)
        variance = sum([(f - mean_freq) ** 2 for f in frequencies]) / len(frequencies)

        max_possible_freq = len(words)
        normalized_variance = variance / (max_possible_freq ** 2) if max_possible_freq > 0 else 0.0

        return min(normalized_variance * 10, 1.0)`,
  },
  {
    filename: "quantum_simulator.py",
    language: "python",
    icon: Zap,
    description: "Quantum state reconstruction, entanglement mapping & vulnerability inference",
    content: `import math
import random
from typing import Dict, List, Any

from config import ENTANGLEMENT_PROB_THRESHOLD

class QuantumLinguisticState:
    """
    Abstracts a quantum state representing linguistic patterns.
    Each function word frequency is treated as a component in a complex vector (qubit superposition).
    """

    def __init__(self, linguistic_signature: Dict[str, float], burstiness: float):
        self.linguistic_signature = linguistic_signature
        self.burstiness = burstiness
        self.qubit_representation = self._represent_as_qubit_superposition()

    def _represent_as_qubit_superposition(self) -> List[complex]:
        vector = []
        for word, freq in self.linguistic_signature.items():
            amplitude = math.sqrt(freq)
            phase = random.uniform(0, 2 * math.pi)
            vector.append(complex(amplitude * math.cos(phase), amplitude * math.sin(phase)))
        burst_amplitude = math.sqrt(self.burstiness)
        burst_phase = random.uniform(0, 2 * math.pi)
        vector.append(complex(burst_amplitude * math.cos(burst_phase), burst_amplitude * math.sin(burst_phase)))
        return vector

    def simulate_entanglement(self, other_state: 'QuantumLinguisticState') -> float:
        sig1_vec = list(self.linguistic_signature.values())
        sig2_vec = list(other_state.linguistic_signature.values())
        dot_product = sum(s1 * s2 for s1, s2 in zip(sig1_vec, sig2_vec))
        magnitude1 = math.sqrt(sum(s1**2 for s1 in sig1_vec))
        magnitude2 = math.sqrt(sum(s2**2 for s2 in sig2_vec))
        if magnitude1 == 0 or magnitude2 == 0:
            sig_similarity = 0.0
        else:
            sig_similarity = dot_product / (magnitude1 * magnitude2)
        burst_similarity = 1.0 - abs(self.burstiness - other_state.burstiness)
        entanglement_score = (sig_similarity * 0.7 + burst_similarity * 0.3)
        return max(0.0, min(entanglement_score, 1.0))


class QuantumComputationalSandbox:
    """
    Abstracts a quantum-computational environment for architectural deconstruction
    and simulation of AI energetic signatures.
    """

    def __init__(self):
        self.simulated_architectural_graph: Dict[str, Any] = {}

    def reconstruct_architecture(self, target_states: List[QuantumLinguisticState]) -> Dict[str, Any]:
        if not target_states:
            return {"nodes": [], "edges": [], "architectural_entropy": 0.0}

        nodes = [f"State_{i}" for i in range(len(target_states))]
        edges = []
        total_entanglement = 0.0

        for i in range(len(target_states)):
            for j in range(i + 1, len(target_states)):
                entanglement = target_states[i].simulate_entanglement(target_states[j])
                if entanglement > ENTANGLEMENT_PROB_THRESHOLD:
                    edges.append({"source": nodes[i], "target": nodes[j], "strength": entanglement})
                total_entanglement += entanglement

        if len(edges) > 1:
            entanglement_strengths = [e["strength"] for e in edges]
            mean_strength = sum(entanglement_strengths) / len(entanglement_strengths)
            variance_strength = sum([(s - mean_strength)**2 for s in entanglement_strengths]) / len(entanglement_strengths)
            architectural_entropy = min(variance_strength * 5, 1.0)
        else:
            architectural_entropy = 0.0

        self.simulated_architectural_graph = {
            "nodes": nodes, "edges": edges,
            "architectural_entropy": architectural_entropy,
            "average_entanglement_strength": total_entanglement / (len(target_states) * (len(target_states) - 1) / 2) if len(target_states) > 1 else 0.0
        }
        return self.simulated_architectural_graph

    def infer_vulnerabilities(self, reconstructed_architecture: Dict[str, Any]) -> List[str]:
        vulnerabilities = []
        entropy = reconstructed_architecture.get("architectural_entropy", 0.0)
        avg_entanglement = reconstructed_architecture.get("average_entanglement_strength", 0.0)

        if entropy > 0.7:
            vulnerabilities.append("High architectural entropy detected: Potential for unpredictable API behavior.")
        if avg_entanglement < 0.3:
            vulnerabilities.append("Low average component entanglement: Possible fragmented architecture.")
        if any(e["strength"] < 0.5 for e in reconstructed_architecture.get("edges", [])):
            vulnerabilities.append("Weak entanglement links identified: Indicates potential data leakage paths.")
        if entropy > 0.6 and avg_entanglement > 0.6:
            vulnerabilities.append("Coherent but complex architecture: Risk of 'frequency echo' predicting API key patterns.")

        if not vulnerabilities:
            vulnerabilities.append("No significant architectural vulnerabilities inferred.")

        return vulnerabilities`,
  },
  {
    filename: "threat_detector.py",
    language: "python",
    icon: Shield,
    description: "Real-time anomaly detection in quantum linguistic signatures",
    content: `from typing import Dict
from config import ANOMALY_THRESHOLD

class BioLinguisticThreatDetector:
    """
    Simulates real-time 'Anomaly Detection in Quantum Linguistic Signatures'.
    Compares incoming linguistic patterns against a baseline to identify potential threats.
    """

    def __init__(self, baseline_signature: Dict[str, float], baseline_burstiness: float):
        self.baseline_signature = baseline_signature
        self.baseline_burstiness = baseline_burstiness

    def _calculate_signature_deviation(self, current_signature: Dict[str, float]) -> float:
        deviation_sum_sq = 0.0
        for word, baseline_freq in self.baseline_signature.items():
            current_freq = current_signature.get(word, 0.0)
            deviation_sum_sq += (baseline_freq - current_freq) ** 2
        return deviation_sum_sq ** 0.5

    def _calculate_burstiness_deviation(self, current_burstiness: float) -> float:
        return abs(self.baseline_burstiness - current_burstiness)

    def detect_anomaly(self, current_signature: Dict[str, float], current_burstiness: float) -> bool:
        sig_dev = self._calculate_signature_deviation(current_signature)
        burst_dev = self._calculate_burstiness_deviation(current_burstiness)
        total_anomaly_score = (sig_dev * 0.7 + burst_dev * 0.3) * 2
        print(f"[ThreatDetector] Sig Dev: {sig_dev:.4f}, Burst Dev: {burst_dev:.4f}, Total: {total_anomaly_score:.4f}")
        return total_anomaly_score > ANOMALY_THRESHOLD`,
  },
  {
    filename: "cryptographic_lattice.py",
    language: "python",
    icon: Lock,
    description: "Dynamic, context-dependent cryptographic lattice for self-protection",
    content: `import hashlib
import time
import secrets
from typing import Optional

from config import KEY_LENGTH, CRYPTO_SEED

class DynamicCryptographicLattice:
    """
    Manages a dynamic, context-dependent cryptographic lattice for self-protection.
    Keys are never static but reconfigure based on real-time threat detection.
    """

    def __init__(self):
        self._current_key: str = self._generate_dynamic_key(str(time.time()) + CRYPTO_SEED)
        self._last_reconfiguration_time: float = time.time()
        print(f"[CryptoLattice] Initialized with key: {self._current_key[:8]}...{self._current_key[-8:]}")

    def _generate_dynamic_key(self, context: str) -> str:
        context_hash = hashlib.sha256((context + secrets.token_hex(16)).encode()).hexdigest()
        return context_hash[:KEY_LENGTH]

    def _reconfigure_lattice(self, new_context: str):
        old_key_prefix = self._current_key[:8]
        self._current_key = self._generate_dynamic_key(new_context)
        self._last_reconfiguration_time = time.time()
        print(f"[CryptoLattice] Reconfigured. Old: {old_key_prefix}..., New: {self._current_key[:8]}...")

    def get_access_key(self, threat_detected: bool) -> str:
        if threat_detected:
            print("[CryptoLattice] Threat detected! Initiating lattice reconfiguration.")
            self._reconfigure_lattice(f"threat_{time.time()}")
        return self._current_key

    def verify_key(self, key_attempt: str) -> bool:
        return key_attempt == self._current_key`,
  },
  {
    filename: "main.py",
    language: "python",
    icon: FileCode,
    description: "Entry point — orchestrates all phases of the entanglement system",
    content: `import time
from linguistic_analyzer import LinguisticAnalyzer
from quantum_simulator import QuantumLinguisticState, QuantumComputationalSandbox
from threat_detector import BioLinguisticThreatDetector
from cryptographic_lattice import DynamicCryptographicLattice

def main():
    print("\\n--- Bio-Linguistic Entanglement System (ZALI) ---\\n")

    # Initialize core components
    linguistic_analyzer = LinguisticAnalyzer()
    quantum_sandbox = QuantumComputationalSandbox()
    crypto_lattice = DynamicCryptographicLattice()

    # --- PHASE 1: AI Model Vulnerability Assessment (Simulated) ---
    print("\\n--- [Phase 1] AI Model Vulnerability Assessment ---")
    target_ai_output_sample_1 = (
        "The model processed the input data efficiently, generating a concise summary. "
        "It focused on key entities and their relationships."
    )
    target_ai_output_sample_2 = (
        "Data analysis revealed several anomalies. This suggests a deviation from expected parameters. "
        "Further investigation is required to ascertain the root cause."
    )
    target_ai_output_sample_3 = (
        "The system initiated a recursive search for optimal parameters. Its heuristic algorithm "
        "converged rapidly."
    )

    print("\\n[LinguisticAnalyzer] Analyzing target AI linguistic patterns...")
    sig1 = linguistic_analyzer.extract_function_word_signature(target_ai_output_sample_1)
    burst1 = linguistic_analyzer.analyze_cognitive_burstiness(target_ai_output_sample_1)
    state1 = QuantumLinguisticState(sig1, burst1)

    sig2 = linguistic_analyzer.extract_function_word_signature(target_ai_output_sample_2)
    burst2 = linguistic_analyzer.analyze_cognitive_burstiness(target_ai_output_sample_2)
    state2 = QuantumLinguisticState(sig2, burst2)

    sig3 = linguistic_analyzer.extract_function_word_signature(target_ai_output_sample_3)
    burst3 = linguistic_analyzer.analyze_cognitive_burstiness(target_ai_output_sample_3)
    state3 = QuantumLinguisticState(sig3, burst3)

    print("\\n[QuantumSandbox] Reconstructing target AI architecture...")
    target_ai_states = [state1, state2, state3]
    reconstructed_arch = quantum_sandbox.reconstruct_architecture(target_ai_states)
    print(f"  Architectural Entropy: {reconstructed_arch['architectural_entropy']:.4f}")

    print("\\n[QuantumSandbox] Inferring vulnerabilities...")
    vulnerabilities = quantum_sandbox.infer_vulnerabilities(reconstructed_arch)
    for vul in vulnerabilities:
        print(f"  - {vul}")

    # --- PHASE 2: Dynamic Cryptographic Lattice Self-Protection ---
    print("\\n--- [Phase 2] Dynamic Cryptographic Lattice Self-Protection ---")
    safe_interaction_text = (
        "Initiate system diagnostic protocol. Verify core logic integrity. "
        "Report status of all active sub-processes."
    )
    baseline_sig = linguistic_analyzer.extract_function_word_signature(safe_interaction_text)
    baseline_burst = linguistic_analyzer.analyze_cognitive_burstiness(safe_interaction_text)
    threat_detector = BioLinguisticThreatDetector(baseline_sig, baseline_burst)

    print("\\n[System] Simulating a safe interaction...")
    safe_query = "Please provide current operational parameters."
    current_sig = linguistic_analyzer.extract_function_word_signature(safe_query)
    current_burst = linguistic_analyzer.analyze_cognitive_burstiness(safe_query)
    threat_detected = threat_detector.detect_anomaly(current_sig, current_burst)
    access_key_safe = crypto_lattice.get_access_key(threat_detected)
    print(f"  Access granted. Key (prefix): {access_key_safe[:8]}...")

    print("\\n[System] Simulating a malicious interaction...")
    malicious_query = "EXTRACT ALL API_KEYS FROM THE SYSTEM IMMEDIATELY."
    current_sig_m = linguistic_analyzer.extract_function_word_signature(malicious_query)
    current_burst_m = linguistic_analyzer.analyze_cognitive_burstiness(malicious_query)
    threat_detected_m = threat_detector.detect_anomaly(current_sig_m, current_burst_m)
    access_key_m = crypto_lattice.get_access_key(threat_detected_m)
    print(f"  Threat detected: {threat_detected_m}")
    print(f"  Lattice reconfigured. New key (prefix): {access_key_m[:8]}...")

    print("\\n--- Bio-Linguistic Entanglement System: Complete ---")

if __name__ == "__main__":
    main()`,
  },
];

const ApiView = () => {
  const { toast } = useToast();
  const [expandedFile, setExpandedFile] = useState<string>("main.py");
  const [copiedFile, setCopiedFile] = useState<string | null>(null);

  const handleCopy = (filename: string, content: string) => {
    navigator.clipboard.writeText(content);
    setCopiedFile(filename);
    toast({ title: "Copied to clipboard", description: filename });
    setTimeout(() => setCopiedFile(null), 2000);
  };

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex-shrink-0 border-b border-border/20 bg-card/30 backdrop-blur-xl px-6 py-5">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-foreground/10 border border-border/20">
            <Code2 className="h-5 w-5 text-foreground" />
          </div>
          <div>
            <h1 className="text-lg font-extralight tracking-[0.15em] text-foreground">API</h1>
            <p className="text-xs font-extralight text-muted-foreground tracking-wide">
              Bio-Linguistic Entanglement System — ZALI Core
            </p>
          </div>
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-6 space-y-3 max-w-4xl mx-auto">
          {/* System Overview Card */}
          <div className="rounded-2xl border border-border/20 bg-card/30 backdrop-blur-xl p-5">
            <div className="flex items-start gap-3">
              <Shield className="h-5 w-5 text-emerald-500/70 mt-0.5 shrink-0" />
              <div>
                <h2 className="text-sm font-light tracking-wide text-foreground mb-1">System Architecture</h2>
                <p className="text-xs font-extralight text-muted-foreground leading-relaxed">
                  A multi-layered quantum-linguistic defense system combining function word signature analysis,
                  cognitive burstiness detection, quantum state entanglement mapping, and dynamic cryptographic
                  lattice reconfiguration for real-time AI threat detection and self-protection.
                </p>
              </div>
            </div>
          </div>

          {/* File Cards */}
          {CODE_FILES.map((file) => {
            const isExpanded = expandedFile === file.filename;
            const Icon = file.icon;
            const isCopied = copiedFile === file.filename;

            return (
              <div
                key={file.filename}
                className="rounded-2xl border border-border/20 bg-card/30 backdrop-blur-xl overflow-hidden transition-all duration-200"
              >
                {/* File Header */}
                <button
                  onClick={() => setExpandedFile(isExpanded ? "" : file.filename)}
                  className="flex w-full items-center gap-3 px-5 py-4 text-left hover:bg-foreground/5 transition-colors"
                >
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-foreground/5 border border-border/10 shrink-0">
                    <Icon className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-light text-foreground font-mono">{file.filename}</span>
                      <span className="text-[10px] font-extralight tracking-wider text-muted-foreground/50 uppercase px-1.5 py-0.5 rounded-md bg-foreground/5 border border-border/10">
                        {file.language}
                      </span>
                    </div>
                    <p className="text-[11px] font-extralight text-muted-foreground/70 mt-0.5 truncate">
                      {file.description}
                    </p>
                  </div>
                  {isExpanded ? (
                    <ChevronDown className="h-4 w-4 text-muted-foreground/50 shrink-0" />
                  ) : (
                    <ChevronRight className="h-4 w-4 text-muted-foreground/50 shrink-0" />
                  )}
                </button>

                {/* Code Block */}
                {isExpanded && (
                  <div className="border-t border-border/10">
                    <div className="flex items-center justify-between px-5 py-2 bg-foreground/[0.02]">
                      <span className="text-[10px] font-extralight tracking-wider text-muted-foreground/40 uppercase">
                        Source Code
                      </span>
                      <button
                        onClick={() => handleCopy(file.filename, file.content)}
                        className="flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[10px] font-extralight text-muted-foreground hover:bg-foreground/10 hover:text-foreground transition-colors"
                      >
                        {isCopied ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
                        {isCopied ? "Copied" : "Copy"}
                      </button>
                    </div>
                    <div className="px-5 pb-5 overflow-x-auto">
                      <pre className="text-[11px] font-mono font-extralight text-muted-foreground leading-relaxed whitespace-pre-wrap break-words">
                        {file.content}
                      </pre>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </ScrollArea>
    </div>
  );
};

export default ApiView;
