import ArticleShell from "@/components/seo/ArticleShell";
import {
  ArticleJsonLd,
  BreadcrumbJsonLd,
  FaqJsonLd,
} from "@/components/seo/SeoJsonLd";
import RelatedLinks from "@/components/seo/RelatedLinks";

const URL = "https://asherin.com/glossary/byok-ai";
const TITLE = "BYOK AI, Bring Your Own Key, Defined";
const PUBLISHED = "2026-06-19";

const ByokAi = () => (
  <ArticleShell
    eyebrow="Glossary · Definition"
    title="What Is BYOK AI?"
    dek="BYOK AI is a platform model where the operator supplies their own provider key, Gemini, OpenAI, Claude, Mistral, xAI, and pays the model vendor directly. This is the full definition, the economics, and the seven providers Asherin supports natively."
    publishedLabel="Jun 19 2026"
    readTime="5 min"
    backTo={{ to: "/glossary", label: "← Asherin Glossary" }}
  >
    <ArticleJsonLd
      id="byok-ai"
      url={URL}
      headline={TITLE}
      description="Definitional guide to BYOK AI, how it works, why operators choose it, and how Asherin implements it across nine providers."
      datePublished={PUBLISHED}
      keywords={["byok ai", "bring your own key ai", "byok intelligence platform"]}
    />
    <BreadcrumbJsonLd
      id="byok-ai"
      items={[
        { name: "Asherin", url: "/" },
        { name: "Glossary", url: "/glossary" },
        { name: "BYOK AI", url: "/glossary/byok-ai" },
      ]}
    />
    <h2>How BYOK works in practice</h2>
    <ol>
      <li>The operator creates an account with a model vendor (e.g. OpenAI, Google, Anthropic) and generates an API key.</li>
      <li>The operator pastes that key into the AI platform's settings, encrypted and stored against their user record only.</li>
      <li>Every request the operator makes is signed with their key and sent to the vendor's endpoint. Billing flows from the vendor directly to the operator's vendor account.</li>
      <li>The platform takes zero token margin. The platform's revenue (if any) comes from subscription or one-time licensing for the platform itself, not from arbitrage on model usage.</li>
    </ol>

    <h2>Why operators choose BYOK</h2>
    <ul>
      <li>
        <strong>Cost transparency.</strong> Operators see exact vendor pricing
        on their vendor invoice. No hidden markup, no opaque "credit" system.
      </li>
      <li>
        <strong>Model choice.</strong> A platform-paid plan typically pins
        operators to one or two models the platform negotiated rates on. BYOK
        operators can switch to whichever model best fits the task, Gemini
        for long context, Claude for agentic code, GPT-4 for general
        reasoning, Mistral for uncensored work.
      </li>
      <li>
        <strong>Lock-in resistance.</strong> If the platform shuts down or
        changes terms, the operator's vendor account, vendor keys, and vendor
        history remain intact. The investment in their AI workflow is portable.
      </li>
      <li>
        <strong>Compliance.</strong> Enterprise operators frequently must
        contract directly with the AI vendor for data-handling and
        retention guarantees. BYOK is the only way to keep that contract clean.
      </li>
    </ul>

    <h2>BYOK is necessary but not sufficient for sovereignty</h2>
    <p>
      A BYOK platform that adds its own refusal layer on top of the operator's
      vendor traffic is not sovereign. A BYOK platform that proxies the
      request through a server it controls, and could log, re-encode, or
      re-route the prompt, is not sovereign. BYOK is the key layer of the
      sovereign stack, but{" "}
      <a href="/glossary/sovereign-ai">three more layers</a> are required for
      a platform to be genuinely sovereign.
    </p>

    <h2>Asherin's BYOK implementation</h2>
    <p>
      Asherin supports BYOK across nine providers in 2026: Gemini, OpenAI,
      Claude, Groq, DeepSeek, Mistral, xAI, OpenRouter, and Venice. Keys are
      encrypted at rest, scoped to a single user, and used as the
      authentication credential on every request to the chosen vendor.
      Operators who do not bring a key fall back to a platform-paid Venice
      uncensored model so the platform stays usable for everyone, but the
      BYOK path is the one operators graduate to once they know which models
      they want to ship.
    </p>

    <FaqJsonLd
      id="byok-ai"
      items={[
        {
          q: "What does BYOK stand for in AI?",
          a: "BYOK stands for Bring Your Own Key. The operator supplies their own API key from a model vendor (such as OpenAI, Google, Anthropic, Mistral) and the AI platform uses that key to call the vendor's API on the operator's behalf.",
        },
        {
          q: "Is BYOK AI cheaper than subscription AI?",
          a: "For heavy users, yes, operators pay vendor rates with no platform markup. For light users, a subscription plan with bundled tokens may be cheaper at low volumes. BYOK wins on cost transparency, model choice, and lock-in resistance.",
        },
        {
          q: "Which providers does Asherin support for BYOK?",
          a: "Asherin supports BYOK across nine providers: Gemini, OpenAI, Claude, Groq, DeepSeek, Mistral, xAI, OpenRouter, and Venice. Each key is encrypted at rest and scoped to a single user.",
        },
      ]}
    />

    <RelatedLinks
      links={[
        {
          to: "/glossary/sovereign-ai",
          label: "Sovereign AI, full definition",
          description: "Why BYOK is the first layer of a sovereign stack but only the first.",
        },
        {
          to: "/feature/byok",
          label: "Asherin's BYOK feature",
          description: "Configure keys for nine providers inside the operator dashboard.",
        },
        {
          to: "/llm-models",
          label: "Supported LLM models",
          description: "The full catalog of vendors and model IDs Asherin routes BYOK traffic to.",
        },
        {
          to: "/glossary/uncensored-ai",
          label: "Uncensored AI, definition",
          description: "How BYOK lets operators pick models that don't refuse mid-task.",
        },
      ]}
    />
  </ArticleShell>
);

export default ByokAi;
