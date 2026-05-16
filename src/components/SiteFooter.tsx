import { Link } from "react-router-dom";
import { Twitter, Github } from "lucide-react";
import { useState } from "react";
import houseOfAsherLogo from "@/assets/HouseOfAsher_Flag.png";

interface SiteFooterProps {
  variant?: "full" | "compact";
}

const SiteFooter = ({ variant = "full" }: SiteFooterProps) => {
  const [showHouseLogo, setShowHouseLogo] = useState(false);
  const year = new Date().getFullYear();

  if (variant === "compact") {
    return (
      <footer className="relative z-10 px-6 pb-8 pt-4">
        <div className="mx-auto max-w-5xl">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 py-6">
            <p className="text-sm font-light tracking-[0.2em] text-foreground">AUREON</p>
            <div className="flex items-center gap-x-6 gap-y-2 flex-wrap justify-center">
              <Link to="/" className="text-xs font-extralight tracking-wide text-muted-foreground hover:text-foreground transition-colors">Home</Link>
              <Link to="/features" className="text-xs font-extralight tracking-wide text-muted-foreground hover:text-foreground transition-colors">Features</Link>
              <Link to="/pricing" className="text-xs font-extralight tracking-wide text-muted-foreground hover:text-foreground transition-colors">Pricing</Link>
              <Link to="/forums" className="text-xs font-extralight tracking-wide text-muted-foreground hover:text-foreground transition-colors">Forums</Link>
              <Link to="/benchmarks" className="text-xs font-extralight tracking-wide text-muted-foreground hover:text-foreground transition-colors">Benchmarks</Link>
              <Link to="/terms" className="text-xs font-extralight tracking-wide text-muted-foreground hover:text-foreground transition-colors">Terms</Link>
              <Link to="/privacy" className="text-xs font-extralight tracking-wide text-muted-foreground hover:text-foreground transition-colors">Privacy</Link>
            </div>
            <p className="text-xs font-extralight tracking-wide text-muted-foreground/50">© {year} Zorak Corp</p>
          </div>
        </div>
      </footer>
    );
  }

  return (
    <footer className="relative z-10 px-6 pb-8 pt-16">
      <div className="mx-auto max-w-6xl">
        <div className="rounded-2xl border border-border/20 bg-card/30 backdrop-blur-md px-8 py-10 sm:px-12">
          <div className="flex flex-col gap-8">
            {/* Branding */}
            <div className="text-center sm:text-left">
              <p className="text-sm font-light tracking-[0.2em] text-foreground">AUREON</p>
              <p className="mt-1 text-xs font-extralight tracking-wide text-muted-foreground">
                Powered by Zorak Corp & House Of Asher · Zophiel Engine
              </p>
            </div>

            {/* Links Grid */}
            <div className="w-full grid grid-cols-2 sm:grid-cols-5 gap-x-8 gap-y-6">
              <div className="flex flex-col gap-2">
                <p className="text-[9px] font-medium tracking-[0.2em] text-muted-foreground/50 uppercase mb-1">Intelligence</p>
                <Link to="/llm-models" className="text-xs font-extralight tracking-wide text-muted-foreground hover:text-foreground transition-colors">LLM Models</Link>
                <Link to="/feature/zophiel" className="text-xs font-extralight tracking-wide text-muted-foreground hover:text-foreground transition-colors">Zophiel Search</Link>
                <Link to="/feature/nomad" className="text-xs font-extralight tracking-wide text-muted-foreground hover:text-foreground transition-colors">NOMAD Public Intel</Link>
                <Link to="/feature/azplen" className="text-xs font-extralight tracking-wide text-muted-foreground hover:text-foreground transition-colors">Azplen Intelligence</Link>
                <Link to="/feature/predictive" className="text-xs font-extralight tracking-wide text-muted-foreground hover:text-foreground transition-colors">Predictive Intelligence</Link>
                <Link to="/feature/oracle-locus" className="text-xs font-extralight tracking-wide text-muted-foreground hover:text-foreground transition-colors">Oracle Locus</Link>
                <Link to="/feature/video-intelligence" className="text-xs font-extralight tracking-wide text-muted-foreground hover:text-foreground transition-colors">Video Intelligence</Link>
                <Link to="/feature/cross" className="text-xs font-extralight tracking-wide text-muted-foreground hover:text-foreground transition-colors">CROSS Live Screen</Link>
                <Link to="/ww3" className="text-xs font-extralight tracking-wide text-destructive/70 hover:text-destructive transition-colors">WW3 Trajectory</Link>
              </div>

              <div className="flex flex-col gap-2">
                <p className="text-[9px] font-medium tracking-[0.2em] text-muted-foreground/50 uppercase mb-1">Security</p>
                <Link to="/feature/zerlal" className="text-xs font-extralight tracking-wide text-muted-foreground hover:text-foreground transition-colors">ZERLAL Cyber Security</Link>
                <Link to="/feature/security" className="text-xs font-extralight tracking-wide text-muted-foreground hover:text-foreground transition-colors">Guardian Vault</Link>
                <Link to="/feature/zeeion" className="text-xs font-extralight tracking-wide text-muted-foreground hover:text-foreground transition-colors">ZEEION FI Forensics</Link>
                <Link to="/feature/axrlen" className="text-xs font-extralight tracking-wide text-muted-foreground hover:text-foreground transition-colors">AXRLEN Engine</Link>
                <Link to="/feature/byok" className="text-xs font-extralight tracking-wide text-muted-foreground hover:text-foreground transition-colors">Bring Your Own Key</Link>
              </div>

              <div className="flex flex-col gap-2">
                <p className="text-[9px] font-medium tracking-[0.2em] text-muted-foreground/50 uppercase mb-1">Agents & Tools</p>
                <Link to="/feature/zahten" className="text-xs font-extralight tracking-wide text-muted-foreground hover:text-foreground transition-colors">Zahten Agent Forge</Link>
                <Link to="/feature/automated-agents" className="text-xs font-extralight tracking-wide text-muted-foreground hover:text-foreground transition-colors">Automated Agents</Link>
                <Link to="/feature/personas" className="text-xs font-extralight tracking-wide text-muted-foreground hover:text-foreground transition-colors">AI Personas</Link>
                <Link to="/feature/briefings" className="text-xs font-extralight tracking-wide text-muted-foreground hover:text-foreground transition-colors">Daily Briefings</Link>
                <Link to="/feature/notebooks" className="text-xs font-extralight tracking-wide text-muted-foreground hover:text-foreground transition-colors">Notebooks</Link>
                <Link to="/feature/lavba" className="text-xs font-extralight tracking-wide text-muted-foreground hover:text-foreground transition-colors">Lavba Strategy</Link>
                <Link to="/feature/vedic" className="text-xs font-extralight tracking-wide text-muted-foreground hover:text-foreground transition-colors">Vedic Strategy</Link>
              </div>

              <div className="flex flex-col gap-2">
                <p className="text-[9px] font-medium tracking-[0.2em] text-muted-foreground/50 uppercase mb-1">Creation</p>
                <Link to="/feature/zali" className="text-xs font-extralight tracking-wide text-muted-foreground hover:text-foreground transition-colors">ZANOEM Design Lab</Link>
                <Link to="/feature/imagine-to-code" className="text-xs font-extralight tracking-wide text-muted-foreground hover:text-foreground transition-colors">Imagine To Code</Link>
                <Link to="/feature/ide" className="text-xs font-extralight tracking-wide text-muted-foreground hover:text-foreground transition-colors">Aureon IDE</Link>
                <Link to="/feature/vibe-imager" className="text-xs font-extralight tracking-wide text-muted-foreground hover:text-foreground transition-colors">Vibe Imager</Link>
                <Link to="/feature/vibe-video" className="text-xs font-extralight tracking-wide text-muted-foreground hover:text-foreground transition-colors">Vibe Video</Link>
                <Link to="/feature/ebook" className="text-xs font-extralight tracking-wide text-muted-foreground hover:text-foreground transition-colors">E-Book Generator</Link>
                <Link to="/feature/whiteboard" className="text-xs font-extralight tracking-wide text-muted-foreground hover:text-foreground transition-colors">Whiteboard</Link>
                <Link to="/feature/cipher" className="text-xs font-extralight tracking-wide text-muted-foreground hover:text-foreground transition-colors">Cipher Toolkit</Link>
                <Link to="/feature/file-scrapper" className="text-xs font-extralight tracking-wide text-muted-foreground hover:text-foreground transition-colors">File Scrapper</Link>
              </div>

              <div className="flex flex-col gap-2">
                <p className="text-[9px] font-medium tracking-[0.2em] text-muted-foreground/50 uppercase mb-1">Company</p>
                <Link to="/features" className="text-xs font-extralight tracking-wide text-muted-foreground hover:text-foreground transition-colors">All Features</Link>
                <Link to="/pricing" className="text-xs font-extralight tracking-wide text-muted-foreground hover:text-foreground transition-colors">Pricing</Link>
                <Link to="/founder" className="text-xs font-extralight tracking-wide text-muted-foreground hover:text-foreground transition-colors">Founder</Link>
                <Link to="/forums" className="text-xs font-extralight tracking-wide text-muted-foreground hover:text-foreground transition-colors">Forums</Link>
                <Link to="/prompt-engineering" className="text-xs font-extralight tracking-wide text-muted-foreground hover:text-foreground transition-colors">Prompt Engineering</Link>
                <Link to="/benchmarks" className="text-xs font-extralight tracking-wide text-muted-foreground hover:text-foreground transition-colors">Benchmarks</Link>
                <Link to="/equity" className="text-xs font-extralight tracking-wide text-muted-foreground hover:text-foreground transition-colors">Equity Ownership</Link>
                <Link to="/nda" className="text-xs font-extralight tracking-wide text-muted-foreground hover:text-foreground transition-colors">NDA</Link>
                <Link to="/terms" className="text-xs font-extralight tracking-wide text-muted-foreground hover:text-foreground transition-colors">Terms of Service</Link>
                <Link to="/privacy" className="text-xs font-extralight tracking-wide text-muted-foreground hover:text-foreground transition-colors">Privacy Policy</Link>
              </div>
            </div>

            {/* Bottom — Copyright */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-6 border-t border-border/15">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowHouseLogo(true)}
                  className="group relative h-7 w-7 overflow-hidden rounded-lg border border-border/30 bg-black transition-all hover:border-foreground/40 hover:scale-105"
                  aria-label="View House of Asher emblem"
                >
                  <img src={houseOfAsherLogo} alt="House of Asher emblem" className="h-full w-full object-cover" />
                </button>
                <p className="text-xs font-extralight tracking-wide text-muted-foreground/50">
                  © {year} #HouseOfAsher · Zorak Corp
                </p>
              </div>
              <p className="text-[10px] font-extralight tracking-wide text-muted-foreground/30">
                AUREON — Founded Nov 18, 2025 · 8:38 AM
              </p>
              <div className="flex items-center gap-3">
                <a href="https://x.com/shep_newton" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors" aria-label="X / Twitter — Primary">
                  <Twitter className="h-4 w-4" />
                  <span className="text-[10px] font-extralight tracking-[0.2em] uppercase">Primary</span>
                </a>
                <a href="https://x.com/aureon_elion" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-[hsl(43_90%_60%)] hover:text-[hsl(43_90%_70%)] transition-colors" aria-label="X / Twitter — Backup">
                  <Twitter className="h-4 w-4" />
                  <span className="text-[10px] font-extralight tracking-[0.2em] uppercase">Backup</span>
                </a>
                <a href="https://bosley.app/" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors" aria-label="Join Asher on Bosley">
                  <span className="text-[10px] font-extralight tracking-[0.2em] uppercase">Bosley</span>
                </a>
                <a href="https://github.com/ZorakCorp" target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-foreground transition-colors" aria-label="GitHub">
                  <Github className="h-4 w-4" />
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>

      {showHouseLogo && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-6"
          onClick={() => setShowHouseLogo(false)}
        >
          <img src={houseOfAsherLogo} alt="House of Asher emblem" className="max-h-[80vh] max-w-[80vw] object-contain rounded-lg" />
        </div>
      )}
    </footer>
  );
};

export default SiteFooter;
