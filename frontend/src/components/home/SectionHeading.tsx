import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { motion } from "motion/react";
import Reveal from "../ui/Reveal";

interface SectionHeadingProps {
  /** Numeral editorial: "01", "02"… */
  index?: string;
  eyebrow: string;
  title: ReactNode;
  link?: { label: string; to: string };
}

export default function SectionHeading({ index, eyebrow, title, link }: SectionHeadingProps) {
  return (
    <Reveal className="flex items-end justify-between gap-6 border-b border-ink-200 pb-5 mb-10">
      <div className="flex flex-col gap-3">
        <span className="type-eyebrow text-ink-400">
          {index && <span className="mr-2 text-ink-900">{index}</span>}
          {eyebrow}
        </span>
        {/* El título sube desde detrás de una máscara, igual que la frase del hero.
            Lo que se observa es el h2 (siempre visible), no el texto: el texto
            arranca escondido por la máscara y el navegador nunca lo daba por
            "visible", así que la animación no corría y quedaba un hueco. */}
        <motion.h2
          className="type-display text-[clamp(2rem,6vw,3.75rem)] text-ink-900 overflow-hidden pb-[0.06em]"
          initial="hidden"
          whileInView="shown"
          viewport={{ once: true, amount: 0.1 }}
        >
          <motion.span
            className="block"
            variants={{ hidden: { y: "105%" }, shown: { y: 0 } }}
            transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
          >
            {title}
          </motion.span>
        </motion.h2>
      </div>

      {link && (
        <Link
          to={link.to}
          className="link-underline shrink-0 hidden sm:flex items-center gap-2 pb-2
                     font-display uppercase text-[11px] tracking-widest2 text-ink-900"
        >
          {link.label}
          <ArrowRight size={13} strokeWidth={2} />
        </Link>
      )}
    </Reveal>
  );
}
