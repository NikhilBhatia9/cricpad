/** Haptic feedback via Vibration API (no-op if unsupported) */

export function hapticLight() {
  try { navigator.vibrate?.(18) } catch { /* unsupported */ }
}

export function hapticMedium() {
  try { navigator.vibrate?.(35) } catch { /* unsupported */ }
}

export function hapticWicket() {
  try { navigator.vibrate?.([60, 40, 60]) } catch { /* unsupported */ }
}

export function hapticBoundary() {
  try { navigator.vibrate?.([30, 20, 30]) } catch { /* unsupported */ }
}
