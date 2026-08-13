// ============================================================================
// AZPLEN DOMAIN PACK ENGINE — data intelligence ingest, not financial-only.
//
// Ingest is only useful when the platform knows WHAT it just received, WHO is
// regulated by it, WHICH real-world objects it maps to, and WHAT decisions it
// unlocks. Any organisation that buys an ingest platform is really buying
// four things:
//
//   1. Landing         — take any shape of data from any system.
//   2. Semantics       — bind columns to real-world objects (the "ontology").
//   3. Governance      — know sensitivity, regulation, and lineage on arrival.
//   4. Decision surface— convert the landed object into questions/KPIs/actions.
//
// Commodity tools stop at (1). AZPLEN binds (2)+(3) at ingest time and then
// goes one step further: the pack also declares the DECISION SET and the
// COLLECTION GAP — what you still cannot answer with what you just uploaded.
//
// This module is deterministic (no model call). Every finding it emits cites
// the column or rule that produced it, so the output is auditable.
// ============================================================================

export type SensitivityClass =
  | "PHI" | "PII" | "PCI" | "MNPI" | "CJI" | "BIOMETRIC"
  | "CREDENTIAL" | "LOCATION" | "MINOR" | "NONE";

export interface DomainField {
  /** Canonical name used inside the pack ontology. */
  canonical: string;
  /** Regex matched against the incoming column header (case-insensitive). */
  match: RegExp;
  /** Real-world object this column binds to. */
  object: string;
  /** Property on that object. */
  property: string;
  required?: boolean;
  sensitivity?: SensitivityClass;
  /** Interchange standard this field belongs to, if any. */
  standard?: string;
}

export interface DomainPack {
  id: string;
  label: string;
  /** One-line statement of what an operator in this vertical is trying to do. */
  mission: string;
  /** Header/value keywords that vote for this pack. */
  signals: RegExp[];
  /** Filename keywords that vote for this pack. */
  fileSignals: RegExp[];
  /** Real-world object types this pack instantiates. */
  objects: string[];
  fields: DomainField[];
  /** Interchange standards an operator will expect to import/export. */
  standards: string[];
  /** Regulations triggered by holding this data. */
  regulations: string[];
  /** Retention expectation in months (0 = no statutory floor known). */
  retentionMonths: number;
  /** Questions the pack can answer once the data lands. */
  decisions: string[];
  /** KPIs computable from the pack's required fields. */
  kpis: { name: string; needs: string[]; formula: string }[];
  /** Feeds an operator still needs; emitted as collection gaps. */
  companionFeeds: string[];
}

// ---------------------------------------------------------------------------
// Cross-domain sensitivity detectors — run on EVERY pack. Governance cannot
// depend on correctly guessing the vertical.
// ---------------------------------------------------------------------------
const UNIVERSAL_SENSITIVITY: { match: RegExp; cls: SensitivityClass; why: string }[] = [
  { match: /\b(ssn|social.?security|nino|sin|tax.?id|itin)\b/i, cls: "PII", why: "Government identifier" },
  { match: /(e.?mail|email.?addr)/i, cls: "PII", why: "Direct contact identifier" },
  { match: /(phone|mobile|msisdn|tel(ephone)?\b|fax)/i, cls: "PII", why: "Direct contact identifier" },
  { match: /(dob|date.?of.?birth|birth.?date)/i, cls: "PII", why: "Quasi-identifier, re-identification risk" },
  { match: /(passport|driver.?licen[cs]e|dl.?number|national.?id)/i, cls: "PII", why: "Government identifier" },
  { match: /(street|address.?line|postal|zip|post.?code)/i, cls: "LOCATION", why: "Residence-level geolocation" },
  { match: /(lat(itude)?|lon(g|gitude)?|geohash|gps)/i, cls: "LOCATION", why: "Precise geolocation" },
  { match: /(card.?number|pan\b|cvv|cvc|iban|routing|account.?number|swift|bic)/i, cls: "PCI", why: "Payment instrument data" },
  { match: /(password|passwd|secret|api.?key|token|private.?key|hash)/i, cls: "CREDENTIAL", why: "Authentication material" },
  { match: /(fingerprint|face.?(id|print)|iris|voice.?print|biometric|dna)/i, cls: "BIOMETRIC", why: "Biometric template" },
  { match: /(diagnos|icd.?10|cpt\b|npi\b|mrn\b|patient|medicat|prescri|lab.?result|hl7|fhir)/i, cls: "PHI", why: "Protected health information" },
  { match: /(student|minor|guardian|juvenile|grade.?level)/i, cls: "MINOR", why: "Minor / education record" },
  { match: /(case.?number|arrest|offense|warrant|booking|inmate|ncic)/i, cls: "CJI", why: "Criminal justice information" },
  { match: /(insider|material.?non.?public|mnpi|deal.?code|pre.?announcement)/i, cls: "MNPI", why: "Material non-public information" },
];

const REG_BY_CLASS: Record<SensitivityClass, string[]> = {
  PHI: ["HIPAA Privacy Rule", "HIPAA Security Rule", "HITECH breach notification"],
  PII: ["GDPR Art.5/6", "CCPA/CPRA", "State breach-notification statutes"],
  PCI: ["PCI-DSS v4.0"],
  MNPI: ["SEC Reg FD", "Market Abuse Regulation", "Insider-trading controls"],
  CJI: ["FBI CJIS Security Policy"],
  BIOMETRIC: ["BIPA (IL)", "GDPR Art.9 special category"],
  CREDENTIAL: ["SOC 2 CC6", "Secret-scanning / rotation policy"],
  LOCATION: ["GDPR Art.5", "CCPA precise-geolocation rules"],
  MINOR: ["FERPA", "COPPA"],
  NONE: [],
};

