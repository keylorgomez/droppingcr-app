import { usePaged } from "../../lib/usePaged";
import MoneyInput from "../../components/ui/MoneyInput";
import ShowMore from "../../components/ui/ShowMore";
import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Plus, Wallet, TrendingUp, Coins, Loader2, X, ChevronDown, AlertTriangle, CheckCircle2, XCircle } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../components/ui/Toast";
import Header from "../../components/ui/Header";
import {
  getAllPayouts, getAdminUsers, createPayout,
  type AdminPayout, type AdminUser,
} from "../../services/payoutsService";
import { fmt, formatDate } from "../../lib/formatters";
import { getFinanceSummary, periodRange } from "../../services/analyticsService";
import { PAYOUT_SHARE, PAYOUT_SHARE_LABEL, payoutAllowance } from "../../config/finance";
import { QUERY_KEYS } from "../../constants/queryKeys";

// ── Summary card ───────────────────────────────────────────────────────────

function SummaryCard({
  label, value, sub, color,
}: {
  label: string;
  value: string;
  sub?:  string;
  color: "green" | "orange" | "blue";
}) {
  const colorMap = {
    green:  "bg-green-50 text-green-700 border-green-100",
    orange: "bg-orange-50 text-orange-700 border-orange-100",
    blue:   "bg-blue-50 text-blue-700 border-blue-100",
  };
  const iconMap = {
    green:  TrendingUp,
    orange: Wallet,
    blue:   Coins,
  };
  const Icon = iconMap[color];

  return (
    <div className={`rounded-2xl border p-4 flex flex-col gap-2 ${colorMap[color]}`}>
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wider opacity-70">
          {label}
        </span>
        <Icon size={16} strokeWidth={1.8} className="opacity-50" />
      </div>
      <p className="text-xl font-bold leading-none">{value}</p>
      {sub && (
        <p className="text-[11px] opacity-60">{sub}</p>
      )}
    </div>
  );
}

// ── Register payout modal ──────────────────────────────────────────────────

