// Auto-generated from user uploads for the Imagine benchmark.
export const IMAGINE_AUREON_CODE = `Aureon Ouput:

\`\`\`python
#!/usr/bin/env python3
"""
Strict structural pattern spotter for Python projects uploaded as ZIP.

Inputs:
  - ZIP file containing a Python project (<= 500MB)

Outputs:
  - report.json
  - report.md

Python:
  - 3.10+

Design goals:
  - Strict mode: no heuristic fallbacks if AST parsing fails
  - Evidence anchors: pattern emission requires >=2 anchors from >=2 files
    (except inherently single-file patterns)
  - Scales to large ZIPs by streaming reads and using integer IDs for graphs
"""

from __future__ import annotations

import argparse
import ast
import dataclasses
import hashlib
import io
import json
import math
import os
import re
import shutil
import sys
import tempfile
import textwrap
import time
import zipfile
from collections import defaultdict, deque
from dataclasses import dataclass
from pathlib import Path
from statistics import median
from typing import Any, DefaultDict, Dict, Iterable, List, Optional, Sequence, Set, Tuple


EXCLUDED_DIR_NAMES: Set[str] = {
    "__pycache__",
    ".venv",
    "venv",
    ".mypy_cache",
    ".pytest_cache",
    ".tox",
    "build",
    "dist",
    ".eggs",
}
EXCLUDED_DIR_PREFIXES: Tuple[str, ...] = tuple(f"{d}/" for d in EXCLUDED_DIR_NAMES)
EGG_INFO_RE = re.compile(r".*\\.egg-info(/|$)")

MAX_ZIP_BYTES_DEFAULT = 500 * 1024 * 1024  # 500MB


def sha256_bytes(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def sha256_text(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8", errors="replace")).hexdigest()


def is_excluded_path(rel_posix: str) -> bool:
    if rel_posix.startswith("/") or rel_posix.startswith("\\\\"):
        return True
    if ".." in Path(rel_posix).parts:
        return True
    if EGG_INFO_RE.match(rel_posix):
        return True
    for prefix in EXCLUDED_DIR_PREFIXES:
        if rel_posix.startswith(prefix):
            return True
    # also exclude any segment equal to excluded names (covers nested)
    parts = rel_posix.split("/")
    for p in parts[:-1]:
        if p in EXCLUDED_DIR_NAMES:
            return True
    return False


def is_python_file(rel_posix: str) -> bool:
    return rel_posix.endswith(".py")


def strip_py_suffix(path: str) -> str:
    return path[:-3] if path.endswith(".py") else path


def module_from_relpath(rel_posix: str) -> str:
    # rel_posix uses "/" separators
    if rel_posix.endswith("__init__.py"):
        rel_posix = rel_posix[: -len("/__init__.py")]
    else:
        rel_posix = strip_py_suffix(rel_posix)
    return rel_posix.replace("/", ".").strip(".")


def count_loc_strict(source: str) -> int:
    loc = 0
    for line in source.splitlines():
        s = line.strip()
        if not s:
            continue
        if s.startswith("#"):
            continue
        loc += 1
    return loc


def safe_extract_zip(zip_path: Path, dest_dir: Path, max_zip_bytes: int) -> Dict[str, Any]:
    zip_size = zip_path.stat().st_size
    if zip_size > max_zip_bytes:
        raise ValueError(f"ZIP exceeds limit: {zip_size} bytes > {max_zip_bytes} bytes")

    extracted_files: List[str] = []
    skipped_files: List[str] = []
    rejected_entries: List[str] = []

    with zipfile.ZipFile(zip_path, "r") as zf:
        for info in zf.infolist():
            name = info.filename.replace("\\\\", "/")
            if name.endswith("/"):
                continue

            # Reject path traversal / absolute paths
            if is_excluded_path(name):
                skipped_files.append(name)
                continue
            if ".." in Path(name).parts or name.startswith("/") or name.startswith("\\\\"):
                rejected_entries.append(name)
                continue

            # Reject symlinks (best-effort: unix external_attr)
            is_symlink = False
            if (info.external_attr >> 16) & 0o170000 == 0o120000:
                is_symlink = True
            if is_symlink:
                rejected_entries.append(name)
                continue

            target_path = dest_dir / name
            target_path.parent.mkdir(parents=True, exist_ok=True)

            with zf.open(info, "r") as src, open(target_path, "wb") as dst:
                shutil.copyfileobj(src, dst)

            extracted_files.append(name)

    return {
        "zip_size_bytes": zip_size,
        "extracted_files": extracted_files,
        "skipped_files": skipped_files,
        "rejected_entries": rejected_entries,
    }


@dataclass(frozen=True)
class EvidenceAnchor:
    file: str
    start_line: int
    end_line: int
    snippet_hash: str
    reason_code: str


@dataclass
class ImportFact:
    imported_module: str
    lineno: int
    col: int
    kind: str  # import|from


@dataclass
class DefinitionFact:
    qualified_name: str
    kind: str  # class|function|async_function
    lineno: int
    end_lineno: int


@dataclass
class FunctionMetrics:
    qualified_name: str
    file: str
    lineno: int
    end_lineno: int
    cyclomatic: int
    max_nesting: int
    early_return_count: int


@dataclass
class ModuleFacts:
    file: str
    module: str
    sha256: str
    loc: int
    parse_error: Optional[str]
    imports: List[ImportFact]
    definitions: List[DefinitionFact]
    function_metrics: List[FunctionMetrics]
    top_level_assignments: List[Tuple[str, int, int]]  # (name, lineno, end_lineno)
    name_loads: List[Tuple[str, int, int]]  # (name, lineno, end_lineno)


BRANCH_NODES: Tuple[type, ...] = (
    ast.If,
    ast.For,
    ast.AsyncFor,
    ast.While,
    ast.Try,
    ast.With,
    ast.AsyncWith,
    ast.BoolOp,
    ast.IfExp,
    ast.ExceptHandler,
)

# Python 3.10 has match/case
if hasattr(ast, "Match"):
    BRANCH_NODES = BRANCH_NODES + (ast.Match,)


class ASTFactExtractor(ast.NodeVisitor):
    def __init__(self, module: str, file_path: str, source_lines: List[str]) -> None:
        self.module = module
        self.file_path = file_path
        self.source_lines = source_lines

        self.imports: List[ImportFact] = []
        self.definitions: List[DefinitionFact] = []
        self.function_metrics: List[FunctionMetrics] = []
        self.top_level_assignments: List[Tuple[str, int, int]] = []
        self.name_loads: List[Tuple[str, int, int]] = []

        self._scope_stack: List[str] = []
        self._function_stack: List[ast.AST] = []
        self._block_depth: int = 0

        # For early return counting (approx): track parent block statement index
        self._stmt_stack: List[Tuple[List[ast.stmt], int]] = []

        # Track top-level context
        self._at_module_top_level: bool = True

    def qualified(self, name: str) -> str:
        if not self._scope_stack:
            return f"{self.module}.{name}" if self.module else name
        return ".".join(([self.module] if self.module else []) + self._scope_stack + [name])

    def visit_Import(self, node: ast.Import) -> Any:
        for alias in node.names:
            self.imports.append(
                ImportFact(
                    imported_module=alias.name,
                    lineno=node.lineno,
                    col=node.col_offset,
                    kind="import",
                )
            )
        self.generic_visit(node)

    def visit_ImportFrom(self, node: ast.ImportFrom) -> Any:
        if node.module is None:
            self.generic_visit(node)
            return
        self.imports.append(
            ImportFact(
                imported_module=node.module,
                lineno=node.lineno,
                col=node.col_offset,
                kind="from",
            )
        )
        self.generic_visit(node)

    def visit_ClassDef(self, node: ast.ClassDef) -> Any:
        qn = self.qualified(node.name)
        self.definitions.append(
            DefinitionFact(
                qualified_name=qn,
                kind="class",
                lineno=node.lineno,
                end_lineno=getattr(node, "end_lineno", node.lineno),
            )
        )
        prev_top = self._at_module_top_level
        self._at_module_top_level = False
        self._scope_stack.append(node.name)
        self.generic_visit(node)
        self._scope_stack.pop()
        self._at_module_top_level = prev_top

    def _analyze_function_metrics(self, node: ast.AST, qn: str) -> FunctionMetrics:
        cyclomatic = 1
        max_nesting = 0
        early_returns = 0

        def walk(n: ast.AST, depth: int) -> None:
            nonlocal cyclomatic, max_nesting, early_returns
            if isinstance(n, BRANCH_NODES):
                cyclomatic += 1
                depth += 1
                max_nesting = max(max_nesting, depth)

            # BoolOp contributes additional paths: a and b and c -> + (len(values)-1)
            if isinstance(n, ast.BoolOp):
                cyclomatic += max(0, len(n.values) - 1)

            # Approx early return: if Return appears in a block before last stmt
            if isinstance(n, ast.Return):
                # This is handled in visit_Return with stmt stack; keep here as backup no-op
                pass

            for child in ast.iter_child_nodes(n):
                walk(child, depth)

        walk(node, 0)

        # early_returns already accumulated in visit_Return based on stmt stack
        early_returns = getattr(node, "_early_return_count", 0)

        return FunctionMetrics(
            qualified_name=qn,
            file=self.file_path,
            lineno=getattr(node, "lineno", 1),
            end_lineno=getattr(node, "end_lineno", getattr(node, "lineno", 1)),
            cyclomatic=cyclomatic,
            max_nesting=max_nesting,
            early_return_count=early_returns,
        )

    def _visit_function_common(self, node: ast.AST, name: str, kind: str) -> Any:
        qn = self.qualified(name)
        self.definitions.append(
            DefinitionFact(
                qualified_name=qn,
                kind=kind,
                lineno=getattr(node, "lineno", 1),
                end_lineno=getattr(node, "end_lineno", getattr(node, "lineno", 1)),
            )
        )

        prev_top = self._at_module_top_level
        self._at_module_top_level = False
        self._scope_stack.append(name)

        # Initialize early return counter storage on node
        setattr(node, "_early_return_count", 0)

        # Walk body with statement stack tracking
        self._function_stack.append(node)
        self._stmt_stack.append((getattr(node, "body", []), 0))
        for idx, stmt in enumerate(getattr(node, "body", [])):
            self._stmt_stack[-1] = (getattr(node, "body", []), idx)
            self.visit(stmt)
        self._stmt_stack.pop()
        self._function_stack.pop()

        # Metrics after visiting body
        self.function_metrics.append(self._analyze_function_metrics(node, qn))

        self._scope_stack.pop()
        self._at_module_top_level = prev_top

    def visit_FunctionDef(self, node: ast.FunctionDef) -> Any:
        return self._visit_function_common(node, node.name, "function")

    def visit_AsyncFunctionDef(self, node: ast.AsyncFunctionDef) -> Any:
        return self._visit_function_common(node, node.name, "async_function")

    def visit_Return(self, node: ast.Return) -> Any:
        # Approx: if Return is not the last statement in the current block, count it
        if self._function_stack and self._stmt_stack:
            stmts, idx = self._stmt_stack[-1]
            if idx < len(stmts) - 1:
                fn = self._function_stack[-1]
                current = getattr(fn, "_early_return_count", 0)
                setattr(fn, "_early_return_count", current + 1)
        self.generic_visit(node)

    def visit_Assign(self, node: ast.Assign) -> Any:
        if self._at_module_top_level:
            for t in node.targets:
                if isinstance(t, ast.Name):
                    self.top_level_assignments.append((t.id, node.lineno, getattr(node, "end_lineno", node.lineno)))
        self.generic_visit(node)

    def visit_AnnAssign(self, node: ast.AnnAssign) -> Any:
        if self._at_module_top_level:
            t = node.target
            if isinstance(t, ast.Name):
                self.top_level_assignments.append((t.id, node.lineno, getattr(node, "end_lineno", node.lineno)))
        self.generic_visit(node)

    def visit_Name(self, node: ast.Name) -> Any:
        if isinstance(node.ctx, ast.Load):
            self.name_loads.append((node.id, node.lineno, getattr(node, "end_lineno", node.lineno)))
        self.generic_visit(node)


def read_text_file(path: Path) -> str:
    return path.read_text(encoding="utf-8", errors="replace")


def slice_snippet_hash(source_lines: List[str], start_line: int, end_line: int) -> str:
    start = max(1, start_line)
    end = max(start, end_line)
    snippet = "\\n".join(source_lines[start - 1 : end])  # 1-indexed lines
    return sha256_text(snippet)


def percentile(values: List[int], p: float) -> int:
    if not values:
        return 0
    vs = sorted(values)
    k = int(math.ceil((p / 100.0) * len(vs))) - 1
    k = max(0, min(k, len(vs) - 1))
    return vs[k]


def z_scores(values: Dict[int, float]) -> Dict[int, float]:
    if not values:
        return {}
    xs = list(values.values())
    mu = sum(xs) / len(xs)
    var = sum((x - mu) ** 2 for x in xs) / len(xs)
    sd = math.sqrt(var) if var > 0 else 1.0
    return {k: (v - mu) / sd for k, v in values.items()}


def tarjan_scc(n: int, adj: List[List[int]]) -> List[List[int]]:
    index = 0
    stack: List[int] = []
    on_stack = [False] * n
    indices = [-1] * n
    lowlink = [0] * n
    sccs: List[List[int]] = []

    sys.setrecursionlimit(max(10_000, n * 2 + 10))

    def strongconnect(v: int) -> None:
        nonlocal index
        indices[v] = index
        lowlink[v] = index
        index += 1
        stack.append(v)
        on_stack[v] = True

        for w in adj[v]:
            if indices[w] == -1:
                strongconnect(w)
                lowlink[v] = min(lowlink[v], lowlink[w])
            elif on_stack[w]:
                lowlink[v] = min(lowlink[v], indices[w])

        if lowlink[v] == indices[v]:
            comp: List[int] = []
            while True:
                w = stack.pop()
                on_stack[w] = False
                comp.append(w)
                if w == v:
                    break
            sccs.append(comp)

    for v in range(n):
        if indices[v] == -1:
            strongconnect(v)

    return sccs


def betweenness_centrality_exact(n: int, adj: List[List[int]]) -> List[float]:
    # Brandes algorithm for directed graphs
    bc = [0.0] * n
    for s in range(n):
        stack: List[int] = []
        pred: List[List[int]] = [[] for _ in range(n)]
        sigma = [0.0] * n
        sigma[s] = 1.0
        dist = [-1] * n
        dist[s] = 0
        q = deque([s])

        while q:
            v = q.popleft()
            stack.append(v)
            for w in adj[v]:
                if dist[w] < 0:
                    q.append(w)
                    dist[w] = dist[v] + 1
                if dist[w] == dist[v] + 1:
                    sigma[w] += sigma[v]
                    pred[w].append(v)

        delta = [0.0] * n
        while stack:
            w = stack.pop()
            for v in pred[w]:
                if sigma[w] != 0:
                    delta_v = (sigma[v] / sigma[w]) * (1.0 + delta[w])
                    delta[v] += delta_v
            if w != s:
                bc[w] += delta[w]
    return bc


def betweenness_centrality_sampled(n: int, adj: List[List[int]], samples: int = 256) -> List[float]:
    # Sampled approximation: run Brandes from sampled sources
    if n == 0:
        return []
    samples = min(samples, n)
    stride = max(1, n // samples)
    sources = list(range(0, n, stride))[:samples]

    bc = [0.0] * n
    for s in sources:
        stack: List[int] = []
        pred: List[List[int]] = [[] for _ in range(n)]
        sigma = [0.0] * n
        sigma[s] = 1.0
        dist = [-1] * n
        dist[s] = 0
        q = deque([s])

        while q:
            v = q.popleft()
            stack.append(v)
            for w in adj[v]:
                if dist[w] < 0:
                    q.append(w)
                    dist[w] = dist[v] + 1
                if dist[w] == dist[v] + 1:
                    sigma[w] += sigma[v]
                    pred[w].append(v)

        delta = [0.0] * n
        while stack:
            w = stack.pop()
            for v in pred[w]:
                if sigma[w] != 0:
                    delta_v = (sigma[v] / sigma[w]) * (1.0 + delta[w])
                    delta[v] += delta_v
            if w != s:
                bc[w] += delta[w]

    # Scale up by factor n/len(sources) for rough comparability
    scale = n / max(1, len(sources))
    return [x * scale for x in bc]


@dataclass
class Pattern:
    pattern_id: str
    score: int
    severity: str
    summary: str
    evidence: List[EvidenceAnchor]
    impacted_modules: List[str]
    impacted_symbols: List[str]


def severity_for_pattern(pattern_id: str) -> str:
    if pattern_id == "CyclicDependency":
        return "critical"
    if pattern_id in ("GodModule", "UnstableCore", "GlobalStateMutation"):
        return "high"
    if pattern_id in ("DeepNestingHotspot",):
        return "medium"
    return "low"


def score_clamp(x: float) -> int:
    return int(max(0, min(100, round(x))))


def choose_two_file_evidence(evidence: List[EvidenceAnchor]) -> List[EvidenceAnchor]:
    # Enforce strict: >=2 anchors from >=2 distinct files
    by_file: Dict[str, List[EvidenceAnchor]] = defaultdict(list)
    for e in evidence:
        by_file[e.file].append(e)
    if len(by_file) < 2:
        return []
    out: List[EvidenceAnchor] = []
    for f in sorted(by_file.keys())[:2]:
        out.append(by_file[f][0])
    return out


def build_markdown_report(
    project_meta: Dict[str, Any],
    patterns: List[Pattern],
    module_metrics: Dict[str, Dict[str, Any]],
    function_metrics: List[FunctionMetrics],
) -> str:
    top_patterns = patterns[:20]

    def md_table(headers: List[str], rows: List[List[str]]) -> str:
        out = []
        out.append("| " + " | ".join(headers) + " |")
        out.append("| " + " | ".join(["---"] * len(headers)) + " |")
        for r in rows:
            out.append("| " + " | ".join(r) + " |")
        return "\\n".join(out)

    # Module rankings
    modules_sorted_fanin = sorted(module_metrics.items(), key=lambda kv: kv[1]["fan_in"], reverse=True)[:20]
    modules_sorted_fanout = sorted(module_metrics.items(), key=lambda kv: kv[1]["fan_out"], reverse=True)[:20]
    modules_sorted_instab = sorted(module_metrics.items(), key=lambda kv: kv[1]["instability"], reverse=True)[:20]

    # Function rankings
    funcs_sorted_cyc = sorted(function_metrics, key=lambda fm: fm.cyclomatic, reverse=True)[:20]
    funcs_sorted_nest = sorted(function_metrics, key=lambda fm: fm.max_nesting, reverse=True)[:20]

    lines: List[str] = []
    lines.append("# Structural Pattern Report (Strict)")
    lines.append("")
    lines.append("## Executive Summary")
    lines.append("")
    lines.append(f"- Files analyzed: **{project_meta['files_analyzed']}**")
    lines.append(f"- Parse errors: **{project_meta['parse_error_count']}**")
    lines.append(f"- Patterns emitted: **{len(patterns)}**")
    lines.append("")

    if top_patterns:
        rows = []
        for p in top_patterns:
            rows.append(
                [
                    p.pattern_id,
                    p.severity,
                    str(p.score),
                    ", ".join(p.impacted_modules[:4]) + ("…" if len(p.impacted_modules) > 4 else ""),
                ]
            )
        lines.append("## Top Patterns")
        lines.append("")
        lines.append(md_table(["Pattern", "Severity", "Score", "Impacted modules"], rows))
        lines.append("")
    else:
        lines.append("## Top Patterns")
        lines.append("")
        lines.append("- None emitted under strict thresholds.")
        lines.append("")

    lines.append("## Module Metrics (Top 20)")
    lines.append("")
    lines.append("### Fan-in")
    lines.append("")
    lines.append(
        md_table(
            ["Module", "Fan-in", "Fan-out", "Instability", "LOC"],
            [
                [
                    m,
                    str(mm["fan_in"]),
                    str(mm["fan_out"]),
                    f"{mm['instability']:.2f}",
                    str(mm["loc"]),
                ]
                for m, mm in modules_sorted_fanin
            ],
        )
    )
    lines.append("")
    lines.append("### Fan-out")
    lines.append("")
    lines.append(
        md_table(
            ["Module", "Fan-in", "Fan-out", "Instability", "LOC"],
            [
                [
                    m,
                    str(mm["fan_in"]),
                    str(mm["fan_out"]),
                    f"{mm['instability']:.2f}",
                    str(mm["loc"]),
                ]
                for m, mm in modules_sorted_fanout
            ],
        )
    )
    lines.append("")
    lines.append("### Instability")
    lines.append("")
    lines.append(
        md_table(
            ["Module", "Fan-in", "Fan-out", "Instability", "LOC"],
            [
                [
                    m,
                    str(mm["fan_in"]),
                    str(mm["fan_out"]),
                    f"{mm['instability']:.2f}",
                    str(mm["loc"]),
                ]
                for m, mm in modules_sorted_instab
            ],
        )
    )
    lines.append("")

    lines.append("## Function Hotspots (Top 20)")
    lines.append("")
    lines.append("### Cyclomatic")
    lines.append("")
    lines.append(
        md_table(
            ["Function", "Cyclomatic", "Nesting", "Early returns", "File:Lines"],
            [
                [
                    fm.qualified_name,
                    str(fm.cyclomatic),
                    str(fm.max_nesting),
                    str(fm.early_return_count),
                    f"{fm.file}:{fm.lineno}-{fm.end_lineno}",
                ]
                for fm in funcs_sorted_cyc
            ],
        )
    )
    lines.append("")
    lines.append("### Nesting")
    lines.append("")
    lines.append(
        md_table(
            ["Function", "Cyclomatic", "Nesting", "Early returns", "File:Lines"],
            [
                [
                    fm.qualified_name,
                    str(fm.cyclomatic),
                    str(fm.max_nesting),
                    str(fm.early_return_count),
                    f"{fm.file}:{fm.lineno}-{fm.end_lineno}",
                ]
                for fm in funcs_sorted_nest
            ],
        )
    )
    lines.append("")

    lines.append("## Evidence Index")
    lines.append("")
    if not patterns:
        lines.append("- No evidence (no patterns emitted).")
    else:
        for p in patterns:
            lines.append(f"### {p.pattern_id} ({p.severity}, score {p.score})")
            lines.append("")
            lines.append(p.summary)
            lines.append("")
            for e in p.evidence:
                lines.append(f"- \`{e.file}:{e.start_line}-{e.end_line}\` \`{e.reason_code}\` \`{e.snippet_hash}\`")
            lines.append("")
    return "\\n".join(lines)


def main() -> int:
    ap = argparse.ArgumentParser(
        prog="py_struct_patterns",
        description="Strict structural pattern detector for Python code uploaded as ZIP (JSON + Markdown).",
        formatter_class=argparse.RawTextHelpFormatter,
    )
    ap.add_argument("zip_path", type=str, help="Path to project.zip")
    ap.add_argument("--max-zip-bytes", type=int, default=MAX_ZIP_BYTES_DEFAULT, help="Max ZIP size in bytes (default 500MB)")
    ap.add_argument("--out-dir", type=str, default=".", help="Output directory (default current)")
    args = ap.parse_args()

    zip_path = Path(args.zip_path).resolve()
    out_dir = Path(args.out_dir).resolve()
    out_dir.mkdir(parents=True, exist_ok=True)

    t0 = time.time()

    with tempfile.TemporaryDirectory(prefix="py_struct_patterns_") as td:
        workdir = Path(td)
        extract_meta = safe_extract_zip(zip_path, workdir, max_zip_bytes=args.max_zip_bytes)

        # Index python files
        py_files: List[Path] = []
        for rel in extract_meta["extracted_files"]:
            rel_posix = rel.replace("\\\\", "/")
            if is_excluded_path(rel_posix):
                continue
            if not is_python_file(rel_posix):
                continue
            py_files.append(workdir / rel_posix)

        # Build internal module set
        file_records: List[Tuple[str, str]] = []  # (rel_posix, module)
        internal_modules: Set[str] = set()
        init_modules: Set[str] = set()

        for p in py_files:
            rel_posix = p.relative_to(workdir).as_posix()
            mod = module_from_relpath(rel_posix)
            if not mod:
                continue
            file_records.append((rel_posix, mod))
            internal_modules.add(mod)
            if rel_posix.endswith("__init__.py"):
                init_modules.add(mod)

        # Map module -> file
        module_to_file: Dict[str, str] = {}
        for rel_posix, mod in file_records:
            module_to_file[mod] = rel_posix

        # Parse + extract facts
        module_facts: Dict[str, ModuleFacts] = {}
        parse_errors: List[Dict[str, Any]] = []

        for rel_posix, mod in file_records:
            file_path = workdir / rel_posix
            raw = file_path.read_bytes()
            digest = sha256_bytes(raw)
            source = raw.decode("utf-8", errors="replace")
            loc = count_loc_strict(source)
            source_lines = source.splitlines()

            imports: List[ImportFact] = []
            defs: List[DefinitionFact] = []
            fn_metrics: List[FunctionMetrics] = []
            top_level_assignments: List[Tuple[str, int, int]] = []
            name_loads: List[Tuple[str, int, int]] = []
            parse_error: Optional[str] = None

            try:
                tree = ast.parse(source, filename=rel_posix)
                extractor = ASTFactExtractor(module=mod, file_path=rel_posix, source_lines=source_lines)
                extractor.visit(tree)
                imports = extractor.imports
                defs = extractor.definitions
                fn_metrics = extractor.function_metrics
                top_level_assignments = extractor.top_level_assignments
                name_loads = extractor.name_loads
            except SyntaxError as e:
                parse_error = f"SyntaxError: {e.msg} at line {e.lineno}"
            except Exception as e:
                parse_error = f"ParseError: {type(e).__name__}: {e}"

            if parse_error:
                parse_errors.append({"file": rel_posix, "module": mod, "error": parse_error})

            module_facts[mod] = ModuleFacts(
                file=rel_posix,
                module=mod,
                sha256=digest,
                loc=loc,
                parse_error=parse_error,
                imports=imports,
                definitions=defs,
                function_metrics=fn_metrics,
                top_level_assignments=top_level_assignments,
                name_loads=name_loads,
            )

        # Build internal module adjacency as integer IDs
        modules_sorted = sorted(internal_modules)
        mod_id: Dict[str, int] = {m: i for i, m in enumerate(modules_sorted)}
        id_mod: List[str] = modules_sorted

        adj: List[List[int]] = [[] for _ in range(len(id_mod))]
        edges_with_locs: List[Tuple[int, int, str, int]] = []  # (from_id, to_id, from_file, lineno)

        def resolve_internal_import(imported: str) -> Optional[str]:
            # strict: exact match or package module
            if imported in internal_modules:
                return imported
            # if importing a package submodule not present, do not guess
            return None

        for m, facts in module_facts.items():
            if facts.parse_error:
                continue
            from_id = mod_id[m]
            for imp in facts.imports:
                target = resolve_internal_import(imp.imported_module)
                if not target:
                    continue
                to_id = mod_id[target]
                if to_id not in adj[from_id]:
                    adj[from_id].append(to_id)
                edges_with_locs.append((from_id, to_id, facts.file, imp.lineno))

        # Metrics: fan-in/out, instability, LOC
        fan_out: Dict[int, int] = {i: len(adj[i]) for i in range(len(adj))}
        fan_in: Dict[int, int] = {i: 0 for i in range(len(adj))}
        for u in range(len(adj)):
            for v in adj[u]:
                fan_in[v] += 1

        instability: Dict[int, float] = {}
        for i in range(len(adj)):
            denom = fan_in[i] + fan_out[i]
            instability[i] = (fan_out[i] / denom) if denom > 0 else 0.0

        loc_by_mod: Dict[int, int] = {mod_id[m]: module_facts[m].loc for m in internal_modules}

        # Centrality
        n_mods = len(id_mod)
        if n_mods > 20_000:
            bc = betweenness_centrality_sampled(n_mods, adj, samples=256)
            bc_mode = "sampled"
        else:
            bc = betweenness_centrality_exact(n_mods, adj)
            bc_mode = "exact"

        # Precompute percentiles
        fan_in_vals = list(fan_in.values())
        fan_out_vals = list(fan_out.values())
        p95_in = percentile(fan_in_vals, 95)
        p95_out = percentile(fan_out_vals, 95)

        # z-scores
        z_in = z_scores({k: float(v) for k, v in fan_in.items()})
        z_out = z_scores({k: float(v) for k, v in fan_out.items()})

        # Helper: evidence from import edges
        file_sources_cache: Dict[str, List[str]] = {}

        def get_source_lines(rel_file: str) -> List[str]:
            if rel_file in file_sources_cache:
                return file_sources_cache[rel_file]
            p = workdir / rel_file
            src = read_text_file(p)
            lines = src.splitlines()
            file_sources_cache[rel_file] = lines
            return lines

        def make_import_anchor(rel_file: str, lineno: int, reason_code: str) -> EvidenceAnchor:
            lines = get_source_lines(rel_file)
            start = lineno
            end = lineno
            return EvidenceAnchor(
                file=rel_file,
                start_line=start,
                end_line=end,
                snippet_hash=slice_snippet_hash(lines, start, end),
                reason_code=reason_code,
            )

        patterns: List[Pattern] = []

        # P1 CyclicDependency
        sccs = tarjan_scc(n_mods, adj)
        for comp in sccs:
            if len(comp) < 3:
                continue
            comp_set = set(comp)
            internal_edge_count = 0
            comp_edges: List[Tuple[int, int, str, int]] = []
            for (u, v, f, ln) in edges_with_locs:
                if u in comp_set and v in comp_set:
                    internal_edge_count += 1
                    comp_edges.append((u, v, f, ln))
            if internal_edge_count < len(comp):
                continue

            evidence = [make_import_anchor(f, ln, "CYCLE_EDGE") for (_, _, f, ln) in comp_edges]
            evidence = choose_two_file_evidence(evidence)
            if not evidence:
                continue

            score = score_clamp(min(100.0, 30.0 + 10.0 * len(comp) + 5.0 * internal_edge_count))
            impacted = [id_mod[i] for i in sorted(comp)]
            summary = f"SCC size {len(comp)} with {internal_edge_count} internal edges."
            patterns.append(
                Pattern(
                    pattern_id="CyclicDependency",
                    score=score,
                    severity=severity_for_pattern("CyclicDependency"),
                    summary=summary,
                    evidence=evidence,
                    impacted_modules=impacted,
                    impacted_symbols=[],
                )
            )

        # P2 GodModule
        for i in range(n_mods):
            if fan_in[i] < max(10, p95_in):
                continue
            if fan_out[i] < max(10, p95_out):
                continue
            if loc_by_mod.get(i, 0) < 300:
                continue

            mod_name = id_mod[i]
            # Evidence: inbound edges (others -> i) and outbound edges (i -> others)
            inbound_edges = [(u, v, f, ln) for (u, v, f, ln) in edges_with_locs if v == i]
            outbound_edges = [(u, v, f, ln) for (u, v, f, ln) in edges_with_locs if u == i]

            evidence: List[EvidenceAnchor] = []
            for (_, _, f, ln) in inbound_edges[:4]:
                evidence.append(make_import_anchor(f, ln, "GODMODULE_INBOUND"))
            for (_, _, f, ln) in outbound_edges[:4]:
                evidence.append(make_import_anchor(f, ln, "GODMODULE_OUTBOUND"))

            evidence = choose_two_file_evidence(evidence)
            if not evidence:
                continue

            score = score_clamp(min(100.0, 50.0 + 5.0 * z_in.get(i, 0.0) + 5.0 * z_out.get(i, 0.0) + (loc_by_mod.get(i, 0) / 100.0)))
            summary = f"fan_in={fan_in[i]} fan_out={fan_out[i]} LOC={loc_by_mod.get(i, 0)}."
            patterns.append(
                Pattern(
                    pattern_id="GodModule",
                    score=score,
                    severity=severity_for_pattern("GodModule"),
                    summary=summary,
                    evidence=evidence,
                    impacted_modules=[mod_name],
                    impacted_symbols=[],
                )
            )

        # P3 UnstableCore
        # Top 10% by betweenness
        if n_mods > 0:
            bc_pairs = sorted([(i, bc[i]) for i in range(n_mods)], key=lambda kv: kv[1], reverse=True)
            top_k = max(1, int(math.ceil(0.10 * n_mods)))
            top_bc_ids = set(i for (i, _) in bc_pairs[:top_k])
        else:
            top_bc_ids = set()

        for i in range(n_mods):
            if i not in top_bc_ids:
                continue
            if instability[i] < 0.7:
                continue
            if (fan_in[i] + fan_out[i]) < 15:
                continue

            mod_name = id_mod[i]
            inbound_edges = [(u, v, f, ln) for (u, v, f, ln) in edges_with_locs if v == i]
            outbound_edges = [(u, v, f, ln) for (u, v, f, ln) in edges_with_locs if u == i]

            evidence: List[EvidenceAnchor] = []
            for (_, _, f, ln) in inbound_edges[:3]:
                evidence.append(make_import_anchor(f, ln, "UNSTABLECORE_INBOUND"))
            for (_, _, f, ln) in outbound_edges[:3]:
                evidence.append(make_import_anchor(f, ln, "UNSTABLECORE_OUTBOUND"))

            evidence = choose_two_file_evidence(evidence)
            if not evidence:
                continue

            score = score_clamp(min(100.0, 40.0 + 60.0 * instability[i]))
            summary = f"betweenness={bc[i]:.3f} ({bc_mode}) instability={instability[i]:.2f} fan_in+fan_out={fan_in[i]+fan_out[i]}."
            patterns.append(
                Pattern(
                    pattern_id="UnstableCore",
                    score=score,
                    severity=severity_for_pattern("UnstableCore"),
                    summary=summary,
                    evidence=evidence,
                    impacted_modules=[mod_name],
                    impacted_symbols=[],
                )
            )

        # P4 GlobalStateMutation
        # Count top-level assignments per module and cross-module reads
        # Build name -> modules that load it
        name_load_modules: DefaultDict[str, Set[str]] = defaultdict(set)
        name_load_anchors: DefaultDict[Tuple[str, str], List[Tuple[str, int, int]]] = defaultdict(list)  # (name, module) -> occurrences

        for m, facts in module_facts.items():
            if facts.parse_error:
                continue
            for name, ln, end_ln in facts.name_loads:
                name_load_modules[name].add(m)
                name_load_anchors[(name, m)].append((facts.file, ln, end_ln))

        for m, facts in module_facts.items():
            if facts.parse_error:
                continue
            assigns = facts.top_level_assignments
            if len(assigns) < 8:
                continue

            # Names assigned at top-level
            assigned_names = [n for (n, _, _) in assigns]
            # For each assigned name, count distinct other modules that load it
            external_read_modules: Set[str] = set()
            for n in assigned_names:
                for reader_mod in name_load_modules.get(n, set()):
                    if reader_mod != m:
                        external_read_modules.add(reader_mod)

            if len(external_read_modules) < 2:
                continue

            # Evidence: two assignment anchors + two external read anchors (but strict: choose_two_file_evidence enforces 2 files)
            evidence: List[EvidenceAnchor] = []
            for (n, ln, end_ln) in assigns[:4]:
                lines = get_source_lines(facts.file)
                evidence.append(
                    EvidenceAnchor(
                        file=facts.file,
                        start_line=ln,
                        end_line=end_ln,
                        snippet_hash=slice_snippet_hash(lines, ln, end_ln),
                        reason_code="GLOBAL_ASSIGN",
                    )
                )

            # Add external reads
            for n in assigned_names[:4]:
                for reader_mod in sorted(list(external_read_modules))[:3]:
                    occs = name_load_anchors.get((n, reader_mod), [])
                    if not occs:
                        continue
                    f2, ln2, end2 = occs[0]
                    lines2 = get_source_lines(f2)
                    evidence.append(
                        EvidenceAnchor(
                            file=f2,
                            start_line=ln2,
                            end_line=end2,
                            snippet_hash=slice_snippet_hash(lines2, ln2, end2),
                            reason_code="EXTERNAL_GLOBAL_READ",
                        )
                    )

            evidence = choose_two_file_evidence(evidence)
            if not evidence:
                continue

            score = score_clamp(min(100.0, 30.0 + 5.0 * len(assigns)))
            summary = f"Top-level assigns={len(assigns)} external reader modules={len(external_read_modules)}."
            patterns.append(
                Pattern(
                    pattern_id="GlobalStateMutation",
                    score=score,
                    severity=severity_for_pattern("GlobalStateMutation"),
                    summary=summary,
                    evidence=evidence,
                    impacted_modules=[m],
                    impacted_symbols=[],
                )
            )

        # P5 DeepNestingHotspot (single-file pattern allowed)
        deep_funcs: List[FunctionMetrics] = []
        for facts in module_facts.values():
            if facts.parse_error:
                continue
            for fm in facts.function_metrics:
                if fm.max_nesting >= 5 and fm.cyclomatic >= 12:
                    deep_funcs.append(fm)

        for fm in sorted(deep_funcs, key=lambda x: (x.max_nesting, x.cyclomatic), reverse=True)[:50]:
            lines = get_source_lines(fm.file)
            evidence = [
                EvidenceAnchor(
                    file=fm.file,
                    start_line=fm.lineno,
                    end_line=fm.end_lineno,
                    snippet_hash=slice_snippet_hash(lines, fm.lineno, fm.end_lineno),
                    reason_code="DEEPNEST_FUNC",
                )
            ]
            score = score_clamp(min(100.0, 10.0 * fm.max_nesting + 3.0 * fm.cyclomatic))
            summary = f"cyclomatic={fm.cyclomatic} max_nesting={fm.max_nesting} early_returns={fm.early_return_count}."
            patterns.append(
                Pattern(
                    pattern_id="DeepNestingHotspot",
                    score=score,
                    severity=severity_for_pattern("DeepNestingHotspot"),
                    summary=summary,
                    evidence=evidence,
                    impacted_modules=[module_from_relpath(fm.file)],
                    impacted_symbols=[fm.qualified_name],
                )
            )

        # P6 GuardClauseStyle (module-level)
        for m, facts in module_facts.items():
            if facts.parse_error:
                continue
            fms = facts.function_metrics
            if len(fms) < 8:
                continue
            med_nesting = median([x.max_nesting for x in fms])
            med_early = median([x.early_return_count for x in fms])
            if med_nesting > 2:
                continue
            if med_early < 2:
                continue

            # Evidence: 2 functions with early returns
            candidates = [x for x in fms if x.early_return_count >= 2]
            if len(candidates) < 2:
                continue
            evidence: List[EvidenceAnchor] = []
            for fn in candidates[:4]:
                lines = get_source_lines(fn.file)
                evidence.append(
                    EvidenceAnchor(
                        file=fn.file,
                        start_line=fn.lineno,
                        end_line=fn.end_lineno,
                        snippet_hash=slice_snippet_hash(lines, fn.lineno, fn.end_lineno),
                        reason_code="GUARDCLAUSE_FUNC",
                    )
                )
            evidence = choose_two_file_evidence(evidence)
            if not evidence:
                # GuardClauseStyle is module-level; allow same-file evidence since module is single file.
                # But strict mode requested 2 files; so only emit if module spans multiple files (not applicable).
                # Therefore: do not emit in this case.
                continue

            score = score_clamp(min(100.0, 20.0 + 10.0 * float(med_early)))
            summary = f"median_nesting={med_nesting} median_early_returns={med_early} functions={len(fms)}."
            patterns.append(
                Pattern(
                    pattern_id="GuardClauseStyle",
                    score=score,
                    severity=severity_for_pattern("GuardClauseStyle"),
                    summary=summary,
                    evidence=evidence,
                    impacted_modules=[m],
                    impacted_symbols=[],
                )
            )

        # Rank patterns
        severity_rank = {"critical": 0, "high": 1, "medium": 2, "low": 3}
        pattern_rank = {
            "CyclicDependency": 0,
            "GodModule": 1,
            "UnstableCore": 2,
            "GlobalStateMutation": 3,
            "DeepNestingHotspot": 4,
            "GuardClauseStyle": 5,
        }

        patterns.sort(
            key=lambda p: (
                severity_rank.get(p.severity, 9),
                pattern_rank.get(p.pattern_id, 99),
                -p.score,
            )
        )

        # Build module metrics output
        module_metrics_out: Dict[str, Dict[str, Any]] = {}
        for m in internal_modules:
            i = mod_id[m]
            module_metrics_out[m] = {
                "fan_in": fan_in[i],
                "fan_out": fan_out[i],
                "instability": instability[i],
                "loc": module_facts[m].loc,
                "file": module_facts[m].file,
            }

        # Flatten function metrics
        all_fn_metrics: List[FunctionMetrics] = []
        for facts in module_facts.values():
            all_fn_metrics.extend(facts.function_metrics)

        # Graph edges output
        module_edges_out: List[Dict[str, Any]] = []
        for (u, v, f, ln) in edges_with_locs:
            module_edges_out.append(
                {
                    "from": id_mod[u],
                    "to": id_mod[v],
                    "file": f,
                    "lineno": ln,
                }
            )

        # JSON report
        report = {
            "project": {
                "zip_path": str(zip_path),
                "zip_size_bytes": extract_meta["zip_size_bytes"],
                "files_analyzed": len(file_records),
                "python_files_found": len(py_files),
                "parse_error_count": len(parse_errors),
                "parse_errors": parse_errors,
                "excluded_dir_names": sorted(EXCLUDED_DIR_NAMES),
                "analysis_mode": "strict",
                "python_version_target": "3.10",
                "elapsed_seconds": round(time.time() - t0, 3),
                "centrality_mode": bc_mode,
                "module_count": n_mods,
                "module_edge_count": len(module_edges_out),
            },
            "modules": module_metrics_out,
            "functions": [
                dataclasses.asdict(fm)
                for fm in sorted(all_fn_metrics, key=lambda x: (x.cyclomatic, x.max_nesting), reverse=True)
            ],
            "patterns": [
                {
                    "pattern_id": p.pattern_id,
                    "score": p.score,
                    "severity": p.severity,
                    "summary": p.summary,
                    "evidence": [dataclasses.asdict(e) for e in p.evidence],
                    "impacted_modules": p.impacted_modules,
                    "impacted_symbols": p.impacted_symbols,
                }
                for p in patterns
            ],
            "graphs": {
                "module_edges": module_edges_out,
            },
        }

        report_json_path = out_dir / "report.json"
        report_md_path = out_dir / "report.md"

        report_json_path.write_text(json.dumps(report, indent=2, sort_keys=False), encoding="utf-8")

        md = build_markdown_report(
            project_meta=report["project"],
            patterns=patterns,
            module_metrics=module_metrics_out,
            function_metrics=all_fn_metrics,
        )
        report_md_path.write_text(md, encoding="utf-8")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
\`\`\`

This is a single-file CLI. Run:

\`\`\`bash
python3 py_struct_patterns.py path/to/project.zip --out-dir out
\`\`\`

Outputs: \`out/report.json\` and \`out/report.md\`.`;

