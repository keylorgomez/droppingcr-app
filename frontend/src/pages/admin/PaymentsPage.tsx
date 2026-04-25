import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery }    from "@tanstack/react-query";
import {
  ArrowLeft, Search, X, Receipt, TrendingUp, ArrowDownLeft, ArrowUpRight,
  Minus, Calendar, Users,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import Header from "../../components/ui/Header";
import { useAuth } from "../../context/AuthContext";
import {
  getPaymentsLog, deliveryStatusMeta,
  type PaymentLog,
} from "../../services/salesService";
import { getAllPayouts, type AdminPayout } from "../../services/payoutsService";
import { getExpensePaymentsLog, type ExpensePaymentLog } from "../../services/expensesService";
import { cn } from "../../lib/utils";

// ── Unified movement entry ─────────────────────────────────────────────────

type Movement =
  | { kind: "in";      data: PaymentLog        }
  | { kind: "out";     data: AdminPayout       }
  | { kind: "expense"; data: ExpensePaymentLog };

// ── Helpers ────────────────────────────────────────────────────────────────

const normalize = (s: string) =>
  s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("es-CR", {
    day: "numeric", month: "short", year: "numeric",
  });
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("es-CR", {
    hour: "2-digit", minute: "2-digit",
  });

}

// ── Skeleton ───────────────────────────────────────────────────────────────

function TableSkeleton() {
  return (
    <div className="flex flex-col gap-2">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="animate-pulse flex gap-3 px-4 py-3.5 border-b border-gray-50">
          <div className="h-3 bg-gray-100 rounded w-24 shrink-0" />
          <div className="h-3 bg-gray-100 rounded flex-1" />
          <div className="h-3 bg-gray-100 rounded w-20 shrink-0" />
          <div className="h-3 bg-gray-100 rounded w-16 shrink-0" />
        </div>
      ))}
    </div>
  );
}

// ── Summary card ───────────────────────────────────────────────────────────

function SummaryCard({
  icon: Icon, label, value, sub, textCls = "text-brand-primary", bgCls = "bg-brand-bg",
}: {
  icon: React.ElementType; label: string; value: string; sub?: string;
  textCls?: string; bgCls?: string;
}) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-5 py-4
                    flex items-center gap-4">
      <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center shrink-0", bgCls)}>
        <Icon size={18} strokeWidth={1.8} className={textCls} />
      </div>
      <div className="min-w-0">
        <p className="text-[10px] font-poppins text-gray-400 uppercase tracking-wider">{label}</p>
        <p className={cn("font-poppins font-bold text-lg leading-tight", textCls)}>{value}</p>
        {sub && <p className="text-[11px] font-poppins text-gray-400">{sub}</p>}
      </div>
    </div>
  );
}

// ── Inflow row ─────────────────────────────────────────────────────────────

function PaymentRow({ log }: { log: PaymentLog }) {
  const status = deliveryStatusMeta(log.delivery_status);
  return (
    <motion.tr
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="border-b border-gray-50 last:border-b-0 hover:bg-gray-50/60 transition-colors"
    >
      <td className="px-4 py-3 align-top shrink-0">
        <p className="text-xs font-poppins text-brand-dark whitespace-nowrap">
          {formatDate(log.paid_at)}
        </p>
        <p className="text-[10px] font-poppins text-gray-300 mt-0.5">
          {formatTime(log.paid_at)}
        </p>
      </td>
      <td className="px-4 py-3 align-top min-w-0">
        <p className="text-xs font-poppins font-medium text-brand-dark truncate max-w-[140px]">
          {log.guest_name ?? <span className="text-gray-300 font-normal italic">Sin nombre</span>}
        </p>
        {log.guest_phone && (
          <p className="text-[10px] font-poppins text-gray-400 mt-0.5">{log.guest_phone}</p>
        )}
      </td>
      <td className="px-4 py-3 align-top min-w-0">
        <p className="text-xs font-poppins italic text-brand-primary font-semibold
                      truncate max-w-[160px] leading-snug">
          {log.product_name}
        </p>
        <span className="inline-block mt-0.5 text-[10px] font-poppins text-gray-400
                         bg-gray-100 rounded-full px-2 py-0.5">
          T.{log.variant_size}
        </span>
      </td>
      <td className="px-4 py-3 align-top text-right shrink-0">
        <div className="flex items-center justify-end gap-1">
          <ArrowDownLeft size={12} className="text-green-500" strokeWidth={2.2} />
          <p className="text-sm font-poppins font-bold text-green-600 whitespace-nowrap">
            ₡{log.amount.toLocaleString("en-US")}
          </p>
        </div>
      </td>
      <td className="px-4 py-3 align-top text-center shrink-0">
        <span className={cn(
          "text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full font-poppins whitespace-nowrap",
          status.bgCls
        )}>
          {status.label}
        </span>
      </td>
      <td className="px-4 py-3 align-top min-w-0">
        <p className="text-[11px] font-poppins text-gray-400 truncate max-w-[140px]">
          {log.note ?? <span className="text-gray-200 italic">—</span>}
        </p>
      </td>
    </motion.tr>
  );
}

