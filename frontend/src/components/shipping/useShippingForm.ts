import { useState } from "react";
import { type ShippingMethod } from "../../services/salesService";
import {
  calculateShipping,
  getAvailableCarriers,
  getDefaultCarrier,
  type Carrier,
} from "../../config/shipping";

// Address → carrier → price state shared by both sale entry points
// (SaleModal and NewOrderModal); rendered by <ShippingFields>.

type DeliveryType = "personal" | "envio";

// ── State hook ─────────────────────────────────────────────────────────────

export function useShippingForm() {
  const [deliveryType,   setDeliveryType]   = useState<DeliveryType>("personal");
  const [province,       setProvince]       = useState("");
  const [canton,         setCanton]         = useState("");
  const [district,       setDistrict]       = useState("");
  const [carrierChoice,  setCarrierChoice]  = useState<Carrier>("mensajero");
  const [trackingNumber, setTrackingNumber] = useState("");

  const availableCarriers: Carrier[] = canton ? getAvailableCarriers(canton, district) : [];
  // Mensajero may have been picked before the district was changed to one outside coverage.
  const carrier: Carrier = availableCarriers.includes(carrierChoice) ? carrierChoice : "correos";

  const { method: shippingMethod, cost: shippingCost }: { method: ShippingMethod; cost: number } =
    deliveryType === "personal" || canton === "Grecia"
      ? { method: "personal_grecia", cost: 0 }
      : canton
        ? calculateShipping(canton, carrier)
        : { method: "personal_grecia", cost: 0 };

  const isEnvio      = deliveryType === "envio";
  const showTracking = isEnvio && carrier === "correos" && canton !== "Grecia";

  function selectProvince(value: string) {
    setProvince(value);
    setCanton("");
    setDistrict("");
    setCarrierChoice("mensajero");
  }

  function selectCanton(value: string) {
    setCanton(value);
    setDistrict("");
    if (value === "Grecia") setDeliveryType("personal");
    else if (value)         setCarrierChoice(getDefaultCarrier(value, ""));
  }

  function selectDistrict(value: string) {
    setDistrict(value);
    setCarrierChoice(getDefaultCarrier(canton, value));
  }

  /** Field errors for an incomplete address; empty when delivery is personal. */
  function validate(): Record<string, string> {
    const validationErrors: Record<string, string> = {};
    if (!isEnvio) return validationErrors;
    if (!province)                validationErrors.province = "Selecciona una provincia.";
    else if (!canton)             validationErrors.canton   = "Selecciona un cantón.";
    else if (!district)           validationErrors.district = "Selecciona un distrito.";
    return validationErrors;
  }

  return {
    deliveryType, setDeliveryType,
    province, canton, district,
    selectProvince, selectCanton, selectDistrict,
    carrier, setCarrierChoice, availableCarriers,
    trackingNumber, setTrackingNumber, showTracking,
    shippingMethod, shippingCost,
    validate,
    /** Address to persist with the sale/order; null when delivery is personal. */
    address: {
      province: isEnvio ? (province || null) : null,
      canton:   isEnvio ? (canton   || null) : null,
      district: isEnvio ? (district || null) : null,
    },
    tracking: showTracking ? (trackingNumber.trim() || null) : null,
  };
}

export type ShippingForm = ReturnType<typeof useShippingForm>;
