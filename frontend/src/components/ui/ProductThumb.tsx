import { useState } from "react";
import { cloudinaryUrl } from "../../lib/cloudinary";
import { cn } from "../../lib/utils";
import { productInitials } from "../../lib/formatters";

type Size = "xs" | "sm" | "md" | "lg";

const INITIALS: Record<Size, string> = {
  xs: "text-[9px]",
  sm: "text-[15px]",
  md: "text-[22px]",
  lg: "text-[clamp(3rem,14vw,5rem)]",
};

/**
 * Foto de un producto, o una tarjeta de marca cuando no tiene (encargos,
 * ventas externas) o la foto no carga. Antes era una caja gris con un ícono,
 * que parecía una imagen rota o falta de internet.
 *
 * El contenedor (tamaño, bordes) lo pone quien lo usa vía `className`.
 */
export default function ProductThumb({
  src, name, size = "sm", label, variant = "thumb", className, imgClassName,
}: {
  src?: string | null;
  name: string;
  size?: Size;
  /** Texto chico debajo de las iniciales ("Encargo"). Solo en md y lg. */
  label?: string;
  variant?: "thumb" | "medium" | "full";
  className?: string;
  imgClassName?: string;
}) {
  const [failed, setFailed] = useState(false);

  if (src && !failed) {
    return (
      <div className={cn("overflow-hidden bg-ink-50", className)}>
        <img
          src={cloudinaryUrl(src, variant)}
          alt={name}
          loading="lazy"
          onError={() => setFailed(true)}
          className={cn("w-full h-full object-cover", imgClassName)}
        />
      </div>
    );
  }

  const showLabel = label && (size === "md" || size === "lg");
  return (
    <div
      role="img"
      aria-label={name}
      className={cn(
        "relative overflow-hidden bg-ink-900 text-bone flex flex-col items-center justify-center select-none",
        className,
      )}
    >
      {/* Brillo diagonal suave: que se lea como tarjeta, no como hueco */}
      <span
        aria-hidden="true"
        className="absolute inset-0 bg-[linear-gradient(135deg,rgba(255,255,255,0.10)_0%,rgba(255,255,255,0)_45%,rgba(255,255,255,0.04)_100%)]"
      />
      <span className={cn("relative type-display leading-none tracking-tight", INITIALS[size])}>
        {productInitials(name)}
      </span>
      {showLabel && (
        <span className={cn(
          "relative font-display uppercase tracking-widest2 text-bone/55 leading-none",
          size === "lg" ? "text-[10px] mt-3" : "text-[7.5px] mt-1.5",
        )}>
          {label}
        </span>
      )}
    </div>
  );
}
