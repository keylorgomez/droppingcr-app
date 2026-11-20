-- Una venta cancelada queda cerrada.
--
-- cancel_sale ya devolvió el stock y registró la devolución contra los pagos.
-- Si después se pudiera:
--   · reactivar (cambiar el estado de entrega), volvería a verse como venta
--     sin descontar stock de nuevo;
--   · borrar uno de sus pagos, Movimientos quedaría con una devolución mayor
--     a lo que entró.
-- La app ya no lo ofrece; esto lo impide también en la base.

create or replace function public.guard_cancelled_sale()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if old.status <> 'cancelled' then
    return new;
  end if;
  -- external_sales no tiene delivery_status: leer ese campo ahí fallaría.
  if new.status is distinct from 'cancelled'
     or (tg_table_name <> 'external_sales'
         and to_jsonb(new)->>'delivery_status' is distinct from 'cancelled') then
    raise exception 'Esta venta está cancelada y no se puede reactivar. Registrala como venta nueva.';
  end if;
  return new;
end;
$$;

drop trigger if exists sales_guard_cancelled on public.sales;
create trigger sales_guard_cancelled
  before update of status, delivery_status on public.sales
  for each row execute function public.guard_cancelled_sale();

drop trigger if exists orders_guard_cancelled on public.orders;
create trigger orders_guard_cancelled
  before update of status, delivery_status on public.orders
  for each row execute function public.guard_cancelled_sale();

drop trigger if exists external_sales_guard_cancelled on public.external_sales;
create trigger external_sales_guard_cancelled
  before update of status on public.external_sales
  for each row execute function public.guard_cancelled_sale();

create or replace function public.guard_cancelled_payment_delete()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if (old.sale_id          is not null and exists (select 1 from sales          where id = old.sale_id          and status = 'cancelled'))
  or (old.order_id         is not null and exists (select 1 from orders         where id = old.order_id         and status = 'cancelled'))
  or (old.external_sale_id is not null and exists (select 1 from external_sales where id = old.external_sale_id and status = 'cancelled'))
  or (old.special_order_id is not null and exists (select 1 from special_orders where id = old.special_order_id and status = 'cancelled')) then
    raise exception 'No se puede borrar un pago de una venta cancelada: su devolución ya se registró.';
  end if;
  return old;
end;
$$;

drop trigger if exists payments_guard_cancelled_delete on public.payments;
create trigger payments_guard_cancelled_delete
  before delete on public.payments
  for each row execute function public.guard_cancelled_payment_delete();

revoke execute on function public.guard_cancelled_sale()           from public, anon, authenticated;
revoke execute on function public.guard_cancelled_payment_delete() from public, anon, authenticated;
