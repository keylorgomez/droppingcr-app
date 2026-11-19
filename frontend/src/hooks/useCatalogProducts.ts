import { useQuery } from "@tanstack/react-query";
import { useAuth } from "../context/AuthContext";
import { getProducts } from "../services/productService";
import { QUERY_KEYS } from "../constants/queryKeys";

/**
 * Catálogo compartido (home, catálogo, detalle, header, sidebar).
 *
 * Espera a saber quién es el usuario: antes se pedía una vez como visitante y
 * otra al cargar la sesión de admin, dos descargas del catálogo por visita.
 */
export function useCatalogProducts() {
  const { user, isLoading: authLoading } = useAuth();
  const isAdmin = user?.role === "admin";
  return useQuery({
    queryKey: [...QUERY_KEYS.PRODUCTS, isAdmin],
    queryFn:  () => getProducts(isAdmin),
    enabled:  !authLoading,
  });
}
