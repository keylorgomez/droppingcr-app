import { useState } from "react";

/**
 * Muestra una lista larga de a pocos ("Mostrar más"). Los datos siguen
 * completos —los totales y filtros de cada pantalla los necesitan—, lo que se
 * limita es cuántas filas se dibujan: con cientos de movimientos, pintar todas
 * de una vez trababa el celular.
 *
 * `resetKey` vuelve a la primera página cuando cambia (filtro, búsqueda, tab).
 */
export function usePaged<T>(items: T[], resetKey: unknown, pageSize = 20) {
  const [state, setState] = useState({ key: resetKey, limit: pageSize });
  const limit = Object.is(state.key, resetKey) ? state.limit : pageSize;

  return {
    visible:   items.slice(0, limit),
    remaining: Math.max(0, items.length - limit),
    pageSize,
    showMore:  () => setState({ key: resetKey, limit: limit + pageSize }),
  };
}
