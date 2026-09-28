import { useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { X, Settings2, CreditCard, Receipt, Coins, ShoppingBag, Printer, LayoutDashboard, PackagePlus } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { getProducts } from "../../services/productService";
import { cn } from "../../lib/utils";
import { QUERY_KEYS } from "../../constants/queryKeys";
import { ROUTES } from "../../constants/app";
import Logo from "./Logo";

interface SidebarProps {
  open: boolean;
  onClose: () => void;
}

const adminLinks = [
  { label: "Dashboard",         icon: LayoutDashboard, href: "/admin/dashboard"    },
  { label: "Nuevo producto",    icon: PackagePlus,     href: "/admin/products/new" },
  { label: "Categorías",        icon: Settings2,       href: "/admin/categories"   },
  { label: "Cobros pendientes", icon: CreditCard,      href: "/admin/deudas"       },
  { label: "Movimientos",       icon: Receipt,         href: "/admin/movimientos"  },
  { label: "Ganancias",         icon: Coins,           href: "/admin/ganancias"    },
  { label: "Gastos",            icon: ShoppingBag,     href: "/admin/gastos"       },
  { label: "Etiquetas",         icon: Printer,         href: "/admin/etiquetas"    },
];

export default function Sidebar({ open, onClose }: SidebarProps) {
  const { user }       = useAuth();
  const isAdmin        = user?.role === "admin";
  const navigate       = useNavigate();
  const [searchParams] = useSearchParams();
  const activeFilter   = searchParams.get("filter") ?? "";

  // Reuse the cached products query — no extra network request
  const { data: products = [], isLoading } = useQuery({
    queryKey: [...QUERY_KEYS.PRODUCTS, isAdmin],
    queryFn:  () => getProducts(isAdmin),
  });

  const hasNew       = products.some((p) => p.is_new);
  const hasDiscounts = products.some((p) => p.discount_percentage > 0);
  const hasHidden    = products.some((p) => !p.is_active);

  // Unique categories present in at least one product, sorted alphabetically
  const categories = useMemo(() => {
    const seen = new Map<string, string>(); // slug → name
    for (const product of products) {
      for (const cat of product.categories) {
        if (!seen.has(cat.slug)) seen.set(cat.slug, cat.name);
      }
    }
    return [...seen.entries()]
      .map(([slug, name]) => ({ slug, name }))
      .sort((a, b) => a.name.localeCompare(b.name, "es"));
  }, [products]);

  function handleNav(href: string) {
    onClose();
    const url = new URL(href, window.location.origin);
    navigate(url.pathname + url.search);
  }

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            className="fixed inset-0 bg-ink-950/40 backdrop-blur-[2px] z-40"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            onClick={onClose}
          />

          <motion.aside
            className="fixed top-0 left-0 h-full w-[300px] max-w-[85vw] bg-ink-950 text-bone z-50 flex flex-col"
            initial={{ x: "-100%" }}
            animate={{ x: 0 }}
            exit={{ x: "-100%" }}
            transition={{ type: "spring", stiffness: 330, damping: 34 }}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 h-14 border-b border-bone/12 shrink-0">
              <button onClick={() => handleNav(ROUTES.HOME)} aria-label="Inicio">
                <Logo compact className="h-[17px] w-auto text-bone" />
              </button>
              <button
                onClick={onClose}
                className="text-bone/50 hover:text-bone transition-colors"
                aria-label="Cerrar menú"
              >
                <X size={19} strokeWidth={1.6} />
              </button>
            </div>

            <div className="flex flex-col flex-1 overflow-y-auto min-h-0 no-scrollbar">
              <nav className="flex flex-col px-6 pt-8">
                <NavLink
                  label="Todo el catálogo"
                  active={!activeFilter}
                  onClick={() => handleNav(ROUTES.CATALOG)}
                  large
                />

                {(isLoading || hasNew) && (
                  <NavLink
                    label="Nuevo"
                    active={activeFilter === "nuevo"}
                    onClick={() => handleNav(ROUTES.catalogFilter("nuevo"))}
                    loading={isLoading}
                    large
                  />
                )}

                {(isLoading || hasDiscounts) && (
                  <NavLink
                    label="Descuentos"
                    active={activeFilter === "descuentos"}
                    onClick={() => handleNav(ROUTES.catalogFilter("descuentos"))}
                    loading={isLoading}
                    large
                  />
                )}

                {isAdmin && (isLoading || hasHidden) && (
                  <NavLink
                    label="Ocultos"
                    active={activeFilter === "oculto"}
                    onClick={() => handleNav(ROUTES.catalogFilter("oculto"))}
                    loading={isLoading}
                    large
                    muted
                  />
                )}

                {(isLoading || categories.length > 0) && (
                  <p className="type-eyebrow text-bone/35 pt-9 pb-4">Categorías</p>
                )}

                {isLoading && [1, 2, 3].map((i) => (
                  <div key={i} className="h-7 my-1.5 bg-bone/10 animate-pulse" />
                ))}

                {!isLoading && categories.map((cat) => (
                  <NavLink
                    key={cat.slug}
                    label={cat.name}
                    active={activeFilter === cat.slug}
                    onClick={() => handleNav(ROUTES.catalogFilter(cat.slug))}
                  />
                ))}
              </nav>

              {isAdmin && (
                <div className="mt-auto px-6 pb-8 pt-10">
                  <div className="border-t border-bone/12 pt-6">
                    <p className="type-eyebrow text-bone/35 pb-4">Administración</p>
                    {adminLinks.map(({ label, icon: Icon, href }) => (
                      <button
                        key={label}
                        onClick={() => { onClose(); navigate(href); }}
                        className="w-full flex items-center gap-3 py-2.5 text-[13px] text-bone/60
                                   hover:text-bone transition-colors text-left"
                      >
                        <Icon size={15} strokeWidth={1.6} className="shrink-0" />
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}

// ── Nav link ───────────────────────────────────────────────────────────────

function NavLink({
  label, active, onClick, loading = false, large = false, muted = false,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  loading?: boolean;
  large?: boolean;
  muted?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={loading}
      className={cn(
        "group w-full flex items-center justify-between gap-3 text-left transition-colors",
        large
          ? "font-display uppercase tracking-display text-2xl leading-none py-2.5"
          : "text-[13.5px] py-2",
        active ? "text-bone" : muted ? "text-bone/35 hover:text-bone/70" : "text-bone/55 hover:text-bone"
      )}
    >
      <span className="truncate">{label}</span>
      <span
        className={cn(
          "h-px bg-current transition-all duration-300 ease-drop shrink-0",
          active ? "w-6 opacity-100" : "w-0 opacity-0 group-hover:w-4 group-hover:opacity-60"
        )}
      />
    </button>
  );
}
