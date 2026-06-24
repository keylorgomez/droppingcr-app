import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Loader2, Plus, Trash2, ShoppingCart, AlertTriangle } from "lucide-react";
import {
  getProductById, getCategories, updateProductInventory, deleteVariant, deleteProduct,
} from "../../services/productService";
import ImageUpload, { type ImageRow } from "../../components/ui/ImageUpload";
import MultiSelect from "../../components/ui/MultiSelect";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../components/ui/Toast";
import Header from "../../components/ui/Header";
import { cn } from "../../lib/utils";
import SaleModal              from "../../components/products/SaleModal";
import DeleteConfirmModal      from "../../components/products/DeleteConfirmModal";
import InstagramPublishModal   from "../../components/products/InstagramPublishModal";
import { buildInstagramCaption } from "../../services/instagramService";
import { QUERY_KEYS } from "../../constants/queryKeys";

// ── Shared styles ──────────────────────────────────────────────────────────

const inputCls =
  "w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-poppins text-brand-dark " +
  "placeholder:text-gray-300 outline-none focus:border-brand-primary " +
  "focus:ring-1 focus:ring-brand-primary/20 transition";

// ── Small layout helpers ───────────────────────────────────────────────────

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
  onChange: (value: boolean) => void; activeColor?: string;
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

// ── Variant row state ──────────────────────────────────────────────────────

interface VariantRowState {
  _key:  string;
  id?:   string;
  size:  string;
  stock: string;
}

function IgIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" />
    </svg>
  );
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

  useEffect(() => {
    if (!authLoading && (!user || user.role !== "admin")) navigate("/", { replace: true });
  }, [user, authLoading, navigate]);

  const { data: product, isLoading } = useQuery({
    queryKey: QUERY_KEYS.PRODUCT(id!),
    queryFn:  () => getProductById(id!),
    enabled:  Boolean(id),
  });

  const { data: allCategories = [] } = useQuery({
    queryKey: QUERY_KEYS.CATEGORIES,
    queryFn:  getCategories,
  });

  // Form state
  const [name,         setName]         = useState("");
  const [description,  setDescription]  = useState("");
  const [pricePurchase, setPricePurchase] = useState("");
  const [priceSale,    setPriceSale]    = useState("");
  const [discount,     setDiscount]     = useState("0");
  const [isActive,     setIsActive]     = useState(true);
  const [isNew,        setIsNew]        = useState(false);
  const [categoryIds,  setCategoryIds]  = useState<string[]>([]);
  const [variants,     setVariants]     = useState<VariantRowState[]>([]);
  const [images,            setImages]            = useState<ImageRow[]>([]);
  const [saleOpen,          setSaleOpen]          = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [igOpen,            setIgOpen]            = useState(false);

  useEffect(() => {
    if (!product) return;
    setName(product.name);
    setDescription(product.description ?? "");
    setPricePurchase(String(product.price_purchase));
    setPriceSale(String(product.price_sale));
    setDiscount(String(product.discount_percentage));
    setIsActive(product.is_active);
    setIsNew(product.is_new);
    setCategoryIds(product.categories.map((category) => category.id));
    setVariants(
      product.variants.map((productVariant) => ({
        _key: newKey(), id: productVariant.id, size: productVariant.size, stock: String(productVariant.stock),
      }))
    );
    setImages(
      [...product.images]
        .sort((imgA, imgB) => {
          if (imgA.is_primary !== imgB.is_primary) return imgA.is_primary ? -1 : 1;
          return imgA.display_order - imgB.display_order;
        })
        .map((img) => ({
          _key:       newKey(),
          image_url:  img.image_url,
          is_primary: img.is_primary,
        }))
    );
  }, [product]);

  const deleteVariantMutation = useMutation({
    mutationFn: deleteVariant,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.PRODUCT(id!) });
      showToast("Talla eliminada.", "success");
    },
    onError: (err: Error) => showToast(err.message, "error"),
  });

  function removeVariantRow(rowKey: string, dbId?: string) {
    if (dbId) {
      if (!window.confirm("¿Eliminar esta talla del producto?")) return;
      deleteVariantMutation.mutate(dbId);
    }
    setVariants((prev) => prev.filter((variantRow) => variantRow._key !== rowKey));
  }

  function updateVariantField(rowKey: string, field: "size" | "stock", value: string) {
    setVariants((prev) =>
      prev.map((variantRow) => (variantRow._key === rowKey ? { ...variantRow, [field]: value } : variantRow))
    );
  }

  const saveProductMutation = useMutation({
    mutationFn: (data: Parameters<typeof updateProductInventory>[1]) =>
      updateProductInventory(id!, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.PRODUCT(id!) });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.PRODUCTS });
      showToast("Producto actualizado.", "success");
      navigate(`/product/${product!.slug}`);
    },
    onError: (err: Error) => showToast(err.message, "error"),
  });

  const deleteProductMutation = useMutation({
    mutationFn: () => deleteProduct(id!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.PRODUCTS });
      showToast("Producto eliminado.", "success");
      navigate("/");
    },
    onError: (err: Error) => showToast(err.message, "error"),
  });

  function handleSave(event: React.FormEvent) {
    event.preventDefault();
    if (!name.trim())                                  { showToast("El nombre es requerido.", "error"); return; }
    if (!pricePurchase || Number(pricePurchase) <= 0)  { showToast("Ingresa un precio de compra válido.", "error"); return; }
    if (!priceSale     || Number(priceSale)     <= 0)  { showToast("Ingresa un precio de venta válido.", "error"); return; }
    if (images.length === 0)      { showToast("Agrega al menos una imagen.", "error"); return; }
    if (categoryIds.length === 0) { showToast("Selecciona al menos una categoría.", "error"); return; }
    saveProductMutation.mutate({
      name:                name.trim(),
      description:         description.trim() || null,
      price_purchase:      Number(pricePurchase),
      price_sale:          Number(priceSale),
      discount_percentage: Number(discount) || 0,
      is_active:           isActive,
      is_new:              isNew,
      category_ids:        categoryIds,
      variants: variants.map((variantRow) => ({
        id:    variantRow.id,
        size:  variantRow.size.trim(),
        stock: Number(variantRow.stock),
      })),
      images: images.map((img, index) => ({
        image_url:     img.image_url,
        is_primary:    img.is_primary,
        display_order: index,
      })),
    });
  }

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

  return (
    <>
      <Header />

      {saleOpen && (
        <SaleModal
          productId={product.id}
          priceSale={product.price_sale}
          pricePurchase={product.price_purchase}
          discountPercentage={product.discount_percentage ?? 0}
          variants={product.variants}
          onClose={() => setSaleOpen(false)}
          onSuccess={() => {
            setSaleOpen(false);
            queryClient.invalidateQueries({ queryKey: QUERY_KEYS.PRODUCT(id!) });
            queryClient.invalidateQueries({ queryKey: QUERY_KEYS.PRODUCTS });
          }}
        />
      )}

      {igOpen && product && (
        <InstagramPublishModal
          productName={product.name}
          imageUrls={product.images
            .sort((a, b) => {
              if (a.is_primary !== b.is_primary) return a.is_primary ? -1 : 1;
              return a.display_order - b.display_order;
            })
            .map((img) => img.image_url)}
          caption={buildInstagramCaption(product)}
          onClose={() => setIgOpen(false)}
        />
      )}

      {deleteConfirmOpen && (
        <DeleteConfirmModal
          productName={product.name}
          isPending={deleteProductMutation.isPending}
          onConfirm={() => deleteProductMutation.mutate()}
          onCancel={() => setDeleteConfirmOpen(false)}
        />
      )}

      <main className="max-w-2xl mx-auto px-4 py-8 pb-16">

        <button
          onClick={() => navigate("/")}
          className="flex items-center gap-1.5 text-xs font-poppins text-gray-400
                     hover:text-brand-primary transition-colors mb-6 -ml-0.5"
        >
          <ArrowLeft size={15} strokeWidth={1.8} />
          Volver al catálogo
        </button>

        <div className="flex items-start justify-between gap-4 mb-8">
          <div>
            <h1 className="font-poppins font-semibold text-xl text-brand-dark leading-tight">
              {product.name}
            </h1>
            <p className="font-poppins text-xs text-gray-400 mt-0.5">
              Edición de inventario y datos del producto
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setIgOpen(true)}
              title="Publicar en Instagram"
              className="h-10 w-10 flex items-center justify-center rounded-xl
                         bg-gradient-to-br from-[#833ab4] via-[#fd1d1d] to-[#fcb045]
                         text-white hover:opacity-90 transition-opacity"
            >
              <IgIcon />
            </button>
            <button
              type="button"
              onClick={() => setSaleOpen(true)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl
                         bg-brand-dark text-white text-sm font-poppins font-medium
                         hover:bg-black transition-colors"
            >
              <ShoppingCart size={15} strokeWidth={1.8} />
              Registrar Venta
            </button>
          </div>
        </div>

        <form onSubmit={handleSave} className="flex flex-col gap-5">

          {/* Product information */}
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
                  Precio costo (₡)
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
                  Precio venta (₡)
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

            {/* Profit margin indicator */}
            {(() => {
              const purchaseCost  = Number(pricePurchase);
              const salePrice     = Number(priceSale);
              const discountPct   = Number(discount) || 0;
              if (!purchaseCost || !salePrice) return null;

              const effectiveSalePrice = discountPct > 0 ? Math.round(salePrice * (1 - discountPct / 100)) : salePrice;
              const profit             = salePrice - purchaseCost;
              const profitPct          = Math.round((profit / purchaseCost) * 100);
              const effectiveProfit    = effectiveSalePrice - purchaseCost;
              const effectivePct       = Math.round((effectiveProfit / purchaseCost) * 100);
              const hasDiscount        = discountPct > 0;

              const marginBand = (pct: number) =>
                pct <= 0  ? { label: "Pérdida",   cls: "bg-red-50   border-red-200   text-red-600"   } :
                pct <= 15 ? { label: "Bajo",      cls: "bg-amber-50 border-amber-200 text-amber-700" } :
                pct <= 40 ? { label: "Bueno",     cls: "bg-green-50 border-green-200 text-green-700" } :
                            { label: "Excelente", cls: "bg-green-50 border-green-200 text-green-700" };

              const mainBand      = marginBand(profitPct);
              const effectiveBand = marginBand(effectivePct);

              return (
                <div className={`rounded-xl border px-4 py-3 flex flex-col gap-2 transition-colors ${mainBand.cls}`}>
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-poppins font-semibold uppercase tracking-wider opacity-70">
                      Margen de ganancia
                    </span>
                    <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${mainBand.cls}`}>
                      {mainBand.label}
                    </span>
                  </div>
                  <div className="flex items-baseline gap-2">
                    <span className="font-poppins font-bold text-xl leading-none">
                      {profitPct > 0 ? "+" : ""}{profitPct}%
                    </span>
                    <span className="font-poppins text-sm font-medium">
                      ₡{profit.toLocaleString("en-US")} por unidad
                    </span>
                  </div>
                  {hasDiscount && (
                    <div className={`rounded-lg border px-3 py-2 flex items-center justify-between ${effectiveBand.cls}`}>
                      <span className="text-[11px] font-poppins">
                        Con {discountPct}% descuento aplicado:
                      </span>
                      <span className="text-[11px] font-poppins font-semibold">
                        {effectivePct > 0 ? "+" : ""}{effectivePct}% · ₡{effectiveProfit.toLocaleString("en-US")}
                      </span>
                    </div>
                  )}
                </div>
              );
            })()}

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

          {/* Categories */}
          <SectionCard title="Categorías">
            <MultiSelect
              options={allCategories}
              selected={categoryIds}
              onChange={setCategoryIds}
              placeholder="Selecciona una o más categorías…"
            />
          </SectionCard>

          {/* Sizes and stock */}
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

          {/* Images */}
          <SectionCard title="Imágenes">
            <ImageUpload
              images={images}
              onChange={setImages}
            />
          </SectionCard>

          {/* Save / cancel */}
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
              disabled={saveProductMutation.isPending}
              className="flex-1 py-3 rounded-xl bg-brand-primary text-white text-sm font-poppins
                         font-medium flex items-center justify-center gap-2
                         hover:bg-[#7a3e18] transition-colors disabled:opacity-60"
            >
              {saveProductMutation.isPending && <Loader2 size={15} className="animate-spin" />}
              Guardar cambios
            </button>
          </div>

          {/* Danger zone */}
          <div className="rounded-2xl border border-red-100 p-5 flex items-center justify-between gap-4">
            <div>
              <p className="font-poppins text-sm font-medium text-red-500">Eliminar producto</p>
              <p className="font-poppins text-[11px] text-gray-400 mt-0.5">
                Acción permanente. No se puede deshacer.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setDeleteConfirmOpen(true)}
              disabled={deleteProductMutation.isPending}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-red-200
                         text-red-500 text-sm font-poppins font-medium
                         hover:bg-red-50 transition-colors disabled:opacity-60 shrink-0"
            >
              {deleteProductMutation.isPending
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