// ── Outflow row (payout) ───────────────────────────────────────────────────

function PayoutRow({ payout }: { payout: AdminPayout }) {
  return (
    <motion.tr
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="border-b border-gray-50 last:border-b-0 hover:bg-red-50/30 transition-colors"
    >
      <td className="px-4 py-3 align-top shrink-0">
        <p className="text-xs font-poppins text-brand-dark whitespace-nowrap">
          {formatDate(payout.paid_at)}
        </p>
        <p className="text-[10px] font-poppins text-gray-300 mt-0.5">
          {formatTime(payout.paid_at)}
        </p>
      </td>
      <td className="px-4 py-3 align-top min-w-0">
        <p className="text-xs font-poppins font-medium text-brand-dark truncate max-w-[140px]">
          {payout.recipient_name}
        </p>
        {payout.creator_name && (
          <p className="text-[10px] font-poppins text-gray-400 mt-0.5">
            Por: {payout.creator_name}
          </p>
        )}
      </td>
      <td className="px-4 py-3 align-top min-w-0">
        <p className="text-xs font-poppins font-semibold text-gray-500 leading-snug">
          Distribución de ganancia
        </p>
        <span className="inline-block mt-0.5 text-[10px] font-poppins text-red-400
                         bg-red-50 rounded-full px-2 py-0.5">
          Admin
        </span>
      </td>
      <td className="px-4 py-3 align-top text-right shrink-0">
        <div className="flex items-center justify-end gap-1">
          <ArrowUpRight size={12} className="text-red-400" strokeWidth={2.2} />
          <p className="text-sm font-poppins font-bold text-red-500 whitespace-nowrap">
            ₡{payout.amount.toLocaleString("en-US")}
          </p>
        </div>
      </td>
      <td className="px-4 py-3 align-top text-center shrink-0">
        <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5
                         rounded-full font-poppins whitespace-nowrap bg-red-100 text-red-600">
          Salida
        </span>
      </td>
      <td className="px-4 py-3 align-top min-w-0">
        <p className="text-[11px] font-poppins text-gray-400 truncate max-w-[140px]">
          {payout.note ?? <span className="text-gray-200 italic">—</span>}
        </p>
      </td>
    </motion.tr>
  );
}

// ── Expense payment row ────────────────────────────────────────────────────

