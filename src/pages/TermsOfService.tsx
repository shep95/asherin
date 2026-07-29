import { useEffect } from "react";
import Header from "@/components/Header";
import LandingBackground from "@/components/LandingBackground";
import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { applySeoHead } from "@/lib/seoHead";

const TermsOfService = () => {
  const lastUpdated = "May 23, 2026";

  useEffect(() => {
    applySeoHead({
      title: "Terms of Service — Aureon",
      description:
        "Aureon Terms of Service: subscription tiers, acceptable use, data privacy commitments, and the contract between operators and the platform.",
      path: "/terms",
    });
  }, []);

  return (
    <LandingBackground>

      <Header />

      <div className="relative z-10 px-6 pt-32 pb-24">
        <div className="mx-auto max-w-3xl">
          <Link to="/" className="inline-flex items-center gap-2 text-sm font-extralight tracking-wide text-muted-foreground hover:text-foreground transition-colors mb-12">
            <ArrowLeft className="h-4 w-4" />
            Back to Home
          </Link>

          <div className="rounded-2xl border border-border/20 bg-card/30 backdrop-blur-md p-8 sm:p-12">
            <h1 className="text-3xl sm:text-4xl font-extralight tracking-wide zophiel-shimmer-text mb-2">Terms of Service</h1>
            <p className="text-sm font-extralight text-muted-foreground mb-12">Last updated: {lastUpdated}</p>

            <div className="space-y-10 text-sm font-extralight leading-relaxed text-muted-foreground">
              <section>
                <h2 className="text-lg font-light tracking-wide text-foreground mb-3">1. Acceptance of Terms</h2>
                <p>By accessing or using Aureon ("the Service"), operated by Zorak Corp & House Of Asher, you agree to be bound by these Terms of Service. If you do not agree to these terms, do not use the Service.</p>
              </section>

              <section>
                <h2 className="text-lg font-light tracking-wide text-foreground mb-3">2. Service Description</h2>
                <p>Aureon is an AI-powered intelligence platform providing uncensored responses, an elite coding engine and in-dashboard IDE, live web search, persistent memory across sessions, team workspace functionality, multi-language output, voice chat, image and video generation, file scraping, and a full intelligence suite (Zophiel, Zerlal, Zeeion, NOMAD, Azplen, Aziion, AXRLEN, CROSS, ZANOEM Design Lab, Predictive Intelligence, Automated Agents, Plugin Marketplace, Guardian Vault, and more). A free Vedic Astrology module is available on the landing page without an account. The Service is offered on two monthly subscription tiers: Aureon ($18/month) and Asherin Pro ($399/month), with a custom-priced Enterprise tier.</p>
              </section>

              <section>
                <h2 className="text-lg font-light tracking-wide text-foreground mb-3">3. Data Privacy & Security</h2>
                <p className="mb-3">Your privacy is foundational to Aureon, not an afterthought. We commit to the following:</p>
                <ul className="space-y-2 ml-4">
                  <li>→ All prompts and conversations are encrypted end-to-end (AES-256-GCM).</li>
                  <li>→ Your data is never sold to third parties.</li>
                  <li>→ Your data is never used to train any AI model.</li>
                  <li>→ Your data is never shared with advertisers.</li>
                  <li>→ Your data is never read by our team.</li>
                  <li>→ All servers are hosted in the United States.</li>
                  <li>→ Bring Your Own Key (BYOK) is supported across all major model providers — your API keys stay yours.</li>
                  <li>→ Upon account deletion, all associated data is permanently removed.</li>
                </ul>
              </section>

              <section>
                <h2 className="text-lg font-light tracking-wide text-foreground mb-3">4. Uncensored Output Policy</h2>
                <p>Aureon provides uncensored AI responses. The Service does not apply corporate-filtered RLHF (Reinforcement Learning from Human Feedback) to suppress or sanitize outputs. Users acknowledge that responses are generated without editorial filtering and accept full responsibility for how they use the information provided.</p>
              </section>

              <section>
                <h2 className="text-lg font-light tracking-wide text-foreground mb-3">5. Subscription & Billing</h2>
                <p className="mb-3">The Service is offered on two monthly subscription tiers plus a custom Enterprise tier:</p>
                <ul className="space-y-2 ml-4">
                  <li>→ Aureon — <strong>$18/month</strong>. Core chat (Chat / Code / Research / Truth modes), uncensored AI, elite coding engine, multi-language output, response-depth control, base Zophiel Search, code snippets library, command palette, limited team workspace, persistent memory (standard limits), end-to-end encryption, delete + export anytime. 60 messages per 3-hour window.</li>
                  <li>→ Asherin Pro — <strong>$399/month</strong>. Everything in Aureon plus Azplen Data Intelligence Platform (ingestion, entity resolution, workflow automation, scenario simulation, threat modeling), NOMAD Public Intelligence Agent, Advanced Intelligence Briefings (daily, industry-customised), Zophiel Search Pro (higher query limits, deeper crawling, priority latency), full team workspace with shared threads and admin controls, and the rest of the advanced suite (AXRLEN, ZEEION, ZERLAL, CROSS, ZANOEM, Plugin Marketplace, Automated Agents, Video Intelligence). 200 messages per 3-hour window.</li>
                  <li>→ Enterprise — Custom pricing. SSO / SAML, org policy controls, audit logs with retention controls, dedicated capacity, and custom SLAs.</li>
                  <li>→ Subscriptions renew monthly. Cancel anytime from the dashboard — access continues until the end of the current billing period.</li>
                  <li>→ No hidden fees, no overage charges, no markup on BYOK provider tokens.</li>
                </ul>

              </section>

              <section>
                <h2 className="text-lg font-light tracking-wide text-foreground mb-3">6. User Responsibilities</h2>
                <p>You are solely responsible for your use of the Service and any content generated through your interactions. You agree not to use Aureon for any activity that violates applicable law. The uncensored nature of the platform does not constitute encouragement or endorsement of illegal activity.</p>
              </section>

              <section>
                <h2 className="text-lg font-light tracking-wide text-foreground mb-3">7. Intellectual Property</h2>
                <p>Content you generate through Aureon is yours. We claim no ownership over your prompts, outputs, or code generated through the Service. The Aureon name, branding, and platform technology are the property of Zorak Corp & House Of Asher.</p>
              </section>

              <section>
                <h2 className="text-lg font-light tracking-wide text-foreground mb-3">8. Service Availability</h2>
                <p>We strive for continuous uptime but do not guarantee uninterrupted access. The Service may be temporarily unavailable for maintenance, updates, or circumstances beyond our control. We are not liable for any loss resulting from service downtime.</p>
              </section>

              <section>
                <h2 className="text-lg font-light tracking-wide text-foreground mb-3">9. Limitation of Liability</h2>
                <p>Aureon is provided "as is." Zorak Corp & House Of Asher shall not be liable for any indirect, incidental, or consequential damages arising from your use of the Service. AI-generated content should not be treated as professional, legal, medical, or financial advice.</p>
              </section>

              <section>
                <h2 className="text-lg font-light tracking-wide text-foreground mb-3">10. Modifications</h2>
                <p>We reserve the right to update these Terms at any time. Continued use of the Service after changes constitutes acceptance of the revised Terms. Material changes will be communicated through the platform.</p>
              </section>

              <section>
                <h2 className="text-lg font-light tracking-wide text-foreground mb-3">11. Contact</h2>
                <p>
                  For questions regarding these Terms, reach out via{" "}
                  <a href="https://x.com/shep_newton" target="_blank" rel="noopener noreferrer" className="text-foreground underline underline-offset-4 hover:text-foreground/80 transition-colors">
                    @shep_newton on X
                  </a>.
                </p>
              </section>
            </div>
          </div>
        </div>
      </div>
    </LandingBackground>
  );
};

export default TermsOfService;