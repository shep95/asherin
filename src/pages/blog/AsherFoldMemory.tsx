/**
 * /blog/asher-fold-memory — teardown of the asher.fold-memory package, plus the
 * one-time $99 purchase door.
 *
 * Every claim on this page is taken from the package README and its bundled
 * selftest output. Nothing here promises a cloud-bill cut; the honest floor is
 * stated as plainly as the win. The checkout is guest-capable — the buyer is
 * never asked to make an account first.
 */
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Loader2, Lock, Check, X } from "lucide-react";
import ArticleShell from "@/components/seo/ArticleShell";
import { ArticleJsonLd, BreadcrumbJsonLd } from "@/components/seo/SeoJsonLd";
import RelatedLinks from "@/components/seo/RelatedLinks";
import { supabase } from "@/integrations/supabase/client";
import orbitAsset from "@/assets/asherin-fold-memory-orbit.png.asset.json";

const URL = "https://asherin.com/blog/asher-fold-memory";
const TITLE = "asher.fold-memory — leftover memory, stored once";
const PUBLISHED = "2026-08-16";
const PRICE_LABEL = "$99";

/* ────────────────────────── graphs ────────────────────────── */

/** Horizontal measure bar. `value` is 0–100. */
const Bar = ({
  label,
  value,
  note,
  tone = "accent",
}: {
  label: string;
  value: number;
  note?: string;
  tone?: "accent" | "muted" | "good";
}) => {
  const [w, setW] = useState(0);
  useEffect(() => {
    const t = window.setTimeout(() => setW(value), 60);
    return () => window.clearTimeout(t);
  }, [value]);

  const fill =
    tone === "muted"
      ? "bg-muted-foreground/25"
      : tone === "good"
      ? "bg-emerald-400/50"
      : "bg-accent/70";

  return (
    <div className="py-3">
      <div className="flex items-baseline justify-between gap-4">
        <p className="text-[11px] font-light tracking-wide text-foreground/85">{label}</p>
        <p className="shrink-0 font-mono text-[11px] text-muted-foreground">{value}%</p>
      </div>
      <div className="mt-2 h-[10px] w-full overflow-hidden rounded-full bg-background/70 ring-1 ring-inset ring-border/30">
        <div
          className={`h-full rounded-full ${fill} transition-[width] duration-1000 ease-out motion-reduce:transition-none`}
          style={{ width: `${w}%` }}
        />
      </div>
      {note && (
        <p className="mt-1.5 text-[10px] font-extralight leading-snug text-muted-foreground/60">{note}</p>
      )}
    </div>
  );
};

const ResultsPanel = () => (
  <figure className="my-10 rounded-2xl border border-border/15 bg-card/10 p-6 backdrop-blur-md">
    <figcaption className="mb-4">
      <p className="text-[10px] font-extralight uppercase tracking-[0.35em] text-muted-foreground/60">
        ◈ included selftest — synthetic pile
      </p>
      <p className="mt-2 text-[11px] font-extralight leading-relaxed text-muted-foreground/70">
        these are the numbers the bundled selftest printed on the reference runner. they are a
        measurement of a synthetic pile, not a scan of anyone's disk and not a forecast of your bill.
      </p>
    </figcaption>
    <Bar
      label="leftover identical text — shared middle stored once"
      value={82}
      tone="accent"
      note="the copies alias to one box. only the first copy costs anything."
    />
    <Bar
      label="unique random bytes — the floor"
      value={0}
      tone="muted"
      note="a unique original has no twin. it stays the size it is. that is not a bug."
    />
    <Bar
      label="unfold exact, or refuse"
      value={100}
      tone="good"
      note="whole-file fingerprint is re-checked on the way out. a corrupted box is refused, never approximated."
    />
  </figure>
);

