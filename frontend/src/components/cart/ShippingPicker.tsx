import { CR_PROVINCES, getCantons, getDistricts } from "../../config/crLocations";
import { getAvailableCarriers, getDefaultCarrier, calculateShipping } from "../../config/shipping";
import { CARRIER_LABEL, type ShippingChoice } from "../../lib/shippingQuote";
import { cn } from "../../lib/utils";

const selectCls =
  "w-full h-11 rounded-btn border border-ink-200 bg-white px-3 text-[13px] text-ink-900 " +
  "outline-none focus:border-ink-900 disabled:bg-ink-50 disabled:text-ink-300";

/**
 * Los mismos selectores de provincia/cantón/distrito del admin: el cliente ve
 * cuánto paga de envío antes de escribir, y el mensaje llega con la dirección
 * lista en vez de tener que preguntarla.
 */
export default function ShippingPicker({
  value,
  onChange,
}: {
  value: ShippingChoice;
  onChange: (next: ShippingChoice) => void;
}) {
  const cantons   = value.province ? getCantons(value.province) : [];
  const districts = value.province && value.canton ? getDistricts(value.province, value.canton) : [];
  const carriers  = value.canton && value.district ? getAvailableCarriers(value.canton, value.district) : [];
  const carrier   = value.carrier ?? (value.canton && value.district ? getDefaultCarrier(value.canton, value.district) : null);

  return (
    <div className="flex flex-col gap-2">
      <select
        aria-label="Provincia"
        className={selectCls}
        value={value.province}
        onChange={(e) => onChange({ province: e.target.value, canton: "", district: "", carrier: null })}
      >
        <option value="">Provincia</option>
        {CR_PROVINCES.map((p) => <option key={p} value={p}>{p}</option>)}
      </select>
      <div className="grid grid-cols-2 gap-2">
        <select
          aria-label="Cantón"
          className={selectCls}
          value={value.canton}
          disabled={!value.province}
          onChange={(e) => onChange({ ...value, canton: e.target.value, district: "", carrier: null })}
        >
          <option value="">Cantón</option>
          {cantons.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <select
          aria-label="Distrito"
          className={selectCls}
          value={value.district}
          disabled={!value.canton}
          onChange={(e) => onChange({ ...value, district: e.target.value, carrier: null })}
        >
          <option value="">Distrito</option>
          {districts.map((d) => <option key={d} value={d}>{d}</option>)}
        </select>
      </div>

      {carriers.length > 1 && (
        <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Forma de envío">
          {carriers.map((c) => {
            const active = carrier === c;
            return (
              <button
                key={c}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => onChange({ ...value, carrier: c })}
                className={cn(
                  "h-11 rounded-btn border text-[12px] transition-colors",
                  active ? "bg-ink-900 text-bone border-ink-900" : "border-ink-200 text-ink-700 hover:border-ink-900"
                )}
              >
                {CARRIER_LABEL[c]} · ₡{calculateShipping(value.canton, c).cost.toLocaleString("en-US")}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
