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

// Derive a display name from our own signup metadata (first_name/last_name)
// or, for Google OAuth, from Google's metadata (given_name/family_name/name).
function deriveNames(authUser: User): { firstName: string; lastName: string } {
  const meta = authUser.user_metadata ?? {};
  const fullName = typeof meta.full_name === "string" ? meta.full_name
                 : typeof meta.name === "string"      ? meta.name
                 : "";
  const firstName =
    (meta.first_name as string | undefined) ||
    (meta.given_name as string | undefined) ||
    (fullName ? fullName.split(" ")[0] : "") ||
    (authUser.email ? authUser.email.split("@")[0] : "") ||
    "";
  const lastName =
    (meta.last_name as string | undefined) ||
    (meta.family_name as string | undefined) ||
    (fullName ? fullName.split(" ").slice(1).join(" ") : "") ||
    "";
  return { firstName, lastName };
}

interface ProfileRow {
  id: string;
  first_name: string | null;
  last_name: string | null;
  whatsapp: string | null;
  role: UserRole;
  welcome_sent: boolean;
}

async function fetchOrCreateProfile(
  authUser: User,
): Promise<{ profile: UserProfile | null; needsWelcome: boolean }> {
  const PROFILE_COLS = "id, first_name, last_name, whatsapp, role, welcome_sent";

  // 1. Read the existing profile (a DB trigger usually pre-creates it on signup).
  const { data, error } = await supabase
    .from("profiles")
    .select(PROFILE_COLS)
    .eq("id", authUser.id)
    .maybeSingle();

  let row: ProfileRow | null = !error && data ? (data as ProfileRow) : null;

  // 2. Create it if missing (fallback when there's no trigger).
  if (!row) {
    const meta = authUser.user_metadata ?? {};
    const derived = deriveNames(authUser);
    const { data: created } = await supabase
      .from("profiles")
      .upsert(
        {
          id:         authUser.id,
          first_name: derived.firstName,
          last_name:  derived.lastName,
          whatsapp:   meta.whatsapp ?? null,
          role:       "customer",
        },
        { onConflict: "id" }
      )
      .select(PROFILE_COLS)
      .single();
    row = (created as ProfileRow) ?? null;
  }

  if (!row) return { profile: null, needsWelcome: false };

  // 3. Backfill the name if empty — Google OAuth sends given_name, not first_name,
  //    so a trigger-created row can land here with a null name.
  let firstName = row.first_name;
  let lastName  = row.last_name;
  if (!firstName) {
    const derived = deriveNames(authUser);
    firstName = derived.firstName;
    lastName  = lastName || derived.lastName;
    if (firstName) {
      await supabase.from("profiles")
        .update({ first_name: firstName, last_name: lastName })
        .eq("id", authUser.id);
    }
  }

  // 4. Atomically claim the welcome email: flip welcome_sent false→true and only
  //    the caller that actually flipped it sends the email. This is race-safe
  //    across the getSession + onAuthStateChange paths and multiple tabs.
  let needsWelcome = false;
  if (row.welcome_sent === false) {
    const { data: claimed } = await supabase
      .from("profiles")
      .update({ welcome_sent: true })
      .eq("id", authUser.id)
      .eq("welcome_sent", false)
      .select("id");
    needsWelcome = !!(claimed && claimed.length);
  }

  return {
    profile: {
      id:         authUser.id,
      email:      authUser.email ?? "",
      first_name: firstName ?? "",
      last_name:  lastName ?? "",
      whatsapp:   row.whatsapp,
      role:       row.role,
    },
    needsWelcome,
  };
}

function sendWelcome(profile: UserProfile) {
  if (!profile.email) return;
  sendTransactionalEmail({
    type: "welcome",
    data: { email: profile.email, first_name: profile.first_name },
  });
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
          const { profile, needsWelcome } = await fetchOrCreateProfile(session.user);
          if (profile) {
            setUser(profile);
            if (needsWelcome) sendWelcome(profile);
          }
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));

    // Listen for auth state changes
    // IMPORTANT: callback must be synchronous — Supabase SDK v2 awaits async
    // callbacks internally, which blocks signInWithPassword from resolving.
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        if (session?.user) {
          fetchOrCreateProfile(session.user)
            .then(({ profile, needsWelcome }) => {
              if (profile) {
                setUser(profile);
                // Fires once per account (any signup method), gated by the atomic
                // welcome_sent claim inside fetchOrCreateProfile.
                if (needsWelcome) sendWelcome(profile);
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
