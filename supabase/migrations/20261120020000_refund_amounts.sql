-- Devolver todo, una parte o nada al cancelar.
--
-- Al cancelar una venta (de cualquier tipo) o un encargo se elige cuánto se le
-- devolvió al cliente. Lo que NO se devolvió es plata que el negocio se queda
-- (un adelanto que nadie reclamó, una devolución parcial): queda guardado en
-- `retained_amount` y cuenta como ganancia en el Dashboard y en la caja
-- repartible. Antes un encargo cancelado sin devolver dejaba esa plata en
-- Movimientos pero fuera de la utilidad, y la caja salía más baja de lo real.

-- ── 1. Columnas ──────────────────────────────────────────────────────────
alter table public.sales          add column if not exists cancelled_at    timestamptz;
alter table public.orders         add column if not exists cancelled_at    timestamptz;
alter table public.sales          add column if not exists retained_amount numeric not null default 0;
alter table public.orders         add column if not exists retained_amount numeric not null default 0;
alter table public.external_sales add column if not exists retained_amount numeric not null default 0;
alter table public.special_orders add column if not exists retained_amount numeric not null default 0;

-- Lo ya cancelado antes de hoy: lo pagado menos lo devuelto.
update public.special_orders so
   set retained_amount = greatest(
         coalesce((select sum(amount) from public.payments p where p.special_order_id = so.id), 0)
       - coalesce((select sum(amount) from public.refunds  r where r.special_order_id = so.id), 0), 0)
 where so.status = 'cancelled';
update public.sales s
   set retained_amount = greatest(
         coalesce((select sum(amount) from public.payments p where p.sale_id = s.id), 0)
       - coalesce((select sum(amount) from public.refunds  r where r.sale_id = s.id), 0), 0)
 where s.status = 'cancelled';
update public.orders o
   set retained_amount = greatest(
         coalesce((select sum(amount) from public.payments p where p.order_id = o.id), 0)
       - coalesce((select sum(amount) from public.refunds  r where r.order_id = o.id), 0), 0)
 where o.status = 'cancelled';

-- ── 2. Cancelar venta: p_refund_amount = cuánto se devolvió ─────────────
-- null = todo lo pagado (lo que hacía antes), 0 = nada.
drop function if exists public.cancel_sale(text, uuid, text, boolean);

create or replace function public.cancel_sale(
  p_kind          text,           -- 'sale' | 'order' | 'external'
  p_id            uuid,
  p_note          text    default null,
  p_refund_amount numeric default null
)
returns numeric                   -- monto devuelto
language plpgsql
set search_path = public
as $$
declare
  v_status   text;
  v_delivery text;
  v_variant  uuid;
  v_qty      integer;
  v_price    numeric;
  v_item     record;
  v_paid     numeric;
  v_refunded numeric;
  v_refund   numeric;
  v_note     text := nullif(trim(p_note), '');
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
  elsif p_kind = 'external' then
    select status, sale_price into v_status, v_price
      from external_sales where id = p_id for update;
  else
    raise exception 'Tipo inválido: %', p_kind;
  end if;
  if not found then
    raise exception 'Venta no encontrada';
  end if;
  if v_status = 'cancelled' then
    return 0;
  end if;

  -- Lo pagado, antes de cambiar el estado. Una externa de contado no tiene
  -- filas en payments: se cobró completa al registrarla.
  v_paid := public.payment_parent_paid(p_kind, p_id);
  if p_kind = 'external' and v_paid = 0 and v_status = 'completed' then
    v_paid := v_price;
  end if;
  select coalesce(sum(amount), 0) into v_refunded from refunds
   where (p_kind = 'sale'     and sale_id          = p_id)
      or (p_kind = 'order'    and order_id         = p_id)
      or (p_kind = 'external' and external_sale_id = p_id);

  v_refund := coalesce(p_refund_amount, greatest(v_paid - v_refunded, 0));
  if v_refund < 0 then
    raise exception 'La devolución no puede ser negativa';
  end if;
  if v_refund > greatest(v_paid - v_refunded, 0) + 1 then
    raise exception 'La devolución (₡%) supera lo que pagó el cliente (₡%)',
      round(v_refund), round(greatest(v_paid - v_refunded, 0));
  end if;

  if p_kind = 'sale' then
    update sales
       set status = 'cancelled', delivery_status = 'cancelled', cancelled_at = now(),
           retained_amount = greatest(v_paid - v_refunded - v_refund, 0),
           note = coalesce(v_note, note)
     where id = p_id;
    if v_variant is not null then
      update product_variants
         set stock = stock + v_qty,
             is_reserved = case when v_delivery = 'apartada' then false else is_reserved end
       where id = v_variant;
    end if;
  elsif p_kind = 'order' then
    update orders
       set status = 'cancelled', delivery_status = 'cancelled', cancelled_at = now(),
           retained_amount = greatest(v_paid - v_refunded - v_refund, 0),
           note = coalesce(v_note, note)
     where id = p_id;
    for v_item in select variant_id, quantity from order_items where order_id = p_id loop
      update product_variants
         set stock = stock + v_item.quantity,
             is_reserved = case when v_delivery = 'apartada' then false else is_reserved end
       where id = v_item.variant_id;
    end loop;
  else
    update external_sales
       set status = 'cancelled', cancelled_at = now(),
           retained_amount = greatest(v_paid - v_refunded - v_refund, 0),
           note = case when v_note is null then note
                       else coalesce(note || ' · ', '') || 'Cancelada: ' || v_note end
     where id = p_id;
    update special_orders
       set status = 'cancelled', cancelled_at = now(),
           note = coalesce(note || ' · ', '') || 'Cancelado después de entregar'
                  || coalesce(': ' || v_note, '')
     where external_sale_id = p_id and status <> 'cancelled';
  end if;

  if v_refund > 0 then
    insert into refunds (sale_id, order_id, external_sale_id, amount, reason, created_by)
    values (
      case when p_kind = 'sale'     then p_id end,
      case when p_kind = 'order'    then p_id end,
      case when p_kind = 'external' then p_id end,
      v_refund,
      coalesce(v_note, case p_kind when 'sale' then 'Cancelación de venta'
                                   when 'order' then 'Cancelación de pedido'
                                   else 'Cancelación de venta externa' end),
      auth.uid()
    );
  end if;

  return v_refund;
