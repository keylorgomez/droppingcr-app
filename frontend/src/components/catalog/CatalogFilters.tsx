import { Check } from "lucide-react";
import { FIT_INFO, type FitType } from "../../lib/fitType";
import type { SizeGroup } from "../../lib/sizes";
import { cn } from "../../lib/utils";

const GROUP_LABEL: Record<SizeGroup, string> = { ropa: "Ropa", calzado: "Calzado" };

/**
 * Tallas agrupadas (ropa / calzado). El título del grupo solo aparece cuando
 * hay más de uno: dentro de una categoría no hace falta. Cada chip dice
 * cuántas piezas hay y los que darían cero quedan apagados, así nunca se
 * llega a "sin resultados" por tocar una talla.
 */
export function SizeFilter({
  groups, selected, onToggle, count, compact = false,
}: {
  groups:   { group: SizeGroup; sizes: string[] }[];
  selected: string[];
  onToggle: (size: string) => void;
  count:    (size: string) => number;
  /** Versión chica para el desplegable de escritorio. */
  compact?: boolean;
}) {
  const showTitles = groups.length > 1;
  return (
    <div className={cn("flex flex-col", compact ? "gap-3" : "gap-4")}>
      {groups.map(({ group, sizes }) => (
        <div key={group} className="flex flex-col gap-2">
          {showTitles && (
            <p className={cn("text-ink-400", compact ? "text-[10px] uppercase tracking-wider px-1" : "text-[11px]")}>
              {GROUP_LABEL[group]}
            </p>
          )}
          <div className={cn("grid", compact ? "grid-cols-3 gap-1" : "grid-cols-4 gap-2")}>
            {sizes.map((size) => {
              const active = selected.includes(size);
              const n = count(size);
              const off = n === 0 && !active;
              return (
                <button
                  key={size}
                  type="button"
                  onClick={() => onToggle(size)}
                  disabled={off}
                  aria-pressed={active}
                  className={cn(
                    "relative flex flex-col items-center justify-center border transition-colors",
                    compact ? "rounded-chip py-2 text-[12px]" : "rounded-btn py-2.5 text-[13px]",
                    active
                      ? "bg-ink-900 border-ink-900 text-bone"
                      : off
                        ? "border-ink-100 text-ink-300 cursor-not-allowed"
                        : "border-ink-200 text-ink-700 hover:border-ink-900 hover:text-ink-900",
                  )}
                >
                  {active && <Check size={9} className="absolute top-1 right-1 opacity-80" strokeWidth={3} />}
                  <span className="leading-tight">{size}</span>
                  <span className={cn("text-[9.5px] tnum leading-tight", active ? "text-bone/60" : "text-ink-400", off && "text-ink-300")}>
                    {n}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

/** Player / Fan / Retro, con el corte de cada una. */
export function FitFilter({
  fits, selected, onToggle, count,
}: {
  fits:     FitType[];
  selected: FitType[];
  onToggle: (fit: FitType) => void;
  count:    (fit: FitType) => number;
}) {
  return (
    <div className="grid grid-cols-3 gap-2">
      {fits.map((fit) => {
        const active = selected.includes(fit);
        const off = count(fit) === 0 && !active;
        return (
          <button
            key={fit}
            type="button"
            onClick={() => onToggle(fit)}
            disabled={off}
            aria-pressed={active}
            className={cn(
              "relative flex flex-col items-center justify-center gap-0.5 rounded-btn py-2.5 border transition-colors",
              active
                ? "bg-ink-900 border-ink-900 text-bone"
                : off ? "border-ink-100 text-ink-300 cursor-not-allowed" : "border-ink-200 text-ink-700",
            )}
          >
            {active && <Check size={9} className="absolute top-1.5 right-1.5 opacity-80" strokeWidth={3} />}
            <span className="text-[13px]">{FIT_INFO[fit].label}</span>
            <span className={cn("text-[10px]", active ? "text-bone/70" : "text-ink-400")}>{FIT_INFO[fit].cut}</span>
          </button>
        );
      })}
    </div>
  );
}
