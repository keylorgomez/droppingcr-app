import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, ArrowRight, ShoppingBag, Pencil, X, ChevronLeft, ChevronRight, Plus, Minus } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { cloudinaryUrl } from "../lib/cloudinary";
import { getProducts, getProductBySlug, type ProductDetail, type CatalogProduct } from "../services/productService";
import { useAuth } from "../context/AuthContext";
import { useCart } from "../context/CartContext";
import { trackViewItem } from "../lib/analytics";
import Header from "../components/ui/Header";
import WhatsAppIcon from "../components/ui/WhatsAppIcon";
import ProductCard from "../components/catalog/ProductCard";
import Reveal from "../components/ui/Reveal";
import SectionHeading from "../components/home/SectionHeading";
import { CLOTHING_SIZES } from "../constants/domain";
import { QUERY_KEYS } from "../constants/queryKeys";
import { STORE_WHATSAPP, ROUTES } from "../constants/app";
import { cn } from "../lib/utils";
import { useSeo, productJsonLd, breadcrumbJsonLd } from "../lib/seo";
import { discountedPrice } from "../lib/formatters";
import { SHIPPING_RATES } from "../config/shipping";
import { SINPE_MOVIL } from "../config/payments";

const colones = (amount: number) => `₡${amount.toLocaleString("en-US")}`;

