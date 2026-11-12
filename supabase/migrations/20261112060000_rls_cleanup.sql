-- Limpieza de políticas RLS (mismo acceso, menos trabajo por fila).
--
-- Se crearon a mano en el dashboard a lo largo del tiempo y quedaron:
--   · duplicadas: sales tenía dos "admin full access", payments seis de lectura;
--     Postgres evalúa TODAS las permisivas de una acción en cada fila.
--   · con auth.uid() suelto: se re-evalúa por fila. (select auth.uid()) se
--     evalúa una vez por consulta (lo que el linter llama "initplan").
--   · con el chequeo de admin copiado como EXISTS(... profiles ...) en vez de
--     is_admin_user(), que además es SECURITY DEFINER y no choca con el RLS de
--     profiles.
--
-- Regla: una política por acción. Lectura = (es mío) OR (soy admin); las
-- escrituras quedan solo para admin, separadas, para no duplicar la lectura.
-- El acceso resultante es EXACTAMENTE el mismo que había (revisado contra
-- pg_policies el 12/11/2026).
--
-- Todo va en UN solo bloque DO: si cualquier create falla, se revierte también
-- el drop y ninguna tabla queda sin políticas (sin RLS abierto ni tienda caída).

do $$
declare
  r     record;
  t     text;
  admin constant text := 'public.is_admin_user((select auth.uid()))';
begin
  -- ── 1. Borrar todas las políticas de estas tablas ──────────────────────
  for r in
    select tablename, policyname from pg_policies
     where schemaname = 'public'
       and tablename in (
         'admin_payouts', 'cart_items', 'categories', 'expense_payments', 'expenses',
         'external_sales', 'order_items', 'orders', 'payments', 'product_categories',
         'product_images', 'product_variants', 'products', 'profiles', 'refunds', 'sales'
       )
  loop
    execute format('drop policy %I on public.%I', r.policyname, r.tablename);
  end loop;

  -- ── 2. Catálogo: lectura pública, escritura admin ──────────────────────
  foreach t in array array['categories', 'product_categories', 'product_images', 'product_variants', 'products'] loop
    execute format('create policy %I on public.%I for select to anon, authenticated using (true)', t || '_read', t);
    execute format('create policy %I on public.%I for insert to authenticated with check (%s)', t || '_admin_insert', t, admin);
    execute format('create policy %I on public.%I for update to authenticated using (%s) with check (%s)', t || '_admin_update', t, admin, admin);
    execute format('create policy %I on public.%I for delete to authenticated using (%s)', t || '_admin_delete', t, admin);
  end loop;

  -- ── 3. Solo admin ──────────────────────────────────────────────────────
  foreach t in array array['expenses', 'expense_payments', 'refunds'] loop
    execute format('create policy %I on public.%I for all to authenticated using (%s) with check (%s)', t || '_admin_all', t, admin, admin);
  end loop;

  -- Repartos: admin lee y registra. No había update/delete y se mantiene así.
  execute format('create policy admin_payouts_admin_select on public.admin_payouts for select to authenticated using (%s)', admin);
  execute format('create policy admin_payouts_admin_insert on public.admin_payouts for insert to authenticated with check (%s)', admin);

  -- ── 4. Carrito: cada uno el suyo ───────────────────────────────────────
  execute 'create policy cart_items_own on public.cart_items for all to authenticated
             using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id)';

  -- ── 5. Perfiles (el cambio de rol lo bloquea el trigger profiles_guard_role)
  execute format('create policy profiles_select on public.profiles for select to authenticated
                    using (id = (select auth.uid()) or %s)', admin);
  execute 'create policy profiles_update_own on public.profiles for update to authenticated
             using (id = (select auth.uid())) with check (id = (select auth.uid()))';

  -- ── 6. Ventas, pedidos y externas: el cliente lee lo suyo ──────────────
  foreach t in array array['sales', 'orders', 'external_sales'] loop
    execute format('create policy %I on public.%I for select to authenticated using (customer_id = (select auth.uid()) or %s)', t || '_select', t, admin);
  end loop;

  -- ── 7. Líneas de pedido: las de mis pedidos ────────────────────────────
  execute format('create policy order_items_select on public.order_items for select to authenticated using (
                    %s or exists (select 1 from public.orders o
                                   where o.id = order_items.order_id and o.customer_id = (select auth.uid())))', admin);

  -- ── 8. Pagos: los de mis ventas, pedidos y externas ────────────────────
  -- Los de encargos el cliente los ve por my_special_orders(), sin el costo.
  execute format('create policy payments_select on public.payments for select to authenticated using (
                    %s
                    or exists (select 1 from public.sales s          where s.id = payments.sale_id          and s.customer_id = (select auth.uid()))
                    or exists (select 1 from public.orders o         where o.id = payments.order_id         and o.customer_id = (select auth.uid()))
                    or exists (select 1 from public.external_sales e where e.id = payments.external_sale_id and e.customer_id = (select auth.uid())))', admin);

  -- Escritura solo admin en ventas, pedidos, externas, líneas y pagos.
  foreach t in array array['sales', 'orders', 'external_sales', 'order_items', 'payments'] loop
    execute format('create policy %I on public.%I for insert to authenticated with check (%s)', t || '_admin_insert', t, admin);
    execute format('create policy %I on public.%I for update to authenticated using (%s) with check (%s)', t || '_admin_update', t, admin, admin);
    execute format('create policy %I on public.%I for delete to authenticated using (%s)', t || '_admin_delete', t, admin);
  end loop;
end $$;
