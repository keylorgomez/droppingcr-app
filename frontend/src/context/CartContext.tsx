import {
  createContext, useContext, useEffect, useRef, useState, type ReactNode,
} from "react";
import { useAuth } from "./AuthContext";
import {
  getGuestCart, setGuestCart, clearGuestCart,
  getUserCart, upsertUserCartItem, removeUserCartItem, clearUserCart,
  syncGuestCartToUser,
  type CartItem,
} from "../services/cartService";

// ── Types ──────────────────────────────────────────────────────────────────

interface AddItemParams {
  variant_id:   string;
  product_id:   string;
  product_name: string;
  variant_size: string;
  image_url:    string;
  price:        number;
  slug:         string;
  stock:        number;
}

interface CartContextType {
  items:        CartItem[];
  isLoading:    boolean;
  itemCount:    number;
  subtotal:     number;
  drawerOpen:   boolean;
  drawerItem:   CartItem | null;
  addItem:      (params: AddItemParams) => Promise<void>;
  removeItem:   (variantId: string) => Promise<void>;
  updateQty:    (variantId: string, qty: number) => Promise<void>;
  clearCart:    () => Promise<void>;
  closeDrawer:  () => void;
}

// ── Context ────────────────────────────────────────────────────────────────

const CartContext = createContext<CartContextType | null>(null);

export function CartProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();

  const [items,      setItems]      = useState<CartItem[]>([]);
  const [isLoading,  setIsLoading]  = useState(true);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerItem, setDrawerItem] = useState<CartItem | null>(null);

  const drawerTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevUserId     = useRef<string | null | undefined>(undefined); // undefined = uninitialised

  // ── Initial load ──────────────────────────────────────────────────────────
  useEffect(() => {
    async function init() {
      setIsLoading(true);
      try {
        if (user) {
          // Sync any leftover guest items first, then load user cart
          const guestItems = getGuestCart();
          if (guestItems.length) {
            await syncGuestCartToUser(user.id, guestItems);
            clearGuestCart();
          }
          const dbItems = await getUserCart(user.id);
          setItems(dbItems);
        } else {
          setItems(getGuestCart());
        }
      } catch {
        // Fail gracefully: show whatever was in local state
      } finally {
        setIsLoading(false);
      }
    }

    // Run on first mount and whenever userId changes (login / logout)
    if (prevUserId.current === undefined || prevUserId.current !== (user?.id ?? null)) {
      prevUserId.current = user?.id ?? null;
      init();
    }
  }, [user]);

  // ── Drawer auto-close ─────────────────────────────────────────────────────
  function openDrawer(item: CartItem) {
    setDrawerItem(item);
    setDrawerOpen(true);
    if (drawerTimerRef.current) clearTimeout(drawerTimerRef.current);
    drawerTimerRef.current = setTimeout(() => setDrawerOpen(false), 4000);
  }

  function closeDrawer() {
    setDrawerOpen(false);
    if (drawerTimerRef.current) clearTimeout(drawerTimerRef.current);
  }

  // ── Add item ──────────────────────────────────────────────────────────────
  async function addItem(params: AddItemParams) {
    const existing = items.find((i) => i.variant_id === params.variant_id);
    const newQty   = Math.min((existing?.quantity ?? 0) + 1, params.stock);

    const newItem: CartItem = {
      ...params,
      quantity: newQty,
    };

    const updated = existing
      ? items.map((i) => i.variant_id === params.variant_id ? { ...i, quantity: newQty } : i)
      : [...items, newItem];

    setItems(updated);
    openDrawer(newItem);

    if (user) {
      await upsertUserCartItem(user.id, params.variant_id, newQty);
    } else {
      setGuestCart(updated);
    }
  }

  // ── Remove item ───────────────────────────────────────────────────────────
  async function removeItem(variantId: string) {
    const updated = items.filter((i) => i.variant_id !== variantId);
    setItems(updated);

    if (user) {
      await removeUserCartItem(user.id, variantId);
    } else {
      setGuestCart(updated);
    }
  }

  // ── Update quantity ────────────────────────────────────────────────────────
  async function updateQty(variantId: string, qty: number) {
    if (qty <= 0) return removeItem(variantId);

    const updated = items.map((i) =>
      i.variant_id === variantId ? { ...i, quantity: qty } : i
    );
    setItems(updated);

    if (user) {
      await upsertUserCartItem(user.id, variantId, qty);
    } else {
      setGuestCart(updated);
    }
  }

  // ── Clear cart ─────────────────────────────────────────────────────────────
  async function clearCart() {
    setItems([]);
    if (user) {
      await clearUserCart(user.id);
    } else {
      clearGuestCart();
    }
  }

  // ── Derived values ─────────────────────────────────────────────────────────
  const itemCount = items.reduce((sum, i) => sum + i.quantity, 0);
  const subtotal  = items.reduce((sum, i) => sum + i.price * i.quantity, 0);

  return (
    <CartContext.Provider value={{
      items, isLoading, itemCount, subtotal,
      drawerOpen, drawerItem,
      addItem, removeItem, updateQty, clearCart,
      closeDrawer,
    }}>
      {children}
    </CartContext.Provider>
  );
}

// ── Hook ───────────────────────────────────────────────────────────────────

export function useCart(): CartContextType {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used inside <CartProvider>");
  return ctx;
}
