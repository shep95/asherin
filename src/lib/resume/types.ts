// Canonical resume shape. Every surface — upload parser, chat bridge, PDF
// renderer, tailoring engine — reads and writes this one structure so a change
// made in chat is the same change the exported PDF carries.

export interface ResumeRole {
  company: string;
  title: string;
  location?: string;
  /** Free-form ("Mar 2021"), kept as written so we never fabricate precision. */
  start?: string;
  end?: string;
  bullets: string[];
}

export interface ResumeEducation {
  school: string;
  degree?: string;
  field?: string;
  start?: string;
  end?: string;
  note?: string;
}

export interface ResumeProject {
  name: string;
  description?: string;
  link?: string;
}

export interface ResumeStructured {
  name: string;
  headline: string;
  email: string;
  phone: string;
  location: string;
  links: string[];
  summary: string;
  experience: ResumeRole[];
  education: ResumeEducation[];
  skills: string[];
  certifications: string[];
  projects: ResumeProject[];
}

export const EMPTY_RESUME: ResumeStructured = {
  name: "",
  headline: "",
  email: "",
  phone: "",
  location: "",
  links: [],
  summary: "",
  experience: [],
  education: [],
  skills: [],
  certifications: [],
  projects: [],
};

/**
 * Coerce anything (model output, a database row, a half-typed draft) into a
 * complete ResumeStructured. Every downstream renderer can then assume shape
 * without a null check on each field.
 */
export function normalizeResume(input: unknown): ResumeStructured {
  const o = (input && typeof input === "object" ? input : {}) as Record<string, unknown>;
  const str = (v: unknown): string => (typeof v === "string" ? v.trim() : "");
  const arrStr = (v: unknown): string[] =>
    Array.isArray(v) ? v.map((x) => str(x)).filter(Boolean) : [];

  const experience: ResumeRole[] = Array.isArray(o.experience)
    ? (o.experience as unknown[]).map((r) => {
        const e = (r && typeof r === "object" ? r : {}) as Record<string, unknown>;
        return {
          company: str(e.company),
          title: str(e.title),
          location: str(e.location) || undefined,
          start: str(e.start) || undefined,
          end: str(e.end) || undefined,
          bullets: arrStr(e.bullets),
        };
      }).filter((r) => r.company || r.title || r.bullets.length)
    : [];

  const education: ResumeEducation[] = Array.isArray(o.education)
    ? (o.education as unknown[]).map((r) => {
        const e = (r && typeof r === "object" ? r : {}) as Record<string, unknown>;
        return {
          school: str(e.school),
          degree: str(e.degree) || undefined,
          field: str(e.field) || undefined,
          start: str(e.start) || undefined,
          end: str(e.end) || undefined,
          note: str(e.note) || undefined,
        };
      }).filter((r) => r.school || r.degree)
    : [];

  const projects: ResumeProject[] = Array.isArray(o.projects)
    ? (o.projects as unknown[]).map((r) => {
        const e = (r && typeof r === "object" ? r : {}) as Record<string, unknown>;
        return {
          name: str(e.name),
          description: str(e.description) || undefined,
          link: str(e.link) || undefined,
        };
      }).filter((p) => p.name)
    : [];

  return {
    name: str(o.name),
    headline: str(o.headline),
    email: str(o.email),
    phone: str(o.phone),
    location: str(o.location),
    links: arrStr(o.links),
    summary: str(o.summary),
    experience,
    education,
    skills: arrStr(o.skills),
    certifications: arrStr(o.certifications),
    projects,
  };
}

/** Flatten a structured resume to plain text — used for search, diffing, and prompts. */
export function resumeToText(r: ResumeStructured): string {
  const L: string[] = [];
  if (r.name) L.push(r.name);
  if (r.headline) L.push(r.headline);
  const contact = [r.email, r.phone, r.location, ...r.links].filter(Boolean).join(" | ");
  if (contact) L.push(contact);
  if (r.summary) L.push("", "SUMMARY", r.summary);
  if (r.experience.length) {
    L.push("", "EXPERIENCE");
    for (const e of r.experience) {
      L.push(`${e.title || "Role"} — ${e.company || ""}${e.location ? `, ${e.location}` : ""} (${e.start || "?"} – ${e.end || "Present"})`);
      e.bullets.forEach((b) => L.push(`  • ${b}`));
    }
  }
  if (r.education.length) {
    L.push("", "EDUCATION");
    for (const e of r.education) {
      L.push(`${[e.degree, e.field].filter(Boolean).join(" ")} — ${e.school} (${e.start || "?"} – ${e.end || "?"})${e.note ? ` · ${e.note}` : ""}`);
    }
  }
  if (r.skills.length) L.push("", "SKILLS", r.skills.join(", "));
  if (r.certifications.length) L.push("", "CERTIFICATIONS", r.certifications.join(", "));
  if (r.projects.length) {
    L.push("", "PROJECTS");
    for (const p of r.projects) L.push(`${p.name}${p.description ? ` — ${p.description}` : ""}${p.link ? ` (${p.link})` : ""}`);
  }
  return L.join("\n");
}
