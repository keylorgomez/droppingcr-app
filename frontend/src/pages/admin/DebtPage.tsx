import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft, Loader2, CreditCard, MessageCircle, ChevronDown, ChevronUp, Plus,
} from "lucide-react";
import {
  getPendingSales, addPayment, type PendingSale,
} from "../../services/salesService";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../components/ui/Toast";
import Header from "../../components/ui/Header";
import { cn } from "../../lib/utils";

// ── Helpers ────────────────────────────────────────────────────────────────

function formatPhone(raw: string | null): string | null {
  if (!raw) return null;
  const digits = raw.replace(/\D/g, "");
  return digits.length === 8 ? `+506${digits}` : raw;
}

function waLink(phone: string | null, name: string | null, product: string, remaining: number): string {
  const p = formatPhone(phone) ?? "";
  const msg = encodeURIComponent(
    `Hola${name ? ` ${name}` : ""}! 👋 Te recordamos que tenés un saldo pendiente de ₡${remaining.toLocaleString("es-CR")} por tu compra de ${product} en Dropping CR. ¡Gracias! 🙌`
  );
  return `https://wa.me/${p.replace("+", "")}?text=${msg}`;
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const days = Math.floor(diff / 86400000);
  if (days === 0) return "Hoy";
  if (days === 1) return "Ayer";
  return `Hace ${days} días`;
}

const inputCls =
  "w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-poppins text-brand-dark " +
  "placeholder:text-gray-300 outline-none focus:border-brand-primary " +
  "focus:ring-1 focus:ring-brand-primary/20 transition";

// ── Abono inline form ──────────────────────────────────────────────────────

