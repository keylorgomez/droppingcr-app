import { Routes, Route, Navigate, useSearchParams } from "react-router-dom";
import { AnimatePresence } from "framer-motion";
import HomePage          from "./pages/HomePage";
import CatalogPage       from "./pages/CatalogPage";
import ProductDetailPage from "./pages/ProductDetailPage";
import ProfilePage       from "./pages/ProfilePage";
import MyOrdersPage      from "./pages/MyOrdersPage";
import CartPage          from "./pages/CartPage";
import ResetPasswordPage from "./pages/ResetPasswordPage";
import ProductFormPage   from "./pages/admin/ProductFormPage";
import EditProductPage   from "./pages/admin/EditProductPage";
import CategoriesPage    from "./pages/admin/CategoriesPage";
import DebtPage          from "./pages/admin/DebtPage";
import OrdersPage        from "./pages/admin/OrdersPage";
import Dashboard         from "./pages/admin/Dashboard";
import PaymentsPage      from "./pages/admin/PaymentsPage";
import PayoutsPage       from "./pages/admin/PayoutsPage";
import ExpensesPage      from "./pages/admin/ExpensesPage";
import LabelsPage        from "./pages/admin/LabelsPage";
import Footer            from "./components/ui/Footer";
import GATracker         from "./components/GATracker";
import ScrollToTop       from "./components/ScrollToTop";
import SplashScreen      from "./components/ui/SplashScreen";
import CartDrawer        from "./components/ui/CartDrawer";
import CompleteProfileModal from "./components/ui/CompleteProfileModal";
import { useAuth }       from "./context/AuthContext";
import { CartProvider }  from "./context/CartContext";
import { ROUTES }        from "./constants/app";

// Redirige al catálogo si el usuario no es admin
function AdminRoute({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();
  if (isLoading) return null;
  if (!user || user.role !== "admin") return <Navigate to={ROUTES.HOME} replace />;
  return <>{children}</>;
}

/**
 * "/" era el catálogo antes del rebranding. Los links viejos con ?filter=
 * (Instagram, WhatsApp, marcadores) siguen funcionando redirigiendo al
 * catálogo; sin filtro, "/" es la nueva landing.
 */
function HomeOrLegacyCatalog() {
  const [searchParams] = useSearchParams();
  const filter = searchParams.get("filter");
  if (filter) return <Navigate to={`${ROUTES.CATALOG}?filter=${filter}`} replace />;
  return <HomePage />;
}

export default function App() {
  const { isLoading } = useAuth();

  return (
    <>
      <AnimatePresence>
        {isLoading && <SplashScreen key="splash" />}
      </AnimatePresence>

      {!isLoading && (
        <CartProvider>
          <div className="min-h-screen flex flex-col bg-bone">
            <GATracker />
            <ScrollToTop />
            <div className="flex-1">
              <Routes>
                {/* Public routes */}
                <Route path="/"                        element={<HomeOrLegacyCatalog />} />
                <Route path="/catalogo"                element={<CatalogPage />} />
                <Route path="/product/:slug"           element={<ProductDetailPage />} />
                <Route path="/carrito"                 element={<CartPage />} />
                <Route path="/profile"                 element={<ProfilePage />} />
                <Route path="/my-orders"               element={<MyOrdersPage />} />
                <Route path="/reset-password"          element={<ResetPasswordPage />} />

                {/* Admin-only routes */}
                <Route path="/admin/products/new"      element={<AdminRoute><ProductFormPage /></AdminRoute>} />
                <Route path="/admin/products/:id/edit" element={<AdminRoute><EditProductPage /></AdminRoute>} />
                <Route path="/admin/categories"        element={<AdminRoute><CategoriesPage /></AdminRoute>} />
                <Route path="/admin/deudas"            element={<AdminRoute><DebtPage /></AdminRoute>} />
                <Route path="/admin/pedidos"           element={<AdminRoute><OrdersPage /></AdminRoute>} />
                <Route path="/admin/dashboard"         element={<AdminRoute><Dashboard /></AdminRoute>} />
                <Route path="/admin/movimientos"       element={<AdminRoute><PaymentsPage /></AdminRoute>} />
                <Route path="/admin/ganancias"         element={<AdminRoute><PayoutsPage /></AdminRoute>} />
                <Route path="/admin/gastos"            element={<AdminRoute><ExpensesPage /></AdminRoute>} />
                <Route path="/admin/etiquetas"         element={<AdminRoute><LabelsPage /></AdminRoute>} />

                {/* Cualquier otra ruta vuelve al inicio */}
                <Route path="*"                        element={<Navigate to={ROUTES.HOME} replace />} />
              </Routes>
            </div>
            <Footer />
          </div>
          <CartDrawer />
          <CompleteProfileModal />
        </CartProvider>
      )}
    </>
  );
}
