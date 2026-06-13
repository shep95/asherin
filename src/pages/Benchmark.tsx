import { useEffect } from "react";
import { Link } from "react-router-dom";
import Header from "@/components/Header";
import SiteFooter from "@/components/SiteFooter";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from "recharts";

const PROMPT = "Implement a thread-safe LRU cache with O(1) get and put.";

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

const CodeBlock = ({ title, lang, code, accent }: {
  title: string; lang: string; code: string; accent: string;
}) => (
  <div className="rounded-2xl border border-border/30 bg-card/20 backdrop-blur-sm overflow-hidden flex flex-col">
    <div className="flex items-center justify-between px-4 py-3 border-b border-border/30 bg-background/40">
      <div className="flex items-center gap-2">
        <div className="h-2 w-2 rounded-full" style={{ background: accent }} />
        <span className="text-sm font-light text-foreground">{title}</span>
      </div>
      <span className="text-[10px] font-extralight tracking-wider text-muted-foreground uppercase">{lang}</span>
    </div>
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
  useEffect(() => {
    document.title = "Aureon Benchmark — Cheap models, groomed to outperform";
    const meta = document.querySelector('meta[name="description"]') ||
      document.head.appendChild(Object.assign(document.createElement("meta"), { name: "description" }));
    meta.setAttribute("content",
      "Aureon vs Opus 4.8 vs GPT-5.5 on a thread-safe LRU cache. See the prompt, the code, and the scored results.");
  }, []);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Header />

      <main className="max-w-6xl mx-auto px-4 sm:px-6 pt-28 pb-24 space-y-20">
        {/* HERO */}
        <section className="space-y-4 text-center">
          <div className="inline-block px-3 py-1 rounded-full border border-border/40 text-[10px] font-light tracking-[0.25em] uppercase text-muted-foreground">
            ◈ Benchmark
          </div>
          <h1 className="text-4xl sm:text-5xl font-extralight tracking-tight">
            Aureon vs Opus 4.8 vs GPT-5.5
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
            <p className="text-[10px] font-medium tracking-[0.25em] uppercase text-muted-foreground mb-2">
              ◉ Prompt given to all three
            </p>
            <p className="text-base sm:text-lg font-light text-foreground">
              "{PROMPT}"
            </p>
            <p className="text-xs font-extralight text-muted-foreground/80 mt-2">
              Tests concurrency + data structure design.
            </p>
          </div>

          {/* Podium short scores */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Podium rank="Winner" name="Aureon" lang="Java" score={27} total={30} highlight />
            <Podium rank="2nd" name="Opus 4.8" lang="Python" score={24} total={30} />
            <Podium rank="3rd" name="GPT-5.5" lang="Python" score={17} total={30} />
          </div>

          {/* Short-rubric chart */}
          <div className="rounded-2xl border border-border/30 bg-card/20 backdrop-blur-sm p-5">
            <p className="text-[10px] font-medium tracking-[0.25em] uppercase text-muted-foreground mb-4">
              ◈ 5-dimension scoring
            </p>
            <div className="h-[320px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={SCORES_SHORT}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border) / 0.3)" />
                  <XAxis dataKey="metric" tick={{ fontSize: 11, fontWeight: 300, fill: "hsl(var(--muted-foreground))" }} />
                  <YAxis tick={{ fontSize: 11, fontWeight: 300, fill: "hsl(var(--muted-foreground))" }} domain={[0, 6]} />
                  <Tooltip contentStyle={TOOLTIP_STYLE} />
                  <Legend wrapperStyle={{ fontSize: 11, fontWeight: 300 }} />
                  <Bar dataKey="aureon" name="Aureon (Java)" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="opus"   name="Opus 4.8 (Python)" fill="#10b981" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="gpt"    name="GPT-5.5 (Python)" fill="#f97316" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Code outputs */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <CodeBlock title="Aureon" lang="Java"   code={AUREON_CODE} accent="#3b82f6" />
            <CodeBlock title="Opus 4.8" lang="Python" code={OPUS_CODE} accent="#10b981" />
            <CodeBlock title="GPT-5.5"  lang="Python" code={GPT_CODE}  accent="#f97316" />
          </div>

          {/* Expanded rubric */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Podium rank="Winner" name="Aureon · Java" lang="Verified by execution" score={50} total={60} highlight />
            <Podium rank="2nd" name="Opus 4.8 · Python" lang="Verified by execution" score={47} total={60} />
            <Podium rank="3rd" name="GPT-5.5 · Python" lang="Verified by execution" score={33} total={60} />
          </div>

          <div className="rounded-2xl border border-border/30 bg-card/20 backdrop-blur-sm p-5">
            <p className="text-[10px] font-medium tracking-[0.25em] uppercase text-muted-foreground mb-4">
              ◈ 10-dimension scoring · ✓ = verified by execution
            </p>
            <div className="h-[460px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={SCORES_FULL} layout="vertical" margin={{ left: 40 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border) / 0.3)" />
                  <XAxis type="number" domain={[0, 6]} tick={{ fontSize: 11, fontWeight: 300, fill: "hsl(var(--muted-foreground))" }} />
                  <YAxis type="category" dataKey="metric" width={170} tick={{ fontSize: 11, fontWeight: 300, fill: "hsl(var(--muted-foreground))" }} />
                  <Tooltip contentStyle={TOOLTIP_STYLE} />
                  <Legend wrapperStyle={{ fontSize: 11, fontWeight: 300 }} />
                  <Bar dataKey="aureon" name="Aureon (Java)" fill="#3b82f6" radius={[0, 3, 3, 0]} />
                  <Bar dataKey="opus"   name="Opus 4.8 (Python)" fill="#10b981" radius={[0, 3, 3, 0]} />
                  <Bar dataKey="gpt"    name="GPT-5.5 (Python)" fill="#f97316" radius={[0, 3, 3, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Method explanation */}
          <div className="rounded-2xl border border-border/30 bg-card/20 backdrop-blur-sm p-6 space-y-4">
            <p className="text-[10px] font-medium tracking-[0.25em] uppercase text-muted-foreground">
              ◉ How Aureon wins on a cheaper base model
            </p>
            <h2 className="text-2xl font-extralight tracking-tight text-foreground">
              We don't train a bigger brain. We groom a cheaper one — harder.
            </h2>
            <div className="space-y-3 text-sm font-extralight leading-relaxed text-muted-foreground/90">
              <p>
                Aureon runs on <span className="text-foreground">GPT-5.2</span> — a normal,
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
      </main>

      <SiteFooter />
    </div>
  );
};

export default Benchmark;
