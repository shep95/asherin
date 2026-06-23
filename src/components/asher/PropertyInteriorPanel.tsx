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
  distance?: number;
}

interface WikiArticle {
  pageid: number;
  title: string;
  extract?: string;
  distance?: number;
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
 * Click-a-property → see inside it (street-level + interior open
 * imagery) and read its history. 100% live, no API keys:
 *  • Google Street View embed (key-less svembed iframe)
 *  • Mapillary panoramic / street imagery viewer
 *  • Wikimedia Commons geosearch — nearby open-licensed photos
 *    (frequently includes interior shots of public buildings,
 *    landmarks, hotels, museums, listed residences)
 *  • Wikipedia geosearch + OSM Overpass building tags →
 *    structured property history (year built, architect,
 *    heritage status, prior owners when documented)
 */
const PropertyInteriorPanel = ({ label, lat, lng, onClose }: Props) => {
  const [tab, setTab] = useState<Tab>("streetview");
  const [nonce, setNonce] = useState(0);

  const [images, setImages] = useState<CommonsImage[] | null>(null);
  const [imagesLoading, setImagesLoading] = useState(false);
  const [imagesErr, setImagesErr] = useState<string | null>(null);

  const [articles, setArticles] = useState<WikiArticle[] | null>(null);
  const [building, setBuilding] = useState<OsmBuilding | null>(null);
  const [histLoading, setHistLoading] = useState(false);
  const [histErr, setHistErr] = useState<string | null>(null);

  const [previewImg, setPreviewImg] = useState<CommonsImage | null>(null);

  const place = useMemo(
    () => label || `${lat.toFixed(4)}, ${lng.toFixed(4)}`,
    [label, lat, lng],
  );

  const streetViewUrl = `https://maps.google.com/maps?q=&layer=c&cbll=${lat},${lng}&cbp=11,0,0,0,0&output=svembed&t=${nonce}`;
  const mapillaryUrl = `https://www.mapillary.com/app/?lat=${lat}&lng=${lng}&z=18&focus=photo&t=${nonce}`;
  const externalStreetView = `https://www.google.com/maps?q=&layer=c&cbll=${lat},${lng}`;

  // --- Load Wikimedia Commons imagery (radius 200m, includes interiors) ----
  useEffect(() => {
    if (tab !== "imagery" || images !== null) return;
    let cancelled = false;
    (async () => {
      setImagesLoading(true);
      setImagesErr(null);
      try {
        const url = `https://commons.wikimedia.org/w/api.php?action=query&format=json&origin=*&generator=geosearch&ggscoord=${lat}|${lng}&ggsradius=500&ggsnamespace=6&ggslimit=40&prop=imageinfo|info&iiprop=url|extmetadata&iiurlwidth=320&inprop=url`;
        const res = await fetch(url);
        const json = await res.json();
        const pages = json?.query?.pages || {};
        const list: CommonsImage[] = Object.values(pages)
          .map((p: any) => {
            const ii = p.imageinfo?.[0];
            if (!ii) return null;
            return {
              title: (p.title || "").replace(/^File:/, ""),
              thumb: ii.thumburl || ii.url,
              full: ii.url,
              pageUrl: ii.descriptionurl || p.fullurl || "",
            } as CommonsImage;
          })
          .filter(Boolean) as CommonsImage[];
        if (!cancelled) setImages(list);
      } catch (e: any) {
        if (!cancelled) setImagesErr(e?.message || "Failed to load imagery");
      } finally {
        if (!cancelled) setImagesLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [tab, images, lat, lng]);

  // --- Load Wikipedia articles + OSM building tags for history ------------
  useEffect(() => {
    if (tab !== "history" || (articles !== null && building !== null)) return;
    let cancelled = false;
    (async () => {
      setHistLoading(true);
      setHistErr(null);
      try {
        const wikiUrl = `https://en.wikipedia.org/w/api.php?action=query&format=json&origin=*&generator=geosearch&ggscoord=${lat}|${lng}&ggsradius=400&ggslimit=15&prop=extracts|info|pageimages&exintro=1&explaintext=1&exchars=400&inprop=url&piprop=thumbnail&pithumbsize=120`;
        const wikiRes = await fetch(wikiUrl);
        const wikiJson = await wikiRes.json();
        const wPages = wikiJson?.query?.pages || {};
        const wList: WikiArticle[] = Object.values(wPages).map((p: any) => ({
          pageid: p.pageid,
          title: p.title,
          extract: p.extract,
          url: p.fullurl,
          thumbnail: p.thumbnail?.source,
        }));

        // Overpass: nearest building polygon with tags (within ~30m)
        const overpassQ = `[out:json][timeout:15];(way["building"](around:30,${lat},${lng});relation["building"](around:30,${lat},${lng}););out tags 1;`;
        const opRes = await fetch("https://overpass-api.de/api/interpreter", {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: `data=${encodeURIComponent(overpassQ)}`,
        });
        const opJson = await opRes.json();
        const el = opJson?.elements?.[0];
        const b: OsmBuilding | null = el ? { id: el.id, tags: el.tags || {} } : null;

        if (!cancelled) {
          setArticles(wList);
          setBuilding(b);
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
  }, [tab, articles, building, lat, lng]);

  const reload = () => {
    setNonce((n) => n + 1);
    setImages(null);
    setArticles(null);
    setBuilding(null);
  };

  const tabs: { id: Tab; label: string; icon: any }[] = [
    { id: "streetview", label: "Street View", icon: Camera },
    { id: "mapillary", label: "Mapillary", icon: ImageIcon },
    { id: "imagery", label: "Interior / Nearby", icon: Home },
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
          <button
            onClick={reload}
            className="p-1 text-muted-foreground hover:text-foreground"
            title="Reload"
          >
            <RefreshCw className="h-3 w-3" strokeWidth={1.5} />
          </button>
          <button
            onClick={onClose}
            className="p-1 text-muted-foreground hover:text-foreground"
            title="Close"
          >
            <X className="h-3.5 w-3.5" strokeWidth={1.5} />
          </button>
        </div>
      </div>

      <div className="flex items-center gap-1 border-b border-border/15 px-2 py-1.5 overflow-x-auto">
        {tabs.map((t) => {
          const Icon = t.icon;
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
                <Loader2 className="h-4 w-4 animate-spin mr-2" /> Searching Wikimedia Commons…
              </div>
            )}
            {imagesErr && (
              <p className="text-[10px] text-destructive font-light">{imagesErr}</p>
            )}
            {!imagesLoading && images && images.length === 0 && (
              <p className="text-[11px] font-extralight text-muted-foreground/70 text-center py-8">
                No open-licensed imagery within 500m. Try a public building, landmark, or city centre.
              </p>
            )}
            {images && images.length > 0 && (
              <div className="grid grid-cols-3 gap-1.5">
                {images.map((img) => (
                  <button
                    key={img.pageUrl}
                    onClick={() => setPreviewImg(img)}
                    className="group relative aspect-square overflow-hidden rounded border border-border/20 bg-black/30"
                    title={img.title}
                  >
                    <img
                      src={img.thumb}
                      alt={img.title}
                      loading="lazy"
                      className="h-full w-full object-cover transition-transform group-hover:scale-105"
                    />
                  </button>
                ))}
              </div>
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
                        title="Source on Wikimedia Commons"
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                      <button
                        onClick={() => setPreviewImg(null)}
                        className="p-1 text-muted-foreground hover:text-foreground"
                      >
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
            {histErr && (
              <p className="text-[10px] text-destructive font-light">{histErr}</p>
            )}

            {!histLoading && building && Object.keys(building.tags).length > 0 && (
              <div className="rounded-lg border border-border/20 bg-foreground/5 p-3 space-y-1.5">
                <div className="flex items-center gap-1.5">
                  <Building className="h-3 w-3 text-foreground/70" />
                  <p className="text-[10px] font-light tracking-[0.2em] text-foreground uppercase">
                    Structure Record — OSM #{building.id}
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[10px] font-light">
                  {Object.entries(building.tags)
                    .filter(([k]) => !k.startsWith("addr:source") && k !== "source")
                    .slice(0, 24)
                    .map(([k, v]) => (
                      <div key={k} className="contents">
                        <span className="text-muted-foreground/60 truncate">{k}</span>
                        <span className="text-foreground/90 truncate">{v}</span>
                      </div>
                    ))}
                </div>
                <a
                  href={`https://www.openstreetmap.org/way/${building.id}/history`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-[10px] font-light tracking-wider text-muted-foreground hover:text-foreground uppercase pt-1"
                >
                  <ExternalLink className="h-3 w-3" /> Edit history
                </a>
              </div>
            )}

            {!histLoading && building && Object.keys(building.tags).length === 0 && (
              <p className="text-[11px] font-extralight text-muted-foreground/70">
                Structure found in OSM but no descriptive tags (year, architect, use).
              </p>
            )}
            {!histLoading && !building && (
              <p className="text-[11px] font-extralight text-muted-foreground/70">
                No mapped building footprint within 30m of this point.
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
            {!histLoading && articles && articles.length === 0 && !building && (
              <p className="text-[11px] font-extralight text-muted-foreground/70 text-center py-6">
                No documented historical context found at this exact location.
              </p>
            )}
          </div>
        )}
      </div>

      <div className="border-t border-border/15 px-3 py-1.5 text-[9px] font-light tracking-wider text-muted-foreground/70 uppercase">
        Sources: Google SV · Mapillary · Wikimedia Commons · Wikipedia · OSM Overpass
      </div>
    </div>
  );
};

export default PropertyInteriorPanel;
