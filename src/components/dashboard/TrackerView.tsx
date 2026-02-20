import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  MapPin, Phone, Plus, Trash2, RefreshCw, Copy, Clock,
  Navigation, Wifi, WifiOff, Activity, Signal, Search, X, Home
} from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";

interface TrackerDevice {
  id: string;
  device_name: string;
  phone_number: string | null;
  last_seen: string | null;
  created_at: string;
}

interface TrackerLocation {
  id: string;
  latitude: number;
  longitude: number;
  accuracy: number | null;
  recorded_at: string;
  address: string | null;
}

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

const isOnline = (lastSeen: string | null) => {
  if (!lastSeen) return false;
  return Date.now() - new Date(lastSeen).getTime() < 5 * 60 * 1000;
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

// Map component using OpenStreetMap iframe (zero dependencies)
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
        style={{ border: 0, display: "block" }}
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

export default function TrackerView() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [devices, setDevices] = useState<TrackerDevice[]>([]);
  const [selectedDevice, setSelectedDevice] = useState<TrackerDevice | null>(null);
  const [locations, setLocations] = useState<TrackerLocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [locLoading, setLocLoading] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [phoneInput, setPhoneInput] = useState("");
  const [nameInput, setNameInput] = useState("");
  const [adding, setAdding] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [logLat, setLogLat] = useState("");
  const [logLon, setLogLon] = useState("");
  const [logLoading, setLogLoading] = useState(false);
  const [selectedPin, setSelectedPin] = useState<TrackerLocation | null>(null);

  const loadDevices = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("tracker_devices" as any)
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });
    if (!error && data) setDevices(data as unknown as TrackerDevice[]);
    setLoading(false);
  }, [user]);

  useEffect(() => { loadDevices(); }, [loadDevices]);

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
    if (selectedDevice) loadLocations(selectedDevice.id);
    else { setLocations([]); setSelectedPin(null); }
  }, [selectedDevice, loadLocations]);

  const addTarget = async () => {
    if (!user) return;
    const digits = phoneInput.replace(/\D/g, "");
    if (digits.length < 7) {
      toast({ title: "Enter a valid phone number", variant: "destructive" });
      return;
    }
    const label = nameInput.trim() || `+${digits}`;
    setAdding(true);
    const duplicate = devices.find(d => d.phone_number?.replace(/\D/g, "") === digits);
    if (duplicate) {
      toast({ title: "Phone number already tracked", variant: "destructive" });
      setAdding(false);
      return;
    }
    const { error } = await supabase
      .from("tracker_devices" as any)
      .insert({ user_id: user.id, device_name: label, phone_number: `+${digits}` })
      .select()
      .single();

    if (error) {
      toast({ title: "Failed to add target", variant: "destructive" });
    } else {
      toast({ title: "Target added", description: `${label} is now being tracked.` });
      setShowAddForm(false);
      setPhoneInput("");
      setNameInput("");
      loadDevices();
    }
    setAdding(false);
  };

  const deleteDevice = async (deviceId: string) => {
    if (!user) return;
    const { error } = await supabase
      .from("tracker_devices" as any)
      .delete()
      .eq("id", deviceId)
      .eq("user_id", user.id);
    if (!error) {
      setDevices(prev => prev.filter(d => d.id !== deviceId));
      if (selectedDevice?.id === deviceId) { setSelectedDevice(null); setLocations([]); setSelectedPin(null); }
      toast({ title: "Target removed" });
    }
  };

  const useCurrentLocation = () => {
    if (!navigator.geolocation) { toast({ title: "Geolocation not supported", variant: "destructive" }); return; }
    navigator.geolocation.getCurrentPosition(
      (pos) => { setLogLat(pos.coords.latitude.toFixed(6)); setLogLon(pos.coords.longitude.toFixed(6)); },
      () => toast({ title: "Could not get location", variant: "destructive" })
    );
  };

  const logManualLocation = async () => {
    if (!user || !selectedDevice || !logLat || !logLon) return;
    const lat = parseFloat(logLat), lon = parseFloat(logLon);
    if (isNaN(lat) || isNaN(lon) || lat < -90 || lat > 90 || lon < -180 || lon > 180) {
      toast({ title: "Invalid coordinates", variant: "destructive" }); return;
    }
    setLogLoading(true);

    // Reverse geocode before saving
    const address = await reverseGeocode(lat, lon);

    const { error } = await supabase
      .from("tracker_locations" as any)
      .insert({ device_id: selectedDevice.id, user_id: user.id, latitude: lat, longitude: lon, address: address || null });
    await supabase.from("tracker_devices" as any).update({ last_seen: new Date().toISOString() }).eq("id", selectedDevice.id);

    if (!error) {
      toast({ title: "Location logged", description: address || `${lat.toFixed(4)}, ${lon.toFixed(4)}` });
      setLogLat(""); setLogLon("");
      loadLocations(selectedDevice.id);
      loadDevices();
    } else {
      toast({ title: "Failed to log location", variant: "destructive" });
    }
    setLogLoading(false);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: "Copied to clipboard" });
  };

  const openInMaps = (lat: number, lon: number) => {
    window.open(`https://www.google.com/maps?q=${lat},${lon}`, "_blank");
  };

  const filteredDevices = devices.filter(d =>
    d.device_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (d.phone_number || "").includes(searchQuery)
  );

  return (
    <div className="flex flex-col h-full bg-transparent">
      {/* Header */}
      <div className="flex-shrink-0 flex items-center justify-between px-6 py-4 border-b border-border/20">
        <div className="flex items-center gap-3">
          <Signal className="h-5 w-5 text-accent" />
          <div>
            <h1 className="text-sm font-extralight tracking-[0.2em] text-foreground">LOCATION TRACKER</h1>
            <p className="text-xs text-muted-foreground font-extralight">Track targets by phone number</p>
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
        {/* LEFT PANEL: Targets */}
        <div className="w-72 flex-shrink-0 flex flex-col border-r border-border/20">
          <div className="flex-shrink-0 px-4 py-3 border-b border-border/10 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-light tracking-[0.15em] text-muted-foreground uppercase">Targets</span>
              <button
                onClick={() => setShowAddForm(!showAddForm)}
                className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-light bg-accent text-accent-foreground hover:bg-accent/90 transition-colors"
              >
                {showAddForm ? <X className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
                {showAddForm ? "Cancel" : "Add Target"}
              </button>
            </div>

            {showAddForm && (
              <div className="rounded-xl border border-accent/20 bg-accent/5 p-3 space-y-2">
                <p className="text-[10px] font-light tracking-[0.1em] text-accent uppercase">New Target</p>
                <div className="relative">
                  <Phone className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/50" />
                  <input
                    type="tel"
                    value={phoneInput}
                    onChange={(e) => setPhoneInput(e.target.value)}
                    placeholder="+1 (555) 000-0000"
                    className="w-full rounded-lg border border-border/20 bg-card/20 pl-8 pr-3 py-1.5 text-xs font-light text-foreground placeholder:text-muted-foreground/40 outline-none focus:border-accent/50"
                  />
                </div>
                <input
                  type="text"
                  value={nameInput}
                  onChange={(e) => setNameInput(e.target.value)}
                  placeholder="Label (e.g. John's iPhone)"
                  className="w-full rounded-lg border border-border/20 bg-card/20 px-3 py-1.5 text-xs font-light text-foreground placeholder:text-muted-foreground/40 outline-none focus:border-accent/50"
                />
                <button
                  onClick={addTarget}
                  disabled={adding || !phoneInput.trim()}
                  className="w-full rounded-lg py-1.5 text-xs font-light bg-accent text-accent-foreground hover:bg-accent/90 transition-colors disabled:opacity-50"
                >
                  {adding ? "Adding…" : "Track Target"}
                </button>
              </div>
            )}

            {devices.length > 0 && (
              <div className="flex items-center gap-2 rounded-xl border border-border/20 bg-card/20 px-3 py-1.5">
                <Search className="h-3.5 w-3.5 text-muted-foreground/50" />
                <input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search targets…"
                  className="flex-1 bg-transparent text-xs font-light text-foreground placeholder:text-muted-foreground/40 outline-none"
                />
              </div>
            )}
          </div>

          <ScrollArea className="flex-1">
            <div className="p-2 space-y-1">
              {loading ? (
                <p className="px-3 py-4 text-xs text-muted-foreground animate-pulse">Loading targets…</p>
              ) : filteredDevices.length === 0 ? (
                <div className="px-3 py-8 text-center space-y-2">
                  <Phone className="h-8 w-8 text-muted-foreground/30 mx-auto" />
                  <p className="text-xs text-muted-foreground font-extralight">No targets tracked yet.</p>
                  <p className="text-[10px] text-muted-foreground/50">Click "Add Target" and enter a phone number.</p>
                </div>
              ) : (
                filteredDevices.map(device => (
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
                      <Phone className="h-4 w-4" />
                      <span className={`absolute -bottom-0.5 -right-0.5 h-2 w-2 rounded-full border border-background ${
                        isOnline(device.last_seen) ? "bg-emerald-500" : "bg-muted-foreground/40"
                      }`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-light truncate">{device.device_name}</p>
                      <p className="text-[10px] text-muted-foreground/60 font-mono">{device.phone_number || "—"}</p>
                    </div>
                    <button
                      onClick={(e) => { e.stopPropagation(); deleteDevice(device.id); }}
                      className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-all"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </ScrollArea>
        </div>

        {/* RIGHT PANEL */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          {selectedDevice ? (
            <>
              {/* Device Header */}
              <div className="flex-shrink-0 flex items-center justify-between px-6 py-4 border-b border-border/10">
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2">
                    {isOnline(selectedDevice.last_seen)
                      ? <Wifi className="h-4 w-4 text-emerald-500" />
                      : <WifiOff className="h-4 w-4 text-muted-foreground/50" />
                    }
                    <span className="text-sm font-light text-foreground">{selectedDevice.device_name}</span>
                  </div>
                  {selectedDevice.phone_number && (
                    <button
                      onClick={() => copyToClipboard(selectedDevice.phone_number!)}
                      className="flex items-center gap-1 text-[10px] font-mono text-muted-foreground hover:text-foreground transition-colors"
                      title="Copy phone number"
                    >
                      <Phone className="h-3 w-3" />
                      {selectedDevice.phone_number}
                      <Copy className="h-3 w-3 opacity-50" />
                    </button>
                  )}
                  <span className={`text-[10px] font-light px-2 py-0.5 rounded-full border ${
                    isOnline(selectedDevice.last_seen)
                      ? "border-emerald-500/30 text-emerald-400 bg-emerald-500/10"
                      : "border-border/30 text-muted-foreground bg-muted/20"
                  }`}>
                    {isOnline(selectedDevice.last_seen) ? "Active" : "Inactive"}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Clock className="h-3.5 w-3.5" />
                  Last seen: {formatRelativeTime(selectedDevice.last_seen)}
                </div>
              </div>

              {/* Manual Location Logger */}
              <div className="flex-shrink-0 px-6 py-3 border-b border-border/10 bg-card/10">
                <p className="text-[10px] font-light tracking-[0.15em] text-muted-foreground uppercase mb-2">Log Location Ping</p>
                <div className="flex items-center gap-2 flex-wrap">
                  <input
                    type="text"
                    value={logLat}
                    onChange={(e) => setLogLat(e.target.value)}
                    placeholder="Latitude"
                    className="flex-1 min-w-24 rounded-lg border border-border/20 bg-card/20 px-3 py-1.5 text-xs font-light text-foreground placeholder:text-muted-foreground/40 outline-none focus:border-accent/50"
                  />
                  <input
                    type="text"
                    value={logLon}
                    onChange={(e) => setLogLon(e.target.value)}
                    placeholder="Longitude"
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

              <ScrollArea className="flex-1">
                <div className="p-6 space-y-5">
                  {/* Map for selected pin */}
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
                </div>
              </ScrollArea>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center gap-4 text-center p-12">
              <div className="h-16 w-16 rounded-2xl border border-border/20 bg-card/20 flex items-center justify-center">
                <Signal className="h-8 w-8 text-muted-foreground/30" />
              </div>
              <div className="space-y-1.5">
                <p className="text-sm font-extralight text-foreground">Select a target to view location history</p>
                <p className="text-xs text-muted-foreground/60">
                  Add targets by phone number using the panel on the left.
                </p>
              </div>
              {devices.length === 0 && (
                <button
                  onClick={() => setShowAddForm(true)}
                  className="mt-2 flex items-center gap-2 rounded-xl border border-accent/30 bg-accent/10 px-4 py-2.5 text-xs font-light text-accent hover:bg-accent/20 transition-colors"
                >
                  <Plus className="h-4 w-4" />
                  Add your first target
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
