import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Trash2, ShoppingBag, Package, AlertTriangle, Truck } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import Header from "../components/ui/Header";
import { useCart } from "../context/CartContext";
import { getLiveStocks } from "../services/cartService";
import { cn } from "../lib/utils";

function WhatsAppIcon({ size = 18 }: { size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="currentColor" aria-hidden="true">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z" />
      <path d="M12 0C5.373 0 0 5.373 0 12c0 2.125.557 4.126 1.528 5.858L.057 23.428a.75.75 0 0 0 .921.921l5.57-1.471A11.943 11.943 0 0 0 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22c-1.907 0-3.698-.511-5.238-1.4l-.374-.22-3.875 1.023 1.023-3.762-.234-.386A9.953 9.953 0 0 1 2 12C2 6.477 6.477 2 12 2s10 4.477 10 10-4.477 10-10 10z" />
    </svg>
  );
}

// ── Skeleton ───────────────────────────────────────────────────────────────

function CartSkeleton() {
  return (
    <div className="flex flex-col gap-3">
      {[1, 2, 3].map((i) => (
        <div key={i} className="animate-pulse flex gap-4 bg-white rounded-2xl border border-gray-100 p-4">
          <div className="w-20 h-20 bg-gray-100 rounded-xl shrink-0" />
          <div className="flex flex-col gap-2 flex-1 pt-1">
            <div className="h-3 bg-gray-100 rounded w-3/4" />
            <div className="h-3 bg-gray-100 rounded w-1/3" />
            <div className="h-4 bg-gray-100 rounded w-1/4 mt-1" />
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Empty state ────────────────────────────────────────────────────────────

function EmptyCart({ onBack }: { onBack: () => void }) {
  return (
    <div className="flex flex-col items-center gap-5 py-24 text-gray-300">
      <ShoppingBag size={56} strokeWidth={1.1} />
      <div className="text-center">
        <p className="font-poppins font-semibold text-base text-gray-400">
          Tu carrito está vacío
        </p>
        <p className="font-poppins text-sm text-gray-300 mt-1">
          Explora el catálogo y agrega lo que te guste.
        </p>
      </div>
      <button
        onClick={onBack}
        className="mt-2 flex items-center gap-2 px-6 py-3 rounded-xl bg-brand-primary
                   text-white text-sm font-poppins font-medium hover:bg-[#7a3e18] transition-colors"
      >
        <ArrowLeft size={15} />
        Ver catálogo
      </button>
    </div>
  );
}

// ── Cart item row ──────────────────────────────────────────────────────────

function CartItemRow({
  item,
  liveStock,
  onRemove,
  onUpdateQty,
}: {
  item: ReturnType<typeof useCart>["items"][number];
  liveStock: number | undefined;
  onRemove: () => void;
  onUpdateQty: (q: number) => void;
}) {
  const stock      = liveStock ?? item.stock;
  const outOfStock = stock === 0;
  const overStock  = item.quantity > stock && stock > 0;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -16 }}
      transition={{ duration: 0.22 }}
      className={cn(
        "bg-white rounded-2xl border p-4 flex gap-4 transition-colors",
        outOfStock ? "border-red-200 bg-red-50/30" : "border-gray-100 shadow-sm"
      )}
    >
      {/* Image */}
      <div className={cn(
        "w-20 h-20 rounded-xl overflow-hidden border shrink-0",
        outOfStock ? "border-red-100 opacity-50" : "border-gray-100 bg-gray-50"
      )}>
        {item.image_url ? (
          <img src={item.image_url} alt={item.product_name}
               className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Package size={20} className="text-gray-200" />
          </div>
        )}
      </div>

      {/* Info + controls */}
      <div className="flex flex-col gap-1.5 flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className={cn(
              "font-poppins font-semibold text-sm italic leading-snug line-clamp-2",
              outOfStock ? "text-red-400" : "text-brand-primary"
            )}>
              {item.product_name}
            </p>
            <span className="inline-block mt-0.5 text-[11px] font-poppins text-gray-400
                             bg-gray-100 rounded-full px-2 py-0.5">
              Talla {item.variant_size}
            </span>
          </div>

          {/* Remove */}
          <button
            onClick={onRemove}
            className="shrink-0 text-gray-300 hover:text-red-400 transition-colors p-0.5"
            aria-label="Eliminar"
          >
            <Trash2 size={15} strokeWidth={1.8} />
          </button>
        </div>

        {/* Stock warnings */}
        {outOfStock && (
          <div className="flex items-center gap-1.5 text-[11px] font-poppins text-red-500">
            <AlertTriangle size={12} strokeWidth={2} />
            Sin stock disponible — eliminá este producto para continuar.
          </div>
        )}
        {overStock && (
          <div className="flex items-center gap-1.5 text-[11px] font-poppins text-amber-600">
            <AlertTriangle size={12} strokeWidth={2} />
            Solo quedan {stock} unidades.
          </div>
        )}

        {/* Price + quantity */}
        <div className="flex items-center justify-between mt-1">
          <p className={cn(
            "font-poppins font-semibold text-base",
            outOfStock ? "text-red-300" : "text-brand-dark"
          )}>
            ₡{(item.price * item.quantity).toLocaleString("en-US")}
          </p>

          {/* Qty stepper */}
          {!outOfStock && (
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => onUpdateQty(item.quantity - 1)}
                className="w-7 h-7 rounded-lg border border-gray-200 flex items-center justify-center
                           text-gray-500 hover:border-brand-primary hover:text-brand-primary
                           transition-colors text-base leading-none"
              >
                −
              </button>
              <span className="w-6 text-center text-sm font-poppins font-medium text-brand-dark">
                {item.quantity}
              </span>
              <button
                onClick={() => onUpdateQty(Math.min(stock, item.quantity + 1))}
                disabled={item.quantity >= stock}
                className="w-7 h-7 rounded-lg border border-gray-200 flex items-center justify-center
                           text-gray-500 hover:border-brand-primary hover:text-brand-primary
                           transition-colors text-base leading-none
                           disabled:opacity-30 disabled:cursor-not-allowed"
              >
                +
              </button>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────

const PHONE = "50688364879";

export default function CartPage() {
  const navigate = useNavigate();
  const { items, isLoading, subtotal, itemCount, removeItem, updateQty } = useCart();

  useEffect(() => { window.scrollTo({ top: 0, behavior: "instant" }); }, []);

  // Live stock validation
  const variantIds = items.map((i) => i.variant_id);
  const { data: liveStocks = {} } = useQuery({
    queryKey:           ["cart-stocks", variantIds.join(",")],
    queryFn:            () => getLiveStocks(variantIds),
    enabled:            variantIds.length > 0,
    refetchOnWindowFocus: true,
    staleTime:          30_000,
  });

  const hasOutOfStock = items.some((i) => (liveStocks[i.variant_id] ?? i.stock) === 0);
  const validItems    = items.filter((i) => (liveStocks[i.variant_id] ?? i.stock) > 0);

  function buildWhatsAppMessage(): string {
    const lines = validItems.map(
      (i) => `• ${i.product_name} (Talla ${i.variant_size}) x${i.quantity} — ₡${(i.price * i.quantity).toLocaleString("en-US")}`
    );
    return (
      `Hola! Me gustaría comprar los siguientes productos:\n\n` +
      lines.join("\n") +
      `\n\nSubtotal: ₡${subtotal.toLocaleString("en-US")}\n\n` +
      `Por favor indíquenme los pasos para completar mi pedido.`
    );
  }

  const whatsappUrl = `https://wa.me/${PHONE}?text=${encodeURIComponent(buildWhatsAppMessage())}`;

  return (
    <>
      <Header />
      <main className="max-w-5xl mx-auto px-4 pt-8 pb-24 md:pb-16">

        {/* Back + title */}
        <div className="mb-6">
          <button
            onClick={() => navigate("/")}
            className="flex items-center gap-1.5 text-sm font-poppins text-gray-400
                       hover:text-brand-primary transition-colors mb-3"
          >
            <ArrowLeft size={15} strokeWidth={2} />
            Seguir comprando
          </button>
          <h1 className="font-poppins font-semibold italic text-brand-primary text-2xl">
            Mi carrito
          </h1>
          {!isLoading && itemCount > 0 && (
            <p className="font-poppins text-xs text-gray-400 mt-1">
              {itemCount} {itemCount === 1 ? "producto" : "productos"}
            </p>
          )}
        </div>

        {isLoading ? (
          <CartSkeleton />
        ) : items.length === 0 ? (
          <EmptyCart onBack={() => navigate("/")} />
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6 items-start">

            {/* ── Items list ─────────────────────────────────────── */}
            <div className="flex flex-col gap-3">
              <AnimatePresence mode="popLayout">
                {items.map((item) => (
                  <CartItemRow
                    key={item.variant_id}
                    item={item}
                    liveStock={liveStocks[item.variant_id]}
                    onRemove={() => removeItem(item.variant_id)}
                    onUpdateQty={(q) => updateQty(item.variant_id, q)}
                  />
                ))}
              </AnimatePresence>
            </div>

            {/* ── Order summary ──────────────────────────────────── */}
            <div className="lg:sticky lg:top-24 flex flex-col gap-3">
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5
                              flex flex-col gap-4">
                <h2 className="font-poppins font-semibold text-sm uppercase tracking-wider
                               text-brand-dark">
                  Resumen de compra
                </h2>

                {/* Item breakdown */}
                <div className="flex flex-col gap-2">
                  {items.map((item) => {
                    const stock = liveStocks[item.variant_id] ?? item.stock;
                    return (
                      <div key={item.variant_id}
                           className="flex items-center justify-between text-xs font-poppins gap-2">
                        <span className={cn(
                          "truncate",
                          stock === 0 ? "text-red-400 line-through" : "text-gray-500"
                        )}>
                          {item.product_name} · T.{item.variant_size} ×{item.quantity}
                        </span>
                        <span className={cn(
                          "shrink-0 font-medium",
                          stock === 0 ? "text-red-300" : "text-brand-dark"
                        )}>
                          ₡{(item.price * item.quantity).toLocaleString("en-US")}
                        </span>
                      </div>
                    );
                  })}
                </div>

                <div className="border-t border-gray-100 pt-3 flex flex-col gap-2">
                  <div className="flex items-center justify-between text-sm font-poppins">
                    <span className="text-gray-500">Subtotal</span>
                    <span className="font-bold text-brand-dark text-lg">
                      ₡{subtotal.toLocaleString("en-US")}
                    </span>
                  </div>

                  {/* Shipping note */}
                  <div className="flex items-start gap-2 bg-gray-50 rounded-xl px-3 py-2.5">
                    <Truck size={14} className="text-gray-400 shrink-0 mt-0.5" strokeWidth={1.8} />
                    <p className="text-[11px] font-poppins text-gray-400 leading-relaxed">
                      El costo de envío se calculará en el siguiente paso según tu ubicación.
                    </p>
                  </div>
                </div>

                {/* Out-of-stock warning */}
                {hasOutOfStock && (
                  <div className="flex items-start gap-2 bg-red-50 rounded-xl px-3 py-2.5">
                    <AlertTriangle size={14} className="text-red-400 shrink-0 mt-0.5" strokeWidth={2} />
                    <p className="text-[11px] font-poppins text-red-500 leading-relaxed">
                      Algunos productos no tienen stock. Retíralos para poder continuar.
                    </p>
                  </div>
                )}

                {/* CTA */}
                <motion.a
                  href={whatsappUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-disabled={hasOutOfStock || validItems.length === 0}
                  onClick={(e) => { if (hasOutOfStock || validItems.length === 0) e.preventDefault(); }}
                  className={cn(
                    "flex items-center justify-center gap-2 w-full py-3.5 rounded-xl",
                    "text-sm font-poppins font-medium transition-colors",
                    hasOutOfStock || validItems.length === 0
                      ? "bg-gray-100 text-gray-300 cursor-not-allowed pointer-events-none"
                      : "bg-[#25D366] text-white hover:bg-[#1da851]"
                  )}
                  whileHover={!hasOutOfStock ? { scale: 1.01 } : {}}
                  whileTap={!hasOutOfStock ? { scale: 0.98 } : {}}
                >
                  <WhatsAppIcon size={17} />
                  Comprar por WhatsApp
                </motion.a>
              </div>
            </div>
          </div>
        )}
      </main>
    </>
  );
}
