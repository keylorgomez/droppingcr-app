-- Envíos a clientes como dinero de paso, y clasificación de los gastos de envío.
--
-- El costo de cada prenda ya incluye traerla hasta CR (China, Miami, Colombia,
-- Kako, Amazon): esos gastos son 'inventory' y no se restan otra vez. Lo que se
-- paga a Correos o al mensajero lo cobra el cliente aparte: es 'shipping', no
-- suma ni resta a la utilidad.

alter table public.expenses drop constraint if exists expenses_kind_check;
alter table public.expenses
  add constraint expenses_kind_check check (kind in ('inventory', 'operating', 'shipping'));

-- Clasificación de los gastos de "Envío" existentes (revisada uno por uno).
update public.expenses set kind = 'inventory'
 where category = 'Envío' and description ~* '(miami|china|colombia|kako|amazon)';

update public.expenses set kind = 'shipping'
 where category = 'Envío'
   and kind = 'operating'
   and description !~* '(gasolina|diesel|publicidad)'
   and description ~* '(correo|mensajer|encomienda|^env[ií]os? [0-9])';

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
    'stock_cost',         v_stock_cost
  );
end;
$$;