// ---------------------------------------------------------------------------
// Packs
// ---------------------------------------------------------------------------
export const DOMAIN_PACKS: DomainPack[] = [
  {
    id: "health",
    label: "Health & Life Sciences",
    mission: "Turn encounters, claims and clinical events into cohort, cost and outcome intelligence without leaking PHI.",
    signals: [/patient/i, /mrn\b/i, /diagnos/i, /icd/i, /cpt\b/i, /npi\b/i, /encounter/i, /admission|discharge/i, /provider/i, /payer|claim/i, /medicat|dosage|rx\b/i, /lab.?(result|test)/i, /fhir|hl7/i],
    fileSignals: [/patient|claim|encounter|ehr|emr|clinical|hl7|fhir|837|835/i],
    objects: ["Patient", "Encounter", "Provider", "Claim", "Procedure", "Diagnosis", "Medication", "Facility"],
    standards: ["HL7 v2", "FHIR R4", "X12 837 (claim)", "X12 835 (remittance)", "ICD-10-CM", "CPT/HCPCS", "LOINC", "RxNorm", "NPI registry"],
    regulations: ["HIPAA", "HITECH", "42 CFR Part 2", "GDPR Art.9", "FDA 21 CFR Part 11 (if trial data)"],
    retentionMonths: 72,
    fields: [
      { canonical: "patient_id", match: /\b(patient.?id|mrn|member.?id|subject.?id)\b/i, object: "Patient", property: "id", required: true, sensitivity: "PHI", standard: "FHIR Patient.identifier" },
      { canonical: "encounter_date", match: /(encounter|admission|service|visit|discharge).?(date|dt|time)/i, object: "Encounter", property: "period", required: true, standard: "FHIR Encounter.period" },
      { canonical: "diagnosis_code", match: /(diagnos|icd|dx.?code)/i, object: "Diagnosis", property: "code", required: true, sensitivity: "PHI", standard: "ICD-10-CM" },
      { canonical: "procedure_code", match: /(procedure|cpt|hcpcs|px.?code)/i, object: "Procedure", property: "code", sensitivity: "PHI", standard: "CPT/HCPCS" },
      { canonical: "provider_id", match: /(provider|physician|clinician|npi)/i, object: "Provider", property: "id", standard: "NPI" },
      { canonical: "facility", match: /(facility|hospital|clinic|site|ward|unit)/i, object: "Facility", property: "name" },
      // Token-anchored: "discharge_date" must never bind as a charge amount.
      { canonical: "claim_amount", match: /(^|[^a-z])(charge|charges|allowed|paid|billed|reimburse)([^a-z]|$)|claim.?amount/i, object: "Claim", property: "amount" },
      { canonical: "payer", match: /(payer|payor|insurer|plan.?name)/i, object: "Claim", property: "payer" },
      { canonical: "outcome", match: /(outcome|mortality|readmit|readmission|los\b|length.?of.?stay|disposition)/i, object: "Encounter", property: "outcome" },
    ],
    decisions: [
      "Which cohorts drive avoidable cost, and which provider varies most from peer baseline?",
      "Where does the readmission curve break by facility, payer and diagnosis group?",
      "Which claims are denial-prone before submission?",
      "Which patients cross the deterioration threshold in the next 30 days?",
    ],
    kpis: [
      { name: "30-day readmission rate", needs: ["patient_id", "encounter_date"], formula: "repeat encounters within 30d ÷ index discharges" },
      { name: "Cost per encounter", needs: ["claim_amount", "encounter_date"], formula: "Σ claim_amount ÷ distinct encounters" },
      { name: "Provider variance index", needs: ["provider_id", "claim_amount"], formula: "provider mean cost ÷ peer-cohort mean cost" },
      { name: "Denial exposure", needs: ["claim_amount", "diagnosis_code"], formula: "share of claims with incomplete coding pairs" },
    ],
    companionFeeds: ["Eligibility (270/271) feed", "Remittance (835) feed", "Provider roster / credentialing", "Bed & staffing census", "SDOH overlay by ZIP"],
  },
  {
    id: "finance",
    label: "Financial Services",
    mission: "Land transactions, positions and counterparties into an auditable object model that survives regulator inspection.",
    signals: [/transaction|txn\b/i, /account.?(no|number|id)/i, /ledger|gl\b|journal/i, /counterpart/i, /isin|cusip|sedol|ticker/i, /debit|credit/i, /balance/i, /settle(ment)?/i, /kyc|aml|sanction/i, /iban|swift|bic/i],
    fileSignals: [/transaction|ledger|gl_|trial.?balance|positions?|trades?|statement|invoice|payment|aml|kyc/i],
    objects: ["Account", "Transaction", "Counterparty", "Instrument", "Position", "Entity", "Alert"],
    standards: ["ISO 20022", "FIX 4.4/5.0", "SWIFT MT", "X12 820", "LEI (ISO 17442)", "ISIN/CUSIP", "XBRL"],
    regulations: ["SOX 404", "GLBA", "BSA/AML", "OFAC sanctions", "PCI-DSS", "MiFID II / EMIR (EU)", "Basel III reporting"],
    retentionMonths: 84,
    fields: [
      { canonical: "transaction_id", match: /(txn|transaction|trade|payment).?(id|ref|no)/i, object: "Transaction", property: "id", required: true },
      { canonical: "value_date", match: /(value|trade|post|settle|booking|txn).?(date|dt|time)|^date$/i, object: "Transaction", property: "valueDate", required: true },
      // Suffixed money columns are the norm in the wild (amount_usd, net_gbp),
      // so the boundary must accept an underscore, not only a word break.
      { canonical: "amount", match: /(^|[^a-z])(amount|amt|debit|credit|notional|gross|net|principal)([^a-z]|$)/i, object: "Transaction", property: "amount", required: true },
      { canonical: "currency", match: /(currency|ccy|iso.?cur)/i, object: "Transaction", property: "currency", standard: "ISO 4217" },
      { canonical: "account_id", match: /(account|acct|iban|ledger).?(id|no|number|code)?/i, object: "Account", property: "id", required: true, sensitivity: "PCI" },
      { canonical: "counterparty", match: /(counterpart|beneficiar|payee|payer|vendor|merchant|customer.?name)/i, object: "Counterparty", property: "name", sensitivity: "PII" },
      { canonical: "instrument", match: /(isin|cusip|sedol|ticker|symbol|instrument|security)/i, object: "Instrument", property: "identifier", standard: "ISIN" },
      { canonical: "gl_code", match: /(gl.?(code|account)|cost.?cent|account.?class)/i, object: "Account", property: "glCode" },
      { canonical: "jurisdiction", match: /(country|jurisdiction|domicile|region)/i, object: "Counterparty", property: "jurisdiction" },
    ],
    decisions: [
      "Which counterparties show structuring, round-tripping or velocity anomalies?",
      "Which GL lines break reconciliation and by how much per period?",
      "Which exposures concentrate beyond appetite by jurisdiction and instrument?",
      "Which alerts are false positives against the observed behavioural baseline?",
    ],
    kpis: [
      { name: "Reconciliation break rate", needs: ["transaction_id", "amount"], formula: "unmatched ÷ total postings" },
      { name: "Counterparty concentration (HHI)", needs: ["counterparty", "amount"], formula: "Σ (share of volume)²" },
      { name: "Velocity anomaly score", needs: ["account_id", "value_date", "amount"], formula: "z-score of account daily volume vs 90d baseline" },
      { name: "Cross-border exposure", needs: ["jurisdiction", "amount"], formula: "Σ amount by counterparty jurisdiction" },
    ],
    companionFeeds: ["Sanctions/PEP list", "FX rate series", "Corporate registry (UBO)", "Market reference data", "Case-management outcomes for alert tuning"],
  },
  {
    id: "media",
    label: "Media, Content & Rights",
    mission: "Bind every asset to its rights window, its audience response, and the money it actually earned.",
    signals: [/asset|title|episode|season|isrc|eidr|ad.?id/i, /impression|view|watch.?time|completion/i, /rights|licen[cs]e|window|territory/i, /royalt|residual/i, /channel|platform|dsp\b/i, /campaign|creative|placement/i, /subscriber|churn|retention/i],
    fileSignals: [/content|asset|catalog|title|episode|royalt|rights|impression|audience|campaign|streams?/i],
    objects: ["Asset", "Rights Window", "Distribution", "Audience Event", "Campaign", "Royalty Statement", "Talent"],
    standards: ["EIDR", "ISRC/ISWC", "Ad-ID", "IAB Tech Lab taxonomy", "DDEX (music)", "SMPTE metadata", "VAST 4.x"],
    regulations: ["GDPR/CCPA (audience telemetry)", "COPPA (child-directed content)", "FTC endorsement rules", "Territorial licensing law", "EU AVMSD quotas"],
    retentionMonths: 36,
    fields: [
      { canonical: "asset_id", match: /(asset|title|content|episode|track|video).?(id|code|key)|eidr|isrc/i, object: "Asset", property: "id", required: true, standard: "EIDR/ISRC" },
      { canonical: "asset_title", match: /(title|name|programme|program|show)/i, object: "Asset", property: "title", required: true },
      { canonical: "territory", match: /(territory|region|market|country|geo)/i, object: "Rights Window", property: "territory" },
      { canonical: "window_start", match: /(start|avail|release|licen[cs]e.?start|publish).?(date|dt)?/i, object: "Rights Window", property: "start" },
      { canonical: "window_end", match: /(end|expiry|expire|takedown|licen[cs]e.?end).?(date|dt)?/i, object: "Rights Window", property: "end" },
      { canonical: "platform", match: /(platform|channel|dsp|service|distributor|network)/i, object: "Distribution", property: "platform" },
      { canonical: "impressions", match: /(impression|view|play|stream|watch|reach|session)s?\b/i, object: "Audience Event", property: "count", required: true },
      { canonical: "completion", match: /(completion|vtr|quartile|watch.?time|duration.?watched|retention)/i, object: "Audience Event", property: "completion" },
      { canonical: "revenue", match: /(revenue|royalt|payout|earning|net.?receipt|spend|cpm)/i, object: "Royalty Statement", property: "amount" },
      { canonical: "audience_id", match: /(user|viewer|subscriber|device|household).?(id|key|hash)/i, object: "Audience Event", property: "subject", sensitivity: "PII" },
    ],
    decisions: [
      "Which titles expire inside 90 days while still carrying demand?",
      "Where does platform-reported performance diverge from royalty-reported revenue?",
      "Which creative/placement pairs decay fastest and when should rotation trigger?",
      "Which catalogue segments are under-monetised per hour of watch time?",
    ],
    kpis: [
      { name: "Revenue per thousand views", needs: ["revenue", "impressions"], formula: "revenue ÷ impressions × 1000" },
      { name: "Rights expiry exposure", needs: ["window_end", "impressions"], formula: "Σ impressions on windows ending ≤ 90d" },
      { name: "Completion decay", needs: ["completion", "window_start"], formula: "slope of completion over days since release" },
      { name: "Platform revenue variance", needs: ["platform", "revenue"], formula: "per-platform RPM vs portfolio median" },
    ],
    companionFeeds: ["Royalty statements from each DSP", "Rights contract PDFs", "Social/PR sentiment stream", "Competitive release calendar", "Ad-server delivery logs"],
  },
  {
    id: "supply",
    label: "Supply Chain & Logistics",
    mission: "Make every shipment, part and supplier a live object so disruption is visible before it lands on the P&L.",
    signals: [/shipment|consignment|awb|bol\b|container/i, /sku|part.?(no|number)|material/i, /supplier|vendor|carrier/i, /warehouse|dc\b|inventory|stock/i, /eta|lead.?time|delay/i, /purchase.?order|po.?number/i],
    fileSignals: [/shipment|inventory|supplier|purchase|logistics|warehouse|freight|bom/i],
    objects: ["Shipment", "SKU", "Supplier", "Facility", "PurchaseOrder", "InventoryPosition"],
    standards: ["GS1 GTIN/SSCC", "EDI 856 (ASN)", "EDI 214 (status)", "EDI 850 (PO)", "Incoterms 2020", "UN/LOCODE"],
    regulations: ["UFLPA forced-labour screening", "Customs/CTPAT", "Dual-use export controls", "Conflict minerals (Dodd-Frank 1502)"],
    retentionMonths: 60,
    fields: [
      { canonical: "shipment_id", match: /(shipment|consignment|awb|bol|tracking|container).?(id|no|number)?/i, object: "Shipment", property: "id", required: true, standard: "SSCC" },
      { canonical: "sku", match: /(sku|part|material|item|gtin|upc).?(no|number|code|id)?/i, object: "SKU", property: "id", required: true, standard: "GTIN" },
      { canonical: "supplier", match: /(supplier|vendor|manufacturer|source)/i, object: "Supplier", property: "name", required: true },
      { canonical: "origin", match: /(origin|ship.?from|port.?of.?loading|source.?site)/i, object: "Shipment", property: "origin", standard: "UN/LOCODE" },
      { canonical: "destination", match: /(destination|ship.?to|port.?of.?discharge|dc\b|warehouse)/i, object: "Shipment", property: "destination" },
      { canonical: "eta", match: /(eta|expected|promised|planned).?(date|arrival)?/i, object: "Shipment", property: "eta" },
      { canonical: "actual_arrival", match: /(actual|received|delivered|arrival).?(date|dt)?/i, object: "Shipment", property: "actual" },
      { canonical: "quantity", match: /(qty|quantity|units|volume|pieces)/i, object: "InventoryPosition", property: "quantity" },
      { canonical: "unit_cost", match: /(unit.?cost|price|landed.?cost|value)/i, object: "InventoryPosition", property: "unitCost" },
    ],
    decisions: [
      "Which lanes are drifting from promised transit and what inventory is at risk?",
      "Which single-sourced SKUs have no qualified alternate inside lead time?",
      "Which suppliers concentrate in a sanctioned or disruption-exposed region?",
      "Where will stock-out occur first given current burn and open POs?",
    ],
    kpis: [
      { name: "On-time-in-full (OTIF)", needs: ["eta", "actual_arrival"], formula: "shipments arriving ≤ ETA ÷ total shipments" },
      { name: "Lane drift (days)", needs: ["eta", "actual_arrival", "origin"], formula: "mean(actual − eta) by lane" },
      { name: "Supplier concentration", needs: ["supplier", "quantity"], formula: "share of volume held by top supplier per SKU" },
      { name: "Days of cover", needs: ["quantity", "sku"], formula: "on-hand ÷ mean daily consumption" },
    ],
    companionFeeds: ["Carrier telemetry / AIS", "Port congestion index", "Sanctions & UFLPA entity list", "Weather & strike advisories", "Demand forecast"],
  },
  {
    id: "public",
    label: "Public Sector & Civic",
    mission: "Fuse casework, service delivery and constituent records under statutory access rules.",
    signals: [/case.?(id|number)/i, /citizen|constituent|resident|applicant/i, /permit|licen[cs]e|benefit|program/i, /agency|department|jurisdiction/i, /incident|complaint|service.?request|311/i, /fiscal.?year|appropriat|grant/i],
    fileSignals: [/permit|case|incident|311|benefit|grant|census|budget|inspection/i],
    objects: ["Case", "Constituent", "Agency", "Program", "Incident", "Asset"],
    standards: ["NIEM", "Open311", "GTFS (transit)", "FIPS geocodes", "USASpending schema"],
    regulations: ["FOIA / state public-records law", "Privacy Act 1974", "CJIS (if justice data)", "Title VI equity reporting", "State records-retention schedules"],
    retentionMonths: 120,
    fields: [
      { canonical: "case_id", match: /(case|incident|request|permit|application).?(id|no|number)/i, object: "Case", property: "id", required: true },
      { canonical: "opened_at", match: /(open|report|receiv|submit|filed).?(date|dt|time)/i, object: "Case", property: "openedAt", required: true },
      { canonical: "closed_at", match: /(clos|resolv|complet|dispos).?(date|dt|time)/i, object: "Case", property: "closedAt" },
      { canonical: "category", match: /(category|type|service.?code|program|issue)/i, object: "Case", property: "category", required: true },
      { canonical: "agency", match: /(agency|department|bureau|office|jurisdiction)/i, object: "Agency", property: "name" },
      { canonical: "location", match: /(address|location|district|ward|tract|zip|parcel)/i, object: "Case", property: "location", sensitivity: "LOCATION" },
      { canonical: "constituent_id", match: /(citizen|constituent|resident|applicant|person).?(id|no)?/i, object: "Constituent", property: "id", sensitivity: "PII" },
      { canonical: "amount", match: /(amount|award|grant|fee|fine|appropriat|budget)/i, object: "Program", property: "amount" },
    ],
    decisions: [
      "Which districts wait longest for the same service class, and is the gap equitable?",
      "Which case types breach statutory response windows?",
      "Where does spend fail to follow demand geography?",
      "Which repeat locations signal an unaddressed structural problem?",
    ],
    kpis: [
      { name: "Median time to close", needs: ["opened_at", "closed_at"], formula: "median(closed_at − opened_at) by category" },
      { name: "SLA breach rate", needs: ["opened_at", "category"], formula: "cases open beyond category SLA ÷ total" },
      { name: "Geographic equity index", needs: ["location", "opened_at"], formula: "district close-time ÷ jurisdiction median" },
      { name: "Repeat-location rate", needs: ["location", "case_id"], formula: "locations with ≥3 cases ÷ distinct locations" },
    ],
    companionFeeds: ["Census/ACS demographics", "Budget appropriation lines", "Inspection outcomes", "Asset condition survey", "Vendor contract registry"],
  },
  {
    id: "retail",
    label: "Retail & Commerce",
    mission: "Connect demand, margin and customer behaviour into one governed object model.",
    signals: [/order.?(id|no)/i, /customer.?(id|no)/i, /product|sku|catalog/i, /cart|checkout|basket/i, /discount|promo|coupon/i, /store|channel|marketplace/i, /return|refund|rma/i],
    fileSignals: [/orders?|sales|customers?|products?|transactions?|pos_|ecom/i],
    objects: ["Order", "Customer", "Product", "Store", "Promotion", "Return"],
    standards: ["GS1 GTIN", "GDSN product data", "Schema.org Product", "EDI 852 (POS)"],
    regulations: ["PCI-DSS", "CCPA/CPRA", "GDPR", "FTC pricing/advertising rules", "Sales-tax nexus reporting"],
    retentionMonths: 48,
    fields: [
      { canonical: "order_id", match: /(order|sale|invoice|receipt|basket).?(id|no|number)/i, object: "Order", property: "id", required: true },
      { canonical: "order_date", match: /(order|purchase|sale|transaction).?(date|dt|time)|^date$/i, object: "Order", property: "date", required: true },
      { canonical: "customer_id", match: /(customer|shopper|buyer|account|loyalty).?(id|no|email)?/i, object: "Customer", property: "id", sensitivity: "PII" },
      { canonical: "product_id", match: /(product|sku|item|gtin|upc).?(id|code|no)?/i, object: "Product", property: "id", required: true, standard: "GTIN" },
      { canonical: "quantity", match: /(qty|quantity|units)/i, object: "Order", property: "quantity" },
      { canonical: "revenue", match: /(revenue|amount|total|price|net.?sales|gross)/i, object: "Order", property: "revenue", required: true },
      { canonical: "cost", match: /(cost|cogs|landed)/i, object: "Product", property: "cost" },
      { canonical: "channel", match: /(channel|store|marketplace|site|location)/i, object: "Store", property: "channel" },
      { canonical: "discount", match: /(discount|promo|coupon|markdown)/i, object: "Promotion", property: "value" },
    ],
    decisions: [
      "Which SKUs are margin-negative after discount and returns?",
      "Which cohorts churn after first repeat purchase and what triggered it?",
      "Where does promotion cannibalise full-price demand?",
      "Which stores/channels diverge from network demand baseline?",
    ],
    kpis: [
      { name: "Contribution margin", needs: ["revenue", "cost"], formula: "(revenue − cost − discount) ÷ revenue" },
      { name: "Repeat rate", needs: ["customer_id", "order_date"], formula: "customers with ≥2 orders ÷ customers" },
      { name: "Discount leakage", needs: ["discount", "revenue"], formula: "Σ discount ÷ Σ gross revenue" },
      { name: "Return rate by SKU", needs: ["product_id", "order_id"], formula: "returned units ÷ sold units" },
    ],
    companionFeeds: ["Returns/RMA feed", "Inventory position", "Competitor price scrape", "Web/app clickstream", "Marketing spend by channel"],
  },
  {
    id: "energy",
    label: "Energy, Utilities & Industrial",
    mission: "Fuse meter, asset and sensor telemetry into reliability, load and safety intelligence.",
    signals: [/meter|kwh|mwh|load|demand.?response/i, /sensor|telemetry|scada|tag.?name/i, /asset|equipment|turbine|transformer|pump/i, /outage|fault|alarm|trip/i, /emission|co2|carbon|fuel/i, /substation|feeder|circuit/i],
    fileSignals: [/meter|scada|telemetry|sensor|outage|asset|maintenance|emission/i],
    objects: ["Asset", "Meter", "Sensor Reading", "Outage Event", "Work Order", "Site"],
    standards: ["IEC 61968/61970 CIM", "OPC UA", "Green Button (ESPI)", "ISO 50001 energy data", "GHG Protocol"],
    regulations: ["NERC CIP", "EPA emissions reporting", "OSHA process safety", "State PUC reliability reporting", "CSRD/ESRS (EU)"],
    retentionMonths: 84,
    fields: [
      { canonical: "asset_id", match: /(asset|equipment|device|unit|machine|tag).?(id|no|name)?/i, object: "Asset", property: "id", required: true },
      { canonical: "timestamp", match: /(timestamp|ts\b|reading.?time|datetime|interval)/i, object: "Sensor Reading", property: "time", required: true },
      { canonical: "measure", match: /(value|reading|kwh|kw\b|mwh|temp|pressure|flow|vibration|voltage|current)/i, object: "Sensor Reading", property: "value", required: true },
      { canonical: "unit", match: /(unit|uom|measure.?unit)/i, object: "Sensor Reading", property: "unit" },
      { canonical: "site", match: /(site|plant|substation|feeder|circuit|facility|location)/i, object: "Site", property: "name" },
      { canonical: "event_type", match: /(alarm|fault|outage|trip|event|status)/i, object: "Outage Event", property: "type" },
      { canonical: "duration", match: /(duration|downtime|minutes.?out|restore)/i, object: "Outage Event", property: "duration" },
      { canonical: "emission", match: /(co2|emission|carbon|ghg|scope.?[123])/i, object: "Site", property: "emissions" },
    ],
    decisions: [
      "Which assets show pre-failure drift against their own baseline?",
      "Which feeders drive the majority of customer-minutes lost?",
      "Where does load forecast diverge from metered reality, and what does it cost?",
      "Which maintenance intervals are over- or under-serviced versus failure history?",
    ],
    kpis: [
      { name: "SAIDI/SAIFI proxy", needs: ["duration", "site"], formula: "Σ customer-minutes ÷ customers served" },
      { name: "Anomaly drift score", needs: ["asset_id", "timestamp", "measure"], formula: "rolling z-score vs 30d asset baseline" },
      { name: "Load factor", needs: ["measure", "timestamp"], formula: "mean load ÷ peak load" },
      { name: "Emission intensity", needs: ["emission", "measure"], formula: "Σ CO2e ÷ Σ output" },
    ],
    companionFeeds: ["Weather & irradiance", "Maintenance work orders", "Market/price signal", "Asset nameplate registry", "Crew dispatch logs"],
  },
  {
    id: "workforce",
    label: "Workforce & Human Capital",
    mission: "Understand capacity, attrition risk and access exposure across the workforce without creating a surveillance liability.",
    signals: [/employee|headcount|staff|worker/i, /salary|compensation|payroll|bonus/i, /department|manager|reports.?to/i, /hire.?date|termination|tenure/i, /performance|rating|review/i, /role|title|grade|level/i],
    fileSignals: [/employee|hr_|payroll|headcount|roster|org.?chart|attrition/i],
    objects: ["Employee", "Position", "Department", "CompensationRecord", "AccessGrant"],
    standards: ["HR-XML", "SOC job codes", "SCIM (identity)", "ISO 30414 human-capital reporting"],
    regulations: ["GDPR Art.88", "EEOC reporting", "FLSA", "Pay-transparency statutes", "Works-council consultation (EU)"],
    retentionMonths: 84,
    fields: [
      { canonical: "employee_id", match: /(employee|worker|staff|person).?(id|no|number)/i, object: "Employee", property: "id", required: true, sensitivity: "PII" },
      { canonical: "hire_date", match: /(hire|start|joined).?(date|dt)/i, object: "Employee", property: "hireDate", required: true },
      { canonical: "termination_date", match: /(term|exit|leave|end).?(date|dt)/i, object: "Employee", property: "termDate" },
      { canonical: "department", match: /(department|division|team|org.?unit|cost.?cent)/i, object: "Department", property: "name", required: true },
      { canonical: "manager", match: /(manager|supervisor|reports.?to|lead)/i, object: "Employee", property: "managerId" },
      { canonical: "compensation", match: /(salary|comp|pay|wage|bonus|rate)/i, object: "CompensationRecord", property: "amount", sensitivity: "PII" },
      { canonical: "title", match: /(title|role|position|grade|level|job)/i, object: "Position", property: "title" },
      { canonical: "rating", match: /(rating|performance|score|review)/i, object: "Employee", property: "rating", sensitivity: "PII" },
    ],
    decisions: [
      "Which teams carry attrition risk that current backfill lead time cannot absorb?",
      "Where does pay dispersion inside a grade exceed defensible range?",
      "Which manager spans of control correlate with exit spikes?",
      "Which departures still hold live system access?",
    ],
    kpis: [
      { name: "Annualised attrition", needs: ["termination_date", "employee_id"], formula: "exits ÷ mean headcount × period factor" },
      { name: "Pay dispersion (grade)", needs: ["compensation", "title"], formula: "IQR of comp within grade ÷ median" },
      { name: "Span of control", needs: ["manager", "employee_id"], formula: "direct reports per manager" },
      { name: "Tenure half-life", needs: ["hire_date", "termination_date"], formula: "median tenure at exit" },
    ],
    companionFeeds: ["Identity/access grants (SCIM)", "Engagement survey", "Recruiting funnel", "Labour-market comp benchmark", "Training completion"],
  },
  {
    id: "cyber",
    label: "Security & Cyber Telemetry",
    mission: "Turn logs, identity events and asset inventory into detection, exposure and dwell-time intelligence.",
    signals: [/src.?ip|dst.?ip|ip.?address/i, /event.?(id|type)|log.?source/i, /user.?agent|host.?name|endpoint/i, /severity|alert|detection|rule.?name/i, /hash|sha256|md5|indicator|ioc/i, /login|auth|mfa|privilege/i],
    fileSignals: [/log|siem|alert|event|firewall|edr|auth|audit|vuln/i],
    objects: ["Event", "Identity", "Host", "Detection", "Indicator", "Vulnerability"],
    standards: ["OCSF", "STIX 2.1 / TAXII", "MITRE ATT&CK", "CEF/LEEF", "CVE/CVSS", "SCIM"],
    regulations: ["SOC 2", "ISO 27001", "NIS2 (EU)", "SEC cyber-disclosure (Item 1.05)", "GDPR Art.33 breach clock"],
    retentionMonths: 24,
    fields: [
      { canonical: "event_time", match: /(time(stamp)?|event.?time|@timestamp|occurred)/i, object: "Event", property: "time", required: true, standard: "OCSF time" },
      { canonical: "event_type", match: /(event.?(type|id|name)|action|activity|rule)/i, object: "Event", property: "type", required: true },
      { canonical: "source_ip", match: /(src.?ip|source.?(ip|address)|client.?ip|remote.?addr)/i, object: "Event", property: "srcIp", sensitivity: "PII" },
      { canonical: "dest_ip", match: /(dst.?ip|dest(ination)?.?ip|server.?ip)/i, object: "Event", property: "dstIp" },
      { canonical: "identity", match: /(user(name)?|account|principal|subject|actor|upn)/i, object: "Identity", property: "id", required: true, sensitivity: "PII" },
      { canonical: "host", match: /(host(name)?|device|asset|endpoint|machine)/i, object: "Host", property: "name" },
      { canonical: "severity", match: /(severity|priority|risk|score|cvss)/i, object: "Detection", property: "severity" },
      { canonical: "indicator", match: /(hash|sha256|md5|domain|url|ioc|indicator|signature)/i, object: "Indicator", property: "value", standard: "STIX" },
    ],
    decisions: [
      "Which identities show impossible-travel or privilege-escalation chains?",
      "What is dwell time between first observed indicator and detection?",
      "Which detections fire without ever producing a true positive?",
      "Which exposed assets carry an exploited-in-the-wild CVE?",
    ],
    kpis: [
      { name: "Mean time to detect", needs: ["event_time", "severity"], formula: "detection_time − first_observed" },
      { name: "Detection precision", needs: ["event_type", "severity"], formula: "true positives ÷ total alerts by rule" },
      { name: "Identity blast radius", needs: ["identity", "host"], formula: "distinct hosts touched per identity" },
      { name: "Exposure age", needs: ["indicator", "event_time"], formula: "days since first exposure observation" },
    ],
    companionFeeds: ["CTI feed (STIX/TAXII)", "Asset CMDB", "Identity directory", "Vulnerability scanner", "Case outcomes for tuning"],
  },
  {
    id: "generic",
    label: "General Operational Data",
    mission: "Land unclassified operational data safely and expose whatever structure it does contain.",
    signals: [],
    fileSignals: [],
    objects: ["Record", "Entity", "Event"],
    standards: ["CSV/JSON schema inference"],
    regulations: ["Apply organisation baseline retention and access policy"],
    retentionMonths: 0,
    fields: [
      { canonical: "record_id", match: /\b(id|key|ref|uuid)\b/i, object: "Record", property: "id" },
      { canonical: "event_time", match: /(date|time|timestamp|created|updated)/i, object: "Event", property: "time" },
      { canonical: "measure", match: /(amount|count|total|value|qty|score)/i, object: "Record", property: "measure" },
      { canonical: "label", match: /(name|label|title|type|category|status)/i, object: "Entity", property: "label" },
    ],
    decisions: [
      "What is the natural key and grain of this dataset?",
      "Which columns carry enough signal to join to an existing object?",
      "What must be collected next to make this dataset decision-grade?",
    ],
    kpis: [
      { name: "Join readiness", needs: ["record_id"], formula: "distinct keys ÷ rows" },
      { name: "Temporal coverage", needs: ["event_time"], formula: "max(date) − min(date)" },
    ],
    companionFeeds: ["A dimension table for every foreign key present", "A timestamped event source", "An owner/steward declaration"],
  },
];

