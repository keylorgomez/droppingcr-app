import WhatsAppIcon from "../ui/WhatsAppIcon";
import { STORE_WHATSAPP } from "../../constants/app";
import type { SizeKind } from "../../lib/sizes";

// En ropa no hay tabla genérica (cada marca corta distinto): se piden las
// medidas reales de la pieza por WhatsApp. En calzado sí sirve la
// equivalencia US/EU/cm. Es la duda #1 al comprar por internet.

// Talla EUR → largo del pie (cm), aproximado. La equivalencia US cambia según
// la marca y si la horma es de hombre o mujer, por eso no va en la tabla:
// cuando la marca la indica, ya viene en la talla ("42 EUR / 9 US").
const SHOES = [36, 37, 38, 39, 40, 41, 42, 43, 44, 45, 46].map((eu) => ({
  eu: String(eu),
  cm: Math.round(((eu - 2) * 2) / 3 * 2) / 2,
}));

const th = "py-2 pr-3 text-left font-display uppercase text-[10px] tracking-widest2 text-ink-400 font-normal";
const td = "py-2 pr-3 tnum text-ink-900";

export default function SizeGuide({ kind, productName }: { kind: SizeKind; productName: string }) {
  const askUrl = `https://wa.me/${STORE_WHATSAPP}?text=${encodeURIComponent(
    `Hola! ¿Me pasan las medidas exactas de ${productName}? (${window.location.href})`
  )}`;

  return (
    <div className="flex flex-col gap-3">
      {kind === "clothing" ? (
        <>
          <p>
            Cada marca corta distinto, así que no usamos una tabla genérica: te pasamos las
            medidas reales de esta pieza (pecho de axila a axila y largo, en cm).
          </p>
          <p>Tip: medí en plano una prenda tuya que te quede bien y comparamos.</p>
        </>
      ) : (
        <>
          <p>Medí tu pie de talón a la punta del dedo más largo, de pie y con medias, y buscá tu talla.</p>
          <table className="w-full max-w-[320px]">
            <thead><tr><th className={th}>EUR</th><th className={th}>Pie (cm)</th></tr></thead>
            <tbody>
              {SHOES.map((r) => (
                <tr key={r.eu} className="border-t border-ink-100">
                  <td className={td}>{r.eu}</td><td className={td}>{r.cm}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
      {kind === "shoes" && <p className="text-ink-400">Medidas aproximadas: cada marca horma distinto. Si estás entre dos tallas, escribinos.</p>}
      <a
        href={askUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-2 self-start font-display uppercase text-[11px] tracking-widest2 text-ink-900 underline underline-offset-4"
      >
        <WhatsAppIcon size={14} />
        Pedir medidas exactas
      </a>
    </div>
  );
}
