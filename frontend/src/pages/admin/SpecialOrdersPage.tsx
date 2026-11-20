import { usePaged } from "../../lib/usePaged";
import ShowMore from "../../components/ui/ShowMore";
import { useMemo, useState, type FormEvent, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "motion/react";
import {
  ArrowLeft, Plus, X, Loader2, PackageSearch, Wallet, Clock, ExternalLink,
  ChevronRight, ChevronDown, CheckCircle2, Ban, Info, Search, Pencil,
} from "lucide-react";
import Header from "../../components/ui/Header";
import MoneyInput from "../../components/ui/MoneyInput";
import WhatsAppIcon from "../../components/ui/WhatsAppIcon";
import { useToast } from "../../components/ui/Toast";
import { fmt, formatDate, displayPhone, localPhone, normalizePhone } from "../../lib/formatters";
import { cn } from "../../lib/utils";
import { QUERY_KEYS } from "../../constants/queryKeys";
import { lookupCustomerProfileByPhone } from "../../services/customerService";
import { addExternalSalePayment } from "../../services/externalSalesService";
import RefundChoice from "../../components/orders/RefundChoice";
import { refundAmountFor, type RefundMode } from "../../lib/refunds";
import {
  getSpecialOrders, createSpecialOrder, updateSpecialOrder, updateSpecialOrderStatus, addSpecialOrderAdvance,
  deliverSpecialOrder, cancelSpecialOrder, isActiveSpecialOrder,
  SPECIAL_ORDER_FLOW, SPECIAL_ORDER_STATUS_LABEL,
  type SpecialOrder, type SpecialOrderStatus,
} from "../../services/specialOrdersService";

const inputCls =
  "w-full rounded-xl border border-ink-200 px-4 py-2.5 text-sm text-brand-dark placeholder:text-ink-300 " +
  "outline-none bg-white focus:border-brand-primary focus:ring-1 focus:ring-brand-primary/20 transition";

type Tab = "active" | SpecialOrderStatus;

const normalize = (text: string) => text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

/** Nombre o producto sin importar tildes; teléfono solo por dígitos (8888-1234 = 88881234). */
function matchesSearch(order: SpecialOrder, query: string): boolean {
  const text   = normalize(query.trim());
  const digits = query.replace(/\D/g, "");
  const haystack = normalize([order.guest_name, order.description, order.size, order.note].filter(Boolean).join(" "));
  if (haystack.includes(text)) return true;
  return digits.length >= 3 && (order.guest_phone ?? "").replace(/\D/g, "").includes(digits);
}

const parseAmount = (value: string) => Number(value.replace(/[^\d.]/g, "")) || 0;

// ── Piezas comunes ─────────────────────────────────────────────────────────

function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    // justify-between: si una etiqueta pasa a dos líneas, los inputs de la fila
    // siguen alineados abajo.
    <label className="flex flex-col justify-between gap-1.5">
      <span className="text-xs font-medium text-ink-500 uppercase tracking-wider">
        {label}{hint && <span className="normal-case tracking-normal text-ink-300"> {hint}</span>}
      </span>
      {children}
    </label>
  );
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm sm:px-4"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <motion.div
        className="w-full sm:max-w-md max-h-[92svh] overflow-y-auto bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl p-6 flex flex-col gap-5"
        initial={{ y: 60, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 60, opacity: 0 }}
        transition={{ type: "spring", stiffness: 340, damping: 32 }}
      >
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-brand-dark text-base">{title}</h2>
          <button onClick={onClose} className="w-9 h-9 -mr-2 flex items-center justify-center text-ink-400 hover:text-brand-primary" aria-label="Cerrar">
            <X size={20} />
          </button>
        </div>
        {children}
      </motion.div>
    </motion.div>
  );
}

