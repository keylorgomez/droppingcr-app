import { useState, useMemo, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  X, Package, Check, Loader2, ShoppingBag,
  Search, Plus, Minus, ArrowLeft, ChevronRight,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useToast } from "../ui/Toast";
import {
  DELIVERY_STATUSES,
  SHIPPING_OPTIONS,
  shippingCostFor,
  type DeliveryStatus,
  type ShippingMethod,
} from "../../services/salesService";
import { recordManualOrder } from "../../services/ordersService";
import {
  getProductsWithVariants,
  type ProductWithVariants,
} from "../../services/productService";
import { cn } from "../../lib/utils";
import { QUERY_KEYS } from "../../constants/queryKeys";

// ── Shared style ───────────────────────────────────────────────────────────

const inputCls =
  "w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-poppins text-brand-dark " +
  "placeholder:text-gray-300 outline-none focus:border-brand-primary " +
  "focus:ring-1 focus:ring-brand-primary/20 transition";

function normalizeText(text: string) {
  return text.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
}

// ── Types ──────────────────────────────────────────────────────────────────

interface CartItem {
  tempId:       string;
  product_id:   string;
  product_name: string;
  variant_id:   string;
  variant_size: string;
  quantity:     number;
  sale_price:   number;
  image_url:    string;
  maxStock:     number;
}

// ── Props ──────────────────────────────────────────────────────────────────

interface NewOrderModalProps {
  onClose: () => void;
}

// ── Component ──────────────────────────────────────────────────────────────

