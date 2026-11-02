-- Dirección exacta (señas) para envíos por mensajero.
--
-- Provincia, cantón y distrito alcanzan para Correos CR, pero el mensajero
-- necesita llegar a la puerta: "100 m norte del parque, casa azul". Se guarda
-- en la venta o el pedido para que la etiqueta generada después la incluya,
-- igual que ya lo hacía la etiqueta manual.
--
-- Opcional: null en registros existentes, entregas personales y Correos.

alter table public.sales
  add column if not exists address_detail text;

alter table public.orders
  add column if not exists address_detail text;
