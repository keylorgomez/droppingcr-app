// Texto propio para cada página de categoría (/catalogo/<slug>). Google
// necesita algo más que una grilla de fotos para entender de qué trata la
// página; al cliente le sirve una línea que le diga qué va a encontrar.
// Lo que no esté aquí usa un texto genérico con el nombre de la categoría.

export interface CategoryCopy {
  /** Título para Google y la pestaña. */
  title: string;
  /** Una o dos frases visibles bajo el título. */
  intro: string;
}

export const CATEGORY_COPY: Record<string, CategoryCopy> = {
  camisetas: {
    title: "Camisetas streetwear en Costa Rica",
    intro: "Camisetas de marcas streetwear, piezas únicas y por tallas. Envío a todo Costa Rica o entrega en Grecia.",
  },
  futbol: {
    title: "Camisetas de fútbol en Costa Rica",
    intro: "Camisetas de selecciones y clubes, por tallas. Envío a todo el país o entrega en Grecia.",
  },
  tenis: {
    title: "Tenis y sneakers en Costa Rica",
    intro: "Tenis y sneakers en tallas US. Revisá la guía de tallas en cada par y, si no está tu talla, lo traemos por encargo.",
  },
  abrigos: {
    title: "Abrigos, hoodies y jackets en Costa Rica",
    intro: "Hoodies, crewnecks y jackets streetwear. Medidas exactas de cada pieza por WhatsApp.",
  },
  gorras: {
    title: "Gorras streetwear en Costa Rica",
    intro: "Gorras y caps de marcas streetwear. Envío a todo Costa Rica.",
  },
  nuevo: {
    title: "Lo nuevo en Dropping CR",
    intro: "Lo último que entró a la tienda. Las piezas únicas se van rápido.",
  },
  descuentos: {
    title: "Streetwear en descuento en Costa Rica",
    intro: "Piezas rebajadas por tiempo limitado, con envío a todo Costa Rica.",
  },
};

export function categoryCopy(slug: string, name: string): CategoryCopy {
  return CATEGORY_COPY[slug] ?? {
    title: `${name} — streetwear en Costa Rica`,
    intro: `${name} en Dropping CR. Piezas únicas con envío a todo Costa Rica.`,
  };
}
