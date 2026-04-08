import { motion } from "framer-motion";

const BG_DESKTOP = "https://images.unsplash.com/photo-1523398002811-999ca8dec234?w=1920&q=80";
const BG_MOBILE  = "https://images.unsplash.com/photo-1523398002811-999ca8dec234?w=800&q=80";

export default function Hero() {
  return (
    <section className="relative w-full h-[90vh] min-h-[560px] flex items-center justify-center overflow-hidden">

      {/* Background image */}
      <picture>
        <source media="(max-width: 639px)" srcSet={BG_MOBILE} />
        <img
          src={BG_DESKTOP}
          alt=""
          className="absolute inset-0 w-full h-full object-cover object-center"
          aria-hidden="true"
        />
      </picture>

      {/* Overlay */}
      <div className="absolute inset-0 bg-black/60" />

      {/* Content */}
      <motion.div
        className="relative z-10 flex flex-col items-center text-center px-6 max-w-2xl mx-auto gap-5"
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, ease: "easeOut" }}
      >
        {/* Label */}
        <span className="text-[11px] font-poppins font-medium tracking-[0.3em] uppercase text-white/60">
          DROP 008 · GRECIA | CR
        </span>

        {/* Slogan */}
        <h1 className="font-poppins font-semibold italic text-[#ffefd1] leading-tight
                        text-4xl sm:text-5xl md:text-6xl">
          Limited drops<br />Global drip
        </h1>

        {/* Subtext */}
        <p className="font-poppins font-light text-sm sm:text-base text-white/70 max-w-sm leading-relaxed">
          Piezas únicas | Ediciones limitadas | Streetwear
        </p>

        {/* CTA */}
        <motion.a
          href="#catalogo"
          className="mt-2 inline-flex items-center gap-2 px-7 py-3 rounded-full
                     bg-[#ffefd1] text-brand-primary font-poppins font-medium text-sm
                     border border-transparent"
          whileHover={{
            backgroundColor: "#ffffff",
            scale: 1.04,
            boxShadow: "0 8px 30px rgba(255,239,209,0.25)",
          }}
          whileTap={{ scale: 0.97 }}
          transition={{ duration: 0.2 }}
        >
          Catálogo
        </motion.a>
      </motion.div>

      {/* Scroll hint */}
      <motion.div
        className="absolute bottom-8 left-0 right-0 flex justify-center"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.2, duration: 0.6 }}
      >
        <motion.div
          className="w-px h-10 bg-white/30 rounded-full origin-top"
          animate={{ scaleY: [0, 1, 0] }}
          transition={{ repeat: Infinity, duration: 1.8, ease: "easeInOut" }}
        />
      </motion.div>

    </section>
  );
}
