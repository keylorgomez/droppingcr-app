/**
 * Genera `public/sitemap.xml` a partir del catálogo real.
 *
 * Sin sitemap, Google solo descubre una ficha si llega a ella navegando, y en
 * un SPA eso significa ejecutar JavaScript y seguir enlaces de una grilla
 * paginada. El sitemap le entrega las ~180 URLs de una.
 *
 * Corre en `prebuild`, así que el archivo se regenera en cada despliegue y
 * refleja el catálogo del momento. Si Supabase no responde, **no se rompe el
 * build**: deja el sitemap anterior y avisa. Un despliegue caído por un sitemap
 * sería un precio absurdo.
 */
import { writeFileSync, existsSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const AQUI    = dirname(fileURLToPath(import.meta.url));
const SALIDA  = join(AQUI, "..", "public", "sitemap.xml");
const SITIO   = "https://droppingcr.com";

/** Lee las variables de Vite desde el entorno o desde `.env.local` en desarrollo. */
function leerEnv(clave) {
  if (process.env[clave]) return process.env[clave];
  const archivo = join(AQUI, "..", ".env.local");
  if (!existsSync(archivo)) return null;
  const linea = readFileSync(archivo, "utf8")
    .split("\n")
    .find((l) => l.startsWith(`${clave}=`));
  return linea ? linea.slice(clave.length + 1).trim().replace(/^["']|["']$/g, "") : null;
}

const URL_SUPABASE = leerEnv("VITE_SUPABASE_URL");
const ANON         = leerEnv("VITE_SUPABASE_ANON_KEY");

function entrada(ruta, { cambio = "weekly", prioridad = "0.5", fecha } = {}) {
  return [
    "  <url>",
    `    <loc>${SITIO}${ruta}</loc>`,
    fecha ? `    <lastmod>${fecha.slice(0, 10)}</lastmod>` : null,
    `    <changefreq>${cambio}</changefreq>`,
    `    <priority>${prioridad}</priority>`,
    "  </url>",
  ].filter(Boolean).join("\n");
}

async function consultar(recurso) {
  const respuesta = await fetch(`${URL_SUPABASE}/rest/v1/${recurso}`, {
    headers: { apikey: ANON, Authorization: `Bearer ${ANON}` },
  });
  if (!respuesta.ok) throw new Error(`${recurso}: HTTP ${respuesta.status}`);
  return respuesta.json();
}

function escapar(texto) {
  return texto.replace(/[<>&'"]/g, (c) =>
    ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '"': "&quot;" })[c]
  );
}

async function main() {
  if (!URL_SUPABASE || !ANON) {
    console.warn("[sitemap] faltan VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY — se conserva el sitemap existente");
    return;
  }

  const [productos, categorias] = await Promise.all([
    consultar("products?select=slug,created_at&is_active=eq.true&order=created_at.desc"),
    consultar("categories?select=slug&order=name"),
  ]);

  const urls = [
    entrada("/",          { cambio: "daily",  prioridad: "1.0" }),
    entrada("/catalogo",  { cambio: "daily",  prioridad: "0.9" }),
    ...categorias.map((c) =>
      entrada(`/catalogo?filter=${escapar(c.slug)}`, { cambio: "weekly", prioridad: "0.7" })
    ),
    ...productos.map((p) =>
      entrada(`/product/${escapar(p.slug)}`, {
        cambio: "weekly",
        prioridad: "0.8",
        fecha: p.created_at,
      })
    ),
  ];

  const xml = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...urls,
    "</urlset>",
    "",
  ].join("\n");

  writeFileSync(SALIDA, xml, "utf8");
  console.log(`[sitemap] ${urls.length} URLs (${productos.length} productos, ${categorias.length} categorías)`);
}

main().catch((error) => {
  console.warn(`[sitemap] no se pudo generar: ${error.message} — se conserva el anterior`);
});
