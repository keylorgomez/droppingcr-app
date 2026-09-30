import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, ArrowRight, ShoppingBag, Pencil, X, ChevronLeft, ChevronRight, Plus, Minus } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cloudinaryUrl } from "../lib/cloudinary";
import { getProducts, getProductBySlug, type ProductDetail, type CatalogProduct } from "../services/productService";
import { useAuth } from "../context/AuthContext";
import { useCart } from "../context/CartContext";
import { trackViewItem } from "../lib/analytics";
import Header from "../components/ui/Header";
import ProductCard from "../components/catalog/ProductCard";
import Reveal from "../components/ui/Reveal";
import SectionHeading from "../components/home/SectionHeading";
import { CLOTHING_SIZES } from "../constants/domain";
import { QUERY_KEYS } from "../constants/queryKeys";
import { STORE_WHATSAPP, ROUTES } from "../constants/app";
import { cn } from "../lib/utils";
import { discountedPrice } from "../lib/formatters";

const RELATED_COUNT = 4;

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
  return <div className={`animate-pulse bg-ink-100 ${className}`} />;
}

function ProductDetailSkeleton() {
  return (
    <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-10 pt-8 pb-20">
      <Skeleton className="w-32 h-3 mb-10" />
      <div className="grid grid-cols-1 lg:grid-cols-[1.25fr_1fr] gap-10 lg:gap-16">
        <Skeleton className="w-full aspect-[4/5] rounded-card" />
        <div className="flex flex-col gap-5 pt-2">
          <Skeleton className="w-24 h-3" />
          <Skeleton className="w-3/4 h-12" />
          <Skeleton className="w-32 h-8" />
          <Skeleton className="w-full h-20 mt-4" />
          <div className="flex gap-2 mt-4">
            {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="w-14 h-12" />)}
          </div>
          <Skeleton className="w-full h-14 mt-4" />
          <Skeleton className="w-full h-14" />
        </div>
      </div>
    </div>
  );
}

// ── Error state ────────────────────────────────────────────────────────────
function ErrorState({ onBack }: { onBack: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-5 px-4 text-center">
      <span className="type-eyebrow text-ink-400">Error 404</span>
      <h2 className="type-display text-[clamp(2rem,6vw,3.5rem)] text-ink-900">
        Pieza no encontrada
      </h2>
      <p className="type-accent text-xl text-ink-400 max-w-sm">
        Este producto no existe o ya se fue con alguien más.
      </p>
      <button onClick={onBack} className="btn-outline mt-3">
        <ArrowLeft size={14} /> Volver al catálogo
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

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") setIndex((i) => (i + 1) % images.length);
      if (e.key === "ArrowLeft")  setIndex((i) => (i - 1 + images.length) % images.length);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [images.length, onClose]);

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
      transition={{ duration: 0.25 }}
      className="fixed inset-0 z-[9999] bg-ink-950 flex flex-col"
      onClick={onClose}
    >
      <div
        className="flex items-center justify-between px-5 h-14 shrink-0"
        onClick={(e) => e.stopPropagation()}
      >
        <span className="type-eyebrow text-bone/50 tnum">
          {String(index + 1).padStart(2, "0")} / {String(images.length).padStart(2, "0")}
        </span>
        <button
          onClick={onClose}
          className="text-bone/60 hover:text-bone transition-colors"
          aria-label="Cerrar"
        >
          <X size={20} strokeWidth={1.6} />
        </button>
      </div>

      <div
        className="flex-1 flex items-center justify-center relative overflow-hidden px-4"
        onClick={(e) => e.stopPropagation()}
      >
        {images.length > 1 && (
          <button
            onClick={prev}
            aria-label="Anterior"
            className="absolute left-3 z-10 w-10 h-10 rounded-btn border border-bone/25 text-bone
                       flex items-center justify-center hover:bg-bone hover:text-ink-900 transition-colors"
          >
            <ChevronLeft size={18} />
          </button>
        )}

        <AnimatePresence mode="wait">
          <motion.img
            key={images[index].image_url}
            src={cloudinaryUrl(images[index].image_url, "full")}
            alt=""
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            onClick={() => setZoomed((z) => !z)}
            className="max-h-full max-w-full object-contain select-none transition-transform duration-500 ease-drop"
            style={{
              transform: zoomed ? "scale(2.2)" : "scale(1)",
              cursor:    zoomed ? "zoom-out" : "zoom-in",
            }}
            draggable={false}
          />
        </AnimatePresence>

        {images.length > 1 && (
          <button
            onClick={next}
            aria-label="Siguiente"
            className="absolute right-3 z-10 w-10 h-10 rounded-btn border border-bone/25 text-bone
                       flex items-center justify-center hover:bg-bone hover:text-ink-900 transition-colors"
          >
            <ChevronRight size={18} />
          </button>
        )}
      </div>

      {images.length > 1 && (
        <div className="flex justify-center gap-1.5 py-6 shrink-0" onClick={(e) => e.stopPropagation()}>
          {images.map((_, i) => (
            <button
              key={i}
              onClick={() => { setZoomed(false); setIndex(i); }}
              aria-label={`Imagen ${i + 1}`}
              className="h-px transition-all duration-500 ease-drop"
              style={{
                width: i === index ? 28 : 12,
                background: i === index ? "#faf9f7" : "rgba(250,249,247,0.3)",
              }}
            />
          ))}
        </div>
      )}
    </motion.div>
  );
}

