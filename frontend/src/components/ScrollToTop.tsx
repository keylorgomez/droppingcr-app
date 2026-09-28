import { useLayoutEffect } from "react";
import { useLocation } from "react-router-dom";

/**
 * React Router no resetea el scroll al navegar: la posición de la página
 * anterior se arrastra a la siguiente. Saliendo de la home —que es larga— eso
 * dejaba al visitante caído en mitad del catálogo, o directo en el paginador
 * cuando la página destino era más corta y el navegador recortaba el scroll.
 *
 * Se salta cuando la navegación pide `restoreScroll`: ese es el "volver al
 * catálogo" desde un producto, donde la gracia es caer justo donde estabas.
 */
export default function ScrollToTop() {
  const { pathname, search, state } = useLocation();
  const restoring = (state as { restoreScroll?: boolean } | null)?.restoreScroll === true;

  // useLayoutEffect y no useEffect: corre antes del paint, así no se alcanza a
  // ver un frame de la página nueva dibujada a media altura.
  useLayoutEffect(() => {
    if (restoring) return;
    window.scrollTo({ top: 0, left: 0, behavior: "instant" });
  }, [pathname, search, restoring]);

  return null;
}
