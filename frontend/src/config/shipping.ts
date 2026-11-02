import type { ShippingMethod } from "../services/salesService";
import { normalizeText } from "../lib/formatters";

// ── Rates ──────────────────────────────────────────────────────────────────
// Single source of truth for shipping prices. SHIPPING_OPTIONS in
// salesService reads from here so both sale entry points stay in sync.

export const SHIPPING_RATES = {
  MENSAJERO:         2500,
  CORREOS_GAM:       2800,
  CORREOS_FUERA_GAM: 3500,
} as const;

// ── GAM Canton list ────────────────────────────────────────────────────────
// Only these specific cantons qualify for Correos CR GAM rates.
// Source: Phase 15 spec.

export const GAM_CANTONS = new Set<string>([
  // San José
  "San José", "Escazú", "Desamparados", "Aserrí", "Mora", "Goicoechea",
  "Santa Ana", "Alajuelita", "Vásquez de Coronado", "Tibás", "Moravia",
  "Montes de Oca", "Curridabat",
  // Alajuela
  "Alajuela", "Atenas", "Poás", "San Mateo",
  // Heredia
  "Heredia", "Barva", "Santo Domingo", "Santa Bárbara", "San Rafael",
  "San Isidro", "Belén", "Flores", "San Pablo",
  // Cartago
  "Cartago", "Paraíso", "La Unión", "Alvarado", "Oreamuno", "El Guarco",
].map(normalizeText));

// ── Mensajería ABM coverage ────────────────────────────────────────────────
// Source: "Tabla de Cobertura ABM" (PDF from the courier).
// Covered districts per canton; names match CR_LOCATIONS. Any canton not in
// this map — or any district not listed — is outside coverage.

export const MENSAJERO_COVERAGE: Record<string, string[]> = {
  // San José
  "San José":            ["Carmen", "Merced", "Hospital", "Catedral", "Zapote", "San Francisco de Dos Ríos",
                          "Uruca", "Mata Redonda", "Pavas", "Hatillo", "San Sebastián"],
  "Escazú":              ["Escazú", "San Antonio", "San Rafael"],
  "Desamparados":        ["Desamparados", "San Miguel", "San Juan de Dios", "San Rafael Arriba", "San Antonio",
                          "Patarrá", "San Rafael Abajo", "Gravilias", "Los Guido"],
  "Aserrí":              ["Aserrí", "Salitrillos"],
  "Mora":                ["Colón"],
  "Goicoechea":          ["Guadalupe", "San Francisco", "Calle Blancos", "Mata de Plátano", "Ipís",
                          "Rancho Redondo", "Purral"],
  "Santa Ana":           ["Santa Ana", "Salitral", "Pozos", "Uruca", "Piedades", "Brasil"],
  "Alajuelita":          ["Alajuelita", "San Josecito", "San Antonio", "Concepción", "San Felipe"],
  "Vásquez de Coronado": ["San Isidro", "San Rafael", "Dulce Nombre de Jesús", "Patalillo"],
  "Tibás":               ["San Juan", "Cinco Esquinas", "Anselmo Llorente", "León XIII", "Colima"],
  "Moravia":             ["San Vicente", "San Jerónimo", "La Trinidad"],
  "Montes de Oca":       ["San Pedro", "Sabanilla", "Mercedes", "San Rafael"],
  "Curridabat":          ["Curridabat", "Granadilla", "Sánchez", "Tirrases"],
  // Alajuela
  "Alajuela":            ["Alajuela", "San José", "San Antonio", "Guácima", "San Rafael", "Río Segundo",
                          "Desamparados"],
  // Cartago
  "Cartago":             ["Oriental", "Occidental", "Carmen", "San Nicolás", "Aguacaliente o San Francisco",
                          "Guadalupe o Arenilla", "Dulce Nombre"],
  "Paraíso":             ["Paraíso", "Llanos de Santa Lucía"],
  "La Unión":            ["Tres Ríos", "San Diego", "San Juan", "San Rafael", "Concepción", "Dulce Nombre",
                          "San Ramón", "Río Azul"],
  "Oreamuno":            ["San Rafael"],
  "El Guarco":           ["El Tejar"],
  // Heredia
  "Heredia":             ["Heredia", "Mercedes", "San Francisco", "Ulloa"],
  "Barva":               ["Barva", "San Pedro", "San Pablo", "San Roque", "Santa Lucía"],
  "Santo Domingo":       ["Santo Domingo", "San Vicente", "San Miguel", "Paracito", "Santo Tomás",
                          "Santa Rosa", "Tures", "Pará"],
  "Santa Bárbara":       ["Santa Bárbara", "San Pedro", "San Juan", "Jesús"],
  "San Rafael":          ["San Rafael", "San Josecito", "Santiago", "Concepción"],
  "San Isidro":          ["San Isidro", "San José", "Concepción", "San Francisco"],
  "Belén":               ["San Antonio", "La Ribera", "La Asunción"],
  "Flores":              ["San Joaquín", "Barrantes", "Llorente"],
  "San Pablo":           ["San Pablo", "Rincón de Sabanilla"],
};

