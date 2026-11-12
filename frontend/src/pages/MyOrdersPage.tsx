import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { ShoppingBag, ArrowLeft } from "lucide-react";
import { AnimatePresence } from "motion/react";
import Header from "../components/ui/Header";
import { useAuth } from "../context/AuthContext";
import { claimOrders, getUserOrders, type UserOrder } from "../services/salesService";
import { claimExternalSales } from "../services/externalSalesService";
import {
  claimSpecialOrders, getMySpecialOrders, SPECIAL_ORDER_FLOW, SPECIAL_ORDER_STATUS_LABEL,
  type MySpecialOrder,
} from "../services/specialOrdersService";
import { fmt } from "../lib/formatters";
import { cn } from "../lib/utils";
import { QUERY_KEYS } from "../constants/queryKeys";
import { OrderSkeleton, OrderCard } from "../components/orders/UserOrderCard";
import { OrderDetailSheet } from "../components/orders/UserOrderDetailSheet";

export default function MyOrdersPage() {
  const { user, isLoading: authLoading } = useAuth();
  const navigate    = useNavigate();
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState<UserOrder | null>(null);

  useEffect(() => { window.scrollTo({ top: 0, behavior: "instant" }); }, []);

  useEffect(() => {
    if (!user?.id || !user?.whatsapp) return;
    Promise.all([
      claimOrders(user.id, user.whatsapp),
      claimExternalSales(user.id, user.whatsapp),
      claimSpecialOrders(user.id, user.whatsapp),
    ]).then(([claimed, claimedExternal, claimedSpecial]) => claimed + claimedExternal + claimedSpecial)
      .then((claimed) => {
        if (claimed > 0) {
          queryClient.invalidateQueries({ queryKey: QUERY_KEYS.MY_ORDERS(user.id) });
        }
      })
      .catch((err) => console.warn("[silencioso]", err));
  }, [user?.id, user?.whatsapp, queryClient]);

  const { data: orders = [], isLoading, isError } = useQuery({
    queryKey:       QUERY_KEYS.MY_ORDERS(user?.id ?? ""),
    queryFn:        () => getUserOrders(user!.id),
    enabled:        !!user?.id,
    staleTime:      0,
    refetchOnMount: true,
  });

  const { data: encargos = [] } = useQuery({
    queryKey: QUERY_KEYS.MY_SPECIAL_ORDERS(user?.id ?? ""),
    queryFn:  getMySpecialOrders,
    enabled:  !!user?.id,
  });
  const activeEncargos = encargos.filter((e) => e.status !== "delivered" && e.status !== "cancelled");

  // La app ya no espera la sesión para pintar: solo redirigir cuando terminó
  // de cargar y de verdad no hay usuario.
  useEffect(() => {
    if (!authLoading && !user) navigate("/");
  }, [authLoading, user, navigate]);

  const pending   = orders.filter((o) => o.status === "pending");
  const completed = orders.filter((o) => o.status === "completed");

  return (
    <>
      <Header />
      <main className="max-w-2xl mx-auto px-4 pt-8 pb-16">

        <div className="mb-6">
          <button
            onClick={() => navigate("/")}
            className="flex items-center gap-1.5 text-sm text-ink-400
                       hover:text-brand-primary transition-colors mb-3"
          >
            <ArrowLeft size={15} strokeWidth={2} />
            Volver al catálogo
          </button>
          <h1 className="type-display text-[clamp(1.9rem,7vw,3rem)] text-ink-900">
            Mis pedidos
          </h1>
          {!isLoading && orders.length > 0 && (
            <p className="text-xs text-ink-400 mt-1">
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
          <p className="text-center text-sm text-ink-600 py-10">
            No se pudieron cargar tus pedidos. Intenta de nuevo.
          </p>
        )}

        {!isLoading && !isError && orders.length === 0 && activeEncargos.length === 0 && (
          <div className="flex flex-col items-center gap-4 py-24 text-ink-300">
            <ShoppingBag size={48} strokeWidth={1.2} />
            <div className="text-center">
              <p className="font-medium text-sm text-ink-400">
                Aún no tienes pedidos registrados.
              </p>
              <p className="text-xs text-ink-300 mt-1">
                Asegúrate de que tu número de WhatsApp en tu perfil coincide
                con el que usaste al hacer tu pedido.
              </p>
            </div>
          </div>
        )}

        {activeEncargos.length > 0 && (
          <section className="mb-8">
            <h2 className="font-display text-[11px] uppercase tracking-widest2
                           text-ink-400 mb-3">
              Encargos
            </h2>
            <div className="flex flex-col gap-3">
              {activeEncargos.map((e) => <EncargoCard key={e.id} encargo={e} />)}
            </div>
          </section>
        )}

        {pending.length > 0 && (
          <section className="mb-8">
            <h2 className="font-display text-[11px] uppercase tracking-widest2
                           text-ink-400 mb-3">
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
            <h2 className="font-display text-[11px] uppercase tracking-widest2
                           text-ink-400 mb-3">
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

// Un encargo es una pieza pedida al proveedor: lo que más pregunta el cliente
// es "¿por dónde viene?", así que el avance va al frente.
function EncargoCard({ encargo }: { encargo: MySpecialOrder }) {
  const step      = SPECIAL_ORDER_FLOW.indexOf(encargo.status);
  const remaining = Math.max(0, encargo.estimated_price - encargo.paid);
  return (
    <div className="rounded-card border border-ink-100 bg-white p-4 flex flex-col gap-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium text-ink-900">{encargo.description}</p>
          {encargo.size && <p className="text-xs text-ink-400 mt-0.5">Talla {encargo.size}</p>}
        </div>
        <span className="shrink-0 font-display uppercase text-[10px] tracking-wider rounded-chip bg-ink-900 text-bone px-2 py-1 leading-none">
          {SPECIAL_ORDER_STATUS_LABEL[encargo.status]}
        </span>
      </div>

      <div className="grid grid-cols-4 gap-1" aria-label={`Paso ${step + 1} de ${SPECIAL_ORDER_FLOW.length}`}>
        {SPECIAL_ORDER_FLOW.map((s, i) => (
          <div key={s} className="flex flex-col gap-1">
            <span className={cn("h-1 rounded-full", i <= step ? "bg-ink-900" : "bg-ink-100")} />
            <span className={cn("text-[10px] leading-tight", i <= step ? "text-ink-700" : "text-ink-300")}>
              {SPECIAL_ORDER_STATUS_LABEL[s]}
            </span>
          </div>
        ))}
      </div>

      {encargo.estimated_price > 0 && (
        <div className="flex items-center justify-between text-xs border-t border-ink-50 pt-2.5">
          <span className="text-ink-500">Adelanto {fmt(encargo.paid)} de {fmt(encargo.estimated_price)}</span>
          <span className="font-semibold text-ink-900">{remaining > 0 ? `Falta ${fmt(remaining)}` : "Pagado"}</span>
        </div>
      )}
    </div>
  );
}
