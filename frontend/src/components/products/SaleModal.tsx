import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation } from "@tanstack/react-query";
import { X, Check, Loader2, ShoppingCart } from "lucide-react";
import {
  recordManualSale,
  DELIVERY_STATUSES,
  type ShippingMethod,
  type DeliveryStatus,
} from "../../services/salesService";
import {
  calculateShipping,
  getAvailableCarriers,
  getDefaultCarrier,
  isGAMCanton,
  type Carrier,
} from "../../config/shipping";
import { useToast } from "../ui/Toast";
import { cn } from "../../lib/utils";
import { type ProductVariant } from "../../services/productService";

// ── Shared style ───────────────────────────────────────────────────────────

const inputCls =
  "w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-poppins text-brand-dark " +
  "placeholder:text-gray-300 outline-none focus:border-brand-primary " +
  "focus:ring-1 focus:ring-brand-primary/20 transition";

// ── Costa Rica geography ───────────────────────────────────────────────────

const CR_CANTONS: Record<string, string[]> = {
  "San José": [
    "San José", "Escazú", "Desamparados", "Puriscal", "Tarrazú", "Aserrí",
    "Mora", "Goicoechea", "Santa Ana", "Alajuelita", "Vásquez de Coronado",
    "Acosta", "Tibás", "Moravia", "Montes de Oca", "Turrubares", "Dota",
    "Curridabat", "Pérez Zeledón", "León Cortés",
  ],
  "Alajuela": [
    "Alajuela", "San Ramón", "Grecia", "San Mateo", "Atenas", "Naranjo",
    "Palmares", "Poás", "Orotina", "San Carlos", "Zarcero", "Valverde Vega",
    "Upala", "Los Chiles", "Guatuso", "Río Cuarto",
  ],
  "Cartago": [
    "Cartago", "Paraíso", "La Unión", "Jiménez", "Turrialba",
    "Alvarado", "Oreamuno", "El Guarco",
  ],
  "Heredia": [
    "Heredia", "Barva", "Santo Domingo", "Santa Bárbara", "San Rafael",
    "San Isidro", "Belén", "Flores", "San Pablo", "Sarapiquí",
  ],
  "Guanacaste": [
    "Liberia", "Nicoya", "Santa Cruz", "Bagaces", "Carrillo", "Cañas",
    "Abangares", "Tilarán", "Nandayure", "La Cruz", "Hojancha",
  ],
  "Puntarenas": [
    "Puntarenas", "Esparza", "Buenos Aires", "Montes de Oro", "Osa",
    "Quepos", "Golfito", "Coto Brus", "Parrita", "Corredores", "Garabito",
  ],
  "Limón": [
    "Limón", "Pococí", "Siquirres", "Talamanca", "Matina", "Guácimo",
  ],
};

const CR_PROVINCES = Object.keys(CR_CANTONS);

// ── Props ──────────────────────────────────────────────────────────────────

export interface SaleModalProps {
  productId:          string;
  priceSale:          number;
  pricePurchase:      number;
  discountPercentage: number;
  variants:           ProductVariant[];
  onClose:            () => void;
  onSuccess:          () => void;
}

// ── Component ──────────────────────────────────────────────────────────────

