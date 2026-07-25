import { supabase } from "../lib/supabaseClient";

// ── Error mapping ──────────────────────────────────────────────────────────

function mapAuthError(message: string): string {
  if (message.includes("Invalid login credentials"))
    return "Credenciales inválidas. Verifica tu correo y contraseña.";
  if (message.includes("Email not confirmed"))
    return "Debes confirmar tu correo electrónico antes de ingresar.";
  if (message.includes("User already registered") || message.includes("already been registered"))
    return "Ya existe una cuenta con este correo electrónico.";
  if (message.includes("Password should be"))
    return "La contraseña debe tener al menos 6 caracteres.";
  if (
    message.includes("429") ||
    message.includes("Too Many Requests") ||
    message.includes("rate limit") ||
    message.includes("For security purposes")
  )
    return "Demasiados intentos. Espera unos minutos antes de volver a intentarlo.";
  return "Ocurrió un error. Por favor intenta de nuevo.";
}

// ── Sign in ────────────────────────────────────────────────────────────────
// Only authenticates. Profile is fetched by AuthContext via onAuthStateChange.

export async function signIn(email: string, password: string): Promise<void> {
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    const status = (error as { status?: number }).status;
    if (status === 429)
      throw new Error("Demasiados intentos. Espera unos minutos antes de volver a intentarlo.");
    throw new Error(mapAuthError(error.message));
  }
}

// ── Google OAuth ─────────────────────────────────────────────────────────────
// Redirects the browser to Google. On return, AuthContext.onAuthStateChange
// picks up the session and fetchOrCreateProfile builds the profile from Google's
// metadata (whatsapp stays null → CompleteProfileModal prompts for it).

export async function signInWithGoogle(): Promise<void> {
  const { error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: `${window.location.origin}/` },
  });
  if (error) throw new Error(mapAuthError(error.message));
}

// ── Password reset ─────────────────────────────────────────────────────────
// Sends the recovery email. Supabase redirects back to /reset-password where
// the client auto-establishes a recovery session (detectSessionInUrl).

export async function resetPassword(email: string): Promise<void> {
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/reset-password`,
  });

  if (error) {
    const status = (error as { status?: number }).status;
    if (status === 429)
      throw new Error("Demasiados intentos. Espera unos minutos antes de volver a intentarlo.");
    throw new Error(mapAuthError(error.message));
  }
}

// ── Update password ────────────────────────────────────────────────────────
// Called from the reset landing page once the recovery session is active.

export async function updatePassword(newPassword: string): Promise<void> {
  const { error } = await supabase.auth.updateUser({ password: newPassword });

  if (error) {
    const status = (error as { status?: number }).status;
    if (status === 429)
      throw new Error("Demasiados intentos. Espera unos minutos antes de volver a intentarlo.");
    throw new Error(mapAuthError(error.message));
  }
}

// ── Sign up ────────────────────────────────────────────────────────────────

interface RegisterData {
  email: string;
  password: string;
  first_name: string;
  last_name: string;
  whatsapp: string | null;
}

export interface SignUpResult {
  requiresEmailConfirmation: boolean;
}

export async function signUp(data: RegisterData): Promise<SignUpResult> {
  // Store profile fields in user_metadata so they survive email confirmation
  const { data: authData, error: signUpError } = await supabase.auth.signUp({
    email:    data.email,
    password: data.password,
    options: {
      data: {
        first_name: data.first_name,
        last_name:  data.last_name,
        whatsapp:   data.whatsapp,
      },
    },
  });

  if (signUpError) {
    const status = (signUpError as { status?: number }).status;
    if (status === 429)
      throw new Error("Demasiados intentos. Espera unos minutos antes de volver a intentarlo.");
    throw new Error(mapAuthError(signUpError.message));
  }

  if (!authData.user) throw new Error(mapAuthError(""));

  // If there's an active session (email confirmation disabled), save profile now.
  // The welcome email is NOT sent here — AuthContext sends it once via the
  // welcome_sent flag, uniformly across all signup methods (manual, Google, etc.).
  if (authData.session) {
    await supabase.from("profiles").upsert(
      {
        id:         authData.user.id,
        first_name: data.first_name,
        last_name:  data.last_name,
        whatsapp:   data.whatsapp,
        role:       "customer",
      },
      { onConflict: "id" }
    );
  }

  return { requiresEmailConfirmation: !authData.session };
}
