import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { FEATURES } from "../constants/featureFlags";

const SESSION_KEY = "wc26_seen";

export default function WorldCupModal() {
  const [open, setOpen]       = useState(false);
  const navigate              = useNavigate();
  const [searchParams]        = useSearchParams();

  useEffect(() => {
    // No mostrar si el flag expiró, si ya está en la colección o si ya se vio esta sesión
    const alreadyOnFutbol = searchParams.get("filter") === "futbol";
    const alreadySeen     = sessionStorage.getItem(SESSION_KEY);
    if (!FEATURES.worldCup2026 || alreadyOnFutbol || alreadySeen) return;

    const t = setTimeout(() => setOpen(true), 900);
    return () => clearTimeout(t);
  }, []);

  function handleClose() {
    sessionStorage.setItem(SESSION_KEY, "1");
    setOpen(false);
  }

  function handleCTA() {
    handleClose();
    sessionStorage.removeItem("catalog_state");
    navigate("/?filter=futbol", { state: { scrollToCatalog: true } });
  }

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* ── Backdrop ── */}
          <motion.div
            className="fixed inset-0 z-[90] bg-black/65 backdrop-blur-[3px]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={handleClose}
          />

          {/* ── Modal ── */}
          <motion.div
            className="fixed inset-0 z-[91] flex items-center justify-center px-5 pointer-events-none"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className="pointer-events-auto w-full max-w-[360px] rounded-3xl overflow-hidden shadow-2xl"
              initial={{ scale: 0.88, y: 40 }}
              animate={{ scale: 1,    y: 0 }}
              exit={{ scale: 0.88,    y: 40 }}
              transition={{ type: "spring", stiffness: 320, damping: 28 }}
            >
              {/* ── Color stripe bar (4 host-country colors) ── */}
              <div className="flex h-[5px]">
                <div className="flex-1 bg-[#E8302A]" /> {/* USA red   */}
                <div className="flex-1 bg-[#F5C400]" /> {/* México yellow */}
                <div className="flex-1 bg-[#1C4F9C]" /> {/* Canadá blue  */}
                <div className="flex-1 bg-[#2B8C3E]" /> {/* verde fútbol  */}
              </div>

              {/* ── Main card — dark background ── */}
              <div className="relative bg-[#0C0C0C] px-6 pt-7 pb-7 overflow-hidden">

                {/* Watermark "26" en el fondo */}
                <p
                  aria-hidden
                  className="pointer-events-none select-none absolute -bottom-4 -right-3
                             text-[140px] font-['Anton'] leading-none text-white/[0.04]"
                >
                  26
                </p>

                {/* Diagonal stripe texture (sutil) */}
                <div
                  aria-hidden
                  className="pointer-events-none absolute inset-0 opacity-[0.03]"
                  style={{
                    backgroundImage:
                      "repeating-linear-gradient(45deg, #fff 0, #fff 1px, transparent 0, transparent 50%)",
                    backgroundSize: "12px 12px",
                  }}
                />

                {/* Close button */}
                <button
                  onClick={handleClose}
                  aria-label="Cerrar"
                  className="absolute top-4 right-4 text-white/30 hover:text-white/70
                             transition-colors rounded-full p-1"
                >
                  <X size={18} />
                </button>

                {/* Eyebrow tag */}
                <div className="flex items-center gap-2 mb-5">
                  <span className="text-[10px] font-poppins font-bold uppercase tracking-[0.18em] text-[#F5C400]">
                    ⚽ Mundial 2026
                  </span>
                </div>

                {/* ── Headline ── */}
                <div className="mb-4 leading-none">
                  <p className="font-['Anton'] text-[46px] uppercase text-white leading-[0.95]">
                    ¡Llegaron
                  </p>
                  <p className="font-['Anton'] text-[46px] uppercase leading-[0.95]">
                    <span className="text-[#E8302A]">las </span>
                    <span className="text-[#4ADE80]">che</span>
                    <span className="text-[#1C9BE8]">mas!</span>
                  </p>
                </div>

                {/* ── Body copy — léxico tico ── */}
                <p className="font-poppins text-[13px] text-white/60 leading-relaxed mb-6">
                  Las camisetas del mundial ya cayeron, mae.{" "}
                  <span className="text-white font-semibold italic">
                    ¡Estas chemas no solo piden estadio, piden calle!
                  </span>{" "}
                  No dejés que se agoten.
                </p>

                {/* ── CTA button ── */}
                <button
                  onClick={handleCTA}
                  className="w-full py-3.5 rounded-2xl font-poppins font-bold text-sm
                             tracking-wide transition-all active:scale-95
                             bg-[#F5C400] text-[#0C0C0C] hover:bg-[#FFD740]
                             shadow-[0_0_24px_rgba(245,196,0,0.35)]"
                >
                  Ver chemas ⚽
                </button>

                {/* ── Dismiss link ── */}
                <button
                  onClick={handleClose}
                  className="w-full text-center mt-3 text-[11px] font-poppins font-bold
                             text-white/60 hover:text-white/90 transition-colors"
                >
                  Ahora no, mae
                </button>
              </div>
            </motion.div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
