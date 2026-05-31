// Centralized React Query key registry.
// All useQuery / invalidateQueries calls must reference these constants.

export const QUERY_KEYS = {
  // ── Products ──────────────────────────────────────────────────────────────
  PRODUCTS:                ["products"]                    as const,
  PRODUCT:                 (idOrSlug: string) =>           ["product", idOrSlug]  as const,
  CATEGORIES:              ["categories"]                  as const,
  CATEGORIES_ADMIN:        ["categories-admin"]            as const,
  PRODUCTS_WITH_VARIANTS:  ["products-admin"]              as const,

  // ── Orders & Sales (admin) ────────────────────────────────────────────────
  ADMIN_SALES:          ["admin-sales"]            as const,
  ADMIN_ORDERS:         ["admin-orders"]           as const,

  // ── Debts ─────────────────────────────────────────────────────────────────
  GROUPED_DEBTS:        ["grouped-debts"]          as const,

  // ── Payments & Refunds ────────────────────────────────────────────────────
  PAYMENTS_LOG:         ["payments-log"]           as const,
  EXPENSE_PAYMENTS_LOG: ["expense-payments-log"]   as const,
  PAYMENTS_LOG_FULL:    ["payments-log-full"]      as const,
  REFUNDS_LOG:          ["refunds-log"]            as const,

  // ── Expenses ──────────────────────────────────────────────────────────────
  EXPENSES:             ["expenses"]               as const,

  // ── Payouts ───────────────────────────────────────────────────────────────
  ADMIN_PAYOUTS:        ["admin-payouts"]          as const,
  ADMIN_USERS:          ["admin-users"]            as const,
  NET_PROFIT_ALL:       ["net-profit-all"]         as const,
  TOTAL_DISTRIBUTED:    ["total-distributed"]      as const,

  // ── Dashboard ─────────────────────────────────────────────────────────────
  DASH_STATS:           ["dash-stats"]             as const,
  DASH_AREA:            ["dash-area"]              as const,
  DASH_TOP:             ["dash-top"]               as const,
  DASH_PIE:             ["dash-pie"]               as const,

  // ── User ──────────────────────────────────────────────────────────────────
  MY_ORDERS:            (userId: string) =>        ["my-orders",  userId] as const,
  MY_PAYOUTS:           (userId: string) =>        ["my-payouts", userId] as const,
} as const;
