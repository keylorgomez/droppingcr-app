import { useId } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Shirt } from "lucide-react";
import { FIT_INFO, FIT_TYPES, type FitType } from "../../lib/fitType";
import { cn } from "../../lib/utils";

/**
 * Versión de la camiseta (solo productos de fútbol). Opcional: tocar la
 * opción elegida otra vez la quita.
 */
export default function FitTypePicker({
  value, onChange, suggested,
}: {
  value:     FitType | null;
  onChange:  (value: FitType | null) => void;
  /** Lo que dice el nombre del producto, para sugerirlo si no hay nada elegido. */
  suggested?: FitType | null;
}) {
  const pillId = useId();
  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: "auto" }}
      exit={{ opacity: 0, height: 0 }}
      transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
      className="overflow-hidden"
    >
      <div className="flex flex-col gap-2 pt-3">
        <div className="flex items-center gap-2">
          <Shirt size={14} className="text-brand-accent shrink-0" />
          <p className="text-xs font-medium text-ink-500 uppercase tracking-wider">
            Versión <span className="text-ink-300 normal-case font-normal">(opcional)</span>
          </p>
        </div>

        <div className="grid grid-cols-3 gap-1.5 rounded-xl bg-ink-50 p-1">
          {FIT_TYPES.map((fit) => {
            const active = value === fit;
            return (
              <button
                key={fit}
                type="button"
                onClick={() => onChange(active ? null : fit)}
                aria-pressed={active}
                className={cn(
                  "relative h-10 rounded-lg text-sm transition-colors",
                  active ? "text-white font-semibold" : "text-ink-500 hover:text-brand-dark",
                )}
              >
                {active && (
                  <motion.span
                    layoutId={`fit-type-${pillId}`}
                    className="absolute inset-0 rounded-lg bg-brand-dark shadow-sm"
                    transition={{ type: "spring", stiffness: 420, damping: 34 }}
                  />
                )}
                <span className="relative">{FIT_INFO[fit].label}</span>
              </button>
            );
          })}
        </div>

        <AnimatePresence mode="wait" initial={false}>
          <motion.p
            key={value ?? "none"}
            initial={{ opacity: 0, y: 3 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -3 }}
            transition={{ duration: 0.15 }}
            className="text-[11px] text-ink-400"
          >
            {value
              ? `${FIT_INFO[value].adminHint}. Se muestra en el detalle del producto.`
              : "Sin indicar: no se muestra ninguna nota de talla."}
          </motion.p>
        </AnimatePresence>

        {!value && suggested && (
          <button
            type="button"
            onClick={() => onChange(suggested)}
            className="self-start text-[11px] text-brand-primary hover:text-brand-dark transition-colors"
          >
            El nombre dice "{FIT_INFO[suggested].label}": usarla
          </button>
        )}
      </div>
    </motion.div>
  );
}
