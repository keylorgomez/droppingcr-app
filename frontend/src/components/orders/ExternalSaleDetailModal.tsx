import { useState } from "react";
import { X, Package, Undo2 } from "lucide-react";
import { motion } from "motion/react";
import { externalSalePaid, type ExternalSale } from "../../services/externalSalesService";
import { formatDate, displayPhone } from "../../lib/formatters";
import CancelSaleDialog from "./CancelSaleDialog";

/**
 * Detalle de una venta externa o de un encargo entregado. No tienen envío ni
 * estados de entrega: lo único que se gestiona acá es cancelarlas. Los abonos
 * se registran en Cobros pendientes.
 */
export default function ExternalSaleDetailModal({ sale, onClose }: { sale: ExternalSale; onClose: () => void }) {
  const [showCancel, setShowCancel] = useState(false);
  const cancelled = sale.status === "cancelled";
  const paid      = externalSalePaid(sale);
  const kindLabel = sale.from_special_order ? "Encargo" : "Venta externa";

  const rows: Array<[string, string]> = [
    ["Precio",   `₡${sale.sale_price.toLocaleString("en-US")}`],
    ["Costo",    `₡${sale.cost_price.toLocaleString("en-US")}`],
    ["Ganancia", cancelled ? "— (cancelada)" : `₡${(sale.sale_price - sale.cost_price).toLocaleString("en-US")}`],
    ["Pagado",   `₡${paid.toLocaleString("en-US")}`],
    ...(sale.remaining > 0 ? [["Falta", `₡${sale.remaining.toLocaleString("en-US")}`] as [string, string]] : []),
  ];

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/40 z-40 backdrop-blur-sm flex items-center justify-center px-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.97, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.97, y: 8 }}
        transition={{ type: "spring", stiffness: 340, damping: 30 }}
        className="w-full max-w-md bg-white rounded-2xl shadow-xl flex flex-col max-h-[92vh] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start gap-3 px-5 py-4 border-b border-ink-100">
          <div className="w-12 h-12 rounded-xl bg-ink-50 border border-ink-100 shrink-0 flex items-center justify-center">
            <Package size={18} className="text-ink-200" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold italic text-brand-primary leading-snug">{sale.product_name}</p>
            <p className="text-xs text-ink-400 mt-0.5">{kindLabel} · {formatDate(sale.sold_at)}</p>
            <p className="text-xs text-brand-dark font-medium mt-0.5">
              {sale.guest_name ?? "Cliente sin nombre"}
              {sale.guest_phone && <span className="text-ink-400 font-normal"> · {displayPhone(sale.guest_phone)}</span>}
            </p>
          </div>
          <button type="button" onClick={onClose} className="p-1 text-ink-300 hover:text-ink-500" aria-label="Cerrar">
            <X size={18} />
          </button>
        </div>

        <div className="px-5 py-4 flex flex-col gap-4 overflow-y-auto">
          {cancelled && (
            <p className="text-xs rounded-xl bg-red-50 text-red-600 px-3 py-2">
              Cancelada: ya no cuenta como venta ni su costo.
            </p>
          )}
          <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
            {rows.map(([term, value]) => (
              <div key={term} className="contents">
                <dt className="text-ink-400">{term}</dt>
                <dd className="text-right font-semibold text-brand-dark">{value}</dd>
              </div>
            ))}
          </dl>
          {sale.note && <p className="text-xs text-ink-400">{sale.note}</p>}
          {sale.remaining > 0 && (
            <p className="text-[11px] text-ink-400">Los abonos se registran en Cobros pendientes.</p>
          )}
        </div>

        <div className="flex gap-3 px-5 py-4 border-t border-ink-100">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl border border-ink-200 text-sm text-ink-500 hover:border-ink-300 transition-colors"
          >
            Cerrar
          </button>
          {!cancelled && (
            <button
              type="button"
              onClick={() => setShowCancel(true)}
              className="flex-1 py-2.5 rounded-xl border border-red-200 text-red-500 text-sm font-medium
                         flex items-center justify-center gap-2 hover:bg-red-50 transition-colors"
            >
              <Undo2 size={14} />
              Cancelar y devolver
            </button>
          )}
        </div>
      </motion.div>

      {showCancel && (
        <CancelSaleDialog
          kind="external"
          id={sale.id}
          label={`${sale.product_name}${sale.guest_name ? ` · ${sale.guest_name}` : ""}`}
          paid={paid}
          owed={sale.remaining}
          fromSpecialOrder={sale.from_special_order}
          onClose={() => setShowCancel(false)}
          onDone={onClose}
        />
      )}
    </motion.div>
  );
}
