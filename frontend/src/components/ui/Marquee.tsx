import { cn } from "../../lib/utils";

interface MarqueeProps {
  items: string[];
  /** Invierte el esquema: texto oscuro sobre fondo claro. */
  inverted?: boolean;
  fast?: boolean;
  className?: string;
}

/**
 * Cinta infinita de texto. Duplica los items exactamente una vez y anima
 * -50%, de modo que el bucle es continuo sin importar cuántos items haya.
 */
export default function Marquee({ items, inverted = false, fast = false, className }: MarqueeProps) {
  const track = [...items, ...items];

  return (
    <div
      className={cn(
        "relative w-full overflow-hidden border-y select-none",
        inverted ? "bg-bone text-ink-900 border-ink-200" : "bg-ink-900 text-bone border-ink-900",
        className
      )}
      aria-hidden="true"
    >
      <div className={cn("flex w-max", fast ? "animate-marquee-fast" : "animate-marquee")}>
        {track.map((text, i) => (
          <span
            key={i}
            className="flex items-center gap-6 whitespace-nowrap px-6 py-2.5
                       font-display uppercase text-[12px] tracking-widest2 leading-none"
          >
            {text}
            <span className="inline-block w-1 h-1 rounded-full bg-current opacity-50" />
          </span>
        ))}
      </div>
    </div>
  );
}
