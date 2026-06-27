import { useMemo, useEffect, useState, useRef } from "react";
import { useNavigate, useSearchParams, useLocation } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ShoppingBag, Search, X, ChevronDown, Check, SlidersHorizontal, ChevronLeft, ChevronRight } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import Header from "../components/ui/Header";
import Hero from "../components/ui/Hero";
import ProductCard from "../components/catalog/ProductCard";
import WorldCupModal from "../components/WorldCupModal";
import { getProducts } from "../services/productService";
import { CLOTHING_SIZES } from "../constants/domain";
import { normalizeText } from "../lib/formatters";
import { QUERY_KEYS } from "../constants/queryKeys";
import { useAuth } from "../context/AuthContext";
import { cn } from "../lib/utils";

const PAGE_SIZE = 12;

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

function ProductCardSkeleton() {
  return (
    <div className="animate-pulse flex flex-col bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="aspect-square bg-gray-100" />
      <div className="flex flex-col gap-2 p-3">
        <div className="h-3 bg-gray-100 rounded-lg w-full" />
        <div className="h-3 bg-gray-100 rounded-lg w-2/3" />
        <div className="h-4 bg-gray-100 rounded-lg w-1/3 mt-1" />
      </div>
    </div>
  );
}

export default function CatalogPage() {
  const navigate       = useNavigate();
  const [searchParams] = useSearchParams();
  const location       = useLocation();
  const { user }       = useAuth();
  const isAdmin        = user?.role === "admin";
  const filter         = searchParams.get("filter") ?? "";

  // Applied filters — initialized from sessionStorage for back-nav restore
  const [search, setSearch] = useState(() => {
    try { const s = sessionStorage.getItem("catalog_state"); if (s) return JSON.parse(s).search ?? ""; } catch {}
    return "";
  });
  const [selectedSizes, setSelectedSizes] = useState<string[]>(() => {
    try { const s = sessionStorage.getItem("catalog_state"); if (s) return JSON.parse(s).selectedSizes ?? []; } catch {}
    return [];
  });

  // Initialize page from sessionStorage so it's correct before any effect runs
  const [page, setPage] = useState(() => {
    try {
      const saved = sessionStorage.getItem("catalog_state");
      if (saved) return JSON.parse(saved).page ?? 1;
    } catch {}
    return 1;
  });

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
  const pendingScrollRef      = useRef<number | null>(null);
  const scrollToCatalogRef    = useRef(false);

  // On mount: restore scroll Y from sessionStorage, or auto-scroll to catalog on filtered links
  useEffect(() => {
    try {
      const saved = sessionStorage.getItem("catalog_state");
      if (saved) {
        // Back-navigation: restore exact scroll position
        const { scrollY } = JSON.parse(saved);
        pendingScrollRef.current = scrollY ?? null;
        sessionStorage.removeItem("catalog_state");
      } else if (filter) {
        // Fresh link with a filter (e.g. /?filter=descuentos): skip hero, go to products
        scrollToCatalogRef.current = true;
      }
    } catch {
      if (filter) scrollToCatalogRef.current = true;
    }
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

  // Lock body scroll when modal is open
  useEffect(() => {
    document.body.style.overflow = modalOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [modalOpen]);

  useEffect(() => {
    const state = location.state as { scrollToCatalog?: boolean; restoreScroll?: boolean } | null;
    if (state?.scrollToCatalog || state?.restoreScroll) {
      if (!pendingScrollRef.current) {
        document.getElementById("catalogo")?.scrollIntoView({ behavior: "smooth" });
      }
      window.history.replaceState({}, "");
    }
  }, [location.state]);

  const { data: products = [], isLoading, isError } = useQuery({
    queryKey: [...QUERY_KEYS.PRODUCTS, isAdmin],
    queryFn:  () => getProducts(isAdmin),
  });

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

  // After paginated updates: run pending scroll restore OR scroll-to-catalog
  useEffect(() => {
    if (isLoading) return;
    if (pendingScrollRef.current !== null) {
      const y = pendingScrollRef.current;
      pendingScrollRef.current = null;
      requestAnimationFrame(() => window.scrollTo({ top: y, behavior: "instant" }));
    } else if (scrollToCatalogRef.current) {
      scrollToCatalogRef.current = false;
      requestAnimationFrame(() =>
        document.getElementById("catalogo")?.scrollIntoView({ behavior: "smooth" })
      );
    }
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
      <WorldCupModal />
      <Header />
      <Hero />

      <main id="catalogo" className="px-4 pt-10 pb-24 md:pb-12 max-w-7xl mx-auto">

        {/* Category filter label */}
        {filterLabel && !isLoading && (
          <div className="flex items-center gap-2 mb-5">
            <h2 className="font-poppins font-semibold text-base text-brand-dark">
              {filterLabel}
            </h2>
            <span className="text-xs font-poppins text-gray-400">
              · {byCategory.length} {byCategory.length === 1 ? "producto" : "productos"}
            </span>
            <a
              href="/"
              className="ml-auto text-xs font-poppins text-gray-400 hover:text-brand-primary
                         underline underline-offset-2 transition-colors"
            >
              Ver todo
            </a>
          </div>
        )}

        {/* ── Desktop: Search + size dropdown ──────────────────────── */}
        {!isLoading && products.length > 0 && (
          <div className="hidden md:flex gap-2 mb-6">

            {/* Search input */}
            <div className="relative flex-1">
              <Search
                size={15}
                className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-300 pointer-events-none"
              />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar producto…"
                className="w-full rounded-xl border border-gray-200 pl-9 pr-9 py-2.5 text-sm
                           font-poppins text-brand-dark placeholder:text-gray-300 outline-none
                           focus:border-brand-primary focus:ring-1 focus:ring-brand-primary/20
                           transition bg-white"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-300
                             hover:text-gray-500 transition-colors"
                >
                  <X size={14} />
                </button>
              )}
            </div>

            {/* Size dropdown */}
            {availableSizes.length > 1 && (
              <div className="relative shrink-0" ref={sizeDropdownRef}>
                <button
                  type="button"
                  onClick={() => setSizeDropdownOpen((o) => !o)}
                  className={cn(
                    "h-full flex items-center gap-1.5 px-4 rounded-xl border text-sm font-poppins transition-all whitespace-nowrap",
                    selectedSizes.length > 0
                      ? "bg-brand-primary border-brand-primary text-white"
                      : "border-gray-200 text-gray-500 bg-white hover:border-brand-primary hover:text-brand-primary"
                  )}
                >
                  {selectedSizes.length === 0
                    ? "Talla"
                    : selectedSizes.length === 1
                      ? `Talla: ${selectedSizes[0]}`
                      : `Tallas (${selectedSizes.length})`}
                  {selectedSizes.length > 0 ? (
                    <span
                      role="button"
                      onClick={(e) => { e.stopPropagation(); setSelectedSizes([]); }}
                      className="ml-0.5 hover:opacity-70 transition-opacity"
                    >
                      <X size={13} />
                    </span>
                  ) : (
                    <ChevronDown
                      size={14}
                      className={cn("transition-transform duration-200", sizeDropdownOpen && "rotate-180")}
                    />
                  )}
                </button>

                {sizeDropdownOpen && (
                  <div className="absolute right-0 top-full mt-1.5 bg-white border border-gray-100
                                  rounded-2xl shadow-lg p-3 z-20 min-w-[160px]">
                    <div className="grid grid-cols-3 gap-1.5">
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
                              "relative flex items-center justify-center rounded-lg text-xs font-poppins font-medium py-2 border transition-all",
                              active
                                ? "bg-brand-primary border-brand-primary text-white"
                                : "border-gray-200 text-gray-600 hover:border-brand-primary hover:text-brand-primary bg-white"
                            )}
                          >
                            {active && <Check size={10} className="absolute top-1 right-1 opacity-80" strokeWidth={3} />}
                            {size}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {isError && (
          <p className="text-center font-poppins text-sm text-red-400 py-10">
            No se pudieron cargar los productos. Intenta de nuevo.
          </p>
        )}

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {isLoading
            ? Array.from({ length: PAGE_SIZE }).map((_, i) => <ProductCardSkeleton key={i} />)
            : paginated.map((product) => (
                <ProductCard
                  key={product.id}
                  name={product.name}
                  price_sale={product.price_sale}
                  image_url={product.image_url}
                  images={product.images}
                  category={product.category}
                  categories={product.categories}
                  is_new={product.is_new}
                  discount_percentage={product.discount_percentage}
                  is_sold_out={product.is_sold_out}
                  is_reserved={product.is_reserved}
                  onClick={() => {
                    sessionStorage.setItem("catalog_state", JSON.stringify({ page, scrollY: window.scrollY, filter, search, selectedSizes }));
                    navigate(`/product/${product.slug}`);
                  }}
                  isHidden={isAdmin && !product.is_active}
                  onEdit={isAdmin ? () => navigate(`/admin/products/${product.id}/edit`) : undefined}
                />
              ))
          }
        </div>

        {/* ── Pagination ──────────────────────────────────────────────── */}
        {!isLoading && totalPages > 1 && (
          <div className="flex flex-col items-center gap-3 mt-10">
            <div className="flex items-center gap-1.5">
              {/* Prev */}
              <button
                onClick={() => { scrollToCatalogRef.current = true; setPage((p: number) => Math.max(1, p - 1)); }}
                disabled={page === 1}
                className="flex items-center justify-center w-9 h-9 rounded-xl border border-gray-200
                           text-gray-400 hover:border-brand-primary hover:text-brand-primary
                           transition-colors disabled:opacity-30 disabled:cursor-not-allowed bg-white"
              >
                <ChevronLeft size={16} />
              </button>

              {getPageItems(page, totalPages).map((item, idx) =>
                item === "…" ? (
                  <span
                    key={`ellipsis-${idx}`}
                    className="w-9 h-9 flex items-center justify-center text-sm text-gray-300 font-poppins select-none"
                  >
                    …
                  </span>
                ) : (
                  <button
                    key={item}
                    onClick={() => { scrollToCatalogRef.current = true; setPage(item); }}
                    className={cn(
                      "w-9 h-9 rounded-xl text-sm font-poppins font-medium border transition-all",
                      item === page
                        ? "bg-brand-primary border-brand-primary text-white shadow-sm"
                        : "border-gray-200 text-gray-500 hover:border-brand-primary hover:text-brand-primary bg-white"
                    )}
                  >
                    {item}
                  </button>
                )
              )}

              {/* Next */}
              <button
                onClick={() => { scrollToCatalogRef.current = true; setPage((p: number) => Math.min(totalPages, p + 1)); }}
                disabled={page === totalPages}
                className="flex items-center justify-center w-9 h-9 rounded-xl border border-gray-200
                           text-gray-400 hover:border-brand-primary hover:text-brand-primary
                           transition-colors disabled:opacity-30 disabled:cursor-not-allowed bg-white"
              >
                <ChevronRight size={16} />
              </button>
            </div>

            {/* Indicador de página en mobile */}
            <p className="sm:hidden text-xs font-poppins text-gray-400">
              Página {page} de {totalPages}
            </p>
          </div>
        )}

        {!isLoading && !isError && filtered.length === 0 && (
          <div className="flex flex-col items-center gap-4 py-24 text-gray-300">
            <ShoppingBag size={48} strokeWidth={1.2} />
            <div className="text-center">
              <p className="font-poppins font-medium text-sm text-gray-400">
                {hasLocalFilter
                  ? "No hay productos con ese criterio."
                  : filter
                    ? "No hay productos en esta categoría."
                    : "No hay productos disponibles."}
              </p>
              <p className="font-poppins text-xs text-gray-300 mt-1">
                {hasLocalFilter ? (
                  <button
                    type="button"
                    onClick={() => { setSearch(""); setSelectedSizes([]); }}
                    className="text-brand-primary underline underline-offset-2"
                  >
                    Limpiar filtros
                  </button>
                ) : filter ? (
                  <a href="/" className="text-brand-primary underline underline-offset-2">
                    Ver todos los productos
                  </a>
                ) : "Vuelve pronto, estamos preparando algo nuevo."}
              </p>
            </div>
          </div>
        )}
      </main>

      {/* ── Mobile: Floating filter button ───────────────────────────── */}
      {!isLoading && products.length > 0 && (
        <div className="md:hidden fixed bottom-6 left-1/2 -translate-x-1/2 z-30">
          <motion.button
            type="button"
            onClick={openModal}
            whileTap={{ scale: 0.96 }}
            className={cn(
              "flex items-center gap-2 px-5 py-3 rounded-full shadow-lg text-sm font-poppins font-medium transition-colors",
              activeFilterCount > 0
                ? "bg-brand-primary text-white"
                : "bg-brand-dark text-white"
            )}
          >
            <SlidersHorizontal size={15} strokeWidth={2} />
            Filtros
            {activeFilterCount > 0 && (
              <span className="flex items-center justify-center w-4 h-4 rounded-full bg-white text-brand-primary text-[10px] font-bold leading-none">
                {activeFilterCount}
              </span>
            )}
          </motion.button>
        </div>
      )}

      {/* ── Mobile: Filter bottom sheet ───────────────────────────────── */}
      <AnimatePresence>
        {modalOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              key="backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="md:hidden fixed inset-0 bg-black/40 z-40 backdrop-blur-sm"
              onClick={applyModal}
            />

            {/* Sheet */}
            <motion.div
              key="sheet"
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", stiffness: 320, damping: 32 }}
              className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-white rounded-t-3xl
                         shadow-2xl px-5 pt-4 pb-8 flex flex-col gap-5"
            >
              {/* Handle + header */}
              <div className="flex flex-col items-center gap-3">
                <div className="w-10 h-1 rounded-full bg-gray-200" />
                <div className="flex w-full items-center justify-between">
                  <h3 className="font-poppins font-semibold text-base text-brand-dark">Filtros</h3>
                  {(pendingSearch || pendingSizes.length > 0) && (
                    <button
                      type="button"
                      onClick={clearModal}
                      className="text-xs font-poppins text-brand-primary underline underline-offset-2"
                    >
                      Limpiar todo
                    </button>
                  )}
                </div>
              </div>

              {/* Search input */}
              <div className="flex flex-col gap-1.5">
                <p className="text-[11px] font-semibold uppercase tracking-widest text-gray-400 font-poppins">
                  Nombre
                </p>
                <div className="relative">
                  <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-300 pointer-events-none" />
                  <input
                    type="text"
                    value={pendingSearch}
                    onChange={(e) => setPendingSearch(e.target.value)}
                    placeholder="Buscar producto…"
                    className="w-full rounded-xl border border-gray-200 pl-9 pr-9 py-3 text-sm
                               font-poppins text-brand-dark placeholder:text-gray-300 outline-none
                               focus:border-brand-primary focus:ring-1 focus:ring-brand-primary/20
                               transition bg-white"
                  />
                  {pendingSearch && (
                    <button
                      type="button"
                      onClick={() => setPendingSearch("")}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-300 hover:text-gray-500"
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>
              </div>

              {/* Size grid */}
              {availableSizes.length > 1 && (
                <div className="flex flex-col gap-2">
                  <p className="text-[11px] font-semibold uppercase tracking-widest text-gray-400 font-poppins">
                    Talla
                  </p>
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
                            "relative flex items-center justify-center rounded-xl text-sm font-poppins font-medium py-3 border transition-all",
                            active
                              ? "bg-brand-primary border-brand-primary text-white"
                              : "border-gray-200 text-gray-600 bg-white"
                          )}
                        >
                          {active && <Check size={10} className="absolute top-1.5 right-1.5 opacity-80" strokeWidth={3} />}
                          {size}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Apply button */}
              <motion.button
                type="button"
                onClick={applyModal}
                whileTap={{ scale: 0.98 }}
                className="w-full py-3.5 rounded-2xl bg-brand-dark text-white text-sm font-poppins
                           font-medium mt-1"
              >
                {previewCount === 0
                  ? "Sin resultados"
                  : `Ver ${previewCount} ${previewCount === 1 ? "producto" : "productos"}`}
              </motion.button>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
