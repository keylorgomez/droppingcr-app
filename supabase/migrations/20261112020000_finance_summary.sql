-- Una sola fuente de verdad para el dinero.
--
-- La misma fórmula vivía en 4 servicios del frontend, cada uno con diferencias
-- (unos excluían canceladas y otros no, el envío era ingreso en pedidos pero no
-- en ventas). Además bajaban tablas enteras al navegador, y PostgREST corta en
-- 1000 filas: al crecer, los totales se iban a quedar cortos sin avisar.

-- ── Líneas de venta unificadas ───────────────────────────────────────────
-- Una fila por producto vendido, sin canceladas. `revenue` y `cost` son los
-- totales de la línea, SIN envío: el envío cobrado es dinero de paso hacia el
-- courier, no ganancia.
create or replace view public.sale_lines
with (security_invoker = true) as
  select 'sale'::text         as source,
         s.id                 as source_id,
         s.sold_at,
         s.variant_id,
         coalesce(s.quantity, 1) as quantity,
         s.sale_price::numeric   as revenue,
         s.cost_price::numeric   as cost
    from sales s
   where coalesce(s.status, 'completed') <> 'cancelled'
  union all
  select 'order', o.id, o.sold_at, i.variant_id, i.quantity,
         (i.sale_price * i.quantity)::numeric,
         (coalesce(i.cost_price, 0) * i.quantity)::numeric
    from order_items i
    join orders o on o.id = i.order_id
   where o.status <> 'cancelled'
  union all
  select 'external', e.id, e.sold_at, null, 1,
         e.sale_price::numeric, e.cost_price::numeric
    from external_sales e;

-- ── Resumen financiero ───────────────────────────────────────────────────
-- Utilidad neta    = margen bruto − gastos operativos
-- Disponible       = utilidad neta − lo que falta cobrar − lo ya repartido
--
-- Lo que falta cobrar se resta completo: el costo de esa mercadería ya se
-- pagó al comprarla, así que hasta que el cliente pague no hay ganancia en
-- caja. Las devoluciones no se restan: solo salen de ventas canceladas, que ya
-- no están en el margen.
--
-- Los gastos de tipo 'inventory' (compra de mercadería) no bajan la utilidad:
-- ese dinero ya está en el costo de cada venta.
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
         coalesce(sum(amount) filter (where kind = 'inventory'), 0)
    into v_opex, v_inventory
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
    -- A hoy
    'receivables',        v_receivable,
    'distributed',        v_distributed,
    'all_time_net',       v_all_margin - v_all_opex,
    'available',          v_all_margin - v_all_opex - v_receivable - v_distributed,
    'stock_cost',         v_stock_cost
  );
end;
$$;

-- ── Top productos ────────────────────────────────────────────────────────
create or replace function public.top_products(
  p_limit integer default 5,
  p_from  timestamptz default null,
  p_to    timestamptz default null
)
returns table (name text, revenue numeric, units bigint, margin numeric)
language sql
stable
set search_path = public
as $$
  select coalesce(pr.name, 'Venta externa') as name,
         sum(l.revenue)            as revenue,
         sum(l.quantity)::bigint   as units,
         sum(l.revenue - l.cost)   as margin
    from sale_lines l
    left join product_variants v on v.id = l.variant_id
    left join products pr        on pr.id = v.product_id
   where l.variant_id is not null
     and public.is_admin_user(auth.uid())
     and (p_from is null or l.sold_at >= p_from)
     and (p_to   is null or l.sold_at <  p_to)
   group by 1
   order by 2 desc
   limit p_limit;
$$;

-- ── Serie diaria (ventas vs. costo) ──────────────────────────────────────
create or replace function public.daily_sales(p_from timestamptz, p_to timestamptz)
returns table (day date, revenue numeric, cost numeric)
language sql
stable
set search_path = public
as $$
  select (l.sold_at at time zone 'America/Costa_Rica')::date as day,
         sum(l.revenue), sum(l.cost)
    from sale_lines l
   where public.is_admin_user(auth.uid())
     and l.sold_at >= p_from and l.sold_at < p_to
   group by 1
   order by 1;
$$;

revoke all on public.sale_lines from anon;
revoke execute on function public.finance_summary(timestamptz, timestamptz)       from public, anon;
revoke execute on function public.top_products(integer, timestamptz, timestamptz) from public, anon;
revoke execute on function public.daily_sales(timestamptz, timestamptz)            from public, anon;
grant  execute on function public.finance_summary(timestamptz, timestamptz)       to authenticated;
grant  execute on function public.top_products(integer, timestamptz, timestamptz) to authenticated;
grant  execute on function public.daily_sales(timestamptz, timestamptz)            to authenticated;