/** Donut showing the honest planning bands per workload shape. */
const Donut = ({ pct, label, sub }: { pct: number; label: string; sub: string }) => {
  const r = 34;
  const c = 2 * Math.PI * r;
  return (
    <div className="flex flex-col items-center rounded-xl border border-border/15 bg-card/20 p-4">
      <svg viewBox="0 0 88 88" className="h-24 w-24 -rotate-90" role="img" aria-label={`${label}: ${pct}%`}>
        <circle cx="44" cy="44" r={r} fill="none" strokeWidth="7" className="stroke-border/30" />
        <circle
          cx="44"
          cy="44"
          r={r}
          fill="none"
          strokeWidth="7"
          strokeLinecap="round"
          className="stroke-accent/70"
          strokeDasharray={`${(pct / 100) * c} ${c}`}
        />
      </svg>
      <p className="-mt-[62px] mb-[38px] font-mono text-sm text-foreground">{pct}%</p>
      <p className="text-[11px] font-light text-foreground/85">{label}</p>
      <p className="mt-1 text-center text-[10px] font-extralight leading-snug text-muted-foreground/60">{sub}</p>
    </div>
  );
};

const BandsPanel = () => (
  <figure className="my-10 rounded-2xl border border-border/15 bg-card/10 p-6 backdrop-blur-md">
    <figcaption className="mb-5 text-[10px] font-extralight uppercase tracking-[0.35em] text-muted-foreground/60">
      ◈ planning bands — upper edge of each honest range
    </figcaption>
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
      <Donut pct={100} label="copy-heavy pile" sub="logs, backups of backups, repeated exports. ~40–100% of the copy slice." />
      <Donut pct={35} label="mixed office pile" sub="documents, some logs, some photos. ~15–35% of the mixed pile." />
      <Donut pct={10} label="unique pile" sub="unique rows, original photos, encrypted disks. ~0–10%." />
    </div>
    <p className="mt-4 text-[10px] font-extralight leading-relaxed text-muted-foreground/60">
      every one of these is unsure until you sample your own pile. sample first, then decide.
    </p>
  </figure>
);

/** The ingest → unfold loop, drawn. */
const LoopPanel = () => {
  const steps = [
    { k: "split", v: "into bites" },
    { k: "fingerprint", v: "name by bits" },
    { k: "shelve", v: "twin → point" },
    { k: "squeeze", v: "leftover air" },
    { k: "index", v: "for the cue" },
    { k: "unfold", v: "match or refuse" },
  ];
  return (
    <figure className="my-10 rounded-2xl border border-border/15 bg-card/10 p-6 backdrop-blur-md">
      <figcaption className="mb-4 text-[10px] font-extralight uppercase tracking-[0.35em] text-muted-foreground/60">
        ◈ the loop
      </figcaption>
      <div className="flex flex-wrap items-stretch gap-2">
        {steps.map((s, i) => (
          <div key={s.k} className="flex min-w-[124px] flex-1 items-center gap-2">
            <div className="min-w-0 flex-1 rounded-lg border border-border/20 bg-card/25 px-3 py-2 text-center">
              <p className="text-[11px] font-light text-foreground">{s.k}</p>
              <p className="mt-0.5 text-[10px] font-extralight text-muted-foreground/60">{s.v}</p>
            </div>
            {i < steps.length - 1 && <span aria-hidden className="text-border">→</span>}
          </div>
        ))}
      </div>
    </figure>
  );
};

/* ────────────────────────── purchase door ────────────────────────── */

