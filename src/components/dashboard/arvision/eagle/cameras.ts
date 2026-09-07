// eagle.eye — camera fabric.
//
// the honest position on bluetooth: a browser cannot pull a video stream over
// web bluetooth. what web bluetooth can do is talk to a paired device's gatt
// services — battery, status, a start/stop characteristic. so bluetooth here is
// a *control and status* channel, and a bluetooth camera only appears in the
// video grid when the operating system already exposes it as a normal video
// input. saying otherwise would be a lie that fails in the field.

export interface CameraSlot {
  deviceId: string;
  label: string;
  stream: MediaStream | null;
  status: "idle" | "opening" | "live" | "denied" | "failed";
  error: string | null;
  openedAtMs: number | null;
}

export async function listVideoInputs(): Promise<MediaDeviceInfo[]> {
  if (!navigator.mediaDevices?.enumerateDevices) return [];
  const all = await navigator.mediaDevices.enumerateDevices();
  return all.filter((d) => d.kind === "videoinput");
}

/** labels are blank until one permission grant happens; ask once, then list. */
export async function primePermissions(): Promise<{ granted: boolean; error: string | null }> {
  try {
    const s = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
    s.getTracks().forEach((t) => t.stop());
    return { granted: true, error: null };
  } catch (e) {
    return { granted: false, error: e instanceof Error ? e.message : "camera permission was refused" };
  }
}

export async function openCamera(deviceId: string): Promise<MediaStream> {
  return await navigator.mediaDevices.getUserMedia({
    video: {
      deviceId: deviceId ? { exact: deviceId } : undefined,
      width: { ideal: 1280 },
      height: { ideal: 720 },
      frameRate: { ideal: 15, max: 30 },
    },
    audio: false,
  });
}

export function closeStream(stream: MediaStream | null) {
  stream?.getTracks().forEach((t) => t.stop());
}

// ---------------------------------------------------------------------------
// bluetooth control channel
// ---------------------------------------------------------------------------

export interface BleLink {
  id: string;
  name: string;
  connected: boolean;
  batteryPercent: number | null;
  services: string[];
  note: string;
}

type BluetoothCapableNavigator = Navigator & {
  bluetooth?: {
    requestDevice: (opts: unknown) => Promise<{
      id: string;
      name?: string;
      gatt?: {
        connect: () => Promise<{
          connected: boolean;
          getPrimaryServices: () => Promise<Array<{ uuid: string; getCharacteristic: (u: string) => Promise<{ readValue: () => Promise<DataView> }> }>>;
          disconnect: () => void;
        }>;
      };
      addEventListener: (t: string, cb: () => void) => void;
    }>;
  };
};

export function bluetoothSupported(): boolean {
  return typeof navigator !== "undefined" && !!(navigator as BluetoothCapableNavigator).bluetooth;
}

export async function pairBleDevice(): Promise<BleLink> {
  const nav = navigator as BluetoothCapableNavigator;
  if (!nav.bluetooth) throw new Error("this browser exposes no web bluetooth api");
  const device = await nav.bluetooth.requestDevice({
    acceptAllDevices: true,
    optionalServices: ["battery_service", "device_information"],
  });
  const server = await device.gatt?.connect();
  let battery: number | null = null;
  const services: string[] = [];
  if (server) {
    try {
      const list = await server.getPrimaryServices();
      for (const s of list) services.push(s.uuid);
      const bat = list.find((s) => s.uuid.includes("180f"));
      if (bat) {
        const ch = await bat.getCharacteristic("00002a19-0000-1000-8000-00805f9b34fb");
        battery = (await ch.readValue()).getUint8(0);
      }
    } catch {
      /* a device that refuses service discovery is still paired */
    }
  }
  return {
    id: device.id,
    name: device.name || "unnamed bluetooth device",
    connected: !!server?.connected,
    batteryPercent: battery,
    services,
    note: "bluetooth carries control and status only. video appears in the grid solely when this operating system also exposes the device as a camera input.",
  };
}
