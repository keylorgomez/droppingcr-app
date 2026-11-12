import { supabase } from "../lib/supabaseClient";
import { DELIVERY_STATUSES } from "./salesService";

// Todos los montos se calculan en la base (finance_summary, top_products,
// daily_sales sobre la vista sale_lines). Antes la misma fórmula vivía en
// cuatro servicios con diferencias entre sí, y bajar tablas enteras al
// navegador se iba a cortar en 1000 filas sin avisar.

// ── Periodos ───────────────────────────────────────────────────────────────

export type Period = "month" | "last_month" | "30d" | "year" | "all";

export const PERIOD_LABELS: Record<Period, string> = {
  month:      "Este mes",
  last_month: "Mes pasado",
  "30d":      "30 días",
  year:       "Este año",
  all:        "Todo",
};

export interface PeriodRange { from: Date | null; to: Date | null; }

export function periodRange(period: Period, now = new Date()): PeriodRange {
  const y = now.getFullYear();
  const m = now.getMonth();
  switch (period) {
    case "month":      return { from: new Date(y, m, 1),     to: null };
    case "last_month": return { from: new Date(y, m - 1, 1), to: new Date(y, m, 1) };
    case "year":       return { from: new Date(y, 0, 1),     to: null };
    case "30d": {
      const from = new Date(now);
      from.setDate(from.getDate() - 29);
      from.setHours(0, 0, 0, 0);
      return { from, to: null };
    }
    case "all":        return { from: null, to: null };
  }
}

/** El periodo anterior equivalente, para comparar (▲/▼). */
export function previousRange(period: Period, now = new Date()): PeriodRange | null {
  const y = now.getFullYear();
  const m = now.getMonth();
  switch (period) {
    // "Este mes" se compara contra el mismo tramo del mes pasado (día 1 → hoy).
    case "month":      return { from: new Date(y, m - 1, 1), to: new Date(y, m - 1, now.getDate() + 1) };
    case "last_month": return { from: new Date(y, m - 2, 1), to: new Date(y, m - 1, 1) };
    case "year":       return { from: new Date(y - 1, 0, 1), to: new Date(y - 1, m, now.getDate() + 1) };
    case "30d": {
      const to   = periodRange("30d", now).from!;
      const from = new Date(to);
      from.setDate(from.getDate() - 30);
      return { from, to };
    }
    case "all":        return null;
  }
}

const iso = (date: Date | null) => (date ? date.toISOString() : null);

// ── Resumen financiero ─────────────────────────────────────────────────────

export interface FinanceSummary {
  // Del periodo
  revenue:             number;  // ventas de mercadería, sin envío
  cost:                number;  // costo de lo vendido
  gross_margin:        number;  // revenue − cost
  operating_expenses:  number;  // gastos operativos (no compra de mercadería)
  inventory_purchases: number;  // compras de mercadería registradas como gasto
  net_profit:          number;  // gross_margin − operating_expenses
  units:               number;
  tickets:             number;
  shipping_collected:  number;  // envío cobrado al cliente (dinero de paso)
  shipping_paid:       number;  // pagado a Correos / mensajero (dinero de paso)
  // A hoy
  receivables:         number;  // lo que falta cobrar
  distributed:         number;  // ya repartido a admins, neto de ajustes
  adjustments:         number;  // ajustes de conciliación (finance_adjustments)
  all_time_net:        number;  // utilidad neta histórica
  available:           number;  // caja del negocio: all_time_net − receivables − distributed
  stock_cost:          number;  // inventario en bodega, a costo
  special_order_advances: number;  // adelantos de encargos sin entregar (plata del cliente)
  special_orders_active:  number;
}

export async function getFinanceSummary(range: PeriodRange): Promise<FinanceSummary> {
  const { data, error } = await supabase.rpc("finance_summary", {
    p_from: iso(range.from),
    p_to:   iso(range.to),
  });
  if (error) throw new Error(error.message);

  // numeric puede llegar como string desde PostgREST.
  const raw = data as Record<string, string | number>;
  return Object.fromEntries(
    // Colones enteros: los costos con decimales dejaban montos como ₡917,376.97.
    Object.entries(raw).map(([key, value]) => [key, Math.round(Number(value) || 0)])
  ) as unknown as FinanceSummary;
}

// ── Serie diaria ───────────────────────────────────────────────────────────

export interface DayData {
  date:   string;   // "1 nov"
  ventas: number;
  costos: number;
}

function dayLabel(date: Date) {
  return date.toLocaleDateString("es-CR", { day: "numeric", month: "short" });
}

