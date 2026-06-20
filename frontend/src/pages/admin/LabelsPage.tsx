import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Printer, Trash2, ArrowLeft } from "lucide-react";
import Header from "../../components/ui/Header";
import { printLabel } from "../../lib/printLabel";
import { cn } from "../../lib/utils";

const inputCls =
  "w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-poppins text-brand-dark " +
  "placeholder:text-gray-300 outline-none focus:border-brand-primary " +
  "focus:ring-1 focus:ring-brand-primary/20 transition";

type MethodKey = "personal" | "mensajero" | "correos";

const METHODS: { key: MethodKey; label: string; method: string }[] = [
  { key: "personal",  label: "Entrega personal", method: "personal_grecia" },
  { key: "mensajero", label: "Mensajero",         method: "mensajero_gam"   },
  { key: "correos",   label: "Correos CR",        method: "correos_cr"      },
];

export default function LabelsPage() {
  const navigate = useNavigate();

  const [name,            setName]            = useState("");
  const [phone,           setPhone]           = useState("");
  const [method,          setMethod]          = useState<MethodKey>("personal");
  const [province,        setProvince]        = useState("");
  const [canton,          setCanton]          = useState("");
  const [district,        setDistrict]        = useState("");
  const [tracking,        setTracking]        = useState("");
  const [detail,          setDetail]          = useState("");
  const [cashOnDelivery,  setCashOnDelivery]  = useState("");
  const [products,        setProducts]        = useState<string[]>([""]);
  const [error,           setError]           = useState("");

  const isEnvio   = method === "mensajero" || method === "correos";
  const isCorreos = method === "correos";

  function addProduct() { setProducts((prev) => [...prev, ""]); }
  function removeProduct(i: number) { setProducts((prev) => prev.filter((_, idx) => idx !== i)); }
  function updateProduct(i: number, v: string) { setProducts((prev) => prev.map((p, idx) => idx === i ? v : p)); }

  function handlePrint() {
    const validProducts = products.map((p) => p.trim()).filter(Boolean);
    if (validProducts.length === 0) { setError("Agregá al menos un producto."); return; }
    setError("");

    const chosen = METHODS.find((m) => m.key === method)!;
    const cod    = cashOnDelivery.trim() ? Number(cashOnDelivery) : undefined;

    printLabel({
      recipientName:  name.trim()  || undefined,
      recipientPhone: phone.trim() ? `+506 ${phone.trim()}` : undefined,
      shippingMethod: chosen.method,
      products:       validProducts.map((n) => ({ name: n })),
      trackingNumber: tracking.trim()  || undefined,
      province:       province.trim()  || undefined,
      canton:         canton.trim()    || undefined,
      district:       district.trim()  || undefined,
      detail:         detail.trim()    || undefined,
      cashOnDelivery: cod,
    });
  }

  function handleReset() {
    setName(""); setPhone(""); setMethod("personal");
    setProvince(""); setCanton(""); setDistrict("");
    setTracking(""); setDetail(""); setCashOnDelivery("");
    setProducts([""]); setError("");
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />

      <div className="max-w-lg mx-auto py-6 px-4">

        {/* Page header */}
        <div className="flex items-center gap-3 mb-6">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="p-2 rounded-xl border border-gray-200 text-gray-400
                       hover:border-brand-primary hover:text-brand-primary transition-colors"
          >
            <ArrowLeft size={18} strokeWidth={1.8} />
          </button>
          <div>
            <h1 className="font-poppins font-semibold italic text-xl text-brand-dark leading-tight">
              Crear etiqueta manual
            </h1>
            <p className="font-poppins text-xs text-gray-400">
              Para reventas o productos sin catálogo.
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-4">

          {/* Shipping method */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex flex-col gap-3">
            <p className="text-[10px] font-poppins text-gray-400 uppercase tracking-widest">
              Tipo de entrega
            </p>
            <div className="grid grid-cols-3 gap-2">
              {METHODS.map(({ key, label }) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setMethod(key)}
                  className={cn(
                    "rounded-xl border px-3 py-2.5 text-xs font-poppins text-center transition-all leading-snug",
                    method === key
                      ? "border-brand-primary bg-brand-primary/5 text-brand-primary font-medium"
                      : "border-gray-200 text-gray-500 hover:border-gray-300"
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Destinatario */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex flex-col gap-3">
            <p className="text-[10px] font-poppins text-gray-400 uppercase tracking-widest">
              Destinatario <span className="normal-case font-normal">(opcional)</span>
            </p>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-gray-500 font-poppins uppercase tracking-wider">
                Nombre
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ej: Juan Pérez"
                className={inputCls}
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-gray-500 font-poppins uppercase tracking-wider">
                WhatsApp
              </label>
              <div className="flex items-center rounded-xl border border-gray-200 overflow-hidden
                              focus-within:border-brand-primary focus-within:ring-1 focus-within:ring-brand-primary/20 transition">
                <span className="px-3 py-2.5 text-sm font-poppins text-gray-400 bg-gray-50
                                 border-r border-gray-200 shrink-0 select-none">+506</span>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 8))}
                  placeholder="88887777"
                  maxLength={8}
                  className="flex-1 px-3 py-2.5 text-sm font-poppins text-brand-dark outline-none bg-white"
                />
              </div>
            </div>
          </div>

          {/* Dirección — solo envíos */}
          {isEnvio && (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex flex-col gap-3">
              <p className="text-[10px] font-poppins text-gray-400 uppercase tracking-widest">
                Dirección
              </p>
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-medium text-gray-500 font-poppins uppercase tracking-wider">
                    Provincia
                  </label>
                  <input
                    type="text"
                    value={province}
                    onChange={(e) => setProvince(e.target.value)}
                    placeholder="Ej: Alajuela"
                    className={inputCls}
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-medium text-gray-500 font-poppins uppercase tracking-wider">
                    Cantón
                  </label>
                  <input
                    type="text"
                    value={canton}
                    onChange={(e) => setCanton(e.target.value)}
                    placeholder="Ej: San Carlos"
                    className={inputCls}
                  />
                </div>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-gray-500 font-poppins uppercase tracking-wider">
                  Distrito
                </label>
                <input
                  type="text"
                  value={district}
                  onChange={(e) => setDistrict(e.target.value)}
                  placeholder="Ej: Florencia"
                  className={inputCls}
                />
              </div>
            </div>
          )}

          {/* Detalles — dirección exacta + monto */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex flex-col gap-3">
            <p className="text-[10px] font-poppins text-gray-400 uppercase tracking-widest">
              Detalles adicionales
            </p>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-gray-500 font-poppins uppercase tracking-wider">
                Dirección exacta / observaciones
                <span className="ml-1 normal-case font-normal text-gray-300">(opcional)</span>
              </label>
              <textarea
                value={detail}
                onChange={(e) => setDetail(e.target.value)}
                rows={3}
                placeholder="Ej: 100m norte del parque, casa azul con portón negro"
                className={cn(inputCls, "resize-none")}
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-gray-500 font-poppins uppercase tracking-wider">
                Monto contra entrega (₡)
                <span className="ml-1 normal-case font-normal text-gray-300">(opcional)</span>
              </label>
              <input
                type="number"
                min={0}
                value={cashOnDelivery}
                onChange={(e) => setCashOnDelivery(e.target.value)}
                placeholder="Ej: 25000"
                className={inputCls}
              />
              <p className="text-[11px] font-poppins text-gray-300 pl-1">
                Aparece en la etiqueta como monto a cobrar. Dejá vacío si no aplica.
              </p>
            </div>
          </div>

          {/* Número de guía — solo correos */}
          {isCorreos && (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex flex-col gap-1">
              <label className="text-xs font-medium text-gray-500 font-poppins uppercase tracking-wider">
                N.° de guía Correos CR
                <span className="ml-1 normal-case font-normal text-gray-300">(opcional)</span>
              </label>
              <input
                type="text"
                value={tracking}
                onChange={(e) => setTracking(e.target.value)}
                placeholder="Ej: CR123456789CR"
                className={inputCls}
              />
            </div>
          )}

          {/* Productos */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex flex-col gap-3">
            <p className="text-[10px] font-poppins text-gray-400 uppercase tracking-widest">
              Productos
            </p>
            <div className="flex flex-col gap-2">
              {products.map((product, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input
                    type="text"
                    value={product}
                    onChange={(e) => updateProduct(i, e.target.value)}
                    placeholder="Ej: Camisa Brand Talla M"
                    className={cn(inputCls, "flex-1")}
                  />
                  {products.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeProduct(i)}
                      className="p-2.5 rounded-xl border border-gray-200 text-gray-300
                                 hover:text-red-400 hover:border-red-200 transition-colors shrink-0"
                    >
                      <Trash2 size={14} strokeWidth={2} />
                    </button>
                  )}
                </div>
              ))}
            </div>
            {error && (
              <span className="text-[11px] text-red-500 font-poppins">{error}</span>
            )}
            <button
              type="button"
              onClick={addProduct}
              className="flex items-center gap-1.5 text-xs font-poppins text-brand-primary
                         hover:text-brand-accent transition-colors w-fit"
            >
              <Plus size={13} strokeWidth={2.5} />
              Agregar otro producto
            </button>
          </div>

          {/* Acciones */}
          <div className="flex gap-3">
            <button
              type="button"
              onClick={handleReset}
              className="flex-1 py-3 rounded-xl border border-gray-200 text-sm font-poppins
                         text-gray-400 hover:border-gray-300 transition-colors"
            >
              Limpiar
            </button>
            <button
              type="button"
              onClick={handlePrint}
              className="flex-1 py-3 rounded-xl bg-brand-primary text-white text-sm font-poppins
                         font-medium flex items-center justify-center gap-2
                         hover:bg-[#7a3e18] transition-colors"
            >
              <Printer size={15} strokeWidth={2} />
              Generar etiqueta
            </button>
          </div>

          <p className="text-[11px] font-poppins text-gray-300 text-center pb-4">
            Se abrirá una ventana lista para imprimir en formato 4"×6".
          </p>
        </div>
      </div>
    </div>
  );
}
