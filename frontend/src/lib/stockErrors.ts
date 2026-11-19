/** ¿El error viene de que la base no encontró stock? (decrement_variant_stock) */
export function isStockError(message: string | null | undefined): boolean {
  return !!message && /sin stock|stock insuficiente|se acaba de vender/i.test(message);
}
