import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Menu, User, ShoppingBag } from "lucide-react";
import { useNavigate, useLocation } from "react-router-dom";
import { motion, useScroll, useMotionValueEvent } from "framer-motion";
import { useAuth } from "../../context/AuthContext";
import { useCart } from "../../context/CartContext";
import { useToast } from "./Toast";
import { t } from "../../lib/i18n";
import { cn } from "../../lib/utils";
import { getProducts, type CatalogProduct } from "../../services/productService";
import { QUERY_KEYS } from "../../constants/queryKeys";
import { ROUTES, MARQUEE_ITEMS } from "../../constants/app";
import Logo from "./Logo";
import Marquee from "./Marquee";
import Sidebar from "./Sidebar";
import UserSidebar from "./UserSidebar";
import AuthModal from "./AuthModal";

function getInitials(firstName: string | null, lastName: string | null) {
  return `${firstName?.[0] ?? ""}${lastName?.[0] ?? ""}`.toUpperCase();
}

/** `show` decide si el link aparece: un filtro sin resultados es una página vacía. */
const navLinks = [
  { label: "Catálogo",   href: ROUTES.CATALOG,                       show: () => true },
  { label: "Nuevo",      href: ROUTES.catalogFilter("nuevo"),        show: (p: CatalogProduct[]) => p.some((x) => x.is_new) },
  { label: "Descuentos", href: ROUTES.catalogFilter("descuentos"),   show: (p: CatalogProduct[]) => p.some((x) => x.discount_percentage > 0) },
];

interface HeaderProps {
  /**
   * El header arranca transparente sobre el hero de la home y se vuelve
   * sólido al hacer scroll. En el resto de páginas siempre es sólido.
   */
  overlay?: boolean;
}

export default function Header({ overlay = false }: HeaderProps) {
  const { user, signOut } = useAuth();
  const isAdmin           = user?.role === "admin";
  const { itemCount }     = useCart();
  const navigate          = useNavigate();
  const location          = useLocation();
  const { showToast }     = useToast();

  // Se sirve de la caché que ya llenaron el catálogo y el sidebar
  const { data: products = [] } = useQuery({
    queryKey: [...QUERY_KEYS.PRODUCTS, isAdmin],
    queryFn:  () => getProducts(isAdmin),
  });

  const [sidebarOpen, setSidebarOpen]         = useState(false);
  const [userSidebarOpen, setUserSidebarOpen] = useState(false);
  const [authModalOpen, setAuthModalOpen]     = useState(false);

  const [scrolled, setScrolled] = useState(false);
  const [hidden,   setHidden]   = useState(false);

  const { scrollY } = useScroll();
  useMotionValueEvent(scrollY, "change", (y) => {
    const prev = scrollY.getPrevious() ?? 0;
    setScrolled(y > 40);
    // Se esconde al bajar (más área para el producto) y reaparece al subir.
    setHidden(y > 160 && y > prev);
  });

  const solid = !overlay || scrolled;

  function handleUserClick() {
    if (user) setUserSidebarOpen(true);
    else      setAuthModalOpen(true);
  }

  function isActive(href: string) {
    return location.pathname + location.search === href;
  }

  return (
    <>
      {/* La cinta solo vive en el tope del documento, no en el header sticky:
          así no roba altura permanente a la ventana. */}
      {!overlay && <Marquee items={[...MARQUEE_ITEMS]} />}

      <motion.header
        className={cn(
          "sticky top-0 z-30 w-full transition-colors duration-500",
          solid
            ? "bg-bone/85 backdrop-blur-xl border-b border-ink-100 text-ink-900"
            : "bg-transparent border-b border-transparent text-bone"
        )}
        animate={{ y: hidden ? "-100%" : 0 }}
        transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      >
        <div className="relative flex items-center h-14 px-4 sm:px-6 max-w-[1600px] mx-auto">

          {/* ── Izquierda: menú + nav desktop ───────────────────────── */}
          <div className="flex items-center gap-7 flex-1">
            <button
              onClick={() => setSidebarOpen(true)}
              className="hover:opacity-60 transition-opacity"
              aria-label="Abrir menú"
            >
              <Menu size={20} strokeWidth={1.6} />
            </button>

            <nav className="hidden md:flex items-center gap-7">
              {navLinks.filter(({ show }) => show(products)).map(({ label, href }) => (
                <button
                  key={label}
                  onClick={() => navigate(href)}
                  className={cn(
                    "link-underline font-display uppercase text-[11px] tracking-widest2 leading-none",
                    isActive(href) ? "opacity-100 after:scale-x-100" : "opacity-70 hover:opacity-100"
                  )}
                >
                  {label}
                </button>
              ))}
            </nav>
          </div>

          {/* ── Centro: logo ─────────────────────────────────────────── */}
          <button
            onClick={() => navigate(ROUTES.HOME)}
            aria-label="Dropping CR — inicio"
            className="absolute left-1/2 -translate-x-1/2 hover:opacity-70 transition-opacity"
          >
            <Logo compact className="h-[21px] sm:h-[23px] w-auto" />
          </button>

          {/* ── Derecha: carrito + cuenta ────────────────────────────── */}
          <div className="flex items-center justify-end gap-4 sm:gap-5 flex-1">
            <button
              onClick={() => navigate(ROUTES.CART)}
              className="relative hover:opacity-60 transition-opacity"
              aria-label="Ver carrito"
            >
              <ShoppingBag size={19} strokeWidth={1.6} />
              {itemCount > 0 && (
                <span
                  className={cn(
                    "absolute -top-1.5 -right-2 min-w-[16px] h-[16px] px-1 text-[9px] font-semibold tnum",
                    "flex items-center justify-center leading-none rounded-full",
                    solid ? "bg-ink-900 text-bone" : "bg-bone text-ink-900"
                  )}
                >
                  {itemCount > 99 ? "99+" : itemCount}
                </span>
              )}
            </button>

            <button
              onClick={handleUserClick}
              className="hover:opacity-60 transition-opacity"
              aria-label="Cuenta de usuario"
            >
              {user ? (
                <span
                  className={cn(
                    "w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-semibold tracking-wide",
                    solid ? "bg-ink-900 text-bone" : "bg-bone text-ink-900"
                  )}
                >
                  {getInitials(user.first_name, user.last_name)}
                </span>
              ) : (
                <User size={19} strokeWidth={1.6} />
              )}
            </button>
          </div>
        </div>
      </motion.header>

      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <UserSidebar
        open={userSidebarOpen}
        onClose={() => setUserSidebarOpen(false)}
        user={user ? { name: [user.first_name, user.last_name].filter(Boolean).join(" ") || user.email, email: user.email, role: user.role } : null}
        onLogout={async () => { await signOut(); setUserSidebarOpen(false); showToast(t.toast.sessionClosed, "error"); }}
      />

      <AuthModal open={authModalOpen} onClose={() => setAuthModalOpen(false)} />
    </>
  );
}
