import { supabase } from "../lib/supabaseClient";

// ── Types ──────────────────────────────────────────────────────────────────

export interface ProfileUpdate {
  first_name?: string;
  last_name?: string;
  whatsapp?: string | null;
}

// ── Update profile ─────────────────────────────────────────────────────────

export async function updateProfile(userId: string, data: ProfileUpdate): Promise<void> {
  const { error } = await supabase
    .from("profiles")
    .update(data)
    .eq("id", userId);

  if (error) throw new Error("No se pudo actualizar el perfil. Intenta de nuevo.");
}
