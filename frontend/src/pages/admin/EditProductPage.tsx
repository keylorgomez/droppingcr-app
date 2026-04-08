import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft, Loader2, Plus, Trash2, ShoppingCart, Check, X, AlertTriangle, PackageX,
} from "lucide-react";
import {
  getProductById, getCategories, updateProductInventory, deleteVariant, deleteProduct,
  type ProductVariant,
} from "../../services/productService";
import ImageUpload, { type ImageRow } from "../../components/ui/ImageUpload";
import MultiSelect from "../../components/ui/MultiSelect";
import { recordManualSale } from "../../services/salesService";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../components/ui/Toast";
import Header from "../../components/ui/Header";
import { cn } from "../../lib/utils";

// ── Shared styles ──────────────────────────────────────────────────────────

const inputCls =
  "w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-poppins text-brand-dark " +
  "placeholder:text-gray-300 outline-none focus:border-brand-primary " +
  "focus:ring-1 focus:ring-brand-primary/20 transition";

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-6 flex flex-col gap-4">
      <h2 className="font-poppins font-semibold text-sm text-brand-dark uppercase tracking-wider">
        {title}
      </h2>
      {children}
    </div>
  );
}

function Toggle({
  label, description, checked, onChange, activeColor = "bg-brand-primary",
}: {
  label: string; description: string; checked: boolean;
  onChange: (v: boolean) => void; activeColor?: string;
}) {
  return (
    <div className="flex items-center justify-between rounded-xl border border-gray-200 px-4 py-3">
      <div>
        <p className="text-sm font-poppins text-brand-dark">{label}</p>
        <p className="text-[11px] font-poppins text-gray-400">{description}</p>
      </div>
      <button
        type="button"
        onClick={() => onChange(!checked)}
        className={cn(
          "w-11 h-6 rounded-full transition-colors relative flex items-center shrink-0",
          checked ? activeColor : "bg-gray-200"
        )}
      >
        <span className={cn(
          "absolute w-5 h-5 bg-white rounded-full shadow transition-transform",
          checked ? "translate-x-5" : "translate-x-0.5"
        )} />
      </button>
    </div>
  );
}

// ── Delete Confirm Modal ───────────────────────────────────────────────────

function DeleteConfirmModal({
  productName,
  isPending,
  onConfirm,
  onCancel,
}: {
  productName: string;
  isPending: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <>
      <div
        className="fixed inset-0 bg-black/40 z-40 backdrop-blur-sm"
        onClick={onCancel}
      />
      <div className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50
                      w-full max-w-sm bg-white rounded-2xl shadow-xl overflow-hidden">

        {/* Red top band */}
        <div className="bg-red-50 px-6 pt-7 pb-5 flex flex-col items-center text-center gap-3">
          <div className="w-14 h-14 rounded-full bg-red-100 flex items-center justify-center">
            <PackageX size={26} className="text-red-500" strokeWidth={1.6} />
          </div>
          <div>
            <p className="font-poppins font-semibold text-base text-brand-dark">
              ¿Eliminar producto?
            </p>
            <p className="font-poppins text-sm text-gray-500 mt-1 leading-snug">
              Vas a eliminar{" "}
              <span className="font-semibold text-brand-dark">"{productName}"</span>{" "}
              permanentemente. Esta acción no se puede deshacer.
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3 px-6 py-5">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-poppins
                       text-gray-500 hover:border-gray-300 hover:text-brand-dark transition-colors"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isPending}
            className="flex-1 py-2.5 rounded-xl bg-red-500 text-white text-sm font-poppins
                       font-medium flex items-center justify-center gap-2
                       hover:bg-red-600 transition-colors disabled:opacity-60"
          >
            {isPending
              ? <Loader2 size={14} className="animate-spin" />
              : <Trash2 size={14} strokeWidth={2} />
            }
            Sí, eliminar
          </button>
        </div>
      </div>
    </>
  );
}

