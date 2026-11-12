import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// La llave anónima es pública (viaja en el frontend) y es un JWT válido, así
// que `verify_jwt` por sí solo NO protege una función: cualquiera puede
// llamarla. Cada función revisa aquí quién llama de verdad.

const ALLOWED_ORIGINS = [
  "https://droppingcr.com",
  "https://www.droppingcr.com",
  "http://localhost:5173",
];

export function corsFor(req: Request): Record<string, string> {
  const origin = req.headers.get("origin") ?? "";
  return {
    "Access-Control-Allow-Origin": ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0],
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Vary": "Origin",
  };
}

export interface Caller {
  id:      string;
  email:   string | null;
  isAdmin: boolean;
}

/** Usuario dueño del JWT del request, o null si es la llave anónima / inválido. */
export async function getCaller(req: Request): Promise<Caller | null> {
  const token = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!token) return null;

  const admin = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
  );

  const { data, error } = await admin.auth.getUser(token);
  if (error || !data.user) return null;

  const { data: profile } = await admin
    .from("profiles")
    .select("role")
    .eq("id", data.user.id)
    .maybeSingle();

  return {
    id:      data.user.id,
    email:   data.user.email ?? null,
    isAdmin: profile?.role === "admin",
  };
}

/** Todo texto que venga del request y termine dentro de un HTML. */
export function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
