-- Looks up a customer's name by phone for the admin sale/order forms, so typing
-- the WhatsApp number can auto-fill the name. Matches on the last 8 digits to
-- tolerate the inconsistent stored formats (+50688887777 vs 88887777).
--
-- SECURITY DEFINER + an explicit admin check: the function bypasses RLS to read
-- across profiles/sales/orders, but returns null for anyone who isn't an admin,
-- preventing customer enumeration by regular users.
create or replace function public.lookup_customer_by_phone(phone_input text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  digits text := right(regexp_replace(coalesce(phone_input, ''), '\D', '', 'g'), 8);
  result text;
begin
  if not exists (select 1 from profiles where id = auth.uid() and role = 'admin') then
    return null;
  end if;

  if length(digits) < 8 then
    return null;
  end if;

  -- 1. Registered profile takes priority (most authoritative name).
  select nullif(trim(coalesce(first_name, '') || ' ' || coalesce(last_name, '')), '')
    into result
  from profiles
  where right(regexp_replace(coalesce(whatsapp, ''), '\D', '', 'g'), 8) = digits
    and nullif(trim(coalesce(first_name, '') || coalesce(last_name, '')), '') is not null
  limit 1;

  if result is not null then
    return result;
  end if;

  -- 2. Otherwise, the most recent name from sales/orders history for that number.
  select guest_name into result
  from (
    select guest_name, sold_at from sales
      where right(regexp_replace(coalesce(guest_phone, ''), '\D', '', 'g'), 8) = digits
        and nullif(trim(guest_name), '') is not null
    union all
    select guest_name, sold_at from orders
      where right(regexp_replace(coalesce(guest_phone, ''), '\D', '', 'g'), 8) = digits
        and nullif(trim(guest_name), '') is not null
  ) h
  order by sold_at desc
  limit 1;

  return result;
end;
$$;

grant execute on function public.lookup_customer_by_phone(text) to authenticated;
