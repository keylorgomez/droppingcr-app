import { useState, useMemo, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  Search, X, Package,
  Truck, MapPin, ChevronRight, ArrowLeft, Plus,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import Header from "../../components/ui/Header";
import { useAuth } from "../../context/AuthContext";
import {
  getAllSales,
  SHIPPING_OPTIONS,
  deliveryStatusMeta,
  type AdminSale,
} from "../../services/salesService";
import {
  getAllOrders,
  type AdminOrder,
} from "../../services/ordersService";
import { cn } from "../../lib/utils";
import { formatDate, normalizeText } from "../../lib/formatters";
import { QUERY_KEYS } from "../../constants/queryKeys";
import SaleDetailModal  from "../../components/orders/SaleDetailModal";
import OrderDetailModal from "../../components/orders/OrderDetailModal";
import NewOrderModal    from "../../components/orders/NewOrderModal";

// ── Helpers ────────────────────────────────────────────────────────────────

function shippingLabel(method: string) {
  return SHIPPING_OPTIONS.find((shippingOption) => shippingOption.value === method)?.label ?? method;
}

// ── Tab config ─────────────────────────────────────────────────────────────

const TABS = [
  { id: "all",       label: "Todos",      statuses: null                                      },
  { id: "pending",   label: "Pendientes", statuses: ["validating", "confirmed", "apartada"]   },
  { id: "shipped",   label: "Enviados",   statuses: ["shipped"]                               },
  { id: "delivered", label: "Entregados", statuses: ["delivered"]                             },
] as const;

type TabId = typeof TABS[number]["id"];

// ── Unified list item ──────────────────────────────────────────────────────

type UnifiedItem =
  | { kind: "sale";  data: AdminSale;  sold_at: string }
  | { kind: "order"; data: AdminOrder; sold_at: string };

// ── Sale Row (single-product sales) ───────────────────────────────────────

function SaleRow({ sale, onClick }: { sale: AdminSale; onClick: () => void }) {
  const statusMeta  = deliveryStatusMeta(sale.delivery_status);
  const total       = sale.sale_price + sale.shipping_cost;
  const isPersonal  = sale.shipping_method === "personal_grecia";

  return (
    <motion.button
      type="button"
      onClick={onClick}
      whileHover={{ backgroundColor: "#fafafa" }}
      className="w-full flex items-center gap-3 px-4 py-3.5 border-b border-gray-50
                 text-left transition-colors last:border-b-0"
    >
      <div className="w-12 h-12 rounded-xl overflow-hidden bg-gray-50 border border-gray-100 shrink-0">
        {sale.image_url
          ? <img src={sale.image_url} alt={sale.product_name} className="w-full h-full object-cover" />
          : <Package size={18} className="m-auto mt-3 text-gray-200" />
        }
      </div>

      <div className="flex-1 min-w-0">
        <p className="font-poppins font-semibold text-sm italic text-brand-primary truncate">
          {sale.product_name}
        </p>
        <p className="font-poppins text-xs text-gray-400 truncate mt-0.5">
          {sale.guest_name ?? "Cliente sin nombre"}{" "}
          {sale.guest_phone && (
            <span className="text-gray-300">· {sale.guest_phone}</span>
          )}
        </p>
        <div className="flex items-center gap-1.5 mt-0.5">
          {isPersonal
            ? <MapPin size={10} className="text-gray-300 shrink-0" />
            : <Truck  size={10} className="text-gray-300 shrink-0" />
          }
          <span className="text-[10px] font-poppins text-gray-300 truncate">
            {shippingLabel(sale.shipping_method)}
          </span>
        </div>
      </div>

      <div className="flex flex-col items-end gap-1.5 shrink-0">
        <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5
                          rounded-full font-poppins ${statusMeta.bgCls}`}>
          {statusMeta.label}
        </span>
        <span className="text-xs font-poppins font-semibold text-brand-dark">
          ₡{total.toLocaleString("en-US")}
        </span>
        <span className="text-[10px] font-poppins text-gray-300">
          {formatDate(sale.sold_at)}
        </span>
      </div>

      <ChevronRight size={14} className="text-gray-200 shrink-0" />
    </motion.button>
  );
}

// ── Order Row (multi-item orders) ──────────────────────────────────────────

function OrderRow({ order, onClick }: { order: AdminOrder; onClick: () => void }) {
  const statusMeta  = deliveryStatusMeta(order.delivery_status);
  const isPersonal  = order.shipping_method === "personal_grecia";
  const isMulti     = order.items.length > 1;
  const firstItem   = order.items[0];
  const label       = isMulti
    ? `${order.items.length} productos`
    : (firstItem?.product_name ?? "—");

  return (
    <motion.button
      type="button"
      onClick={onClick}
      whileHover={{ backgroundColor: "#fafafa" }}
      className="w-full flex items-center gap-3 px-4 py-3.5 border-b border-gray-50
                 text-left transition-colors last:border-b-0"
    >
      {isMulti ? (
        <div className="grid grid-cols-2 gap-0.5 w-12 h-12 shrink-0">
          {order.items.slice(0, 4).map((item, index) => (
            <div key={index} className="rounded-md overflow-hidden bg-gray-50 border border-gray-100">
              {item.image_url
                ? <img src={item.image_url} alt={item.product_name} className="w-full h-full object-cover" />
                : <Package size={8} className="m-auto text-gray-200" />
              }
            </div>
          ))}
        </div>
      ) : (
        <div className="w-12 h-12 rounded-xl overflow-hidden bg-gray-50 border border-gray-100 shrink-0">
          {firstItem?.image_url
            ? <img src={firstItem.image_url} alt={label} className="w-full h-full object-cover" />
            : <Package size={18} className="m-auto mt-3 text-gray-200" />
          }
        </div>
      )}

      <div className="flex-1 min-w-0">
        {isMulti ? (
          <div className="flex flex-col gap-0.5 mb-0.5">
            {order.items.map((item, index) => (
              <p key={index} className="font-poppins font-semibold text-xs italic text-brand-primary truncate leading-snug">
                {item.product_name}
                <span className="font-normal text-gray-400 not-italic ml-1">{item.variant_size}</span>
                {item.quantity > 1 && (
                  <span className="font-normal text-gray-300 not-italic ml-1">×{item.quantity}</span>
                )}
              </p>
            ))}
          </div>
        ) : (
          <div className="flex items-center gap-1.5 mb-0.5">
            <p className="font-poppins font-semibold text-sm italic text-brand-primary truncate">
              {label}
            </p>
          </div>
        )}
        <p className="font-poppins text-xs text-gray-400 truncate">
          {order.guest_name ?? "Cliente sin nombre"}{" "}
          {order.guest_phone && (
            <span className="text-gray-300">· {order.guest_phone}</span>
          )}
        </p>
        <div className="flex items-center gap-1.5 mt-0.5">
          {isPersonal
            ? <MapPin size={10} className="text-gray-300 shrink-0" />
            : <Truck  size={10} className="text-gray-300 shrink-0" />
          }
          <span className="text-[10px] font-poppins text-gray-300 truncate">
            {shippingLabel(order.shipping_method)}
          </span>
        </div>
      </div>

      <div className="flex flex-col items-end gap-1.5 shrink-0">
        <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5
                          rounded-full font-poppins ${statusMeta.bgCls}`}>
          {statusMeta.label}
        </span>
        <span className="text-xs font-poppins font-semibold text-brand-dark">
          ₡{order.order_total.toLocaleString("en-US")}
        </span>
        <span className="text-[10px] font-poppins text-gray-300">
          {formatDate(order.sold_at)}
        </span>
      </div>

      <ChevronRight size={14} className="text-gray-200 shrink-0" />
    </motion.button>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────

export default function OrdersPage() {
  const { user }       = useAuth();
  const navigate       = useNavigate();
  const [searchParams] = useSearchParams();

  const [activeTab,     setActiveTab]     = useState<TabId>("all");
  const [search,        setSearch]        = useState("");
  const [selectedSale,  setSelectedSale]  = useState<AdminSale  | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<AdminOrder | null>(null);
  const [showNewModal,  setShowNewModal]  = useState(false);

  if (user && user.role !== "admin") { navigate("/"); return null; }

  // eslint-disable-next-line react-hooks/rules-of-hooks
  useEffect(() => { window.scrollTo({ top: 0, behavior: "instant" }); }, []);

  // Auto-open NewOrderModal when navigated with ?draft=true (from EditProductPage)
  // eslint-disable-next-line react-hooks/rules-of-hooks
  useEffect(() => {
    if (searchParams.get("draft") === "true") {
      setShowNewModal(true);
      window.history.replaceState({}, "", "/admin/pedidos");
    }
  }, []);

  const { data: sales = [], isLoading: salesLoading, isError: salesError } = useQuery({
    queryKey: QUERY_KEYS.ADMIN_SALES,
    queryFn:  getAllSales,
  });

  const { data: orders = [], isLoading: ordersLoading, isError: ordersError } = useQuery({
    queryKey: QUERY_KEYS.ADMIN_ORDERS,
    queryFn:  getAllOrders,
  });

  const isLoading = salesLoading || ordersLoading;
  const isError   = salesError   || ordersError;

  const unified = useMemo((): UnifiedItem[] => {
    const saleItems: UnifiedItem[]  = sales.map((sale) => ({ kind: "sale"  as const, data: sale,  sold_at: sale.sold_at  }));
    const orderItems: UnifiedItem[] = orders.map((order) => ({ kind: "order" as const, data: order, sold_at: order.sold_at }));
    return [...saleItems, ...orderItems].sort(
      (itemA, itemB) => new Date(itemB.sold_at).getTime() - new Date(itemA.sold_at).getTime()
    );
  }, [sales, orders]);

  const byTab = useMemo(() => {
    const tab = TABS.find((tabOption) => tabOption.id === activeTab);
    if (!tab?.statuses) return unified;
    const activeStatuses = tab.statuses as readonly string[];
    return unified.filter((unifiedItem) =>
      activeStatuses.includes(unifiedItem.data.delivery_status)
    );
  }, [unified, activeTab]);

  const filtered = useMemo(() => {
    const searchQuery = normalizeText(search.trim());
    if (!searchQuery) return byTab;
    return byTab.filter((unifiedItem) => {
      const { data } = unifiedItem;
      return (
        normalizeText(data.guest_name ?? "").includes(searchQuery) ||
        (data.guest_phone ?? "").replace(/\D/g, "").includes(searchQuery.replace(/\D/g, ""))
      );
    });
  }, [byTab, search]);

  const counts = useMemo(() => ({
    all:       unified.length,
    pending:   unified.filter((unifiedItem) =>
      ["validating", "confirmed", "apartada"].includes(unifiedItem.data.delivery_status)
    ).length,
    shipped:   unified.filter((unifiedItem) => unifiedItem.data.delivery_status === "shipped").length,
    delivered: unified.filter((unifiedItem) => unifiedItem.data.delivery_status === "delivered").length,
  }), [unified]);

  const tabCount = (id: TabId) =>
    id === "all"       ? counts.all :
    id === "pending"   ? counts.pending :
    id === "shipped"   ? counts.shipped :
    id === "delivered" ? counts.delivered : 0;

  return (
    <>
      <Header />
      <main className="max-w-3xl mx-auto px-4 pt-8 pb-16">

        {/* Back + title */}
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <button
              onClick={() => navigate("/")}
              className="flex items-center gap-1.5 text-sm font-poppins text-gray-400
                         hover:text-brand-primary transition-colors mb-3"
            >
              <ArrowLeft size={15} strokeWidth={2} />
              Volver al catálogo
            </button>
            <h1 className="font-poppins font-semibold italic text-brand-primary text-2xl">
              Gestión de pedidos
            </h1>
            {!isLoading && (
              <p className="font-poppins text-xs text-gray-400 mt-1">
                {unified.length} {unified.length === 1 ? "pedido" : "pedidos"} en total
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={() => setShowNewModal(true)}
            className="mt-8 flex items-center gap-2 px-4 py-2.5 rounded-xl bg-brand-primary text-white
                       text-sm font-poppins font-medium hover:bg-[#7a3e18] transition-colors shrink-0"
          >
            <Plus size={15} strokeWidth={2.5} />
            Nueva venta
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 bg-gray-100 p-1 rounded-xl mb-4 overflow-x-auto scrollbar-none">
          {TABS.map((tab) => {
            const count = tabCount(tab.id);
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-poppins font-medium",
                  "whitespace-nowrap transition-all shrink-0",
                  activeTab === tab.id
                    ? "bg-white text-brand-primary shadow-sm"
                    : "text-gray-500 hover:text-gray-700"
                )}
              >
                {tab.label}
                {count > 0 && (
                  <span className={cn(
                    "inline-flex items-center justify-center w-4 h-4 rounded-full text-[10px] font-bold",
                    activeTab === tab.id
                      ? "bg-brand-primary text-white"
                      : "bg-gray-300 text-white"
                  )}>
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Search */}
        <div className="relative mb-4">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-300 pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nombre o WhatsApp…"
            className="w-full rounded-xl border border-gray-200 pl-9 pr-9 py-2.5 text-sm
                       font-poppins text-brand-dark placeholder:text-gray-300 outline-none
                       focus:border-brand-primary focus:ring-1 focus:ring-brand-primary/20
                       transition bg-white"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-300 hover:text-gray-500"
            >
              <X size={14} />
            </button>
          )}
        </div>

        {/* Error */}
        {isError && (
          <p className="text-center font-poppins text-sm text-red-400 py-10">
            No se pudieron cargar los pedidos. Intenta de nuevo.
          </p>
        )}

        {/* Skeleton */}
        {isLoading && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            {Array.from({ length: 5 }).map((_, index) => (
              <div key={index} className="flex gap-3 px-4 py-3.5 border-b border-gray-50 last:border-b-0 animate-pulse">
                <div className="w-12 h-12 rounded-xl bg-gray-100 shrink-0" />
                <div className="flex-1 flex flex-col gap-2 justify-center">
                  <div className="h-3 bg-gray-100 rounded w-3/4" />
                  <div className="h-3 bg-gray-100 rounded w-1/2" />
                </div>
                <div className="flex flex-col gap-2 items-end">
                  <div className="h-4 bg-gray-100 rounded w-16" />
                  <div className="h-3 bg-gray-100 rounded w-12" />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Empty */}
        {!isLoading && !isError && filtered.length === 0 && (
          <div className="flex flex-col items-center gap-3 py-20 text-gray-300">
            <Package size={40} strokeWidth={1.2} />
            <p className="font-poppins text-sm text-gray-400">
              {search ? "No hay pedidos con ese criterio." : "No hay pedidos en este estado."}
            </p>
          </div>
        )}

        {/* List */}
        {!isLoading && filtered.length > 0 && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            {filtered.map((unifiedItem) =>
              unifiedItem.kind === "sale" ? (
                <SaleRow
                  key={`sale-${unifiedItem.data.id}`}
                  sale={unifiedItem.data}
                  onClick={() => setSelectedSale(unifiedItem.data)}
                />
              ) : (
                <OrderRow
                  key={`order-${unifiedItem.data.id}`}
                  order={unifiedItem.data}
                  onClick={() => setSelectedOrder(unifiedItem.data)}
                />
              )
            )}
          </div>
        )}
      </main>

      {/* Modals */}
      <AnimatePresence>
        {selectedSale && (
          <SaleDetailModal
            key={`sale-modal-${selectedSale.id}`}
            sale={selectedSale}
            onClose={() => setSelectedSale(null)}
          />
        )}
        {selectedOrder && (
          <OrderDetailModal
            key={`order-modal-${selectedOrder.id}`}
            order={selectedOrder}
            onClose={() => setSelectedOrder(null)}
          />
        )}
        {showNewModal && (
          <NewOrderModal
            key="new-order-modal"
            onClose={() => setShowNewModal(false)}
          />
        )}
      </AnimatePresence>
    </>
  );
}
