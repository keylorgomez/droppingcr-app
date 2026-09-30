import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { X, ArrowRight } from "lucide-react";
import { FEATURES } from "../constants/featureFlags";
import { ROUTES } from "../constants/app";
import { t } from "../lib/i18n";

const SESSION_KEY = "promo_seen";
// Aparece cuando el visitante ya pasó el hero: en móvil la tarjeta tapa media
// pantalla, y sobre el hero arruina la primera impresión de la landing.
const SCROLL_TRIGGER_RATIO = 0.75;
const FALLBACK_DELAY_MS = 20000;
// Los dígitos de Anton miden 0.882em de tinta (medido con TextMetrics: 0.870
// sobre la línea base y 0.012 bajo ella). La celda del carrete tiene que ser
// mayor que eso o el número sale recortado. 0.95em deja el dígito centrado y,
// sobre todo, deja hueco suficiente para que el dígito de la celda vecina no
// asome por redondeo a subpíxel (0.95em de 56px cae en 53.2px).
const DIGIT_CELL_EM = 0.95;

interface PromoBannerProps {
  /** Descuento más alto entre los productos activos — 0 oculta el banner. */
  maxDiscountPercent: number;
  /** true cuando ya estamos en la página que el banner promociona. */
  suppressed?: boolean;
}

function DigitReel({ digit, delay, reduceMotion }: { digit: number; delay: number; reduceMotion: boolean }) {
  const start = (digit + 6) % 10;
  return (
    <span className="relative inline-block h-[0.95em] overflow-hidden align-bottom
                      font-display text-[48px] sm:text-[56px] leading-[0.95] text-bone
                      [font-variant-numeric:proportional-nums]">
      <motion.span
        className="flex flex-col items-center"
        initial={{ y: `-${start * DIGIT_CELL_EM}em` }}
        animate={{ y: `-${digit * DIGIT_CELL_EM}em` }}
        transition={reduceMotion ? { duration: 0 } : { duration: 0.85, ease: [0.16, 1, 0.3, 1], delay }}
      >
        {Array.from({ length: 10 }, (_, d) => (
          <span key={d} className="block h-[0.95em] leading-[0.95]">{d}</span>
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

    let done = false;
    const reveal = () => {
      if (done) return;
      done = true;
      setEntered(true);
      window.removeEventListener("scroll", onScroll);
      clearTimeout(timer);
    };

    const onScroll = () => {
      if (window.scrollY > window.innerHeight * SCROLL_TRIGGER_RATIO) reveal();
    };

    // Red de seguridad para páginas cortas donde nunca hay scroll suficiente
    const timer = setTimeout(reveal, FALLBACK_DELAY_MS);
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();

    return () => {
      window.removeEventListener("scroll", onScroll);
      clearTimeout(timer);
    };
  }, [shouldOffer]);

  function dismiss() {
    sessionStorage.setItem(SESSION_KEY, "1");
    setEntered(false);
  }

  function goToPromos() {
    dismiss();
    navigate(ROUTES.catalogFilter("descuentos"));
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
          className="fixed z-40 left-4 right-4 bottom-4 max-w-[320px] mx-auto sm:mx-0 sm:left-auto sm:right-6 sm:bottom-6 sm:w-[286px]
                     rounded-card bg-ink-950 text-bone border border-bone/15
                     px-5 pt-4 pb-5 shadow-lift"
        >
          <div className="flex items-start justify-between mb-4">
            <span className="type-eyebrow text-bone/50">{t.promoBanner.tag}</span>
            <button
              type="button"
              onClick={dismiss}
              className="text-bone/50 hover:text-bone transition-colors -mt-0.5"
              aria-label={t.actions.close}
            >
              <X size={13} strokeWidth={2} />
            </button>
          </div>

          <p className="type-accent text-base text-bone/70 mb-1">{t.promoBanner.lede}</p>

          <div className="flex items-end gap-1.5 mb-3">
            <span className="flex">
              {digits.map((d, i) => (
                <span key={i} className={i > 0 ? "-ml-[0.04em]" : ""}>
                  <DigitReel digit={d} delay={reduceMotion ? 0 : i * 0.1} reduceMotion={reduceMotion} />
                </span>
              ))}
            </span>
            <span className="flex flex-col items-start gap-0.5 pb-[0.1em]">
              <span className="font-display text-3xl leading-[0.95] text-bone">%</span>
              <span className="type-eyebrow text-bone/60">{t.promoBanner.off}</span>
            </span>
          </div>

          <div className="w-8 h-px bg-bone/40 mb-3" />

          <p className="text-[12px] leading-[1.55] text-bone/65 mb-5 max-w-[30ch]">
            {t.promoBanner.subtext}
          </p>

          <button
            type="button"
            onClick={goToPromos}
            className="inline-flex items-center gap-2 font-display uppercase text-[10px] tracking-widest2
                       px-4 py-2.5 rounded-btn border border-bone/40 text-bone transition-colors
                       hover:bg-bone hover:text-ink-900 hover:border-bone"
          >
            {t.promoBanner.cta}
            <ArrowRight size={11} strokeWidth={2.4} />
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
