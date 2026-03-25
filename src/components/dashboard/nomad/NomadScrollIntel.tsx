import { ChevronDown } from "lucide-react";

interface NomadScrollIntelProps {
  visible: boolean;
  onClick: () => void;
  unreadCount: number;
}

const NomadScrollIntel = ({ visible, onClick, unreadCount }: NomadScrollIntelProps) => {
  if (!visible) return null;

  return (
    <button
      onClick={onClick}
      className="absolute bottom-20 left-1/2 -translate-x-1/2 z-40 flex items-center gap-2 rounded-full border border-accent/30 bg-card/90 backdrop-blur-xl px-4 py-2 shadow-lg hover:bg-card transition-all animate-fade-in"
    >
      <ChevronDown className="h-3.5 w-3.5 text-accent" />
      <span className="text-[10px] font-extralight tracking-wider text-foreground">
        {unreadCount > 0 ? `${unreadCount} new finding${unreadCount > 1 ? "s" : ""}` : "Jump to latest"}
      </span>
    </button>
  );
};

export default NomadScrollIntel;
