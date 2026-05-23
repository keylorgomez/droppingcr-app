import { supabase } from "./supabaseClient";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface EmailOrderItem {
  product_name: string;
  variant_size: string;
  quantity: number;
  sale_price: number;
}

type EmailPayload =
  | { type: "welcome"; data: { email: string; first_name: string } }
  | {
      type: "new_order";
      data: {
        guest_phone:   string | null;
        guest_name:    string | null;
        items:         EmailOrderItem[];
        shipping_cost: number;
        total:         number;
      };
    }
  | {
      type: "payment_receipt";
      data: {
        guest_phone:  string | null;
        guest_name:   string | null;
        amount_paid:  number;
        total_owed:   number;
        remaining:    number;
        note:         string | null;
      };
    };

// ── Fire-and-forget — nunca bloquea la UI ────────────────────────────────────

export function sendTransactionalEmail(payload: EmailPayload): void {
  supabase.functions
    .invoke("send-email", { body: payload })
    .catch(() => {}); // silencioso — el flujo principal no se interrumpe
}
