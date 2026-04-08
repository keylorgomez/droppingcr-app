import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Search, X, Package, MessageCircle, Loader2, Check,
  Truck, MapPin, ChevronRight, ArrowLeft,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import Header from "../../components/ui/Header";
import { useToast } from "../../components/ui/Toast";
import { useAuth } from "../../context/AuthContext";
import {
  getAllSales, updateSaleAdmin,
  DELIVERY_STATUSES, SHIPPING_OPTIONS,
  deliveryStatusMeta,
  type AdminSale, type DeliveryStatus,
} from "../../services/salesService";
import { cn } from "../../lib/utils";

// ── Helpers ────────────────────────────────────────────────────────────────

const normalize = (s: string) =>
  s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("es-CR", {
    day: "numeric", month: "short", year: "numeric",
  });
}

function shippingLabel(method: string) {
  return SHIPPING_OPTIONS.find((o) => o.value === method)?.label ?? method;
}

const inputCls =
  "w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-poppins text-brand-dark " +
  "placeholder:text-gray-300 outline-none focus:border-brand-primary " +
  "focus:ring-1 focus:ring-brand-primary/20 transition";

// ── Tab config ─────────────────────────────────────────────────────────────

const TABS = [
  { id: "all",       label: "Todos",      statuses: null                          },
  { id: "pending",   label: "Pendientes", statuses: ["validating", "confirmed"]   },
  { id: "shipped",   label: "Enviados",   statuses: ["shipped"]                   },
  { id: "delivered", label: "Entregados", statuses: ["delivered"]                 },
] as const;

type TabId = typeof TABS[number]["id"];

// ── Order Row ──────────────────────────────────────────────────────────────

