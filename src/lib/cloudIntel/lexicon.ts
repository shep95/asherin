// ═══════════════════════════════════════════════════════════════════════════
// MULTILINGUAL LINGUISTIC LEXICON
//
// The first generation of the tone/urgency/deal/social classifiers was a set
// of hand-curated English word lists matched with `String.includes`. That has
// two failure modes, and only one of them is obvious:
//
//   1. A non-English correspondent scores zero on every dimension and is
//      reported as "linguistically flat" — which reads as a finding about the
//      person when it is actually a finding about the instrument.
//   2. `includes` matches inside words ("deal" inside "dealership", "help"
//      inside "helpless"), so even the English path over-counts.
//
// This module replaces both. It carries per-dimension term sets for nine
// language families, detects which language a text is written in from
// stopword and script evidence, matches on token boundaries rather than
// substrings, and — critically — reports when it could NOT determine the
// language, so the caller can state "not analysable" instead of "flat".
//
// DOCTRINE
//   · Absence of a hit is only reportable when the analyser understood the
//     language. Otherwise the correct output is `coverage: "unsupported"`.
//   · Detection is evidence-based (stopword density + script), never a guess
//     from a single character.
//   · Every lexicon is scored against its OWN language only. Cross-language
//     matching produces false positives (Spanish "actual" ≠ English "actual").
// ═══════════════════════════════════════════════════════════════════════════

export type LexDimension =
  | "urgency" | "deal" | "social" | "schedule" | "distress" | "flattery"
  | "minimizer" | "qualifier" | "gratitude";

export type LangCode = "en" | "es" | "fr" | "de" | "pt" | "it" | "nl" | "ru" | "ar" | "hi" | "zh" | "ja" | "ko";

/** Languages with a full nine-dimension lexicon below. */
const SUPPORTED: LangCode[] = ["en", "es", "fr", "de", "pt", "it", "nl", "ru", "ar"];

type Lexicon = Record<LexDimension, string[]>;

// ───────────────────────────── lexicons ─────────────────────────────
// Terms are lowercase and diacritic-bearing forms are written as they appear;
// normalisation strips diacritics on both sides so "prêt" matches "pret".

const EN: Lexicon = {
  urgency: ["asap", "urgent", "urgently", "immediately", "today", "eod", "deadline", "right away", "time sensitive", "by tomorrow", "no later than"],
  deal: ["invoice", "payment", "contract", "term sheet", "termsheet", "agreement", "wire", "equity", "investment", "proposal", "quote", "budget", "pricing", "deal", "funding", "royalty", "valuation", "retainer", "purchase order"],
  social: ["dinner", "lunch", "coffee", "birthday", "congrats", "congratulations", "family", "weekend", "holiday", "checking in", "check in", "catch up", "hope you", "how are you"],
  schedule: ["meeting", "call", "reschedule", "calendar", "invite", "availability", "schedule", "zoom", "meet", "appointment", "slot"],
  distress: ["emergency", "problem", "issue", "failed", "help", "concerned", "worried", "sorry", "unfortunately", "delay", "escalate", "blocked"],
  flattery: ["impressed", "amazing", "brilliant", "genius", "incredible", "honored", "admire", "huge fan", "love what"],
  minimizer: ["just", "quick", "quickly", "small", "tiny", "briefly", "simply", "only"],
  qualifier: ["honestly", "frankly", "to be fair", "actually", "basically", "literally", "i just wanted"],
  gratitude: ["thanks", "thank you", "appreciate", "grateful", "great", "glad", "happy"],
};

const ES: Lexicon = {
  urgency: ["urgente", "urgentemente", "cuanto antes", "de inmediato", "hoy mismo", "fecha limite", "plazo", "lo antes posible", "prioritario"],
  deal: ["factura", "pago", "contrato", "acuerdo", "transferencia", "inversion", "propuesta", "presupuesto", "precio", "financiacion", "valoracion", "anticipo", "orden de compra"],
  social: ["cena", "almuerzo", "comida", "cafe", "cumpleanos", "felicidades", "enhorabuena", "familia", "fin de semana", "vacaciones", "como estas", "espero que"],
  schedule: ["reunion", "llamada", "reprogramar", "calendario", "invitacion", "disponibilidad", "agenda", "cita", "horario"],
  distress: ["emergencia", "problema", "fallo", "error", "ayuda", "preocupado", "preocupada", "lo siento", "lamentablemente", "retraso", "bloqueado", "escalar"],
  flattery: ["impresionante", "increible", "brillante", "genial", "admiro", "honrado", "gran admirador", "me encanta"],
  minimizer: ["solo", "rapido", "rapida", "pequeno", "brevemente", "simplemente", "unicamente"],
  qualifier: ["sinceramente", "francamente", "la verdad", "basicamente", "literalmente", "de hecho"],
  gratitude: ["gracias", "agradezco", "agradecido", "agradecida", "te agradezco", "mil gracias"],
};

