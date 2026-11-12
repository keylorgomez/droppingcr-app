-- Endurecimiento de seguridad (auditoría 2026-11-11).
--
-- Todo lo de abajo se podía explotar con la llave anónima que viaja en el
-- frontend: leer todos los perfiles, autopromoverse a admin, mover el stock de
-- cualquier producto y adueñarse de pedidos ajenos.

-- ── 1. Perfiles: nada público ────────────────────────────────────────────
-- Ya existen "users can read own profile" y "admins can read all profiles".
drop policy if exists "Public profiles are viewable by everyone" on public.profiles;

-- Tres políticas UPDATE idénticas: se deja una sola, con WITH CHECK.
drop policy if exists "Users can update own profile"  on public.profiles;
drop policy if exists "users can update own profile"  on public.profiles;

-- ── 1b. Ventas: el cliente lee lo suyo por customer_id, nada más ─────────
-- Estas políticas comparaban profiles.whatsapp (que cada usuario edita a su
-- gusto) contra guest_phone: poniéndose el número de otra persona se podían
-- leer sus compras y pagos, y la de UPDATE dejaba además reescribir precio o
-- estado de una venta sin reclamar. La app reclama por la RPC
-- claim_orders_by_phone y después lee por customer_id.
drop policy if exists "users can claim their own sales"               on public.sales;
drop policy if exists "customers can read own sales"                  on public.sales;
drop policy if exists "users can read their own or unclaimed sales"   on public.sales;
drop policy if exists "customers can read own payments"               on public.payments;

drop policy if exists "sales_select_own" on public.sales;
create policy "sales_select_own"
  on public.sales for select
  to authenticated
  using (customer_id = (select auth.uid()));

-- ── 2. Nadie se cambia el rol a sí mismo ─────────────────────────────────
-- Trigger y no permisos por columna: la app hace upsert con role='customer'
-- y quitarle el UPDATE de la columna rompería el registro. El trigger solo
-- frena un cambio REAL de rol hecho por alguien que no es admin. Las llamadas
-- de servidor (service_role, postgres, triggers de auth) no tienen auth.uid()
-- de usuario y pasan.
create or replace function public.guard_profile_role()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    return new;                              -- servidor / dashboard
  end if;

  if tg_op = 'INSERT' then
    if new.role is distinct from 'customer' and not public.is_admin_user(auth.uid()) then
      new.role := 'customer';
    end if;
    return new;
  end if;

  if new.role is distinct from old.role and not public.is_admin_user(auth.uid()) then
    raise exception 'No autorizado para cambiar el rol' using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_guard_role on public.profiles;
create trigger profiles_guard_role
  before insert or update on public.profiles
  for each row execute function public.guard_profile_role();

-- ── 3. Stock: solo admins, y nunca por debajo de lo que hay ──────────────
create or replace function public.decrement_variant_stock(p_variant_id uuid, p_amount integer)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin_user(auth.uid()) then
    raise exception 'No autorizado' using errcode = '42501';
  end if;
  if p_amount is null or p_amount < 1 then
    raise exception 'Cantidad inválida';
  end if;

  -- Antes era GREATEST(0, stock - n): dos ventas simultáneas de la última
  -- unidad pasaban las dos. Ahora la segunda falla.
  update product_variants
     set stock = stock - p_amount
   where id = p_variant_id
     and stock >= p_amount;

  if not found then
    raise exception 'Stock insuficiente para esta talla';
  end if;
end;
$$;

create or replace function public.increment_variant_stock(p_variant_id uuid, p_amount integer)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin_user(auth.uid()) then
    raise exception 'No autorizado' using errcode = '42501';
  end if;
  if p_amount is null or p_amount < 1 then
    raise exception 'Cantidad inválida';
  end if;

  update product_variants set stock = stock + p_amount where id = p_variant_id;
end;
$$;

-- ── 4. Reclamar pedidos: solo los propios y con el teléfono propio ───────
-- Mismas reglas que claim_external_sales_by_phone.
create or replace function public.claim_orders_by_phone(p_user_id uuid, p_phone_last8 text)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  digits   text := right(regexp_replace(coalesce(p_phone_last8, ''), '\D', '', 'g'), 8);
  v_sales  integer := 0;
  v_orders integer := 0;
