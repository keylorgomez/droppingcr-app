import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Trash2, ShoppingBag, Package, AlertTriangle, Truck } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { cloudinaryUrl } from "../lib/cloudinary";
import Header from "../components/ui/Header";
import { useCart } from "../context/CartContext";
import { getLiveStocks } from "../services/cartService";
import { cn } from "../lib/utils";
import { STORE_WHATSAPP, SITE_URL, ROUTES } from "../constants/app";
import { SHIPPING_RATES } from "../config/shipping";
import { SINPE_MOVIL } from "../config/payments";
import WhatsAppIcon from "../components/ui/WhatsAppIcon";
import ShippingPicker from "../components/cart/ShippingPicker";
import { EMPTY_SHIPPING, shippingQuote, type ShippingChoice } from "../lib/shippingQuote";

// ── Skeleton ───────────────────────────────────────────────────────────────

function CartSkeleton() {
  return (
    <div className="flex flex-col gap-3">
      {[1, 2, 3].map((i) => (
        <div key={i} className="animate-pulse flex gap-4 bg-bone rounded-card border border-ink-100 p-4">
          <div className="w-20 h-20 bg-ink-100 rounded-btn shrink-0" />
          <div className="flex flex-col gap-2 flex-1 pt-1">
            <div className="h-3 bg-ink-100 rounded w-3/4" />
            <div className="h-3 bg-ink-100 rounded w-1/3" />
            <div className="h-4 bg-ink-100 rounded w-1/4 mt-1" />
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Empty state ────────────────────────────────────────────────────────────

function EmptyCart({ onBack }: { onBack: () => void }) {
  return (
    <div className="flex flex-col items-center gap-5 py-24 text-ink-300">
      <ShoppingBag size={56} strokeWidth={1.1} />
      <div className="text-center">
        <p className="font-semibold text-base text-ink-400">
          Tu carrito está vacío
        </p>
        <p className="text-sm text-ink-300 mt-1">
          Explora el catálogo y agrega lo que te guste.
        </p>
      </div>
      <button
        onClick={onBack}
        className="mt-2 flex items-center gap-2 px-6 py-3 rounded-btn bg-brand-primary
                   text-white text-sm font-medium hover:bg-[#2e2e2e] transition-colors"
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
        "bg-bone rounded-card border p-4 flex gap-4 transition-colors",
        outOfStock ? "border-ink-900 bg-ink-50" : "border-ink-100 shadow-sm"
      )}
    >
      {/* Image */}
      <div className={cn(
        "w-20 h-20 rounded-btn overflow-hidden border shrink-0",
        outOfStock ? "border-ink-200 opacity-50" : "border-ink-100 bg-ink-50"
      )}>
        {item.image_url ? (
          <img src={cloudinaryUrl(item.image_url, "thumb")} alt={item.product_name}
               className="w-full h-full object-cover" loading="lazy" />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Package size={20} className="text-ink-200" />
          </div>
        )}
      </div>

      {/* Info + controls */}
      <div className="flex flex-col gap-1.5 flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className={cn(
              "text-[13px] leading-snug line-clamp-2",
              outOfStock ? "text-ink-600" : "text-brand-primary"
            )}>
              {item.product_name}
            </p>
            <span className="inline-block mt-0.5 text-[11px] text-ink-400
                             bg-ink-100 rounded-full px-2 py-0.5">
              Talla {item.variant_size}
            </span>
          </div>

          {/* Remove */}
          <button
            onClick={onRemove}
            className="shrink-0 text-ink-300 hover:text-ink-600 transition-colors p-0.5"
            aria-label="Eliminar"
          >
            <Trash2 size={15} strokeWidth={1.8} />
          </button>
        </div>

        {/* Stock warnings */}
        {outOfStock && (
          <div className="flex items-center gap-1.5 text-[11px] text-ink-900">
            <AlertTriangle size={12} strokeWidth={2} />
            Sin stock disponible — eliminá este producto para continuar.
          </div>
        )}
        {overStock && (
          <div className="flex items-center gap-1.5 text-[11px] text-ink-600">
            <AlertTriangle size={12} strokeWidth={2} />
            Solo quedan {stock} unidades.
          </div>
        )}

        {/* Price + quantity */}
        <div className="flex items-center justify-between mt-1">
          <p className={cn(
            "font-semibold text-base",
            outOfStock ? "text-ink-300" : "text-brand-dark"
          )}>
            ₡{(item.price * item.quantity).toLocaleString("en-US")}
          </p>

          {/* Qty stepper */}
          {!outOfStock && (
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => onUpdateQty(item.quantity - 1)}
                className="w-7 h-7 rounded-btn border border-ink-200 flex items-center justify-center
                           text-ink-500 hover:border-brand-primary hover:text-brand-primary
                           transition-colors text-base leading-none"
              >
                −
              </button>
              <span className="w-6 text-center text-sm font-medium text-brand-dark">
                {item.quantity}
              </span>
              <button
                onClick={() => onUpdateQty(Math.min(stock, item.quantity + 1))}
                disabled={item.quantity >= stock}
                className="w-7 h-7 rounded-btn border border-ink-200 flex items-center justify-center
                           text-ink-500 hover:border-brand-primary hover:text-brand-primary
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

const PHONE = STORE_WHATSAPP;

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

  // La dirección se recuerda en este navegador: quien vuelve a comprar no la
  // escribe de nuevo. Si el almacenamiento falla, simplemente arranca vacía.
  const [shipping, setShippingState] = useState<ShippingChoice>(() => {
    try {
      const saved = localStorage.getItem("dropping:cart-shipping");
      return saved ? { ...EMPTY_SHIPPING, ...JSON.parse(saved) } : EMPTY_SHIPPING;
    } catch { return EMPTY_SHIPPING; }
  });
  const [payMethod, setPayMethod] = useState<string>("");
  function setShipping(next: ShippingChoice) {
    setShippingState(next);
    try { localStorage.setItem("dropping:cart-shipping", JSON.stringify(next)); } catch { /* sin almacenamiento */ }
  }
  const quote = shippingQuote(shipping);

  const hasOutOfStock = items.some((i) => (liveStocks[i.variant_id] ?? i.stock) === 0);
  const validItems    = items.filter((i) => (liveStocks[i.variant_id] ?? i.stock) > 0);

  // El mensaje llega listo para responder: con el link de cada pieza (para no
  // confundir tallas o modelos parecidos) y la dirección a completar, que es
  // lo primero que hay que preguntar para cotizar el envío.
  function buildWhatsAppMessage(): string {
    const lines = validItems.map(
      (i) => `• ${i.product_name} — Talla ${i.variant_size} x${i.quantity} — ₡${(i.price * i.quantity).toLocaleString("en-US")}\n  ${SITE_URL}${ROUTES.PRODUCT(i.slug)}`
    );
    const validSubtotal = validItems.reduce((t, i) => t + i.price * i.quantity, 0);
    const money = (n: number) => `₡${n.toLocaleString("en-US")}`;
    const totals = quote
      ? `Subtotal: ${money(validSubtotal)}\nEnvío (${quote.label}): ${quote.cost === 0 ? "gratis" : money(quote.cost)}\n*Total: ${money(validSubtotal + quote.cost)}*`
      : `Subtotal: ${money(validSubtotal)} + envío`;
    const where = quote
      ? `${shipping.district}, ${shipping.canton}, ${shipping.province}`
      : "(provincia, cantón y distrito)";
    return (
      `Hola! Quiero comprar:\n\n` +
      lines.join("\n") +
      `\n\n${totals}\n\n` +
      `Envío a: ${where}\n` +
      `Pago con: ${payMethod || "(SINPE / transferencia / contra entrega)"}`
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
            className="flex items-center gap-1.5 text-sm text-ink-400
                       hover:text-brand-primary transition-colors mb-3"
          >
            <ArrowLeft size={15} strokeWidth={2} />
            Seguir comprando
          </button>
          <h1 className="type-display text-[clamp(1.9rem,7vw,3rem)] text-ink-900">
            Mi carrito
          </h1>
          {!isLoading && itemCount > 0 && (
            <p className="text-xs text-ink-400 mt-1">
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
              <div className="bg-bone rounded-card border border-ink-100 shadow-sm p-5
                              flex flex-col gap-4">
                <h2 className="font-display text-[11px] uppercase tracking-widest2
                               text-brand-dark">
                  Resumen de compra
                </h2>

                {/* Item breakdown */}
                <div className="flex flex-col gap-2">
                  {items.map((item) => {
                    const stock = liveStocks[item.variant_id] ?? item.stock;
                    return (
                      <div key={item.variant_id}
                           className="flex items-center justify-between text-xs gap-2">
                        <span className={cn(
                          "truncate",
                          stock === 0 ? "text-ink-600 line-through" : "text-ink-500"
                        )}>
                          {item.product_name} · T.{item.variant_size} ×{item.quantity}
                        </span>
                        <span className={cn(
                          "shrink-0 font-medium",
                          stock === 0 ? "text-ink-300" : "text-brand-dark"
                        )}>
                          ₡{(item.price * item.quantity).toLocaleString("en-US")}
                        </span>
                      </div>
                    );
                  })}
                </div>

                <div className="border-t border-ink-100 pt-3 flex flex-col gap-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-ink-500">Subtotal</span>
                    <span className="font-bold text-brand-dark text-lg">
                      ₡{subtotal.toLocaleString("en-US")}
                    </span>
                  </div>

                  {/* Envío: calculado con la dirección */}
                  <div className="flex flex-col gap-2 pt-1">
                    <div className="flex items-center gap-2 text-[12px] font-medium text-ink-700">
                      <Truck size={14} className="text-ink-400" strokeWidth={1.8} />
                      ¿A dónde lo enviamos?
                    </div>
                    <ShippingPicker value={shipping} onChange={setShipping} />
                    {!quote && (
                      <p className="text-[11px] text-ink-400 leading-relaxed">
                        Mensajero ₡{SHIPPING_RATES.MENSAJERO.toLocaleString("en-US")} · Correos GAM ₡{SHIPPING_RATES.CORREOS_GAM.toLocaleString("en-US")} · Fuera del GAM ₡{SHIPPING_RATES.CORREOS_FUERA_GAM.toLocaleString("en-US")} · Grecia gratis
                      </p>
                    )}
                  </div>

                  {quote && (
                    <>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-ink-500">Envío · {quote.label}</span>
                        <span className="font-medium text-brand-dark">
                          {quote.cost === 0 ? "Gratis" : `₡${quote.cost.toLocaleString("en-US")}`}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-sm border-t border-ink-100 pt-2">
                        <span className="text-ink-900 font-medium">Total</span>
                        <span className="font-bold text-brand-dark text-lg tnum">
                          ₡{(subtotal + quote.cost).toLocaleString("en-US")}
                        </span>
                      </div>
                    </>
                  )}

                  {/* Forma de pago */}
                  <div className="flex flex-col gap-2 pt-1">
                    <p className="text-[12px] font-medium text-ink-700">¿Cómo vas a pagar?</p>
                    <div className="grid grid-cols-3 gap-1.5">
                      {["SINPE Móvil", "Transferencia", "Contra entrega"].map((m) => (
                        <button
                          key={m}
                          type="button"
                          onClick={() => setPayMethod(payMethod === m ? "" : m)}
                          aria-pressed={payMethod === m}
                          className={cn(
                            "min-h-11 rounded-btn border px-1.5 text-[11.5px] leading-tight transition-colors",
                            payMethod === m ? "bg-ink-900 text-bone border-ink-900" : "border-ink-200 text-ink-700 hover:border-ink-900"
                          )}
                        >
                          {m}
                        </button>
                      ))}
                    </div>
                    {payMethod === "SINPE Móvil" && (
                      <p className="text-[11px] text-ink-500">SINPE Móvil al {SINPE_MOVIL.phone}. Te confirmamos el pago por WhatsApp.</p>
                    )}
                  </div>
                </div>

                {/* Out-of-stock warning */}
                {hasOutOfStock && (
                  <div className="flex items-start gap-2 bg-ink-50 rounded-btn px-3 py-2.5">
                    <AlertTriangle size={14} className="text-ink-600 shrink-0 mt-0.5" strokeWidth={2} />
                    <p className="text-[11px] text-ink-900 leading-relaxed">
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
                    "flex items-center justify-center gap-2 w-full py-3.5 rounded-btn",
                    "text-sm font-medium transition-colors",
                    hasOutOfStock || validItems.length === 0
                      ? "bg-ink-100 text-ink-300 cursor-not-allowed pointer-events-none"
                      : "bg-[#0a0a0a] text-white hover:bg-[#2e2e2e]"
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