// ── Acordeón de información ────────────────────────────────────────────────
function InfoRow({ title, children }: { title: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-t border-ink-200">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between gap-4 py-4 text-left group"
      >
        <span className="font-display uppercase text-[11px] tracking-widest2 text-ink-900">
          {title}
        </span>
        <span className="text-ink-400 group-hover:text-ink-900 transition-colors">
          {open ? <Minus size={14} strokeWidth={2} /> : <Plus size={14} strokeWidth={2} />}
        </span>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
            className="overflow-hidden"
          >
            <div className="pb-5 text-[13px] leading-relaxed text-ink-500">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Product content ────────────────────────────────────────────────────────
function ProductContent({ product }: { product: ProductDetail }) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { addItem } = useCart();
  const isAdmin  = user?.role === "admin";

  const [addingToCart, setAddingToCart] = useState(false);
  const [sizeError,    setSizeError]    = useState(false);
  const [zoomOpen,     setZoomOpen]     = useState(false);
  const [zoomIndex,    setZoomIndex]    = useState(0);
  const [mobileImg,    setMobileImg]    = useState(0);

  const sortedImages = [...product.images].sort((a, b) =>
    b.is_primary === a.is_primary ? 0 : b.is_primary ? 1 : -1
  );

  const [selectedSize, setSelectedSize] = useState<string | null>(null);

  const hasDiscount = product.discount_percentage > 0;
  const finalPrice = discountedPrice(product.price_sale, product.discount_percentage);

  // Stock per size
  const stockBySize = product.variants.reduce<Record<string, number>>((acc, v) => {
    acc[v.size] = (acc[v.size] ?? 0) + v.stock;
    return acc;
  }, {});

  // Reserved per size (is_reserved on any variant of that size)
  const isReservedBySize = product.variants.reduce<Record<string, boolean>>((acc, v) => {
    if (v.is_reserved) acc[v.size] = true;
    return acc;
  }, {});

  // Sort sizes: clothing order → numeric → alphabetical fallback
  const sortSizes = (sizeA: string, sizeB: string): number => {
    const indexA = CLOTHING_SIZES.SORT_ORDER.indexOf(sizeA.toUpperCase() as typeof CLOTHING_SIZES.SORT_ORDER[number]);
    const indexB = CLOTHING_SIZES.SORT_ORDER.indexOf(sizeB.toUpperCase() as typeof CLOTHING_SIZES.SORT_ORDER[number]);
    if (indexA !== -1 && indexB !== -1) return indexA - indexB;
    if (indexA !== -1) return -1;
    if (indexB !== -1) return 1;
    const numA = parseFloat(sizeA), numB = parseFloat(sizeB);
    if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
    return sizeA.localeCompare(sizeB);
  };
  const sizes = Object.keys(stockBySize).sort(sortSizes);

  const isSoldOut = product.variants.every((v) => v.stock === 0);
  const lowStock  = selectedSize ? stockBySize[selectedSize] : 0;

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
        price:        finalPrice,
        slug:         product.slug,
        stock:        variant.stock,
      });
    } finally {
      setAddingToCart(false);
    }
  }

  const whatsappBuyUrl = `https://wa.me/${STORE_WHATSAPP}?text=${encodeURIComponent(
    `Hola! Me interesa el producto: ${product.name} (${window.location.href})`
  )}`;

  const whatsappQuoteUrl = `https://wa.me/${STORE_WHATSAPP}?text=${encodeURIComponent(
    `Hola! Quiero cotizar un pedido del producto: ${product.name} (${window.location.href}) — está agotado, ¿pueden hacerlo por encargo?`
  )}`;

  function openZoom(i: number) {
    setZoomIndex(i);
    setZoomOpen(true);
  }

  function goBackToCatalog() {
    try {
      // Se repone la query completa —categoría, búsqueda y tallas— y no solo el
      // filtro: si no, volver de un producto vacía la búsqueda que traía.
      const saved = sessionStorage.getItem("catalog_state");
      const query = saved ? (JSON.parse(saved).query ?? "") : "";
      navigate(`${ROUTES.CATALOG}${query}`, { state: { restoreScroll: true } });
    } catch {
      navigate(ROUTES.CATALOG, { state: { restoreScroll: true } });
    }
  }

  return (
    <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-10 pt-6 pb-20">

      {/* ── Migas + admin ─────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-4 mb-8">
        <button
          onClick={goBackToCatalog}
          className="group flex items-center gap-2 type-eyebrow text-ink-400 hover:text-ink-900 transition-colors"
        >
          <ArrowLeft size={13} strokeWidth={2} className="transition-transform duration-300 ease-drop group-hover:-translate-x-1" />
          Catálogo
        </button>

        {isAdmin && (
          <button
            onClick={() => navigate(`/admin/products/${product.id}/edit`)}
            className="flex items-center gap-2 font-display uppercase text-[10px] tracking-widest2
                       rounded-btn border border-ink-200 px-3 py-2 text-ink-600
                       hover:border-ink-900 hover:text-ink-900 transition-colors"
          >
            <Pencil size={12} strokeWidth={2} />
            Editar
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1.2fr_1fr] gap-10 lg:gap-16 xl:gap-24">

        {/* ── Galería ───────────────────────────────────────────────── */}
        <div>
          {/* Desktop: columna apilada, se lee como un lookbook */}
          <div className="hidden lg:flex flex-col gap-3">
            {sortedImages.map((img, i) => (
              <button
                key={img.id}
                onClick={() => openZoom(i)}
                className="relative w-full aspect-[4/5] overflow-hidden rounded-card bg-ink-50 cursor-zoom-in group"
              >
                <img
                  src={cloudinaryUrl(img.image_url, "full")}
                  alt={product.name}
                  loading={i === 0 ? "eager" : "lazy"}
                  className="absolute inset-0 w-full h-full object-cover transition-transform duration-[900ms] ease-drop group-hover:scale-[1.03]"
                />
              </button>
            ))}
          </div>

          {/* Mobile: carrusel con scroll-snap */}
          <div className="lg:hidden -mx-4 sm:-mx-6">
            <div
              className="flex overflow-x-auto snap-x snap-mandatory no-scrollbar"
              onScroll={(e) => {
                const el = e.currentTarget;
                setMobileImg(Math.round(el.scrollLeft / el.clientWidth));
              }}
            >
              {sortedImages.map((img, i) => (
                <button
                  key={img.id}
                  onClick={() => openZoom(i)}
                  className="relative shrink-0 w-screen aspect-[4/5] snap-center bg-ink-50"
                >
                  <img
                    src={cloudinaryUrl(img.image_url, "full")}
                    alt={product.name}
                    loading={i === 0 ? "eager" : "lazy"}
                    className="absolute inset-0 w-full h-full object-cover"
                  />
                </button>
              ))}
            </div>

            {sortedImages.length > 1 && (
              <div className="flex justify-center gap-1.5 mt-4">
                {sortedImages.map((_, i) => (
                  <span
                    key={i}
                    className="h-px transition-all duration-400 ease-drop"
                    style={{
                      width: i === mobileImg ? 24 : 10,
                      background: i === mobileImg ? "#0a0a0a" : "#d9d9d9",
                    }}
                  />
                ))}
              </div>
            )}
          </div>
        </div>

        <AnimatePresence>
          {zoomOpen && (
            <ZoomModal
              images={sortedImages}
              startIndex={zoomIndex}
              onClose={() => setZoomOpen(false)}
            />
          )}
        </AnimatePresence>

        {/* ── Panel de compra ──────────────────────────────────────── */}
        <div className="lg:sticky lg:top-24 lg:self-start flex flex-col">

          {product.categories[0] && (
            <Link
              to={ROUTES.catalogFilter(product.categories[0].slug)}
              className="link-underline self-start type-eyebrow text-ink-400 hover:text-ink-900 transition-colors"
            >
              {product.categories[0].name}
            </Link>
          )}

          <h1 className="type-display text-[clamp(1.9rem,4.4vw,3.25rem)] text-ink-900 mt-4">
            {product.name}
          </h1>

          {/* Precio */}
          <div className="flex items-baseline flex-wrap gap-x-3 gap-y-1 mt-6">
            <span className={cn("text-2xl font-semibold tnum", hasDiscount ? "text-sale" : "text-ink-900")}>
              ₡{finalPrice.toLocaleString("en-US")}
            </span>
            {hasDiscount && (
              <>
                <span className="text-base text-ink-400 line-through tnum">
                  ₡{product.price_sale.toLocaleString("en-US")}
                </span>
                <span className="font-display uppercase text-[10px] tracking-widest2
                                 rounded-chip bg-sale text-white px-2 py-1 leading-none">
                  −{product.discount_percentage}%
                </span>
              </>
            )}
          </div>

          {product.description && (
            <p className="text-[13.5px] leading-relaxed text-ink-500 mt-7 max-w-prose">
              {product.description}
            </p>
          )}

          {/* Tallas */}
          {sizes.length > 0 && (
            <div className="mt-9">
              <div className="flex items-baseline justify-between gap-4 mb-3">
                <p className="type-eyebrow text-ink-400">Talla</p>
                <AnimatePresence>
                  {sizeError && (
                    <motion.p
                      initial={{ opacity: 0, y: -4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      className="type-eyebrow text-ink-900"
                    >
                      Elegí una talla
                    </motion.p>
                  )}
                </AnimatePresence>
              </div>

              <div className="grid grid-cols-5 sm:grid-cols-6 gap-1.5">
                {sizes.map((size) => {
                  const inStock    = stockBySize[size] > 0;
                  const isApartada = !inStock && isReservedBySize[size];
                  const active     = selectedSize === size;
                  return (
                    <button
                      key={size}
                      onClick={() => { if (inStock) { setSelectedSize(size); setSizeError(false); } }}
                      disabled={!inStock}
                      title={isApartada ? "Apartada" : undefined}
                      className={cn(
                        "relative h-12 rounded-btn text-[13px] border transition-colors",
                        active
                          ? "bg-ink-900 text-bone border-ink-900"
                          : inStock
                            ? "border-ink-200 text-ink-900 hover:border-ink-900"
                            : "border-ink-100 text-ink-300 cursor-not-allowed line-through"
                      )}
                    >
                      {size}
                      {isApartada && (
                        <span className="absolute -top-1.5 -right-1 bg-reserved text-ink-900
                                         text-[7px] rounded-chip font-display uppercase tracking-wider px-1 py-0.5 leading-none">
                          Apt
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>

              {selectedSize && lowStock > 0 && lowStock <= 2 && (
                <p className="type-eyebrow text-ink-500 mt-3">
                  Última{lowStock === 1 ? "" : "s"} {lowStock} en talla {selectedSize}
                </p>
              )}
            </div>
          )}

          {/* Acciones */}
          <div className="flex flex-col gap-2.5 mt-9">
            {isSoldOut ? (
              <>
                <p className="type-eyebrow text-ink-400 text-center pb-1">
                  Agotado · disponible por encargo
                </p>
                <a
                  href={whatsappQuoteUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-ink w-full"
                >
                  <WhatsAppIcon size={16} />
                  Cotizar por WhatsApp
                </a>
              </>
            ) : (
              <>
                <motion.button
                  onClick={handleAddToCart}
                  disabled={addingToCart}
                  className="btn-ink w-full"
                  whileTap={{ scale: 0.985 }}
                >
                  <ShoppingBag size={16} strokeWidth={1.8} />
                  {addingToCart ? "Agregando…" : "Añadir al carrito"}
                </motion.button>

                <a
                  href={whatsappBuyUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-outline w-full"
                >
                  <WhatsAppIcon size={16} />
                  Comprar por WhatsApp
                </a>
              </>
            )}
          </div>

          {/* Información */}
          <div className="mt-12">
            <InfoRow title="Envíos y entrega">
              Enviamos a todo el país por Correos de Costa Rica con número de guía.
              También coordinamos entrega en Grecia. El costo del envío se confirma
              al cerrar el pedido por WhatsApp.
            </InfoRow>
            <InfoRow title="Formas de pago">
              SINPE Móvil, transferencia bancaria o efectivo contra entrega.
              El pago se coordina directamente con nosotros después de hacer el pedido.
            </InfoRow>
            <InfoRow title="Estado de la pieza">
              Cada prenda se revisa antes de publicarse. Si una pieza tiene algún
              detalle, lo indicamos en la descripción y en las fotos.
            </InfoRow>
            <div className="border-t border-ink-200" />
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Relacionados ───────────────────────────────────────────────────────────
function RelatedProducts({ product }: { product: ProductDetail }) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const isAdmin  = user?.role === "admin";

  const { data: products = [] } = useQuery({
    queryKey: [...QUERY_KEYS.PRODUCTS, isAdmin],
    queryFn:  () => getProducts(isAdmin),
  });

  const related = useMemo(() => {
    const slugs = new Set(product.categories.map((c) => c.slug));
    const score = (p: CatalogProduct) => (p.categories.some((c) => slugs.has(c.slug)) ? 0 : 1);
    return products
      .filter((p) => p.is_active && p.id !== product.id && !p.is_sold_out)
      .sort((a, b) => score(a) - score(b))
      .slice(0, RELATED_COUNT);
  }, [products, product]);

  if (related.length === 0) return null;

  return (
    <section className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-10 pb-24">
      <SectionHeading
        eyebrow="Seguí buscando"
        title="También te puede gustar"
        link={{ label: "Ver catálogo", to: ROUTES.CATALOG }}
      />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-x-4 gap-y-10">
        {related.map((p, i) => (
          <ProductCard
            key={p.id}
            index={i}
            name={p.name}
            price_sale={p.price_sale}
            image_url={p.image_url}
            images={p.images}
            is_new={p.is_new}
            discount_percentage={p.discount_percentage}
            is_sold_out={p.is_sold_out}
            is_reserved={p.is_reserved}
            onClick={() => navigate(ROUTES.PRODUCT(p.slug))}
          />
        ))}
      </div>

      <Reveal className="flex justify-center mt-14">
        <Link to={ROUTES.CATALOG} className="btn-outline group">
          Ver todo el catálogo
          <ArrowRight size={14} strokeWidth={2} className="transition-transform duration-300 ease-drop group-hover:translate-x-1" />
        </Link>
      </Reveal>
    </section>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────
export default function ProductDetailPage() {
  const { slug } = useParams<{ slug: string }>();
  const navigate  = useNavigate();

  useEffect(() => { window.scrollTo({ top: 0, behavior: "instant" }); }, [slug]);

  const { data: product, isLoading, isError } = useQuery({
    queryKey: QUERY_KEYS.PRODUCT(slug!),
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
      {(isError || (!isLoading && !product)) && <ErrorState onBack={() => navigate(ROUTES.CATALOG)} />}
      {product && (
        <>
          <ProductContent product={product} />
          <RelatedProducts product={product} />
        </>
      )}
    </>
  );
}
