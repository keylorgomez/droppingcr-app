-- Abonos, cancelaciones y repartos en UNA transacción.
--
-- Antes la app registraba un abono en 3 llamadas sueltas (insertar el pago,
-- sumar, marcar completada y liberar el apartado) con datos que podían estar
-- viejos: un doble toque o dos admins a la vez registraban el abono dos veces.
-- Al cancelar, la devolución de stock y el reembolso ignoraban errores.
--
-- Todas bloquean la fila "padre" (FOR UPDATE), así dos llamadas simultáneas
-- sobre la misma venta se ejecutan una detrás de otra y la segunda ve lo que
-- hizo la primera. SECURITY INVOKER + chequeo de admin, igual que record_sale.

-- ── Cuánto se debe de cada cosa ──────────────────────────────────────────
-- La misma regla que usan finance_summary y la app:
--   venta:   sale_price (total de la línea) + envío
--   pedido:  Σ(precio unitario × cantidad) + envío
--   externa: sale_price
create or replace function public.payment_parent_owed(p_kind text, p_id uuid)
returns numeric
language sql
stable
set search_path = public
as $$
  select case p_kind
    when 'sale' then (select s.sale_price + coalesce(s.shipping_cost, 0) from sales s where s.id = p_id)
    when 'order' then (
      select coalesce((select sum(i.sale_price * i.quantity) from order_items i where i.order_id = o.id), 0)
             + coalesce(o.shipping_cost, 0)
        from orders o where o.id = p_id)
    when 'external' then (select e.sale_price from external_sales e where e.id = p_id)
  end;
$$;

create or replace function public.payment_parent_paid(p_kind text, p_id uuid)
returns numeric
language sql
stable
set search_path = public
as $$
  select coalesce(sum(amount), 0) from payments
   where case p_kind
           when 'sale'     then sale_id = p_id
           when 'order'    then order_id = p_id
           when 'external' then external_sale_id = p_id
         end;
$$;

-- ── Registrar un abono ───────────────────────────────────────────────────
-- p_kind: 'sale' | 'order' | 'external'. Devuelve el estado resultante para
-- que la app arme el recibo sin volver a consultar.
create or replace function public.add_payment(
  p_kind   text,
  p_id     uuid,
  p_amount numeric,
  p_note   text default null
)
returns jsonb
language plpgsql
set search_path = public
as $$
declare
  v_status    text;
  v_delivery  text;
  v_owed      numeric;
  v_paid      numeric;
  v_completed boolean := false;
begin
  if not public.is_admin_user(auth.uid()) then
    raise exception 'No autorizado' using errcode = '42501';
  end if;
  if p_amount is null or p_amount <= 0 then
    raise exception 'El monto debe ser mayor a 0';
  end if;

  -- Bloquear el padre: serializa abonos simultáneos sobre la misma venta.
  case p_kind
    when 'sale'     then select status, delivery_status into v_status, v_delivery from sales  where id = p_id for update;
    when 'order'    then select status, delivery_status into v_status, v_delivery from orders where id = p_id for update;
    when 'external' then select status, null            into v_status, v_delivery from external_sales where id = p_id for update;
    else raise exception 'Tipo inválido: %', p_kind;
  end case;
  if not found then
    raise exception 'Venta no encontrada';
  end if;
  if v_status = 'cancelled' then
    raise exception 'La venta está cancelada';
  end if;

  v_owed := public.payment_parent_owed(p_kind, p_id);
  v_paid := public.payment_parent_paid(p_kind, p_id);

  -- Un doble toque del mismo abono es la causa más común de pagos repetidos.
  if exists (
    select 1 from payments
     where amount = p_amount
       and paid_at > now() - interval '20 seconds'
       and case p_kind
             when 'sale'     then sale_id = p_id
             when 'order'    then order_id = p_id
             when 'external' then external_sale_id = p_id
           end
  ) then
    raise exception 'Ese abono ya se registró hace unos segundos';
  end if;

  if v_paid + p_amount > v_owed + 1 then
    raise exception 'El abono (₡%) supera lo que falta (₡%)', round(p_amount), round(greatest(v_owed - v_paid, 0));
  end if;

  insert into payments (sale_id, order_id, external_sale_id, amount, note)
  values (
    case when p_kind = 'sale'     then p_id end,
    case when p_kind = 'order'    then p_id end,
    case when p_kind = 'external' then p_id end,
    p_amount,
    nullif(trim(p_note), '')
  );
  v_paid := v_paid + p_amount;

  if v_paid >= v_owed then
    v_completed := true;
    if p_kind = 'sale' then
      update sales
         set status = 'completed',
             delivery_status = case when delivery_status = 'apartada' then 'confirmed' else delivery_status end
       where id = p_id;
      if v_delivery = 'apartada' then
        update product_variants set is_reserved = false
         where id = (select variant_id from sales where id = p_id);
      end if;
    elsif p_kind = 'order' then
      update orders
         set status = 'completed',
             delivery_status = case when delivery_status = 'apartada' then 'confirmed' else delivery_status end
       where id = p_id;
      if v_delivery = 'apartada' then
        update product_variants set is_reserved = false
         where id in (select variant_id from order_items where order_id = p_id);
      end if;
    else
      update external_sales set status = 'completed' where id = p_id;
    end if;
  end if;

  return jsonb_build_object(
    'total_owed', v_owed,
    'total_paid', v_paid,
    'remaining',  greatest(v_owed - v_paid, 0),
    'completed',  v_completed
  );
