import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft, Plus, Loader2, X, ChevronDown, CreditCard,
  Clock, AlertCircle, CheckCircle2, Wallet,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import Header from "../../components/ui/Header";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../components/ui/Toast";
import {
  getExpenses, createExpense, addExpensePayment,
  type Expense, type ExpenseStatus,
} from "../../services/expensesService";

// ── Helpers ────────────────────────────────────────────────────────────────

function fmt(n: number) {
  return `₡${n.toLocaleString("en-US")}`;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("es-CR", {
    day: "numeric", month: "short", year: "numeric",
  });
}

const STATUS_META: Record<ExpenseStatus, { label: string; bgCls: string; icon: React.ElementType }> = {
  pending: { label: "Pendiente",   bgCls: "bg-yellow-100 text-yellow-700", icon: Clock        },
  partial: { label: "En proceso",  bgCls: "bg-orange-100 text-orange-700", icon: AlertCircle  },
  paid:    { label: "Pagado",      bgCls: "bg-green-100  text-green-700",  icon: CheckCircle2 },
};

// ── New expense modal ──────────────────────────────────────────────────────

function NewExpenseModal({
  onClose, onSave, saving,
}: {
  onClose: () => void;
  onSave:  (description: string, amount: number, category: string, notes: string) => void;
  saving:  boolean;
}) {
  const [description, setDescription] = useState("");
  const [amount, setAmount]           = useState("");
  const [category, setCategory]       = useState("");
  const [notes, setNotes]             = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = parseFloat(amount);
    if (!description.trim() || !parsed || parsed <= 0) return;
    onSave(description.trim(), parsed, category.trim(), notes.trim());
  }

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center
                 bg-black/40 backdrop-blur-sm px-4"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <motion.div
        className="w-full max-w-md bg-white rounded-3xl shadow-2xl p-6 flex flex-col gap-5"
        initial={{ y: 60, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
        exit={{ y: 60, opacity: 0 }}
        transition={{ type: "spring", stiffness: 340, damping: 32 }}
      >
        <div className="flex items-center justify-between">
          <h2 className="font-poppins font-semibold text-brand-dark text-base">Nuevo gasto</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-brand-primary transition-colors">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <Field label="Descripción">
            <input
              type="text" value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Ej: Envío proveedor Nike, Publicidad IG…"
              required className={inputCls}
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Monto total (₡)">
              <input
                type="number" min={1} step={1} value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0" required className={inputCls}
              />
            </Field>
            <Field label="Categoría (opcional)">
              <div className="relative">
                <select
                  value={category} onChange={(e) => setCategory(e.target.value)}
                  className={`${inputCls} appearance-none pr-8`}
                >
                  <option value="">Sin categoría</option>
                  <option value="Envío">Envío</option>
                  <option value="Publicidad">Publicidad</option>
                  <option value="Suministros">Suministros</option>
                  <option value="Plataformas">Plataformas</option>
                  <option value="Otros">Otros</option>
                </select>
                <ChevronDown size={13} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
              </div>
            </Field>
          </div>

          <Field label="Notas (opcional)">
            <textarea
              value={notes} onChange={(e) => setNotes(e.target.value)}
              placeholder="Contexto adicional…" rows={2}
              className={`${inputCls} resize-none`}
            />
          </Field>

          <button
            type="submit" disabled={saving || !description || !amount}
            className="mt-1 w-full py-3 rounded-xl bg-brand-primary text-white text-sm
                       font-poppins font-medium flex items-center justify-center gap-2
                       hover:bg-[#7a3e18] transition-colors disabled:opacity-50"
          >
            {saving && <Loader2 size={15} className="animate-spin" />}
            Registrar gasto
          </button>
        </form>
      </motion.div>
    </motion.div>
  );
}

// ── Payment modal ──────────────────────────────────────────────────────────

function PaymentModal({
  expense, onClose, onSave, saving,
}: {
  expense: Expense;
  onClose: () => void;
  onSave:  (amount: number, note: string) => void;
  saving:  boolean;
}) {
  const remaining = expense.amount - expense.total_paid;
  const [amount, setAmount] = useState(String(remaining));
  const [note, setNote]     = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = parseFloat(amount);
    if (!parsed || parsed <= 0) return;
    onSave(Math.min(parsed, remaining), note.trim());
  }

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center
                 bg-black/40 backdrop-blur-sm px-4"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <motion.div
        className="w-full max-w-md bg-white rounded-3xl shadow-2xl p-6 flex flex-col gap-5"
        initial={{ y: 60, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
        exit={{ y: 60, opacity: 0 }}
        transition={{ type: "spring", stiffness: 340, damping: 32 }}
      >
        <div className="flex items-center justify-between">
          <h2 className="font-poppins font-semibold text-brand-dark text-base">Registrar pago</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-brand-primary transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Expense summary */}
        <div className="rounded-xl bg-gray-50 border border-gray-100 px-4 py-3 flex flex-col gap-1">
          <p className="text-xs font-poppins font-semibold text-brand-dark line-clamp-1">
            {expense.description}
          </p>
          <div className="flex items-center justify-between text-xs font-poppins text-gray-400">
            <span>Pagado: <span className="font-medium text-brand-dark">{fmt(expense.total_paid)}</span></span>
            <span>Pendiente: <span className="font-semibold text-red-500">{fmt(remaining)}</span></span>
          </div>
          <div className="h-1.5 rounded-full bg-gray-200 overflow-hidden mt-1">
            <div
              className="h-full rounded-full bg-brand-primary transition-all"
              style={{ width: `${(expense.total_paid / expense.amount) * 100}%` }}
            />
          </div>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <Field label={`Monto a pagar (₡) — máx. ${fmt(remaining)}`}>
            <input
              type="number" min={1} max={remaining} step={1}
              value={amount} onChange={(e) => setAmount(e.target.value)}
              required className={inputCls}
            />
          </Field>

          <Field label="Nota (opcional)">
            <input
              type="text" value={note} onChange={(e) => setNote(e.target.value)}
              placeholder="Ej: Pago parcial tarjeta Visa…"
              className={inputCls}
            />
          </Field>

          <button
            type="submit" disabled={saving || !amount || parseFloat(amount) <= 0}
            className="mt-1 w-full py-3 rounded-xl bg-brand-primary text-white text-sm
                       font-poppins font-medium flex items-center justify-center gap-2
                       hover:bg-[#7a3e18] transition-colors disabled:opacity-50"
          >
            {saving && <Loader2 size={15} className="animate-spin" />}
            Confirmar pago
          </button>
        </form>
      </motion.div>
    </motion.div>
  );
}

// ── Expense card ───────────────────────────────────────────────────────────

function ExpenseCard({
  expense, onPayClick,
}: {
  expense:    Expense;
  onPayClick: (e: Expense) => void;
}) {
  const meta      = STATUS_META[expense.status];
  const remaining = expense.amount - expense.total_paid;
  const progress  = expense.amount > 0
    ? Math.min(100, (expense.total_paid / expense.amount) * 100)
    : 100;
  const StatusIcon = meta.icon;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden"
    >
      <div className="p-4 flex flex-col gap-3">
        {/* Header row */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex flex-col gap-0.5 min-w-0">
            <p className="font-poppins font-semibold text-sm text-brand-dark leading-snug line-clamp-2">
              {expense.description}
            </p>
            <div className="flex items-center gap-2 mt-0.5">
              {expense.category && (
                <span className="text-[10px] font-poppins text-gray-400 bg-gray-100 rounded-full px-2 py-0.5">
                  {expense.category}
                </span>
              )}
              <span className="text-[10px] font-poppins text-gray-300">
                {formatDate(expense.created_at)}
              </span>
            </div>
          </div>
          <div className="flex flex-col items-end gap-1.5 shrink-0">
            <span className={`flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider
                              px-2.5 py-1 rounded-full font-poppins ${meta.bgCls}`}>
              <StatusIcon size={9} strokeWidth={2.5} />
              {meta.label}
            </span>
            <p className="text-sm font-poppins font-bold text-brand-dark">
              {fmt(expense.amount)}
            </p>
          </div>
        </div>

        {/* Progress (only if not pending with ₡0) */}
        {expense.total_paid > 0 && (
          <div className="flex flex-col gap-1.5">
            <div className="flex justify-between text-xs font-poppins">
              <span className="text-gray-400">Pagado</span>
              <span className="font-medium text-brand-dark">
                {fmt(expense.total_paid)}
                <span className="text-gray-300 font-normal"> / {fmt(expense.amount)}</span>
              </span>
            </div>
            <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden">
              <div
                className="h-full rounded-full bg-brand-primary transition-all"
                style={{ width: `${progress}%` }}
              />
            </div>
            {expense.status !== "paid" && (
              <p className="text-[11px] font-poppins text-gray-400">
                Pendiente:{" "}
                <span className="font-semibold text-red-500">{fmt(remaining)}</span>
              </p>
            )}
          </div>
        )}

        {/* Notes */}
        {expense.notes && (
          <p className="text-[11px] font-poppins text-gray-400 italic leading-snug">
            {expense.notes}
          </p>
        )}
      </div>

      {/* Pay button */}
      {expense.status !== "paid" && (
        <div className="px-4 pb-4">
          <button
            onClick={() => onPayClick(expense)}
            className="w-full flex items-center justify-center gap-2 rounded-xl border
                       border-brand-primary text-brand-primary text-xs font-poppins font-semibold
                       py-2.5 hover:bg-brand-bg transition-colors"
          >
            <Wallet size={13} strokeWidth={2} />
            Registrar pago
          </button>
        </div>
      )}
    </motion.div>
  );
}

// ── Input helpers ──────────────────────────────────────────────────────────

const inputCls =
  "w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-poppins " +
  "text-brand-dark placeholder:text-gray-300 outline-none bg-white " +
  "focus:border-brand-primary focus:ring-1 focus:ring-brand-primary/20 transition";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-poppins font-medium text-gray-500 uppercase tracking-wider">
        {label}
      </label>
      {children}
    </div>
  );
}

