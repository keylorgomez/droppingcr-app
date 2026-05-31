/**
 * Domain value constants — single source of truth for all string enums.
 *
 * Use these in business logic comparisons and assignments instead of
 * inline string literals, e.g.:
 *   DELIVERY_STATUS.APARTADA   instead of  "apartada"
 *   SALE_STATUS.COMPLETED      instead of  "completed"
 *
 * The UI rendering arrays (DELIVERY_STATUSES, SHIPPING_OPTIONS) in
 * salesService derive their `value` fields from these constants.
 */

// ── Sale / order lifecycle ─────────────────────────────────────────────────

export const SALE_STATUS = {
  PENDING:   "pending",
  COMPLETED: "completed",
  CANCELLED: "cancelled",
} as const;

export type SaleStatusValue = typeof SALE_STATUS[keyof typeof SALE_STATUS];

// ── Delivery ───────────────────────────────────────────────────────────────

export const DELIVERY_STATUS = {
  VALIDATING: "validating",
  CONFIRMED:  "confirmed",
  APARTADA:   "apartada",
  SHIPPED:    "shipped",
  DELIVERED:  "delivered",
  CANCELLED:  "cancelled",
} as const;

export type DeliveryStatusValue = typeof DELIVERY_STATUS[keyof typeof DELIVERY_STATUS];

// ── Shipping methods ───────────────────────────────────────────────────────

export const SHIPPING_METHOD = {
  PERSONAL_GRECIA:   "personal_grecia",
  MENSAJERO_SJO:     "mensajero_sjo",
  MENSAJERO_CARTAGO: "mensajero_cartago",
  CORREOS_GAM:       "correos_gam",
  CORREOS_FUERA_GAM: "correos_fuera_gam",
} as const;

export type ShippingMethodValue = typeof SHIPPING_METHOD[keyof typeof SHIPPING_METHOD];

// ── Clothing sizes ─────────────────────────────────────────────────────────

export const CLOTHING_SIZES = {
  /** Canonical sort order for display — clothing → numeric → alpha fallback */
  SORT_ORDER: ["XS", "S", "M", "L", "XL", "XXL", "XLL", "XXXL", "2XL", "3XL", "4XL"] as const,

  /** Quick-add presets shown in the product form variant builder */
  QUICK_ADD: ["XS", "S", "M", "L", "XL", "XXL", "Talla Única"] as const,

  /** Size filter chips shown in the catalog */
  CATALOG_FILTER: ["XS", "S", "M", "L", "XL", "XXL"] as const,
} as const;
