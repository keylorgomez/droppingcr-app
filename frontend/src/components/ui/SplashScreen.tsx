import { motion } from "framer-motion";
import Logo from "./Logo";

export default function SplashScreen() {
  return (
    <motion.div
      className="fixed inset-0 z-[9999] pointer-events-none flex flex-col items-center justify-center bg-ink-950 grain"
      initial={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
    >
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
      >
        <Logo className="w-[62vw] max-w-[380px] h-auto text-bone" />
      </motion.div>

      {/* Barra de carga: lee como intención, no como espera */}
      <div className="w-[62vw] max-w-[380px] h-px bg-bone/15 mt-8 overflow-hidden">
        <motion.div
          className="h-full bg-bone"
          initial={{ x: "-100%" }}
          animate={{ x: "100%" }}
          transition={{ duration: 1.1, repeat: Infinity, ease: "easeInOut" }}
        />
      </div>
    </motion.div>
  );
}
