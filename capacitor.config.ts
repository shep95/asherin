import type { CapacitorConfig } from "@capacitor/cli";

/**
 * ASHERIN NATIVE COMPANION
 *
 * The web Sentinel can only hear Bluetooth while its tab is open and in front.
 * The native shell exists to remove exactly that limit: a real app holds the
 * radio while backgrounded and while the screen is off, and — on Android — can
 * be relaunched by the OS after a reboot. No shell, native or otherwise, can
 * scan while the handset is fully powered down; the radio has no power then.
 * The UI states that boundary rather than implying a capability nobody has.
 */
const config: CapacitorConfig = {
  appId: "app.lovable.5d5e1e109f7147608dad575a93313745",
  appName: "ziali-magic-pixels",
  webDir: "dist",
  // Production origin. A staging/preview host here makes the shipped app load
  // preview content AND trips every "is this a preview build?" guard in the
  // web layer, which silently disables background work on a real handset.
  server: {
    url: "https://asherin.com",
    cleartext: false,
  },

  plugins: {
    BluetoothLe: {
      displayStrings: {
        scanning: "Sentinel is listening for nearby radios",
        cancel: "Stop",
        availableDevices: "Radios in range",
        noDeviceFound: "No radios in range",
      },
    },
    LocalNotifications: {
      smallIcon: "ic_stat_icon_config_sample",
    },
  },
  ios: {
    contentInset: "always",
  },
};

export default config;
