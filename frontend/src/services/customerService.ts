import { supabase } from "../lib/supabaseClient";

// Auto-fill helper for the admin sale/order forms: given a WhatsApp number,
// returns the customer's name if we've seen them before (registered profile or
// past sale/order history). Returns null when there's no match. Admin-gated in
// the DB function itself, so it's safe to call from the client.

export async function lookupCustomerByPhone(phone: string): Promise<string | null> {
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 8) return null;

  const { data, error } = await supabase.rpc("lookup_customer_by_phone", {
    phone_input: digits,
  });

  if (error) return null;
  const name = typeof data === "string" ? data.trim() : "";
  return name || null;
}

export interface CustomerMatch {
  /** id del perfil registrado, o null si solo lo conocemos del historial. */
  customer_id: string | null;
  name:        string | null;
}

/**
 * Igual que `lookupCustomerByPhone`, pero además devuelve el id del perfil para
 * poder enlazar la venta en el momento. Sin id (cliente no registrado) la venta
 * queda de invitado y se reclama sola cuando la persona se registre.
 */
export async function lookupCustomerProfileByPhone(phone: string): Promise<CustomerMatch | null> {
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 8) return null;

  const { data, error } = await supabase.rpc("lookup_customer_profile_by_phone", {
    phone_input: digits,
  });
  if (error) return null;

  const row = Array.isArray(data) ? data[0] : null;
  if (!row) return null;

  const name = typeof row.full_name === "string" ? row.full_name.trim() : "";
  return { customer_id: row.customer_id ?? null, name: name || null };
}
