import { useRef } from "react";
import {
  motion, useAnimationFrame, useMotionValue, useReducedMotion,
  useScroll, useSpring, useTransform, useVelocity, wrap,
} from "motion/react";

interface ScrollMarqueeProps {
  words: string[];
  /** Porcentaje del ancho que avanza por segundo sin scroll. */
  baseSpeed?: number;
  className?: string;
}

/**
 * Cinta de texto gigante que avanza sola y se acelera (o se invierte) con la
 * velocidad del scroll. Alterna palabras rellenas y en contorno para que la
 * fila tenga ritmo sin agregar color.
 */
export default function ScrollMarquee({ words, baseSpeed = 2.2, className }: ScrollMarqueeProps) {
  const reduceMotion = useReducedMotion() ?? false;
  const baseX = useMotionValue(0);
  const { scrollY } = useScroll();
  const scrollVelocity = useVelocity(scrollY);
  const smoothVelocity = useSpring(scrollVelocity, { damping: 50, stiffness: 400 });
  const velocityFactor = useTransform(smoothVelocity, [-1000, 0, 1000], [-4, 0, 4], { clamp: false });
  const direction = useRef(1);

  // Dos copias idénticas: al recorrer la mitad se vuelve al inicio sin salto.
  const x = useTransform(baseX, (value) => `${wrap(-50, 0, value)}%`);

  useAnimationFrame((_, delta) => {
    if (reduceMotion) return;
    let move = direction.current * baseSpeed * (delta / 1000);
    const factor = velocityFactor.get();
    if (factor < 0) direction.current = -1;
    else if (factor > 0) direction.current = 1;
    move += direction.current * move * Math.abs(factor);
    baseX.set(baseX.get() - move);
  });

  const row = (
    <span className="flex shrink-0 items-center">
      {words.map((word, i) => (
        <span key={i} className="flex items-center">
          <span
            className={i % 2 === 0
              ? "text-bone"
              : "text-transparent [-webkit-text-stroke:1.5px_rgba(250,249,247,0.55)]"}
          >
            {word}
          </span>
          <span className="inline-block w-[0.6em]" />
        </span>
      ))}
    </span>
  );

  return (
    <div className={`overflow-hidden whitespace-nowrap select-none ${className ?? ""}`} aria-hidden="true">
      <motion.div className="flex w-max font-display uppercase leading-[1.12]" style={{ x }}>
        {row}
        {row}
      </motion.div>
    </div>
  );
}
