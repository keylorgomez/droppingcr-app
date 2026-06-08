import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft, Search, X, Receipt, TrendingUp, ArrowDownLeft, ArrowUpRight,
  Minus, Calendar, Plus, Loader2, ShoppingBag,
} from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import Header from "../../components/ui/Header";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../components/ui/Toast";
import {
  getPaymentsLog, getRefundsLog,
  type PaymentLog,
} from "../../services/salesService";
import { getAllPayouts, type AdminPayout } from "../../services/payoutsService";
import { getExpensePaymentsLog, type ExpensePaymentLog } from "../../services/expensesService";
import {
  getExternalSalesLog, createExternalSale,
  type ExternalSale, type ExternalSaleInput,
} from "../../services/externalSalesService";
import { cn } from "../../lib/utils";
import { normalizeText } from "../../lib/formatters";
import { QUERY_KEYS } from "../../constants/queryKeys";
import {
  type Movement,
  TableSkeleton, SummaryCard,
  PaymentRow, MobilePaymentCard,
  PayoutRow, MobilePayoutCard,
  ExpensePaymentRow, MobileExpenseCard,
  RefundRow, MobileRefundCard,
  ExternalSaleRow, MobileExternalSaleCard,
} from "../../components/payments/MovementRows";

// ── External sale modal ────────────────────────────────────────────────────

function ExternalSaleModal({
  onClose,
  onSave,
  saving,
}: {
  onClose: () => void;
  onSave:  (input: ExternalSaleInput) => void;
  saving:  boolean;
}) {
  const [productName, setProductName] = useState("");
  const [costPrice,   setCostPrice]   = useState("");
  const [salePrice,   setSalePrice]   = useState("");
  const [note,        setNote]        = useState("");

  const cost   = parseFloat(costPrice.replace(/[^0-9.]/g, "")) || 0;
  const sale   = parseFloat(salePrice.replace(/[^0-9.]/g, "")) || 0;
  const profit = sale - cost;
  const showProfit = cost > 0 || sale > 0;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!productName.trim() || sale <= 0) return;
    onSave({
      product_name: productName.trim(),
      cost_price:   cost,
      sale_price:   sale,
      note:         note.trim() || null,
    });
  }

  const inputCls = `w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm
                    font-poppins text-brand-dark placeholder:text-gray-300 outline-none
                    focus:border-brand-primary focus:ring-1 focus:ring-brand-primary/20 transition`;
  const labelCls = "text-[11px] font-poppins font-semibold uppercase tracking-wider text-gray-400";

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4">
      <motion.div
        className="absolute inset-0 bg-black/40"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      />
      <motion.div
        className="relative z-10 w-full max-w-md bg-white rounded-2xl shadow-xl p-6"
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 12 }}
        transition={{ type: "spring", stiffness: 300, damping: 28 }}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-purple-100 flex items-center justify-center shrink-0">
              <ShoppingBag size={15} strokeWidth={2} className="text-purple-600" />
            </div>
            <h2 className="font-poppins font-semibold italic text-brand-primary text-lg">
              Venta externa
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-300 hover:text-gray-500 transition-colors"
          >
            <X size={18} strokeWidth={2} />
          </button>
        </div>

        <p className="text-xs font-poppins text-gray-400 mb-5 leading-relaxed">
          Registra una venta de producto de proveedor externo. Se suma al ingreso y a las ganancias.
        </p>

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {/* Product name */}
          <div className="flex flex-col gap-1.5">
            <label className={labelCls}>Nombre del producto</label>
            <input
              value={productName}
              onChange={(e) => setProductName(e.target.value)}
              placeholder="Ej: Camiseta Nike Dri-FIT talla M"
              required
              className={inputCls}
            />
          </div>

          {/* Prices */}
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <label className={labelCls}>Precio costo (₡)</label>
              <input
                value={costPrice}
                onChange={(e) => setCostPrice(e.target.value)}
                placeholder="0"
                inputMode="decimal"
                className={inputCls}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className={labelCls}>Precio venta (₡)</label>
              <input
                value={salePrice}
                onChange={(e) => setSalePrice(e.target.value)}
                placeholder="0"
                inputMode="decimal"
                required
                className={inputCls}
              />
            </div>
          </div>

          {/* Live profit preview */}
          {showProfit && (
            <div className={cn(
              "rounded-xl px-4 py-3 flex items-center justify-between border",
              profit >= 0
                ? "bg-green-50 border-green-100"
                : "bg-red-50 border-red-100"
            )}>
              <span className="text-xs font-poppins text-gray-500">Ganancia estimada</span>
              <span className={cn(
                "text-sm font-poppins font-bold",
                profit >= 0 ? "text-green-600" : "text-red-500"
              )}>
                {profit >= 0 ? "+" : ""}₡{profit.toLocaleString("en-US")}
              </span>
            </div>
          )}

          {/* Note */}
          <div className="flex flex-col gap-1.5">
            <label className={labelCls}>Nota <span className="normal-case font-normal tracking-normal">(opcional)</span></label>
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Cliente, proveedor, observaciones…"
              className={inputCls}
            />
          </div>

          {/* Actions */}
          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-poppins
                         font-medium text-gray-500 hover:bg-gray-50 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving || !productName.trim() || sale <= 0}
              className="flex-1 py-2.5 rounded-xl bg-brand-primary text-white text-sm
                         font-poppins font-medium hover:opacity-90 transition-opacity
                         disabled:opacity-50 disabled:cursor-not-allowed
                         flex items-center justify-center gap-2"
            >
              {saving && <Loader2 size={14} className="animate-spin" />}
              Registrar
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────

