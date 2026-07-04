// Grayscale-monochrome markdown dossier for the zosma-weak-key-scan edge fn.
// Kept intentionally compact so it renders cleanly in the chat surface.

interface WeakKeyRow {
  host: string;
  ok: boolean;
  grade: "A" | "B" | "C" | "D" | "F" | "ERR";
  issues: string[];
  pubkey_algo: string | null;
  bit_length: number | null;
  spki_sha256: string | null;
  roca_vulnerable: boolean | null;
  small_factor_hit: string | null;
  low_entropy: boolean;
  known_weak_hit: boolean;
  error?: string;
}

interface WeakKeyReport {
  operator?: string;
  summary: {
    total: number;
    graded_A: number;
    graded_F: number;
    errors: number;
    roca_hits: number;
    small_factor_hits: number;
    known_weak_hits: number;
  };
  rows: WeakKeyRow[];
}

const GRADE_MARK: Record<WeakKeyRow["grade"], string> = {
  A: "◉", B: "◉", C: "◈", D: "◈", F: "◇", ERR: "—",
};

export function formatWeakKeyDossier(r: WeakKeyReport): string {
  const s = r.summary;
  const header = [
    "## ◈ ZOSMA — Weak-Key Sweep",
    "",
    `**Targets:** ${s.total} · **A:** ${s.graded_A} · **F:** ${s.graded_F} · **Errors:** ${s.errors}`,
    `**ROCA hits:** ${s.roca_hits} · **Small-factor hits:** ${s.small_factor_hits} · **Known-weak hits:** ${s.known_weak_hits}`,
    "",
    "| | Host | Grade | Algo | Bits | Findings |",
    "|---|---|---|---|---|---|",
  ];

  const body = r.rows.map((row) => {
    const mark = GRADE_MARK[row.grade];
    const algo = row.pubkey_algo ?? "—";
    const bits = row.bit_length ?? "—";
    const findings = row.error
      ? `\`${row.error}\``
      : (row.issues.length ? row.issues.map(i => `\`${i}\``).join(" · ") : "clean");
    return `| ${mark} | \`${row.host}\` | **${row.grade}** | ${algo} | ${bits} | ${findings} |`;
  });

  const critical = r.rows.filter(x => x.grade === "F");
  const footer: string[] = [];
  if (critical.length) {
    footer.push("", "**◇ Critical:**");
    for (const c of critical) {
      footer.push(`- \`${c.host}\` — ${c.issues.join("; ") || c.error || "unspecified"}`);
    }
  }

  return [...header, ...body, ...footer].join("\n");
}
