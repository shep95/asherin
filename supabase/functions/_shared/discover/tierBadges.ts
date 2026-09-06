// source → tier badge. tier is roughly "how corroborating is this?"
export function sourceTier(source: string): "t1" | "t2" | "t3" | "t4" {
  const s = source.toLowerCase();
  if (["crt.sh", "sec.edgar", "keys.openpgp.org", "commoncrawl"].some((x) => s.includes(x))) return "t1";
  if (["wayback", "wikidata", "gravatar", "github"].some((x) => s.includes(x))) return "t2";
  if (["xposedornot", "url-probe", "dns"].some((x) => s.includes(x))) return "t3";
  return "t4";
}
