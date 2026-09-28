import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Truck, ShieldCheck, MessageCircle, ArrowRight } from "lucide-react";
import Header from "../components/ui/Header";
import Marquee from "../components/ui/Marquee";
import Reveal from "../components/ui/Reveal";
import PromoBanner from "../components/PromoBanner";
import ProductCard from "../components/catalog/ProductCard";
import HeroDrop from "../components/home/HeroDrop";
import FeaturedDrop from "../components/home/FeaturedDrop";
import SectionHeading from "../components/home/SectionHeading";
import CategoryTiles, { type CategoryTile } from "../components/home/CategoryTiles";
import { getProducts, type CatalogProduct } from "../services/productService";
import { QUERY_KEYS } from "../constants/queryKeys";
import { ROUTES, MARQUEE_ITEMS, HERO_IMAGES, CATEGORY_IMAGES, MAX_HERO_SLIDES } from "../constants/app";
import { useAuth } from "../context/AuthContext";

const CURATED_COUNT = 8;
const MAX_TILES     = 6;

/**
 * Fotos del hero. Manda la curaduría manual de `HERO_IMAGES`; si está vacía,
 * cae a las fotos más recientes del catálogo para que la portada nunca quede
 * en negro aunque nadie haya subido campaña.
 */
function heroImages(products: CatalogProduct[]): string[] {
  if (HERO_IMAGES.length > 0) return HERO_IMAGES;
  return products
    .filter((p) => p.image_url)
    .slice(0, MAX_HERO_SLIDES)
    .map((p) => p.image_url);
}

function CuratedSkeleton() {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-x-4 gap-y-10">
      {Array.from({ length: CURATED_COUNT }).map((_, i) => (
        <div key={i} className="animate-pulse flex flex-col">
          <div className="aspect-[4/5] rounded-card bg-ink-100" />
          <div className="h-3 bg-ink-100 w-3/4 mt-3" />
          <div className="h-3 bg-ink-100 w-1/3 mt-2" />
        </div>
      ))}
    </div>
  );
}

