/** Full currency — ₡12,500 */
export function fmt(n: number): string {
  return `₡${n.toLocaleString("en-US")}`;
}

/** Compact currency for summaries — ₡1.2M / ₡500k / ₡850 */
export function fmtCompact(n: number): string {
  if (n >= 1_000_000) return `₡${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `₡${(n / 1_000).toFixed(0)}k`;
  return `₡${n.toLocaleString("en-US")}`;
}

/** Date — "27 may. 2026" */
export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("es-CR", {
    day: "numeric", month: "short", year: "numeric",
  });
}

/** Time — "03:45 p. m." */
export function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("es-CR", {
    hour: "2-digit", minute: "2-digit",
  });
}

/**
 * Format phone for wa.me URLs — strips non-digits, prepends 506 if exactly 8 digits.
 * Returns null for empty/invalid input.
 */
export function formatPhone(raw: string | null): string | null {
  if (!raw) return null;
  const digits = raw.replace(/\D/g, "");
  if (!digits) return null;
  return digits.length === 8 ? `506${digits}` : digits;
}

/**
 * Normalize phone for matching — strips non-digits and keeps last 8 digits.
 * Handles +506XXXXXXXX, 506XXXXXXXX, or bare XXXXXXXX equally.
 */
export function normalizePhone(raw: string): string {
  return raw.replace(/\D/g, "").slice(-8);
}

/**
 * Normalize text for accent-insensitive search — lowercases and strips diacritics.
 */
export function normalizeText(text: string): string {
  return text.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
}

/**
 * Precio efectivo de un producto según su descuento.
 *
 * Este cálculo estaba repetido en la tarjeta, el detalle, la pieza destacada y
 * el modal de venta. Al no estar en el formulario de pedidos, ese formulario
 * cobraba el precio de lista aunque la pieza estuviera rebajada. Centralizarlo
 * es lo que evita que vuelva a desincronizarse.
 */
export function discountedPrice(priceSale: number, discountPercentage: number): number {
  if (!discountPercentage || discountPercentage <= 0) return priceSale;
  return Math.round(priceSale * (1 - discountPercentage / 100));
}

/**
 * ¿El texto contiene **todas** las palabras buscadas, en cualquier orden?
 *
 * Buscar la frase completa como una sola cadena obligaba a escribir el nombre
 * tal cual: "Brasil Player" no encontraba "Neymar Brasil visita Player" porque
 * las dos palabras no están pegadas. Partiendo la consulta y exigiendo que
 * aparezcan todas, se puede describir la pieza en vez de recordar su nombre.
 *
 * Cada palabra se busca por substring, así que "bras play" también sirve.
 */
export function matchesSearch(text: string, query: string): boolean {
  const terms = normalizeText(query).split(/\s+/).filter(Boolean);
  if (terms.length === 0) return true;

  const haystack = normalizeText(text);
  return terms.every((term) => haystack.includes(term));
}