export default function NewOrderModal({ onClose }: NewOrderModalProps) {
  const { showToast } = useToast();
  const queryClient   = useQueryClient();

  // Customer info
  const [guestName,  setGuestName]  = useState("");
  const [guestPhone, setGuestPhone] = useState("");

  // Load draft from sessionStorage (set by EditProductPage for add-more-products flow)
  useEffect(() => {
    const draftJson = sessionStorage.getItem("order_draft");
    if (draftJson) {
      try {
        const draft = JSON.parse(draftJson);
        if (draft.guest_name)  setGuestName(draft.guest_name);
        if (draft.guest_phone) setGuestPhone(draft.guest_phone);
      } catch {}
      sessionStorage.removeItem("order_draft");
    }
  }, []);

  // Cart state
  const [cartItems,     setCartItems]     = useState<CartItem[]>([]);
  const [showPicker,    setShowPicker]    = useState(false);
  const [pickerSearch,  setPickerSearch]  = useState("");
  const [pickerProduct, setPickerProduct] = useState<ProductWithVariants | null>(null);

  // Shipping
  const [shippingMethod, setShippingMethod] = useState<ShippingMethod>("personal_grecia");
  const shippingCost = shippingCostFor(shippingMethod);

  // Payment
  const [initialPayment, setInitialPayment] = useState("");
  const [payStatus,      setPayStatus]      = useState<"pending" | "completed">("pending");

  // Delivery
  const [deliveryStatus, setDeliveryStatus] = useState<DeliveryStatus>("validating");

  // Note
  const [note, setNote] = useState("");

  const { data: products = [], isLoading: productsLoading } = useQuery({
    queryKey: QUERY_KEYS.PRODUCTS_WITH_VARIANTS,
    queryFn:  getProductsWithVariants,
  });

  const filteredProducts = useMemo(() => {
    const searchQuery = normalizeText(pickerSearch.trim());
    if (!searchQuery) return products;
    return products.filter((product) => normalizeText(product.name).includes(searchQuery));
  }, [products, pickerSearch]);

  const itemsTotal = cartItems.reduce((total, item) => total + item.sale_price * item.quantity, 0);
  const orderTotal = itemsTotal + shippingCost;

  function addToCart(product: ProductWithVariants, variantId: string) {
    const variant = product.variants.find((variantEntry) => variantEntry.id === variantId);
    if (!variant) return;
    const tempId = `${Date.now()}-${Math.random()}`;
    setCartItems((prev) => [
      ...prev,
      {
        tempId,
        product_id:   product.id,
        product_name: product.name,
        variant_id:   variant.id,
        variant_size: variant.size,
        quantity:     1,
        sale_price:   product.price_sale,
        image_url:    product.image_url,
        maxStock:     variant.stock,
      },
    ]);
    setPickerProduct(null);
    setPickerSearch("");
    setShowPicker(false);
  }

  function removeCartItem(tempId: string) {
    setCartItems((prev) => prev.filter((cartItem) => cartItem.tempId !== tempId));
  }

  function updateCartItem(tempId: string, field: "quantity" | "sale_price", value: number) {
    setCartItems((prev) =>
      prev.map((cartItem) => {
        if (cartItem.tempId !== tempId) return cartItem;
        if (field === "quantity") {
          const clamped = Math.max(1, Math.min(cartItem.maxStock, value));
          return { ...cartItem, quantity: clamped };
        }
        return { ...cartItem, [field]: value };
      })
    );
  }

  const submitMutation = useMutation({
    mutationFn: () => recordManualOrder({
      items: cartItems.map((cartItem) => ({
        product_id: cartItem.product_id,
        variant_id: cartItem.variant_id,
        quantity:   cartItem.quantity,
        sale_price: cartItem.sale_price,
      })),
      guest_name:      guestName.trim() || null,
      guest_phone:     guestPhone.trim() || null,
      status:          payStatus,
      initial_payment: Number(initialPayment) || 0,
      shipping_method: shippingMethod,
      shipping_cost:   shippingCost,
      delivery_status: deliveryStatus,
      tracking_number: null,
      note:            note.trim() || null,
    }),
    onSuccess: () => {
      showToast("Compra registrada correctamente.", "success");
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.ADMIN_SALES });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.ADMIN_ORDERS });
      onClose();
    },
    onError: (err: Error) => showToast(err.message, "error"),
  });

  function handleSubmit() {
    if (cartItems.length === 0) {
      showToast("Agregá al menos un producto.", "error");
      return;
    }
    submitMutation.mutate();
  }

  return (
    <motion.div
      key="backdrop-new"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/40 z-40 backdrop-blur-sm
                 flex items-center justify-center px-4"
      onClick={onClose}
    >
      <motion.div
        key="modal-new"
        initial={{ opacity: 0, scale: 0.97, y: 16 }}
        animate={{ opacity: 1, scale: 1,    y: 0  }}
        exit={{ opacity: 0,    scale: 0.97, y: 8  }}
        transition={{ type: "spring", stiffness: 340, damping: 30 }}
        className="w-full max-w-lg bg-white rounded-2xl shadow-xl flex flex-col
                   max-h-[94vh] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-gray-100">
          <div>
            <h2 className="font-poppins font-semibold text-base text-brand-dark">
              Nueva compra
            </h2>
            <p className="font-poppins text-xs text-gray-400 mt-0.5">
              Registrá uno o más productos para un cliente
            </p>
          </div>
          <button onClick={onClose} className="text-gray-300 hover:text-gray-500 transition-colors">
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex flex-col gap-5 px-5 py-5">

          {/* 1. Cliente */}
          <section className="flex flex-col gap-3">
            <p className="text-xs font-medium text-gray-500 font-poppins uppercase tracking-wider">
              Cliente
            </p>
            <input
              type="text"
              value={guestName}
              onChange={(e) => setGuestName(e.target.value)}
              placeholder="Nombre del cliente"
              className={inputCls}
            />
            <input
              type="text"
              value={guestPhone}
              onChange={(e) => setGuestPhone(e.target.value)}
              placeholder="WhatsApp (ej: 88887777)"
              className={inputCls}
            />
          </section>

          {/* 2. Productos */}
          <section className="flex flex-col gap-3">
            <p className="text-xs font-medium text-gray-500 font-poppins uppercase tracking-wider">
              Productos
            </p>

            {/* Cart items */}
            {cartItems.length > 0 && (
              <div className="rounded-xl border border-gray-100 overflow-hidden divide-y divide-gray-50">
                {cartItems.map((item) => (
                  <div key={item.tempId} className="flex flex-col px-3 py-2.5 gap-1">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-lg overflow-hidden bg-gray-50 border border-gray-100 shrink-0">
                        {item.image_url
                          ? <img src={item.image_url} alt={item.product_name} className="w-full h-full object-cover" />
                          : <Package size={12} className="m-auto mt-1.5 text-gray-200" />
                        }
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-poppins text-xs font-medium text-brand-dark truncate">
                          {item.product_name}
                        </p>
                        <span className="text-[10px] font-poppins bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-md font-medium">
                          {item.variant_size}
                        </span>
                      </div>

                      {/* Quantity controls */}
                      <div className="flex flex-col items-center gap-0.5 shrink-0">
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => updateCartItem(item.tempId, "quantity", item.quantity - 1)}
                            className="w-6 h-6 rounded-md border border-gray-200 flex items-center justify-center
                                       text-gray-400 hover:text-gray-600 hover:border-gray-300 transition-colors"
                          >
                            <Minus size={10} />
                          </button>
                          <input
                            type="number"
                            min={1}
                            max={item.maxStock}
                            value={item.quantity}
                            onChange={(e) => updateCartItem(item.tempId, "quantity", Number(e.target.value))}
                            className="w-10 text-center text-xs font-poppins border border-gray-200 rounded-md
                                       py-1 outline-none focus:border-brand-primary transition"
                          />
                          <button
                            type="button"
                            onClick={() => updateCartItem(item.tempId, "quantity", item.quantity + 1)}
                            className="w-6 h-6 rounded-md border border-gray-200 flex items-center justify-center
                                       text-gray-400 hover:text-gray-600 hover:border-gray-300 transition-colors"
                          >
                            <Plus size={10} />
                          </button>
                        </div>
                        {item.quantity >= item.maxStock && (
                          <span className="text-[10px] font-poppins text-red-400">
                            Máx: {item.maxStock}
                          </span>
                        )}
                      </div>

                      {/* Price with margin indicator */}
                      <div className="flex flex-col items-end shrink-0 gap-0.5">
                        <div className="flex items-center">
                          <span className="text-xs font-poppins text-gray-400 mr-0.5">₡</span>
                          <input
                            type="number"
                            min={0}
                            value={item.sale_price}
                            onChange={(e) => updateCartItem(item.tempId, "sale_price", Number(e.target.value))}
                            className="w-20 text-right text-xs font-poppins border border-gray-200 rounded-md
                                       px-2 py-1 outline-none focus:border-brand-primary transition"
                          />
                        </div>
                        {(() => {
                          const matchingProduct = products.find((prod) => prod.id === item.product_id);
                          if (!matchingProduct || !matchingProduct.price_purchase) return null;
                          const margin = ((item.sale_price - matchingProduct.price_purchase) / matchingProduct.price_purchase) * 100;
                          const colorCls =
                            margin < 0  ? "text-red-500"   :
                            margin < 20 ? "text-amber-500" :
                            margin < 40 ? "text-blue-500"  : "text-green-600";
                          return (
                            <p className={`text-[10px] font-poppins font-semibold ${colorCls}`}>
                              {margin.toFixed(0)}%
                            </p>
                          );
                        })()}
                      </div>

                      <button
                        type="button"
                        onClick={() => removeCartItem(item.tempId)}
                        className="text-gray-300 hover:text-red-400 transition-colors shrink-0 ml-0.5"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Add product button */}
            <button
              type="button"
              onClick={() => setShowPicker((prev) => !prev)}
              className="flex items-center gap-2 py-2.5 rounded-xl border border-dashed border-gray-300
                         text-sm font-poppins text-gray-400 hover:border-brand-primary hover:text-brand-primary
                         transition-colors justify-center"
            >
              <Plus size={14} strokeWidth={2.5} />
              Agregar producto
            </button>

            {/* Product picker */}
            <AnimatePresence>
              {showPicker && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="overflow-hidden"
                >
                  <div className="border border-gray-200 rounded-xl overflow-hidden">
                    {/* Search */}
                    <div className="relative border-b border-gray-100">
                      <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-300 pointer-events-none" />
                      <input
                        type="text"
                        value={pickerSearch}
                        onChange={(e) => { setPickerSearch(e.target.value); setPickerProduct(null); }}
                        placeholder="Buscar producto…"
                        autoFocus
                        className="w-full pl-9 pr-4 py-2.5 text-sm font-poppins text-brand-dark
                                   placeholder:text-gray-300 outline-none bg-white"
                      />
                    </div>

                    {/* Products list or variant picker */}
                    {!pickerProduct ? (
                      <div className="max-h-48 overflow-y-auto divide-y divide-gray-50">
                        {productsLoading && (
                          <p className="py-6 text-center text-xs font-poppins text-gray-300">
                            Cargando productos…
                          </p>
                        )}
                        {!productsLoading && filteredProducts.length === 0 && (
                          <p className="py-6 text-center text-xs font-poppins text-gray-300">
                            No hay productos disponibles.
                          </p>
                        )}
                        {filteredProducts.map((product) => (
                          <button
                            key={product.id}
                            type="button"
                            onClick={() => setPickerProduct(product)}
                            className="w-full flex items-center gap-2.5 px-3 py-2.5 text-left
                                       hover:bg-gray-50 transition-colors"
                          >
                            <div className="w-8 h-8 rounded-lg overflow-hidden bg-gray-50 border border-gray-100 shrink-0">
                              {product.image_url
                                ? <img src={product.image_url} alt={product.name} className="w-full h-full object-cover" />
                                : <Package size={12} className="m-auto mt-1.5 text-gray-200" />
                              }
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="font-poppins text-xs font-medium text-brand-dark truncate">
                                {product.name}
                              </p>
                              <p className="font-poppins text-[10px] text-gray-400">
                                ₡{product.price_sale.toLocaleString("en-US")}
                              </p>
                            </div>
                            <ChevronRight size={12} className="text-gray-300 shrink-0" />
                          </button>
                        ))}
                      </div>
                    ) : (
                      <div className="p-3">
                        <button
                          type="button"
                          onClick={() => setPickerProduct(null)}
                          className="flex items-center gap-1 text-xs font-poppins text-gray-400
                                     hover:text-brand-primary transition-colors mb-2"
                        >
                          <ArrowLeft size={12} />
                          Volver
                        </button>
                        <p className="font-poppins text-xs font-medium text-brand-dark mb-2 truncate">
                          {pickerProduct.name}
                        </p>
                        {pickerProduct.variants.length === 0 ? (
                          <p className="text-xs font-poppins text-gray-300">Sin tallas disponibles.</p>
                        ) : (
                          <div className="flex flex-wrap gap-2">
                            {pickerProduct.variants.map((variant) => (
                              <button
                                key={variant.id}
                                type="button"
                                onClick={() => addToCart(pickerProduct, variant.id)}
                                className="px-3 py-1.5 rounded-lg border border-gray-200 text-xs font-poppins
                                           font-medium text-brand-dark hover:border-brand-primary hover:text-brand-primary
                                           hover:bg-brand-primary/5 transition-all"
                              >
                                {variant.size}
                                <span className="ml-1 text-[10px] text-gray-300">({variant.stock})</span>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </section>

          {/* 3. Envío */}
          <section className="flex flex-col gap-2">
            <p className="text-xs font-medium text-gray-500 font-poppins uppercase tracking-wider">
              Envío
            </p>
            <select
              value={shippingMethod}
              onChange={(e) => setShippingMethod(e.target.value as ShippingMethod)}
              className={inputCls}
            >
              {SHIPPING_OPTIONS.map((shippingOption) => (
                <option key={shippingOption.value} value={shippingOption.value}>
                  {shippingOption.label} — ₡{shippingOption.cost.toLocaleString("en-US")}
                </option>
              ))}
            </select>
            {shippingCost > 0 && (
              <p className="text-[11px] font-poppins text-gray-400">
                Costo de envío: ₡{shippingCost.toLocaleString("en-US")}
              </p>
            )}
          </section>

          {/* 4. Estado de pago */}
          <section className="flex flex-col gap-2">
            <p className="text-xs font-medium text-gray-500 font-poppins uppercase tracking-wider">
              Estado de pago
            </p>
            <div className="flex gap-2">
              {(["pending", "completed"] as const).map((payStatusOption) => (
                <button
                  key={payStatusOption}
                  type="button"
                  onClick={() => {
                    setPayStatus(payStatusOption);
                    if (payStatusOption === "completed") setInitialPayment(orderTotal.toString());
                    else setInitialPayment("");
                  }}
                  className={cn(
                    "flex-1 py-2.5 rounded-xl border text-sm font-poppins font-medium transition-all",
                    payStatus === payStatusOption
                      ? "border-brand-primary bg-brand-primary/5 text-brand-primary"
                      : "border-gray-200 text-gray-400 hover:border-gray-300"
                  )}
                >
                  {payStatusOption === "pending" ? "A pagos (pendiente)" : "Pago completo"}
                </button>
              ))}
            </div>

            {payStatus === "completed" && (
              <div className="flex items-center gap-2 rounded-xl bg-green-50 border border-green-100 px-3 py-2.5">
                <span className="text-green-600 text-xs font-poppins">✓ Se registrará pago de</span>
                <span className="text-green-700 text-sm font-poppins font-semibold">
                  ₡{orderTotal.toLocaleString("en-US")}
                </span>
              </div>
            )}
          </section>

          {/* 5. Abono inicial */}
          {payStatus === "pending" && (
            <section className="flex flex-col gap-2">
              <p className="text-xs font-medium text-gray-500 font-poppins uppercase tracking-wider">
                Abono inicial (₡)
              </p>
              <input
                type="number"
                min={0}
                value={initialPayment}
                onChange={(e) => setInitialPayment(e.target.value)}
                placeholder="0"
                className={inputCls}
              />
              {initialPayment && Number(initialPayment) > 0 && (
                <p className="text-[11px] font-poppins text-gray-400">
                  Restará: ₡{Math.max(0, orderTotal - Number(initialPayment)).toLocaleString("en-US")}
                </p>
              )}
            </section>
          )}

          {/* 6. Estado de entrega */}
          <section className="flex flex-col gap-2">
            <p className="text-xs font-medium text-gray-500 font-poppins uppercase tracking-wider">
              Estado de entrega
            </p>
            <select
              value={deliveryStatus}
              onChange={(e) => setDeliveryStatus(e.target.value as DeliveryStatus)}
              className={inputCls}
            >
              {DELIVERY_STATUSES.map((statusOption) => (
                <option key={statusOption.value} value={statusOption.value}>
                  {statusOption.label}
                </option>
              ))}
            </select>
          </section>

          {/* 7. Notas */}
          <section className="flex flex-col gap-2">
            <p className="text-xs font-medium text-gray-500 font-poppins uppercase tracking-wider">
              Notas
              <span className="ml-1 text-gray-300 normal-case font-normal">(opcional)</span>
            </p>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
              placeholder="Observaciones del pedido…"
              className={cn(inputCls, "resize-none")}
            />
          </section>
        </div>

        {/* Footer */}
        <div className="border-t border-gray-100 px-5 pt-3 pb-5">
          <div className="flex items-center justify-between mb-3 text-xs font-poppins text-gray-400">
            <span>Subtotal productos</span>
            <span className="font-medium text-brand-dark">₡{itemsTotal.toLocaleString("en-US")}</span>
          </div>
          {shippingCost > 0 && (
            <div className="flex items-center justify-between mb-3 text-xs font-poppins text-gray-400">
              <span>Envío</span>
              <span className="font-medium text-brand-dark">₡{shippingCost.toLocaleString("en-US")}</span>
            </div>
          )}
          <div className="flex items-center justify-between mb-4">
            <span className="font-poppins font-semibold text-sm text-brand-dark">Total</span>
            <span className="font-poppins font-semibold text-base text-brand-primary">
              ₡{orderTotal.toLocaleString("en-US")}
            </span>
          </div>

          <div className="flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-poppins
                         text-gray-500 hover:border-gray-300 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={submitMutation.isPending}
              className="flex-1 py-2.5 rounded-xl bg-brand-primary text-white text-sm font-poppins
                         font-medium flex items-center justify-center gap-2
                         hover:bg-[#7a3e18] transition-colors disabled:opacity-60"
            >
              {submitMutation.isPending
                ? <Loader2 size={14} className="animate-spin" />
                : <ShoppingBag size={14} strokeWidth={2} />
              }
              Registrar compra
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
