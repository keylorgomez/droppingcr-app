/**
 * Feature Flags — temporadas y campañas
 *
 * Para desactivar una campaña manualmente: cambia `enabled: true` → `false`.
 * Si tiene `expiresAt`, se desactiva solo al pasar esa fecha (sin tocar nada).
 */

function isActive(flag: { enabled: boolean; expiresAt?: string }): boolean {
  if (!flag.enabled) return false;
  if (flag.expiresAt && new Date() > new Date(flag.expiresAt)) return false;
  return true;
}

export const FLAGS = {
  worldCup2026: {
    enabled:   true,
    expiresAt: "2026-07-20", // Final del Mundial 2026 — 19 jul 2026
  },
} as const;

export const FEATURES = {
  /** Diseño temático en cards y modal promocional del Mundial 2026 */
  worldCup2026: isActive(FLAGS.worldCup2026),
};
