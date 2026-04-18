import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery }    from "@tanstack/react-query";
import {
  ArrowLeft, Search, X, Receipt, TrendingUp, Users, Calendar,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import Header from "../../components/ui/Header";
import { useAuth } from "../../context/AuthContext";
import {
  getPaymentsLog, deliveryStatusMeta,
  type PaymentLog,
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

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("es-CR", {
    hour: "2-digit", minute: "2-digit",
  });
}

// ── Skeleton ───────────────────────────────────────────────────────────────

function TableSkeleton() {
  return (
    <div className="flex flex-col gap-2">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="animate-pulse flex gap-3 px-4 py-3.5 border-b border-gray-50">
          <div className="h-3 bg-gray-100 rounded w-24 shrink-0" />
          <div className="h-3 bg-gray-100 rounded flex-1" />
          <div className="h-3 bg-gray-100 rounded w-20 shrink-0" />
          <div className="h-3 bg-gray-100 rounded w-16 shrink-0" />
        </div>
      ))}
    </div>
  );
}

// ── Summary card ───────────────────────────────────────────────────────────

function SummaryCard({
  icon: Icon,
  label,
  value,
  sub,
  color = "text-brand-primary",
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  sub?: string;
  color?: string;
}) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-5 py-4
                    flex items-center gap-4">
      <div className="w-10 h-10 rounded-xl bg-brand-bg flex items-center justify-center shrink-0">
        <Icon size={18} strokeWidth={1.8} className={color} />
      </div>
      <div className="min-w-0">
        <p className="text-[10px] font-poppins text-gray-400 uppercase tracking-wider">{label}</p>
        <p className={cn("font-poppins font-bold text-lg leading-tight", color)}>{value}</p>
        {sub && <p className="text-[11px] font-poppins text-gray-400">{sub}</p>}
      </div>
    </div>
  );
}

// ── Payment row ────────────────────────────────────────────────────────────

