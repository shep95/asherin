---
name: pattern-creator
description: The adaptive pattern creator mechanism — discover, create, evaluate, retain, retrieve, compose, adapt, evolve — with provenance, scope, testing, quarantine, retirement and transfer constraints. Retrieve on explicit request; never inject wholesale into a prompt.
---

# Pattern creator

A reusable mechanism for turning experience into retrievable procedure. It is a
procedure, not a persona, and it never modifies model weights: adaptation is
retrieval, scope, memory and procedure.

## The cycle

1. **Discover** — run only when coverage is insufficient. Triggers: no coverage,
   partial coverage with named gaps, repeated failure, explicit user feedback.
   Unknown is a real state; record it rather than inventing a fit.
2. **Create** — prefer a mechanism that already works somewhere over a fresh
   guess. Order of preference: cross-domain transfer, composition of two partial
   matches, synthesis from primitives (lowest confidence).
3. **Evaluate** — a created pattern is a hypothesis. It carries evidence
   quality, confidence, and success/failure counts, all starting at the bottom.
4. **Retain** — promotion runs through the learning gate, never by generation.
   Status ladder: observed → candidate → testing → validated → active → refined.
5. **Retrieve** — by trigger terms, domain, and context relevance. Never dump
   the registry into a prompt; retrieve a small ranked set per turn.
6. **Compose** — combine, sequence, nest, mutate, generalize, specialize,
   domain-swap, add feedback or redundancy.
7. **Adapt** — feedback is attributed to the pattern or process that produced
   the unwanted result, and classified by scope: task, conversation, project,
   user, domain, or (only after abstraction) global.
8. **Evolve** — a new version never overwrites an old one. Lineage is immutable
   and reversible.

## Pattern object

identity · domain · family · abstraction · scale · context · trigger · inputs ·
state_before · goals · function · mechanism · transformations · constraints ·
causal/temporal/spatial/information structure · state_after · outputs · side
effects · feedback · adaptation · assumptions · invariants · evidence ·
uncertainty · confidence · compatible/conflicting/complementary patterns ·
analogies · failure modes · anti-patterns · repair patterns · transfer
constraints · tests · falsifiers · success and stopping conditions.

## Transfer constraints

Cross-domain transfer runs source → function → mechanism → invariant → abstract
pattern → target function → target constraints → candidate implementation →
test. Surface resemblance is never sufficient. If the invariant does not hold in
the target domain, the transfer is refused and the reason recorded.

## Quarantine and retirement

- A pattern that contradicts a validated pattern is quarantined, not deleted,
  and excluded from retrieval until the contradiction is resolved.
- A pattern whose failure count outweighs its evidence is retired to `failed`
  with the conditions under which it failed.
- Retirement and quarantine are reversible; the history stays.

## Provenance

Every pattern records where it came from: built-in, user feedback,
conversation, project observation, research, experiment, composition,
cross-domain transfer, or global. Provenance is never inferred after the fact.

## Boundaries

- No credentials, secrets, or personal identifiers ever enter a pattern.
- Global promotion requires abstraction that strips every identifier first.
- No model weights are trained, fine-tuned, or otherwise modified.
