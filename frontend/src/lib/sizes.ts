export type SizeKind = "clothing" | "shoes";

/** Calzado (EUR/US) → tabla de pie; letras → ropa; "Única" u otras → sin guía. */
export function sizeKind(sizes: string[]): SizeKind | null {
  if (sizes.length === 0) return null;
  // Calzado: la talla dice EUR/US, o es un número de calzado EUR (36–48) o US
  // (4–15). 28–34 son pantalones.
  const isShoe = (raw: string) => {
    const s = raw.trim();
    if (/\b(EUR?|US)\b/i.test(s)) return true;
    if (!/^\d+(\.5)?$/.test(s)) return false;
    const n = Number(s);
    return (n >= 36 && n <= 48) || (n >= 4 && n <= 15);
  };
  if (sizes.every(isShoe)) return "shoes";
  if (sizes.some((s) => /^(X{0,3}S|M|X{0,3}L|\d?XL)$/i.test(s.trim()))) return "clothing";
  return null;
}

