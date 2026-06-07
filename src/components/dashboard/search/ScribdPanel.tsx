// ScribdPanel — Scribd-focused wrapper around DomainMapPanel.
// Pre-seeds the harvester with scribd.com and offers one-click presets that
// jump to specific Scribd surfaces (Documents hub, search, categories, etc.).
import DomainMapPanel from "./DomainMapPanel";

const PRESETS = [
  { label: "All Docs", value: "https://www.scribd.com/docs" },
  { label: "Top Search · Military", value: "https://www.scribd.com/search?query=military&content_type=documents" },
  { label: "Top Search · Intelligence", value: "https://www.scribd.com/search?query=intelligence&content_type=documents" },
  { label: "Top Search · Cybersecurity", value: "https://www.scribd.com/search?query=cybersecurity&content_type=documents" },
  { label: "Academic Papers", value: "https://www.scribd.com/explore/Academic-Papers" },
  { label: "Government Docs", value: "https://www.scribd.com/explore/Government-and-Politics" },
  { label: "Research", value: "https://www.scribd.com/explore/Research" },
  { label: "Whole Domain", value: "scribd.com" },
];

const ScribdPanel = () => {
  return (
    <DomainMapPanel
      title="Scribd Harvester"
      subtitle="Connected directly to scribd.com — map and harvest every document, PDF, and Word file from any Scribd URL, search query, or category. Pre-seeded with scribd.com; pick a preset or paste your own Scribd link."
      defaultInput="https://www.scribd.com/docs"
      presets={PRESETS}
    />
  );
};

export default ScribdPanel;
