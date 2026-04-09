import { Routes, Route } from "react-router-dom";
import { AnimatePresence } from "framer-motion";
import CatalogPage       from "./pages/CatalogPage";
import ProductDetailPage from "./pages/ProductDetailPage";
import ProfilePage       from "./pages/ProfilePage";
import MyOrdersPage      from "./pages/MyOrdersPage";
import ProductFormPage   from "./pages/admin/ProductFormPage";
import EditProductPage   from "./pages/admin/EditProductPage";
import CategoriesPage    from "./pages/admin/CategoriesPage";
import DebtPage          from "./pages/admin/DebtPage";
import OrdersPage        from "./pages/admin/OrdersPage";
import Dashboard         from "./pages/admin/Dashboard";
import Footer            from "./components/ui/Footer";
import GATracker         from "./components/GATracker";
import SplashScreen      from "./components/ui/SplashScreen";
import { useAuth }       from "./context/AuthContext";

export default function App() {
  const { isLoading } = useAuth();

  return (
    <>
      <AnimatePresence>
        {isLoading && <SplashScreen key="splash" />}
      </AnimatePresence>

      {!isLoading && (
        <div className="min-h-screen flex flex-col bg-white font-poppins">
          <GATracker />
          <div className="flex-1">
            <Routes>
              <Route path="/"                        element={<CatalogPage />} />
              <Route path="/product/:slug"           element={<ProductDetailPage />} />
              <Route path="/profile"                 element={<ProfilePage />} />
              <Route path="/admin/products/new"      element={<ProductFormPage />} />
              <Route path="/admin/products/:id/edit" element={<EditProductPage />} />
              <Route path="/admin/categories"        element={<CategoriesPage />} />
              <Route path="/admin/deudas"            element={<DebtPage />} />
              <Route path="/my-orders"               element={<MyOrdersPage />} />
              <Route path="/admin/pedidos"           element={<OrdersPage />} />
              <Route path="/admin/dashboard"         element={<Dashboard />} />
            </Routes>
          </div>
          <Footer />
        </div>
      )}
    </>
  );
}
