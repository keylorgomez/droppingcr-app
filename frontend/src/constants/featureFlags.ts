export const FLAGS = {
  discountBanner: {
    enabled: true,
  },
} as const;

export const FEATURES = {
  /** Tarjeta flotante que dirige a /?filter=descuentos cuando hay productos con descuento activo */
  discountBanner: FLAGS.discountBanner.enabled,
};