const FR: Lexicon = {
  urgency: ["urgent", "urgente", "des que possible", "immediatement", "aujourd hui", "date limite", "delai", "au plus tard", "prioritaire"],
  deal: ["facture", "paiement", "contrat", "accord", "virement", "investissement", "proposition", "devis", "budget", "tarif", "financement", "valorisation", "bon de commande"],
  social: ["diner", "dejeuner", "cafe", "anniversaire", "felicitations", "famille", "week end", "vacances", "comment vas tu", "j espere que"],
  schedule: ["reunion", "appel", "reprogrammer", "calendrier", "invitation", "disponibilite", "agenda", "rendez vous", "creneau"],
  distress: ["urgence", "probleme", "echec", "erreur", "aide", "inquiet", "inquiete", "desole", "malheureusement", "retard", "bloque", "escalade"],
  flattery: ["impressionne", "incroyable", "brillant", "genie", "honore", "admire", "grand fan", "j adore"],
  minimizer: ["juste", "rapide", "rapidement", "petit", "brievement", "simplement", "seulement"],
  qualifier: ["honnetement", "franchement", "en fait", "basiquement", "litteralement"],
  gratitude: ["merci", "remercie", "reconnaissant", "reconnaissante", "grand merci"],
};

const DE: Lexicon = {
  urgency: ["dringend", "sofort", "umgehend", "heute noch", "frist", "deadline", "so schnell wie moglich", "spatestens", "eilt"],
  deal: ["rechnung", "zahlung", "vertrag", "vereinbarung", "uberweisung", "investition", "angebot", "budget", "preis", "finanzierung", "bewertung", "bestellung"],
  social: ["abendessen", "mittagessen", "kaffee", "geburtstag", "gluckwunsch", "gluckwunsche", "familie", "wochenende", "urlaub", "wie geht es dir", "ich hoffe"],
  schedule: ["besprechung", "termin", "anruf", "verschieben", "kalender", "einladung", "verfugbarkeit", "zeitfenster"],
  distress: ["notfall", "problem", "fehler", "hilfe", "besorgt", "entschuldigung", "leider", "verzogerung", "blockiert", "eskalation"],
  flattery: ["beeindruckt", "unglaublich", "brillant", "genial", "geehrt", "bewundere", "grosser fan"],
  minimizer: ["nur", "kurz", "schnell", "klein", "einfach", "lediglich"],
  qualifier: ["ehrlich gesagt", "offen gesagt", "eigentlich", "im grunde", "buchstablich"],
  gratitude: ["danke", "vielen dank", "dankbar", "ich schatze"],
};

const PT: Lexicon = {
  urgency: ["urgente", "urgentemente", "o quanto antes", "imediatamente", "hoje mesmo", "prazo", "data limite", "prioritario"],
  deal: ["fatura", "pagamento", "contrato", "acordo", "transferencia", "investimento", "proposta", "orcamento", "preco", "financiamento", "avaliacao", "ordem de compra"],
  social: ["jantar", "almoco", "cafe", "aniversario", "parabens", "familia", "fim de semana", "ferias", "como vai", "espero que"],
  schedule: ["reuniao", "chamada", "remarcar", "calendario", "convite", "disponibilidade", "agenda", "horario"],
  distress: ["emergencia", "problema", "falha", "erro", "ajuda", "preocupado", "preocupada", "desculpe", "infelizmente", "atraso", "bloqueado"],
  flattery: ["impressionado", "incrivel", "brilhante", "genial", "honrado", "admiro", "grande fa"],
  minimizer: ["apenas", "rapido", "pequeno", "brevemente", "simplesmente", "somente"],
  qualifier: ["honestamente", "francamente", "na verdade", "basicamente", "literalmente"],
  gratitude: ["obrigado", "obrigada", "agradeco", "grato", "grata"],
};

