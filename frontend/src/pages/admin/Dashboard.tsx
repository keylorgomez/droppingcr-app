import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  ResponsiveContainer, AreaChart, Area,
  BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from "recharts";
import { ArrowLeft, TrendingUp, AlertCircle, ShoppingBag, Receipt, Wallet, Package, Tag } from "lucide-react";
import Header from "../../components/ui/Header";
import {
  getFinanceSummary, getDailySales, getTopProducts, getDeliveryStatusDistribution,
  periodRange, previousRange, PERIOD_LABELS, type Period,
} from "../../services/analyticsService";
import { fmt as fmtFull, fmtCompact as fmt } from "../../lib/formatters";
import { QUERY_KEYS } from "../../constants/queryKeys";

interface ChartTooltipProps {
  active?: boolean;
  payload?: Array<{ name?: string; value?: number; color?: string; fill?: string }>;
  label?: string;
}

// ── Custom Tooltip ─────────────────────────────────────────────────────────

function ChartTooltip({ active, payload, label }: ChartTooltipProps) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: "white", border: "1px solid #f3f4f6",
      borderRadius: 12, padding: "10px 14px",
      fontFamily: "Inter, sans-serif", fontSize: 12,
      boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
    }}>
      {label && <p style={{ color: "#9ca3af", marginBottom: 6, fontSize: 11 }}>{label}</p>}
      {payload.map((entry) => (
        <p key={entry.name} style={{ color: entry.color ?? entry.fill, fontWeight: 600, margin: "2px 0" }}>
          {entry.name}: {fmtFull(entry.value ?? 0)}
        </p>
      ))}
    </div>
  );
}

// ── KPI Card ───────────────────────────────────────────────────────────────

function Delta({ now, before }: { now: number; before?: number }) {
  if (before === undefined || before === 0) return null;
  const change = ((now - before) / Math.abs(before)) * 100;
  if (!Number.isFinite(change)) return null;
  const up = change >= 0;
  return (
    <span className={`ml-1.5 text-[11px] font-semibold ${up ? "text-green-600" : "text-red-500"}`}>
      {up ? "▲" : "▼"} {Math.abs(change).toFixed(0)}%
    </span>
  );
}

