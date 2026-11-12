// ── Reparto de utilidades ────────────────────────────────────────────────────
// Parte de la utilidad neta que se puede repartir entre los admins; el resto
// queda como fondo del negocio (recompras, imprevistos, temporada baja).

export const PAYOUT_SHARE = 0.6;

export const PAYOUT_SHARE_LABEL = `${Math.round(PAYOUT_SHARE * 100)}% distribuible · ${Math.round((1 - PAYOUT_SHARE) * 100)}% fondo del negocio`;
