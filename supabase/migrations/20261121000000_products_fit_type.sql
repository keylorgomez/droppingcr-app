-- Versión de las camisetas de fútbol: Player, Fan o Retro.
--
-- Es opcional (null = no se indica). El detalle del producto la usa para
-- recomendar la talla: Player es slim fit (dos tallas más), Fan y Retro son
-- más holgadas (una talla más, por comodidad).

alter table public.products
  add column if not exists fit_type text;

alter table public.products
  drop constraint if exists products_fit_type_check;
alter table public.products
  add constraint products_fit_type_check check (fit_type in ('player', 'fan', 'retro'));

-- Etiquetar los productos de fútbol que ya lo dicen en el nombre. Los que no
-- dicen nada quedan sin versión.
update public.products p
   set fit_type = case
         when p.name ~* '\mplayer\M' then 'player'
         when p.name ~* '\mretro\M'  then 'retro'
         when p.name ~* '\mfan\M'    then 'fan'
       end
 where p.fit_type is null
   and (p.name ~* '\mplayer\M' or p.name ~* '\mretro\M' or p.name ~* '\mfan\M')
   and exists (
     select 1
       from public.product_categories pc
       join public.categories c on c.id = pc.category_id
      where pc.product_id = p.id and c.slug = 'futbol'
   );
