import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2, ArrowLeft, Coins } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "../context/AuthContext";
import { updateProfile } from "../services/profileService";
import { getMyPayouts, type AdminPayout } from "../services/payoutsService";
import { useToast } from "../components/ui/Toast";
import Header from "../components/ui/Header";

// ── Small field components ─────────────────────────────────────────────────

function ReadOnlyField({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-medium text-gray-400 font-poppins uppercase tracking-wider">
        {label}
      </label>
      <div className="w-full rounded-xl border border-gray-100 bg-gray-50 px-4 py-2.5
                      text-sm font-poppins text-gray-400 select-none truncate">
        {value}
      </div>
    </div>
  );
}

function EditField({
  label, value, onChange, placeholder,
}: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-medium text-gray-500 font-poppins uppercase tracking-wider">
        {label}
      </label>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-poppins
                   text-brand-dark placeholder:text-gray-300 outline-none
                   focus:border-brand-primary focus:ring-1 focus:ring-brand-primary/20 transition"
      />
    </div>
  );
}

// ── Skeleton ───────────────────────────────────────────────────────────────

function ProfileSkeleton() {
  return (
    <>
      <Header />
      <main className="max-w-lg mx-auto px-4 py-10">
        <div className="animate-pulse space-y-5">
          <div className="space-y-1.5">
            <div className="h-6 bg-gray-100 rounded-lg w-1/4" />
            <div className="h-3.5 bg-gray-100 rounded-lg w-1/2" />
          </div>
          <div className="grid grid-cols-2 gap-4 pt-2">
            <div className="h-11 bg-gray-100 rounded-xl" />
            <div className="h-11 bg-gray-100 rounded-xl" />
          </div>
          <div className="border-t border-gray-100 pt-5 space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="h-11 bg-gray-100 rounded-xl" />
              <div className="h-11 bg-gray-100 rounded-xl" />
            </div>
            <div className="h-11 bg-gray-100 rounded-xl" />
            <div className="h-12 bg-gray-100 rounded-xl mt-2" />
          </div>
        </div>
      </main>
    </>
  );
}

// ── Admin payouts section ──────────────────────────────────────────────────

function AdminPayoutsSection({ userId }: { userId: string }) {
  const { data: payouts = [], isLoading } = useQuery({
    queryKey: ["my-payouts", userId],
    queryFn:  () => getMyPayouts(userId),
  });

  const total = payouts.reduce((s, p) => s + p.amount, 0);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Coins size={15} className="text-brand-accent" strokeWidth={1.8} />
          <span className="text-xs font-poppins font-semibold uppercase tracking-wider text-gray-500">
            Mis abonos de ganancia
          </span>
        </div>
        {!isLoading && payouts.length > 0 && (
          <span className="text-sm font-poppins font-bold text-brand-primary">
            ₡{total.toLocaleString("en-US")}
          </span>
        )}
      </div>

      {isLoading && (
        <div className="space-y-2">
          {[1, 2].map((i) => (
            <div key={i} className="h-12 bg-gray-100 rounded-xl animate-pulse" />
          ))}
        </div>
      )}

      {!isLoading && payouts.length === 0 && (
        <p className="text-xs font-poppins text-gray-300 text-center py-6">
          Aún no tienes abonos registrados.
        </p>
      )}

      {!isLoading && payouts.length > 0 && (
        <div className="flex flex-col gap-2">
          {payouts.map((p: AdminPayout) => (
            <div
              key={p.id}
              className="flex items-center justify-between rounded-xl border border-gray-100
                         bg-gray-50 px-4 py-2.5 gap-3"
            >
              <div className="flex flex-col gap-0.5 min-w-0">
                <p className="text-xs font-poppins text-gray-400">
                  {new Date(p.paid_at).toLocaleDateString("es-CR", {
                    day: "numeric", month: "short", year: "numeric",
                  })}
                </p>
                {p.note && (
                  <p className="text-[11px] font-poppins text-gray-400 truncate">{p.note}</p>
                )}
              </div>
              <span className="font-poppins font-semibold text-sm text-brand-primary shrink-0">
                ₡{p.amount.toLocaleString("en-US")}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────

export default function ProfilePage() {
  const { user, isLoading, refreshUser } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName]   = useState("");
  const [whatsapp, setWhatsapp]   = useState("");
  const [saving, setSaving]       = useState(false);

  // Redirect if not authenticated
  useEffect(() => {
    if (!isLoading && !user) navigate("/", { replace: true });
  }, [user, isLoading, navigate]);

  // Populate form when profile is ready
  useEffect(() => {
    if (user) {
      setFirstName(user.first_name);
      setLastName(user.last_name);
      const raw = user.whatsapp ?? "";
      setWhatsapp(raw.startsWith("+506") ? raw.slice(4) : raw);
    }
  }, [user]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    setSaving(true);
    try {
      await updateProfile(user.id, {
        first_name: firstName.trim(),
        last_name:  lastName.trim(),
        whatsapp:   whatsapp ? `+506${whatsapp.replace(/\D/g, "")}` : null,
      });
      await refreshUser();
      showToast("Perfil actualizado exitosamente.", "success");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Error al actualizar.", "error");
    } finally {
      setSaving(false);
    }
  }

  if (isLoading || !user) return <ProfileSkeleton />;

  const roleLabel = user.role === "admin" ? "Administrador" : "Cliente";

  return (
    <>
      <Header />
      <main className="max-w-lg mx-auto px-4 py-10">

        {/* Back button */}
        <button
          onClick={() => navigate("/")}
          className="flex items-center gap-1.5 text-xs font-poppins text-gray-400
                     hover:text-brand-primary transition-colors mb-6 -ml-0.5"
        >
          <ArrowLeft size={15} strokeWidth={1.8} />
          Volver al catálogo
        </button>

        {/* Title */}
        <h1 className="font-poppins font-semibold text-xl text-brand-dark mb-0.5">
          Mi perfil
        </h1>
        <p className="font-poppins text-xs text-gray-400 mb-8">
          Gestiona tu información personal
        </p>

        {/* Read-only section */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
          <ReadOnlyField label="Correo electrónico" value={user.email} />
          <ReadOnlyField label="Rol" value={roleLabel} />
        </div>

        <div className="border-t border-gray-100 mb-6" />

        {/* Editable form */}
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3">
            <EditField
              label="Nombre"
              value={firstName}
              onChange={setFirstName}
              placeholder="Nombre"
            />
            <EditField
              label="Apellido"
              value={lastName}
              onChange={setLastName}
              placeholder="Apellido"
            />
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
                type="tel"
                value={whatsapp}
                onChange={(e) => setWhatsapp(e.target.value.replace(/\D/g, "").slice(0, 8))}
                placeholder="88887777"
                maxLength={8}
                className="flex-1 px-3 py-2.5 text-sm font-poppins text-brand-dark
                           outline-none bg-white placeholder:text-gray-300"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={saving}
            className="mt-2 w-full py-3 rounded-xl bg-brand-primary text-white text-sm
                       font-poppins font-medium flex items-center justify-center gap-2
                       hover:bg-[#7a3e18] transition-colors disabled:opacity-60"
          >
            {saving && <Loader2 size={15} className="animate-spin" />}
            Guardar cambios
          </button>
        </form>

        {/* Admin payouts history */}
        {user.role === "admin" && (
          <>
            <div className="border-t border-gray-100 mt-6 mb-6" />
            <AdminPayoutsSection userId={user.id} />
          </>
        )}

      </main>
    </>
  );
}
