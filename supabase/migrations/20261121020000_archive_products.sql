-- Archivar productos en vez de borrarlos, y sacar del catálogo lo agotado
-- hace mucho.
--
--   · Borrar un producto vendido fallaba (order_items lo impide) o, peor, si
--     se vendió como venta individual dejaba esa venta sin producto. Ahora
--     `delete_or_archive_product` lo borra solo si nunca se vendió; si tiene
--     ventas lo archiva: sale del catálogo y el historial queda intacto.
--   · `sold_out_at`: desde cuándo está agotado (sin stock y sin apartar). El
--     catálogo esconde lo que lleva más de 3 meses así. Si vuelve el stock,
--     se limpia solo y reaparece.

alter table public.products add column if not exists archived_at timestamptz;
alter table public.products add column if not exists sold_out_at timestamptz;

create index if not exists products_listed_idx
  on public.products (sold_out_at) where archived_at is null;

-- ── 1. Desde cuándo está agotado ──────────────────────────────────────
-- Lo que hoy está agotado toma la fecha de su última venta (o la de alta si
-- nunca se registró una).
update public.products p
   set sold_out_at = coalesce(greatest(
         (select max(s.sold_at) from sales s
           where s.product_id = p.id and coalesce(s.status, 'completed') <> 'cancelled'),
         (select max(o.sold_at) from order_items i join orders o on o.id = i.order_id
           where i.product_id = p.id and o.status <> 'cancelled')
       ), p.created_at)
 where p.sold_out_at is null
   and not exists (select 1 from public.product_variants v
                    where v.product_id = p.id and (v.stock > 0 or v.is_reserved));

-- Corre con permisos propios (security definer): se dispara también cuando un
-- cliente compra y baja el stock, y el cliente no puede editar productos.
create or replace function public.product_variants_sold_out_trigger()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ids uuid[];
begin
  if tg_op = 'DELETE' then
    v_ids := array[old.product_id];
  elsif tg_op = 'INSERT' then
    v_ids := array[new.product_id];
  else
    if new.stock is not distinct from old.stock
       and new.is_reserved is not distinct from old.is_reserved
       and new.product_id is not distinct from old.product_id then
      return null;
    end if;
    v_ids := array[old.product_id, new.product_id];
  end if;

  update products p
     set sold_out_at = case
           when exists (select 1 from product_variants v
                         where v.product_id = p.id and (v.stock > 0 or v.is_reserved))
             then null
           else coalesce(p.sold_out_at, now())
         end
   where p.id = any (v_ids);
  return null;
end;
$$;

revoke execute on function public.product_variants_sold_out_trigger() from public, anon, authenticated;

drop trigger if exists product_variants_sold_out on public.product_variants;
create trigger product_variants_sold_out
  after insert or update of stock, is_reserved, product_id or delete on public.product_variants
  for each row execute function public.product_variants_sold_out_trigger();

-- ── 2. Borrar o archivar ──────────────────────────────────────────────
create or replace function public.product_has_sales(p_product_id uuid)
returns boolean
language sql
stable
set search_path = public
as $$
  select exists (select 1 from sales s where s.product_id = p_product_id
                    or s.variant_id in (select id from product_variants where product_id = p_product_id))
      or exists (select 1 from order_items i where i.product_id = p_product_id
                    or i.variant_id in (select id from product_variants where product_id = p_product_id));
$$;

create or replace function public.delete_or_archive_product(p_id uuid)
returns text                    -- 'deleted' | 'archived'
language plpgsql
set search_path = public
as $$
begin
  if not public.is_admin_user(auth.uid()) then
    raise exception 'No autorizado' using errcode = '42501';
  end if;
  perform 1 from products where id = p_id for update;
  if not found then
    raise exception 'Producto no encontrado';
  end if;

  if public.product_has_sales(p_id) then
    update products
       set archived_at = coalesce(archived_at, now()), is_active = false, is_featured = false
     where id = p_id;
    -- Que no quede en carritos de clientes.
    delete from cart_items where variant_id in (select id from product_variants where product_id = p_id);
    return 'archived';
  end if;

  delete from products where id = p_id;
  return 'deleted';
end;
$$;

create or replace function public.restore_product(p_id uuid)
returns void
language plpgsql
set search_path = public
as $$
begin
  if not public.is_admin_user(auth.uid()) then
    raise exception 'No autorizado' using errcode = '42501';
  end if;
  update products set archived_at = null, is_active = true where id = p_id;
end;
$$;

revoke execute on function public.product_has_sales(uuid)         from public, anon;
grant  execute on function public.product_has_sales(uuid)         to authenticated;
revoke execute on function public.delete_or_archive_product(uuid) from public, anon;
revoke execute on function public.restore_product(uuid)           from public, anon;
grant  execute on function public.delete_or_archive_product(uuid) to authenticated;
grant  execute on function public.restore_product(uuid)           to authenticated;

-- ── 3. Un producto con ventas no se puede borrar por ningún camino ─────
-- (sales.product_id es ON DELETE SET NULL: sin esto la venta quedaba sin
-- producto en el historial.)
create or replace function public.guard_product_delete()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if public.product_has_sales(old.id) then
    raise exception 'Este producto tiene ventas: archivalo en vez de borrarlo.' using errcode = '23503';
  end if;
  return old;
end;
$$;

drop trigger if exists guard_product_delete on public.products;
create trigger guard_product_delete
  before delete on public.products
  for each row execute function public.guard_product_delete();

-- Lo mismo con una talla: borrar una talla vendida dejaba la venta sin talla
-- (pasó con 2 ventas). Si ya se vendió, se deja en stock 0.
create or replace function public.guard_variant_delete()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if exists (select 1 from sales where variant_id = old.id)
     or exists (select 1 from order_items where variant_id = old.id) then
    raise exception 'La talla % ya tiene ventas: dejala en stock 0 en vez de borrarla.', old.size using errcode = '23503';
  end if;
  return old;
end;
$$;

drop trigger if exists guard_variant_delete on public.product_variants;
create trigger guard_variant_delete
  before delete on public.product_variants
  for each row execute function public.guard_variant_delete();