// ── Sale Modal ─────────────────────────────────────────────────────────────

interface SaleModalProps {
  productId: string;
  priceSale: number;
  variants:  ProductVariant[];
  onClose:   () => void;
  onSuccess: () => void;
}

function SaleModal({ productId, priceSale, variants, onClose, onSuccess }: SaleModalProps) {
  const { showToast }     = useToast();
  const availableVariants = variants.filter((v) => v.stock > 0);

  const [variantId,      setVariantId]      = useState(availableVariants[0]?.id ?? "");
  const [quantity,       setQuantity]       = useState(1);
  const [priceSold,      setPriceSold]      = useState(String(priceSale));
  const [guestName,      setGuestName]      = useState("");
  const [guestPhone,     setGuestPhone]     = useState("");
  const [isPagos,        setIsPagos]        = useState(false);
  const [initialPayment, setInitialPayment] = useState("");
  const [note,           setNote]           = useState("");
  const [errors,         setErrors]         = useState<Record<string, string>>({});

  const selectedVariant = availableVariants.find((v) => v.id === variantId);
  const priceNum        = Number(priceSold) || 0;

  const mutation = useMutation({
    mutationFn: recordManualSale,
    onSuccess: () => {
      showToast("Venta registrada correctamente.", "success");
      onSuccess();
    },
    onError: (err: Error) => showToast(err.message, "error"),
  });

  function validate(): boolean {
    const e: Record<string, string> = {};
    if (!variantId)                                       e.variant        = "Selecciona una talla.";
    if (quantity < 1)                                     e.quantity       = "Mínimo 1 unidad.";
    if (selectedVariant && quantity > selectedVariant.stock)
                                                          e.quantity       = `Máximo ${selectedVariant.stock} en stock.`;
    if (!priceSold || priceNum <= 0)                      e.priceSold      = "Ingresa un precio válido.";
    if (isPagos && initialPayment) {
      const abono = Number(initialPayment);
      if (abono <= 0)        e.initialPayment = "El abono debe ser mayor a 0.";
      if (abono > priceNum)  e.initialPayment = "El abono no puede superar el precio.";
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  function handleConfirm() {
    if (!validate()) return;
    const rawPhone = guestPhone.replace(/\D/g, "");
    mutation.mutate({
      product_id:      productId,
      variant_id:      variantId,
      quantity,
      sale_price:      priceNum,
      note:            note.trim() || null,
      guest_name:      guestName.trim() || null,
      guest_phone:     rawPhone ? `+506${rawPhone}` : null,
      status:          isPagos ? "pending" : "completed",
      initial_payment: isPagos ? (Number(initialPayment) || 0) : priceNum,
    });
  }

  return (
    <>
      <div className="fixed inset-0 bg-black/40 z-40 backdrop-blur-sm" onClick={onClose} />

      <div className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50
                      w-full max-w-sm bg-white rounded-2xl shadow-xl flex flex-col
                      max-h-[90vh] overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-gray-100">
          <div className="flex items-center gap-2.5">
            <ShoppingCart size={17} className="text-brand-accent" strokeWidth={1.8} />
            <h3 className="font-poppins font-semibold text-base text-brand-dark">Registrar Venta</h3>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-brand-primary transition-colors">
            <X size={18} />
          </button>
        </div>

        {availableVariants.length === 0 ? (
          <p className="text-sm font-poppins text-gray-400 text-center py-8 px-6">
            No hay tallas con stock disponible.
          </p>
        ) : (
          <div className="overflow-y-auto flex flex-col gap-4 px-6 py-5">

            {/* Variant + Quantity */}
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-gray-500 font-poppins uppercase tracking-wider">Talla</label>
              <select
                value={variantId}
                onChange={(e) => { setVariantId(e.target.value); setQuantity(1); }}
                className={inputCls}
              >
                {availableVariants.map((v) => (
                  <option key={v.id} value={v.id}>{v.size} — {v.stock} en stock</option>
                ))}
              </select>
              {errors.variant && <span className="text-[11px] text-red-500 font-poppins">{errors.variant}</span>}
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-gray-500 font-poppins uppercase tracking-wider">Cantidad</label>
              <div className="flex items-center gap-2">
                <button type="button" onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                        className="w-10 h-10 rounded-xl border border-gray-200 flex items-center justify-center
                                   text-gray-500 hover:border-brand-primary hover:text-brand-primary transition-colors shrink-0">−</button>
                <input type="number" min={1} max={selectedVariant?.stock ?? 1} value={quantity}
                       onChange={(e) => setQuantity(Math.max(1, Number(e.target.value)))}
                       className={cn(inputCls, "text-center")} />
                <button type="button" onClick={() => setQuantity((q) => Math.min(selectedVariant?.stock ?? 1, q + 1))}
                        className="w-10 h-10 rounded-xl border border-gray-200 flex items-center justify-center
                                   text-gray-500 hover:border-brand-primary hover:text-brand-primary transition-colors shrink-0">+</button>
              </div>
              {errors.quantity && <span className="text-[11px] text-red-500 font-poppins">{errors.quantity}</span>}
            </div>

            {/* Price */}
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-gray-500 font-poppins uppercase tracking-wider">Precio de venta (₡)</label>
              <input type="number" min={0} step="0.01" value={priceSold}
                     onChange={(e) => setPriceSold(e.target.value)} className={inputCls} />
              {errors.priceSold && <span className="text-[11px] text-red-500 font-poppins">{errors.priceSold}</span>}
              <span className="text-[11px] text-gray-400 font-poppins">
                Oficial: ₡{priceSale.toLocaleString("es-CR")}. Modifica si hubo precio especial.
              </span>
            </div>

            {/* Divider: datos del cliente */}
            <div className="border-t border-gray-100 pt-1">
              <p className="text-[10px] font-poppins text-gray-400 uppercase tracking-widest mb-3">
                Datos del cliente (opcional)
              </p>
              <div className="flex flex-col gap-3">
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-medium text-gray-500 font-poppins uppercase tracking-wider">Nombre</label>
                  <input type="text" value={guestName} onChange={(e) => setGuestName(e.target.value)}
                         placeholder="Ej: Juan Pérez" className={inputCls} />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-medium text-gray-500 font-poppins uppercase tracking-wider">WhatsApp</label>
                  <div className="flex items-center rounded-xl border border-gray-200 overflow-hidden
                                  focus-within:border-brand-primary focus-within:ring-1 focus-within:ring-brand-primary/20 transition">
                    <span className="px-3 py-2.5 text-sm font-poppins text-gray-400 bg-gray-50
                                     border-r border-gray-200 shrink-0 select-none">+506</span>
                    <input type="tel" value={guestPhone}
                           onChange={(e) => setGuestPhone(e.target.value.replace(/\D/g, "").slice(0, 8))}
                           placeholder="88887777" maxLength={8}
                           className="flex-1 px-3 py-2.5 text-sm font-poppins text-brand-dark outline-none bg-white" />
                  </div>
                </div>
              </div>
            </div>

            {/* Venta a Pagos */}
            <div className="border-t border-gray-100 pt-1">
              <label className="flex items-center gap-3 cursor-pointer select-none">
                <div
                  onClick={() => setIsPagos((v) => !v)}
                  className={cn(
                    "w-10 h-5 rounded-full transition-colors relative flex items-center shrink-0 cursor-pointer",
                    isPagos ? "bg-brand-primary" : "bg-gray-200"
                  )}
                >
                  <span className={cn(
                    "absolute w-4 h-4 bg-white rounded-full shadow transition-transform",
                    isPagos ? "translate-x-5" : "translate-x-0.5"
                  )} />
                </div>
                <div>
                  <p className="text-sm font-poppins text-brand-dark">Venta a Pagos</p>
                  <p className="text-[11px] font-poppins text-gray-400">El cliente abonará en cuotas</p>
                </div>
              </label>

              {isPagos && (
                <div className="flex flex-col gap-1 mt-3">
                  <label className="text-xs font-medium text-gray-500 font-poppins uppercase tracking-wider">
                    Abono inicial (₡)
                  </label>
                  <input type="number" min={1} max={priceNum} step="0.01"
                         value={initialPayment} onChange={(e) => setInitialPayment(e.target.value)}
                         placeholder="0.00" className={inputCls} />
                  {errors.initialPayment && (
                    <span className="text-[11px] text-red-500 font-poppins">{errors.initialPayment}</span>
                  )}
                  {initialPayment && Number(initialPayment) > 0 && (
                    <span className="text-[11px] text-gray-400 font-poppins">
                      Restará: ₡{Math.max(0, priceNum - Number(initialPayment)).toLocaleString("es-CR")}
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* Note */}
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-gray-500 font-poppins uppercase tracking-wider">Nota (opcional)</label>
              <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2}
                        placeholder="Ej: cliente habitual, precio acordado…"
                        className={cn(inputCls, "resize-none")} />
            </div>

            {/* Actions */}
            <div className="flex gap-3 pb-1">
              <button type="button" onClick={onClose}
                      className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-poppins
                                 text-gray-500 hover:border-gray-300 transition-colors">
                Cancelar
              </button>
              <button type="button" onClick={handleConfirm} disabled={mutation.isPending}
                      className="flex-1 py-2.5 rounded-xl bg-brand-primary text-white text-sm font-poppins
                                 font-medium flex items-center justify-center gap-2
                                 hover:bg-[#7a3e18] transition-colors disabled:opacity-60">
                {mutation.isPending
                  ? <Loader2 size={14} className="animate-spin" />
                  : <Check size={14} strokeWidth={2.5} />
                }
                Confirmar venta
              </button>
            </div>

          </div>
        )}
      </div>
    </>
  );
}

// ── Variant row ────────────────────────────────────────────────────────────

interface VariantRowState {
  _key:  string;
  id?:   string;
  size:  string;
  stock: string;
}

let keyCounter = 0;
const newKey = () => String(++keyCounter);

// ── Page ───────────────────────────────────────────────────────────────────

export default function EditProductPage() {
  const { id }         = useParams<{ id: string }>();
  const navigate       = useNavigate();
  const { showToast }  = useToast();
  const { user, isLoading: authLoading } = useAuth();
  const queryClient    = useQueryClient();

  // Admin guard
  useEffect(() => {
    if (!authLoading && (!user || user.role !== "admin")) navigate("/", { replace: true });
  }, [user, authLoading, navigate]);

  // Data
  const { data: product, isLoading } = useQuery({
    queryKey: ["product", id],
    queryFn:  () => getProductById(id!),
    enabled:  Boolean(id),
  });

  const { data: allCategories = [] } = useQuery({
    queryKey: ["categories"],
    queryFn:  getCategories,
  });

  // Form state
  const [name,          setName]          = useState("");
  const [description,   setDescription]   = useState("");
  const [pricePurchase, setPricePurchase] = useState("");
  const [priceSale,     setPriceSale]     = useState("");
  const [discount,      setDiscount]      = useState("0");
  const [isActive,      setIsActive]      = useState(true);
  const [isNew,         setIsNew]         = useState(false);
  const [categoryIds,   setCategoryIds]   = useState<string[]>([]);
  const [variants,      setVariants]      = useState<VariantRowState[]>([]);
  const [images,             setImages]             = useState<ImageRow[]>([]);
  const [saleOpen,           setSaleOpen]           = useState(false);
  const [deleteConfirmOpen,  setDeleteConfirmOpen]  = useState(false);

  // Populate form
  useEffect(() => {
    if (!product) return;
    setName(product.name);
    setDescription(product.description ?? "");
    setPricePurchase(String(product.price_purchase));
    setPriceSale(String(product.price_sale));
    setDiscount(String(product.discount_percentage));
    setIsActive(product.is_active);
    setIsNew(product.is_new);
    setCategoryIds(product.categories.map((c) => c.id));
    setVariants(
      product.variants.map((v) => ({
        _key: newKey(), id: v.id, size: v.size, stock: String(v.stock),
      }))
    );
    setImages(
      [...product.images]
        .sort((a, b) => {
          if (a.is_primary !== b.is_primary) return a.is_primary ? -1 : 1;
          return a.display_order - b.display_order;
        })
        .map((img) => ({
          _key:       newKey(),
          image_url:  img.image_url,
          is_primary: img.is_primary,
        }))
    );
  }, [product]);

  // Delete variant
  const deleteMut = useMutation({
    mutationFn: deleteVariant,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["product"] });
      showToast("Talla eliminada.", "success");
    },
    onError: (err: Error) => showToast(err.message, "error"),
  });

  function removeVariantRow(key: string, dbId?: string) {
    if (dbId) {
      if (!window.confirm("¿Eliminar esta talla del producto?")) return;
      deleteMut.mutate(dbId);
    }
    setVariants((prev) => prev.filter((v) => v._key !== key));
  }

  function updateVariantField(
    key: string,
    field: "size" | "stock",
    value: string
  ) {
    setVariants((prev) =>
      prev.map((v) => (v._key === key ? { ...v, [field]: value } : v))
    );
  }

  // Save
  const saveMut = useMutation({
    mutationFn: (data: Parameters<typeof updateProductInventory>[1]) =>
      updateProductInventory(id!, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["product"] });
      queryClient.invalidateQueries({ queryKey: ["products"] });
      showToast("Producto actualizado.", "success");
      navigate(`/product/${product!.slug}`);
    },
    onError: (err: Error) => showToast(err.message, "error"),
  });

  // Delete
  const deleteMutProduct = useMutation({
    mutationFn: () => deleteProduct(id!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      showToast("Producto eliminado.", "success");
      navigate("/");
    },
    onError: (err: Error) => showToast(err.message, "error"),
  });

  function handleDelete() {
    setDeleteConfirmOpen(true);
  }

  function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim())                                  { showToast("El nombre es requerido.", "error"); return; }
    if (!pricePurchase || Number(pricePurchase) <= 0)  { showToast("Ingresa un precio de compra válido.", "error"); return; }
    if (!priceSale     || Number(priceSale)     <= 0)  { showToast("Ingresa un precio de venta válido.", "error"); return; }
    if (images.length === 0)        { showToast("Agrega al menos una imagen.", "error"); return; }
    if (categoryIds.length === 0)   { showToast("Selecciona al menos una categoría.", "error"); return; }
    saveMut.mutate({
      name:                name.trim(),
      description:         description.trim() || null,
      price_purchase:      Number(pricePurchase),
      price_sale:          Number(priceSale),
      discount_percentage: Number(discount) || 0,
      is_active:           isActive,
      is_new:              isNew,
      category_ids:        categoryIds,
      variants: variants.map((v) => ({
        id:    v.id,
        size:  v.size.trim(),
        stock: Number(v.stock),
      })),
      images: images.map((img, i) => ({
        image_url:     img.image_url,
        is_primary:    img.is_primary,
        display_order: i,
      })),
    });
  }

  // Skeleton
  if (isLoading || authLoading || !product) {
    return (
      <>
        <Header />
        <main className="max-w-2xl mx-auto px-4 py-10 animate-pulse space-y-4">
          <div className="h-5 bg-gray-100 rounded-lg w-1/4" />
          <div className="h-32 bg-gray-100 rounded-2xl" />
          <div className="h-48 bg-gray-100 rounded-2xl" />
          <div className="h-32 bg-gray-100 rounded-2xl" />
        </main>
      </>
    );
  }

  // Live variant data for the sale modal (use current product from cache)
  const liveVariants = product.variants;

  return (
    <>
      <Header />

      {saleOpen && (
        <SaleModal
          productId={product.id}
          priceSale={product.price_sale}
          variants={liveVariants}
          onClose={() => setSaleOpen(false)}
          onSuccess={() => {
            setSaleOpen(false);
            queryClient.invalidateQueries({ queryKey: ["product"] });
            queryClient.invalidateQueries({ queryKey: ["products"] });
          }}
        />
      )}

      {deleteConfirmOpen && (
        <DeleteConfirmModal
          productName={product!.name}
          isPending={deleteMutProduct.isPending}
          onConfirm={() => deleteMutProduct.mutate()}
          onCancel={() => setDeleteConfirmOpen(false)}
        />
      )}

      <main className="max-w-2xl mx-auto px-4 py-8 pb-16">

        {/* Back */}
        <button
          onClick={() => navigate("/")}
          className="flex items-center gap-1.5 text-xs font-poppins text-gray-400
                     hover:text-brand-primary transition-colors mb-6 -ml-0.5"
        >
          <ArrowLeft size={15} strokeWidth={1.8} />
          Volver al catálogo
        </button>

        {/* Title + sale button */}
        <div className="flex items-start justify-between gap-4 mb-8">
          <div>
            <h1 className="font-poppins font-semibold text-xl text-brand-dark leading-tight">
              {product.name}
            </h1>
            <p className="font-poppins text-xs text-gray-400 mt-0.5">
              Edición de inventario y datos del producto
            </p>
          </div>
          <button
            type="button"
            onClick={() => setSaleOpen(true)}
            className="shrink-0 flex items-center gap-2 px-4 py-2.5 rounded-xl
                       bg-brand-dark text-white text-sm font-poppins font-medium
                       hover:bg-black transition-colors"
          >
            <ShoppingCart size={15} strokeWidth={1.8} />
            Registrar Venta
          </button>
        </div>

        <form onSubmit={handleSave} className="flex flex-col gap-5">

          {/* ── Información ────────────────────────────────────────── */}
          <SectionCard title="Información del producto">

            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-gray-500 font-poppins uppercase tracking-wider">
                Nombre
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className={inputCls}
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-gray-500 font-poppins uppercase tracking-wider">
                Descripción
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                placeholder="Descripción del producto…"
                className={cn(inputCls, "resize-none")}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-gray-500 font-poppins uppercase tracking-wider">
                  Precio de compra (₡)
                </label>
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  value={pricePurchase}
                  onChange={(e) => setPricePurchase(e.target.value)}
                  placeholder="0.00"
                  className={inputCls}
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-gray-500 font-poppins uppercase tracking-wider">
                  Precio de venta (₡)
                </label>
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  value={priceSale}
                  onChange={(e) => setPriceSale(e.target.value)}
                  placeholder="0.00"
                  className={inputCls}
                />
              </div>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-gray-500 font-poppins uppercase tracking-wider">
                Descuento (%)
              </label>
              <input
                type="number"
                min={0}
                max={100}
                value={discount}
                onChange={(e) => setDiscount(e.target.value)}
                className={inputCls}
              />
            </div>

            <Toggle
              label="Visible en catálogo"
              description="Activa o desactiva la visibilidad pública"
              checked={isActive}
              onChange={setIsActive}
            />

            <Toggle
              label="Marcar como Nuevo"
              description='Muestra el badge verde "NUEVO" en el card'
              checked={isNew}
              onChange={setIsNew}
              activeColor="bg-emerald-500"
            />
          </SectionCard>

          {/* ── Categorías ─────────────────────────────────────────── */}
          <SectionCard title="Categorías">
            <MultiSelect
              options={allCategories}
              selected={categoryIds}
              onChange={setCategoryIds}
              placeholder="Selecciona una o más categorías…"
            />
          </SectionCard>

          {/* ── Tallas y stock ─────────────────────────────────────── */}
          <SectionCard title="Tallas y stock">

            {variants.length > 0 && (
              <div className="flex flex-col gap-2">
                <div className="grid grid-cols-[1fr_120px_36px] gap-2 px-1">
                  <span className="text-[10px] font-poppins text-gray-400 uppercase tracking-wider">Talla</span>
                  <span className="text-[10px] font-poppins text-gray-400 uppercase tracking-wider">Stock</span>
                  <span />
                </div>

                {variants.map((row) => (
                  <div
                    key={row._key}
                    className="grid grid-cols-[1fr_120px_36px] gap-2 items-center"
                  >
                    <input
                      type="text"
                      value={row.size}
                      onChange={(e) => updateVariantField(row._key, "size", e.target.value)}
                      placeholder="Talla"
                      className={inputCls}
                    />
                    <div className="relative">
                      <input
                        type="number"
                        min={0}
                        value={row.stock}
                        onChange={(e) => updateVariantField(row._key, "stock", e.target.value)}
                        className={cn(
                          inputCls,
                          Number(row.stock) === 0 && "border-red-200 text-red-400"
                        )}
                      />
                      {Number(row.stock) === 0 && (
                        <span className="absolute -top-1.5 -right-1.5 w-3 h-3 bg-red-400
                                         rounded-full" title="Sin stock" />
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => removeVariantRow(row._key, row.id)}
                      className="h-10 w-9 flex items-center justify-center rounded-xl
                                 text-gray-300 hover:text-red-400 hover:bg-red-50 transition-colors"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {variants.length === 0 && (
              <p className="text-xs text-gray-400 font-poppins text-center py-3
                            border border-dashed border-gray-200 rounded-xl">
                No hay tallas registradas
              </p>
            )}

            <button
              type="button"
              onClick={() => setVariants((prev) => [...prev, { _key: newKey(), size: "", stock: "0" }])}
              className="flex items-center gap-2 text-xs font-poppins text-brand-primary
                         hover:text-[#7a3e18] transition-colors self-start"
            >
              <Plus size={14} /> Agregar talla
            </button>
          </SectionCard>

          {/* ── Imágenes ───────────────────────────────────────────── */}
          <SectionCard title="Imágenes">
            <ImageUpload
              images={images}
              onChange={setImages}
            />
          </SectionCard>

          {/* ── Actions ────────────────────────────────────────────── */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={() => navigate("/")}
              className="flex-1 py-3 rounded-xl border border-gray-200 text-sm font-poppins
                         text-gray-500 hover:border-gray-300 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saveMut.isPending}
              className="flex-1 py-3 rounded-xl bg-brand-primary text-white text-sm font-poppins
                         font-medium flex items-center justify-center gap-2
                         hover:bg-[#7a3e18] transition-colors disabled:opacity-60"
            >
              {saveMut.isPending && <Loader2 size={15} className="animate-spin" />}
              Guardar cambios
            </button>
          </div>

          {/* ── Danger zone ────────────────────────────────────────── */}
          <div className="rounded-2xl border border-red-100 p-5 flex items-center justify-between gap-4">
            <div>
              <p className="font-poppins text-sm font-medium text-red-500">Eliminar producto</p>
              <p className="font-poppins text-[11px] text-gray-400 mt-0.5">
                Acción permanente. No se puede deshacer.
              </p>
            </div>
            <button
              type="button"
              onClick={handleDelete}
              disabled={deleteMutProduct.isPending}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-red-200
                         text-red-500 text-sm font-poppins font-medium
                         hover:bg-red-50 transition-colors disabled:opacity-60 shrink-0"
            >
              {deleteMutProduct.isPending
                ? <Loader2 size={14} className="animate-spin" />
                : <AlertTriangle size={14} strokeWidth={2} />
              }
              Eliminar
            </button>
          </div>

        </form>
      </main>
    </>
  );
}