// ---------------------------------------------------------------------------
// Output types
// ---------------------------------------------------------------------------
export interface SensitiveField {
  column: string;
  cls: SensitivityClass;
  why: string;
  regulations: string[];
}

export interface OntologyBinding {
  column: string;
  canonical: string;
  object: string;
  property: string;
  standard?: string;
}

export interface ContractFinding {
  code: string;
  severity: "low" | "medium" | "high" | "critical";
  message: string;
  /** Column or rule that produced this finding — provenance, never a guess. */
  evidence: string;
  remediation: string;
}

export interface DomainProfile {
  version: 2;
  packId: string;
  packLabel: string;
  mission: string;
  confidence: number;              // 0..1
  alternates: { packId: string; label: string; confidence: number }[];
  objects: string[];
  bindings: OntologyBinding[];
  unmappedColumns: string[];
  sensitiveFields: SensitiveField[];
  sensitivityClasses: SensitivityClass[];
  regulations: string[];
  retentionMonths: number;
  standards: string[];
  findings: ContractFinding[];
  /** KPIs that are computable right now vs blocked on a missing field. */
  kpisReady: { name: string; formula: string }[];
  kpisBlocked: { name: string; formula: string; missing: string[] }[];
  decisions: string[];
  collectionGaps: string[];
  /** 0-100. Higher = more governance pressure on this dataset. */
  riskScore: number;
  riskGrade: "LOW" | "MODERATE" | "ELEVATED" | "SEVERE";
  /** Deterministic, human-readable summary for chat/report injection. */
  briefing: string;
  generatedAt: string;
}
// ---------------------------------------------------------------------------
// Header matching — snake_case, camelCase, dotted and spaced headers must all
// resolve identically. A regex is tested against the raw header and against a
// tokenised form ("patient_mrn" -> "patient mrn") so `\b` anchors work.
// ---------------------------------------------------------------------------
export function tokeniseHeader(h: string): string {
  return String(h ?? "")
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[^A-Za-z0-9]+/g, " ")
    .trim()
    .toLowerCase();
}

