import { useState } from "react";
import { Github, GitBranch, Upload, Link, Box, X, ChevronRight, Check, Bell, Mail } from "lucide-react";
import { scanProfiles } from "./mockData";

interface ScanModalProps {
  open: boolean;
  onClose: () => void;
}

type Step = 1 | 2 | 3;

const sources = [
  { id: "github", label: "GitHub", icon: Github },
  { id: "gitlab", label: "GitLab", icon: GitBranch },
  { id: "bitbucket", label: "Bitbucket", icon: GitBranch },
  { id: "upload", label: "Upload ZIP", icon: Upload },
  { id: "url", label: "Paste URL", icon: Link },
  { id: "docker", label: "Docker Image", icon: Box },
];

const ScanModal = ({ open, onClose }: ScanModalProps) => {
  const [step, setStep] = useState<Step>(1);
  const [selectedSource, setSelectedSource] = useState<string | null>(null);
  const [selectedProfile, setSelectedProfile] = useState<string>("security-audit");

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-2xl border border-border/[0.08] bg-card/95 backdrop-blur-md shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border/[0.06]">
          <div className="flex items-center gap-3">
            <span className="text-[11px] font-light text-foreground/80 tracking-wide">New Scan</span>
            <div className="flex items-center gap-1">
              {[1, 2, 3].map((s) => (
                <div key={s} className={`w-6 h-0.5 rounded-full ${step >= s ? "bg-foreground/30" : "bg-foreground/[0.06]"}`} />
              ))}
            </div>
          </div>
          <button onClick={onClose} className="p-1 text-muted-foreground/30 hover:text-foreground/50">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-5">
          {/* Step 1: Source */}
          {step === 1 && (
            <div className="space-y-4">
              <div>
                <h3 className="text-[10px] text-muted-foreground/40 uppercase tracking-wider mb-3">Select Source</h3>
                <div className="grid grid-cols-3 gap-2">
                  {sources.map((s) => (
                    <button
                      key={s.id}
                      onClick={() => setSelectedSource(s.id)}
                      className={`flex flex-col items-center gap-2 p-4 rounded-xl border transition-all ${
                        selectedSource === s.id
                          ? "border-foreground/15 bg-foreground/[0.04]"
                          : "border-border/[0.06] hover:border-foreground/10 hover:bg-foreground/[0.02]"
                      }`}
                    >
                      <s.icon className="h-5 w-5 text-foreground/40" />
                      <span className="text-[10px] text-foreground/50">{s.label}</span>
                    </button>
                  ))}
                </div>
              </div>
              {selectedSource && (
                <div className="space-y-2">
                  {selectedSource === "url" ? (
                    <input
                      type="text"
                      placeholder="https://github.com/owner/repo"
                      className="w-full px-3 py-2 rounded-lg bg-foreground/[0.03] border border-border/[0.06] text-[10px] text-foreground/70 placeholder:text-muted-foreground/20 focus:outline-none focus:border-foreground/10"
                    />
                  ) : selectedSource === "upload" ? (
                    <div className="border-2 border-dashed border-border/[0.08] rounded-xl p-8 text-center">
                      <Upload className="h-5 w-5 text-muted-foreground/20 mx-auto mb-2" />
                      <p className="text-[10px] text-muted-foreground/30">Drop ZIP/TAR archive here or click to browse</p>
                      <p className="text-[8px] text-muted-foreground/20 mt-1">Up to 5GB</p>
                    </div>
                  ) : (
                    <div className="text-[10px] text-muted-foreground/30 p-3 rounded-lg bg-foreground/[0.02] border border-border/[0.04]">
                      OAuth connection required — click Next to authenticate
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Step 2: Profile */}
          {step === 2 && (
            <div className="space-y-3">
              <h3 className="text-[10px] text-muted-foreground/40 uppercase tracking-wider">Scan Profile</h3>
              {scanProfiles.map((p) => (
                <button
                  key={p.id}
                  onClick={() => setSelectedProfile(p.id)}
                  className={`w-full text-left p-4 rounded-xl border transition-all ${
                    selectedProfile === p.id
                      ? "border-foreground/15 bg-foreground/[0.04]"
                      : "border-border/[0.06] hover:border-foreground/10"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] text-foreground/60">{p.name}</span>
                    <span className="text-[9px] text-muted-foreground/25">{p.estimatedTime}</span>
                  </div>
                  <p className="text-[9px] text-muted-foreground/30 mt-1">{p.description}</p>
                  <div className="flex flex-wrap gap-1 mt-2">
                    {p.includes.map((inc) => (
                      <span key={inc} className="text-[8px] px-1.5 py-0.5 rounded bg-foreground/[0.03] text-muted-foreground/30">
                        {inc}
                      </span>
                    ))}
                  </div>
                </button>
              ))}
            </div>
          )}

          {/* Step 3: Notifications */}
          {step === 3 && (
            <div className="space-y-4">
              <h3 className="text-[10px] text-muted-foreground/40 uppercase tracking-wider">Notification Settings</h3>
              <div className="space-y-3">
                <label className="flex items-center justify-between p-3 rounded-xl border border-border/[0.06] hover:bg-foreground/[0.02] cursor-pointer">
                  <div className="flex items-center gap-2">
                    <Mail className="h-3.5 w-3.5 text-muted-foreground/30" />
                    <span className="text-[10px] text-foreground/50">Email on completion</span>
                  </div>
                  <input type="checkbox" defaultChecked className="w-3.5 h-3.5 rounded accent-foreground/30" />
                </label>
                <label className="flex items-center justify-between p-3 rounded-xl border border-border/[0.06] hover:bg-foreground/[0.02] cursor-pointer">
                  <div className="flex items-center gap-2">
                    <Bell className="h-3.5 w-3.5 text-red-400/50" />
                    <span className="text-[10px] text-foreground/50">Immediate alert on critical findings</span>
                  </div>
                  <input type="checkbox" defaultChecked className="w-3.5 h-3.5 rounded accent-foreground/30" />
                </label>
                <label className="flex items-center justify-between p-3 rounded-xl border border-border/[0.06] hover:bg-foreground/[0.02] cursor-pointer">
                  <div className="flex items-center gap-2">
                    <span className="text-[9px] text-muted-foreground/30">Slack</span>
                    <span className="text-[10px] text-foreground/50">Post to #security channel</span>
                  </div>
                  <input type="checkbox" className="w-3.5 h-3.5 rounded accent-foreground/30" />
                </label>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-4 border-t border-border/[0.06]">
          <button
            onClick={() => step > 1 ? setStep((step - 1) as Step) : onClose()}
            className="text-[10px] text-muted-foreground/30 hover:text-foreground/50"
          >
            {step > 1 ? "← Back" : "Cancel"}
          </button>
          <button
            onClick={() => step < 3 ? setStep((step + 1) as Step) : onClose()}
            disabled={step === 1 && !selectedSource}
            className="px-4 py-1.5 rounded-lg bg-foreground/[0.08] text-[10px] text-foreground/60 hover:bg-foreground/[0.12] transition-colors disabled:opacity-30 flex items-center gap-1"
          >
            {step === 3 ? (
              <>
                <Check className="h-3 w-3" /> Start Scan
              </>
            ) : (
              <>
                Next <ChevronRight className="h-3 w-3" />
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ScanModal;
