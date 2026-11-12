import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import Reveal from "../ui/Reveal";
import SectionHeading from "./SectionHeading";
import WhatsAppIcon from "../ui/WhatsAppIcon";
import { ROUTES, STORE_WHATSAPP } from "../../constants/app";
import { SHIPPING_RATES } from "../../config/shipping";

// Para quien nunca compró por Instagram o por una web: tres pasos, sin
// jerga, con lo que cuesta y cómo se paga a la vista.

const colones = (amount: number) => `₡${amount.toLocaleString("en-US")}`;

const STEPS = [
  {
    title: "Elegí tu pieza",
    text:  "Mirá el catálogo y la talla disponible en cada foto. Cada pieza es única: cuando se va, no vuelve.",
  },
  {
    title: "Pedila",
    text:  "Agregala al carrito o tocá \"Comprar por WhatsApp\". Te confirmamos disponibilidad y el envío al toque.",
  },
  {
    title: "Pagá y recibila",
    text:  `SINPE Móvil, transferencia o contra entrega. Mensajero desde ${colones(SHIPPING_RATES.MENSAJERO)} o Correos de CR a todo el país.`,
  },
] as const;

export default function HowToBuy() {
  return (
    <section className="px-4 sm:px-6 lg:px-10 pb-20 lg:pb-28 max-w-[1600px] mx-auto">
      <SectionHeading index="04" eyebrow="Cómo comprar" title="Así de fácil" />

      <ol className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {STEPS.map((step, i) => (
          <Reveal key={step.title} delay={i * 0.08}>
            <li className="h-full flex flex-col gap-3 rounded-card border border-ink-200 bg-white/50 p-6">
              <span className="font-display text-[44px] leading-none text-ink-200 tnum">0{i + 1}</span>
              <h3 className="font-display uppercase text-[15px] tracking-widest2 text-ink-900">{step.title}</h3>
              <p className="text-[14px] leading-relaxed text-ink-500">{step.text}</p>
            </li>
          </Reveal>
        ))}
      </ol>

      <Reveal className="flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-3 mt-10">
        <Link to={ROUTES.CATALOG} className="btn-ink">
          Ver catálogo
          <ArrowRight size={14} strokeWidth={2} />
        </Link>
        <a
          href={`https://wa.me/${STORE_WHATSAPP}?text=${encodeURIComponent("Hola! Tengo una consulta sobre una pieza.")}`}
          target="_blank"
          rel="noopener noreferrer"
          className="btn-outline"
        >
          <WhatsAppIcon size={16} />
          Escribinos
        </a>
      </Reveal>
    </section>
  );
}