function SubmitButton({ saving, children, disabled }: { saving: boolean; children: ReactNode; disabled?: boolean }) {
  return (
    <button
      type="submit"
      disabled={saving || disabled}
      className="w-full py-3 rounded-xl bg-brand-primary text-white text-sm font-medium flex items-center justify-center gap-2
                 hover:bg-[#2e2e2e] transition-colors disabled:opacity-50"
    >
      {saving && <Loader2 size={15} className="animate-spin" />}
      {children}
    </button>
  );
}

// ── Nuevo encargo ──────────────────────────────────────────────────────────

function NewOrderModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const { showToast } = useToast();
  const [phone, setPhone]             = useState("");
  const [name, setName]               = useState("");
  const [customerId, setCustomerId]   = useState<string | null>(null);
  const [description, setDescription] = useState("");
  const [size, setSize]               = useState("");
  const [price, setPrice]             = useState("");
  const [cost, setCost]               = useState("");
  const [advance, setAdvance]         = useState("");
  const [note, setNote]               = useState("");

  const mutation = useMutation({
    mutationFn: () => {
      const digits = phone.replace(/\D/g, "");
      return createSpecialOrder({
        customer_id:     customerId,
        guest_name:      name.trim() || null,
        guest_phone:     digits ? `+506${digits.slice(-8)}` : null,
        description:     description.trim(),
        size:            size.trim() || null,
        reference_url:   null,
        estimated_price: parseAmount(price),
        estimated_cost:  cost ? parseAmount(cost) : null,
        note:            note.trim() || null,
        advance:         parseAmount(advance),
      });
    },
    onSuccess: () => { showToast("Encargo registrado.", "success"); onSaved(); },
    onError:   (err: Error) => showToast(err.message, "error"),
  });

  async function autofillFromPhone() {
    const match = await lookupCustomerProfileByPhone(phone);
    if (!match) return;
    setCustomerId(match.customer_id);
    if (!name.trim() && match.name) setName(match.name);
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    if (!description.trim() || parseAmount(advance) > parseAmount(price) && parseAmount(price) > 0) {
      showToast(!description.trim() ? "Describí qué se encargó." : "El adelanto supera el precio estimado.", "error");
      return;
    }
    mutation.mutate();
  }

  return (
    <Modal title="Nuevo encargo" onClose={onClose}>
      <form onSubmit={submit} className="flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-3">
          <Field label="WhatsApp">
            <input
              type="tel" inputMode="numeric" value={phone}
              onChange={(e) => { setPhone(e.target.value); setCustomerId(null); }}
              onBlur={autofillFromPhone} placeholder="8888 8888" className={inputCls}
            />
          </Field>
          <Field label="Nombre">
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Cliente" className={inputCls} />
          </Field>
        </div>

        <Field label="¿Qué encargó?">
          <input
            value={description} onChange={(e) => setDescription(e.target.value)} required
            placeholder="Ej: Camiseta Real Madrid local 25/26" className={inputCls}
          />
        </Field>

        {/* Etiquetas cortas de una sola línea: con "(opcional)" largo una
            columna saltaba a dos renglones y los campos quedaban desalineados. */}
        <div className="grid grid-cols-2 gap-3">
          <Field label="Talla">
            <input value={size} onChange={(e) => setSize(e.target.value)} placeholder="M" className={inputCls} />
          </Field>
          <Field label="Adelanto ₡">
            <MoneyInput value={advance} onChange={setAdvance} placeholder="0" className={inputCls} />
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Precio est. ₡">
            <MoneyInput value={price} onChange={setPrice} placeholder="0" className={inputCls} />
          </Field>
          <Field label="Costo est. ₡">
            <MoneyInput value={cost} onChange={setCost} placeholder="Opcional" className={inputCls} />
          </Field>
        </div>

        <Field label="Nota" hint="(opcional)">
          <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} placeholder="Proveedor, fecha estimada, link…" className={cn(inputCls, "resize-none")} />
        </Field>

        <p className="flex gap-2 text-[11.5px] text-ink-400 leading-snug">
          <Info size={14} className="shrink-0 mt-px" />
          Nada de esto cuenta como venta ni ganancia hasta que entregues la pieza con su precio y costo reales.
        </p>

        <SubmitButton saving={mutation.isPending}>Registrar encargo</SubmitButton>
      </form>
    </Modal>
  );
}

// ── Editar ─────────────────────────────────────────────────────────────────

function EditModal({ order, onClose, onSaved }: { order: SpecialOrder; onClose: () => void; onSaved: () => void }) {
  const { showToast } = useToast();
  const [name, setName]               = useState(order.guest_name ?? "");
  const [phone, setPhone]             = useState(localPhone(order.guest_phone));
  const [description, setDescription] = useState(order.description);
  const [size, setSize]               = useState(order.size ?? "");
  const [price, setPrice]             = useState(order.estimated_price ? String(order.estimated_price) : "");
  const [cost, setCost]               = useState(order.estimated_cost !== null ? String(order.estimated_cost) : "");
  const [note, setNote]               = useState(order.note ?? "");

  const priceValue = parseAmount(price);
  const costValue  = cost ? parseAmount(cost) : null;
  const profit     = costValue !== null && priceValue > 0 ? priceValue - costValue : null;

  const mutation = useMutation({
    mutationFn: () => updateSpecialOrder(order.id, {
      guest_name:      name.trim() || null,
      guest_phone:     (() => { const digits = localPhone(phone); return digits ? (digits.length === 8 ? `+506${digits}` : phone.trim()) : null; })(),
      description:     description.trim(),
      size:            size.trim() || null,
      estimated_price: priceValue,
      estimated_cost:  costValue,
      note:            note.trim() || null,
    }),
    onSuccess:  () => { showToast("Encargo actualizado.", "success"); onSaved(); },
    onError:    (err: Error) => showToast(err.message, "error"),
  });

  return (
    <Modal title="Editar encargo" onClose={onClose}>
      <form onSubmit={(e) => { e.preventDefault(); if (description.trim()) mutation.mutate(); }} className="flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Cliente">
            <input value={name} onChange={(e) => setName(e.target.value)} className={inputCls} />
          </Field>
          <Field label="Teléfono">
            <input type="tel" inputMode="numeric" value={phone} onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 8))} placeholder="8888 8888" className={inputCls} />
          </Field>
        </div>
        <div className="grid grid-cols-[1fr_6rem] gap-3">
          <Field label="Producto">
            <input value={description} onChange={(e) => setDescription(e.target.value)} className={inputCls} />
          </Field>
          <Field label="Talla">
            <input value={size} onChange={(e) => setSize(e.target.value)} className={inputCls} />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Precio al cliente ₡">
            <MoneyInput value={price} onChange={setPrice} placeholder="0" className={inputCls} />
          </Field>
          <Field label="Costo est. ₡">
            <MoneyInput value={cost} onChange={setCost} placeholder="Opcional" className={inputCls} />
          </Field>
        </div>
        {profit !== null && (
          <p className={cn("text-[12px] -mt-1", profit >= 0 ? "text-green-600" : "text-red-500")}>
            Ganancia proyectada: {fmt(profit)}
            {profit < 0 && " · ¿quedaron invertidos el precio y el costo?"}
          </p>
        )}
        <Field label="Nota" hint="(opcional)">
          <input value={note} onChange={(e) => setNote(e.target.value)} className={inputCls} />
        </Field>
        <p className="text-[11.5px] text-ink-400 -mt-1">
          Los adelantos no se editan aquí. Si registraste uno mal, corregilo en Movimientos.
        </p>
        <SubmitButton saving={mutation.isPending} disabled={!description.trim()}>Guardar cambios</SubmitButton>
      </form>
    </Modal>
  );
}

