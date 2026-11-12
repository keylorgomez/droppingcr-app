-- Registrar ventas y pedidos en UNA transacción.
--
-- Antes la app hacía 4 llamadas sueltas desde el navegador (insertar la venta,
-- bajar stock, marcar apartado, registrar el pago). Si se caía la señal a la
-- mitad quedaba una venta sin descontar stock o un stock descontado sin venta,
-- y dos admins podían vender la última unidad a la vez. Ahora es todo o nada.
--
-- SECURITY INVOKER: corren con los permisos (y el RLS) de quien llama. El
-- chequeo de admin explícito da un error claro en vez de un "0 filas".

-- ── Venta de un solo producto ────────────────────────────────────────────
-- `sale_price` es el TOTAL de la línea (precio × cantidad), así que el costo
-- también se guarda como total: antes se guardaba el de UNA unidad y con
-- cantidad > 1 la ganancia salía inflada.
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
begin
  if not public.is_admin_user(auth.uid()) then
    raise exception 'No autorizado' using errcode = '42501';
  end if;
  if v_qty < 1 then
    raise exception 'Cantidad inválida';
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
    province, canton, district, address_detail
  ) values (
    v_product, v_variant, v_qty, (p->>'sale_price')::numeric, coalesce(v_cost, 0) * v_qty,
    nullif(p->>'guest_name', ''), nullif(p->>'guest_phone', ''), p->>'status', nullif(p->>'note', ''),
    p->>'shipping_method', coalesce((p->>'shipping_cost')::numeric, 0), p->>'delivery_status', nullif(p->>'tracking_number', ''),
    nullif(p->>'province', ''), nullif(p->>'canton', ''), nullif(p->>'district', ''), nullif(p->>'address_detail', '')
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
begin
  if not public.is_admin_user(auth.uid()) then
    raise exception 'No autorizado' using errcode = '42501';
  end if;
  if jsonb_array_length(coalesce(p->'items', '[]'::jsonb)) = 0 then
    raise exception 'El pedido no tiene productos';
  end if;

  insert into orders (
    guest_name, guest_phone, shipping_method, shipping_cost, delivery_status,
    tracking_number, status, note, province, canton, district, address_detail, created_by
  ) values (
    nullif(p->>'guest_name', ''), nullif(p->>'guest_phone', ''), p->>'shipping_method',
    coalesce((p->>'shipping_cost')::numeric, 0), p->>'delivery_status',
    nullif(p->>'tracking_number', ''), p->>'status', nullif(p->>'note', ''),
    nullif(p->>'province', ''), nullif(p->>'canton', ''), nullif(p->>'district', ''), nullif(p->>'address_detail', ''),
    auth.uid()
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

-- ── Gastos: inventario vs. operativo ─────────────────────────────────────
-- La compra de mercadería ya está en el costo de cada venta: restarla otra vez
-- de la ganancia la contaría dos veces. Solo los gastos operativos bajan la
-- utilidad neta. "Suministros" es compra de mercadería; "Envío" mezcla
-- importación (va al costo) y envíos operativos, así que se clasifica uno por
-- uno. Por defecto queda como operativo: es la opción conservadora, nunca
-- muestra más dinero disponible del que hay.
alter table public.expenses
  add column if not exists kind text not null default 'operating';

alter table public.expenses drop constraint if exists expenses_kind_check;
alter table public.expenses
  add constraint expenses_kind_check check (kind in ('inventory', 'operating'));

update public.expenses set kind = 'inventory' where category = 'Suministros';
