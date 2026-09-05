import { Key, Lock, DollarSign, ShieldCheck, RefreshCw, Network } from "lucide-react";
import FeaturePageShell from "@/components/landing/FeaturePageShell";
import {
  ArticleJsonLd,
  BreadcrumbJsonLd,
  FaqJsonLd,
} from "@/components/seo/SeoJsonLd";
import RelatedLinks from "@/components/seo/RelatedLinks";

const URL = "https://asherin.com/feature/byok";
const TITLE = "BYOK on Asherin, Nine Providers, Zero Markup | Asherin";
const PUBLISHED = "2026-06-19";

const PROVIDERS = [
  { name: "Gemini (Google AI Studio)", note: "Default for vision and long-context work. Billing to Google. Free tier covers most operator workloads." },
  { name: "OpenAI", note: "GPT-4o, GPT-4.1, o-series. Billing to OpenAI. Org-scoped keys supported." },
  { name: "Anthropic Claude", note: "Claude 3.5 / 4.x family. Billing to Anthropic. Workspace keys supported." },
  { name: "Mistral / Codestral", note: "European-hosted reasoning + code models. Billing to Mistral." },
  { name: "xAI Grok", note: "Real-time-search-tuned reasoning. Billing to xAI." },
  { name: "Groq", note: "Lowest-latency open-weights inference (Llama, DeepSeek, GPT-OSS via Groq). Billing to Groq." },
  { name: "DeepSeek", note: "DeepSeek-V3 / R1 reasoning. Billing to DeepSeek." },
  { name: "OpenRouter", note: "Aggregator key, routes to 200+ models across vendors. Billing to OpenRouter." },
  { name: "Venice", note: "Uncensored mistral-31-24b default for operators without a paid key. Vision-capable." },
];