end;
$$;

-- ── Borrar un abono ──────────────────────────────────────────────────────
-- Si con eso deja de estar saldada, vuelve a "pendiente".
create or replace function public.delete_payment(p_payment_id uuid)
returns void
language plpgsql
set search_path = public
as $$
declare
  v_pay  payments%rowtype;
  v_kind text;
  v_id   uuid;
begin
  if not public.is_admin_user(auth.uid()) then
    raise exception 'No autorizado' using errcode = '42501';
  end if;

  select * into v_pay from payments where id = p_payment_id;
  if not found then
    raise exception 'Abono no encontrado';
  end if;

  if v_pay.sale_id is not null then
    v_kind := 'sale';     v_id := v_pay.sale_id;
    perform 1 from sales where id = v_id for update;
  elsif v_pay.order_id is not null then
    v_kind := 'order';    v_id := v_pay.order_id;
    perform 1 from orders where id = v_id for update;
  elsif v_pay.external_sale_id is not null then
    v_kind := 'external'; v_id := v_pay.external_sale_id;
    perform 1 from external_sales where id = v_id for update;
  end if;

  delete from payments where id = p_payment_id;

  if v_kind is not null
     and public.payment_parent_paid(v_kind, v_id) < public.payment_parent_owed(v_kind, v_id) then
    case v_kind
      when 'sale'     then update sales          set status = 'pending' where id = v_id and status = 'completed';
      when 'order'    then update orders         set status = 'pending' where id = v_id and status = 'completed';
      when 'external' then update external_sales set status = 'pending' where id = v_id and status = 'completed';
    end case;
  end if;
end;
$$;

-- ── Cancelar una venta o un pedido ───────────────────────────────────────
-- Devuelve el stock, suelta el apartado y registra el reembolso de lo que el
-- cliente ya había pagado (menos lo que ya se le hubiera reembolsado). Si ya
-- estaba cancelada no hace nada: un doble toque no devuelve el stock dos veces.
create or replace function public.cancel_sale(
  p_kind text,          -- 'sale' | 'order'
  p_id   uuid,
  p_note text default null
)
returns numeric          -- monto reembolsado
language plpgsql
set search_path = public
as $$
declare
  v_status   text;
  v_delivery text;
  v_variant  uuid;
  v_qty      integer;
  v_item     record;
  v_paid     numeric;
  v_refunded numeric;
  v_refund   numeric := 0;
begin
  if not public.is_admin_user(auth.uid()) then
    raise exception 'No autorizado' using errcode = '42501';
  end if;

  if p_kind = 'sale' then
    select status, delivery_status, variant_id, coalesce(quantity, 1)
      into v_status, v_delivery, v_variant, v_qty
      from sales where id = p_id for update;
  elsif p_kind = 'order' then
    select status, delivery_status into v_status, v_delivery
      from orders where id = p_id for update;
  else
    raise exception 'Tipo inválido: %', p_kind;
  end if;
  if not found then
    raise exception 'Venta no encontrada';
  end if;
  if v_status = 'cancelled' then
    return 0;
  end if;

  if p_kind = 'sale' then
    update sales
       set status = 'cancelled', delivery_status = 'cancelled',
           note = coalesce(nullif(trim(p_note), ''), note)
     where id = p_id;
    if v_variant is not null then
      update product_variants
         set stock = stock + v_qty,
             is_reserved = case when v_delivery = 'apartada' then false else is_reserved end
       where id = v_variant;
    end if;
  else
    update orders
       set status = 'cancelled', delivery_status = 'cancelled',
           note = coalesce(nullif(trim(p_note), ''), note)
     where id = p_id;
    for v_item in select variant_id, quantity from order_items where order_id = p_id loop
      update product_variants
         set stock = stock + v_item.quantity,
             is_reserved = case when v_delivery = 'apartada' then false else is_reserved end
       where id = v_item.variant_id;
    end loop;
  end if;

  v_paid := public.payment_parent_paid(p_kind, p_id);
  select coalesce(sum(amount), 0) into v_refunded from refunds
   where (p_kind = 'sale' and sale_id = p_id) or (p_kind = 'order' and order_id = p_id);
  v_refund := greatest(v_paid - v_refunded, 0);

  if v_refund > 0 then
    insert into refunds (sale_id, order_id, amount, reason, created_by)
    values (
      case when p_kind = 'sale'  then p_id end,
      case when p_kind = 'order' then p_id end,
      v_refund,
      coalesce(nullif(trim(p_note), ''), case when p_kind = 'sale' then 'Cancelación de venta' else 'Cancelación de pedido' end),
      auth.uid()
    );
  end if;

  return v_refund;
