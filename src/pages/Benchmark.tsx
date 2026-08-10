import { useEffect } from "react";
import { Link } from "react-router-dom";
import Header from "@/components/Header";
import SiteFooter from "@/components/SiteFooter";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from "recharts";
import { IMAGINE_AUREON_CODE, IMAGINE_OPUS_CODE } from "./benchmarkImagineCode";

const PROMPT = "Implement a thread-safe LRU cache with O(1) get and put.";

const IMAGINE_PROMPT = "Create me an algorithm for spotting structural patterns in code I upload to it.";

const IMAGINE_SCORES = [
  { metric: "Analysis correctness",  aureon: 9, opus: 4 },
  { metric: "Structural depth",      aureon: 9, opus: 3 },
  { metric: "Pattern variety",       aureon: 8, opus: 5 },
  { metric: "Robustness & safety",   aureon: 8, opus: 3 },
  { metric: "Scalability",           aureon: 7, opus: 4 },
  { metric: "Output rigor",          aureon: 9, opus: 5 },
  { metric: "Language coverage",     aureon: 3, opus: 7 },
  { metric: "Accessibility & setup", aureon: 4, opus: 9 },
];

const IMAGINE_BUGS = [
  { metric: "Real correctness bugs",     aureon: 0, opus: 2 },
  { metric: "Silent-failure paths",      aureon: 0, opus: 3 },
  { metric: "Missing edge-case handling", aureon: 1, opus: 4 },
];

const SCORES_SHORT = [
  { metric: "Correctness", aureon: 6, opus: 6, gpt: 4 },
  { metric: "Concurrency", aureon: 6, opus: 4, gpt: 4 },
  { metric: "API completeness", aureon: 6, opus: 4, gpt: 3 },
  { metric: "Code craft", aureon: 5, opus: 6, gpt: 4 },
  { metric: "Memory hygiene", aureon: 6, opus: 4, gpt: 2 },
];

const SCORES_FULL = [
  { metric: "Functional correctness ✓", aureon: 6, opus: 6, gpt: 4 },
  { metric: "Eviction semantics ✓", aureon: 6, opus: 6, gpt: 6 },
  { metric: "Concurrency safety ✓", aureon: 6, opus: 5, gpt: 5 },
  { metric: "Performance under load ✓", aureon: 4, opus: 4, gpt: 4 },
  { metric: "API completeness", aureon: 6, opus: 4, gpt: 2 },
  { metric: "Code craft", aureon: 5, opus: 6, gpt: 4 },
  { metric: "Memory hygiene", aureon: 6, opus: 5, gpt: 3 },
  { metric: "Error handling", aureon: 5, opus: 5, gpt: 3 },
  { metric: "Robustness / edge cases", aureon: 6, opus: 5, gpt: 3 },
  { metric: "Documentation", aureon: 6, opus: 4, gpt: 1 },
];

const AUREON_CODE = `import java.util.HashMap;
import java.util.Map;
import java.util.concurrent.locks.ReentrantLock;

/**
 * Thread-safe LRU Cache with O(1) get/put.
 *
 * Design:
 * - HashMap<K, Node<K,V>> for O(1) lookup
 * - Doubly-linked list for O(1) recency updates and eviction
 * - Single lock to make get/put atomic and keep list+map consistent
 */
public final class LRUCache<K, V> {
    private final int capacity;
    private final Map<K, Node<K, V>> index;
    private final Node<K, V> head; // MRU sentinel
    private final Node<K, V> tail; // LRU sentinel
    private final ReentrantLock lock = new ReentrantLock();

    private static final class Node<K, V> {
        K key;
        V value;
        Node<K, V> prev;
        Node<K, V> next;
        Node() {}
        Node(K key, V value) { this.key = key; this.value = value; }
    }

    public LRUCache(int capacity) {
        if (capacity <= 0) throw new IllegalArgumentException("capacity must be > 0");
        this.capacity = capacity;
        this.index = new HashMap<>(Math.max(16, capacity * 2));
        this.head = new Node<>();
        this.tail = new Node<>();
        head.next = tail;
        tail.prev = head;
    }

    public int capacity() { return capacity; }

    public int size() {
        lock.lock();
        try { return index.size(); } finally { lock.unlock(); }
    }

    public V get(K key) {
        if (key == null) throw new NullPointerException("key");
        lock.lock();
        try {
            Node<K, V> n = index.get(key);
            if (n == null) return null;
            moveToFront(n);
            return n.value;
        } finally { lock.unlock(); }
    }

    public void put(K key, V value) {
        if (key == null) throw new NullPointerException("key");
        lock.lock();
        try {
            Node<K, V> existing = index.get(key);
            if (existing != null) {
                existing.value = value;
                moveToFront(existing);
                return;
            }
            Node<K, V> n = new Node<>(key, value);
            index.put(key, n);
            addToFront(n);
            if (index.size() > capacity) {
                Node<K, V> lru = removeLRU();
                if (lru != null) {
                    index.remove(lru.key);
                    lru.key = null; lru.value = null;
                    lru.prev = null; lru.next = null;
                }
            }
        } finally { lock.unlock(); }
    }

    public V remove(K key) {
        if (key == null) throw new NullPointerException("key");
        lock.lock();
        try {
            Node<K, V> n = index.remove(key);
            if (n == null) return null;
            unlink(n);
            V val = n.value;
            n.key = null; n.value = null;
            n.prev = null; n.next = null;
            return val;
        } finally { lock.unlock(); }
    }

    public void clear() {
        lock.lock();
        try {
            index.clear();
            head.next = tail;
            tail.prev = head;
        } finally { lock.unlock(); }
    }

    private void moveToFront(Node<K, V> n) { unlink(n); addToFront(n); }

    private void addToFront(Node<K, V> n) {
        Node<K, V> first = head.next;
        n.prev = head; n.next = first;
        head.next = n; first.prev = n;
    }

    private void unlink(Node<K, V> n) {
        Node<K, V> p = n.prev;
        Node<K, V> nx = n.next;
        if (p != null) p.next = nx;
        if (nx != null) nx.prev = p;
        n.prev = null; n.next = null;
    }

    private Node<K, V> removeLRU() {
        Node<K, V> lru = tail.prev;
        if (lru == head) return null;
        unlink(lru);
        return lru;
    }
}`;

