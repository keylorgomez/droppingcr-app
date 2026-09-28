import { motion, AnimatePresence } from "framer-motion";
import { X, Package, ArrowRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useCart } from "../../context/CartContext";
import { cloudinaryUrl } from "../../lib/cloudinary";
import { ROUTES } from "../../constants/app";

export default function CartDrawer() {
  const { drawerOpen, drawerItem, closeDrawer, items, itemCount, subtotal } = useCart();
  const navigate = useNavigate();

  function goToCart() {
    closeDrawer();
    navigate(ROUTES.CART);
  }

  return (
    <AnimatePresence>
      {drawerOpen && (
        <>
          {/* Backdrop — only on desktop */}
          <motion.div
            className="hidden md:block fixed inset-0 bg-ink-950/25 z-40"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={closeDrawer}
          />

          {/* ── Desktop: slide from right ─────────────────────────── */}
          <motion.aside
            className="hidden md:flex fixed top-0 right-0 h-full w-80 bg-bone z-50
                       flex-col shadow-lift border-l border-ink-200"
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", stiffness: 340, damping: 34 }}
          >
            <DrawerContent
              drawerItem={drawerItem}
              itemCount={itemCount}
              subtotal={subtotal}
              items={items}
              onClose={closeDrawer}
              onGoToCart={goToCart}
            />
          </motion.aside>

          {/* ── Mobile: bottom sheet ──────────────────────────────── */}
          <>
            <motion.div
              className="md:hidden fixed inset-0 bg-ink-950/50 z-40 backdrop-blur-sm"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={closeDrawer}
            />
            <motion.div
              className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-bone rounded-t-panel
                         shadow-sheet flex flex-col max-h-[75vh]"
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", stiffness: 340, damping: 34 }}
            >
              {/* Handle */}
              <div className="flex justify-center pt-3 pb-1 shrink-0">
                <div className="w-10 h-0.5 bg-ink-200" />
              </div>
              <DrawerContent
                drawerItem={drawerItem}
                itemCount={itemCount}
                subtotal={subtotal}
                items={items}
                onClose={closeDrawer}
                onGoToCart={goToCart}
              />
            </motion.div>
          </>
        </>
      )}
    </AnimatePresence>
  );
}

// ── Shared content ─────────────────────────────────────────────────────────

function DrawerContent({
  drawerItem, itemCount, subtotal, items, onClose, onGoToCart,
}: {
  drawerItem: ReturnType<typeof useCart>["drawerItem"];
  itemCount: number;
  subtotal: number;
  items: ReturnType<typeof useCart>["items"];
  onClose: () => void;
  onGoToCart: () => void;
}) {
  return (
    <>
      {/* Header */}
      <div className="flex items-center justify-between px-5 h-14 border-b border-ink-200 shrink-0">
        <span className="type-eyebrow text-ink-900">Producto agregado</span>
        <button
          onClick={onClose}
          className="text-ink-400 hover:text-ink-900 transition-colors"
          aria-label="Cerrar"
        >
          <X size={18} />
        </button>
      </div>

      {/* Added item */}
      {drawerItem && (
        <div className="px-5 py-4 border-b border-ink-50 shrink-0">
          <div className="flex gap-3 items-center">
            {/* Image */}
            <div className="w-[60px] h-[75px] overflow-hidden bg-ink-50 shrink-0">
              {drawerItem.image_url ? (
                <img
                  src={cloudinaryUrl(drawerItem.image_url, "thumb")}
                  alt={drawerItem.product_name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <Package size={20} className="text-ink-200" />
                </div>
              )}
            </div>
            {/* Info */}
            <div className="flex-1 min-w-0">
              <p className="text-[13px] text-ink-900 line-clamp-2 leading-snug">
                {drawerItem.product_name}
              </p>
              <p className="type-eyebrow text-ink-400 mt-1.5">Talla {drawerItem.variant_size}</p>
              <p className="text-[13px] font-semibold tnum text-ink-900 mt-2">
                ₡{drawerItem.price.toLocaleString("en-US")}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Cart summary */}
      <div className="flex-1 overflow-y-auto px-5 py-4">
        <div className="flex flex-col gap-2">
          {items.slice(0, 4).map((item) => (
            <div key={item.variant_id} className="flex items-center gap-2 text-xs">
              <div className="w-8 h-10 overflow-hidden bg-ink-50 shrink-0">
                {item.image_url
                  ? <img src={cloudinaryUrl(item.image_url, "thumb")} alt="" className="w-full h-full object-cover" />
                  : <Package size={12} className="text-ink-200 m-auto mt-2" />
                }
              </div>
              <span className="flex-1 text-ink-500 truncate">
                {item.product_name}
                <span className="text-ink-300"> · T.{item.variant_size}</span>
              </span>
              <span className="text-ink-400 tnum shrink-0">×{item.quantity}</span>
              <span className="text-ink-900 font-medium tnum shrink-0">
                ₡{(item.price * item.quantity).toLocaleString("en-US")}
              </span>
            </div>
          ))}
          {items.length > 4 && (
            <p className="text-[11px] text-ink-400 text-center pt-1">
              +{items.length - 4} producto{items.length - 4 > 1 ? "s" : ""} más
            </p>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="px-5 pb-6 pt-3 border-t border-ink-200 flex flex-col gap-2.5 shrink-0">
        {/* Subtotal */}
        <div className="flex items-center justify-between text-sm">
          <span className="type-eyebrow text-ink-400">
            {itemCount} {itemCount === 1 ? "producto" : "productos"}
          </span>
          <span className="text-base font-semibold tnum text-ink-900">
            ₡{subtotal.toLocaleString("en-US")}
          </span>
        </div>

        {/* CTA buttons */}
        <button
          onClick={onGoToCart}
          className="btn-ink w-full py-3.5"
        >
          Ver carrito
          <ArrowRight size={15} strokeWidth={2} />
        </button>
        <button
          onClick={onClose}
          className="w-full py-3 text-[12px] text-ink-500 hover:text-ink-900 transition-colors"
        >
          Seguir comprando
        </button>
      </div>
    </>
  );
}
