import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { X, ArrowRight } from "lucide-react";
import { FEATURES } from "../constants/featureFlags";
import { t } from "../lib/i18n";

const SESSION_KEY = "promo_seen";
const ENTRANCE_DELAY_MS = 1100;
const DIGIT_STEP_EM = 0.8;

interface PromoBannerProps {
  /** Descuento más alto entre los productos activos — 0 oculta el banner. */
  maxDiscountPercent: number;
  /** true cuando ya estamos en la página que el banner promociona. */
  suppressed?: boolean;
}

function DigitReel({ digit, delay, reduceMotion }: { digit: number; delay: number; reduceMotion: boolean }) {
  const start = (digit + 6) % 10;
  return (
    <span className="relative inline-block h-[0.8em] overflow-hidden align-top
                      font-poppins font-semibold italic text-[56px] leading-[0.8] text-promo-blush
                      [font-variant-numeric:proportional-nums]">
      <motion.span
        className="flex flex-col items-center"
        initial={{ y: `-${start * DIGIT_STEP_EM}em` }}
        animate={{ y: `-${digit * DIGIT_STEP_EM}em` }}
        transition={reduceMotion ? { duration: 0 } : { duration: 0.85, ease: [0.16, 1, 0.3, 1], delay }}
      >
        {Array.from({ length: 10 }, (_, d) => (
          <span key={d} className="block h-[0.8em] leading-[0.8]">{d}</span>
        ))}
      </motion.span>
    </span>
  );
}

export default function PromoBanner({ maxDiscountPercent, suppressed = false }: PromoBannerProps) {
  const navigate = useNavigate();
  const reduceMotion = useReducedMotion() ?? false;
  const [entered, setEntered] = useState(false);

  const shouldOffer = FEATURES.discountBanner && !suppressed && maxDiscountPercent > 0;

  useEffect(() => {
    if (!shouldOffer) return;
    if (sessionStorage.getItem(SESSION_KEY)) return;

    const timer = setTimeout(() => setEntered(true), reduceMotion ? 150 : ENTRANCE_DELAY_MS);
    return () => clearTimeout(timer);
  }, [shouldOffer, reduceMotion]);

  function dismiss() {
    sessionStorage.setItem(SESSION_KEY, "1");
    setEntered(false);
  }

  function goToPromos() {
    dismiss();
    navigate("/?filter=descuentos", { state: { scrollToCatalog: true } });
  }

  const digits = String(maxDiscountPercent).split("").map(Number);

  return (
    <AnimatePresence>
      {entered && (
        <motion.div
          initial={{ y: 60, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 40, opacity: 0 }}
          transition={{ duration: reduceMotion ? 0.3 : 0.62, ease: [0.16, 1, 0.3, 1] }}
          onClick={goToPromos}
          className="group fixed z-40 left-4 right-4 bottom-4 sm:left-auto sm:right-6 sm:bottom-6 sm:w-72
                     bg-promo-bg border-[1.5px] border-red-500 rounded-[10px]
                     px-4 pt-4 pb-4 shadow-2xl cursor-pointer"
        >
          <div className="flex items-start justify-between mb-3.5">
            <span className="font-poppins font-bold text-[9.5px] tracking-[0.14em] uppercase text-promo-blush">
              {t.promoBanner.tag}
            </span>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); dismiss(); }}
              className="text-white/75 hover:text-white transition-colors -mt-0.5"
              aria-label={t.actions.close}
            >
              <X size={13} strokeWidth={2.2} />
            </button>
          </div>

          <p className="font-poppins italic text-xs text-white mb-0.5">{t.promoBanner.lede}</p>

          <div className="flex items-end gap-[5px] mb-2.5">
            <span className="flex">
              {digits.map((d, i) => (
                <span key={i} className={i > 0 ? "-ml-[0.09em]" : ""}>
                  <DigitReel digit={d} delay={reduceMotion ? 0 : i * 0.1} reduceMotion={reduceMotion} />
                </span>
              ))}
            </span>
            <span className="flex flex-col items-center gap-px pb-[0.06em]">
              <span className="font-poppins font-semibold italic text-3xl leading-[0.85] text-promo-blush opacity-90">%</span>
              <span className="font-poppins font-bold text-[10px] tracking-[0.14em] uppercase text-white">
                {t.promoBanner.off}
              </span>
            </span>
          </div>

          <div className="w-[30px] h-[1.5px] bg-promo-blush opacity-90 mb-2.5" />

          <p className="font-poppins text-[11.5px] leading-[1.5] text-white mb-3.5 max-w-[30ch]">
            {t.promoBanner.subtext}
          </p>

          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); goToPromos(); }}
            className="inline-flex items-center gap-[7px] font-poppins font-medium text-xs
                       px-3.5 py-2 rounded-full border border-white/30 text-white
                       transition-colors
                       group-hover:bg-promo-coral group-hover:border-promo-coral group-hover:text-white group-hover:font-bold"
          >
            {t.promoBanner.cta}
            <ArrowRight size={11} strokeWidth={2.6} />
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
