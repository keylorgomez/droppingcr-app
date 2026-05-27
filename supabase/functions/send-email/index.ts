import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// ── Tipos ─────────────────────────────────────────────────────────────────────

interface OrderItem {
  product_name: string;
  variant_size: string;
  quantity: number;
  sale_price: number;
}

// ── Templates HTML ────────────────────────────────────────────────────────────

function welcomeHtml(firstName: string): string {
  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1.0"/>
  <title>Bienvenido a Dropping CR</title>
</head>
<body style="margin:0;padding:0;background:#f2f2f2;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f2f2f2;padding:40px 16px;">
    <tr><td align="center">
      <table width="100%" style="max-width:540px;" cellpadding="0" cellspacing="0">

        <!-- Header -->
        <tr>
          <td style="background:#0a0a0a;border-radius:16px 16px 0 0;padding:32px 40px;text-align:center;">
            <p style="margin:0;font-size:20px;font-weight:700;letter-spacing:0.15em;color:#ffffff;text-transform:uppercase;">DROPPING CR</p>
            <p style="margin:6px 0 0;font-size:10px;letter-spacing:0.22em;color:#975023;text-transform:uppercase;">Streetwear · Costa Rica</p>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="background:#ffffff;padding:40px 40px 32px;">
            <p style="margin:0 0 6px;font-size:12px;color:#aaa;text-transform:uppercase;letter-spacing:0.12em;">Bienvenido/a</p>
            <h1 style="margin:0 0 22px;font-size:26px;font-weight:700;color:#0a0a0a;line-height:1.2;">Hola, ${firstName} 👋</h1>
            <p style="margin:0 0 14px;font-size:15px;color:#555;line-height:1.75;">
              Tu cuenta en <strong style="color:#0a0a0a;">Dropping CR</strong> está lista.
              Ya podés guardar tus favoritos y ver el estado de tus pedidos directo desde tu perfil.
            </p>
            <p style="margin:0 0 32px;font-size:15px;color:#555;line-height:1.75;">
              Los drops son limitados — cuando caiga uno nuevo, vas a querer ser el primero en saberlo.
            </p>
            <table cellpadding="0" cellspacing="0" width="100%">
              <tr>
                <td align="center">
                  <a href="https://droppingcr.com"
                     style="display:inline-block;background:#975023;color:#ffffff;text-decoration:none;
                            font-size:13px;font-weight:700;letter-spacing:0.1em;padding:14px 40px;
                            border-radius:50px;text-transform:uppercase;">
                    Ver catálogo
                  </a>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="background:#fafafa;border-radius:0 0 16px 16px;padding:20px 40px;text-align:center;border-top:1px solid #eeeeee;">
            <p style="margin:0;font-size:12px;color:#bbb;line-height:1.7;">
              ¿Preguntas? Escribinos por
              <a href="https://wa.me/50688364879" style="color:#975023;text-decoration:none;">WhatsApp</a>.<br/>
              © ${new Date().getFullYear()} Dropping CR · Costa Rica
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

function orderHtml(
  guestName: string | null,
  items: OrderItem[],
  shippingCost: number,
  total: number,
): string {
  const name = guestName?.trim() || "Cliente";

  const rows = items
    .map(
      (item) => `
      <tr>
        <td style="padding:14px 0;border-bottom:1px solid #f0f0f0;vertical-align:top;">
          <p style="margin:0;font-size:14px;font-weight:600;color:#0a0a0a;">${item.product_name}</p>
          <p style="margin:4px 0 0;font-size:12px;color:#999;">Talla: ${item.variant_size} &nbsp;·&nbsp; Cant: ${item.quantity}</p>
        </td>
        <td style="padding:14px 0;border-bottom:1px solid #f0f0f0;text-align:right;vertical-align:top;
                   font-size:14px;font-weight:600;color:#0a0a0a;white-space:nowrap;">
          ₡${(item.sale_price * item.quantity).toLocaleString("en-US")}
        </td>
      </tr>`,
    )
    .join("");

  const shippingRow = shippingCost > 0
    ? `<tr>
         <td style="padding:10px 0;border-bottom:1px solid #f0f0f0;font-size:13px;color:#777;">Envío</td>
         <td style="padding:10px 0;border-bottom:1px solid #f0f0f0;text-align:right;font-size:13px;color:#777;">
           ₡${shippingCost.toLocaleString("en-US")}
         </td>
       </tr>`
    : "";

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1.0"/>
  <title>Comprobante — Dropping CR</title>
</head>
<body style="margin:0;padding:0;background:#f2f2f2;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f2f2f2;padding:40px 16px;">
    <tr><td align="center">
      <table width="100%" style="max-width:540px;" cellpadding="0" cellspacing="0">

        <!-- Header -->
        <tr>
          <td style="background:#0a0a0a;border-radius:16px 16px 0 0;padding:32px 40px;text-align:center;">
            <p style="margin:0;font-size:20px;font-weight:700;letter-spacing:0.15em;color:#ffffff;text-transform:uppercase;">DROPPING CR</p>
            <p style="margin:6px 0 0;font-size:10px;letter-spacing:0.22em;color:#975023;text-transform:uppercase;">Comprobante de compra</p>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="background:#ffffff;padding:36px 40px 0;">
            <p style="margin:0 0 4px;font-size:12px;color:#aaa;text-transform:uppercase;letter-spacing:0.12em;">¡Gracias por tu compra!</p>
            <h1 style="margin:0 0 28px;font-size:22px;font-weight:700;color:#0a0a0a;">${name}</h1>

            <!-- Items -->
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td style="padding-bottom:10px;font-size:11px;font-weight:700;text-transform:uppercase;
                           letter-spacing:0.12em;color:#aaa;border-bottom:2px solid #0a0a0a;">Producto</td>
                <td style="padding-bottom:10px;font-size:11px;font-weight:700;text-transform:uppercase;
                           letter-spacing:0.12em;color:#aaa;border-bottom:2px solid #0a0a0a;text-align:right;">Subtotal</td>
              </tr>
              ${rows}
              ${shippingRow}
              <!-- Total -->
              <tr>
                <td style="padding:18px 0 0;font-size:15px;font-weight:700;color:#0a0a0a;">Total a pagar</td>
                <td style="padding:18px 0 0;text-align:right;font-size:22px;font-weight:700;color:#975023;">
                  ₡${total.toLocaleString("en-US")}
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="background:#fafafa;border-radius:0 0 16px 16px;padding:20px 40px;
                     text-align:center;border-top:1px solid #eeeeee;">
            <p style="margin:0;font-size:12px;color:#bbb;line-height:1.7;">
              ¿Preguntas? Escribinos por
              <a href="https://wa.me/50688364879" style="color:#975023;text-decoration:none;">WhatsApp</a>.<br/>
              © ${new Date().getFullYear()} Dropping CR · Costa Rica
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

function paymentReceiptHtml(
  guestName:   string | null,
  amountPaid:  number,
  totalOwed:   number,
  remaining:   number,
  note:        string | null,
): string {
  const name       = guestName?.trim() || "Cliente";
  const isPaidOff  = remaining <= 0;

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1.0"/>
  <title>Abono recibido — Dropping CR</title>
</head>
<body style="margin:0;padding:0;background:#f2f2f2;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f2f2f2;padding:40px 16px;">
    <tr><td align="center">
      <table width="100%" style="max-width:540px;" cellpadding="0" cellspacing="0">

        <!-- Header -->
        <tr>
          <td style="background:#0a0a0a;border-radius:16px 16px 0 0;padding:32px 40px;text-align:center;">
            <p style="margin:0;font-size:20px;font-weight:700;letter-spacing:0.15em;color:#ffffff;text-transform:uppercase;">DROPPING CR</p>
            <p style="margin:6px 0 0;font-size:10px;letter-spacing:0.22em;color:#975023;text-transform:uppercase;">Comprobante de abono</p>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="background:#ffffff;padding:36px 40px 32px;">
            <p style="margin:0 0 4px;font-size:12px;color:#aaa;text-transform:uppercase;letter-spacing:0.12em;">Hola,</p>
            <h1 style="margin:0 0 24px;font-size:22px;font-weight:700;color:#0a0a0a;">${name} 👋</h1>

            <p style="margin:0 0 24px;font-size:15px;color:#555;line-height:1.75;">
              Registramos un abono a tu cuenta. Acá te dejamos el resumen:
            </p>

            <!-- Payment summary box -->
            <table width="100%" cellpadding="0" cellspacing="0"
                   style="background:#f9f9f9;border-radius:12px;padding:0;overflow:hidden;border:1px solid #eeeeee;">
              <tr>
                <td style="padding:16px 20px;border-bottom:1px solid #eeeeee;">
                  <span style="font-size:12px;color:#999;text-transform:uppercase;letter-spacing:0.1em;">Abono recibido</span><br/>
                  <span style="font-size:24px;font-weight:700;color:#975023;">₡${amountPaid.toLocaleString("en-US")}</span>
                </td>
              </tr>
              <tr>
                <td style="padding:16px 20px;border-bottom:1px solid #eeeeee;">
                  <span style="font-size:12px;color:#999;text-transform:uppercase;letter-spacing:0.1em;">Total de tu pedido</span><br/>
                  <span style="font-size:16px;font-weight:600;color:#0a0a0a;">₡${totalOwed.toLocaleString("en-US")}</span>
                </td>
              </tr>
              <tr>
                <td style="padding:16px 20px;">
                  <span style="font-size:12px;color:#999;text-transform:uppercase;letter-spacing:0.1em;">Saldo pendiente</span><br/>
                  <span style="font-size:20px;font-weight:700;color:${isPaidOff ? "#22c55e" : "#dc2626"};">
                    ${isPaidOff ? "✓ Pagado completo" : `₡${remaining.toLocaleString("en-US")}`}
                  </span>
                </td>
              </tr>
            </table>

            ${note ? `
            <div style="margin-top:20px;background:#ffefd1;border-radius:12px;padding:14px 18px;">
              <p style="margin:0;font-size:13px;color:#975023;line-height:1.65;">
                📝 Nota: ${note}
              </p>
            </div>` : ""}

            <p style="margin:24px 0 0;font-size:13px;color:#aaa;line-height:1.65;">
              Cualquier consulta nos podés escribir por WhatsApp.
            </p>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="background:#fafafa;border-radius:0 0 16px 16px;padding:20px 40px;
                     text-align:center;border-top:1px solid #eeeeee;">
            <p style="margin:0;font-size:12px;color:#bbb;line-height:1.7;">
              <a href="https://wa.me/50688364879" style="color:#975023;text-decoration:none;">WhatsApp</a> · ¿Preguntas? Con gusto te ayudamos.<br/>
              © ${new Date().getFullYear()} Dropping CR · Costa Rica
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

// ── Handler ───────────────────────────────────────────────────────────────────

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { type, data } = await req.json();

    const resendKey  = Deno.env.get("RESEND_API_KEY");
    const fromEmail  = Deno.env.get("RESEND_FROM_EMAIL") ?? "Dropping CR <noreply@droppingcr.com>";

    if (!resendKey) throw new Error("RESEND_API_KEY not configured");

    let toEmail: string | null = null;
    let subject = "";
    let html    = "";

    // ── Welcome ──────────────────────────────────────────────────────────────
    if (type === "welcome") {
      toEmail = data.email;
      subject = "¡Bienvenido/a a Dropping CR! 🔥";
      html    = welcomeHtml(data.first_name ?? "");

    // ── New order ────────────────────────────────────────────────────────────
    } else if (type === "new_order") {
      // Buscar email del cliente por su número de WhatsApp
      const supabaseAdmin = createClient(
        Deno.env.get("SUPABASE_URL")               ?? "",
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")  ?? "",
      );

      const phone = (data.guest_phone ?? "").replace(/\D/g, "").slice(-8);

      if (phone) {
        const { data: profiles } = await supabaseAdmin
          .from("profiles")
          .select("id, whatsapp")
          .not("whatsapp", "is", null);

        const match = (profiles ?? []).find(
          (p: { id: string; whatsapp: string }) =>
            p.whatsapp?.replace(/\D/g, "").slice(-8) === phone,
        );

        if (match) {
          const result = await supabaseAdmin.auth.admin.getUserById(match.id);
          toEmail = result.data?.user?.email ?? null;
        }
      }

      // Sin email registrado → omitir silenciosamente
      if (!toEmail) {
        return new Response(
          JSON.stringify({ skipped: "no registered email for this phone" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      subject = "¡Tu compra en Dropping CR está registrada! 📦";
      html    = orderHtml(
        data.guest_name   ?? null,
        data.items        ?? [],
        data.shipping_cost ?? 0,
        data.total        ?? 0,
      );

    // ── Payment receipt ──────────────────────────────────────────────────────
    } else if (type === "payment_receipt") {
      const supabaseAdmin = createClient(
        Deno.env.get("SUPABASE_URL")              ?? "",
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      );

      const phone = (data.guest_phone ?? "").replace(/\D/g, "").slice(-8);

      if (phone) {
        const { data: profiles } = await supabaseAdmin
          .from("profiles")
          .select("id, whatsapp")
          .not("whatsapp", "is", null);

        const match = (profiles ?? []).find(
          (p: { id: string; whatsapp: string }) =>
            p.whatsapp?.replace(/\D/g, "").slice(-8) === phone,
        );

        if (match) {
          const result = await supabaseAdmin.auth.admin.getUserById(match.id);
          toEmail = result.data?.user?.email ?? null;
        }
      }

      if (!toEmail) {
        return new Response(
          JSON.stringify({ skipped: "no registered email for this phone" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      subject = "Abono registrado en Dropping CR 🧾";
      html    = paymentReceiptHtml(
        data.guest_name  ?? null,
        data.amount_paid ?? 0,
        data.total_owed  ?? 0,
        data.remaining   ?? 0,
        data.note        ?? null,
      );

    } else {
      throw new Error(`Unknown email type: ${type}`);
    }

    // ── Validar email antes de enviar ────────────────────────────────────────
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!toEmail || !emailRegex.test(toEmail)) {
      console.error("Invalid email address, skipping:", toEmail);
      return new Response(
        JSON.stringify({ skipped: "invalid email address", email: toEmail }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // ── Envío con Resend ─────────────────────────────────────────────────────
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${resendKey}`,
        "Content-Type":  "application/json",
      },
      body: JSON.stringify({ from: fromEmail, to: [toEmail], subject, html }),
    });

    const resData = await res.json();
    if (!res.ok) {
      console.error("Resend error:", JSON.stringify(resData));
    }
    return new Response(JSON.stringify(resData), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status:  res.ok ? 200 : 400,
    });

  } catch (err) {
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status:  500,
      },
    );
  }
});