// ── Abonar ─────────────────────────────────────────────────────────────────

function AdvanceModal({ order, onClose, onSaved }: { order: SpecialOrder; onClose: () => void; onSaved: () => void }) {
  const { showToast } = useToast();
  const [amount, setAmount] = useState("");
  const [note, setNote]     = useState("");
  const pending = Math.max(0, order.estimated_price - order.advance);

  const mutation = useMutation({
    mutationFn: () => addSpecialOrderAdvance(order.id, parseAmount(amount), note.trim() || null),
    onSuccess:  () => { showToast("Adelanto registrado.", "success"); onSaved(); },
    onError:    (err: Error) => showToast(err.message, "error"),
  });

  return (
    <Modal title="Registrar adelanto" onClose={onClose}>
      <form onSubmit={(e) => { e.preventDefault(); if (parseAmount(amount) > 0) mutation.mutate(); }} className="flex flex-col gap-4">
        <p className="text-sm text-ink-500">
          {order.description} · ya adelantó <b className="text-brand-dark">{fmt(order.advance)}</b>
          {order.estimated_price > 0 && <> · falta aprox. <b className="text-brand-dark">{fmt(pending)}</b></>}
        </p>
        <Field label="Monto ₡">
          <MoneyInput autoFocus value={amount} onChange={setAmount} placeholder="0" className={inputCls} />
        </Field>
        <Field label="Nota" hint="(opcional)">
          <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="SINPE, efectivo…" className={inputCls} />
        </Field>
        <SubmitButton saving={mutation.isPending} disabled={parseAmount(amount) <= 0}>Registrar adelanto</SubmitButton>
      </form>
    </Modal>
  );
}

// ── Entregar ───────────────────────────────────────────────────────────────

type Settlement = "paid" | "installments";

