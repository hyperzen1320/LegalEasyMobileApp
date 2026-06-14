import * as Device from "expo-device";
import * as ScreenOrientation from "expo-screen-orientation";

// Orientation policy: phones stay portrait (the app's layouts are built
// thumb-first), tablets rotate freely so the adaptive two-pane layouts
// can use landscape. Runtime control is the only mechanism that works in
// both Expo Go and dev builds — the static app.json field is ignored by
// Expo Go, which is why app.json says "default" and this does the work.

export async function applyOrientationPolicy(): Promise<void> {
  try {
    const type = await Device.getDeviceTypeAsync();
    if (type === Device.DeviceType.TABLET) {
      await ScreenOrientation.unlockAsync();
    } else {
      await ScreenOrientation.lockAsync(
        ScreenOrientation.OrientationLock.PORTRAIT_UP
      );
    }
  } catch {
    // Some environments (web, odd emulators) reject orientation calls;
    // the platform default is an acceptable fallback.
  }
}
