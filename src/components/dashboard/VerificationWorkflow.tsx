import { useState } from "react";
import { CheckCircle2, AlertTriangle, XCircle, Loader2, Shield } from "lucide-react";

interface VerificationResult {
  contradictions: string[];
  missingSteps: string[];
  unsupportedClaims: string[];
  testCases: string[];
  overallScore: number;
}

interface VerificationWorkflowProps {
  content: string;
  onVerify: (prompt: string) => void;
}

const VerificationWorkflow = ({ content, onVerify }: VerificationWorkflowProps) => {
  const [loading, setLoading] = useState(false);

  const handleVerify = () => {
    setLoading(true);
    const prompt = `SELF-AUDIT PROTOCOL — Analyze the following response for quality and accuracy:

"""
${content.slice(0, 2000)}
"""

Please perform these checks:
1. **Contradictions**: List any internal contradictions or inconsistent statements.
2. **Missing Steps**: Identify any logical gaps or missing steps in the reasoning.
3. **Unsupported Claims**: Flag any factual claims that lack evidence or citations.
4. **Test Cases**: Suggest 3-5 edge cases or scenarios that would stress-test this answer.
5. **Overall Assessment**: Rate confidence (0-100%) and explain any weaknesses.

Format your response clearly with headers for each section.`;
    onVerify(prompt);
    setTimeout(() => setLoading(false), 500);
  };

  return (
    <button
      onClick={handleVerify}
      disabled={loading}
      className="flex items-center gap-1 text-[10px] font-light text-muted-foreground/50 hover:text-accent transition-colors disabled:opacity-30"
    >
      {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Shield className="h-3 w-3" />}
      Check My Work
    </button>
  );
};

export default VerificationWorkflow;
