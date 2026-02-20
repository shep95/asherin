import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { MapPin, Smartphone, Plus, Trash2, RefreshCw, Copy, Clock, Navigation, Wifi, WifiOff, Activity } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";

interface TrackerDevice {
  id: string;
  device_name: string;
  last_seen: string | null;
  created_at: string;
  pairing_token: string | null;
  pairing_token_expires_at: string | null;
}

interface TrackerLocation {
  id: string;
  latitude: number;
  longitude: number;
  accuracy: number | null;
  recorded_at: string;
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
  return Date.now() - new Date(lastSeen).getTime() < 5 * 60 * 1000; // 5 min threshold
};

export default function TrackerView() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [devices, setDevices] = useState<TrackerDevice[]>([]);
  const [selectedDevice, setSelectedDevice] = useState<TrackerDevice | null>(null);
  const [locations, setLocations] = useState<TrackerLocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [locLoading, setLocLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [pairingInfo, setPairingInfo] = useState<{ token: string; expiresAt: string; deviceId: string } | null>(null);
  const [logLat, setLogLat] = useState("");
  const [logLon, setLogLon] = useState("");
  const [logDeviceId, setLogDeviceId] = useState("");
  const [logLoading, setLogLoading] = useState(false);

  const loadDevices = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("tracker_devices" as any)
      .select("*")
      .eq("user_id", user.id)
      .is("pairing_token", null)
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
    if (!error && data) setLocations(data as unknown as TrackerLocation[]);
    setLocLoading(false);
  }, []);

  useEffect(() => {
    if (selectedDevice) loadLocations(selectedDevice.id);
    else setLocations([]);
  }, [selectedDevice, loadLocations]);

  const generatePairingToken = async () => {
    if (!user) return;
    setGenerating(true);
    const token = Array.from(crypto.getRandomValues(new Uint8Array(16))).map(b => b.toString(16).padStart(2, "0")).join("");
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();

    const { data, error } = await supabase
      .from("tracker_devices" as any)
      .insert({ user_id: user.id, pairing_token: token, pairing_token_expires_at: expiresAt, device_name: "Pending…" })
      .select()
      .single();

    if (error) {
      toast({ title: "Failed to generate token", variant: "destructive" });
    } else if (data) {
      setPairingInfo({ token, expiresAt, deviceId: (data as any).id });
    }
    setGenerating(false);
  };

  const completeDevicePairing = async () => {
    if (!pairingInfo || !user) return;
    const name = prompt("Enter a name for this device (e.g. 'iPhone 15'):");
    if (!name || name.trim().length < 2) return;

    const { error } = await supabase
      .from("tracker_devices" as any)
      .update({ device_name: name.trim(), pairing_token: null, pairing_token_expires_at: null, last_seen: new Date().toISOString() })
      .eq("id", pairingInfo.deviceId)
      .eq("user_id", user.id);

    if (error) {
      toast({ title: "Failed to register device", variant: "destructive" });
    } else {
      toast({ title: "Device registered", description: `${name.trim()} added successfully.` });
      setPairingInfo(null);
      loadDevices();
    }
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
      if (selectedDevice?.id === deviceId) { setSelectedDevice(null); setLocations([]); }
      toast({ title: "Device removed" });
    }
  };

  const logManualLocation = async () => {
    if (!user || !logLat || !logLon || !logDeviceId) return;
    const lat = parseFloat(logLat), lon = parseFloat(logLon);
    if (isNaN(lat) || isNaN(lon) || lat < -90 || lat > 90 || lon < -180 || lon > 180) {
      toast({ title: "Invalid coordinates", variant: "destructive" }); return;
    }
    setLogLoading(true);
    const { error } = await supabase
      .from("tracker_locations" as any)
      .insert({ device_id: logDeviceId, user_id: user.id, latitude: lat, longitude: lon });

    // Update last_seen on device
    await supabase.from("tracker_devices" as any).update({ last_seen: new Date().toISOString() }).eq("id", logDeviceId);

    if (!error) {
      toast({ title: "Location logged" });
      setLogLat(""); setLogLon("");
      if (selectedDevice?.id === logDeviceId) loadLocations(logDeviceId);
      loadDevices();
    } else {
      toast({ title: "Failed to log location", variant: "destructive" });
    }
    setLogLoading(false);
  };

  const useCurrentLocation = () => {
    if (!navigator.geolocation) { toast({ title: "Geolocation not supported", variant: "destructive" }); return; }
    navigator.geolocation.getCurrentPosition(
      (pos) => { setLogLat(pos.coords.latitude.toFixed(6)); setLogLon(pos.coords.longitude.toFixed(6)); },
      () => toast({ title: "Could not get location", variant: "destructive" })
    );
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: "Copied to clipboard" });
  };

  const openInMaps = (lat: number, lon: number) => {
    window.open(`https://www.google.com/maps?q=${lat},${lon}`, "_blank");
  };

  return (
    <div className="flex flex-col h-full bg-transparent">
      {/* Header */}
      <div className="flex-shrink-0 flex items-center justify-between px-6 py-4 border-b border-border/20">
        <div className="flex items-center gap-3">
          <MapPin className="h-5 w-5 text-accent" />
          <div>
            <h1 className="text-sm font-extralight tracking-[0.2em] text-foreground">LOCATION TRACKER</h1>
            <p className="text-xs text-muted-foreground font-extralight">Device management & location history</p>
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
        {/* LEFT PANEL: Devices */}
        <div className="w-72 flex-shrink-0 flex flex-col border-r border-border/20">
          <div className="flex-shrink-0 px-4 py-3 border-b border-border/10">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-light tracking-[0.15em] text-muted-foreground uppercase">Devices</span>
              <button
                onClick={generatePairingToken}
                disabled={generating}
                className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-light bg-accent text-accent-foreground hover:bg-accent/90 transition-colors disabled:opacity-50"
              >
                <Plus className="h-3.5 w-3.5" />
                {generating ? "Generating…" : "Add Device"}
              </button>
            </div>

            {/* Pairing Token Display */}
            {pairingInfo && (
              <div className="rounded-xl border border-accent/30 bg-accent/10 p-3 space-y-2">
                <p className="text-[10px] font-light tracking-[0.1em] text-accent uppercase">Pairing Token</p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 text-xs font-mono text-foreground break-all">{pairingInfo.token}</code>
                  <button onClick={() => copyToClipboard(pairingInfo.token)} className="text-muted-foreground hover:text-foreground transition-colors">
                    <Copy className="h-3.5 w-3.5" />
                  </button>
                </div>
                <p className="text-[10px] text-muted-foreground">Expires in 15 minutes. Use this token in your mobile app to pair.</p>
                <button
                  onClick={completeDevicePairing}
                  className="w-full rounded-lg py-1.5 text-xs font-light bg-foreground/10 hover:bg-foreground/20 text-foreground transition-colors"
                >
                  Complete Pairing Manually
                </button>
              </div>
            )}
          </div>

          <ScrollArea className="flex-1">
            <div className="p-2 space-y-1">
              {loading ? (
                <p className="px-3 py-4 text-xs text-muted-foreground animate-pulse">Loading devices…</p>
              ) : devices.length === 0 ? (
                <div className="px-3 py-8 text-center space-y-2">
                  <Smartphone className="h-8 w-8 text-muted-foreground/30 mx-auto" />
                  <p className="text-xs text-muted-foreground font-extralight">No devices registered yet.</p>
                  <p className="text-[10px] text-muted-foreground/50">Click "Add Device" to generate a pairing token.</p>
                </div>
              ) : (
                devices.map(device => (
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
                      <p className="text-[10px] text-muted-foreground/60">{formatRelativeTime(device.last_seen)}</p>
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
                  <span className={`text-[10px] font-light px-2 py-0.5 rounded-full border ${
                    isOnline(selectedDevice.last_seen)
                      ? "border-emerald-500/30 text-emerald-400 bg-emerald-500/10"
                      : "border-border/30 text-muted-foreground bg-muted/20"
                  }`}>
                    {isOnline(selectedDevice.last_seen) ? "Online" : "Offline"}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Clock className="h-3.5 w-3.5" />
                  Last seen: {formatRelativeTime(selectedDevice.last_seen)}
                </div>
              </div>

              {/* Manual Location Logger */}
              <div className="flex-shrink-0 px-6 py-3 border-b border-border/10 bg-card/10">
                <p className="text-[10px] font-light tracking-[0.15em] text-muted-foreground uppercase mb-2">Log Location</p>
                <div className="flex items-center gap-2 flex-wrap">
                  <input
                    type="text"
                    value={logLat}
                    onChange={(e) => setLogLat(e.target.value)}
                    placeholder="Latitude (e.g. 40.712776)"
                    className="flex-1 min-w-24 rounded-lg border border-border/20 bg-card/20 px-3 py-1.5 text-xs font-light text-foreground placeholder:text-muted-foreground/40 outline-none focus:border-accent/50"
                  />
                  <input
                    type="text"
                    value={logLon}
                    onChange={(e) => setLogLon(e.target.value)}
                    placeholder="Longitude (e.g. -74.005974)"
                    className="flex-1 min-w-24 rounded-lg border border-border/20 bg-card/20 px-3 py-1.5 text-xs font-light text-foreground placeholder:text-muted-foreground/40 outline-none focus:border-accent/50"
                  />
                  <select
                    value={logDeviceId}
                    onChange={(e) => setLogDeviceId(e.target.value)}
                    className="rounded-lg border border-border/20 bg-card/20 px-3 py-1.5 text-xs font-light text-foreground outline-none focus:border-accent/50"
                  >
                    <option value={selectedDevice.id}>{selectedDevice.device_name}</option>
                    {devices.filter(d => d.id !== selectedDevice.id).map(d => (
                      <option key={d.id} value={d.id}>{d.device_name}</option>
                    ))}
                  </select>
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
                    {logLoading ? "…" : "Log"}
                  </button>
                </div>
              </div>

              {/* Location History */}
              <ScrollArea className="flex-1">
                <div className="p-6">
                  <div className="flex items-center gap-2 mb-4">
                    <Activity className="h-4 w-4 text-muted-foreground" />
                    <span className="text-xs font-light tracking-[0.15em] text-muted-foreground uppercase">Location History</span>
                    <span className="text-[10px] text-muted-foreground/50">({locations.length} entries)</span>
                  </div>

                  {locLoading ? (
                    <p className="text-xs text-muted-foreground animate-pulse">Loading location history…</p>
                  ) : locations.length === 0 ? (
                    <div className="text-center py-12 space-y-3">
                      <MapPin className="h-10 w-10 text-muted-foreground/20 mx-auto" />
                      <p className="text-sm font-extralight text-muted-foreground">No location data yet.</p>
                      <p className="text-xs text-muted-foreground/50">Use the logger above or connect a device.</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {locations.map((loc, idx) => (
                        <div
                          key={loc.id}
                          className="group flex items-center gap-4 rounded-xl border border-border/10 bg-card/20 px-4 py-3 hover:border-border/30 hover:bg-card/30 transition-all"
                        >
                          <div className="flex-shrink-0 flex items-center justify-center h-7 w-7 rounded-lg bg-accent/10 text-accent text-[10px] font-light">
                            {idx + 1}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-3">
                              <span className="text-xs font-light text-foreground font-mono">
                                {parseFloat(String(loc.latitude)).toFixed(6)}°, {parseFloat(String(loc.longitude)).toFixed(6)}°
                              </span>
                              {loc.accuracy && (
                                <span className="text-[10px] text-muted-foreground/60">±{parseFloat(String(loc.accuracy)).toFixed(0)}m</span>
                              )}
                            </div>
                            <p className="text-[10px] text-muted-foreground/50 mt-0.5">{new Date(loc.recorded_at).toLocaleString()}</p>
                          </div>
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                              onClick={() => copyToClipboard(`${loc.latitude},${loc.longitude}`)}
                              className="rounded-lg p-1.5 text-muted-foreground hover:text-foreground hover:bg-foreground/10 transition-colors"
                              title="Copy coordinates"
                            >
                              <Copy className="h-3 w-3" />
                            </button>
                            <button
                              onClick={() => openInMaps(loc.latitude, loc.longitude)}
                              className="rounded-lg p-1.5 text-muted-foreground hover:text-foreground hover:bg-foreground/10 transition-colors"
                              title="Open in Google Maps"
                            >
                              <MapPin className="h-3 w-3" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </ScrollArea>
            </>
          ) : (
            /* No device selected */
            <div className="flex flex-1 items-center justify-center">
              <div className="text-center space-y-4 max-w-sm px-6">
                <div className="flex items-center justify-center gap-2 mb-6">
                  <div className="h-px flex-1 bg-border/20" />
                  <MapPin className="h-8 w-8 text-muted-foreground/30" />
                  <div className="h-px flex-1 bg-border/20" />
                </div>
                <h2 className="text-sm font-extralight tracking-[0.2em] text-foreground">SELECT A DEVICE</h2>
                <p className="text-xs font-extralight leading-relaxed text-muted-foreground">
                  Choose a device from the sidebar to view its location history, or add a new device using a pairing token.
                </p>
                <div className="rounded-xl border border-border/10 bg-card/10 p-4 text-left space-y-2 mt-4">
                  <p className="text-[10px] font-light tracking-[0.15em] text-muted-foreground uppercase">API Endpoint</p>
                  <code className="block text-[10px] font-mono text-accent break-all">
                    POST /tracker/location
                  </code>
                  <p className="text-[10px] text-muted-foreground/60">Connect mobile apps or IoT devices to push location data directly.</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
