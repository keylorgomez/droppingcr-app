import { useMemo, useEffect } from "react";
import { useNavigate, useSearchParams, useLocation } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ShoppingBag } from "lucide-react";
import Header from "../components/ui/Header";
import Hero from "../components/ui/Hero";
import ProductCard from "../components/catalog/ProductCard";
import { getProducts } from "../services/productService";
import { useAuth } from "../context/AuthContext";

function ProductCardSkeleton() {
  return (
    <div className="animate-pulse flex flex-col bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="aspect-square bg-gray-100" />
      <div className="flex flex-col gap-2 p-3">
        <div className="h-3 bg-gray-100 rounded-lg w-full" />
        <div className="h-3 bg-gray-100 rounded-lg w-2/3" />
        <div className="h-4 bg-gray-100 rounded-lg w-1/3 mt-1" />
      </div>
    </div>
  );
}

export default function CatalogPage() {
  const navigate         = useNavigate();
  const [searchParams]   = useSearchParams();
  const { user }         = useAuth();
  const isAdmin          = user?.role === "admin";
  const filter           = searchParams.get("filter") ?? "";

  const location = useLocation();

  useEffect(() => {
    if ((location.state as any)?.scrollToCatalog) {
      document.getElementById("catalogo")?.scrollIntoView({ behavior: "smooth" });
      // Clear the state so a manual refresh doesn't re-trigger the scroll
      window.history.replaceState({}, "");
    }
  }, [location.state]);

  const { data: products = [], isLoading, isError } = useQuery({
    queryKey: ["products"],
    queryFn:  getProducts,
  });

  const filtered = useMemo(() => {
    if (!filter) return products;
    if (filter === "nuevo")      return products.filter((p) => p.is_new);
    if (filter === "descuentos") return products.filter((p) => p.discount_percentage > 0);
    return products.filter((p) => p.categories.some((c) => c.slug === filter));
  }, [products, filter]);

  const filterLabel = useMemo(() => {
    if (!filter) return null;
    if (filter === "nuevo")      return "Nuevo";
    if (filter === "descuentos") return "Descuentos";
    // Find category name from any product that has it
    const cat = products
      .flatMap((p) => p.categories)
      .find((c) => c.slug === filter);
    return cat?.name ?? filter;
  }, [filter, products]);

  return (
    <>
      <Header />
      <Hero />

      <main id="catalogo" className="px-4 pt-10 pb-12 max-w-7xl mx-auto">

        {/* Active filter label */}
        {filterLabel && !isLoading && (
          <div className="flex items-center gap-2 mb-6">
            <h2 className="font-poppins font-semibold text-base text-brand-dark">
              {filterLabel}
            </h2>
            <span className="text-xs font-poppins text-gray-400">
              · {filtered.length} {filtered.length === 1 ? "producto" : "productos"}
            </span>
            <a
              href="/"
              className="ml-auto text-xs font-poppins text-gray-400 hover:text-brand-primary
                         underline underline-offset-2 transition-colors"
            >
              Ver todo
            </a>
          </div>
        )}

        {isError && (
          <p className="text-center font-poppins text-sm text-red-400 py-10">
            No se pudieron cargar los productos. Intenta de nuevo.
          </p>
        )}

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {isLoading
            ? Array.from({ length: 8 }).map((_, i) => <ProductCardSkeleton key={i} />)
            : filtered.map((product) => (
                <ProductCard
                  key={product.id}
                  name={product.name}
                  price_sale={product.price_sale}
                  image_url={product.image_url}
                  images={product.images}
                  category={product.category}
                  is_new={product.is_new}
                  discount_percentage={product.discount_percentage}
                  is_sold_out={product.is_sold_out}
                  onClick={() => navigate(`/product/${product.slug}`)}
                  onEdit={isAdmin ? () => navigate(`/admin/products/${product.id}/edit`) : undefined}
                />
              ))
          }
        </div>

        {!isLoading && !isError && filtered.length === 0 && (
          <div className="flex flex-col items-center gap-4 py-24 text-gray-300">
            <ShoppingBag size={48} strokeWidth={1.2} />
            <div className="text-center">
              <p className="font-poppins font-medium text-sm text-gray-400">
                {filter ? "No hay productos en esta categoría." : "No hay productos disponibles."}
              </p>
              <p className="font-poppins text-xs text-gray-300 mt-1">
                {filter ? (
                  <a href="/" className="text-brand-primary underline underline-offset-2">
                    Ver todos los productos
                  </a>
                ) : "Vuelve pronto, estamos preparando algo nuevo."}
              </p>
            </div>
          </div>
        )}
      </main>
    </>
  );
}
