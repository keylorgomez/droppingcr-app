import { useLayoutEffect } from "react";
import { SITE_URL } from "../constants/app";

/**
 * Metadatos por página.
 *
 * La app es un SPA: el `index.html` es el mismo para las ~180 fichas, así que
 * sin esto todas se anuncian con el mismo título y Google no tiene por qué
 * posicionar ninguna en particular. El hook reescribe el `<head>` en cada ruta.
 *
 * Limitación conocida: esto corre con JavaScript. Google lo renderiza y lo ve;
 * la mayoría de crawlers de IA no, y para ellos sigue haciendo falta servir
 * HTML ya hecho (prerender o SSR).
 */
export interface SeoInput {
  /** Sin la marca: el hook agrega "· Dropping CR". */
  title:        string;
  description:  string;
  /** Ruta absoluta del sitio, ej. "/product/camiseta". */
  path:         string;
  image?:       string;
  type?:        "website" | "product";
  noindex?:     boolean;
  /** JSON-LD ya listo para serializar. */
  jsonLd?:      object | object[];
}

const DEFAULT_IMAGE = `${SITE_URL}/og-dropping.jpg`;
const BRAND         = "Dropping CR";

/** Marca los nodos que gestiona el hook para poder retirarlos al cambiar de ruta. */
const OWNED = "data-seo";

function upsertMeta(attr: "name" | "property", key: string, content: string) {
  let el = document.head.querySelector<HTMLMetaElement>(`meta[${attr}="${key}"]`);
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute(attr, key);
    el.setAttribute(OWNED, "");
    document.head.appendChild(el);
  }
  el.setAttribute("content", content);
}

function upsertLink(rel: string, href: string) {
  let el = document.head.querySelector<HTMLLinkElement>(`link[rel="${rel}"]`);
  if (!el) {
    el = document.createElement("link");
    el.setAttribute("rel", rel);
    el.setAttribute(OWNED, "");
    document.head.appendChild(el);
  }
  el.setAttribute("href", href);
}

export function useSeo({
  title, description, path, image, type = "website", noindex = false, jsonLd,
}: SeoInput): void {
  const serializedJsonLd = jsonLd ? JSON.stringify(jsonLd) : "";

  // En layout effect para que el título ya esté puesto antes del primer pintado:
  // con useEffect, al compartir rápido se alcanza a leer el título anterior.
  useLayoutEffect(() => {
    const url      = `${SITE_URL}${path}`;
    const fullTitle = title.includes(BRAND) ? title : `${title} · ${BRAND}`;

    document.title = fullTitle;
    upsertMeta("name", "description", description);
    upsertLink("canonical", url);

    upsertMeta("property", "og:title",       fullTitle);
    upsertMeta("property", "og:description", description);
    upsertMeta("property", "og:url",         url);
    upsertMeta("property", "og:image",       image ?? DEFAULT_IMAGE);
    upsertMeta("property", "og:type",        type);
    upsertMeta("property", "og:site_name",   BRAND);

    upsertMeta("name", "twitter:card",        "summary_large_image");
    upsertMeta("name", "twitter:title",       fullTitle);
    upsertMeta("name", "twitter:description", description);
    upsertMeta("name", "twitter:image",       image ?? DEFAULT_IMAGE);

    // `noindex` tiene que desaparecer al salir de la página, no quedar pegado.
    const robots = document.head.querySelector<HTMLMetaElement>('meta[name="robots"]');
    if (noindex) upsertMeta("name", "robots", "noindex, follow");
    else if (robots?.hasAttribute(OWNED)) robots.remove();

    let script: HTMLScriptElement | null = null;
    if (serializedJsonLd) {
      script = document.createElement("script");
      script.type = "application/ld+json";
      script.setAttribute(OWNED, "");
      script.textContent = serializedJsonLd;
      document.head.appendChild(script);
    }

    return () => { script?.remove(); };
  }, [title, description, path, image, type, noindex, serializedJsonLd]);
}

// ── Fragmentos de JSON-LD ──────────────────────────────────────────────────

/** Identidad del negocio. Es lo que permite a Google (y a una IA) saber quién sos. */
export function organizationJsonLd(): object {
  return {
    "@context": "https://schema.org",
    "@type": "Store",
    name: BRAND,
    url: SITE_URL,
    logo: `${SITE_URL}/logo-tile.svg`,
    image: DEFAULT_IMAGE,
    description:
      "Tienda de streetwear, vintage y camisetas de fútbol en Grecia, Costa Rica. " +
      "Piezas únicas y ediciones limitadas con envío a todo el país.",
    address: {
      "@type": "PostalAddress",
      addressLocality: "Grecia",
      addressRegion: "Alajuela",
      addressCountry: "CR",
    },
    areaServed: { "@type": "Country", name: "Costa Rica" },
    currenciesAccepted: "CRC",
    sameAs: [
      "https://instagram.com/dropping.cr",
      "https://tiktok.com/@dropping.cr",
    ],
  };
}

interface ProductJsonLdInput {
  name:        string;
  description: string | null;
  slug:        string;
  price:       number;
  images:      string[];
  inStock:     boolean;
  category:    string | null;
}

/**
 * Ficha de producto legible por máquina: es lo que habilita que Google muestre
 * precio y disponibilidad en el resultado, y lo que deja a un modelo responder
 * "cuánto cuesta" sin tener que adivinar del texto.
 */
export function productJsonLd(p: ProductJsonLdInput): object {
  return {
    "@context": "https://schema.org",
    "@type": "Product",
    name: p.name,
    description: p.description ?? `${p.name} — disponible en Dropping CR, Costa Rica.`,
    image: p.images,
    sku: p.slug,
    ...(p.category ? { category: p.category } : {}),
    brand: { "@type": "Brand", name: BRAND },
    offers: {
      "@type": "Offer",
      url: `${SITE_URL}/product/${p.slug}`,
      priceCurrency: "CRC",
      price: p.price,
      availability: p.inStock
        ? "https://schema.org/InStock"
        : "https://schema.org/OutOfStock",
      seller: { "@type": "Organization", name: BRAND },
    },
  };
}

/** Migas de pan: le dicen a Google dónde encaja la página dentro del sitio. */
export function breadcrumbJsonLd(trail: Array<{ name: string; path: string }>): object {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: trail.map((step, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: step.name,
      item: `${SITE_URL}${step.path}`,
    })),
  };
}
