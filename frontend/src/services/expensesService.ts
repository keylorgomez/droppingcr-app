import { supabase } from "../lib/supabaseClient";

// ── Types ──────────────────────────────────────────────────────────────────

export type ExpenseStatus = "pending" | "partial" | "paid";

export interface Expense {
  id:          string;
  description: string;
  amount:      number;
  category:    string | null;
  status:      ExpenseStatus;
  notes:       string | null;
  created_by:  string | null;
  created_at:  string;
  total_paid:  number;
}

export interface ExpensePaymentLog {
  id:                  string;
  expense_id:          string;
  expense_description: string;
  expense_category:    string | null;
  amount:              number;
  note:                string | null;
  paid_at:             string;
  creator_name:        string | null;
}

// ── Queries ────────────────────────────────────────────────────────────────

export async function getExpenses(): Promise<Expense[]> {
  const { data, error } = await supabase
    .from("expenses")
    .select("*, expense_payments ( amount )")
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);

  return (data ?? []).map((e: any) => {
    const total_paid = (e.expense_payments ?? []).reduce(
      (s: number, p: any) => s + p.amount, 0
    );
    return {
      id:          e.id,
      description: e.description,
      amount:      e.amount,
      category:    e.category ?? null,
      status:      e.status as ExpenseStatus,
      notes:       e.notes ?? null,
      created_by:  e.created_by ?? null,
      created_at:  e.created_at,
      total_paid,
    };
  });
}

export async function createExpense(
  description: string,
  amount:      number,
  category:    string | null,
  notes:       string | null,
  createdBy:   string,
): Promise<void> {
  const { error } = await supabase.from("expenses").insert({
    description,
    amount,
    category:   category  || null,
    notes:      notes     || null,
    created_by: createdBy,
    status:     "pending",
  });
  if (error) throw new Error(error.message);
}

export async function addExpensePayment(
  expenseId: string,
  amount:    number,
  note:      string | null,
  createdBy: string,
): Promise<void> {
  // 1. Insert the payment
  const { error: payErr } = await supabase.from("expense_payments").insert({
    expense_id: expenseId,
    amount,
    note:        note || null,
    created_by:  createdBy,
  });
  if (payErr) throw new Error(payErr.message);

  // 2. Recalculate total paid and update status
  const { data: expData, error: expErr } = await supabase
    .from("expenses")
    .select("amount, expense_payments ( amount )")
    .eq("id", expenseId)
    .single();

  if (expErr) throw new Error(expErr.message);

  const totalPaid = (expData.expense_payments ?? []).reduce(
    (s: number, p: any) => s + p.amount, 0
  );
  const newStatus: ExpenseStatus =
    totalPaid >= expData.amount ? "paid"
    : totalPaid > 0             ? "partial"
    :                             "pending";

  const { error: updErr } = await supabase
    .from("expenses")
    .update({ status: newStatus })
    .eq("id", expenseId);

  if (updErr) throw new Error(updErr.message);
}

// Only returns expenses that have at least one payment (for Movimientos)
export async function getExpensePaymentsLog(): Promise<ExpensePaymentLog[]> {
  const { data, error } = await supabase
    .from("expense_payments")
    .select(`
      id, expense_id, amount, note, paid_at,
      expense:expenses ( description, category ),
      creator:profiles!created_by ( first_name, last_name )
    `)
    .order("paid_at", { ascending: false });

  if (error) throw new Error(error.message);

  return (data ?? []).map((p: any) => ({
    id:                  p.id,
    expense_id:          p.expense_id,
    expense_description: p.expense?.description ?? "Gasto",
    expense_category:    p.expense?.category    ?? null,
    amount:              p.amount,
    note:                p.note ?? null,
    paid_at:             p.paid_at,
    creator_name:        p.creator
      ? `${p.creator.first_name ?? ""} ${p.creator.last_name ?? ""}`.trim() || null
      : null,
  }));
}
