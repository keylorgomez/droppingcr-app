import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Pencil } from "lucide-react";

interface ProductCardProps {
  name: string;
  price_sale: number;
  image_url: string;
  images?: string[];
  category: string;
  is_new?: boolean;
  discount_percentage?: number;
  is_sold_out?: boolean;
  onClick?: () => void;
  onEdit?: () => void;
}

export default function ProductCard({
  name,
  price_sale,
  image_url,
  images,
  category: _category,
  is_new = false,
  discount_percentage = 0,
  is_sold_out = false,
  onClick,
  onEdit,
}: ProductCardProps) {
  const allImages = images?.length ? images : [image_url];
  const hasMultipleImages = allImages.length > 1;

  const [imgIndex, setImgIndex] = useState(0);
  const [isHovered, setIsHovered] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (isHovered && hasMultipleImages && !is_sold_out) {
      intervalRef.current = setInterval(() => {
        setImgIndex((i) => (i + 1) % allImages.length);
      }, 1800);
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (!isHovered) setImgIndex(0);
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [isHovered, hasMultipleImages, allImages.length, is_sold_out]);

  const hasDiscount = discount_percentage > 0;
  const discountedPrice = hasDiscount
    ? Math.round(price_sale * (1 - discount_percentage / 100))
    : price_sale;

  // Left badge: AGOTADO takes priority over NUEVO
  const leftBadge = is_sold_out
    ? { text: "AGOTADO", cls: "bg-gray-600 text-white" }
    : is_new
      ? { text: "NUEVO", cls: "bg-emerald-500 text-white" }
      : null;

  // Right badge: discount, hidden when sold out
  const rightBadge = !is_sold_out && hasDiscount
    ? { text: `${discount_percentage}% OFF`, cls: "bg-red-500 text-white" }
    : null;

  return (
    <motion.div
      className={`flex flex-col bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden font-poppins ${
        is_sold_out ? "opacity-50 cursor-not-allowed" : "cursor-pointer"
      }`}
      whileHover={is_sold_out ? {} : { y: -4, boxShadow: "0 8px 24px rgba(0,0,0,0.10)" }}
      transition={{ type: "spring", stiffness: 320, damping: 24 }}
      onHoverStart={() => setIsHovered(true)}
      onHoverEnd={() => setIsHovered(false)}
      onClick={is_sold_out ? undefined : onClick}
    >
      {/* Image */}
      <div className="relative overflow-hidden aspect-square bg-gray-50">
        <AnimatePresence>
          <motion.img
            key={allImages[imgIndex]}
            src={allImages[imgIndex]}
            alt={name}
            className="w-full h-full object-cover absolute inset-0"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.6, ease: "easeInOut" }}
          />
        </AnimatePresence>

        {/* Image dots indicator */}
        {hasMultipleImages && !is_sold_out && (
          <div className="absolute bottom-2 left-0 right-0 flex justify-center gap-1">
            {allImages.map((_, i) => (
              <span
                key={i}
                className={`block rounded-full transition-all duration-300 ${
                  i === imgIndex ? "w-3 h-1.5 bg-white" : "w-1.5 h-1.5 bg-white/50"
                }`}
              />
            ))}
          </div>
        )}

        {/* Left badge: AGOTADO or NUEVO */}
        {leftBadge && (
          <span className={`absolute top-3 left-3 text-[10px] font-bold tracking-widest uppercase px-2.5 py-1 rounded-full ${leftBadge.cls}`}>
            {leftBadge.text}
          </span>
        )}

        {/* Right badge: discount */}
        {rightBadge && (
          <span className={`absolute top-3 right-3 text-[10px] font-bold tracking-widest uppercase px-2.5 py-1 rounded-full ${rightBadge.cls}`}>
            {rightBadge.text}
          </span>
        )}

        {/* Admin edit button — visible on hover */}
        {onEdit && (
          <AnimatePresence>
            {isHovered && (
              <motion.button
                initial={{ opacity: 0, scale: 0.85 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.85 }}
                transition={{ duration: 0.15 }}
                onClick={(e) => { e.stopPropagation(); onEdit(); }}
                className="absolute bottom-3 right-3 w-8 h-8 rounded-full bg-white/90
                           shadow-md flex items-center justify-center
                           text-brand-primary hover:bg-brand-primary hover:text-white
                           transition-colors"
                title="Editar producto"
              >
                <Pencil size={13} strokeWidth={2} />
              </motion.button>
            )}
          </AnimatePresence>
        )}
      </div>

      {/* Body */}
      <div className="flex flex-col gap-1 p-3">
        <h3 className="text-[11px] font-semibold italic text-brand-primary leading-snug line-clamp-2 min-h-[2.2rem]">
          {name}
        </h3>

        <div className="mt-1.5">
          {hasDiscount && (
            <p className="text-[11px] text-gray-400 line-through leading-none mb-0.5">
              ₡{price_sale.toLocaleString("en-US")}
            </p>
          )}
          <p className={`font-bold leading-none ${hasDiscount ? "text-red-500 text-lg" : "text-base text-brand-dark"}`}>
            ₡{discountedPrice.toLocaleString("en-US")}
          </p>
        </div>
      </div>
    </motion.div>
  );
}
