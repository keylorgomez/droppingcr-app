import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft, Plus, Trash2, Loader2, Tag,
} from "lucide-react";
import ImageUpload, { type ImageRow } from "../../components/ui/ImageUpload";
import MultiSelect from "../../components/ui/MultiSelect";
import {
  getCategories, getProductById,
  createProduct, updateProduct,
  type ProductInput,
} from "../../services/productService";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../components/ui/Toast";
import Header from "../../components/ui/Header";
import { cn } from "../../lib/utils";

// ── Slug helper ────────────────────────────────────────────────────────────

function slugify(str: string): string {
  return str
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-");
}

// ── Form row types ─────────────────────────────────────────────────────────

interface VariantRow { _key: string; size: string; stock: string }

let keyCounter = 0;
const newKey = () => String(++keyCounter);

// ── Section card ───────────────────────────────────────────────────────────

function SectionCard({
  title, children, id, hasError = false,
}: {
  title: string; children: React.ReactNode; id?: string; hasError?: boolean;
}) {
  return (
    <div
      id={id}
      className={cn(
        "bg-white rounded-2xl border p-6 flex flex-col gap-4 scroll-mt-24 transition-colors",
        hasError ? "border-red-300" : "border-gray-100"
      )}
    >
      <h2 className={cn(
        "font-poppins font-semibold text-sm uppercase tracking-wider",
        hasError ? "text-red-500" : "text-brand-dark"
      )}>
        {title}
      </h2>
      {children}
    </div>
  );
}

// ── Field ──────────────────────────────────────────────────────────────────

function Field({
  id, label, error, children,
}: {
  id?: string; label: string; error?: string; children: React.ReactNode;
}) {
  return (
    <div id={id} className="flex flex-col gap-1 scroll-mt-24">
      <label className={cn(
        "text-xs font-medium font-poppins uppercase tracking-wider",
        error ? "text-red-500" : "text-gray-500"
      )}>
        {label}
      </label>
      {children}
      {error && (
        <span className="text-[11px] text-red-500 font-poppins flex items-center gap-1">
          {error}
        </span>
      )}
    </div>
  );
}

function inputCls(hasError = false) {
  return cn(
    "w-full rounded-xl border px-4 py-2.5 text-sm font-poppins text-brand-dark",
    "placeholder:text-gray-300 outline-none transition",
    hasError
      ? "border-red-400 bg-red-50/40 focus:border-red-400 focus:ring-1 focus:ring-red-300/30"
      : "border-gray-200 focus:border-brand-primary focus:ring-1 focus:ring-brand-primary/20"
  );
}

// ── Variants section ───────────────────────────────────────────────────────

const COMMON_SIZES = ["XS", "S", "M", "L", "XL", "XXL", "Talla Única"];

function VariantsSection({
  rows, onChange, error,
}: {
  rows: VariantRow[];
  onChange: (rows: VariantRow[]) => void;
  error?: string;
}) {
  function addRow(size = "") {
    onChange([...rows, { _key: newKey(), size, stock: "1" }]);
  }

  function updateRow(key: string, field: keyof Omit<VariantRow, "_key">, value: string) {
    onChange(rows.map((r) => (r._key === key ? { ...r, [field]: value } : r)));
  }

  function removeRow(key: string) {
    onChange(rows.filter((r) => r._key !== key));
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Quick-add size chips */}
      <div className="flex flex-wrap gap-1.5">
        {COMMON_SIZES.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => addRow(s)}
            className="px-3 py-1 rounded-full text-xs font-poppins border border-gray-200
                       text-gray-500 hover:border-brand-primary hover:text-brand-primary
                       transition-colors"
          >
            + {s}
          </button>
        ))}
      </div>

      {/* Rows */}
      {rows.length > 0 && (
        <div className="flex flex-col gap-2">
          <div className="grid grid-cols-[1fr_100px_36px] gap-2 px-1">
            <span className="text-[10px] font-poppins text-gray-400 uppercase tracking-wider">Talla</span>
            <span className="text-[10px] font-poppins text-gray-400 uppercase tracking-wider">Stock</span>
            <span />
          </div>
          {rows.map((row) => (
            <div key={row._key} className="grid grid-cols-[1fr_100px_36px] gap-2 items-center">
              <input
                type="text"
                value={row.size}
                onChange={(e) => updateRow(row._key, "size", e.target.value)}
                placeholder="Ej: M, XL, Talla Única"
                className={inputCls()}
              />
              <input
                type="number"
                min={0}
                value={row.stock}
                onChange={(e) => updateRow(row._key, "stock", e.target.value)}
                className={inputCls()}
              />
              <button
                type="button"
                onClick={() => removeRow(row._key)}
                className="h-10 w-9 flex items-center justify-center rounded-xl text-gray-300
                           hover:text-red-400 hover:bg-red-50 transition-colors"
              >
                <Trash2 size={15} />
              </button>
            </div>
          ))}
        </div>
      )}

      {rows.length === 0 && (
        <p className="text-xs text-gray-400 font-poppins text-center py-3 border border-dashed
                      border-gray-200 rounded-xl">
          Agrega al menos una talla
        </p>
      )}

      <button
        type="button"
        onClick={() => addRow()}
        className="flex items-center gap-2 text-xs font-poppins text-brand-primary
                   hover:text-[#7a3e18] transition-colors self-start"
      >
        <Plus size={14} /> Agregar talla personalizada
      </button>

      {error && <span className="text-[11px] text-red-500 font-poppins">{error}</span>}
    </div>
  );
}


