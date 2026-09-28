-- Ventas externas con cliente opcional y pago a plazos.
--
-- Hasta ahora una venta externa era solo un registro contable: nombre libre del
-- producto, costo, precio y nota. No se podía vincular a un cliente ni cobrarla
-- en abonos, así que una venta de algo que no está en el catálogo quedaba fuera
-- de "Cobros pendientes" y el cliente no la veía en sus pedidos.
--
-- Todos los campos de cliente son opcionales: una venta externa sin cliente
-- sigue funcionando exactamente igual que antes.

-- ── 1. Datos de cliente y estado de cobro ────────────────────────────────
alter table public.external_sales
  add column if not exists customer_id  uuid references public.profiles(id) on delete set null,
  add column if not exists guest_name   text,
  add column if not exists guest_phone  text,
  add column if not exists status       text not null default 'completed';

alter table public.external_sales
  drop constraint if exists external_sales_status_check;
alter table public.external_sales
  add constraint external_sales_status_check check (status in ('completed', 'pending'));

create index if not exists external_sales_customer_id_idx
  on public.external_sales (customer_id) where customer_id is not null;

-- Las deudas se agrupan por teléfono, igual que en sales/orders.
create index if not exists external_sales_guest_phone_idx
  on public.external_sales (guest_phone) where guest_phone is not null;

-- ── 2. Los abonos de una venta externa viven en `payments` ───────────────
-- Es la misma tabla que alimenta el log de Movimientos y el saldo que ve el
-- cliente; separarlos habría duplicado esa lógica.
alter table public.payments
  add column if not exists external_sale_id uuid references public.external_sales(id) on delete cascade;

create index if not exists payments_external_sale_id_idx
  on public.payments (external_sale_id) where external_sale_id is not null;

do $$
declare
  con record;
  found_any boolean := false;
begin
  -- `payments.sale_id` no puede seguir siendo obligatorio si ahora un abono
  -- puede colgar de una venta externa.
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'payments'
      and column_name = 'sale_id' and is_nullable = 'NO'
  ) then
    raise notice 'payments.sale_id era NOT NULL: se relaja';
    alter table public.payments alter column sale_id drop not null;
  end if;

  -- Si existe un check que exige exactamente un padre (sale_id / order_id),
  -- hay que reemplazarlo por uno que contemple los tres.
  for con in
    select conname, pg_get_constraintdef(oid) as def
    from pg_constraint
    where conrelid = 'public.payments'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%sale_id%'
      and pg_get_constraintdef(oid) ilike '%order_id%'
  loop
    found_any := true;
    raise notice 'check existente en payments -> % : %', con.conname, con.def;
    execute format('alter table public.payments drop constraint %I', con.conname);
  end loop;

  if not found_any then
    raise notice 'payments no tenia check de padre unico';
  end if;
end $$;

alter table public.payments
  drop constraint if exists payments_single_parent;
alter table public.payments
  add constraint payments_single_parent
  check (num_nonnulls(sale_id, order_id, external_sale_id) = 1);

-- ── 3. RLS: el cliente ve su propia venta externa y sus abonos ───────────
-- A propósito NO se ejecuta `enable row level security`: si estuviera apagada,
-- encenderla acá dejaría al admin sin poder insertar hasta escribir el resto de
-- las políticas, y eso rompería la caja en producción. Se reporta el estado y
-- se decide aparte. Añadir políticas es aditivo y seguro en ambos casos.
do $$
declare es_rls boolean; pay_rls boolean;
begin
  select relrowsecurity into es_rls  from pg_class where oid = 'public.external_sales'::regclass;
  select relrowsecurity into pay_rls from pg_class where oid = 'public.payments'::regclass;
  raise notice 'RLS external_sales = % | RLS payments = %', es_rls, pay_rls;
  raise notice 'politicas actuales en external_sales: %',
    (select coalesce(string_agg(policyname || '/' || cmd, ', '), 'ninguna')
       from pg_policies where schemaname='public' and tablename='external_sales');
end $$;

drop policy if exists "external_sales_select_own" on public.external_sales;
create policy "external_sales_select_own"
  on public.external_sales for select
  to authenticated
  using (
    customer_id = auth.uid()
    or exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

drop policy if exists "payments_select_own_external" on public.payments;
create policy "payments_select_own_external"
  on public.payments for select
  to authenticated
  using (
    exists (
      select 1 from public.external_sales es
      where es.id = payments.external_sale_id
        and es.customer_id = auth.uid()
    )
  );
