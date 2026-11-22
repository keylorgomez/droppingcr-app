import FloatingWhatsApp from "../components/ui/FloatingWhatsApp";
import { useCatalogProducts } from "../hooks/useCatalogProducts";
import { useMemo, useEffect, useLayoutEffect, useState, useRef } from "react";
import { useNavigate, useSearchParams, useLocation, useParams, Link } from "react-router-dom";
import { categoryCopy } from "../config/categoryCopy";
import { Search, X, ChevronDown, SlidersHorizontal, ChevronLeft, ChevronRight, Share2 } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import Header from "../components/ui/Header";
import PromoBanner from "../components/PromoBanner";
import ProductCard from "../components/catalog/ProductCard";
import { catalogSortRank } from "../services/productService";
import { matchesSearch, discountedPrice } from "../lib/formatters";
import { compareSizes, normalizeSize, sizeGroup, type SizeGroup } from "../lib/sizes";
import { SizeFilter, FitFilter } from "../components/catalog/CatalogFilters";
import { FIT_INFO, FIT_TYPES, isFitType, type FitType } from "../lib/fitType";
import type { CatalogProduct } from "../services/productService";
import { ROUTES } from "../constants/app";
import { useAuth } from "../context/AuthContext";
import { useSeo, breadcrumbJsonLd } from "../lib/seo";
import { useToast } from "../components/ui/Toast";
import { cn } from "../lib/utils";

const PAGE_SIZE = 12;
const GRID_ANCHOR = "grid";

/** En celular entran menos botones: hasta 5 páginas seguidas y, si hay más, solo la actual entre la primera y la última. */
function getPageItems(current: number, total: number, compact = false): (number | "…")[] {
  if (total <= (compact ? 5 : 7)) return Array.from({ length: total }, (_, i) => i + 1);

  // Celular: máximo 5 posiciones. En los extremos se ven las vecinas.
  if (compact) {
    if (current <= 3)         return [1, 2, 3, "…", total];
    if (current >= total - 2) return [1, "…", total - 2, total - 1, total];
    return [1, "…", current, "…", total];
  }

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
const PARAM = { FILTER: "filter", QUERY: "q", SIZES: "tallas", VERSION: "version", SORT: "orden" } as const;

type SortKey = "recomendado" | "menor" | "mayor";
const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: "recomendado", label: "Recomendado" },
  { key: "menor",       label: "Menor precio" },
  { key: "mayor",       label: "Mayor precio" },
];
function isSortKey(value: unknown): value is SortKey {
  return value === "recomendado" || value === "menor" || value === "mayor";
}

interface LocalFilters { search: string; sizes: string[]; fits: FitType[] }

/** Búsqueda, tallas y versión sobre lo que ya filtró la categoría. */
function applyLocalFilters(list: CatalogProduct[], { search, sizes, fits }: LocalFilters): CatalogProduct[] {
  let result = list;
  if (search.trim()) result = result.filter((p) => matchesSearch(p.name, search));
  // "2XL" y "XXL" son la misma talla: se comparan normalizadas.
  if (sizes.length > 0) result = result.filter((p) => p.sizes.some((size) => sizes.includes(normalizeSize(size))));
  if (fits.length > 0)  result = result.filter((p) => p.fit_type !== null && fits.includes(p.fit_type));
  return result;
}

/** Agotadas y apartadas siempre al final; dentro de cada grupo, el orden elegido. */
function sortProducts(list: CatalogProduct[], sort: SortKey): CatalogProduct[] {
  const unavailable = (p: CatalogProduct) => (p.is_sold_out ? 1 : 0);
  const price = (p: CatalogProduct) => discountedPrice(p.price_sale, p.discount_percentage);
  return [...list].sort((a, b) => {
    if (sort === "recomendado") return catalogSortRank(a) - catalogSortRank(b);
    const byStock = unavailable(a) - unavailable(b);
    if (byStock !== 0) return byStock;
    return sort === "menor" ? price(a) - price(b) : price(b) - price(a);
  });
}

/** Espera a que la persona deje de escribir antes de reescribir la URL. */
const URL_SYNC_DELAY_MS = 400;