const IT: Lexicon = {
  urgency: ["urgente", "urgentemente", "al piu presto", "immediatamente", "oggi stesso", "scadenza", "entro"],
  deal: ["fattura", "pagamento", "contratto", "accordo", "bonifico", "investimento", "proposta", "preventivo", "budget", "prezzo", "finanziamento", "valutazione"],
  social: ["cena", "pranzo", "caffe", "compleanno", "congratulazioni", "famiglia", "fine settimana", "vacanza", "come stai", "spero che"],
  schedule: ["riunione", "chiamata", "riprogrammare", "calendario", "invito", "disponibilita", "agenda", "appuntamento"],
  distress: ["emergenza", "problema", "errore", "aiuto", "preoccupato", "preoccupata", "scusa", "purtroppo", "ritardo", "bloccato"],
  flattery: ["impressionato", "incredibile", "brillante", "geniale", "onorato", "ammiro", "grande fan"],
  minimizer: ["solo", "veloce", "piccolo", "brevemente", "semplicemente", "soltanto"],
  qualifier: ["onestamente", "francamente", "in realta", "praticamente", "letteralmente"],
  gratitude: ["grazie", "ringrazio", "grato", "grata", "apprezzo"],
};

const NL: Lexicon = {
  urgency: ["dringend", "urgent", "zo snel mogelijk", "onmiddellijk", "vandaag nog", "deadline", "uiterlijk"],
  deal: ["factuur", "betaling", "contract", "overeenkomst", "overboeking", "investering", "voorstel", "offerte", "budget", "prijs", "financiering", "waardering"],
  social: ["diner", "lunch", "koffie", "verjaardag", "gefeliciteerd", "familie", "weekend", "vakantie", "hoe gaat het", "ik hoop"],
  schedule: ["vergadering", "gesprek", "verzetten", "agenda", "uitnodiging", "beschikbaarheid", "afspraak"],
  distress: ["noodgeval", "probleem", "fout", "hulp", "bezorgd", "sorry", "helaas", "vertraging", "geblokkeerd"],
  flattery: ["onder de indruk", "ongelooflijk", "briljant", "geniaal", "vereerd", "bewonder", "grote fan"],
  minimizer: ["gewoon", "snel", "klein", "kort", "eenvoudig", "alleen"],
  qualifier: ["eerlijk gezegd", "openlijk", "eigenlijk", "in feite", "letterlijk"],
  gratitude: ["bedankt", "dank je", "dank u", "dankbaar", "waardeer"],
};

const RU: Lexicon = {
  urgency: ["срочно", "срочный", "немедленно", "как можно скорее", "сегодня же", "дедлайн", "крайний срок"],
  deal: ["счет", "оплата", "договор", "контракт", "соглашение", "перевод", "инвестиции", "предложение", "бюджет", "цена", "финансирование", "оценка"],
  social: ["ужин", "обед", "кофе", "день рождения", "поздравляю", "семья", "выходные", "отпуск", "как дела", "надеюсь"],
  schedule: ["встреча", "звонок", "перенести", "календарь", "приглашение", "доступность", "расписание"],
  distress: ["срочная помощь", "проблема", "ошибка", "помощь", "беспокоюсь", "извините", "к сожалению", "задержка", "заблокировано"],
  flattery: ["впечатлен", "невероятно", "блестяще", "гениально", "польщен", "восхищаюсь", "большой поклонник"],
  minimizer: ["просто", "быстро", "небольшой", "коротко", "всего лишь"],
  qualifier: ["честно говоря", "откровенно", "на самом деле", "в принципе", "буквально"],
  gratitude: ["спасибо", "благодарю", "признателен", "ценю"],
};

const AR: Lexicon = {
  urgency: ["عاجل", "بشكل عاجل", "فورا", "في اسرع وقت", "اليوم", "الموعد النهائي"],
  deal: ["فاتورة", "دفع", "عقد", "اتفاقية", "تحويل", "استثمار", "عرض", "ميزانية", "سعر", "تمويل", "تقييم"],
  social: ["عشاء", "غداء", "قهوة", "عيد ميلاد", "تهانينا", "عائلة", "عطلة", "كيف حالك", "اتمنى"],
  schedule: ["اجتماع", "مكالمة", "اعادة جدولة", "تقويم", "دعوة", "موعد", "جدول"],
  distress: ["طوارئ", "مشكلة", "خطا", "مساعدة", "قلق", "اسف", "للاسف", "تاخير", "معطل"],
  flattery: ["معجب", "رائع", "عبقري", "مذهل", "اتشرف", "معجب كبير"],
  minimizer: ["فقط", "سريع", "صغير", "باختصار", "ببساطة"],
  qualifier: ["بصراحة", "في الحقيقة", "اساسا", "حرفيا"],
  gratitude: ["شكرا", "اشكرك", "ممتن", "اقدر"],
};

