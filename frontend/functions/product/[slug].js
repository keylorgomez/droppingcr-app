// Cloudflare Pages Function: vista previa de cada producto al compartir.
//
// WhatsApp, Instagram y Facebook NO ejecutan JavaScript: leen el HTML tal cual
// y por eso todo link de producto mostraba la foto y el texto genéricos. Esta
// función intercepta /product/:slug, busca el producto y reescribe las
// etiquetas og:* del index.html antes de entregarlo. Para el navegador no
// cambia nada: la app de React arranca igual.
//
// Necesita las variables de entorno SUPABASE_URL y SUPABASE_ANON_KEY en el
// proyecto de Cloudflare Pages (las mismas que VITE_SUPABASE_*). Sin ellas, o
// si algo falla, devuelve la página normal.

const SITE = "https://droppingcr.com";

function cloudinary(url, params) {
  return url && url.includes("res.cloudinary.com") ? url.replace("/upload/", `/upload/${params}/`) : url;
}

async function findProduct(env, slug) {
  const url = `${env.SUPABASE_URL}/rest/v1/products?slug=eq.${encodeURIComponent(slug)}&is_active=eq.true` +
    "&select=name,description,price_sale,discount_percentage,product_images(image_url,is_primary,display_order)";
  const res = await fetch(url, {
    headers: { apikey: env.SUPABASE_ANON_KEY, Authorization: `Bearer ${env.SUPABASE_ANON_KEY}` },
    cf: { cacheTtl: 300, cacheEverything: true },
  });
  if (!res.ok) return null;
  const rows = await res.json();
  return rows[0] ?? null;
}

export async function onRequest(context) {
  const { request, env, params, next } = context;
  const page = await next();

  if (!env.SUPABASE_URL || !env.SUPABASE_ANON_KEY) return page;

  try {
    const product = await findProduct(env, params.slug);
    if (!product) return page;

    const price = Math.round(product.price_sale * (1 - (product.discount_percentage || 0) / 100));
    const title = `${product.name} · ₡${price.toLocaleString("en-US")} | Dropping CR`;
    const description = (product.description || "").trim() ||
      `${product.name} por ₡${price.toLocaleString("en-US")}. Pieza única con envío a todo Costa Rica.`;
    const images = [...(product.product_images || [])].sort((a, b) =>
      a.is_primary !== b.is_primary ? (a.is_primary ? -1 : 1) : a.display_order - b.display_order);
    // 1200×630 recortado: el formato que WhatsApp y Facebook muestran grande.
    const image = images[0] ? cloudinary(images[0].image_url, "f_jpg,q_auto,w_1200,h_630,c_fill,g_auto") : null;
    const url = `${SITE}${new URL(request.url).pathname}`;

    const meta = {
      "og:title": title, "og:description": description, "og:url": url, "og:type": "product",
      "twitter:title": title, "twitter:description": description,
      ...(image ? { "og:image": image, "twitter:image": image } : {}),
    };

    return new HTMLRewriter()
      .on("title", { element: (el) => { el.setInnerContent(title); } })
      .on('meta[name="description"]', { element: (el) => { el.setAttribute("content", description); } })
      .on('link[rel="canonical"]', { element: (el) => { el.setAttribute("href", url); } })
      .on("meta[property], meta[name]", {
        element: (el) => {
          const key = el.getAttribute("property") || el.getAttribute("name");
          if (key in meta) el.setAttribute("content", meta[key]);
        },
      })
      .transform(page);
  } catch {
    return page;
  }
}
