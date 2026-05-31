import { Loader2, Trash2, PackageX } from "lucide-react";

interface DeleteConfirmModalProps {
  productName: string;
  isPending:   boolean;
  onConfirm:   () => void;
  onCancel:    () => void;
}

export default function DeleteConfirmModal({
  productName,
  isPending,
  onConfirm,
  onCancel,
}: DeleteConfirmModalProps) {
  return (
    <>
      <div
        className="fixed inset-0 bg-black/40 z-40 backdrop-blur-sm"
        onClick={onCancel}
      />
      <div className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50
                      w-full max-w-sm bg-white rounded-2xl shadow-xl overflow-hidden">

        {/* Red top band */}
        <div className="bg-red-50 px-6 pt-7 pb-5 flex flex-col items-center text-center gap-3">
          <div className="w-14 h-14 rounded-full bg-red-100 flex items-center justify-center">
            <PackageX size={26} className="text-red-500" strokeWidth={1.6} />
          </div>
          <div>
            <p className="font-poppins font-semibold text-base text-brand-dark">
              ¿Eliminar producto?
            </p>
            <p className="font-poppins text-sm text-gray-500 mt-1 leading-snug">
              Vas a eliminar{" "}
              <span className="font-semibold text-brand-dark">"{productName}"</span>{" "}
              permanentemente. Esta acción no se puede deshacer.
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3 px-6 py-5">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-poppins
                       text-gray-500 hover:border-gray-300 hover:text-brand-dark transition-colors"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isPending}
            className="flex-1 py-2.5 rounded-xl bg-red-500 text-white text-sm font-poppins
                       font-medium flex items-center justify-center gap-2
                       hover:bg-red-600 transition-colors disabled:opacity-60"
          >
            {isPending
              ? <Loader2 size={14} className="animate-spin" />
              : <Trash2 size={14} strokeWidth={2} />
            }
            Sí, eliminar
          </button>
        </div>
      </div>
    </>
  );
}
