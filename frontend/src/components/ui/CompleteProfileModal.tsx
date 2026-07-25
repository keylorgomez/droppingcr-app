import { useState, useEffect } from "react";
import { Loader2, MessageCircle } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { updateProfile } from "../../services/profileService";
import { useToast } from "./Toast";
import { t } from "../../lib/i18n";
import { Dialog, DialogContent } from "./dialog";

const SESSION_KEY = "whatsapp_prompt_dismissed";

// Prompts customers who have no WhatsApp on file to add it — Google sign-ups
// start without one, and orders are linked to customers by phone number.
// Dismissable, but reappears next session until the number is provided.

export default function CompleteProfileModal() {
  const { user, refreshUser } = useAuth();
  const { showToast } = useToast();

  const [open, setOpen]         = useState(false);
  const [whatsapp, setWhatsapp] = useState("");
  const [error, setError]       = useState("");
  const [loading, setLoading]   = useState(false);

  const needsWhatsapp =
    !!user && user.role === "customer" && !user.whatsapp;

  useEffect(() => {
    if (!needsWhatsapp) { setOpen(false); return; }
    if (sessionStorage.getItem(SESSION_KEY)) return;
    setOpen(true);
  }, [needsWhatsapp]);

  function dismiss() {
    sessionStorage.setItem(SESSION_KEY, "1");
    setOpen(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const digits = whatsapp.replace(/\D/g, "");
    if (digits.length !== 8) { setError(t.completeProfile.invalid); return; }

    setLoading(true);
    try {
      await updateProfile(user!.id, { whatsapp: `+506${digits}` });
      await refreshUser();
      showToast(t.completeProfile.saved, "success");
      setOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al guardar.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && dismiss()}>
      <DialogContent className="overflow-hidden px-8 py-8">

        <div className="mb-6 text-center flex flex-col items-center gap-2">
          <div className="w-12 h-12 rounded-full bg-brand-primary/10 flex items-center justify-center">
            <MessageCircle size={22} className="text-brand-primary" />
          </div>
          <span className="font-poppins font-semibold italic text-brand-primary text-xl">
            {t.completeProfile.title}
          </span>
          <p className="text-xs text-gray-400 font-poppins leading-relaxed max-w-[38ch]">
            {t.completeProfile.subtitle}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-gray-500 font-poppins uppercase tracking-wider">
              {t.completeProfile.label}
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
                placeholder={t.completeProfile.placeholder} maxLength={8} autoFocus
                className="flex-1 px-3 py-2.5 text-sm font-poppins text-brand-dark outline-none bg-white"
              />
            </div>
          </div>

          {error && (
            <p className="text-xs text-red-500 font-poppins text-center bg-red-50 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          <button type="submit" disabled={loading}
                  className="mt-1 w-full py-3 rounded-xl bg-brand-primary text-white text-sm
                             font-poppins font-medium flex items-center justify-center gap-2
                             hover:bg-[#7a3e18] transition-colors disabled:opacity-60">
            {loading && <Loader2 size={15} className="animate-spin" />}
            {t.completeProfile.save}
          </button>

          <button type="button" onClick={dismiss}
                  className="text-xs text-center text-gray-400 font-poppins hover:text-brand-primary transition-colors">
            {t.completeProfile.skip}
          </button>
        </form>

      </DialogContent>
    </Dialog>
  );
}
