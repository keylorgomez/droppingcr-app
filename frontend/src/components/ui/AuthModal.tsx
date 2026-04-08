import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { signIn, signUp } from "../../services/authService";
import { useToast } from "./Toast";
import { Dialog, DialogContent } from "./dialog";

// ── Types ──────────────────────────────────────────────────────────────────

type FormMode = "login" | "register";

interface AuthModalProps {
  open: boolean;
  onClose: () => void;
}

// ── Shared field components ────────────────────────────────────────────────

function Field({
  label, type = "text", value, onChange, placeholder, autoComplete,
}: {
  label: string; type?: string; value: string; onChange: (v: string) => void;
  placeholder?: string; autoComplete?: string;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-medium text-gray-500 font-poppins uppercase tracking-wider">
        {label}
      </label>
      <input
        type={type} value={value} onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder} autoComplete={autoComplete}
        className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-poppins
                   text-brand-dark placeholder:text-gray-300 outline-none
                   focus:border-brand-primary focus:ring-1 focus:ring-brand-primary/20 transition"
      />
    </div>
  );
}

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

function SubmitButton({ loading, label }: { loading: boolean; label: string }) {
  return (
    <button type="submit" disabled={loading}
            className="mt-1 w-full py-3 rounded-xl bg-brand-primary text-white text-sm
                       font-poppins font-medium flex items-center justify-center gap-2
                       hover:bg-[#7a3e18] transition-colors disabled:opacity-60">
      {loading && <Loader2 size={15} className="animate-spin" />}
      {label}
    </button>
  );
}

function ErrorBanner({ message }: { message: string }) {
  return (
    <p className="text-xs text-red-500 font-poppins text-center bg-red-50 rounded-lg px-3 py-2">
      {message}
    </p>
  );
}

// ── Login form ─────────────────────────────────────────────────────────────

function LoginForm({ onSwitch, onSuccess }: { onSwitch: () => void; onSuccess: () => void }) {
  const { showToast } = useToast();
  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [error, setError]       = useState("");
  const [loading, setLoading]   = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await signIn(email, password);
      // AuthContext.onAuthStateChange handles user state update automatically
      showToast("¡Bienvenido de vuelta! Sesión iniciada.", "success");
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al iniciar sesión.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <Field label="Correo electrónico" type="email" value={email} onChange={setEmail}
             placeholder="tucorreo@email.com" autoComplete="email" />
      <PasswordField label="Contraseña" value={password} onChange={setPassword}
                     autoComplete="current-password" />
      {error && <ErrorBanner message={error} />}
      <SubmitButton loading={loading} label="Entrar" />
      <p className="text-xs text-center text-gray-400 font-poppins">
        ¿No tienes cuenta?{" "}
        <button type="button" onClick={onSwitch}
                className="text-brand-primary font-medium hover:underline">
          Regístrate
        </button>
      </p>
    </form>
  );
}

// ── Register form ──────────────────────────────────────────────────────────

