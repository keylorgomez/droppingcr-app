import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { ShoppingBag, ExternalLink, Truck, MapPin, Package, ArrowLeft } from "lucide-react";
import { motion } from "framer-motion";
import Header from "../components/ui/Header";
import { useAuth } from "../context/AuthContext";
import {
  claimOrders, getUserOrders,
  deliveryStatusMeta, SHIPPING_OPTIONS,
  type UserOrder,
} from "../services/salesService";

// ── Helpers ────────────────────────────────────────────────────────────────

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("es-CR", {
    day: "numeric", month: "short", year: "numeric",
  });
}

function shippingLabel(method: string) {
  return SHIPPING_OPTIONS.find((o) => o.value === method)?.label ?? method;
}

const CORREOS_METHODS = new Set(["correos_gam", "correos_fuera_gam"]);

// ── Skeleton ───────────────────────────────────────────────────────────────

function OrderSkeleton() {
  return (
    <div className="animate-pulse flex gap-4 bg-white rounded-2xl border border-gray-100 p-4">
      <div className="w-20 h-20 rounded-xl bg-gray-100 shrink-0" />
      <div className="flex flex-col gap-2 flex-1 pt-1">
        <div className="h-3 bg-gray-100 rounded w-3/4" />
        <div className="h-3 bg-gray-100 rounded w-1/2" />
        <div className="h-4 bg-gray-100 rounded w-1/4 mt-1" />
      </div>
    </div>
  );
}

// ── Order Card ─────────────────────────────────────────────────────────────

function OrderCard({ order }: { order: UserOrder }) {
  const total     = order.sale_price + order.shipping_cost;
  const remaining = Math.max(0, total - order.total_paid);
  const isPending = order.status === "pending";
  const progress  = total > 0 ? Math.min(100, (order.total_paid / total) * 100) : 100;
  const status    = deliveryStatusMeta(order.delivery_status);
  const isCorreos = CORREOS_METHODS.has(order.shipping_method);
  const isPersonal = order.shipping_method === "personal_grecia";

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden"
    >
      <div className="flex gap-4 p-4">
        {/* Product image */}
        <div className="w-20 h-20 rounded-xl overflow-hidden bg-gray-50 border border-gray-100 shrink-0">
          {order.image_url ? (
            <img src={order.image_url} alt={order.product_name}
                 className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <Package size={24} className="text-gray-200" strokeWidth={1.4} />
            </div>
          )}
        </div>

        {/* Info */}
        <div className="flex flex-col gap-1 flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="font-poppins font-semibold text-sm italic text-brand-primary
                            leading-snug line-clamp-2">
                {order.product_name}
              </p>
              <p className="font-poppins text-xs text-gray-400 mt-0.5">
                Talla {order.variant_size} · {formatDate(order.sold_at)}
              </p>
            </div>
            {/* Delivery status badge */}
            <span className={`shrink-0 text-[10px] font-bold uppercase tracking-wider
                              px-2.5 py-1 rounded-full font-poppins ${status.bgCls}`}>
              {status.label}
            </span>
          </div>

          {/* Shipping method */}
          <div className="flex items-center gap-1.5 mt-0.5">
            {isPersonal
              ? <MapPin size={11} className="text-gray-300 shrink-0" />
              : <Truck   size={11} className="text-gray-300 shrink-0" />
            }
            <span className="text-[11px] font-poppins text-gray-400 truncate">
              {shippingLabel(order.shipping_method)}
            </span>
          </div>
        </div>
      </div>

      {/* Payment detail — only when pending */}
      {isPending && (
        <div className="px-4 pb-4 flex flex-col gap-2 border-t border-gray-50 pt-3 mx-4 mb-0">
          <div className="flex justify-between text-xs font-poppins">
            <span className="text-gray-400">Pagado</span>
            <span className="font-medium text-brand-dark">
              ₡{order.total_paid.toLocaleString("en-US")}
              <span className="text-gray-300 font-normal"> / ₡{total.toLocaleString("en-US")}</span>
            </span>
          </div>
          {/* Progress bar */}
          <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden">
            <div
              className="h-full rounded-full bg-brand-primary transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="text-[11px] font-poppins text-gray-400">
            Pendiente: <span className="font-semibold text-red-500">
              ₡{remaining.toLocaleString("en-US")}
            </span>
            {order.shipping_cost > 0 && (
              <span className="text-gray-300">
                {" "}(incluye ₡{order.shipping_cost.toLocaleString("en-US")} de envío)
              </span>
            )}
          </p>
        </div>
      )}

      {/* Correos tracking button */}
      {isCorreos && order.tracking_number && (
        <div className="px-4 pb-4">
          <a
            href={`https://rastrea.correos.go.cr/`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-between w-full rounded-xl border border-gray-200
                       px-4 py-2.5 text-xs font-poppins text-brand-dark hover:border-brand-primary
                       hover:text-brand-primary transition-colors"
          >
            <span>
              Rastrear paquete{" "}
              <span className="font-semibold">{order.tracking_number}</span>
            </span>
            <ExternalLink size={13} className="shrink-0 text-gray-300" />
          </a>
        </div>
      )}
    </motion.div>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────

export default function MyOrdersPage() {
  const { user }    = useAuth();
  const navigate    = useNavigate();
  const queryClient = useQueryClient();

  useEffect(() => { window.scrollTo({ top: 0, behavior: "instant" }); }, []);

  // ── The Bridge ──────────────────────────────────────────────────────────
  // Claim unclaimed sales whose guest_phone matches the user's WhatsApp,
  // then invalidate the orders cache so the list refreshes immediately.
  useEffect(() => {
    if (!user?.id || !user?.whatsapp) return;
    claimOrders(user.id, user.whatsapp)
      .then((claimed) => {
        if (claimed > 0) {
          queryClient.invalidateQueries({ queryKey: ["my-orders", user.id] });
        }
      })
      .catch(() => {});
  }, [user?.id, user?.whatsapp, queryClient]);

  const { data: orders = [], isLoading, isError } = useQuery({
    queryKey:       ["my-orders", user?.id],
    queryFn:        () => getUserOrders(user!.id),
    enabled:        !!user?.id,
    staleTime:      0,
    refetchOnMount: true,
  });

  // Redirect unauthenticated users
  useEffect(() => {
    if (!user) navigate("/");
  }, [user, navigate]);

  const pending   = orders.filter((o) => o.status === "pending");
  const completed = orders.filter((o) => o.status === "completed");

  return (
    <>
      <Header />
      <main className="max-w-2xl mx-auto px-4 pt-8 pb-16">

        {/* Back + title */}
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

        {/* Pending orders */}
        {pending.length > 0 && (
          <section className="mb-8">
            <h2 className="font-poppins text-[11px] font-semibold uppercase tracking-widest
                           text-gray-400 mb-3">
              En proceso
            </h2>
            <div className="flex flex-col gap-3">
              {pending.map((o) => <OrderCard key={o.id} order={o} />)}
            </div>
          </section>
        )}

        {/* Completed orders */}
        {completed.length > 0 && (
          <section>
            <h2 className="font-poppins text-[11px] font-semibold uppercase tracking-widest
                           text-gray-400 mb-3">
              Comprados
            </h2>
            <div className="flex flex-col gap-3">
              {completed.map((o) => <OrderCard key={o.id} order={o} />)}
            </div>
          </section>
        )}
      </main>
    </>
  );
}