const BuyPanel = () => {
  const [loading, setLoading] = useState(false);
  const status = useMemo(() => new URLSearchParams(window.location.search).get("purchase"), []);

  useEffect(() => {
    if (status === "success") toast.success("payment received — check your email for the receipt and the pack.");
    if (status === "cancelled") toast("checkout cancelled. nothing was charged.");
  }, [status]);

  const buy = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("fold-memory-checkout", { body: {} });
      if (error) throw error;
      if (!data?.url) throw new Error("no checkout url returned");
      window.location.href = data.url as string;
    } catch (e) {
      console.error("fold-memory checkout failed:", e);
      toast.error("could not open checkout. try again in a moment.");
      setLoading(false);
    }
  };

  return (
    <aside className="my-12 rounded-2xl border border-accent/20 bg-card/20 p-6 backdrop-blur-md">
      <p className="text-[10px] font-extralight uppercase tracking-[0.35em] text-accent/80">◈ the pack</p>
      <div className="mt-3 flex flex-wrap items-end gap-x-4 gap-y-1">
        <p className="text-3xl font-light tracking-tight text-foreground">{PRICE_LABEL}</p>
        <p className="pb-1 text-[11px] font-extralight text-muted-foreground/70">one time. no subscription. no account needed.</p>
      </div>

      <ul className="mt-5 space-y-2">
        {[
          "fold_memory.py — the laptop / device runner. python 3, no extra packages, no wifi for what is already held.",
          "add-to-postgres.sql — the starter closet for a company database: unique boxes, pointers, tick log.",
          "the tested-results graphs, as svg and html.",
          "the readme, written plainly: purpose, the loop, how to add it, and the honest money estimate.",
        ].map((line) => (
          <li key={line} className="flex gap-2.5">
            <Check className="mt-[3px] h-3.5 w-3.5 shrink-0 text-accent/70" />
            <span className="text-[13px] font-extralight leading-relaxed text-foreground/80">{line}</span>
          </li>
        ))}
      </ul>

      <button
        type="button"
        onClick={buy}
        disabled={loading}
        className="mt-6 inline-flex items-center gap-2 rounded-xl bg-accent px-6 py-3 text-[12px] font-light tracking-[0.18em] uppercase text-accent-foreground transition-opacity hover:opacity-90 disabled:opacity-60 focus-visible:outline focus-visible:outline-1 focus-visible:outline-foreground/40"
      >
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Lock className="h-4 w-4" />}
        {loading ? "opening checkout…" : `buy the pack — ${PRICE_LABEL}`}
      </button>

      <p className="mt-3 text-[10px] font-extralight leading-relaxed text-muted-foreground/60">
        payment is handled by stripe. the download link is sent to the email you enter at checkout.
      </p>
    </aside>
  );
};

/* ────────────────────────── page ────────────────────────── */

