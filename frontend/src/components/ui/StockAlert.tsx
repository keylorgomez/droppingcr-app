import { PackageX } from "lucide-react";

/**
 * Aviso a pantalla completa de "esta pieza ya se vendió". Se usa cuando la
 * base rechaza una venta por falta de stock o cuando el stock en vivo deja en
 * cero algo que la persona tenía seleccionado: no puede pasar como un toast
 * que se va solo.
 */
export default function StockAlert({
  title = "Esta pieza ya se vendió",
  message,
  actionLabel = "Entendido",
  onClose,
}: {
  title?:       string;
  message:      string;
  actionLabel?: string;
  onClose:      () => void;
}) {
  return (
    // stopPropagation: puede abrirse dentro de un modal cuyo fondo cierra al
    // hacer clic; el clic en el aviso no debe cerrar el formulario de atrás.
    <div onClick={(e) => e.stopPropagation()} className="fixed inset-0 z-[60] flex items-center justify-center p-4" role="alertdialog" aria-modal="true" aria-labelledby="stock-alert-title">
      <div className="absolute inset-0 bg-ink-950/55 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-sm rounded-2xl bg-white shadow-xl p-6 flex flex-col items-center text-center gap-3">
        <span className="h-12 w-12 rounded-full bg-red-50 text-red-500 flex items-center justify-center">
          <PackageX size={24} strokeWidth={1.8} />
        </span>
        <h2 id="stock-alert-title" className="font-semibold text-brand-dark text-lg leading-tight">{title}</h2>
        <p className="text-sm text-ink-500 leading-snug">{message}</p>
        <button
          type="button"
          autoFocus
          onClick={onClose}
          className="mt-2 w-full h-11 rounded-xl bg-ink-900 text-bone text-sm font-semibold hover:bg-ink-700 transition-colors"
        >
          {actionLabel}
        </button>
      </div>
    </div>
  );
}
