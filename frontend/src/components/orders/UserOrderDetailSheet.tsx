import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Truck, MapPin, Package, ExternalLink } from "lucide-react";
import { deliveryStatusMeta, type UserOrder } from "../../services/salesService";
import { fmt, formatDate } from "../../lib/formatters";
import { shippingLabel, CORREOS_METHODS } from "./UserOrderCard";
import { cloudinaryUrl } from "../../lib/cloudinary";

// ── Image Lightbox ─────────────────────────────────────────────────────────

function ImageLightbox({ src, alt, onClose }: { src: string; alt: string; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <motion.div
      className="fixed inset-0 z-[60] bg-black flex items-center justify-center"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      onClick={onClose}
    >
      <button
        onClick={onClose}
        className="absolute top-4 right-4 w-9 h-9 rounded-full bg-white/10 backdrop-blur-sm
                   flex items-center justify-center text-white hover:bg-white/20 transition-colors z-10"
      >
        <X size={18} />
      </button>
      <motion.img
        src={src}
        alt={alt}
        initial={{ scale: 0.92, opacity: 0 }}
        animate={{ scale: 1,    opacity: 1 }}
        exit={{ scale: 0.92,    opacity: 0 }}
        transition={{ duration: 0.2 }}
        onClick={(e) => e.stopPropagation()}
        className="max-w-full max-h-full object-contain select-none"
        style={{ touchAction: "pinch-zoom" }}
        draggable={false}
      />
    </motion.div>
  );
}

// ── Order Detail Sheet ─────────────────────────────────────────────────────

