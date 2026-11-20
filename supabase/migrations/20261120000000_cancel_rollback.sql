-- Cancelar una venta = deshacerla, como si nunca se hubiera hecho.
--
-- Vale para los tres tipos: venta individual, pedido de varios productos y
-- venta externa (incluye los encargos entregados, que se guardan como externa).
--
--   · La venta queda 'cancelled': sale de sale_lines, así que su ingreso Y su
--     costo dejan de contar en utilidad, Dashboard y exportación. Si después se
--     vuelve a registrar la venta, el costo no queda doble.
--   · Piezas del catálogo: el stock vuelve (igual que antes).
--   · Encargo entregado: el encargo pasa a 'cancelled' con la nota.
--   · p_refund = true: se registra la devolución de lo que el cliente pagó
--     (sale en Movimientos y baja el Balance neto). Así la plata queda como si
--     nunca hubiera entrado: el pago sigue en el historial y la devolución lo
--     compensa.
--   · p_refund = false: no se devolvió plata; los pagos quedan como estaban.
--
-- Antes las ventas externas no se podían cancelar (su estado solo aceptaba
-- 'completed' / 'pending') y una devolución no se podía ligar a ellas.

-- ── 1. Ventas externas cancelables ──────────────────────────────────────
alter table public.external_sales
  drop constraint if exists external_sales_status_check;
alter table public.external_sales
  add constraint external_sales_status_check check (status in ('completed', 'pending', 'cancelled'));
alter table public.external_sales
  add column if not exists cancelled_at timestamptz;

-- ── 2. Devoluciones ligadas a cualquier tipo de venta ───────────────────
alter table public.refunds
  add column if not exists external_sale_id uuid references public.external_sales(id) on delete set null;
create index if not exists refunds_external_sale_id_idx
  on public.refunds (external_sale_id) where external_sale_id is not null;

-- order_id se creó a mano; sin llave foránea la app no puede traer el
-- producto del pedido (Movimientos mostraba "—" en esas devoluciones).
alter table public.refunds
  add column if not exists order_id uuid;
do $$
begin
  if not exists (
    select 1 from pg_constraint
     where conrelid = 'public.refunds'::regclass and contype = 'f'
       and conkey = array[(select attnum from pg_attribute
                            where attrelid = 'public.refunds'::regclass and attname = 'order_id')]
  ) then
    alter table public.refunds
      add constraint refunds_order_id_fkey foreign key (order_id) references public.orders(id) on delete set null;
  end if;
end $$;
create index if not exists refunds_order_id_idx
  on public.refunds (order_id) where order_id is not null;

-- ── 3. Las externas canceladas no cuentan ───────────────────────────────
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
    from external_sales e
   where e.status <> 'cancelled';

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
     where e.status <> 'cancelled'
  ) x
  where (p_from is null or x.sold_at >= p_from)
    and (p_to   is null or x.sold_at <  p_to)
  order by x.sold_at;
end;
$$;

-- ── 4. Cancelar (con o sin devolución) ──────────────────────────────────
drop function if exists public.cancel_sale(text, uuid, text);

create or replace function public.cancel_sale(
  p_kind   text,               -- 'sale' | 'order' | 'external'
  p_id     uuid,
  p_note   text    default null,
  p_refund boolean default true
)
returns numeric                -- monto devuelto (0 si no se devolvió)
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
  v_refund   numeric := 0;
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

  -- Lo que el cliente pagó, antes de cambiar el estado. Una externa de contado
  -- no tiene filas en payments: se cobró completa al registrarla.
  v_paid := public.payment_parent_paid(p_kind, p_id);
  if p_kind = 'external' and v_paid = 0 and v_status = 'completed' then
    v_paid := v_price;
  end if;

  if p_kind = 'sale' then
    update sales
       set status = 'cancelled', delivery_status = 'cancelled',
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
       set status = 'cancelled', delivery_status = 'cancelled',
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
           note = case when v_note is null then note
                       else coalesce(note || ' · ', '') || 'Cancelada: ' || v_note end
     where id = p_id;
    -- Si venía de un encargo, el encargo también queda cancelado.
    update special_orders
       set status = 'cancelled', cancelled_at = now(),
           note = coalesce(note || ' · ', '') || 'Cancelado después de entregar'
                  || coalesce(': ' || v_note, '')
     where external_sale_id = p_id and status <> 'cancelled';
  end if;

  if p_refund then
    select coalesce(sum(amount), 0) into v_refunded from refunds
     where (p_kind = 'sale'     and sale_id          = p_id)
        or (p_kind = 'order'    and order_id         = p_id)
        or (p_kind = 'external' and external_sale_id = p_id);
    v_refund := greatest(v_paid - v_refunded, 0);

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
  end if;

  return v_refund;
end;
$$;

revoke execute on function public.cancel_sale(text, uuid, text, boolean) from public, anon;
grant  execute on function public.cancel_sale(text, uuid, text, boolean) to authenticated;
