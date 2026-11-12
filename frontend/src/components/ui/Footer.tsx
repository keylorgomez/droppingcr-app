import { Link } from "react-router-dom";
import { ArrowUp } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import { ROUTES, STORE_WHATSAPP } from "../../constants/app";
import { SHIPPING_RATES } from "../../config/shipping";
import ScrollMarquee from "./ScrollMarquee";
import WhatsAppIcon from "./WhatsAppIcon";

const socialLinks = [
  {
    label: "Instagram",
    href: "https://instagram.com/dropping.cr",
    icon: (
      <svg viewBox="0 0 24 24" width="17" height="17" fill="currentColor" aria-hidden="true">
        <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
      </svg>
    ),
  },
  {
    label: "WhatsApp",
    href: `https://wa.me/${STORE_WHATSAPP}`,
    icon: (
      <svg viewBox="0 0 24 24" width="17" height="17" fill="currentColor" aria-hidden="true">
        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z" />
        <path d="M12 0C5.373 0 0 5.373 0 12c0 2.125.557 4.126 1.528 5.858L.057 23.428a.75.75 0 0 0 .921.921l5.57-1.471A11.943 11.943 0 0 0 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22c-1.907 0-3.698-.511-5.238-1.4l-.374-.22-3.875 1.023 1.023-3.762-.234-.386A9.953 9.953 0 0 1 2 12C2 6.477 6.477 2 12 2s10 4.477 10 10-4.477 10-10 10z" />
      </svg>
    ),
  },
  {
    label: "TikTok",
    href: "https://tiktok.com/@dropping.cr",
    icon: (
      <svg viewBox="0 0 24 24" width="17" height="17" fill="currentColor" aria-hidden="true">
        <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.5 2.89 2.89 0 0 1-2.89-2.89 2.89 2.89 0 0 1 2.89-2.89c.28 0 .54.04.79.1V9.01a6.33 6.33 0 0 0-.79-.05 6.34 6.34 0 0 0-6.34 6.34 6.34 6.34 0 0 0 6.34 6.34 6.34 6.34 0 0 0 6.33-6.34V8.69a8.18 8.18 0 0 0 4.78 1.52V6.75a4.85 4.85 0 0 1-1.01-.06z" />
      </svg>
    ),
  },
];

const colones = (amount: number) => `₡${amount.toLocaleString("en-US")}`;

const whatsappUrl = `https://wa.me/${STORE_WHATSAPP}?text=${encodeURIComponent("Hola! Tengo una consulta.")}`;

const LINKS = [
  { label: "Catálogo",    to: ROUTES.CATALOG },
  { label: "Lo nuevo",    to: ROUTES.catalogFilter("nuevo") },
  { label: "Descuentos",  to: ROUTES.catalogFilter("descuentos") },
  { label: "Mis pedidos", to: "/my-orders" },
];

/**
 * Footer: poco texto y un cierre con presencia. Las tarifas y los métodos de
 * pago ya viven en la ficha, el carrito y "Cómo comprar"; aquí basta una línea.
 * Cierra con una cinta de texto gigante que avanza con el scroll.
 */
export default function Footer() {
  const reduceMotion = useReducedMotion() ?? false;

  return (
    <footer className="relative w-full bg-ink-950 text-bone overflow-hidden">
      <div className="max-w-[1600px] mx-auto px-5 sm:px-6 lg:px-10 pt-16 sm:pt-20">

        {/* Celular: todo centrado en una columna, con un eje claro.
            Desktop: frase y contacto a la izquierda, links a la derecha. */}
        <div className="flex flex-col items-center text-center lg:flex-row lg:items-end lg:justify-between lg:text-left gap-10">
          {/* Frase + contacto */}
          <div className="flex flex-col items-center lg:items-start gap-7 max-w-xl w-full">
            <p className="type-accent text-[clamp(2rem,5vw,3.25rem)] leading-[1.1] text-bone/90 text-balance">
              Drip is temporary, style is forever.
            </p>
            <div className="flex flex-col sm:flex-row items-center gap-4 w-full sm:w-auto">
              <motion.a
                href={whatsappUrl}
                target="_blank"
                rel="noopener noreferrer"
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                className="inline-flex items-center justify-center gap-2.5 h-[52px] w-full max-w-[320px] sm:w-auto px-7
                           rounded-full bg-bone text-ink-900 font-display uppercase text-[12px] tracking-widest2
                           hover:bg-white transition-colors"
              >
                <WhatsAppIcon size={18} />
                Escribinos por WhatsApp
              </motion.a>
              <div className="flex items-center gap-3">
                {socialLinks.filter((social) => social.label !== "WhatsApp").map(({ label, href, icon }) => (
                  <motion.a
                    key={label}
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={label}
                    whileHover={{ y: -3 }}
                    className="w-12 h-12 rounded-full border border-bone/20 flex items-center justify-center
                               text-bone/70 hover:text-bone hover:border-bone/60 transition-colors"
                  >
                    {icon}
                  </motion.a>
                ))}
              </div>
            </div>
          </div>

          {/* Links: grilla 2×2 centrada en celular, una fila en desktop */}
          <nav className="grid grid-cols-2 gap-x-8 gap-y-1 w-full max-w-[300px] sm:flex sm:w-auto sm:max-w-none sm:gap-8">
            {LINKS.map(({ label, to }) => (
              <Link
                key={label}
                to={to}
                className="font-display uppercase text-[13px] tracking-widest2 text-bone/70 hover:text-bone
                           transition-colors py-2.5 text-center sm:link-underline"
              >
                {label}
              </Link>
            ))}
          </nav>
        </div>

        <div className="flex flex-col items-center gap-5 text-center lg:flex-row lg:justify-between lg:text-left mt-12 pt-7 border-t border-bone/10">
          <p className="text-[12.5px] leading-relaxed text-bone/50 max-w-[300px] lg:max-w-none">
            Envíos a todo el país desde {colones(SHIPPING_RATES.MENSAJERO)} · SINPE Móvil · Contra entrega
          </p>
          <button
            onClick={() => window.scrollTo({ top: 0, behavior: reduceMotion ? "auto" : "smooth" })}
            className="group inline-flex items-center gap-2.5 h-10 pl-4 pr-3 rounded-full border border-bone/15
                       font-display uppercase text-[11px] tracking-widest2 text-bone/60
                       hover:text-bone hover:border-bone/40 transition-colors"
          >
            Volver arriba
            <ArrowUp size={14} className="transition-transform duration-300 group-hover:-translate-y-0.5" />
          </button>
        </div>
      </div>

      {/* Cierre: cinta de texto gigante que responde al scroll */}
      <ScrollMarquee
        words={["Piezas únicas", "Drops limitados", "Grecia CR", "Drip is temporary"]}
        className="mt-10 text-[clamp(2.25rem,8vw,5.5rem)] border-y border-bone/10 py-2"
      />

      <div className="relative max-w-[1600px] mx-auto px-5 sm:px-6 lg:px-10 pt-6 pb-7 flex flex-col sm:flex-row items-center sm:justify-between gap-1">
        <p className="text-[11.5px] text-bone/40">© {new Date().getFullYear()} Dropping CR</p>
        <p className="text-[11.5px] text-bone/40">Hecho en Grecia, Costa Rica</p>
      </div>
    </footer>
  );
}
