import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft, Loader2, CreditCard, MessageCircle,
  ChevronDown, ChevronUp, Plus, Package, Wallet, Search, X,
} from "lucide-react";
import {
  getGroupedDebts, addGeneralPayment,
  type ClientDebt, type PendingSale,
} from "../../services/salesService";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../components/ui/Toast";
import Header from "../../components/ui/Header";
import { cn } from "../../lib/utils";

// ── Helpers ────────────────────────────────────────────────────────────────

function fmt(n: number) {
  return `₡${n.toLocaleString("en-US")}`;
}

function formatPhone(raw: string | null): string | null {
  if (!raw) return null;
  const digits = raw.replace(/\D/g, "");
  return digits.length === 8 ? `506${digits}` : digits;
}

function waLink(phone: string | null, name: string | null, remaining: number): string {
  const p = formatPhone(phone) ?? "";
  const msg = encodeURIComponent(
    `Hola${name ? ` ${name}` : ""}! 👋 Te recordamos que tenés un saldo pendiente de ${fmt(remaining)} en Dropping CR. ¡Gracias! 🙌`
  );
  return `https://wa.me/${p}?text=${msg}`;
}

function timeAgo(iso: string): string {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  if (days === 0) return "Hoy";
  if (days === 1) return "Ayer";
  return `Hace ${days} días`;
}

const inputCls =
  "w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-poppins text-brand-dark " +
  "placeholder:text-gray-300 outline-none focus:border-brand-primary " +
  "focus:ring-1 focus:ring-brand-primary/20 transition";

// ── Abono General Form ─────────────────────────────────────────────────────

function AbonoGeneralForm({ client, onDone }: { client: ClientDebt; onDone: () => void }) {
  const { showToast } = useToast();
  const queryClient  = useQueryClient();
  const [amount, setAmount] = useState("");
  const [note,   setNote]   = useState("");
  const [error,  setError]  = useState("");

  const mutation = useMutation({
    mutationFn: () => addGeneralPayment(client.sales, Number(amount), note.trim() || null),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["grouped-debts"] });
      showToast("Abono registrado y distribuido.", "success");
      onDone();
    },
    onError: (err: Error) => showToast(err.message, "error"),
  });

  function handleSave() {
    const a = Number(amount);
    if (!amount || a <= 0)    { setError("Ingresa un monto válido."); return; }
    if (a > client.remaining) { setError(`Máximo ${fmt(client.remaining)}.`); return; }
    setError("");
    mutation.mutate();
  }

  return (
    <div className="flex flex-col gap-3 pt-4 border-t border-gray-100">
      <div>
        <p className="text-[10px] font-poppins text-gray-400 uppercase tracking-widest">
          Abono general — saldo pendiente: {fmt(client.remaining)}
        </p>
        <p className="text-[11px] font-poppins text-gray-400 mt-0.5">
          Se distribuirá entre las ventas más antiguas primero.
        </p>
      </div>

      <div className="grid grid-cols-[1fr_160px] gap-2">
        <div className="flex flex-col gap-1">
          <input
            type="number"
            min={1}
            max={client.remaining}
            value={amount}
            onChange={(e) => { setAmount(e.target.value); setError(""); }}
            placeholder="Monto (₡)"
            className={inputCls}
            autoFocus
          />
          {error && <span className="text-[11px] text-red-500 font-poppins">{error}</span>}
        </div>
        <input
          type="text"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Nota (opcional)"
          className={inputCls}
        />
      </div>

      <div className="flex gap-2 self-end">
        <button
          type="button"
          onClick={onDone}
          className="px-4 py-2 rounded-xl border border-gray-200 text-sm font-poppins
                     text-gray-500 hover:border-gray-300 transition-colors"
        >
          Cancelar
        </button>
        <button
          type="button"
          onClick={handleSave}
          disabled={mutation.isPending}
          className="px-4 py-2 rounded-xl bg-brand-primary text-white text-sm font-poppins
                     font-medium flex items-center gap-2
                     hover:bg-[#7a3e18] transition-colors disabled:opacity-60"
        >
          {mutation.isPending && <Loader2 size={13} className="animate-spin" />}
          Guardar abono
        </button>
      </div>
    </div>
  );
}

// ── Sale Detail Row ────────────────────────────────────────────────────────

function SaleRow({ sale }: { sale: PendingSale }) {
  const paidPct = Math.min(100, Math.round((sale.total_paid / sale.sale_price) * 100));

  return (
    <div className="flex flex-col gap-1.5 py-3 border-t border-gray-50 first:border-0">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-xs font-poppins font-medium text-brand-dark">
            {sale.product_name}
            <span className="text-gray-400 font-normal ml-1">— {sale.variant_size}</span>
          </p>
          <p className="text-[11px] font-poppins text-gray-400">{timeAgo(sale.sold_at)}</p>
          {sale.note && (
            <p className="text-[11px] font-poppins text-gray-300 italic">{sale.note}</p>
          )}
        </div>
        <div className="text-right shrink-0">
          <p className="text-[11px] font-poppins text-gray-400 line-through">{fmt(sale.sale_price)}</p>
          <p className="text-xs font-poppins font-semibold text-red-500">{fmt(sale.remaining)}</p>
        </div>
      </div>
      <div className="h-1 w-full bg-gray-100 rounded-full overflow-hidden">
        <div
          className="h-full bg-emerald-400 rounded-full transition-all duration-500"
          style={{ width: `${paidPct}%` }}
        />
      </div>
    </div>
  );
}