const RELATED_COUNT = 4;

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

  // Con una sola talla disponible no tiene sentido hacer elegir: va marcada.
  const [selectedSize, setSelectedSize] = useState<string | null>(() => {
    const available = [...new Set(product.variants.filter((v) => v.stock > 0).map((v) => v.size))];
    return available.length === 1 ? available[0] : null;
  });

  // Barra de compra fija en celular: aparece cuando los botones principales
  // salen de pantalla, así la compra está siempre a un toque.
  const actionsRef = useRef<HTMLDivElement>(null);
  const [actionsVisible, setActionsVisible] = useState(true);
  useEffect(() => {
    const node = actionsRef.current;
    if (!node) return;
    const observer = new IntersectionObserver(([entry]) => setActionsVisible(entry.isIntersecting));
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

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

  // Mientras se ve la barra fija, la página crece lo que mide la barra para
  // que no tape el final del footer.
  const stickyBarShown = !actionsVisible && !isSoldOut;
  useEffect(() => {
    if (!stickyBarShown || window.matchMedia("(min-width: 1024px)").matches) return;
    document.body.style.paddingBottom = "84px";
    return () => { document.body.style.paddingBottom = ""; };
  }, [stickyBarShown]);

  const categoryName = product.categories[0]?.name ?? null;

  // Sin esto las fichas comparten título y descripción, y Google no tiene por
  // qué posicionar una sobre otra. El JSON-LD es lo que además habilita que
  // muestre precio y disponibilidad en el resultado.
  useSeo({
    title: categoryName ? `${product.name} — ${categoryName}` : product.name,
    description:
      product.description?.trim() ||
      `${product.name}${categoryName ? ` (${categoryName})` : ""} por ₡${finalPrice.toLocaleString("en-US")}` +
      `${sizes.length ? `. Tallas ${sizes.join(", ")}` : ""}. Envíos a todo Costa Rica.`,
    path:  ROUTES.PRODUCT(product.slug),
    image: sortedImages[0] ? cloudinaryUrl(sortedImages[0].image_url, "medium") : undefined,
    type:  "product",
    jsonLd: [
      productJsonLd({
        name:        product.name,
        description: product.description,
        slug:        product.slug,
        price:       finalPrice,
        images:      sortedImages.map((img) => cloudinaryUrl(img.image_url, "full")),
        inStock:     !isSoldOut,
        category:    categoryName,
      }),
      breadcrumbJsonLd([
        { name: "Inicio",   path: ROUTES.HOME },
        { name: "Catálogo", path: ROUTES.CATALOG },
        ...(categoryName ? [{ name: categoryName, path: ROUTES.catalogFilter(product.categories[0].slug) }] : []),
        { name: product.name, path: ROUTES.PRODUCT(product.slug) },
      ]),
    ],
  });

  async function handleAddToCart() {
    if (!selectedSize) {
      setSizeError(true);
      // Desde la barra fija, llevar a la persona a elegir la talla.
      actionsRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
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
    `Hola! Me interesa ${product.name}${selectedSize ? ` en talla ${selectedSize}` : ""} (${colones(finalPrice)}). ${window.location.href}`
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
      <div className="flex items-center justify-between gap-4 mb-4 lg:mb-8">
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
          {/* Desktop: la principal grande y el resto en dos columnas. Apiladas
              una tras otra a todo el ancho obligaban a bajar una pantalla por foto. */}
          <div className="hidden lg:grid grid-cols-2 gap-3">
            {sortedImages.map((img, i) => (
              <motion.button
                key={img.id}
                onClick={() => openZoom(i)}
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "120px" }}
                transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1], delay: i === 0 ? 0 : 0.06 * (i % 2) }}
                className={cn(
                  "relative w-full aspect-[4/5] overflow-hidden rounded-card bg-ink-50 cursor-zoom-in group",
                  i === 0 && "col-span-2"
                )}
              >
                <img
                  src={cloudinaryUrl(img.image_url, "full")}
                  alt={product.name}
                  loading={i === 0 ? "eager" : "lazy"}
                  className="absolute inset-0 w-full h-full object-cover transition-transform duration-[900ms] ease-drop group-hover:scale-[1.03]"
                />
              </motion.button>
            ))}
          </div>

          {/* Mobile: carrusel más bajo que deja asomar la siguiente foto. A todo
              el ancho la foto medía 125% del ancho de pantalla y el nombre y el
              precio quedaban debajo del pliegue en celulares chicos. */}
          <div className="lg:hidden -mx-4 sm:-mx-6">
            <div
              className="flex gap-2.5 overflow-x-auto snap-x snap-mandatory no-scrollbar px-4 sm:px-6 scroll-px-4"
              onScroll={(e) => {
                const el    = e.currentTarget;
                const slide = el.firstElementChild as HTMLElement | null;
                const step  = slide ? slide.offsetWidth + 10 : el.clientWidth;
                setMobileImg(Math.round(el.scrollLeft / step));
              }}
            >
              {sortedImages.map((img, i) => (
                <button
                  key={img.id}
                  onClick={() => openZoom(i)}
                  className={cn(
                    "relative shrink-0 snap-start overflow-hidden rounded-card bg-ink-50",
                    "h-[min(100vw,58svh)] aspect-[4/5]",
                    sortedImages.length === 1 && "w-full aspect-auto"
                  )}
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

          {/* Lo que más se pregunta antes de comprar, sin abrir nada */}
          <ul className="mt-4 flex flex-col gap-1 text-[12.5px] text-ink-500">
            <li>Envío a todo el país desde {colones(SHIPPING_RATES.MENSAJERO)}</li>
            <li>Pagá por SINPE Móvil, transferencia o contra entrega</li>
          </ul>

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
                  {lowStock === 1
                    ? `Queda solo 1 en talla ${selectedSize}`
                    : `Quedan solo ${lowStock} en talla ${selectedSize}`}
                </p>
              )}
            </div>
          )}

          {/* Acciones */}
          <div ref={actionsRef} className="flex flex-col gap-2.5 mt-9">
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
              Mensajero privado en zonas de cobertura: {colones(SHIPPING_RATES.MENSAJERO)}.
              Correos de Costa Rica con número de guía: {colones(SHIPPING_RATES.CORREOS_GAM)} dentro
              del GAM y {colones(SHIPPING_RATES.CORREOS_FUERA_GAM)} fuera del GAM. Entrega personal
              gratis en Grecia.
            </InfoRow>
            <InfoRow title="Formas de pago">
              SINPE Móvil al {SINPE_MOVIL.phone}, transferencia bancaria o efectivo
              contra entrega. También podés apartar la pieza con un abono.
            </InfoRow>
            <InfoRow title="Estado de la pieza">
              Cada prenda se revisa antes de publicarse. Si una pieza tiene algún
              detalle, lo indicamos en la descripción y en las fotos.
            </InfoRow>
            <div className="border-t border-ink-200" />
          </div>
        </div>
      </div>

      {/* ── Barra de compra fija (solo celular) ──────────────────── */}
      <AnimatePresence>
        {stickyBarShown && (
          <motion.div
            initial={{ y: "110%" }}
            animate={{ y: 0 }}
            exit={{ y: "110%" }}
            transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
            className="lg:hidden fixed inset-x-0 bottom-0 z-40 bg-bone/95 backdrop-blur-xl
                       border-t border-ink-200 px-4 pt-3 pb-[max(12px,env(safe-area-inset-bottom))]"
          >
            <div className="flex items-center gap-3">
              <div className="flex flex-col min-w-0 flex-1">
                <span className="text-[12px] text-ink-500 truncate">
                  {selectedSize ? `Talla ${selectedSize}` : product.name}
                </span>
                <span className={cn("text-[17px] font-semibold tnum leading-tight", hasDiscount ? "text-sale" : "text-ink-900")}>
                  {colones(finalPrice)}
                </span>
              </div>
              <a
                href={whatsappBuyUrl}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Comprar por WhatsApp"
                className="w-12 h-12 shrink-0 rounded-btn border border-ink-900 flex items-center justify-center text-ink-900"
              >
                <WhatsAppIcon size={20} />
              </a>
              <button
                onClick={handleAddToCart}
                disabled={addingToCart}
                className="btn-ink h-12 px-5 shrink-0"
              >
                <ShoppingBag size={16} strokeWidth={1.8} />
                {addingToCart ? "Agregando…" : selectedSize ? "Añadir" : "Elegir talla"}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Relacionados ───────────────────────────────────────────────────────────
function RelatedProducts({ product }: { product: ProductDetail }) {
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
            sizes={p.sizes}
            href={ROUTES.PRODUCT(p.slug)}
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