function DeliverModal({ order, onClose, onSaved }: { order: SpecialOrder; onClose: () => void; onSaved: () => void }) {
  const { showToast } = useToast();
  const [price, setPrice] = useState(order.estimated_price ? String(order.estimated_price) : "");
  const [cost, setCost]   = useState(order.estimated_cost !== null ? String(order.estimated_cost) : "");
  const [name, setName]   = useState(order.description);
  // Sin opción marcada a propósito: elegir "pagó" registra plata, así que
  // tiene que ser una decisión, no un default que se acepta sin leer.
  const [settlement, setSettlement] = useState<Settlement | null>(null);
  const [partial, setPartial]       = useState("");
  const [payNote, setPayNote]       = useState("");

  const finalPrice = parseAmount(price);
  const realCost   = parseAmount(cost);
  const balance    = finalPrice - order.advance;
  const owes       = balance > 0;
  const partialAmt = parseAmount(partial);

  // Lo que se cobra en el momento de la entrega.
  const collectNow = !owes ? 0 : settlement === "paid" ? balance : settlement === "installments" ? partialAmt : 0;
  const leftOwing  = owes ? balance - collectNow : 0;

  const partialError = settlement === "installments" && partialAmt >= balance && partialAmt > 0
    ? "Si paga todo, elegí \"Pagó el saldo\"." : null;
  const canSubmit = finalPrice > 0 && cost !== "" && (!owes || settlement !== null) && !partialError;

  const mutation = useMutation({
    mutationFn: async () => {
      const saleId = await deliverSpecialOrder(order.id, finalPrice, realCost, name.trim() || null);
      if (collectNow <= 0) return { paymentFailed: false };
      try {
        await addExternalSalePayment(saleId, collectNow, payNote.trim() || (settlement === "paid" ? "Saldo al entregar" : "Abono al entregar"));
        return { paymentFailed: false };
      } catch (err) {
        console.warn("[entrega] el pago no se registró", err);
        return { paymentFailed: true };
      }
    },
    onSuccess: ({ paymentFailed }) => {
      if (paymentFailed) {
        showToast("Encargo entregado, pero el pago no se registró: anotalo en Cobros pendientes.", "error");
      } else if (leftOwing > 0) {
        showToast(`Entregado a pagos: queda debiendo ${fmt(leftOwing)} en Cobros pendientes.`, "success");
      } else {
        showToast("Encargo entregado y pagado: ya cuenta como venta.", "success");
      }
      onSaved();
    },
    onError: (err: Error) => showToast(err.message, "error"),
  });

  const optionCls = (on: boolean) => cn(
    "flex-1 rounded-xl border px-3 py-2.5 text-left transition-colors",
    on ? "border-ink-900 bg-ink-900 text-bone" : "border-ink-200 bg-white text-brand-dark hover:border-ink-400"
  );

  return (
    <Modal title="Entregar encargo" onClose={onClose}>
      <form
        onSubmit={(e) => { e.preventDefault(); if (canSubmit) mutation.mutate(); }}
        className="flex flex-col gap-4"
      >
        <p className="text-[12.5px] text-ink-500 leading-snug">
          Con los números reales el encargo se convierte en una venta y sus adelantos pasan a ser abonos.
        </p>
        <Field label="Producto">
          <input value={name} onChange={(e) => setName(e.target.value)} className={inputCls} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Precio final ₡">
            <MoneyInput value={price} onChange={setPrice} className={inputCls} />
          </Field>
          <Field label="Costo real ₡">
            <MoneyInput value={cost} onChange={setCost} placeholder="Puesto en CR" className={inputCls} />
          </Field>
        </div>

        {owes && finalPrice > 0 && (
          <div className="flex flex-col gap-2.5">
            <span className="text-xs font-medium text-ink-500 uppercase tracking-wider">
              Saldo de {fmt(balance)}
            </span>
            <div className="flex gap-2">
              <button type="button" onClick={() => setSettlement("paid")} className={optionCls(settlement === "paid")}>
                <span className="block text-[13px] font-semibold">Pagó el saldo</span>
                <span className="block text-[11px] opacity-70">Queda saldada</span>
              </button>
              <button type="button" onClick={() => setSettlement("installments")} className={optionCls(settlement === "installments")}>
                <span className="block text-[13px] font-semibold">Venta a pagos</span>
                <span className="block text-[11px] opacity-70">Va a Cobros pendientes</span>
              </button>
            </div>
            {settlement === "installments" && (
              <Field label="Abono al entregar ₡">
                <MoneyInput value={partial} onChange={setPartial} placeholder="0 si no dio nada" className={inputCls} />
              </Field>
            )}
            {partialError && <p className="text-[11.5px] text-red-500 -mt-1">{partialError}</p>}
            {collectNow > 0 && (
              <Field label="Cómo pagó">
                <input value={payNote} onChange={(e) => setPayNote(e.target.value)} placeholder="SINPE, efectivo…" className={inputCls} />
              </Field>
            )}
          </div>
        )}

        {finalPrice > 0 && (
          <div className="rounded-xl bg-ink-50 px-4 py-3 text-sm flex flex-col gap-1.5 tnum">
            <div className="flex justify-between"><span className="text-ink-500">Adelantado</span><span>{fmt(order.advance)}</span></div>
            {collectNow > 0 && (
              <div className="flex justify-between"><span className="text-ink-500">Cobra al entregar</span><span>{fmt(collectNow)}</span></div>
            )}
            <div className="flex justify-between">
              <span className="text-ink-500">{balance >= 0 ? "Queda debiendo" : "Saldo a favor del cliente"}</span>
              <span className={leftOwing > 0 ? "text-amber-600 font-semibold" : "font-semibold"}>
                {fmt(balance >= 0 ? leftOwing : Math.abs(balance))}
              </span>
            </div>
            {cost !== "" && (
              <div className="flex justify-between border-t border-ink-200 pt-1.5">
                <span className="text-ink-500">Ganancia</span>
                <span className={finalPrice - realCost >= 0 ? "text-green-600 font-semibold" : "text-red-500 font-semibold"}>
                  {fmt(finalPrice - realCost)}
                </span>
              </div>
            )}
          </div>
        )}

        <SubmitButton saving={mutation.isPending} disabled={!canSubmit}>Confirmar entrega</SubmitButton>
      </form>
    </Modal>
  );
}

// ── Cancelar ───────────────────────────────────────────────────────────────

function CancelModal({ order, onClose, onSaved }: { order: SpecialOrder; onClose: () => void; onSaved: () => void }) {
  const { showToast } = useToast();
  const [mode,    setMode]    = useState<RefundMode | null>(order.advance > 0 ? null : "none");
  const [partial, setPartial] = useState("");
  const [reason,  setReason]  = useState("");
  const refundAmount = refundAmountFor(mode, partial, order.advance);

  const mutation = useMutation({
    mutationFn: () => cancelSpecialOrder(order.id, refundAmount ?? 0, reason.trim() || null),
    onSuccess:  () => { showToast("Encargo cancelado.", "success"); onSaved(); },
    onError:    (err: Error) => showToast(err.message, "error"),
  });

  return (
    <Modal title="Cancelar encargo" onClose={onClose}>
      <form
        onSubmit={(e) => { e.preventDefault(); if (refundAmount !== null) mutation.mutate(); }}
        className="flex flex-col gap-4"
      >
        <p className="text-sm text-ink-500">{order.description}</p>
        <RefundChoice
          paid={order.advance}
          mode={mode}
          onMode={setMode}
          partial={partial}
          onPartial={setPartial}
        />
        <Field label="Motivo" hint="(opcional)">
          <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Nadie lo reclamó, el proveedor no tenía la talla…" className={inputCls} />
        </Field>
        <SubmitButton saving={mutation.isPending} disabled={refundAmount === null}>Cancelar encargo</SubmitButton>
      </form>
    </Modal>
  );
}