function OrderRow({ sale, onClick }: { sale: AdminSale; onClick: () => void }) {
  const status = deliveryStatusMeta(sale.delivery_status);
  const total  = sale.sale_price + sale.shipping_cost;
  const isPersonal = sale.shipping_method === "personal_grecia";

  return (
    <motion.button
      type="button"
      onClick={onClick}
      whileHover={{ backgroundColor: "#fafafa" }}
      className="w-full flex items-center gap-3 px-4 py-3.5 border-b border-gray-50
                 text-left transition-colors last:border-b-0"
    >
      {/* Product image */}
      <div className="w-12 h-12 rounded-xl overflow-hidden bg-gray-50 border border-gray-100 shrink-0">
        {sale.image_url
          ? <img src={sale.image_url} alt={sale.product_name} className="w-full h-full object-cover" />
          : <Package size={18} className="m-auto mt-3 text-gray-200" />
        }
      </div>

      {/* Main info */}
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
            : <Truck   size={10} className="text-gray-300 shrink-0" />
          }
          <span className="text-[10px] font-poppins text-gray-300 truncate">
            {shippingLabel(sale.shipping_method)}
          </span>
        </div>
      </div>

      {/* Right: status + amount */}
      <div className="flex flex-col items-end gap-1.5 shrink-0">
        <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5
                          rounded-full font-poppins ${status.bgCls}`}>
          {status.label}
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

// ── Order Modal ────────────────────────────────────────────────────────────

function OrderModal({ sale, onClose }: { sale: AdminSale; onClose: () => void }) {
  const { showToast }  = useToast();
  const queryClient    = useQueryClient();

  const [deliveryStatus, setDeliveryStatus] = useState<DeliveryStatus>(
    sale.delivery_status as DeliveryStatus
  );
  const [trackingNumber, setTrackingNumber] = useState(sale.tracking_number ?? "");
  const [note,           setNote]           = useState(sale.note ?? "");
  const [trackingError,  setTrackingError]  = useState("");

  const total     = sale.sale_price + sale.shipping_cost;
  const remaining = Math.max(0, total - sale.total_paid);
  const isShipped = deliveryStatus === "shipped";
  const hasPhone  = !!sale.guest_phone;
  const isCorreos = sale.shipping_method.startsWith("correos");

  const mutation = useMutation({
    mutationFn: () => updateSaleAdmin(
      sale.id,
      deliveryStatus,
      trackingNumber.trim() || null,
      note.trim() || null
    ),
    onSuccess: () => {
      showToast("Pedido actualizado correctamente.", "success");
      queryClient.invalidateQueries({ queryKey: ["admin-sales"] });
      onClose();
    },
    onError: (err: Error) => showToast(err.message, "error"),
  });

  function handleSave() {
    if (isShipped && isCorreos && !trackingNumber.trim()) {
      setTrackingError("El número de guía es requerido cuando el envío es por Correos CR.");
      return;
    }
    setTrackingError("");
    mutation.mutate();
  }

  // WhatsApp notification message
  const waMessage = trackingNumber.trim()
    ? `¡Buenas! Te saluda Dropping CR 👋\n\nTu pedido ya va en camino 📦\n\nEl número de guía de Correos CR es: *${trackingNumber.trim()}*\n\nPodés rastrearlo en https://rastrea.correos.go.cr o en tu perfil de nuestra página. ¡Cualquier duda estamos aquí!`
    : `¡Buenas! Te saluda Dropping CR 👋\n\nTu pedido ya va en camino 🚚\n\nEn breve recibirás más información sobre la entrega. ¡Cualquier duda estamos aquí!`;

  const waUrl = sale.guest_phone
    ? `https://wa.me/${sale.guest_phone.replace(/\D/g, "")}?text=${encodeURIComponent(waMessage)}`
    : null;

  return (
    <>
      {/* Backdrop + centering container */}
      <motion.div
        key="backdrop"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/40 z-40 backdrop-blur-sm
                   flex items-center justify-center px-4"
        onClick={onClose}
      >
      {/* Modal */}
      <motion.div
        key="modal"
        initial={{ opacity: 0, scale: 0.97, y: 16 }}
        animate={{ opacity: 1, scale: 1,    y: 0  }}
        exit={{ opacity: 0,    scale: 0.97, y: 8  }}
        transition={{ type: "spring", stiffness: 340, damping: 30 }}
        className="w-full max-w-md bg-white rounded-2xl shadow-xl flex flex-col
                   max-h-[92vh] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start gap-3 px-5 pt-5 pb-4 border-b border-gray-100">
          <div className="w-12 h-12 rounded-xl overflow-hidden bg-gray-50 border border-gray-100 shrink-0">
            {sale.image_url
              ? <img src={sale.image_url} alt={sale.product_name} className="w-full h-full object-cover" />
              : <Package size={18} className="m-auto mt-3 text-gray-200" />
            }
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-poppins font-semibold text-sm italic text-brand-primary leading-snug line-clamp-2">
              {sale.product_name}
            </p>
            <p className="font-poppins text-xs text-gray-400 mt-0.5">
              Talla {sale.variant_size} · {formatDate(sale.sold_at)}
            </p>
            {sale.guest_name && (
              <p className="font-poppins text-xs text-brand-dark mt-0.5 font-medium">
                {sale.guest_name}
                {sale.guest_phone && (
                  <span className="text-gray-400 font-normal"> · {sale.guest_phone}</span>
                )}
              </p>
            )}
          </div>
          <button onClick={onClose} className="text-gray-300 hover:text-gray-500 transition-colors shrink-0 mt-0.5">
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex flex-col gap-4 px-5 py-5">

          {/* Payment summary */}
          <div className="rounded-xl bg-gray-50 px-4 py-3 grid grid-cols-3 gap-2 text-center">
            <div>
              <p className="text-[10px] font-poppins text-gray-400 uppercase tracking-wider mb-0.5">Total</p>
              <p className="font-poppins font-semibold text-sm text-brand-dark">
                ₡{total.toLocaleString("en-US")}
              </p>
              <p className="text-[10px] font-poppins text-gray-300">
                +₡{sale.shipping_cost.toLocaleString("en-US")} envío
              </p>
            </div>
            <div className="border-x border-gray-200">
              <p className="text-[10px] font-poppins text-gray-400 uppercase tracking-wider mb-0.5">Abonado</p>
              <p className="font-poppins font-semibold text-sm text-green-600">
                ₡{sale.total_paid.toLocaleString("en-US")}
              </p>
            </div>
            <div>
              <p className="text-[10px] font-poppins text-gray-400 uppercase tracking-wider mb-0.5">Saldo</p>
              <p className={cn(
                "font-poppins font-semibold text-sm",
                remaining > 0 ? "text-red-500" : "text-green-600"
              )}>
                {remaining > 0 ? `₡${remaining.toLocaleString("en-US")}` : "Pagado ✓"}
              </p>
            </div>
          </div>

          {/* Delivery status */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-gray-500 font-poppins uppercase tracking-wider">
              Estado de entrega
            </label>
            <div className="grid grid-cols-1 gap-1.5">
              {DELIVERY_STATUSES.map((s) => (
                <label
                  key={s.value}
                  onClick={() => setDeliveryStatus(s.value as DeliveryStatus)}
                  className={cn(
                    "flex items-center gap-3 rounded-xl border px-3.5 py-2.5 cursor-pointer transition-all",
                    deliveryStatus === s.value
                      ? "border-brand-primary bg-brand-primary/5"
                      : "border-gray-200 hover:border-gray-300"
                  )}
                >
                  <span className={cn(
                    "w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors",
                    deliveryStatus === s.value ? "border-brand-primary" : "border-gray-300"
                  )}>
                    {deliveryStatus === s.value && (
                      <span className="w-2 h-2 rounded-full bg-brand-primary" />
                    )}
                  </span>
                  <span className={cn(
                    "text-xs font-bold uppercase tracking-wider px-2 py-0.5 rounded-full font-poppins",
                    s.bgCls
                  )}>
                    {s.label}
                  </span>
                </label>
              ))}
            </div>
          </div>

          {/* Tracking number */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-gray-500 font-poppins uppercase tracking-wider">
              N.° de guía
              {isShipped && isCorreos && (
                <span className="ml-1 text-red-400 normal-case font-normal">(requerido)</span>
              )}
              {(!isShipped || !isCorreos) && (
                <span className="ml-1 text-gray-300 normal-case font-normal">(opcional)</span>
              )}
            </label>
            <input
              type="text"
              value={trackingNumber}
              onChange={(e) => { setTrackingNumber(e.target.value); setTrackingError(""); }}
              placeholder="Ej: CR123456789CR"
              className={cn(inputCls, trackingError && "border-red-300 focus:border-red-400 focus:ring-red-100")}
            />
            {trackingError && (
              <span className="text-[11px] text-red-500 font-poppins">{trackingError}</span>
            )}
          </div>

          {/* Internal notes */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-gray-500 font-poppins uppercase tracking-wider">
              Notas internas
              <span className="ml-1 text-gray-300 normal-case font-normal">(solo admin)</span>
            </label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
              placeholder="Observaciones del pedido…"
              className={cn(inputCls, "resize-none")}
            />
          </div>

          {/* WhatsApp notify — only when shipped + has phone */}
          {isShipped && hasPhone && waUrl && (
            <a
              href={waUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 w-full py-3 rounded-xl
                         bg-[#25D366] text-white text-sm font-poppins font-medium
                         hover:bg-[#1da851] transition-colors"
            >
              <MessageCircle size={16} strokeWidth={2} />
              Notificar envío por WhatsApp
            </a>
          )}
        </div>

        {/* Footer */}
        <div className="flex gap-3 px-5 py-4 border-t border-gray-100">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-poppins
                       text-gray-500 hover:border-gray-300 transition-colors"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={mutation.isPending}
            className="flex-1 py-2.5 rounded-xl bg-brand-primary text-white text-sm font-poppins
                       font-medium flex items-center justify-center gap-2
                       hover:bg-[#7a3e18] transition-colors disabled:opacity-60"
          >
            {mutation.isPending
              ? <Loader2 size={14} className="animate-spin" />
              : <Check size={14} strokeWidth={2.5} />
            }
            Guardar cambios
          </button>
        </div>
      </motion.div>
      </motion.div>
    </>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────

export default function OrdersPage() {
  const { user }   = useAuth();
  const navigate   = useNavigate();

  const [activeTab,    setActiveTab]    = useState<TabId>("all");
  const [search,       setSearch]       = useState("");
  const [selectedSale, setSelectedSale] = useState<AdminSale | null>(null);

  // Redirect non-admins
  if (user && user.role !== "admin") { navigate("/"); return null; }

  // eslint-disable-next-line react-hooks/rules-of-hooks
  useEffect(() => { window.scrollTo({ top: 0, behavior: "instant" }); }, []);

  const { data: sales = [], isLoading, isError } = useQuery({
    queryKey: ["admin-sales"],
    queryFn:  getAllSales,
  });

  // Tab counts
  const counts = useMemo(() => {
    const pending   = sales.filter((s) => ["validating", "confirmed"].includes(s.delivery_status)).length;
    const shipped   = sales.filter((s) => s.delivery_status === "shipped").length;
    const delivered = sales.filter((s) => s.delivery_status === "delivered").length;
    return { pending, shipped, delivered, all: sales.length };
  }, [sales]);

  // Filter by tab
  const byTab = useMemo(() => {
    const tab = TABS.find((t) => t.id === activeTab);
    if (!tab?.statuses) return sales;
    return sales.filter((s) => (tab.statuses as readonly string[]).includes(s.delivery_status));
  }, [sales, activeTab]);

  // Filter by search
  const filtered = useMemo(() => {
    const q = normalize(search.trim());
    if (!q) return byTab;
    return byTab.filter((s) =>
      normalize(s.guest_name ?? "").includes(q) ||
      (s.guest_phone ?? "").replace(/\D/g, "").includes(q.replace(/\D/g, ""))
    );
  }, [byTab, search]);

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
            Gestión de pedidos
          </h1>
          {!isLoading && (
            <p className="font-poppins text-xs text-gray-400 mt-1">
              {sales.length} {sales.length === 1 ? "pedido" : "pedidos"} en total
            </p>
          )}
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

        {/* List */}
        {isError && (
          <p className="text-center font-poppins text-sm text-red-400 py-10">
            No se pudieron cargar los pedidos. Intenta de nuevo.
          </p>
        )}

        {isLoading && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex gap-3 px-4 py-3.5 border-b border-gray-50 last:border-b-0 animate-pulse">
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

        {!isLoading && !isError && filtered.length === 0 && (
          <div className="flex flex-col items-center gap-3 py-20 text-gray-300">
            <Package size={40} strokeWidth={1.2} />
            <p className="font-poppins text-sm text-gray-400">
              {search ? "No hay pedidos con ese criterio." : "No hay pedidos en este estado."}
            </p>
          </div>
        )}

        {!isLoading && filtered.length > 0 && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            {filtered.map((sale) => (
              <OrderRow
                key={sale.id}
                sale={sale}
                onClick={() => setSelectedSale(sale)}
              />
            ))}
          </div>
        )}
      </main>

      {/* Modal */}
      <AnimatePresence>
        {selectedSale && (
          <OrderModal
            key={selectedSale.id}
            sale={selectedSale}
            onClose={() => setSelectedSale(null)}
          />
        )}
      </AnimatePresence>
    </>
  );
}
