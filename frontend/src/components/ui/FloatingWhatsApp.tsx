import { motion, useReducedMotion } from "motion/react";
import WhatsAppIcon from "./WhatsAppIcon";
import { STORE_WHATSAPP } from "../../constants/app";

/**
 * Atajo a WhatsApp, siempre a mano. Es por donde se cierra casi toda venta y
 * quien navega poco no va a buscar el link en el footer.
 */
export default function FloatingWhatsApp({ message = "Hola! Vengo de la página de Dropping CR 👋" }: { message?: string }) {
  const reduceMotion = useReducedMotion() ?? false;
  return (
    <motion.a
      href={`https://wa.me/${STORE_WHATSAPP}?text=${encodeURIComponent(message)}`}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Escribinos por WhatsApp"
      initial={reduceMotion ? false : { opacity: 0, scale: 0.6 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: 1.2, duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      whileTap={{ scale: 0.92 }}
      className="fixed z-30 right-4 bottom-6 md:right-6 md:bottom-8 w-14 h-14 rounded-full
                 bg-[#25D366] text-white shadow-lift flex items-center justify-center
                 hover:brightness-105 transition-[filter]"
    >
      <WhatsAppIcon size={26} />
    </motion.a>
  );
}
