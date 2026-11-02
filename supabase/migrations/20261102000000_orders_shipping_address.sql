-- Dirección de envío en pedidos de varios productos.
--
-- `sales` ya guarda provincia, cantón y distrito, pero `orders` no, así que un
-- pedido registrado desde "Nuevo pedido" no podía validar la cobertura del
-- mensajero ni imprimir la dirección en la etiqueta. Ahora ambos puntos de
-- registro usan el mismo selector de dirección y guardan las mismas columnas.
--
-- Las tres columnas son opcionales: los pedidos existentes y las entregas
-- personales quedan en null.

alter table public.orders
  add column if not exists province text,
  add column if not exists canton   text,
  add column if not exists district text;
