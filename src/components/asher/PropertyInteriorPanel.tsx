import { useEffect, useMemo, useState } from "react";
import { X, Home, RefreshCw, ExternalLink, Loader2, ImageIcon, BookOpen, Camera, Building } from "lucide-react";

interface Props {
  label: string | null;
  lat: number;
  lng: number;
  onClose: () => void;
}

type Tab = "streetview" | "mapillary" | "imagery" | "history";

interface CommonsImage {
  title: string;
  thumb: string;
  full: string;
  pageUrl: string;
  source: "commons" | "openverse";
  score: number;
  radiusM?: number;
}

interface WikiArticle {
  pageid: number;
  title: string;
  extract?: string;
  url: string;
  thumbnail?: string;
}

interface OsmBuilding {
  id: number;
  tags: Record<string, string>;
}

/**
 * PropertyInteriorPanel
 * --------------------------------------------------------------
 * Click-a-property → see inside it (street-level + interior open imagery)
 * and read its history. 100% live, no API keys.
 *
 *  • Google Street View embed (key-less svembed iframe)
 *  • Mapillary key-less /embed viewer (crowd-sourced street + interior)
 *  • Wikimedia Commons geosearch + Openverse text search — adaptive
 *    radius sweep (200m → 1km → 5km) with interior-keyword scoring so
 *    actual room photos surface before generic nearby files
 *  • Wikipedia geosearch + OSM Overpass building tags for structured
 *    property history (year, architect, heritage status, prior owners
 *    when documented)
 */

const INTERIOR_KEYWORDS = [
  "interior", "inside", "room", "kitchen", "bedroom", "bathroom",
  "living", "dining", "lobby", "hall", "salon", "parlour", "parlor",
  "stair", "atrium", "foyer", "office", "study", "library",
];

function scoreInterior(title: string): number {
  const t = title.toLowerCase();
  let s = 0;
  for (const kw of INTERIOR_KEYWORDS) if (t.includes(kw)) s += 5;
  // Penalize obvious non-property files
  if (/\b(map|plan|portrait|logo|seal|coat[_ ]of[_ ]arms|flag)\b/.test(t)) s -= 4;
  return s;
}