const LEXICONS: Partial<Record<LangCode, Lexicon>> = { en: EN, es: ES, fr: FR, de: DE, pt: PT, it: IT, nl: NL, ru: RU, ar: AR };

// ─────────────────────── detection evidence ───────────────────────
// Stopwords, not content words: they are the highest-frequency, most
// language-specific tokens and they survive subject-line truncation.

const STOPWORDS: Partial<Record<LangCode, string[]>> = {
  en: ["the", "and", "you", "for", "with", "that", "this", "have", "your", "are", "will", "from", "not", "can"],
  es: ["que", "de", "la", "el", "los", "las", "para", "con", "una", "por", "esta", "como", "pero", "muy"],
  fr: ["le", "la", "les", "des", "une", "pour", "avec", "que", "vous", "nous", "dans", "est", "pas", "sur"],
  de: ["der", "die", "das", "und", "ich", "sie", "mit", "fur", "auf", "ist", "nicht", "eine", "wir", "haben"],
  pt: ["que", "de", "para", "com", "uma", "nao", "por", "como", "mas", "voce", "esta", "dos", "das"],
  it: ["che", "di", "il", "la", "per", "con", "una", "non", "come", "sono", "questo", "dei", "alla"],
  nl: ["de", "het", "een", "en", "van", "voor", "met", "niet", "dat", "ik", "je", "zijn", "op"],
  ru: ["и", "в", "не", "на", "что", "с", "по", "это", "как", "для", "вы", "мы"],
  ar: ["في", "من", "على", "الى", "عن", "مع", "هذا", "التي", "ان", "لا"],
};

/** Scripts settle the question before any stopword is counted. */
const SCRIPT_TESTS: Array<{ lang: LangCode; re: RegExp }> = [
  { lang: "zh", re: /[\u4e00-\u9fff]/ },
  { lang: "ja", re: /[\u3040-\u30ff]/ },
  { lang: "ko", re: /[\uac00-\ud7af]/ },
  { lang: "ru", re: /[\u0400-\u04ff]/ },
  { lang: "ar", re: /[\u0600-\u06ff]/ },
  { lang: "hi", re: /[\u0900-\u097f]/ },
];

/** Fold diacritics and punctuation so "prêt"/"pret" and "café"/"cafe" unify. */
export function normalizeText(raw: string): string {
  return String(raw ?? "")
    .toLowerCase()
    .normalize("NFD")
    // Combining marks only — Cyrillic and Arabic base letters are untouched.
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\p{L}\p{N}\s]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export interface LanguageVerdict {
  /** Best-supported language, or null when no evidence cleared the floor. */
  lang: LangCode | null;
  /** 0–1. Share of stopword evidence that pointed at the winner. */
  confidence: number;
  /** Whether a lexicon exists for the detected language. */
  supported: boolean;
  /** Human-readable basis. Always populated — never a bare null result. */
  basis: string;
}

/**
 * Detect the language of a corpus.
 *
 * Script evidence is decisive when present (CJK, Cyrillic, Arabic, Devanagari
 * cannot be confused with Latin). For Latin-script text the winner is the
 * language whose stopwords occupy the greatest share of tokens, and it must
 * clear an absolute floor of three hits — otherwise a two-word subject line
 * would "detect" a language off one coincidence.
 */