interface SavedCatalogState {
  page?:          number;
  query?:         string;
  scrollY?:       number;
  filter?:        string;
  search?:        string;
  selectedSizes?: string[];
  selectedFits?:  FitType[];
  sort?:          SortKey;
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
  // /catalogo/<slug> es la URL de cada categoría; ?filter= queda por links viejos.
  const { slug: slugParam } = useParams();
  const filter         = slugParam ?? searchParams.get(PARAM.FILTER) ?? "";

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
    const list = fromUrl
      ? fromUrl.split(",").map((size) => size.trim()).filter(Boolean)
      : savedState?.selectedSizes ?? [];
    return [...new Set(list.map(normalizeSize))];
  });
  const [selectedFits, setSelectedFits] = useState<FitType[]>(() => {
    const fromUrl = searchParams.get(PARAM.VERSION);
    const list = fromUrl ? fromUrl.split(",") : savedState?.selectedFits ?? [];
    return list.map((fit) => fit.trim().toLowerCase()).filter(isFitType);
  });
  const [sort, setSort] = useState<SortKey>(() => {
    const fromUrl = searchParams.get(PARAM.SORT);
    return isSortKey(fromUrl) ? fromUrl : savedState?.sort ?? "recomendado";
  });
  const [page, setPage]                   = useState<number>(savedState?.page ?? 1);

  // Desktop dropdown
  const [sizeDropdownOpen, setSizeDropdownOpen] = useState(false);
  const sizeDropdownRef = useRef<HTMLDivElement>(null);

  // Mobile filter modal
  const [modalOpen,      setModalOpen]      = useState(false);
  const [pendingSearch,  setPendingSearch]  = useState("");
  const [pendingSizes,   setPendingSizes]   = useState<string[]>([]);
  const [pendingFits,    setPendingFits]    = useState<FitType[]>([]);
  const [pendingSort,    setPendingSort]    = useState<SortKey>("recomendado");

  // Track previous values to detect real changes (avoids StrictMode false resets)
  const prevFilterRef  = useRef(filter);
  const prevSearchRef  = useRef(search);
  const prevSizesRef   = useRef(selectedSizes);
  const prevFitsRef    = useRef(selectedFits);
  const prevSortRef    = useRef(sort);

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
    setSelectedFits([]);
    setSizeDropdownOpen(false);
    setModalOpen(false);
    setPage(1);
  }, [filter]);

  // Volver a la página 1 solo cuando cambia de verdad algún filtro o el orden
  useEffect(() => {
    const sizesChanged = JSON.stringify(prevSizesRef.current) !== JSON.stringify(selectedSizes);
    const fitsChanged  = JSON.stringify(prevFitsRef.current)  !== JSON.stringify(selectedFits);
    if (prevSearchRef.current === search && !sizesChanged && !fitsChanged && prevSortRef.current === sort) return;
    prevSearchRef.current = search;
    prevSizesRef.current  = selectedSizes;
    prevFitsRef.current   = selectedFits;
    prevSortRef.current   = sort;
    setPage(1);
  }, [search, selectedSizes, selectedFits, sort]);

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

      if (selectedFits.length) next.set(PARAM.VERSION, selectedFits.join(","));
      else                     next.delete(PARAM.VERSION);

      if (sort !== "recomendado") next.set(PARAM.SORT, sort);
      else                        next.delete(PARAM.SORT);

      if (next.toString() !== window.location.search.replace(/^\?/, "")) {
        setSearchParams(next, { replace: true });
      }
    }, URL_SYNC_DELAY_MS);

    return () => clearTimeout(timer);
  }, [search, selectedSizes, selectedFits, sort, setSearchParams]);

  // Lock body scroll when modal is open
  useEffect(() => {
    document.body.style.overflow = modalOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [modalOpen]);

  const { data: products = [], isLoading, isError } = useCatalogProducts();

  const maxDiscountPercent = useMemo(
    () => products.reduce((max, p) => (p.is_active && p.discount_percentage > max ? p.discount_percentage : max), 0),
    [products]
  );

  // Step 1: apply sidebar category / special filter
  const byCategory = useMemo(() => {
    // El admin ve lo mismo que el cliente más lo oculto; lo archivado y lo
    // agotado hace más de 3 meses solo aparece en "Archivo".
    const listed = products.filter((p) => p.is_listed && (p.is_active || isAdmin));
    if (filter === "archivo")    return products.filter((p) => isAdmin && (p.is_archived || p.is_stale));
    if (filter === "oculto")     return products.filter((p) => !p.is_active && !p.is_archived);
    if (!filter) return listed;
    if (filter === "nuevo")      return listed.filter((p) => p.is_new);
    if (filter === "descuentos") return listed.filter((p) => p.discount_percentage > 0);
    return listed.filter((p) => p.categories.some((c) => c.slug === filter));
  }, [products, filter, isAdmin]);

  // Step 2: tallas con stock en lo que dejó la categoría, sin duplicados
  // ("2XL" = "XXL") y de menor a mayor.
  const availableSizes = useMemo(
    () => [...new Set(byCategory.flatMap((p) => p.sizes.map(normalizeSize)))].sort(compareSizes),
    [byCategory]
  );

  // Versiones (Player / Fan / Retro) presentes, con cuántas piezas hay de cada una.
  const fitCounts = useMemo(() => {
    const counts: Partial<Record<FitType, number>> = {};
    for (const p of byCategory) if (p.fit_type) counts[p.fit_type] = (counts[p.fit_type] ?? 0) + 1;
    return counts;
  }, [byCategory]);
  const availableFits = FIT_TYPES.filter((fit) => (fitCounts[fit] ?? 0) > 0);
  const inFootball    = filter === "futbol";

  // Tallas por grupo. "Talla Única" y "Ajustable" no se ofrecen: le quedan a
  // cualquiera y solo agregan ruido (en Gorras eran el único filtro).
  const sizeGroups = useMemo(() => {
    const groups: { group: SizeGroup; sizes: string[] }[] = [];
    for (const group of ["ropa", "calzado"] as SizeGroup[]) {
      const sizes = availableSizes.filter((size) => sizeGroup(size) === group);
      if (sizes.length) groups.push({ group, sizes });
    }
    return groups;
  }, [availableSizes]);
  const sizeFilterCount = sizeGroups.reduce((n, g) => n + g.sizes.length, 0);

  /** Cuántas piezas quedarían al tocar esa talla / versión, con lo demás igual. */
  function countWith(filters: LocalFilters) {
    return applyLocalFilters(byCategory, filters).length;
  }

  // Step 3: búsqueda, tallas y versión sobre la categoría; después el orden
  const filtered = useMemo(
    () => sortProducts(applyLocalFilters(byCategory, { search, sizes: selectedSizes, fits: selectedFits }), sort),
    [byCategory, search, selectedSizes, selectedFits, sort]
  );

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);

  // Paginación compacta en pantallas angostas (iPhone SE: 7 botones de 40px no entran).
  const [compactPager, setCompactPager] = useState(() => window.matchMedia("(max-width: 639px)").matches);
  useEffect(() => {
    const media = window.matchMedia("(max-width: 639px)");
    const onChange = (e: MediaQueryListEvent) => setCompactPager(e.matches);
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, []);
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
  const previewCount = useMemo(
    () => applyLocalFilters(byCategory, { search: pendingSearch, sizes: pendingSizes, fits: pendingFits }).length,
    [byCategory, pendingSearch, pendingSizes, pendingFits]
  );

  const filterLabel = useMemo(() => {
    if (!filter) return null;
    if (filter === "nuevo")      return "Nuevo";
    if (filter === "descuentos") return "Descuentos";
    if (filter === "oculto")     return "Ocultos";
    if (filter === "archivo")    return "Archivo";
    const cat = products.flatMap((p) => p.categories).find((c) => c.slug === filter);
    return cat?.name ?? filter;
  }, [filter, products]);

  const hasLocalFilter = Boolean(search.trim() || selectedSizes.length > 0 || selectedFits.length > 0);
  const activeFilterCount = (search.trim() ? 1 : 0) + selectedSizes.length + selectedFits.length
    + (sort !== "recomendado" ? 1 : 0);

  function clearLocalFilters() {
    setSearch("");
    setSelectedSizes([]);
    setSelectedFits([]);
  }

  // Chips de lo que está aplicado: en celular los filtros viven en una hoja
  // que se cierra, y sin esto no se ve por qué la grilla muestra menos piezas.
  const activeChips: { key: string; label: string; onRemove: () => void }[] = [
    ...(search.trim() ? [{ key: "q", label: `“${search.trim()}”`, onRemove: () => setSearch("") }] : []),
    ...selectedFits.map((fit) => ({
      key: `fit-${fit}`, label: FIT_INFO[fit].label,
      onRemove: () => setSelectedFits((prev) => prev.filter((f) => f !== fit)),
    })),
    ...selectedSizes.map((size) => ({
      key: `size-${size}`, label: `Talla ${size}`,
      onRemove: () => setSelectedSizes((prev) => prev.filter((s) => s !== size)),
    })),
    ...(sort !== "recomendado" ? [{
      key: "sort", label: SORT_OPTIONS.find((o) => o.key === sort)!.label, onRemove: () => setSort("recomendado"),
    }] : []),
  ];

  function toggleFit(list: FitType[], fit: FitType): FitType[] {
    return list.includes(fit) ? list.filter((f) => f !== fit) : [...list, fit];
  }

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

  // El canonical deja fuera `q` y `tallas`: son infinitas combinaciones de la
  // misma grilla y Google las tomaría como páginas duplicadas. Una categoría
  // (`?filter=`) sí es contenido propio y se apunta a sí misma.
  const copy = filterLabel && filter !== "oculto" && filter !== "archivo" ? categoryCopy(filter, filterLabel) : null;

  useSeo({
    title: copy ? copy.title : "Catálogo de streetwear y camisetas de fútbol",
    description: copy
      ? copy.intro
      : "Todo el catálogo de Dropping CR: streetwear, vintage, camisetas de fútbol, " +
        "sneakers y accesorios. Envíos a todo Costa Rica.",
    path: filter ? ROUTES.catalogFilter(filter) : ROUTES.CATALOG,
    // Una búsqueda sin resultados no aporta nada a un índice.
    noindex: filtered.length === 0,
    jsonLd: breadcrumbJsonLd([
      { name: "Inicio",   path: ROUTES.HOME },
      { name: "Catálogo", path: ROUTES.CATALOG },
      ...(filterLabel ? [{ name: filterLabel, path: ROUTES.catalogFilter(filter) }] : []),
    ]),
  });

  function openModal() {
    setPendingSearch(search);
    setPendingSizes(selectedSizes);
    setPendingFits(selectedFits);
    setPendingSort(sort);
    setModalOpen(true);
  }

  function applyModal() {
    setSearch(pendingSearch);
    setSelectedSizes(pendingSizes);
    setSelectedFits(pendingFits);
    setSort(pendingSort);
    setModalOpen(false);
  }

  function clearModal() {
    setPendingSearch("");
    setPendingSizes([]);
    setPendingFits([]);
    setPendingSort("recomendado");
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
            {copy && <p className="text-[13px] leading-relaxed text-ink-500 max-w-[52ch]">{copy.intro}</p>}
            {filter === "archivo" && (
              <p className="text-[13px] leading-relaxed text-ink-500 max-w-[52ch]">
                Lo archivado (eliminado con ventas) y lo agotado hace más de 3 meses. Los clientes no lo ven en el
                catálogo. Si le volvés a poner stock, reaparece solo; lo archivado se restaura desde su edición.
              </p>
            )}
          </div>

          {!isLoading && (
            <p className="hidden sm:block shrink-0 pb-2 text-[12px] tnum text-ink-400">
              {filtered.length} {filtered.length === 1 ? "pieza" : "piezas"}
            </p>
          )}
        </div>

        {/* ── Desktop: búsqueda + tallas ───────────────────────────── */}
        {!isLoading && products.length > 0 && (
          // En tablet la búsqueda va en su propia fila: con versión, talla, orden
          // y compartir al lado quedaba de 80px.
          <div className="hidden md:flex flex-wrap lg:flex-nowrap items-stretch gap-3 mb-10">
            <div className="relative flex-1 basis-full lg:basis-0 min-w-0">
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

            {availableFits.length > 0 && (
              <div className="shrink-0 flex items-center gap-1 rounded-btn border border-ink-200 p-1" role="group" aria-label="Versión de camiseta de fútbol">
                {/* Fuera de Fútbol se aclara a qué aplica */}
                {!inFootball && (
                  <span className="pl-2.5 pr-1 text-[10px] font-display uppercase tracking-widest2 text-ink-300">Fútbol</span>
                )}
                {availableFits.map((fit) => {
                  const active = selectedFits.includes(fit);
                  const n = countWith({ search, sizes: selectedSizes, fits: [fit] });
                  return (
                    <button
                      key={fit}
                      type="button"
                      onClick={() => setSelectedFits((prev) => toggleFit(prev, fit))}
                      aria-pressed={active}
                      disabled={n === 0 && !active}
                      title={`${FIT_INFO[fit].cut} · ${n} ${n === 1 ? "pieza" : "piezas"}`}
                      className={cn(
                        "h-full px-3.5 rounded-chip text-[11px] font-display uppercase tracking-widest2 transition-colors",
                        active ? "bg-ink-900 text-bone" : "text-ink-500 hover:text-ink-900 disabled:text-ink-200 disabled:cursor-not-allowed"
                      )}
                    >
                      {FIT_INFO[fit].label}
                    </button>
                  );
                })}
              </div>
            )}

            {sizeFilterCount > 1 && (
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
                                 p-2 z-20 w-[220px] shadow-lift"
                    >
                      <SizeFilter
                        compact
                        groups={sizeGroups}
                        selected={selectedSizes}
                        onToggle={(size) => setSelectedSizes((prev) =>
                          prev.includes(size) ? prev.filter((s) => s !== size) : [...prev, size]
                        )}
                        count={(size) => countWith({ search, sizes: [size], fits: selectedFits })}
                      />
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}

            <label className="relative shrink-0">
              <span className="sr-only">Ordenar</span>
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value as SortKey)}
                className={cn(
                  "h-12 appearance-none rounded-btn border bg-transparent pl-5 pr-10 text-[12px] font-display uppercase tracking-widest2 outline-none cursor-pointer transition-colors",
                  sort !== "recomendado" ? "border-ink-900 text-ink-900" : "border-ink-200 text-ink-500 hover:border-ink-900 hover:text-ink-900"
                )}
              >
                {SORT_OPTIONS.map((option) => <option key={option.key} value={option.key}>{option.label}</option>)}
              </select>
              <ChevronDown size={14} className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-ink-400" />
            </label>

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

        {/* ── Filtros aplicados ────────────────────────────────────── */}
        <AnimatePresence initial={false}>
          {!isLoading && activeChips.length > 0 && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
              className="overflow-hidden md:-mt-5"
            >
              <div className="flex flex-wrap items-center gap-1.5 pt-0.5 pb-6">
                <span className="text-[12px] tnum text-ink-400 mr-1.5 sm:hidden">
                  {filtered.length} {filtered.length === 1 ? "pieza" : "piezas"}
                </span>
                <AnimatePresence initial={false} mode="popLayout">
                  {activeChips.map((chip) => (
                    <motion.button
                      key={chip.key}
                      layout
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.9 }}
                      transition={{ duration: 0.2 }}
                      type="button"
                      onClick={chip.onRemove}
                      aria-label={`Quitar ${chip.label}`}
                      className="flex items-center gap-1.5 h-8 pl-3 pr-2 rounded-full border border-ink-200 bg-white/60
                                 text-[12px] text-ink-900 hover:border-ink-900 transition-colors max-w-[60vw]"
                    >
                      <span className="truncate">{chip.label}</span>
                      <X size={12} className="shrink-0 text-ink-400" />
                    </motion.button>
                  ))}
                </AnimatePresence>
                {activeChips.length > 1 && (
                  <button
                    type="button"
                    onClick={() => { clearLocalFilters(); setSort("recomendado"); }}
                    className="ml-1 link-underline font-display uppercase text-[10px] tracking-widest2 text-ink-500"
                  >
                    Limpiar todo
                  </button>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

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
                      page, scrollY: window.scrollY, filter, search, selectedSizes, selectedFits, sort,
                      // La query entera: al volver hay que reponer también
                      // búsqueda y tallas, no solo la categoría.
                      query: window.location.search,
                    }));
                  }}
                  href={ROUTES.PRODUCT(product.slug)}
                  sizes={product.sizes}
                fit={product.fit_type}
                  isHidden={isAdmin && (!product.is_active || !product.is_listed)}
                  hiddenLabel={product.is_archived ? "Archivado" : product.is_stale ? "Agotado +3 meses" : "Oculto"}
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
                className="flex items-center justify-center w-9 h-9 sm:w-10 sm:h-10 rounded-btn border border-ink-200 text-ink-500
                           hover:border-ink-900 hover:text-ink-900 transition-colors
                           disabled:opacity-25 disabled:cursor-not-allowed disabled:hover:border-ink-200"
              >
                <ChevronLeft size={16} />
              </button>

              {getPageItems(page, totalPages, compactPager).map((item, idx) =>
                item === "…" ? (
                  <span
                    key={`ellipsis-${idx}`}
                    className="w-9 h-9 sm:w-10 sm:h-10 flex items-center justify-center text-[13px] text-ink-300 select-none"
                  >
                    …
                  </span>
                ) : (
                  <button
                    key={item}
                    onClick={() => { scrollToGridRef.current = true; setPage(item); }}
                    className={cn(
                      "w-9 h-9 sm:w-10 sm:h-10 rounded-btn text-[13px] tnum border transition-colors",
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
                className="flex items-center justify-center w-9 h-9 sm:w-10 sm:h-10 rounded-btn border border-ink-200 text-ink-500
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
                onClick={clearLocalFilters}
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

      <FloatingWhatsApp message="Hola! Estoy viendo el catálogo y tengo una consulta 👋" />

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
                         shadow-sheet flex flex-col max-h-[88dvh]"
            >
              {/* Encabezado fijo */}
              <div className="flex flex-col items-center gap-4 px-5 pt-4 pb-4 shrink-0">
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
                    {(pendingSearch || pendingSizes.length > 0 || pendingFits.length > 0 || pendingSort !== "recomendado") && (
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

              {/* Solo el contenido scrollea: el botón de aplicar queda siempre a la vista */}
              <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-5 pb-5 flex flex-col gap-6">
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

              {availableFits.length > 0 && (
                <div className="flex flex-col gap-2.5">
                  <p className="type-eyebrow text-ink-400">
                    {inFootball ? "Versión" : "Camisetas de fútbol"}
                  </p>
                  <FitFilter
                    fits={availableFits}
                    selected={pendingFits}
                    onToggle={(fit) => setPendingFits((prev) => toggleFit(prev, fit))}
                    count={(fit) => countWith({ search: pendingSearch, sizes: pendingSizes, fits: [fit] })}
                  />
                  <AnimatePresence initial={false}>
                    {pendingFits.length === 1 && (
                      <motion.p
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        className="text-[11.5px] text-ink-500 overflow-hidden"
                      >
                        {FIT_INFO[pendingFits[0]].label}: pedí {FIT_INFO[pendingFits[0]].sizeUp === 1 ? "una talla" : "dos tallas"} más
                        de la que usás normalmente.
                      </motion.p>
                    )}
                  </AnimatePresence>
                </div>
              )}

              {sizeFilterCount > 1 && (
                <div className="flex flex-col gap-2.5">
                  <p className="type-eyebrow text-ink-400">Talla</p>
                  <SizeFilter
                    groups={sizeGroups}
                    selected={pendingSizes}
                    onToggle={(size) => setPendingSizes((prev) =>
                      prev.includes(size) ? prev.filter((s) => s !== size) : [...prev, size]
                    )}
                    count={(size) => countWith({ search: pendingSearch, sizes: [size], fits: pendingFits })}
                  />
                </div>
              )}

              <div className="flex flex-col gap-2.5">
                <p className="type-eyebrow text-ink-400">Ordenar</p>
                <div className="grid grid-cols-3 gap-2">
                  {SORT_OPTIONS.map((option) => (
                    <button
                      key={option.key}
                      type="button"
                      onClick={() => setPendingSort(option.key)}
                      aria-pressed={pendingSort === option.key}
                      className={cn(
                        "rounded-btn py-3 border text-[12px] leading-tight transition-colors",
                        pendingSort === option.key ? "bg-ink-900 border-ink-900 text-bone" : "border-ink-200 text-ink-600"
                      )}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>

              </div>

              <div className="shrink-0 px-5 pt-3 pb-[max(1.5rem,env(safe-area-inset-bottom))] border-t border-ink-100">
                <motion.button
                  type="button"
                  onClick={applyModal}
                  whileTap={{ scale: 0.98 }}
                  disabled={previewCount === 0}
                  className="btn-ink w-full"
                >
                  {previewCount === 0
                    ? "Sin resultados"
                    : `Ver ${previewCount} ${previewCount === 1 ? "pieza" : "piezas"}`}
                </motion.button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
