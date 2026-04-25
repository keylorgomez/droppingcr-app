import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, ShoppingCart, Pencil, X, ZoomIn, ChevronLeft, ChevronRight } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { getProductBySlug, type ProductDetail } from "../services/productService";
import { useAuth } from "../context/AuthContext";
import { useCart } from "../context/CartContext";
import { trackViewItem } from "../lib/analytics";
import Header from "../components/ui/Header";

// ── WhatsApp icon ──────────────────────────────────────────────────────────
function WhatsAppIcon({ size = 18 }: { size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="currentColor" aria-hidden="true">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z" />
      <path d="M12 0C5.373 0 0 5.373 0 12c0 2.125.557 4.126 1.528 5.858L.057 23.428a.75.75 0 0 0 .921.921l5.57-1.471A11.943 11.943 0 0 0 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22c-1.907 0-3.698-.511-5.238-1.4l-.374-.22-3.875 1.023 1.023-3.762-.234-.386A9.953 9.953 0 0 1 2 12C2 6.477 6.477 2 12 2s10 4.477 10 10-4.477 10-10 10z" />
    </svg>
  );
}

// ── Skeleton ───────────────────────────────────────────────────────────────
function Skeleton({ className }: { className?: string }) {
  return <div className={`animate-pulse rounded-xl bg-gray-100 ${className}`} />;
}

function ProductDetailSkeleton() {
  return (
    <div className="max-w-5xl mx-auto px-4 pt-6 pb-12">
      <Skeleton className="w-36 h-4 mb-8" />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
        <div className="flex flex-col gap-3">
          <Skeleton className="w-full aspect-square rounded-2xl" />
          <div className="flex gap-2">
            {[1, 2, 3].map((i) => <Skeleton key={i} className="w-20 h-20 rounded-xl" />)}
          </div>
        </div>
        <div className="flex flex-col gap-4 pt-2">
          <Skeleton className="w-20 h-3" />
          <Skeleton className="w-3/4 h-8" />
          <Skeleton className="w-28 h-7 mt-2" />
          <div className="flex gap-2 mt-4">
            {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="w-12 h-10 rounded-lg" />)}
          </div>
          <Skeleton className="w-full h-12 mt-4 rounded-xl" />
          <Skeleton className="w-full h-12 rounded-xl" />
        </div>
      </div>
    </div>
  );
}

// ── Error state ────────────────────────────────────────────────────────────
function ErrorState({ onBack }: { onBack: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[50vh] gap-4 px-4 text-center">
      <p className="text-4xl">🤔</p>
      <h2 className="font-poppins font-semibold italic text-brand-primary text-xl">
        Producto no encontrado
      </h2>
      <p className="text-sm text-gray-400 font-poppins max-w-xs">
        Este producto no existe o ya no está disponible.
      </p>
      <button
        onClick={onBack}
        className="mt-2 flex items-center gap-2 text-sm font-poppins text-brand-primary hover:underline"
      >
        <ArrowLeft size={15} /> Volver al catálogo
      </button>
    </div>
  );
}

