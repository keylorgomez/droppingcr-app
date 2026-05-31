import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { X, Package, Check, Loader2, MessageCircle, Plus } from "lucide-react";
import { motion } from "framer-motion";
import { useToast } from "../ui/Toast";
import {
  DELIVERY_STATUSES,
  type DeliveryStatus,
} from "../../services/salesService";
import {
  updateOrderAdmin,
  addOrderPayment,
  type AdminOrder,
} from "../../services/ordersService";
import { QUERY_KEYS } from "../../constants/queryKeys";
import { cn } from "../../lib/utils";
import { formatDate } from "../../lib/formatters";

// ── Shared style ───────────────────────────────────────────────────────────

const inputCls =
  "w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-poppins text-brand-dark " +
  "placeholder:text-gray-300 outline-none focus:border-brand-primary " +
  "focus:ring-1 focus:ring-brand-primary/20 transition";

// ── Props ──────────────────────────────────────────────────────────────────

interface OrderDetailModalProps {
  order:   AdminOrder;
  onClose: () => void;
}

// ── Component ──────────────────────────────────────────────────────────────

export default function OrderDetailModal({ order, onClose }: OrderDetailModalProps) {
  const { showToast } = useToast();
  const queryClient   = useQueryClient();

  const [deliveryStatus, setDeliveryStatus] = useState<DeliveryStatus>(
    order.delivery_status as DeliveryStatus
  );
  const [trackingNumber, setTrackingNumber] = useState(order.tracking_number ?? "");
  const [note,           setNote]           = useState(order.note ?? "");
  const [trackingError,  setTrackingError]  = useState("");
  const [showAbono,      setShowAbono]      = useState(false);
  const [abonoAmount,    setAbonoAmount]    = useState("");

  const remaining = Math.max(0, order.order_total - order.total_paid);
  const isShipped = deliveryStatus === "shipped";
  const hasPhone  = !!order.guest_phone;
  const isCorreos = order.shipping_method.startsWith("correos");

  const saveMutation = useMutation({
    mutationFn: () => updateOrderAdmin(
      order.id,
      deliveryStatus,
      trackingNumber.trim() || null,
      note.trim() || null,
      order.delivery_status,
    ),
    onSuccess: () => {
      showToast("Pedido actualizado correctamente.", "success");
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.ADMIN_ORDERS });
      onClose();
    },
    onError: (err: Error) => showToast(err.message, "error"),
  });

  const abonoMutation = useMutation({
    mutationFn: () => addOrderPayment(
      order.id,
      order.order_total,
      Number(abonoAmount),
      "Abono",
    ),
    onSuccess: () => {
      showToast("Abono registrado.", "success");
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.ADMIN_ORDERS });
      onClose();
    },
    onError: (err: Error) => showToast(err.message, "error"),
  });

  function handleSave() {
    if (isShipped && isCorreos && !trackingNumber.trim()) {
      setTrackingError("El número de guía es requerido cuando el envío es por Correos CR.");
      return;
    }
    setTrackingError("");
    saveMutation.mutate();
  }

  function handleAbono() {
    const amount = Number(abonoAmount);
    if (!amount || amount <= 0) {
      showToast("Ingresá un monto válido.", "error");
      return;
    }
    abonoMutation.mutate();
  }

  const waMessage = trackingNumber.trim()
    ? `¡Buenas! Te saluda Dropping CR 👋\n\nTu pedido ya va en camino 📦\n\nEl número de guía de Correos CR es: *${trackingNumber.trim()}*\n\nPodés rastrearlo en https://rastrea.correos.go.cr o en tu perfil de nuestra página. ¡Cualquier duda estamos aquí!`
    : `¡Buenas! Te saluda Dropping CR 👋\n\nTu pedido ya va en camino 🚚\n\nEn breve recibirás más información sobre la entrega. ¡Cualquier duda estamos aquí!`;

  const waUrl = order.guest_phone
    ? `https://wa.me/${order.guest_phone.replace(/\D/g, "")}?text=${encodeURIComponent(waMessage)}`
    : null;

  return (
    <motion.div
      key="backdrop-order"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/40 z-40 backdrop-blur-sm
                 flex items-center justify-center px-4"
      onClick={onClose}
    >
      <motion.div
        key="modal-order"
        initial={{ opacity: 0, scale: 0.97, y: 16 }}
        animate={{ opacity: 1, scale: 1,    y: 0  }}
        exit={{ opacity: 0,    scale: 0.97, y: 8  }}
        transition={{ type: "spring", stiffness: 340, damping: 30 }}
        className="w-full max-w-md bg-white rounded-2xl shadow-xl flex flex-col
                   max-h-[92vh] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start gap-3 px-5 pt-5 pb-4 border-b border-gray-100">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="font-poppins font-semibold text-sm italic text-brand-primary leading-snug">
                {order.guest_name ?? "Cliente sin nombre"}
              </p>
              {order.items.length > 1 && (
                <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5
                                 rounded-full bg-indigo-100 text-indigo-600 font-poppins">
                  MULTI
                </span>
              )}
            </div>
            {order.guest_phone && (
              <p className="font-poppins text-xs text-gray-400 mt-0.5">
                {order.guest_phone}
              </p>
            )}
            <p className="font-poppins text-xs text-gray-300 mt-0.5">
              {formatDate(order.sold_at)}
            </p>
          </div>
          <button onClick={onClose} className="text-gray-300 hover:text-gray-500 transition-colors shrink-0 mt-0.5">
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex flex-col gap-4 px-5 py-5">

          {/* Items list */}
          <div className="flex flex-col gap-1.5">
            <p className="text-xs font-medium text-gray-500 font-poppins uppercase tracking-wider">
              Productos ({order.items.length})
            </p>
            <div className="rounded-xl border border-gray-100 overflow-hidden divide-y divide-gray-50">
              {order.items.map((item) => (
                <div key={item.id} className="flex items-center gap-3 px-3 py-2.5">
                  <div className="w-8 h-8 rounded-lg overflow-hidden bg-gray-50 border border-gray-100 shrink-0">
                    {item.image_url
                      ? <img src={item.image_url} alt={item.product_name} className="w-full h-full object-cover" />
                      : <Package size={12} className="m-auto mt-1.5 text-gray-200" />
                    }
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-poppins text-xs font-medium text-brand-dark truncate">
                      {item.product_name}
                    </p>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className="text-[10px] font-poppins bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-md font-medium">
                        {item.variant_size}
                      </span>
                      <span className="text-[10px] font-poppins text-gray-400">
                        x{item.quantity}
                      </span>
                    </div>
                  </div>
                  <p className="font-poppins text-xs font-semibold text-brand-dark shrink-0">
                    ₡{(item.sale_price * item.quantity).toLocaleString("en-US")}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Payment summary */}
          <div className="rounded-xl bg-gray-50 px-4 py-3 grid grid-cols-3 gap-2 text-center">
            <div>
              <p className="text-[10px] font-poppins text-gray-400 uppercase tracking-wider mb-0.5">Total</p>
              <p className="font-poppins font-semibold text-sm text-brand-dark">
                ₡{order.order_total.toLocaleString("en-US")}
              </p>
              <p className="text-[10px] font-poppins text-gray-300">
                +₡{order.shipping_cost.toLocaleString("en-US")} envío
              </p>
            </div>
            <div className="border-x border-gray-200">
              <p className="text-[10px] font-poppins text-gray-400 uppercase tracking-wider mb-0.5">Abonado</p>
              <p className="font-poppins font-semibold text-sm text-green-600">
                ₡{order.total_paid.toLocaleString("en-US")}
              </p>
            </div>
            <div>
              <p className="text-[10px] font-poppins text-gray-400 uppercase tracking-wider mb-0.5">Saldo</p>
              <p className={cn(
                "font-poppins font-semibold text-sm",
                remaining > 0 ? "text-red-500" : "text-green-600"
              )}>
                {remaining > 0 ? `₡${remaining.toLocaleString("en-US")}` : "Pagado ✓"}
              </p>
            </div>
          </div>

          {/* Abono panel */}
          {remaining > 0 && (
            <div>
              {!showAbono ? (
                <button
                  type="button"
                  onClick={() => setShowAbono(true)}
                  className="w-full py-2.5 rounded-xl border border-green-200 text-sm font-poppins
                             text-green-600 hover:bg-green-50 transition-colors flex items-center justify-center gap-2"
                >
                  <Plus size={14} strokeWidth={2.5} />
                  Registrar abono
                </button>
              ) : (
                <div className="flex flex-col gap-2 p-3 rounded-xl border border-green-200 bg-green-50/40">
                  <p className="text-xs font-poppins font-medium text-green-700">
                    Monto del abono (₡)
                  </p>
                  <div className="flex gap-2">
                    <input
                      type="number"
                      min={1}
                      value={abonoAmount}
                      onChange={(e) => setAbonoAmount(e.target.value)}
                      placeholder="Ej: 5000"
                      className={cn(inputCls, "flex-1")}
                      autoFocus
                    />
                    <button
                      type="button"
                      onClick={handleAbono}
                      disabled={abonoMutation.isPending}
                      className="px-4 py-2.5 rounded-xl bg-green-600 text-white text-sm font-poppins
                                 font-medium hover:bg-green-700 transition-colors disabled:opacity-60
                                 flex items-center gap-1.5 shrink-0"
                    >
                      {abonoMutation.isPending
                        ? <Loader2 size={14} className="animate-spin" />
                        : <Check size={14} strokeWidth={2.5} />
                      }
                      Guardar
                    </button>
                    <button
                      type="button"
                      onClick={() => { setShowAbono(false); setAbonoAmount(""); }}
                      className="p-2.5 rounded-xl border border-gray-200 text-gray-400 hover:text-gray-600
                                 transition-colors shrink-0"
                    >
                      <X size={14} />
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Delivery status */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-gray-500 font-poppins uppercase tracking-wider">
              Estado de entrega
            </label>
            <div className="grid grid-cols-1 gap-1.5">
              {DELIVERY_STATUSES.map((statusOption) => (
                <label
                  key={statusOption.value}
                  onClick={() => setDeliveryStatus(statusOption.value as DeliveryStatus)}
                  className={cn(
                    "flex items-center gap-3 rounded-xl border px-3.5 py-2.5 cursor-pointer transition-all",
                    deliveryStatus === statusOption.value
                      ? "border-brand-primary bg-brand-primary/5"
                      : "border-gray-200 hover:border-gray-300"
                  )}
                >
                  <span className={cn(
                    "w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors",
                    deliveryStatus === statusOption.value ? "border-brand-primary" : "border-gray-300"
                  )}>
                    {deliveryStatus === statusOption.value && (
                      <span className="w-2 h-2 rounded-full bg-brand-primary" />
                    )}
                  </span>
                  <span className={cn(
                    "text-xs font-bold uppercase tracking-wider px-2 py-0.5 rounded-full font-poppins",
                    statusOption.bgCls
                  )}>
                    {statusOption.label}
                  </span>
                </label>
              ))}
            </div>
          </div>

          {/* Tracking number */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-gray-500 font-poppins uppercase tracking-wider">
              N.° de guía
              {isShipped && isCorreos
                ? <span className="ml-1 text-red-400 normal-case font-normal">(requerido)</span>
                : <span className="ml-1 text-gray-300 normal-case font-normal">(opcional)</span>
              }
            </label>
            <input
              type="text"
              value={trackingNumber}
              onChange={(e) => { setTrackingNumber(e.target.value); setTrackingError(""); }}
              placeholder="Ej: CR123456789CR"
              className={cn(inputCls, trackingError && "border-red-300 focus:border-red-400 focus:ring-red-100")}
            />
            {trackingError && (
              <span className="text-[11px] text-red-500 font-poppins">{trackingError}</span>
            )}
          </div>

          {/* Notes */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-gray-500 font-poppins uppercase tracking-wider">
              Notas internas
              <span className="ml-1 text-gray-300 normal-case font-normal">(solo admin)</span>
            </label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
              placeholder="Observaciones del pedido…"
              className={cn(inputCls, "resize-none")}
            />
          </div>

          {/* WhatsApp notify */}
          {isShipped && hasPhone && waUrl && (
            <a
              href={waUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 w-full py-3 rounded-xl
                         bg-[#25D366] text-white text-sm font-poppins font-medium
                         hover:bg-[#1da851] transition-colors"
            >
              <MessageCircle size={16} strokeWidth={2} />
              Notificar envío por WhatsApp
            </a>
          )}
        </div>

        {/* Footer */}
        <div className="flex gap-3 px-5 py-4 border-t border-gray-100">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-poppins
                       text-gray-500 hover:border-gray-300 transition-colors"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saveMutation.isPending}
            className="flex-1 py-2.5 rounded-xl bg-brand-primary text-white text-sm font-poppins
                       font-medium flex items-center justify-center gap-2
                       hover:bg-[#7a3e18] transition-colors disabled:opacity-60"
          >
            {saveMutation.isPending
              ? <Loader2 size={14} className="animate-spin" />
              : <Check size={14} strokeWidth={2.5} />
            }
            Guardar
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
