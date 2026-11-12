-- Encargos: piezas que se piden al proveedor contra pedido del cliente.
--
-- Se cotiza un precio estimado y el cliente suele dejar un adelanto, pero el
-- costo y el precio reales se conocen hasta que la pieza llega a CR. Un
-- adelanto NO es venta ni ganancia: es plata del cliente en custodia (si la
-- pieza no llega, se devuelve). Por eso un encargo no toca ventas, margen ni
-- utilidad hasta que se entrega; en ese momento se convierte en una venta
-- externa con precio y costo reales y sus adelantos pasan a ser abonos de esa
-- venta.

-- ── 1. Tabla ─────────────────────────────────────────────────────────────
create table if not exists public.special_orders (
  id               uuid primary key default gen_random_uuid(),
  customer_id      uuid references public.profiles(id) on delete set null,
  guest_name       text,
  guest_phone      text,
  description      text not null,
  size             text,
  reference_url    text,
  estimated_price  numeric not null default 0 check (estimated_price >= 0),
  estimated_cost   numeric check (estimated_cost >= 0),
  status           text not null default 'quoted'
                   check (status in ('quoted', 'ordered', 'in_transit', 'arrived', 'delivered', 'cancelled')),
  note             text,
  external_sale_id uuid references public.external_sales(id) on delete set null,
  created_by       uuid default auth.uid(),
  created_at       timestamptz not null default now(),
  delivered_at     timestamptz,
  cancelled_at     timestamptz
);

create index if not exists special_orders_status_idx   on public.special_orders (status);
create index if not exists special_orders_customer_idx on public.special_orders (customer_id) where customer_id is not null;

alter table public.special_orders enable row level security;

drop policy if exists "special_orders_admin_all" on public.special_orders;
create policy "special_orders_admin_all"
  on public.special_orders for all
  to authenticated
  using (public.is_admin_user((select auth.uid())))
  with check (public.is_admin_user((select auth.uid())));

drop policy if exists "special_orders_select_own" on public.special_orders;
create policy "special_orders_select_own"
  on public.special_orders for select
  to authenticated
  using (customer_id = (select auth.uid()));

-- ── 2. Adelantos en la misma tabla de pagos (salen en Movimientos) ───────
alter table public.payments
  add column if not exists special_order_id uuid references public.special_orders(id) on delete cascade;

create index if not exists payments_special_order_idx
  on public.payments (special_order_id) where special_order_id is not null;

alter table public.payments drop constraint if exists payments_single_parent;
alter table public.payments
  add constraint payments_single_parent
  check (num_nonnulls(sale_id, order_id, external_sale_id, special_order_id) = 1);

drop policy if exists "payments_select_own_special" on public.payments;
create policy "payments_select_own_special"
  on public.payments for select
  to authenticated
  using (exists (
    select 1 from public.special_orders so
    where so.id = payments.special_order_id and so.customer_id = (select auth.uid())
  ));

-- Devolución de un adelanto cuando un encargo se cancela.
alter table public.refunds
  add column if not exists special_order_id uuid references public.special_orders(id) on delete set null;

-- ── 3. Crear encargo (con adelanto opcional), todo junto ─────────────────
create or replace function public.create_special_order(p jsonb)
returns uuid
language plpgsql
set search_path = public
as $$
declare
  v_id      uuid;
  v_advance numeric := coalesce((p->>'advance')::numeric, 0);
begin
  if not public.is_admin_user(auth.uid()) then
    raise exception 'No autorizado' using errcode = '42501';
  end if;
  if coalesce(trim(p->>'description'), '') = '' then
    raise exception 'Falta describir qué se encargó';
  end if;

  insert into special_orders (
    customer_id, guest_name, guest_phone, description, size, reference_url,
    estimated_price, estimated_cost, note, status
  ) values (
    nullif(p->>'customer_id', '')::uuid,
    nullif(trim(p->>'guest_name'), ''), nullif(trim(p->>'guest_phone'), ''),
    trim(p->>'description'), nullif(trim(p->>'size'), ''), nullif(trim(p->>'reference_url'), ''),
    coalesce((p->>'estimated_price')::numeric, 0), nullif(p->>'estimated_cost', '')::numeric,
    nullif(trim(p->>'note'), ''), coalesce(nullif(p->>'status', ''), 'quoted')
  )
  returning id into v_id;

  if v_advance > 0 then
    insert into payments (special_order_id, amount, note)
    values (v_id, v_advance, 'Adelanto de encargo');
  end if;

  return v_id;
end;
$$;

-- ── 4. Entregar: se convierte en venta externa con números reales ────────
create or replace function public.deliver_special_order(
  p_id           uuid,
  p_final_price  numeric,
  p_cost         numeric,
  p_product_name text default null
)
returns uuid
language plpgsql
set search_path = public
as $$
declare
  v_order   special_orders%rowtype;
  v_paid    numeric;
  v_sale_id uuid;