end;
$$;

-- ── Tope de repartos ─────────────────────────────────────────────────────
-- Nadie puede registrar un reparto mayor a la caja del negocio (utilidad
-- histórica − lo que falta cobrar − lo ya repartido). La regla del 60% sigue
-- siendo un aviso en la app; esto es el límite duro: no repartir plata que no
-- existe.
create or replace function public.guard_payout_amount()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_available numeric;
begin
  if tg_op = 'UPDATE' and new.amount <= old.amount then
    return new;
  end if;

  v_available := (public.finance_summary(null, null)->>'available')::numeric;
  if tg_op = 'UPDATE' then
    v_available := v_available + old.amount;
  end if;

  if new.amount > v_available + 1 then
    raise exception 'El reparto (₡%) supera la caja del negocio (₡%)',
      round(new.amount), round(greatest(v_available, 0))
      using errcode = 'P0001';
  end if;
  return new;
end;
$$;

drop trigger if exists admin_payouts_guard_amount on public.admin_payouts;
create trigger admin_payouts_guard_amount
  before insert or update of amount on public.admin_payouts
  for each row execute function public.guard_payout_amount();

-- ── Permisos ─────────────────────────────────────────────────────────────
revoke execute on function public.payment_parent_owed(text, uuid)          from public, anon;
revoke execute on function public.payment_parent_paid(text, uuid)          from public, anon;
revoke execute on function public.add_payment(text, uuid, numeric, text)   from public, anon;
revoke execute on function public.delete_payment(uuid)                     from public, anon;
revoke execute on function public.cancel_sale(text, uuid, text)            from public, anon;
revoke execute on function public.guard_payout_amount()                    from public, anon, authenticated;
grant  execute on function public.payment_parent_owed(text, uuid)          to authenticated;
grant  execute on function public.payment_parent_paid(text, uuid)          to authenticated;
grant  execute on function public.add_payment(text, uuid, numeric, text)   to authenticated;
grant  execute on function public.delete_payment(uuid)                     to authenticated;
grant  execute on function public.cancel_sale(text, uuid, text)            to authenticated;

-- ── Piezas quietas ───────────────────────────────────────────────────────
-- Producto activo con stock que lleva más de p_days días publicado y no se ha
-- vendido en ese tiempo: plata parada en bodega. Guía qué rebajar y qué no
-- volver a comprar.
create or replace function public.stale_inventory(p_days integer default 60)
returns table (
  product_id   uuid,
  name         text,
  slug         text,
  units        bigint,
  stock_cost   numeric,
  days_listed  integer,
  last_sold_at timestamptz
)
language plpgsql
stable
set search_path = public
as $$
begin
  if not public.is_admin_user(auth.uid()) then
    raise exception 'No autorizado' using errcode = '42501';
  end if;

  return query
  with stock as (
    select v.product_id, sum(v.stock)::bigint as units
      from product_variants v
     where v.stock > 0
     group by v.product_id
  ),
  last_sale as (
    select v.product_id, max(l.sold_at) as last_sold_at
      from sale_lines l
      join product_variants v on v.id = l.variant_id
     group by v.product_id
  )
  select p.id, p.name::text, p.slug::text, s.units,
         (coalesce(p.price_purchase, 0) * s.units)::numeric,
         (current_date - p.created_at::date)::integer,
         ls.last_sold_at
    from products p
    join stock s on s.product_id = p.id
    left join last_sale ls on ls.product_id = p.id
   where p.is_active
     and p.created_at < now() - make_interval(days => p_days)
     and (ls.last_sold_at is null or ls.last_sold_at < now() - make_interval(days => p_days))
   order by coalesce(p.price_purchase, 0) * s.units desc;
end;
$$;

