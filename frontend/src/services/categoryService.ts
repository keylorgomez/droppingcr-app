import { supabase } from "../lib/supabaseClient";
import type { Category } from "./productService";

// ── Input ──────────────────────────────────────────────────────────────────

export interface CategoryInput {
  name: string;
}

// ── Slug helper ────────────────────────────────────────────────────────────

function slugify(str: string): string {
  return str
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-");
}

// ── Queries ────────────────────────────────────────────────────────────────

export async function getCategories(): Promise<Category[]> {
  const { data, error } = await supabase
    .from("categories")
    .select("id, name, slug")
    .order("name");

  if (error) throw new Error(error.message);
  return data ?? [];
}

// ── Mutations ──────────────────────────────────────────────────────────────

export async function createCategory(input: CategoryInput): Promise<void> {
  const { error } = await supabase.from("categories").insert({
    name: input.name.trim(),
    slug: slugify(input.name),
  });

  if (error) {
    if (error.message.includes("unique") || error.message.includes("duplicate"))
      throw new Error("Ya existe una categoría con ese nombre.");
    throw new Error(error.message);
  }
}

export async function updateCategory(id: string, input: CategoryInput): Promise<void> {
  const { error } = await supabase
    .from("categories")
    .update({
      name: input.name.trim(),
      slug: slugify(input.name),
    })
    .eq("id", id);

  if (error) throw new Error(error.message);
}

export async function deleteCategory(id: string): Promise<void> {
  const { error } = await supabase.from("categories").delete().eq("id", id);
  if (error) throw new Error(error.message);
}
