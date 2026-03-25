import { useState, useMemo } from "react";
import {
  User, Phone, Building2, Globe, AtSign, CreditCard, MapPin,
  Car, Fingerprint, Link2, ChevronRight, Search, Filter, Layers,
  Smartphone, Wallet, Radio, Shield, Hash
} from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";

interface NomadEntity {
  type: string;
  value: string;
  confidence: number;
  source?: string;
  linkedTo?: string[];
}

interface NomadObjectExplorerProps {
  entities: NomadEntity[];
  crossRefMap: Record<string, string[]>;
}

const OBJECT_ICONS: Record<string, any> = {
  email: AtSign, phone: Phone, organization: Building2, url: Globe,
  person: User, financial: CreditCard, money: CreditCard,
  vehicle: Car, license_plate: Car, vin: Car,
  transaction: CreditCard, transaction_id: Hash, bank_account: Wallet,
  swift_code: Wallet, iban: Wallet, crypto_wallet: Wallet,
  cell_tower: Radio, imei: Smartphone, imsi: Smartphone,
  ip_address: Globe, coordinates: MapPin, geo_coordinate: MapPin,
  location: MapPin, us_location: MapPin,
  passport: Shield, ssn: Shield,
  handle: Fingerprint, role: User, institution: Building2,
  sec_identifier: Building2, ein: Building2,
  education_level: Building2, technology: Globe, subreddit: Globe, date: Hash,
};

const OBJECT_COLORS: Record<string, string> = {
  person: "text-blue-400", email: "text-cyan-400", phone: "text-green-400",
  organization: "text-amber-400", vehicle: "text-orange-400",
  financial: "text-emerald-400", transaction: "text-emerald-400",
  bank_account: "text-emerald-400", crypto_wallet: "text-purple-400",
  cell_tower: "text-red-400", ip_address: "text-rose-400",
  location: "text-teal-400", coordinates: "text-teal-400",
  passport: "text-yellow-400", handle: "text-indigo-400",
};

const CATEGORY_ORDER = [
  "person", "organization", "phone", "email", "handle",
  "financial", "transaction", "bank_account", "crypto_wallet", "swift_code", "iban",
  "vehicle", "license_plate", "vin",
  "cell_tower", "imei", "imsi", "ip_address",
  "location", "us_location", "coordinates", "geo_coordinate",
  "passport", "ssn",
  "url", "role", "institution", "technology", "date", "sec_identifier", "ein", "education_level", "subreddit",
];

function getObjectColor(type: string) {
  for (const [key, color] of Object.entries(OBJECT_COLORS)) {
    if (type.includes(key)) return color;
  }
  return "text-muted-foreground";
}

