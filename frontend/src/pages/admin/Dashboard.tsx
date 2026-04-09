import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  ResponsiveContainer, AreaChart, Area,
  BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from "recharts";
import { ArrowLeft, TrendingUp, DollarSign, AlertCircle, ShoppingBag } from "lucide-react";
import Header from "../../components/ui/Header";
import { useAuth } from "../../context/AuthContext";
import {
  getDashboardStats, getSalesVsCostsLast30Days,
  getTopProducts, getDeliveryStatusDistribution,
} from "../../services/analyticsService";

// ── Formatters ─────────────────────────────────────────────────────────────

const fmt = (n: number) =>
  n >= 1_000_000 ? `₡${(n / 1_000_000).toFixed(1)}M`
  : n >= 1_000   ? `₡${(n / 1_000).toFixed(0)}k`
  : `₡${n.toLocaleString("en-US")}`;

const fmtFull = (n: number) => `₡${n.toLocaleString("en-US")}`;

// ── Custom Tooltip ─────────────────────────────────────────────────────────

function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: "white", border: "1px solid #f3f4f6",
      borderRadius: 12, padding: "10px 14px",
      fontFamily: "Poppins, sans-serif", fontSize: 12,
      boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
    }}>
      {label && <p style={{ color: "#9ca3af", marginBottom: 6, fontSize: 11 }}>{label}</p>}
      {payload.map((entry: any) => (
        <p key={entry.name} style={{ color: entry.color ?? entry.fill, fontWeight: 600, margin: "2px 0" }}>
          {entry.name}: {fmtFull(entry.value)}
        </p>
      ))}
    </div>
  );
}

// ── KPI Card ───────────────────────────────────────────────────────────────