export type Carrier = "mensajero" | "correos";

export interface ShippingResult {
  method: ShippingMethod;
  cost:   number;
}

// ── Helpers ────────────────────────────────────────────────────────────────

export function isGAMCanton(canton: string): boolean {
  return GAM_CANTONS.has(normalizeText(canton));
}

/** True when the canton has at least one district the courier covers. */
export function cantonHasMensajero(canton: string): boolean {
  return canton in MENSAJERO_COVERAGE;
}

/** True when this specific district is inside Mensajería ABM coverage. */
export function isMensajeroCovered(canton: string, district: string): boolean {
  const covered = MENSAJERO_COVERAGE[canton];
  if (!covered || !district) return false;
  const target = normalizeText(district);
  return covered.some((name) => normalizeText(name) === target);
}

/**
 * Returns the carriers available for a given canton + district.
 * - Grecia               → [] (personal delivery, handled separately)
 * - Covered by ABM       → ["mensajero", "correos"]
 * - Anywhere else        → ["correos"]
 */
export function getAvailableCarriers(canton: string, district: string): Carrier[] {
  if (canton === "Grecia") return [];
  return isMensajeroCovered(canton, district) ? ["mensajero", "correos"] : ["correos"];
}

/**
 * Default carrier for a canton + district.
 * Covered → mensajero (cheapest option). Otherwise → correos (only option).
 */
export function getDefaultCarrier(canton: string, district: string): Carrier {
  return isMensajeroCovered(canton, district) ? "mensajero" : "correos";
}

/**
 * Core shipping calculator.
 * Rules:
 *   Grecia               → personal_grecia,   ₡0
 *   mensajero            → mensajero_sjo,     ₡2,500 (flat, any covered district)
 *   GAM + correos        → correos_gam,       ₡2,800
 *   Fuera GAM + correos  → correos_fuera_gam, ₡3,500
 *
 * mensajero_sjo is kept as the stored value for every mensajero delivery so
 * existing rows and any DB constraint keep working; mensajero_cartago is now
 * legacy and only appears on historical sales.
 */
export function calculateShipping(canton: string, carrier: Carrier): ShippingResult {
  if (canton === "Grecia") {
    return { method: "personal_grecia", cost: 0 };
  }

  if (carrier === "mensajero") {
    return { method: "mensajero_sjo", cost: SHIPPING_RATES.MENSAJERO };
  }

  return isGAMCanton(canton)
    ? { method: "correos_gam",       cost: SHIPPING_RATES.CORREOS_GAM }
    : { method: "correos_fuera_gam", cost: SHIPPING_RATES.CORREOS_FUERA_GAM };
}