// ── Tarjeta ────────────────────────────────────────────────────────────────

function StatusChip({ status }: { status: SpecialOrderStatus }) {
  const cls =
    status === "delivered" ? "bg-green-50 text-green-700" :
    status === "cancelled" ? "bg-ink-100 text-ink-500" :
    status === "arrived"   ? "bg-blue-50 text-blue-700" :
                             "bg-amber-50 text-amber-700";
  return (
    <span className={cn("text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full whitespace-nowrap", cls)}>
      {SPECIAL_ORDER_STATUS_LABEL[status]}
    </span>
  );
}

function OrderCard({
  order, onEdit, onAdvance, onDeliver, onCancel, onStep, stepping,
}: {
  order: SpecialOrder;
  onEdit: () => void; onAdvance: () => void; onDeliver: () => void; onCancel: () => void;
  onStep: (next: SpecialOrderStatus) => void; stepping: boolean;
}) {
  const active    = isActiveSpecialOrder(order);
  const stepIndex = SPECIAL_ORDER_FLOW.indexOf(order.status);
  const next      = stepIndex >= 0 && stepIndex < SPECIAL_ORDER_FLOW.length - 1 ? SPECIAL_ORDER_FLOW[stepIndex + 1] : null;
  const pending   = Math.max(0, order.estimated_price - order.advance);

  // El cliente (nombre, teléfono, WhatsApp) va en la cabecera del grupo.
  return (
    <div className="p-4 flex flex-col gap-3.5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-semibold text-sm text-brand-dark leading-snug">
            {order.description}{order.size && <span className="text-ink-400 font-normal"> · Talla {order.size}</span>}
          </p>
          <p className="text-[12px] text-ink-400 mt-0.5 flex flex-wrap items-center gap-x-2">
            <span>{formatDate(order.created_at)}</span>
            {order.reference_url && (
              <a href={order.reference_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 underline">
                referencia <ExternalLink size={11} />
              </a>
            )}
          </p>
        </div>
        <StatusChip status={order.status} />
      </div>

      {/* Avance */}
      {active && (
        <div className="flex gap-1">
          {SPECIAL_ORDER_FLOW.map((step, i) => (
            <span key={step} className={cn("h-1 flex-1 rounded-full", i <= stepIndex ? "bg-ink-900" : "bg-ink-100")} />
          ))}
        </div>
      )}

      <div className="grid grid-cols-3 gap-2 text-center tnum">
        <div className="rounded-xl bg-ink-50 py-2">
          <p className="text-[10px] uppercase tracking-wider text-ink-400">Estimado</p>
          <p className="text-sm font-semibold text-brand-dark">{fmt(order.estimated_price)}</p>
        </div>
        <div className="rounded-xl bg-ink-50 py-2">
          <p className="text-[10px] uppercase tracking-wider text-ink-400">Adelantó</p>
          <p className="text-sm font-semibold text-brand-dark">{fmt(order.advance)}</p>
        </div>
        <div className="rounded-xl bg-ink-50 py-2">
          <p className="text-[10px] uppercase tracking-wider text-ink-400">{active ? "Falta aprox." : "—"}</p>
          <p className="text-sm font-semibold text-brand-dark">{active ? fmt(pending) : "—"}</p>
        </div>
      </div>

      {active && order.estimated_cost !== null && order.estimated_price > 0 && (
        <p className="text-[11.5px] text-ink-400">
          Ganancia proyectada: {fmt(order.estimated_price - order.estimated_cost)} (no cuenta hasta entregar)
        </p>
      )}
      {order.note && <p className="text-[12px] text-ink-500 bg-ink-50 rounded-lg px-3 py-2">{order.note}</p>}

      {active && (
        <div className="flex flex-wrap gap-2 pt-1">
          {next && (
            <button
              onClick={() => onStep(next)} disabled={stepping}
              className="h-9 px-3 rounded-lg border border-ink-200 text-[12px] font-medium text-brand-dark hover:border-ink-900 transition-colors inline-flex items-center gap-1 disabled:opacity-50"
            >
              {SPECIAL_ORDER_STATUS_LABEL[next]} <ChevronRight size={14} />
            </button>
          )}
          <button onClick={onAdvance} className="h-9 px-3 rounded-lg border border-ink-200 text-[12px] font-medium text-brand-dark hover:border-ink-900 transition-colors">
            + Adelanto
          </button>
          <button onClick={onDeliver} className="h-9 px-3 rounded-lg bg-ink-900 text-bone text-[12px] font-medium hover:bg-ink-700 transition-colors inline-flex items-center gap-1.5">
            <CheckCircle2 size={14} /> Entregar
          </button>
          <button onClick={onEdit} aria-label="Editar encargo" className="h-9 w-9 rounded-lg border border-ink-200 flex items-center justify-center text-ink-600 hover:border-ink-900 transition-colors">
            <Pencil size={14} />
          </button>
          <button onClick={onCancel} className="h-9 px-3 rounded-lg text-[12px] font-medium text-red-500 hover:bg-red-50 transition-colors inline-flex items-center gap-1.5 ml-auto">
            <Ban size={13} /> Cancelar
          </button>
        </div>
      )}
    </div>
  );
}

// ── Grupo por cliente ──────────────────────────────────────────────────────

interface CustomerGroup {
  key:    string;
  name:   string;
  phone:  string | null;
  orders: SpecialOrder[];
}

/**
 * Junta los encargos de una misma persona: por teléfono, si no por cuenta y
 * si no por nombre. Los grupos quedan en el orden de su encargo más reciente
 * (la lista ya viene de más nuevo a más viejo).
 */
function groupByCustomer(orders: SpecialOrder[]): CustomerGroup[] {
  const groups = new Map<string, CustomerGroup>();
  for (const order of orders) {
    const phone = order.guest_phone ? normalizePhone(order.guest_phone) : "";
    const key   = phone.length >= 8 ? `tel:${phone}` : order.customer_id ?? `name:${normalize(order.guest_name ?? "").trim()}`;
    const group = groups.get(key);
    if (group) {
      group.orders.push(order);
      group.phone ??= order.guest_phone;
    } else {
      groups.set(key, { key, name: order.guest_name ?? "Sin nombre", phone: order.guest_phone, orders: [order] });
    }
  }
  return [...groups.values()];
}

function GroupCard({
  group, expanded, onToggle, children,
}: { group: CustomerGroup; expanded: boolean; onToggle: () => void; children: ReactNode }) {
  const digits  = group.phone?.replace(/\D/g, "");
  const active  = group.orders.filter(isActiveSpecialOrder);
  const pending = active.reduce((total, order) => total + Math.max(0, order.estimated_price - order.advance), 0);

  return (
    // Sin `layout`: esa animación escala la tarjeta para cambiarle la altura y
    // al abrir se veía estirada. La altura la anima el contenido de abajo.
    <motion.div
      initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
      className="bg-white rounded-2xl border border-ink-100 shadow-sm overflow-hidden"
    >
      <div className={cn("flex items-center gap-3 px-4 py-3 bg-ink-50/60", expanded && "border-b border-ink-100")}>
        <button
          type="button" onClick={onToggle} aria-expanded={expanded}
          className="flex-1 min-w-0 flex items-center gap-3 text-left"
        >
          <span className="flex-1 min-w-0">
            <span className="block font-semibold text-[15px] text-brand-dark truncate">{group.name}</span>
            <span className="block text-[12px] text-ink-500 tnum mt-0.5">
              {displayPhone(group.phone) ?? "Sin teléfono"}
              <span className="text-ink-400">
                {" · "}{group.orders.length} {group.orders.length === 1 ? "encargo" : "encargos"}
              </span>
            </span>
          </span>
          {pending > 0 ? (
            <span className="shrink-0 text-right">
              <span className="block text-[10px] uppercase tracking-wider text-ink-400 leading-none">Falta aprox.</span>
              <span className="block text-lg font-bold text-brand-dark tnum leading-tight mt-1">{fmt(pending)}</span>
            </span>
          ) : active.length > 0 ? (
            <span className="shrink-0 text-[12px] font-semibold text-green-600">Pagado</span>
          ) : null}
          <ChevronDown
            size={18}
            className={cn("shrink-0 text-ink-400 transition-transform duration-200", expanded && "rotate-180")}
          />
        </button>
        {digits && (
          <a
            href={`https://wa.me/${digits.length === 8 ? `506${digits}` : digits}`}
            target="_blank" rel="noopener noreferrer" aria-label={`Escribir a ${group.name}`}
            className="shrink-0 h-9 w-9 rounded-lg border border-ink-200 bg-white flex items-center justify-center text-ink-600 hover:border-ink-900"
          >
            <WhatsAppIcon size={15} />
          </a>
        )}
      </div>

      {expanded ? (
        <motion.div
          key="detail"
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: "auto", opacity: 1 }}
          transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
          className="divide-y divide-ink-100 overflow-hidden"
        >
          {children}
        </motion.div>
      ) : (
        // Resumen: una línea por encargo con lo que más se pregunta (qué, en
        // qué va y cuánto falta). Tocar cualquiera abre el detalle.
        <button type="button" onClick={onToggle} className="w-full text-left divide-y divide-ink-100 border-t border-ink-100">
          {group.orders.map((order) => {
            const falta = Math.max(0, order.estimated_price - order.advance);
            return (
              <span key={order.id} className="flex items-center gap-3 px-4 py-2.5">
                <span className="flex-1 min-w-0 text-[13px] text-brand-dark truncate">
                  {order.description}
                  {order.size && <span className="text-ink-400"> · {order.size}</span>}
                </span>
                {isActiveSpecialOrder(order) && falta > 0 && (
                  <span className="shrink-0 text-[12px] text-ink-500 tnum">{fmt(falta)}</span>
                )}
                <StatusChip status={order.status} />
              </span>
            );
          })}
        </button>
      )}
    </motion.div>
  );
}

