import { useEffect, useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { cloudinaryUrl } from "../../lib/cloudinary";
import { ROUTES, MAX_HERO_SLIDES } from "../../constants/app";
import Logo from "../ui/Logo";

// 4 s deja ~2.6 s de foto asentada después del crossfade de 1.4 s: se siente
// vivo sin volverse un parpadeo.
const SLIDE_MS = 4000;

interface HeroDropProps {
  /** Fotos reales del inventario — evita el look de banco de imágenes. */
  images: string[];
}

export default function HeroDrop({ images }: HeroDropProps) {
  const navigate = useNavigate();
  const reduceMotion = useReducedMotion() ?? false;
  const [index, setIndex] = useState(0);

  const slides = images.slice(0, MAX_HERO_SLIDES);

  useEffect(() => {
    if (slides.length < 2 || reduceMotion) return;
    const id = setInterval(() => setIndex((i) => (i + 1) % slides.length), SLIDE_MS);
    return () => clearInterval(id);
  }, [slides.length, reduceMotion]);

  return (
    <section className="relative w-full h-[100svh] min-h-[600px] overflow-hidden bg-ink-950 grain">

      {/* ── Fondo rotativo ──────────────────────────────────────────── */}
      <AnimatePresence mode="sync">
        {slides.length > 0 && (
          <motion.img
            key={slides[index]}
            src={cloudinaryUrl(slides[index], "full")}
            alt=""
            aria-hidden="true"
            className="absolute inset-0 w-full h-full object-cover grayscale contrast-[1.08]"
            initial={{ opacity: 0, scale: 1.06 }}
            animate={{ opacity: 0.62, scale: reduceMotion ? 1.06 : 1.14 }}
            exit={{ opacity: 0 }}
            transition={{
              opacity: { duration: 1.4, ease: "easeInOut" },
              scale:   { duration: reduceMotion ? 0 : SLIDE_MS / 1000 + 1.6, ease: "linear" },
            }}
          />
        )}
      </AnimatePresence>

      {/* Viñeta: sostiene el contraste del texto sin importar la foto */}
      <div className="absolute inset-0 bg-gradient-to-b from-ink-950/70 via-ink-950/35 to-ink-950/90" />

      {/* ── Contenido ───────────────────────────────────────────────── */}
      <div className="relative z-10 h-full flex flex-col items-center justify-center px-6 text-bone">

        <motion.div
          initial={{ opacity: 0, y: 28 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, ease: [0.16, 1, 0.3, 1], delay: 0.15 }}
          className="w-full max-w-4xl flex flex-col items-center text-center"
        >
          <Logo className="w-[78vw] max-w-[620px] h-auto" />

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.9, delay: 0.7 }}
            className="type-accent text-2xl sm:text-3xl mt-7 text-bone/85"
          >
            Drip is temporary, style is forever.
          </motion.p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1], delay: 0.95 }}
          className="flex flex-col sm:flex-row items-center gap-3 mt-10 w-full max-w-sm sm:max-w-none sm:w-auto"
        >
          <button
            onClick={() => navigate(ROUTES.CATALOG)}
            className="w-full sm:w-auto bg-bone text-ink-900 font-display uppercase text-[12px]
                       tracking-widest2 px-10 py-4 rounded-btn transition-transform duration-300 ease-drop
                       hover:scale-[1.03] hover:bg-white"
          >
            Ver catálogo
          </button>
          <button
            onClick={() => navigate(ROUTES.catalogFilter("nuevo"))}
            className="w-full sm:w-auto border border-bone/40 text-bone font-display uppercase text-[12px]
                       tracking-widest2 px-10 py-4 rounded-btn transition-colors duration-300
                       hover:bg-bone hover:text-ink-900 hover:border-bone"
          >
            Nuevo drop
          </button>
        </motion.div>
      </div>

      {/* ── Índice de slides ────────────────────────────────────────── */}
      {slides.length > 1 && (
        <div className="absolute bottom-8 left-6 z-10 flex items-center gap-2">
          {slides.map((_, i) => (
            <button
              key={i}
              onClick={() => setIndex(i)}
              aria-label={`Imagen ${i + 1}`}
              className="h-px transition-all duration-500 ease-drop"
              style={{
                width: i === index ? 32 : 14,
                background: i === index ? "#faf9f7" : "rgba(250,249,247,0.35)",
              }}
            />
          ))}
        </div>
      )}

      {/* ── Scroll hint ─────────────────────────────────────────────── */}
      <div className="absolute bottom-8 right-6 z-10 flex items-center gap-3">
        <span className="font-display uppercase text-[10px] tracking-widest2 text-bone/50">
          Scroll
        </span>
        <motion.span
          className="block w-px h-8 bg-bone/40 origin-top"
          animate={{ scaleY: [0, 1, 0] }}
          transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }}
        />
      </div>
    </section>
  );
}