begin
  if not public.is_admin_user(auth.uid()) then
    raise exception 'No autorizado' using errcode = '42501';
  end if;
  if p_final_price is null or p_final_price <= 0 then
    raise exception 'Falta el precio final';
  end if;
  if p_cost is null or p_cost < 0 then
    raise exception 'Falta el costo real';
  end if;

  select * into v_order from special_orders where id = p_id for update;
  if not found then
    raise exception 'Encargo no encontrado';
  end if;
  if v_order.status in ('delivered', 'cancelled') then
    raise exception 'Este encargo ya está %', case v_order.status when 'delivered' then 'entregado' else 'cancelado' end;
  end if;

  select coalesce(sum(amount), 0) into v_paid from payments where special_order_id = p_id;

  insert into external_sales (
    product_name, sale_price, cost_price, note, created_by,
    customer_id, guest_name, guest_phone, status
  ) values (
    coalesce(nullif(trim(p_product_name), ''), v_order.description)
      || coalesce(' · Talla ' || v_order.size, ''),
    p_final_price, p_cost,
    'Encargo' || coalesce(' — ' || v_order.note, ''),
    auth.uid(),
    v_order.customer_id, v_order.guest_name, v_order.guest_phone,
    case when v_paid >= p_final_price then 'completed' else 'pending' end
  )
  returning id into v_sale_id;

  -- Los adelantos pasan a ser abonos de la venta: siguen en Movimientos y
  -- cuentan para lo que el cliente ya pagó.
  update payments
     set external_sale_id = v_sale_id, special_order_id = null
   where special_order_id = p_id;

  update special_orders
     set status = 'delivered', delivered_at = now(), external_sale_id = v_sale_id
   where id = p_id;

  return v_sale_id;
end;
$$;

-- ── 5. Cancelar: registra la devolución del adelanto si se devolvió ──────
create or replace function public.cancel_special_order(
  p_id     uuid,
  p_refund boolean,
  p_reason text default null
)
returns void
language plpgsql
set search_path = public
as $$
declare
  v_status text;
  v_paid   numeric;
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

  select coalesce(sum(amount), 0) into v_paid from payments where special_order_id = p_id;

  if p_refund and v_paid > 0 then
    insert into refunds (special_order_id, amount, reason, created_by)
    values (p_id, v_paid, coalesce(nullif(trim(p_reason), ''), 'Encargo cancelado'), auth.uid());
  end if;

  update special_orders
     set status = 'cancelled', cancelled_at = now(),
         note = case when nullif(trim(p_reason), '') is null then note
                     else coalesce(note || ' · ', '') || 'Cancelado: ' || trim(p_reason) end
   where id = p_id;
end;
$$;

revoke execute on function public.create_special_order(jsonb)                          from public, anon;
revoke execute on function public.deliver_special_order(uuid, numeric, numeric, text)  from public, anon;
revoke execute on function public.cancel_special_order(uuid, boolean, text)            from public, anon;
grant  execute on function public.create_special_order(jsonb)                          to authenticated;
grant  execute on function public.deliver_special_order(uuid, numeric, numeric, text)  to authenticated;
grant  execute on function public.cancel_special_order(uuid, boolean, text)            to authenticated;

-- ── 6. Resumen financiero con los adelantos de encargos aparte ───────────
-- ── Resumen financiero ───────────────────────────────────────────────────
-- Utilidad neta    = margen bruto − gastos operativos
-- Disponible       = utilidad neta − lo que falta cobrar − lo ya repartido
--
-- Lo que falta cobrar se resta completo: el costo de esa mercadería ya se
-- pagó al comprarla, así que hasta que el cliente pague no hay ganancia en
-- caja. Las devoluciones no se restan: solo salen de ventas canceladas, que ya
-- no están en el margen.
--
-- Los gastos de tipo 'inventory' (compra de mercadería e importación) no bajan
-- la utilidad: ese dinero ya está en el costo de cada prenda puesta en CR.
-- Los de tipo 'shipping' (Correos / mensajero a clientes) tampoco: es dinero
-- de paso, lo cobra el cliente y se le paga al courier. Se informan aparte
-- (cobrado vs. pagado) para ver si cuadran, pero no son ganancia ni pérdida.
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
  v_all_margin  numeric;
  v_all_opex    numeric;
  v_stock_cost  numeric;
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

  -- Adelantos de encargos todavía no entregados: plata del cliente en
  -- custodia. Se informa aparte y NO entra a utilidad ni a caja repartible.
  select coalesce(sum(p.amount), 0) into v_advances
    from payments p join special_orders so on so.id = p.special_order_id
   where so.status not in ('delivered', 'cancelled');
  select count(*) into v_active_so from special_orders where status not in ('delivered', 'cancelled');
  select coalesce(sum(revenue - cost), 0) into v_all_margin from sale_lines;
  select coalesce(sum(amount), 0) into v_all_opex from expenses where kind = 'operating';

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
    'net_profit',         v_revenue - v_cost - v_opex,
    'units',              v_lines,
    'tickets',            v_tickets,
    'shipping_collected', v_shipping,
    'shipping_paid',      v_ship_paid,
    -- A hoy
    'receivables',        v_receivable,
    'distributed',        v_distributed,
    'all_time_net',       v_all_margin - v_all_opex,
    'available',          v_all_margin - v_all_opex - v_receivable - v_distributed,
    'stock_cost',         v_stock_cost,
    'special_order_advances', v_advances,
    'special_orders_active',  v_active_so
  );
end;
$$;