export default function PaymentsPage() {
  const { user }        = useAuth();
  const navigate        = useNavigate();
  const queryClient     = useQueryClient();
  const { showToast }   = useToast();
  const [search, setSearch]       = useState("");
  const [modalOpen, setModalOpen] = useState(false);

  const { data: logs    = [], isLoading: loadingLogs    } = useQuery({
    queryKey: QUERY_KEYS.PAYMENTS_LOG,
    queryFn:  getPaymentsLog,
    staleTime: 30_000,
  });

  const { data: payouts = [], isLoading: loadingPayouts } = useQuery({
    queryKey: QUERY_KEYS.ADMIN_PAYOUTS,
    queryFn:  getAllPayouts,
    staleTime: 30_000,
  });

  const { data: expensePayments = [], isLoading: loadingExpenses } = useQuery({
    queryKey: QUERY_KEYS.EXPENSE_PAYMENTS_LOG,
    queryFn:  getExpensePaymentsLog,
    staleTime: 30_000,
  });

  const { data: refunds = [], isLoading: loadingRefunds } = useQuery({
    queryKey: QUERY_KEYS.REFUNDS_LOG,
    queryFn:  getRefundsLog,
    staleTime: 30_000,
  });

  const { data: externalSales = [], isLoading: loadingExternal } = useQuery({
    queryKey: QUERY_KEYS.EXTERNAL_SALES_LOG,
    queryFn:  getExternalSalesLog,
    staleTime: 30_000,
  });

  const { mutate: saveExternal, isPending: savingExternal } = useMutation({
    mutationFn: async (input: ExternalSaleInput) => {
      if (!user) throw new Error("No autenticado");
      await createExternalSale(input, user.id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.EXTERNAL_SALES_LOG });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.DASH_STATS });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.DASH_AREA });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.NET_PROFIT_ALL });
      showToast("Venta externa registrada", "success");
      setModalOpen(false);
    },
    onError: (err: Error) => showToast(err.message, "error"),
  });

  const isLoading = loadingLogs || loadingPayouts || loadingExpenses || loadingRefunds || loadingExternal;

  if (user && user.role !== "admin") { navigate("/"); return null; }

  // ── Merge and sort ─────────────────────────────────────────────────────────
  const movements: Movement[] = useMemo(() => {
    const ins:  Movement[] = logs.map((d)            => ({ kind: "in"       as const, data: d }));
    const outs: Movement[] = payouts.map((d)         => ({ kind: "out"      as const, data: d }));
    const exps: Movement[] = expensePayments.map((d) => ({ kind: "expense"  as const, data: d }));
    const refs: Movement[] = refunds.map((d)         => ({ kind: "refund"   as const, data: d }));
    const exts: Movement[] = externalSales.map((d)   => ({ kind: "external" as const, data: d }));

    const dateOf = (m: Movement): string => {
      if (m.kind === "refund")   return m.data.created_at;
      if (m.kind === "external") return m.data.sold_at;
      return m.data.paid_at;
    };

    return [...ins, ...outs, ...exps, ...refs, ...exts].sort(
      (a, b) => new Date(dateOf(b)).getTime() - new Date(dateOf(a)).getTime()
    );
  }, [logs, payouts, expensePayments, refunds, externalSales]);

  // ── Filter ─────────────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    if (!search.trim()) return movements;
    const q = normalizeText(search.trim());
    return movements.filter((m) => {
      if (m.kind === "in") {
        const l = m.data as PaymentLog;
        return (
          normalizeText(l.guest_name   ?? "").includes(q) ||
          normalizeText(l.guest_phone  ?? "").includes(q) ||
          normalizeText(l.product_name     ).includes(q) ||
          normalizeText(l.note         ?? "").includes(q)
        );
      } else if (m.kind === "out") {
        const p = m.data as AdminPayout;
        return (
          normalizeText(p.recipient_name   ).includes(q) ||
          normalizeText(p.note         ?? "").includes(q) ||
          normalizeText(p.creator_name ?? "").includes(q)
        );
      } else if (m.kind === "expense") {
        const e = m.data as ExpensePaymentLog;
        return (
          normalizeText(e.expense_description         ).includes(q) ||
          normalizeText(e.expense_category        ?? "").includes(q) ||
          normalizeText(e.note                    ?? "").includes(q)
        );
      } else if (m.kind === "external") {
        const e = m.data as ExternalSale;
        return (
          normalizeText(e.product_name     ).includes(q) ||
          normalizeText(e.note         ?? "").includes(q)
        );
      } else {
        const r = m.data;
        return (
          normalizeText(r.guest_name   ?? "").includes(q) ||
          normalizeText(r.guest_phone  ?? "").includes(q) ||
          normalizeText(r.product_name     ).includes(q) ||
          normalizeText(r.reason       ?? "").includes(q)
        );
      }
    });
  }, [movements, search]);

  // ── Summary stats ──────────────────────────────────────────────────────────
  const externalTotal = externalSales.reduce((s, e) => s + e.sale_price, 0);
  const totalIn  = logs.reduce((s, l) => s + l.amount, 0) + externalTotal;
  const totalOut = payouts.reduce((s, p) => s + p.amount, 0)
                 + expensePayments.reduce((s, e) => s + e.amount, 0)
                 + refunds.reduce((s, r) => s + r.amount, 0);

  const now          = new Date();
  const currentMonth = now.getMonth();
  const currentYear  = now.getFullYear();
  const monthLabel   = now.toLocaleDateString("es-CR", { month: "long", year: "numeric" });

  const thisMonth = logs.filter((l) => {
    const d = new Date(l.paid_at);
    return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
  });
  const thisMonthPayouts = payouts.filter((p) => {
    const d = new Date(p.paid_at);
    return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
  });
  const thisMonthExpenses = expensePayments.filter((e) => {
    const d = new Date(e.paid_at);
    return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
  });
  const thisMonthRefunds = refunds.filter((r) => {
    const d = new Date(r.created_at);
    return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
  });
  const thisMonthExternals = externalSales.filter((e) => {
    const d = new Date(e.sold_at);
    return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
  });

  const thisMonthIn  = thisMonth.reduce((s, l) => s + l.amount, 0)
                     + thisMonthExternals.reduce((s, e) => s + e.sale_price, 0);
  const thisMonthOut = thisMonthPayouts.reduce((s, p) => s + p.amount, 0)
                     + thisMonthExpenses.reduce((s, e) => s + e.amount, 0)
                     + thisMonthRefunds.reduce((s, r) => s + r.amount, 0);

  const filteredIn = filtered.reduce((s, m) => {
    if (m.kind === "in")       return s + (m.data as PaymentLog).amount;
    if (m.kind === "external") return s + (m.data as ExternalSale).sale_price;
    return s;
  }, 0);
  const filteredOut = filtered.reduce((s, m) => {
    if (m.kind === "out" || m.kind === "expense" || m.kind === "refund") {
      return s + (m.data as { amount: number }).amount;
    }
    return s;
  }, 0);

  return (
    <>
      <Header />
      <main className="max-w-7xl mx-auto px-4 pt-8 pb-24 md:pb-16">

        {/* Back + title + action */}
        <div className="mb-6">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-1.5 text-sm font-poppins text-gray-400
                       hover:text-brand-primary transition-colors mb-3"
          >
            <ArrowLeft size={15} strokeWidth={2} />
            Volver
          </button>
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2.5">
                <Receipt size={20} strokeWidth={1.8} className="text-brand-primary" />
                <h1 className="font-poppins font-semibold italic text-brand-primary text-2xl">
                  Movimientos de dinero
                </h1>
              </div>
              <p className="font-poppins text-xs text-gray-400 mt-1">
                Historial de entradas y salidas de dinero
              </p>
            </div>
            <button
              onClick={() => setModalOpen(true)}
              className="shrink-0 flex items-center gap-1.5 px-4 py-2 rounded-xl
                         bg-purple-100 text-purple-700 text-xs font-poppins font-semibold
                         hover:bg-purple-200 transition-colors"
            >
              <Plus size={13} strokeWidth={2.5} />
              Venta externa
            </button>
          </div>
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3">
          <SummaryCard
            icon={ArrowDownLeft}
            label="Ingresos totales"
            value={`₡${totalIn.toLocaleString("en-US")}`}
            sub={`${logs.length + externalSales.length} pagos recibidos`}
            textCls="text-green-600"
            bgCls="bg-green-50"
          />
          <SummaryCard
            icon={ArrowUpRight}
            label="Salidas totales"
            value={`₡${totalOut.toLocaleString("en-US")}`}
            sub={`${payouts.length} abono${payouts.length !== 1 ? "s" : ""} a admins`}
            textCls="text-red-500"
            bgCls="bg-red-50"
          />
          <SummaryCard
            icon={totalIn - totalOut >= 0 ? TrendingUp : Minus}
            label="Balance neto"
            value={`₡${(totalIn - totalOut).toLocaleString("en-US")}`}
            sub="Ingresos − salidas"
            textCls={totalIn - totalOut >= 0 ? "text-brand-primary" : "text-red-500"}
            bgCls={totalIn - totalOut >= 0 ? "bg-brand-bg" : "bg-red-50"}
          />
        </div>

        {/* Monthly cards */}
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-2 px-0.5">
            <Calendar size={13} strokeWidth={1.8} className="text-brand-accent" />
            <span className="text-[11px] font-poppins font-semibold uppercase tracking-widest text-gray-400 capitalize">
              {monthLabel}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-2xl border border-green-100 bg-green-50 px-5 py-4 flex flex-col gap-1">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-poppins font-semibold uppercase tracking-wider text-green-600/70">
                  Ingresos del mes
                </span>
                <ArrowDownLeft size={15} strokeWidth={2} className="text-green-500" />
              </div>
              <p className="text-2xl font-poppins font-bold text-green-700 leading-none mt-1">
                ₡{thisMonthIn.toLocaleString("en-US")}
              </p>
              <p className="text-[11px] font-poppins text-green-600/60 mt-0.5">
                {thisMonth.length + thisMonthExternals.length}{" "}
                {thisMonth.length + thisMonthExternals.length === 1 ? "pago recibido" : "pagos recibidos"}
              </p>
            </div>
            <div className="rounded-2xl border border-red-100 bg-red-50 px-5 py-4 flex flex-col gap-1">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-poppins font-semibold uppercase tracking-wider text-red-500/70">
                  Salidas del mes
                </span>
                <ArrowUpRight size={15} strokeWidth={2} className="text-red-400" />
              </div>
              <p className="text-2xl font-poppins font-bold text-red-600 leading-none mt-1">
                ₡{thisMonthOut.toLocaleString("en-US")}
              </p>
              <p className="text-[11px] font-poppins text-red-500/60 mt-0.5">
                {thisMonthPayouts.length} {thisMonthPayouts.length === 1 ? "abono registrado" : "abonos registrados"}
              </p>
            </div>
          </div>
        </div>

        {/* Search */}
        <div className="relative mb-4 max-w-sm">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-300" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nombre, teléfono, producto…"
            className="w-full pl-9 pr-9 py-2.5 rounded-xl border border-gray-200 text-sm
                       font-poppins text-brand-dark placeholder:text-gray-300 outline-none
                       focus:border-brand-primary focus:ring-1 focus:ring-brand-primary/20 transition"
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-300
                         hover:text-gray-500 transition-colors"
            >
              <X size={14} />
            </button>
          )}
        </div>

        {/* Table */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          {isLoading ? (
            <TableSkeleton />
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-20 text-gray-300">
              <Receipt size={40} strokeWidth={1.1} />
              <p className="font-poppins text-sm text-gray-400">
                {search ? "No se encontraron resultados." : "Aún no hay movimientos registrados."}
              </p>
            </div>
          ) : (
            <>
              {/* Desktop table */}
              <table className="hidden md:table w-full table-auto">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50/70">
                    {["Fecha", "Persona", "Detalle", "Monto", "Tipo", "Nota"].map((h, i) => (
                      <th
                        key={h}
                        className={cn(
                          "px-4 py-2.5 text-[10px] font-poppins font-semibold text-gray-400 uppercase tracking-wider whitespace-nowrap",
                          i === 3 ? "text-right" : i === 4 ? "text-center" : "text-left"
                        )}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  <AnimatePresence>
                    {filtered.map((m) =>
                      m.kind === "in"
                        ? <PaymentRow          key={`in-${m.data.id}`}  log={m.data}    />
                        : m.kind === "out"
                        ? <PayoutRow           key={`out-${m.data.id}`} payout={m.data} />
                        : m.kind === "expense"
                        ? <ExpensePaymentRow   key={`exp-${m.data.id}`} ep={m.data}     />
                        : m.kind === "external"
                        ? <ExternalSaleRow     key={`ext-${m.data.id}`} sale={m.data}   />
                        : <RefundRow           key={`ref-${m.data.id}`} refund={m.data} />
                    )}
                  </AnimatePresence>
                </tbody>
              </table>

              {/* Mobile cards */}
              <div className="md:hidden flex flex-col divide-y divide-gray-50">
                <AnimatePresence>
                  {filtered.map((m) =>
                    m.kind === "in"
                      ? <MobilePaymentCard       key={`in-${m.data.id}`}  log={m.data}    />
                      : m.kind === "out"
                      ? <MobilePayoutCard        key={`out-${m.data.id}`} payout={m.data} />
                      : m.kind === "expense"
                      ? <MobileExpenseCard       key={`exp-${m.data.id}`} ep={m.data}     />
                      : m.kind === "external"
                      ? <MobileExternalSaleCard  key={`ext-${m.data.id}`} sale={m.data}   />
                      : <MobileRefundCard        key={`ref-${m.data.id}`} refund={m.data} />
                  )}
                </AnimatePresence>
              </div>
            </>
          )}

          {/* Footer */}
          {!isLoading && filtered.length > 0 && (
            <div className="px-4 py-3 border-t border-gray-50 flex items-center justify-between flex-wrap gap-2">
              <p className="text-[11px] font-poppins text-gray-400">
                {filtered.length} {filtered.length === 1 ? "movimiento" : "movimientos"}
                {search && ` · filtrado de ${movements.length}`}
              </p>
              <div className="flex items-center gap-4">
                {filteredIn > 0 && (
                  <span className="text-[11px] font-poppins font-semibold text-green-600 flex items-center gap-1">
                    <ArrowDownLeft size={11} strokeWidth={2.2} />
                    ₡{filteredIn.toLocaleString("en-US")}
                  </span>
                )}
                {filteredOut > 0 && (
                  <span className="text-[11px] font-poppins font-semibold text-red-500 flex items-center gap-1">
                    <ArrowUpRight size={11} strokeWidth={2.2} />
                    ₡{filteredOut.toLocaleString("en-US")}
                  </span>
                )}
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Modal */}
      <AnimatePresence>
        {modalOpen && (
          <ExternalSaleModal
            onClose={() => setModalOpen(false)}
            onSave={saveExternal}
            saving={savingExternal}
          />
        )}
      </AnimatePresence>
    </>
  );
}
