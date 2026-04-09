import { supabase } from "../lib/supabaseClient";
import { DELIVERY_STATUSES } from "./salesService";

// ── Types ──────────────────────────────────────────────────────────────────

export interface DashboardStats {
  totalRevenue: number;   // sum of sale_price
  netProfit:    number;   // sum of (sale_price − cost_price)
  pendingDebt:  number;   // sum of remaining balances for 'pending' sales
  totalSales:   number;   // count of all sales
}

export interface DayData {
  date:   string;   // "1 may", "2 may" …
  ventas: number;
  costos: number;
}

export interface TopProduct {
  name:    string;
  revenue: number;
  units:   number;
}

export interface StatusSlice {
  name:  string;
  value: number;
  color: string;
}

// ── Colour map for delivery statuses ──────────────────────────────────────

const STATUS_COLORS: Record<string, string> = {
  validating: "#f59e0b",
  confirmed:  "#f97316",
  shipped:    "#3b82f6",
  delivered:  "#22c55e",
  cancelled:  "#ef4444",
};

// ── Helpers ────────────────────────────────────────────────────────────────

function dayKey(iso: string) {
  return new Date(iso).toLocaleDateString("es-CR", { day: "numeric", month: "short" });
}

function startOfDayOffset(daysAgo: number): string {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

// ── Queries ────────────────────────────────────────────────────────────────

export async function getDashboardStats(): Promise<DashboardStats> {
  const { data, error } = await supabase
    .from("sales")
    .select("sale_price, cost_price, shipping_cost, status, payments ( amount )");

  if (error) throw new Error(error.message);

  let totalRevenue = 0;
  let netProfit    = 0;
  let pendingDebt  = 0;

  for (const s of data ?? []) {
    totalRevenue += s.sale_price;
    netProfit    += s.sale_price - (s.cost_price ?? 0);

    if (s.status === "pending") {
      const paid  = ((s as any).payments ?? []).reduce((sum: number, p: any) => sum + p.amount, 0);
      const total = s.sale_price + (s.shipping_cost ?? 0);
      pendingDebt += Math.max(0, total - paid);
    }
  }

  return {
    totalRevenue,
    netProfit,
    pendingDebt,
    totalSales: (data ?? []).length,
  };
}

export async function getSalesVsCostsLast30Days(): Promise<DayData[]> {
  const { data, error } = await supabase
    .from("sales")
    .select("sale_price, cost_price, sold_at")
    .gte("sold_at", startOfDayOffset(29));

  if (error) throw new Error(error.message);

  // Pre-fill every day with zeros so the chart is always 30 bars
  const map = new Map<string, { ventas: number; costos: number }>();
  for (let i = 29; i >= 0; i--) {
    map.set(dayKey(startOfDayOffset(i)), { ventas: 0, costos: 0 });
  }

  for (const s of data ?? []) {
    const key = dayKey(s.sold_at);
    if (map.has(key)) {
      const entry = map.get(key)!;
      entry.ventas += s.sale_price;
      entry.costos += s.cost_price ?? 0;
    }
  }

  return [...map.entries()].map(([date, v]) => ({ date, ...v }));
}

export async function getTopProducts(limit = 5): Promise<TopProduct[]> {
  const { data, error } = await supabase
    .from("sales")
    .select("sale_price, quantity, product_variants ( products ( name ) )");

  if (error) throw new Error(error.message);

  const map = new Map<string, { revenue: number; units: number }>();
  for (const s of data ?? []) {
    const name    = (s as any).product_variants?.products?.name ?? "Desconocido";
    const entry   = map.get(name) ?? { revenue: 0, units: 0 };
    entry.revenue += s.sale_price;
    entry.units   += (s as any).quantity ?? 1;
    map.set(name, entry);
  }

  return [...map.entries()]
    .map(([name, v]) => ({ name, ...v }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, limit);
}

export async function getDeliveryStatusDistribution(): Promise<StatusSlice[]> {
  const { data, error } = await supabase
    .from("sales")
    .select("delivery_status");

  if (error) throw new Error(error.message);

  const counts = new Map<string, number>();
  for (const s of data ?? []) {
    const key = (s as any).delivery_status ?? "validating";
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  return [...counts.entries()]
    .map(([value, count]) => ({
      name:  DELIVERY_STATUSES.find((s) => s.value === value)?.label ?? value,
      value: count,
      color: STATUS_COLORS[value] ?? "#9ca3af",
    }))
    .sort((a, b) => b.value - a.value);
}
