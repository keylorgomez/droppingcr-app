import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence, useInView, useReducedMotion, useScroll, useTransform } from "motion/react";
import { ArrowRight } from "lucide-react";
import { cloudinaryUrl } from "../../lib/cloudinary";
import { ROUTES } from "../../constants/app";
import type { CatalogProduct } from "../../services/productService";
import Reveal from "../ui/Reveal";
import { discountedPrice } from "../../lib/formatters";

interface FeaturedDropProps {
  product: CatalogProduct;
}

const STORY_MS = 3200;
const EASE = [0.16, 1, 0.3, 1] as const;

/**
 * Pieza destacada sobre fondo negro, el único bloque invertido del cuerpo de
 * la home. Las fotos corren solas como una historia de Instagram —con sus
 * barritas de progreso— solo mientras la sección está en pantalla. En celular
 * nombre y precio van sobre la foto, así la sección no se vuelve una torre.
 */
export default function FeaturedDrop({ product }: FeaturedDropProps) {
  const reduceMotion = useReducedMotion() ?? false;
  const sectionRef = useRef<HTMLElement>(null);
  const inView = useInView(sectionRef, { amount: 0.4 });
  const [index, setIndex] = useState(0);

  const playing = inView && !reduceMotion;
  const photos = (product.images.length ? product.images : [product.image_url]).slice(0, 5);
  const hasDiscount = product.discount_percentage > 0;
  const price = discountedPrice(product.price_sale, product.discount_percentage);
  const href = ROUTES.PRODUCT(product.slug);

  // Avanza solo si se ve: no gastar datos ni distraer cuando está fuera de pantalla.
  useEffect(() => {
    if (!inView || reduceMotion || photos.length < 2) return;
    const id = setTimeout(() => setIndex((i) => (i + 1) % photos.length), STORY_MS);
    return () => clearTimeout(id);
  }, [index, inView, reduceMotion, photos.length]);

  const { scrollYProgress } = useScroll({ target: sectionRef, offset: ["start end", "end start"] });
  const photoY = useTransform(scrollYProgress, [0, 1], reduceMotion ? ["0%", "0%"] : ["-6%", "6%"]);

  const priceBlock = (
    <div className="flex items-baseline gap-3">
      <span className="text-[26px] lg:text-3xl font-semibold tnum">₡{price.toLocaleString("en-US")}</span>
      {hasDiscount && (
        <>
          <span className="text-base text-bone/45 line-through tnum">₡{product.price_sale.toLocaleString("en-US")}</span>
          <span className="font-display uppercase text-[11px] tracking-wider rounded-chip bg-sale text-white px-2 py-1 leading-none">
            −{product.discount_percentage}%
          </span>
        </>
      )}
    </div>
  );

  return (
    <section ref={sectionRef} className="bg-ink-950 text-bone">
      <div className="grid grid-cols-1 lg:grid-cols-2 items-stretch">

        {/* ── Fotos tipo historia ─────────────────────────────────────── */}
        <Link
          to={href}
          aria-label={product.name}
          className="relative block h-[72svh] min-h-[440px] max-h-[680px] lg:h-auto lg:max-h-none lg:min-h-[72vh] overflow-hidden grain"
        >
          <motion.div className="absolute -inset-y-[7%] inset-x-0" style={{ y: photoY }}>
            <AnimatePresence mode="sync">
              <motion.img
                key={photos[index]}
                src={cloudinaryUrl(photos[index], "full")}
                alt={index === 0 ? product.name : ""}
                loading="lazy"
                className="absolute inset-0 w-full h-full object-cover"
                initial={{ opacity: 0, scale: 1.08 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
                transition={{ opacity: { duration: 0.7 }, scale: { duration: STORY_MS / 1000 + 0.8, ease: "linear" } }}
              />
            </AnimatePresence>
          </motion.div>

          {/* Barritas de progreso */}
          {photos.length > 1 && (
            <div className="absolute top-4 inset-x-4 z-10 flex gap-1.5">
              {photos.map((_, i) => (
                <span key={i} className="h-[2px] flex-1 rounded-full bg-bone/25 overflow-hidden">
                  <motion.span
                    key={i === index ? `active-${index}-${playing}` : `idle-${i}-${i < index}`}
                    className="block h-full bg-bone origin-left"
                    initial={{ scaleX: i < index ? 1 : 0 }}
                    animate={{ scaleX: i < index || (i === index && playing) ? 1 : 0 }}
                    transition={i === index && playing ? { duration: STORY_MS / 1000, ease: "linear" } : { duration: 0 }}
                  />
                </span>
              ))}
            </div>
          )}

          {/* Celular: la ficha va sobre la foto */}
          <div className="lg:hidden absolute inset-x-0 bottom-0 z-10 bg-gradient-to-t from-ink-950 via-ink-950/70 to-transparent px-5 pt-24 pb-6">
            <span className="type-eyebrow text-bone/60"><span className="mr-2 text-bone">01</span>Pieza destacada</span>
            <h2 className="type-display text-[clamp(2rem,9vw,3rem)] mt-3 text-bone">{product.name}</h2>
            <div className="mt-3">{priceBlock}</div>
          </div>
        </Link>

        {/* ── Ficha ─────────────────────────────────────────────────── */}
        <div className="flex flex-col justify-center px-5 sm:px-12 lg:px-16 py-7 lg:py-16">
          <div className="hidden lg:block">
            <Reveal>
              <span className="type-eyebrow text-bone/45"><span className="mr-2 text-bone">01</span>Pieza destacada</span>
            </Reveal>
            <Reveal delay={0.08}>
              <h2 className="type-display text-[clamp(2.25rem,5vw,4.25rem)] mt-5 text-bone">{product.name}</h2>
            </Reveal>
            {product.categories[0] && (
              <Reveal delay={0.14}>
                <p className="type-accent text-xl text-bone/55 mt-3">{product.categories[0].name}</p>
              </Reveal>
            )}
            <Reveal delay={0.2}><div className="mt-7">{priceBlock}</div></Reveal>
          </div>

          <div className="flex flex-col sm:flex-row lg:flex-col sm:items-center lg:items-start gap-5 lg:mt-8">
            {product.sizes.length > 0 && (
              <Reveal delay={0.26}>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="type-eyebrow text-bone/45 mr-1">Tallas</span>
                  {product.sizes.map((size) => (
                    <span
                      key={size}
                      className="min-w-[40px] text-center rounded-chip border border-bone/25 text-bone/85 text-[12.5px] px-2.5 py-2 leading-none"
                    >
                      {size}
                    </span>
                  ))}
                </div>
              </Reveal>
            )}

            <Reveal delay={0.32} className="sm:ml-auto lg:ml-0">
              <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }} transition={{ ease: EASE }}>
                <Link
                  to={href}
                  className="group inline-flex w-full sm:w-auto items-center justify-center gap-3 rounded-btn bg-bone text-ink-900
                             font-display uppercase text-[12px] tracking-widest2 px-9 h-[52px] hover:bg-white transition-colors"
                >
                  Ver pieza
                  <ArrowRight size={14} strokeWidth={2} className="transition-transform duration-300 group-hover:translate-x-1" />
                </Link>
              </motion.div>
            </Reveal>
          </div>
        </div>
      </div>
    </section>
  );
}
