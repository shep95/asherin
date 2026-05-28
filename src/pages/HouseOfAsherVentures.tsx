import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import Header from "@/components/Header";
import { Loader2, ShieldCheck } from "lucide-react";

const SECTIONS: { title: string; questions: { id: string; q: string }[] }[] = [
  { title: "I. Vision & Solution Clarity", questions: [
    { id: "v1", q: "What specific, quantifiable pain point does your solution address, and how is it validated?" },
    { id: "v2", q: "How does your solution demonstrably outperform existing alternatives? Provide comparative metrics." },
    { id: "v3", q: "What single, irrefutable advantage cannot be easily replicated by competitors?" },
    { id: "v4", q: "Precisely define your ideal customer avatar — demographics, psychographics, current pain points." },
  ]},
  { title: "II. Market Dynamics & Opportunity", questions: [
    { id: "m1", q: "Present bottom-up and top-down TAM calculation with verifiable assumptions." },
    { id: "m2", q: "Quantify the realistic SOM you can capture in 3-5 years and your penetration strategy." },
    { id: "m3", q: "Provide quadrant analysis of competitors — strengths, weaknesses, market share." },
    { id: "m4", q: "Which macro/tech/societal trends directly accelerate your growth trajectory?" },
    { id: "m5", q: "Identify regulatory/legal hurdles and your specific mitigation strategy." },
  ]},
  { title: "III. Team & Execution Capability", questions: [
    { id: "t1", q: "For each founder, detail quantified past accomplishments — exits, revenue, launches." },
    { id: "t2", q: "Identify critical skill gaps in the team and your precise hiring plan and timeline." },
    { id: "t3", q: "Detail active advisors, their value-add, compensation, and engagement frequency." },
    { id: "t4", q: "Describe organizational chart, key roles, and how the structure scales with growth." },
    { id: "t5", q: "Detail a significant past professional failure per founder and lessons applied here." },
  ]},
  { title: "IV. Product Development & Technology", questions: [
    { id: "p1", q: "Current product stage (concept/MVP/beta/GA) with verifiable proof of functionality." },
    { id: "p2", q: "Core technology stack and proprietary IP (patents, trade secrets, algorithms) forming the moat." },
    { id: "p3", q: "Next 12-18 months roadmap — milestones, features, resource requirements." },
    { id: "p4", q: "Architecture design for 10x, 100x, 1000x growth without re-architecture." },
    { id: "p5", q: "Data handling, encryption, security protocols, and regulatory compliance." },
  ]},
  { title: "V. Business Model & Traction", questions: [
    { id: "b1", q: "Primary/secondary revenue streams with unit economics (CAC, LTV, churn)." },
    { id: "b2", q: "Justify pricing relative to value, competitors, and willingness to pay." },
    { id: "b3", q: "Go-to-market channels and projected CAC for each." },
    { id: "b4", q: "Current traction — MAU, paying customers, MRR, growth rates, testimonials." },
    { id: "b5", q: "The 3-5 most critical KPIs you track and how they signal strategic progress." },
  ]},
  { title: "VI. Financials & Funding", questions: [
    { id: "f1", q: "Historical financials — revenue, expenses, cash flow since inception." },
    { id: "f2", q: "3-5 year projections (P&L, BS, CF) with justified assumptions." },
    { id: "f3", q: "Precise capital ask and exact allocation across R&D, marketing, hiring, etc." },
    { id: "f4", q: "How will this capital directly accelerate milestones and increase enterprise value?" },
    { id: "f5", q: "Current monthly burn rate, current runway, runway after this raise." },
    { id: "f6", q: "Probable exit scenarios — likely acquirers and realistic valuation range." },
  ]},
  { title: "VII. Risk Assessment & Mitigation", questions: [
    { id: "r1", q: "Identify the top 3 risks (market, execution, financial, regulatory, competitive)." },
    { id: "r2", q: "For each risk, detail a specific, actionable mitigation plan." },
    { id: "r3", q: "Contingency plans for market shifts, tech failures, or key personnel departures." },
    { id: "r4", q: "Strategy for protecting core IP against infringement or theft." },
  ]},
];