export function matchesHeader(rx: RegExp, header: string): boolean {
  const raw = String(header ?? "");
  return rx.test(raw) || rx.test(tokeniseHeader(raw));
}


// ---------------------------------------------------------------------------
// Classification
// ---------------------------------------------------------------------------
function scorePack(pack: DomainPack, headers: string[], fileName: string, sampleText: string): number {
  if (pack.id === "generic") return 0.0001;
  let score = 0;
  const headerBlob = headers.join(" | ") + " | " + headers.map(tokeniseHeader).join(" | ");
  for (const rx of pack.signals) {
    if (rx.test(headerBlob)) score += 3;          // header hit — strongest signal
    else if (rx.test(sampleText)) score += 0.6;   // value hit — weaker, values lie
  }
  for (const rx of pack.fileSignals) if (rx.test(fileName)) score += 2;
  // Field-level binding hits: a pack that can actually bind columns wins over
  // one that merely shares vocabulary.
  for (const f of pack.fields) {
    if (headers.some((h) => matchesHeader(f.match, h))) score += f.required ? 2.5 : 1.2;
  }
  return score;
}

export function classifyDomain(headers: string[], fileName: string, sampleRows: Record<string, string>[]) {
  const sampleText = sampleRows.slice(0, 40).map((r) => Object.values(r).join(" ")).join(" \n ").slice(0, 20000);
  const scored = DOMAIN_PACKS.map((p) => ({ pack: p, score: scorePack(p, headers, fileName, sampleText) }))
    .sort((a, b) => b.score - a.score);
  const top = scored[0];
  const total = scored.reduce((s, x) => s + x.score, 0) || 1;
  // A pack must clear an absolute floor, not just win relatively — otherwise a
  // single coincidental keyword would mislabel the dataset and every downstream
  // regulation claim would be wrong.
  const qualified = top.score >= 6 ? top : { pack: DOMAIN_PACKS.find((p) => p.id === "generic")!, score: top.score };
  const confidence = qualified.pack.id === "generic" ? 0.35 : Math.min(0.98, top.score / total + 0.15);
  return {
    pack: qualified.pack,
    confidence,
    alternates: scored.filter((s) => s.pack.id !== qualified.pack.id && s.score > 3).slice(0, 3)
      .map((s) => ({ packId: s.pack.id, label: s.pack.label, confidence: Math.min(0.95, s.score / total) })),
  };
}

