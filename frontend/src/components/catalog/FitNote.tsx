import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { ArrowRight } from "lucide-react";
import { FIT_INFO, normalizeSize, recommendedSize, type FitType } from "../../lib/fitType";
import { cn } from "../../lib/utils";

const USUAL_SIZES = ["S", "M", "L", "XL", "XXL"] as const;
const EASE = [0.16, 1, 0.3, 1] as const;

/**
 * Nota de corte para camisetas de fútbol: qué versión es, qué tan ajustada
 * queda y qué talla pedir según la que la persona usa normalmente.
 */
export default function FitNote({
  fit, availableSizes, selectedSize, onPickSize,
}: {
  fit: FitType;
  /** Tallas con stock, tal como están en el producto. */
  availableSizes: string[];
  selectedSize: string | null;
  onPickSize: (size: string) => void;
}) {
  const info = FIT_INFO[fit];
  const [usual, setUsual] = useState<string | null>(null);
  const target   = usual ? recommendedSize(usual, fit) : null;
  // La talla del producto que corresponde a la recomendada ("2XL" ↔ "XXL").
  const match    = target ? availableSizes.find((size) => normalizeSize(size) === target) ?? null : null;
  const picked   = match !== null && selectedSize === match;

  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.3 }}
      transition={{ duration: 0.7, ease: EASE }}
      className="mt-5 rounded-card border border-ink-200 bg-ink-50/60 p-4 sm:p-5"
    >
      {/* Encabezado */}
      <div className="flex items-center justify-between gap-3">
        <p className="type-eyebrow text-ink-900">Versión {info.label}</p>
        <span className="font-display uppercase text-[10px] tracking-widest2 rounded-chip
                         border border-ink-900 text-ink-900 px-2 py-1 leading-none whitespace-nowrap">
          {info.cut}
        </span>
      </div>
      <p className="text-[13px] leading-relaxed text-ink-500 mt-2.5">{info.about}</p>

      {/* Medidor: de ajustada a holgada */}
      <div className="mt-5" aria-hidden="true">
        <div className="relative h-[3px] rounded-full bg-ink-200">
          <motion.div
            className="absolute inset-y-0 left-0 rounded-full bg-ink-900"
            initial={{ width: "50%" }}
            whileInView={{ width: `${info.ease * 100}%` }}
            viewport={{ once: true }}
            transition={{ duration: 1.1, ease: EASE, delay: 0.25 }}
          />
          <motion.span
            className="absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full
                       bg-ink-900 ring-4 ring-ink-50"
            initial={{ left: "50%" }}
            whileInView={{ left: `${info.ease * 100}%` }}
            viewport={{ once: true }}
            transition={{ duration: 1.1, ease: EASE, delay: 0.25 }}
          />
        </div>
        <div className="flex justify-between mt-2 text-[10px] font-display uppercase tracking-widest2 text-ink-400">
          <span className={cn(info.ease < 0.5 && "text-ink-900")}>Ajustada</span>
          <span>Regular</span>
          <span className={cn(info.ease >= 0.5 && "text-ink-900")}>Holgada</span>
        </div>
      </div>

      {/* Recomendación */}
      <p className="text-[13px] leading-relaxed text-ink-900 mt-5">
        <span className="font-semibold">
          +{info.sizeUp} {info.sizeUp === 1 ? "talla" : "tallas"}.
        </span>{" "}
        {info.advice}
      </p>

      {/* Calculadora de talla */}
      <div className="mt-4 pt-4 border-t border-ink-200">
        <p className="text-[12px] text-ink-500 mb-2.5">¿Qué talla usás normalmente?</p>
        <div className="flex flex-wrap gap-1.5">
          {USUAL_SIZES.map((size) => (
            <button
              key={size}
              type="button"
              onClick={() => setUsual(usual === size ? null : size)}
              aria-pressed={usual === size}
              className={cn(
                "h-9 min-w-[2.75rem] px-3 rounded-btn text-[12.5px] border transition-colors",
                usual === size
                  ? "bg-ink-900 text-bone border-ink-900"
                  : "border-ink-200 text-ink-900 hover:border-ink-900 bg-white/60",
              )}
            >
              {size}
            </button>
          ))}
        </div>

        <AnimatePresence mode="wait" initial={false}>
          {usual && (
            <motion.div
              key={usual}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.3, ease: EASE }}
              className="mt-3.5 flex flex-wrap items-center gap-x-3 gap-y-2"
            >
              {target ? (
                <>
                  <p className="flex items-center gap-2 text-[13px] text-ink-500">
                    <span className="tnum">{usual}</span>
                    <ArrowRight size={13} strokeWidth={1.8} className="text-ink-400" />
                    <span className="text-ink-900">
                      Pedí <span className="font-semibold">{target}</span>
                    </span>
                  </p>
                  {match ? (
                    <button
                      type="button"
                      onClick={() => onPickSize(match)}
                      disabled={picked}
                      className={cn(
                        "font-display uppercase text-[10.5px] tracking-widest2 transition-colors",
                        picked ? "text-ink-400" : "text-ink-900 underline underline-offset-4 hover:text-ink-500",
                      )}
                    >
                      {picked ? "Talla elegida" : `Elegir ${match}`}
                    </button>
                  ) : (
                    <span className="text-[12px] text-ink-400">No la tenemos disponible ahora: escribinos y te la conseguimos.</span>
                  )}
                </>
              ) : (
                <p className="text-[12.5px] text-ink-500">
                  Para esa talla escribinos y te ayudamos a encontrar la que te quede bien.
                </p>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