// ── Client Card ────────────────────────────────────────────────────────────

function ClientCard({ client }: { client: ClientDebt }) {
  const [showSales, setShowSales] = useState(false);
  const [showAbono, setShowAbono] = useState(false);

  const paidPct = Math.min(100, Math.round((client.total_paid / client.total_sale) * 100));
  const name    = client.guest_name ?? "Cliente sin nombre";

  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-5 flex flex-col gap-4">

      {/* Top row */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-poppins font-semibold text-sm text-brand-dark">{name}</p>
          {client.guest_phone && (
            <p className="font-poppins text-xs text-gray-400 mt-0.5">{client.guest_phone}</p>
          )}
          <p className="font-poppins text-[11px] text-gray-300 mt-0.5">
            {client.sales.length} {client.sales.length === 1 ? "venta pendiente" : "ventas pendientes"}
          </p>
        </div>
        {client.guest_phone && (
          <a
            href={waLink(client.guest_phone, client.guest_name, client.remaining)}
            target="_blank"
            rel="noopener noreferrer"
            className="shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#25D366]
                       text-white text-xs font-poppins font-medium hover:bg-[#1da851] transition-colors"
          >
            <MessageCircle size={13} strokeWidth={2} />
            Cobrar por WA
          </a>
        )}
      </div>

      {/* Price pills */}
      <div className="grid grid-cols-3 gap-2 text-center">
        {[
          { label: "Total",     value: fmt(client.total_sale), cls: "bg-gray-50 text-brand-dark" },
          { label: "Abonado",   value: fmt(client.total_paid), cls: "bg-emerald-50 text-emerald-600" },
          { label: "Pendiente", value: fmt(client.remaining),  cls: "bg-red-50 text-red-500" },
        ].map(({ label, value, cls }) => (
          <div key={label} className={`rounded-xl py-2.5 px-2 ${cls.split(" ")[0]}`}>
            <p className="text-[10px] font-poppins text-gray-400 uppercase tracking-wider mb-0.5">{label}</p>
            <p className={`font-poppins font-semibold text-sm ${cls.split(" ")[1]}`}>{value}</p>
          </div>
        ))}
      </div>

      {/* Progress bar */}
      <div className="flex flex-col gap-1">
        <div className="h-1.5 w-full bg-gray-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-emerald-500 rounded-full transition-all duration-500"
            style={{ width: `${paidPct}%` }}
          />
        </div>
        <p className="text-[10px] font-poppins text-gray-400 text-right">{paidPct}% pagado</p>
      </div>

      {/* Toggle: sale detail */}
      <button
        type="button"
        onClick={() => { setShowSales((v) => !v); if (showAbono) setShowAbono(false); }}
        className="flex items-center gap-1.5 text-xs font-poppins text-gray-400
                   hover:text-brand-primary transition-colors self-start"
      >
        {showSales ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
        <Package size={13} strokeWidth={1.8} />
        {showSales
          ? "Ocultar artículos"
          : `Ver ${client.sales.length} ${client.sales.length === 1 ? "artículo" : "artículos"}`}
      </button>

      {showSales && (
        <div className="rounded-xl border border-gray-100 px-4 -mt-2">
          {client.sales.map((sale) => (
            <SaleRow key={sale.id} sale={sale} />
          ))}
        </div>
      )}

      {/* Abono button */}
      <button
        type="button"
        onClick={() => { setShowAbono((v) => !v); if (showSales) setShowSales(false); }}
        className={cn(
          "flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-poppins font-medium transition-colors self-start",
          showAbono
            ? "bg-brand-primary text-white hover:bg-[#7a3e18]"
            : "border border-gray-200 text-brand-primary hover:border-brand-primary"
        )}
      >
        <Plus size={13} strokeWidth={2.5} />
        Registrar Abono General
      </button>

      {showAbono && (
        <AbonoGeneralForm client={client} onDone={() => setShowAbono(false)} />
      )}
    </div>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────

export default function DebtPage() {
  const navigate = useNavigate();
  const { user, isLoading: authLoading } = useAuth();

  if (!authLoading && (!user || user.role !== "admin")) {
    navigate("/", { replace: true });
  }

  useEffect(() => { window.scrollTo({ top: 0, behavior: "instant" }); }, []);

  const { data: clients = [], isLoading, isError, error } = useQuery({
    queryKey: ["grouped-debts"],
    queryFn:  getGroupedDebts,
  });

  const [search, setSearch] = useState("");

  const normalize = (s: string) =>
    s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

  const filtered = search.trim()
    ? clients.filter((c) => {
        const q         = normalize(search.trim());
        const phoneQ    = q.replace(/\D/g, "");
        const nameMatch = normalize(c.guest_name ?? "").includes(q);
        const phoneMatch = phoneQ.length > 0 &&
                           (c.guest_phone ?? "").replace(/\D/g, "").includes(phoneQ);
        return nameMatch || phoneMatch;
      })
    : clients;

  const grandTotalSale = clients.reduce((sum, c) => sum + c.total_sale, 0);
  const grandTotalPaid = clients.reduce((sum, c) => sum + c.total_paid, 0);
  const grandTotal     = clients.reduce((sum, c) => sum + c.remaining, 0);

  if (authLoading) return null;

  return (
    <>
      <Header />
      <main className="max-w-2xl mx-auto px-4 py-8 pb-16">

        {/* Back + title */}
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-1.5 text-xs font-poppins text-gray-400
                     hover:text-brand-primary transition-colors mb-6 -ml-0.5"
        >
          <ArrowLeft size={15} strokeWidth={1.8} />
          Volver
        </button>

        <div className="flex items-center gap-2.5 mb-1">
          <CreditCard size={18} className="text-brand-accent" strokeWidth={1.8} />
          <h1 className="font-poppins font-semibold text-xl text-brand-dark">Cobros Pendientes</h1>
        </div>
        <p className="font-poppins text-xs text-gray-400 mb-8">
          Agrupado por cliente. Los abonos se distribuyen de la venta más antigua a la más reciente.
        </p>

        {/* ── Grand total banner ─────────────────────────────────── */}
        {!isLoading && clients.length > 0 && (
          <div className="bg-brand-dark rounded-2xl p-5 mb-6 flex flex-col gap-4">
            <div className="flex items-center gap-2">
              <Wallet size={15} className="text-brand-bg" strokeWidth={1.8} />
              <p className="font-poppins text-xs text-brand-bg/70 uppercase tracking-widest">
                Resumen global
              </p>
            </div>

            <div className="grid grid-cols-3 gap-3 text-center">
              <div>
                <p className="text-[10px] font-poppins text-white/50 uppercase tracking-wider mb-0.5">
                  Deudores
                </p>
                <p className="font-poppins font-bold text-2xl text-white">{clients.length}</p>
              </div>
              <div>
                <p className="text-[10px] font-poppins text-white/50 uppercase tracking-wider mb-0.5">
                  Abonado
                </p>
                <p className="font-poppins font-bold text-xl text-emerald-400">{fmt(grandTotalPaid)}</p>
              </div>
              <div>
                <p className="text-[10px] font-poppins text-white/50 uppercase tracking-wider mb-0.5">
                  Por cobrar
                </p>
                <p className="font-poppins font-bold text-xl text-red-400">{fmt(grandTotal)}</p>
              </div>
            </div>

            {grandTotalSale > 0 && (
              <div className="flex flex-col gap-1">
                <div className="h-1.5 w-full bg-white/10 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-emerald-400 rounded-full transition-all duration-700"
                    style={{ width: `${Math.round((grandTotalPaid / grandTotalSale) * 100)}%` }}
                  />
                </div>
                <p className="text-[10px] font-poppins text-white/40 text-right">
                  {Math.round((grandTotalPaid / grandTotalSale) * 100)}% del total cobrado
                </p>
              </div>
            )}
          </div>
        )}

        {/* ── Search ──────────────────────────────────────────────── */}
        {!isLoading && clients.length > 0 && (
          <div className="relative mb-4">
            <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-300 pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por nombre o teléfono…"
              className="w-full rounded-xl border border-gray-200 pl-9 pr-9 py-2.5 text-sm
                         font-poppins text-brand-dark placeholder:text-gray-300 outline-none
                         focus:border-brand-primary focus:ring-1 focus:ring-brand-primary/20 transition"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-300
                           hover:text-gray-500 transition-colors"
              >
                <X size={14} />
              </button>
            )}
          </div>
        )}

        {/* ── Client list ─────────────────────────────────────────── */}
        {isError && (
          <div className="rounded-2xl border border-red-100 bg-red-50 p-4 mb-4">
            <p className="font-poppins text-sm font-medium text-red-500 mb-0.5">Error al cargar los cobros</p>
            <p className="font-poppins text-xs text-red-400">{(error as Error)?.message}</p>
          </div>
        )}

        {isLoading ? (
          <div className="flex flex-col gap-4 animate-pulse">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-52 bg-gray-100 rounded-2xl" />
            ))}
          </div>
        ) : clients.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-20 text-center">
            <CreditCard size={40} strokeWidth={1.2} className="text-gray-200" />
            <p className="font-poppins font-medium text-sm text-gray-400">Sin cobros pendientes</p>
            <p className="font-poppins text-xs text-gray-300">Todas las ventas están al día.</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-16 text-center">
            <Search size={36} strokeWidth={1.2} className="text-gray-200" />
            <p className="font-poppins font-medium text-sm text-gray-400">
              Sin resultados para "{search}"
            </p>
            <button
              type="button"
              onClick={() => setSearch("")}
              className="text-xs font-poppins text-brand-primary hover:underline"
            >
              Limpiar búsqueda
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {filtered.map((client) => (
              <ClientCard key={client.key} client={client} />
            ))}
          </div>
        )}

      </main>
    </>
  );
}
