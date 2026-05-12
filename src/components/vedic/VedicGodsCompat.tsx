import { useMemo, useState } from "react";
import { Sparkles, Crown, Skull, Flame } from "lucide-react";
import { matchMythology, type Match } from "@/lib/vedic/mythologyMatch";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const PantheonIcon = ({ p }: { p: Match["pantheon"] }) => {
  if (p === "Greek") return <Crown className="h-3.5 w-3.5 text-amber-300/80" strokeWidth={1.5} />;
  if (p === "Roman") return <Sparkles className="h-3.5 w-3.5 text-foreground/70" strokeWidth={1.5} />;
  if (p === "Greek-Monster") return <Skull className="h-3.5 w-3.5 text-rose-300/80" strokeWidth={1.5} />;
  return <Flame className="h-3.5 w-3.5 text-orange-300/80" strokeWidth={1.5} />;
};

const Row = ({ m }: { m: Match }) => (
  <div className="rounded-2xl border border-border/20 bg-card/30 backdrop-blur-md p-5 transition-colors hover:border-border/40">
    <div className="mb-1 flex items-center justify-between">
      <div className="flex items-center gap-2">
        <PantheonIcon p={m.pantheon} />
        <span className="text-sm font-light tracking-wide text-foreground">{m.name}</span>
        <span className="text-[10px] font-extralight tracking-[0.2em] uppercase text-muted-foreground/70">{m.pantheon}</span>
      </div>
      <span className="font-mono text-sm tracking-wider text-foreground">{m.percent}%</span>
    </div>
    <div className="text-[11px] font-extralight uppercase tracking-[0.2em] text-muted-foreground/70">{m.domain}</div>
    <p className="mt-2 text-xs font-extralight leading-relaxed text-muted-foreground">{m.blurb}</p>
    <div className="mt-3 h-[3px] w-full overflow-hidden rounded-full bg-border/20">
      <div className="h-full bg-foreground/70 transition-all" style={{ width: `${m.percent}%` }} />
    </div>
  </div>
);

const VedicGodsCompat = () => {
  const [date, setDate] = useState("");
  const matches = useMemo(() => date ? matchMythology(new Date(date)) : [], [date]);
  const filterBy = (p: string) => matches.filter((m) => m.pantheon === p).slice(0, 6);

  return (
    <section className="relative z-10 px-6 py-24">
      <div className="mx-auto max-w-6xl">
        <div className="mb-10 flex flex-col items-start gap-4">
          <div className="rounded-full border border-border/20 bg-card/30 backdrop-blur-md px-3 py-1 inline-flex items-center gap-2">
            <Crown className="h-3 w-3 text-foreground/70" />
            <span className="text-[10px] font-light tracking-[0.3em] text-muted-foreground uppercase">Mythological Archetype Match</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-extralight tracking-wide text-foreground">
            Compare Your Chart to Greek &amp; Roman Gods — and Their Monsters
          </h2>
          <p className="text-sm font-extralight text-muted-foreground max-w-2xl">
            Your Vedic signature is mapped against eight domain weights — authority, war, wisdom, love, chaos, sea, sky, wealth — and scored cosine-style against twenty-eight mythological figures. The closer the percentage, the closer the operating signature.
          </p>
          <div className="flex flex-col sm:flex-row items-stretch sm:items-end gap-3 w-full max-w-md">
            <div className="flex-1">
              <label className="text-[10px] font-extralight tracking-[0.25em] uppercase text-muted-foreground">Birth Date</label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)}
                className="mt-1 bg-card/30 border-border/30 backdrop-blur-md" />
            </div>
            <Button onClick={() => date && setDate(date)} disabled={!date}
              className="bg-foreground text-background hover:bg-foreground/90 font-light">
              Reveal Archetypes
            </Button>
          </div>
        </div>

        {matches.length > 0 && (
          <Tabs defaultValue="all" className="space-y-6">
            <TabsList className="bg-card/30 backdrop-blur-md border border-border/20 p-1 rounded-xl">
              <TabsTrigger value="all">All</TabsTrigger>
              <TabsTrigger value="greek">Greek Gods</TabsTrigger>
              <TabsTrigger value="roman">Roman Gods</TabsTrigger>
              <TabsTrigger value="gmonster">Greek Monsters</TabsTrigger>
              <TabsTrigger value="rmonster">Roman Monsters</TabsTrigger>
            </TabsList>
            <TabsContent value="all" className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {matches.slice(0, 12).map((m) => <Row key={m.name} m={m} />)}
            </TabsContent>
            <TabsContent value="greek" className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filterBy("Greek").map((m) => <Row key={m.name} m={m} />)}
            </TabsContent>
            <TabsContent value="roman" className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filterBy("Roman").map((m) => <Row key={m.name} m={m} />)}
            </TabsContent>
            <TabsContent value="gmonster" className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filterBy("Greek-Monster").map((m) => <Row key={m.name} m={m} />)}
            </TabsContent>
            <TabsContent value="rmonster" className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filterBy("Roman-Monster").map((m) => <Row key={m.name} m={m} />)}
            </TabsContent>
          </Tabs>
        )}
        {!matches.length && (
          <div className="rounded-2xl border border-border/20 bg-card/20 backdrop-blur-md p-10 text-center">
            <p className="text-xs font-extralight tracking-wide text-muted-foreground">
              Enter a birth date above to compute archetype resonance across both pantheons.
            </p>
          </div>
        )}
      </div>
    </section>
  );
};

export default VedicGodsCompat;