const NomadObjectExplorer = ({ entities, crossRefMap }: NomadObjectExplorerProps) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedType, setSelectedType] = useState<string | null>(null);
  const [selectedObject, setSelectedObject] = useState<NomadEntity | null>(null);

  // Group entities by type
  const grouped = useMemo(() => {
    const map: Record<string, NomadEntity[]> = {};
    for (const e of entities) {
      if (!map[e.type]) map[e.type] = [];
      map[e.type].push(e);
    }
    return map;
  }, [entities]);

  // Auto-link: find connections between objects
  const objectLinks = useMemo(() => {
    const links: Record<string, { linkedEntities: NomadEntity[]; sharedSources: string[] }> = {};
    for (const e of entities) {
      const key = `${e.type}:${e.value.toLowerCase().trim()}`;
      const sources = crossRefMap[key] || [];
      // Find all other entities that share a source
      const linked = entities.filter(other => {
        if (other === e) return false;
        const otherKey = `${other.type}:${other.value.toLowerCase().trim()}`;
        const otherSources = crossRefMap[otherKey] || [];
        return sources.some(s => otherSources.includes(s));
      });
      links[key] = { linkedEntities: linked, sharedSources: sources };
    }
    return links;
  }, [entities, crossRefMap]);

  const filteredEntities = useMemo(() => {
    let list = entities;
    if (selectedType) list = list.filter(e => e.type === selectedType);
    if (searchTerm) list = list.filter(e => e.value.toLowerCase().includes(searchTerm.toLowerCase()));
    // Sort by category order, then confidence
    return [...list].sort((a, b) => {
      const ai = CATEGORY_ORDER.indexOf(a.type);
      const bi = CATEGORY_ORDER.indexOf(b.type);
      if (ai !== bi) return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
      return b.confidence - a.confidence;
    });
  }, [entities, selectedType, searchTerm]);

  const typeList = Object.keys(grouped).sort((a, b) => {
    const ai = CATEGORY_ORDER.indexOf(a);
    const bi = CATEGORY_ORDER.indexOf(b);
    return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
  });

  if (entities.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center py-20">
        <Layers className="h-10 w-10 text-muted-foreground/30 mb-4" />
        <p className="text-sm font-extralight text-muted-foreground">No objects detected yet.</p>
        <p className="text-[10px] font-extralight text-muted-foreground/50 mt-1">Run an investigation to populate the Object Explorer.</p>
      </div>
    );
  }

  return (
    <div className="flex h-full">
      {/* Left: Object Type Filter */}
      <div className="w-48 border-r border-border/20 flex-shrink-0">
        <div className="p-3 border-b border-border/20">
          <div className="flex items-center gap-2 rounded-xl border border-border/20 bg-card/30 px-3 py-2">
            <Search className="h-3 w-3 text-muted-foreground/50" />
            <input
              type="text"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              placeholder="Search objects..."
              className="bg-transparent text-[11px] font-extralight text-foreground placeholder:text-muted-foreground/40 outline-none w-full"
            />
          </div>
        </div>
        <ScrollArea className="h-[calc(100%-52px)]">
          <div className="p-2 space-y-0.5">
            <button
              onClick={() => setSelectedType(null)}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-[11px] font-extralight transition-colors ${
                !selectedType ? "bg-foreground/[0.06] text-accent" : "text-muted-foreground hover:text-foreground hover:bg-card/30"
              }`}
            >
              <span className="flex items-center gap-2"><Filter className="h-3 w-3" /> All Objects</span>
              <span className="text-[9px] text-muted-foreground/50">{entities.length}</span>
            </button>
            {typeList.map(type => {
              const Icon = OBJECT_ICONS[type] || Hash;
              return (
                <button
                  key={type}
                  onClick={() => setSelectedType(type === selectedType ? null : type)}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-[11px] font-extralight transition-colors ${
                    selectedType === type ? "bg-foreground/[0.06] text-accent" : "text-muted-foreground hover:text-foreground hover:bg-card/30"
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <Icon className={`h-3 w-3 ${getObjectColor(type)}`} />
                    {type.replace(/_/g, " ")}
                  </span>
                  <span className="text-[9px] text-muted-foreground/50">{grouped[type]?.length}</span>
                </button>
              );
            })}
          </div>
        </ScrollArea>
      </div>

      {/* Center: Object List */}
      <div className="flex-1 min-w-0">
        <ScrollArea className="h-full">
          <div className="p-4 space-y-2">
            {filteredEntities.map((entity, idx) => {
              const Icon = OBJECT_ICONS[entity.type] || Hash;
              const key = `${entity.type}:${entity.value.toLowerCase().trim()}`;
              const links = objectLinks[key];
              const linkCount = links?.linkedEntities.length || 0;
              const isSelected = selectedObject?.value === entity.value && selectedObject?.type === entity.type;

              return (
                <button
                  key={`${entity.type}-${entity.value}-${idx}`}
                  onClick={() => setSelectedObject(isSelected ? null : entity)}
                  className={`w-full text-left rounded-2xl border px-4 py-3 transition-all ${
                    isSelected
                      ? "border-foreground/15 bg-foreground/[0.06]"
                      : "border-border/20 bg-card/20 hover:bg-card/40 hover:border-border/30"
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`h-8 w-8 rounded-xl flex items-center justify-center ${isSelected ? "bg-foreground/[0.1]" : "bg-card/40"}`}>
                        <Icon className={`h-4 w-4 ${getObjectColor(entity.type)}`} />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-light text-foreground truncate">{entity.value}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-[9px] font-extralight text-muted-foreground/60 uppercase tracking-wider">{entity.type.replace(/_/g, " ")}</span>
                          <span className="text-[9px] font-extralight text-muted-foreground/40">
                            {Math.round(entity.confidence * 100)}% confidence
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {linkCount > 0 && (
                        <span className="flex items-center gap-1 text-[9px] font-extralight text-foreground/60">
                          <Link2 className="h-3 w-3" /> {linkCount}
                        </span>
                      )}
                      <ChevronRight className={`h-3.5 w-3.5 text-muted-foreground/30 transition-transform ${isSelected ? "rotate-90" : ""}`} />
                    </div>
                  </div>

                  {/* Expanded: Show linked objects */}
                  {isSelected && links && links.linkedEntities.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-border/20 space-y-1.5 animate-fade-in">
                      <p className="text-[9px] font-extralight tracking-wider text-muted-foreground/50 uppercase">
                        Auto-Linked Objects ({links.linkedEntities.length})
                      </p>
                      {links.linkedEntities.slice(0, 12).map((linked, lidx) => {
                        const LIcon = OBJECT_ICONS[linked.type] || Hash;
                        return (
                          <div key={lidx} className="flex items-center gap-2 py-1 px-2 rounded-lg bg-card/30">
                            <LIcon className={`h-3 w-3 ${getObjectColor(linked.type)}`} />
                            <span className="text-[10px] font-extralight text-foreground/80 truncate">{linked.value}</span>
                            <span className="text-[8px] font-extralight text-muted-foreground/40 ml-auto shrink-0">{linked.type.replace(/_/g, " ")}</span>
                          </div>
                        );
                      })}
                      {links.linkedEntities.length > 12 && (
                        <p className="text-[8px] font-extralight text-muted-foreground/40 pl-2">
                          +{links.linkedEntities.length - 12} more linked objects
                        </p>
                      )}
                      <div className="flex items-center gap-1 mt-1.5">
                        <span className="text-[8px] font-extralight text-muted-foreground/40">
                          Sources: {links.sharedSources.join(", ")}
                        </span>
                      </div>
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </ScrollArea>
      </div>
    </div>
  );
};

export default NomadObjectExplorer;
