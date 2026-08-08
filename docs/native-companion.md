# Asherin Native Companion (Capacitor)

The web Sentinel only hears Bluetooth while its tab is open and focused. The
companion app removes that limit: the OS keeps the radio alive while the app is
backgrounded and while the screen is off. Nothing scans while the handset is
fully powered down — the radio is unpowered — so the log resumes at boot.

## Build it on your machine

1. Export to GitHub, then `git pull` your repo.
2. `npm install`
3. `npx cap add ios` and/or `npx cap add android`
4. `npm run build`
5. `npx cap sync`
6. `npx cap run android` (Android Studio) or `npx cap run ios` (Xcode on macOS)

`capacitor.config.ts` points `server.url` at the Lovable sandbox preview, so the
app hot-reloads against the live build. Remove that `server` block before
shipping to the stores so the app serves the bundled `dist/`.

Run `npx cap sync` after every `git pull` that touches native capability.

## Required native permissions

### Android — `android/app/src/main/AndroidManifest.xml`

```xml
<uses-permission android:name="android.permission.BLUETOOTH_SCAN"
    android:usesPermissionFlags="neverForLocation" tools:targetApi="s" />
<uses-permission android:name="android.permission.BLUETOOTH_CONNECT" tools:targetApi="s" />
<uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />
<uses-permission android:name="android.permission.ACCESS_BACKGROUND_LOCATION" />
<uses-permission android:name="android.permission.FOREGROUND_SERVICE" />
<uses-permission android:name="android.permission.POST_NOTIFICATIONS" />
```

Drop `neverForLocation` if you want the sweep correlated with position — the
Sentinel's "different place?" signal depends on a location fix.

### iOS — `ios/App/App/Info.plist`

```xml
<key>NSBluetoothAlwaysUsageDescription</key>
<string>Asherin listens for nearby Bluetooth radios to detect devices that follow you.</string>
<key>NSLocationAlwaysAndWhenInUseUsageDescription</key>
<string>Asherin correlates radio sightings with location to tell a repeat encounter from a coincidence.</string>
<key>UIBackgroundModes</key>
<array>
  <string>bluetooth-central</string>
  <string>location</string>
</array>
```

iOS rotates advertisement identifiers for privacy, so recurrence on iOS leans on
manufacturer data plus timing rather than a stable address.

Read more: https://lovable.dev/blog/2025-05-14-mobile-app-development-lovable-capacitor
