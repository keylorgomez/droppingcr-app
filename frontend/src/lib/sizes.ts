export type SizeKind = "clothing" | "shoes";

/** Calzado (EUR/US) → tabla de pie; letras → ropa; "Única" u otras → sin guía. */
/**
 * Calzado: la talla dice EUR/US, o es un número de calzado EUR (35–48).
 * 28–34 son pantalones.
 */
export function isShoeSize(raw: string): boolean {
  const s = raw.trim();
  if (/\b(EUR?|US)\b/i.test(s)) return true;
  if (!/^\d+(\.5)?$/.test(s)) return false;
  // Solo números EUR: un "5" suelto es un balón, no un zapato.
  const n = Number(s);
  return n >= 35 && n <= 48;
}

export function sizeKind(sizes: string[]): SizeKind | null {
  if (sizes.length === 0) return null;
  if (sizes.every(isShoeSize)) return "shoes";
  if (sizes.some((s) => /^(X{0,3}S|M|X{0,3}L|\d?XL)$/i.test(s.trim()))) return "clothing";
  return null;
}


/** Tallas de letra de menor a mayor, ya normalizadas. */
export const LETTER_SIZES = ["XS", "S", "M", "L", "XL", "XXL", "3XL", "4XL"] as const;

/**
 * Clave de una talla para comparar y filtrar: "XLL" y "2XL" son "XXL",
 * "XXXL" es "3XL" y en calzado manda el número EUR ("42 EUR / 9 US" → "42 EUR").
 */
export function normalizeSize(size: string): string {
  const s = size.trim().toUpperCase();
  if (s === "XLL" || s === "2XL") return "XXL";
  if (s === "XXXL") return "3XL";
  const eur = s.match(/^(\d+(?:\.5)?)\s*EUR\b/) ?? s.match(/\bEUR\s*(\d+(?:\.5)?)$/);
  if (eur) return `${eur[1]} EUR`;
  return s;
}

/**
 * Orden para mostrar tallas: letras de menor a mayor, después números
 * (pantalón, calzado) y al final lo demás ("Talla Única", "Ajustable").
 */
export function compareSizes(a: string, b: string): number {
  const rank = (size: string): [number, number] => {
    const letter = (LETTER_SIZES as readonly string[]).indexOf(normalizeSize(size));
    if (letter >= 0) return [0, letter];
    const num = parseFloat(size);
    if (!Number.isNaN(num)) return [1, num];
    return [2, 0];
  };
  const [groupA, valueA] = rank(a);
  const [groupB, valueB] = rank(b);
  if (groupA !== groupB) return groupA - groupB;
  if (valueA !== valueB) return valueA - valueB;
  return a.localeCompare(b, "es");
}

export type SizeGroup = "ropa" | "calzado";

/**
 * Grupo de una talla para los filtros. null = no sirve para filtrar
 * ("Talla Única", "Ajustable"): le queda a cualquiera.
 */
export function sizeGroup(size: string): SizeGroup | null {
  if (isShoeSize(size)) return "calzado";
  if ((LETTER_SIZES as readonly string[]).includes(normalizeSize(size))) return "ropa";
  if (/^\d+(\.5)?$/.test(size.trim())) return "ropa"; // pantalones 28–34
  return null;
}

// ── Registro de tallas (admin) ─────────────────────────────────────────────

/** Qué tallas lleva un producto, según su categoría. */
export type ProductSizeKind = "ropa" | "calzado" | "unica";

const SHOE_CATEGORIES   = ["tenis"];
const ONESIZE_CATEGORIES = ["gorras", "medias", "panoletas", "bolsos", "lentes", "balones"];

export function productSizeKind(categorySlugs: string[]): ProductSizeKind {
  if (categorySlugs.some((slug) => SHOE_CATEGORIES.includes(slug)))   return "calzado";
  // Fútbol mezcla camisetas, balones y tacos: no define el tipo por sí sola.
  const specific = categorySlugs.filter((slug) => slug !== "futbol");
  if (specific.length > 0 && specific.every((slug) => ONESIZE_CATEGORIES.includes(slug))) return "unica";
  return "ropa";
}

export const SIZE_PRESETS: Record<ProductSizeKind, { label: string; sizes: string[] }> = {
  ropa:    { label: "Ropa",        sizes: [...LETTER_SIZES] },
  calzado: { label: "Calzado",     sizes: ["36", "37", "38", "39", "40", "40.5", "41", "41.5", "42", "42.5", "43", "44", "45"].map((n) => `${n} EUR`) },
  unica:   { label: "Talla única", sizes: ["Talla Única", "Ajustable"] },
};

/**
 * Deja la talla en el formato de la tienda (igual que `normalize_size` en la
 * base): "2xl" → "XXL", "42" (calzado) → "42 EUR", "US 9 / EUR 42.5" →
 * "42.5 EUR / 9 US", "unica" → "Talla Única". Lo que no reconoce queda igual.
 */
export function normalizeSizeInput(raw: string, isShoe = false): string {
  const s = raw.trim().replace(/\s+/g, " ");
  if (!s) return s;
  const upper = s.toUpperCase();
  if (upper === "2XL" || upper === "XLL") return "XXL";
  if (upper === "XXXL") return "3XL";
  if ((LETTER_SIZES as readonly string[]).includes(upper)) return upper;
  const lower = s.toLowerCase();
  if (["talla única", "talla unica", "única", "unica"].includes(lower)) return "Talla Única";
  if (lower === "ajustable") return "Ajustable";
  let m = s.match(/^US\s*(\d+(?:\.5)?)\s*\/\s*EUR\s*(\d+(?:\.5)?)$/i);
  if (m) return `${m[2]} EUR / ${m[1]} US`;
  m = s.match(/^(\d+(?:\.5)?)\s*EUR\s*\/\s*(\d+(?:\.5)?)\s*US$/i);
  if (m) return `${m[1]} EUR / ${m[2]} US`;
  m = s.match(/^(\d+(?:\.5)?)\s*EUR$/i);
  if (m) return `${m[1]} EUR`;
  if (isShoe && /^(3[5-9]|4[0-8])(\.5)?$/.test(s)) return `${s} EUR`;
  return s;
}

/** Tallas repetidas una vez normalizadas ("2XL" y "XXL" son la misma). */
export function duplicateSizes(sizes: string[]): string[] {
  const seen = new Set<string>();
  const dup  = new Set<string>();
  for (const size of sizes.map((x) => normalizeSize(x.trim())).filter(Boolean)) {
    if (seen.has(size)) dup.add(size);
    seen.add(size);
  }
  return [...dup];
}
