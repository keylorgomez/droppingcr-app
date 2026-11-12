// ── Reparto de utilidades ────────────────────────────────────────────────────
// Parte de la utilidad neta que se puede repartir entre los admins; el resto
// queda como fondo del negocio (recompras, imprevistos, temporada baja).

export const PAYOUT_SHARE = 0.6;

export const PAYOUT_SHARE_LABEL = `${Math.round(PAYOUT_SHARE * 100)}% distribuible · ${Math.round((1 - PAYOUT_SHARE) * 100)}% fondo del negocio`;

/**
 * Cuánto se puede repartir hoy.
 * - `rule`: lo que todavía permite la regla del 60% sobre la utilidad neta
 *   histórica (negativo si ya se pasaron).
 * - `allowed`: eso, pero nunca más que la caja (lo que falta cobrar no se
 *   reparte). Nunca negativo.
 * La caja es además el tope duro: la base rechaza un reparto mayor.
 */
export function payoutAllowance(netProfit: number, distributed: number, cash: number) {
  const rule = Math.round(netProfit * PAYOUT_SHARE) - distributed;
  return { rule, allowed: Math.max(0, Math.min(rule, cash)) };
}
