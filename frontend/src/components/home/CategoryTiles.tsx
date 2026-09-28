import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowUpRight } from "lucide-react";
import { cloudinaryUrl } from "../../lib/cloudinary";
import { ROUTES } from "../../constants/app";

export interface CategoryTile {
  slug: string;
  name: string;
  count: number;
  image: string;
}

interface CategoryTilesProps {
  categories: CategoryTile[];
}

export default function CategoryTiles({ categories }: CategoryTilesProps) {
  const navigate = useNavigate();
  if (categories.length === 0) return null;

  return (
    <div className="grid grid-cols-2 lg:grid-cols-3 gap-2 lg:gap-3 px-4 sm:px-6 lg:px-10 max-w-[1600px] mx-auto">
      {categories.map((cat, i) => (
        <div key={cat.slug} className="animate-rise" style={{ animationDelay: `${i * 60}ms` }}>
          <motion.button
            onClick={() => navigate(ROUTES.catalogFilter(cat.slug))}
            className="group relative w-full h-full aspect-[4/5] lg:aspect-square overflow-hidden rounded-card bg-ink-950 text-left"
            whileHover="hover"
            initial="rest"
            animate="rest"
          >
            <motion.img
              src={cloudinaryUrl(cat.image, "medium")}
              alt=""
              aria-hidden="true"
              loading="lazy"
              className="absolute inset-0 w-full h-full object-cover grayscale"
              variants={{ rest: { scale: 1, opacity: 0.55 }, hover: { scale: 1.07, opacity: 0.75 } }}
              transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
            />

            <div className="absolute inset-0 bg-gradient-to-t from-ink-950/85 to-transparent" />

            <div className="absolute inset-0 flex flex-col justify-end p-4 sm:p-6">
              <div className="flex items-end justify-between gap-4">
                <div>
                  <h3 className="type-display text-[clamp(1.1rem,4.5vw,2.25rem)] text-bone">
                    {cat.name}
                  </h3>
                  <p className="type-eyebrow text-bone/50 mt-2">
                    {cat.count} {cat.count === 1 ? "pieza" : "piezas"}
                  </p>
                </div>
                <motion.span
                  className="hidden sm:flex shrink-0 w-9 h-9 rounded-btn border border-bone/40 items-center justify-center text-bone"
                  variants={{ rest: { opacity: 0.5 }, hover: { opacity: 1, backgroundColor: "#faf9f7", color: "#0a0a0a" } }}
                  transition={{ duration: 0.3 }}
                >
                  <ArrowUpRight size={16} strokeWidth={2} />
                </motion.span>
              </div>
            </div>
          </motion.button>
        </div>
      ))}
    </div>
  );
}