// ── Página ─────────────────────────────────────────────────────────────────

export default function SpecialOrdersPage() {
  const navigate    = useNavigate();
  const queryClient = useQueryClient();
  const { showToast } = useToast();

  const [tab, setTab]           = useState<Tab>("active");
  const [creating, setCreating] = useState(false);
  const [editFor, setEditFor]       = useState<SpecialOrder | null>(null);
  const [advanceFor, setAdvanceFor] = useState<SpecialOrder | null>(null);
  const [deliverFor, setDeliverFor] = useState<SpecialOrder | null>(null);
  const [cancelFor, setCancelFor]   = useState<SpecialOrder | null>(null);

  const { data: orders = [], isLoading, error } = useQuery({
    queryKey: QUERY_KEYS.SPECIAL_ORDERS,
    queryFn:  getSpecialOrders,
  });

  function refresh() {
    queryClient.invalidateQueries({ queryKey: QUERY_KEYS.SPECIAL_ORDERS });
    queryClient.invalidateQueries({ queryKey: QUERY_KEYS.FINANCE });
    queryClient.invalidateQueries({ queryKey: QUERY_KEYS.PAYMENTS_LOG });
    queryClient.invalidateQueries({ queryKey: QUERY_KEYS.EXTERNAL_SALES_LOG });
    setCreating(false); setEditFor(null); setAdvanceFor(null); setDeliverFor(null); setCancelFor(null);
  }

  const stepMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: SpecialOrderStatus }) => updateSpecialOrderStatus(id, status),
    onSuccess:  refresh,
    onError:    (err: Error) => showToast(err.message, "error"),
  });

  const active = useMemo(() => orders.filter(isActiveSpecialOrder), [orders]);
  // Con texto en el buscador se busca en TODOS los encargos (activos,
  // entregados y cancelados): el chip de cada tarjeta dice en qué estado está.
  const [query, setQuery] = useState("");
  const searching = query.trim().length > 0;
  const shown  = useMemo(() => {
    if (searching) return orders.filter((order) => matchesSearch(order, query));
    return tab === "active" ? active : orders.filter((order) => order.status === tab);
  }, [tab, orders, active, searching, query]);
  const custody = active.reduce((total, order) => total + order.advance, 0);
  const pending = active.reduce((total, order) => total + Math.max(0, order.estimated_price - order.advance), 0);

  // "Activos" junta todo lo que falta entregar; las de en medio lo parten por
  // etapa. Un encargo está en una sola etapa, así que entregados y cancelados
  // nunca se cuelan en ellas.
  const countOf = (status: SpecialOrderStatus) => orders.filter((o) => o.status === status).length;
  const TABS: { id: Tab; label: string; count: number }[] = [
    { id: "active",     label: "Activos",    count: active.length },
    { id: "quoted",     label: "Cotizados",  count: countOf("quoted") },
    { id: "ordered",    label: "Pedidos",    count: countOf("ordered") },
    { id: "in_transit", label: "En camino",  count: countOf("in_transit") },
    { id: "arrived",    label: "En CR",      count: countOf("arrived") },
    { id: "delivered",  label: "Entregados", count: countOf("delivered") },
    { id: "cancelled",  label: "Cancelados", count: countOf("cancelled") },
  ];


  // Se dibujan de a 20: con cientos de filas el celular se trababa.
  const groups = useMemo(() => groupByCustomer(shown), [shown]);
  const paged  = usePaged(groups, `${tab}|${query}`);

  // Los grupos arrancan cerrados (solo el resumen) para no scrollear de más.
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());
  const allOpen = groups.length > 0 && groups.every((g) => expanded.has(g.key));
  const toggleGroup = (key: string) => setExpanded((prev) => {
    const next = new Set(prev);
    if (next.has(key)) next.delete(key); else next.add(key);
    return next;
  });
  const toggleAll = () => setExpanded(allOpen ? new Set() : new Set(groups.map((g) => g.key)));
  return (
    <>
      <Header />
      <main className="max-w-3xl mx-auto px-4 pt-8 pb-16 flex flex-col gap-5">
        <div className="flex items-end justify-between gap-4">
          <div>
            <button onClick={() => navigate(-1)} className="flex items-center gap-1.5 text-sm text-ink-400 hover:text-brand-primary transition-colors mb-3">
              <ArrowLeft size={15} strokeWidth={2} /> Volver
            </button>
            <h1 className="font-semibold text-brand-primary text-2xl">Encargos</h1>
            <p className="text-xs text-ink-400 mt-1">Piezas por pedido: no cuentan como venta hasta entregarlas.</p>
          </div>
          <button
            onClick={() => setCreating(true)}
            className="shrink-0 h-11 px-4 rounded-xl bg-ink-900 text-bone text-sm font-medium inline-flex items-center gap-2 hover:bg-ink-700 transition-colors"
          >
            <Plus size={16} /> Nuevo
          </button>
        </div>

        <div className="grid grid-cols-3 gap-2.5">
          {[
            { icon: Wallet,        label: "Adelantos en custodia", value: fmt(custody), tone: "text-amber-700 bg-amber-50 border-amber-100" },
            { icon: PackageSearch, label: "Encargos activos",      value: String(active.length), tone: "text-ink-800 bg-white border-ink-100" },
            { icon: Clock,         label: "Por cobrar aprox.",     value: fmt(pending), tone: "text-ink-800 bg-white border-ink-100" },
          ].map(({ icon: Icon, label, value, tone }) => (
            <div key={label} className={cn("rounded-2xl border p-3 sm:p-4 flex flex-col gap-1.5", tone)}>
              <Icon size={16} strokeWidth={1.8} className="opacity-60" />
              <p className="text-[10px] sm:text-[11px] uppercase tracking-wider opacity-70 leading-tight">{label}</p>
              <p className="text-base sm:text-xl font-bold tnum leading-none">{value}</p>
            </div>
          ))}
        </div>

        <p className="flex gap-2 text-[12px] text-ink-500 bg-ink-50 rounded-xl px-3.5 py-3 leading-snug">
          <Info size={15} className="shrink-0 mt-px" />
          Los adelantos son plata de los clientes hasta que entregues la pieza: no suman a la utilidad ni a lo que se puede repartir.
          Lo que le pagás al proveedor por un encargo no lo registres en Gastos: va como costo real al entregar.
        </p>

        <div className="relative">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-300 pointer-events-none" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar por nombre, teléfono o producto"
            aria-label="Buscar encargos"
            className={cn(inputCls, "pl-10 pr-10")}
          />
          {searching && (
            <button
              type="button"
              onClick={() => setQuery("")}
              aria-label="Limpiar búsqueda"
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-ink-400 hover:text-ink-700"
            >
              <X size={15} />
            </button>
          )}
        </div>

        {searching ? (
          <p className="text-xs text-ink-400 -mt-2">
            {shown.length} {shown.length === 1 ? "resultado" : "resultados"} en todos los encargos
          </p>
        ) : (
        <div className="flex gap-2 overflow-x-auto no-scrollbar">
          {TABS.map(({ id, label, count }) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={cn(
                "h-9 px-4 rounded-full text-xs font-semibold whitespace-nowrap border transition-colors",
                tab === id ? "bg-ink-900 text-bone border-ink-900" : "bg-white text-ink-600 border-ink-200"
              )}
            >
              {label} · {count}
            </button>
          ))}
        </div>
        )}

        {error ? (
          <p className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            No se pudieron cargar los encargos: {(error as Error).message}
          </p>
        ) : isLoading ? (
          Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-44 rounded-2xl bg-ink-100 animate-pulse" />)
        ) : shown.length === 0 ? (
          <p className="text-center text-sm text-ink-400 py-14">
            {searching ? "Ningún encargo coincide con la búsqueda." : tab === "active" ? "No hay encargos pendientes." : "Nada por aquí todavía."}
          </p>
        ) : (
          <div className="flex flex-col gap-3">
            <button type="button" onClick={toggleAll} className="self-end -mb-1 text-[12px] font-medium text-ink-500 hover:text-brand-dark">
              {allOpen ? "Contraer todo" : "Expandir todo"}
            </button>
            {paged.visible.map((group) => (
              <GroupCard key={group.key} group={group} expanded={expanded.has(group.key)} onToggle={() => toggleGroup(group.key)}>
                {group.orders.map((order) => (
                  <OrderCard
                    key={order.id}
                    order={order}
                    stepping={stepMutation.isPending}
                    onStep={(status) => stepMutation.mutate({ id: order.id, status })}
                    onEdit={() => setEditFor(order)}
                    onAdvance={() => setAdvanceFor(order)}
                    onDeliver={() => setDeliverFor(order)}
                    onCancel={() => setCancelFor(order)}
                  />
                ))}
              </GroupCard>
            ))}
            <ShowMore remaining={paged.remaining} pageSize={paged.pageSize} onClick={paged.showMore} />
          </div>
        )}
      </main>

      <AnimatePresence>
        {creating   && <NewOrderModal key="new" onClose={() => setCreating(false)} onSaved={refresh} />}
        {editFor    && <EditModal    key="edit" order={editFor} onClose={() => setEditFor(null)} onSaved={refresh} />}
        {advanceFor && <AdvanceModal key="adv" order={advanceFor} onClose={() => setAdvanceFor(null)} onSaved={refresh} />}
        {deliverFor && <DeliverModal key="del" order={deliverFor} onClose={() => setDeliverFor(null)} onSaved={refresh} />}
        {cancelFor  && <CancelModal  key="can" order={cancelFor}  onClose={() => setCancelFor(null)}  onSaved={refresh} />}
      </AnimatePresence>
    </>
  );
}
