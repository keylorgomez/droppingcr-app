import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { cloudinaryUrl } from "../../lib/cloudinary";
import { ROUTES } from "../../constants/app";
import type { CatalogProduct } from "../../services/productService";
import Reveal from "../ui/Reveal";

interface FeaturedDropProps {
  product: CatalogProduct;
}

/**
 * Pieza destacada a pantalla partida sobre fondo negro — es el único bloque
 * invertido del cuerpo de la home, y por eso marca jerarquía sin decoración.
 */
export default function FeaturedDrop({ product }: FeaturedDropProps) {
  const navigate = useNavigate();
  const [hovered, setHovered] = useState(false);

  const hasDiscount = product.discount_percentage > 0;
  const price = hasDiscount
    ? Math.round(product.price_sale * (1 - product.discount_percentage / 100))
    : product.price_sale;

  const goToProduct = () => navigate(ROUTES.PRODUCT(product.slug));

  return (
    <section className="bg-ink-950 text-bone">
      <div className="grid grid-cols-1 lg:grid-cols-2 items-stretch">

        {/* ── Imagen ──────────────────────────────────────────────── */}
        <div
          className="relative aspect-[4/5] lg:aspect-auto lg:min-h-[76vh] overflow-hidden cursor-pointer grain"
          onMouseEnter={() => setHovered(true)}
          onMouseLeave={() => setHovered(false)}
          onClick={goToProduct}
        >
          <motion.img
            src={cloudinaryUrl(product.image_url, "full")}
            alt={product.name}
            className="absolute inset-0 w-full h-full object-cover"
            initial={{ scale: 1.02 }}
            animate={{ scale: hovered ? 1.06 : 1.02 }}
            transition={{ duration: 1.1, ease: [0.16, 1, 0.3, 1] }}
          />
          {product.images[1] && (
            <motion.img
              src={cloudinaryUrl(product.images[1], "full")}
              alt=""
              aria-hidden="true"
              className="absolute inset-0 w-full h-full object-cover"
              initial={false}
              animate={{ opacity: hovered ? 1 : 0, scale: hovered ? 1.06 : 1.1 }}
              transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
            />
          )}
        </div>

        {/* ── Ficha ───────────────────────────────────────────────── */}
        <div className="flex flex-col justify-center px-6 sm:px-12 lg:px-16 py-14 lg:py-20">
          <Reveal>
            <span className="type-eyebrow text-bone/45">
              <span className="mr-2 text-bone">01</span>
              Pieza destacada
            </span>
          </Reveal>

          <Reveal delay={0.08}>
            <h2 className="type-display text-[clamp(2.25rem,5.5vw,4.5rem)] mt-5 text-bone">
              {product.name}
            </h2>
          </Reveal>

          {product.categories[0] && (
            <Reveal delay={0.14}>
              <p className="type-accent text-xl text-bone/55 mt-4">
                {product.categories[0].name}
              </p>
            </Reveal>
          )}

          <Reveal delay={0.2}>
            <div className="flex items-baseline gap-3 mt-8">
              <span className="text-3xl font-semibold tnum">
                ₡{price.toLocaleString("en-US")}
              </span>
              {hasDiscount && (
                <>
                  <span className="text-base text-bone/40 line-through tnum">
                    ₡{product.price_sale.toLocaleString("en-US")}
                  </span>
                  <span className="font-display uppercase text-[10px] tracking-widest2
                                   rounded-chip bg-sale text-white px-2 py-1 leading-none">
                    −{product.discount_percentage}%
                  </span>
                </>
              )}
            </div>
          </Reveal>

          {product.sizes.length > 0 && (
            <Reveal delay={0.26}>
              <div className="flex flex-wrap items-center gap-2 mt-8">
                <span className="type-eyebrow text-bone/45 mr-2">Tallas</span>
                {product.sizes.map((size) => (
                  <span
                    key={size}
                    className="min-w-[38px] text-center rounded-chip border border-bone/25 text-bone/80
                               text-[12px] px-2.5 py-1.5 leading-none"
                  >
                    {size}
                  </span>
                ))}
              </div>
            </Reveal>
          )}

          <Reveal delay={0.32}>
            <button
              onClick={goToProduct}
              className="group mt-11 inline-flex items-center gap-3 self-start
                         rounded-btn bg-bone text-ink-900 font-display uppercase text-[12px] tracking-widest2
                         px-9 py-4 transition-colors duration-300 hover:bg-white"
            >
              Ver pieza
              <ArrowRight
                size={14}
                strokeWidth={2}
                className="transition-transform duration-300 ease-drop group-hover:translate-x-1"
              />
            </button>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
