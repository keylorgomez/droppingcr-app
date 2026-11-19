-- Stock y concurrencia (19/11/2026).
--
-- Quién gana la última unidad lo decide la base, no el navegador: el UPDATE
-- condicional de decrement_variant_stock (stock >= cantidad) toma un bloqueo
-- de fila, así que de dos ventas simultáneas de la última pieza una pasa y la
-- otra recibe "sin stock". El tiempo real (websocket) es solo para que las
-- pantallas se enteren rápido; nunca reemplaza este chequeo.
--
-- Esta migración agrega:
--   1. CHECK stock >= 0: ninguna ruta (ni una edición a mano) deja stock negativo.
--   2. Mensaje de "sin stock" con el producto y la talla.
--   3. request_id en ventas y pedidos: un doble toque o un reintento de red
--      devuelve la venta ya creada en vez de registrar dos.
--   4. product_variants en Realtime: la app escucha cambios de stock en vivo.
--   5. Ventas y pedidos validan el pago contra el total: nada de "pagada" con
--      un pago menor ni de abonos mayores a lo que se debe.

-- ── 1. Stock nunca negativo ─────────────────────────────────────────────
-- NOT VALID: aplica a toda escritura nueva sin revisar las filas viejas.
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'product_variants_stock_nonneg') then
    alter table public.product_variants
      add constraint product_variants_stock_nonneg check (stock >= 0) not valid;
  end if;
end $$;

-- ── 2. Mensaje claro cuando la talla ya se vendió ───────────────────────
create or replace function public.decrement_variant_stock(p_variant_id uuid, p_amount integer)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name  text;
  v_size  text;
  v_stock integer;
begin
  if not public.is_admin_user(auth.uid()) then
    raise exception 'No autorizado' using errcode = '42501';
  end if;
  if p_amount is null or p_amount < 1 then
    raise exception 'Cantidad inválida';
  end if;

  update product_variants
     set stock = stock - p_amount
   where id = p_variant_id
     and stock >= p_amount;

  if not found then
    select p.name, v.size, v.stock into v_name, v_size, v_stock
      from product_variants v join products p on p.id = v.product_id
     where v.id = p_variant_id;
    raise exception 'Sin stock: % talla % (quedan %). Se acaba de vender o apartar.',
      coalesce(v_name, 'producto'), coalesce(v_size, '?'), coalesce(v_stock, 0)
      using errcode = 'P0001';
  end if;
end;
$$;

-- ── 3. Ventas y pedidos idempotentes ────────────────────────────────────
alter table public.sales  add column if not exists request_id uuid;
alter table public.orders add column if not exists request_id uuid;
create unique index if not exists sales_request_id_key  on public.sales  (request_id) where request_id is not null;
create unique index if not exists orders_request_id_key on public.orders (request_id) where request_id is not null;

create or replace function public.record_sale(p jsonb)
returns uuid
language plpgsql
set search_path = public
as $$
declare
  v_qty      integer := coalesce((p->>'quantity')::integer, 1);
  v_variant  uuid    := (p->>'variant_id')::uuid;
  v_product  uuid    := (p->>'product_id')::uuid;
  v_cost     numeric;
  v_sale_id  uuid;
  v_payment  numeric := coalesce((p->>'initial_payment')::numeric, 0);
  v_request  uuid    := nullif(p->>'request_id', '')::uuid;
  v_owed     numeric;
begin
  if not public.is_admin_user(auth.uid()) then
    raise exception 'No autorizado' using errcode = '42501';
  end if;

  -- Doble toque / reintento de red: la misma solicitud devuelve la venta ya creada.
  if v_request is not null then
    select id into v_sale_id from sales where request_id = v_request;
    if found then
      return v_sale_id;
    end if;
  end if;

  if v_qty < 1 then
    raise exception 'Cantidad inválida';
  end if;
  if coalesce((p->>'sale_price')::numeric, 0) <= 0 then
    raise exception 'Precio inválido';
  end if;
  -- Pago contra total (precio de la línea + envío), con ₡1 de tolerancia.
  v_owed := (p->>'sale_price')::numeric + coalesce((p->>'shipping_cost')::numeric, 0);
  if v_payment > v_owed + 1 then
    raise exception 'El pago (₡%) supera el total (₡%)', round(v_payment), round(v_owed);
  end if;
  if p->>'status' = 'completed' and v_payment < v_owed - 1 then
    raise exception 'Una venta pagada necesita el pago completo (₡%)', round(v_owed);
  end if;

  select price_purchase into v_cost from products where id = v_product;
  if not found then
    raise exception 'Producto no encontrado';
  end if;

  -- Primero el stock: si no alcanza, no se crea nada.
  perform public.decrement_variant_stock(v_variant, v_qty);

  insert into sales (
    product_id, variant_id, quantity, sale_price, cost_price,
    guest_name, guest_phone, status, note,
    shipping_method, shipping_cost, delivery_status, tracking_number,
    province, canton, district, address_detail, request_id
  ) values (
    v_product, v_variant, v_qty, (p->>'sale_price')::numeric, coalesce(v_cost, 0) * v_qty,
    nullif(p->>'guest_name', ''), nullif(p->>'guest_phone', ''), p->>'status', nullif(p->>'note', ''),
    p->>'shipping_method', coalesce((p->>'shipping_cost')::numeric, 0), p->>'delivery_status', nullif(p->>'tracking_number', ''),
    nullif(p->>'province', ''), nullif(p->>'canton', ''), nullif(p->>'district', ''), nullif(p->>'address_detail', ''),
    v_request
  )
  returning id into v_sale_id;

  if p->>'delivery_status' = 'apartada' then
    update product_variants set is_reserved = true where id = v_variant;
  end if;

  if v_payment > 0 then
    insert into payments (sale_id, amount, note)
    values (v_sale_id, v_payment, case when p->>'status' = 'pending' then 'Abono inicial' else 'Pago completo' end);
  end if;

  return v_sale_id;