const FeatureByok = () => (
  <>
    <ArticleJsonLd
      id="feature-byok"
      url={URL}
      headline={TITLE}
      description="Asherin's BYOK implementation across nine providers. Operators bring their own API key, pay the vendor directly, and route every reasoning call through their own account with zero platform markup."
      datePublished={PUBLISHED}
      keywords={[
        "byok ai",
        "bring your own key ai",
        "byok ai platform",
        "ai api key",
        "sovereign ai",
      ]}
    />
    <BreadcrumbJsonLd
      id="feature-byok"
      items={[
        { name: "Asherin", url: "/" },
        { name: "Software", url: "/software" },
        { name: "BYOK", url: "/feature/byok" },
      ]}
    />

    <FeaturePageShell
      documentTitle={TITLE}
      eyebrow="Sovereign Stack · BYOK"
      headline={
        <>
          BYOK on Asherin
          <br />
          <span className="text-muted-foreground/70">
            nine providers, zero markup, your billing.
          </span>
        </>
      }
      subheadline="BYOK, Bring Your Own Key, is the floor of Asherin's sovereign stack. Operators paste a key from any of nine providers, pay the vendor directly, and route every reasoning call through their own account. No platform proxy. No prompt mutation. No revoke risk from a third party."
      tierLabel="Included on every paid tier · Free Venice fallback for non-BYOK users"
      capabilities={[
        {
          icon: Key,
          title: "Nine Providers Supported",
          description:
            "Gemini, OpenAI, Claude, Mistral, xAI, Groq, DeepSeek, OpenRouter, Venice. Paste a key, pick a model, route everything Asherin does through your account.",
        },
        {
          icon: DollarSign,
          title: "Direct Vendor Billing",
          description:
            "Spend is invoiced by the model vendor, not Aureon. A typical operator BYOK bill at the API tier is ~$15-25/month on OpenAI vs $47/month on Asherin's managed Chat tier, see the cost comparison below.",
        },
        {
          icon: Lock,
          title: "Encrypted Key Storage",
          description:
            "Keys are encrypted at rest with AES-256-GCM using per-user envelope encryption. Decryption happens only inside the edge function that issues the outbound call to the vendor.",
        },
        {
          icon: Network,
          title: "Zero Prompt Mutation",
          description:
            "Asherin does not append a hidden system prompt to BYOK calls. The exact prompt you author is the exact prompt that hits the vendor, verifiable in your vendor's request log.",
        },
        {
          icon: RefreshCw,
          title: "Per-Call Provider Toggle",
          description:
            "Switch providers per conversation, not per account. A single chat can route message 1 to Claude, message 2 to Gemini, message 3 to Groq, all through your own keys.",
        },
        {
          icon: ShieldCheck,
          title: "Sovereign-Stack Compatible",
          description:
            "BYOK is the prerequisite for sovereignty. Every Asherin module, Zophiel, ZERLAL, AXRLEN, NOMAD, respects the active BYOK key. The operator's vendor account is the single source of inference cost and audit.",
        },
      ]}
      useCases={[
        "Operators already on a paid OpenAI / Claude / Gemini plan who want one interface that respects their key.",
        "Teams with strict procurement: a single vendor invoice instead of two (vendor + platform).",
        "Researchers who need to route every call through their org's monitored vendor account for audit.",
        "Operators rotating providers mid-session to compare reasoning, refusal behavior, or latency.",
        "Cost-sensitive operators using Groq or DeepSeek for low-cost inference on long sessions.",
        "Privacy-first operators using Venice + their own key when the workload can't touch a US vendor account.",
      ]}
      ctaTitle="Connect your first key in under 60 seconds"
      ctaSubtitle="Settings → AI Keys → paste, save, ready. Every Asherin module starts routing through your account immediately."
    >
      <section className="relative z-10 px-6 pb-24">
        <div className="mx-auto max-w-3xl space-y-8 text-base font-extralight leading-[1.85] text-foreground/85">
          <h2 className="text-2xl font-light tracking-tight text-foreground pt-4">
            Why BYOK before anything else
          </h2>
          <p>
            Sovereignty starts at the key. A platform that holds the key
            holds the operator. BYOK inverts that: the operator holds the
            key, the platform routes through it. This is the necessary
            though not sufficient, condition for{" "}
            <a href="/glossary/sovereign-ai" className="text-accent hover:underline">
              sovereign AI
            </a>
            , and it is the layer Asherin implements first because the
            rest of the sovereign stack does not work without it. The
            background terminology is documented in{" "}
            <a href="/glossary/byok-ai" className="text-accent hover:underline">
              the BYOK AI glossary entry
            </a>
            ; this page covers the specifics of Asherin's implementation.
          </p>

          <h2 className="text-2xl font-light tracking-tight text-foreground pt-4">
            All nine providers, with their differences
          </h2>
          <p>
            The supported providers and what changes per provider:
          </p>
          <ul>
            {PROVIDERS.map((p) => (
              <li key={p.name}>
                <strong>{p.name}.</strong> {p.note}
              </li>
            ))}
          </ul>

          <h2 className="text-2xl font-light tracking-tight text-foreground pt-4">
            Cost comparison, with real numbers
          </h2>
          <p>
            For a typical operator workload, call it 10M input tokens
            and 2M output tokens per month on the GPT-4o-mini class
            BYOK economics look like this: roughly <strong>$2-4/month</strong>{" "}
            on Groq with an open-weights model, <strong>$10-15/month</strong>{" "}
            on OpenAI GPT-4o-mini direct, or <strong>$0/month</strong>{" "}
            on Gemini Flash through Google AI Studio's free tier. Compare
            to Asherin's managed Chat tier at <strong>$47/month</strong>,
            which exists for operators who do not want to manage keys
            and prefer a single bill. The two paths are deliberately
            both available, BYOK for cost-optimization and sovereignty,
            managed tier for operational simplicity.
          </p>

          <h2 className="text-2xl font-light tracking-tight text-foreground pt-4">
            Security architecture
          </h2>
          <p>
            Keys are encrypted at rest with AES-256-GCM. Each user's key
            is wrapped under a per-user envelope key that is itself
            wrapped under a platform master key held in a managed
            secret store (not in the database). Decryption happens
            inside the edge function that issues the outbound call to
            the vendor, and the cleartext key never leaves that
            function's memory. The platform does not log key material,
            and audit logs reference only the SHA-256 fingerprint of
            the key for diagnostic purposes.
          </p>

          <h2 className="text-2xl font-light tracking-tight text-foreground pt-4">
            Named limitations
          </h2>
          <p>
            BYOK does not anonymize the operator to the vendor, your
            OpenAI bill identifies you to OpenAI, your Claude bill
            identifies you to Anthropic, etc. Asherin's BYOK is about
            sovereignty against the platform, not anonymity against the
            model vendor. For operators who need anonymity from the
            vendor as well, the Venice fallback is the closest available
            primitive on the supported list; for true vendor anonymity,
            self-hosting an open-weights model on operator hardware is
            the correct architecture and BYOK is not a substitute.
          </p>

          <FaqJsonLd
            id="feature-byok"
            items={[
              {
                q: "What is BYOK on Asherin?",
                a: "BYOK, Bring Your Own Key, lets an operator paste a key from any of nine supported providers (Gemini, OpenAI, Claude, Mistral, xAI, Groq, DeepSeek, OpenRouter, Venice). Every Asherin reasoning call routes through that key, the operator pays the vendor directly, and the platform never mutates the prompt.",
              },
              {
                q: "Does Asherin charge a markup on BYOK calls?",
                a: "No. BYOK calls bill from the model vendor to the operator with zero Asherin markup. Asherin's revenue comes from the paid subscription tier, not from rebilling inference.",
              },
              {
                q: "How are my API keys stored?",
                a: "Keys are encrypted at rest with AES-256-GCM using per-user envelope encryption. Decryption happens only inside the edge function issuing the outbound call. The platform does not log key material; audit logs reference only a SHA-256 fingerprint.",
              },
              {
                q: "Can I switch providers mid-conversation?",
                a: "Yes. The per-call provider toggle allows a single conversation to route message 1 to one provider, message 2 to another, etc. All routing respects the active BYOK key for the selected provider.",
              },
              {
                q: "What is the actual cost difference vs the managed tier?",
                a: "For a typical operator workload (10M in / 2M out per month), BYOK runs roughly $0 on Gemini Flash free tier, $2-4 on Groq, or $10-15 on OpenAI GPT-4o-mini direct. The Asherin managed Chat tier is $47/month, designed for operators who prefer one bill and no key management.",
              },
            ]}
          />

          <RelatedLinks
            heading="Continue down the BYOK cluster"
            links={[
              {
                to: "/glossary/byok-ai",
                label: "BYOK AI, full definition",
                description: "The term itself, what it means, and what it does not mean.",
              },
              {
                to: "/glossary/sovereign-ai",
                label: "Sovereign AI, the four-layer test",
                description: "Why BYOK is necessary but not sufficient for sovereignty.",
              },
              {
                to: "/blog/sovereign-ai-platforms",
                label: "The 2026 sovereign AI platform landscape",
                description: "Where Asherin's BYOK sits in the broader sovereign-AI market.",
              },
              {
                to: "/pricing",
                label: "Pricing, BYOK vs managed",
                description: "When BYOK saves money, and when the managed tier is the better fit.",
              },
            ]}
          />
        </div>
      </section>
    </FeaturePageShell>
  </>
);

export default FeatureByok;