const HouseOfAsherVentures = () => {
  const [companyName, setCompanyName] = useState("");
  const [founderName, setFounderName] = useState("");
  const [founderEmail, setFounderEmail] = useState("");
  const [website, setWebsite] = useState("");
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ approved: boolean; compositeScore?: number } | null>(null);

  const setAnswer = (id: string, val: string) => setAnswers((p) => ({ ...p, [id]: val }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyName || !founderName || !founderEmail) {
      toast.error("Company name, founder name, and email are required");
      return;
    }
    const missing = SECTIONS.flatMap((s) => s.questions).filter((q) => !answers[q.id]?.trim());
    if (missing.length > 0) {
      toast.error(`${missing.length} question${missing.length > 1 ? "s" : ""} unanswered. Aureon rejects incomplete applications.`);
      return;
    }

    // Map ids to full questions for richer context
    const labeledAnswers: Record<string, string> = {};
    SECTIONS.forEach((s) => s.questions.forEach((q) => {
      labeledAnswers[q.q] = answers[q.id];
    }));

    setSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke("houseofasher-analyze", {
        body: { companyName, founderName, founderEmail, website, answers: labeledAnswers },
      });
      if (error) throw error;
      setResult({ approved: data.approved, compositeScore: data.compositeScore });
      if (data.approved) {
        toast.success("Application advanced. Check your inbox.");
      } else {
        toast.message("Application reviewed. A decision has been emailed to you.");
      }
    } catch (err: any) {
      toast.error("Submission failed: " + (err?.message || err));
    } finally {
      setSubmitting(false);
    }
  };

  if (result) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="max-w-2xl mx-auto px-6 py-32 text-center">
          <ShieldCheck className="h-12 w-12 mx-auto mb-6 text-foreground/60" />
          <h1 className="text-3xl font-extralight tracking-tight mb-4">
            {result.approved ? "Application Advanced" : "Decision Recorded"}
          </h1>
          <p className="text-muted-foreground font-light leading-relaxed">
            {result.approved
              ? "Your application has passed Aureon's analytical review and is being forwarded to the Senate of HouseOfAsher. A detailed decision has been sent to your inbox."
              : "Aureon has reviewed your submission. A detailed decision with rationale has been sent to your email."}
          </p>
          {result.compositeScore != null && (
            <p className="mt-6 text-xs tracking-[0.2em] uppercase text-muted-foreground/60">
              Composite Score · {result.compositeScore}/100
            </p>
          )}
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="max-w-3xl mx-auto px-6 py-16">
        <div className="mb-12">
          <p className="text-[10px] tracking-[0.3em] uppercase text-foreground/50 mb-3">◈ HouseOfAsher · Ventures</p>
          <h1 className="text-4xl sm:text-5xl font-extralight tracking-tight mb-4">Apply for Investment Review</h1>
          <p className="text-sm text-muted-foreground font-light leading-relaxed max-w-2xl">
            Your application is processed by Aureon — our multi-phase analytical engine that performs entity resolution,
            financial forensics, market physics, and predictive trajectory analysis before any human at the Senate sees your file.
            Vague language, unsubstantiated claims, and marketing rhetoric will be flagged and downscored.
            Answers must be <strong className="text-foreground/80">quantified, evidence-based, and specific</strong>.
          </p>
        </div>

        <form onSubmit={submit} className="space-y-10">
          <section className="space-y-4 p-6 rounded-2xl border border-foreground/10 bg-card/30 backdrop-blur">
            <h2 className="text-xs tracking-[0.25em] uppercase text-foreground/60">Identification</h2>
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <Label className="text-xs">Company name *</Label>
                <Input value={companyName} onChange={(e) => setCompanyName(e.target.value)} className="mt-1" />
              </div>
              <div>
                <Label className="text-xs">Founder name *</Label>
                <Input value={founderName} onChange={(e) => setFounderName(e.target.value)} className="mt-1" />
              </div>
              <div>
                <Label className="text-xs">Founder email *</Label>
                <Input type="email" value={founderEmail} onChange={(e) => setFounderEmail(e.target.value)} className="mt-1" />
              </div>
              <div>
                <Label className="text-xs">Website</Label>
                <Input value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="https://" className="mt-1" />
              </div>
            </div>
          </section>

          {SECTIONS.map((section) => (
            <section key={section.title} className="space-y-5 p-6 rounded-2xl border border-foreground/10 bg-card/30 backdrop-blur">
              <h2 className="text-xs tracking-[0.25em] uppercase text-foreground/60">{section.title}</h2>
              {section.questions.map((q) => (
                <div key={q.id}>
                  <Label className="text-sm font-light leading-snug block mb-2">{q.q}</Label>
                  <Textarea
                    value={answers[q.id] || ""}
                    onChange={(e) => setAnswer(q.id, e.target.value)}
                    rows={3}
                    placeholder="Quantified, evidence-based, specific."
                    className="resize-y"
                  />
                </div>
              ))}
            </section>
          ))}

          <div className="flex items-center justify-end gap-4 pt-4">
            <p className="text-[10px] tracking-wide text-muted-foreground/60">
              By submitting you consent to automated analytical review.
            </p>
            <Button type="submit" disabled={submitting} size="lg">
              {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {submitting ? "Aureon analyzing…" : "Submit for Aureon Review"}
            </Button>
          </div>
        </form>
      </main>
    </div>
  );
};

export default HouseOfAsherVentures;