function ExpensePaymentRow({ ep }: { ep: ExpensePaymentLog }) {
  return (
    <motion.tr
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="border-b border-gray-50 last:border-b-0 hover:bg-orange-50/20 transition-colors"
    >
      <td className="px-4 py-3 align-top shrink-0">
        <p className="text-xs font-poppins text-brand-dark whitespace-nowrap">
          {formatDate(ep.paid_at)}
        </p>
        <p className="text-[10px] font-poppins text-gray-300 mt-0.5">
          {formatTime(ep.paid_at)}
        </p>
      </td>
      <td className="px-4 py-3 align-top min-w-0">
        <p className="text-xs font-poppins font-medium text-brand-dark truncate max-w-[140px]">
          Gasto operativo
        </p>
        {ep.creator_name && (
          <p className="text-[10px] font-poppins text-gray-400 mt-0.5">
            Por: {ep.creator_name}
          </p>
        )}
      </td>
      <td className="px-4 py-3 align-top min-w-0">
        <p className="text-xs font-poppins font-semibold text-gray-600 leading-snug truncate max-w-[160px]">
          {ep.expense_description}
        </p>
        {ep.expense_category && (
          <span className="inline-block mt-0.5 text-[10px] font-poppins text-orange-500
                           bg-orange-50 rounded-full px-2 py-0.5">
            {ep.expense_category}
          </span>
        )}
      </td>
      <td className="px-4 py-3 align-top text-right shrink-0">
        <div className="flex items-center justify-end gap-1">
          <ArrowUpRight size={12} className="text-orange-400" strokeWidth={2.2} />
          <p className="text-sm font-poppins font-bold text-orange-500 whitespace-nowrap">
            ₡{ep.amount.toLocaleString("en-US")}
          </p>
        </div>
      </td>
      <td className="px-4 py-3 align-top text-center shrink-0">
        <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5
                         rounded-full font-poppins whitespace-nowrap bg-orange-100 text-orange-600">
          Gasto
        </span>
      </td>
      <td className="px-4 py-3 align-top min-w-0">
        <p className="text-[11px] font-poppins text-gray-400 truncate max-w-[140px]">
          {ep.note ?? <span className="text-gray-200 italic">—</span>}
        </p>
      </td>
    </motion.tr>
  );
}

// ── Mobile expense payment card ────────────────────────────────────────────

function MobileExpenseCard({ ep }: { ep: ExpensePaymentLog }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      className="px-4 py-3.5 flex gap-3 bg-orange-50/20"
    >
      <div className="flex flex-col items-center gap-1 shrink-0 min-w-[80px]">
        <div className="flex items-center gap-0.5">
          <ArrowUpRight size={11} className="text-orange-400" strokeWidth={2.2} />
          <p className="text-sm font-poppins font-bold text-orange-500 whitespace-nowrap">
            ₡{ep.amount.toLocaleString("en-US")}
          </p>
        </div>
        <p className="text-[10px] font-poppins text-gray-400 text-center leading-tight">
          {formatDate(ep.paid_at)}
        </p>
      </div>
      <div className="flex flex-col gap-1 flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <p className="text-xs font-poppins font-semibold text-gray-700 leading-snug line-clamp-2 flex-1">
            {ep.expense_description}
          </p>
          <span className="shrink-0 text-[10px] font-bold uppercase tracking-wider
                           px-2 py-0.5 rounded-full font-poppins bg-orange-100 text-orange-600">
            Gasto
          </span>
        </div>
        {ep.expense_category && (
          <p className="text-[11px] font-poppins text-orange-500">{ep.expense_category}</p>
        )}
        {ep.note && (
          <p className="text-[11px] font-poppins text-gray-400 truncate">{ep.note}</p>
        )}
      </div>
    </motion.div>
  );
}

// ── Mobile card ────────────────────────────────────────────────────────────

