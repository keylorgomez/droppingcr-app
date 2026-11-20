import { parseAmountValue } from "./money";

export type RefundMode = "all" | "part" | "none";

/**
 * Cuánto se devuelve al cancelar según la opción elegida. null = falta
 * completar (una parte vacía o fuera de rango). Nunca más de lo pagado.
 */
export function refundAmountFor(mode: RefundMode | null, partial: string, paid: number): number | null {
  if (mode === "all")  return paid;
  if (mode === "none") return 0;
  if (mode === "part") {
    const amount = parseAmountValue(partial);
    return amount > 0 && amount < paid ? amount : null;
  }
  return null;
}