export function detectLanguage(rawCorpus: string): LanguageVerdict {
  const text = normalizeText(rawCorpus);
  if (text.length < 12) {
    return { lang: null, confidence: 0, supported: false, basis: "Corpus too short to carry language evidence (under 12 characters after normalisation)." };
  }

  for (const { lang, re } of SCRIPT_TESTS) {
    if (re.test(rawCorpus)) {
      return {
        lang,
        confidence: 0.95,
        supported: SUPPORTED.includes(lang),
        basis: `Script evidence: ${lang.toUpperCase()} character range present.`,
      };
    }
  }

  const tokens = text.split(" ").filter(Boolean);
  const tokenSet = new Set(tokens);
  let best: { lang: LangCode; hits: number } | null = null;
  let totalHits = 0;

  for (const [lang, words] of Object.entries(STOPWORDS) as Array<[LangCode, string[]]>) {
    if (/^(ru|ar)$/.test(lang)) continue; // settled by script, above
    const hits = words.reduce((n, w) => (tokenSet.has(w) ? n + 1 : n), 0);
    totalHits += hits;
    if (!best || hits > best.hits) best = { lang, hits };
  }

  if (!best || best.hits < 3) {
    return {
      lang: null,
      confidence: 0,
      supported: false,
      basis: `No language cleared the evidence floor (best candidate matched ${best?.hits ?? 0} stopwords; three are required).`,
    };
  }

  return {
    lang: best.lang,
    confidence: totalHits ? Math.min(1, best.hits / totalHits) : 0,
    supported: SUPPORTED.includes(best.lang),
    basis: `Stopword evidence: ${best.hits} ${best.lang.toUpperCase()} function words across ${tokens.length} tokens.`,
  };
}

// ───────────────────────────── scoring ─────────────────────────────

export type Coverage = "analysed" | "unsupported" | "undetermined";

export interface LexScore {
  /** Per-dimension hit counts. Zero is meaningful only when coverage === "analysed". */
  hits: Record<LexDimension, number>;
  lang: LangCode | null;
  coverage: Coverage;
  /** Why the score reads the way it does — rendered verbatim in reports. */
  note: string;
}

const ZERO: Record<LexDimension, number> = {
  urgency: 0, deal: 0, social: 0, schedule: 0, distress: 0,
  flattery: 0, minimizer: 0, qualifier: 0, gratitude: 0,
};

/**
 * Count term hits on TOKEN boundaries, not substrings.
 *
 * Multi-word terms are matched against the normalised string with spaces on
 * both sides, single words against the token set. This is what stops "deal"
 * scoring inside "dealership" and "help" inside "helpless" — the substring
 * bug that inflated every English score in the previous generation.
 */
function countTerms(normalised: string, tokens: Set<string>, terms: string[]): number {
  let n = 0;
  const padded = ` ${normalised} `;
  for (const term of terms) {
    if (term.includes(" ")) {
      if (padded.includes(` ${term} `)) n++;
    } else if (tokens.has(term)) {
      n++;
    }
  }
  return n;
}

/**
 * Score one corpus across every dimension in its own language.
 *
 * The contract that matters: when the language is undetectable or has no
 * lexicon, this returns zeros AND says so. A caller must branch on `coverage`
 * before describing a subject as linguistically flat.
 */
export function scoreLexicon(rawCorpus: string, pinned?: LanguageVerdict): LexScore {
  const verdict = pinned ?? detectLanguage(rawCorpus);
  const normalised = normalizeText(rawCorpus);
  const tokens = new Set(normalised.split(" ").filter(Boolean));

  if (!verdict.lang) {
    return {
      hits: { ...ZERO },
      lang: null,
      coverage: "undetermined",
      note: `Linguistic layer not run — language could not be determined. ${verdict.basis} Scores of zero here describe the instrument, not the correspondent.`,
    };
  }

  const lex = LEXICONS[verdict.lang];
  if (!lex) {
    return {
      hits: { ...ZERO },
      lang: verdict.lang,
      coverage: "unsupported",
      note: `Correspondence is in ${verdict.lang.toUpperCase()}; no lexicon is carried for that language, so tone, urgency and deal pressure are NOT OBSERVABLE rather than absent. ${verdict.basis}`,
    };
  }

  const hits = { ...ZERO };
  for (const dim of Object.keys(hits) as LexDimension[]) {
    hits[dim] = countTerms(normalised, tokens, lex[dim]);
  }

  return {
    hits,
    lang: verdict.lang,
    coverage: "analysed",
    note: `Linguistic layer run against the ${verdict.lang.toUpperCase()} lexicon. ${verdict.basis}`,
  };
}

/** Convenience: the dimension list a report can iterate deterministically. */
export const LEX_DIMENSIONS: LexDimension[] = [
  "urgency", "deal", "social", "schedule", "distress", "flattery", "minimizer", "qualifier", "gratitude",
];
