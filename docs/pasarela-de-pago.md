# Pasarela de pago: diseño de stock y concurrencia

Estado: **diseño**, no implementado. La base ya tiene lo que este flujo necesita
(ver `supabase/migrations/20261119000000_stock_concurrency.sql`).

## Regla de oro

Quién se queda con la última unidad lo decide **la base de datos**, con un
`UPDATE ... WHERE stock >= cantidad` dentro de una transacción. Ese update toma
un bloqueo de fila: si dos compras llegan al mismo milisegundo, la segunda
espera a la primera y después no encuentra stock. No hay forma de que las dos
pasen.

El websocket (Supabase Realtime) **no** evita la doble venta: solo avisa rápido
a las pantallas abiertas. Sirve para la experiencia ("esta talla se acaba de
agotar"), nunca como el control.

## Carrito: no reserva

Agregar al carrito **no** toca el stock (como hoy). La mayoría de carritos no se
compran y reservar ahí escondería piezas que siguen disponibles.

Lo que sí hace el carrito:
- Muestra el stock en vivo (Realtime) y avisa si una talla se agotó.
- Revalida el stock al entrar a pagar.

## Checkout: reserva corta (hold)

La reserva se hace **al tocar "Pagar"**, no antes:

1. `start_checkout(items, request_id)` en una transacción:
   - Para cada línea: `UPDATE product_variants SET stock = stock - qty WHERE id = ? AND stock >= qty`.
   - Si alguna falla: rollback de todo y error "Se acaba de vender: X talla Y".
   - Crea un `checkout` con estado `awaiting_payment`, `expires_at = now() + 15 min`
     y las líneas.
   - Idempotente por `request_id` (igual que `record_sale` hoy).
2. Se crea el cobro en la pasarela con el id del checkout como referencia.
3. **Webhook de la pasarela** (Edge Function con la clave secreta, no el navegador):
   - Pago aprobado → `confirm_checkout(checkout_id, payment_ref)`: crea el pedido
     (`orders` + `order_items` + `payments`) y marca el checkout `paid`.
     Idempotente por `payment_ref`: las pasarelas reenvían el mismo webhook.
   - Rechazado o cancelado → `release_checkout(checkout_id)`: devuelve el stock.
4. **Expiración**: `pg_cron` cada minuto llama `release_expired_checkouts()`,
   que devuelve el stock de los holds vencidos sin pago.

Mientras dura el hold, la pieza **no** está disponible para nadie más, tampoco
para una venta manual del admin: `record_sale` va a responder "Sin stock" porque
el stock ya se descontó. Conviene que ese mensaje diga "reservada en un pago en
curso (vence 3:42 p. m.)" consultando los checkouts activos.

### Caso límite: el pago llega después de que venció el hold

Puede pasar (la persona tardó, la pasarela demoró el webhook). `confirm_checkout`
intenta descontar de nuevo:
- Si todavía hay stock → se confirma normal.
- Si no → el pedido queda en `needs_refund` y se le avisa al admin para devolver
  el dinero o ofrecer otra talla. Nunca se vende en negativo (hay un
  `CHECK (stock >= 0)` en la base).

## Por qué no "solo websocket"

| Opción | Evita doble venta | Problema |
|---|---|---|
| Websocket que oculta la pieza | No | Dos personas que tocan "Pagar" a la vez igual pasan; se cae la conexión y queda desactualizado. |
| Descontar al agregar al carrito | Sí | Esconde stock que nadie compra; hay que limpiar carritos abandonados. |
| **Hold corto al pagar + update condicional** | **Sí** | Necesita el job de expiración (pg_cron). |

## Ventas manuales (hoy)

Ya funcionan con la misma regla:
- `record_sale` y `record_order` descuentan con el update condicional: si dos
  admins venden la última unidad a la vez, el segundo recibe
  "Sin stock: <producto> talla <talla> (quedan 0)".
- Doble toque o reintento: cada intento manda un `request_id`; la base devuelve
  la venta ya creada en vez de crear otra.
- Editar un producto ya no pisa el stock: si una talla se vendió mientras se
  editaba, se avisa y no se sobrescribe.
- Todas las pantallas de admin reciben los cambios de stock en vivo.

## Qué falta decidir antes de implementar

- Pasarela (Tilopay, ONVO, BAC Compra Click, PayPal…): define el webhook y la
  firma que hay que verificar.
- Duración del hold (15 min sugerido).
- Si los envíos se cobran en la pasarela o aparte.
- Activar `pg_cron` en Supabase (Database → Extensions).