function toKey(date: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** Ventas vs. costo por día; los días sin ventas van en cero. "Todo" muestra 12 meses. */
export async function getDailySales(range: PeriodRange): Promise<DayData[]> {
  const to   = range.to ?? new Date(Date.now() + 86_400_000);
  const from = range.from ?? new Date(to.getFullYear() - 1, to.getMonth(), to.getDate());

  const { data, error } = await supabase.rpc("daily_sales", {
    p_from: from.toISOString(),
    p_to:   to.toISOString(),
  });
  if (error) throw new Error(error.message);

  const byDay = new Map<string, { revenue: number; cost: number }>();
  for (const row of (data ?? []) as { day: string; revenue: string | number; cost: string | number }[]) {
    byDay.set(row.day, { revenue: Number(row.revenue) || 0, cost: Number(row.cost) || 0 });
  }

  const days: DayData[] = [];
  const cursor = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  const last   = new Date(Math.min(to.getTime() - 1, Date.now()));
  while (cursor <= last) {
    const entry = byDay.get(toKey(cursor));
    days.push({ date: dayLabel(cursor), ventas: entry?.revenue ?? 0, costos: entry?.cost ?? 0 });
    cursor.setDate(cursor.getDate() + 1);
  }
  return days;
}

// ── Top productos ──────────────────────────────────────────────────────────

export interface TopProduct {
  name:    string;
  revenue: number;
  units:   number;
  margin:  number;
}

export async function getTopProducts(limit: number, range: PeriodRange): Promise<TopProduct[]> {
  const { data, error } = await supabase.rpc("top_products", {
    p_limit: limit,
    p_from:  iso(range.from),
    p_to:    iso(range.to),
  });
  if (error) throw new Error(error.message);

  return ((data ?? []) as Record<string, string | number>[]).map((row) => ({
    name:    String(row.name),
    revenue: Number(row.revenue) || 0,
    units:   Number(row.units)   || 0,
    margin:  Number(row.margin)  || 0,
  }));
}

// ── Estados de entrega ─────────────────────────────────────────────────────

export interface StatusSlice {
  name:  string;
  value: number;
  color: string;
}

const STATUS_COLORS: Record<string, string> = {
  validating: "#f59e0b",
  apartada:   "#e8c468",
  confirmed:  "#f97316",
  shipped:    "#3b82f6",
  delivered:  "#22c55e",
};

/** Pedidos del periodo por estado de entrega (sin canceladas). */
export async function getDeliveryStatusDistribution(range: PeriodRange): Promise<StatusSlice[]> {
  const build = (table: "sales" | "orders") => {
    let query = supabase.from(table).select("delivery_status").neq("status", "cancelled");
    if (range.from) query = query.gte("sold_at", range.from.toISOString());
    if (range.to)   query = query.lt("sold_at", range.to.toISOString());
    return query;
  };

  const [salesResult, ordersResult] = await Promise.all([build("sales"), build("orders")]);
  if (salesResult.error)  throw new Error(salesResult.error.message);
  if (ordersResult.error) throw new Error(ordersResult.error.message);

  const counts = new Map<string, number>();
  for (const row of [...(salesResult.data ?? []), ...(ordersResult.data ?? [])] as { delivery_status: string | null }[]) {
    const key = row.delivery_status ?? "validating";
    if (key === "cancelled") continue;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  return [...counts.entries()]
    .map(([value, count]) => ({
      name:  DELIVERY_STATUSES.find((status) => status.value === value)?.label ?? value,
      value: count,
      color: STATUS_COLORS[value] ?? "#9ca3af",
    }))
    .sort((a, b) => b.value - a.value);
}

// ── Piezas quietas ─────────────────────────────────────────────────────────

export interface StaleProduct {
  product_id:   string;
  name:         string;
  slug:         string;
  units:        number;
  stock_cost:   number;
  days_listed:  number;
  last_sold_at: string | null;
}

/** Con stock, publicadas hace más de `days` días y sin ventas en ese tiempo. */
export async function getStaleInventory(days = 60): Promise<StaleProduct[]> {
  const { data, error } = await supabase.rpc("stale_inventory", { p_days: days });
  if (error) throw new Error(error.message);
  return ((data ?? []) as Record<string, string | number | null>[]).map((row) => ({
    product_id:   String(row.product_id),
    name:         String(row.name),
    slug:         String(row.slug),
    units:        Number(row.units) || 0,
    stock_cost:   Math.round(Number(row.stock_cost) || 0),
    days_listed:  Number(row.days_listed) || 0,
    last_sold_at: row.last_sold_at ? String(row.last_sold_at) : null,
  }));
}

// ── Exportar a CSV ─────────────────────────────────────────────────────────

const CSV_HEADERS = ["Fecha", "Tipo", "Cliente", "Teléfono", "Producto", "Talla", "Cantidad", "Ingreso", "Costo", "Margen", "Envío", "Estado"];
const STATUS_ES: Record<string, string> = { completed: "Pagada", pending: "Pendiente" };

export function toCsv(rows: (string | number | null)[][]): string {
  const cell = (v: string | number | null) => {
    const s = v == null ? "" : String(v);
    return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  // BOM: sin él Excel abre los acentos como "Ã©".
  return "﻿" + rows.map((r) => r.map(cell).join(",")).join("\r\n");
}

/** Descarga las ventas del periodo como CSV (abre en Excel / Google Sheets). */
export async function downloadSalesCsv(range: PeriodRange, label: string): Promise<number> {
  const { data, error } = await supabase.rpc("sales_export", { p_from: iso(range.from), p_to: iso(range.to) });
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as Record<string, string | number | null>[];

  const body = rows.map((r) => [
    new Date(String(r.sold_at)).toLocaleDateString("es-CR"),
    r.source, r.customer, r.phone, r.product, r.size,
    Number(r.quantity) || 0,
    Math.round(Number(r.revenue) || 0),
    Math.round(Number(r.cost) || 0),
    Math.round(Number(r.margin) || 0),
    Math.round(Number(r.shipping) || 0),
    STATUS_ES[String(r.status)] ?? r.status,
  ]);

  const blob = new Blob([toCsv([CSV_HEADERS, ...body])], { type: "text/csv;charset=utf-8" });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href     = url;
  a.download = `ventas-dropping-${label.toLowerCase().replace(/\s+/g, "-")}.csv`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return rows.length;
}
