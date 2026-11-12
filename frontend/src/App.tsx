import { lazy, Suspense, useEffect } from "react";
import { Routes, Route, Navigate, useSearchParams } from "react-router-dom";
import HomePage          from "./pages/HomePage";
import Footer            from "./components/ui/Footer";
import GATracker         from "./components/GATracker";
import ScrollToTop       from "./components/ScrollToTop";
import CartDrawer        from "./components/ui/CartDrawer";
import CompleteProfileModal from "./components/ui/CompleteProfileModal";
import { useAuth }       from "./context/AuthContext";
import { CartProvider }  from "./context/CartContext";
import { ROUTES }        from "./constants/app";

// Cada pantalla se descarga cuando se visita. La Home va en el paquete
// principal porque es la que abre casi todo el mundo; el backoffice entero
// (con Recharts) ya no viaja en el celular de un cliente.
const CatalogPage       = lazy(() => import("./pages/CatalogPage"));
const ProductDetailPage = lazy(() => import("./pages/ProductDetailPage"));
const ProfilePage       = lazy(() => import("./pages/ProfilePage"));
const MyOrdersPage      = lazy(() => import("./pages/MyOrdersPage"));
const CartPage          = lazy(() => import("./pages/CartPage"));
const ResetPasswordPage = lazy(() => import("./pages/ResetPasswordPage"));
const ProductFormPage   = lazy(() => import("./pages/admin/ProductFormPage"));
const EditProductPage   = lazy(() => import("./pages/admin/EditProductPage"));
const CategoriesPage    = lazy(() => import("./pages/admin/CategoriesPage"));
const DebtPage          = lazy(() => import("./pages/admin/DebtPage"));
const OrdersPage        = lazy(() => import("./pages/admin/OrdersPage"));
const Dashboard         = lazy(() => import("./pages/admin/Dashboard"));
const PaymentsPage      = lazy(() => import("./pages/admin/PaymentsPage"));
const PayoutsPage       = lazy(() => import("./pages/admin/PayoutsPage"));
const ExpensesPage      = lazy(() => import("./pages/admin/ExpensesPage"));
const LabelsPage        = lazy(() => import("./pages/admin/LabelsPage"));
const SpecialOrdersPage = lazy(() => import("./pages/admin/SpecialOrdersPage"));
const NotFoundPage      = lazy(() => import("./pages/NotFoundPage"));

/** Mientras baja el código de una pantalla: el fondo de siempre, sin saltos. */
function RouteFallback() {
  return <div className="min-h-[70vh] bg-bone" aria-busy="true" />;
}

/** Quita el splash de index.html cuando la app ya pintó. */
function useDismissSplash() {
  useEffect(() => {
    const dismiss = (window as unknown as { __dismissSplash?: () => void }).__dismissSplash;
    dismiss?.();
  }, []);
}

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
  useDismissSplash();

  // La tienda pinta de inmediato: el carrito, el avatar y las rutas admin se
  // completan cuando se resuelve la sesión.
  return (
    <CartProvider>
          <div className="min-h-screen flex flex-col bg-bone">
            <GATracker />
            <ScrollToTop />
            <div className="flex-1">
              <Suspense fallback={<RouteFallback />}>
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
                <Route path="/admin/encargos"          element={<AdminRoute><SpecialOrdersPage /></AdminRoute>} />

                {/* 404 real con `noindex`, no un redirect al inicio: redirigir
                    hacía que Google indexara la URL inventada como contenido válido. */}
                <Route path="*"                        element={<NotFoundPage />} />
              </Routes>
              </Suspense>
            </div>
            <Footer />
          </div>
          <CartDrawer />
          <CompleteProfileModal />
    </CartProvider>
  );
}
