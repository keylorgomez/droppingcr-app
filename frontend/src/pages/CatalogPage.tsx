import { useMemo, useEffect, useLayoutEffect, useState, useRef } from "react";
import { useNavigate, useSearchParams, useLocation, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Search, X, ChevronDown, Check, SlidersHorizontal, ChevronLeft, ChevronRight, Share2 } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import Header from "../components/ui/Header";
import PromoBanner from "../components/PromoBanner";
import ProductCard from "../components/catalog/ProductCard";
import { getProducts } from "../services/productService";
import { CLOTHING_SIZES } from "../constants/domain";
import { normalizeText } from "../lib/formatters";
import { QUERY_KEYS } from "../constants/queryKeys";
import { ROUTES } from "../constants/app";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../components/ui/Toast";
import { cn } from "../lib/utils";

const PAGE_SIZE = 12;
const GRID_ANCHOR = "grid";

function getPageItems(current: number, total: number): (number | "…")[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);

  const delta = 1;
  const items: (number | "…")[] = [1];

  const rangeStart = Math.max(2, current - delta);
  const rangeEnd   = Math.min(total - 1, current + delta);

  if (rangeStart > 2) items.push("…");
  for (let i = rangeStart; i <= rangeEnd; i++) items.push(i);
  if (rangeEnd < total - 1) items.push("…");

  items.push(total);
  return items;
}

/** Nombres de los parámetros de URL. Cambiarlos rompe links ya compartidos. */
const PARAM = { FILTER: "filter", QUERY: "q", SIZES: "tallas" } as const;

/** Espera a que la persona deje de escribir antes de reescribir la URL. */
const URL_SYNC_DELAY_MS = 400;

interface SavedCatalogState {
  page?:          number;
  query?:         string;
  scrollY?:       number;
  filter?:        string;
  search?:        string;
  selectedSizes?: string[];
}

function readSavedState(): SavedCatalogState | null {
  try {
    const raw = sessionStorage.getItem("catalog_state");
    return raw ? (JSON.parse(raw) as SavedCatalogState) : null;
  } catch {
    return null;
  }
}

function ProductCardSkeleton() {
  return (
    <div className="animate-pulse flex flex-col">
      <div className="aspect-[4/5] rounded-card bg-ink-100" />
      <div className="h-3 bg-ink-100 w-3/4 mt-3" />
      <div className="h-3 bg-ink-100 w-1/3 mt-2" />
    </div>
  );
}

