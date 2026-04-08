import { supabase } from "../lib/supabaseClient";

// ── Types ──────────────────────────────────────────────────────────────────

export interface Category {
  id: string;
  name: string;
  slug: string;
}

export interface ProductImage {
  id: string;
  image_url: string;
  is_primary: boolean;
  display_order: number;
}

export interface ProductVariant {
  id: string;
  size: string;
  stock: number;
}

export interface ProductDetail {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  price_purchase: number;
  price_sale: number;
  discount_percentage: number;
  is_active: boolean;
  is_new: boolean;
  created_at: string;
  categories: Category[];
  images: ProductImage[];
  variants: ProductVariant[];
}

export interface CatalogProduct {
  id: string;
  name: string;
  slug: string;
  price_sale: number;
  discount_percentage: number;
  image_url: string;
  images: string[];
  category: string;
  categories: { name: string; slug: string }[];
  sizes: string[];
  is_new: boolean;
  is_sold_out: boolean;
}

export interface ProductInput {
  name: string;
  slug: string;
  description: string | null;
  price_purchase: number;
  price_sale: number;
  discount_percentage: number;
  is_active: boolean;
  is_new: boolean;
  category_ids: string[];
  images: { image_url: string; is_primary: boolean; display_order: number }[];
  variants: { size: string; stock: number }[];
}

// ── Helpers ────────────────────────────────────────────────────────────────

function flattenCategories(productCategories: unknown[]): Category[] {
  return (productCategories ?? [])
    .map((pc: any) => pc.categories)
    .filter(Boolean) as Category[];
}

// ── Queries ────────────────────────────────────────────────────────────────

export async function getProducts(): Promise<CatalogProduct[]> {
  const { data, error } = await supabase
    .from("products")
    .select(`
      id, name, slug, price_sale, discount_percentage, is_new,
      product_images ( image_url, is_primary, display_order ),
      product_variants ( stock, size ),
      product_categories ( categories ( name, slug ) )
    `)
    .eq("is_active", true)
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);

  return (data ?? []).map((p: any) => {
    // Primary image always first, then rest by display_order
    const images: { image_url: string; is_primary: boolean; display_order: number }[] =
      [...(p.product_images ?? [])].sort((a, b) => {
        if (a.is_primary !== b.is_primary) return a.is_primary ? -1 : 1;
        return a.display_order - b.display_order;
      });

    const primaryImage = images[0];
    const totalStock = (p.product_variants ?? []).reduce(
      (sum: number, v: { stock: number }) => sum + v.stock, 0
    );
    const sizes: string[] = [
      ...new Set<string>(
        (p.product_variants ?? [])
          .filter((v: any) => v.stock > 0)
          .map((v: any) => v.size as string)
      ),
    ];
    const productCategories: { name: string; slug: string }[] = (p.product_categories ?? [])
      .map((pc: any) => pc.categories)
      .filter(Boolean)
      .map((c: any) => ({ name: c.name, slug: c.slug }));

    return {
      id:                  p.id,
      name:                p.name,
      slug:                p.slug,
      price_sale:          p.price_sale,
      discount_percentage: p.discount_percentage,
      image_url:           primaryImage?.image_url ?? "",
      images:              images.map((i) => i.image_url),
      category:            productCategories[0]?.name ?? "",
      categories:          productCategories,
      sizes,
      is_new:              p.is_new ?? false,
      is_sold_out:         totalStock === 0,
    };
  });
}