function AbonoForm({
  sale,
  onDone,
}: {
  sale: PendingSale;
  onDone: () => void;
}) {
  const { showToast } = useToast();
  const queryClient   = useQueryClient();
  const [amount, setAmount] = useState("");
  const [note,   setNote]   = useState("");
  const [error,  setError]  = useState("");

  const mutation = useMutation({
    mutationFn: () =>
      addPayment(sale.id, sale.sale_price, Number(amount), note.trim() || null),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pending-sales"] });
      showToast("Abono registrado.", "success");
      onDone();
    },
    onError: (err: Error) => showToast(err.message, "error"),
  });

  function handleSave() {
    const a = Number(amount);
    if (!amount || a <= 0)          { setError("Ingresa un monto válido."); return; }
    if (a > sale.remaining)         { setError(`Máximo ₡${sale.remaining.toLocaleString("es-CR")}.`); return; }
    setError("");
    mutation.mutate();
  }

  return (
    <div className="flex flex-col gap-3 pt-3 border-t border-gray-100 mt-1">
      <p className="text-[10px] font-poppins text-gray-400 uppercase tracking-widest">
        Nuevo abono — restante: ₡{sale.remaining.toLocaleString("es-CR")}
      </p>

      <div className="grid grid-cols-[1fr_160px] gap-2">
        <div className="flex flex-col gap-1">
          <input
            type="number"
            min={1}
            max={sale.remaining}
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

// ── Sale card ──────────────────────────────────────────────────────────────

function SaleCard({ sale }: { sale: PendingSale }) {
  const [showAbono,    setShowAbono]    = useState(false);
  const [showPayments, setShowPayments] = useState(false);

  const paidPct   = Math.min(100, Math.round((sale.total_paid / sale.sale_price) * 100));
  const productStr = `${sale.product_name} (${sale.variant_size})`;
  const phone      = sale.guest_phone;

  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-5 flex flex-col gap-4">

      {/* Top row */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-poppins font-semibold text-sm text-brand-dark">
            {sale.guest_name ?? "Cliente sin nombre"}
          </p>
          <p className="font-poppins text-xs text-gray-400 mt-0.5">{productStr}</p>
        </div>
        <span className="text-[11px] font-poppins text-gray-400 shrink-0 mt-0.5">
          {timeAgo(sale.sold_at)}
        </span>
      </div>

      {/* Price breakdown */}
      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="bg-gray-50 rounded-xl py-2.5 px-2">
          <p className="text-[10px] font-poppins text-gray-400 uppercase tracking-wider mb-0.5">Total</p>
          <p className="font-poppins font-semibold text-sm text-brand-dark">
            ₡{sale.sale_price.toLocaleString("es-CR")}
          </p>
        </div>
        <div className="bg-emerald-50 rounded-xl py-2.5 px-2">
          <p className="text-[10px] font-poppins text-gray-400 uppercase tracking-wider mb-0.5">Pagado</p>
          <p className="font-poppins font-semibold text-sm text-emerald-600">
            ₡{sale.total_paid.toLocaleString("es-CR")}
          </p>
        </div>
        <div className="bg-red-50 rounded-xl py-2.5 px-2">
          <p className="text-[10px] font-poppins text-gray-400 uppercase tracking-wider mb-0.5">Pendiente</p>
          <p className="font-poppins font-semibold text-sm text-red-500">
            ₡{sale.remaining.toLocaleString("es-CR")}
          </p>
        </div>
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

      {/* Payment history toggle */}
      {sale.payments.length > 0 && (
        <button
          type="button"
          onClick={() => setShowPayments((v) => !v)}
          className="flex items-center gap-1.5 text-xs font-poppins text-gray-400
                     hover:text-brand-primary transition-colors self-start"
        >
          {showPayments ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
          {sale.payments.length} {sale.payments.length === 1 ? "abono registrado" : "abonos registrados"}
        </button>
      )}

      {showPayments && (
        <div className="flex flex-col gap-1.5">
          {sale.payments.map((p) => (
            <div key={p.id} className="flex items-center justify-between text-xs font-poppins
                                       bg-gray-50 rounded-xl px-3 py-2">
              <span className="text-gray-500">
                {new Date(p.paid_at).toLocaleDateString("es-CR")}
                {p.note && <span className="text-gray-400 ml-2">— {p.note}</span>}
              </span>
              <span className="font-semibold text-emerald-600">
                +₡{p.amount.toLocaleString("es-CR")}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-2">
        {phone && (
          <a
            href={waLink(phone, sale.guest_name, productStr, sale.remaining)}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#25D366] text-white
                       text-xs font-poppins font-medium hover:bg-[#1da851] transition-colors"
          >
            <MessageCircle size={13} strokeWidth={2} />
            Cobrar por WA
          </a>
        )}
        <button
          type="button"
          onClick={() => setShowAbono((v) => !v)}
          className={cn(
            "flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-poppins font-medium transition-colors",
            showAbono
              ? "bg-brand-primary text-white hover:bg-[#7a3e18]"
              : "border border-gray-200 text-brand-primary hover:border-brand-primary"
          )}
        >
          <Plus size={13} strokeWidth={2.5} />
          Registrar abono
        </button>
      </div>

      {showAbono && (
        <AbonoForm sale={sale} onDone={() => setShowAbono(false)} />
      )}
    </div>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────

export default function DebtPage() {
  const navigate = useNavigate();
  const { user, isLoading: authLoading } = useAuth();

  useEffect(() => {
    if (!authLoading && (!user || user.role !== "admin")) navigate("/", { replace: true });
  }, [user, authLoading, navigate]);

  const { data: sales = [], isLoading } = useQuery({
    queryKey: ["pending-sales"],
    queryFn:  getPendingSales,
  });

  const totalPendiente = sales.reduce((sum, s) => sum + s.remaining, 0);

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
          Ventas a pagos con saldo pendiente de cobro.
        </p>

        {/* Summary */}
        {!isLoading && sales.length > 0 && (
          <div className="grid grid-cols-2 gap-3 mb-6">
            <div className="bg-red-50 rounded-2xl p-4 text-center">
              <p className="text-[10px] font-poppins text-gray-400 uppercase tracking-wider mb-1">
                Total pendiente
              </p>
              <p className="font-poppins font-bold text-xl text-red-500">
                ₡{totalPendiente.toLocaleString("es-CR")}
              </p>
            </div>
            <div className="bg-gray-50 rounded-2xl p-4 text-center">
              <p className="text-[10px] font-poppins text-gray-400 uppercase tracking-wider mb-1">
                Ventas activas
              </p>
              <p className="font-poppins font-bold text-xl text-brand-dark">{sales.length}</p>
            </div>
          </div>
        )}

        {/* List */}
        {isLoading ? (
          <div className="flex flex-col gap-4 animate-pulse">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-52 bg-gray-100 rounded-2xl" />
            ))}
          </div>
        ) : sales.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-20 text-center">
            <CreditCard size={40} strokeWidth={1.2} className="text-gray-200" />
            <p className="font-poppins font-medium text-sm text-gray-400">
              Sin cobros pendientes
            </p>
            <p className="font-poppins text-xs text-gray-300">
              Todas las ventas están al día.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {sales.map((sale) => (
              <SaleCard key={sale.id} sale={sale} />
            ))}
          </div>
        )}

      </main>
    </>
  );
}
