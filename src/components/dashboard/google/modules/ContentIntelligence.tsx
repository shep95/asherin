import { useState } from "react";
import {
  FolderOpen, Search, FileText, Users, Copy, HardDrive,
  Clock, Lock, AlignLeft, Camera, User, MapPin, Palette,
  Star, Calendar, Eye, Smile, Tag, ChevronRight,
} from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

const docFeatures = [
  { icon: FolderOpen, name: "Smart File Organizer", desc: "Auto-organizes Drive files by project, type, importance" },
  { icon: Search, name: "Content Search AI", desc: "Natural language file search — 'Find that contract I signed last month'" },
  { icon: FileText, name: "Document Analyzer", desc: "Analyzes document content — topics, entities, sentiment, keywords" },
  { icon: Users, name: "Collaboration Tracker", desc: "Tracks who you collaborate with on documents" },
  { icon: Copy, name: "Duplicate Finder", desc: "Finds duplicate files — 'You have 3 versions of Q4_Report.docx'" },
  { icon: HardDrive, name: "Storage Optimizer", desc: "Suggests files to delete — '127 files >1 year old, never opened'" },
  { icon: Clock, name: "Version History Tracker", desc: "Tracks document changes with who/when timeline" },
  { icon: Lock, name: "Sharing Permissions Auditor", desc: "Checks file sharing — '12 files shared publicly (security risk)'" },
  { icon: AlignLeft, name: "Auto-Summarizer", desc: "TL;DR of any document in 3 bullet points" },
];

const photoFeatures = [
  { icon: Camera, name: "Photo Timeline", desc: "Creates chronological photo story with GPS data" },
  { icon: User, name: "Face Recognition", desc: "Identifies people in photos — 'Sarah appears in 47 photos'" },
  { icon: MapPin, name: "Photo Location Map", desc: "World map of everywhere you've taken photos" },
  { icon: Palette, name: "Photo Categorizer", desc: "Auto-categorizes: Food, Travel, People, Nature, Work" },
  { icon: Star, name: "Best Photo Selector", desc: "Picks best photos from bursts using AI quality scoring" },
  { icon: Calendar, name: "Event Detector", desc: "Groups photos by events — 'Birthday party — 47 photos'" },
  { icon: Eye, name: "Visual Search", desc: "Search photos by content — 'Show me all photos of beaches'" },
  { icon: Smile, name: "Emotion Detector", desc: "Detects emotions in photos via facial analysis" },
  { icon: Tag, name: "Auto-Tagging", desc: "Auto-tags photos with subjects, scenes, objects" },
];

const ContentIntelligence = () => {
  const [tab, setTab] = useState("documents");

  return (
    <div className="space-y-6">
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="bg-transparent p-0 gap-1">
          <TabsTrigger value="documents" className="rounded-xl px-4 py-2 text-xs font-light data-[state=active]:bg-foreground/10 data-[state=active]:text-foreground">
            <FileText className="h-3.5 w-3.5 mr-1.5" /> Documents
          </TabsTrigger>
          <TabsTrigger value="photos" className="rounded-xl px-4 py-2 text-xs font-light data-[state=active]:bg-foreground/10 data-[state=active]:text-foreground">
            <Camera className="h-3.5 w-3.5 mr-1.5" /> Photos & Video
          </TabsTrigger>
        </TabsList>

        <TabsContent value="documents" className="mt-4 space-y-4">
          {/* Drive Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: "Total Files", value: "2,847" },
              { label: "Shared", value: "342" },
              { label: "Duplicates", value: "23" },
              { label: "Public (Risk)", value: "12" },
            ].map((s) => (
              <div key={s.label} className="rounded-2xl border border-border/20 bg-card/30 backdrop-blur-md p-4 space-y-1">
                <span className="text-[10px] font-extralight text-muted-foreground">{s.label}</span>
                <span className="text-lg font-light text-foreground block">{s.value}</span>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {docFeatures.map((f) => (
              <div key={f.name} className="flex items-start gap-3 rounded-2xl border border-border/20 bg-card/20 backdrop-blur-md p-4 hover:bg-foreground/5 transition-all group">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-foreground/5">
                  <f.icon className="h-4 w-4 text-foreground/70" />
                </div>
                <div className="flex-1 min-w-0 space-y-0.5">
                  <span className="text-xs font-light text-foreground">{f.name}</span>
                  <p className="text-[10px] font-extralight text-muted-foreground">{f.desc}</p>
                </div>
                <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/30 group-hover:text-foreground/50 mt-1" />
              </div>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="photos" className="mt-4 space-y-4">
          {/* Photo Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: "Total Photos", value: "50,000" },
              { label: "People Identified", value: "127" },
              { label: "Locations", value: "1,847" },
              { label: "Events Detected", value: "41" },
            ].map((s) => (
              <div key={s.label} className="rounded-2xl border border-border/20 bg-card/30 backdrop-blur-md p-4 space-y-1">
                <span className="text-[10px] font-extralight text-muted-foreground">{s.label}</span>
                <span className="text-lg font-light text-foreground block">{s.value}</span>
              </div>
            ))}
          </div>

          {/* Photo Intelligence Report */}
          <div className="rounded-2xl border border-border/20 bg-card/30 backdrop-blur-md p-5 space-y-3">
            <h3 className="text-sm font-light tracking-wide text-foreground">Photo Intelligence Report</h3>
            <div className="grid grid-cols-2 gap-3 text-[10px] font-extralight text-muted-foreground">
              <div className="space-y-1">
                <span className="text-foreground/70 font-light">👥 People</span>
                <p>Most photographed: Sarah (1,247 photos)</p>
                <p>You appear in: 8,400 photos</p>
              </div>
              <div className="space-y-1">
                <span className="text-foreground/70 font-light">🗺️ Locations</span>
                <p>23 countries · 89 cities</p>
                <p>Most: NYC (34,200 photos)</p>
              </div>
              <div className="space-y-1">
                <span className="text-foreground/70 font-light">📅 Events</span>
                <p>18 birthdays · 12 trips · 4 weddings</p>
              </div>
              <div className="space-y-1">
                <span className="text-foreground/70 font-light">🎨 Content</span>
                <p>Food: 8.4k · Landscapes: 6.2k · People: 21k</p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {photoFeatures.map((f) => (
              <div key={f.name} className="flex items-start gap-3 rounded-2xl border border-border/20 bg-card/20 backdrop-blur-md p-4 hover:bg-foreground/5 transition-all group">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-foreground/5">
                  <f.icon className="h-4 w-4 text-foreground/70" />
                </div>
                <div className="flex-1 min-w-0 space-y-0.5">
                  <span className="text-xs font-light text-foreground">{f.name}</span>
                  <p className="text-[10px] font-extralight text-muted-foreground">{f.desc}</p>
                </div>
                <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/30 group-hover:text-foreground/50 mt-1" />
              </div>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default ContentIntelligence;
