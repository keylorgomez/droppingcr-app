import { useState, useMemo, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Search, X, Package, MessageCircle, Loader2, Check,
  Truck, MapPin, ChevronRight, ArrowLeft, Plus, Minus,
  ShoppingBag,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import Header from "../../components/ui/Header";
import { useToast } from "../../components/ui/Toast";
import { useAuth } from "../../context/AuthContext";
import {
  getAllSales, updateSaleAdmin, recordManualOrder, getAllOrders,
  updateOrderAdmin, addOrderPayment,
  DELIVERY_STATUSES, SHIPPING_OPTIONS,
  deliveryStatusMeta, shippingCostFor,
  type AdminSale, type AdminOrder, type DeliveryStatus, type ShippingMethod,
} from "../../services/salesService";
import {
  getProductsWithVariants,
  type ProductWithVariants,
} from "../../services/productService";
import { cn } from "../../lib/utils";

// ── Helpers ────────────────────────────────────────────────────────────────

const normalize = (s: string) =>
  s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("es-CR", {
    day: "numeric", month: "short", year: "numeric",
  });
}

function shippingLabel(method: string) {
  return SHIPPING_OPTIONS.find((o) => o.value === method)?.label ?? method;
}

const inputCls =
  "w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-poppins text-brand-dark " +
  "placeholder:text-gray-300 outline-none focus:border-brand-primary " +
  "focus:ring-1 focus:ring-brand-primary/20 transition";

// ── Tab config ─────────────────────────────────────────────────────────────

const TABS = [
  { id: "all",       label: "Todos",      statuses: null                                      },
  { id: "pending",   label: "Pendientes", statuses: ["validating", "confirmed", "apartada"]   },
  { id: "shipped",   label: "Enviados",   statuses: ["shipped"]                               },
  { id: "delivered", label: "Entregados", statuses: ["delivered"]                             },
] as const;

type TabId = typeof TABS[number]["id"];

// ── Unified list item ──────────────────────────────────────────────────────

type UnifiedItem =
  | { kind: "sale";  data: AdminSale;  sold_at: string }
  | { kind: "order"; data: AdminOrder; sold_at: string };

// ── Order Row (old single-product sales) ───────────────────────────────────

function SaleRow({ sale, onClick }: { sale: AdminSale; onClick: () => void }) {
  const status    = deliveryStatusMeta(sale.delivery_status);
  const total     = sale.sale_price + sale.shipping_cost;
  const isPersonal = sale.shipping_method === "personal_grecia";

  return (
    <motion.button
      type="button"
      onClick={onClick}
      whileHover={{ backgroundColor: "#fafafa" }}
      className="w-full flex items-center gap-3 px-4 py-3.5 border-b border-gray-50
                 text-left transition-colors last:border-b-0"
    >
      <div className="w-12 h-12 rounded-xl overflow-hidden bg-gray-50 border border-gray-100 shrink-0">
        {sale.image_url
          ? <img src={sale.image_url} alt={sale.product_name} className="w-full h-full object-cover" />
          : <Package size={18} className="m-auto mt-3 text-gray-200" />
        }
      </div>

      <div className="flex-1 min-w-0">
        <p className="font-poppins font-semibold text-sm italic text-brand-primary truncate">
          {sale.product_name}
        </p>
        <p className="font-poppins text-xs text-gray-400 truncate mt-0.5">
          {sale.guest_name ?? "Cliente sin nombre"}{" "}
          {sale.guest_phone && (
            <span className="text-gray-300">· {sale.guest_phone}</span>
          )}
        </p>
        <div className="flex items-center gap-1.5 mt-0.5">
          {isPersonal
            ? <MapPin size={10} className="text-gray-300 shrink-0" />
            : <Truck  size={10} className="text-gray-300 shrink-0" />
          }
          <span className="text-[10px] font-poppins text-gray-300 truncate">
            {shippingLabel(sale.shipping_method)}
          </span>
        </div>
      </div>

      <div className="flex flex-col items-end gap-1.5 shrink-0">
        <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5
                          rounded-full font-poppins ${status.bgCls}`}>
          {status.label}
        </span>
        <span className="text-xs font-poppins font-semibold text-brand-dark">
          ₡{total.toLocaleString("en-US")}
        </span>
        <span className="text-[10px] font-poppins text-gray-300">
          {formatDate(sale.sold_at)}
        </span>
      </div>

      <ChevronRight size={14} className="text-gray-200 shrink-0" />
    </motion.button>
  );
}

// ── Multi-Order Row (new orders) ───────────────────────────────────────────

function OrderRow({ order, onClick }: { order: AdminOrder; onClick: () => void }) {
  const status      = deliveryStatusMeta(order.delivery_status);
  const isPersonal  = order.shipping_method === "personal_grecia";
  const isMulti     = order.items.length > 1;
  const firstItem   = order.items[0];
  const label       = isMulti
    ? `${order.items.length} productos`
    : (firstItem?.product_name ?? "—");

  return (
    <motion.button
      type="button"
      onClick={onClick}
      whileHover={{ backgroundColor: "#fafafa" }}
      className="w-full flex items-center gap-3 px-4 py-3.5 border-b border-gray-50
                 text-left transition-colors last:border-b-0"
    >
      {/* Image: grid for multi, single for regular */}
      {isMulti ? (
        <div className="grid grid-cols-2 gap-0.5 w-12 h-12 shrink-0">
          {order.items.slice(0, 4).map((item, i) => (
            <div key={i} className="rounded-md overflow-hidden bg-gray-50 border border-gray-100">
              {item.image_url
                ? <img src={item.image_url} alt={item.product_name} className="w-full h-full object-cover" />
                : <Package size={8} className="m-auto text-gray-200" />
              }
            </div>
          ))}
        </div>
      ) : (
        <div className="w-12 h-12 rounded-xl overflow-hidden bg-gray-50 border border-gray-100 shrink-0">
          {firstItem?.image_url
            ? <img src={firstItem.image_url} alt={label} className="w-full h-full object-cover" />
            : <Package size={18} className="m-auto mt-3 text-gray-200" />
          }
        </div>
      )}

      <div className="flex-1 min-w-0">
        {isMulti ? (
          <div className="flex flex-col gap-0.5 mb-0.5">
            {order.items.map((item, i) => (
              <p key={i} className="font-poppins font-semibold text-xs italic text-brand-primary truncate leading-snug">
                {item.product_name}
                <span className="font-normal text-gray-400 not-italic ml-1">{item.variant_size}</span>
                {item.quantity > 1 && (
                  <span className="font-normal text-gray-300 not-italic ml-1">×{item.quantity}</span>
                )}
              </p>
            ))}
          </div>
        ) : (
          <div className="flex items-center gap-1.5 mb-0.5">
            <p className="font-poppins font-semibold text-sm italic text-brand-primary truncate">
              {label}
            </p>
          </div>
        )}
        <p className="font-poppins text-xs text-gray-400 truncate">
          {order.guest_name ?? "Cliente sin nombre"}{" "}
          {order.guest_phone && (
            <span className="text-gray-300">· {order.guest_phone}</span>
          )}
        </p>
        <div className="flex items-center gap-1.5 mt-0.5">
          {isPersonal
            ? <MapPin size={10} className="text-gray-300 shrink-0" />
            : <Truck  size={10} className="text-gray-300 shrink-0" />
          }
          <span className="text-[10px] font-poppins text-gray-300 truncate">
            {shippingLabel(order.shipping_method)}
          </span>
        </div>
      </div>

      <div className="flex flex-col items-end gap-1.5 shrink-0">
        <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5
                          rounded-full font-poppins ${status.bgCls}`}>
          {status.label}
        </span>
        <span className="text-xs font-poppins font-semibold text-brand-dark">
          ₡{order.order_total.toLocaleString("en-US")}
        </span>
        <span className="text-[10px] font-poppins text-gray-300">
          {formatDate(order.sold_at)}
        </span>
      </div>

      <ChevronRight size={14} className="text-gray-200 shrink-0" />
    </motion.button>
  );
}