export function OrderDetailSheet({ order, onClose }: { order: UserOrder; onClose: () => void }) {
  const total      = order.sale_price + order.shipping_cost;
  const remaining  = Math.max(0, total - order.total_paid);
  const isPending  = order.status === "pending";
  const progress   = total > 0 ? Math.min(100, (order.total_paid / total) * 100) : 100;
  const status     = deliveryStatusMeta(order.delivery_status);
  const isCorreos  = CORREOS_METHODS.has(order.shipping_method);
  const isPersonal = order.shipping_method === "personal_grecia";
  const isMulti    = order.isMultiOrder && order.items && order.items.length > 1;
  const [lightbox, setLightbox] = useState<{ src: string; alt: string } | null>(null);

  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, []);

  return (
    <>
      {/* Backdrop */}
      <motion.div
        className="fixed inset-0 bg-black/40 z-40"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      />

      {/* Sheet */}
      <motion.div
        className="fixed bottom-0 left-0 right-0 z-50 bg-white rounded-t-3xl
                   max-h-[90dvh] flex flex-col shadow-2xl"
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        transition={{ type: "spring", stiffness: 340, damping: 32 }}
      >
        {/* Drag handle */}
        <div className="flex justify-center pt-3 pb-1 shrink-0">
          <div className="w-10 h-1 rounded-full bg-gray-200" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 shrink-0">
          <div>
            <span className={`text-[10px] font-bold uppercase tracking-wider
                              px-2.5 py-1 rounded-full font-poppins ${status.bgCls}`}>
              {status.label}
            </span>
            <p className="font-poppins text-xs text-gray-400 mt-1.5">{formatDate(order.sold_at)}</p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center
                       hover:bg-gray-200 transition-colors"
          >
            <X size={15} className="text-gray-500" />
          </button>
        </div>

        {/* Scrollable content */}
        <div className="overflow-y-auto flex-1 min-h-0">

          {/* Single-item: large image */}
          {!isMulti && (
            <div
              className="mx-5 rounded-2xl overflow-hidden bg-gray-50 mb-4
                         aspect-square max-h-[60vw] md:max-h-64 cursor-zoom-in"
              onClick={() => order.image_url && setLightbox({ src: order.image_url, alt: order.product_name })}
            >
              {order.image_url
                ? <img src={cloudinaryUrl(order.image_url, "full")} alt={order.product_name}
                       className="w-full h-full object-cover" />
                : <div className="w-full h-full flex items-center justify-center">
                    <Package size={48} className="text-gray-200" strokeWidth={1.2} />
                  </div>
              }
            </div>
          )}

          {/* Single-item: product info */}
          {!isMulti && (
            <div className="px-5 mb-4">
              <p className="font-poppins font-bold text-lg italic text-brand-primary leading-snug">
                {order.product_name}
              </p>
              <p className="font-poppins text-sm text-gray-400 mt-1">
                Talla {order.variant_size}
              </p>
              <p className="font-poppins text-lg font-bold text-brand-dark mt-2">
                {fmt(order.sale_price)}
              </p>
            </div>
          )}

          {/* Multi-item: items list with large images */}
          {isMulti && (
            <div className="px-5 mb-4">
              <p className="font-poppins text-[11px] font-semibold uppercase tracking-widest
                             text-gray-400 mb-3">
                Productos
              </p>
              <div className="flex flex-col gap-3">
                {order.items!.map((item, i) => (
                  <div key={i} className="flex gap-3 items-center">
                    <div
                      className="w-36 h-36 sm:w-28 sm:h-28 md:w-24 md:h-24 rounded-xl overflow-hidden bg-gray-50
                                 border border-gray-100 shrink-0 cursor-zoom-in"
                      onClick={() => item.image_url && setLightbox({ src: item.image_url, alt: item.product_name })}
                    >
                      {item.image_url
                        ? <img src={cloudinaryUrl(item.image_url, "medium")} alt={item.product_name}
                               className="w-full h-full object-cover" loading="lazy" />
                        : <div className="w-full h-full flex items-center justify-center">
                            <Package size={22} className="text-gray-200" strokeWidth={1.3} />
                          </div>
                      }
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-poppins font-semibold text-sm italic text-brand-primary
                                    leading-snug line-clamp-2">
                        {item.product_name}
                      </p>
                      <p className="font-poppins text-xs text-gray-400 mt-0.5">
                        Talla {item.variant_size}
                        {item.quantity > 1 && <span className="ml-1">· ×{item.quantity}</span>}
                      </p>
                      <p className="font-poppins text-sm font-semibold text-brand-dark mt-1">
                        {fmt(item.sale_price * item.quantity)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Shipping info */}
          <div className="mx-5 mb-4 rounded-2xl bg-gray-50 px-4 py-3 flex items-center gap-2">
            {isPersonal
              ? <MapPin size={14} className="text-gray-400 shrink-0" />
              : <Truck  size={14} className="text-gray-400 shrink-0" />
            }
            <div>
              <p className="font-poppins text-xs font-medium text-gray-600">
                {shippingLabel(order.shipping_method)}
              </p>
              {order.shipping_cost > 0 && (
                <p className="font-poppins text-[11px] text-gray-400">
                  {fmt(order.shipping_cost)} de envío
                </p>
              )}
            </div>
          </div>

          {/* Payment summary */}
          <div className="mx-5 mb-4 rounded-2xl border border-gray-100 overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-50">
              <p className="font-poppins text-[11px] font-semibold uppercase tracking-widest text-gray-400">
                Pago
              </p>
            </div>

            {isMulti && order.items!.map((item, i) => (
              <div key={i} className="flex justify-between px-4 py-2.5 border-b border-gray-50">
                <p className="font-poppins text-xs text-gray-500 truncate mr-2">
                  {item.product_name}
                  {item.quantity > 1 && <span className="text-gray-300"> ×{item.quantity}</span>}
                </p>
                <p className="font-poppins text-xs text-gray-500 shrink-0">
                  {fmt(item.sale_price * item.quantity)}
                </p>
              </div>
            ))}

            {order.shipping_cost > 0 && (
              <div className="flex justify-between px-4 py-2.5 border-b border-gray-50">
                <p className="font-poppins text-xs text-gray-400">Envío</p>
                <p className="font-poppins text-xs text-gray-400">{fmt(order.shipping_cost)}</p>
              </div>
            )}

            <div className="flex justify-between px-4 py-3 border-b border-gray-50">
              <p className="font-poppins text-sm font-semibold text-brand-dark">Total</p>
              <p className="font-poppins text-sm font-semibold text-brand-dark">{fmt(total)}</p>
            </div>

            {isPending ? (
              <div className="px-4 py-3">
                <div className="flex justify-between text-xs font-poppins mb-2">
                  <span className="text-gray-400">Abonado</span>
                  <span className="font-medium text-brand-dark">
                    {fmt(order.total_paid)}
                    <span className="text-gray-300 font-normal"> / {fmt(total)}</span>
                  </span>
                </div>
                <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
                  <div className="h-full rounded-full bg-brand-primary transition-all"
                       style={{ width: `${progress}%` }} />
                </div>
                <div className="flex items-center justify-between mt-2">
                  <span className="text-[11px] font-poppins text-gray-400">Saldo pendiente</span>
                  <span className="text-base font-poppins font-bold text-red-500">
                    {fmt(remaining)}
                  </span>
                </div>
              </div>
            ) : (
              <div className="px-4 py-3 flex items-center justify-between">
                <span className="font-poppins text-sm font-semibold text-brand-dark">
                  {fmt(total)}
                </span>
                <span className="flex items-center gap-1.5 text-[11px] font-poppins font-semibold
                                 text-green-600 bg-green-50 px-3 py-1.5 rounded-full">
                  ✓ Pago completado
                </span>
              </div>
            )}
          </div>

          {/* Correos tracking */}
          {isCorreos && order.tracking_number && (
            <div className="mx-5 mb-6">
              <a
                href="https://rastrea.correos.go.cr/"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-between w-full rounded-xl border border-gray-200
                           px-4 py-3 text-xs font-poppins text-brand-dark hover:border-brand-primary
                           hover:text-brand-primary transition-colors"
              >
                <span>
                  Rastrear paquete{" "}
                  <span className="font-semibold">{order.tracking_number}</span>
                </span>
                <ExternalLink size={13} className="shrink-0 text-gray-300" />
              </a>
            </div>
          )}

          <div className="h-6" />
        </div>
      </motion.div>

      {/* Lightbox */}
      <AnimatePresence>
        {lightbox && (
          <ImageLightbox
            src={lightbox.src}
            alt={lightbox.alt}
            onClose={() => setLightbox(null)}
          />
        )}
      </AnimatePresence>
    </>
  );
}
