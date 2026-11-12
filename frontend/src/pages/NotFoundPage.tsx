import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import Header from "../components/ui/Header";
import { ROUTES } from "../constants/app";
import { useSeo } from "../lib/seo";

/**
 * Antes cualquier URL inexistente redirigía al inicio. Para un buscador eso es
 * peor que un 404: la URL responde 200 con contenido válido, así que la indexa
 * como una página más y multiplica duplicados del inicio.
 *
 * El hosting sirve `index.html` para todo, así que el código HTTP no se puede
 * cambiar desde acá; `noindex` es lo que sí está en nuestras manos.
 */
export default function NotFoundPage() {
  useSeo({
    title: "Página no encontrada",
    description: "La página que buscás no existe o se movió.",
    path: "/404",
    noindex: true,
  });

  return (
    <>
      <Header />
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-5 px-6 text-center">
        <span className="type-eyebrow text-ink-400">Error 404</span>
        <h1 className="type-display text-[clamp(2rem,6vw,3.5rem)] text-ink-900">
          Esta página no existe
        </h1>
        <p className="type-accent text-xl text-ink-400 max-w-sm">
          El link está roto o la pieza ya no está disponible.
        </p>
        <Link to={ROUTES.CATALOG} className="btn-ink mt-3 group">
          Ver el catálogo
          <ArrowRight size={14} strokeWidth={2} className="transition-transform duration-300 ease-drop group-hover:translate-x-1" />
        </Link>
      </div>
    </>
  );
}
