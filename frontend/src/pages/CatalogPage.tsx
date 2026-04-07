import { useNavigate } from "react-router-dom";
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
  const navigate    = useNavigate();
  const { user }    = useAuth();
  const isAdmin     = user?.role === "admin";

  const { data: products = [], isLoading, isError } = useQuery({
    queryKey: ["products"],
    queryFn:  getProducts,
  });

  return (
    <>
      <Header />
      <Hero />

      <main id="catalogo" className="px-4 pt-10 pb-12 max-w-7xl mx-auto">
        {isError && (
          <p className="text-center font-poppins text-sm text-red-400 py-10">
            No se pudieron cargar los productos. Intenta de nuevo.
          </p>
        )}

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {isLoading
            ? Array.from({ length: 8 }).map((_, i) => <ProductCardSkeleton key={i} />)
            : products.map((product) => (
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

        {!isLoading && !isError && products.length === 0 && (
          <div className="flex flex-col items-center gap-4 py-24 text-gray-300">
            <ShoppingBag size={48} strokeWidth={1.2} />
            <div className="text-center">
              <p className="font-poppins font-medium text-sm text-gray-400">
                No hay productos disponibles
              </p>
              <p className="font-poppins text-xs text-gray-300 mt-1">
                Vuelve pronto, estamos preparando algo nuevo.
              </p>
            </div>
          </div>
        )}
      </main>
    </>
  );
}
