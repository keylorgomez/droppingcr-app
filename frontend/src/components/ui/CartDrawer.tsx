import { motion, AnimatePresence } from "framer-motion";
import { X, ShoppingCart, Package, ArrowRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useCart } from "../../context/CartContext";

export default function CartDrawer() {
  const { drawerOpen, drawerItem, closeDrawer, items, itemCount, subtotal } = useCart();
  const navigate = useNavigate();

  function goToCart() {
    closeDrawer();
    navigate("/carrito");
  }

  return (
    <AnimatePresence>
      {drawerOpen && (
        <>
          {/* Backdrop — only on desktop */}
          <motion.div
            className="hidden md:block fixed inset-0 z-40"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={closeDrawer}
          />

          {/* ── Desktop: slide from right ─────────────────────────── */}
          <motion.aside
            className="hidden md:flex fixed top-0 right-0 h-full w-80 bg-white z-50
                       flex-col shadow-2xl border-l border-gray-100"
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
              className="md:hidden fixed inset-0 bg-black/40 z-40 backdrop-blur-sm"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={closeDrawer}
            />
            <motion.div
              className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-white
                         rounded-t-3xl shadow-2xl flex flex-col max-h-[75vh]"
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", stiffness: 340, damping: 34 }}
            >
              {/* Handle */}
              <div className="flex justify-center pt-3 pb-1 shrink-0">
                <div className="w-10 h-1 rounded-full bg-gray-200" />
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
      <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 shrink-0">
        <div className="flex items-center gap-2.5">
          <ShoppingCart size={17} className="text-brand-primary" strokeWidth={1.8} />
          <span className="font-poppins font-semibold text-brand-dark text-sm">
            Producto agregado
          </span>
        </div>
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-brand-primary transition-colors"
          aria-label="Cerrar"
        >
          <X size={18} />
        </button>
      </div>

      {/* Added item */}
      {drawerItem && (
        <div className="px-5 py-4 border-b border-gray-50 shrink-0">
          <div className="flex gap-3 items-center">
            {/* Image */}
            <div className="w-16 h-16 rounded-xl overflow-hidden bg-gray-50 border border-gray-100 shrink-0">
              {drawerItem.image_url ? (
                <img
                  src={drawerItem.image_url}
                  alt={drawerItem.product_name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <Package size={20} className="text-gray-200" />
                </div>
              )}
            </div>
            {/* Info */}
            <div className="flex-1 min-w-0">
              <p className="font-poppins font-semibold text-sm italic text-brand-primary
                            line-clamp-2 leading-snug">
                {drawerItem.product_name}
              </p>
              <p className="font-poppins text-xs text-gray-400 mt-0.5">
                Talla {drawerItem.variant_size}
              </p>
              <p className="font-poppins font-semibold text-sm text-brand-dark mt-1">
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
            <div key={item.variant_id} className="flex items-center gap-2 text-xs font-poppins">
              <div className="w-8 h-8 rounded-lg overflow-hidden bg-gray-50 shrink-0">
                {item.image_url
                  ? <img src={item.image_url} alt="" className="w-full h-full object-cover" />
                  : <Package size={12} className="text-gray-200 m-auto mt-2" />
                }
              </div>
              <span className="flex-1 text-gray-500 truncate">
                {item.product_name}
                <span className="text-gray-300"> · T.{item.variant_size}</span>
              </span>
              <span className="text-gray-400 shrink-0">×{item.quantity}</span>
              <span className="text-brand-dark font-medium shrink-0">
                ₡{(item.price * item.quantity).toLocaleString("en-US")}
              </span>
            </div>
          ))}
          {items.length > 4 && (
            <p className="text-[11px] font-poppins text-gray-400 text-center pt-1">
              +{items.length - 4} producto{items.length - 4 > 1 ? "s" : ""} más
            </p>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="px-5 pb-6 pt-3 border-t border-gray-100 flex flex-col gap-3 shrink-0">
        {/* Subtotal */}
        <div className="flex items-center justify-between text-sm font-poppins">
          <span className="text-gray-500">
            {itemCount} {itemCount === 1 ? "producto" : "productos"}
          </span>
          <span className="font-semibold text-brand-dark">
            ₡{subtotal.toLocaleString("en-US")}
          </span>
        </div>

        {/* CTA buttons */}
        <button
          onClick={onGoToCart}
          className="flex items-center justify-center gap-2 w-full py-3 rounded-xl
                     bg-brand-primary text-white text-sm font-poppins font-medium
                     hover:bg-[#7a3e18] transition-colors"
        >
          Ver carrito
          <ArrowRight size={15} strokeWidth={2} />
        </button>
        <button
          onClick={onClose}
          className="w-full py-2.5 rounded-xl border border-gray-200 text-sm
                     font-poppins text-gray-500 hover:border-gray-300 hover:text-brand-dark
                     transition-colors"
        >
          Seguir comprando
        </button>
      </div>
    </>
  );
}