export default function HomePage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const isAdmin  = user?.role === "admin";

  // Misma query key que el catálogo y el sidebar: se sirve de caché.
  const { data: products = [], isLoading } = useQuery({
    queryKey: [...QUERY_KEYS.PRODUCTS, isAdmin],
    queryFn:  () => getProducts(isAdmin),
  });

  const visible = useMemo(() => products.filter((p) => p.is_active), [products]);

  const maxDiscountPercent = useMemo(
    () => visible.reduce((max, p) => (p.discount_percentage > max ? p.discount_percentage : max), 0),
    [visible]
  );

  // Destacado: manda lo que el admin marcó con "Destacar en la home". Si no hay
  // nada marcado, cae a lo más reciente marcado como nuevo y luego al mejor
  // descuento, para que la sección nunca desaparezca.
  const featured = useMemo(() => {
    const picked = visible.find((p) => p.is_featured);
    if (picked) return picked;

    const inStock = visible.filter((p) => !p.is_sold_out && !p.is_reserved);
    const pool    = inStock.length > 0 ? inStock : visible;
    return (
      pool.find((p) => p.is_new) ??
      [...pool].sort((a, b) => b.discount_percentage - a.discount_percentage)[0] ??
      null
    );
  }, [visible]);

  // Selección: novedades y rebajas primero, el destacado no se repite.
  const curated = useMemo(() => {
    const rank = (p: CatalogProduct) => {
      if (p.is_sold_out || p.is_reserved) return 3;
      if (p.is_new)                       return 0;
      if (p.discount_percentage > 0)      return 1;
      return 2;
    };
    return [...visible]
      .filter((p) => p.id !== featured?.id)
      .sort((a, b) => rank(a) - rank(b))
      .slice(0, CURATED_COUNT);
  }, [visible, featured]);

  const categoryTiles: CategoryTile[] = useMemo(() => {
    const byslug = new Map<string, CategoryTile>();
    for (const product of visible) {
      for (const cat of product.categories) {
        const entry = byslug.get(cat.slug);
        if (entry) entry.count += 1;
        else byslug.set(cat.slug, { slug: cat.slug, name: cat.name, count: 1, image: product.image_url });
      }
    }
    return [...byslug.values()]
      .map((c) => ({ ...c, image: CATEGORY_IMAGES[c.slug] ?? c.image }))
      .filter((c) => c.image)
      .sort((a, b) => b.count - a.count)
      .slice(0, MAX_TILES);
  }, [visible]);

  return (
    <>
      {!isLoading && <PromoBanner maxDiscountPercent={maxDiscountPercent} />}

      <Header overlay />
      <HeroDrop images={heroImages(visible)} />

      <Marquee items={[...MARQUEE_ITEMS]} />

      {featured && <FeaturedDrop product={featured} />}

      {/* ── Selección curada ─────────────────────────────────────────── */}
      <section className="px-4 sm:px-6 lg:px-10 py-20 lg:py-28 max-w-[1600px] mx-auto">
        <SectionHeading
          index="02"
          eyebrow="Selección"
          title={<>Lo que<br className="sm:hidden" /> está saliendo</>}
          link={{ label: "Ver todo el catálogo", to: ROUTES.CATALOG }}
        />

        {isLoading ? (
          <CuratedSkeleton />
        ) : curated.length > 0 ? (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-x-4 gap-y-10">
            {curated.map((product, i) => (
              <ProductCard
                key={product.id}
                index={i}
                name={product.name}
                price_sale={product.price_sale}
                image_url={product.image_url}
                images={product.images}
                is_new={product.is_new}
                discount_percentage={product.discount_percentage}
                is_sold_out={product.is_sold_out}
                is_reserved={product.is_reserved}
                onClick={() => navigate(ROUTES.PRODUCT(product.slug))}
              />
            ))}
          </div>
        ) : (
          <p className="type-accent text-xl text-ink-400 py-16 text-center">
            Estamos preparando el próximo drop.
          </p>
        )}

        <Reveal className="flex justify-center mt-16">
          <button onClick={() => navigate(ROUTES.CATALOG)} className="btn-outline group">
            Ver todo el catálogo
            <ArrowRight
              size={14}
              strokeWidth={2}
              className="transition-transform duration-300 ease-drop group-hover:translate-x-1"
            />
          </button>
        </Reveal>
      </section>

      {/* ── Categorías ───────────────────────────────────────────────── */}
      {categoryTiles.length > 0 && (
        <section className="pb-20 lg:pb-28">
          <div className="px-4 sm:px-6 lg:px-10 max-w-[1600px] mx-auto">
            <SectionHeading index="03" eyebrow="Categorías" title="Buscá por tipo" />
          </div>
          <CategoryTiles categories={categoryTiles} />
        </section>
      )}

      {/* ── Manifiesto ───────────────────────────────────────────────── */}
      <section className="bg-ink-950 text-bone px-6 py-24 lg:py-32 grain relative">
        <Reveal className="max-w-3xl mx-auto text-center">
          <span className="type-eyebrow text-bone/40">Dropping CR</span>
          <p className="type-accent text-[clamp(1.6rem,4.5vw,2.75rem)] leading-[1.25] mt-6">
            No vendemos temporadas. Traemos piezas que ya no se consiguen,
            una por una, y cuando se van <span className="not-italic font-display uppercase">no vuelven</span>.
          </p>
          <p className="type-eyebrow text-bone/40 mt-8">Grecia · Costa Rica</p>
        </Reveal>
      </section>

      {/* ── Garantías ────────────────────────────────────────────────── */}
      <section className="border-b border-ink-200">
        <div className="max-w-[1600px] mx-auto grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-ink-200">
          {[
            { icon: Truck,         title: "Envíos a todo el país", text: "Correos de Costa Rica, con número de guía." },
            { icon: ShieldCheck,   title: "Piezas verificadas",     text: "Cada prenda se revisa antes de publicarse." },
            { icon: MessageCircle, title: "Atención directa",       text: "Escribinos por WhatsApp y te respondemos." },
          ].map(({ icon: Icon, title, text }, i) => (
            <Reveal key={title} delay={i * 0.08} className="flex flex-col gap-3 px-6 lg:px-10 py-12">
              <Icon size={20} strokeWidth={1.5} className="text-ink-900" />
              <h3 className="font-display uppercase text-[13px] tracking-widest2 text-ink-900">
                {title}
              </h3>
              <p className="text-[13px] leading-relaxed text-ink-500 max-w-[32ch]">{text}</p>
            </Reveal>
          ))}
        </div>
      </section>
    </>
  );
}