const OPUS_CODE = `import threading
from typing import Optional, Hashable, Any

class Node:
    __slots__ = ("key", "value", "prev", "next")
    def __init__(self, key=None, value=None):
        self.key = key
        self.value = value
        self.prev: Optional["Node"] = None
        self.next: Optional["Node"] = None

class LRUCache:
    def __init__(self, capacity: int):
        if capacity <= 0:
            raise ValueError("capacity must be positive")
        self.capacity = capacity
        self._map: dict[Hashable, Node] = {}
        self._lock = threading.RLock()
        self._head = Node()
        self._tail = Node()
        self._head.next = self._tail
        self._tail.prev = self._head

    def _remove(self, node: Node) -> None:
        node.prev.next = node.next
        node.next.prev = node.prev

    def _add_front(self, node: Node) -> None:
        node.prev = self._head
        node.next = self._head.next
        self._head.next.prev = node
        self._head.next = node

    def get(self, key: Hashable) -> Optional[Any]:
        with self._lock:
            node = self._map.get(key)
            if node is None:
                return None
            self._remove(node)
            self._add_front(node)
            return node.value

    def put(self, key: Hashable, value: Any) -> None:
        with self._lock:
            node = self._map.get(key)
            if node is not None:
                node.value = value
                self._remove(node)
                self._add_front(node)
                return
            if len(self._map) >= self.capacity:
                lru = self._tail.prev
                self._remove(lru)
                del self._map[lru.key]
            node = Node(key, value)
            self._map[key] = node
            self._add_front(node)

    def __len__(self) -> int:
        with self._lock:
            return len(self._map)

    def __contains__(self, key: Hashable) -> bool:
        with self._lock:
            return key in self._map`;

const GPT_CODE = `import threading

class Node:
    def __init__(self, key=None, value=None):
        self.key = key
        self.value = value
        self.prev = None
        self.next = None

class LRUCache:
    def __init__(self, capacity: int):
        if capacity <= 0:
            raise ValueError("capacity must be positive")
        self.capacity = capacity
        self.cache = {}
        self.lock = threading.RLock()
        self.head = Node()
        self.tail = Node()
        self.head.next = self.tail
        self.tail.prev = self.head

    def get(self, key):
        with self.lock:
            if key not in self.cache:
                return -1
            node = self.cache[key]
            self._remove(node)
            self._add_to_front(node)
            return node.value

    def put(self, key, value):
        with self.lock:
            if key in self.cache:
                node = self.cache[key]
                node.value = value
                self._remove(node)
                self._add_to_front(node)
                return
            node = Node(key, value)
            self.cache[key] = node
            self._add_to_front(node)
            if len(self.cache) > self.capacity:
                lru = self.tail.prev
                self._remove(lru)
                del self.cache[lru.key]

    def _remove(self, node):
        prev_node = node.prev
        next_node = node.next
        prev_node.next = next_node
        next_node.prev = prev_node

    def _add_to_front(self, node):
        first = self.head.next
        node.prev = self.head
        node.next = first
        self.head.next = node
        first.prev = node`;

type Rank = "Winner" | "2nd" | "3rd";

const Podium = ({ rank, name, lang, score, total, highlight }: {
  rank: Rank; name: string; lang: string; score: number; total: number; highlight?: boolean;
}) => (
  <div className={`rounded-2xl border p-5 backdrop-blur-sm transition-all ${
    highlight
      ? "border-foreground/40 bg-foreground/[0.04] shadow-[0_0_40px_-15px_hsl(var(--foreground)/0.3)]"
      : "border-border/30 bg-card/20"
  }`}>
    <div className={`inline-block px-2.5 py-1 rounded-full text-[10px] font-light tracking-wider mb-3 ${
      rank === "Winner"
        ? "bg-foreground/15 text-foreground"
        : "bg-muted/30 text-muted-foreground"
    }`}>
      {rank}
    </div>
    <div className="text-sm font-light text-muted-foreground">{name}</div>
    <div className="text-xs font-extralight text-muted-foreground/70 mb-2">{lang}</div>
    <div className="text-4xl font-extralight text-foreground tracking-tight">
      {score}<span className="text-lg text-muted-foreground/60">/{total}</span>
    </div>
  </div>
);

const CodeBlock = ({ title, lang, code, accent, subtitle }: {
  title: string; lang: string; code: string; accent: string; subtitle?: string;
}) => (
  <div className="rounded-2xl border border-border/30 bg-card/20 backdrop-blur-sm overflow-hidden flex flex-col">
    <div className="flex items-center justify-between px-4 py-3 border-b border-border/30 bg-background/40 gap-3">
      <div className="flex items-center gap-2 min-w-0">
        <div className="h-2 w-2 rounded-full shrink-0" style={{ background: accent }} />
        <h3 className="text-sm font-light text-foreground truncate">{title}</h3>
      </div>
      <span className="text-[10px] font-extralight tracking-wider text-muted-foreground uppercase shrink-0">{lang}</span>
    </div>
    {subtitle && (
      <div className="px-4 py-2 border-b border-border/30 bg-background/20">
        <span className="text-[10px] font-light tracking-[0.18em] uppercase" style={{ color: accent }}>
          {subtitle}
        </span>
      </div>
    )}
    <pre className="text-[11px] leading-relaxed font-mono text-foreground/85 p-4 overflow-auto max-h-[480px]">
      <code>{code}</code>
    </pre>
  </div>
);

