import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Loader2, CheckCircle2, ExternalLink } from "lucide-react";

function IgIcon({ size = 15, color = "currentColor" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.5" cy="6.5" r="1" fill={color} stroke="none" />
    </svg>
  );
}
import { publishToInstagram } from "../../services/instagramService";
import { cn } from "../../lib/utils";

interface Props {
  productName: string;
  imageUrls:   string[];
  caption:     string;
  onClose:     () => void;
}

type Stage = "compose" | "publishing" | "done";

export default function InstagramPublishModal({ productName, imageUrls, caption: initialCaption, onClose }: Props) {
  const [caption,  setCaption]  = useState(initialCaption);
  const [stage,    setStage]    = useState<Stage>("compose");
  const [error,    setError]    = useState("");
  const [postId,   setPostId]   = useState("");

  async function handlePublish() {
    setError("");
    setStage("publishing");
    try {
      const id = await publishToInstagram(imageUrls, caption);
      setPostId(id);
      setStage("done");
    } catch (err) {
      setError((err as Error).message);
      setStage("compose");
    }
  }

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4">
        {/* Backdrop */}
        <motion.div
          className="absolute inset-0 bg-black/50"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={stage !== "publishing" ? onClose : undefined}
        />

        {/* Modal */}
        <motion.div
          className="relative bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden"
          initial={{ opacity: 0, y: 24, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 16, scale: 0.97 }}
          transition={{ duration: 0.22, ease: "easeOut" }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-[#f09433] via-[#e6683c] via-[#dc2743] via-[#cc2366] to-[#bc1888] flex items-center justify-center">
                <IgIcon size={15} color="white" />
              </div>
              <div>
                <p className="font-poppins font-semibold text-sm text-brand-dark leading-tight">
                  Publicar en Instagram
                </p>
                <p className="font-poppins text-[10px] text-gray-400 leading-tight">{productName}</p>
              </div>
            </div>
            {stage !== "publishing" && (
              <button
                type="button"
                onClick={onClose}
                className="p-1.5 rounded-lg text-gray-400 hover:text-brand-dark hover:bg-gray-50 transition-colors"
              >
                <X size={16} strokeWidth={2} />
              </button>
            )}
          </div>

          <div className="p-5">
            {stage === "done" ? (
              // ── Success ──────────────────────────────────────────────────
              <div className="flex flex-col items-center gap-4 py-4">
                <div className="w-14 h-14 rounded-full bg-emerald-50 flex items-center justify-center">
                  <CheckCircle2 size={30} className="text-emerald-500" strokeWidth={1.8} />
                </div>
                <div className="text-center">
                  <p className="font-poppins font-semibold text-brand-dark">¡Publicado con éxito!</p>
                  <p className="font-poppins text-xs text-gray-400 mt-1">
                    El post ya está visible en @dropping.cr
                  </p>
                </div>
                <a
                  href={`https://www.instagram.com/p/${postId}/`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 text-xs font-poppins text-brand-primary hover:underline"
                >
                  <ExternalLink size={12} strokeWidth={2} />
                  Ver publicación
                </a>
                <button
                  type="button"
                  onClick={onClose}
                  className="w-full py-2.5 rounded-xl bg-brand-primary text-white text-sm font-poppins font-medium
                             hover:bg-[#7a3e18] transition-colors"
                >
                  Cerrar
                </button>
              </div>
            ) : (
              // ── Compose ───────────────────────────────────────────────────
              <>
                {/* Image previews */}
                <div className="flex gap-2 mb-4 overflow-x-auto pb-1">
                  {imageUrls.slice(0, 10).map((url, i) => (
                    <img
                      key={i}
                      src={url}
                      alt=""
                      className={cn(
                        "shrink-0 object-cover rounded-lg border border-gray-100",
                        imageUrls.length === 1 ? "w-full max-h-40" : "w-16 h-16"
                      )}
                    />
                  ))}
                </div>

                {imageUrls.length > 1 && (
                  <p className="text-[11px] font-poppins text-gray-400 mb-3">
                    Se publicará como carrusel con {Math.min(imageUrls.length, 10)} imágenes.
                  </p>
                )}

                {/* Caption editor */}
                <div className="flex flex-col gap-1 mb-4">
                  <label className="text-[10px] font-poppins font-semibold uppercase tracking-widest text-gray-400">
                    Caption
                  </label>
                  <textarea
                    value={caption}
                    onChange={(e) => setCaption(e.target.value)}
                    rows={8}
                    className="w-full rounded-xl border border-gray-200 px-3.5 py-2.5 text-sm font-poppins
                               text-brand-dark outline-none focus:border-brand-primary resize-none
                               focus:ring-1 focus:ring-brand-primary/20 transition"
                  />
                  <p className="text-[10px] font-poppins text-gray-300 text-right">
                    {caption.length} / 2200 caracteres
                  </p>
                </div>

                {error && (
                  <p className="text-xs font-poppins text-red-500 bg-red-50 rounded-xl px-3 py-2 mb-3">
                    {error}
                  </p>
                )}

                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={onClose}
                    className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-poppins
                               text-gray-500 hover:border-gray-300 transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={handlePublish}
                    disabled={stage === "publishing" || !caption.trim()}
                    className="flex-1 py-2.5 rounded-xl text-white text-sm font-poppins font-medium
                               flex items-center justify-center gap-2 transition-colors
                               bg-gradient-to-r from-[#833ab4] via-[#fd1d1d] to-[#fcb045]
                               hover:opacity-90 disabled:opacity-50"
                  >
                    {stage === "publishing"
                      ? <><Loader2 size={14} className="animate-spin" /> Publicando…</>
                      : <><IgIcon size={14} /> Publicar</>
                    }
                  </button>
                </div>
              </>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
