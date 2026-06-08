import { motion } from "framer-motion";
import { ArrowDownLeft, ArrowUpRight } from "lucide-react";
import { deliveryStatusMeta } from "../../services/salesService";
import { formatDate, formatTime } from "../../lib/formatters";
import { cn } from "../../lib/utils";
import type { PaymentLog, RefundLog } from "../../services/salesService";
import type { AdminPayout } from "../../services/payoutsService";
import type { ExpensePaymentLog } from "../../services/expensesService";
import type { ExternalSale } from "../../services/externalSalesService";

// ── Unified movement entry (shared with PaymentsPage) ─────────────────────

export type Movement =
  | { kind: "in";       data: PaymentLog        }
  | { kind: "out";      data: AdminPayout       }
  | { kind: "expense";  data: ExpensePaymentLog }
  | { kind: "refund";   data: RefundLog         }
  | { kind: "external"; data: ExternalSale      };

// ── Skeleton ───────────────────────────────────────────────────────────────

export function TableSkeleton() {
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

export function SummaryCard({
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

export function PaymentRow({ log }: { log: PaymentLog }) {
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

// ── Mobile inflow card ─────────────────────────────────────────────────────

export function MobilePaymentCard({ log }: { log: PaymentLog }) {
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

// ── Outflow row (payout) ───────────────────────────────────────────────────

export function PayoutRow({ payout }: { payout: AdminPayout }) {
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

// ── Mobile outflow card ────────────────────────────────────────────────────

export function MobilePayoutCard({ payout }: { payout: AdminPayout }) {
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

// ── Expense payment row ────────────────────────────────────────────────────

export function ExpensePaymentRow({ ep }: { ep: ExpensePaymentLog }) {
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

// ── Mobile expense card ────────────────────────────────────────────────────

export function MobileExpenseCard({ ep }: { ep: ExpensePaymentLog }) {
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

// ── Refund row ─────────────────────────────────────────────────────────────

export function RefundRow({ refund }: { refund: RefundLog }) {
  return (
    <motion.tr
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="border-b border-gray-50 last:border-b-0 hover:bg-blue-50/20 transition-colors"
    >
      <td className="px-4 py-3 align-top shrink-0">
        <p className="text-xs font-poppins text-brand-dark whitespace-nowrap">
          {formatDate(refund.created_at)}
        </p>
        <p className="text-[10px] font-poppins text-gray-300 mt-0.5">
          {formatTime(refund.created_at)}
        </p>
      </td>
      <td className="px-4 py-3 align-top min-w-0">
        <p className="text-xs font-poppins font-medium text-brand-dark truncate max-w-[140px]">
          {refund.guest_name ?? <span className="text-gray-300 italic font-normal">Sin nombre</span>}
        </p>
        {refund.guest_phone && (
          <p className="text-[10px] font-poppins text-gray-400 mt-0.5">{refund.guest_phone}</p>
        )}
      </td>
      <td className="px-4 py-3 align-top min-w-0">
        <p className="text-xs font-poppins font-semibold italic text-blue-600 leading-snug
                      truncate max-w-[160px]">
          {refund.product_name}
        </p>
        <span className="inline-block mt-0.5 text-[10px] font-poppins text-blue-400
                         bg-blue-50 rounded-full px-2 py-0.5">
          T.{refund.variant_size}
        </span>
      </td>
      <td className="px-4 py-3 align-top text-right shrink-0">
        <div className="flex items-center justify-end gap-1">
          <ArrowUpRight size={12} className="text-blue-400" strokeWidth={2.2} />
          <p className="text-sm font-poppins font-bold text-blue-600 whitespace-nowrap">
            ₡{refund.amount.toLocaleString("en-US")}
          </p>
        </div>
      </td>
      <td className="px-4 py-3 align-top text-center shrink-0">
        <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5
                         rounded-full font-poppins whitespace-nowrap bg-blue-100 text-blue-600">
          Devolución
        </span>
      </td>
      <td className="px-4 py-3 align-top min-w-0">
        <p className="text-[11px] font-poppins text-gray-400 truncate max-w-[140px]">
          {refund.reason ?? <span className="text-gray-200 italic">—</span>}
        </p>
      </td>
    </motion.tr>
  );
}

// ── Mobile refund card ─────────────────────────────────────────────────────

export function MobileRefundCard({ refund }: { refund: RefundLog }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      className="px-4 py-3.5 flex gap-3 bg-blue-50/20"
    >
      <div className="flex flex-col items-center gap-1 shrink-0 min-w-[80px]">
        <div className="flex items-center gap-0.5">
          <ArrowUpRight size={11} className="text-blue-400" strokeWidth={2.2} />
          <p className="text-sm font-poppins font-bold text-blue-600 whitespace-nowrap">
            ₡{refund.amount.toLocaleString("en-US")}
          </p>
        </div>
        <p className="text-[10px] font-poppins text-gray-400 text-center leading-tight">
          {formatDate(refund.created_at)}
        </p>
      </div>
      <div className="flex flex-col gap-1 flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <p className="text-xs font-poppins font-semibold italic text-blue-600 leading-snug
                        line-clamp-2 flex-1">
            {refund.product_name}
            <span className="not-italic font-normal text-gray-400"> · T.{refund.variant_size}</span>
          </p>
          <span className="shrink-0 text-[10px] font-bold uppercase tracking-wider
                           px-2 py-0.5 rounded-full font-poppins bg-blue-100 text-blue-600">
            Devolución
          </span>
        </div>
        <p className="text-[11px] font-poppins text-gray-500">
          {refund.guest_name ?? <span className="italic text-gray-300">Sin nombre</span>}
          {refund.guest_phone && <span className="text-gray-400"> · {refund.guest_phone}</span>}
        </p>
        {refund.reason && (
          <p className="text-[11px] font-poppins text-gray-400 truncate">{refund.reason}</p>
        )}
      </div>
    </motion.div>
  );
}

// ── External sale row ──────────────────────────────────────────────────────

export function ExternalSaleRow({ sale }: { sale: ExternalSale }) {
  const profit = sale.sale_price - sale.cost_price;
  return (
    <motion.tr
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="border-b border-gray-50 last:border-b-0 hover:bg-purple-50/30 transition-colors"
    >
      <td className="px-4 py-3 align-top shrink-0">
        <p className="text-xs font-poppins text-brand-dark whitespace-nowrap">
          {formatDate(sale.sold_at)}
        </p>
        <p className="text-[10px] font-poppins text-gray-300 mt-0.5">
          {formatTime(sale.sold_at)}
        </p>
      </td>
      <td className="px-4 py-3 align-top min-w-0">
        <p className="text-xs font-poppins font-medium italic text-gray-400 truncate max-w-[140px]">
          Venta externa
        </p>
      </td>
      <td className="px-4 py-3 align-top min-w-0">
        <p className="text-xs font-poppins font-semibold italic text-purple-700 leading-snug
                      truncate max-w-[160px]">
          {sale.product_name}
        </p>
        <span className="inline-block mt-0.5 text-[10px] font-poppins rounded-full px-2 py-0.5
                         bg-purple-50 text-purple-500">
          Ganancia: ₡{profit.toLocaleString("en-US")}
        </span>
      </td>
      <td className="px-4 py-3 align-top text-right shrink-0">
        <div className="flex items-center justify-end gap-1">
          <ArrowDownLeft size={12} className="text-purple-500" strokeWidth={2.2} />
          <p className="text-sm font-poppins font-bold text-purple-600 whitespace-nowrap">
            ₡{sale.sale_price.toLocaleString("en-US")}
          </p>
        </div>
      </td>
      <td className="px-4 py-3 align-top text-center shrink-0">
        <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5
                         rounded-full font-poppins whitespace-nowrap bg-purple-100 text-purple-600">
          Reventa
        </span>
      </td>
      <td className="px-4 py-3 align-top min-w-0">
        <p className="text-[11px] font-poppins text-gray-400 truncate max-w-[140px]">
          {sale.note ?? <span className="text-gray-200 italic">—</span>}
        </p>
      </td>
    </motion.tr>
  );
}

// ── Mobile external sale card ──────────────────────────────────────────────

export function MobileExternalSaleCard({ sale }: { sale: ExternalSale }) {
  const profit = sale.sale_price - sale.cost_price;
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      className="px-4 py-3.5 flex gap-3 bg-purple-50/20"
    >
      <div className="flex flex-col items-center gap-1 shrink-0 min-w-[80px]">
        <div className="flex items-center gap-0.5">
          <ArrowDownLeft size={11} className="text-purple-500" strokeWidth={2.2} />
          <p className="text-sm font-poppins font-bold text-purple-600 whitespace-nowrap">
            ₡{sale.sale_price.toLocaleString("en-US")}
          </p>
        </div>
        <p className="text-[10px] font-poppins text-gray-400 text-center leading-tight">
          {formatDate(sale.sold_at)}
        </p>
      </div>
      <div className="flex flex-col gap-1 flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <p className="text-xs font-poppins font-semibold italic text-purple-700 leading-snug
                        line-clamp-2 flex-1">
            {sale.product_name}
          </p>
          <span className="shrink-0 text-[10px] font-bold uppercase tracking-wider
                           px-2 py-0.5 rounded-full font-poppins bg-purple-100 text-purple-600">
            Reventa
          </span>
        </div>
        <p className="text-[11px] font-poppins text-purple-500">
          Ganancia: ₡{profit.toLocaleString("en-US")}
        </p>
        {sale.note && (
          <p className="text-[11px] font-poppins text-gray-400 truncate">{sale.note}</p>
        )}
      </div>
    </motion.div>
  );
}
