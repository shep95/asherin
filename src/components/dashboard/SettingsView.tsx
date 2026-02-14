import { User, Shield, Bell, Palette, Key, Globe } from "lucide-react";

const sections = [
  { icon: User, label: "Profile", desc: "Name, email, avatar" },
  { icon: Shield, label: "Privacy & Security", desc: "Encryption, data handling" },
  { icon: Bell, label: "Notifications", desc: "Email alerts, updates" },
  { icon: Palette, label: "Appearance", desc: "Theme, font size, layout" },
  { icon: Key, label: "API Keys", desc: "Custom model connections" },
  { icon: Globe, label: "Language", desc: "Interface language" },
];

const SettingsView = () => (
  <div className="max-w-2xl mx-auto p-6 space-y-6">
    <div>
      <h2 className="text-xl font-extralight tracking-wide text-foreground">Settings</h2>
      <p className="text-sm font-extralight text-muted-foreground mt-1">Configure your Zialiel experience.</p>
    </div>

    <div className="space-y-2">
      {sections.map((s) => (
        <button
          key={s.label}
          className="flex w-full items-center gap-4 rounded-xl border border-border/20 bg-card/20 backdrop-blur-sm p-4 text-left hover:bg-foreground/5 transition-colors group"
        >
          <div className="rounded-lg border border-border/20 bg-card/30 p-2.5">
            <s.icon className="h-5 w-5 text-muted-foreground group-hover:text-foreground transition-colors" />
          </div>
          <div>
            <p className="text-sm font-light text-foreground">{s.label}</p>
            <p className="text-xs font-extralight text-muted-foreground">{s.desc}</p>
          </div>
        </button>
      ))}
    </div>
  </div>
);

export default SettingsView;
