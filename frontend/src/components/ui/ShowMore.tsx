import { ChevronDown } from "lucide-react";

interface ShowMoreProps {
  remaining: number;
  pageSize:  number;
  onClick:   () => void;
}

/** Botón "Mostrar más" para listas paginadas con `usePaged`. */
export default function ShowMore({ remaining, pageSize, onClick }: ShowMoreProps) {
  if (remaining <= 0) return null;
  return (
    <button
      onClick={onClick}
      className="w-full mt-3 h-11 rounded-xl border border-ink-200 bg-white text-sm font-medium text-ink-700
                 inline-flex items-center justify-center gap-2 hover:border-ink-900 transition-colors"
    >
      Mostrar {Math.min(pageSize, remaining)} más
      <span className="text-ink-400 font-normal">· quedan {remaining}</span>
      <ChevronDown size={15} />
    </button>
  );
}
