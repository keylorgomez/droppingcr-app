import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "../context/AuthContext";
import { QUERY_KEYS } from "../constants/queryKeys";
import { ROUTES } from "../constants/app";

/**
 * Stock en vivo por websocket (Supabase Realtime sobre product_variants).
 *
 * Es solo para que la pantalla se entere rápido de que otra persona vendió o
 * apartó una pieza. Quién se queda con la última unidad lo decide SIEMPRE la
 * base (decrement_variant_stock); esto nunca reemplaza ese chequeo.
 *
 * Abierto para admins en todo el sitio, y para clientes solo en el detalle de
 * producto y el carrito: cada pestaña abierta es una conexión y el plan de
 * Supabase tiene un tope de conexiones simultáneas.
 */
export function useLiveStock() {
  const queryClient  = useQueryClient();
  const { user }     = useAuth();
  const { pathname } = useLocation();

  const enabled =
    user?.role === "admin" ||
    pathname.startsWith(ROUTES.PRODUCT("")) ||
    pathname.startsWith(ROUTES.CART);

  useEffect(() => {
    if (!enabled) return;

    // Una venta de pedido toca varias tallas a la vez: se agrupan en una sola
    // recarga en vez de una por fila.
    let timer: ReturnType<typeof setTimeout> | undefined;
    const refresh = () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: QUERY_KEYS.PRODUCTS });
        queryClient.invalidateQueries({ queryKey: QUERY_KEYS.PRODUCTS_WITH_VARIANTS });
        queryClient.invalidateQueries({ queryKey: ["product"] });
        queryClient.invalidateQueries({ queryKey: ["cart-stocks"] });
      }, 400);
    };

    const channel = supabase
      .channel("live-stock")
      .on("postgres_changes", { event: "*", schema: "public", table: "product_variants" }, refresh)
      .subscribe();

    return () => {
      clearTimeout(timer);
      supabase.removeChannel(channel);
    };
  }, [enabled, queryClient]);
}

/** Montado una vez dentro del router. */
export function LiveStock() {
  useLiveStock();
  return null;
}
