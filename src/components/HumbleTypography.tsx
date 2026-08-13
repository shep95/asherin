import { useEffect } from "react";
import { useLocation } from "react-router-dom";

/**
 * Editorial rules shared by every public page, every article, and the
 * subscription surface.  Longest phrases come first so a specific sentence is
 * softened before a shorter word inside it is considered.
 */
const HUMBLE_REWRITES: ReadonlyArray<readonly [RegExp, string]> = [
  [/most people aren't ready for this/gi, "built for people who need careful research"],
  [/watch what happens when ai has no leash/gi, "see how the tools approach an open question"],
  [/most ai gives you guardrails/gi, "ai systems take different approaches"],
  [/asherin gives you the full picture/gi, "asherin brings relevant sources into one view"],
  [/no artificial limits/gi, "open-ended inquiry"],
  [/truth over comfort/gi, "evidence before certainty"],
  [/production-grade code/gi, "practical code support"],
  [/zero-filter policy/gi, "direct-answer policy"],
  [/no guardrails/gi, "user-directed settings"],
  [/no apologies, no refusals/gi, "with clear explanations when a request cannot be completed"],
  [/we strip the safety filters off the model for you/gi, "you can choose the model and settings that fit your work"],
  [/we uncensor the model so your tool answers anything/gi, "you can configure the model for your intended work"],
  [/get the best out of your prompts/gi, "get more useful results from your prompts"],
  [/that's the wrong approach/gi, "another approach may be more useful"],
  [/how most people prompt/gi, "a broad first prompt"],
  [/the asherin method/gi, "a more specific prompt"],
  [/intelligence with the right data is power/gi, "careful analysis begins with relevant data"],
  [/every powerful empire ran an r&d arm/gi, "research groups have long supported public and private institutions"],
  [/only the best of the best\. you will be competing\./gi, "applications are reviewed carefully and respectfully."],
  [/private darpa for the asher empire/gi, "independent research and development group"],
  [/groomed to outperform/gi, "evaluated through an open comparison"],
  [/we win/gi, "the approach can be useful"],
  [/sees the future before it happens/gi, "explores possible future scenarios"],
  [/controls the present/gi, "models present conditions"],
  [/can't afford to fail/gi, "working with limited resources"],
  [/compete with funded companies/gi, "build alongside better-funded companies"],
  [/beat raw model budgets/gi, "can matter as much as model budget"],
  [/the best ai systems win/gi, "useful ai systems depend"],
  [/the best ai/gi, "a useful ai system"],
  [/the best asset/gi, "an important asset"],
  [/get the best out/gi, "get more from"],
  [/most advanced/gi, "more developed"],
  [/world[- ]class/gi, "carefully developed"],
  [/unmatched/gi, "distinct"],
  [/unrivaled/gi, "distinct"],
  [/revolutionary/gi, "new"],
  [/elite[- ]tier/gi, "specialized"],
  [/elite/gi, "established"],
  [/ultimate/gi, "practical"],
  [/perfect/gi, "well-suited"],
  [/dominates?/gi, "performs well in"],
  [/crush(?:es|ed|ing)?/gi, "outperforms"],
  [/destroy(?:s|ed|ing)?/gi, "disrupts"],
  [/effortless(?:ly)?/gi, "with less manual work"],
  [/guaranteed?/gi, "intended"],
  [/maximum intelligence/gi, "broader tool access"],
  [/most capability/gi, "broader plan"],
  [/everything you need/gi, "a set of tools"],
  [/everything in asherin/gi, "the asherin plan features"],
  [/the full intelligence suite/gi, "additional intelligence tools"],
  [/the complete picture/gi, "a broader view"],
  [/the complete, unfiltered answer/gi, "a direct answer with stated limits"],
  [/full-spectrum/gi, "multi-source"],
  [/answers everything/gi, "explores many questions"],
  [/any question on any topic/gi, "a wide range of questions"],
  [/answers anything/gi, "handles a range of requests"],
  [/no topic is off limits/gi, "supports open-ended inquiry"],
  [/no topic limits/gi, "open-ended topics"],
  [/no hidden bias/gi, "with sources and limitations stated"],
  [/no disclaimers, no refusals, no corporate filters blocking your work/gi, "with sources, useful context, and clear limitations"],
  [/uncensored/gi, "user-directed"],
  [/unrestricted/gi, "user-directed"],
  [/zero setup/gi, "simple setup"],
  [/yours forever/gi, "available in your workspace"],
  [/ship it/gi, "prepare it"],
  [/intelligence-grade/gi, "structured"],
  [/wrong/gi, "less suitable"],
  [/fail/gi, "face avoidable difficulty"],
  [/\bwinner\b/gi, "leading outcome"],
  [/\bloser\b/gi, "other outcome"],
  [/\bbest\b/gi, "well-suited"],
];

const PRESERVE_TAGS = new Set(["CODE", "PRE", "KBD", "SAMP", "SCRIPT", "STYLE", "TEXTAREA", "INPUT"]);

function rewriteCopy(value: string): string {
  return HUMBLE_REWRITES.reduce((copy, [pattern, replacement]) => copy.replace(pattern, replacement), value).toLowerCase();
}

function shouldPreserve(node: Node): boolean {
  const parent = node.nodeType === Node.ELEMENT_NODE ? (node as Element) : node.parentElement;
  return Boolean(parent?.closest("[data-preserve-case], code, pre, kbd, samp, script, style, textarea, input"));
}

function rewriteTree(root: ParentNode): void {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const nodes: Text[] = [];
  while (walker.nextNode()) nodes.push(walker.currentNode as Text);
  nodes.forEach((node) => {
    if (shouldPreserve(node) || !node.nodeValue?.trim()) return;
    const next = rewriteCopy(node.nodeValue);
    if (next !== node.nodeValue) node.nodeValue = next;
  });

  root.querySelectorAll?.("[aria-label], [title], img[alt]").forEach((element) => {
    if (shouldPreserve(element) || PRESERVE_TAGS.has(element.tagName)) return;
    ["aria-label", "title", "alt"].forEach((attribute) => {
      const value = element.getAttribute(attribute);
      if (value) element.setAttribute(attribute, rewriteCopy(value));
    });
  });
}

/**
 * Public pages speak in a quiet, lowercase voice.
 *
 * The switch lives on <html data-humble="on"> and is driven by the route, not
 * by each page, so a new marketing page inherits the voice for free and no
 * component has to remember to opt in.
 *
 * Working surfaces (dashboards, tools, reports) are excluded: there, casing is
 * data — identifiers, hashes, coordinates, code — and flattening it would
 * destroy meaning rather than soften tone. The single exception is the
 * subscription screen, which is commercial copy and opts in explicitly via its
 * own wrapper attribute.
 */
const WORKING_SURFACES = [
  "/dashboard",
  "/asher-dashboard",
  "/report/",
  "/whiteboard",
  "/ziaassets",
];

const HumbleTypography = () => {
  const { pathname } = useLocation();

  useEffect(() => {
    const path = pathname.toLowerCase();
    const isWorking = WORKING_SURFACES.some(
      (p) => path === p || path.startsWith(p.endsWith("/") ? p : `${p}/`),
    );
    const root = document.documentElement;
    if (isWorking) root.removeAttribute("data-humble");
    else root.setAttribute("data-humble", "on");

    const apply = () => {
      const scope = isWorking
        ? document.querySelector("[data-humble-scope]")
        : document.body;
      if (scope) rewriteTree(scope);
      if (!isWorking) {
        document.title = rewriteCopy(document.title);
        document.head.querySelectorAll('meta[name="description"], meta[property="og:title"], meta[property="og:description"], meta[name="twitter:title"], meta[name="twitter:description"]').forEach((meta) => {
          const content = meta.getAttribute("content");
          if (content) meta.setAttribute("content", rewriteCopy(content));
        });
      }
    };

    apply();
    let queued = false;
    const observer = new MutationObserver(() => {
      if (queued) return;
      queued = true;
      window.requestAnimationFrame(() => {
        queued = false;
        apply();
      });
    });
    observer.observe(document.body, { childList: true, subtree: true });

    return () => {
      observer.disconnect();
      root.removeAttribute("data-humble");
    };
  }, [pathname]);

  return null;
};

export default HumbleTypography;
