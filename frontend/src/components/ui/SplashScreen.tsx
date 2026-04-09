import { motion } from "framer-motion";

export default function SplashScreen() {
  return (
    <motion.div
      className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-white"
      initial={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
    >
      {/* Logo */}
      <motion.img
        src="/droppingCR.png"
        alt="Dropping CR"
        className="w-24 h-24 object-contain mb-6"
        initial={{ opacity: 0, scale: 0.85 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
      />

      {/* Spinner */}
      <motion.div
        className="w-6 h-6 rounded-full border-2 border-gray-200 border-t-brand-primary"
        animate={{ rotate: 360 }}
        transition={{ duration: 0.8, repeat: Infinity, ease: "linear" }}
      />
    </motion.div>
  );
}