const PropertyInteriorPanel = ({ label, lat, lng, onClose }: Props) => {
  const [tab, setTab] = useState<Tab>("streetview");
  const [nonce, setNonce] = useState(0);

  const [images, setImages] = useState<CommonsImage[] | null>(null);
  const [imagesLoading, setImagesLoading] = useState(false);
  const [imagesErr, setImagesErr] = useState<string | null>(null);
  const [effectiveRadius, setEffectiveRadius] = useState<number | null>(null);

  const [articles, setArticles] = useState<WikiArticle[] | null>(null);
  const [buildings, setBuildings] = useState<OsmBuilding[] | null>(null);
  const [histLoading, setHistLoading] = useState(false);
  const [histErr, setHistErr] = useState<string | null>(null);

  const [previewImg, setPreviewImg] = useState<CommonsImage | null>(null);

  const place = useMemo(
    () => label || `${lat.toFixed(4)}, ${lng.toFixed(4)}`,
    [label, lat, lng],
  );

  const streetViewUrl = `https://maps.google.com/maps?q=&layer=c&cbll=${lat},${lng}&cbp=11,0,0,0,0&output=svembed&t=${nonce}`;
  // /embed renders without a Mapillary account; /app/ shows a login wall in an iframe.
  const mapillaryUrl = `https://www.mapillary.com/embed?map_style=OpenStreetMap&image_key=&map_filter=all&lat=${lat}&lng=${lng}&z=18&style=photo&t=${nonce}`;
  const externalStreetView = `https://www.google.com/maps?q=&layer=c&cbll=${lat},${lng}`;

  // --- Interior imagery: adaptive radius sweep across Commons + Openverse ---
  useEffect(() => {
    if (images !== null) return; // already loaded (or in-flight via previous run)
    let cancelled = false;
    (async () => {
      setImagesLoading(true);
      setImagesErr(null);
      const radii = [200, 1000, 5000]; // metres
      const collected: CommonsImage[] = [];
      let usedRadius: number | null = null;
      try {
        for (const r of radii) {
          if (cancelled) return;

          // Commons geosearch
          const commonsUrl = `https://commons.wikimedia.org/w/api.php?action=query&format=json&origin=*&generator=geosearch&ggscoord=${lat}|${lng}&ggsradius=${r}&ggsnamespace=6&ggslimit=40&prop=imageinfo|info&iiprop=url|extmetadata&iiurlwidth=320&inprop=url`;

          // Openverse: text query around place label, filtered by license
          const ovQuery = encodeURIComponent(
            (label ? `${label} interior` : "building interior") +
            ` ${lat.toFixed(2)} ${lng.toFixed(2)}`
          );
          const openverseUrl = `https://api.openverse.org/v1/images/?q=${ovQuery}&page_size=20&license_type=all-cc`;

          const [cRes, oRes] = await Promise.allSettled([
            fetch(commonsUrl).then((x) => x.json()),
            fetch(openverseUrl, { headers: { Accept: "application/json" } })
              .then((x) => (x.ok ? x.json() : { results: [] }))
              .catch(() => ({ results: [] })),
          ]);

          if (cRes.status === "fulfilled") {
            const pages = (cRes.value as any)?.query?.pages || {};
            for (const p of Object.values<any>(pages)) {
              const ii = p.imageinfo?.[0];
              if (!ii) continue;
              const title = String(p.title || "").replace(/^File:/, "");
              collected.push({
                title,
                thumb: ii.thumburl || ii.url,
                full: ii.url,
                pageUrl: ii.descriptionurl || p.fullurl || "",
                source: "commons",
                score: scoreInterior(title) + 1, // small base for Commons
                radiusM: r,
              });
            }
          }

          if (oRes.status === "fulfilled") {
            const results = ((oRes.value as any)?.results || []) as any[];
            for (const it of results) {
              const title = String(it.title || it.id || "");
              collected.push({
                title,
                thumb: it.thumbnail || it.url,
                full: it.url,
                pageUrl: it.foreign_landing_url || it.url,
                source: "openverse",
                score: scoreInterior(title),
              });
            }
          }

          // Stop expanding as soon as we have a decent pool
          if (collected.length >= 8) {
            usedRadius = r;
            break;
          }
          usedRadius = r;
        }

        // Dedupe by full URL, then sort: interior score desc, then commons first
        const seen = new Set<string>();
        const ranked = collected
          .filter((i) => {
            if (!i.full || seen.has(i.full)) return false;
            seen.add(i.full);
            return true;
          })
          .sort((a, b) => {
            if (b.score !== a.score) return b.score - a.score;
            if (a.source !== b.source) return a.source === "commons" ? -1 : 1;
            return 0;
          })
          .slice(0, 48);

        if (!cancelled) {
          setImages(ranked);
          setEffectiveRadius(usedRadius);
        }
      } catch (e: any) {
        if (!cancelled) setImagesErr(e?.message || "Failed to load imagery");
      } finally {
        if (!cancelled) setImagesLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [images, lat, lng, label]);

  // --- History: Wikipedia geosearch + OSM Overpass (multiple buildings) ----
  useEffect(() => {
    if (articles !== null && buildings !== null) return;
    let cancelled = false;
    (async () => {
      setHistLoading(true);
      setHistErr(null);
      try {
        const wikiUrl = `https://en.wikipedia.org/w/api.php?action=query&format=json&origin=*&generator=geosearch&ggscoord=${lat}|${lng}&ggsradius=500&ggslimit=15&prop=extracts|info|pageimages&exintro=1&explaintext=1&exchars=400&inprop=url&piprop=thumbnail&pithumbsize=120`;

        // Overpass: up to 5 nearest building polygons with tags (within 60m)
        const overpassQ = `[out:json][timeout:15];(way["building"](around:60,${lat},${lng});relation["building"](around:60,${lat},${lng}););out tags 5;`;
        const overpassEndpoints = [
          "https://overpass-api.de/api/interpreter",
          "https://overpass.kumi.systems/api/interpreter",
        ];

        const wikiP = fetch(wikiUrl).then((r) => r.json()).catch(() => ({}));

        const overpassP = (async () => {
          for (const ep of overpassEndpoints) {
            try {
              const r = await fetch(ep, {
                method: "POST",
                headers: {
                  "Content-Type": "application/x-www-form-urlencoded",
                  Accept: "application/json",
                },
                body: `data=${encodeURIComponent(overpassQ)}`,
              });
              if (!r.ok) continue;
              return await r.json();
            } catch { /* try next */ }
          }
          return { elements: [] };
        })();

        const [wikiJson, opJson] = await Promise.all([wikiP, overpassP]);
        const wPages = (wikiJson as any)?.query?.pages || {};
        const wList: WikiArticle[] = Object.values(wPages).map((p: any) => ({
          pageid: p.pageid,
          title: p.title,
          extract: p.extract,
          url: p.fullurl,
          thumbnail: p.thumbnail?.source,
        }));
        const els: any[] = (opJson as any)?.elements || [];
        const bs: OsmBuilding[] = els
          .map((el) => ({ id: el.id, tags: el.tags || {} }))
          // Prefer ones with descriptive tags
          .sort((a, b) => Object.keys(b.tags).length - Object.keys(a.tags).length);

        if (!cancelled) {
          setArticles(wList);
          setBuildings(bs);
        }
      } catch (e: any) {
        if (!cancelled) setHistErr(e?.message || "Failed to load history");
      } finally {
        if (!cancelled) setHistLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [articles, buildings, lat, lng]);

  const reload = () => {
    setNonce((n) => n + 1);
    setImages(null);
    setArticles(null);
    setBuildings(null);
    setEffectiveRadius(null);
  };

  const tabs: { id: Tab; label: string; icon: any }[] = [
    { id: "streetview", label: "Street View", icon: Camera },
    { id: "mapillary", label: "Mapillary", icon: ImageIcon },
    { id: "imagery", label: "Interior / Rooms", icon: Home },
    { id: "history", label: "History", icon: BookOpen },
  ];

  return (
    <div className="absolute top-3 right-3 z-[1002] w-[480px] max-h-[calc(100%-1.5rem)] rounded-2xl border border-border/30 bg-card/95 backdrop-blur-xl shadow-2xl overflow-hidden flex flex-col">
      <div className="flex items-center justify-between border-b border-border/15 px-3 py-2">
        <div className="flex items-center gap-2 min-w-0">
          <Home className="h-3.5 w-3.5 text-foreground/70 shrink-0" strokeWidth={1.5} />
          <p className="text-[10px] font-light tracking-[0.3em] text-muted-foreground uppercase truncate">
            Inside Property — {place}
          </p>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={reload} className="p-1 text-muted-foreground hover:text-foreground" title="Reload">
            <RefreshCw className="h-3 w-3" strokeWidth={1.5} />
          </button>
          <button onClick={onClose} className="p-1 text-muted-foreground hover:text-foreground" title="Close">
            <X className="h-3.5 w-3.5" strokeWidth={1.5} />
          </button>
        </div>
      </div>

      <div className="flex items-center gap-1 border-b border-border/15 px-2 py-1.5 overflow-x-auto">
        {tabs.map((t) => {
          const Icon = t.icon;
          const badge =
            t.id === "imagery" && images
              ? images.length
              : t.id === "history" && (articles || buildings)
              ? (articles?.length || 0) + (buildings?.length || 0)
              : null;
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-1.5 px-2 py-1 rounded text-[10px] font-light tracking-[0.18em] uppercase transition-colors whitespace-nowrap ${
                tab === t.id
                  ? "bg-foreground/10 text-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-foreground/5"
              }`}
            >
              <Icon className="h-3 w-3" strokeWidth={1.5} />
              {t.label}
              {badge !== null && badge > 0 && (
                <span className="ml-0.5 text-[9px] font-mono opacity-70">{badge}</span>
              )}
              {((t.id === "imagery" && imagesLoading) || (t.id === "history" && histLoading)) && (
                <Loader2 className="h-2.5 w-2.5 animate-spin opacity-60" />
              )}
            </button>
          );
        })}
      </div>

      <div className="flex-1 overflow-auto">
        {tab === "streetview" && (
          <div className="space-y-2">
            <div className="aspect-video bg-black">
              <iframe
                key={streetViewUrl}
                src={streetViewUrl}
                title="Street view"
                className="h-full w-full"
                allow="accelerometer; gyroscope; fullscreen"
              />
            </div>
            <a
              href={externalStreetView}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-1.5 mx-3 mb-3 rounded-md border border-border/30 px-3 py-1.5 text-[10px] font-light tracking-[0.18em] text-muted-foreground hover:text-foreground hover:bg-foreground/5 uppercase"
            >
              <ExternalLink className="h-3 w-3" /> Open in Google Maps
            </a>
          </div>
        )}

        {tab === "mapillary" && (
          <div className="space-y-2">
            <div className="aspect-video bg-black">
              <iframe
                key={mapillaryUrl}
                src={mapillaryUrl}
                title="Mapillary street imagery"
                className="h-full w-full"
                allow="accelerometer; gyroscope; fullscreen"
              />
            </div>
            <p className="px-3 pb-3 text-[9px] font-light tracking-wider text-muted-foreground/70 uppercase">
              Crowd-sourced street & interior imagery (CC-BY-SA). Drag to navigate panoramas.
            </p>
          </div>
        )}

        {tab === "imagery" && (
          <div className="p-3 space-y-2">
            {imagesLoading && (
              <div className="flex items-center justify-center py-10 text-muted-foreground text-xs">
                <Loader2 className="h-4 w-4 animate-spin mr-2" /> Sweeping Wikimedia Commons + Openverse…
              </div>
            )}
            {imagesErr && <p className="text-[10px] text-destructive font-light">{imagesErr}</p>}

            {!imagesLoading && images && images.length === 0 && (
              <p className="text-[11px] font-extralight text-muted-foreground/70 text-center py-8">
                No open-licensed imagery within 5 km. Residential houses usually have no open interior photos for privacy reasons — try a hotel, museum, landmark, or city block.
              </p>
            )}

            {images && images.length > 0 && (
              <>
                <div className="flex items-center justify-between text-[9px] tracking-[0.2em] uppercase text-muted-foreground/70 px-0.5">
                  <span>{images.length} open-licensed photos</span>
                  {effectiveRadius && (
                    <span>radius: {effectiveRadius >= 1000 ? `${effectiveRadius / 1000} km` : `${effectiveRadius} m`}</span>
                  )}
                </div>
                <div className="grid grid-cols-3 gap-1.5">
                  {images.map((img) => (
                    <button
                      key={img.pageUrl + img.full}
                      onClick={() => setPreviewImg(img)}
                      className="group relative aspect-square overflow-hidden rounded border border-border/20 bg-black/30"
                      title={img.title}
                    >
                      <img
                        src={img.thumb}
                        alt={img.title}
                        loading="lazy"
                        onError={(e) => { (e.currentTarget.parentElement as HTMLElement).style.display = "none"; }}
                        className="h-full w-full object-cover transition-transform group-hover:scale-105"
                      />
                      {img.score > 0 && (
                        <span className="absolute top-0.5 left-0.5 px-1 py-px rounded bg-emerald-500/80 text-[8px] text-white font-mono">
                          interior
                        </span>
                      )}
                      <span className="absolute bottom-0.5 right-0.5 px-1 rounded bg-black/60 text-[8px] text-white/80 font-mono uppercase">
                        {img.source === "commons" ? "wm" : "ov"}
                      </span>
                    </button>
                  ))}
                </div>
              </>
            )}

            {previewImg && (
              <div
                className="fixed inset-0 z-[1100] bg-black/85 backdrop-blur flex items-center justify-center p-6"
                onClick={() => setPreviewImg(null)}
              >
                <div
                  className="max-w-4xl w-full bg-card/95 rounded-xl overflow-hidden border border-border/30"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="flex items-center justify-between px-3 py-2 border-b border-border/20">
                    <p className="text-[10px] font-light tracking-[0.2em] text-muted-foreground uppercase truncate">
                      {previewImg.title}
                    </p>
                    <div className="flex items-center gap-2">
                      <a
                        href={previewImg.pageUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-1 text-muted-foreground hover:text-foreground"
                        title={`Source: ${previewImg.source === "commons" ? "Wikimedia Commons" : "Openverse"}`}
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                      <button onClick={() => setPreviewImg(null)} className="p-1 text-muted-foreground hover:text-foreground">
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                  <img src={previewImg.full} alt={previewImg.title} className="w-full max-h-[75vh] object-contain bg-black" />
                </div>
              </div>
            )}
          </div>
        )}

        {tab === "history" && (
          <div className="p-3 space-y-3">
            {histLoading && (
              <div className="flex items-center justify-center py-10 text-muted-foreground text-xs">
                <Loader2 className="h-4 w-4 animate-spin mr-2" /> Querying OpenStreetMap + Wikipedia…
              </div>
            )}
            {histErr && <p className="text-[10px] text-destructive font-light">{histErr}</p>}

            {!histLoading && buildings && buildings.length > 0 && (
              <div className="space-y-2">
                {buildings.slice(0, 5).map((b) => (
                  <div key={b.id} className="rounded-lg border border-border/20 bg-foreground/5 p-3 space-y-1.5">
                    <div className="flex items-center gap-1.5">
                      <Building className="h-3 w-3 text-foreground/70" />
                      <p className="text-[10px] font-light tracking-[0.2em] text-foreground uppercase">
                        Structure — OSM #{b.id}
                      </p>
                    </div>
                    {Object.keys(b.tags).length === 0 ? (
                      <p className="text-[10px] text-muted-foreground/60 italic">No descriptive tags.</p>
                    ) : (
                      <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[10px] font-light">
                        {Object.entries(b.tags)
                          .filter(([k]) => !k.startsWith("addr:source") && k !== "source")
                          .slice(0, 18)
                          .map(([k, v]) => (
                            <div key={k} className="contents">
                              <span className="text-muted-foreground/60 truncate">{k}</span>
                              <span className="text-foreground/90 truncate">{v}</span>
                            </div>
                          ))}
                      </div>
                    )}
                    <a
                      href={`https://www.openstreetmap.org/way/${b.id}/history`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-[10px] font-light tracking-wider text-muted-foreground hover:text-foreground uppercase pt-1"
                    >
                      <ExternalLink className="h-3 w-3" /> Edit history
                    </a>
                  </div>
                ))}
              </div>
            )}

            {!histLoading && buildings && buildings.length === 0 && (
              <p className="text-[11px] font-extralight text-muted-foreground/70">
                No mapped building footprint within 60 m of this point.
              </p>
            )}

            {articles && articles.length > 0 && (
              <div className="space-y-2">
                <p className="text-[10px] font-light tracking-[0.25em] text-muted-foreground uppercase">
                  Historical Context — Wikipedia ({articles.length})
                </p>
                {articles.map((a) => (
                  <a
                    key={a.pageid}
                    href={a.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex gap-2 rounded-lg border border-border/20 bg-card/40 p-2 hover:bg-foreground/5 transition-colors"
                  >
                    {a.thumbnail && (
                      <img src={a.thumbnail} alt="" className="h-14 w-14 rounded object-cover shrink-0" />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="text-[11px] font-light text-foreground truncate">{a.title}</p>
                      {a.extract && (
                        <p className="text-[10px] font-extralight text-muted-foreground/80 line-clamp-3 mt-0.5">
                          {a.extract}
                        </p>
                      )}
                    </div>
                  </a>
                ))}
              </div>
            )}
            {!histLoading && articles && articles.length === 0 && (!buildings || buildings.length === 0) && (
              <p className="text-[11px] font-extralight text-muted-foreground/70 text-center py-6">
                No documented historical context found at this exact location.
              </p>
            )}
          </div>
        )}
      </div>

      <div className="border-t border-border/15 px-3 py-1.5 text-[9px] font-light tracking-wider text-muted-foreground/70 uppercase">
        Sources: Google SV · Mapillary · Wikimedia Commons · Openverse · Wikipedia · OSM Overpass
      </div>
    </div>
  );
};

export default PropertyInteriorPanel;