end;
$$;

-- ── Pedido de varios productos ───────────────────────────────────────────
-- En order_items `sale_price` es UNITARIO (se multiplica por quantity), igual
-- que el costo.
create or replace function public.record_order(p jsonb)
returns uuid
language plpgsql
set search_path = public
as $$
declare
  v_order_id uuid;
  v_item     jsonb;
  v_qty      integer;
  v_cost     numeric;
  v_payment  numeric := coalesce((p->>'initial_payment')::numeric, 0);
  v_request  uuid    := nullif(p->>'request_id', '')::uuid;
  v_owed     numeric;
begin
  if not public.is_admin_user(auth.uid()) then
    raise exception 'No autorizado' using errcode = '42501';
  end if;

  if v_request is not null then
    select id into v_order_id from orders where request_id = v_request;
    if found then
      return v_order_id;
    end if;
  end if;

  if jsonb_array_length(coalesce(p->'items', '[]'::jsonb)) = 0 then
    raise exception 'El pedido no tiene productos';
  end if;
  -- En order_items el precio es UNITARIO: total = Σ precio × cantidad + envío.
  select coalesce(sum((i->>'sale_price')::numeric * coalesce((i->>'quantity')::integer, 1)), 0)
    into v_owed from jsonb_array_elements(p->'items') i;
  v_owed := v_owed + coalesce((p->>'shipping_cost')::numeric, 0);
  if v_payment > v_owed + 1 then
    raise exception 'El pago (₡%) supera el total (₡%)', round(v_payment), round(v_owed);
  end if;
  if p->>'status' = 'completed' and v_payment < v_owed - 1 then
    raise exception 'Un pedido pagado necesita el pago completo (₡%)', round(v_owed);
  end if;

  insert into orders (
    guest_name, guest_phone, shipping_method, shipping_cost, delivery_status,
    tracking_number, status, note, province, canton, district, address_detail, created_by, request_id
  ) values (
    nullif(p->>'guest_name', ''), nullif(p->>'guest_phone', ''), p->>'shipping_method',
    coalesce((p->>'shipping_cost')::numeric, 0), p->>'delivery_status',
    nullif(p->>'tracking_number', ''), p->>'status', nullif(p->>'note', ''),
    nullif(p->>'province', ''), nullif(p->>'canton', ''), nullif(p->>'district', ''), nullif(p->>'address_detail', ''),
    auth.uid(), v_request
  )
  returning id into v_order_id;

  for v_item in select * from jsonb_array_elements(p->'items') loop
    v_qty := coalesce((v_item->>'quantity')::integer, 1);

    select price_purchase into v_cost from products where id = (v_item->>'product_id')::uuid;
    if not found then
      raise exception 'Producto no encontrado';
    end if;

    perform public.decrement_variant_stock((v_item->>'variant_id')::uuid, v_qty);

    insert into order_items (order_id, product_id, variant_id, quantity, sale_price, cost_price)
    values (
      v_order_id, (v_item->>'product_id')::uuid, (v_item->>'variant_id')::uuid,
      v_qty, (v_item->>'sale_price')::numeric, coalesce(v_cost, 0)
    );

    if p->>'delivery_status' = 'apartada' then
      update product_variants set is_reserved = true where id = (v_item->>'variant_id')::uuid;
    end if;
  end loop;

  if v_payment > 0 then
    insert into payments (order_id, sale_id, amount, note)
    values (v_order_id, null, v_payment, case when p->>'status' = 'pending' then 'Abono inicial' else 'Pago completo' end);
  end if;

  return v_order_id;
end;
$$;

revoke execute on function public.record_sale(jsonb)  from public, anon;
revoke execute on function public.record_order(jsonb) from public, anon;
grant  execute on function public.record_sale(jsonb)  to authenticated;
grant  execute on function public.record_order(jsonb) to authenticated;

-- ── 4. Stock en vivo ─────────────────────────────────────────────────────
-- Realtime respeta el RLS: product_variants ya es de lectura pública.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
     where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'product_variants'
  ) then
    alter publication supabase_realtime add table public.product_variants;
  end if;
end $$;
