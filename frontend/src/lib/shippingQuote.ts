import { getDefaultCarrier, calculateShipping, type Carrier } from "../config/shipping";

export interface ShippingChoice {
  province: string;
  canton:   string;
  district: string;
  carrier:  Carrier | null;
}

export const EMPTY_SHIPPING: ShippingChoice = { province: "", canton: "", district: "", carrier: null };

export const CARRIER_LABEL: Record<Carrier, string> = { mensajero: "Mensajero", correos: "Correos de CR" };

/** Costo del envío elegido, o null si la dirección todavía está incompleta. */
export function shippingQuote(choice: ShippingChoice): { cost: number; label: string } | null {
  if (!choice.canton || !choice.district) return null;
  if (choice.canton === "Grecia") return { cost: 0, label: "Entrega personal en Grecia" };
  const carrier = choice.carrier ?? getDefaultCarrier(choice.canton, choice.district);
  const { cost } = calculateShipping(choice.canton, carrier);
  return { cost, label: CARRIER_LABEL[carrier] };
}

