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

// ── Raw Supabase row types (internal) ────────────────────────────────────

interface RawPaymentAmount  { amount: number; }
interface RawOrderItemStats { sale_price: number; cost_price: number | null; quantity: number; }

interface RawStatsSale {
  sale_price:    number;
  cost_price:    number | null;
  shipping_cost: number | null;
  status:        string;
  payments:      RawPaymentAmount[];
}

interface RawStatsOrder {
  shipping_cost: number | null;
  status:        string;
  order_items:   RawOrderItemStats[];
  payments:      RawPaymentAmount[];
}

interface RawDailyOrder {
  sold_at:       string;
  shipping_cost: number | null;
  order_items:   RawOrderItemStats[];
}

interface RawProductSale {
  sale_price: number;
  quantity:   number | null;
  product_variants: { products: { name: string } | null } | null;
}

interface RawProductOrderItem {
  sale_price: number;
  quantity:   number | null;
  product_variants: { products: { name: string } | null } | null;
}

interface RawDeliveryStatusRow { delivery_status: string | null; }

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
  // Fetch sales and orders in parallel
  const [salesResult, ordersResult] = await Promise.all([
    supabase
      .from("sales")
      .select("sale_price, cost_price, shipping_cost, status, payments ( amount )")
      .neq("status", "cancelled"),
    supabase
      .from("orders")
      .select("shipping_cost, status, order_items(sale_price, cost_price, quantity), payments(amount)")
      .neq("status", "cancelled"),
  ]);

  if (salesResult.error) throw new Error(salesResult.error.message);

  let totalRevenue = 0;
  let netProfit    = 0;
  let pendingDebt  = 0;

  for (const sale of (salesResult.data ?? []) as RawStatsSale[]) {
    totalRevenue += sale.sale_price;
    netProfit    += sale.sale_price - (sale.cost_price ?? 0);

    if (sale.status === "pending") {
      const paid  = sale.payments.reduce((sum, payment) => sum + payment.amount, 0);
      const total = sale.sale_price + (sale.shipping_cost ?? 0);
      pendingDebt += Math.max(0, total - paid);
    }
  }

  for (const order of (ordersResult.data ?? []) as RawStatsOrder[]) {
    const shipping     = order.shipping_cost ?? 0;
    const itemsRevenue = order.order_items.reduce((total, item) => total + item.sale_price * item.quantity, 0);
    const itemsProfit  = order.order_items.reduce((total, item) => total + (item.sale_price - (item.cost_price ?? 0)) * item.quantity, 0);

    totalRevenue += itemsRevenue + shipping;
    netProfit    += itemsProfit;

    if (order.status === "pending") {
      const paid      = order.payments.reduce((total, payment) => total + payment.amount, 0);
      const totalOwed = itemsRevenue + shipping;
      pendingDebt    += Math.max(0, totalOwed - paid);
    }
  }

  return {
    totalRevenue,
    netProfit,
    pendingDebt,
    totalSales: (salesResult.data ?? []).length + (ordersResult.data ?? []).length,
  };
}

export async function getSalesVsCostsLast30Days(): Promise<DayData[]> {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 29);
  cutoff.setHours(0, 0, 0, 0);

  const [salesResult, ordersResult] = await Promise.all([
    supabase
      .from("sales")
      .select("sale_price, cost_price, sold_at")
      .gte("sold_at", startOfDayOffset(29)),
    supabase
      .from("orders")
      .select("sold_at, shipping_cost, order_items(sale_price, cost_price, quantity)")
      .gte("sold_at", cutoff.toISOString())
      .neq("status", "cancelled"),
  ]);

  if (salesResult.error) throw new Error(salesResult.error.message);

  // Pre-fill every day with zeros so the chart is always 30 bars
  const map = new Map<string, { ventas: number; costos: number }>();
  for (let i = 29; i >= 0; i--) {
    map.set(dayKey(startOfDayOffset(i)), { ventas: 0, costos: 0 });
  }

  for (const sale of salesResult.data ?? []) {
    const key = dayKey(sale.sold_at);
    if (map.has(key)) {
      const entry = map.get(key)!;
      entry.ventas += sale.sale_price;
      entry.costos += sale.cost_price ?? 0;
    }
  }

  for (const order of (ordersResult.data ?? []) as RawDailyOrder[]) {
    const key = dayKey(order.sold_at);
    if (map.has(key)) {
      const entry    = map.get(key)!;
      const shipping = order.shipping_cost ?? 0;
      entry.ventas += order.order_items.reduce((total, item) => total + item.sale_price * item.quantity, 0) + shipping;
      entry.costos += order.order_items.reduce((total, item) => total + (item.cost_price ?? 0) * item.quantity, 0);
    }
  }

  return [...map.entries()].map(([date, v]) => ({ date, ...v }));
}

export async function getTopProducts(limit = 5): Promise<TopProduct[]> {
  const [salesResult, orderItemsResult] = await Promise.all([
    supabase
      .from("sales")
      .select("sale_price, quantity, product_variants ( products ( name ) )"),
    supabase
      .from("order_items")
      .select("sale_price, quantity, product_variants(products(name))")
      .not("product_variants", "is", null),
  ]);

  if (salesResult.error) throw new Error(salesResult.error.message);

  const map = new Map<string, { revenue: number; units: number }>();

  for (const sale of (salesResult.data ?? []) as unknown as RawProductSale[]) {
    const name    = sale.product_variants?.products?.name ?? "Desconocido";
    const entry   = map.get(name) ?? { revenue: 0, units: 0 };
    entry.revenue += sale.sale_price;
    entry.units   += sale.quantity ?? 1;
    map.set(name, entry);
  }

  for (const orderItem of (orderItemsResult.data ?? []) as unknown as RawProductOrderItem[]) {
    const name  = orderItem.product_variants?.products?.name ?? "Desconocido";
    const entry = map.get(name) ?? { revenue: 0, units: 0 };
    entry.revenue += orderItem.sale_price * (orderItem.quantity ?? 1);
    entry.units   += orderItem.quantity ?? 1;
    map.set(name, entry);
  }

  return [...map.entries()]
    .map(([productName, stats]) => ({ name: productName, ...stats }))
    .sort((productA, productB) => productB.revenue - productA.revenue)
    .slice(0, limit);
}

export async function getDeliveryStatusDistribution(): Promise<StatusSlice[]> {
  const [salesResult, ordersResult] = await Promise.all([
    supabase.from("sales").select("delivery_status"),
    supabase.from("orders").select("delivery_status").neq("status", "cancelled"),
  ]);

  if (salesResult.error) throw new Error(salesResult.error.message);

  const counts = new Map<string, number>();

  for (const sale of (salesResult.data ?? []) as RawDeliveryStatusRow[]) {
    const key = sale.delivery_status ?? "validating";
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  for (const order of (ordersResult.data ?? []) as RawDeliveryStatusRow[]) {
    const key = order.delivery_status ?? "validating";
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
