import type { ShippingMethod } from "../services/salesService";

// ── GAM Canton list ────────────────────────────────────────────────────────
// Only these specific cantons qualify for GAM rates.
// Source: Phase 15 spec.

export const GAM_CANTONS = new Set<string>([
  // San José
  "San José", "Escazú", "Desamparados", "Aserrí", "Mora", "Goicoechea",
  "Santa Ana", "Alajuelita", "Vázquez de Coronado", "Tibás", "Moravia",
  "Montes de Oca", "Curridabat",
  // Alajuela
  "Alajuela", "Atenas", "Poás", "San Mateo",
  // Heredia
  "Heredia", "Barva", "Santo Domingo", "Santa Bárbara", "San Rafael",
  "San Isidro", "Belén", "Flores", "San Pablo",
  // Cartago
  "Cartago", "Paraíso", "La Unión", "Alvarado", "Oreamuno", "El Guarco",
]);

export type Carrier = "mensajero" | "correos";

export interface ShippingResult {
  method: ShippingMethod;
  cost:   number;
}

// ── Helpers ────────────────────────────────────────────────────────────────

export function isGAMCanton(canton: string): boolean {
  return GAM_CANTONS.has(canton);
}

/**
 * Returns the carriers available for a given canton.
 * - Grecia        → [] (personal delivery, handled separately)
 * - GAM canton    → ["mensajero", "correos"]
 * - Rural canton  → ["correos"]
 */
export function getAvailableCarriers(canton: string): Carrier[] {
  if (canton === "Grecia") return [];
  return isGAMCanton(canton) ? ["mensajero", "correos"] : ["correos"];
}

/**
 * Default carrier for a canton.
 * GAM → mensajero (cheaper for the user in most cases).
 * Rural → correos (only option).
 */
export function getDefaultCarrier(canton: string): Carrier {
  return isGAMCanton(canton) ? "mensajero" : "correos";
}

/**
 * Core shipping calculator.
 * Rules:
 *   Grecia                      → personal_grecia,  ₡0
 *   GAM + mensajero + Cartago   → mensajero_cartago, ₡4,000
 *   GAM + mensajero             → mensajero_sjo,     ₡3,000
 *   GAM + correos               → correos_gam,       ₡2,500
 *   Rural + correos             → correos_fuera_gam, ₡3,000
 */
export function calculateShipping(
  province: string,
  canton:   string,
  carrier:  Carrier
): ShippingResult {
  if (canton === "Grecia") {
    return { method: "personal_grecia", cost: 0 };
  }

  if (carrier === "mensajero") {
    return province === "Cartago"
      ? { method: "mensajero_cartago", cost: 4000 }
      : { method: "mensajero_sjo",     cost: 3000 };
  }

  // correos
  return isGAMCanton(canton)
    ? { method: "correos_gam",       cost: 2500 }
    : { method: "correos_fuera_gam", cost: 3000 };
}
