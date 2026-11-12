import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion, AnimatePresence, useReducedMotion, useScroll, useTransform } from "motion/react";
import { cloudinaryUrl } from "../../lib/cloudinary";
import { discountedPrice } from "../../lib/formatters";
import { ROUTES, MAX_HERO_SLIDES } from "../../constants/app";
import type { CatalogProduct } from "../../services/productService";
import Logo from "../ui/Logo";

// 4 s deja ~2.6 s de foto asentada después del crossfade de 1.4 s: se siente
// vivo sin volverse un parpadeo.
const SLIDE_MS = 4000;
const EASE = [0.16, 1, 0.3, 1] as const;
const TAGLINE = "Drip is temporary, style is forever.";

interface HeroDropProps {
  /** Fotos reales del inventario — evita el look de banco de imágenes. */
  images: string[];
  /** Lo último que entró, para que haya producto desde el primer pantallazo. */
  latest: CatalogProduct[];
  /** Cuántas piezas están marcadas como nuevas. */
  newCount: number;
}

export default function HeroDrop({ images, latest, newCount }: HeroDropProps) {
  const navigate = useNavigate();
  const reduceMotion = useReducedMotion() ?? false;
  const [index, setIndex] = useState(0);

  const slides = images.slice(0, MAX_HERO_SLIDES);

  useEffect(() => {
    if (slides.length < 2 || reduceMotion) return;
    const id = setInterval(() => setIndex((i) => (i + 1) % slides.length), SLIDE_MS);
    return () => clearInterval(id);
  }, [slides.length, reduceMotion]);

  // Parallax de salida: el contenido sube más lento que la página y se
  // desvanece; la foto se queda atrás. Profundidad sin agregar elementos.
  const sectionRef = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({ target: sectionRef, offset: ["start start", "end start"] });
  const contentY       = useTransform(scrollYProgress, [0, 1], [0, reduceMotion ? 0 : 110]);
  const contentOpacity = useTransform(scrollYProgress, [0, 0.6], [1, 0]);
  const photoY         = useTransform(scrollYProgress, [0, 1], ["0%", reduceMotion ? "0%" : "18%"]);

  return (
    // No ocupa la pantalla entera: dejar asomar la siguiente sección invita a
    // bajar, y en celulares chicos el hero completo se sentía un muro.
    <section
      ref={sectionRef}
      className="relative w-full h-[88svh] sm:h-[90vh] min-h-[600px] max-h-[960px] overflow-hidden bg-ink-950 grain"
    >
      {/* ── Fondo rotativo ──────────────────────────────────────────── */}
      <motion.div className="absolute inset-0" style={{ y: photoY }}>
        <AnimatePresence mode="sync">
          {slides.length > 0 && (
            <motion.img
              key={slides[index]}
              src={cloudinaryUrl(slides[index], "full")}
              alt=""
              aria-hidden="true"
              className="absolute inset-0 w-full h-full object-cover grayscale contrast-[1.08]"
              initial={{ opacity: 0, scale: 1.06 }}
              animate={{ opacity: 0.55, scale: reduceMotion ? 1.06 : 1.14 }}
              exit={{ opacity: 0 }}
              transition={{
                opacity: { duration: 1.4, ease: "easeInOut" },
                scale:   { duration: reduceMotion ? 0 : SLIDE_MS / 1000 + 1.6, ease: "linear" },
              }}
            />
          )}
        </AnimatePresence>
      </motion.div>

      {/* Viñeta: sostiene el contraste del texto sin importar la foto */}
      <div className="absolute inset-0 bg-gradient-to-b from-ink-950/75 via-ink-950/30 to-ink-950" />

      {/* ── Contenido ───────────────────────────────────────────────── */}
      <motion.div
        className="relative z-10 h-full flex flex-col text-bone"
        style={{ y: contentY, opacity: contentOpacity }}
      >
        <div className="flex-1 flex flex-col items-center justify-center px-6 pt-16">
          {/* Drop en vivo: lo nuevo es la razón para volver */}
          {newCount > 0 && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, ease: EASE, delay: 0.2 }}
            >
              <Link
                to={ROUTES.catalogFilter("nuevo")}
                className="inline-flex items-center gap-2.5 rounded-full border border-bone/25 bg-ink-950/30
                           backdrop-blur-md pl-3 pr-4 py-2 font-display uppercase text-[11px] tracking-widest2
                           text-bone/85 hover:border-bone/60 transition-colors"
              >
                <span className="relative flex w-2 h-2">
                  <span className="absolute inset-0 rounded-full bg-bone animate-ping opacity-60" />
                  <span className="relative w-2 h-2 rounded-full bg-bone" />
                </span>
                Nuevo drop · {newCount} {newCount === 1 ? "pieza" : "piezas"}
              </Link>
            </motion.div>
          )}

          {/* El logo se "enfoca": entra desenfocado y algo más grande */}
          <motion.div
            className="mt-7"
            initial={{ opacity: 0, scale: 1.06, filter: "blur(14px)" }}
            animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
            transition={{ duration: 1.2, ease: EASE, delay: 0.1 }}
          >
            <Logo className="w-[72vw] max-w-[540px] h-auto" />
          </motion.div>

          {/* La frase sube palabra por palabra, cada una desde detrás de una máscara */}
          {/* Instrument Serif viene en un solo peso: un trazo fino del mismo
              color lo engruesa sin el "negrita falsa" deformada del navegador,
              y la sombra lo despega de la foto. */}
          <p className="type-accent text-[23px] sm:text-[30px] mt-5 text-bone flex flex-wrap justify-center gap-x-[0.28em]
                        [-webkit-text-stroke:0.6px_currentColor] [text-shadow:0_2px_18px_rgba(0,0,0,0.55)]">
            {TAGLINE.split(" ").map((word, i) => (
              <span key={i} className="inline-block overflow-hidden pb-[0.12em]">
                <motion.span
                  className="inline-block"
                  initial={{ y: "110%" }}
                  animate={{ y: 0 }}
                  transition={{ duration: 0.8, ease: EASE, delay: 0.55 + i * 0.07 }}
                >
                  {word}
                </motion.span>
              </span>
            ))}
          </p>

          {/* Lado a lado también en celular: apilados empujaban todo hacia abajo */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: EASE, delay: 1 }}
            className="grid grid-cols-2 gap-2.5 sm:gap-3 mt-8 w-full max-w-[380px]"
          >
            <motion.button
              onClick={() => navigate(ROUTES.CATALOG)}
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              className="h-[50px] bg-bone text-ink-900 font-display uppercase text-[12px] tracking-widest2
                         rounded-btn hover:bg-white transition-colors"
            >
              Ver catálogo
            </motion.button>
            <motion.button
              onClick={() => navigate(ROUTES.catalogFilter("descuentos"))}
              whileTap={{ scale: 0.97 }}
              className="h-[50px] border border-bone/40 text-bone font-display uppercase text-[12px]
                         tracking-widest2 rounded-btn transition-colors duration-300
                         hover:bg-bone hover:text-ink-900 hover:border-bone backdrop-blur-sm"
            >
              Descuentos
            </motion.button>
          </motion.div>
        </div>

        {/* ── Recién llegado: producto real desde el primer pantallazo ───── */}
        {latest.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.9, ease: EASE, delay: 1.2 }}
            className="pb-5 sm:pb-7"
          >
            <div className="flex items-center justify-between px-4 sm:px-6 lg:px-10 max-w-[1600px] mx-auto mb-3">
              <span className="type-eyebrow text-bone/55">Recién llegado</span>
              <Link to={ROUTES.CATALOG} className="type-eyebrow text-bone/55 hover:text-bone transition-colors">
                Ver todo →
              </Link>
            </div>
            <div className="flex gap-2.5 overflow-x-auto no-scrollbar snap-x snap-mandatory px-4 sm:px-6 lg:px-10 scroll-px-4">
              {latest.map((product, i) => {
                const price = discountedPrice(product.price_sale, product.discount_percentage);
                return (
                  <motion.div
                    key={product.id}
                    initial={{ opacity: 0, x: 24 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.6, ease: EASE, delay: 1.3 + i * 0.06 }}
                    className="snap-start shrink-0"
                  >
                    <Link
                      to={ROUTES.PRODUCT(product.slug)}
                      className="group flex items-center gap-3 w-[220px] sm:w-[250px] rounded-card
                                 bg-bone/[0.07] hover:bg-bone/[0.14] border border-bone/10 backdrop-blur-md
                                 p-2 pr-3 transition-colors"
                    >
                      <span className="relative w-14 h-[70px] shrink-0 overflow-hidden rounded-[8px] bg-ink-800">
                        <img
                          src={cloudinaryUrl(product.image_url, "thumb")}
                          alt=""
                          loading="lazy"
                          className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 ease-drop group-hover:scale-110"
                        />
                      </span>
                      <span className="flex flex-col min-w-0 gap-1">
                        <span className="text-[13px] leading-snug text-bone line-clamp-2">{product.name}</span>
                        <span className="text-[13px] font-semibold tnum text-bone/80">
                          ₡{price.toLocaleString("en-US")}
                          {product.discount_percentage > 0 && (
                            <span className="ml-1.5 text-[11px] font-display tracking-wider text-bone/50">
                              −{product.discount_percentage}%
                            </span>
                          )}
                        </span>
                      </span>
                    </Link>
                  </motion.div>
                );
              })}
            </div>
          </motion.div>
        )}
      </motion.div>
    </section>
  );
}
