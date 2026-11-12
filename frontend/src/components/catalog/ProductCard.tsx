import { useState } from "react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "motion/react";
import { Pencil, EyeOff, ArrowUpRight } from "lucide-react";
import { cloudinaryUrl } from "../../lib/cloudinary";
import { cn } from "../../lib/utils";
import { discountedPrice } from "../../lib/formatters";

interface ProductCardProps {
  name: string;
  price_sale: number;
  image_url: string;
  images?: string[];
  is_new?: boolean;
  discount_percentage?: number;
  is_sold_out?: boolean;
  is_reserved?: boolean;
  isHidden?: boolean;
  /** Tallas con stock, en el orden en que se muestran. */
  sizes?: string[];
  /** Índice en la grilla — escalona la entrada. */
  index?: number;
  /**
   * Destino de la tarjeta. Con href la tarjeta es un link de verdad: se puede
   * abrir en otra pestaña, compartir con un toque largo y Google la rastrea.
   */
  href?: string;
  /** Efecto extra al tocar (ej. guardar la posición del catálogo). */
  onClick?: () => void;
  onEdit?: () => void;
}

const EASE = [0.16, 1, 0.3, 1] as const;

export default function ProductCard({
  name,
  price_sale,
  image_url,
  images,
  is_new = false,
  discount_percentage = 0,
  is_sold_out = false,
  is_reserved = false,
  isHidden = false,
  sizes = [],
  index = 0,
  href,
  onClick,
  onEdit,
}: ProductCardProps) {

  const allImages = images?.length ? images : [image_url];
  const secondImage = allImages[1];

  const [isHovered, setIsHovered] = useState(false);

  const hasDiscount = discount_percentage > 0;
  const finalPrice  = discountedPrice(price_sale, discount_percentage);

  const unavailable = is_sold_out || is_reserved;
  const interactive = !unavailable && !isHidden;

  // Un solo badge de estado: prioridad APARTADA > AGOTADO > NUEVO. Cada uno con
  // su propio tratamiento — apartada y agotado se veían iguales y no lo son.
  const statusBadge = is_reserved
    ? { text: "Apartada", cls: "bg-reserved text-ink-900" }
    : is_sold_out
      ? { text: "Agotado",  cls: "bg-bone/90 text-ink-900 border border-ink-900 backdrop-blur-sm" }
      : is_new
        ? { text: "Nuevo",   cls: "bg-ink-900 text-bone" }
        : null;

  const rootProps = {
    className: cn(
      "group relative flex flex-col cursor-pointer animate-rise",
      "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ink-900 rounded-card",
      isHidden && "opacity-60"
    ),
    style: { animationDelay: `${(index % 4) * 45}ms` },
    onMouseEnter: () => setIsHovered(true),
    onMouseLeave: () => setIsHovered(false),
    onClick,
  };

  const content = (
    <>
      {/* ── Imagen ──────────────────────────────────────────────────── */}
      <motion.div
        className="relative overflow-hidden rounded-card bg-ink-50 aspect-[4/5]"
        // El lift vive en el contenedor de imagen, no en toda la tarjeta:
        // así el texto no se mueve y la grilla se siente estable.
        animate={{
          y: interactive && isHovered ? -6 : 0,
          boxShadow: interactive && isHovered
            ? "0 22px 40px -22px rgba(10,10,10,0.45)"
            : "0 0px 0px 0px rgba(10,10,10,0)",
        }}
        transition={{ duration: 0.5, ease: EASE }}
      >
        <motion.img
          src={cloudinaryUrl(allImages[0], "thumb")}
          alt={name}
          loading="lazy"
          className={cn(
            "absolute inset-0 w-full h-full object-cover",
            (is_sold_out && !is_reserved) || isHidden ? "grayscale" : ""
          )}
          animate={{ scale: interactive && isHovered ? 1.07 : 1 }}
          transition={{ duration: 1.1, ease: EASE }}
        />

        {/* Segunda foto: revela el fit por detrás al pasar el cursor */}
        {secondImage && interactive && (
          <motion.img
            src={cloudinaryUrl(secondImage, "thumb")}
            alt=""
            aria-hidden="true"
            loading="lazy"
            className="absolute inset-0 w-full h-full object-cover"
            initial={false}
            animate={{ opacity: isHovered ? 1 : 0, scale: isHovered ? 1.07 : 1.12 }}
            transition={{ duration: 0.8, ease: EASE }}
          />
        )}

        {/* Velo inferior: da contraste a la etiqueta sin oscurecer la prenda */}
        <motion.div
          className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-ink-950/65 to-transparent pointer-events-none"
          initial={false}
          animate={{ opacity: interactive && isHovered ? 1 : 0 }}
          transition={{ duration: 0.45, ease: EASE }}
        />

        {/* Badge de estado */}
        {statusBadge && (
          <span
            className={cn(
              "absolute top-2.5 left-2.5 sm:top-3 sm:left-3 z-10 rounded-chip font-display uppercase text-[11px] tracking-widest2 leading-none px-2 py-1.5",
              statusBadge.cls
            )}
          >
            {statusBadge.text}
          </span>
        )}

        {/* Descuento: el único punto de color del sitio, y va sobre la foto
            porque es lo primero que barre el ojo al escanear la grilla. */}
        {hasDiscount && !unavailable && (
          <span className="absolute top-2.5 right-2.5 sm:top-3 sm:right-3 z-10 rounded-chip bg-sale text-white
                           font-display uppercase text-[12px] tracking-wider leading-none px-2 py-1.5">
            −{discount_percentage}%
          </span>
        )}

        {/* Contador de fotos */}
        {allImages.length > 1 && !unavailable && (
          <motion.span
            className="absolute bottom-3 left-3 z-10 rounded-full bg-ink-950/45 backdrop-blur-sm
                       text-bone text-[10px] tnum font-medium leading-none px-2 py-1.5"
            initial={false}
            animate={{ opacity: isHovered ? 0 : 1 }}
            transition={{ duration: 0.25 }}
          >
            {allImages.length}
          </motion.span>
        )}

        {/* Llamada al hover — sube desde el borde inferior */}
        {interactive && !onEdit && (
          <motion.span
            className="absolute inset-x-3 bottom-3 z-10 flex items-center justify-between gap-2
                       rounded-btn bg-bone/95 backdrop-blur-sm text-ink-900
                       font-display uppercase text-[10px] tracking-widest2 px-3.5 py-2.5
                       pointer-events-none"
            initial={false}
            animate={{
              opacity: isHovered ? 1 : 0,
              y: isHovered ? 0 : 14,
            }}
            transition={{ duration: 0.45, ease: EASE }}
          >
            Ver pieza
            <ArrowUpRight size={14} strokeWidth={2.2} />
          </motion.span>
        )}

        {/* Editar — solo admin */}
        {onEdit && (
          <AnimatePresence>
            {isHovered && (
              <motion.button
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 8 }}
                transition={{ duration: 0.25, ease: EASE }}
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); onEdit(); }}
                className="absolute bottom-3 right-3 z-20 w-9 h-9 rounded-btn bg-bone text-ink-900
                           flex items-center justify-center hover:bg-white transition-colors shadow-lift"
                title="Editar producto"
              >
                <Pencil size={14} strokeWidth={2} />
              </motion.button>
            )}
          </AnimatePresence>
        )}

        {/* Oculto — solo admin */}
        {isHidden && (
          <div className="absolute inset-0 z-10 flex items-center justify-center pointer-events-none">
            <span className="flex items-center gap-1.5 rounded-chip bg-ink-900/85 text-bone
                             font-display uppercase text-[9px] tracking-widest2
                             px-3 py-2 backdrop-blur-sm">
              <EyeOff size={10} strokeWidth={2.5} />
              Oculto
            </span>
          </div>
        )}
      </motion.div>

      {/* ── Ficha ───────────────────────────────────────────────────────
          El nombre reserva siempre dos líneas: sin eso, un título de una
          línea sube el precio y la fila de la grilla queda desalineada. */}
      <div className="flex flex-col pt-3">
        <h3 className={cn(
          "text-[13px] leading-[1.36] line-clamp-2 min-h-[35px]",
          unavailable ? "text-ink-400" : "text-ink-900"
        )}>
          <span
            className={cn(
              "bg-gradient-to-r from-current to-current bg-no-repeat",
              "[background-size:0%_1px] [background-position:0_100%]",
              "transition-[background-size] duration-500 ease-drop",
              interactive && "group-hover:[background-size:100%_1px]"
            )}
          >
            {name}
          </span>
        </h3>

        <div className="flex items-baseline gap-2 h-5 mt-1.5">
          <span className={cn(
            "text-[14.5px] font-semibold tnum leading-none",
            unavailable ? "text-ink-400" : hasDiscount ? "text-sale" : "text-ink-900"
          )}>
            ₡{finalPrice.toLocaleString("en-US")}
          </span>

          {hasDiscount && (
            <span className="text-[12px] text-ink-400 line-through tnum leading-none">
              ₡{price_sale.toLocaleString("en-US")}
            </span>
          )}
        </div>

        {/* Tallas con stock: ahorra entrar a cada pieza para ver si hay la tuya.
            Alto fijo para que la grilla no quede escalonada. */}
        <p className="h-4 mt-1.5 text-[11px] text-ink-400 tracking-wide truncate">
          {!unavailable && sizes.length > 0 ? `Tallas: ${sizes.join(" · ")}` : ""}
        </p>
      </div>
    </>
  );

  // La entrada es una animación CSS y no un `whileInView`: el producto es el
  // contenido, no decoración. Si el motor de animaciones se atasca o el
  // observador no dispara, con CSS la tarjeta queda visible igual.
  return href ? (
    <Link to={href} aria-label={name} {...rootProps}>{content}</Link>
  ) : (
    <article {...rootProps}>{content}</article>
  );
}
