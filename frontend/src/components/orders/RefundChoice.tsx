import MoneyInput from "../ui/MoneyInput";
import { parseAmountValue } from "../../lib/money";
import type { RefundMode } from "../../lib/refunds";
import { cn } from "../../lib/utils";

/**
 * Devolver todo, una parte o nada de lo que el cliente pagó. Lo que no se
 * devuelve queda como ganancia del negocio (ej. un adelanto que nadie reclamó).
 * Nunca se puede devolver más de lo pagado, aunque la venta debiera más.
 */
export default function RefundChoice({
  paid, mode, onMode, partial, onPartial, owedNote,
}: {
  paid:      number;
  mode:      RefundMode | null;
  onMode:    (mode: RefundMode) => void;
  partial:   string;
  onPartial: (raw: string) => void;
  /** Aviso extra, ej. "Faltaban ₡20,000 por cobrar: ese saldo se anula." */
  owedNote?: string;
}) {
  const money = (n: number) => `₡${Math.round(n).toLocaleString("en-US")}`;
  const partialValue = parseAmountValue(partial);
  const partialError = mode === "part" && partial !== "" && !(partialValue > 0 && partialValue < paid)
    ? `Tiene que ser mayor a 0 y menor a ${money(paid)}.`
    : "";

  const optionCls = (active: boolean) => cn(
    "w-full text-left rounded-xl border px-4 py-3 text-sm transition-colors",
    active ? "border-brand-primary bg-brand-bg text-brand-dark" : "border-ink-200 text-ink-500 hover:border-ink-300",
  );

  if (paid <= 0) {
    return (
      <p className="text-xs text-ink-400">
        El cliente no había pagado nada: no hay plata que devolver.{owedNote ? ` ${owedNote}` : ""}
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs font-medium text-ink-500 uppercase tracking-wider">
        El cliente pagó {money(paid)}. ¿Cuánto se le devolvió?
      </p>
      {owedNote && <p className="text-[11px] text-ink-400 -mt-1">{owedNote}</p>}

      <button type="button" onClick={() => onMode("all")} className={optionCls(mode === "all")}>
        <span className="font-semibold">Todo ({money(paid)})</span>
        <span className="block text-[11px] text-ink-400 mt-0.5">Sale como devolución en Movimientos y baja el balance.</span>
      </button>

      <button type="button" onClick={() => onMode("part")} className={optionCls(mode === "part")}>
        <span className="font-semibold">Una parte</span>
        <span className="block text-[11px] text-ink-400 mt-0.5">Lo que no se devuelve queda como ganancia.</span>
      </button>
      {mode === "part" && (
        <div className="flex flex-col gap-1 pl-1">
          <MoneyInput
            value={partial}
            onChange={onPartial}
            placeholder="Monto devuelto"
            autoFocus
            className="w-full rounded-xl border border-ink-200 px-4 py-2.5 text-sm text-brand-dark
                       placeholder:text-ink-300 outline-none focus:border-brand-primary
                       focus:ring-1 focus:ring-brand-primary/20 transition"
          />
          {partialError
            ? <span className="text-[11px] text-red-500">{partialError}</span>
            : partialValue > 0 && partialValue < paid && (
                <span className="text-[11px] text-ink-400">
                  Se devuelven {money(partialValue)} y el negocio se queda {money(paid - partialValue)}.
                </span>
              )}
        </div>
      )}

      <button type="button" onClick={() => onMode("none")} className={optionCls(mode === "none")}>
        <span className="font-semibold">Nada</span>
        <span className="block text-[11px] text-ink-400 mt-0.5">
          El negocio se queda los {money(paid)} (ej. nadie lo reclamó). Cuenta como ganancia.
        </span>
      </button>
    </div>
  );
}
