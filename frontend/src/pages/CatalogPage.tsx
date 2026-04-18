import { useMemo, useEffect, useState, useRef } from "react";
import { useNavigate, useSearchParams, useLocation } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ShoppingBag, Search, X, ChevronDown, Check, SlidersHorizontal, ChevronLeft, ChevronRight } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import Header from "../components/ui/Header";
import Hero from "../components/ui/Hero";
import ProductCard from "../components/catalog/ProductCard";
import { getProducts } from "../services/productService";
import { useAuth } from "../context/AuthContext";
import { cn } from "../lib/utils";

const PAGE_SIZE = 12;

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

const normalize = (s: string) =>
  s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

export default function CatalogPage() {
  const navigate       = useNavigate();
  const [searchParams] = useSearchParams();
  const location       = useLocation();
  const { user }       = useAuth();
  const isAdmin        = user?.role === "admin";
  const filter         = searchParams.get("filter") ?? "";

  // Applied filters
  const [search,       setSearch]       = useState("");
  const [selectedSize, setSelectedSize] = useState<string | null>(null);

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
  const [modalOpen,    setModalOpen]    = useState(false);
  const [pendingSearch, setPendingSearch] = useState("");
  const [pendingSize,   setPendingSize]   = useState<string | null>(null);

  // Track previous values to detect real changes (avoids StrictMode false resets)
  const prevFilterRef   = useRef(filter);
  const prevSearchRef   = useRef(search);
  const prevSizeRef     = useRef(selectedSize);

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
    setSelectedSize(null);
    setSizeDropdownOpen(false);
    setModalOpen(false);
    setPage(1);
  }, [filter]);

  // Reset page only when search or size actually change
  useEffect(() => {
    if (prevSearchRef.current === search && prevSizeRef.current === selectedSize) return;
    prevSearchRef.current = search;
    prevSizeRef.current   = selectedSize;
    setPage(1);
  }, [search, selectedSize]);

  // Lock body scroll when modal is open
  useEffect(() => {
    document.body.style.overflow = modalOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [modalOpen]);

  useEffect(() => {
    const state = location.state as any;
    if (state?.scrollToCatalog || state?.restoreScroll) {
      if (!pendingScrollRef.current) {
        document.getElementById("catalogo")?.scrollIntoView({ behavior: "smooth" });
      }
      window.history.replaceState({}, "");
    }
  }, [location.state]);

  const { data: products = [], isLoading, isError } = useQuery({
    queryKey: ["products"],
    queryFn:  getProducts,
  });

  // Step 1: apply sidebar category / special filter
  const byCategory = useMemo(() => {
    if (!filter) return products;
    if (filter === "nuevo")      return products.filter((p) => p.is_new);
    if (filter === "descuentos") return products.filter((p) => p.discount_percentage > 0);
    return products.filter((p) => p.categories.some((c) => c.slug === filter));
  }, [products, filter]);

  // Step 2: available sizes from the category-filtered set (with stock)
  const availableSizes = useMemo(() => {
    const all = byCategory.flatMap((p) => p.sizes);
    return [...new Set(all)].sort((a, b) => {
      const aNum = Number(a), bNum = Number(b);
      if (!isNaN(aNum) && !isNaN(bNum)) return aNum - bNum;
      if (!isNaN(aNum)) return 1;
      if (!isNaN(bNum)) return -1;
      const order = ["XS", "S", "M", "L", "XL", "XXL"];
      const ai = order.indexOf(a), bi = order.indexOf(b);
      if (ai !== -1 && bi !== -1) return ai - bi;
      if (ai !== -1) return -1;
      if (bi !== -1) return 1;
      return a.localeCompare(b, "es");
    });
  }, [byCategory]);

  // Step 3: apply search + size on top of category filter, then sort
  const filtered = useMemo(() => {
    let result = byCategory;
    if (search.trim()) {
      const q = normalize(search.trim());
      result = result.filter((p) => normalize(p.name).includes(q));
    }
    if (selectedSize) {
      result = result.filter((p) => p.sizes.includes(selectedSize));
    }
    const rank = (p: typeof result[0]) => {
      if (p.is_sold_out)             return 3;
      if (p.is_new)                  return 0;
      if (p.discount_percentage > 0) return 1;
      return 2;
    };
    return [...result].sort((a, b) => rank(a) - rank(b));
  }, [byCategory, search, selectedSize]);

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
      const q = normalize(pendingSearch.trim());
      result = result.filter((p) => normalize(p.name).includes(q));
    }
    if (pendingSize) {
      result = result.filter((p) => p.sizes.includes(pendingSize));
    }
    return result.length;
  }, [byCategory, pendingSearch, pendingSize]);

  const filterLabel = useMemo(() => {
    if (!filter) return null;
    if (filter === "nuevo")      return "Nuevo";
    if (filter === "descuentos") return "Descuentos";
    const cat = products.flatMap((p) => p.categories).find((c) => c.slug === filter);
    return cat?.name ?? filter;
  }, [filter, products]);

  const hasLocalFilter = search.trim() || selectedSize;
  const activeFilterCount = (search.trim() ? 1 : 0) + (selectedSize ? 1 : 0);

  function openModal() {
    setPendingSearch(search);
    setPendingSize(selectedSize);
    setModalOpen(true);
  }

  function applyModal() {
    setSearch(pendingSearch);
    setSelectedSize(pendingSize);
    setModalOpen(false);
  }

  function clearModal() {
    setPendingSearch("");
    setPendingSize(null);
  }

  return (
    <>
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
                    selectedSize
                      ? "bg-brand-primary border-brand-primary text-white"
                      : "border-gray-200 text-gray-500 bg-white hover:border-brand-primary hover:text-brand-primary"
                  )}
                >
                  {selectedSize ? `Talla: ${selectedSize}` : "Talla"}
                  {selectedSize ? (
                    <span
                      role="button"
                      onClick={(e) => { e.stopPropagation(); setSelectedSize(null); }}
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
                        const active = selectedSize === size;
                        return (
                          <button
                            key={size}
                            type="button"
                            onClick={() => { setSelectedSize(active ? null : size); setSizeDropdownOpen(false); }}
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
                  is_new={product.is_new}
                  discount_percentage={product.discount_percentage}
                  is_sold_out={product.is_sold_out}
                  is_reserved={product.is_reserved}
                  onClick={() => {
                    sessionStorage.setItem("catalog_state", JSON.stringify({ page, scrollY: window.scrollY, filter }));
                    navigate(`/product/${product.slug}`);
                  }}
                  onEdit={isAdmin ? () => navigate(`/admin/products/${product.id}/edit`) : undefined}
                />
              ))
          }
        </div>

        {/* ── Pagination ──────────────────────────────────────────────── */}
        {!isLoading && totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 mt-10">
            <button
              onClick={() => { scrollToCatalogRef.current = true; setPage((p: number) => Math.max(1, p - 1)); }}
              disabled={page === 1}
              className="flex items-center justify-center w-9 h-9 rounded-xl border border-gray-200
                         text-gray-400 hover:border-brand-primary hover:text-brand-primary
                         transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <ChevronLeft size={16} />
            </button>

            {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
              <button
                key={p}
                onClick={() => { scrollToCatalogRef.current = true; setPage(p); }}
                className={cn(
                  "w-9 h-9 rounded-xl text-sm font-poppins font-medium border transition-all",
                  p === page
                    ? "bg-brand-primary border-brand-primary text-white"
                    : "border-gray-200 text-gray-500 hover:border-brand-primary hover:text-brand-primary bg-white"
                )}
              >
                {p}
              </button>
            ))}

            <button
              onClick={() => { scrollToCatalogRef.current = true; setPage((p: number) => Math.min(totalPages, p + 1)); }}
              disabled={page === totalPages}
              className="flex items-center justify-center w-9 h-9 rounded-xl border border-gray-200
                         text-gray-400 hover:border-brand-primary hover:text-brand-primary
                         transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <ChevronRight size={16} />
            </button>
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
                    onClick={() => { setSearch(""); setSelectedSize(null); }}
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
                  {(pendingSearch || pendingSize) && (
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
                      const active = pendingSize === size;
                      return (
                        <button
                          key={size}
                          type="button"
                          onClick={() => setPendingSize(active ? null : size)}
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