// ── Order Modal (old single-product sales — unchanged logic) ───────────────

function OrderModal({ sale, onClose }: { sale: AdminSale; onClose: () => void }) {
  const { showToast } = useToast();
  const queryClient   = useQueryClient();

  const [deliveryStatus, setDeliveryStatus] = useState<DeliveryStatus>(
    sale.delivery_status as DeliveryStatus
  );
  const [trackingNumber, setTrackingNumber] = useState(sale.tracking_number ?? "");
  const [note,           setNote]           = useState(sale.note ?? "");
  const [trackingError,  setTrackingError]  = useState("");

  const total     = sale.sale_price + sale.shipping_cost;
  const remaining = Math.max(0, total - sale.total_paid);
  const isShipped = deliveryStatus === "shipped";
  const hasPhone  = !!sale.guest_phone;
  const isCorreos = sale.shipping_method.startsWith("correos");

  const mutation = useMutation({
    mutationFn: () => updateSaleAdmin(
      sale.id,
      deliveryStatus,
      trackingNumber.trim() || null,
      note.trim() || null,
      sale.delivery_status,
      sale.variant_id,
      sale.quantity
    ),
    onSuccess: () => {
      showToast("Pedido actualizado correctamente.", "success");
      queryClient.invalidateQueries({ queryKey: ["admin-sales"] });
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
    mutation.mutate();
  }

  const waMessage = trackingNumber.trim()
    ? `¡Buenas! Te saluda Dropping CR 👋\n\nTu pedido ya va en camino 📦\n\nEl número de guía de Correos CR es: *${trackingNumber.trim()}*\n\nPodés rastrearlo en https://rastrea.correos.go.cr o en tu perfil de nuestra página. ¡Cualquier duda estamos aquí!`
    : `¡Buenas! Te saluda Dropping CR 👋\n\nTu pedido ya va en camino 🚚\n\nEn breve recibirás más información sobre la entrega. ¡Cualquier duda estamos aquí!`;

  const waUrl = sale.guest_phone
    ? `https://wa.me/${sale.guest_phone.replace(/\D/g, "")}?text=${encodeURIComponent(waMessage)}`
    : null;

  return (
    <motion.div
      key="backdrop"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/40 z-40 backdrop-blur-sm
                 flex items-center justify-center px-4"
      onClick={onClose}
    >
      <motion.div
        key="modal"
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
          <div className="w-12 h-12 rounded-xl overflow-hidden bg-gray-50 border border-gray-100 shrink-0">
            {sale.image_url
              ? <img src={sale.image_url} alt={sale.product_name} className="w-full h-full object-cover" />
              : <Package size={18} className="m-auto mt-3 text-gray-200" />
            }
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-poppins font-semibold text-sm italic text-brand-primary leading-snug line-clamp-2">
              {sale.product_name}
            </p>
            <p className="font-poppins text-xs text-gray-400 mt-0.5">
              Talla {sale.variant_size} · {formatDate(sale.sold_at)}
            </p>
            {sale.guest_name && (
              <p className="font-poppins text-xs text-brand-dark mt-0.5 font-medium">
                {sale.guest_name}
                {sale.guest_phone && (
                  <span className="text-gray-400 font-normal"> · {sale.guest_phone}</span>
                )}
              </p>
            )}
          </div>
          <button onClick={onClose} className="text-gray-300 hover:text-gray-500 transition-colors shrink-0 mt-0.5">
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex flex-col gap-4 px-5 py-5">
          {/* Payment summary */}
          <div className="rounded-xl bg-gray-50 px-4 py-3 grid grid-cols-3 gap-2 text-center">
            <div>
              <p className="text-[10px] font-poppins text-gray-400 uppercase tracking-wider mb-0.5">Total</p>
              <p className="font-poppins font-semibold text-sm text-brand-dark">
                ₡{total.toLocaleString("en-US")}
              </p>
              <p className="text-[10px] font-poppins text-gray-300">
                +₡{sale.shipping_cost.toLocaleString("en-US")} envío
              </p>
            </div>
            <div className="border-x border-gray-200">
              <p className="text-[10px] font-poppins text-gray-400 uppercase tracking-wider mb-0.5">Abonado</p>
              <p className="font-poppins font-semibold text-sm text-green-600">
                ₡{sale.total_paid.toLocaleString("en-US")}
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

          {/* Delivery status */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-gray-500 font-poppins uppercase tracking-wider">
              Estado de entrega
            </label>
            <div className="grid grid-cols-1 gap-1.5">
              {DELIVERY_STATUSES.map((s) => (
                <label
                  key={s.value}
                  onClick={() => setDeliveryStatus(s.value as DeliveryStatus)}
                  className={cn(
                    "flex items-center gap-3 rounded-xl border px-3.5 py-2.5 cursor-pointer transition-all",
                    deliveryStatus === s.value
                      ? "border-brand-primary bg-brand-primary/5"
                      : "border-gray-200 hover:border-gray-300"
                  )}
                >
                  <span className={cn(
                    "w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors",
                    deliveryStatus === s.value ? "border-brand-primary" : "border-gray-300"
                  )}>
                    {deliveryStatus === s.value && (
                      <span className="w-2 h-2 rounded-full bg-brand-primary" />
                    )}
                  </span>
                  <span className={cn(
                    "text-xs font-bold uppercase tracking-wider px-2 py-0.5 rounded-full font-poppins",
                    s.bgCls
                  )}>
                    {s.label}
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

          {/* Internal notes */}
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
            disabled={mutation.isPending}
            className="flex-1 py-2.5 rounded-xl bg-brand-primary text-white text-sm font-poppins
                       font-medium flex items-center justify-center gap-2
                       hover:bg-[#7a3e18] transition-colors disabled:opacity-60"
          >
            {mutation.isPending
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

// ── Order Detail Modal (new multi-item orders) ─────────────────────────────

function OrderDetailModal({ order, onClose }: { order: AdminOrder; onClose: () => void }) {
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
      queryClient.invalidateQueries({ queryKey: ["admin-orders"] });
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
      queryClient.invalidateQueries({ queryKey: ["admin-orders"] });
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
    const amt = Number(abonoAmount);
    if (!amt || amt <= 0) {
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
          {order.status === "pending" && remaining > 0 && (
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
              {DELIVERY_STATUSES.map((s) => (
                <label
                  key={s.value}
                  onClick={() => setDeliveryStatus(s.value as DeliveryStatus)}
                  className={cn(
                    "flex items-center gap-3 rounded-xl border px-3.5 py-2.5 cursor-pointer transition-all",
                    deliveryStatus === s.value
                      ? "border-brand-primary bg-brand-primary/5"
                      : "border-gray-200 hover:border-gray-300"
                  )}
                >
                  <span className={cn(
                    "w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors",
                    deliveryStatus === s.value ? "border-brand-primary" : "border-gray-300"
                  )}>
                    {deliveryStatus === s.value && (
                      <span className="w-2 h-2 rounded-full bg-brand-primary" />
                    )}
                  </span>
                  <span className={cn(
                    "text-xs font-bold uppercase tracking-wider px-2 py-0.5 rounded-full font-poppins",
                    s.bgCls
                  )}>
                    {s.label}
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

// ── New Order Modal ────────────────────────────────────────────────────────

interface CartItem {
  tempId:       string;
  product_id:   string;
  product_name: string;
  variant_id:   string;
  variant_size: string;
  quantity:     number;
  sale_price:   number;
  image_url:    string;
  maxStock:     number;
}

function NewOrderModal({ onClose }: { onClose: () => void }) {
  const { showToast } = useToast();
  const queryClient   = useQueryClient();

  // Customer
  const [guestName,  setGuestName]  = useState("");
  const [guestPhone, setGuestPhone] = useState("");

  // Load draft from sessionStorage (set by EditProductPage when admin wants to add more products)
  useEffect(() => {
    const draft = sessionStorage.getItem("order_draft");
    if (draft) {
      try {
        const d = JSON.parse(draft);
        if (d.guest_name)  setGuestName(d.guest_name);
        if (d.guest_phone) setGuestPhone(d.guest_phone);
      } catch {}
      sessionStorage.removeItem("order_draft");
    }
  }, []);

  // Cart
  const [cartItems,       setCartItems]       = useState<CartItem[]>([]);
  const [showPicker,      setShowPicker]      = useState(false);
  const [pickerSearch,    setPickerSearch]    = useState("");
  const [pickerProduct,   setPickerProduct]   = useState<ProductWithVariants | null>(null);

  // Shipping
  const [shippingMethod, setShippingMethod] = useState<ShippingMethod>("personal_grecia");
  const shippingCost = shippingCostFor(shippingMethod);

  // Payment
  const [initialPayment, setInitialPayment] = useState("");
  const [payStatus,      setPayStatus]      = useState<"pending" | "completed">("pending");

  // Delivery
  const [deliveryStatus, setDeliveryStatus] = useState<DeliveryStatus>("validating");

  // Note
  const [note, setNote] = useState("");

  const { data: products = [], isLoading: productsLoading } = useQuery({
    queryKey: ["products-admin"],
    queryFn:  getProductsWithVariants,
  });

  const filteredProducts = useMemo(() => {
    const q = normalize(pickerSearch.trim());
    if (!q) return products;
    return products.filter((p) => normalize(p.name).includes(q));
  }, [products, pickerSearch]);

  const itemsTotal = cartItems.reduce((s, i) => s + i.sale_price * i.quantity, 0);
  const orderTotal = itemsTotal + shippingCost;

  function addToCart(product: ProductWithVariants, variantId: string) {
    const variant = product.variants.find((v) => v.id === variantId);
    if (!variant) return;
    const tempId = `${Date.now()}-${Math.random()}`;
    setCartItems((prev) => [
      ...prev,
      {
        tempId,
        product_id:   product.id,
        product_name: product.name,
        variant_id:   variant.id,
        variant_size: variant.size,
        quantity:     1,
        sale_price:   product.price_sale,
        image_url:    product.image_url,
        maxStock:     variant.stock,
      },
    ]);
    setPickerProduct(null);
    setPickerSearch("");
    setShowPicker(false);
  }

  function removeCartItem(tempId: string) {
    setCartItems((prev) => prev.filter((i) => i.tempId !== tempId));
  }

  function updateCartItem(tempId: string, field: "quantity" | "sale_price", value: number) {
    setCartItems((prev) =>
      prev.map((i) => {
        if (i.tempId !== tempId) return i;
        if (field === "quantity") {
          const clamped = Math.max(1, Math.min(i.maxStock, value));
          return { ...i, quantity: clamped };
        }
        return { ...i, [field]: value };
      })
    );
  }

  const mutation = useMutation({
    mutationFn: () => recordManualOrder({
      items: cartItems.map((i) => ({
        product_id: i.product_id,
        variant_id: i.variant_id,
        quantity:   i.quantity,
        sale_price: i.sale_price,
      })),
      guest_name:      guestName.trim() || null,
      guest_phone:     guestPhone.trim() || null,
      status:          payStatus,
      initial_payment: Number(initialPayment) || 0,
      shipping_method: shippingMethod,
      shipping_cost:   shippingCost,
      delivery_status: deliveryStatus,
      tracking_number: null,
      note:            note.trim() || null,
    }),
    onSuccess: () => {
      showToast("Compra registrada correctamente.", "success");
      queryClient.invalidateQueries({ queryKey: ["admin-sales"] });
      queryClient.invalidateQueries({ queryKey: ["admin-orders"] });
      onClose();
    },
    onError: (err: Error) => showToast(err.message, "error"),
  });

  function handleSubmit() {
    if (cartItems.length === 0) {
      showToast("Agregá al menos un producto.", "error");
      return;
    }
    mutation.mutate();
  }

  return (
    <motion.div
      key="backdrop-new"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/40 z-40 backdrop-blur-sm
                 flex items-center justify-center px-4"
      onClick={onClose}
    >
      <motion.div
        key="modal-new"
        initial={{ opacity: 0, scale: 0.97, y: 16 }}
        animate={{ opacity: 1, scale: 1,    y: 0  }}
        exit={{ opacity: 0,    scale: 0.97, y: 8  }}
        transition={{ type: "spring", stiffness: 340, damping: 30 }}
        className="w-full max-w-lg bg-white rounded-2xl shadow-xl flex flex-col
                   max-h-[94vh] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-gray-100">
          <div>
            <h2 className="font-poppins font-semibold text-base text-brand-dark">
              Nueva compra
            </h2>
            <p className="font-poppins text-xs text-gray-400 mt-0.5">
              Registrá uno o más productos para un cliente
            </p>
          </div>
          <button onClick={onClose} className="text-gray-300 hover:text-gray-500 transition-colors">
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex flex-col gap-5 px-5 py-5">

          {/* 1. Cliente */}
          <section className="flex flex-col gap-3">
            <p className="text-xs font-medium text-gray-500 font-poppins uppercase tracking-wider">
              Cliente
            </p>
            <input
              type="text"
              value={guestName}
              onChange={(e) => setGuestName(e.target.value)}
              placeholder="Nombre del cliente"
              className={inputCls}
            />
            <input
              type="text"
              value={guestPhone}
              onChange={(e) => setGuestPhone(e.target.value)}
              placeholder="WhatsApp (ej: 88887777)"
              className={inputCls}
            />
          </section>

          {/* 2. Productos */}
          <section className="flex flex-col gap-3">
            <p className="text-xs font-medium text-gray-500 font-poppins uppercase tracking-wider">
              Productos
            </p>

            {/* Cart items */}
            {cartItems.length > 0 && (
              <div className="rounded-xl border border-gray-100 overflow-hidden divide-y divide-gray-50">
                {cartItems.map((item) => (
                  <div key={item.tempId} className="flex flex-col px-3 py-2.5 gap-1">
                    <div className="flex items-center gap-2.5">
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
                        <span className="text-[10px] font-poppins bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-md font-medium">
                          {item.variant_size}
                        </span>
                      </div>
                      {/* Qty */}
                      <div className="flex flex-col items-center gap-0.5 shrink-0">
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => updateCartItem(item.tempId, "quantity", item.quantity - 1)}
                            className="w-6 h-6 rounded-md border border-gray-200 flex items-center justify-center
                                       text-gray-400 hover:text-gray-600 hover:border-gray-300 transition-colors"
                          >
                            <Minus size={10} />
                          </button>
                          <input
                            type="number"
                            min={1}
                            max={item.maxStock}
                            value={item.quantity}
                            onChange={(e) => updateCartItem(item.tempId, "quantity", Number(e.target.value))}
                            className="w-10 text-center text-xs font-poppins border border-gray-200 rounded-md
                                       py-1 outline-none focus:border-brand-primary transition"
                          />
                          <button
                            type="button"
                            onClick={() => updateCartItem(item.tempId, "quantity", item.quantity + 1)}
                            className="w-6 h-6 rounded-md border border-gray-200 flex items-center justify-center
                                       text-gray-400 hover:text-gray-600 hover:border-gray-300 transition-colors"
                          >
                            <Plus size={10} />
                          </button>
                        </div>
                        {item.quantity >= item.maxStock && (
                          <span className="text-[10px] font-poppins text-red-400">
                            Máx: {item.maxStock}
                          </span>
                        )}
                      </div>
                      {/* Price */}
                      <div className="flex flex-col items-end shrink-0 gap-0.5">
                        <div className="flex items-center">
                          <span className="text-xs font-poppins text-gray-400 mr-0.5">₡</span>
                          <input
                            type="number"
                            min={0}
                            value={item.sale_price}
                            onChange={(e) => updateCartItem(item.tempId, "sale_price", Number(e.target.value))}
                            className="w-20 text-right text-xs font-poppins border border-gray-200 rounded-md
                                       px-2 py-1 outline-none focus:border-brand-primary transition"
                          />
                        </div>
                        {/* Profit margin — solo porcentaje con color */}
                        {(() => {
                          const product = products.find((p) => p.id === item.product_id);
                          if (!product || !product.price_purchase) return null;
                          const margin = ((item.sale_price - product.price_purchase) / product.price_purchase) * 100;
                          const color =
                            margin < 0  ? "text-red-500"   :
                            margin < 20 ? "text-amber-500" :
                            margin < 40 ? "text-blue-500"  : "text-green-600";
                          return (
                            <p className={`text-[10px] font-poppins font-semibold ${color}`}>
                              {margin.toFixed(0)}%
                            </p>
                          );
                        })()}
                      </div>
                      <button
                        type="button"
                        onClick={() => removeCartItem(item.tempId)}
                        className="text-gray-300 hover:text-red-400 transition-colors shrink-0 ml-0.5"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Add product button */}
            <button
              type="button"
              onClick={() => setShowPicker((v) => !v)}
              className="flex items-center gap-2 py-2.5 rounded-xl border border-dashed border-gray-300
                         text-sm font-poppins text-gray-400 hover:border-brand-primary hover:text-brand-primary
                         transition-colors justify-center"
            >
              <Plus size={14} strokeWidth={2.5} />
              Agregar producto
            </button>

            {/* Product picker */}
            <AnimatePresence>
              {showPicker && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="overflow-hidden"
                >
                  <div className="border border-gray-200 rounded-xl overflow-hidden">
                    {/* Search */}
                    <div className="relative border-b border-gray-100">
                      <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-300 pointer-events-none" />
                      <input
                        type="text"
                        value={pickerSearch}
                        onChange={(e) => { setPickerSearch(e.target.value); setPickerProduct(null); }}
                        placeholder="Buscar producto…"
                        autoFocus
                        className="w-full pl-9 pr-4 py-2.5 text-sm font-poppins text-brand-dark
                                   placeholder:text-gray-300 outline-none bg-white"
                      />
                    </div>

                    {/* Products list or variant picker */}
                    {!pickerProduct ? (
                      <div className="max-h-48 overflow-y-auto divide-y divide-gray-50">
                        {productsLoading && (
                          <p className="py-6 text-center text-xs font-poppins text-gray-300">
                            Cargando productos…
                          </p>
                        )}
                        {!productsLoading && filteredProducts.length === 0 && (
                          <p className="py-6 text-center text-xs font-poppins text-gray-300">
                            No hay productos disponibles.
                          </p>
                        )}
                        {filteredProducts.map((p) => (
                          <button
                            key={p.id}
                            type="button"
                            onClick={() => setPickerProduct(p)}
                            className="w-full flex items-center gap-2.5 px-3 py-2.5 text-left
                                       hover:bg-gray-50 transition-colors"
                          >
                            <div className="w-8 h-8 rounded-lg overflow-hidden bg-gray-50 border border-gray-100 shrink-0">
                              {p.image_url
                                ? <img src={p.image_url} alt={p.name} className="w-full h-full object-cover" />
                                : <Package size={12} className="m-auto mt-1.5 text-gray-200" />
                              }
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="font-poppins text-xs font-medium text-brand-dark truncate">
                                {p.name}
                              </p>
                              <p className="font-poppins text-[10px] text-gray-400">
                                ₡{p.price_sale.toLocaleString("en-US")}
                              </p>
                            </div>
                            <ChevronRight size={12} className="text-gray-300 shrink-0" />
                          </button>
                        ))}
                      </div>
                    ) : (
                      <div className="p-3">
                        <button
                          type="button"
                          onClick={() => setPickerProduct(null)}
                          className="flex items-center gap-1 text-xs font-poppins text-gray-400
                                     hover:text-brand-primary transition-colors mb-2"
                        >
                          <ArrowLeft size={12} />
                          Volver
                        </button>
                        <p className="font-poppins text-xs font-medium text-brand-dark mb-2 truncate">
                          {pickerProduct.name}
                        </p>
                        {pickerProduct.variants.length === 0 ? (
                          <p className="text-xs font-poppins text-gray-300">Sin tallas disponibles.</p>
                        ) : (
                          <div className="flex flex-wrap gap-2">
                            {pickerProduct.variants.map((v) => (
                              <button
                                key={v.id}
                                type="button"
                                onClick={() => addToCart(pickerProduct, v.id)}
                                className="px-3 py-1.5 rounded-lg border border-gray-200 text-xs font-poppins
                                           font-medium text-brand-dark hover:border-brand-primary hover:text-brand-primary
                                           hover:bg-brand-primary/5 transition-all"
                              >
                                {v.size}
                                <span className="ml-1 text-[10px] text-gray-300">({v.stock})</span>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </section>

          {/* 3. Envío */}
          <section className="flex flex-col gap-2">
            <p className="text-xs font-medium text-gray-500 font-poppins uppercase tracking-wider">
              Envío
            </p>
            <select
              value={shippingMethod}
              onChange={(e) => setShippingMethod(e.target.value as ShippingMethod)}
              className={inputCls}
            >
              {SHIPPING_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label} — ₡{o.cost.toLocaleString("en-US")}
                </option>
              ))}
            </select>
            {shippingCost > 0 && (
              <p className="text-[11px] font-poppins text-gray-400">
                Costo de envío: ₡{shippingCost.toLocaleString("en-US")}
              </p>
            )}
          </section>

          {/* 4. Estado de pago */}
          <section className="flex flex-col gap-2">
            <p className="text-xs font-medium text-gray-500 font-poppins uppercase tracking-wider">
              Estado de pago
            </p>
            <div className="flex gap-2">
              {(["pending", "completed"] as const).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setPayStatus(s)}
                  className={cn(
                    "flex-1 py-2.5 rounded-xl border text-sm font-poppins font-medium transition-all",
                    payStatus === s
                      ? "border-brand-primary bg-brand-primary/5 text-brand-primary"
                      : "border-gray-200 text-gray-400 hover:border-gray-300"
                  )}
                >
                  {s === "pending" ? "A pagos (pendiente)" : "Pago completo"}
                </button>
              ))}
            </div>
          </section>

          {/* 5. Abono inicial — visible when status is pending */}
          {payStatus === "pending" && (
            <section className="flex flex-col gap-2">
              <p className="text-xs font-medium text-gray-500 font-poppins uppercase tracking-wider">
                Abono inicial (₡)
              </p>
              <input
                type="number"
                min={0}
                value={initialPayment}
                onChange={(e) => setInitialPayment(e.target.value)}
                placeholder="0"
                className={inputCls}
              />
              {initialPayment && Number(initialPayment) > 0 && (
                <p className="text-[11px] font-poppins text-gray-400">
                  Restará: ₡{Math.max(0, orderTotal - Number(initialPayment)).toLocaleString("en-US")}
                </p>
              )}
            </section>
          )}

          {/* 6. Estado de entrega */}
          <section className="flex flex-col gap-2">
            <p className="text-xs font-medium text-gray-500 font-poppins uppercase tracking-wider">
              Estado de entrega
            </p>
            <select
              value={deliveryStatus}
              onChange={(e) => setDeliveryStatus(e.target.value as DeliveryStatus)}
              className={inputCls}
            >
              {DELIVERY_STATUSES.map((s) => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
          </section>

          {/* 7. Notas */}
          <section className="flex flex-col gap-2">
            <p className="text-xs font-medium text-gray-500 font-poppins uppercase tracking-wider">
              Notas
              <span className="ml-1 text-gray-300 normal-case font-normal">(opcional)</span>
            </p>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
              placeholder="Observaciones del pedido…"
              className={cn(inputCls, "resize-none")}
            />
          </section>
        </div>

        {/* Footer */}
        <div className="border-t border-gray-100 px-5 pt-3 pb-5">
          {/* Totals summary */}
          <div className="flex items-center justify-between mb-3 text-xs font-poppins text-gray-400">
            <span>Subtotal productos</span>
            <span className="font-medium text-brand-dark">₡{itemsTotal.toLocaleString("en-US")}</span>
          </div>
          {shippingCost > 0 && (
            <div className="flex items-center justify-between mb-3 text-xs font-poppins text-gray-400">
              <span>Envío</span>
              <span className="font-medium text-brand-dark">₡{shippingCost.toLocaleString("en-US")}</span>
            </div>
          )}
          <div className="flex items-center justify-between mb-4">
            <span className="font-poppins font-semibold text-sm text-brand-dark">Total</span>
            <span className="font-poppins font-semibold text-base text-brand-primary">
              ₡{orderTotal.toLocaleString("en-US")}
            </span>
          </div>

          <div className="flex gap-3">
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
              onClick={handleSubmit}
              disabled={mutation.isPending}
              className="flex-1 py-2.5 rounded-xl bg-brand-primary text-white text-sm font-poppins
                         font-medium flex items-center justify-center gap-2
                         hover:bg-[#7a3e18] transition-colors disabled:opacity-60"
            >
              {mutation.isPending
                ? <Loader2 size={14} className="animate-spin" />
                : <ShoppingBag size={14} strokeWidth={2} />
              }
              Registrar compra
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────

export default function OrdersPage() {
  const { user }         = useAuth();
  const navigate         = useNavigate();
  const [searchParams]   = useSearchParams();

  const [activeTab,       setActiveTab]       = useState<TabId>("all");
  const [search,          setSearch]          = useState("");
  const [selectedSale,    setSelectedSale]    = useState<AdminSale | null>(null);
  const [selectedOrder,   setSelectedOrder]   = useState<AdminOrder | null>(null);
  const [showNewModal,    setShowNewModal]     = useState(false);

  // Redirect non-admins
  if (user && user.role !== "admin") { navigate("/"); return null; }

  // eslint-disable-next-line react-hooks/rules-of-hooks
  useEffect(() => { window.scrollTo({ top: 0, behavior: "instant" }); }, []);

  // Auto-open NewOrderModal when navigated with ?draft=true (from EditProductPage)
  // eslint-disable-next-line react-hooks/rules-of-hooks
  useEffect(() => {
    if (searchParams.get("draft") === "true") {
      setShowNewModal(true);
      // Clean URL without reload
      window.history.replaceState({}, "", "/admin/pedidos");
    }
  }, []);

  const { data: sales = [], isLoading: salesLoading, isError: salesError } = useQuery({
    queryKey: ["admin-sales"],
    queryFn:  getAllSales,
  });

  const { data: orders = [], isLoading: ordersLoading, isError: ordersError } = useQuery({
    queryKey: ["admin-orders"],
    queryFn:  getAllOrders,
  });

  const isLoading = salesLoading || ordersLoading;
  const isError   = salesError   || ordersError;

  // Merge + sort descending
  const unified = useMemo((): UnifiedItem[] => {
    const saleItems: UnifiedItem[] = sales.map((s) => ({
      kind: "sale" as const,
      data: s,
      sold_at: s.sold_at,
    }));
    const orderItems: UnifiedItem[] = orders.map((o) => ({
      kind: "order" as const,
      data: o,
      sold_at: o.sold_at,
    }));
    return [...saleItems, ...orderItems].sort(
      (a, b) => new Date(b.sold_at).getTime() - new Date(a.sold_at).getTime()
    );
  }, [sales, orders]);

  // Tab filter
  const byTab = useMemo(() => {
    const tab = TABS.find((t) => t.id === activeTab);
    if (!tab?.statuses) return unified;
    const statuses = tab.statuses as readonly string[];
    return unified.filter((item) => {
      const ds = item.kind === "sale" ? item.data.delivery_status : item.data.delivery_status;
      return statuses.includes(ds);
    });
  }, [unified, activeTab]);

  // Search filter
  const filtered = useMemo(() => {
    const q = normalize(search.trim());
    if (!q) return byTab;
    return byTab.filter((item) => {
      const name  = item.kind === "sale" ? item.data.guest_name  : item.data.guest_name;
      const phone = item.kind === "sale" ? item.data.guest_phone : item.data.guest_phone;
      return (
        normalize(name ?? "").includes(q) ||
        (phone ?? "").replace(/\D/g, "").includes(q.replace(/\D/g, ""))
      );
    });
  }, [byTab, search]);

  // Tab counts
  const counts = useMemo(() => ({
    all:       unified.length,
    pending:   unified.filter((i) => ["validating", "confirmed", "apartada"].includes(
      i.kind === "sale" ? i.data.delivery_status : i.data.delivery_status
    )).length,
    shipped:   unified.filter((i) => (
      i.kind === "sale" ? i.data.delivery_status : i.data.delivery_status
    ) === "shipped").length,
    delivered: unified.filter((i) => (
      i.kind === "sale" ? i.data.delivery_status : i.data.delivery_status
    ) === "delivered").length,
  }), [unified]);

  const tabCount = (id: TabId) =>
    id === "all"       ? counts.all :
    id === "pending"   ? counts.pending :
    id === "shipped"   ? counts.shipped :
    id === "delivered" ? counts.delivered : 0;

  return (
    <>
      <Header />
      <main className="max-w-3xl mx-auto px-4 pt-8 pb-16">

        {/* Back + title */}
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <button
              onClick={() => navigate("/")}
              className="flex items-center gap-1.5 text-sm font-poppins text-gray-400
                         hover:text-brand-primary transition-colors mb-3"
            >
              <ArrowLeft size={15} strokeWidth={2} />
              Volver al catálogo
            </button>
            <h1 className="font-poppins font-semibold italic text-brand-primary text-2xl">
              Gestión de pedidos
            </h1>
            {!isLoading && (
              <p className="font-poppins text-xs text-gray-400 mt-1">
                {unified.length} {unified.length === 1 ? "pedido" : "pedidos"} en total
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={() => setShowNewModal(true)}
            className="mt-8 flex items-center gap-2 px-4 py-2.5 rounded-xl bg-brand-primary text-white
                       text-sm font-poppins font-medium hover:bg-[#7a3e18] transition-colors shrink-0"
          >
            <Plus size={15} strokeWidth={2.5} />
            Nueva venta
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 bg-gray-100 p-1 rounded-xl mb-4 overflow-x-auto scrollbar-none">
          {TABS.map((tab) => {
            const count = tabCount(tab.id);
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-poppins font-medium",
                  "whitespace-nowrap transition-all shrink-0",
                  activeTab === tab.id
                    ? "bg-white text-brand-primary shadow-sm"
                    : "text-gray-500 hover:text-gray-700"
                )}
              >
                {tab.label}
                {count > 0 && (
                  <span className={cn(
                    "inline-flex items-center justify-center w-4 h-4 rounded-full text-[10px] font-bold",
                    activeTab === tab.id
                      ? "bg-brand-primary text-white"
                      : "bg-gray-300 text-white"
                  )}>
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Search */}
        <div className="relative mb-4">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-300 pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nombre o WhatsApp…"
            className="w-full rounded-xl border border-gray-200 pl-9 pr-9 py-2.5 text-sm
                       font-poppins text-brand-dark placeholder:text-gray-300 outline-none
                       focus:border-brand-primary focus:ring-1 focus:ring-brand-primary/20
                       transition bg-white"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-300 hover:text-gray-500"
            >
              <X size={14} />
            </button>
          )}
        </div>

        {/* Error */}
        {isError && (
          <p className="text-center font-poppins text-sm text-red-400 py-10">
            No se pudieron cargar los pedidos. Intenta de nuevo.
          </p>
        )}

        {/* Skeleton */}
        {isLoading && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex gap-3 px-4 py-3.5 border-b border-gray-50 last:border-b-0 animate-pulse">
                <div className="w-12 h-12 rounded-xl bg-gray-100 shrink-0" />
                <div className="flex-1 flex flex-col gap-2 justify-center">
                  <div className="h-3 bg-gray-100 rounded w-3/4" />
                  <div className="h-3 bg-gray-100 rounded w-1/2" />
                </div>
                <div className="flex flex-col gap-2 items-end">
                  <div className="h-4 bg-gray-100 rounded w-16" />
                  <div className="h-3 bg-gray-100 rounded w-12" />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Empty */}
        {!isLoading && !isError && filtered.length === 0 && (
          <div className="flex flex-col items-center gap-3 py-20 text-gray-300">
            <Package size={40} strokeWidth={1.2} />
            <p className="font-poppins text-sm text-gray-400">
              {search ? "No hay pedidos con ese criterio." : "No hay pedidos en este estado."}
            </p>
          </div>
        )}

        {/* List */}
        {!isLoading && filtered.length > 0 && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            {filtered.map((item) =>
              item.kind === "sale" ? (
                <SaleRow
                  key={`sale-${item.data.id}`}
                  sale={item.data}
                  onClick={() => setSelectedSale(item.data)}
                />
              ) : (
                <OrderRow
                  key={`order-${item.data.id}`}
                  order={item.data}
                  onClick={() => setSelectedOrder(item.data)}
                />
              )
            )}
          </div>
        )}
      </main>

      {/* Modals */}
      <AnimatePresence>
        {selectedSale && (
          <OrderModal
            key={`om-${selectedSale.id}`}
            sale={selectedSale}
            onClose={() => setSelectedSale(null)}
          />
        )}
        {selectedOrder && (
          <OrderDetailModal
            key={`odm-${selectedOrder.id}`}
            order={selectedOrder}
            onClose={() => setSelectedOrder(null)}
          />
        )}
        {showNewModal && (
          <NewOrderModal
            key="new-order-modal"
            onClose={() => setShowNewModal(false)}
          />
        )}
      </AnimatePresence>
    </>
  );
}