export async function getCategories(): Promise<Category[]> {
  const { data, error } = await supabase
    .from("categories")
    .select("id, name, slug")
    .order("name");

  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function getProductBySlug(slug: string): Promise<ProductDetail> {
  const { data, error } = await supabase
    .from("products")
    .select(`
      id, name, slug, description,
      price_purchase, price_sale, discount_percentage,
      is_active, is_new, created_at,
      images: product_images ( id, image_url, is_primary, display_order ),
      variants: product_variants ( id, size, stock ),
      product_categories ( categories ( id, name, slug ) )
    `)
    .eq("slug", slug)
    .eq("is_active", true)
    .single();

  if (error) throw new Error(error.message);
  if (!data)  throw new Error(`Producto "${slug}" no encontrado.`);

  const images = [...(data.images ?? [])].sort(
    (a, b) => a.display_order - b.display_order
  );

  return {
    ...data,
    images,
    categories: flattenCategories(data.product_categories ?? []),
  } as ProductDetail;
}

export async function getProductById(id: string): Promise<ProductDetail> {
  const { data, error } = await supabase
    .from("products")
    .select(`
      id, name, slug, description,
      price_purchase, price_sale, discount_percentage,
      is_active, is_new, created_at,
      images: product_images ( id, image_url, is_primary, display_order ),
      variants: product_variants ( id, size, stock ),
      product_categories ( categories ( id, name, slug ) )
    `)
    .eq("id", id)
    .single();

  if (error) throw new Error(error.message);
  if (!data)  throw new Error("Producto no encontrado.");

  const images = [...(data.images ?? [])].sort(
    (a, b) => a.display_order - b.display_order
  );

  return {
    ...data,
    images,
    categories: flattenCategories(data.product_categories ?? []),
  } as ProductDetail;
}

// ── Inventory-focused update (preserves variant IDs for sale tracking) ─────

export interface InventoryUpdate {
  name:                string;
  description:         string | null;
  price_purchase:      number;
  price_sale:          number;
  discount_percentage: number;
  is_active:           boolean;
  is_new:              boolean;
  category_ids: string[];
  variants: { id?: string; size: string; stock: number }[];
  images:   { image_url: string; is_primary: boolean; display_order: number }[];
}

export async function updateProductInventory(
  productId: string,
  data: InventoryUpdate
): Promise<void> {
  const { error } = await supabase
    .from("products")
    .update({
      name:                data.name,
      description:         data.description,
      price_purchase:      data.price_purchase,
      price_sale:          data.price_sale,
      discount_percentage: data.discount_percentage,
      is_active:           data.is_active,
      is_new:              data.is_new,
    })
    .eq("id", productId);

  if (error) throw new Error(error.message);

  // Sync categories: wipe + re-insert
  await supabase.from("product_categories").delete().eq("product_id", productId);
  if (data.category_ids.length) {
    const { error: catError } = await supabase
      .from("product_categories")
      .insert(data.category_ids.map((cid) => ({ product_id: productId, category_id: cid })));
    if (catError) throw new Error(catError.message);
  }

  // Sync images: wipe + re-insert
  await supabase.from("product_images").delete().eq("product_id", productId);
  if (data.images.length) {
    const { error: imgError } = await supabase
      .from("product_images")
      .insert(data.images.map((img) => ({ ...img, product_id: productId })));
    if (imgError) throw new Error(imgError.message);
  }

  for (const v of data.variants) {
    if (v.id) {
      const { error: e } = await supabase
        .from("product_variants")
        .update({ size: v.size, stock: v.stock })
        .eq("id", v.id);
      if (e) throw new Error(e.message);
    } else {
      const { error: e } = await supabase
        .from("product_variants")
        .insert({ product_id: productId, size: v.size, stock: v.stock });
      if (e) throw new Error(e.message);
    }
  }
}

export async function deleteProduct(productId: string): Promise<void> {
  const { error } = await supabase
    .from("products")
    .delete()
    .eq("id", productId);
  if (error) throw new Error(error.message);
}

export async function deleteVariant(variantId: string): Promise<void> {
  const { error } = await supabase
    .from("product_variants")
    .delete()
    .eq("id", variantId);
  if (error) throw new Error(error.message);
}

// ── Mutations ──────────────────────────────────────────────────────────────

export async function createProduct(input: ProductInput): Promise<string> {
  const { data: product, error: productError } = await supabase
    .from("products")
    .insert({
      name:                input.name,
      slug:                input.slug,
      description:         input.description,
      price_purchase:      input.price_purchase,
      price_sale:          input.price_sale,
      discount_percentage: input.discount_percentage,
      is_active:           input.is_active,
      is_new:              input.is_new,
    })
    .select("id")
    .single();

  if (productError) throw new Error(productError.message);
  const productId = product.id;

  if (input.category_ids.length) {
    const { error } = await supabase
      .from("product_categories")
      .insert(input.category_ids.map((cid) => ({ product_id: productId, category_id: cid })));
    if (error) throw new Error(error.message);
  }

  if (input.images.length) {
    const { error } = await supabase
      .from("product_images")
      .insert(input.images.map((img) => ({ ...img, product_id: productId })));
    if (error) throw new Error(error.message);
  }

  if (input.variants.length) {
    const { error } = await supabase
      .from("product_variants")
      .insert(input.variants.map((v) => ({ ...v, product_id: productId })));
    if (error) throw new Error(error.message);
  }

  return productId;
}

export async function updateProduct(id: string, input: ProductInput): Promise<void> {
  const { error: productError } = await supabase
    .from("products")
    .update({
      name:                input.name,
      slug:                input.slug,
      description:         input.description,
      price_purchase:      input.price_purchase,
      price_sale:          input.price_sale,
      discount_percentage: input.discount_percentage,
      is_active:           input.is_active,
      is_new:              input.is_new,
    })
    .eq("id", id);

  if (productError) throw new Error(productError.message);

  // Sync categories: wipe + re-insert
  await supabase.from("product_categories").delete().eq("product_id", id);
  if (input.category_ids.length) {
    const { error } = await supabase
      .from("product_categories")
      .insert(input.category_ids.map((cid) => ({ product_id: id, category_id: cid })));
    if (error) throw new Error(error.message);
  }

  // Sync images: wipe + re-insert
  await supabase.from("product_images").delete().eq("product_id", id);
  if (input.images.length) {
    const { error } = await supabase
      .from("product_images")
      .insert(input.images.map((img) => ({ ...img, product_id: id })));
    if (error) throw new Error(error.message);
  }

  // Sync variants: wipe + re-insert
  await supabase.from("product_variants").delete().eq("product_id", id);
  if (input.variants.length) {
    const { error } = await supabase
      .from("product_variants")
      .insert(input.variants.map((v) => ({ ...v, product_id: id })));
    if (error) throw new Error(error.message);
  }
}
