import { motion } from "framer-motion";
import { Truck, MapPin, Package, ChevronRight } from "lucide-react";
import { deliveryStatusMeta, SHIPPING_OPTIONS, type UserOrder } from "../../services/salesService";
import { fmt, formatDate } from "../../lib/formatters";
import { cloudinaryUrl } from "../../lib/cloudinary";

// ── Shared helpers (also used by UserOrderDetailSheet) ─────────────────────

export function shippingLabel(method: string) {
  return SHIPPING_OPTIONS.find((o) => o.value === method)?.label ?? method;
}

export const CORREOS_METHODS = new Set(["correos_gam", "correos_fuera_gam"]);

// ── Skeleton ───────────────────────────────────────────────────────────────

export function OrderSkeleton() {
  return (
    <div className="animate-pulse flex gap-4 bg-white rounded-2xl border border-gray-100 p-4">
      <div className="w-20 h-20 rounded-xl bg-gray-100 shrink-0" />
      <div className="flex flex-col gap-2 flex-1 pt-1">
        <div className="h-3 bg-gray-100 rounded w-3/4" />
        <div className="h-3 bg-gray-100 rounded w-1/2" />
        <div className="h-4 bg-gray-100 rounded w-1/4 mt-1" />
      </div>
    </div>
  );
}

// ── Order Card ─────────────────────────────────────────────────────────────