function PayoutModal({
  admins,
  onClose,
  onSave,
  saving,
  allowed,
  cash,
}: {
  /** Caja del negocio: tope duro, la base rechaza un reparto mayor. */
  cash: number;
  /** Lo que se puede repartir hoy respetando el 60/40 y la plata cobrada. */
  allowed: number;
  admins:  AdminUser[];
  onClose: () => void;
  onSave:  (recipientId: string, amount: number, note: string) => void;
  saving:  boolean;
}) {
  const [recipientId, setRecipientId] = useState(admins[0]?.id ?? "");
  const [amount, setAmount]           = useState("");
  const [note, setNote]               = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = parseFloat(amount.replace(/,/g, ""));
    if (!recipientId || !parsed || parsed <= 0) return;
    onSave(recipientId, parsed, note.trim());
  }

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center
                 bg-black/40 backdrop-blur-sm px-4 pb-safe"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <motion.div
        className="w-full max-w-md bg-white rounded-3xl shadow-2xl p-6 flex flex-col gap-5"
        initial={{ y: 60, opacity: 0 }}
        animate={{ y: 0,  opacity: 1 }}
        exit={{ y: 60,    opacity: 0 }}
        transition={{ type: "spring", stiffness: 340, damping: 32 }}
      >
        {/* Header */}
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-brand-dark text-base">
            Registrar abono
          </h2>
          <button
            onClick={onClose}
            className="text-ink-400 hover:text-brand-primary transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {/* Admin selector */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-ink-500 uppercase tracking-wider">
              Admin destinatario
            </label>
            <div className="relative">
              <select
                value={recipientId}
                onChange={(e) => setRecipientId(e.target.value)}
                className="w-full appearance-none rounded-xl border border-ink-200 px-4 py-2.5
                           text-sm text-brand-dark outline-none bg-white
                           focus:border-brand-primary focus:ring-1 focus:ring-brand-primary/20
                           transition pr-9"
                required
              >
                {admins.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.first_name} {a.last_name} ({a.email})
                  </option>
                ))}
              </select>
              <ChevronDown
                size={15}
                className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-ink-400"
              />
            </div>
          </div>

          {/* Amount */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-ink-500 uppercase tracking-wider">
              Monto (₡)
            </label>
            <MoneyInput
              value={amount}
              onChange={(raw) => setAmount(raw)}
              placeholder="0"
              className="w-full rounded-xl border border-ink-200 px-4 py-2.5 text-sm
                         text-brand-dark placeholder:text-ink-300 outline-none
                         focus:border-brand-primary focus:ring-1 focus:ring-brand-primary/20
                         transition"
              required
            />
            {Number(amount) > cash ? (
              <p className="text-[11px] text-red-600 leading-snug font-semibold">
                Supera la caja del negocio ({fmt(Math.max(0, cash))}). No se puede repartir plata que no ha entrado.
              </p>
            ) : Number(amount) > allowed && (
              <p className="text-[11px] text-red-600 leading-snug">
                {allowed > 0
                  ? `Supera lo que pueden repartir hoy (${fmt(allowed)}). Se puede registrar, pero el negocio queda por debajo del 40% de reserva.`
                  : "Hoy no hay margen para repartir sin bajar la reserva del 40%. Se puede registrar igual."}
              </p>
            )}
          </div>

          {/* Note */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-ink-500 uppercase tracking-wider">
              Nota <span className="normal-case text-ink-400">(opcional)</span>
            </label>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Ej: Salario mayo, comisión, etc."
              className="w-full rounded-xl border border-ink-200 px-4 py-2.5 text-sm
                         text-brand-dark placeholder:text-ink-300 outline-none
                         focus:border-brand-primary focus:ring-1 focus:ring-brand-primary/20
                         transition"
            />
          </div>

          <button
            type="submit"
            disabled={saving || !amount || parseFloat(amount) <= 0 || Number(amount) > cash}
            className="mt-1 w-full py-3 rounded-xl bg-brand-primary text-white text-sm
                       font-medium flex items-center justify-center gap-2
                       hover:bg-[#2e2e2e] transition-colors disabled:opacity-50"
          >
            {saving && <Loader2 size={15} className="animate-spin" />}
            Guardar abono
          </button>
        </form>
      </motion.div>
    </motion.div>
  );
}

// ── Per-admin breakdown ────────────────────────────────────────────────────

function AdminBreakdown({ payouts }: { payouts: AdminPayout[] }) {
  const byAdmin = useMemo(() => {
    const map = new Map<string, { name: string; total: number; count: number }>();
    for (const p of payouts) {
      const entry = map.get(p.recipient_id) ?? { name: p.recipient_name, total: 0, count: 0 };
      entry.total += p.amount;
      entry.count += 1;
      map.set(p.recipient_id, entry);
    }
    return [...map.values()].sort((a, b) => b.total - a.total);
  }, [payouts]);

  if (byAdmin.length === 0) return null;

  return (
    <div className="flex flex-col gap-2">
      <p className="text-[11px] font-semibold uppercase tracking-widest text-ink-400">
        Por admin
      </p>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {byAdmin.map((a) => (
          <div
            key={a.name}
            className="bg-ink-50 rounded-xl px-3 py-2.5 flex flex-col gap-0.5"
          >
            <p className="text-xs font-semibold text-brand-dark truncate">{a.name}</p>
            <p className="text-sm font-bold text-brand-primary">{fmt(a.total)}</p>
            <p className="text-[10px] text-ink-400">
              {a.count} {a.count === 1 ? "abono" : "abonos"}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Distribution tracker ───────────────────────────────────────────────────

function DistributionTracker({
  netProfit, totalDistributed, adjustments,
}: {
  netProfit:        number;
  totalDistributed: number;
  adjustments:      number;
}) {
  const target      = Math.round(netProfit * PAYOUT_SHARE);
  const fundNegocio = Math.round(netProfit * (1 - PAYOUT_SHARE));
  const progress    = target > 0 ? (totalDistributed / target) * 100 : 0;
  const remaining   = target - totalDistributed;
  const exceeded    = totalDistributed > target;
  const atRisk      = !exceeded && progress >= 80;

  type ColorKey = "green" | "yellow" | "red";
  const colorKey: ColorKey = exceeded ? "red" : atRisk ? "yellow" : "green";

  const theme: Record<ColorKey, {
    bg: string; border: string; barCls: string; textCls: string;
    badgeCls: string; label: string; Icon: React.ElementType;
    trackCls: string;
  }> = {
    green: {
      bg:       "bg-green-50",
      border:   "border-green-200",
      barCls:   "bg-green-500",
      textCls:  "text-green-700",
      badgeCls: "bg-green-100 text-green-700",
      trackCls: "bg-green-100",
      label:    "Dentro del límite",
      Icon:     CheckCircle2,
    },
    yellow: {
      bg:       "bg-yellow-50",
      border:   "border-yellow-200",
      barCls:   "bg-yellow-400",
      textCls:  "text-yellow-700",
      badgeCls: "bg-yellow-100 text-yellow-700",
      trackCls: "bg-yellow-100",
      label:    "Cerca del límite",
      Icon:     AlertTriangle,
    },
    red: {
      bg:       "bg-red-50",
      border:   "border-red-200",
      barCls:   "bg-red-500",
      textCls:  "text-red-700",
      badgeCls: "bg-red-100 text-red-700",
      trackCls: "bg-red-100",
      label:    "Límite superado",
      Icon:     XCircle,
    },
  };

  const t = theme[colorKey];

  return (
    <div className={`rounded-2xl border ${t.border} ${t.bg} p-5 flex flex-col gap-4`}>
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-semibold text-sm text-brand-dark">
            Control de distribución
          </p>
          <p className="text-xs text-ink-400 mt-0.5">
            {PAYOUT_SHARE_LABEL}
          </p>
        </div>
        <span className={`flex items-center gap-1.5 shrink-0 text-[10px] font-bold uppercase
                          tracking-wider px-2.5 py-1.5 rounded-full ${t.badgeCls}`}>
          <t.Icon size={11} strokeWidth={2.5} />
          {t.label}
        </span>
      </div>

      {/* 60/40 split */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-white/60 rounded-xl px-3.5 py-3 flex flex-col gap-0.5">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-ink-400">
            {Math.round(PAYOUT_SHARE * 100)}% distribuible
          </p>
          <p className={`text-lg font-bold leading-tight ${t.textCls}`}>
            {fmt(target)}
          </p>
          <p className="text-[10px] text-ink-400">
            del total de ganancias
          </p>
        </div>
        <div className="bg-white/60 rounded-xl px-3.5 py-3 flex flex-col gap-0.5">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-ink-400">
            {Math.round((1 - PAYOUT_SHARE) * 100)}% fondo negocio
          </p>
          <p className="text-lg font-bold text-brand-dark leading-tight">
            {fmt(fundNegocio)}
          </p>
          <p className="text-[10px] text-ink-400">
            reserva del negocio
          </p>
        </div>
      </div>

      {/* Progress bar */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <span className="text-xs text-ink-500">
            Distribuido: <span className="font-semibold text-brand-dark">
              {fmt(totalDistributed)}
            </span>
            {adjustments !== 0 && (
              <span className="text-ink-400"> (neto de ajuste de conciliación {fmt(adjustments)})</span>
            )}
          </span>
          <span className={`text-xs font-bold ${t.textCls}`}>
            {Math.min(progress, 999).toFixed(1)}%
          </span>
        </div>

        {/* Track */}
        <div className={`relative h-3.5 rounded-full overflow-hidden ${t.trackCls}`}>
          {/* Filled bar */}
          <div
            className={`absolute inset-y-0 left-0 rounded-full transition-all duration-700 ${t.barCls}`}
            style={{ width: `${Math.min(progress, 100)}%` }}
          />
          {/* 80% warning marker */}
          <div
            className="absolute inset-y-0 w-px bg-white/60"
            style={{ left: "80%" }}
          />
        </div>

        {/* Labels under bar */}
        <div className="flex items-center justify-between text-[11px]">
          <span className="text-ink-400">
            Objetivo: {fmt(target)}
          </span>
          {exceeded ? (
            <span className="font-semibold text-red-600">
              Excedido en {fmt(Math.abs(remaining))}
            </span>
          ) : (
            <span className={`font-semibold ${t.textCls}`}>
              Disponible: {fmt(remaining)}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Row skeleton ───────────────────────────────────────────────────────────

function RowSkeleton() {
  return (
    <tr className="border-t border-ink-50">
      {[1, 2, 3, 4].map((i) => (
        <td key={i} className="px-4 py-3">
          <div className="h-3 bg-ink-100 rounded animate-pulse" style={{ width: `${55 + i * 10}%` }} />
        </td>
      ))}
    </tr>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────

export default function PayoutsPage() {
  const { user }    = useAuth();
  const navigate    = useNavigate();
  const { showToast } = useToast();
  const queryClient = useQueryClient();

  const [modalOpen, setModalOpen]     = useState(false);
  const [filterAdmin, setFilterAdmin] = useState("");

  const { data: payouts = [], isLoading: loadingPayouts } = useQuery({
    queryKey: QUERY_KEYS.ADMIN_PAYOUTS,
    queryFn:  getAllPayouts,
  });

  const { data: admins = [], isLoading: loadingAdmins } = useQuery({
    queryKey: QUERY_KEYS.ADMIN_USERS,
    queryFn:  getAdminUsers,
  });

  // Utilidad neta = margen − gastos operativos (la compra de mercadería ya
  // está en el costo). Disponible = eso − lo que falta cobrar − lo repartido.
  const { data: finance, isLoading: loadingFinance } = useQuery({
    queryKey: QUERY_KEYS.FINANCE_SUMMARY("all"),
    queryFn:  () => getFinanceSummary(periodRange("all")),
  });

  const loadingProfit      = loadingFinance;
  const loadingDistributed = loadingFinance;
  const netProfit          = finance?.all_time_net ?? 0;
  const totalDistributed   = finance?.distributed  ?? 0;
  const receivables        = finance?.receivables  ?? 0;
  // Caja del negocio: toda la ganancia cobrada que no se ha repartido.
  const cash               = finance?.available    ?? 0;
  // Lo que todavía permite la regla 60/40 sobre la utilidad.
  // Lo que se puede repartir hoy: lo que permite la regla, pero nunca más de
  // lo que hay en caja (lo que falta cobrar no se puede repartir).
  const { rule: ruleRemaining, allowed: canDistribute } = payoutAllowance(netProfit, totalDistributed, cash);
  const perAdmin           = admins.length > 0 ? Math.floor(canDistribute / admins.length) : 0;
  const limitReason        =
    ruleRemaining <= 0
      ? `Ya repartieron ${fmt(-ruleRemaining)} por encima del ${Math.round(PAYOUT_SHARE * 100)}%. Se libera con ventas nuevas.`
      : cash < ruleRemaining
        ? `La regla permite ${fmt(ruleRemaining)}, pero falta cobrar: al entrar lo pendiente se libera más.`
        : `Dentro de la regla ${Math.round(PAYOUT_SHARE * 100)}/${Math.round((1 - PAYOUT_SHARE) * 100)} y con plata en caja.`;

  const saveMutation = useMutation({
    mutationFn: ({ recipientId, amount, note }: {
      recipientId: string; amount: number; note: string;
    }) => createPayout(recipientId, amount, note || null, user!.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.ADMIN_PAYOUTS });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.FINANCE });
      setModalOpen(false);
      showToast("Abono registrado correctamente.", "success");
    },
    onError: (err) => {
      showToast(err instanceof Error ? err.message : "Error al guardar.", "error");
    },
  });

  const filtered = filterAdmin
    ? payouts.filter((p) => p.recipient_id === filterAdmin)
    : payouts;

  const filteredTotal = filtered.reduce((s, p) => s + p.amount, 0);


  // Se dibujan de a 20: con cientos de filas el celular se trababa.
  const paged = usePaged(filtered, filterAdmin);
  return (
    <>
      <Header />
      <main className="max-w-4xl mx-auto px-4 pt-8 pb-16">

        {/* Back + title */}
        <div className="mb-6">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-1.5 text-sm text-ink-400
                       hover:text-brand-primary transition-colors mb-3"
          >
            <ArrowLeft size={15} strokeWidth={2} />
            Volver
          </button>
          <h1 className="font-semibold text-brand-primary text-2xl">
            Distribución de ganancias
          </h1>
          <p className="text-xs text-ink-400 mt-1">
            Registra y controla los abonos de ganancia para cada admin.
          </p>
        </div>

        {/* Lo que importa al abrir esta pantalla: cuánto se puede repartir hoy */}
        {!loadingFinance && (
          <div className={`rounded-2xl border p-5 mb-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 ${
            canDistribute > 0 ? "bg-green-50 border-green-200 text-green-800" : "bg-ink-50 border-ink-200 text-ink-800"
          }`}>
            <div className="flex flex-col gap-1">
              <span className="text-xs font-semibold uppercase tracking-wider opacity-70">Pueden repartir hoy</span>
              <span className="text-3xl font-bold leading-none tnum">{fmt(canDistribute)}</span>
              <span className="text-[12px] opacity-75">{limitReason}</span>
            </div>
            {canDistribute > 0 && admins.length > 1 && (
              <span className="text-sm font-medium opacity-80 tnum">≈ {fmt(perAdmin)} por admin</span>
            )}
          </div>
        )}

        {/* Summary cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          <SummaryCard
            label="Utilidad neta"
            value={loadingProfit ? "…" : fmt(netProfit)}
            sub={(finance?.retained ?? 0) > 0 ? "Margen − gastos + retenido" : "Margen − gastos operativos"}
            color="green"
          />
          <SummaryCard
            label="Por cobrar"
            value={loadingFinance ? "…" : fmt(receivables)}
            sub="Aún no es dinero en caja"
            color="orange"
          />
          <SummaryCard
            label="Total distribuido"
            value={loadingDistributed ? "…" : fmt(totalDistributed)}
            sub={`${payouts.length} abono${payouts.length !== 1 ? "s" : ""} registrado${payouts.length !== 1 ? "s" : ""}`}
            color="orange"
          />
          <SummaryCard
            label="Caja del negocio"
            value={loadingFinance ? "…" : fmt(cash)}
            sub="Ganancia cobrada que no se ha repartido"
            color="blue"
          />
        </div>

        {/* Distribution tracker — show once data is loaded */}
        {!loadingProfit && !loadingDistributed && netProfit > 0 && (
          <div className="mb-6">
            <DistributionTracker
              netProfit={netProfit}
              totalDistributed={totalDistributed}
              adjustments={finance?.adjustments ?? 0}
            />
          </div>
        )}

        {/* Per-admin breakdown */}
        {payouts.length > 0 && (
          <div className="mb-6">
            <AdminBreakdown payouts={payouts} />
          </div>
        )}

        {/* Controls row */}
        <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
          {/* Filter by admin */}
          <div className="relative">
            <select
              value={filterAdmin}
              onChange={(e) => setFilterAdmin(e.target.value)}
              className="appearance-none rounded-xl border border-ink-200 px-3 py-2 pr-8
                         text-sm text-brand-dark outline-none bg-white
                         focus:border-brand-primary transition"
            >
              <option value="">Todos los admins</option>
              {admins.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.first_name} {a.last_name}
                </option>
              ))}
            </select>
            <ChevronDown
              size={14}
              className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-ink-400"
            />
          </div>

          <button
            onClick={() => setModalOpen(true)}
            disabled={loadingAdmins}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-brand-primary text-white
                       text-sm font-medium hover:bg-[#2e2e2e] transition-colors
                       disabled:opacity-50 shrink-0"
          >
            <Plus size={15} strokeWidth={2.2} />
            Registrar abono
          </button>
        </div>

        {/* Table */}
        <div className="rounded-2xl border border-ink-100 overflow-hidden shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-ink-100 bg-ink-50">
                <th className="text-left px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-ink-400">
                  Fecha
                </th>
                <th className="text-left px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-ink-400">
                  Admin
                </th>
                <th className="text-right px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-ink-400">
                  Monto
                </th>
                <th className="text-left px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-ink-400 hidden sm:table-cell">
                  Nota
                </th>
                <th className="text-left px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-ink-400 hidden md:table-cell">
                  Registrado por
                </th>
              </tr>
            </thead>
            <tbody>
              {loadingPayouts && (
                <>{Array.from({ length: 5 }).map((_, i) => <RowSkeleton key={i} />)}</>
              )}

              {!loadingPayouts && filtered.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-16 text-center text-ink-400 text-sm">
                    No hay abonos registrados aún.
                  </td>
                </tr>
              )}

              {!loadingPayouts && paged.visible.map((p) => (
                <tr key={p.id} className="border-t border-ink-50 hover:bg-ink-50/60 transition-colors">
                  <td className="px-4 py-3 text-ink-500 whitespace-nowrap text-xs">
                    {formatDate(p.paid_at)}
                  </td>
                  <td className="px-4 py-3 font-medium text-brand-dark">
                    {p.recipient_name}
                  </td>
                  <td className="px-4 py-3 text-right font-semibold text-brand-primary whitespace-nowrap">
                    {fmt(p.amount)}
                  </td>
                  <td className="px-4 py-3 text-ink-400 text-xs hidden sm:table-cell max-w-[200px] truncate">
                    {p.note ?? <span className="text-ink-200">—</span>}
                  </td>
                  <td className="px-4 py-3 text-ink-400 text-xs hidden md:table-cell">
                    {p.creator_name ?? <span className="text-ink-200">—</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="px-4 pb-3">
            <ShowMore remaining={paged.remaining} pageSize={paged.pageSize} onClick={paged.showMore} />
          </div>

          {/* Footer */}
          {filtered.length > 0 && (
            <div className="border-t border-ink-100 bg-ink-50 px-4 py-2.5
                            flex items-center justify-between">
              <span className="text-xs text-ink-400">
                {filtered.length} {filtered.length === 1 ? "registro" : "registros"}
              </span>
              <span className="text-sm font-semibold text-brand-dark">
                Total: {fmt(filteredTotal)}
              </span>
            </div>
          )}
        </div>
      </main>

      {/* Modal */}
      <AnimatePresence>
        {modalOpen && (
          <PayoutModal
            admins={
              admins.length > 0
                ? admins
                : user
                  ? [{ id: user.id, first_name: user.first_name, last_name: user.last_name, email: user.email }]
                  : []
            }
            saving={saveMutation.isPending}
            allowed={canDistribute}
            cash={cash}
            onClose={() => setModalOpen(false)}
            onSave={(recipientId, amount, note) =>
              saveMutation.mutate({ recipientId, amount, note })
            }
          />
        )}
      </AnimatePresence>
    </>
  );
}