end;
$$;

revoke execute on function public.cancel_sale(text, uuid, text, numeric) from public, anon;
grant  execute on function public.cancel_sale(text, uuid, text, numeric) to authenticated;

-- ── 3. Cancelar encargo: devolver todo, una parte o nada ────────────────
drop function if exists public.cancel_special_order(uuid, boolean, text);

create or replace function public.cancel_special_order(
  p_id            uuid,
  p_refund_amount numeric,
  p_reason        text default null
)
returns void
language plpgsql
set search_path = public
as $$
declare
  v_status   text;
  v_paid     numeric;
  v_refunded numeric;
  v_reason   text := nullif(trim(p_reason), '');
begin
  if not public.is_admin_user(auth.uid()) then
    raise exception 'No autorizado' using errcode = '42501';
  end if;

  select status into v_status from special_orders where id = p_id for update;
  if not found then
    raise exception 'Encargo no encontrado';
  end if;
  if v_status in ('delivered', 'cancelled') then
    raise exception 'Este encargo ya no se puede cancelar';
  end if;

  select coalesce(sum(amount), 0) into v_paid     from payments where special_order_id = p_id;
  select coalesce(sum(amount), 0) into v_refunded from refunds  where special_order_id = p_id;

  if coalesce(p_refund_amount, 0) < 0 then
    raise exception 'La devolución no puede ser negativa';
  end if;
  if coalesce(p_refund_amount, 0) > greatest(v_paid - v_refunded, 0) + 1 then
    raise exception 'La devolución (₡%) supera el adelanto (₡%)',
      round(p_refund_amount), round(greatest(v_paid - v_refunded, 0));
  end if;

  if coalesce(p_refund_amount, 0) > 0 then
    insert into refunds (special_order_id, amount, reason, created_by)
    values (p_id, p_refund_amount, coalesce(v_reason, 'Encargo cancelado'), auth.uid());
  end if;

  update special_orders
     set status = 'cancelled', cancelled_at = now(),
         retained_amount = greatest(v_paid - v_refunded - coalesce(p_refund_amount, 0), 0),
         note = case when v_reason is null then note
                     else coalesce(note || ' · ', '') || 'Cancelado: ' || v_reason end
   where id = p_id;
end;
$$;

revoke execute on function public.cancel_special_order(uuid, numeric, text) from public, anon;
grant  execute on function public.cancel_special_order(uuid, numeric, text) to authenticated;

-- ── 4. Resumen financiero con lo retenido ────────────────────────────────
create or replace function public.finance_summary(
  p_from timestamptz default null,
  p_to   timestamptz default null
)
returns jsonb
language plpgsql
stable
set search_path = public
as $$
declare
  v_revenue     numeric;
  v_cost        numeric;
  v_lines       integer;
  v_tickets     integer;
  v_shipping    numeric;
  v_opex        numeric;
  v_inventory   numeric;
  v_ship_paid   numeric;
  v_advances    numeric;
  v_active_so   integer;
  v_receivable  numeric;
  v_distributed numeric;
  v_adjustment  numeric;
  v_all_margin  numeric;
  v_all_opex    numeric;
  v_stock_cost  numeric;
  v_retained    numeric;
  v_all_retained numeric;
