import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { supabase } from "../lib/supabaseClient";
import { sendTransactionalEmail } from "../lib/emailService";
import type { User } from "@supabase/supabase-js";

// ── Types ──────────────────────────────────────────────────────────────────

export type UserRole = "admin" | "customer";

export interface UserProfile {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  whatsapp: string | null;
  role: UserRole;
}

interface AuthContextType {
  user: UserProfile | null;
  isLoading: boolean;
  refreshUser: () => Promise<void>;
  signOut: () => Promise<void>;
}

// ── Context ────────────────────────────────────────────────────────────────

const AuthContext = createContext<AuthContextType | null>(null);

async function fetchOrCreateProfile(
  authUser: User,
): Promise<{ profile: UserProfile | null; isNew: boolean }> {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, first_name, last_name, whatsapp, role")
    .eq("id", authUser.id)
    .maybeSingle();

  // Profile exists — return it
  if (!error && data) {
    return {
      profile: {
        id:         authUser.id,
        email:      authUser.email ?? "",
        first_name: data.first_name,
        last_name:  data.last_name,
        whatsapp:   data.whatsapp,
        role:       data.role,
      },
      isNew: false,
    };
  }

  // Profile missing — try to create from user_metadata (set during signUp)
  const meta = authUser.user_metadata ?? {};
  if (meta.first_name) {
    const { data: created, error: createError } = await supabase
      .from("profiles")
      .upsert(
        {
          id:         authUser.id,
          first_name: meta.first_name,
          last_name:  meta.last_name  ?? "",
          whatsapp:   meta.whatsapp   ?? null,
          role:       "customer",
        },
        { onConflict: "id" }
      )
      .select("id, first_name, last_name, whatsapp, role")
      .single();

    if (!createError && created) {
      return {
        profile: {
          id:         authUser.id,
          email:      authUser.email ?? "",
          first_name: created.first_name,
          last_name:  created.last_name,
          whatsapp:   created.whatsapp,
          role:       created.role,
        },
        isNew: true,
      };
    }
  }

  return { profile: null, isNew: false };
}

// ── Provider ───────────────────────────────────────────────────────────────

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser]         = useState<UserProfile | null>(null);
  const [isLoading, setLoading] = useState(true);

  useEffect(() => {
    // Initial session check
    supabase.auth.getSession()
      .then(async ({ data: { session } }) => {
        if (session?.user) {
          const { profile } = await fetchOrCreateProfile(session.user);
          if (profile) setUser(profile);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));

    // Listen for auth state changes
    // IMPORTANT: callback must be synchronous — Supabase SDK v2 awaits async
    // callbacks internally, which blocks signInWithPassword from resolving.
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (session?.user) {
          fetchOrCreateProfile(session.user)
            .then(({ profile, isNew }) => {
              if (profile) {
                setUser(profile);
                // isNew: true solo cuando confirmación de email está activa y el perfil
                // se crea al primer login. Si no hay confirmación, authService ya envió el correo.
                if (isNew) {
                  sendTransactionalEmail({
                    type: "welcome",
                    data: { email: profile.email, first_name: profile.first_name },
                  });
                }
              }
            })
            .catch(() => {})
            .finally(() => setLoading(false));
        } else {
          setUser(null);
          setLoading(false);
        }
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  async function refreshUser() {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user) {
      const { profile } = await fetchOrCreateProfile(session.user);
      setUser(profile);
    }
  }

  async function signOut() {
    await supabase.auth.signOut();
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, isLoading, refreshUser, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

// ── Hook ───────────────────────────────────────────────────────────────────

export function useAuth(): AuthContextType {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
