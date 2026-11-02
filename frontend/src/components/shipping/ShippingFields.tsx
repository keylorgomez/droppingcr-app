import { calculateShipping, cantonHasMensajero } from "../../config/shipping";
import { CR_PROVINCES, getCantons, getDistricts } from "../../config/crLocations";
import { cn } from "../../lib/utils";
import { type ShippingForm } from "./useShippingForm";

// Shared by both sale entry points (SaleModal and NewOrderModal) so the
// address → carrier → price rules can't drift apart between them.

const inputCls =
  "w-full rounded-xl border border-ink-200 px-4 py-2.5 text-sm text-brand-dark " +
  "placeholder:text-ink-300 outline-none focus:border-brand-primary " +
  "focus:ring-1 focus:ring-brand-primary/20 transition";

// ── UI ─────────────────────────────────────────────────────────────────────

function Radio({ checked }: { checked: boolean }) {
  return (
    <span className={cn(
      "w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors",
      checked ? "border-brand-primary" : "border-ink-300"
    )}>
      {checked && <span className="w-2 h-2 rounded-full bg-brand-primary" />}
    </span>
  );
}

function FieldError({ message }: { message?: string }) {
  return message ? <span className="text-[11px] text-red-500">{message}</span> : null;
}

interface ShippingFieldsProps {
  form:   ShippingForm;
  errors: Record<string, string>;
}

export function ShippingFields({ form, errors }: ShippingFieldsProps) {
  const {
    deliveryType, setDeliveryType,
    province, canton, district,
    selectProvince, selectCanton, selectDistrict,
    carrier, setCarrierChoice, availableCarriers,
    trackingNumber, setTrackingNumber, showTracking,
    shippingCost,
  } = form;

  return (
    <div className="flex flex-col gap-3">
      {(["personal", "envio"] as const).map((deliveryTypeOption) => (
        <label
          key={deliveryTypeOption}
          onClick={() => setDeliveryType(deliveryTypeOption)}
          className={cn(
            "flex items-center gap-3 rounded-xl border px-4 py-3 cursor-pointer transition-all",
            deliveryType === deliveryTypeOption
              ? "border-brand-primary bg-brand-primary/5"
              : "border-ink-200 hover:border-ink-300"
          )}
        >
          <Radio checked={deliveryType === deliveryTypeOption} />
          <div>
            <p className="text-sm text-brand-dark">
              {deliveryTypeOption === "personal" ? "Entrega personal (Grecia)" : "Envío"}
            </p>
            {deliveryTypeOption === "personal" && (
              <p className="text-[11px] text-ink-400">Gratis</p>
            )}
          </div>
        </label>
      ))}

      {deliveryType === "envio" && (
        <div className="flex flex-col gap-3 pt-1">

          {/* Province */}
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-ink-500 uppercase tracking-wider">
              Provincia
            </label>
            <select
              value={province}
              onChange={(e) => selectProvince(e.target.value)}
              className={inputCls}
            >
              <option value="">Seleccionar provincia…</option>
              {CR_PROVINCES.map((provinceName) => (
                <option key={provinceName} value={provinceName}>{provinceName}</option>
              ))}
            </select>
            <FieldError message={errors.province} />
          </div>

          {/* Canton — appears after province is selected */}
          {province && (
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-ink-500 uppercase tracking-wider">
                Cantón
              </label>
              <select
                value={canton}
                onChange={(e) => selectCanton(e.target.value)}
                className={inputCls}
              >
                <option value="">Seleccionar cantón…</option>
                {getCantons(province).map((cantonName) => (
                  <option key={cantonName} value={cantonName}>{cantonName}</option>
                ))}
              </select>
              <FieldError message={errors.canton} />
            </div>
          )}

          {/* District — appears after canton */}
          {canton && (
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-ink-500 uppercase tracking-wider">
                Distrito
              </label>
              <select
                value={district}
                onChange={(e) => selectDistrict(e.target.value)}
                className={inputCls}
              >
                <option value="">Seleccionar distrito…</option>
                {getDistricts(province, canton).map((districtName) => (
                  <option key={districtName} value={districtName}>{districtName}</option>
                ))}
              </select>
              <FieldError message={errors.district} />
            </div>
          )}

          {/* Shipping carrier — appears after canton (except Grecia) */}
          {canton && canton !== "Grecia" && (
            <div className="flex flex-col gap-2">
              <label className="text-xs font-medium text-ink-500 uppercase tracking-wider">
                Servicio de envío
              </label>

              {availableCarriers.length > 1 ? (
                /* District inside Mensajería ABM coverage: Mensajero or Correos */
                <div className="flex flex-col gap-2">
                  {availableCarriers.map((carrierOption) => {
                    const shippingResult = calculateShipping(canton, carrierOption);
                    const carrierLabel   = carrierOption === "mensajero" ? "Mensajero privado" : "Correos CR";
                    return (
                      <label
                        key={carrierOption}
                        onClick={() => setCarrierChoice(carrierOption)}
                        className={cn(
                          "flex items-center justify-between rounded-xl border px-4 py-3 cursor-pointer transition-all",
                          carrier === carrierOption
                            ? "border-brand-primary bg-brand-primary/5"
                            : "border-ink-200 hover:border-ink-300"
                        )}
                      >
                        <div className="flex items-center gap-3">
                          <Radio checked={carrier === carrierOption} />
                          <span className="text-sm text-brand-dark">{carrierLabel}</span>
                        </div>
                        <span className="text-xs font-semibold text-brand-primary">
                          ₡{shippingResult.cost.toLocaleString("en-US")}
                        </span>
                      </label>
                    );
                  })}
                </div>
              ) : (
                /* Outside mensajero coverage: Correos only */
                <div className="flex flex-col gap-1">
                  <div className="flex items-center justify-between rounded-xl border border-ink-200 px-4 py-3 bg-ink-50">
                    <span className="text-sm text-ink-600">Correos CR</span>
                    <span className="text-xs font-semibold text-brand-primary">
                      ₡{shippingCost.toLocaleString("en-US")}
                    </span>
                  </div>
                  <p className="text-[11px] text-ink-400 px-1">
                    {!cantonHasMensajero(canton)
                      ? "Cantón fuera de cobertura del mensajero — solo Correos CR."
                      : district
                        ? "Distrito fuera de cobertura del mensajero — solo Correos CR."
                        : "Seleccioná el distrito para ver si aplica mensajero."}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Tracking number — Correos only */}
          {showTracking && (
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-ink-500 uppercase tracking-wider">
                N.° de seguimiento{" "}
                <span className="normal-case text-ink-300">(opcional)</span>
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
  );
}