function KPICard({
  title, value, sub, icon: Icon, accent, delta,
}: {
  title: string; value: string; sub?: React.ReactNode;
  icon: React.ElementType; accent: string; delta?: React.ReactNode;
}) {
  return (
    <div className="bg-white rounded-2xl border border-ink-100 shadow-sm p-4 sm:p-5 flex flex-col gap-3 min-w-0">
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-semibold uppercase tracking-widest text-ink-400">
          {title}
        </p>
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${accent}`}>
          <Icon size={17} strokeWidth={1.8} />
        </div>
      </div>
      <div>
        <p className="font-bold text-xl sm:text-2xl text-brand-dark leading-none tnum">
          {value}{delta}
        </p>
        {sub && <p className="text-xs text-ink-400 mt-1">{sub}</p>}
      </div>
    </div>
  );
}

// ── Chart Card wrapper ─────────────────────────────────────────────────────

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl border border-ink-100 shadow-sm p-5">
      <p className="font-semibold text-sm text-brand-dark mb-5">{title}</p>
      {children}
    </div>
  );
}

// ── Skeleton ───────────────────────────────────────────────────────────────

function Skeleton({ className }: { className?: string }) {
  return <div className={`animate-pulse rounded-xl bg-ink-100 ${className ?? ""}`} />;
}

// ── Page ───────────────────────────────────────────────────────────────────

const PERIODS: Period[] = ["month", "last_month", "30d", "year", "all"];

export default function Dashboard() {
  const navigate = useNavigate();
  const [period, setPeriod] = useState<Period>("month");

  useEffect(() => { window.scrollTo({ top: 0, behavior: "instant" }); }, []);

  const range    = periodRange(period);
  const previous = previousRange(period);

  const { data: stats,    isLoading: loadingStats, error: statsError } = useQuery({ queryKey: QUERY_KEYS.FINANCE_SUMMARY(period), queryFn: () => getFinanceSummary(range) });
  const { data: before }                            = useQuery({ queryKey: QUERY_KEYS.FINANCE_SUMMARY(`${period}-prev`), queryFn: () => getFinanceSummary(previous!), enabled: !!previous });
  const { data: areaData, isLoading: loadingArea  } = useQuery({ queryKey: QUERY_KEYS.DASH_AREA(period), queryFn: () => getDailySales(range) });
  const { data: topProds, isLoading: loadingTop   } = useQuery({ queryKey: QUERY_KEYS.DASH_TOP(period),  queryFn: () => getTopProducts(5, range) });
  const { data: pie,      isLoading: loadingPie   } = useQuery({ queryKey: QUERY_KEYS.DASH_PIE(period),  queryFn: () => getDeliveryStatusDistribution(range) });

  const marginPct = stats && stats.revenue > 0 ? ((stats.gross_margin / stats.revenue) * 100).toFixed(1) : "0";
  const avgTicket = stats && stats.tickets > 0 ? stats.revenue / stats.tickets : 0;
  const avgBefore = before && before.tickets > 0 ? before.revenue / before.tickets : undefined;

  return (
    <>
      <Header />
      <main className="max-w-5xl mx-auto px-4 pt-8 pb-16 flex flex-col gap-6">

        {/* Header */}
        <div>
          <button
            onClick={() => navigate("/")}
            className="flex items-center gap-1.5 text-sm text-ink-400
                       hover:text-brand-primary transition-colors mb-3"
          >
            <ArrowLeft size={15} strokeWidth={2} />
            Volver al catálogo
          </button>
          <h1 className="font-semibold text-brand-primary text-2xl">
            Panel Admin
          </h1>
          <p className="text-xs text-ink-400 mt-1">
            Montos sin envío (el envío es dinero de paso al courier) y sin ventas canceladas.
          </p>
        </div>

        {/* Selector de periodo — se desliza en celular */}
        <div className="-mx-4 px-4 overflow-x-auto no-scrollbar">
          <div className="flex gap-2 w-max">
            {PERIODS.map((option) => (
              <button
                key={option}
                onClick={() => setPeriod(option)}
                className={`h-9 px-4 rounded-full text-xs font-semibold whitespace-nowrap transition-colors border ${
                  period === option
                    ? "bg-ink-900 text-bone border-ink-900"
                    : "bg-white text-ink-600 border-ink-200 hover:border-ink-400"
                }`}
              >
                {PERIOD_LABELS[option]}
              </button>
            ))}
          </div>
        </div>

        {/* Si la base no responde, decirlo en vez de dejar el esqueleto eterno */}
        {statsError && (
          <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            No se pudieron cargar los números: {(statsError as Error).message}
          </div>
        )}

        {/* ── KPIs del periodo ─────────────────────────────────────── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {statsError ? null : loadingStats || !stats ? (
            Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-28 rounded-2xl" />
            ))
          ) : (
            <>
              <KPICard
                title="Ventas"
                value={fmtFull(stats.revenue)}
                delta={<Delta now={stats.revenue} before={before?.revenue} />}
                sub={`${stats.tickets} ventas · ${stats.units} piezas`}
                icon={ShoppingBag}
                accent="bg-brand-primary/10 text-brand-primary"
              />
              <KPICard
                title="Margen bruto"
                value={fmtFull(stats.gross_margin)}
                delta={<Delta now={stats.gross_margin} before={before?.gross_margin} />}
                sub={`${marginPct}% sobre ventas`}
                icon={TrendingUp}
                accent="bg-green-50 text-green-600"
              />
              <KPICard
                title="Gastos operativos"
                value={fmtFull(stats.operating_expenses)}
                sub="Sin mercadería ni envíos a clientes"
                icon={Receipt}
                accent="bg-red-50 text-red-500"
              />
              <KPICard
                title="Utilidad neta"
                value={fmtFull(stats.net_profit)}
                delta={<Delta now={stats.net_profit} before={before?.net_profit} />}
                sub="Margen − gastos operativos"
                icon={Wallet}
                accent={stats.net_profit >= 0 ? "bg-green-50 text-green-600" : "bg-red-50 text-red-500"}
              />
            </>
          )}
        </div>

        {/* Envíos a clientes: dinero de paso, no es ganancia. Solo se muestra
            si lo cobrado y lo pagado a couriers cuadran. */}
        {stats && (stats.shipping_collected > 0 || stats.shipping_paid > 0) && (
          <div className="rounded-2xl border border-ink-100 bg-white px-4 py-3 text-xs text-ink-500 flex flex-wrap gap-x-4 gap-y-1">
            <span className="font-semibold text-ink-700">Envíos a clientes (no es ganancia)</span>
            <span>Cobrado {fmtFull(stats.shipping_collected)}</span>
            <span>Pagado a Correos/mensajero {fmtFull(stats.shipping_paid)}</span>
            <span className={stats.shipping_collected - stats.shipping_paid >= 0 ? "text-green-600" : "text-red-500"}>
              Diferencia {fmtFull(stats.shipping_collected - stats.shipping_paid)}
            </span>
          </div>
        )}

        {/* Encargos: plata de clientes en custodia, aparte de la ganancia */}
        {stats && stats.special_orders_active > 0 && (
          <button
            onClick={() => navigate("/admin/encargos")}
            className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-left text-xs text-amber-800
                       flex flex-wrap items-center gap-x-4 gap-y-1 hover:border-amber-300 transition-colors"
          >
            <span className="font-semibold">Encargos activos: {stats.special_orders_active}</span>
            <span>Adelantos en custodia {fmtFull(stats.special_order_advances)}</span>
            <span className="opacity-70">No es ganancia hasta entregar · Ver encargos →</span>
          </button>
        )}

        {/* ── Indicadores a hoy ────────────────────────────────────── */}
        {stats && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <KPICard
              title="Ticket promedio"
              value={fmtFull(Math.round(avgTicket))}
              delta={<Delta now={avgTicket} before={avgBefore} />}
              sub={PERIOD_LABELS[period]}
              icon={Tag}
              accent="bg-ink-50 text-ink-700"
            />
            <KPICard
              title="Por cobrar"
              value={fmtFull(stats.receivables)}
              sub="Saldo pendiente a hoy"
              icon={AlertCircle}
              accent="bg-amber-50 text-amber-600"
            />
            <KPICard
              title="Inventario"
              value={fmtFull(stats.stock_cost)}
              sub="En bodega, a costo"
              icon={Package}
              accent="bg-ink-50 text-ink-700"
            />
            <KPICard
              title="Caja del negocio"
              value={fmtFull(stats.available)}
              sub="Ganancia cobrada no repartida"
              icon={Wallet}
              accent={stats.available >= 0 ? "bg-green-50 text-green-600" : "bg-red-50 text-red-500"}
            />
          </div>
        )}

        {/* ── AreaChart: Ventas vs Costos 30 días ──────────────────── */}
        <ChartCard title={`Ventas vs costo — ${PERIOD_LABELS[period].toLowerCase()}`}>
          {loadingArea ? (
            <Skeleton className="h-64" />
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <AreaChart data={areaData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="gVentas" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#16a34a" stopOpacity={0.18} />
                    <stop offset="95%" stopColor="#16a34a" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gCostos" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#ef4444" stopOpacity={0.14} />
                    <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 10, fontFamily: "Inter", fill: "#9ca3af" }}
                  tickLine={false} axisLine={false}
                  interval={Math.floor((areaData?.length ?? 30) / 6)}
                />
                <YAxis
                  tickFormatter={fmt}
                  tick={{ fontSize: 10, fontFamily: "Inter", fill: "#9ca3af" }}
                  tickLine={false} axisLine={false} width={52}
                />
                <Tooltip content={<ChartTooltip />} />
                <Legend
                  iconType="circle" iconSize={8}
                  wrapperStyle={{ fontFamily: "Inter", fontSize: 11, paddingTop: 8 }}
                />
                <Area type="monotone" dataKey="ventas" name="Ventas"
                  stroke="#16a34a" strokeWidth={2}
                  fill="url(#gVentas)" dot={false} activeDot={{ r: 4 }} />
                <Area type="monotone" dataKey="costos" name="Costos"
                  stroke="#ef4444" strokeWidth={2}
                  fill="url(#gCostos)" dot={false} activeDot={{ r: 4 }} />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        {/* ── BarChart + PieChart ───────────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

          {/* Top 5 productos */}
          <ChartCard title="Top 5 productos (por ingresos)">
            {loadingTop ? (
              <Skeleton className="h-56" />
            ) : !topProds?.length ? (
              <p className="text-xs text-ink-400 text-center py-16">Sin datos aún.</p>
            ) : (
              <ResponsiveContainer width="100%" height={230}>
                <BarChart
                  data={topProds}
                  layout="vertical"
                  margin={{ top: 0, right: 8, left: 0, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" horizontal={false} />
                  <XAxis
                    type="number" tickFormatter={fmt}
                    tick={{ fontSize: 10, fontFamily: "Inter", fill: "#9ca3af" }}
                    tickLine={false} axisLine={false}
                  />
                  <YAxis
                    type="category" dataKey="name" width={90}
                    tick={{ fontSize: 10, fontFamily: "Inter", fill: "#6b7280" }}
                    tickLine={false} axisLine={false}
                    tickFormatter={(v: string) => v.length > 14 ? v.slice(0, 13) + "…" : v}
                  />
                  <Tooltip content={<ChartTooltip />} cursor={{ fill: "#f5f4f2" }} />
                  <Bar dataKey="revenue" name="Ingresos" fill="#0a0a0a" radius={[0, 6, 6, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </ChartCard>

          {/* Estado de pedidos */}
          <ChartCard title="Distribución por estado de entrega">
            {loadingPie ? (
              <Skeleton className="h-56" />
            ) : !pie?.length ? (
              <p className="text-xs text-ink-400 text-center py-16">Sin datos aún.</p>
            ) : (
              <ResponsiveContainer width="100%" height={230}>
                <PieChart>
                  <Pie
                    data={pie}
                    cx="50%" cy="45%"
                    innerRadius={55} outerRadius={85}
                    paddingAngle={3}
                    dataKey="value"
                    nameKey="name"
                  >
                    {pie.map((entry, i) => (
                      <Cell key={i} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip content={<ChartTooltip />} />
                  <Legend
                    iconType="circle" iconSize={8}
                    wrapperStyle={{ fontFamily: "Inter", fontSize: 11 }}
                  />
                </PieChart>
              </ResponsiveContainer>
            )}
          </ChartCard>
        </div>
      </main>
    </>
  );
}
