import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import {
  X, Tag, Flame, LayoutGrid, Footprints, Shirt, Snowflake, Trophy,
  BadgePercent, Settings2, CreditCard,
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";

interface SidebarProps {
  open: boolean;
  onClose: () => void;
}

const navLinks = [
  { label: "Catálogo",      icon: LayoutGrid,   href: "/" },
  { label: "Descuentos",    icon: BadgePercent, href: "/?filter=descuentos" },
  { label: "Nuevo",         icon: Flame,        href: "/?filter=new" },
  { label: "Tenis",         icon: Footprints,   href: "/?filter=tenis" },
  { label: "Camisetas",     icon: Shirt,        href: "/?filter=camisetas" },
  { label: "Abrigos",       icon: Snowflake,    href: "/?filter=abrigos" },
  { label: "Accesorios",    icon: Tag,          href: "/?filter=accesorios" },
  { label: "Mundial 2026",  icon: Trophy,       href: "/?filter=mundial-2026" },
];

const adminLinks = [
  { label: "Gestionar Categorías", icon: Settings2,  href: "/admin/categories" },
  { label: "Cobros Pendientes",    icon: CreditCard, href: "/admin/deudas" },
];

export default function Sidebar({ open, onClose }: SidebarProps) {
  const { user } = useAuth();
  const navigate = useNavigate();

  function handleAdminNav(href: string) {
    onClose();
    navigate(href);
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
              {/* Main nav */}
              <nav className="flex flex-col gap-1 px-2 py-4">
                {navLinks.map(({ label, icon: Icon, href }) => (
                  <a
                    key={label}
                    href={href}
                    onClick={onClose}
                    className="flex items-center gap-3 px-2 py-3 rounded-xl text-sm font-poppins
                               text-brand-dark hover:bg-brand-bg hover:text-brand-primary transition-colors"
                  >
                    <Icon size={17} strokeWidth={1.8} className="text-brand-accent" />
                    {label}
                  </a>
                ))}
              </nav>

              {/* Admin section — visible only to admins */}
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
                        onClick={() => handleAdminNav(href)}
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