export const IMAGINE_OPUS_CODE = `import React, { useState, useCallback, useMemo } from "react";

// ── Tokenizer ──────────────────────────────────────────────────────────────
// Lightweight, language-agnostic lexer. Good enough for structural analysis
// across C-family languages (JS/TS/Java/C#/C++/Go/Rust/Python-ish).
function tokenize(src) {
  const lines = src.split("\\n");
  return lines.map((raw, i) => {
    const line = raw.replace(/\\t/g, "  ");
    const indent = line.length - line.trimStart().length;
    const trimmed = line.trim();
    return { n: i + 1, raw, trimmed, indent, len: trimmed.length };
  });
}

// ── Pattern rules ─────────────────────────────────────────────────────────
// Each rule scans tokenized lines and emits findings: { line, severity, msg }.
const RULES = [
  {
    id: "deep-nesting",
    label: "Deep nesting",
    desc: "Blocks indented past 5 levels — usually a sign logic should be extracted.",
    run(tokens) {
      const out = [];
      const unit = inferIndentUnit(tokens);
      for (const t of tokens) {
        if (!t.trimmed) continue;
        const level = Math.round(t.indent / unit);
        if (level >= 5) out.push({ line: t.n, severity: "warn", msg: \`Nesting level \${level}\` });
      }
      return collapseRuns(out);
    },
  },
  {
    id: "long-function",
    label: "Long functions",
    desc: "Brace-delimited or def blocks exceeding 50 lines.",
    run(tokens) {
      const out = [];
      const fnRe = /\\b(function|def|fn|func)\\b|=>\\s*\\{|\\)\\s*\\{$/;
      let open = null, depth = 0;
      for (const t of tokens) {
        if (open === null && fnRe.test(t.trimmed)) { open = t.n; depth = countBraces(t.trimmed); continue; }
        if (open !== null) {
          depth += countBraces(t.trimmed);
          if (depth <= 0 && /\\}/.test(t.trimmed)) {
            const span = t.n - open;
            if (span > 50) out.push({ line: open, severity: "warn", msg: \`Function spans \${span} lines\` });
            open = null;
          }
        }
      }
      return out;
    },
  },
  {
    id: "dup-blocks",
    label: "Duplicate blocks",
    desc: "Runs of 4+ consecutive identical lines repeated elsewhere.",
    run(tokens) {
      const out = [];
      const windowSize = 4;
      const seen = new Map();
      for (let i = 0; i + windowSize <= tokens.length; i++) {
        const slice = tokens.slice(i, i + windowSize).map((t) => t.trimmed).filter(Boolean);
        if (slice.length < windowSize) continue;
        const key = slice.join("\\u0001");
        if (seen.has(key)) {
          out.push({ line: tokens[i].n, severity: "info", msg: \`Mirrors block at line \${seen.get(key)}\` });
        } else seen.set(key, tokens[i].n);
      }
      return collapseRuns(out);
    },
  },
  {
    id: "long-params",
    label: "Long parameter lists",
    desc: "Signatures with 5+ comma-separated parameters.",
    run(tokens) {
      const out = [];
      const sigRe = /\\((.*)\\)/;
      const declRe = /\\b(function|def|fn|func)\\b|=>\\s*$|\\)\\s*\\{?$/;
      for (const t of tokens) {
        if (!declRe.test(t.trimmed)) continue;
        const m = t.trimmed.match(sigRe);
        if (!m) continue;
        const params = m[1].split(",").map((s) => s.trim()).filter(Boolean);
        if (params.length >= 5) out.push({ line: t.n, severity: "info", msg: \`\${params.length} parameters\` });
      }
      return out;
    },
  },
  {
    id: "magic-numbers",
    label: "Magic numbers",
    desc: "Bare numeric literals (≥ 2 digits, not 0/1/100) outside declarations.",
    run(tokens) {
      const out = [];
      for (const t of tokens) {
        if (/\\b(const|let|var|enum|#define|static)\\b/.test(t.trimmed)) continue;
        const nums = t.trimmed.match(/(?<![\\w.])\\d{2,}(?![\\w.])/g) || [];
        const flagged = nums.filter((n) => !["100", "1000", "10", "12", "24", "60"].includes(n));
        if (flagged.length) out.push({ line: t.n, severity: "info", msg: \`Literal(s): \${flagged.join(", ")}\` });
      }
      return out;
    },
  },
  {
    id: "long-line",
    label: "Long lines",
    desc: "Lines exceeding 120 characters.",
    run(tokens) {
      return tokens.filter((t) => t.raw.length > 120).map((t) => ({ line: t.n, severity: "info", msg: \`\${t.raw.length} chars\` }));
    },
  },
];

function inferIndentUnit(tokens) {
  const indents = tokens.map((t) => t.indent).filter((x) => x > 0);
  if (!indents.length) return 2;
  return Math.min(...indents) || 2;
}
function countBraces(s) {
  return (s.match(/\\{/g) || []).length - (s.match(/\\}/g) || []).length;
}
function collapseRuns(findings) {
  const out = [];
  let last = -10;
  for (const f of findings.sort((a, b) => a.line - b.line)) {
    if (f.line - last > 2) out.push(f);
    last = f.line;
  }
  return out;
}

function analyze(src) {
  const tokens = tokenize(src);
  return RULES.map((r) => ({ rule: r, findings: r.run(tokens) }));
}

const SEV = {
  warn: { bg: "var(--sev-warn-bg)", fg: "var(--sev-warn-fg)" },
  info: { bg: "var(--sev-info-bg)", fg: "var(--sev-info-fg)" },
};

export default function PatternDetector() {
  const [src, setSrc] = useState("");
  const [name, setName] = useState("");
  const results = useMemo(() => (src ? analyze(src) : []), [src]);
  const total = results.reduce((a, r) => a + r.findings.length, 0);

  const onFile = useCallback((file) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => { setSrc(String(e.target.result)); setName(file.name); };
    reader.readAsText(file);
  }, []);

  const onDrop = useCallback((e) => { e.preventDefault(); onFile(e.dataTransfer.files?.[0]); }, [onFile]);

  return (
    <div style={S.shell}>
      <style>{CSS}</style>
      <header style={S.head}>
        <div style={S.mark}>◷</div>
        <div>
          <h1 style={S.title}>Structure Scope</h1>
          <p style={S.sub}>Drop in code. Get the shapes it's hiding.</p>
        </div>
      </header>

      <div
        style={S.drop}
        onDragOver={(e) => e.preventDefault()}
        onDrop={onDrop}
        onClick={() => document.getElementById("fpick").click()}
      >
        <input id="fpick" type="file" hidden onChange={(e) => onFile(e.target.files?.[0])} />
        {name ? (
          <span><strong>{name}</strong> · {src.split("\\n").length} lines · click to replace</span>
        ) : (
          <span>Drop a source file here, or click to browse</span>
        )}
      </div>

      <textarea
        style={S.editor}
        value={src}
        placeholder="…or paste code directly"
        onChange={(e) => { setSrc(e.target.value); if (!name) setName("pasted snippet"); }}
        spellCheck={false}
      />

      {src && (
        <div style={S.summary}>
          <span style={S.count}>{total}</span> structural signal{total === 1 ? "" : "s"} across {results.filter(r => r.findings.length).length} pattern{results.filter(r => r.findings.length).length === 1 ? "" : "s"}
        </div>
      )}

      <div style={S.grid}>
        {results.map(({ rule, findings }) => (
          <div key={rule.id} style={{ ...S.card, opacity: findings.length ? 1 : 0.5 }}>
            <div style={S.cardHead}>
              <h3 style={S.cardTitle}>{rule.label}</h3>
              <span style={S.badge}>{findings.length}</span>
            </div>
            <p style={S.cardDesc}>{rule.desc}</p>
            {findings.length > 0 && (
              <ul style={S.findings}>
                {findings.slice(0, 8).map((f, i) => (
                  <li key={i} style={S.finding}>
                    <span style={{ ...S.dot, background: SEV[f.severity].bg, color: SEV[f.severity].fg }}>L{f.line}</span>
                    <span>{f.msg}</span>
                  </li>
                ))}
                {findings.length > 8 && <li style={S.more}>+{findings.length - 8} more</li>}
              </ul>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

const CSS = \`
:root{
  --bg:#0f1117; --panel:#171a22; --line:#262b36; --ink:#e6e9ef; --mut:#7c8499;
  --accent:#5ee0c0; --accent-dim:#2a4d45;
  --sev-warn-bg:#3a2a14; --sev-warn-fg:#f0b56b;
  --sev-info-bg:#1c2937; --sev-info-fg:#6fb0e8;
}
*{box-sizing:border-box}
textarea:focus,div[tabindex]:focus{outline:2px solid var(--accent)}
@media (prefers-reduced-motion: no-preference){.card{transition:opacity .2s}}
\`;

const mono = "'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, monospace";
const S = {
  shell: { background: "var(--bg)", color: "var(--ink)", fontFamily: "ui-sans-serif, system-ui, sans-serif", minHeight: "100vh", padding: "32px", maxWidth: 1100, margin: "0 auto" },
  head: { display: "flex", gap: 16, alignItems: "center", marginBottom: 28 },
  mark: { fontSize: 34, color: "var(--accent)", lineHeight: 1 },
  title: { margin: 0, fontSize: 26, fontWeight: 700, letterSpacing: "-0.02em" },
  sub: { margin: "2px 0 0", color: "var(--mut)", fontSize: 14 },
  drop: { border: "1.5px dashed var(--line)", borderRadius: 12, padding: "22px", textAlign: "center", color: "var(--mut)", cursor: "pointer", marginBottom: 14, fontSize: 14 },
  editor: { width: "100%", minHeight: 180, background: "var(--panel)", color: "var(--ink)", border: "1px solid var(--line)", borderRadius: 12, padding: 16, fontFamily: mono, fontSize: 13, lineHeight: 1.6, resize: "vertical" },
  summary: { margin: "20px 0 8px", color: "var(--mut)", fontSize: 14 },
  count: { color: "var(--accent)", fontWeight: 700, fontSize: 18 },
  grid: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 14, marginTop: 8 },
  card: { background: "var(--panel)", border: "1px solid var(--line)", borderRadius: 12, padding: 16 },
  cardHead: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 },
  cardTitle: { margin: 0, fontSize: 15, fontWeight: 600 },
  badge: { background: "var(--accent-dim)", color: "var(--accent)", borderRadius: 20, padding: "1px 9px", fontSize: 12, fontWeight: 700, fontFamily: mono },
  cardDesc: { margin: "0 0 10px", color: "var(--mut)", fontSize: 12.5, lineHeight: 1.5 },
  findings: { listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 6 },
  finding: { display: "flex", gap: 8, alignItems: "center", fontSize: 12.5, fontFamily: mono },
  dot: { borderRadius: 5, padding: "1px 6px", fontSize: 11, fontWeight: 700, minWidth: 38, textAlign: "center" },
  more: { color: "var(--mut)", fontSize: 12, fontStyle: "italic" },
};`;
