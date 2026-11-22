import { useId, useState } from "react";
import { motion } from "motion/react";
import { Check } from "lucide-react";
import { normalizeSize, SIZE_PRESETS, type ProductSizeKind } from "../../lib/sizes";
import { cn } from "../../lib/utils";

const KINDS: ProductSizeKind[] = ["ropa", "calzado", "unica"];

/**
 * Tallas listas para agregar, según el tipo de producto. El tipo sale de la
 * categoría (Tenis → calzado, Gorras → talla única…) pero se puede cambiar.
 * Las que ya están agregadas quedan marcadas y no se repiten.
 */
export default function SizeQuickAdd({
  suggestedKind, existing, onAdd,
}: {
  suggestedKind: ProductSizeKind;
  existing: string[];
  onAdd: (size: string) => void;
}) {
  // Lo elegido a mano manda; si no, sigue a la categoría.
  const [chosen, setChosen] = useState<ProductSizeKind | null>(null);
  const pillId = useId();
  const kind = chosen ?? suggestedKind;
  const have = new Set(existing.map((size) => normalizeSize(size)));

  return (
    <div className="flex flex-col gap-2.5">
      <div className="grid grid-cols-3 gap-1 rounded-xl bg-ink-50 p-1">
        {KINDS.map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => setChosen(option)}
            aria-pressed={kind === option}
            className={cn(
              "relative h-8 rounded-lg text-xs transition-colors",
              kind === option ? "text-white font-semibold" : "text-ink-500 hover:text-brand-dark",
            )}
          >
            {kind === option && (
              <motion.span
                layoutId={`size-kind-${pillId}`}
                className="absolute inset-0 rounded-lg bg-brand-dark"
                transition={{ type: "spring", stiffness: 420, damping: 34 }}
              />
            )}
            <span className="relative">{SIZE_PRESETS[option].label}</span>
          </button>
        ))}
      </div>

      <motion.div
        key={kind}
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2 }}
        className="flex flex-wrap gap-1.5"
      >
        {SIZE_PRESETS[kind].sizes.map((size) => {
          const added = have.has(normalizeSize(size));
          return (
            <button
              key={size}
              type="button"
              onClick={() => !added && onAdd(size)}
              disabled={added}
              className={cn(
                "flex items-center gap-1 px-3 py-1 rounded-full text-xs border transition-colors",
                added
                  ? "border-brand-dark bg-brand-dark text-white cursor-default"
                  : "border-ink-200 text-ink-500 hover:border-brand-primary hover:text-brand-primary",
              )}
            >
              {added ? <Check size={11} strokeWidth={3} /> : "+"} {size}
            </button>
          );
        })}
      </motion.div>
      {kind === "calzado" && (
        <p className="text-[11px] text-ink-400">
          Si la caja trae la talla US, agregala a mano: "42 EUR / 9 US".
        </p>
      )}
    </div>
  );
}
