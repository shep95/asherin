import { VerdictAction, LocalSignal } from "./types";

/**
 * VOICE ALERT ENGINE
 * Uses browser SpeechSynthesis for instant voice feedback.
 */
export class VoiceAlertEngine {
  private enabled = true;
  private lastSpoke = 0;
  private cooldownMs = 5000; // Min 5s between voice alerts

  setEnabled(val: boolean) { this.enabled = val; }

  speak(text: string, urgent = false) {
    if (!this.enabled) return;
    if (!window.speechSynthesis) return;

    const now = Date.now();
    if (now - this.lastSpoke < this.cooldownMs && !urgent) return;
    this.lastSpoke = now;

    // Cancel any current speech
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = urgent ? 1.4 : 1.2;
    utterance.pitch = urgent ? 1.2 : 1.0;
    utterance.volume = 1.0;

    // Try to use a deeper voice
    const voices = window.speechSynthesis.getVoices();
    const preferred = voices.find(v => v.name.includes("Google") && v.lang.startsWith("en")) || voices.find(v => v.lang.startsWith("en"));
    if (preferred) utterance.voice = preferred;

    window.speechSynthesis.speak(utterance);
  }

  speakVerdict(action: VerdictAction, message: string, confidence: number) {
    const urgent = ["BUY_NOW", "SELL_NOW", "EXIT_NOW"].includes(action);

    switch (action) {
      case "BUY_NOW":
        this.speak(`Buy signal. ${confidence}% confidence. ${message}`, true);
        break;
      case "SELL_NOW":
        this.speak(`Sell signal. ${confidence}% confidence. ${message}`, true);
        break;
      case "EXIT_NOW":
        this.speak(`Exit now! ${message}`, true);
        break;
      case "HOLD":
        this.speak(`Hold position. ${message}`, false);
        break;
      default:
        break;
    }
  }

  speakLocalSignal(signal: LocalSignal) {
    const urgent = ["BUY_NOW", "SELL_NOW", "EXIT_NOW"].includes(signal.action);
    this.speak(signal.reason, urgent);
  }
}