function MobilePaymentCard({ log }: { log: PaymentLog }) {
  const status = deliveryStatusMeta(log.delivery_status);
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      className="px-4 py-3.5 flex gap-3"
    >
      <div className="flex flex-col items-center gap-1 shrink-0 min-w-[80px]">
        <div className="flex items-center gap-0.5">
          <ArrowDownLeft size={11} className="text-green-500" strokeWidth={2.2} />
          <p className="text-sm font-poppins font-bold text-green-600 whitespace-nowrap">
            ₡{log.amount.toLocaleString("en-US")}
          </p>
        </div>
        <p className="text-[10px] font-poppins text-gray-400 text-center leading-tight">
          {formatDate(log.paid_at)}
        </p>
      </div>
      <div className="flex flex-col gap-1 flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <p className="text-xs font-poppins font-semibold italic text-brand-primary
                        leading-snug line-clamp-2 flex-1">
            {log.product_name}
            <span className="not-italic font-normal text-gray-400"> · T.{log.variant_size}</span>
          </p>
          <span className={cn(
            "shrink-0 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full font-poppins",
            status.bgCls
          )}>
            {status.label}
          </span>
        </div>
        <p className="text-[11px] font-poppins text-gray-500">
          {log.guest_name ?? <span className="italic text-gray-300">Sin nombre</span>}
          {log.guest_phone && <span className="text-gray-400"> · {log.guest_phone}</span>}
        </p>
        {log.note && (
          <p className="text-[11px] font-poppins text-gray-400 truncate">{log.note}</p>
        )}
      </div>
    </motion.div>
  );
}

