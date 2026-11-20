import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, Undo2 } from "lucide-react";
import { useToast } from "../ui/Toast";
import { cancelSale } from "../../services/salesService";
import { QUERY_KEYS } from "../../constants/queryKeys";
import RefundChoice from "./RefundChoice";
import { refundAmountFor, type RefundMode } from "../../lib/refunds";

export type CancelKind = "sale" | "order" | "external";

/**
 * Confirmación para cancelar una venta. Cancelar la deshace: deja de contar
 * su ingreso y su costo, el stock del catálogo vuelve y, si se devolvió la
 * plata, la devolución queda registrada en Movimientos.
 */
export default function CancelSaleDialog({
  kind,
  id,
  label,
  paid,
  owed = 0,
  fromSpecialOrder = false,
  onClose,
  onDone,
}: {
  kind:   CancelKind;
  id:     string;
  /** Qué se está cancelando, para el texto: "IZAN tank · Talla S". */
  label:  string;
  /** Lo que el cliente pagó hasta hoy. */
  paid:   number;
  /** Lo que faltaba cobrar (ventas a pagos): ese saldo se anula. */
  owed?:  number;
  fromSpecialOrder?: boolean;
  onClose: () => void;
  onDone:  () => void;
}) {
  const { showToast } = useToast();
  const queryClient   = useQueryClient();
  const [mode,    setMode]    = useState<RefundMode | null>(paid > 0 ? null : "none");
  const [partial, setPartial] = useState("");
  const [reason,  setReason]  = useState("");
  const refundAmount = refundAmountFor(mode, partial, paid);

  const mutation = useMutation({
    mutationFn: () => cancelSale(kind, id, reason.trim() || null, refundAmount ?? 0),
    onSuccess: (refunded) => {
      showToast(
        refunded > 0
          ? `Venta cancelada. Devolución de ₡${Math.round(refunded).toLocaleString("en-US")} registrada.`
          : "Venta cancelada.",
        "success",
      );
      for (const key of [
        QUERY_KEYS.ADMIN_SALES, QUERY_KEYS.ADMIN_ORDERS, QUERY_KEYS.EXTERNAL_SALES_LOG,
        QUERY_KEYS.REFUNDS_LOG, QUERY_KEYS.PAYMENTS_LOG, QUERY_KEYS.GROUPED_DEBTS,
        QUERY_KEYS.FINANCE, QUERY_KEYS.PRODUCTS, QUERY_KEYS.PRODUCTS_WITH_VARIANTS,
        QUERY_KEYS.SPECIAL_ORDERS, ["cart-stocks"],
      ]) {
        queryClient.invalidateQueries({ queryKey: key });
      }
      onDone();
    },
    onError: (err: Error) => showToast(err.message, "error"),
  });

  const effects = [
    "Deja de contar como venta: se quitan su ingreso y su costo de las ganancias, como si nunca se hubiera hecho.",
    kind === "external"
      ? "Si la volvés a registrar después, el costo no queda doble."
      : "Las piezas vuelven al stock del catálogo.",
    ...(fromSpecialOrder ? ["El encargo también queda cancelado."] : []),
  ];


  return (
    <div
      onClick={(e) => e.stopPropagation()}
      className="fixed inset-0 z-[60] flex items-center justify-center p-4"
      role="alertdialog" aria-modal="true" aria-labelledby="cancel-sale-title"
    >
      <div className="absolute inset-0 bg-ink-950/55 backdrop-blur-sm" onClick={() => !mutation.isPending && onClose()} />
      <div className="relative w-full max-w-sm max-h-[92vh] overflow-y-auto overscroll-contain rounded-2xl bg-white shadow-xl p-5 sm:p-6 flex flex-col gap-3.5">
        <div className="flex flex-col items-center text-center gap-2">
          <span className="h-10 w-10 rounded-full bg-red-50 text-red-500 flex items-center justify-center">
            <Undo2 size={20} strokeWidth={1.8} />
          </span>
          <h2 id="cancel-sale-title" className="font-semibold text-brand-dark text-lg leading-tight">
            ¿Cancelar esta venta?
          </h2>
          <p className="text-sm text-ink-500 leading-snug">{label}</p>
        </div>

        <ul className="text-xs text-ink-500 flex flex-col gap-1.5 list-disc pl-4">
          {effects.map((text) => <li key={text}>{text}</li>)}
        </ul>

        <RefundChoice
          paid={paid}
          mode={mode}
          onMode={setMode}
          partial={partial}
          onPartial={setPartial}
          owedNote={owed > 0 ? `Faltaban ₡${Math.round(owed).toLocaleString("en-US")} por cobrar: ese saldo se anula y sale de Cobros pendientes.` : undefined}
        />

        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-ink-500 uppercase tracking-wider">
            Motivo <span className="text-ink-300 normal-case font-normal">(opcional)</span>
          </label>
          <input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Ej: defecto de fábrica"
            className="w-full rounded-xl border border-ink-200 px-4 py-2.5 text-sm text-brand-dark
                       placeholder:text-ink-300 outline-none focus:border-brand-primary
                       focus:ring-1 focus:ring-brand-primary/20 transition"
          />
        </div>

        <div className="flex gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={mutation.isPending}
            className="flex-1 h-11 rounded-xl border border-ink-200 text-sm text-ink-500 hover:border-ink-300 transition-colors"
          >
            Volver
          </button>
          <button
            type="button"
            onClick={() => mutation.mutate()}
            disabled={refundAmount === null || mutation.isPending}
            className="flex-1 h-11 rounded-xl bg-red-500 text-white text-sm font-semibold
                       flex items-center justify-center gap-2 hover:bg-red-600 transition-colors
                       disabled:opacity-50"
          >
            {mutation.isPending && <Loader2 size={14} className="animate-spin" />}
            Cancelar venta
          </button>
        </div>
      </div>
    </div>
  );
}
