-- Tallas con un solo formato.
--
--   · Ropa: XS S M L XL XXL 3XL 4XL. "2XL"/"XLL" eran XXL y "XXXL" era 3XL:
--     salían como tallas distintas en los filtros.
--   · Calzado: "42 EUR" o "42 EUR / 9 US" (EUR primero). Había "42",
--     "US 9 / EUR 42.5", etc.
--   · "L (tipo M)" / "XL (como L)": la nota pasa a la descripción del
--     producto (le sirve al cliente) y la talla queda limpia.
--
-- Además, un trigger normaliza la talla al guardar, por si entra por un
-- camino que no pasa por el formulario.

-- ── 1. Notas de horma → descripción ───────────────────────────────────
update public.products p
   set description = concat_ws(E'\n\n', nullif(trim(p.description), ''), n.note)
  from (
    select v.product_id,
           string_agg(distinct regexp_replace(trim(v.size),
             '^(\S+)\s*\((?:tipo|como)\s+(\S+)\)$', 'Ojo con la talla: la \1 de esta pieza queda como una \2.', 'i'), ' ') as note
      from public.product_variants v
     where trim(v.size) ~* '^\S+\s*\((tipo|como)\s+\S+\)$'
     group by v.product_id
  ) n
 where n.product_id = p.id;

update public.product_variants
   set size = regexp_replace(trim(size), '^(\S+)\s*\((?:tipo|como)\s+\S+\)$', '\1', 'i')
 where trim(size) ~* '^\S+\s*\((tipo|como)\s+\S+\)$';

-- ── 2. Función de normalización ───────────────────────────────────────
create or replace function public.normalize_size(p_size text, p_is_shoe boolean default false)
returns text
language sql
immutable
as $$
  select case
    when s is null or s = '' then s
    when upper(s) in ('2XL', 'XLL')  then 'XXL'
    when upper(s) = 'XXXL'           then '3XL'
    when upper(s) in ('XS', 'S', 'M', 'L', 'XL', 'XXL', '3XL', '4XL') then upper(s)
    when lower(s) in ('talla única', 'talla unica', 'única', 'unica') then 'Talla Única'
    when lower(s) = 'ajustable'      then 'Ajustable'
    -- "US 9 / EUR 42.5" → "42.5 EUR / 9 US"
    when s ~* '^US\s*([0-9]+(\.5)?)\s*/\s*EUR\s*([0-9]+(\.5)?)$'
      then regexp_replace(s, '^US\s*([0-9]+(\.5)?)\s*/\s*EUR\s*([0-9]+(\.5)?)$', '\3 EUR / \1 US', 'i')
    -- "42 eur / 9 us" → "42 EUR / 9 US"
    when s ~* '^([0-9]+(\.5)?)\s*EUR\s*/\s*([0-9]+(\.5)?)\s*US$'
      then regexp_replace(s, '^([0-9]+(\.5)?)\s*EUR\s*/\s*([0-9]+(\.5)?)\s*US$', '\1 EUR / \3 US', 'i')
    -- "42 eur" / "42eur" → "42 EUR"
    when s ~* '^([0-9]+(\.5)?)\s*EUR$'
      then regexp_replace(s, '^([0-9]+(\.5)?)\s*EUR$', '\1 EUR', 'i')
    -- "42" en calzado → "42 EUR" (en un balón, "5" se queda igual)
    when p_is_shoe and s ~ '^(3[5-9]|4[0-8])(\.5)?$' then s || ' EUR'
    else s
  end
  from (select regexp_replace(trim(p_size), '\s+', ' ', 'g') as s) x;
$$;

-- ── 3. Limpiar lo que ya existe ───────────────────────────────────────
update public.product_variants v
   set size = public.normalize_size(v.size, exists (
         select 1 from public.product_categories pc
           join public.categories c on c.id = pc.category_id
          where pc.product_id = v.product_id and c.slug = 'tenis'))
 where v.size is distinct from public.normalize_size(v.size, exists (
         select 1 from public.product_categories pc
           join public.categories c on c.id = pc.category_id
          where pc.product_id = v.product_id and c.slug = 'tenis'));

-- ── 4. Y que no vuelva a pasar ────────────────────────────────────────
create or replace function public.normalize_variant_size()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.size := public.normalize_size(new.size, exists (
    select 1 from product_categories pc
      join categories c on c.id = pc.category_id
     where pc.product_id = new.product_id and c.slug = 'tenis'));
  return new;
end;
$$;

drop trigger if exists normalize_variant_size on public.product_variants;
create trigger normalize_variant_size
  before insert or update of size on public.product_variants
  for each row execute function public.normalize_variant_size();