function MobilePayoutCard({ payout }: { payout: AdminPayout }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      className="px-4 py-3.5 flex gap-3 bg-red-50/30"
    >
      <div className="flex flex-col items-center gap-1 shrink-0 min-w-[80px]">
        <div className="flex items-center gap-0.5">
          <ArrowUpRight size={11} className="text-red-400" strokeWidth={2.2} />
          <p className="text-sm font-poppins font-bold text-red-500 whitespace-nowrap">
            ₡{payout.amount.toLocaleString("en-US")}
          </p>
        </div>
        <p className="text-[10px] font-poppins text-gray-400 text-center leading-tight">
          {formatDate(payout.paid_at)}
        </p>
      </div>
      <div className="flex flex-col gap-1 flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <p className="text-xs font-poppins font-semibold text-gray-700 leading-snug flex-1">
            Distribución de ganancia
          </p>
          <span className="shrink-0 text-[10px] font-bold uppercase tracking-wider
                           px-2 py-0.5 rounded-full font-poppins bg-red-100 text-red-600">
            Salida
          </span>
        </div>
        <p className="text-[11px] font-poppins text-gray-500">
          {payout.recipient_name}
        </p>
        {payout.note && (
          <p className="text-[11px] font-poppins text-gray-400 truncate">{payout.note}</p>
        )}
      </div>
    </motion.div>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────

export default function PaymentsPage() {
  const { user }   = useAuth();
  const navigate   = useNavigate();
  const [search, setSearch] = useState("");

  const { data: logs    = [], isLoading: loadingLogs    } = useQuery({
    queryKey: ["payments-log"],
    queryFn:  getPaymentsLog,
    staleTime: 30_000,
  });

  const { data: payouts = [], isLoading: loadingPayouts } = useQuery({
    queryKey: ["admin-payouts"],
    queryFn:  getAllPayouts,
    staleTime: 30_000,
  });

  const { data: expensePayments = [], isLoading: loadingExpenses } = useQuery({
    queryKey: ["expense-payments-log"],
    queryFn:  getExpensePaymentsLog,
    staleTime: 30_000,
  });

  const isLoading = loadingLogs || loadingPayouts || loadingExpenses;

  // Guard: solo admin
  if (user && user.role !== "admin") {
    navigate("/");
    return null;
  }

  // ── Merge and sort ───────────────────────────────────────────────────────
  const movements: Movement[] = useMemo(() => {
    const ins:  Movement[] = logs.map((d)            => ({ kind: "in"      as const, data: d }));
    const outs: Movement[] = payouts.map((d)         => ({ kind: "out"     as const, data: d }));
    const exps: Movement[] = expensePayments.map((d) => ({ kind: "expense" as const, data: d }));
    return [...ins, ...outs, ...exps].sort(
      (a, b) => new Date(b.data.paid_at).getTime() - new Date(a.data.paid_at).getTime()
    );
  }, [logs, payouts, expensePayments]);

  // ── Filter ───────────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    if (!search.trim()) return movements;
    const q = normalize(search.trim());
    return movements.filter((m) => {
      if (m.kind === "in") {
        const l = m.data;
        return (
          normalize(l.guest_name   ?? "").includes(q) ||
          normalize(l.guest_phone  ?? "").includes(q) ||
          normalize(l.product_name     ).includes(q) ||
          normalize(l.note         ?? "").includes(q)
        );
      } else if (m.kind === "out") {
        const p = m.data;
        return (
          normalize(p.recipient_name   ).includes(q) ||
          normalize(p.note         ?? "").includes(q) ||
          normalize(p.creator_name ?? "").includes(q)
        );
      } else {
        const e = m.data;
        return (
          normalize(e.expense_description         ).includes(q) ||
          normalize(e.expense_category        ?? "").includes(q) ||
          normalize(e.note                    ?? "").includes(q)
        );
      }
    });
  }, [movements, search]);

  // ── Summary stats ────────────────────────────────────────────────────────
  const totalIn  = logs.reduce((s, l) => s + l.amount, 0);
  const totalOut = payouts.reduce((s, p) => s + p.amount, 0)
                 + expensePayments.reduce((s, e) => s + e.amount, 0);

  const uniqueClients = new Set(
    logs.map((l) => l.guest_phone ?? l.guest_name ?? l.sale_id)
  ).size;

  const now            = new Date();
  const currentMonth   = now.getMonth();
  const currentYear    = now.getFullYear();
  const monthLabel     = now.toLocaleDateString("es-CR", { month: "long", year: "numeric" });

  const thisMonth = logs.filter((l) => {
    const d = new Date(l.paid_at);
    return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
  });
  const thisMonthIn = thisMonth.reduce((s, l) => s + l.amount, 0);

  const thisMonthPayouts = payouts.filter((p) => {
    const d = new Date(p.paid_at);
    return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
  });
  const thisMonthExpenses = expensePayments.filter((e) => {
    const d = new Date(e.paid_at);
    return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
  });
  const thisMonthOut = thisMonthPayouts.reduce((s, p) => s + p.amount, 0)
                     + thisMonthExpenses.reduce((s, e) => s + e.amount, 0);

  // ── Footer totals ────────────────────────────────────────────────────────
  const filteredIn  = filtered
    .filter((m) => m.kind === "in")
    .reduce((s, m) => s + m.data.amount, 0);
  const filteredOut = filtered
    .filter((m) => m.kind !== "in")
    .reduce((s, m) => s + m.data.amount, 0);

  return (
    <>
      <Header />
      <main className="max-w-7xl mx-auto px-4 pt-8 pb-24 md:pb-16">

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

        {/* Summary cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3">
          <SummaryCard
            icon={ArrowDownLeft}
            label="Ingresos totales"
            value={`₡${totalIn.toLocaleString("en-US")}`}
            sub={`${logs.length} pagos recibidos`}
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
            {/* Monthly ingresos */}
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
                {thisMonth.length} {thisMonth.length === 1 ? "pago recibido" : "pagos recibidos"}
              </p>
            </div>

            {/* Monthly salidas */}
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
                        ? <PaymentRow      key={`in-${m.data.id}`}  log={m.data}    />
                        : m.kind === "out"
                        ? <PayoutRow       key={`out-${m.data.id}`} payout={m.data} />
                        : <ExpensePaymentRow key={`exp-${m.data.id}`} ep={m.data}   />
                    )}
                  </AnimatePresence>
                </tbody>
              </table>

              {/* Mobile cards */}
              <div className="md:hidden flex flex-col divide-y divide-gray-50">
                <AnimatePresence>
                  {filtered.map((m) =>
                    m.kind === "in"
                      ? <MobilePaymentCard key={`in-${m.data.id}`}   log={m.data}    />
                      : m.kind === "out"
                      ? <MobilePayoutCard  key={`out-${m.data.id}`}  payout={m.data} />
                      : <MobileExpenseCard key={`exp-${m.data.id}`}  ep={m.data}     />
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
    </>
  );
}
