import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { Webhook } from "https://esm.sh/standardwebhooks@1.0.0";

// ── Send Email Hook ──────────────────────────────────────────────────────────
// Supabase calls this function for EVERY auth email (recovery, signup
// confirmation, magic link, email change, etc.) once the hook is enabled.
// It must therefore handle every action type — anything unhandled still sends a
// branded generic email so no auth flow breaks.

const WHATSAPP = "https://wa.me/50688364879";
const INK   = "#0a0a0a";  // negro tinta — botones y cifras
const BONE  = "#faf9f7";  // blanco hueso — texto sobre negro
const MUTED = "#909090";  // gris del eyebrow sobre el header negro

// ── Shared HTML shell ────────────────────────────────────────────────────────

function shell(opts: {
  eyebrow:  string;
  heading:  string;
  body:     string;
  ctaLabel: string;
  ctaLink:  string;
  footer?:  string;
}): string {
  const { eyebrow, heading, body, ctaLabel, ctaLink, footer } = opts;
  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1.0"/>
  <title>Dropping CR</title>
</head>
<body style="margin:0;padding:0;background:#f5f4f2;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f4f2;padding:40px 16px;">
    <tr><td align="center">
      <table width="100%" style="max-width:540px;" cellpadding="0" cellspacing="0">

        <!-- Header -->
        <tr>
          <td style="background:#0a0a0a;border-radius:16px 16px 0 0;padding:32px 40px;text-align:center;">
            <p style="margin:0;font-size:20px;font-weight:700;letter-spacing:0.15em;color:#ffffff;text-transform:uppercase;">DROPPING CR</p>
            <p style="margin:6px 0 0;font-size:10px;letter-spacing:0.22em;color:${MUTED};text-transform:uppercase;">Streetwear · Costa Rica</p>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="background:#ffffff;padding:40px 40px 32px;">
            <p style="margin:0 0 6px;font-size:12px;color:#aaa;text-transform:uppercase;letter-spacing:0.12em;">${eyebrow}</p>
            <h1 style="margin:0 0 22px;font-size:26px;font-weight:700;color:#0a0a0a;line-height:1.2;">${heading}</h1>
            <p style="margin:0 0 28px;font-size:15px;color:#555;line-height:1.75;">${body}</p>
            <table cellpadding="0" cellspacing="0" width="100%">
              <tr>
                <td align="center">
                  <a href="${ctaLink}"
                     style="display:inline-block;background:${INK};color:${BONE};text-decoration:none;
                            font-size:13px;font-weight:700;letter-spacing:0.1em;padding:14px 40px;
                            border-radius:10px;text-transform:uppercase;">
                    ${ctaLabel}
                  </a>
                </td>
              </tr>
            </table>
            ${footer ? `<p style="margin:28px 0 0;font-size:13px;color:#aaa;line-height:1.65;">${footer}</p>` : ""}
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="background:#fafafa;border-radius:0 0 16px 16px;padding:20px 40px;text-align:center;border-top:1px solid #eeeeee;">
            <p style="margin:0;font-size:12px;color:#bbb;line-height:1.7;">
              ¿Preguntas? Escribinos por
              <a href="${WHATSAPP}" style="color:${INK};text-decoration:underline;">WhatsApp</a>.<br/>
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

// ── Per-action content ───────────────────────────────────────────────────────

function contentFor(actionType: string, ctaLink: string): { subject: string; html: string } {
  switch (actionType) {
    case "recovery":
      return {
        subject: "Restablecé tu contraseña — Dropping CR 🔑",
        html: shell({
          eyebrow:  "Restablecer contraseña",
          heading:  "¿Olvidaste tu contraseña?",
          body:     "No hay problema. Hacé clic en el botón para crear una nueva contraseña para tu cuenta. Si no lo solicitaste, podés ignorar este correo — tu contraseña actual sigue funcionando.",
          ctaLabel: "Crear nueva contraseña",
          ctaLink,
          footer:   "Por seguridad, este enlace caduca en una hora.",
        }),
      };
    case "signup":
    case "email":
      return {
        subject: "Confirmá tu correo — Dropping CR 🔥",
        html: shell({
          eyebrow:  "Casi listo",
          heading:  "Confirmá tu cuenta",
          body:     "Gracias por unirte a Dropping CR. Confirmá tu correo para activar tu cuenta y empezar a ver los drops.",
          ctaLabel: "Confirmar correo",
          ctaLink,
        }),
      };
    case "email_change":
      return {
        subject: "Confirmá tu nuevo correo — Dropping CR",
        html: shell({
          eyebrow:  "Cambio de correo",
          heading:  "Confirmá tu nuevo correo",
          body:     "Recibimos una solicitud para cambiar el correo de tu cuenta. Confirmá para aplicar el cambio.",
          ctaLabel: "Confirmar cambio",
          ctaLink,
        }),
      };
    case "magiclink":
      return {
        subject: "Tu enlace de acceso — Dropping CR",
        html: shell({
          eyebrow:  "Acceso rápido",
          heading:  "Ingresá a tu cuenta",
          body:     "Usá el botón para iniciar sesión en Dropping CR. Si no lo solicitaste, ignorá este correo.",
          ctaLabel: "Iniciar sesión",
          ctaLink,
        }),
      };
    default:
      return {
        subject: "Acción requerida — Dropping CR",
        html: shell({
          eyebrow:  "Dropping CR",
          heading:  "Confirmá tu solicitud",
          body:     "Hacé clic en el botón para continuar con la acción que solicitaste en tu cuenta.",
          ctaLabel: "Continuar",
          ctaLink,
        }),
      };
  }
}

// ── Handler ───────────────────────────────────────────────────────────────────

serve(async (req) => {
  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const resendKey   = Deno.env.get("RESEND_API_KEY");
  const fromEmail   = Deno.env.get("RESEND_FROM_EMAIL") ?? "Dropping CR <noreply@droppingcr.com>";
  const hookSecret  = Deno.env.get("SEND_EMAIL_HOOK_SECRET") ?? "";

  const raw = await req.text();

  // Verify the Standard Webhooks signature so only Supabase can trigger sends.
  let payload: {
    user: { email: string };
    email_data: {
      token_hash: string;
      redirect_to: string;
      email_action_type: string;
    };
  };
  try {
    const wh = new Webhook(hookSecret.replace(/^v1,/, ""));
    payload = wh.verify(raw, Object.fromEntries(req.headers)) as typeof payload;
  } catch {
    return new Response(JSON.stringify({ error: "invalid signature" }), { status: 401 });
  }

  if (!resendKey) {
    return new Response(JSON.stringify({ error: "RESEND_API_KEY not configured" }), { status: 500 });
  }

  const { user, email_data } = payload;
  const { token_hash, redirect_to, email_action_type } = email_data;

  // For password recovery, link straight to the app with the token as a query
  // param so the token is only consumed when the user submits (via verifyOtp).
  // This survives email-link prefetching (Gmail/security scanners) that would
  // otherwise consume a one-time /auth/v1/verify link before the user clicks it.
  // Other action types keep the standard verify link.
  const appLink =
    redirect_to +
    (redirect_to.includes("?") ? "&" : "?") +
    `token_hash=${token_hash}&type=${email_action_type}`;
  const verifyLink =
    `${supabaseUrl}/auth/v1/verify?token=${token_hash}` +
    `&type=${email_action_type}` +
    `&redirect_to=${encodeURIComponent(redirect_to)}`;

  const ctaLink = email_action_type === "recovery" ? appLink : verifyLink;

  const { subject, html } = contentFor(email_action_type, ctaLink);

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${resendKey}`,
      "Content-Type":  "application/json",
    },
    body: JSON.stringify({ from: fromEmail, to: [user.email], subject, html }),
  });

  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    console.error("Resend error:", JSON.stringify(errData));
    return new Response(JSON.stringify({ error: "send failed" }), { status: 500 });
  }

  return new Response(JSON.stringify({}), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
});