function KPICard({
  title, value, sub, icon: Icon, accent,
}: {
  title: string; value: string; sub?: string;
  icon: React.ElementType; accent: string;
}) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-poppins font-semibold uppercase tracking-widest text-gray-400">
          {title}
        </p>
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${accent}`}>
          <Icon size={17} strokeWidth={1.8} />
        </div>
      </div>
      <div>
        <p className="font-poppins font-bold text-2xl text-brand-dark leading-none">{value}</p>
        {sub && <p className="font-poppins text-xs text-gray-400 mt-1">{sub}</p>}
      </div>
    </div>
  );
}

// ── Chart Card wrapper ─────────────────────────────────────────────────────

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
      <p className="font-poppins font-semibold text-sm text-brand-dark mb-5">{title}</p>
      {children}
    </div>
  );
}

// ── Skeleton ───────────────────────────────────────────────────────────────

function Skeleton({ className }: { className?: string }) {
  return <div className={`animate-pulse rounded-xl bg-gray-100 ${className ?? ""}`} />;
}

// ── Page ───────────────────────────────────────────────────────────────────

export default function Dashboard() {
  const { user }  = useAuth();
  const navigate  = useNavigate();

  useEffect(() => { window.scrollTo({ top: 0, behavior: "instant" }); }, []);

  if (user && user.role !== "admin") { navigate("/"); return null; }

  const { data: stats,    isLoading: loadingStats    } = useQuery({ queryKey: ["dash-stats"],    queryFn: getDashboardStats });
  const { data: areaData, isLoading: loadingArea     } = useQuery({ queryKey: ["dash-area"],     queryFn: getSalesVsCostsLast30Days });
  const { data: topProds, isLoading: loadingTop      } = useQuery({ queryKey: ["dash-top"],      queryFn: () => getTopProducts(5) });
  const { data: pie,      isLoading: loadingPie      } = useQuery({ queryKey: ["dash-pie"],      queryFn: getDeliveryStatusDistribution });

  const margin = stats && stats.totalRevenue > 0
    ? ((stats.netProfit / stats.totalRevenue) * 100).toFixed(1)
    : "0";

  return (
    <>
      <Header />
      <main className="max-w-5xl mx-auto px-4 pt-8 pb-16 flex flex-col gap-6">

        {/* Header */}
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
            Panel Admin
          </h1>
          <p className="font-poppins text-xs text-gray-400 mt-1">
            Métricas en tiempo real · Últimos 30 días en gráficos
          </p>
        </div>

        {/* ── KPI Cards ────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {loadingStats ? (
            Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-28 rounded-2xl" />
            ))
          ) : (
            <>
              <KPICard
                title="Ventas totales"
                value={fmtFull(stats?.totalRevenue ?? 0)}
                sub={`${stats?.totalSales ?? 0} pedidos`}
                icon={ShoppingBag}
                accent="bg-brand-primary/10 text-brand-primary"
              />
              <KPICard
                title="Ganancia neta"
                value={fmtFull(stats?.netProfit ?? 0)}
                sub={`Margen ${margin}%`}
                icon={TrendingUp}
                accent="bg-green-50 text-green-600"
              />
              <KPICard
                title="Deuda pendiente"
                value={fmtFull(stats?.pendingDebt ?? 0)}
                sub="Saldo por cobrar"
                icon={AlertCircle}
                accent="bg-red-50 text-red-500"
              />
              <KPICard
                title="Costo total"
                value={fmtFull((stats?.totalRevenue ?? 0) - (stats?.netProfit ?? 0))}
                sub="Suma de costos"
                icon={DollarSign}
                accent="bg-brand-accent/10 text-brand-accent"
              />
            </>
          )}
        </div>

        {/* ── AreaChart: Ventas vs Costos 30 días ──────────────────── */}
        <ChartCard title="Ventas vs Costos — últimos 30 días">
          {loadingArea ? (
            <Skeleton className="h-64" />
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <AreaChart data={areaData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="gVentas" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#975023" stopOpacity={0.18} />
                    <stop offset="95%" stopColor="#975023" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gCostos" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#a26720" stopOpacity={0.14} />
                    <stop offset="95%" stopColor="#a26720" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 10, fontFamily: "Poppins", fill: "#9ca3af" }}
                  tickLine={false} axisLine={false}
                  interval={Math.floor((areaData?.length ?? 30) / 6)}
                />
                <YAxis
                  tickFormatter={fmt}
                  tick={{ fontSize: 10, fontFamily: "Poppins", fill: "#9ca3af" }}
                  tickLine={false} axisLine={false} width={52}
                />
                <Tooltip content={<ChartTooltip />} />
                <Legend
                  iconType="circle" iconSize={8}
                  wrapperStyle={{ fontFamily: "Poppins", fontSize: 11, paddingTop: 8 }}
                />
                <Area type="monotone" dataKey="ventas" name="Ventas"
                  stroke="#975023" strokeWidth={2}
                  fill="url(#gVentas)" dot={false} activeDot={{ r: 4 }} />
                <Area type="monotone" dataKey="costos" name="Costos"
                  stroke="#a26720" strokeWidth={2}
                  fill="url(#gCostos)" dot={false} activeDot={{ r: 4 }} />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        {/* ── BarChart + PieChart ───────────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

          {/* Top 5 productos */}
          <ChartCard title="Top 5 productos más vendidos">
            {loadingTop ? (
              <Skeleton className="h-56" />
            ) : !topProds?.length ? (
              <p className="text-xs font-poppins text-gray-400 text-center py-16">Sin datos aún.</p>
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
                    tick={{ fontSize: 10, fontFamily: "Poppins", fill: "#9ca3af" }}
                    tickLine={false} axisLine={false}
                  />
                  <YAxis
                    type="category" dataKey="name" width={90}
                    tick={{ fontSize: 10, fontFamily: "Poppins", fill: "#6b7280" }}
                    tickLine={false} axisLine={false}
                    tickFormatter={(v: string) => v.length > 14 ? v.slice(0, 13) + "…" : v}
                  />
                  <Tooltip content={<ChartTooltip />} cursor={{ fill: "#f9f5f2" }} />
                  <Bar dataKey="revenue" name="Ingresos" fill="#975023" radius={[0, 6, 6, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </ChartCard>

          {/* Estado de pedidos */}
          <ChartCard title="Distribución por estado de entrega">
            {loadingPie ? (
              <Skeleton className="h-56" />
            ) : !pie?.length ? (
              <p className="text-xs font-poppins text-gray-400 text-center py-16">Sin datos aún.</p>
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
                    wrapperStyle={{ fontFamily: "Poppins", fontSize: 11 }}
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
