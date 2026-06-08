import { supabase } from "../lib/supabaseClient";

// ── Types ──────────────────────────────────────────────────────────────────

export interface AdminUser {
  id:         string;
  first_name: string;
  last_name:  string;
  email:      string;
}

export interface AdminPayout {
  id:             string;
  recipient_id:   string;
  recipient_name: string;
  amount:         number;
  note:           string | null;
  paid_at:        string;
  created_by:     string | null;
  creator_name:   string | null;
}

// ── Raw Supabase row types (internal) ────────────────────────────────────

interface RawAdminUserRow {
  id:         string;
  first_name: string | null;
  last_name:  string | null;
  email:      string | null;
}

interface RawProfileName {
  first_name: string | null;
  last_name:  string | null;
}

interface RawPayoutRow {
  id:           string;
  recipient_id: string;
  amount:       number;
  note:         string | null;
  paid_at:      string;
  created_by:   string | null;
  recipient:    RawProfileName | null;
  creator:      RawProfileName | null;
}

interface RawMyPayoutRow {
  id:           string;
  recipient_id: string;
  amount:       number;
  note:         string | null;
  paid_at:      string;
  created_by:   string | null;
  creator:      RawProfileName | null;
}

interface RawSaleProfit  { sale_price: number; cost_price: number | null; }
interface RawOrderProfit { sale_price: number; cost_price: number | null; quantity: number | null; }

// ── Queries ────────────────────────────────────────────────────────────────

export async function getAdminUsers(): Promise<AdminUser[]> {
  const { data, error } = await supabase.rpc("get_admin_profiles");

  if (error) throw new Error(error.message);
  return (data ?? []).map((u: RawAdminUserRow) => ({
    id:         u.id,
    first_name: u.first_name ?? "",
    last_name:  u.last_name  ?? "",
    email:      u.email      ?? "",
  }));
}

export async function createPayout(
  recipientId: string,
  amount:      number,
  note:        string | null,
  createdBy:   string,
): Promise<void> {
  const { error } = await supabase.from("admin_payouts").insert({
    recipient_id: recipientId,
    amount,
    note:         note || null,
    created_by:   createdBy,
  });
  if (error) throw new Error(error.message);
}

export async function getAllPayouts(): Promise<AdminPayout[]> {
  const { data, error } = await supabase
    .from("admin_payouts")
    .select(`
      id, recipient_id, amount, note, paid_at, created_by,
      recipient:profiles!recipient_id ( first_name, last_name ),
      creator:profiles!created_by    ( first_name, last_name )
    `)
    .order("paid_at", { ascending: false });

  if (error) throw new Error(error.message);
  return (data as unknown as RawPayoutRow[]).map((p) => ({
    id:             p.id,
    recipient_id:   p.recipient_id,
    recipient_name: `${p.recipient?.first_name ?? ""} ${p.recipient?.last_name ?? ""}`.trim() || "—",
    amount:         p.amount,
    note:           p.note ?? null,
    paid_at:        p.paid_at,
    created_by:     p.created_by ?? null,
    creator_name:   p.creator
      ? `${p.creator.first_name ?? ""} ${p.creator.last_name ?? ""}`.trim() || null
      : null,
  }));
}

export async function getMyPayouts(userId: string): Promise<AdminPayout[]> {
  const { data, error } = await supabase
    .from("admin_payouts")
    .select(`
      id, recipient_id, amount, note, paid_at, created_by,
      creator:profiles!created_by ( first_name, last_name )
    `)
    .eq("recipient_id", userId)
    .order("paid_at", { ascending: false });

  if (error) throw new Error(error.message);
  return (data as unknown as RawMyPayoutRow[]).map((p) => ({
    id:             p.id,
    recipient_id:   p.recipient_id,
    recipient_name: "",
    amount:         p.amount,
    note:           p.note ?? null,
    paid_at:        p.paid_at,
    created_by:     p.created_by ?? null,
    creator_name:   p.creator
      ? `${p.creator.first_name ?? ""} ${p.creator.last_name ?? ""}`.trim() || null
      : null,
  }));
}

// Net profit from ALL non-cancelled sales + orders + external sales (sale_price − cost_price)
export async function getAllTimeNetProfit(): Promise<number> {
  const [salesResult, orderItemsResult, externalResult] = await Promise.all([
    supabase
      .from("sales")
      .select("sale_price, cost_price")
      .neq("status", "cancelled"),
    supabase
      .from("order_items")
      .select("sale_price, cost_price, quantity, orders!inner( status )")
      .neq("orders.status", "cancelled"),
    supabase
      .from("external_sales")
      .select("sale_price, cost_price"),
  ]);

  if (salesResult.error) throw new Error(salesResult.error.message);

  const salesProfit = (salesResult.data ?? []).reduce(
    (sum, s: RawSaleProfit) => sum + (s.sale_price - (s.cost_price ?? 0)),
    0,
  );

  const ordersProfit = (orderItemsResult.data ?? []).reduce(
    (sum, i: RawOrderProfit) => sum + (i.sale_price - (i.cost_price ?? 0)) * (i.quantity ?? 1),
    0,
  );

  const externalProfit = (externalResult.data ?? []).reduce(
    (sum, e: { sale_price: number; cost_price: number }) => sum + (e.sale_price - e.cost_price),
    0,
  );

  return salesProfit + ordersProfit + externalProfit;
}

export async function getTotalDistributed(): Promise<number> {
  const { data, error } = await supabase
    .from("admin_payouts")
    .select("amount");

  if (error) throw new Error(error.message);
  return (data ?? []).reduce((sum, p: { amount: number }) => sum + p.amount, 0);
}
