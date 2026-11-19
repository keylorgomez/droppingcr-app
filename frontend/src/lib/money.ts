/**
 * Montos en los formularios: se escriben con separador de miles a la vista
 * ("12,500.50") pero el estado guarda el número limpio ("12500.50"), así que
 * `Number(valor)` sigue funcionando en todos lados.
 *
 * Convención de la app (igual que `fmt`): coma para miles, punto para decimales.
 */

/**
 * Texto del campo → número limpio como string ("₡12,500.5" → "12500.5").
 * La coma siempre es de miles (la pone el propio campo); el punto es decimal.
 * Quien escribe con teclado en español y toca "," para decimales lo resuelve
 * MoneyInput antes de llegar acá.
 */
export function cleanAmount(text: string, decimals = 2): string {
  const s = text.replace(/[^\d.]/g, "");
  const dot = s.indexOf(".");
  const intPart = (dot === -1 ? s : s.slice(0, dot)).replace(/^0+(?=\d)/, "");
  if (dot === -1 || decimals === 0) return intPart;
  const decPart = s.slice(dot + 1).replace(/\./g, "").slice(0, decimals);
  return `${intPart || "0"}.${decPart}`;
}

/** Número limpio → como se muestra en el campo ("12500.5" → "12,500.5"). */
export function displayAmount(raw: string): string {
  if (raw === "") return "";
  const [intPart, decPart] = raw.split(".");
  const grouped = (intPart || "0").replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return decPart === undefined ? grouped : `${grouped}.${decPart}`;
}

/** Monto del formulario → número (vacío o inválido = 0). */
export function parseAmountValue(raw: string): number {
  const n = Number(raw);
  return Number.isFinite(n) ? n : 0;
}
