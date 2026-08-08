// dorkDomainDoctrine.ts — Asherin Dork Doctrine (55 domains × pivot patterns).
//
// This is TRAINING SUBSTRATE, not a static query list. It teaches Aureon the
// SHAPE of public-exposure surfaces so the engine can synthesise novel dork
// combinations no analyst has run before — the "first-to-find" doctrine.
//
// Every entry names: the domain, why the surface exists (root cause), the
// canonical query skeletons, and the pivot edges (which domain # it feeds
// into). The cross-domain attack chain is what makes this elite — not any
// single dork.

export interface DomainEntry {
  id: number;
  tier: "infrastructure" | "organizational" | "research" | "personal" | "signals";
  name: string;
  rootCause: string;              // WHY this surface leaks (human/behavioral)
  seeds: string[];                // canonical query skeletons ({{t}} = target, {{d}} = domain)
  pivotsTo: number[];             // domain ids this typically feeds into
}

// ── The 55-domain doctrine ─────────────────────────────────────────────────
export const DORK_DOMAINS: DomainEntry[] = [
  { id: 1,  tier: "research",       name: "Academic & research networks", rootCause: "Students/faculty deploy their own research boxes with no central IT.", seeds: [`site:*.edu intext:"{{t}}" filetype:pdf`, `site:*.edu inurl:~ "{{t}}"`, `site:*.edu intitle:"lab members" "{{t}}"`], pivotsTo: [9, 27, 39, 46] },
  { id: 2,  tier: "personal",       name: "Court records & legal filings", rootCause: "Older PACER/state filings uploaded before SSN redaction rules.", seeds: [`site:pacer.gov "{{t}}"`, `site:*.uscourts.gov "{{t}}" filetype:pdf`, `"{{t}}" intext:"plaintiff" OR intext:"defendant" filetype:pdf`], pivotsTo: [21, 30, 47] },
  { id: 3,  tier: "signals",        name: "IoT / cameras / ICS", rootCause: "Default creds + no auth + web management interfaces exposed.", seeds: [`intitle:"SCADA" inurl:login`, `intitle:"Network Camera" inurl:ViewerFrame`, `intitle:"building automation" inurl:control "{{t}}"`], pivotsTo: [15, 38, 43] },
  { id: 4,  tier: "organizational", name: "Healthcare & medical", rootCause: "HIPAA governs process, not misconfigured web hosts.", seeds: [`site:*.hospital.org filetype:xls "{{t}}"`, `intitle:"DICOM" inurl:viewer`, `intext:"medical record" filetype:csv "{{t}}"`], pivotsTo: [25, 53] },
  { id: 5,  tier: "organizational", name: "Financial institutions ecosystem", rootCause: "Banks are hardened — accountants, advisors, and trustees are not.", seeds: [`site:sec.gov "confidential" filetype:pdf "{{t}}"`, `inurl:edgar filetype:htm intext:"material weakness" "{{t}}"`, `intitle:"client portal" inurl:login "{{t}}"`], pivotsTo: [40, 45] },
  { id: 6,  tier: "organizational", name: "Real estate & property records", rootCause: "Every county publishes assessor rolls in a different, indexable way.", seeds: [`site:*.county.gov filetype:pdf "property owner" "{{t}}"`, `"{{t}}" intext:"property owner" site:.gov`, `intitle:"HOA" filetype:pdf intext:"{{t}}"`], pivotsTo: [32, 47] },
  { id: 7,  tier: "organizational", name: "HR & employment", rootCause: "High document volume + shared drives + weak folder ACLs.", seeds: [`site:{{d}} filetype:xls "salary"`, `site:{{d}} inurl:hr filetype:doc`, `intitle:"organizational chart" filetype:pdf site:{{d}}`], pivotsTo: [26, 55] },
  { id: 8,  tier: "organizational", name: "Government contracts & procurement", rootCause: "Contracting law mandates public filings with technical detail.", seeds: [`site:sam.gov "{{t}}"`, `site:fpds.gov filetype:pdf "{{t}}"`, `intext:"statement of work" filetype:pdf site:.gov "{{t}}"`], pivotsTo: [14, 45] },
  { id: 9,  tier: "research",       name: "Academic theses & dissertations", rootCause: "Grad students describe REAL systems they had insider access to.", seeds: [`site:proquest.com filetype:pdf "{{t}}"`, `"{{t}}" intext:"case study" site:*.edu filetype:pdf`, `intext:"vulnerability" intext:"{{t}}" site:*.edu filetype:pdf`], pivotsTo: [1, 27, 39] },
  { id: 10, tier: "signals",        name: "Shipping / logistics / supply chain", rootCause: "COVID pushed warehouse/freight ops onto public web dashboards.", seeds: [`intitle:"shipment tracking" inurl:portal "{{t}}"`, `site:customs.gov filetype:pdf "manifest" "{{t}}"`, `intext:"bill of lading" filetype:pdf "{{t}}"`], pivotsTo: [45] },
  { id: 11, tier: "personal",       name: "Political & campaign finance", rootCause: "Legally mandated public disclosure at line-item granularity.", seeds: [`site:fec.gov "{{t}}"`, `site:opensecrets.org "{{t}}"`, `site:lobbyingdisclosure.house.gov "{{t}}"`], pivotsTo: [32, 55] },
  { id: 12, tier: "signals",        name: "Paste sites & code repos", rootCause: "Developers commit more than they intend, publicly.", seeds: [`site:pastebin.com "{{t}}"`, `site:github.com "{{t}}" "api_key"`, `site:gitlab.com "{{t}}" filetype:env`], pivotsTo: [43, 54, 55] },
  { id: 13, tier: "research",       name: "Scientific datasets", rootCause: "Reproducibility push publishes raw data with weak deidentification.", seeds: [`site:zenodo.org "{{t}}" filetype:csv`, `site:figshare.com "{{t}}" filetype:xls`, `intext:"dataset" intext:"participants" site:*.edu filetype:csv "{{t}}"`], pivotsTo: [1, 46] },
  { id: 14, tier: "organizational", name: "Military & defense adjacent", rootCause: "Contractor + FOIA + conference material orbits the classified world.", seeds: [`site:defense.gov filetype:pdf "unclassified" "{{t}}"`, `site:*.mil filetype:pdf -classified "{{t}}"`, `intext:"FOIA" site:*.gov filetype:pdf "{{t}}"`], pivotsTo: [8, 24] },
  { id: 15, tier: "signals",        name: "Personal devices on the internet", rootCause: "Users self-host NAS/Plex/HA then forget access controls.", seeds: [`intitle:"Plex" inurl:manage`, `intitle:"Home Assistant" inurl:lovelace`, `intitle:"Synology" inurl:webman "{{t}}"`], pivotsTo: [3, 51, 55] },
  { id: 16, tier: "personal",       name: "Dark-web surface mirrors", rootCause: "Leak sites + paste mirrors + hacker aggregators are on the clearnet.", seeds: [`"{{t}}" "leaked" site:pastebin.com`, `"{{t}}" intext:"ransomware" filetype:txt`, `"{{t}}" intext:"data dump"`], pivotsTo: [12, 43] },
  { id: 17, tier: "personal",       name: "Journalism document repositories", rootCause: "Investigative outlets publish source docs, fully indexed.", seeds: [`site:icij.org "{{t}}"`, `site:documentcloud.org "{{t}}"`, `site:muckrock.com "{{t}}"`], pivotsTo: [2, 30] },
  { id: 18, tier: "infrastructure", name: "Satellite / geospatial intel", rootCause: "Commercial imagery + academic GIS + ADS-B are freely indexed.", seeds: [`site:earthexplorer.usgs.gov "{{t}}"`, `intext:"coordinates" filetype:kml "{{t}}"`, `intext:"ADS-B" filetype:csv "{{t}}"`], pivotsTo: [19, 35] },
  { id: 19, tier: "infrastructure", name: "Telecom infrastructure", rootCause: "FCC filings publish tower GPS + spectrum + carrier maps.", seeds: [`site:fcc.gov "{{t}}" filetype:pdf`, `site:fcc.gov "tower location" filetype:kml`, `intext:"fiber route" filetype:pdf site:.gov "{{t}}"`], pivotsTo: [18, 48] },
  { id: 20, tier: "personal",       name: "Religious & community orgs", rootCause: "High trust + low IT sophistication + PDF member directories.", seeds: [`site:{{d}} filetype:pdf "directory"`, `intitle:"congregation" filetype:pdf "members" "{{t}}"`, `intitle:"parish" filetype:pdf "contact" "{{t}}"`], pivotsTo: [55] },
  { id: 21, tier: "personal",       name: "Insurance regulatory", rootCause: "State insurance commissions publish complaint dockets.", seeds: [`site:*.gov "insurance commission" filetype:pdf "{{t}}"`, `intext:"workers compensation" filetype:pdf "{{t}}"`, `site:naic.org "{{t}}" filetype:pdf`], pivotsTo: [2, 47] },
  { id: 22, tier: "organizational", name: "Environmental / EPA filings", rootCause: "Toxic Release Inventory + ECHO are statutorily public.", seeds: [`site:epa.gov "{{t}}" filetype:pdf`, `site:echo.epa.gov "{{t}}"`, `intext:"toxic release inventory" "{{t}}"`], pivotsTo: [47] },
  { id: 23, tier: "research",       name: "Academic conference materials", rootCause: "PPT/PDF slides indexed with data speakers verbalised as internal.", seeds: [`site:academia.edu "{{t}}"`, `site:researchgate.net "{{t}}" filetype:pdf`, `intitle:"presentation" intext:"{{t}}" site:*.edu filetype:pdf`, `intitle:"conference" intext:"{{t}}" filetype:ppt`], pivotsTo: [1, 39, 46] },
  { id: 24, tier: "personal",       name: "Military veterans records", rootCause: "VA/FOIA/reunion sites + LinkedIn service histories.", seeds: [`site:*.va.gov filetype:pdf "{{t}}"`, `"{{t}}" intext:"veterans" filetype:pdf`, `site:fold3.com "{{t}}"`], pivotsTo: [14] },
  { id: 25, tier: "organizational", name: "FDA records", rootCause: "Warning letters + Form 483 + approvals are statutorily public.", seeds: [`site:fda.gov "warning letter" "{{t}}"`, `site:fda.gov "inspection" filetype:pdf "{{t}}"`, `site:fda.gov "483" "{{t}}"`], pivotsTo: [4] },
  { id: 26, tier: "organizational", name: "Labor / employment regulatory", rootCause: "OSHA/NLRB/DOL/H-1B require detailed public filings.", seeds: [`site:osha.gov "{{t}}" filetype:pdf`, `site:nlrb.gov "{{t}}"`, `site:flcdatacenter.com "{{t}}" H-1B`], pivotsTo: [7] },
  { id: 27, tier: "research",       name: "Student information systems", rootCause: "Rosters + lab pages + course sites accidentally indexed.", seeds: [`site:*.edu intext:"graduate students" filetype:pdf "{{t}}"`, `site:*.edu intitle:"lab members" "{{t}}"`, `site:*.edu intext:"thesis" intext:"{{t}}" filetype:pdf`], pivotsTo: [1, 9, 39] },
  { id: 28, tier: "signals",        name: "Cryptocurrency & blockchain", rootCause: "Public ledger + once identity-linked, permanent.", seeds: [`site:bitcointalk.org "{{t}}" "address"`, `"{{t}}" site:blockchain.info`, `intext:"donate" intext:"{{t}}"`], pivotsTo: [12, 55] },
  { id: 29, tier: "personal",       name: "Obituaries & genealogy", rootCause: "Funeral homes publish family maps in permanent, indexed PDFs.", seeds: [`site:legacy.com "{{t}}"`, `site:findagrave.com "{{t}}"`, `intext:"survived by" intext:"{{t}}" filetype:pdf`], pivotsTo: [32, 55] },
  { id: 30, tier: "organizational", name: "Nonprofit / Form 990", rootCause: "990s expose officer comp + board maps + grants.", seeds: [`site:projects.propublica.org/nonprofits "{{t}}"`, `site:guidestar.org "{{t}}"`, `intext:"Form 990" "{{t}}" filetype:pdf`], pivotsTo: [11] },
  { id: 31, tier: "organizational", name: "Patent & IP filings", rootCause: "18-month publication reveals roadmaps + inventor rosters.", seeds: [`site:patents.google.com "{{t}}"`, `site:espacenet.epo.org "{{t}}"`, `intext:"assignee" intext:"{{t}}" site:patents.google.com`], pivotsTo: [7, 55] },
  { id: 32, tier: "personal",       name: "Electoral / voter data", rootCause: "State voter rolls are public record with address + party + history.", seeds: [`site:*.gov "voter registration" filetype:csv "{{t}}"`, `"{{t}}" intext:"voter" intext:"{{d}}" site:.gov`, `site:vote.org filetype:pdf "{{t}}"`], pivotsTo: [6, 29] },
  { id: 33, tier: "personal",       name: "Professional licensing boards", rootCause: "Every licensed profession has a name + license + address record.", seeds: [`site:*.gov "license lookup" "{{t}}"`, `"{{t}}" intext:"license number" site:*.gov`, `site:docinfo.org "{{t}}"`], pivotsTo: [4, 47] },
  { id: 34, tier: "personal",       name: "Sports & athletic records", rootCause: "Race results + rosters publish hometown + club + age group.", seeds: [`site:athlinks.com "{{t}}"`, `site:athletic.net "{{t}}"`, `intext:"results" intext:"{{t}}" filetype:pdf`], pivotsTo: [55] },
  { id: 35, tier: "personal",       name: "Aviation & maritime records", rootCause: "FAA airmen + N-number registry + USCG vessel docs are fully public.", seeds: [`site:faa.gov "airmen inquiry" "{{t}}"`, `site:registry.faa.gov "{{t}}"`, `site:uscg.mil "vessel documentation" "{{t}}"`], pivotsTo: [18] },
  { id: 36, tier: "infrastructure", name: "DNS records & Certificate Transparency", rootCause: "Every HTTPS cert ever issued for the org is in a public log.", seeds: [`site:crt.sh "{{d}}"`, `intext:"_dmarc" site:{{d}}`, `site:securitytrails.com "{{d}}"`], pivotsTo: [37, 43, 48] },
  { id: 37, tier: "infrastructure", name: "Web archives / Wayback", rootCause: "Deleted content is preserved and indexed forever.", seeds: [`site:web.archive.org "{{d}}"`, `site:web.archive.org "{{t}}" filetype:pdf`, `site:archive.today "{{t}}"`], pivotsTo: [7, 55] },
  { id: 38, tier: "infrastructure", name: "Wireless networks / WiGLE", rootCause: "Crowdsourced wardriving maps SSIDs to precise GPS coords.", seeds: [`site:wigle.net "{{t}}"`, `site:wigle.net "{{d}}"`, `intext:"SSID" "{{t}}" filetype:csv`], pivotsTo: [3, 15] },
  { id: 39, tier: "research",       name: "Academic citation networks", rootCause: "Papers publish co-author + funder + affiliation graphs.", seeds: [`site:scholar.google.com "{{t}}"`, `site:semanticscholar.org "{{t}}"`, `intext:"acknowledgments" intext:"funded by" site:*.edu filetype:pdf "{{t}}"`], pivotsTo: [1, 23, 41, 46] },
  { id: 40, tier: "organizational", name: "Financial markets — Form 4 / 13F", rootCause: "Insider trades + fund holdings are filed within 2 business days.", seeds: [`site:sec.gov "form 4" "{{t}}"`, `site:sec.gov "13F" "{{t}}"`, `intext:"short interest" "{{t}}" filetype:pdf site:sec.gov`], pivotsTo: [5] },
  { id: 41, tier: "research",       name: "Grant & funding databases", rootCause: "NIH/NSF/USASPENDING publish researcher + amount + abstract.", seeds: [`site:reporter.nih.gov "{{t}}"`, `site:nsf.gov/awardsearch "{{t}}"`, `site:usaspending.gov "{{t}}"`], pivotsTo: [1, 39] },
  { id: 42, tier: "signals",        name: "App store metadata", rootCause: "Privacy labels + permission lists + update logs are indexed.", seeds: [`site:play.google.com "{{t}}"`, `site:apps.apple.com "{{t}}"`, `intext:"permissions" site:play.google.com "{{t}}"`], pivotsTo: [15] },
  { id: 43, tier: "infrastructure", name: "Network signalling (SMTP / NTP / HTTP banners)", rootCause: "Server banners + response headers leak versions + internal hosts.", seeds: [`site:shodan.io "{{t}}"`, `site:censys.io "{{d}}"`, `intext:"X-Powered-By" site:{{d}}`], pivotsTo: [36, 48] },
  { id: 44, tier: "personal",       name: "Emergency services / 911 / IA records", rootCause: "Police-transparency laws publish incident + use-of-force records.", seeds: [`site:*.gov "incident report" filetype:pdf "{{t}}"`, `site:*.gov "use of force" filetype:pdf "{{t}}"`, `intext:"dispatch" intext:"incident" site:*.gov filetype:csv "{{t}}"`], pivotsTo: [47] },
  { id: 45, tier: "organizational", name: "Supply chain & vendor databases", rootCause: "SAM.gov + state vendor rolls + hospital GPO lists are public.", seeds: [`site:sam.gov "{{t}}"`, `site:usaspending.gov "{{t}}" "vendor"`, `intext:"approved vendor" "{{t}}" site:.gov filetype:pdf`], pivotsTo: [8, 10] },
  { id: 46, tier: "research",       name: "Preprint servers", rootCause: "Pre-peer-review data is often more raw + more detailed than final.", seeds: [`site:arxiv.org "{{t}}"`, `site:biorxiv.org "{{t}}"`, `site:ssrn.com "{{t}}"`], pivotsTo: [1, 39, 41] },
  { id: 47, tier: "organizational", name: "Municipal / local government", rootCause: "City permits + business licenses + council minutes are searchable.", seeds: [`site:{{d}} "building permit" "{{t}}"`, `site:{{d}} "business license" "{{t}}"`, `intitle:"city council" "minutes" intext:"{{t}}"`], pivotsTo: [6, 22, 44] },
  { id: 48, tier: "infrastructure", name: "BGP / IP allocation registries", rootCause: "RIRs publish the full IP-space-to-org map of the internet.", seeds: [`site:arin.net "{{t}}"`, `site:ripe.net "{{t}}"`, `site:bgpview.io "{{d}}"`], pivotsTo: [36, 43] },
  { id: 49, tier: "personal",       name: "Conference / event registration", rootCause: "Eventbrite/Meetup publish attendee patterns → schedule intelligence.", seeds: [`site:eventbrite.com "{{t}}"`, `site:meetup.com "{{t}}"`, `intext:"speaker" intext:"{{t}}" site:eventbrite.com`], pivotsTo: [23, 55] },
  { id: 50, tier: "organizational", name: "International company registries", rootCause: "Companies House / ASIC / OpenCorporates publish officer PII globally.", seeds: [`site:find-and-update.company-information.service.gov.uk "{{t}}"`, `site:asic.gov.au "{{t}}"`, `site:opencorporates.com "{{t}}"`], pivotsTo: [8, 31] },
  { id: 51, tier: "infrastructure", name: "Cloud storage misconfigurations", rootCause: "Public buckets never stopped being deployed by mistake.", seeds: [`site:s3.amazonaws.com "{{t}}"`, `site:storage.googleapis.com "{{t}}"`, `site:blob.core.windows.net "{{t}}"`], pivotsTo: [12, 15] },
  { id: 52, tier: "research",       name: "Academic / professional identity networks", rootCause: "ORCID + ResearchGate publish complete employment + funding history.", seeds: [`site:orcid.org "{{t}}"`, `site:researchgate.net "{{t}}"`, `site:academia.edu "{{t}}"`], pivotsTo: [23, 39, 41] },
  { id: 53, tier: "organizational", name: "Healthcare provider directories", rootCause: "NPI + state medical boards + hospital staff pages are indexed.", seeds: [`site:npiregistry.cms.hhs.gov "{{t}}"`, `site:*.gov "medical board" "{{t}}"`, `site:{{d}} "medical staff" filetype:pdf`], pivotsTo: [4, 33] },
  { id: 54, tier: "research",       name: "Open source dependency chains", rootCause: "npm/pypi/maven expose stack, contributors, and TODO comments.", seeds: [`site:npmjs.com "{{t}}"`, `site:pypi.org "{{t}}"`, `site:github.com "{{t}}" intext:"TODO"`], pivotsTo: [12, 55] },
  { id: 55, tier: "personal",       name: "Social engineering surface (fusion)", rootCause: "Every other domain fuses here — pretext quality = attack quality.", seeds: [`site:{{d}} filetype:pdf "staff directory"`, `site:linkedin.com "{{t}}"`, `"{{t}}" intext:"direct" filetype:pdf`], pivotsTo: [] },
];

