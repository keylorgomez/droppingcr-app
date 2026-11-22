-- A qué cliente pertenece cada venta lo decide la base, por el teléfono.
--
-- Antes el formulario mandaba el customer_id que encontraba al salir del campo
-- de teléfono. Si se corregía el número antes de que respondiera la búsqueda,
-- quedaba el id del número viejo: 3 encargos (y sus ventas externas al
-- entregarlos) quedaron ligados a la cuenta de otra persona, que los veía en
-- "Mis pedidos", y el dueño real no.
--
-- Además las ventas de un cliente registrado solo se le ligaban cuando entraba
-- a "Mis pedidos". Ahora se ligan al registrar la venta y al crear la cuenta.

-- ── 1. Cuenta de un teléfono (solo si hay exactamente una) ─────────────
create or replace function public.customer_for_phone(p_phone text)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select case when count(*) = 1 then (array_agg(p.id))[1] end
    from profiles p
   where length(right(regexp_replace(coalesce(p_phone, ''), '\D', '', 'g'), 8)) = 8
     and right(regexp_replace(coalesce(p.whatsapp, ''), '\D', '', 'g'), 8)
       = right(regexp_replace(coalesce(p_phone, ''), '\D', '', 'g'), 8);
$$;
revoke execute on function public.customer_for_phone(text) from public, anon, authenticated;

-- ── 2. Al guardar una venta, el teléfono manda ────────────────────────
--   · Sin teléfono: se respeta el customer_id que venga.
--   · El propio cliente comprando desde la tienda (customer_id = él mismo):
--     se respeta aunque ponga otro teléfono de contacto.
--   · Lo demás (lo registra el admin): la cuenta con ese teléfono, o
--     ninguna si el número no está registrado.
create or replace function public.link_customer_by_phone()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if length(right(regexp_replace(coalesce(new.guest_phone, ''), '\D', '', 'g'), 8)) < 8 then
    return new;
  end if;
  if new.customer_id is not null and new.customer_id = auth.uid()
     and not public.is_admin_user(auth.uid()) then
    return new;
  end if;
  new.customer_id := public.customer_for_phone(new.guest_phone);
  return new;
end;
$$;
revoke execute on function public.link_customer_by_phone() from public, anon, authenticated;

do $$
declare
  t text;
begin
  foreach t in array array['sales', 'orders', 'external_sales', 'special_orders'] loop
    execute format('drop trigger if exists link_customer_by_phone on public.%I', t);
    execute format(
      'create trigger link_customer_by_phone before insert or update of guest_phone, customer_id on public.%I
         for each row execute function public.link_customer_by_phone()', t);
  end loop;
end $$;

-- ── 3. Al crear la cuenta o cambiar el WhatsApp, se le ligan sus ventas ─
create or replace function public.link_sales_to_new_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_customer uuid := public.customer_for_phone(new.whatsapp);
  v_digits   text := right(regexp_replace(coalesce(new.whatsapp, ''), '\D', '', 'g'), 8);
begin
  if v_customer is null or v_customer <> new.id then
    return null;
  end if;
  update sales          set customer_id = new.id where customer_id is null and right(regexp_replace(coalesce(guest_phone, ''), '\D', '', 'g'), 8) = v_digits;
  update orders         set customer_id = new.id where customer_id is null and right(regexp_replace(coalesce(guest_phone, ''), '\D', '', 'g'), 8) = v_digits;
  update external_sales set customer_id = new.id where customer_id is null and right(regexp_replace(coalesce(guest_phone, ''), '\D', '', 'g'), 8) = v_digits;
  update special_orders set customer_id = new.id where customer_id is null and right(regexp_replace(coalesce(guest_phone, ''), '\D', '', 'g'), 8) = v_digits;
  return null;
end;
$$;
revoke execute on function public.link_sales_to_new_profile() from public, anon, authenticated;

drop trigger if exists link_sales_to_new_profile on public.profiles;
create trigger link_sales_to_new_profile
  after insert or update of whatsapp on public.profiles
  for each row execute function public.link_sales_to_new_profile();

-- ── 4. Corregir lo que ya existe ──────────────────────────────────────
-- Ventas con teléfono: ligadas a la cuenta de ese teléfono (o a ninguna).
-- Solo cambia lo que está mal o sin ligar; lo ligado correctamente queda igual.
do $$
declare
  t text;
begin
  foreach t in array array['sales', 'orders', 'external_sales', 'special_orders'] loop
    execute format($f$
      update public.%I r
         set customer_id = public.customer_for_phone(r.guest_phone)
       where length(right(regexp_replace(coalesce(r.guest_phone, ''), '\D', '', 'g'), 8)) = 8
         and r.customer_id is distinct from public.customer_for_phone(r.guest_phone)
         and (
           r.customer_id is null
           or not exists (select 1 from public.profiles p
                           where p.id = r.customer_id
                             and right(regexp_replace(coalesce(p.whatsapp, ''), '\D', '', 'g'), 8)
                               = right(regexp_replace(r.guest_phone, '\D', '', 'g'), 8))
         )$f$, t);
  end loop;
end $$;