export function OrderCard({ order, onClick }: { order: UserOrder; onClick: () => void }) {
  const total      = order.sale_price + order.shipping_cost;
  const remaining  = Math.max(0, total - order.total_paid);
  const isPending  = order.status === "pending";
  const progress   = total > 0 ? Math.min(100, (order.total_paid / total) * 100) : 100;
  const status     = deliveryStatusMeta(order.delivery_status);
  const isPersonal = order.shipping_method === "personal_grecia";
  const isMulti    = order.isMultiOrder && order.items && order.items.length > 1;

  return (
    <motion.button
      type="button"
      onClick={onClick}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="w-full bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden text-left"
    >
      {isMulti ? (
        <>
          {/* Header */}
          <div className="flex items-center justify-between px-4 pt-4 pb-3">
            <div>
              <p className="font-poppins text-xs text-gray-400">{formatDate(order.sold_at)}</p>
              <div className="flex items-center gap-1.5 mt-0.5">
                {isPersonal
                  ? <MapPin size={11} className="text-gray-300 shrink-0" />
                  : <Truck  size={11} className="text-gray-300 shrink-0" />
                }
                <span className="text-[11px] font-poppins text-gray-400">
                  {shippingLabel(order.shipping_method)}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className={`text-[10px] font-bold uppercase tracking-wider
                                px-2.5 py-1 rounded-full font-poppins ${status.bgCls}`}>
                {status.label}
              </span>
              <ChevronRight size={14} className="text-gray-300" />
            </div>
          </div>

          {/* Items preview */}
          <div className="flex gap-2 px-4 pb-3 border-t border-gray-50 pt-3">
            {order.items!.slice(0, 4).map((item, i) => (
              <div key={i} className="w-12 h-12 rounded-xl overflow-hidden bg-gray-50 border border-gray-100 shrink-0">
                {item.image_url
                  ? <img src={cloudinaryUrl(item.image_url, "thumb")} alt={item.product_name} className="w-full h-full object-cover" loading="lazy" />
                  : <div className="w-full h-full flex items-center justify-center">
                      <Package size={14} className="text-gray-200" strokeWidth={1.4} />
                    </div>
                }
              </div>
            ))}
            {order.items!.length > 4 && (
              <div className="w-12 h-12 rounded-xl bg-gray-50 border border-gray-100 flex items-center justify-center shrink-0">
                <span className="text-[11px] font-poppins text-gray-400">+{order.items!.length - 4}</span>
              </div>
            )}
            <div className="flex-1 flex flex-col justify-center pl-1">
              <p className="font-poppins text-xs text-gray-500 font-medium">
                {order.items!.length} productos
              </p>
              <p className="font-poppins text-xs text-gray-400">{fmt(total)}</p>
            </div>
          </div>

          {/* Payment bar */}
          {isPending ? (
            <div className="px-4 pb-4 pt-1 border-t border-gray-50">
              <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden">
                <div className="h-full rounded-full bg-brand-primary transition-all"
                     style={{ width: `${progress}%` }} />
              </div>
              <div className="flex justify-between mt-1.5">
                <span className="text-[11px] font-poppins text-gray-400">Saldo pendiente</span>
                <span className="text-[11px] font-poppins font-bold text-red-500">{fmt(remaining)}</span>
              </div>
            </div>
          ) : (
            <div className="px-4 pb-3 pt-1 border-t border-gray-50">
              <span className="text-[11px] font-poppins font-semibold text-green-600">✓ Pago completado</span>
            </div>
          )}
        </>
      ) : (
        /* Single-item layout */
        <>
          <div className="flex gap-4 p-4">
            <div className="w-20 h-20 rounded-xl overflow-hidden bg-gray-50 border border-gray-100 shrink-0">
              {order.image_url ? (
                <img src={cloudinaryUrl(order.image_url ?? "", "thumb")} alt={order.product_name}
                     className="w-full h-full object-cover" loading="lazy" />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <Package size={24} className="text-gray-200" strokeWidth={1.4} />
                </div>
              )}
            </div>

            <div className="flex flex-col gap-1 flex-1 min-w-0">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-poppins font-semibold text-sm italic text-brand-primary
                                leading-snug line-clamp-2">
                    {order.product_name}
                  </p>
                  <p className="font-poppins text-xs text-gray-400 mt-0.5">
                    Talla {order.variant_size} · {formatDate(order.sold_at)}
                  </p>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <span className={`text-[10px] font-bold uppercase tracking-wider
                                    px-2.5 py-1 rounded-full font-poppins ${status.bgCls}`}>
                    {status.label}
                  </span>
                  <ChevronRight size={14} className="text-gray-300" />
                </div>
              </div>
              <div className="flex items-center gap-1.5 mt-0.5">
                {isPersonal
                  ? <MapPin size={11} className="text-gray-300 shrink-0" />
                  : <Truck  size={11} className="text-gray-300 shrink-0" />
                }
                <span className="text-[11px] font-poppins text-gray-400 truncate">
                  {shippingLabel(order.shipping_method)}
                </span>
              </div>
            </div>
          </div>

          {isPending && (
            <div className="px-4 pb-4 flex flex-col gap-2 border-t border-gray-50 pt-3 mx-4 mb-0">
              <div className="flex justify-between text-xs font-poppins">
                <span className="text-gray-400">Pagado</span>
                <span className="font-medium text-brand-dark">
                  {fmt(order.total_paid)}
                  <span className="text-gray-300 font-normal"> / {fmt(total)}</span>
                </span>
              </div>
              <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden">
                <div className="h-full rounded-full bg-brand-primary transition-all"
                     style={{ width: `${progress}%` }} />
              </div>
              <p className="text-[11px] font-poppins text-gray-400">
                Pendiente: <span className="font-semibold text-red-500">{fmt(remaining)}</span>
              </p>
            </div>
          )}

          {order.status === "completed" && (
            <div className="px-4 pb-4 border-t border-gray-50 pt-3 mx-4 mb-0">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-[11px] font-poppins text-gray-400">Total pagado</span>
                  <p className="text-sm font-poppins font-semibold text-brand-dark">{fmt(total)}</p>
                </div>
                <span className="text-[11px] font-poppins font-semibold text-green-600
                                 bg-green-50 px-3 py-1.5 rounded-full">
                  ✓ Pago completado
                </span>
              </div>
            </div>
          )}
        </>
      )}
    </motion.button>
  );
}