// ── Page ───────────────────────────────────────────────────────────────────

export default function ProductFormPage() {
  const { id }       = useParams<{ id?: string }>();
  const isEdit       = Boolean(id);
  const navigate     = useNavigate();
  const { showToast } = useToast();
  const { user, isLoading: authLoading } = useAuth();
  const queryClient  = useQueryClient();

  // ── Redirect non-admins ────────────────────────────────────────────────
  useEffect(() => {
    if (!authLoading && (!user || user.role !== "admin")) navigate("/", { replace: true });
  }, [user, authLoading, navigate]);

  // ── Remote data ────────────────────────────────────────────────────────
  const { data: categories = [], isLoading: catsLoading } = useQuery({
    queryKey: ["categories"],
    queryFn:  getCategories,
  });

  const { data: existingProduct, isLoading: productLoading } = useQuery({
    queryKey: ["product", id],
    queryFn:  () => getProductById(id!),
    enabled:  isEdit,
  });

  // ── Form state ─────────────────────────────────────────────────────────
  const [name,        setName]        = useState("");
  const [slug,        setSlug]        = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [description, setDescription] = useState("");
  const [pricePurchase, setPricePurchase] = useState("");
  const [priceSale,     setPriceSale]     = useState("");
  const [discount,      setDiscount]      = useState("0");
  const [isActive,      setIsActive]      = useState(true);
  const [isNew,         setIsNew]         = useState(false);
  const [categoryIds,   setCategoryIds]   = useState<string[]>([]);
  const [variants,      setVariants]      = useState<VariantRow[]>([]);
  const [images,        setImages]        = useState<ImageRow[]>([]);
  const [errors,        setErrors]        = useState<Record<string, string>>({});

  // ── Populate form in edit mode ─────────────────────────────────────────
  useEffect(() => {
    if (!existingProduct) return;
    const p = existingProduct;
    setName(p.name);
    setSlug(p.slug);
    setSlugTouched(true);
    setDescription(p.description ?? "");
    setPricePurchase(String(p.price_purchase));
    setPriceSale(String(p.price_sale));
    setDiscount(String(p.discount_percentage));
    setIsActive(p.is_active);
    setIsNew(p.is_new);
    setCategoryIds(p.categories.map((c) => c.id));
    setVariants(p.variants.map((v) => ({
      _key: newKey(), size: v.size, stock: String(v.stock),
    })));
    setImages(p.images.map((img) => ({
      _key: newKey(), image_url: img.image_url, is_primary: img.is_primary,
    })));
  }, [existingProduct]);

  // ── Auto-slug from name ────────────────────────────────────────────────
  function handleNameChange(v: string) {
    setName(v);
    if (!slugTouched) setSlug(slugify(v));
  }

  // ── Validation ─────────────────────────────────────────────────────────
  function validate(): boolean {
    const e: Record<string, string> = {};
    if (!name.trim())                e.name          = "El nombre es requerido.";
    if (!slug.trim())                e.slug          = "El slug es requerido.";
    if (slug.trim() && !/^[a-z0-9-]+$/.test(slug))
                                     e.slug          = "Solo letras minúsculas, números y guiones.";
    if (!pricePurchase || Number(pricePurchase) <= 0)
                                     e.pricePurchase = "Ingresa un precio de compra válido.";
    if (!priceSale || Number(priceSale) <= 0)
                                     e.priceSale     = "Ingresa un precio de venta válido.";
    if (categoryIds.length === 0)    e.categories    = "Selecciona al menos una categoría.";
    if (variants.length === 0)       e.variants      = "Agrega al menos una talla.";
    variants.forEach((v, i) => {
      if (!v.size.trim())            e[`variant_size_${i}`]  = "La talla es requerida.";
      if (Number(v.stock) < 0)       e[`variant_stock_${i}`] = "Stock no puede ser negativo.";
    });
    if (images.length === 0)         e.images = "Agrega al menos una imagen.";
    if (images.length > 0 && !images.some((img) => img.is_primary))
                                     e.images = "Marca una imagen como principal.";

    setErrors(e);

    // Scroll to the first invalid field
    const fieldOrder = ["name", "slug", "pricePurchase", "priceSale", "categories", "variants", "images"];
    const firstKey   = fieldOrder.find((k) =>
      e[k] !== undefined || Object.keys(e).some((ek) => ek.startsWith(k))
    );
    if (firstKey) {
      requestAnimationFrame(() => {
        document.getElementById(`field-${firstKey}`)?.scrollIntoView({
          behavior: "smooth",
          block:    "center",
        });
      });
    }

    return Object.keys(e).length === 0;
  }

  // ── Mutation ───────────────────────────────────────────────────────────
  const mutation = useMutation({
    mutationFn: async (input: ProductInput): Promise<void> => {
      if (isEdit) await updateProduct(id!, input);
      else await createProduct(input);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      showToast(
        isEdit ? "Producto actualizado." : "Producto creado exitosamente.",
        "success"
      );
      navigate("/");
    },
    onError: (err: Error) => {
      showToast(err.message, "error");
    },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;

    const input: ProductInput = {
      name:                name.trim(),
      slug:                slug.trim(),
      description:         description.trim() || null,
      price_purchase:      Number(pricePurchase),
      price_sale:          Number(priceSale),
      discount_percentage: Number(discount) || 0,
      is_active:           isActive,
      is_new:              isNew,
      category_ids:        categoryIds,
      images: images.map((img, i) => ({
        image_url:     img.image_url.trim(),
        is_primary:    img.is_primary,
        display_order: i,
      })),
      variants: variants.map((v) => ({
        size:  v.size.trim(),
        stock: Number(v.stock),
      })),
    };

    mutation.mutate(input);
  }

  // ── Loading / access guard ─────────────────────────────────────────────
  const pageLoading = authLoading || catsLoading || (isEdit && productLoading);

  if (pageLoading) {
    return (
      <>
        <Header />
        <main className="max-w-2xl mx-auto px-4 py-10">
          <div className="animate-pulse space-y-4">
            <div className="h-6 bg-gray-100 rounded-lg w-1/3" />
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-32 bg-gray-100 rounded-2xl" />
            ))}
          </div>
        </main>
      </>
    );
  }

  return (
    <>
      <Header />
      <main className="max-w-2xl mx-auto px-4 py-8 pb-16">

        {/* Back + title */}
        <button
          onClick={() => navigate("/")}
          className="flex items-center gap-1.5 text-xs font-poppins text-gray-400
                     hover:text-brand-primary transition-colors mb-6 -ml-0.5"
        >
          <ArrowLeft size={15} strokeWidth={1.8} />
          Volver al catálogo
        </button>

        <h1 className="font-poppins font-semibold text-xl text-brand-dark mb-1">
          {isEdit ? "Editar producto" : "Nuevo producto"}
        </h1>
        <p className="font-poppins text-xs text-gray-400 mb-8">
          {isEdit ? "Modifica la información del producto." : "Completa los datos para agregar un producto al catálogo."}
        </p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-5">

          {/* ── Información básica ──────────────────────────────────── */}
          <SectionCard title="Información básica" hasError={!!(errors.name || errors.slug)}>
            <Field id="field-name" label="Nombre del producto" error={errors.name}>
              <input
                type="text"
                value={name}
                onChange={(e) => handleNameChange(e.target.value)}
                placeholder="Ej: Hoodie Dropping Vintage"
                className={inputCls(!!errors.name)}
              />
            </Field>

            <Field id="field-slug" label="Slug (URL)" error={errors.slug}>
              <input
                type="text"
                value={slug}
                onChange={(e) => { setSlugTouched(true); setSlug(e.target.value); }}
                placeholder="hoodie-dropping-vintage"
                className={inputCls(!!errors.slug)}
              />
              <span className="text-[11px] text-gray-400 font-poppins mt-0.5">
                Generado automáticamente. Solo minúsculas, números y guiones.
              </span>
            </Field>

            <Field label="Descripción">
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                placeholder="Describe el producto, materiales, fit, etc."
                className={cn(inputCls(), "resize-none")}
              />
            </Field>

            <div className="flex items-center justify-between rounded-xl border border-gray-200 px-4 py-3">
              <div>
                <p className="text-sm font-poppins text-brand-dark">Visible en catálogo</p>
                <p className="text-[11px] font-poppins text-gray-400">Activa o desactiva la visibilidad</p>
              </div>
              <button
                type="button"
                onClick={() => setIsActive((v) => !v)}
                className={cn(
                  "w-11 h-6 rounded-full transition-colors relative flex items-center shrink-0",
                  isActive ? "bg-brand-primary" : "bg-gray-200"
                )}
              >
                <span
                  className={cn(
                    "absolute w-5 h-5 bg-white rounded-full shadow transition-transform",
                    isActive ? "translate-x-5" : "translate-x-0.5"
                  )}
                />
              </button>
            </div>

            <div className="flex items-center justify-between rounded-xl border border-gray-200 px-4 py-3">
              <div>
                <p className="text-sm font-poppins text-brand-dark">Marcar como Nuevo</p>
                <p className="text-[11px] font-poppins text-gray-400">Muestra el badge verde "NUEVO" en el card</p>
              </div>
              <button
                type="button"
                onClick={() => setIsNew((v) => !v)}
                className={cn(
                  "w-11 h-6 rounded-full transition-colors relative flex items-center shrink-0",
                  isNew ? "bg-emerald-500" : "bg-gray-200"
                )}
              >
                <span
                  className={cn(
                    "absolute w-5 h-5 bg-white rounded-full shadow transition-transform",
                    isNew ? "translate-x-5" : "translate-x-0.5"
                  )}
                />
              </button>
            </div>
          </SectionCard>

          {/* ── Precios ────────────────────────────────────────────── */}
          <SectionCard title="Precios" hasError={!!(errors.pricePurchase || errors.priceSale)}>
            <div className="grid grid-cols-2 gap-3">
              <Field id="field-pricePurchase" label="Precio costo (₡)" error={errors.pricePurchase}>
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  value={pricePurchase}
                  onChange={(e) => setPricePurchase(e.target.value)}
                  placeholder="0.00"
                  className={inputCls(!!errors.pricePurchase)}
                />
              </Field>
              <Field id="field-priceSale" label="Precio venta (₡)" error={errors.priceSale}>
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  value={priceSale}
                  onChange={(e) => setPriceSale(e.target.value)}
                  placeholder="0.00"
                  className={inputCls(!!errors.priceSale)}
                />
              </Field>
            </div>
            <Field label="Descuento (%)">
              <input
                type="number"
                min={0}
                max={100}
                value={discount}
                onChange={(e) => setDiscount(e.target.value)}
                placeholder="0"
                className={inputCls()}
              />
            </Field>

            {/* ── Margen de ganancia ───────────────────────────────── */}
            {(() => {
              const cost        = Number(pricePurchase);
              const sale        = Number(priceSale);
              const disc        = Number(discount) || 0;
              if (!cost || !sale) return null;

              const effectiveSale   = disc > 0 ? Math.round(sale * (1 - disc / 100)) : sale;
              const profit          = sale - cost;
              const profitPct       = Math.round((profit / cost) * 100);
              const effectiveProfit = effectiveSale - cost;
              const effectivePct    = Math.round((effectiveProfit / cost) * 100);
              const hasDiscount     = disc > 0;

              const band = (pct: number) =>
                pct <= 0
                  ? { label: "Pérdida",   cls: "bg-red-50   border-red-200   text-red-600"   }
                  : pct <= 15
                  ? { label: "Bajo",      cls: "bg-amber-50 border-amber-200 text-amber-700" }
                  : pct <= 40
                  ? { label: "Bueno",     cls: "bg-green-50 border-green-200 text-green-700" }
                  : { label: "Excelente", cls: "bg-green-50 border-green-200 text-green-700" };

              const main = band(profitPct);
              const eff  = band(effectivePct);

              return (
                <div className={cn(
                  "rounded-xl border px-4 py-3 flex flex-col gap-2 transition-colors",
                  main.cls
                )}>
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-poppins font-semibold uppercase tracking-wider opacity-70">
                      Margen de ganancia
                    </span>
                    <span className={cn(
                      "text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full",
                      main.cls
                    )}>
                      {main.label}
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
                    <div className={cn(
                      "rounded-lg border px-3 py-2 flex items-center justify-between",
                      eff.cls
                    )}>
                      <span className="text-[11px] font-poppins">
                        Con {disc}% descuento aplicado:
                      </span>
                      <span className="text-[11px] font-poppins font-semibold">
                        {effectivePct > 0 ? "+" : ""}{effectivePct}% · ₡{effectiveProfit.toLocaleString("en-US")}
                      </span>
                    </div>
                  )}
                </div>
              );
            })()}
          </SectionCard>

          {/* ── Categorías ─────────────────────────────────────────── */}
          <SectionCard title="Categorías" id="field-categories" hasError={!!errors.categories}>
            <div className="flex items-start gap-2">
              <Tag size={15} className="text-brand-accent mt-3 shrink-0" />
              <div className="flex-1 flex flex-col gap-2">
                {!catsLoading && categories.length === 0 ? (
                  <p className="text-sm font-poppins text-gray-400 py-2.5 px-4 rounded-xl
                                border border-dashed border-gray-200 text-center">
                    No hay categorías disponibles
                  </p>
                ) : (
                  <MultiSelect
                    options={categories}
                    selected={categoryIds}
                    onChange={setCategoryIds}
                    placeholder="Selecciona una o más categorías…"
                    error={errors.categories}
                  />
                )}
                <button
                  type="button"
                  onClick={() => navigate("/admin/categories")}
                  className="self-start text-xs font-poppins text-brand-primary
                             hover:text-[#7a3e18] transition-colors flex items-center gap-1"
                >
                  <Plus size={12} />
                  Añadir nueva categoría
                </button>
              </div>
            </div>
          </SectionCard>

          {/* ── Variantes ──────────────────────────────────────────── */}
          <SectionCard title="Tallas y stock" id="field-variants" hasError={!!errors.variants}>
            <VariantsSection
              rows={variants}
              onChange={setVariants}
              error={errors.variants}
            />
          </SectionCard>

          {/* ── Imágenes ───────────────────────────────────────────── */}
          <SectionCard title="Imágenes" id="field-images" hasError={!!errors.images}>
            <ImageUpload
              images={images}
              onChange={setImages}
              error={errors.images}
            />
          </SectionCard>

          {/* ── Actions ────────────────────────────────────────────── */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={() => navigate("/")}
              className="flex-1 py-3 rounded-xl border border-gray-200 text-sm font-poppins
                         text-gray-500 hover:border-gray-300 hover:text-brand-dark transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={mutation.isPending}
              className="flex-1 py-3 rounded-xl bg-brand-primary text-white text-sm font-poppins
                         font-medium flex items-center justify-center gap-2
                         hover:bg-[#7a3e18] transition-colors disabled:opacity-60"
            >
              {mutation.isPending && <Loader2 size={15} className="animate-spin" />}
              {isEdit ? "Guardar cambios" : "Crear producto"}
            </button>
          </div>

        </form>
      </main>
    </>
  );
}
