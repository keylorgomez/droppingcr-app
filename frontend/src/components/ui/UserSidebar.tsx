import { motion, AnimatePresence } from "framer-motion";
import { X, User, ShoppingBag, LogOut, LayoutDashboard, Package } from "lucide-react";
import { useNavigate } from "react-router-dom";
import type { UserRole } from "../../context/AuthContext";

interface SidebarUser {
  name: string;
  email: string;
  role: UserRole;
}

interface UserSidebarProps {
  open: boolean;
  onClose: () => void;
  user: SidebarUser | null;
  onLogout: () => void;
}

function getInitials(name: string): string {
  return name.trim().split(" ").slice(0, 2).map((w) => w[0].toUpperCase()).join("");
}

const customerLinks = [
  { label: "Mi perfil",   icon: User,            href: "/profile" },
  { label: "Mis pedidos", icon: ShoppingBag,     href: null },
];

const adminLinks = [
  { label: "Panel Admin",  icon: LayoutDashboard, href: null },
  { label: "Productos",    icon: Package,         href: "/admin/products/new" },
  { label: "Mi perfil",   icon: User,            href: "/profile" },
  { label: "Mis pedidos", icon: ShoppingBag,     href: null },
];

export default function UserSidebar({ open, onClose, user, onLogout }: UserSidebarProps) {
  const navigate = useNavigate();
  const links = user?.role === "admin" ? adminLinks : customerLinks;

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
            className="fixed top-0 right-0 h-full w-72 bg-white z-50 flex flex-col shadow-xl"
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", stiffness: 320, damping: 32 }}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-5 border-b border-gray-100">
              <span className="font-poppins font-semibold italic text-brand-primary text-base leading-none">
                Mi cuenta
              </span>
              <button onClick={onClose} className="text-gray-400 hover:text-brand-primary transition-colors" aria-label="Cerrar">
                <X size={20} />
              </button>
            </div>

            {user && (
              <div className="flex flex-col flex-1 px-4 py-6 gap-2 overflow-y-auto min-h-0">
                {/* Avatar + info */}
                <div className="flex items-center gap-3 px-2 pb-5 border-b border-gray-100">
                  <div className="w-11 h-11 rounded-full bg-brand-primary flex items-center justify-center
                                  text-white font-poppins font-semibold text-sm shrink-0">
                    {getInitials(user.name)}
                  </div>
                  <div className="min-w-0">
                    <p className="font-poppins font-semibold text-sm text-brand-dark truncate">{user.name}</p>
                    <p className="font-poppins text-xs text-gray-400 truncate">{user.email}</p>
                    {user.role === "admin" && (
                      <span className="inline-block mt-1 text-[10px] font-bold uppercase tracking-wider
                                       bg-brand-accent/10 text-brand-accent px-2 py-0.5 rounded-full">
                        Admin
                      </span>
                    )}
                  </div>
                </div>

                {/* Role-based nav */}
                <nav className="flex flex-col gap-1 pt-2">
                  {links.map(({ label, icon: Icon, href }) => (
                    <button
                      key={label}
                      onClick={() => {
                        if (href) { onClose(); navigate(href); }
                      }}
                      disabled={!href}
                      className="flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-poppins
                                 text-brand-dark hover:bg-brand-bg hover:text-brand-primary
                                 transition-colors text-left w-full
                                 disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <Icon size={17} strokeWidth={1.8} className="text-brand-accent" />
                      {label}
                    </button>
                  ))}
                </nav>

                {/* Logout */}
                <div className="mt-auto pt-4 border-t border-gray-100">
                  <button
                    onClick={onLogout}
                    className="flex items-center gap-3 px-3 py-3 w-full rounded-xl text-sm
                               font-poppins text-red-500 hover:bg-red-50 transition-colors"
                  >
                    <LogOut size={17} strokeWidth={1.8} />
                    Cerrar sesión
                  </button>
                </div>
              </div>
            )}
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