function RegisterForm({ onSwitch, onSuccess }: { onSwitch: () => void; onSuccess: () => void }) {
  const { showToast } = useToast();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName]   = useState("");
  const [whatsapp, setWhatsapp]   = useState("");
  const [email, setEmail]         = useState("");
  const [password, setPassword]   = useState("");
  const [confirm, setConfirm]     = useState("");
  const [error, setError]         = useState("");
  const [loading, setLoading]     = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (password !== confirm) { setError("Las contraseñas no coinciden."); return; }
    if (password.length < 6)  { setError("La contraseña debe tener al menos 6 caracteres."); return; }

    setLoading(true);
    try {
      const { requiresEmailConfirmation } = await signUp({
        email, password,
        first_name: firstName,
        last_name:  lastName,
        whatsapp:   whatsapp ? `+506${whatsapp.replace(/\D/g, "")}` : null,
      });

      if (requiresEmailConfirmation) {
        showToast("¡Cuenta creada! Revisa tu correo para confirmarla.", "success");
      } else {
        showToast("¡Cuenta creada exitosamente! Bienvenido a Dropping CR.", "success");
      }
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al crear la cuenta.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3.5">
      <div className="grid grid-cols-2 gap-3">
        <Field label="Nombre"   value={firstName} onChange={setFirstName} placeholder="Nombre" />
        <Field label="Apellido" value={lastName}  onChange={setLastName}  placeholder="Apellido" />
      </div>

      {/* WhatsApp with +506 prefix */}
      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-gray-500 font-poppins uppercase tracking-wider">
          WhatsApp
        </label>
        <div className="flex items-center rounded-xl border border-gray-200 overflow-hidden
                        focus-within:border-brand-primary focus-within:ring-1
                        focus-within:ring-brand-primary/20 transition">
          <span className="px-3 py-2.5 text-sm font-poppins text-gray-400 bg-gray-50
                           border-r border-gray-200 shrink-0 select-none">
            +506
          </span>
          <input
            type="tel" value={whatsapp}
            onChange={(e) => setWhatsapp(e.target.value.replace(/\D/g, "").slice(0, 8))}
            placeholder="88887777" maxLength={8}
            className="flex-1 px-3 py-2.5 text-sm font-poppins text-brand-dark outline-none bg-white"
          />
        </div>
      </div>

      <Field label="Correo electrónico" type="email" value={email} onChange={setEmail}
             placeholder="tucorreo@email.com" autoComplete="email" />
      <PasswordField label="Contraseña"          value={password} onChange={setPassword} autoComplete="new-password" />
      <PasswordField label="Confirmar contraseña" value={confirm}  onChange={setConfirm}  autoComplete="new-password" />

      {error && <ErrorBanner message={error} />}
      <SubmitButton loading={loading} label="Crear cuenta" />

      <p className="text-xs text-center text-gray-400 font-poppins">
        ¿Ya tienes cuenta?{" "}
        <button type="button" onClick={onSwitch}
                className="text-brand-primary font-medium hover:underline">
          Inicia sesión
        </button>
      </p>
    </form>
  );
}

// ── Modal ──────────────────────────────────────────────────────────────────

const slideVariants = {
  enterFromRight: { x: 40,  opacity: 0 },
  enterFromLeft:  { x: -40, opacity: 0 },
  center:         { x: 0,   opacity: 1 },
  exitToLeft:     { x: -40, opacity: 0 },
  exitToRight:    { x: 40,  opacity: 0 },
};

export default function AuthModal({ open, onClose }: AuthModalProps) {
  const [mode, setMode]           = useState<FormMode>("login");
  const [direction, setDirection] = useState<1 | -1>(1);

  function switchTo(next: FormMode) {
    setDirection(next === "register" ? 1 : -1);
    setMode(next);
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="overflow-hidden px-8 py-8">

        <div className="mb-6 text-center">
          <span className="font-poppins font-semibold italic text-brand-primary text-xl">
            Dropping CR
          </span>
          <p className="text-xs text-gray-400 font-poppins mt-0.5">
            {mode === "login" ? "Inicia sesión en tu cuenta" : "Crea tu cuenta gratis"}
          </p>
        </div>

        <AnimatePresence mode="wait" custom={direction}>
          <motion.div
            key={mode}
            custom={direction}
            variants={slideVariants}
            initial={direction === 1 ? "enterFromRight" : "enterFromLeft"}
            animate="center"
            exit={direction === 1 ? "exitToLeft" : "exitToRight"}
            transition={{ duration: 0.22, ease: "easeInOut" }}
          >
            {mode === "login"
              ? <LoginForm    onSwitch={() => switchTo("register")} onSuccess={onClose} />
              : <RegisterForm onSwitch={() => switchTo("login")}    onSuccess={onClose} />
            }
          </motion.div>
        </AnimatePresence>

      </DialogContent>
    </Dialog>
  );
}
