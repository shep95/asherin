import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import Header from "@/components/Header";
import LandingBackground from "@/components/LandingBackground";
import { Loader2, ShieldCheck, ArrowRight } from "lucide-react";

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
      <LandingBackground>
        <Header />
        <main className="relative z-10 max-w-2xl mx-auto px-6 py-32 text-center">
          <div aria-hidden className="pointer-events-none absolute left-1/2 top-1/3 -translate-x-1/2 -translate-y-1/2 w-[80vw] max-w-[900px] h-[420px] zophiel-aurora rounded-full" />
          <div className="relative">
            <ShieldCheck className="h-12 w-12 mx-auto mb-6 text-foreground/60" />
            <h1 className="text-4xl sm:text-5xl font-extralight tracking-[-0.02em] mb-4">
              {result.approved ? (
                <>Application <span className="zophiel-shimmer-text italic font-thin">Advanced</span></>
              ) : (
                <>Decision <span className="zophiel-shimmer-text italic font-thin">Recorded</span></>
              )}
            </h1>
            <p className="text-muted-foreground font-extralight leading-relaxed">
              {result.approved
                ? "Your application has passed Aureon's analytical review and is being forwarded to the Senate of HouseOfAsher. A detailed decision has been sent to your inbox."
                : "Aureon has reviewed your submission. A detailed decision with rationale has been sent to your email."}
            </p>
            {result.compositeScore != null && (
              <p className="mt-8 font-mono text-[10px] tracking-[0.3em] uppercase text-muted-foreground/60">
                Composite Score · {result.compositeScore}/100
              </p>
            )}
          </div>
        </main>
      </LandingBackground>
    );
  }

  return (
    <LandingBackground>
      <Header />
      <main className="relative z-10 px-6 pt-28 pb-20">
        {/* Aurora glow */}
        <div aria-hidden className="pointer-events-none absolute left-1/2 top-[20%] -translate-x-1/2 -translate-y-1/2 w-[90vw] max-w-[1100px] h-[500px] zophiel-aurora rounded-full" />

        {/* Grid floor */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-[0.10]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.08) 1px, transparent 1px)",
            backgroundSize: "72px 72px",
            maskImage: "radial-gradient(ellipse at top, black 15%, transparent 65%)",
            WebkitMaskImage: "radial-gradient(ellipse at top, black 15%, transparent 65%)",
          }}
        />

        <div className="relative mx-auto w-full max-w-3xl">
          {/* Top meta row */}
          <div className="flex items-center justify-between text-[9px] tracking-[0.4em] text-muted-foreground/50 uppercase font-mono mb-6">
            <span className="flex items-center gap-2">
              <span className="h-px w-6 bg-foreground/30" />
              NODE / VENTURES-01
            </span>
            <span className="hidden sm:flex items-center gap-2">
              CHANNEL · AUREON SENATE
              <span className="h-px w-6 bg-foreground/30" />
            </span>
          </div>

          {/* Hero */}
          <div className="mb-14">
            <div className="inline-flex items-center gap-2 rounded-full border border-foreground/15 bg-foreground/[0.03] backdrop-blur-md px-3 py-1 font-mono text-[10px] tracking-[0.3em] uppercase text-muted-foreground/70">
              <span className="h-1 w-1 rounded-full bg-emerald-400" />
              HOUSEOFASHER · VENTURES
            </div>
            <h1 className="mt-6 text-5xl sm:text-6xl md:text-7xl font-extralight tracking-[-0.02em] leading-[0.95] text-foreground">
              Apply for
              <br />
              <span className="zophiel-shimmer-text italic font-thin">investment review.</span>
            </h1>
            <p className="mt-7 max-w-2xl text-base sm:text-lg font-extralight leading-relaxed text-muted-foreground/90">
              Your application is processed by <span className="text-foreground/90">Aureon</span> — our multi-phase analytical
              engine performing entity resolution, financial forensics, market physics, and predictive trajectory analysis
              before any human at the Senate sees your file. Vague language and marketing rhetoric will be flagged and downscored.
              Answers must be <span className="text-foreground/90">quantified, evidence-based, and specific</span>.
            </p>
          </div>

          <form onSubmit={submit} className="space-y-8">
            <section className="space-y-4 p-6 sm:p-8 rounded-2xl border border-foreground/10 bg-foreground/[0.02] backdrop-blur-xl">
              <div className="flex items-center gap-3">
                <span className="h-px w-6 bg-foreground/30" />
                <h2 className="font-mono text-[10px] tracking-[0.3em] uppercase text-muted-foreground/70">Identification</h2>
              </div>
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <Label className="text-[10px] tracking-[0.2em] uppercase text-muted-foreground/70">Company name *</Label>
                  <Input value={companyName} onChange={(e) => setCompanyName(e.target.value)} className="mt-2 bg-background/40 border-foreground/10" />
                </div>
                <div>
                  <Label className="text-[10px] tracking-[0.2em] uppercase text-muted-foreground/70">Founder name *</Label>
                  <Input value={founderName} onChange={(e) => setFounderName(e.target.value)} className="mt-2 bg-background/40 border-foreground/10" />
                </div>
                <div>
                  <Label className="text-[10px] tracking-[0.2em] uppercase text-muted-foreground/70">Founder email *</Label>
                  <Input type="email" value={founderEmail} onChange={(e) => setFounderEmail(e.target.value)} className="mt-2 bg-background/40 border-foreground/10" />
                </div>
                <div>
                  <Label className="text-[10px] tracking-[0.2em] uppercase text-muted-foreground/70">Website</Label>
                  <Input value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="https://" className="mt-2 bg-background/40 border-foreground/10" />
                </div>
              </div>
            </section>

            {SECTIONS.map((section, idx) => (
              <section key={section.title} className="space-y-6 p-6 sm:p-8 rounded-2xl border border-foreground/10 bg-foreground/[0.02] backdrop-blur-xl">
                <div className="flex items-center gap-3">
                  <span className="font-mono text-[10px] tracking-[0.3em] text-muted-foreground/40">
                    {String(idx + 1).padStart(2, "0")}
                  </span>
                  <span className="h-px w-6 bg-foreground/30" />
                  <h2 className="font-mono text-[10px] tracking-[0.3em] uppercase text-muted-foreground/70">{section.title}</h2>
                </div>
                {section.questions.map((q) => (
                  <div key={q.id}>
                    <Label className="text-sm font-extralight leading-snug block mb-2 text-foreground/90">{q.q}</Label>
                    <Textarea
                      value={answers[q.id] || ""}
                      onChange={(e) => setAnswer(q.id, e.target.value)}
                      rows={3}
                      placeholder="Quantified. Evidence-based. Specific."
                      className="resize-y bg-background/40 border-foreground/10 font-extralight placeholder:text-muted-foreground/40"
                    />
                  </div>
                ))}
              </section>
            ))}

            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pt-4">
              <p className="font-mono text-[10px] tracking-[0.25em] uppercase text-muted-foreground/50">
                By submitting · you consent to automated analytical review
              </p>
              <Button type="submit" disabled={submitting} size="lg" className="group">
                {submitting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Aureon analyzing…
                  </>
                ) : (
                  <>
                    Submit for Aureon Review
                    <ArrowRight className="h-4 w-4 ml-2 transition-transform group-hover:translate-x-0.5" />
                  </>
                )}
              </Button>
            </div>
          </form>
        </div>
      </main>
    </LandingBackground>
  );
};

export default HouseOfAsherVentures;
