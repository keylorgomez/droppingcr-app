import { supabase } from "../lib/supabaseClient";
import { fetchAll } from "../lib/fetchAll";

// ── Types ──────────────────────────────────────────────────────────────────

export type ExpenseStatus = "pending" | "partial" | "paid";

/**
 * inventory = mercadería e importación (China, Miami, Kako…): ya está en el
 *             costo de cada prenda puesta en CR → NO baja la utilidad.
 * shipping  = Correos / mensajero a clientes: lo cobra el cliente aparte, es
 *             dinero de paso → NO baja la utilidad.
 * operating = todo lo demás (publicidad, plataformas, gasolina…) → SÍ baja.
 */
export type ExpenseKind = "inventory" | "operating" | "shipping";

export const EXPENSE_KINDS: ExpenseKind[] = ["operating", "inventory", "shipping"];

export const EXPENSE_KIND_LABEL: Record<ExpenseKind, string> = {
  inventory: "Mercadería",
  operating: "Operativo",
  shipping:  "Envío a cliente",
};

export const EXPENSE_KIND_HINT: Record<ExpenseKind, string> = {
  inventory: "Ya va en el costo de la prenda",
  operating: "Se resta de la utilidad",
  shipping:  "Lo paga el cliente, no afecta",
};

/** Tipo sugerido según la categoría; el admin lo puede cambiar. */
export function defaultKindFor(category: string | null): ExpenseKind {
  if (category === "Suministros") return "inventory";
  if (category === "Envío")       return "shipping";
  return "operating";
}

/** Siguiente tipo al tocar la etiqueta en la lista. */
export function nextKind(kind: ExpenseKind): ExpenseKind {
  return EXPENSE_KINDS[(EXPENSE_KINDS.indexOf(kind) + 1) % EXPENSE_KINDS.length];
}

export interface Expense {
  id:          string;
  description: string;
  amount:      number;
  category:    string | null;
  kind:        ExpenseKind;
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

// ── Raw Supabase row types (internal) ────────────────────────────────────

interface RawExpenseRow {
  id:               string;
  description:      string;
  amount:           number;
  category:         string | null;
  kind:             string | null;
  status:           string;
  notes:            string | null;
  created_by:       string | null;
  created_at:       string;
  expense_payments: Array<{ amount: number }>;
}

interface RawExpensePaymentLogRow {
  id:         string;
  expense_id: string;
  amount:     number;
  note:       string | null;
  paid_at:    string;
  expense:    { description: string; category: string | null } | null;
  creator:    { first_name: string | null; last_name: string | null } | null;
}

// ── Queries ────────────────────────────────────────────────────────────────

export async function getExpenses(): Promise<Expense[]> {
  const { data, error } = await fetchAll(() => supabase
    .from("expenses")
    .select("*, expense_payments ( amount )")
    .order("created_at", { ascending: false }));

  if (error) throw new Error(error.message);

  return (data ?? []).map((e: RawExpenseRow) => {
    const total_paid = (e.expense_payments ?? []).reduce(
      (s, p) => s + p.amount, 0
    );
    return {
      id:          e.id,
      description: e.description,
      amount:      e.amount,
      category:    e.category ?? null,
      kind:        (e.kind as ExpenseKind | null) ?? defaultKindFor(e.category ?? null),
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
  kind:        ExpenseKind = defaultKindFor(category),
): Promise<void> {
  const { error } = await supabase.from("expenses").insert({
    description,
    amount,
    kind,
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
    (s, p: { amount: number }) => s + p.amount, 0
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

export async function updateExpenseKind(expenseId: string, kind: ExpenseKind): Promise<void> {
  const { error } = await supabase.from("expenses").update({ kind }).eq("id", expenseId);
  if (error) throw new Error(error.message);
}

// Only returns expenses that have at least one payment (for Movimientos)
export async function getExpensePaymentsLog(): Promise<ExpensePaymentLog[]> {
  const { data, error } = await fetchAll(() => supabase
    .from("expense_payments")
    .select(`
      id, expense_id, amount, note, paid_at,
      expense:expenses ( description, category ),
      creator:profiles!created_by ( first_name, last_name )
    `)
    .order("paid_at", { ascending: false }));

  if (error) throw new Error(error.message);

  return (data as unknown as RawExpensePaymentLogRow[]).map((p) => ({
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
