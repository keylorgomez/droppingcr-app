import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { ShoppingBag, ArrowLeft } from "lucide-react";
import { AnimatePresence } from "framer-motion";
import Header from "../components/ui/Header";
import { useAuth } from "../context/AuthContext";
import { claimOrders, getUserOrders, type UserOrder } from "../services/salesService";
import { QUERY_KEYS } from "../constants/queryKeys";
import { OrderSkeleton, OrderCard } from "../components/orders/UserOrderCard";
import { OrderDetailSheet } from "../components/orders/UserOrderDetailSheet";

export default function MyOrdersPage() {
  const { user }    = useAuth();
  const navigate    = useNavigate();
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState<UserOrder | null>(null);

  useEffect(() => { window.scrollTo({ top: 0, behavior: "instant" }); }, []);

  useEffect(() => {
    if (!user?.id || !user?.whatsapp) return;
    claimOrders(user.id, user.whatsapp)
      .then((claimed) => {
        if (claimed > 0) {
          queryClient.invalidateQueries({ queryKey: QUERY_KEYS.MY_ORDERS(user.id) });
        }
      })
      .catch(() => {});
  }, [user?.id, user?.whatsapp, queryClient]);

  const { data: orders = [], isLoading, isError } = useQuery({
    queryKey:       QUERY_KEYS.MY_ORDERS(user?.id ?? ""),
    queryFn:        () => getUserOrders(user!.id),
    enabled:        !!user?.id,
    staleTime:      0,
    refetchOnMount: true,
  });

  useEffect(() => {
    if (!user) navigate("/");
  }, [user, navigate]);

  const pending   = orders.filter((o) => o.status === "pending");
  const completed = orders.filter((o) => o.status === "completed");

  return (
    <>
      <Header />
      <main className="max-w-2xl mx-auto px-4 pt-8 pb-16">

        <div className="mb-6">
          <button
            onClick={() => navigate("/")}
            className="flex items-center gap-1.5 text-sm font-poppins text-gray-400
                       hover:text-brand-primary transition-colors mb-3"
          >
            <ArrowLeft size={15} strokeWidth={2} />
            Volver al catálogo
          </button>
          <h1 className="font-poppins font-semibold italic text-brand-primary text-2xl">
            Mis pedidos
          </h1>
          {!isLoading && orders.length > 0 && (
            <p className="font-poppins text-xs text-gray-400 mt-1">
              {orders.length} {orders.length === 1 ? "pedido" : "pedidos"} encontrados
            </p>
          )}
        </div>

        {isLoading && (
          <div className="flex flex-col gap-3">
            {Array.from({ length: 3 }).map((_, i) => <OrderSkeleton key={i} />)}
          </div>
        )}

        {isError && (
          <p className="text-center font-poppins text-sm text-red-400 py-10">
            No se pudieron cargar tus pedidos. Intenta de nuevo.
          </p>
        )}

        {!isLoading && !isError && orders.length === 0 && (
          <div className="flex flex-col items-center gap-4 py-24 text-gray-300">
            <ShoppingBag size={48} strokeWidth={1.2} />
            <div className="text-center">
              <p className="font-poppins font-medium text-sm text-gray-400">
                Aún no tienes pedidos registrados.
              </p>
              <p className="font-poppins text-xs text-gray-300 mt-1">
                Asegúrate de que tu número de WhatsApp en tu perfil coincide
                con el que usaste al hacer tu pedido.
              </p>
            </div>
          </div>
        )}

        {pending.length > 0 && (
          <section className="mb-8">
            <h2 className="font-poppins text-[11px] font-semibold uppercase tracking-widest
                           text-gray-400 mb-3">
              En proceso
            </h2>
            <div className="flex flex-col gap-3">
              {pending.map((o) => (
                <OrderCard key={o.id} order={o} onClick={() => setSelected(o)} />
              ))}
            </div>
          </section>
        )}

        {completed.length > 0 && (
          <section>
            <h2 className="font-poppins text-[11px] font-semibold uppercase tracking-widest
                           text-gray-400 mb-3">
              Comprados
            </h2>
            <div className="flex flex-col gap-3">
              {completed.map((o) => (
                <OrderCard key={o.id} order={o} onClick={() => setSelected(o)} />
              ))}
            </div>
          </section>
        )}
      </main>

      <AnimatePresence>
        {selected && (
          <OrderDetailSheet order={selected} onClose={() => setSelected(null)} />
        )}
      </AnimatePresence>
    </>
  );
}
