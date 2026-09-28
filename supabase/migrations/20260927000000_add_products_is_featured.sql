-- Pieza destacada de la home: hasta ahora la elegía el frontend (la más reciente
-- marcada como "nuevo"), lo que dejaba la portada fuera del control del admin.
alter table products add column if not exists is_featured boolean not null default false;

-- Solo una pieza destacada a la vez. El índice parcial indexa la columna misma
-- y se limita a las filas en true, así que la base rechaza una segunda; imponer
-- la regla acá y no en la UI evita que se salte desde cualquier otro cliente.
create unique index if not exists products_single_featured
  on products (is_featured) where is_featured;