export default function SaleModal({
  productId,
  priceSale,
  pricePurchase,
  discountPercentage,
  variants,
  onClose,
  onSuccess,
}: SaleModalProps) {
  const effectivePrice    = discountPercentage > 0
    ? Math.round(priceSale * (1 - discountPercentage / 100))
    : priceSale;
  const { showToast }     = useToast();
  const navigate          = useNavigate();
  const availableVariants = variants.filter((variant) => variant.stock > 0);

  const [variantId,         setVariantId]         = useState("");
  const [quantity,          setQuantity]          = useState(1);
  const [priceSold,         setPriceSold]         = useState(String(effectivePrice));
  const [guestName,         setGuestName]         = useState("");
  const [guestPhone,        setGuestPhone]        = useState("");
  const [isPagos,           setIsPagos]           = useState(false);
  const [initialPayment,    setInitialPayment]    = useState("");
  const [note,              setNote]              = useState("");
  const [deliveryStatus,    setDeliveryStatus]    = useState<DeliveryStatus>("validating");
  const [trackingNumber,    setTrackingNumber]    = useState("");
  const [errors,            setErrors]            = useState<Record<string, string>>({});
  const [saleConfirmed,     setSaleConfirmed]     = useState(false);
  const [confirmedSaleData, setConfirmedSaleData] = useState<{ name: string; phone: string } | null>(null);

  // Shipping form state
  const [deliveryType,  setDeliveryType]  = useState<"personal" | "envio">("personal");
  const [province,      setProvince]      = useState("");
  const [canton,        setCanton]        = useState("");
  const [district,      setDistrict]      = useState("");
  const [carrierChoice, setCarrierChoice] = useState<"mensajero" | "correos">("mensajero");

  const selectedVariant    = availableVariants.find((variant) => variant.id === variantId);
  const priceNum           = Number(priceSold) || 0;
  const cantonIsGAM        = canton ? isGAMCanton(canton) : false;
  const availableCarriers: Carrier[] = canton ? getAvailableCarriers(canton) : [];

  const { method: shippingMethod, cost: shippingCost }: { method: ShippingMethod; cost: number } =
    deliveryType === "personal" || canton === "Grecia"
      ? { method: "personal_grecia", cost: 0 }
      : canton
        ? calculateShipping(province, canton, carrierChoice)
        : { method: "personal_grecia", cost: 0 };

  const totalNum     = priceNum + shippingCost;
  const showTracking = deliveryType === "envio" && carrierChoice === "correos" && canton !== "Grecia";

  const saleMutation = useMutation({
    mutationFn: recordManualSale,
    onSuccess: () => {
      setSaleConfirmed(true);
      setConfirmedSaleData({
        name:  guestName.trim(),
        phone: guestPhone.trim(),
      });
      onSuccess();
    },
    onError: (err: Error) => showToast(err.message, "error"),
  });

  function validate(): boolean {
    const validationErrors: Record<string, string> = {};
    if (!variantId)                                              validationErrors.variant        = "Selecciona una talla.";
    if (quantity < 1)                                            validationErrors.quantity       = "Mínimo 1 unidad.";
    if (selectedVariant && quantity > selectedVariant.stock)     validationErrors.quantity       = `Máximo ${selectedVariant.stock} en stock.`;
    if (!priceSold || priceNum <= 0)                             validationErrors.priceSold      = "Ingresa un precio válido.";
    if (deliveryType === "envio" && !province)                   validationErrors.province       = "Selecciona una provincia.";
    if (isPagos && initialPayment) {
      const abonoAmount = Number(initialPayment);
      if (abonoAmount <= 0)         validationErrors.initialPayment = "El abono debe ser mayor a 0.";
      if (abonoAmount > totalNum)   validationErrors.initialPayment = "El abono no puede superar el total.";
    }
    setErrors(validationErrors);
    return Object.keys(validationErrors).length === 0;
  }

  function handleConfirm() {
    if (!validate()) return;
    const rawPhone = guestPhone.replace(/\D/g, "");
    saleMutation.mutate({
      product_id:      productId,
      variant_id:      variantId,
      quantity,
      sale_price:      priceNum,
      note:            note.trim() || null,
      guest_name:      guestName.trim() || null,
      guest_phone:     rawPhone ? `+506${rawPhone}` : null,
      status:          isPagos ? "pending" : "completed",
      initial_payment: isPagos ? (Number(initialPayment) || 0) : totalNum,
      shipping_method: shippingMethod,
      shipping_cost:   shippingCost,
      delivery_status: deliveryStatus,
      tracking_number: trackingNumber.trim() || null,
      province:        deliveryType === "envio" ? (province  || null) : null,
      canton:          deliveryType === "envio" ? (canton    || null) : null,
      district:        deliveryType === "envio" ? (district  || null) : null,
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

        {saleConfirmed ? (
          /* Sale confirmed: ask if client wants more products */
          <div className="flex flex-col items-center gap-5 px-6 py-8 text-center">
            <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center">
              <Check size={28} className="text-green-600" strokeWidth={2.5} />
            </div>
            <div>
              <p className="font-poppins font-semibold text-base text-brand-dark">
                ¡Venta registrada!
              </p>
              <p className="font-poppins text-sm text-gray-500 mt-1.5 leading-snug">
                ¿El cliente está comprando más productos en esta misma compra?
              </p>
            </div>
            <div className="flex flex-col gap-2 w-full">
              <button
                type="button"
                onClick={() => {
                  sessionStorage.setItem("order_draft", JSON.stringify({
                    guest_name:  confirmedSaleData?.name  || null,
                    guest_phone: confirmedSaleData?.phone || null,
                  }));
                  showToast("Venta registrada. Agregá los demás productos.", "success");
                  navigate("/admin/pedidos?draft=true");
                }}
                className="w-full py-2.5 rounded-xl bg-brand-primary text-white text-sm font-poppins
                           font-medium hover:bg-[#7a3e18] transition-colors"
              >
                Sí, agregar más productos
              </button>
              <button
                type="button"
                onClick={() => {
                  showToast("Venta registrada correctamente.", "success");
                  setSaleConfirmed(false);
                  onClose();
                }}
                className="w-full py-2.5 rounded-xl border border-gray-200 text-sm font-poppins
                           text-gray-500 hover:border-gray-300 transition-colors"
              >
                No, listo
              </button>
            </div>
          </div>
        ) : availableVariants.length === 0 ? (
          <p className="text-sm font-poppins text-gray-400 text-center py-8 px-6">
            No hay tallas con stock disponible.
          </p>
        ) : (
          <div className="overflow-y-auto flex flex-col gap-4 px-6 py-5">

            {/* Variant selector */}
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-gray-500 font-poppins uppercase tracking-wider">Talla</label>
              <select
                value={variantId}
                onChange={(e) => { setVariantId(e.target.value); setQuantity(1); }}
                className={inputCls}
              >
                <option value="">Seleccioná una talla…</option>
                {availableVariants.map((variant) => (
                  <option key={variant.id} value={variant.id}>
                    {variant.size} — {variant.stock} en stock
                  </option>
                ))}
              </select>
              {errors.variant && <span className="text-[11px] text-red-500 font-poppins">{errors.variant}</span>}
            </div>

            {/* Quantity */}
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-gray-500 font-poppins uppercase tracking-wider">Cantidad</label>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setQuantity((prevQuantity) => Math.max(1, prevQuantity - 1))}
                  className="w-10 h-10 rounded-xl border border-gray-200 flex items-center justify-center
                             text-gray-500 hover:border-brand-primary hover:text-brand-primary transition-colors shrink-0"
                >
                  −
                </button>
                <input
                  type="number"
                  min={1}
                  max={selectedVariant?.stock ?? 1}
                  value={quantity}
                  onChange={(e) => setQuantity(Math.max(1, Number(e.target.value)))}
                  className={cn(inputCls, "text-center")}
                />
                <button
                  type="button"
                  onClick={() => setQuantity((prevQuantity) => Math.min(selectedVariant?.stock ?? 1, prevQuantity + 1))}
                  className="w-10 h-10 rounded-xl border border-gray-200 flex items-center justify-center
                             text-gray-500 hover:border-brand-primary hover:text-brand-primary transition-colors shrink-0"
                >
                  +
                </button>
              </div>
              {errors.quantity && <span className="text-[11px] text-red-500 font-poppins">{errors.quantity}</span>}
            </div>

            {/* Price */}
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-gray-500 font-poppins uppercase tracking-wider">
                Precio de venta (₡)
              </label>
              <input
                type="number"
                min={0}
                step="0.01"
                value={priceSold}
                onChange={(e) => setPriceSold(e.target.value)}
                className={inputCls}
              />
              {errors.priceSold && <span className="text-[11px] text-red-500 font-poppins">{errors.priceSold}</span>}
              <span className="text-[11px] text-gray-400 font-poppins">
                {discountPercentage > 0
                  ? `Con ${discountPercentage}% descuento: ₡${effectivePrice.toLocaleString("en-US")} (original ₡${priceSale.toLocaleString("en-US")})`
                  : `Oficial: ₡${priceSale.toLocaleString("en-US")}. Modifica si hubo precio especial.`
                }
              </span>
            </div>

            {/* Profit margin indicator */}
            {(() => {
              const soldPrice    = Number(priceSold);
              const purchaseCost = pricePurchase;
              if (!soldPrice || !purchaseCost) return null;

              const profit    = soldPrice - purchaseCost;
              const marginPct = Math.round((profit / purchaseCost) * 100);

              const band =
                marginPct <= 0  ? { label: "Pérdida",   cls: "bg-red-50   border-red-200   text-red-600"   } :
                marginPct <= 15 ? { label: "Bajo",      cls: "bg-amber-50 border-amber-200 text-amber-700" } :
                marginPct <= 40 ? { label: "Bueno",     cls: "bg-green-50 border-green-200 text-green-700" } :
                                  { label: "Excelente", cls: "bg-green-50 border-green-200 text-green-700" };

              return (
                <div className={`rounded-xl border px-3 py-2.5 flex items-center justify-between transition-colors ${band.cls}`}>
                  <div className="flex items-baseline gap-1.5">
                    <span className="font-poppins font-bold text-base leading-none">
                      {marginPct > 0 ? "+" : ""}{marginPct}%
                    </span>
                    <span className="font-poppins text-xs">
                      ₡{profit.toLocaleString("en-US")} ganancia
                    </span>
                  </div>
                  <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${band.cls}`}>
                    {band.label}
                  </span>
                </div>
              );
            })()}

            {/* Delivery method */}
            <div className="border-t border-gray-100 pt-1 flex flex-col gap-3">
              <p className="text-[10px] font-poppins text-gray-400 uppercase tracking-widest">
                Método de entrega
              </p>

              {(["personal", "envio"] as const).map((deliveryTypeOption) => (
                <label
                  key={deliveryTypeOption}
                  onClick={() => setDeliveryType(deliveryTypeOption)}
                  className={cn(
                    "flex items-center gap-3 rounded-xl border px-4 py-3 cursor-pointer transition-all",
                    deliveryType === deliveryTypeOption
                      ? "border-brand-primary bg-brand-primary/5"
                      : "border-gray-200 hover:border-gray-300"
                  )}
                >
                  <span className={cn(
                    "w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors",
                    deliveryType === deliveryTypeOption ? "border-brand-primary" : "border-gray-300"
                  )}>
                    {deliveryType === deliveryTypeOption && (
                      <span className="w-2 h-2 rounded-full bg-brand-primary" />
                    )}
                  </span>
                  <div>
                    <p className="text-sm font-poppins text-brand-dark">
                      {deliveryTypeOption === "personal" ? "Entrega personal (Grecia)" : "Envío"}
                    </p>
                    {deliveryTypeOption === "personal" && (
                      <p className="text-[11px] font-poppins text-gray-400">Gratis</p>
                    )}
                  </div>
                </label>
              ))}

              {deliveryType === "envio" && (
                <div className="flex flex-col gap-3 pt-1">

                  {/* Province */}
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-medium text-gray-500 font-poppins uppercase tracking-wider">
                      Provincia
                    </label>
                    <select
                      value={province}
                      onChange={(e) => {
                        setProvince(e.target.value);
                        setCanton("");
                        setDistrict("");
                        setCarrierChoice("mensajero");
                      }}
                      className={inputCls}
                    >
                      <option value="">Seleccionar provincia…</option>
                      {CR_PROVINCES.map((provinceName) => (
                        <option key={provinceName} value={provinceName}>{provinceName}</option>
                      ))}
                    </select>
                    {errors.province && (
                      <span className="text-[11px] text-red-500 font-poppins">{errors.province}</span>
                    )}
                  </div>

                  {/* Canton — appears after province is selected */}
                  {province && (
                    <div className="flex flex-col gap-1">
                      <label className="text-xs font-medium text-gray-500 font-poppins uppercase tracking-wider">
                        Cantón
                      </label>
                      <select
                        value={canton}
                        onChange={(e) => {
                          const selectedCanton = e.target.value;
                          setCanton(selectedCanton);
                          setDistrict("");
                          if (selectedCanton === "Grecia") {
                            setDeliveryType("personal");
                          } else if (selectedCanton) {
                            setCarrierChoice(getDefaultCarrier(selectedCanton));
                          }
                        }}
                        className={inputCls}
                      >
                        <option value="">Seleccionar cantón…</option>
                        {(CR_CANTONS[province] ?? []).map((cantonName) => (
                          <option key={cantonName} value={cantonName}>{cantonName}</option>
                        ))}
                      </select>
                    </div>
                  )}

                  {/* District — text input, appears after canton */}
                  {canton && (
                    <div className="flex flex-col gap-1">
                      <label className="text-xs font-medium text-gray-500 font-poppins uppercase tracking-wider">
                        Distrito
                      </label>
                      <input
                        type="text"
                        value={district}
                        onChange={(e) => setDistrict(e.target.value)}
                        placeholder="Ej: San Francisco"
                        className={inputCls}
                      />
                    </div>
                  )}

                  {/* Shipping carrier — appears after canton (except Grecia) */}
                  {canton && canton !== "Grecia" && (
                    <div className="flex flex-col gap-2">
                      <label className="text-xs font-medium text-gray-500 font-poppins uppercase tracking-wider">
                        Servicio de envío
                      </label>

                      {cantonIsGAM ? (
                        /* GAM zone: Mensajero or Correos */
                        <div className="flex flex-col gap-2">
                          {availableCarriers.map((carrier) => {
                            const shippingResult = calculateShipping(province, canton, carrier);
                            const carrierLabel   = carrier === "mensajero" ? "Mensajero privado" : "Correos CR";
                            return (
                              <label
                                key={carrier}
                                onClick={() => setCarrierChoice(carrier)}
                                className={cn(
                                  "flex items-center justify-between rounded-xl border px-4 py-3 cursor-pointer transition-all",
                                  carrierChoice === carrier
                                    ? "border-brand-primary bg-brand-primary/5"
                                    : "border-gray-200 hover:border-gray-300"
                                )}
                              >
                                <div className="flex items-center gap-3">
                                  <span className={cn(
                                    "w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors",
                                    carrierChoice === carrier ? "border-brand-primary" : "border-gray-300"
                                  )}>
                                    {carrierChoice === carrier && (
                                      <span className="w-2 h-2 rounded-full bg-brand-primary" />
                                    )}
                                  </span>
                                  <span className="text-sm font-poppins text-brand-dark">{carrierLabel}</span>
                                </div>
                                <span className="text-xs font-poppins font-semibold text-brand-primary">
                                  ₡{shippingResult.cost.toLocaleString("en-US")}
                                </span>
                              </label>
                            );
                          })}
                        </div>
                      ) : (
                        /* Outside GAM: Correos only */
                        <div className="flex flex-col gap-1">
                          <div className="flex items-center justify-between rounded-xl border border-gray-200 px-4 py-3 bg-gray-50">
                            <span className="text-sm font-poppins text-gray-600">Correos CR</span>
                            <span className="text-xs font-poppins font-semibold text-brand-primary">₡3,000</span>
                          </div>
                          <p className="text-[11px] font-poppins text-gray-400 px-1">
                            Zona rural — solo disponible Correos CR.
                          </p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Tracking number — Correos only */}
                  {showTracking && (
                    <div className="flex flex-col gap-1">
                      <label className="text-xs font-medium text-gray-500 font-poppins uppercase tracking-wider">
                        N.° de seguimiento{" "}
                        <span className="normal-case text-gray-300">(opcional)</span>
                      </label>
                      <input
                        type="text"
                        value={trackingNumber}
                        onChange={(e) => setTrackingNumber(e.target.value)}
                        placeholder="Ej: CR123456789"
                        className={inputCls}
                      />
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Total breakdown */}
            <div className="rounded-xl bg-gray-50 px-4 py-3 flex flex-col gap-1.5 text-sm font-poppins">
              <div className="flex justify-between text-gray-500">
                <span>Producto</span>
                <span>₡{priceNum.toLocaleString("en-US")}</span>
              </div>
              <div className="flex justify-between text-gray-500">
                <span>Envío</span>
                <span>{shippingCost === 0 ? "Gratis" : `₡${shippingCost.toLocaleString("en-US")}`}</span>
              </div>
              <div className="flex justify-between font-semibold text-brand-dark border-t border-gray-200 pt-1.5 mt-0.5">
                <span>Total</span>
                <span>₡{totalNum.toLocaleString("en-US")}</span>
              </div>
            </div>

            {/* Delivery status */}
            <div className="border-t border-gray-100 pt-1 flex flex-col gap-2">
              <p className="text-[10px] font-poppins text-gray-400 uppercase tracking-widest">
                Estado de entrega
              </p>
              <select
                value={deliveryStatus}
                onChange={(e) => {
                  const selectedStatus = e.target.value as DeliveryStatus;
                  setDeliveryStatus(selectedStatus);
                  if (selectedStatus === "apartada") setIsPagos(true);
                }}
                className={inputCls}
              >
                {DELIVERY_STATUSES.map((statusOption) => (
                  <option key={statusOption.value} value={statusOption.value}>
                    {statusOption.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Client data */}
            <div className="border-t border-gray-100 pt-1">
              <p className="text-[10px] font-poppins text-gray-400 uppercase tracking-widest mb-3">
                Datos del cliente (opcional)
              </p>
              <div className="flex flex-col gap-3">
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-medium text-gray-500 font-poppins uppercase tracking-wider">
                    Nombre
                  </label>
                  <input
                    type="text"
                    value={guestName}
                    onChange={(e) => setGuestName(e.target.value)}
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
                      value={guestPhone}
                      onChange={(e) => setGuestPhone(e.target.value.replace(/\D/g, "").slice(0, 8))}
                      placeholder="88887777"
                      maxLength={8}
                      className="flex-1 px-3 py-2.5 text-sm font-poppins text-brand-dark outline-none bg-white"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Installment payments toggle */}
            <div className="border-t border-gray-100 pt-1">
              <label className="flex items-center gap-3 cursor-pointer select-none">
                <div
                  onClick={() => setIsPagos((prevState) => !prevState)}
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
                  <input
                    type="number"
                    min={1}
                    max={totalNum}
                    step="0.01"
                    value={initialPayment}
                    onChange={(e) => setInitialPayment(e.target.value)}
                    placeholder="0.00"
                    className={inputCls}
                  />
                  {errors.initialPayment && (
                    <span className="text-[11px] text-red-500 font-poppins">{errors.initialPayment}</span>
                  )}
                  {initialPayment && Number(initialPayment) > 0 && (
                    <span className="text-[11px] text-gray-400 font-poppins">
                      Restará: ₡{Math.max(0, totalNum - Number(initialPayment)).toLocaleString("en-US")}
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* Note */}
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-gray-500 font-poppins uppercase tracking-wider">
                Nota (opcional)
              </label>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={2}
                placeholder="Ej: cliente habitual, precio acordado…"
                className={cn(inputCls, "resize-none")}
              />
            </div>

            {/* Actions */}
            <div className="flex gap-3 pb-1">
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
                onClick={handleConfirm}
                disabled={saleMutation.isPending}
                className="flex-1 py-2.5 rounded-xl bg-brand-primary text-white text-sm font-poppins
                           font-medium flex items-center justify-center gap-2
                           hover:bg-[#7a3e18] transition-colors disabled:opacity-60"
              >
                {saleMutation.isPending
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