// ── Skeleton ───────────────────────────────────────────────────────────────

function CardSkeleton() {
  return (
    <div className="animate-pulse bg-white rounded-2xl border border-gray-100 p-4 flex flex-col gap-3">
      <div className="flex justify-between gap-3">
        <div className="flex flex-col gap-2 flex-1">
          <div className="h-3.5 bg-gray-100 rounded w-3/4" />
          <div className="h-2.5 bg-gray-100 rounded w-1/3" />
        </div>
        <div className="flex flex-col items-end gap-2">
          <div className="h-5 bg-gray-100 rounded-full w-20" />
          <div className="h-4 bg-gray-100 rounded w-16" />
        </div>
      </div>
    </div>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────

type FilterTab = "all" | ExpenseStatus;

const TABS: { value: FilterTab; label: string }[] = [
  { value: "all",     label: "Todos"      },
  { value: "pending", label: "Pendientes" },
  { value: "partial", label: "En proceso" },
  { value: "paid",    label: "Pagados"    },
];

export default function ExpensesPage() {
  const { user }      = useAuth();
  const navigate      = useNavigate();
  const { showToast } = useToast();
  const queryClient   = useQueryClient();

  const [tab, setTab]             = useState<FilterTab>("all");
  const [newOpen, setNewOpen]     = useState(false);
  const [payTarget, setPayTarget] = useState<Expense | null>(null);

  const { data: expenses = [], isLoading } = useQuery({
    queryKey: ["expenses"],
    queryFn:  getExpenses,
  });

  const createMutation = useMutation({
    mutationFn: ({ description, amount, category, notes }: {
      description: string; amount: number; category: string; notes: string;
    }) => createExpense(description, amount, category || null, notes || null, user!.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["expenses"] });
      setNewOpen(false);
      showToast("Gasto registrado.", "success");
    },
    onError: (err) => showToast(err instanceof Error ? err.message : "Error.", "error"),
  });

  const payMutation = useMutation({
    mutationFn: ({ expenseId, amount, note }: {
      expenseId: string; amount: number; note: string;
    }) => addExpensePayment(expenseId, amount, note || null, user!.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["expenses"] });
      queryClient.invalidateQueries({ queryKey: ["expense-payments-log"] });
      queryClient.invalidateQueries({ queryKey: ["payments-log-full"] });
      setPayTarget(null);
      showToast("Pago registrado.", "success");
    },
    onError: (err) => showToast(err instanceof Error ? err.message : "Error.", "error"),
  });

  const filtered = useMemo(
    () => tab === "all" ? expenses : expenses.filter((e) => e.status === tab),
    [expenses, tab],
  );

  // Summary stats
  const totalPending = expenses
    .filter((e) => e.status !== "paid")
    .reduce((s, e) => s + (e.amount - e.total_paid), 0);

  const now = new Date();
  const paidThisMonth = expenses
    .filter((e) => {
      const d = new Date(e.created_at);
      return e.status === "paid"
        && d.getMonth() === now.getMonth()
        && d.getFullYear() === now.getFullYear();
    })
    .reduce((s, e) => s + e.amount, 0);

  return (
    <>
      <Header />
      <main className="max-w-2xl mx-auto px-4 pt-8 pb-16">

        {/* Back + title */}
        <div className="mb-6">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-1.5 text-sm font-poppins text-gray-400
                       hover:text-brand-primary transition-colors mb-3"
          >
            <ArrowLeft size={15} strokeWidth={2} />
            Volver
          </button>
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2.5 mb-0.5">
                <CreditCard size={20} strokeWidth={1.8} className="text-brand-primary" />
                <h1 className="font-poppins font-semibold italic text-brand-primary text-2xl">
                  Gastos de tienda
                </h1>
              </div>
              <p className="font-poppins text-xs text-gray-400">
                Control de gastos operativos y pagos de tarjeta
              </p>
            </div>
            <button
              onClick={() => setNewOpen(true)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-brand-primary
                         text-white text-sm font-poppins font-medium hover:bg-[#7a3e18]
                         transition-colors shrink-0"
            >
              <Plus size={15} strokeWidth={2.2} />
              Nuevo gasto
            </button>
          </div>
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-2 gap-3 mb-6">
          <div className="rounded-2xl border border-red-100 bg-red-50 px-4 py-3.5 flex flex-col gap-1">
            <span className="text-[10px] font-poppins font-semibold uppercase tracking-wider text-red-500/70">
              Deuda pendiente
            </span>
            <p className="text-xl font-poppins font-bold text-red-600 leading-none">
              {fmt(totalPending)}
            </p>
            <p className="text-[11px] font-poppins text-red-400/70">
              {expenses.filter((e) => e.status !== "paid").length} gastos sin saldar
            </p>
          </div>
          <div className="rounded-2xl border border-green-100 bg-green-50 px-4 py-3.5 flex flex-col gap-1">
            <span className="text-[10px] font-poppins font-semibold uppercase tracking-wider text-green-600/70">
              Pagado este mes
            </span>
            <p className="text-xl font-poppins font-bold text-green-700 leading-none">
              {fmt(paidThisMonth)}
            </p>
            <p className="text-[11px] font-poppins text-green-600/60">
              {expenses.filter((e) => {
                const d = new Date(e.created_at);
                return e.status === "paid" && d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
              }).length} gastos completados
            </p>
          </div>
        </div>

        {/* Filter tabs */}
        <div className="flex gap-1 mb-5 bg-gray-100 p-1 rounded-xl">
          {TABS.map((t) => {
            const count = t.value === "all"
              ? expenses.length
              : expenses.filter((e) => e.status === t.value).length;
            return (
              <button
                key={t.value}
                onClick={() => setTab(t.value)}
                className={`flex-1 py-1.5 rounded-lg text-xs font-poppins font-medium transition-colors
                            ${tab === t.value
                              ? "bg-white text-brand-primary shadow-sm"
                              : "text-gray-400 hover:text-gray-600"}`}
              >
                {t.label}
                {count > 0 && (
                  <span className={`ml-1.5 text-[10px] font-bold px-1.5 py-0.5 rounded-full
                                    ${tab === t.value ? "bg-brand-bg text-brand-primary" : "bg-gray-200 text-gray-400"}`}>
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* List */}
        {isLoading && (
          <div className="flex flex-col gap-3">
            {Array.from({ length: 4 }).map((_, i) => <CardSkeleton key={i} />)}
          </div>
        )}

        {!isLoading && filtered.length === 0 && (
          <div className="flex flex-col items-center gap-3 py-20 text-gray-300">
            <CreditCard size={44} strokeWidth={1.1} />
            <p className="font-poppins text-sm text-gray-400 text-center">
              {tab === "all"
                ? "No hay gastos registrados aún."
                : `No hay gastos con estado "${TABS.find((t) => t.value === tab)?.label}".`}
            </p>
          </div>
        )}

        {!isLoading && (
          <div className="flex flex-col gap-3">
            <AnimatePresence>
              {filtered.map((e) => (
                <ExpenseCard
                  key={e.id}
                  expense={e}
                  onPayClick={setPayTarget}
                />
              ))}
            </AnimatePresence>
          </div>
        )}
      </main>

      {/* New expense modal */}
      <AnimatePresence>
        {newOpen && (
          <NewExpenseModal
            saving={createMutation.isPending}
            onClose={() => setNewOpen(false)}
            onSave={(description, amount, category, notes) =>
              createMutation.mutate({ description, amount, category, notes })
            }
          />
        )}
      </AnimatePresence>

      {/* Payment modal */}
      <AnimatePresence>
        {payTarget && (
          <PaymentModal
            expense={payTarget}
            saving={payMutation.isPending}
            onClose={() => setPayTarget(null)}
            onSave={(amount, note) =>
              payMutation.mutate({ expenseId: payTarget.id, amount, note })
            }
          />
        )}
      </AnimatePresence>
    </>
  );
}
