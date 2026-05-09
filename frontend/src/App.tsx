import { Routes, Route, Navigate } from "react-router-dom";
import { AnimatePresence } from "framer-motion";
import CatalogPage       from "./pages/CatalogPage";
import ProductDetailPage from "./pages/ProductDetailPage";
import ProfilePage       from "./pages/ProfilePage";
import MyOrdersPage      from "./pages/MyOrdersPage";
import CartPage          from "./pages/CartPage";
import ProductFormPage   from "./pages/admin/ProductFormPage";
import EditProductPage   from "./pages/admin/EditProductPage";
import CategoriesPage    from "./pages/admin/CategoriesPage";
import DebtPage          from "./pages/admin/DebtPage";
import OrdersPage        from "./pages/admin/OrdersPage";
import Dashboard         from "./pages/admin/Dashboard";
import PaymentsPage      from "./pages/admin/PaymentsPage";
import PayoutsPage       from "./pages/admin/PayoutsPage";
import ExpensesPage      from "./pages/admin/ExpensesPage";
import Footer            from "./components/ui/Footer";
import GATracker         from "./components/GATracker";
import SplashScreen      from "./components/ui/SplashScreen";
import CartDrawer        from "./components/ui/CartDrawer";
import { useAuth }       from "./context/AuthContext";
import { CartProvider }  from "./context/CartContext";

// Redirige al catálogo si el usuario no es admin
function AdminRoute({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();
  if (isLoading) return null;
  if (!user || user.role !== "admin") return <Navigate to="/" replace />;
  return <>{children}</>;
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
          <div className="min-h-screen flex flex-col bg-white font-poppins">
            <GATracker />
            <div className="flex-1">
              <Routes>
                {/* Public routes */}
                <Route path="/"                        element={<CatalogPage />} />
                <Route path="/product/:slug"           element={<ProductDetailPage />} />
                <Route path="/carrito"                 element={<CartPage />} />
                <Route path="/profile"                 element={<ProfilePage />} />
                <Route path="/my-orders"               element={<MyOrdersPage />} />

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
              </Routes>
            </div>
            <Footer />
          </div>
          <CartDrawer />
        </CartProvider>
      )}
    </>
  );
}
