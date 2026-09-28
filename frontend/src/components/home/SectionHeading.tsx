import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
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
        <h2 className="type-display text-[clamp(2rem,6vw,3.75rem)] text-ink-900">
          {title}
        </h2>
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
