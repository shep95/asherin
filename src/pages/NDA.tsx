import Header from "@/components/Header";
import LandingBackground from "@/components/LandingBackground";
import { useEffect } from "react";
import { Shield, FileText, Lock, ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";
import { applySeoHead } from "@/lib/seoHead";

const NDA = () => {
  useEffect(() => {
    applySeoHead({
      title: "Non-Disclosure Agreement — Aureon Advisor",
      description: "Aureon Advisor Non-Disclosure Agreement. Confidentiality terms for advisors and partners engaging with Aureon's intelligence platform.",
      path: "/nda",
    });
  }, []);

  return (
    <LandingBackground overlayOpacity="bg-black/85">
      <Header />

      <div className="relative z-10 pt-24 px-6">
        <Link to="/" className="inline-flex items-center gap-2 text-xs font-light tracking-wide text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to Home
        </Link>
      </div>

      <div className="relative z-10 pt-8 pb-16 px-6">
        <div className="mx-auto max-w-3xl">
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-2 rounded-full border border-purple-500/30 bg-purple-500/10 px-4 py-1.5 mb-6">
              <Shield className="h-4 w-4 text-purple-400" />
              <span className="text-xs font-light tracking-[0.15em] text-purple-400 uppercase">Confidential</span>
            </div>
            <h1 className="text-3xl sm:text-4xl font-extralight tracking-wide zophiel-shimmer-text">
              Non-Disclosure Agreement
            </h1>
            <p className="mt-4 text-sm font-extralight text-muted-foreground">
              AUREON Pro Tier — Required for all Pro subscribers.
            </p>
          </div>

          <div className="rounded-2xl border border-purple-500/15 bg-card/30 backdrop-blur-md p-8 sm:p-12 space-y-8">
            <div className="flex items-center gap-3 pb-6 border-b border-border/20">
              <FileText className="h-6 w-6 text-purple-400" />
              <div>
                <h2 className="text-sm font-light tracking-wide text-foreground">MUTUAL NON-DISCLOSURE AGREEMENT</h2>
                <p className="text-[10px] text-muted-foreground mt-0.5">Effective upon execution of Advisor subscription</p>
              </div>
            </div>

            <div className="space-y-6 text-sm font-extralight leading-relaxed text-foreground/85">
              <section>
                <h3 className="text-xs font-light tracking-[0.15em] text-foreground uppercase mb-3">1. PARTIES</h3>
                <p>This Non-Disclosure Agreement ("Agreement") is entered into between <strong className="text-foreground">Zorak Corp d/b/a Aureon</strong> ("Disclosing Party") and the subscribing individual or entity purchasing the Aureon Advisor tier ("Receiving Party"), collectively referred to as the "Parties."</p>
              </section>

              <section>
                <h3 className="text-xs font-light tracking-[0.15em] text-foreground uppercase mb-3">2. DEFINITION OF CONFIDENTIAL INFORMATION</h3>
                <p>"Confidential Information" means all non-public information disclosed by either Party, including but not limited to:</p>
                <ul className="mt-3 space-y-2 ml-4">
                  <li className="flex items-start gap-2"><Lock className="h-3 w-3 mt-1 text-purple-400 shrink-0" /><span>Proprietary AI system architecture, prompt engineering methodologies, and intelligence protocols ("Ghost Chain Protocol," "Zophiel Core Logic," and related systems).</span></li>
                  <li className="flex items-start gap-2"><Lock className="h-3 w-3 mt-1 text-purple-400 shrink-0" /><span>The internal operational mechanics, algorithms, data processing pipelines, and analytical frameworks of the AZPLEN Data Intelligence Platform, NOMAD Public Intelligence Engine, and Zophiel Search Engine.</span></li>
                  <li className="flex items-start gap-2"><Lock className="h-3 w-3 mt-1 text-purple-400 shrink-0" /><span>Business strategies, pricing models, client lists, and proprietary benchmarking data.</span></li>
                  <li className="flex items-start gap-2"><Lock className="h-3 w-3 mt-1 text-purple-400 shrink-0" /><span>Any advisor communications, strategic recommendations, and intelligence briefings provided through the Advisor tier.</span></li>
                  <li className="flex items-start gap-2"><Lock className="h-3 w-3 mt-1 text-purple-400 shrink-0" /><span>Source code, system prompts, API configurations, and technical documentation made accessible through Advisor-level access.</span></li>
                </ul>
              </section>

              <section>
                <h3 className="text-xs font-light tracking-[0.15em] text-foreground uppercase mb-3">3. OBLIGATIONS OF THE RECEIVING PARTY</h3>
                <p>The Receiving Party agrees to:</p>
                <ul className="mt-3 space-y-2 ml-4">
                  <li>(a) Hold all Confidential Information in strict confidence and not disclose it to any third party without prior written consent.</li>
                  <li>(b) Use Confidential Information solely for the purpose of utilizing the Aureon platform services covered by the Advisor subscription.</li>
                  <li>(c) Not reverse-engineer, decompile, or attempt to derive the underlying logic, algorithms, or source code of any Aureon system.</li>
                  <li>(d) Not publicly discuss, post, review, or describe the internal workings, features, or methodologies of the Aureon platform beyond what is publicly available on aureon.ai.</li>
                  <li>(e) Restrict access to Confidential Information to those within Receiving Party's organization who have a need-to-know basis.</li>
                </ul>
              </section>

              <section>
                <h3 className="text-xs font-light tracking-[0.15em] text-foreground uppercase mb-3">4. EXCLUSIONS</h3>
                <p>Confidential Information does not include information that:</p>
                <ul className="mt-3 space-y-2 ml-4">
                  <li>(a) Is or becomes publicly available through no fault of the Receiving Party.</li>
                  <li>(b) Was lawfully known to the Receiving Party before disclosure.</li>
                  <li>(c) Is received from a third party without obligation of confidentiality.</li>
                  <li>(d) Is independently developed without reference to Confidential Information.</li>
                  <li>(e) Is required to be disclosed by law or legal proceeding, provided the Receiving Party gives prompt notice.</li>
                </ul>
              </section>

              <section>
                <h3 className="text-xs font-light tracking-[0.15em] text-foreground uppercase mb-3">5. TERM AND TERMINATION</h3>
                <p>This Agreement shall remain in effect for the duration of the Advisor subscription and for a period of <strong className="text-foreground">five (5) years</strong> following the termination or expiration of said subscription. Upon termination, the Receiving Party shall destroy or return all Confidential Information in their possession.</p>
              </section>

              <section>
                <h3 className="text-xs font-light tracking-[0.15em] text-foreground uppercase mb-3">6. REMEDIES</h3>
                <p>The Parties acknowledge that breach of this Agreement may cause irreparable harm for which monetary damages would be inadequate. The Disclosing Party shall be entitled to seek equitable relief, including injunction and specific performance, in addition to any other remedies available at law or in equity. The breaching party shall be liable for all costs of enforcement, including reasonable attorneys' fees.</p>
              </section>

              <section>
                <h3 className="text-xs font-light tracking-[0.15em] text-foreground uppercase mb-3">7. GOVERNING LAW</h3>
                <p>This Agreement shall be governed by and construed in accordance with the laws of the United States of America. Any disputes shall be resolved in the courts of competent jurisdiction within the state of incorporation of Zorak Corp.</p>
              </section>

              <section>
                <h3 className="text-xs font-light tracking-[0.15em] text-foreground uppercase mb-3">8. ACCEPTANCE</h3>
                <p>By completing the purchase of an Aureon Pro subscription ($740/month), the Receiving Party acknowledges that they have read, understood, and agree to be bound by the terms of this Non-Disclosure Agreement. The act of payment constitutes electronic acceptance of this Agreement.</p>
              </section>
            </div>

            <div className="pt-6 border-t border-border/20">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <p className="text-xs font-light text-foreground">Zorak Corp d/b/a Aureon</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">Last updated: February 2026</p>
                </div>
                <div className="flex items-center gap-2">
                  <Link to="/terms" className="text-[10px] text-muted-foreground hover:text-foreground transition-colors underline">Terms of Service</Link>
                  <span className="text-muted-foreground/30">·</span>
                  <Link to="/privacy" className="text-[10px] text-muted-foreground hover:text-foreground transition-colors underline">Privacy Policy</Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <footer className="relative z-10 px-6 pb-8 pt-4">
        <div className="mx-auto max-w-5xl">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 py-6">
            <p className="text-sm font-light tracking-[0.2em] text-foreground">AUREON</p>
            <p className="text-xs font-extralight tracking-wide text-muted-foreground/50">© {new Date().getFullYear()} Zorak Corp</p>
          </div>
        </div>
      </footer>
    </LandingBackground>
  );
};

export default NDA;