function PaymentRow({ log }: { log: PaymentLog }) {
  const status = deliveryStatusMeta(log.delivery_status);

  return (
    <motion.tr
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="border-b border-gray-50 last:border-b-0 hover:bg-gray-50/60 transition-colors"
    >
      {/* Fecha */}
      <td className="px-4 py-3 align-top shrink-0">
        <p className="text-xs font-poppins text-brand-dark whitespace-nowrap">
          {formatDate(log.paid_at)}
        </p>
        <p className="text-[10px] font-poppins text-gray-300 mt-0.5">
          {formatTime(log.paid_at)}
        </p>
      </td>

      {/* Cliente */}
      <td className="px-4 py-3 align-top min-w-0">
        <p className="text-xs font-poppins font-medium text-brand-dark truncate max-w-[140px]">
          {log.guest_name ?? <span className="text-gray-300 font-normal italic">Sin nombre</span>}
        </p>
        {log.guest_phone && (
          <p className="text-[10px] font-poppins text-gray-400 mt-0.5">
            {log.guest_phone}
          </p>
        )}
      </td>

      {/* Producto */}
      <td className="px-4 py-3 align-top min-w-0">
        <p className="text-xs font-poppins italic text-brand-primary font-semibold
                      truncate max-w-[160px] leading-snug">
          {log.product_name}
        </p>
        <span className="inline-block mt-0.5 text-[10px] font-poppins text-gray-400
                         bg-gray-100 rounded-full px-2 py-0.5">
          T.{log.variant_size}
        </span>
      </td>

      {/* Monto */}
      <td className="px-4 py-3 align-top text-right shrink-0">
        <p className="text-sm font-poppins font-bold text-green-600 whitespace-nowrap">
          +₡{log.amount.toLocaleString("en-US")}
        </p>
      </td>

      {/* Estado pedido */}
      <td className="px-4 py-3 align-top text-center shrink-0">
        <span className={cn(
          "text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full font-poppins whitespace-nowrap",
          status.bgCls
        )}>
          {status.label}
        </span>
      </td>

      {/* Nota */}
      <td className="px-4 py-3 align-top min-w-0">
        <p className="text-[11px] font-poppins text-gray-400 truncate max-w-[140px]">
          {log.note ?? <span className="text-gray-200 italic">—</span>}
        </p>
      </td>
    </motion.tr>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────

export default function PaymentsPage() {
  const { user }   = useAuth();
  const navigate   = useNavigate();
  const [search, setSearch] = useState("");

  const { data: logs = [], isLoading } = useQuery({
    queryKey: ["payments-log"],
    queryFn:  getPaymentsLog,
    staleTime: 30_000,
  });

  // Guard: solo admin
  if (user && user.role !== "admin") {
    navigate("/");
    return null;
  }

  const filtered = useMemo(() => {
    if (!search.trim()) return logs;
    const q = normalize(search.trim());
    return logs.filter((l) =>
      normalize(l.guest_name  ?? "").includes(q) ||
      normalize(l.guest_phone ?? "").includes(q) ||
      normalize(l.product_name).includes(q) ||
      normalize(l.note        ?? "").includes(q)
    );
  }, [logs, search]);

  // Summary stats
  const totalCollected = logs.reduce((s, l) => s + l.amount, 0);
  const uniqueClients  = new Set(
    logs.map((l) => l.guest_phone ?? l.guest_name ?? l.sale_id)
  ).size;

  const now       = new Date();
  const thisMonth = logs.filter((l) => {
    const d = new Date(l.paid_at);
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  });
  const thisMonthTotal = thisMonth.reduce((s, l) => s + l.amount, 0);

  return (
    <>
      <Header />
      <main className="max-w-7xl mx-auto px-4 pt-8 pb-24 md:pb-16">

        {/* Back + title */}
        <div className="mb-6">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-1.5 text-sm font-poppins text-gray-400
                       hover:text-brand-primary transition-colors mb-3"
          >
            <ArrowLeft size={15} strokeWidth={2} />
            Volver
          </button>
          <div className="flex items-center gap-2.5">
            <Receipt size={20} strokeWidth={1.8} className="text-brand-primary" />
            <h1 className="font-poppins font-semibold italic text-brand-primary text-2xl">
              Movimientos de dinero
            </h1>
          </div>
          <p className="font-poppins text-xs text-gray-400 mt-1">
            Historial de todos los abonos y pagos recibidos
          </p>
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
          <SummaryCard
            icon={TrendingUp}
            label="Total recaudado"
            value={`₡${totalCollected.toLocaleString("en-US")}`}
            sub={`${logs.length} movimientos`}
            color="text-green-600"
          />
          <SummaryCard
            icon={Calendar}
            label="Este mes"
            value={`₡${thisMonthTotal.toLocaleString("en-US")}`}
            sub={`${thisMonth.length} movimientos`}
            color="text-brand-primary"
          />
          <SummaryCard
            icon={Users}
            label="Clientes únicos"
            value={String(uniqueClients)}
            sub="con al menos un pago"
          />
        </div>

        {/* Search */}
        <div className="relative mb-4 max-w-sm">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-300" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nombre, teléfono, producto…"
            className="w-full pl-9 pr-9 py-2.5 rounded-xl border border-gray-200 text-sm
                       font-poppins text-brand-dark placeholder:text-gray-300 outline-none
                       focus:border-brand-primary focus:ring-1 focus:ring-brand-primary/20 transition"
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-300
                         hover:text-gray-500 transition-colors"
            >
              <X size={14} />
            </button>
          )}
        </div>

        {/* Table */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">

          {isLoading ? (
            <TableSkeleton />
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-20 text-gray-300">
              <Receipt size={40} strokeWidth={1.1} />
              <p className="font-poppins text-sm text-gray-400">
                {search ? "No se encontraron resultados." : "Aún no hay movimientos registrados."}
              </p>
            </div>
          ) : (
            <>
              {/* Desktop table */}
              <table className="hidden md:table w-full table-auto">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50/70">
                    {["Fecha", "Cliente", "Producto", "Monto", "Estado", "Nota"].map((h, i) => (
                      <th
                        key={h}
                        className={cn(
                          "px-4 py-2.5 text-[10px] font-poppins font-semibold text-gray-400 uppercase tracking-wider whitespace-nowrap",
                          i === 3 ? "text-right" : i === 4 ? "text-center" : "text-left"
                        )}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  <AnimatePresence>
                    {filtered.map((log) => (
                      <PaymentRow key={log.id} log={log} />
                    ))}
                  </AnimatePresence>
                </tbody>
              </table>

              {/* Mobile cards */}
              <div className="md:hidden flex flex-col divide-y divide-gray-50">
                <AnimatePresence>
                  {filtered.map((log) => (
                    <MobilePaymentCard key={log.id} log={log} />
                  ))}
                </AnimatePresence>
              </div>
            </>
          )}

          {/* Footer count */}
          {!isLoading && filtered.length > 0 && (
            <div className="px-4 py-3 border-t border-gray-50 flex items-center justify-between">
              <p className="text-[11px] font-poppins text-gray-400">
                {filtered.length} {filtered.length === 1 ? "movimiento" : "movimientos"}
                {search && ` · filtrado de ${logs.length}`}
              </p>
              <p className="text-[11px] font-poppins font-semibold text-green-600">
                Total filtrado: ₡{filtered.reduce((s, l) => s + l.amount, 0).toLocaleString("en-US")}
              </p>
            </div>
          )}
        </div>
      </main>
    </>
  );
}

// ── Mobile card ────────────────────────────────────────────────────────────

function MobilePaymentCard({ log }: { log: PaymentLog }) {
  const status = deliveryStatusMeta(log.delivery_status);
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      className="px-4 py-3.5 flex gap-3"
    >
      {/* Left: amount + date */}
      <div className="flex flex-col items-center gap-1 shrink-0 min-w-[72px]">
        <p className="text-sm font-poppins font-bold text-green-600 whitespace-nowrap">
          +₡{log.amount.toLocaleString("en-US")}
        </p>
        <p className="text-[10px] font-poppins text-gray-400 text-center leading-tight">
          {formatDate(log.paid_at)}
        </p>
      </div>

      {/* Right: info */}
      <div className="flex flex-col gap-1 flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <p className="text-xs font-poppins font-semibold italic text-brand-primary
                        leading-snug line-clamp-2 flex-1">
            {log.product_name}
            <span className="not-italic font-normal text-gray-400"> · T.{log.variant_size}</span>
          </p>
          <span className={cn(
            "shrink-0 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full font-poppins",
            status.bgCls
          )}>
            {status.label}
          </span>
        </div>
        <p className="text-[11px] font-poppins text-gray-500">
          {log.guest_name ?? <span className="italic text-gray-300">Sin nombre</span>}
          {log.guest_phone && <span className="text-gray-400"> · {log.guest_phone}</span>}
        </p>
        {log.note && (
          <p className="text-[11px] font-poppins text-gray-400 truncate">{log.note}</p>
        )}
      </div>
    </motion.div>
  );
}
