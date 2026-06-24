import { supabase } from "../lib/supabaseClient";
import type { ProductDetail } from "./productService";

export function buildInstagramCaption(product: Pick<
  ProductDetail,
  "name" | "description" | "price_sale" | "discount_percentage" | "variants"
>): string {
  const lines: string[] = [];

  lines.push(`${product.name.toUpperCase()}`, "");

  if (product.description?.trim()) {
    lines.push(product.description.trim(), "");
  }

  const availableSizes = product.variants
    .filter((v) => v.stock > 0)
    .map((v) => v.size);

  if (availableSizes.length > 0) {
    lines.push(`Tallas disponibles: ${availableSizes.join(" · ")}`);
  }

  const discPct = product.discount_percentage ?? 0;
  if (discPct > 0) {
    const discounted = Math.round(product.price_sale * (1 - discPct / 100));
    lines.push(`Precio: ₡${product.price_sale.toLocaleString("en-US")} → ₡${discounted.toLocaleString("en-US")} (${discPct}% OFF)`);
  } else {
    lines.push(`Precio: ₡${product.price_sale.toLocaleString("en-US")}`);
  }

  lines.push(
    "",
    "📲 Pedí el tuyo por DM o WhatsApp",
    "🛒 droppingcr.com",
    "",
  );

  return lines.join("\n");
}

export async function publishToInstagram(imageUrls: string[], caption: string): Promise<string> {
  const { data, error } = await supabase.functions.invoke("instagram-publish", {
    body: { imageUrls, caption },
  });
  if (error) throw new Error(error.message);
  if (data?.error) throw new Error(data.error);
  return data.postId as string;
}
