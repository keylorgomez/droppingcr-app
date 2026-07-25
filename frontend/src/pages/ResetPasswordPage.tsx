import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Eye, EyeOff, Loader2, ShieldCheck, KeyRound } from "lucide-react";
import { supabase } from "../lib/supabaseClient";
import { updatePassword } from "../services/authService";
import { useToast } from "../components/ui/Toast";
import Header from "../components/ui/Header";

// ── Shared field (mirrors AuthModal styling) ───────────────────────────────

function PasswordField({
  label, value, onChange, autoComplete,
}: {
  label: string; value: string; onChange: (v: string) => void; autoComplete?: string;
}) {
  const [show, setShow] = useState(false);
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-medium text-gray-500 font-poppins uppercase tracking-wider">
        {label}
      </label>
      <div className="relative">
        <input
          type={show ? "text" : "password"} value={value}
          onChange={(e) => onChange(e.target.value)} autoComplete={autoComplete}
          className="w-full rounded-xl border border-gray-200 px-4 py-2.5 pr-10 text-sm font-poppins
                     text-brand-dark outline-none focus:border-brand-primary
                     focus:ring-1 focus:ring-brand-primary/20 transition"
        />
        <button type="button" onClick={() => setShow(!show)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-brand-primary transition-colors">
          {show ? <EyeOff size={15} /> : <Eye size={15} />}
        </button>
      </div>
    </div>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────

type SessionStatus = "checking" | "ready" | "invalid";

export default function ResetPasswordPage() {
  const navigate = useNavigate();
  const { showToast } = useToast();

  const [status, setStatus]     = useState<SessionStatus>("checking");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm]   = useState("");
  const [error, setError]       = useState("");
  const [loading, setLoading]   = useState(false);

  // The reset email link opens here with a recovery token in the URL hash.
  // supabase-js (detectSessionInUrl) parses it and fires PASSWORD_RECOVERY.
  useEffect(() => {
    let settled = false;

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY" || session) {
        settled = true;
        setStatus("ready");
      }
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) { settled = true; setStatus("ready"); }
    });

    // If no recovery session materializes, the link is expired or already used.
    const timer = setTimeout(() => {
      if (!settled) setStatus("invalid");
    }, 3000);

    return () => { subscription.unsubscribe(); clearTimeout(timer); };
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (password !== confirm) { setError("Las contraseñas no coinciden."); return; }
    if (password.length < 6)  { setError("La contraseña debe tener al menos 6 caracteres."); return; }

    setLoading(true);
    try {
      await updatePassword(password);
      showToast("Contraseña actualizada. Ya podés usarla para ingresar.", "success");
      navigate("/", { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al actualizar la contraseña.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <Header />
      <main className="max-w-md mx-auto px-4 py-16">
        <div className="rounded-2xl border border-gray-100 shadow-sm px-8 py-8 bg-white">

          <div className="mb-6 text-center flex flex-col items-center gap-2">
            <div className="w-12 h-12 rounded-full bg-brand-primary/10 flex items-center justify-center">
              <KeyRound size={22} className="text-brand-primary" />
            </div>
            <span className="font-poppins font-semibold italic text-brand-primary text-xl">
              Nueva contraseña
            </span>
            <p className="text-xs text-gray-400 font-poppins">
              Elegí una contraseña nueva para tu cuenta
            </p>
          </div>

          {status === "checking" && (
            <div className="flex flex-col items-center gap-3 py-8 text-gray-400">
              <Loader2 size={22} className="animate-spin" />
              <p className="text-xs font-poppins">Validando el enlace…</p>
            </div>
          )}

          {status === "invalid" && (
            <div className="flex flex-col items-center gap-4 py-4 text-center">
              <p className="text-sm font-poppins text-brand-dark">
                Este enlace no es válido o ya expiró.
              </p>
              <p className="text-xs text-gray-400 font-poppins leading-relaxed">
                Los enlaces para restablecer contraseña caducan por seguridad. Volvé a solicitar
                uno desde el inicio de sesión.
              </p>
              <button type="button" onClick={() => navigate("/", { replace: true })}
                      className="mt-1 w-full py-3 rounded-xl bg-brand-primary text-white text-sm
                                 font-poppins font-medium hover:bg-[#7a3e18] transition-colors">
                Volver al inicio
              </button>
            </div>
          )}

          {status === "ready" && (
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <PasswordField label="Nueva contraseña" value={password} onChange={setPassword}
                             autoComplete="new-password" />
              <PasswordField label="Confirmar contraseña" value={confirm} onChange={setConfirm}
                             autoComplete="new-password" />
              {error && (
                <p className="text-xs text-red-500 font-poppins text-center bg-red-50 rounded-lg px-3 py-2">
                  {error}
                </p>
              )}
              <button type="submit" disabled={loading}
                      className="mt-1 w-full py-3 rounded-xl bg-brand-primary text-white text-sm
                                 font-poppins font-medium flex items-center justify-center gap-2
                                 hover:bg-[#7a3e18] transition-colors disabled:opacity-60">
                {loading ? <Loader2 size={15} className="animate-spin" /> : <ShieldCheck size={15} />}
                Guardar contraseña
              </button>
            </form>
          )}

        </div>
      </main>
    </>
  );
}
