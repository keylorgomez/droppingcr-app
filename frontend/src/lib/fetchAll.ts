// PostgREST devuelve como máximo 1000 filas por consulta (ajuste por defecto de
// Supabase). Sin paginar, al pasar ese número las listas y los totales se
// cortan sin ningún error. Esto pide de a 1000 hasta traer todo.

const PAGE_SIZE = 1000;

interface PageResult<T> {
  data:  T[] | null;
  error: { message: string } | null;
}

interface Rangeable<T> {
  range(from: number, to: number): PromiseLike<PageResult<T>>;
}

/**
 * `build` debe crear la consulta desde cero en cada llamada (con su `.order`,
 * para que las páginas no se crucen).
 */
export async function fetchAll<T>(build: () => Rangeable<T>): Promise<PageResult<T>> {
  const rows: T[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await build().range(from, from + PAGE_SIZE - 1);
    if (error) return { data: null, error };
    rows.push(...(data ?? []));
    if (!data || data.length < PAGE_SIZE) return { data: rows, error: null };
  }
}
