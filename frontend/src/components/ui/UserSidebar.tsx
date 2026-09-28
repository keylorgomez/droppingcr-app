import { motion, AnimatePresence } from "framer-motion";
import { X, User, ShoppingBag, LogOut, LayoutDashboard, Package, ClipboardList, CreditCard } from "lucide-react";
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
  const words = name.trim().split(" ").filter(Boolean);
  if (!words.length) return "?";
  return words.slice(0, 2).map((w) => w[0].toUpperCase()).join("");
}

const customerLinks = [
  { label: "Mi perfil",   icon: User,            href: "/profile"    },
  { label: "Mis pedidos", icon: ShoppingBag,     href: "/my-orders"  },
];

const adminLinks = [
  { label: "Panel Admin",  icon: LayoutDashboard, href: "/admin/dashboard"    },
  { label: "Productos",    icon: Package,         href: "/admin/products/new" },
  { label: "Pedidos",      icon: ClipboardList,   href: "/admin/pedidos"      },
  { label: "Cobros",       icon: CreditCard,      href: "/admin/deudas"       },
  { label: "Mi perfil",   icon: User,            href: "/profile"            },
  { label: "Mis pedidos", icon: ShoppingBag,     href: "/my-orders"          },
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
            className="fixed inset-0 bg-ink-950/40 backdrop-blur-[2px] z-40"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
          />

          {/* Panel */}
          <motion.aside
            className="fixed top-0 right-0 h-full w-[300px] max-w-[85vw] bg-ink-950 text-bone z-50 flex flex-col"
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", stiffness: 320, damping: 32 }}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 h-14 border-b border-bone/12 shrink-0">
              <span className="type-eyebrow text-bone">Mi cuenta</span>
              <button onClick={onClose} className="text-bone/50 hover:text-bone transition-colors" aria-label="Cerrar">
                <X size={19} strokeWidth={1.6} />
              </button>
            </div>

            {user && (
              <div className="flex flex-col flex-1 px-6 py-7 overflow-y-auto min-h-0 no-scrollbar">
                {/* Avatar + info */}
                <div className="flex items-center gap-3.5 pb-6 border-b border-bone/12">
                  <div className="w-11 h-11 rounded-full bg-bone text-ink-900 flex items-center
                                  justify-center font-semibold text-[13px] shrink-0">
                    {getInitials(user.name)}
                  </div>
                  <div className="min-w-0">
                    <p className="text-[13.5px] text-bone truncate">{user.name}</p>
                    <p className="text-[12px] text-bone/45 truncate">{user.email}</p>
                    {user.role === "admin" && (
                      <span className="inline-block mt-1.5 font-display uppercase text-[9px] tracking-widest2
                                       border border-bone/35 text-bone/70 px-1.5 py-1 leading-none">
                        Admin
                      </span>
                    )}
                  </div>
                </div>

                {/* Role-based nav */}
                <nav className="flex flex-col pt-6">
                  {links.map(({ label, icon: Icon, href }) => (
                    <button
                      key={label}
                      onClick={() => {
                        if (href) { onClose(); navigate(href); }
                      }}
                      disabled={!href}
                      className="flex items-center gap-3 py-3 text-[13.5px]
                                 text-bone/60 hover:text-bone transition-colors text-left w-full
                                 disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                      <Icon size={16} strokeWidth={1.6} className="shrink-0" />
                      {label}
                    </button>
                  ))}
                </nav>

                {/* Logout */}
                <div className="mt-auto pt-6 border-t border-bone/12">
                  <button
                    onClick={onLogout}
                    className="flex items-center gap-3 py-3 w-full text-[13.5px]
                               text-bone/60 hover:text-bone transition-colors"
                  >
                    <LogOut size={16} strokeWidth={1.6} />
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
