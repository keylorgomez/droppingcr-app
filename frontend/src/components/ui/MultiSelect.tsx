import { useState, useEffect, useRef } from "react";
import { ChevronDown, Check } from "lucide-react";
import { cn } from "../../lib/utils";
import type { Category } from "../../services/productService";

interface MultiSelectProps {
  options:     Category[];
  selected:    string[];
  onChange:    (ids: string[]) => void;
  placeholder?: string;
  error?:      string;
}

export default function MultiSelect({
  options, selected, onChange, placeholder = "Seleccionar…", error,
}: MultiSelectProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  function toggle(id: string) {
    onChange(selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id]);
  }

  const selectedLabels = options
    .filter((o) => selected.includes(o.id))
    .map((o) => o.name);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "w-full flex items-center justify-between rounded-xl border px-4 py-2.5 text-sm font-poppins transition",
          "focus:outline-none focus:border-brand-primary focus:ring-1 focus:ring-brand-primary/20",
          error ? "border-red-300" : "border-gray-200",
          open && "border-brand-primary ring-1 ring-brand-primary/20"
        )}
      >
        <span className={selectedLabels.length ? "text-brand-dark" : "text-gray-300"}>
          {selectedLabels.length ? selectedLabels.join(", ") : placeholder}
        </span>
        <ChevronDown
          size={15}
          className={cn("text-gray-400 transition-transform", open && "rotate-180")}
        />
      </button>

      {open && (
        <div className="absolute z-20 mt-1.5 w-full bg-white rounded-xl border border-gray-200
                        shadow-lg py-1 max-h-52 overflow-y-auto">
          {options.length === 0 && (
            <p className="px-4 py-3 text-xs text-gray-400 font-poppins">Sin categorías</p>
          )}
          {options.map((opt) => {
            const checked = selected.includes(opt.id);
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => toggle(opt.id)}
                className="w-full flex items-center gap-3 px-4 py-2.5 text-sm font-poppins
                           text-brand-dark hover:bg-brand-bg transition-colors text-left"
              >
                <span className={cn(
                  "w-4 h-4 rounded-md border flex items-center justify-center shrink-0 transition",
                  checked ? "bg-brand-primary border-brand-primary" : "border-gray-300"
                )}>
                  {checked && <Check size={10} className="text-white" strokeWidth={3} />}
                </span>
                {opt.name}
              </button>
            );
          })}
        </div>
      )}
      {error && <span className="text-[11px] text-red-500 font-poppins mt-1 block">{error}</span>}
    </div>
  );
}
