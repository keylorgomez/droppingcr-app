import type { ReactNode } from "react";
import { motion, useReducedMotion } from "framer-motion";

interface RevealProps {
  children: ReactNode;
  /** Retraso en segundos — sirve para escalonar hijos de una misma fila. */
  delay?: number;
  /** Distancia del desplazamiento inicial en px. */
  y?: number;
  className?: string;
}

/**
 * Entrada al entrar en viewport. `once` evita que el contenido re-anime al
 * hacer scroll hacia arriba, que es lo que hace que una página se sienta
 * inquieta en vez de pulida.
 */
export default function Reveal({ children, delay = 0, y = 24, className }: RevealProps) {
  const reduceMotion = useReducedMotion() ?? false;

  return (
    <motion.div
      className={className}
      initial={reduceMotion ? false : { opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1], delay }}
    >
      {children}
    </motion.div>
  );
}
