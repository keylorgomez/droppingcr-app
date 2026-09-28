// Business-level constants that are not domain/data related.
// Update these when contact info or branding changes.

export const STORE_WHATSAPP = "50688364879";

export const MS_PER_DAY = 86_400_000;

// Rutas públicas. El catálogo dejó de vivir en "/" cuando la home pasó a ser
// una landing editorial; centralizarlas evita links rotos al moverlas otra vez.
export const ROUTES = {
  HOME:    "/",
  CATALOG: "/catalogo",
  CART:    "/carrito",
  PRODUCT: (slug: string) => `/product/${slug}`,
  catalogFilter: (slug: string) => `/catalogo?filter=${slug}`,
} as const;

// Frases de la cinta superior — tono de marca, no copy funcional.
export const MARQUEE_ITEMS = [
  "LIMITED DROPS",
  "GLOBAL DRIP",
  "GRECIA · CR",
  "ENVÍOS A TODO EL PAÍS",
  "PIEZAS ÚNICAS",
  "VINTAGE FITS",
] as const;

// ── Imágenes de campaña ────────────────────────────────────────────────────
// Sirven para curar la portada con fotos elegidas a mano en vez de depender del
// inventario. Los archivos van en `public/hero/` y `public/categorias/` y se
// referencian con ruta absoluta ("/hero/foto.jpg"); también acepta URLs de
// Cloudinary, que además se sirven optimizadas.
//
// El hero las pasa a escala de grises por CSS: subí las fotos a color, no hace
// falta editarlas.

/** Fotos del carrusel del hero. Vacío = usa las fotos más recientes del catálogo. */
export const HERO_IMAGES: string[] = [
  "/hero/01-creativity.jpg",
  "/hero/02-olise.jpg",
  "/hero/03-noche.jpg",
  "/hero/04-gimenez.jpg",
  "/hero/05-keeptrying.jpg",
  "/hero/06-coldculture.jpg",
];

/**
 * Tope de fotos del carrusel. Vive acá y no dentro del hero porque el recorte
 * se aplica en dos lugares (la lista curada y el respaldo del inventario); con
 * el número suelto en cada uno, agregar una foto la descartaba en silencio.
 */
export const MAX_HERO_SLIDES = 6;

/** Foto fija por categoría (slug → ruta). Lo que falte usa la foto de un producto. */
export const CATEGORY_IMAGES: Record<string, string> = {
  camisetas: "/categorias/camisetas.jpg",
  tenis:     "/categorias/tenis.jpg",
  futbol:    "/categorias/futbol.jpg",
};