begin
  if auth.uid() is null or auth.uid() <> p_user_id then
    return 0;
  end if;

  if length(digits) < 8 then
    return 0;
  end if;

  if not exists (
    select 1 from profiles
    where id = p_user_id
      and right(regexp_replace(coalesce(whatsapp, ''), '\D', '', 'g'), 8) = digits
  ) then
    return 0;
  end if;

  update sales
     set customer_id = p_user_id
   where customer_id is null
     and guest_phone is not null
     and right(regexp_replace(guest_phone, '\D', '', 'g'), 8) = digits;
  get diagnostics v_sales = row_count;

  update orders
     set customer_id = p_user_id
   where customer_id is null
     and guest_phone is not null
     and right(regexp_replace(guest_phone, '\D', '', 'g'), 8) = digits;
  get diagnostics v_orders = row_count;

  return v_sales + v_orders;
end;
$$;

-- ── 5. Emails de admins: solo para admins ────────────────────────────────
create or replace function public.get_admin_profiles()
returns table (id uuid, first_name text, last_name text, email text)
language sql
stable
security definer
set search_path = public
as $$
  select p.id, p.first_name, p.last_name, u.email::text
  from profiles p
  join auth.users u on u.id = p.id
  where p.role = 'admin'
    and public.is_admin_user(auth.uid())
  order by p.first_name;
$$;

-- ── 6. search_path fijo y sin ejecución anónima ──────────────────────────
alter function public.is_admin_user(uuid) set search_path = public;
alter function public.handle_new_user()   set search_path = public;

revoke execute on function public.handle_new_user()                          from public, anon, authenticated;
revoke execute on function public.guard_profile_role()                       from public, anon, authenticated;
revoke execute on function public.get_admin_profiles()                       from public, anon;
revoke execute on function public.increment_variant_stock(uuid, integer)     from public, anon;
revoke execute on function public.decrement_variant_stock(uuid, integer)     from public, anon;
revoke execute on function public.claim_orders_by_phone(uuid, text)          from public, anon;
revoke execute on function public.claim_external_sales_by_phone(uuid, text)  from public, anon;
revoke execute on function public.lookup_customer_by_phone(text)             from public, anon;
revoke execute on function public.lookup_customer_profile_by_phone(text)     from public, anon;

grant execute on function public.get_admin_profiles()                        to authenticated;
grant execute on function public.increment_variant_stock(uuid, integer)      to authenticated;
grant execute on function public.decrement_variant_stock(uuid, integer)      to authenticated;
grant execute on function public.claim_orders_by_phone(uuid, text)           to authenticated;
grant execute on function public.claim_external_sales_by_phone(uuid, text)   to authenticated;
grant execute on function public.lookup_customer_by_phone(text)              to authenticated;
grant execute on function public.lookup_customer_profile_by_phone(text)      to authenticated;

-- ── 7. Índices de llaves foráneas y fechas ───────────────────────────────
-- Baratos hoy y necesarios cuando crezcan pedidos y abonos.
create index if not exists payments_sale_id_idx          on public.payments (sale_id)  where sale_id  is not null;
create index if not exists payments_order_id_idx         on public.payments (order_id) where order_id is not null;
create index if not exists order_items_order_id_idx      on public.order_items (order_id);
create index if not exists order_items_variant_id_idx    on public.order_items (variant_id);
create index if not exists product_images_product_id_idx on public.product_images (product_id);
create index if not exists product_variants_product_idx  on public.product_variants (product_id);
create index if not exists sales_sold_at_idx             on public.sales (sold_at desc);
create index if not exists sales_customer_id_idx         on public.sales (customer_id) where customer_id is not null;
create index if not exists sales_variant_id_idx          on public.sales (variant_id);
create index if not exists orders_sold_at_idx            on public.orders (sold_at desc);
create index if not exists expense_payments_expense_idx  on public.expense_payments (expense_id);
create index if not exists refunds_sale_id_idx           on public.refunds (sale_id);