// ── Zoom / Lightbox ────────────────────────────────────────────────────────
function ZoomModal({
  images,
  startIndex,
  onClose,
}: {
  images: { image_url: string }[];
  startIndex: number;
  onClose: () => void;
}) {
  const [index,  setIndex]  = useState(startIndex);
  const [zoomed, setZoomed] = useState(false);

  // Close on ESC
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") setIndex((i) => (i + 1) % images.length);
      if (e.key === "ArrowLeft")  setIndex((i) => (i - 1 + images.length) % images.length);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [images.length, onClose]);

  // Lock body scroll
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, []);

  const prev = useCallback(() => {
    setZoomed(false);
    setIndex((i) => (i - 1 + images.length) % images.length);
  }, [images.length]);

  const next = useCallback(() => {
    setZoomed(false);
    setIndex((i) => (i + 1) % images.length);
  }, [images.length]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="fixed inset-0 z-[9999] bg-black/90 flex flex-col"
      onClick={onClose}
    >
      {/* Top bar */}
      <div
        className="flex items-center justify-between px-4 py-3 shrink-0"
        onClick={(e) => e.stopPropagation()}
      >
        <span className="text-white/50 text-xs font-poppins">
          {index + 1} / {images.length}
        </span>
        <button
          onClick={onClose}
          className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 flex items-center
                     justify-center text-white transition-colors"
        >
          <X size={18} />
        </button>
      </div>

      {/* Image area */}
      <div
        className="flex-1 flex items-center justify-center relative overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Prev arrow */}
        {images.length > 1 && (
          <button
            onClick={prev}
            className="absolute left-2 z-10 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20
                       flex items-center justify-center text-white transition-colors shrink-0"
          >
            <ChevronLeft size={20} />
          </button>
        )}

        <AnimatePresence mode="wait">
          <motion.img
            key={images[index].image_url}
            src={images[index].image_url}
            alt=""
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.96 }}
            transition={{ duration: 0.2 }}
            onClick={() => setZoomed((z) => !z)}
            className="max-h-full max-w-full object-contain select-none transition-transform duration-300"
            style={{
              transform: zoomed ? "scale(2.4)" : "scale(1)",
              cursor:    zoomed ? "zoom-out" : "zoom-in",
            }}
            draggable={false}
          />
        </AnimatePresence>

        {/* Next arrow */}
        {images.length > 1 && (
          <button
            onClick={next}
            className="absolute right-2 z-10 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20
                       flex items-center justify-center text-white transition-colors shrink-0"
          >
            <ChevronRight size={20} />
          </button>
        )}
      </div>

      {/* Dots */}
      {images.length > 1 && (
        <div
          className="flex justify-center gap-1.5 py-4 shrink-0"
          onClick={(e) => e.stopPropagation()}
        >
          {images.map((_, i) => (
            <button
              key={i}
              onClick={() => { setZoomed(false); setIndex(i); }}
              className={`rounded-full transition-all duration-300 ${
                i === index ? "w-4 h-1.5 bg-white" : "w-1.5 h-1.5 bg-white/30 hover:bg-white/60"
              }`}
            />
          ))}
        </div>
      )}

      {/* Hint */}
      {!zoomed && (
        <p className="text-center text-white/30 text-[11px] font-poppins pb-4 shrink-0">
          Toca la imagen para hacer zoom
        </p>
      )}
    </motion.div>
  );
}

