import { useLayoutEffect, useRef, type InputHTMLAttributes } from "react";
import { cleanAmount, displayAmount } from "../../lib/money";

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, "value" | "onChange" | "type" | "inputMode"> & {
  /** Número limpio como string: "12500.5" (vacío = sin valor). */
  value:     string;
  onChange:  (raw: string) => void;
  /** 0 para enteros (cantidades, colones redondos). Por defecto 2. */
  decimals?: number;
};

/**
 * Campo de monto con separador de miles mientras se escribe: "12,500" en vez
 * de "12500", para que se lea de un vistazo si van tres o cuatro ceros.
 */
export default function MoneyInput({ value, onChange, decimals = 2, ...rest }: Props) {
  const ref   = useRef<HTMLInputElement>(null);
  // Cuántos dígitos había a la izquierda del cursor: al reformatear con comas
  // el cursor se devuelve a esa misma posición y no salta al final.
  const caret = useRef<number | null>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || caret.current === null || document.activeElement !== el) return;
    let digits = caret.current;
    let pos = 0;
    while (pos < el.value.length && digits > 0) {
      if (/[\d.]/.test(el.value[pos])) digits--;
      pos++;
    }
    el.setSelectionRange(pos, pos);
    caret.current = null;
  });

  return (
    <input
      {...rest}
      ref={ref}
      type="text"
      inputMode={decimals > 0 ? "decimal" : "numeric"}
      autoComplete="off"
      value={displayAmount(value)}
      onChange={(e) => {
        let text = e.target.value;
        const pos = e.target.selectionStart ?? text.length;
        // Teclado en español: la tecla decimal escribe ",". Si se acaba de
        // teclear una coma (no la que pone el formato), es el punto decimal.
        const typed = (e.nativeEvent as InputEvent).data;
        if (decimals > 0 && typed === "," && !text.slice(0, pos - 1).includes(".")) {
          text = text.slice(0, pos - 1) + "." + text.slice(pos);
        }
        caret.current = text.slice(0, pos).replace(/[^\d.]/g, "").length;
        onChange(cleanAmount(text, decimals));
      }}
    />
  );
}