-- ── Exportar ventas a CSV ────────────────────────────────────────────────
-- Una fila por línea vendida (sin canceladas), con lo que hace falta para la
-- contabilidad. Montos en colones; el envío va aparte porque es de paso.
create or replace function public.sales_export(
  p_from timestamptz default null,
  p_to   timestamptz default null
)
returns table (
  sold_at   timestamptz,
  source    text,
  customer  text,
  phone     text,
  product   text,
  size      text,
  quantity  integer,
  revenue   numeric,
  cost      numeric,
  margin    numeric,
  shipping  numeric,
  status    text
)
language plpgsql
stable
set search_path = public
as $$
begin
  if not public.is_admin_user(auth.uid()) then
    raise exception 'No autorizado' using errcode = '42501';
  end if;

  return query
  select * from (
    select s.sold_at::timestamptz, 'Venta'::text, s.guest_name::text, s.guest_phone::text, p.name::text, v.size::text,
           coalesce(s.quantity, 1)::integer, s.sale_price::numeric, s.cost_price::numeric,
           (s.sale_price - s.cost_price)::numeric, coalesce(s.shipping_cost, 0)::numeric, s.status::text
      from sales s
      left join product_variants v on v.id = s.variant_id
      left join products p on p.id = s.product_id
     where coalesce(s.status, 'completed') <> 'cancelled'
    union all
    select o.sold_at::timestamptz, 'Pedido'::text, o.guest_name::text, o.guest_phone::text, p.name::text, v.size::text,
           i.quantity::integer, (i.sale_price * i.quantity)::numeric, (coalesce(i.cost_price, 0) * i.quantity)::numeric,
           ((i.sale_price - coalesce(i.cost_price, 0)) * i.quantity)::numeric,
           -- el envío del pedido va solo en su primera línea, para no repetirlo
           case when i.id = (select min(i2.id::text)::uuid from order_items i2 where i2.order_id = o.id)
                then coalesce(o.shipping_cost, 0) else 0 end::numeric,
           o.status::text
      from order_items i
      join orders o on o.id = i.order_id
      left join product_variants v on v.id = i.variant_id
      left join products p on p.id = v.product_id
     where o.status <> 'cancelled'
    union all
    select e.sold_at::timestamptz, 'Externa'::text, e.guest_name::text, e.guest_phone::text, e.product_name::text, null::text,
           1, e.sale_price::numeric, e.cost_price::numeric, (e.sale_price - e.cost_price)::numeric, 0::numeric, e.status::text
      from external_sales e
  ) x
  where (p_from is null or x.sold_at >= p_from)
    and (p_to   is null or x.sold_at <  p_to)
  order by x.sold_at;
end;
$$;

revoke execute on function public.stale_inventory(integer)                  from public, anon;
revoke execute on function public.sales_export(timestamptz, timestamptz)     from public, anon;
grant  execute on function public.stale_inventory(integer)                  to authenticated;
grant  execute on function public.sales_export(timestamptz, timestamptz)     to authenticated;

-- ── Encargos visibles para el cliente ────────────────────────────────────
-- Igual que claim_external_sales_by_phone: el cliente reclama los encargos
-- hechos con su número y desde ahí los ve en "Mis pedidos" (la política
-- special_orders_select_own ya existe).
create or replace function public.claim_special_orders_by_phone(
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
  if auth.uid() is null or auth.uid() <> p_user_id or length(digits) < 8 then
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
    update special_orders
       set customer_id = p_user_id
     where customer_id is null
       and right(regexp_replace(coalesce(guest_phone, ''), '\D', '', 'g'), 8) = digits
    returning 1
  )
  select count(*) into claimed from claimed_rows;

  return coalesce(claimed, 0);
end;
$$;

revoke execute on function public.claim_special_orders_by_phone(uuid, text) from public, anon;
grant  execute on function public.claim_special_orders_by_phone(uuid, text) to authenticated;

-- El cliente NO debe poder leer estimated_cost (el costo de la tienda). La
-- política de lectura directa lo exponía por la API; se reemplaza por una
-- función que devuelve solo lo que le toca ver.
drop policy if exists "special_orders_select_own" on public.special_orders;

create or replace function public.my_special_orders()
returns table (
  id              uuid,
  description     text,
  size            text,
  estimated_price numeric,
  status          text,
  created_at      timestamptz,
  delivered_at    timestamptz,
  paid            numeric
)
language sql
stable
security definer
set search_path = public
as $$
  select so.id, so.description::text, so.size::text, so.estimated_price::numeric, so.status::text,
         so.created_at::timestamptz, so.delivered_at::timestamptz,
         coalesce((select sum(p.amount) from payments p where p.special_order_id = so.id), 0)::numeric
    from special_orders so
   where so.customer_id = auth.uid()
     and auth.uid() is not null
   order by so.created_at desc;
$$;

revoke execute on function public.my_special_orders() from public, anon;
grant  execute on function public.my_special_orders() to authenticated;
