import { Download } from "lucide-react";
import Header from "@/components/Header";
import SiteFooter from "@/components/SiteFooter";
import memeAsset from "@/assets/syndrome-meme.png.asset.json";
import bundleAsset from "@/assets/asherin-v50.zip.asset.json";

/**
 * /blog/opensource-asherin — single-panel release page.
 * One meme, one quote, one download of the current Asherin build.
 */

const UPGRADES = [
  "Zophiel engine",
  "Aureon logic system in place",
  "Asherin Maps",
];

const NEW_FEATURES = ["Dorking", "Cloud Intelligence", "Asherin Engine"];

const bundleSizeLabel = `${(bundleAsset.size / 1024 / 1024).toFixed(0)} MB`;

const OpenSourceAsherin = () => {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <Header />

      <main className="mx-auto max-w-2xl px-6 pt-32 pb-24">
        <h1 className="text-3xl sm:text-4xl font-light tracking-tight leading-snug text-foreground">
          OpenSource Asherin
        </h1>

        <figure className="mt-10">
          <img
            src={memeAsset.url}
            alt="Syndrome from The Incredibles raising a fist, smirking"
            width={751}
            height={801}
            loading="lazy"
            className="w-full rounded-2xl border border-border/60 object-cover"
          />
          <figcaption className="mt-6 text-center">
            <blockquote className="text-xl sm:text-2xl font-light italic leading-relaxed text-foreground">
              &ldquo;When everyone&rsquo;s super&hellip; no one will be.&rdquo;
            </blockquote>
            <p className="mt-3 text-xs font-extralight tracking-[0.3em] uppercase text-muted-foreground">
              ~ the villain Syndrome
            </p>
          </figcaption>
        </figure>

        <div className="mt-12 rounded-2xl border border-border/60 bg-card/40 p-6">
          <a
            href={bundleAsset.url}
            download="asherin-v50.zip"
            className="inline-flex items-center gap-3 rounded-xl border border-border bg-background px-5 py-3 text-sm font-light tracking-wide text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Download className="h-4 w-4" aria-hidden="true" />
            download asherinv.50
            <span className="text-xs font-extralight text-muted-foreground">
              ({bundleSizeLabel} zip)
            </span>
          </a>

          <div className="mt-6 space-y-3 text-sm font-extralight leading-relaxed text-foreground/80">
            <p>
              <span className="text-foreground">upgrades:</span>{" "}
              {UPGRADES.join(", ")}
            </p>
            <p>
              <span className="text-foreground">new features added:</span>{" "}
              {NEW_FEATURES.join(", ")}
            </p>
          </div>

          <p className="mt-6 text-xs font-extralight text-muted-foreground">
            This bundle stays the current release until the next version ships.
          </p>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
};

export default OpenSourceAsherin;
