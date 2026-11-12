-- Ajuste de conciliación (única vez, 12/11/2026).
--
-- Al pasar los números del Excel a la app quedó un desfase: el banco tenía
-- ₡423,183.16 y el Balance neto de Movimientos ₡356,546.97. Se revisó que no
-- hubiera ventas pagadas sin sus abonos (0) y la diferencia se atribuye a
-- errores del registro anterior. Por decisión del dueño, esos ₡66,636.19 se
-- aplican UNA vez contra lo repartido: baja el excedido del 60 % y el Balance
-- neto queda igual al banco.
--
-- No hay pantalla para crear más ajustes a propósito: desde ahora todo se
-- registra en la app y este desfase no debería repetirse. Si hiciera falta
-- otro, va en una migración con su explicación, como esta.

create table if not exists public.finance_adjustments (
  id         uuid primary key default gen_random_uuid(),
  amount     numeric(12, 2) not null check (amount <> 0),
  reason     text not null,
  created_at timestamptz not null default now()
);

alter table public.finance_adjustments enable row level security;

drop policy if exists finance_adjustments_admin_select on public.finance_adjustments;
create policy finance_adjustments_admin_select on public.finance_adjustments
  for select to authenticated using (public.is_admin_user((select auth.uid())));

insert into public.finance_adjustments (amount, reason)
select 66636.19, 'Conciliación con el banco al cerrar el Excel (12/11/2026)'
 where not exists (select 1 from public.finance_adjustments);

-- ── Resumen financiero: lo repartido descuenta los ajustes ───────────────
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
    'adjustments',        v_adjustment,
    'all_time_net',       v_all_margin - v_all_opex,
    'available',          v_all_margin - v_all_opex - v_receivable - v_distributed,
    'stock_cost',         v_stock_cost,
    'special_order_advances', v_advances,
    'special_orders_active',  v_active_so
  );
end;
$$;