// ── Product content ────────────────────────────────────────────────────────
function ProductContent({ product }: { product: ProductDetail }) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { addItem } = useCart();
  const isAdmin  = user?.role === "admin";

  const [addingToCart,   setAddingToCart]   = useState(false);
  const [sizeError,      setSizeError]      = useState(false);
  const [zoomOpen,       setZoomOpen]       = useState(false);

  const sortedImages = [...product.images].sort((a, b) =>
    b.is_primary === a.is_primary ? 0 : b.is_primary ? 1 : -1
  );

  const [activeImg, setActiveImg] = useState(0);
  const [selectedSize, setSelectedSize] = useState<string | null>(null);

  const hasDiscount = product.discount_percentage > 0;
  const discountedPrice = hasDiscount
    ? Math.round(product.price_sale * (1 - product.discount_percentage / 100))
    : product.price_sale;

  // Stock per size
  const stockBySize = product.variants.reduce<Record<string, number>>((acc, v) => {
    acc[v.size] = (acc[v.size] ?? 0) + v.stock;
    return acc;
  }, {});
  const sizes = Object.keys(stockBySize);


  const isSoldOut = product.variants.every((v) => v.stock === 0);

  async function handleAddToCart() {
    if (!selectedSize) {
      setSizeError(true);
      return;
    }
    setSizeError(false);
    const variant = product.variants.find((v) => v.size === selectedSize && v.stock > 0);
    if (!variant) return;
    setAddingToCart(true);
    try {
      await addItem({
        variant_id:   variant.id,
        product_id:   product.id,
        product_name: product.name,
        variant_size: selectedSize,
        image_url:    sortedImages[0]?.image_url ?? "",
        price:        discountedPrice,
        slug:         product.slug,
        stock:        variant.stock,
      });
    } finally {
      setAddingToCart(false);
    }
  }
  const phoneNumber = "50688364879";

  const whatsappBuyUrl = `https://wa.me/${phoneNumber}?text=${encodeURIComponent(
    `Hola! Me interesa el producto: ${product.name} (${window.location.href})`
  )}`;

  const whatsappQuoteUrl = `https://wa.me/${phoneNumber}?text=${encodeURIComponent(
    `Hola! Quiero cotizar un pedido del producto: ${product.name} (${window.location.href}) — está agotado, ¿pueden hacerlo por encargo?`
  )}`;

  return (
    <div className="max-w-5xl mx-auto px-4 pt-6 pb-16">
      {/* Back + admin edit */}
      <div className="flex items-center justify-between mb-8">
        <button
          onClick={() => {
            try {
              const saved = sessionStorage.getItem("catalog_state");
              const savedFilter = saved ? (JSON.parse(saved).filter ?? "") : "";
              navigate(savedFilter ? `/?filter=${savedFilter}` : "/", { state: { restoreScroll: true } });
            } catch {
              navigate("/", { state: { restoreScroll: true } });
            }
          }}
          className="flex items-center gap-1.5 text-sm font-poppins text-gray-400 hover:text-brand-primary transition-colors"
        >
          <ArrowLeft size={15} strokeWidth={2} />
          Volver al catálogo
        </button>

        {isAdmin && (
          <button
            onClick={() => navigate(`/admin/products/${product.id}/edit`)}
            className="flex items-center gap-1.5 text-xs font-poppins text-brand-primary
                       border border-brand-primary/30 rounded-xl px-3 py-1.5
                       hover:bg-brand-primary hover:text-white transition-colors"
          >
            <Pencil size={13} strokeWidth={2} />
            Editar producto
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">

        {/* ── Left: Gallery ─────────────────────────────────────────── */}
        <div className="flex flex-col gap-3">
          {/* Main image */}
          <div
            className="relative overflow-hidden rounded-2xl aspect-square bg-gray-50 border border-gray-100 cursor-zoom-in"
            onClick={() => setZoomOpen(true)}
          >
            <AnimatePresence mode="wait">
              <motion.img
                key={sortedImages[activeImg]?.image_url}
                src={sortedImages[activeImg]?.image_url}
                alt={product.name}
                className="w-full h-full object-cover absolute inset-0"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.35, ease: "easeInOut" }}
              />
            </AnimatePresence>

            {hasDiscount && (
              <span className="absolute top-4 left-4 bg-red-500 text-white text-[10px] font-bold tracking-widest uppercase px-2.5 py-1 rounded-full">
                {product.discount_percentage} OFF
              </span>
            )}

            {/* Zoom hint button */}
            <button
              onClick={(e) => { e.stopPropagation(); setZoomOpen(true); }}
              className="absolute bottom-3 right-3 w-8 h-8 rounded-full bg-white/80 backdrop-blur-sm
                         shadow-md flex items-center justify-center text-brand-primary
                         hover:bg-white transition-colors"
              aria-label="Ver imagen en detalle"
            >
              <ZoomIn size={15} strokeWidth={2} />
            </button>
          </div>

          {/* Lightbox */}
          <AnimatePresence>
            {zoomOpen && (
              <ZoomModal
                images={sortedImages}
                startIndex={activeImg}
                onClose={() => setZoomOpen(false)}
              />
            )}
          </AnimatePresence>

          {/* Thumbnails */}
          {sortedImages.length > 1 && (
            <div className="flex gap-2 overflow-x-auto pb-1">
              {sortedImages.map((img, i) => (
                <button
                  key={img.id}
                  onClick={() => setActiveImg(i)}
                  className={`shrink-0 w-[72px] h-[72px] rounded-xl overflow-hidden border-2 transition-all ${
                    i === activeImg ? "border-brand-primary" : "border-transparent"
                  }`}
                >
                  <img src={img.image_url} alt="" className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* ── Right: Details ────────────────────────────────────────── */}
        <div className="flex flex-col gap-4">

          {/* Category + badges */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[11px] font-semibold uppercase tracking-widest text-brand-accent">
              {product.categories[0]?.name ?? ""}
            </span>
            {product.discount_percentage > 0 && (
              <span className="text-[10px] font-bold uppercase tracking-wider bg-red-50 text-red-500 px-2 py-0.5 rounded-full">
                {product.discount_percentage}% descuento
              </span>
            )}
          </div>

          {/* Name */}
          <h1 className="font-poppins font-semibold italic text-brand-primary text-2xl leading-snug">
            {product.name}
          </h1>

          {/* Price */}
          <div>
            {hasDiscount && (
              <p className="text-sm text-gray-400 line-through leading-none mb-1">
                ₡{product.price_sale.toLocaleString("en-US")}
              </p>
            )}
            <p className={`font-poppins font-bold leading-none ${
              hasDiscount ? "text-red-500 text-3xl" : "text-brand-dark text-3xl"
            }`}>
              ₡{discountedPrice.toLocaleString("en-US")}
            </p>
          </div>

          {/* Description */}
          {product.description && (
            <p className="text-sm text-gray-500 font-poppins leading-relaxed border-t border-gray-100 pt-4">
              {product.description}
            </p>
          )}

          {/* Size selector */}
          {sizes.length > 0 && (
            <div className="border-t border-gray-100 pt-4">
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 font-poppins">
                  Talla
                </p>
                {sizeError && (
                  <p className="text-[11px] font-poppins text-red-500">
                    Seleccioná una talla
                  </p>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                {sizes.map((size) => {
                  const inStock = stockBySize[size] > 0;
                  const active  = selectedSize === size;
                  return (
                    <button
                      key={size}
                      onClick={() => inStock && setSelectedSize(size)}
                      disabled={!inStock}
                      className={`min-w-[44px] h-10 px-3 rounded-lg text-sm font-poppins font-medium border transition-all ${
                        active
                          ? "bg-brand-primary text-white border-brand-primary"
                          : inStock
                          ? "bg-white text-brand-dark border-gray-200 hover:border-brand-primary hover:text-brand-primary"
                          : "bg-gray-50 text-gray-300 border-gray-100 line-through cursor-not-allowed"
                      }`}
                    >
                      {size}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Action buttons */}
          <div className="flex flex-col gap-3 pt-2 mt-auto">
            {isSoldOut ? (
              <>
                <p className="text-xs font-poppins text-gray-400 text-center">
                  Este producto está agotado, pero podés consultarnos por encargo.
                </p>
                <motion.a
                  href={whatsappQuoteUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 w-full py-3.5 rounded-xl
                             bg-[#25D366] text-white text-sm font-poppins font-medium"
                  whileHover={{ backgroundColor: "#1da851" }}
                  whileTap={{ scale: 0.98 }}
                  transition={{ duration: 0.15 }}
                >
                  <WhatsAppIcon size={17} />
                  Cotizar por WhatsApp
                </motion.a>
              </>
            ) : (
              <>
                <motion.button
                  onClick={handleAddToCart}
                  disabled={addingToCart}
                  className="flex items-center justify-center gap-2 w-full py-3.5 rounded-xl
                             bg-brand-dark text-white text-sm font-poppins font-medium
                             hover:bg-brand-primary transition-colors
                             disabled:opacity-60 disabled:cursor-not-allowed"
                  whileTap={{ scale: 0.98 }}
                >
                  <ShoppingCart size={17} strokeWidth={2} />
                  {addingToCart ? "Agregando…" : "Añadir al carrito"}
                </motion.button>

                <motion.a
                  href={whatsappBuyUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 w-full py-3.5 rounded-xl bg-[#25D366] text-white text-sm font-poppins font-medium"
                  whileHover={{ backgroundColor: "#1da851" }}
                  whileTap={{ scale: 0.98 }}
                  transition={{ duration: 0.15 }}
                >
                  <WhatsAppIcon size={17} />
                  Comprar por WhatsApp
                </motion.a>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────
export default function ProductDetailPage() {
  const { slug } = useParams<{ slug: string }>();
  const navigate  = useNavigate();

  useEffect(() => { window.scrollTo({ top: 0, behavior: "instant" }); }, [slug]);

  const { data: product, isLoading, isError } = useQuery({
    queryKey: ["product", slug],
    queryFn:  () => getProductBySlug(slug!),
    enabled:  !!slug,
  });

  // Fire view_item once per product load (guard with ref to avoid double-fire in StrictMode)
  const trackedSlug = useRef<string | null>(null);
  useEffect(() => {
    if (product && trackedSlug.current !== product.slug) {
      trackedSlug.current = product.slug;
      trackViewItem({
        id:       product.id,
        name:     product.name,
        price:    product.price_sale,
        category: product.categories[0]?.name,
      });
    }
  }, [product]);

  return (
    <>
      <Header />
      {isLoading && <ProductDetailSkeleton />}
      {(isError || (!isLoading && !product)) && <ErrorState onBack={() => navigate("/")} />}
      {product && <ProductContent product={product} />}
    </>
  );
}
