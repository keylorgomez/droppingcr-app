-- Vincular una venta externa con un cliente registrado.
--
-- Son dos momentos distintos:
--   1. Al registrarla, si el WhatsApp ya corresponde a un perfil, se enlaza en
--      el acto (`lookup_customer_profile_by_phone`).
--   2. Si la persona se registra después, reclama sus ventas externas igual que
--      ya hace con sales/orders (`claim_external_sales_by_phone`).

-- ── 1. Perfil + nombre por teléfono ──────────────────────────────────────
-- `lookup_customer_by_phone` ya devuelve el nombre para autocompletar, pero no
-- el id, y sin id no se puede enlazar la venta. Esta devuelve ambos y se queda
-- como la versión buena; la anterior sigue viva para no tocar los formularios
-- de venta y pedido que ya la usan.
create or replace function public.lookup_customer_profile_by_phone(phone_input text)
returns table (customer_id uuid, full_name text)
language plpgsql
security definer
set search_path = public
as $$
declare
  digits text := right(regexp_replace(coalesce(phone_input, ''), '\D', '', 'g'), 8);
begin
  -- SECURITY DEFINER salta RLS, así que el chequeo de admin es lo único que
  -- impide que cualquier usuario enumere clientes por teléfono.
  if not exists (select 1 from profiles where id = auth.uid() and role = 'admin') then
    return;
  end if;

  if length(digits) < 8 then
    return;
  end if;

  -- Perfil registrado: es la fuente más confiable y la única que da un id.
  return query
  select p.id,
         nullif(trim(coalesce(p.first_name, '') || ' ' || coalesce(p.last_name, '')), '')
  from profiles p
  where right(regexp_replace(coalesce(p.whatsapp, ''), '\D', '', 'g'), 8) = digits
  limit 1;

  if found then
    return;
  end if;

  -- Sin perfil: al menos el nombre del historial de ventas, para no obligar a
  -- reescribirlo. Sin id, la venta queda de invitado hasta que se registre.
  return query
  select null::uuid, h.guest_name
  from (
    select guest_name, sold_at from sales
      where right(regexp_replace(coalesce(guest_phone, ''), '\D', '', 'g'), 8) = digits
        and nullif(trim(guest_name), '') is not null
    union all
    select guest_name, sold_at from orders
      where right(regexp_replace(coalesce(guest_phone, ''), '\D', '', 'g'), 8) = digits
        and nullif(trim(guest_name), '') is not null
    union all
    select guest_name, sold_at from external_sales
      where right(regexp_replace(coalesce(guest_phone, ''), '\D', '', 'g'), 8) = digits
        and nullif(trim(guest_name), '') is not null
  ) h
  order by h.sold_at desc
  limit 1;
end;
$$;

grant execute on function public.lookup_customer_profile_by_phone(text) to authenticated;

-- ── 2. Reclamar ventas externas al registrarse ───────────────────────────
-- No se toca `claim_orders_by_phone`: se añade una hermana para external_sales
-- y la app llama a las dos. Menos riesgo que reescribir una función que ya
-- funciona para sales y orders.
create or replace function public.claim_external_sales_by_phone(
  p_user_id     uuid,
  p_phone_last8 text
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  digits  text := right(regexp_replace(coalesce(p_phone_last8, ''), '\D', '', 'g'), 8);
  claimed integer;
begin
  -- Solo el propio usuario puede reclamar, y solo con su teléfono verificado:
  -- sin esto, cualquiera podría apropiarse de la deuda (y los datos) de otro.
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

  with claimed_rows as (
    update external_sales
       set customer_id = p_user_id
     where customer_id is null
       and right(regexp_replace(coalesce(guest_phone, ''), '\D', '', 'g'), 8) = digits
    returning 1
  )
  select count(*) into claimed from claimed_rows;

  return coalesce(claimed, 0);
end;
$$;

grant execute on function public.claim_external_sales_by_phone(uuid, text) to authenticated;
