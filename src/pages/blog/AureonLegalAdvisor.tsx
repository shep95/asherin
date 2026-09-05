import { useEffect } from "react";
import ArticleShell from "@/components/seo/ArticleShell";
import RelatedLinks from "@/components/seo/RelatedLinks";
import {
  ArticleJsonLd,
  BreadcrumbJsonLd,
  FaqJsonLd,
} from "@/components/seo/SeoJsonLd";
import { applySeoHead } from "@/lib/seoHead";

/**
 * /blog/aureon-legal-advisor-multi-jurisdictional
 *
 * Long-form field report on the July 8, 2026 launch of Asherin & Asher
 * "LAW mode" — a multi-jurisdictional legal-research reflex that surfaces
 * older statutes, colonial-era carryovers, and precedent that quietly
 * supersedes modern law across any country, state, or province.
 */
const URL = "https://asherin.com/blog/aureon-legal-advisor-multi-jurisdictional";
const PUBLISHED = "2026-07-08";

const FAQ = [
  {
    q: "What is LAW mode in Asherin and Asher?",
    a: "LAW mode is a per-message toggle that wraps every prompt in a strict multi-jurisdictional legal-research directive. The model researches every applicable law in the country, state, or province you named, including older statutes and precedent that can supersede newer law, and returns a structured answer with jurisdiction, controlling authority, conflicts, and a mandatory disclaimer.",
  },
  {
    q: "Does LAW mode replace a lawyer?",
    a: "No. LAW mode is an intelligence layer for legal research and orientation. Every output carries an explicit disclaimer that it is not legal advice and that a licensed attorney in the relevant jurisdiction is required before acting.",
  },
  {
    q: "How does LAW mode handle older laws that override newer ones?",
    a: "The directive forces the model to check colonial statutes, uncodified common law, constitutional carve-outs, and binding precedent before quoting a modern statute. Where an older instrument controls, the answer names both, cites the conflict, and flags which one is currently enforceable.",
  },
  {
    q: "Can LAW mode fabricate case citations?",
    a: "The directive explicitly forbids invented citations. When the model is not certain a case, statute number, or section exists, it must say so and refuse to render a fake citation.",
  },
];

