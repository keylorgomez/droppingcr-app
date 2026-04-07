import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Loader2, Pencil, Trash2, Check, X, Settings2 } from "lucide-react";
import {
  getCategories, createCategory, updateCategory, deleteCategory,
} from "../../services/categoryService";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../components/ui/Toast";
import Header from "../../components/ui/Header";

const inputCls =
  "w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-poppins text-brand-dark " +
  "placeholder:text-gray-300 outline-none focus:border-brand-primary " +
  "focus:ring-1 focus:ring-brand-primary/20 transition";

export default function CategoriesPage() {
  const navigate      = useNavigate();
  const { showToast } = useToast();
  const { user, isLoading: authLoading } = useAuth();
  const queryClient   = useQueryClient();

  useEffect(() => {
    if (!authLoading && (!user || user.role !== "admin")) navigate("/", { replace: true });
  }, [user, authLoading, navigate]);

  // ── Create form ────────────────────────────────────────────────────────
  const [newName,   setNewName]   = useState("");
  const [nameError, setNameError] = useState("");

  // ── Edit row ───────────────────────────────────────────────────────────
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName,  setEditName]  = useState("");
  const [editError, setEditError] = useState("");

  // ── Data ───────────────────────────────────────────────────────────────
  const { data: categories = [], isLoading } = useQuery({
    queryKey: ["categories-admin"],
    queryFn:  getCategories,
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["categories-admin"] });
    queryClient.invalidateQueries({ queryKey: ["categories"] });
  };

  const createMut = useMutation({
    mutationFn: createCategory,
    onSuccess: () => { invalidate(); showToast("Categoría creada.", "success"); setNewName(""); },
    onError:   (err: Error) => showToast(err.message, "error"),
  });

  const updateMut = useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) => updateCategory(id, { name }),
    onSuccess: () => { invalidate(); showToast("Categoría actualizada.", "success"); setEditingId(null); },
    onError:   (err: Error) => showToast(err.message, "error"),
  });

  const deleteMut = useMutation({
    mutationFn: deleteCategory,
    onSuccess: () => { invalidate(); showToast("Categoría eliminada.", "success"); },
    onError:   (err: Error) => showToast(err.message, "error"),
  });

  // ── Handlers ───────────────────────────────────────────────────────────
  function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!newName.trim()) { setNameError("El nombre es requerido."); return; }
    setNameError("");
    createMut.mutate({ name: newName });
  }

  function startEdit(cat: { id: string; name: string }) {
    setEditingId(cat.id);
    setEditName(cat.name);
    setEditError("");
  }

  function confirmEdit(id: string) {
    if (!editName.trim()) { setEditError("El nombre es requerido."); return; }
    setEditError("");
    updateMut.mutate({ id, name: editName });
  }

  function handleDelete(id: string, name: string) {
    if (!window.confirm(`¿Eliminar la categoría "${name}"? Esta acción no se puede deshacer.`)) return;
    deleteMut.mutate(id);
  }

  if (authLoading) return null;

  return (
    <>
      <Header />
      <main className="max-w-2xl mx-auto px-4 py-8 pb-16">

        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-1.5 text-xs font-poppins text-gray-400
                     hover:text-brand-primary transition-colors mb-6 -ml-0.5"
        >
          <ArrowLeft size={15} strokeWidth={1.8} />
          Volver
        </button>

        <div className="flex items-center gap-2.5 mb-1">
          <Settings2 size={18} className="text-brand-accent" strokeWidth={1.8} />
          <h1 className="font-poppins font-semibold text-xl text-brand-dark">
            Gestionar Categorías
          </h1>
        </div>
        <p className="font-poppins text-xs text-gray-400 mb-8">
          Crea y administra las categorías del catálogo.
        </p>

        {/* ── Create form ──────────────────────────────────────────── */}
        <div className="bg-white rounded-2xl border border-gray-100 p-6 mb-6">
          <h2 className="font-poppins font-semibold text-sm text-brand-dark uppercase
                         tracking-wider mb-4">
            Nueva categoría
          </h2>

          <form onSubmit={handleCreate} className="flex gap-3 items-start">
            <div className="flex-1 flex flex-col gap-1">
              <input
                type="text"
                value={newName}
                onChange={(e) => { setNewName(e.target.value); setNameError(""); }}
                placeholder="Ej: Camisetas, Tenis, Accesorios…"
                className={inputCls}
              />
              {nameError && (
                <span className="text-[11px] text-red-500 font-poppins">{nameError}</span>
              )}
            </div>

            <button
              type="submit"
              disabled={createMut.isPending}
              className="shrink-0 px-5 py-2.5 rounded-xl bg-brand-primary text-white text-sm
                         font-poppins font-medium flex items-center gap-2
                         hover:bg-[#7a3e18] transition-colors disabled:opacity-60"
            >
              {createMut.isPending && <Loader2 size={14} className="animate-spin" />}
              Guardar
            </button>
          </form>
        </div>

        {/* ── List ─────────────────────────────────────────────────── */}
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100">
            <h2 className="font-poppins font-semibold text-sm text-brand-dark uppercase tracking-wider">
              Categorías existentes
            </h2>
          </div>

          {isLoading ? (
            <div className="p-6 space-y-3 animate-pulse">
              {[1, 2, 3].map((i) => <div key={i} className="h-10 bg-gray-100 rounded-xl" />)}
            </div>
          ) : categories.length === 0 ? (
            <div className="px-6 py-10 text-center">
              <p className="font-poppins text-sm text-gray-400">No hay categorías creadas aún.</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              <div className="grid grid-cols-[1fr_72px] gap-4 px-6 py-2.5">
                <span className="text-[10px] font-poppins text-gray-400 uppercase tracking-wider">Nombre / Slug</span>
                <span />
              </div>

              {categories.map((cat) => {
                const isEditing  = editingId === cat.id;
                const isMutating = updateMut.isPending && editingId === cat.id;

                return (
                  <div key={cat.id} className="grid grid-cols-[1fr_72px] gap-4 items-center px-6 py-3">
                    {isEditing ? (
                      <>
                        <div className="flex flex-col gap-0.5">
                          <input
                            type="text"
                            value={editName}
                            onChange={(e) => { setEditName(e.target.value); setEditError(""); }}
                            className={inputCls}
                            autoFocus
                          />
                          {editError && (
                            <span className="text-[11px] text-red-500 font-poppins">{editError}</span>
                          )}
                        </div>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => confirmEdit(cat.id)}
                            disabled={isMutating}
                            className="h-8 w-8 flex items-center justify-center rounded-lg
                                       text-emerald-500 hover:bg-emerald-50 transition-colors"
                            title="Confirmar"
                          >
                            {isMutating
                              ? <Loader2 size={14} className="animate-spin" />
                              : <Check size={15} strokeWidth={2.5} />}
                          </button>
                          <button
                            onClick={() => setEditingId(null)}
                            className="h-8 w-8 flex items-center justify-center rounded-lg
                                       text-gray-400 hover:bg-gray-100 transition-colors"
                            title="Cancelar"
                          >
                            <X size={15} />
                          </button>
                        </div>
                      </>
                    ) : (
                      <>
                        <div>
                          <p className="text-sm font-poppins text-brand-dark">{cat.name}</p>
                          <p className="text-[11px] font-poppins text-gray-400">{cat.slug}</p>
                        </div>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => startEdit(cat)}
                            className="h-8 w-8 flex items-center justify-center rounded-lg
                                       text-gray-400 hover:text-brand-primary hover:bg-brand-bg
                                       transition-colors"
                            title="Editar"
                          >
                            <Pencil size={14} />
                          </button>
                          <button
                            onClick={() => handleDelete(cat.id, cat.name)}
                            disabled={deleteMut.isPending}
                            className="h-8 w-8 flex items-center justify-center rounded-lg
                                       text-gray-400 hover:text-red-500 hover:bg-red-50
                                       transition-colors"
                            title="Eliminar"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

      </main>
    </>
  );
}
