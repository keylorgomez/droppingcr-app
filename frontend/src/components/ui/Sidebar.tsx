import { useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  X, LayoutGrid, Flame, BadgePercent, Tag, Settings2, CreditCard,
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { getProducts } from "../../services/productService";
import { cn } from "../../lib/utils";

interface SidebarProps {
  open: boolean;
  onClose: () => void;
}

const adminLinks = [
  { label: "Gestionar Categorías", icon: Settings2,  href: "/admin/categories" },
  { label: "Cobros Pendientes",    icon: CreditCard, href: "/admin/deudas" },
];

export default function Sidebar({ open, onClose }: SidebarProps) {
  const { user }       = useAuth();
  const navigate       = useNavigate();
  const [searchParams] = useSearchParams();
  const activeFilter   = searchParams.get("filter") ?? "";

  // Reuse the cached products query — no extra network request
  const { data: products = [], isLoading } = useQuery({
    queryKey: ["products"],
    queryFn:  getProducts,
  });

  const hasNew       = products.some((p) => p.is_new);
  const hasDiscounts = products.some((p) => p.discount_percentage > 0);

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
          {/* Backdrop */}
          <motion.div
            className="fixed inset-0 bg-black/30 z-40"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
          />

          {/* Panel */}
          <motion.aside
            className="fixed top-0 left-0 h-full w-64 bg-white z-50 flex flex-col shadow-xl"
            initial={{ x: "-100%" }}
            animate={{ x: 0 }}
            exit={{ x: "-100%" }}
            transition={{ type: "spring", stiffness: 320, damping: 32 }}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-5 border-b border-gray-100">
              <span className="font-poppins font-semibold italic text-brand-primary text-lg leading-none">
                Dropping
              </span>
              <button
                onClick={onClose}
                className="text-gray-400 hover:text-brand-primary transition-colors"
                aria-label="Cerrar menú"
              >
                <X size={20} />
              </button>
            </div>

            {/* Scrollable content */}
            <div className="flex flex-col flex-1 overflow-y-auto min-h-0">
              <nav className="flex flex-col gap-0.5 px-2 py-4">

                {/* Always: all products */}
                <NavLink
                  label="Catálogo"
                  icon={LayoutGrid}
                  active={!activeFilter}
                  onClick={() => handleNav("/")}
                />

                {/* Nuevo — only if at least one product is marked as new */}
                {(isLoading || hasNew) && (
                  <NavLink
                    label="Nuevo"
                    icon={Flame}
                    active={activeFilter === "nuevo"}
                    onClick={() => handleNav("/?filter=nuevo")}
                    loading={isLoading}
                  />
                )}

                {/* Descuentos — only if at least one product has a discount */}
                {(isLoading || hasDiscounts) && (
                  <NavLink
                    label="Descuentos"
                    icon={BadgePercent}
                    active={activeFilter === "descuentos"}
                    onClick={() => handleNav("/?filter=descuentos")}
                    loading={isLoading}
                  />
                )}

                {/* Categories section */}
                {(isLoading || categories.length > 0) && (
                  <p className="px-2 pt-5 pb-1 text-[10px] font-poppins text-gray-400
                                uppercase tracking-widest">
                    Categorías
                  </p>
                )}

                {isLoading && (
                  <>
                    {[1, 2, 3].map((i) => (
                      <div
                        key={i}
                        className="h-10 mx-0.5 my-0.5 rounded-xl bg-gray-100 animate-pulse"
                      />
                    ))}
                  </>
                )}

                {!isLoading && categories.map((cat) => (
                  <NavLink
                    key={cat.slug}
                    label={cat.name}
                    icon={Tag}
                    active={activeFilter === cat.slug}
                    onClick={() => handleNav(`/?filter=${cat.slug}`)}
                  />
                ))}
              </nav>

              {/* Admin section */}
              {user?.role === "admin" && (
                <div className="mt-auto px-2 pb-4">
                  <div className="border-t border-gray-100 pt-4">
                    <p className="px-2 mb-1 text-[10px] font-poppins text-gray-400
                                  uppercase tracking-widest">
                      Administración
                    </p>
                    {adminLinks.map(({ label, icon: Icon, href }) => (
                      <button
                        key={label}
                        onClick={() => { onClose(); navigate(href); }}
                        className="w-full flex items-center gap-3 px-2 py-3 rounded-xl text-sm
                                   font-poppins text-brand-dark hover:bg-brand-bg
                                   hover:text-brand-primary transition-colors text-left"
                      >
                        <Icon size={17} strokeWidth={1.8} className="text-brand-accent" />
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
  label, icon: Icon, active, onClick, loading = false,
}: {
  label: string;
  icon: React.ElementType;
  active: boolean;
  onClick: () => void;
  loading?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={loading}
      className={cn(
        "w-full flex items-center gap-3 px-2 py-3 rounded-xl text-sm font-poppins transition-colors text-left",
        active
          ? "bg-brand-bg text-brand-primary font-medium"
          : "text-brand-dark hover:bg-brand-bg hover:text-brand-primary"
      )}
    >
      <Icon
        size={17}
        strokeWidth={1.8}
        className={active ? "text-brand-primary" : "text-brand-accent"}
      />
      {label}
    </button>
  );
}