export default function CatalogPage() {
  const navigate       = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const location       = useLocation();
  const { user }       = useAuth();
  const { showToast }  = useToast();
  const isAdmin        = user?.role === "admin";
  const filter         = searchParams.get(PARAM.FILTER) ?? "";

  // `catalog_state` solo vale cuando se vuelve desde el detalle de un producto.
  // Si no se comprueba, una visita nueva desde la home hereda página, filtros y
  // scroll de la sesión anterior.
  const restoring = (location.state as { restoreScroll?: boolean } | null)?.restoreScroll === true;
  const savedState = restoring ? readSavedState() : null;

  // La URL manda sobre el estado guardado: si alguien abre un link compartido,
  // tiene que ver ese filtro y no el de su visita anterior.
  const [search, setSearch] = useState<string>(
    () => searchParams.get(PARAM.QUERY) ?? savedState?.search ?? ""
  );
  const [selectedSizes, setSelectedSizes] = useState<string[]>(() => {
    const fromUrl = searchParams.get(PARAM.SIZES);
    if (fromUrl) return fromUrl.split(",").map((size) => size.trim()).filter(Boolean);
    return savedState?.selectedSizes ?? [];
  });
  const [page, setPage]                   = useState<number>(savedState?.page ?? 1);

  // Desktop dropdown
  const [sizeDropdownOpen, setSizeDropdownOpen] = useState(false);
  const sizeDropdownRef = useRef<HTMLDivElement>(null);

  // Mobile filter modal
  const [modalOpen,      setModalOpen]      = useState(false);
  const [pendingSearch,  setPendingSearch]  = useState("");
  const [pendingSizes,   setPendingSizes]   = useState<string[]>([]);

  // Track previous values to detect real changes (avoids StrictMode false resets)
  const prevFilterRef  = useRef(filter);
  const prevSearchRef  = useRef(search);
  const prevSizesRef   = useRef(selectedSizes);

  // Pending actions after paginated re-renders
  const pendingScrollRef   = useRef<number | null>(savedState?.scrollY ?? null);
  const scrollToGridRef    = useRef(false);

  // El estado guardado se consume una sola vez: si no se borra, revive en la
  // próxima visita y devuelve al visitante a una página que ya no pidió.
  // De dejar la vista arriba se encarga <ScrollToTop />.
  useEffect(() => {
    sessionStorage.removeItem("catalog_state");
  }, []);

  // Close desktop dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (sizeDropdownRef.current && !sizeDropdownRef.current.contains(e.target as Node)) {
        setSizeDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Reset filters + page only when filter actually changes (not on initial mount)
  useEffect(() => {
    if (prevFilterRef.current === filter) return;
    prevFilterRef.current = filter;
    setSearch("");
    setSelectedSizes([]);
    setSizeDropdownOpen(false);
    setModalOpen(false);
    setPage(1);
  }, [filter]);

  // Reset page only when search or sizes actually change
  useEffect(() => {
    const sizesChanged = JSON.stringify(prevSizesRef.current) !== JSON.stringify(selectedSizes);
    if (prevSearchRef.current === search && !sizesChanged) return;
    prevSearchRef.current = search;
    prevSizesRef.current  = selectedSizes;
    setPage(1);
  }, [search, selectedSizes]);

  // Reflejar búsqueda y tallas en la URL para que el link sea compartible.
  // `replace` y no `push`: cada letra tecleada no debe dejar una entrada en el
  // historial, o el botón "atrás" tendría que pulsarse una vez por carácter.
  // El retraso evita reescribir la URL en cada pulsación.
  useEffect(() => {
    const timer = setTimeout(() => {
      const next = new URLSearchParams(window.location.search);

      if (search.trim()) next.set(PARAM.QUERY, search.trim());
      else               next.delete(PARAM.QUERY);

      if (selectedSizes.length) next.set(PARAM.SIZES, selectedSizes.join(","));
      else                      next.delete(PARAM.SIZES);

      if (next.toString() !== window.location.search.replace(/^\?/, "")) {
        setSearchParams(next, { replace: true });
      }
    }, URL_SYNC_DELAY_MS);

    return () => clearTimeout(timer);
  }, [search, selectedSizes, setSearchParams]);

  // Lock body scroll when modal is open
  useEffect(() => {
    document.body.style.overflow = modalOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [modalOpen]);

  const { data: products = [], isLoading, isError } = useQuery({
    queryKey: [...QUERY_KEYS.PRODUCTS, isAdmin],
    queryFn:  () => getProducts(isAdmin),
  });

  const maxDiscountPercent = useMemo(
    () => products.reduce((max, p) => (p.is_active && p.discount_percentage > max ? p.discount_percentage : max), 0),
    [products]
  );

  // Step 1: apply sidebar category / special filter
  const byCategory = useMemo(() => {
    if (!filter) return products.filter((p) => p.is_active || isAdmin);
    if (filter === "nuevo")      return products.filter((p) => p.is_new && (p.is_active || isAdmin));
    if (filter === "descuentos") return products.filter((p) => p.discount_percentage > 0 && (p.is_active || isAdmin));
    if (filter === "oculto")     return products.filter((p) => !p.is_active);
    return products.filter((p) => p.categories.some((c) => c.slug === filter) && (p.is_active || isAdmin));
  }, [products, filter, isAdmin]);

  // Step 2: available sizes from the category-filtered set (with stock)
  const availableSizes = useMemo(() => {
    const all = byCategory.flatMap((p) => p.sizes);
    return [...new Set(all)].sort((sizeA, sizeB) => {
      const numA = Number(sizeA), numB = Number(sizeB);
      if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
      if (!isNaN(numA)) return 1;
      if (!isNaN(numB)) return -1;
      const indexA = CLOTHING_SIZES.CATALOG_FILTER.indexOf(sizeA as typeof CLOTHING_SIZES.CATALOG_FILTER[number]);
      const indexB = CLOTHING_SIZES.CATALOG_FILTER.indexOf(sizeB as typeof CLOTHING_SIZES.CATALOG_FILTER[number]);
      if (indexA !== -1 && indexB !== -1) return indexA - indexB;
      if (indexA !== -1) return -1;
      if (indexB !== -1) return 1;
      return sizeA.localeCompare(sizeB, "es");
    });
  }, [byCategory]);

  // Step 3: apply search + size on top of category filter, then sort
  const filtered = useMemo(() => {
    let result = byCategory;
    if (search.trim()) {
      const q = normalizeText(search.trim());
      result = result.filter((p) => normalizeText(p.name).includes(q));
    }
    if (selectedSizes.length > 0) {
      result = result.filter((p) => selectedSizes.some((s) => p.sizes.includes(s)));
    }
    const rank = (p: typeof result[0]) => {
      if (p.is_sold_out)             return 3;
      if (p.is_new)                  return 0;
      if (p.discount_percentage > 0) return 1;
      return 2;
    };
    return [...result].sort((a, b) => rank(a) - rank(b));
  }, [byCategory, search, selectedSizes]);

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paginated  = useMemo(
    () => filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
    [filtered, page]
  );

  // Restaurar la posición al volver de un producto. En layout effect y sin
  // requestAnimationFrame: corre antes del paint, así no se ve un frame arriba
  // del todo, y no depende de que el bucle de animación esté vivo. La grilla
  // reserva altura con `aspect-[4/5]`, así que el documento ya mide lo que debe
  // aunque las fotos no hayan cargado.
  useLayoutEffect(() => {
    if (isLoading || pendingScrollRef.current === null) return;
    const y = pendingScrollRef.current;
    pendingScrollRef.current = null;
    window.scrollTo({ top: y, left: 0, behavior: "instant" });
  }, [paginated, isLoading]);

  // Al cambiar de página, volver al inicio de la grilla (no al tope: los
  // filtros quedan a la vista).
  useEffect(() => {
    if (isLoading || !scrollToGridRef.current) return;
    scrollToGridRef.current = false;
    document.getElementById(GRID_ANCHOR)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [paginated, isLoading]);

  // Preview count inside the mobile modal
  const previewCount = useMemo(() => {
    let result = byCategory;
    if (pendingSearch.trim()) {
      const q = normalizeText(pendingSearch.trim());
      result = result.filter((p) => normalizeText(p.name).includes(q));
    }
    if (pendingSizes.length > 0) {
      result = result.filter((p) => pendingSizes.some((s) => p.sizes.includes(s)));
    }
    return result.length;
  }, [byCategory, pendingSearch, pendingSizes]);

  const filterLabel = useMemo(() => {
    if (!filter) return null;
    if (filter === "nuevo")      return "Nuevo";
    if (filter === "descuentos") return "Descuentos";
    if (filter === "oculto")     return "Ocultos";
    const cat = products.flatMap((p) => p.categories).find((c) => c.slug === filter);
    return cat?.name ?? filter;
  }, [filter, products]);

  const hasLocalFilter = search.trim() || selectedSizes.length > 0;
  const activeFilterCount = (search.trim() ? 1 : 0) + selectedSizes.length;

  /**
   * Comparte la vista tal cual se ve. En móvil abre el menú nativo —que es por
   * donde va a salir a WhatsApp— y si no existe, copia el link al portapapeles.
   */
  async function shareCurrentView() {
    const url   = window.location.href;
    const title = filterLabel ? `Dropping CR — ${filterLabel}` : "Dropping CR";

    if (navigator.share) {
      // Cancelar el menú lanza AbortError: no es un fallo que valga reportar.
      try { await navigator.share({ title, url }); } catch { /* cancelado */ }
      return;
    }

    try {
      await navigator.clipboard.writeText(url);
      showToast("Link copiado", "success");
    } catch {
      showToast("No se pudo copiar el link", "error");
    }
  }

  function openModal() {
    setPendingSearch(search);
    setPendingSizes(selectedSizes);
    setModalOpen(true);
  }

  function applyModal() {
    setSearch(pendingSearch);
    setSelectedSizes(pendingSizes);
    setModalOpen(false);
  }

  function clearModal() {
    setPendingSearch("");
    setPendingSizes([]);
  }

  return (
    <>
      {!isLoading && (
        <PromoBanner maxDiscountPercent={maxDiscountPercent} suppressed={filter === "descuentos"} />
      )}
      <Header />

      <main className="px-4 sm:px-6 lg:px-10 pt-10 pb-28 md:pb-20 max-w-[1600px] mx-auto">

        {/* ── Encabezado ───────────────────────────────────────────── */}
        <div className="flex items-end justify-between gap-6 border-b border-ink-200 pb-6 mb-8">
          <div className="flex flex-col gap-3">
            <span className="type-eyebrow text-ink-400">
              {filterLabel ? (
                <>
                  <Link to={ROUTES.CATALOG} className="hover:text-ink-900 transition-colors">Catálogo</Link>
                  <span className="mx-2 text-ink-300">/</span>
                  <span className="text-ink-900">{filterLabel}</span>
                </>
              ) : (
                "Todas las piezas"
              )}
            </span>
            <h1 className="type-display text-[clamp(2.25rem,7vw,4.5rem)] text-ink-900">
              {filterLabel ?? "Catálogo"}
            </h1>
          </div>

          {!isLoading && (
            <p className="hidden sm:block shrink-0 pb-2 text-[12px] tnum text-ink-400">
              {filtered.length} {filtered.length === 1 ? "pieza" : "piezas"}
            </p>
          )}
        </div>

        {/* ── Desktop: búsqueda + tallas ───────────────────────────── */}
        {!isLoading && products.length > 0 && (
          <div className="hidden md:flex items-stretch gap-3 mb-10">
            <div className="relative flex-1">
              <Search
                size={15}
                className="absolute left-4 top-1/2 -translate-y-1/2 text-ink-300 pointer-events-none"
              />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar pieza…"
                className="w-full h-12 rounded-btn border border-ink-200 bg-transparent pl-10 pr-10 text-[13px]
                           text-ink-900 placeholder:text-ink-300 outline-none
                           focus:border-ink-900 transition-colors"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch("")}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-ink-300 hover:text-ink-900 transition-colors"
                  aria-label="Limpiar búsqueda"
                >
                  <X size={14} />
                </button>
              )}
            </div>

            {availableSizes.length > 1 && (
              <div className="relative shrink-0" ref={sizeDropdownRef}>
                <button
                  type="button"
                  onClick={() => setSizeDropdownOpen((o) => !o)}
                  className={cn(
                    "h-12 flex items-center gap-2 px-5 rounded-btn border text-[12px] font-display uppercase tracking-widest2 transition-colors whitespace-nowrap",
                    selectedSizes.length > 0
                      ? "bg-ink-900 border-ink-900 text-bone"
                      : "border-ink-200 text-ink-500 hover:border-ink-900 hover:text-ink-900"
                  )}
                >
                  {selectedSizes.length === 0
                    ? "Talla"
                    : selectedSizes.length === 1
                      ? `Talla ${selectedSizes[0]}`
                      : `Tallas (${selectedSizes.length})`}
                  {selectedSizes.length > 0 ? (
                    <span
                      role="button"
                      onClick={(e) => { e.stopPropagation(); setSelectedSizes([]); }}
                      className="ml-0.5 hover:opacity-60 transition-opacity"
                    >
                      <X size={13} />
                    </span>
                  ) : (
                    <ChevronDown
                      size={14}
                      className={cn("transition-transform duration-300", sizeDropdownOpen && "rotate-180")}
                    />
                  )}
                </button>

                <AnimatePresence>
                  {sizeDropdownOpen && (
                    <motion.div
                      initial={{ opacity: 0, y: -6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -6 }}
                      transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                      className="absolute right-0 top-full mt-1.5 bg-bone rounded-card border border-ink-200
                                 p-2 z-20 min-w-[184px] shadow-lift"
                    >
                      <div className="grid grid-cols-3 gap-1">
                        {availableSizes.map((size) => {
                          const active = selectedSizes.includes(size);
                          return (
                            <button
                              key={size}
                              type="button"
                              onClick={() => setSelectedSizes((prev) =>
                                active ? prev.filter((s) => s !== size) : [...prev, size]
                              )}
                              className={cn(
                                "relative flex items-center justify-center rounded-chip text-[12px] py-2.5 border transition-colors",
                                active
                                  ? "bg-ink-900 border-ink-900 text-bone"
                                  : "border-ink-200 text-ink-600 hover:border-ink-900 hover:text-ink-900"
                              )}
                            >
                              {active && <Check size={9} className="absolute top-1 right-1 opacity-80" strokeWidth={3} />}
                              {size}
                            </button>
                          );
                        })}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}

            {/* Solo aparece cuando hay algo que compartir: un link al catálogo
                entero no necesita botón. */}
            {(hasLocalFilter || filter) && (
              <button
                type="button"
                onClick={shareCurrentView}
                title="Compartir esta búsqueda"
                className="h-12 shrink-0 flex items-center gap-2 px-5 rounded-btn border border-ink-200
                           text-[12px] font-display uppercase tracking-widest2 text-ink-500
                           hover:border-ink-900 hover:text-ink-900 transition-colors whitespace-nowrap"
              >
                <Share2 size={14} strokeWidth={2} />
                Compartir
              </button>
            )}
          </div>
        )}

        {isError && (
          <p className="text-center text-[13px] text-ink-500 py-20">
            No se pudieron cargar los productos. Intentá de nuevo.
          </p>
        )}

        {/* ── Grilla ───────────────────────────────────────────────── */}
        <div id={GRID_ANCHOR} className="grid grid-cols-2 lg:grid-cols-4 gap-x-4 gap-y-10 scroll-mt-24">
          {isLoading
            ? Array.from({ length: PAGE_SIZE }).map((_, i) => <ProductCardSkeleton key={i} />)
            : paginated.map((product, i) => (
                <ProductCard
                  key={product.id}
                  index={i}
                  name={product.name}
                  price_sale={product.price_sale}
                  image_url={product.image_url}
                  images={product.images}
                  is_new={product.is_new}
                  discount_percentage={product.discount_percentage}
                  is_sold_out={product.is_sold_out}
                  is_reserved={product.is_reserved}
                  onClick={() => {
                    sessionStorage.setItem("catalog_state", JSON.stringify({
                      page, scrollY: window.scrollY, filter, search, selectedSizes,
                      // La query entera: al volver hay que reponer también
                      // búsqueda y tallas, no solo la categoría.
                      query: window.location.search,
                    }));
                    navigate(ROUTES.PRODUCT(product.slug));
                  }}
                  isHidden={isAdmin && !product.is_active}
                  onEdit={isAdmin ? () => navigate(`/admin/products/${product.id}/edit`) : undefined}
                />
              ))
          }
        </div>

        {/* ── Paginación ───────────────────────────────────────────── */}
        {!isLoading && totalPages > 1 && (
          <div className="flex flex-col items-center gap-4 mt-20">
            <div className="flex items-center gap-1">
              <button
                onClick={() => { scrollToGridRef.current = true; setPage((p: number) => Math.max(1, p - 1)); }}
                disabled={page === 1}
                aria-label="Página anterior"
                className="flex items-center justify-center w-10 h-10 rounded-btn border border-ink-200 text-ink-500
                           hover:border-ink-900 hover:text-ink-900 transition-colors
                           disabled:opacity-25 disabled:cursor-not-allowed disabled:hover:border-ink-200"
              >
                <ChevronLeft size={16} />
              </button>

              {getPageItems(page, totalPages).map((item, idx) =>
                item === "…" ? (
                  <span
                    key={`ellipsis-${idx}`}
                    className="w-10 h-10 flex items-center justify-center text-[13px] text-ink-300 select-none"
                  >
                    …
                  </span>
                ) : (
                  <button
                    key={item}
                    onClick={() => { scrollToGridRef.current = true; setPage(item); }}
                    className={cn(
                      "w-10 h-10 rounded-btn text-[13px] tnum border transition-colors",
                      item === page
                        ? "bg-ink-900 border-ink-900 text-bone"
                        : "border-ink-200 text-ink-500 hover:border-ink-900 hover:text-ink-900"
                    )}
                  >
                    {item}
                  </button>
                )
              )}

              <button
                onClick={() => { scrollToGridRef.current = true; setPage((p: number) => Math.min(totalPages, p + 1)); }}
                disabled={page === totalPages}
                aria-label="Página siguiente"
                className="flex items-center justify-center w-10 h-10 rounded-btn border border-ink-200 text-ink-500
                           hover:border-ink-900 hover:text-ink-900 transition-colors
                           disabled:opacity-25 disabled:cursor-not-allowed disabled:hover:border-ink-200"
              >
                <ChevronRight size={16} />
              </button>
            </div>

            <p className="sm:hidden type-eyebrow text-ink-400">
              Página {page} / {totalPages}
            </p>
          </div>
        )}

        {/* ── Vacío ────────────────────────────────────────────────── */}
        {!isLoading && !isError && filtered.length === 0 && (
          <div className="flex flex-col items-center gap-5 py-28 text-center">
            <p className="type-accent text-2xl text-ink-400">
              {hasLocalFilter
                ? "Nada coincide con ese criterio."
                : filter
                  ? "Todavía no hay piezas en esta categoría."
                  : "Estamos preparando el próximo drop."}
            </p>
            {hasLocalFilter ? (
              <button
                type="button"
                onClick={() => { setSearch(""); setSelectedSizes([]); }}
                className="link-underline font-display uppercase text-[11px] tracking-widest2 text-ink-900"
              >
                Limpiar filtros
              </button>
            ) : filter ? (
              <Link
                to={ROUTES.CATALOG}
                className="link-underline font-display uppercase text-[11px] tracking-widest2 text-ink-900"
              >
                Ver todo el catálogo
              </Link>
            ) : null}
          </div>
        )}
      </main>

      {/* ── Mobile: botón flotante de filtros ────────────────────────── */}
      {!isLoading && products.length > 0 && (
        <div className="md:hidden fixed bottom-6 left-1/2 -translate-x-1/2 z-30">
          <motion.button
            type="button"
            onClick={openModal}
            whileTap={{ scale: 0.96 }}
            className={cn(
              "flex items-center gap-2.5 px-6 py-3.5 rounded-full shadow-lift font-display uppercase text-[11px] tracking-widest2 transition-colors",
              activeFilterCount > 0 ? "bg-ink-900 text-bone" : "bg-ink-900 text-bone"
            )}
          >
            <SlidersHorizontal size={14} strokeWidth={2} />
            Filtros
            {activeFilterCount > 0 && (
              <span className="flex items-center justify-center w-4 h-4 rounded-full bg-bone text-ink-900 text-[9px] font-semibold leading-none">
                {activeFilterCount}
              </span>
            )}
          </motion.button>
        </div>
      )}

      {/* ── Mobile: hoja de filtros ──────────────────────────────────── */}
      <AnimatePresence>
        {modalOpen && (
          <>
            <motion.div
              key="backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.25 }}
              className="md:hidden fixed inset-0 bg-ink-950/50 z-40 backdrop-blur-sm"
              onClick={applyModal}
            />

            <motion.div
              key="sheet"
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", stiffness: 340, damping: 34 }}
              className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-bone rounded-t-panel
                         shadow-sheet px-5 pt-4 pb-8 flex flex-col gap-6"
            >
              <div className="flex flex-col items-center gap-4">
                <div className="w-10 h-0.5 bg-ink-200" />
                <div className="flex w-full items-center justify-between gap-4">
                  <h3 className="type-display text-2xl text-ink-900">Filtros</h3>
                  <div className="flex items-center gap-4">
                    {(hasLocalFilter || filter) && (
                      <button
                        type="button"
                        onClick={shareCurrentView}
                        className="flex items-center gap-1.5 font-display uppercase text-[10px]
                                   tracking-widest2 text-ink-500"
                      >
                        <Share2 size={12} strokeWidth={2} />
                        Compartir
                      </button>
                    )}
                    {(pendingSearch || pendingSizes.length > 0) && (
                      <button
                        type="button"
                        onClick={clearModal}
                        className="link-underline font-display uppercase text-[10px] tracking-widest2 text-ink-500"
                      >
                        Limpiar
                      </button>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-2.5">
                <p className="type-eyebrow text-ink-400">Nombre</p>
                <div className="relative">
                  <Search size={15} className="absolute left-4 top-1/2 -translate-y-1/2 text-ink-300 pointer-events-none" />
                  <input
                    type="text"
                    value={pendingSearch}
                    onChange={(e) => setPendingSearch(e.target.value)}
                    placeholder="Buscar pieza…"
                    className="w-full h-12 rounded-btn border border-ink-200 bg-transparent pl-10 pr-10 text-[13px]
                               text-ink-900 placeholder:text-ink-300 outline-none focus:border-ink-900 transition-colors"
                  />
                  {pendingSearch && (
                    <button
                      type="button"
                      onClick={() => setPendingSearch("")}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-ink-300 hover:text-ink-900"
                      aria-label="Limpiar búsqueda"
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>
              </div>

              {availableSizes.length > 1 && (
                <div className="flex flex-col gap-2.5">
                  <p className="type-eyebrow text-ink-400">Talla</p>
                  <div className="grid grid-cols-4 gap-2">
                    {availableSizes.map((size) => {
                      const active = pendingSizes.includes(size);
                      return (
                        <button
                          key={size}
                          type="button"
                          onClick={() => setPendingSizes((prev) =>
                            active ? prev.filter((s) => s !== size) : [...prev, size]
                          )}
                          className={cn(
                            "relative flex items-center justify-center rounded-btn text-[13px] py-3 border transition-colors",
                            active
                              ? "bg-ink-900 border-ink-900 text-bone"
                              : "border-ink-200 text-ink-600"
                          )}
                        >
                          {active && <Check size={9} className="absolute top-1.5 right-1.5 opacity-80" strokeWidth={3} />}
                          {size}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              <motion.button
                type="button"
                onClick={applyModal}
                whileTap={{ scale: 0.98 }}
                disabled={previewCount === 0}
                className="btn-ink w-full mt-1"
              >
                {previewCount === 0
                  ? "Sin resultados"
                  : `Ver ${previewCount} ${previewCount === 1 ? "pieza" : "piezas"}`}
              </motion.button>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
