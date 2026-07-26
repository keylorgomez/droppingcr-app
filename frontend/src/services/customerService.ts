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