const AureonLegalAdvisor = () => {
  useEffect(() => {
    applySeoHead({
      title:
        "Asherin Legal Advisor (LAW Mode), Multi-Jurisdictional AI Legal Research | Asherin",
      description:
        "Asherin and Asher now ship LAW mode: a per-message toggle that runs deep multi-jurisdictional legal research across any country, state, or province, including older statutes that supersede newer law.",
      path: "/blog/aureon-legal-advisor-multi-jurisdictional",
    });
  }, []);

  return (
    <>
      <ArticleJsonLd
        id="legal-advisor"
        url={URL}
        headline="Asherin Legal Advisor (LAW Mode), Multi-Jurisdictional AI Legal Research"
        description="A field report on the July 8, 2026 launch of LAW mode across Asherin and Asher, how it researches every applicable law in a jurisdiction, surfaces older statutes that supersede newer ones, and enforces a no-fabrication rule on citations."
        datePublished={PUBLISHED}
        keywords={[
          "aureon legal advisor",
          "ai legal research",
          "multi-jurisdictional law ai",
          "older laws superseding newer",
          "law mode aureon",
          "asher legal ai",
        ]}
      />
      <BreadcrumbJsonLd
        id="legal-advisor"
        items={[
          { name: "Home", url: "/" },
          { name: "Blog", url: "/blog" },
          { name: "Asherin Legal Advisor (LAW Mode)", url: URL },
        ]}
      />
      <FaqJsonLd id="legal-advisor" items={FAQ} />

      <ArticleShell
        eyebrow="Field Report"
        publishedLabel="July 8, 2026"
        readTime="8 min read"
        title="Asherin Legal Advisor, LAW mode ships multi-jurisdictional research to every operator"
        dek="Asherin and Asher now run a dedicated legal-research reflex on demand. Toggle the LAW pill in the composer and every prompt is wrapped in a strict directive that hunts the entire body of applicable law, modern statutes, colonial-era carryovers, uncodified common law, and binding precedent, across any country, state, or province you name."
      >
        <h2>Why LAW mode exists</h2>
        <p>
          Legal answers fail quietly. A model that quotes the newest
          statute and stops there is confident, fast, and often wrong
          because in most legal systems there is an older instrument
          that continues to control. Colonial-era acts still bind former
          Commonwealth jurisdictions. Uncodified common law overrides
          statute in narrow but decisive slices. Constitutional
          carve-outs can strip a modern law of effect the moment it is
          challenged. LAW mode is the reflex that forces the model to
          walk that whole stack before it speaks.
        </p>

        <h2>How the reflex works</h2>
        <p>
          A single toggle in the composer, the <strong>LAW</strong>{" "}
          pill, sitting next to <strong>NAR</strong>, flips the send
          path. When it is on, your prompt is wrapped in a legal-research
          directive before it reaches the model. The directive is
          deterministic and lives in <code>src/lib/legalAdvisor.ts</code>{" "}
          so every surface (Asherin Chat, Asher Chat) speaks the exact
          same protocol.
        </p>
        <ol>
          <li>
            <strong>Extract jurisdiction.</strong> Country, state or
            province, and city when the user names one. If jurisdiction
            is ambiguous, the answer opens by naming the ambiguity
            rather than guessing.
          </li>
          <li>
            <strong>Enumerate sources.</strong> Constitution, primary
            legislation, delegated legislation, judicial precedent,
            uncodified common law, colonial carryovers, and any
            supranational instruments (EU directives, ECOWAS protocols,
            African Union, OAS, etc.) that bind the jurisdiction.
          </li>
          <li>
            <strong>Detect conflicts.</strong> When two instruments
            speak to the same question, LAW mode names both, states
            which controls, and explains why (lex posterior, lex
            superior, lex specialis, or a constitutional carve-out).
          </li>
          <li>
            <strong>Refuse fabricated citations.</strong> The directive
            forbids invented case numbers, statute sections, and article
            numbers. Where the model is not certain, it says so on the
            record.
          </li>
          <li>
            <strong>Ship the disclaimer.</strong> Every output ends with
            a mandatory notice: this is intelligence, not legal advice;
            engage a licensed attorney in the relevant jurisdiction
            before acting.
          </li>
        </ol>

        <h2>Older laws that quietly override newer ones</h2>
        <p>
          The most common failure mode of general-purpose AI on legal
          questions is confidently citing the newest statute while an
          older instrument still controls. LAW mode targets exactly
          this. A few live examples of the pattern the reflex was built
          to catch:
        </p>
        <ul>
          <li>
            Commonwealth jurisdictions that never repealed a colonial
            criminal code section, so the modern penal act appears to
            govern but the older section still supplies the operative
            definition.
          </li>
          <li>
            US states where a nineteenth-century statute of frauds
            survives modernization and quietly voids a contract that
            would otherwise be valid under the newest commercial code.
          </li>
          <li>
            Civil-law countries where a Napoleonic-era article of the
            civil code was never fully displaced by a specialized modern
            statute, so the older article decides the edge case.
          </li>
          <li>
            Constitutional carve-outs that make a modern statute
            unenforceable against a protected class of speech, worship,
            or property.
          </li>
        </ul>
        <p>
          Missing one of these is not a rounding error, it is the
          difference between the answer being useful and the answer
          being wrong.
        </p>

        <h2>Where LAW mode fits in the operator stack</h2>
        <p>
          LAW mode sits alongside two other composer toggles:
        </p>
        <ul>
          <li>
            <strong>NAR</strong>, converts a raw prompt into a
            structured narrative before sending, so the model sees
            intent, context, and flaw analysis instead of a wall of
            text. Use for planning, briefing, and multi-step reasoning.
          </li>
          <li>
            <strong>LAW</strong>, wraps a prompt in the
            legal-research directive above. Use whenever you are asking
            a jurisdictional question, running a compliance sweep, or
            trying to understand the enforceable law in a foreign
            country.
          </li>
        </ul>
        <p>
          The two toggles are independent. Turn on both when you want a
          structured narrative frame <em>and</em> full legal enumeration
, for example, a due-diligence memo on operating in a new
          jurisdiction.
        </p>

        <h2>What LAW mode is not</h2>
        <p>
          LAW mode is <strong>not</strong> a replacement for a licensed
          attorney. It is not a substitute for a jurisdiction-local
          research service where the stakes justify one. It cannot see
          sealed dockets, private counsel opinions, or unpublished
          agency guidance. It will not draft a filing or sign an
          engagement letter. The disclaimer at the bottom of every LAW
          output is the honest boundary of what the reflex can do.
        </p>

        <h2>How to use it right now</h2>
        <ol>
          <li>
            Open <a href="/dashboard">Asherin Chat</a> or Asher Chat.
          </li>
          <li>
            Click the <strong>LAW</strong> pill in the composer. It
            glows when active.
          </li>
          <li>
            Ask a jurisdictional question, for example, <em>"What are
            the current employer notice requirements before terminating
            an at-will employee in Montana, and does any older statute
            override the modern rule?"</em>
          </li>
          <li>
            Read the structured output: jurisdiction, controlling
            authority, conflicting instruments, and the mandatory
            disclaimer.
          </li>
        </ol>
        <p>
          Toggle LAW off for any non-legal turn so your token budget
          stays clean.
        </p>

        <RelatedLinks
          heading="Related in the operator stack"
          links={[
            {
              to: "/hosrad",
              label: "HOSRAD, House of Asher Research & Developers",
              description:
                "The R&D division that funded the legal reflex, alongside quantum, AI, and defense work.",
            },
            {
              to: "/updates",
              label: "Asherin changelog",
              description:
                "Daily engineering updates from the operator stack, including the July 8, 2026 LAW mode ship.",
            },
            {
              to: "/blog/ai-without-restrictions",
              label: "AI without restrictions, the operator workflow",
              description:
                "How Asherin's model-choice, prompt-discipline, and refusal-detection layers keep long sessions honest.",
            },
            {
              to: "/blog/what-is-ai-osint",
              label: "What is AI OSINT? The analyst's guide",
              description:
                "The four-stage OSINT pipeline that feeds the same jurisdictional intelligence layer LAW mode consumes.",
            },
          ]}
        />
      </ArticleShell>
    </>
  );
};

export default AureonLegalAdvisor;