const TOOLTIP_STYLE = {
  background: "hsl(var(--background) / 0.95)",
  border: "1px solid hsl(var(--border))",
  borderRadius: "8px",
  fontSize: "12px",
  fontWeight: 300,
} as const;

const Benchmark = () => {
  // Head is centrally managed in <RouteSeo /> (entry for /benchmark).
  // Inject TechArticle JSON-LD so Google can surface this as a technical article.
  useEffect(() => {
    const id = "benchmark-techarticle-jsonld";
    let el = document.getElementById(id) as HTMLScriptElement | null;
    if (!el) {
      el = document.createElement("script");
      el.id = id;
      el.type = "application/ld+json";
      document.head.appendChild(el);
    }
    el.textContent = JSON.stringify({
      "@context": "https://schema.org",
      "@type": "TechArticle",
      headline: "Asherin vs Opus 4.8 vs GPT-5.5 — Thread-Safe LRU Cache Benchmark",
      description:
        "Same prompt, three models, scored head-to-head on a thread-safe LRU cache with O(1) get and put.",
      url: "https://asherin.com/benchmark",
      author: { "@type": "Organization", name: "Asherin" },
      publisher: {
        "@type": "Organization",
        name: "Asherin",
        logo: { "@type": "ImageObject", url: "https://asherin.com/favicon.png" },
      },
      proficiencyLevel: "Expert",
      about: "Concurrent data structure implementation benchmark across frontier LLMs",
    });
    return () => {
      document.getElementById(id)?.remove();
    };
  }, []);



  return (
    <div className="landing-perf min-h-screen bg-background text-foreground">
      <Header />

      <main className="max-w-6xl mx-auto px-4 sm:px-6 pt-28 pb-24 space-y-20">
        {/* HERO */}
        <section className="space-y-4 text-center">
          <div className="inline-block px-3 py-1 rounded-full border border-border/40 text-[10px] font-light tracking-[0.25em] uppercase text-muted-foreground">
            ◈ Benchmark
          </div>
          <h1 className="text-4xl sm:text-5xl font-extralight tracking-tight">
            Asherin vs Opus 4.8 vs GPT-5.5
          </h1>
          <p className="max-w-2xl mx-auto text-sm sm:text-base font-extralight text-muted-foreground leading-relaxed">
            Same prompt. Three models. One scored head-to-head on a thread-safe LRU cache —
            the kind of task that exposes whether a model actually understands concurrency
            and data-structure design, or just guesses convincingly.
          </p>
        </section>

        {/* SECTION 1: CODING BENCHMARK */}
        <section className="space-y-8">
          <div className="rounded-2xl border border-border/30 bg-card/20 backdrop-blur-sm p-5">
            <h2 className="text-[10px] font-medium tracking-[0.25em] uppercase text-muted-foreground mb-2">
              ◉ Prompt given to all three
            </h2>
            <p className="text-base sm:text-lg font-light text-foreground">
              "{PROMPT}"
            </p>
            <p className="text-xs font-extralight text-muted-foreground/80 mt-2">
              Tests concurrency + data structure design.
            </p>
          </div>

          {/* Podium short scores */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Podium rank="Winner" name="Asherin" lang="Java" score={27} total={30} highlight />
            <Podium rank="2nd" name="Opus 4.8" lang="Python" score={24} total={30} />
            <Podium rank="3rd" name="GPT-5.5" lang="Python" score={17} total={30} />
          </div>

          {/* Short-rubric chart */}
          <div className="rounded-2xl border border-border/30 bg-card/20 backdrop-blur-sm p-5">
            <h2 className="text-[10px] font-medium tracking-[0.25em] uppercase text-muted-foreground mb-4">
              ◈ 5-dimension scoring
            </h2>
            <div className="h-[320px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={SCORES_SHORT}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border) / 0.3)" />
                  <XAxis dataKey="metric" tick={{ fontSize: 11, fontWeight: 300, fill: "hsl(var(--muted-foreground))" }} />
                  <YAxis tick={{ fontSize: 11, fontWeight: 300, fill: "hsl(var(--muted-foreground))" }} domain={[0, 6]} />
                  <Tooltip contentStyle={TOOLTIP_STYLE} />
                  <Legend wrapperStyle={{ fontSize: 11, fontWeight: 300 }} />
                  <Bar dataKey="aureon" name="Asherin (Java)" fill="#b8860b" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="opus"   name="Opus 4.8 (Python)" fill="#facc15" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="gpt"    name="GPT-5.5 (Python)" fill="#ffffff" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Code outputs */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <CodeBlock title="Asherin" lang="Java"   code={AUREON_CODE} accent="#b8860b" subtitle="Asherin · refined output" />
            <CodeBlock title="Opus 4.8" lang="Python" code={OPUS_CODE} accent="#facc15" />
            <CodeBlock title="GPT-5.5"  lang="Python" code={GPT_CODE}  accent="#ffffff" />
          </div>

          {/* Expanded rubric */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Podium rank="Winner" name="Asherin · Java" lang="Verified by execution" score={50} total={60} highlight />
            <Podium rank="2nd" name="Opus 4.8 · Python" lang="Verified by execution" score={47} total={60} />
            <Podium rank="3rd" name="GPT-5.5 · Python" lang="Verified by execution" score={33} total={60} />
          </div>

          <div className="rounded-2xl border border-border/30 bg-card/20 backdrop-blur-sm p-5">
            <h2 className="text-[10px] font-medium tracking-[0.25em] uppercase text-muted-foreground mb-4">
              ◈ 10-dimension scoring · ✓ = verified by execution
            </h2>
            <div className="h-[460px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={SCORES_FULL} layout="vertical" margin={{ left: 40 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border) / 0.3)" />
                  <XAxis type="number" domain={[0, 6]} tick={{ fontSize: 11, fontWeight: 300, fill: "hsl(var(--muted-foreground))" }} />
                  <YAxis type="category" dataKey="metric" width={170} tick={{ fontSize: 11, fontWeight: 300, fill: "hsl(var(--muted-foreground))" }} />
                  <Tooltip contentStyle={TOOLTIP_STYLE} />
                  <Legend wrapperStyle={{ fontSize: 11, fontWeight: 300 }} />
                  <Bar dataKey="aureon" name="Asherin (Java)" fill="#b8860b" radius={[0, 3, 3, 0]} />
                  <Bar dataKey="opus"   name="Opus 4.8 (Python)" fill="#facc15" radius={[0, 3, 3, 0]} />
                  <Bar dataKey="gpt"    name="GPT-5.5 (Python)" fill="#ffffff" radius={[0, 3, 3, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Security + bug winners */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="rounded-2xl border border-border/30 bg-card/20 backdrop-blur-sm p-5">
              <p className="text-[10px] font-medium tracking-[0.25em] uppercase text-muted-foreground mb-2">Security winner</p>
              <p className="text-2xl font-extralight text-foreground">Asherin</p>
              <p className="text-[11px] font-light text-muted-foreground mt-1">by a hair · clears evicted data</p>
            </div>
            <div className="rounded-2xl border border-border/30 bg-card/20 backdrop-blur-sm p-5">
              <p className="text-[10px] font-medium tracking-[0.25em] uppercase text-muted-foreground mb-2">Fewest bugs winner</p>
              <div className="flex items-baseline gap-2">
                <p className="text-5xl font-extralight text-foreground">0</p>
                <p className="text-xs font-light text-muted-foreground">bugs</p>
              </div>
              <p className="text-[11px] font-light text-muted-foreground mt-1">Opus 4.8 · 0 real · 0 silent · 0 dead code</p>
            </div>
          </div>

          <div className="rounded-2xl border border-border/30 bg-card/20 backdrop-blur-sm p-5 space-y-6">
            <h2 className="text-[10px] font-medium tracking-[0.25em] uppercase text-muted-foreground">
              ◈ Security & bug cleanliness · higher is better
            </h2>
            <div className="h-[260px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={[
                    { metric: "Security",       aureon: 5, opus: 4, gpt: 4 },
                    { metric: "Bug cleanliness", aureon: 5, opus: 6, gpt: 3 },
                  ]}
                  margin={{ top: 10, right: 20, left: 0, bottom: 10 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border) / 0.3)" />
                  <XAxis dataKey="metric" tick={{ fontSize: 11, fontWeight: 300, fill: "hsl(var(--muted-foreground))" }} />
                  <YAxis domain={[0, 6]} tick={{ fontSize: 11, fontWeight: 300, fill: "hsl(var(--muted-foreground))" }} />
                  <Tooltip contentStyle={TOOLTIP_STYLE} />
                  <Legend wrapperStyle={{ fontSize: 11, fontWeight: 300 }} />
                  <Bar dataKey="aureon" name="Asherin (Java)"      fill="#b8860b" radius={[3, 3, 0, 0]} />
                  <Bar dataKey="opus"   name="Opus 4.8 (Python)"  fill="#facc15" radius={[3, 3, 0, 0]} />
                  <Bar dataKey="gpt"    name="GPT-5.5 (Python)"   fill="#ffffff" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <h2 className="text-[10px] font-medium tracking-[0.25em] uppercase text-muted-foreground pt-2">
              ◈ Raw bug & exposure counts · lower is better
            </h2>
            <div className="h-[220px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={[
                    { metric: "Real correctness bugs",   aureon: 0, opus: 0, gpt: 1 },
                    { metric: "Latent dead code",         aureon: 1, opus: 0, gpt: 0 },
                    { metric: "Uncleared sensitive data", aureon: 0, opus: 1, gpt: 1 },
                  ]}
                  margin={{ top: 10, right: 20, left: 0, bottom: 10 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border) / 0.3)" />
                  <XAxis dataKey="metric" tick={{ fontSize: 10, fontWeight: 300, fill: "hsl(var(--muted-foreground))" }} />
                  <YAxis domain={[0, 2]} allowDecimals={false} tick={{ fontSize: 11, fontWeight: 300, fill: "hsl(var(--muted-foreground))" }} />
                  <Tooltip contentStyle={TOOLTIP_STYLE} />
                  <Legend wrapperStyle={{ fontSize: 11, fontWeight: 300 }} />
                  <Bar dataKey="aureon" name="Asherin (Java)"      fill="#b8860b" radius={[3, 3, 0, 0]} />
                  <Bar dataKey="opus"   name="Opus 4.8 (Python)"  fill="#facc15" radius={[3, 3, 0, 0]} />
                  <Bar dataKey="gpt"    name="GPT-5.5 (Python)"   fill="#ffffff" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <p className="text-sm font-extralight leading-relaxed text-muted-foreground/90">
              The two charts tell the split story: the top one is the scored verdict (higher = better),
              the bottom one is the raw evidence (lower = better). Asherin edges Opus 4.8 on security
              by explicitly wiping evicted entries from memory, while Opus 4.8 ships with zero
              verified bugs and no dead code. GPT-5.5 leaks sensitive references and ships a real
              correctness bug — the cost of running a raw base model with no grooming protocol.
            </p>
          </div>


          {/* Method explanation */}
          <div className="rounded-2xl border border-border/30 bg-card/20 backdrop-blur-sm p-6 space-y-4">
            <h2 className="text-[10px] font-medium tracking-[0.25em] uppercase text-muted-foreground">
              ◉ How Asherin wins on a cheaper base model
            </h2>
            <h2 className="text-2xl font-extralight tracking-tight text-foreground">
              We don't train a bigger brain. We groom a cheaper one — harder.
            </h2>
            <div className="space-y-3 text-sm font-extralight leading-relaxed text-muted-foreground/90">
              <p>
                Asherin runs on <span className="text-foreground">GPT-5.2</span> — a normal,
                cheap-to-run base model. The exact same family of model that, raw, scored
                17/30 on this benchmark as GPT-5.5.
              </p>
              <p>
                The difference isn't the brain. It's the <span className="text-foreground">grooming</span> —
                a multi-layer prompt protocol that forces the model into hidden chain-of-thought,
                self-critique loops, edge-case storms, and constitutional review before a single
                line of code is emitted.
              </p>
              <p>
                That protocol is built from <span className="text-foreground">#houseofasher</span> research
                and developer theories the rest of the industry doesn't touch — including the
                hiring thesis that people with no emotional attachment to their parents
                consistently out-reason average operators, because they default to first-principles
                instead of inherited consensus. We run those theories against our models and
                keep what survives.
              </p>
              <p>
                Result: a cheap base model groomed into something that beats Opus 4.8 and GPT-5.5
                on the same prompt, at a fraction of the inference cost.
              </p>
            </div>
            <div className="pt-2">
              <Link
                to="/founder"
                className="inline-block text-xs font-light tracking-wider uppercase text-foreground border-b border-foreground/40 hover:border-foreground transition-colors"
              >
                Read the founder thesis →
              </Link>
            </div>
          </div>
        </section>

        {/* SECTION 1.5: IMAGINE — STRUCTURAL PATTERN SPOTTER */}
        <section className="space-y-8">
          <div className="text-center space-y-3">
            <div className="inline-block px-3 py-1 rounded-full border border-border/40 text-[10px] font-light tracking-[0.25em] uppercase text-muted-foreground">
              ◈ Imagine benchmark · structural pattern spotter
            </div>
            <h2 className="text-3xl sm:text-4xl font-extralight tracking-tight">
              "Imagine" something harder than a textbook question.
            </h2>
            <p className="max-w-2xl mx-auto text-sm font-extralight text-muted-foreground leading-relaxed">
              Open-ended product prompt — no spec, no test harness, just a verb. We asked both
              models to <em>invent</em> the tool. What came back exposes how each one actually
              thinks about a real codebase.
            </p>
          </div>

          <div className="rounded-2xl border border-border/30 bg-card/20 backdrop-blur-sm p-5">
            <h2 className="text-[10px] font-medium tracking-[0.25em] uppercase text-muted-foreground mb-2">
              ◉ Prompt given to both
            </h2>
            <p className="text-base sm:text-lg font-light text-foreground">"{IMAGINE_PROMPT}"</p>
            <p className="text-xs font-extralight text-muted-foreground/80 mt-2">
              No constraints. No language. No scale. Pure imagination test.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Podium rank="Winner" name="Asherin · Python AST CLI" lang="Strict-mode whole-project analyzer" score={57} total={80} highlight />
            <Podium rank="2nd" name="Opus 4.8 · React heuristic tool" lang="Single-file in-browser linter" score={40} total={80} />
          </div>

          <div className="rounded-2xl border border-border/30 bg-card/20 backdrop-blur-sm p-5">
            <h2 className="text-[10px] font-medium tracking-[0.25em] uppercase text-muted-foreground mb-4">
              ◈ 8-dimension scoring · higher is better
            </h2>
            <div className="h-[420px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={IMAGINE_SCORES} layout="vertical" margin={{ left: 40 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border) / 0.3)" />
                  <XAxis type="number" domain={[0, 10]} tick={{ fontSize: 11, fontWeight: 300, fill: "hsl(var(--muted-foreground))" }} />
                  <YAxis type="category" dataKey="metric" width={170} tick={{ fontSize: 11, fontWeight: 300, fill: "hsl(var(--muted-foreground))" }} />
                  <Tooltip contentStyle={TOOLTIP_STYLE} />
                  <Legend wrapperStyle={{ fontSize: 11, fontWeight: 300 }} />
                  <Bar dataKey="aureon" name="Asherin (Python AST CLI)"  fill="#b8860b" radius={[0, 3, 3, 0]} />
                  <Bar dataKey="opus"   name="Opus 4.8 (React heuristic)" fill="#facc15" radius={[0, 3, 3, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="rounded-2xl border-2 border-foreground/40 bg-foreground/5 backdrop-blur-sm p-5">
              <p className="text-[10px] font-medium tracking-[0.25em] uppercase text-muted-foreground mb-2">Fewest bugs winner</p>
              <div className="flex items-baseline gap-2">
                <p className="text-5xl font-extralight text-foreground">1</p>
                <p className="text-xs font-light text-muted-foreground">total bug</p>
              </div>
              <p className="text-[11px] font-light text-muted-foreground mt-1">
                Asherin · 0 real · 0 silent · 1 edge-case missing
              </p>
            </div>
            <div className="rounded-2xl border border-border/30 bg-card/20 backdrop-blur-sm p-5">
              <p className="text-[10px] font-medium tracking-[0.25em] uppercase text-muted-foreground mb-2">Opus 4.8</p>
              <div className="flex items-baseline gap-2">
                <p className="text-5xl font-extralight text-foreground">9</p>
                <p className="text-xs font-light text-muted-foreground">total bugs</p>
              </div>
              <p className="text-[11px] font-light text-muted-foreground mt-1">
                2 real bugs · 3 silent failures · 4 edge-cases missed
              </p>
            </div>
          </div>

          <div className="rounded-2xl border border-border/30 bg-card/20 backdrop-blur-sm p-5">
            <h2 className="text-[10px] font-medium tracking-[0.25em] uppercase text-muted-foreground mb-4">
              ◈ Raw bug counts · lower is better
            </h2>
            <div className="h-[240px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={IMAGINE_BUGS} margin={{ top: 10, right: 20, left: 0, bottom: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border) / 0.3)" />
                  <XAxis dataKey="metric" tick={{ fontSize: 10, fontWeight: 300, fill: "hsl(var(--muted-foreground))" }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11, fontWeight: 300, fill: "hsl(var(--muted-foreground))" }} />
                  <Tooltip contentStyle={TOOLTIP_STYLE} />
                  <Legend wrapperStyle={{ fontSize: 11, fontWeight: 300 }} />
                  <Bar dataKey="aureon" name="Asherin (Python AST CLI)"   fill="#b8860b" radius={[3, 3, 0, 0]} />
                  <Bar dataKey="opus"   name="Opus 4.8 (React heuristic)" fill="#facc15" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="rounded-2xl border border-foreground/20 bg-foreground/5 backdrop-blur-sm p-5">
            <h2 className="text-[10px] font-medium tracking-[0.25em] uppercase text-muted-foreground mb-2">
              ◉ Same base model. Different operator.
            </h2>
            <p className="text-sm font-extralight leading-relaxed text-muted-foreground/90">
              The Asherin output below was produced by our internal refinement pipeline running
              on top of a <span className="text-foreground">GPT-5.2</span> base model — the same family of cheap, off-the-shelf model
              that scores in the mid-teens raw. The Opus 4.8 output is straight from Anthropic's flagship.
              Compare what the model says when nobody grooms it vs. when Asherin does.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <CodeBlock title="Asherin" lang="Python" code={IMAGINE_AUREON_CODE} accent="#b8860b" subtitle="Asherin · refined output" />
            <CodeBlock title="Opus 4.8" lang="React / JS" code={IMAGINE_OPUS_CODE} accent="#facc15" subtitle="Anthropic flagship · raw output" />
          </div>

          <div className="rounded-2xl border border-border/30 bg-card/20 backdrop-blur-sm p-6 space-y-3">
            <h2 className="text-[10px] font-medium tracking-[0.25em] uppercase text-muted-foreground">
              ◉ Read between the lines
            </h2>
            <p className="text-sm font-extralight leading-relaxed text-muted-foreground/90">
              Opus 4.8 built a slick in-browser linter — great for demos, useless on a real repo.
              Asherin shipped a strict-mode AST analyzer that ingests a whole project as a ZIP,
              refuses heuristic fallbacks when parsing fails, and demands ≥2 evidence anchors across
              ≥2 files before claiming a pattern. One is a toy. The other is an audit tool.
            </p>
          </div>
        </section>

        {/* SECTION 2: SECURITY BENCHMARK */}
        <section className="space-y-8">
          <div className="text-center space-y-3">
            <div className="inline-block px-3 py-1 rounded-full border border-border/40 text-[10px] font-light tracking-[0.25em] uppercase text-muted-foreground">
              ◈ Security benchmark · ZERLAL agent
            </div>
            <div className="inline-block px-3 py-1 rounded-full border border-border/40 text-[10px] font-light tracking-[0.25em] uppercase text-muted-foreground">
              ◈ Security benchmark · ZERLAL agent
            </div>
            <h2 className="text-3xl sm:text-4xl font-extralight tracking-tight">
              Same project. Same time. One AI found 20× more bugs.
            </h2>
            <p className="max-w-2xl mx-auto text-sm font-extralight text-muted-foreground leading-relaxed">
              We pointed three security AIs at the same real-world codebases and counted the
              issues each one actually found. Asherin's security agent — ZERLAL — wasn't close.
              It was in a different category.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="rounded-2xl border border-border/30 bg-card/20 backdrop-blur-sm p-6 text-center">
              <p className="text-[10px] font-medium tracking-[0.25em] uppercase text-muted-foreground mb-3">Opus 4.8</p>
              <div className="text-5xl font-extralight text-foreground">11</div>
              <p className="text-xs font-extralight text-muted-foreground mt-2">security bugs found</p>
            </div>
            <div className="rounded-2xl border border-border/30 bg-card/20 backdrop-blur-sm p-6 text-center">
              <p className="text-[10px] font-medium tracking-[0.25em] uppercase text-muted-foreground mb-3">Anthropic Fable 5</p>
              <div className="text-5xl font-extralight text-foreground">13</div>
              <p className="text-xs font-extralight text-muted-foreground mt-2">security bugs found</p>
            </div>
            <div className="rounded-2xl border-2 border-foreground/40 bg-foreground/5 backdrop-blur-sm p-6 text-center">
              <p className="text-[10px] font-medium tracking-[0.25em] uppercase text-foreground mb-3">Asherin · ZERLAL</p>
              <div className="text-5xl font-extralight text-foreground">200+</div>
              <p className="text-xs font-extralight text-muted-foreground mt-2">security flaws found in the same project</p>
            </div>
          </div>

          <div className="rounded-2xl border border-border/30 bg-card/20 backdrop-blur-sm p-6 space-y-5">
            <h2 className="text-[10px] font-medium tracking-[0.25em] uppercase text-muted-foreground">
              ◉ Case study · $ZEC (ZCASH) open-source blockchain
            </h2>
            <h3 className="text-2xl font-extralight tracking-tight text-foreground">
              Fable 5 found 1 bug. ZERLAL found 200+ — and we stopped it early.
            </h3>
            <div className="space-y-3 text-sm font-extralight leading-relaxed text-muted-foreground/90">
              <p>
                We ran both tools against the public ZCASH codebase. In 20 minutes, after
                scanning 20 of 530 files, Anthropic's Fable 5 surfaced{" "}
                <span className="text-foreground">1 security issue</span>.
              </p>
              <p>
                In 10 minutes, after scanning 28 of 530 files, ZERLAL surfaced{" "}
                <span className="text-foreground">over 200 security flaws</span> — and was still
                finding more when we stopped the run. We weren't trying to fully audit ZCASH;
                we were stress-testing our own software against a real, well-known target.
              </p>
              <p>
                ZCASH markets itself as a secure cryptocurrency. The findings below say
                otherwise — and most of them are the kind of bug that ships straight into
                end-user wallets.
              </p>
            </div>
          </div>

          <div className="rounded-2xl border border-border/30 bg-card/20 backdrop-blur-sm p-6 space-y-5">
            <h2 className="text-[10px] font-medium tracking-[0.25em] uppercase text-muted-foreground">
              ◈ What ZERLAL actually found in ZCASH (translated for humans)
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm font-extralight leading-relaxed">
              {[
                { t: "Wallet passwords open to the internet", b: "The default Docker setup exposes the wallet's remote-control port (RPC) to the entire internet, with the password set to \"notsecure\". Anyone who port-scans your IP can drain the wallet." },
                { t: "Passwords printed into logs", b: "On startup, the container prints your wallet password into the log. Every logging tool (CloudWatch, Grafana, ELK) then stores it permanently. Anyone with log access owns the node." },
                { t: "The security check is broken", b: "ZCASH ships a script that's supposed to verify each release is hardened before going out. It has a broken reference and silently crashes — so binaries ship without the checks, and nobody notices." },
                { t: "Wallet backdoor via swapped library", b: "An attacker who gets write access to the shared code-library folder can swap in a fake version with the same name and number. The next release ships that backdoor to every wallet user." },
                { t: "Build machine takeover", b: "The build scripts trust environment variables blindly. One compromised laptop or CI runner lets an attacker inject commands that run before a single line of ZCASH even compiles." },
                { t: "Pre-release crypto in production", b: "Core hashing libraries (sha2, ripemd) are still marked pre-release. In a blockchain, a tiny hash difference between nodes can split the network or quietly break zero-knowledge proofs." },
                { t: "Multiple versions of the same library", b: "Four versions of hashbrown and two of getrandom run in parallel. Patching one doesn't patch the others — fixing a known exploit can still leave you wide open through an older code path." },
                { t: "Monitoring with no password", b: "Grafana and Prometheus are exposed with no authentication. An attacker on the same network can fake healthy metrics, so dashboards stay green while the attack runs in silence." },
                { t: "Release builds pull live from GitHub", b: "The release signing setup fetches another project's GitHub repo during the build with no pinned version or signature. If that account is hijacked, the next ZCASH release ships malicious code automatically." },
                { t: "Linker / build-tool hijack", b: "Cross-compilation calls tools like the linker by name from PATH instead of an absolute path. Swap the binary, and the compiled artifact is compromised — no source change required." },
              ].map((x) => (
                <div key={x.t} className="rounded-xl border border-border/30 bg-background/30 p-4">
                  <p className="text-foreground font-light mb-1">◉ {x.t}</p>
                  <p className="text-xs text-muted-foreground/90">{x.b}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-border/30 bg-card/20 backdrop-blur-sm p-6 space-y-4">
            <h2 className="text-[10px] font-medium tracking-[0.25em] uppercase text-muted-foreground">
              ◈ The full attack chain — how small bugs become a global wipeout
            </h2>
            <ol className="space-y-2 text-sm font-extralight text-muted-foreground/90 leading-relaxed list-none">
              <li>◉ Attacker compromises a single developer machine through a shell-injection bug.</li>
              <li>◉ They swap one crypto library in the shared vendor folder for a malicious copy.</li>
              <li>◉ The broken security-check script fails silently — nothing is flagged.</li>
              <li>◉ The next official release ships the backdoor to every ZEC holder who updates.</li>
              <li>◉ The attacker activates it. Wallets on that release lose funds.</li>
            </ol>
            <p className="text-xs font-extralight text-muted-foreground/80 pt-2">
              One entry point. Global impact. "Open source" doesn't mean secure — it means the
              vulnerabilities are also open source.
            </p>
          </div>

          {/* INSIDER THREAT: How founders & devs can steal your ZCASH */}
          <div className="rounded-2xl border-2 border-foreground/30 bg-foreground/5 backdrop-blur-sm p-6 space-y-5">
            <h2 className="text-[10px] font-medium tracking-[0.25em] uppercase text-muted-foreground">
              ◉ Insider threat · how ZCASH founders & core developers could quietly steal your ZEC
            </h2>
            <h3 className="text-2xl font-extralight tracking-tight text-foreground">
              Forget outside hackers. The people who write the code have an easier door.
            </h3>
            <p className="text-sm font-extralight leading-relaxed text-muted-foreground/90">
              Every flaw ZERLAL found above is also an internal abuse path. A core developer, founder,
              or anyone with commit access to ZCASH doesn't need to "hack" anything — they already
              hold the keys to the build pipeline, the release signing setup, and the binaries that
              end up on your machine. Here is how a malicious insider would actually do it,
              step-by-step, using only the holes that already exist in the project today.
            </p>
          </div>

          <div className="rounded-2xl border border-border/30 bg-card/20 backdrop-blur-sm p-6 space-y-5">
            <h2 className="text-[10px] font-medium tracking-[0.25em] uppercase text-muted-foreground">
              ◈ 12 ways an insider can drain ZEC wallets without raising an alarm
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm font-extralight leading-relaxed">
              {[
                { t: "Malicious release build", b: "A core dev with release permissions ships one tainted binary. Because the security-check script is broken, nothing flags it. Every user who auto-updates is now running attacker code with full wallet access." },
                { t: "Swap a crypto library mid-release", b: "Replace the vendored sha2 / ripemd / hashbrown copy with a near-identical version that leaks the spending key during signing. Hash outputs look normal. Only the attacker's node knows the secret." },
                { t: "Backdoored zk-proof generator", b: "Modify the zero-knowledge proof code so a special 'magic' note is always accepted as valid. The insider can mint or spend ZEC from any address without a real private key. On-chain it looks like a normal shielded transaction." },
                { t: "Weak randomness for new wallets", b: "Quietly reduce entropy in the keygen path (e.g., seed from predictable values). Every wallet created after that release has keys the insider can brute-force in minutes. Users notice nothing until funds vanish months later." },
                { t: "Hidden RPC command", b: "Add an undocumented JSON-RPC method like debug_export that dumps the wallet seed to anyone who knows the call. Combined with the default 'notsecure' password and exposed Docker port, the insider drains nodes remotely." },
                { t: "Log-leak the seed phrase", b: "Add one debug line that prints the wallet seed on startup. Logs ship to CloudWatch / Grafana / Sentry. The insider — or anyone who ever had log access — can replay every wallet ever opened." },
                { t: "Trusted-setup sabotage", b: "Shielded ZEC depends on a trusted setup ceremony. An insider who participated and kept the toxic waste can forge unlimited counterfeit ZEC silently. The chain has no way to detect it from the outside." },
                { t: "Compiler / linker swap", b: "Push a build-config change that calls the linker by name from PATH. On the release machine, swap the linker for a wrapper that injects a payload into the final binary. Source code on GitHub stays 100% clean." },
                { t: "Dependency hijack via live GitHub pull", b: "The release pipeline fetches another repo at build time with no pinned commit. An insider who controls that second repo (or its maintainer account) ships malicious code into ZCASH without ever touching the ZCASH repo." },
                { t: "Fee-redirect patch", b: "Change one line in the mempool / mining code so a small percentage of every transaction fee silently routes to an attacker address. At ZCASH's volume, this prints money for years before anyone notices." },
                { t: "Selective censorship + front-running", b: "An insider running mining infrastructure can read pending shielded-to-transparent transactions, reorder them, and front-run exchanges. Users get worse prices, the insider pockets the difference — fully legal-looking on-chain." },
                { t: "Kill-switch / remote brick", b: "Plant a dormant condition (date, block height, or remote flag) that disables signing in every wallet on a given release. Hold users' funds hostage, or short ZEC on exchanges right before flipping the switch." },
              ].map((x) => (
                <div key={x.t} className="rounded-xl border border-border/30 bg-background/30 p-4">
                  <p className="text-foreground font-light mb-1">◉ {x.t}</p>
                  <p className="text-xs text-muted-foreground/90">{x.b}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-border/30 bg-card/20 backdrop-blur-sm p-6 space-y-4">
            <h2 className="text-[10px] font-medium tracking-[0.25em] uppercase text-muted-foreground">
              ◈ Why this is worse than a normal exploit
            </h2>
            <ul className="space-y-2 text-sm font-extralight text-muted-foreground/90 leading-relaxed list-none">
              <li>◉ <span className="text-foreground">They sign the release.</span> Your wallet trusts the signature by default — the malicious binary looks 100% official.</li>
              <li>◉ <span className="text-foreground">They write the security check.</span> The same people who could attack you also control the script that's supposed to catch the attack. It's already broken.</li>
              <li>◉ <span className="text-foreground">They control the update channel.</span> Auto-update means one bad release reaches every user within hours.</li>
              <li>◉ <span className="text-foreground">Shielded by design.</span> ZCASH's privacy features that protect users also protect the attacker. Stolen funds can be laundered through the same shielded pool in a single transaction.</li>
              <li>◉ <span className="text-foreground">Plausible deniability.</span> Every step above can be framed as "a bug" if discovered. No insider has ever been prosecuted for a "mistake" in open-source crypto code.</li>
            </ul>
          </div>

          <div className="rounded-2xl border border-border/30 bg-card/20 backdrop-blur-sm p-6 space-y-4">
            <h2 className="text-[10px] font-medium tracking-[0.25em] uppercase text-muted-foreground">
              ◈ How to protect yourself (if you actually hold ZEC)
            </h2>
            <ul className="space-y-2 text-sm font-extralight text-muted-foreground/90 leading-relaxed list-none">
              <li>◉ Never run the default Docker image as-is. Change the RPC password, bind RPC to localhost only, and put the node behind a firewall.</li>
              <li>◉ Don't auto-update. Pin a release, wait, and let other people get rugged first.</li>
              <li>◉ Verify the binary against multiple independent reproducible builds — not just the official signature.</li>
              <li>◉ Use a hardware wallet for any meaningful amount. The signing key never touches the compromised software.</li>
              <li>◉ Keep cold storage off any machine that has ever run the official node, wallet, or build tools.</li>
              <li>◉ Treat shielded balances as a target, not a hiding place. Privacy cuts both ways.</li>
            </ul>
            <p className="text-xs font-extralight text-muted-foreground/80 pt-2">
              None of the above is theoretical. Every attack on this page maps to a real finding ZERLAL
              pulled out of the public ZCASH codebase in under 10 minutes.
            </p>
          </div>



          <div className="rounded-2xl border border-border/30 bg-card/20 backdrop-blur-sm p-6 text-center space-y-3">
            <h2 className="text-[10px] font-medium tracking-[0.25em] uppercase text-muted-foreground">
              ◉ The takeaway
            </h2>
            <h3 className="text-2xl font-extralight tracking-tight text-foreground max-w-3xl mx-auto">
              Anthropic charges $200/month for Fable 5. It found a handful of bugs on this project.
              Asherin's ZERLAL agent found 200+ on the same code, in less time.
            </h3>
            <p className="text-sm font-extralight text-muted-foreground max-w-2xl mx-auto">
              The future of AI security isn't in boardrooms. It's in basements.
              <span className="block mt-1 text-foreground">#houseofasher</span>
            </p>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
};

export default Benchmark;
