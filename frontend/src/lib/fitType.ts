import { LETTER_SIZES as FIT_SIZE_LADDER, normalizeSize } from "./sizes";
export { normalizeSize };

/**
 * Versión de una camiseta de fútbol. Define el corte y, con eso, qué talla
 * conviene pedir. Es opcional: null = no se indica y no se muestra nada.
 */
export type FitType = "player" | "fan" | "retro";

export const FIT_TYPES: FitType[] = ["player", "fan", "retro"];

export const FOOTBALL_CATEGORY_SLUG = "futbol";

export interface FitInfo {
  /** Nombre corto para chips y etiquetas. */
  label:    string;
  /** Cómo se describe el corte. */
  cut:      string;
  /** Qué es esta versión, en una frase. */
  about:    string;
  /** Cuántas tallas más se recomienda pedir. */
  sizeUp:   number;
  /** La recomendación, lista para mostrar. */
  advice:   string;
  /** 0 = muy ajustado, 1 = muy holgado. Para el medidor visual. */
  ease:     number;
  /** Texto corto para el formulario del admin. */
  adminHint: string;
}

export const FIT_INFO: Record<FitType, FitInfo> = {
  player: {
    label:  "Player",
    cut:    "Slim fit",
    about:  "La versión que usan los jugadores en la cancha: tela técnica más liviana y un corte ajustado al cuerpo.",
    sizeUp: 2,
    advice: "Viene más pequeña que una camiseta normal. Te recomendamos pedir dos tallas más de la que usás normalmente.",
    ease:   0.12,
    adminHint: "Slim fit · se recomiendan 2 tallas más",
  },
  fan: {
    label:  "Fan",
    cut:    "Corte regular",
    about:  "La versión de la afición: tela más resistente y un corte más holgado que la Player.",
    sizeUp: 1,
    advice: "Para que te quede más cómoda, te recomendamos pedir una talla más de la que usás normalmente.",
    ease:   0.62,
    adminHint: "Más holgada · se recomienda 1 talla más",
  },
  retro: {
    label:  "Retro",
    cut:    "Corte clásico",
    about:  "Inspirada en las camisetas de época, con el corte más suelto de esos años.",
    sizeUp: 1,
    advice: "Para que te quede más cómoda, te recomendamos pedir una talla más de la que usás normalmente.",
    ease:   0.72,
    adminHint: "Más holgada · se recomienda 1 talla más",
  },
};

export function isFitType(value: unknown): value is FitType {
  return typeof value === "string" && (FIT_TYPES as string[]).includes(value);
}

/** Lee la versión del nombre ("Argentina Messi casa Player" → player). */
export function fitFromName(name: string): FitType | null {
  if (/\bplayer\b/i.test(name)) return "player";
  if (/\bretro\b/i.test(name))  return "retro";
  if (/\bfan\b/i.test(name))    return "fan";
  return null;
}

/**
 * Talla a pedir para quien usa `usual` normalmente. null si se pasa de la
 * talla más grande (o la talla no es de letras).
 */
export function recommendedSize(usual: string, fit: FitType): string | null {
  const index = (FIT_SIZE_LADDER as readonly string[]).indexOf(normalizeSize(usual));
  if (index < 0) return null;
  return FIT_SIZE_LADDER[index + FIT_INFO[fit].sizeUp] ?? null;
}