begin
  if not public.is_admin_user(auth.uid()) then
    raise exception 'No autorizado' using errcode = '42501';
  end if;

  select coalesce(sum(revenue), 0), coalesce(sum(cost), 0), coalesce(sum(quantity), 0),
         count(distinct source || source_id::text)
    into v_revenue, v_cost, v_lines, v_tickets
    from sale_lines
   where (p_from is null or sold_at >= p_from)
     and (p_to   is null or sold_at <  p_to);

  select coalesce(sum(shipping_cost), 0) into v_shipping from (
    select shipping_cost, sold_at from sales  where coalesce(status, 'completed') <> 'cancelled'
    union all
    select shipping_cost, sold_at from orders where status <> 'cancelled'
  ) x
   where (p_from is null or sold_at >= p_from)
     and (p_to   is null or sold_at <  p_to);

  select coalesce(sum(amount) filter (where kind = 'operating'), 0),
         coalesce(sum(amount) filter (where kind = 'inventory'), 0),
         coalesce(sum(amount) filter (where kind = 'shipping'),  0)
    into v_opex, v_inventory, v_ship_paid
    from expenses
   where (p_from is null or created_at >= p_from)
     and (p_to   is null or created_at <  p_to);

  -- Saldos y reparto son "a hoy", no del periodo.
  select coalesce(sum(greatest(owed - paid, 0)), 0) into v_receivable from (
    select s.sale_price + coalesce(s.shipping_cost, 0) as owed,
           coalesce((select sum(amount) from payments p where p.sale_id = s.id), 0) as paid
      from sales s where s.status = 'pending'
    union all
    select coalesce((select sum(i.sale_price * i.quantity) from order_items i where i.order_id = o.id), 0)
             + coalesce(o.shipping_cost, 0),
           coalesce((select sum(amount) from payments p where p.order_id = o.id), 0)
      from orders o where o.status = 'pending'
    union all
    select e.sale_price,
           coalesce((select sum(amount) from payments p where p.external_sale_id = e.id), 0)
      from external_sales e where e.status = 'pending'
  ) d;

  select coalesce(sum(amount), 0) into v_distributed from admin_payouts;
  -- Ajustes de conciliación (ver finance_adjustments): restan de lo repartido.
  select coalesce(sum(amount), 0) into v_adjustment from finance_adjustments;
  v_distributed := v_distributed - v_adjustment;

  -- Adelantos de encargos todavía no entregados: plata del cliente en
  -- custodia. Se informa aparte y NO entra a utilidad ni a caja repartible.
  select coalesce(sum(p.amount), 0) into v_advances
    from payments p join special_orders so on so.id = p.special_order_id
   where so.status not in ('delivered', 'cancelled');
  select count(*) into v_active_so from special_orders where status not in ('delivered', 'cancelled');
  select coalesce(sum(revenue - cost), 0) into v_all_margin from sale_lines;
  select coalesce(sum(amount), 0) into v_all_opex from expenses where kind = 'operating';

  -- Plata que el negocio se quedó de ventas o encargos cancelados (adelanto
  -- no reclamado, devolución parcial). Es ingreso: entró y no se devolvió.
  select coalesce(sum(retained_amount) filter (where (p_from is null or at >= p_from) and (p_to is null or at < p_to)), 0),
         coalesce(sum(retained_amount), 0)
    into v_retained, v_all_retained
    from (
      select retained_amount, coalesce(cancelled_at, sold_at)    as at from sales          where retained_amount > 0
      union all
      select retained_amount, coalesce(cancelled_at, sold_at)          from orders         where retained_amount > 0
      union all
      select retained_amount, coalesce(cancelled_at, sold_at)          from external_sales where retained_amount > 0
      union all
      select retained_amount, coalesce(cancelled_at, created_at)       from special_orders where retained_amount > 0
    ) r;

  select coalesce(sum(coalesce(p.price_purchase, 0) * v.stock), 0)
    into v_stock_cost
    from product_variants v join products p on p.id = v.product_id
   where v.stock > 0;

  return jsonb_build_object(
    -- Periodo
    'revenue',            v_revenue,
    'cost',               v_cost,
    'gross_margin',       v_revenue - v_cost,
    'operating_expenses', v_opex,
    'inventory_purchases',v_inventory,
    'net_profit',         v_revenue - v_cost - v_opex + v_retained,
    'retained',           v_retained,
    'units',              v_lines,
    'tickets',            v_tickets,
    'shipping_collected', v_shipping,
    'shipping_paid',      v_ship_paid,
    -- A hoy
    'receivables',        v_receivable,
    'distributed',        v_distributed,
    'adjustments',        v_adjustment,
    'all_time_net',       v_all_margin - v_all_opex + v_all_retained,
    'available',          v_all_margin - v_all_opex + v_all_retained - v_receivable - v_distributed,
    'stock_cost',         v_stock_cost,
    'special_order_advances', v_advances,
    'special_orders_active',  v_active_so
  );
end;
$$;