const AsherFoldMemory = () => (
  <ArticleShell
    eyebrow="Release"
    title={TITLE}
    dek="leftover memory software. it does not make unique things smaller — it keeps one copy of anything identical, and it only hands a file back if the fingerprint still matches. here is the whole package, the measured results, and the honest floor."
    publishedLabel="16 aug 2026"
    readTime="9 min"
    image={
      <img
        src={orbitAsset.url}
        alt="asher.fold-memory — a triangular satellite in low orbit above earth, captioned leftover memory, stored once"
        width={1080}
        height={1080}
        loading="eager"
        className="w-full rounded-2xl border border-border/20 object-cover"
      />
    }
  >
    <ArticleJsonLd
      headline={TITLE}
      description="asher.fold-memory is leftover-memory software: identical copies are stored once, recall runs on a cue, and unfold returns the exact bits or refuses. one-time $99 pack."
      url={URL}
      datePublished={PUBLISHED}
      image={`https://asherin.com${orbitAsset.url}`}
    />
    <BreadcrumbJsonLd
      items={[
        { name: "asherin", url: "https://asherin.com/" },
        { name: "blog", url: "https://asherin.com/blog" },
        { name: TITLE, url: URL },
      ]}
    />

    <p>
      most storage bills are not paid for information. they are paid for repetition — the same log
      line written every minute, the backup of a backup, the spreadsheet emailed five times, the
      json config copied into twenty folders. that is leftover: bytes that already exist somewhere
      else, being paid for again.
    </p>
    <p>
      <strong>asher.fold-memory</strong> is a small piece of software with one law. anything
      identical is stored once. anything unique stays exactly the size it is. and when you ask for
      a file back, you get the original bits or you get a refusal — never a lookalike.
    </p>

    <BuyPanel />

    <h2>what it is for</h2>
    <p>
      unique things — one photo, one encrypted vault, one original file — are the floor. they do
      not get smaller, and any tool that says otherwise is selling something. the purpose here is
      narrower and more honest:
    </p>
    <ul>
      <li>store shared leftover copies once.</li>
      <li>remember where they were by a cue — a hint — instead of stuffing extra copies.</li>
      <li>give the exact original bits back, or refuse.</li>
      <li>run on a laptop with no wifi for what is already held, or inside a company database on a clock.</li>
    </ul>
    <p>
      it is not a cloud warehouse, and it is not a zip that claims to shrink everything.
    </p>

    <h2>how it works</h2>
    <p>the vocabulary first, in plain words:</p>
    <ul>
      <li><strong>leftover copies</strong> — the same bytes sitting in more than one place.</li>
      <li><strong>the floor</strong> — the one original that has no twin. it cannot get smaller.</li>
      <li><strong>fingerprint</strong> — a long id made from the exact bits. change one bit, the id changes.</li>
      <li><strong>closet</strong> — a shelf that labels a box by what is inside, so two identical boxes share one shelf.</li>
      <li><strong>bite</strong> — a bite-sized piece of a file. small bites for text, bigger bites for photos.</li>
      <li><strong>cue</strong> — asking "what did we hold about x?" a <strong>trance</strong> is a richer cue: it adds no storage, it just looks harder at what is already held.</li>
      <li><strong>refuse</strong> — if the fingerprint does not match, do not pretend to have the file.</li>
    </ul>

    <LoopPanel />

    <p>
      a file is split into bites. each bite is named by its fingerprint. if that fingerprint is
      already on the shelf, no second box is stored — the new file just points at the first. the
      leftover air in each box is squeezed, a small recall index is kept so a cue can find the
      right fingerprints, and on the way out the bites are glued in order and the whole-file
      fingerprint is checked again. match, and you get the exact file. miss, and it refuses.
    </p>
    <p>copies die. uniqueness stays.</p>

    <h2>tested results</h2>
    <p>
      the numbers below are the bundled selftest running on a synthetic pile: repeated text plus
      unique random bytes. they are what the software measured, not a drawing of a wish.
    </p>

    <ResultsPanel />

    <h2>the ice-cream law</h2>
    <p>
      this is the part most vendors leave out, so read it before you buy. you buy an ice cream. the
      sun melts it. you cannot take the money back — the ice cream is gone, but the cup is still in
      your hand.
    </p>
    <ul>
      <li>the <strong>ice cream</strong> is the leftover copies.</li>
      <li>the <strong>melt</strong> is this software folding the twins and deleting the extra scoops.</li>
      <li>the <strong>cup</strong> is the database file size your cloud still reports.</li>
      <li>the <strong>freezer</strong> is the disk they rented you. they bill the freezer, not the melted scoops.</li>
    </ul>
    <p>
      postgres keeps the file the same size after a delete — the space inside is empty but the cup
      is unchanged, and the provider bills the freezer you already rented. so your leftover can
      genuinely be gone while the reported number does not move that night. a smaller freezer is a
      later decision, not an automatic refund.
    </p>

    <h2>the money estimate, honestly</h2>
    <p>
      savings track leftover copies, not "all data." pick the row that matches your pile:
    </p>

    <BandsPanel />

    <ul>
      <li>
        <strong>bill is copies</strong> — logs, backups of backups, duplicated exports: plan on
        saving most of <em>that copy slice</em>, often ~40–100% of it. unsure until you sample.
      </li>
      <li>
        <strong>bill is unique</strong> — unique rows, unique photos, unique encrypted disks: plan
        on ~0–10%.
      </li>
      <li>
        <strong>mixed office plus logs plus some photos</strong>: a working planning band is ~15–35%
        of the mixed pile. also unsure.
      </li>
    </ul>
    <p className="flex gap-2.5">
      <X className="mt-1 h-4 w-4 shrink-0 text-destructive/60" />
      <span>
        what this is not: it is not "we will cut your whole cloud bill by 90%." that would only be
        true if almost everything you store were a twin. and it is not "the reported size must fall
        tonight." melted leftover and the cup on the invoice are two different things.
      </span>
    </p>
    <p>
      for context, backup-industry writeups have long put real-world copy ratios somewhere around
      8:1 to 22:1, and have argued that a large share of enterprise growth is copy data rather than
      new unique data. those figures are older and unsure on today's exact percentages. they explain
      why leftover memory has a market; they are not a guarantee about your unique rows.
    </p>

    <h2>how to add it</h2>
    <h3>on a laptop or device</h3>
    <p>
      keep python 3 on the machine. no extra packages, and no wifi is needed for what is already
      held.
    </p>
    <ul>
      <li><code>python fold_memory.py selftest</code> — prove it before trusting it.</li>
      <li><code>python fold_memory.py ingest "/path/to/your/folder"</code> — put a folder in.</li>
      <li><code>python fold_memory.py cue "leftover never deleted"</code> — recall. add <code>--trance</code> to look harder.</li>
      <li><code>python fold_memory.py unfold &lt;fingerprint&gt; --out "/path/to/restored"</code> — get the exact file back.</li>
      <li><code>python fold_memory.py stats</code> — see the sizes.</li>
    </ul>
    <p>
      the runner already skips <code>.env</code>, keys, cookies, wallets and similarly named files.
      do not point it at a password store.
    </p>

    <h3>inside your own software</h3>
    <p>
      this is backend leftover memory, not a frontend widget. add the small database closet from{" "}
      <code>add-to-postgres.sql</code> — tables for unique boxes, pointers, and a tick log — then
      expose three verbs: <strong>ingest</strong>, <strong>unfold</strong> (fingerprint or refuse),
      and <strong>cue</strong>. point ingest, unfold and delete at leftover logs and duplicate
      blobs, never at unique customer rows, and run it on a clock. never ingest secret columns:
      passwords, tokens, vaults, or job commands that carry keys.
    </p>

    <h2>who this saves money for</h2>
    <ul>
      <li>
        <strong>people</strong> — phone dumps, email attachments, the <em>final_final_v3</em>{" "}
        folder. the twins fold; the camera originals stay the floor.
      </li>
      <li>
        <strong>companies</strong> — nightly backups, vm clones, log pipelines, the same contract
        pdf sitting in ten shares. the gap this fills over an existing backup appliance is the
        memory part: cue and trance recall, plus fingerprint-or-refuse as a law inside the product,
        locally, with no wifi needed for held bytes.
      </li>
      <li>
        <strong>governments</strong> — records systems, place files, repeated xml and pdf packets.
        same law: copies fold, unique records stay, unfold must match. no claim is made here about
        classified networks.
      </li>
    </ul>

    <h2>what is in the pack</h2>
    <ul>
      <li><code>fold_memory.py</code> — the laptop / device runner.</li>
      <li><code>add-to-postgres.sql</code> — the starter closet for a company database, with no secrets.</li>
      <li><code>TESTED RESULTS GRAPHS</code> — svg and html.</li>
      <li>the readme, in the same plain language as this page.</li>
    </ul>

    <BuyPanel />

    <RelatedLinks
      heading="keep reading"
      links={[
        { to: "/blog/asherin-agent-sovereign-intelligence-layer", label: "the asherin agent — a personal sovereign intelligence layer" },
        { to: "/software", label: "what else asherin runs" },
        { to: "/pricing", label: "seats and pricing" },
      ]}
    />
  </ArticleShell>
);

export default AsherFoldMemory;
