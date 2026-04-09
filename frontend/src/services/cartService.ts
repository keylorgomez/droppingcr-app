import { supabase } from "../lib/supabaseClient";

// ── Types ──────────────────────────────────────────────────────────────────

export interface CartItem {
  variant_id:   string;
  product_id:   string;
  product_name: string;
  variant_size: string;
  image_url:    string;
  price:        number;  // effective price (with discount applied) at add time
  quantity:     number;
  slug:         string;
  stock:        number;  // last-known stock; refresh in CartPage
}

// ── Guest (localStorage) ───────────────────────────────────────────────────

const CART_KEY = "dropping_guest_cart";

export function getGuestCart(): CartItem[] {
  try {
    return JSON.parse(localStorage.getItem(CART_KEY) ?? "[]");
  } catch {
    return [];
  }
}

export function setGuestCart(items: CartItem[]): void {
  localStorage.setItem(CART_KEY, JSON.stringify(items));
}

export function clearGuestCart(): void {
  localStorage.removeItem(CART_KEY);
}

// ── User (Supabase) ────────────────────────────────────────────────────────

export async function getUserCart(userId: string): Promise<CartItem[]> {
  const { data, error } = await supabase
    .from("cart_items")
    .select(`
      variant_id, quantity,
      product_variants (
        size, stock,
        products (
          id, name, slug, price_sale, discount_percentage,
          product_images ( image_url, is_primary, display_order )
        )
      )
    `)
    .eq("user_id", userId)
    .order("created_at", { ascending: true });

  if (error) throw new Error(error.message);

  return (data ?? []).map((row: any) => {
    const pv   = row.product_variants;
    const pr   = pv?.products;
    const imgs = [...(pr?.product_images ?? [])].sort((a: any, b: any) => {
      if (a.is_primary !== b.is_primary) return a.is_primary ? -1 : 1;
      return a.display_order - b.display_order;
    });
    const price = pr?.discount_percentage > 0
      ? Math.round(pr.price_sale * (1 - pr.discount_percentage / 100))
      : (pr?.price_sale ?? 0);

    return {
      variant_id:   row.variant_id,
      product_id:   pr?.id            ?? "",
      product_name: pr?.name          ?? "",
      variant_size: pv?.size          ?? "",
      image_url:    imgs[0]?.image_url ?? "",
      price,
      quantity:     row.quantity,
      slug:         pr?.slug          ?? "",
      stock:        pv?.stock         ?? 0,
    } as CartItem;
  });
}

export async function upsertUserCartItem(
  userId:    string,
  variantId: string,
  quantity:  number
): Promise<void> {
  const { error } = await supabase
    .from("cart_items")
    .upsert(
      { user_id: userId, variant_id: variantId, quantity },
      { onConflict: "user_id,variant_id" }
    );
  if (error) throw new Error(error.message);
}

export async function removeUserCartItem(userId: string, variantId: string): Promise<void> {
  const { error } = await supabase
    .from("cart_items")
    .delete()
    .eq("user_id", userId)
    .eq("variant_id", variantId);
  if (error) throw new Error(error.message);
}

export async function clearUserCart(userId: string): Promise<void> {
  const { error } = await supabase
    .from("cart_items")
    .delete()
    .eq("user_id", userId);
  if (error) throw new Error(error.message);
}

// ── Sync: guest → user on login ────────────────────────────────────────────

export async function syncGuestCartToUser(
  userId:     string,
  guestItems: CartItem[]
): Promise<void> {
  if (!guestItems.length) return;

  // Fetch existing user cart to merge quantities
  const existing = await getUserCart(userId);
  const existingMap = new Map(existing.map((i) => [i.variant_id, i.quantity]));

  for (const item of guestItems) {
    const currentQty = existingMap.get(item.variant_id) ?? 0;
    const merged     = Math.max(currentQty, item.quantity);
    await upsertUserCartItem(userId, item.variant_id, merged);
  }
}

// ── Live stock validation (CartPage) ──────────────────────────────────────

export async function getLiveStocks(
  variantIds: string[]
): Promise<Record<string, number>> {
  if (!variantIds.length) return {};
  const { data } = await supabase
    .from("product_variants")
    .select("id, stock")
    .in("id", variantIds);
  return Object.fromEntries((data ?? []).map((v: any) => [v.id, v.stock]));
}