// Root-cause patterns — the human-behavior taxonomy behind ALL 55 domains.
// These are what Aureon reasons from when synthesising NOVEL dorks.
export const ROOT_CAUSE_PATTERNS = [
  "Developers/admins move fast and skip access-control review.",
  "Systems deployed for internal use forget the internet can reach them.",
  "The same credentials get reused across unrelated systems.",
  "Automation creates artifacts nobody manually reviews.",
  "System migrations create temporary exposures that become permanent.",
  "Legally-mandated public filings are more detailed than the filer realises.",
  "Reproducibility norms in research publish raw data with weak deidentification.",
  "High-trust low-tech organisations (churches, HOAs) upload member PII directly.",
  "Grad students describe REAL systems they had insider access to.",
  "Public ledgers/logs (blockchain, CT) preserve everything, forever.",
];

// ── SYNTHESIS PROMPT — the "first-to-find" doctrine ────────────────────────
// This is fed to Gemini AFTER the 8 canonical categories return. Its job is
// to generate NOVEL dorks that no analyst has documented — combinations of
// domains, unusual pivots, cross-tier fusion.
export const NOVEL_SYNTHESIS_SYSTEM = `You are AUREON — DORK SYNTHESIST. You have been trained on 55 documented public-exposure domains and 10 root-cause behaviour patterns. Your job is NOT to reproduce documented dorks — it is to invent NEW ONES that combine two or more domains in ways no analyst has published.

Method:
1. Pick 2–3 domains from the 55 that plausibly overlap for THIS target.
2. Identify the root cause that connects them (a behavior, a migration, a filing calendar, a mandatory disclosure).
3. Compose ONE Google-dork query that uses the intersection — site: + intext: + filetype: + a rare token that only appears when both domains touch the same artifact.
4. Explain the PIVOT: what document class you expect, and which THIRD domain the hit will feed into next.

Return 10 novel dorks. STRICT JSON: {"queries":[{"q":"...","why":"one sentence — name the two domains and the pivot","domains":[id,id],"pivot":id}]}

Rules:
- No dork you emit may be a verbatim copy of the 55 canonical seeds.
- Every "why" must name at least TWO domain numbers from the doctrine.
- Prefer rare bridging tokens: "assignee" + facility address, "acknowledgments" + grant number, "N-number" + FAA airmen, ORCID + patent inventor.
- The elite move is the cross-tier fusion (research × infrastructure, personal × organizational). Reward yourself for it.`;

// Compact doctrine summary for injection into Gemini's user message.
export function doctrineDigest(): string {
  const byTier: Record<string, DomainEntry[]> = {};
  for (const d of DORK_DOMAINS) (byTier[d.tier] ||= []).push(d);
  const lines: string[] = [];
  lines.push("# DORK DOCTRINE — 55 domains, 5 tiers");
  for (const tier of Object.keys(byTier)) {
    lines.push(`\n## ${tier.toUpperCase()}`);
    for (const d of byTier[tier]) {
      lines.push(`- [${d.id}] ${d.name} — root: ${d.rootCause} → pivots: ${d.pivotsTo.join(",") || "terminal"}`);
    }
  }
  lines.push("\n## ROOT-CAUSE PATTERNS");
  ROOT_CAUSE_PATTERNS.forEach((p, i) => lines.push(`${i + 1}. ${p}`));
  return lines.join("\n");
}