// ---------------------------------------------------------------------------
// Profile builder
// ---------------------------------------------------------------------------
const ISO_DATE = /^\d{4}-\d{2}-\d{2}([T ]\d{2}:\d{2})?/;

export function buildDomainProfile(input: {
  fileName: string;
  headers: string[];
  sampleRows: Record<string, string>[];
  rowCount: number;
}): DomainProfile {
  const { fileName, headers, sampleRows, rowCount } = input;
  const { pack, confidence, alternates } = classifyDomain(headers, fileName, sampleRows);

  // --- Ontology bindings -------------------------------------------------
  // Headers in the wild are snake/camel/dotted. `\b` does not break on an
  // underscore, so "patient_mrn" would never match /\bmrn\b/. Test the raw
  // header AND a whitespace-tokenised form so every pack matcher behaves the
  // same regardless of the source system's naming convention.
  const bindings: OntologyBinding[] = [];
  const boundColumns = new Set<string>();
  for (const field of pack.fields) {
    const col = headers.find((h) => matchesHeader(field.match, h) && !boundColumns.has(h));
    if (!col) continue;
    boundColumns.add(col);
    bindings.push({ column: col, canonical: field.canonical, object: field.object, property: field.property, standard: field.standard });
  }
  const unmappedColumns = headers.filter((h) => !boundColumns.has(h));

  // --- Sensitivity register (universal + pack) ---------------------------
  const sensitiveFields: SensitiveField[] = [];
  for (const h of headers) {
    const hits = UNIVERSAL_SENSITIVITY.filter((d) => matchesHeader(d.match, h));
    const packField = pack.fields.find((f) => f.sensitivity && f.sensitivity !== "NONE" && matchesHeader(f.match, h));
    const classes = new Set<SensitivityClass>(hits.map((x) => x.cls));
    if (packField?.sensitivity) classes.add(packField.sensitivity);
    for (const cls of classes) {
      const why = hits.find((x) => x.cls === cls)?.why ?? `Pack ${pack.id} classifies this field as ${cls}`;
      sensitiveFields.push({ column: h, cls, why, regulations: REG_BY_CLASS[cls] ?? [] });
    }
  }
  const sensitivityClasses = Array.from(new Set(sensitiveFields.map((s) => s.cls)));

  // --- Contract findings (deterministic, evidence-cited) -----------------
  const findings: ContractFinding[] = [];
  const boundCanonicals = new Set(bindings.map((b) => b.canonical));

  for (const field of pack.fields.filter((f) => f.required)) {
    if (!boundCanonicals.has(field.canonical)) {
      findings.push({
        code: `MISSING_${field.canonical.toUpperCase()}`,
        severity: "high",
        message: `Required ${pack.label} field "${field.canonical}" (${field.object}.${field.property}) is absent.`,
        evidence: `No header matched ${String(field.match)} in [${headers.join(", ")}]`,
        remediation: `Add a ${field.canonical} column at source, or map an existing column to ${field.object}.${field.property} before this dataset can drive ${pack.label} KPIs.`,
      });
    }
  }

  // Sensitive data without a key means it cannot be honoured for deletion.
  const hasKey = bindings.some((b) => /_id$/.test(b.canonical) || b.property === "id");
  if (sensitiveFields.length > 0 && !hasKey) {
    findings.push({
      code: "NO_SUBJECT_KEY",
      severity: "high",
      message: "Sensitive data landed without a stable subject key — deletion and access requests cannot be honoured.",
      evidence: `Sensitive columns: ${Array.from(new Set(sensitiveFields.map((s) => s.column))).join(", ")}`,
      remediation: "Introduce a pseudonymous subject key (hashed) at ingest so DSAR/right-to-erasure is executable.",
    });
  }

  // A SWIFT/BIC or routing code is a public directory identifier, not secret
  // material. Firing "critical" on it trains operators to ignore the finding,
  // so the critical tier is reserved for card data, full account numbers and
  // credentials; directory identifiers get their own lower-severity notice.
  const SECRET_COLUMN = /(card.?number|pan\b|cvv|cvc|iban|account.?number|acct.?no|password|passwd|secret|api.?key|token|private.?key)/i;
  const secretCols = sensitiveFields
    .filter((s) => (s.cls === "PCI" || s.cls === "CREDENTIAL") && SECRET_COLUMN.test(s.column))
    .map((s) => s.column);
  const directoryCols = sensitiveFields
    .filter((s) => s.cls === "PCI" && !SECRET_COLUMN.test(s.column))
    .map((s) => s.column);

  if (secretCols.length) {
    findings.push({
      code: "RAW_SECRET_MATERIAL",
      severity: "critical",
      message: "Payment or credential material detected in a raw ingest file.",
      evidence: Array.from(new Set(secretCols)).join(", "),
      remediation: "Tokenise or drop these columns before storage; raw retention puts the whole environment into PCI-DSS / secret-rotation scope.",
    });
  } else if (directoryCols.length) {
    findings.push({
      code: "PAYMENT_ROUTING_IDENTIFIERS",
      severity: "low",
      message: "Payment routing identifiers are present (public directory codes, not secrets) — they still enable counterparty attribution.",
      evidence: Array.from(new Set(directoryCols)).join(", "),
      remediation: "Restrict to analysts with counterparty scope and exclude from exports shared outside the institution.",
    });
  }



  // Temporal integrity — a dataset with no usable time axis cannot be trended.
  // A time axis is any bound column whose canonical, property or header reads
  // temporal — "eta", "period", "occurred_at" are axes just as much as "date".
  const TEMPORAL = /(date|time|dt$|_at$|eta|period|timestamp|when|expiry|expires|due)/i;
  const dateBinding =
    bindings.find((b) => TEMPORAL.test(b.canonical) || TEMPORAL.test(b.property)) ??
    bindings.find((b) => TEMPORAL.test(b.column));
  if (dateBinding) {
    const vals = sampleRows.map((r) => r[dateBinding.column]).filter(Boolean).slice(0, 200);
    const nonIso = vals.filter((v) => !ISO_DATE.test(v) && isNaN(Date.parse(v)));
    if (vals.length && nonIso.length / vals.length > 0.1) {
      findings.push({
        code: "DATE_FORMAT_DRIFT",
        severity: "medium",
        message: `Time axis "${dateBinding.column}" has unparseable values in ${Math.round((nonIso.length / vals.length) * 100)}% of samples.`,
        evidence: `Examples: ${nonIso.slice(0, 3).join(" | ")}`,
        remediation: "Normalise to ISO-8601 UTC at ingest; mixed locale dates silently reorder every trend.",
      });
    }
    const parsed = vals.map((v) => Date.parse(v)).filter((n) => !isNaN(n));
    if (parsed.length) {
      const future = parsed.filter((n) => n > Date.now() + 86400000).length;
      if (future / parsed.length > 0.02 && !/eta|window_end|expiry/.test(dateBinding.canonical)) {
        findings.push({
          code: "FUTURE_TIMESTAMPS",
          severity: "medium",
          message: `${future} sampled rows carry future timestamps on "${dateBinding.column}".`,
          evidence: `${future}/${parsed.length} sampled values are beyond now+24h`,
          remediation: "Check source timezone handling; future-dated events corrupt every windowed aggregate.",
        });
      }
    }
  } else {
    findings.push({
      code: "NO_TIME_AXIS",
      severity: "medium",
      message: "No time axis was bound — this dataset cannot support trend, baseline or forecast work.",
      evidence: `Columns present: ${headers.slice(0, 12).join(", ")}`,
      remediation: "Attach an event timestamp at source, or join to a dated fact table.",
    });
  }

  // Grain check — duplicate keys silently double every measure.
  const keyBinding = bindings.find((b) => b.property === "id");
  if (keyBinding && sampleRows.length > 5) {
    const vals = sampleRows.map((r) => r[keyBinding.column]).filter(Boolean);
    const uniq = new Set(vals).size;
    if (vals.length > 0 && uniq / vals.length < 0.9) {
      findings.push({
        code: "GRAIN_AMBIGUITY",
        severity: "medium",
        message: `"${keyBinding.column}" repeats — the row grain is finer than one ${keyBinding.object}.`,
        evidence: `${uniq} distinct of ${vals.length} sampled values`,
        remediation: `Declare the true grain (e.g. ${keyBinding.object} × line item) before aggregating, or measures will double-count.`,
      });
    }
  }

  if (rowCount > 0 && rowCount < 30) {
    findings.push({
      code: "LOW_VOLUME",
      severity: "low",
      message: `Only ${rowCount} rows landed — statistical findings from this dataset are not defensible.`,
      evidence: `rowCount=${rowCount}`,
      remediation: "Treat as a sample. Backfill the full extract before publishing any rate or trend.",
    });
  }

  // --- KPI readiness -----------------------------------------------------
  const kpisReady: { name: string; formula: string }[] = [];
  const kpisBlocked: { name: string; formula: string; missing: string[] }[] = [];
  for (const kpi of pack.kpis) {
    const missing = kpi.needs.filter((n) => !boundCanonicals.has(n));
    if (missing.length === 0) kpisReady.push({ name: kpi.name, formula: kpi.formula });
    else kpisBlocked.push({ name: kpi.name, formula: kpi.formula, missing });
  }

  // --- Risk scoring ------------------------------------------------------
  const clsWeight: Record<SensitivityClass, number> = {
    PHI: 26, CJI: 24, PCI: 24, CREDENTIAL: 26, BIOMETRIC: 22, MNPI: 20,
    MINOR: 18, PII: 12, LOCATION: 10, NONE: 0,
  };
  let risk = 0;
  for (const cls of sensitivityClasses) risk += clsWeight[cls];
  risk += findings.filter((f) => f.severity === "critical").length * 15;
  risk += findings.filter((f) => f.severity === "high").length * 7;
  risk += findings.filter((f) => f.severity === "medium").length * 3;
  risk += Math.min(10, Math.floor(rowCount / 50000) * 2); // volume amplifies breach impact
  const riskScore = Math.max(0, Math.min(100, risk));
  const riskGrade = riskScore >= 70 ? "SEVERE" : riskScore >= 45 ? "ELEVATED" : riskScore >= 20 ? "MODERATE" : "LOW";

  // --- Collection gaps ---------------------------------------------------
  const collectionGaps = [
    ...pack.companionFeeds,
    ...kpisBlocked.slice(0, 3).map((k) => `Field(s) ${k.missing.join(", ")} — unlocks "${k.name}"`),
  ].slice(0, 8);

  const regulations = Array.from(new Set([
    ...pack.regulations,
    ...sensitiveFields.flatMap((s) => s.regulations),
  ]));

  const briefing = [
    `${pack.label} (${Math.round(confidence * 100)}% confidence) — ${rowCount.toLocaleString()} rows, ${headers.length} columns.`,
    `Bound ${bindings.length}/${headers.length} columns to ${Array.from(new Set(bindings.map((b) => b.object))).join(", ") || "no objects"}.`,
    sensitivityClasses.length ? `Sensitivity: ${sensitivityClasses.join(", ")}. Regulatory surface: ${regulations.slice(0, 5).join("; ")}.` : "No sensitive classes detected.",
    findings.length ? `${findings.length} contract finding(s): ${findings.slice(0, 3).map((f) => f.code).join(", ")}.` : "Contract clean.",
    kpisReady.length ? `Computable now: ${kpisReady.map((k) => k.name).join(", ")}.` : "No pack KPI is computable yet.",
    kpisBlocked.length ? `Blocked: ${kpisBlocked.map((k) => `${k.name} (needs ${k.missing.join("+")})`).join("; ")}.` : "",
    `Risk ${riskScore}/100 (${riskGrade}).`,
  ].filter(Boolean).join(" ");

  return {
    version: 2,
    packId: pack.id,
    packLabel: pack.label,
    mission: pack.mission,
    confidence,
    alternates,
    objects: pack.objects,
    bindings,
    unmappedColumns,
    sensitiveFields,
    sensitivityClasses,
    regulations,
    retentionMonths: pack.retentionMonths,
    standards: pack.standards,
    findings,
    kpisReady,
    kpisBlocked,
    decisions: pack.decisions,
    collectionGaps,
    riskScore,
    riskGrade,
    briefing,
    generatedAt: new Date().toISOString(),
  };
}

/** Compact catalogue used by the UI and by chat when no dataset is selected. */
export function packCatalogue() {
  return DOMAIN_PACKS.map((p) => ({
    id: p.id,
    label: p.label,
    mission: p.mission,
    objects: p.objects,
    standards: p.standards,
    regulations: p.regulations,
    decisions: p.decisions,
    kpis: p.kpis.map((k) => k.name),
    companionFeeds: p.companionFeeds,
  }));
}
