import { VerdictAction } from "./types";

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

    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = urgent ? 1.4 : 1.2;
    utterance.pitch = urgent ? 1.2 : 1.0;
    utterance.volume = 1.0;

    const voices = window.speechSynthesis.getVoices();
    const preferred = voices.find(v => v.name.includes("Google") && v.lang.startsWith("en")) || voices.find(v => v.lang.startsWith("en"));
    if (preferred) utterance.voice = preferred;

    window.speechSynthesis.speak(utterance);
  }

  speakVerdict(action: VerdictAction, message: string, confidence: number) {
    switch (action) {
      case "FIX_NOW":
        this.speak(`Fix now. ${confidence}% confidence. ${message}`, true);
        break;
      case "ESCALATE":
        this.speak(`Escalate. ${message}`, true);
        break;
      case "HOLD":
        this.speak(`Hold. ${message}`, false);
        break;
      default:
        break;
    }
  }
}
