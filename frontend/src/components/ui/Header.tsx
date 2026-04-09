import { useState } from "react";
import { Menu, User } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import Sidebar from "./Sidebar";
import UserSidebar from "./UserSidebar";
import AuthModal from "./AuthModal";
import TypewriterBanner from "./TypewriterBanner";

function getInitials(firstName: string, lastName: string) {
  return `${firstName[0] ?? ""}${lastName[0] ?? ""}`.toUpperCase();
}

export default function Header() {
  const { user, signOut } = useAuth();

  const [sidebarOpen, setSidebarOpen]       = useState(false);
  const [userSidebarOpen, setUserSidebarOpen] = useState(false);
  const [authModalOpen, setAuthModalOpen]   = useState(false);

  function handleUserClick() {
    if (user) {
      setUserSidebarOpen(true);
    } else {
      setAuthModalOpen(true);
    }
  }

  return (
    <>
      <header className="sticky top-0 z-30 w-full bg-white border-b border-gray-100">
        <TypewriterBanner />

        <div className="relative flex items-center justify-center h-16 px-4 max-w-7xl mx-auto">

          {/* Menu — left */}
          <button
            onClick={() => setSidebarOpen(true)}
            className="absolute left-4 text-brand-dark hover:text-brand-primary transition-colors"
            aria-label="Abrir menú"
          >
            <Menu size={22} strokeWidth={1.8} />
          </button>

          {/* Logo */}
          <a href="/" className="flex flex-col items-center leading-none select-none gap-0.5">
            {/* Desktop */}
            <span className="hidden sm:block font-poppins font-semibold italic text-brand-primary text-2xl tracking-tight">
              Dropping
            </span>
            <span className="hidden sm:block font-poppins font-medium text-brand-primary text-sm tracking-tight uppercase">
              CR
            </span>
            {/* Mobile */}
            <span className="sm:hidden font-poppins font-semibold italic text-brand-primary text-xl tracking-tight">
              Dropping{" "}
              <span className="font-medium not-italic tracking-tight text-base">CR</span>
            </span>
          </a>

          {/* User — right */}
          <button
            onClick={handleUserClick}
            className="absolute right-4 text-brand-dark hover:text-brand-primary transition-colors"
            aria-label="Cuenta de usuario"
          >
            {user ? (
              <div className="w-8 h-8 rounded-full bg-brand-primary flex items-center justify-center
                              text-white font-poppins font-semibold text-xs">
                {getInitials(user.first_name, user.last_name)}
              </div>
            ) : (
              <User size={22} strokeWidth={1.8} />
            )}
          </button>

        </div>
      </header>

      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <UserSidebar
        open={userSidebarOpen}
        onClose={() => setUserSidebarOpen(false)}
        user={user ? { name: [user.first_name, user.last_name].filter(Boolean).join(" ") || user.email, email: user.email, role: user.role } : null}
        onLogout={async () => { await signOut(); setUserSidebarOpen(false); }}
      />

      <AuthModal open={authModalOpen} onClose={() => setAuthModalOpen(false)} />
    </>
  );
}
