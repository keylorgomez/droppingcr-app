# CLAUDE.md — Dropping CR

Guía de arquitectura, principios y convenciones para este proyecto. Léelo antes de modificar cualquier parte del codebase.

---

## MVP — Qué es Dropping CR

**Dropping CR** es una plataforma de catálogo y gestión operacional para una tienda de ropa/streetwear en Costa Rica. No es un e-commerce autónomo: el pago ocurre fuera de la app (transferencia, SINPE, efectivo). La app sirve como vitrina pública y como sistema de backoffice completo para el negocio.

### Alcance actual del MVP

**Vista pública (clientes):**
- Landing editorial en `/`: hero a pantalla completa con fotos del inventario rotando,
  pieza destacada, selección curada, categorías y manifiesto de marca
- Catálogo filtrable por búsqueda y talla en `/catalogo`
- Detalle de producto con galería tipo lookbook, acordeón de envíos/pago y relacionados
- Carrito persistente (guest en localStorage, usuario en DB)
- Perfil de usuario e historial de pedidos

**Vista admin (backoffice):**
- Dashboard con KPIs: revenue, ganancia neta, deuda pendiente, top productos
- Gestión de productos (CRUD) con variantes por talla, stock real, imágenes Cloudinary
- Gestión de categorías
- Registro de ventas (single-item: `sales`) y órdenes (multi-item: `orders`)
- Control de pagos parciales y deudas por cliente
- Movimientos: log de todos los pagos y devoluciones
- Venta externa: registrar algo que no está en el catálogo, con cliente y pago a
  plazos opcionales
- Gastos operativos con abonos parciales
- Distribución de ganancias a admins (`payouts`)

### Lo que NO está implementado aún (roadmap)
- Pasarela de pago (Stripe/PayPal/SINPE Móvil API) — la tabla `cart_items` ya lo prepara
- Notificaciones push / WhatsApp automation
- Multi-tenant (múltiples negocios)
- Sistema de descuentos/cupones
- Reportes exportables (CSV/PDF)

---

## Stack de Trabajo

### Frontend
| Herramienta | Versión | Rol |
|-------------|---------|-----|
| React | ^19 | Framework UI |
| TypeScript | ~6 | Tipado estricto (strict mode) |
| Vite | ^8 | Build tool + dev server |
| React Router | ^7 | Enrutamiento cliente |
| TanStack Query | ^5 | Server state, caché, invalidación |
| Tailwind CSS | ^3 | Estilos utilitarios |
| Framer Motion | ^12 | Animaciones (modales, sidebars, drawers) |
| Recharts | ^3 | Gráficas en dashboard |
| Radix UI Dialog | ^1 | Componentes accesibles (modales base) |
| Lucide React | ^1 | Iconos SVG |
| Google Fonts | — | Anton (display) · Instrument Serif (acento) · Inter (UI) |
| clsx + tailwind-merge | — | Composición de clases CSS |

### Backend (Serverless)
| Servicio | Rol |
|----------|-----|
| Supabase PostgreSQL | Base de datos relacional |
| Supabase Auth | Autenticación + sesiones |
| Supabase RLS | Seguridad a nivel de fila |
| Supabase Edge Functions (Deno) | Serverless para emails |

### Servicios Externos
| Servicio | Rol |
|----------|-----|
| Cloudinary | CDN + transformación de imágenes |
| Resend | Email transaccional |
| Google Analytics 4 | Tracking eventos |

---

## Arquitectura

### Diagrama de capas

```
┌─────────────────────────────────────────┐
│         Presentation Layer              │
│  pages/ + components/                   │
│  React Components, JSX, UI logic        │
├─────────────────────────────────────────┤
│         State Layer                     │
│  context/ (Auth, Cart, Toast)           │
│  TanStack Query (server state)          │
│  useState / useReducer (local state)    │
├─────────────────────────────────────────┤
│         Business Logic Layer            │
│  services/ — puro TypeScript, sin JSX   │
│  Toda la lógica de negocio vive aquí    │
├─────────────────────────────────────────┤
│         Data Access Layer               │
│  lib/supabaseClient.ts                  │
│  Queries y mutaciones a Supabase        │
├─────────────────────────────────────────┤
│         Infrastructure                  │
│  Supabase (DB + Auth + Edge Functions)  │
│  Cloudinary / Resend / GA4              │
└─────────────────────────────────────────┘
```

### Organización de carpetas

```
frontend/src/
├── pages/              # Rutas (1 archivo = 1 página)
│   └── admin/          # Rutas protegidas por rol
├── components/
│   ├── ui/             # Componentes genéricos sin lógica de negocio
│   ├── home/           # Secciones de la landing (hero, destacado, categorías)
│   ├── catalog/        # Componentes del catálogo público
│   ├── orders/         # Componentes de pedidos y ventas
│   ├── products/       # Componentes admin de productos
│   └── payments/       # Componentes de movimientos y pagos
├── services/           # Business Logic Layer (sin JSX)
├── context/            # Estado global (Auth, Cart, Toast)
├── lib/                # Clientes externos + utilidades puras
├── constants/          # Constantes de dominio + query keys
├── locales/            # Textos i18n (actualmente solo es.ts)
└── config/             # Configuraciones de negocio (shipping, etc.)
```

### Reglas de arquitectura

1. **Los componentes no hablan con Supabase directamente.** Toda query o mutación a la BD pasa por un `*Service.ts`.
2. **Los servicios no importan nada de React.** Son funciones TypeScript puras: no `useState`, no `useEffect`, no JSX.
3. **El estado de servidor vive en React Query.** No uses `useState` para datos que vienen de la API.
4. **El estado global de la app vive en Context.** Solo para: usuario autenticado, carrito, notificaciones toast.
5. **Las query keys son la fuente de verdad.** Todas definidas en `src/constants/queryKeys.ts`. Nunca hardcodear strings de query.
6. **Las rutas públicas viven en `constants/app.ts` (`ROUTES`).** Nunca escribir `/catalogo`
   ni `/?filter=x` a mano: la home y el catálogo ya se movieron una vez.

---

## Principios SOLID Aplicados

### S — Single Responsibility Principle
Cada archivo tiene una única razón para cambiar:
- `productService.ts` → gestión de productos y sus relaciones
- `salesService.ts` → registro y consulta de ventas single-item
- `ordersService.ts` → gestión de órdenes multi-item
- `AuthContext.tsx` → estado de autenticación y usuario
- `CartContext.tsx` → estado del carrito y sincronización

Los componentes de página (`pages/`) solo orquestan: llaman servicios, manejan estado local de UI, renderizan.

### O — Open/Closed Principle
- Los **delivery statuses** y **shipping methods** están en `constants/domain.ts`. Para agregar un nuevo estado/método, se agrega la constante sin modificar la lógica existente.
- El sistema de **i18n** en `locales/es.ts` permite agregar idiomas sin tocar componentes.
- Los **feature flags** en `constants/featureFlags.ts` permiten activar/desactivar funciones sin if-else dispersos.

### L — Liskov Substitution Principle
- Los modales comparten la interfaz `{ open: boolean; onClose: () => void }`. Cualquier modal puede sustituirse por otro con la misma firma.
- Los servicios exponen funciones con firmas predecibles: `getX(): Promise<X[]>`, `createX(input: XInput): Promise<void>`.

### I — Interface Segregation Principle
- Las interfaces de los servicios están partidas por dominio. `OrdersPage` no importa nada de `expensesService.ts`.
- Los componentes reciben solo las props que usan. No se pasan objetos grandes "por si acaso".

### D — Dependency Inversion Principle
- Los servicios dependen de `supabase` (el cliente abstracto), no de implementaciones concretas de queries.
- `AuthContext` y `CartContext` exponen interfaces (`useAuth()`, `useCart()`) que los componentes usan sin conocer la implementación.
- La Edge Function de email recibe el payload y elige el proveedor (Resend) internamente — la app solo llama `sendEmail(...)`.

---

## Patrones de Diseño

### Service Layer (Repository-like)
Cada dominio tiene un `*Service.ts` que encapsula todas las operaciones CRUD:

```typescript
// Patrón consistente en todos los servicios
export async function getXxx(): Promise<XxxType[]> { ... }       // Query
export async function getXxxById(id: string): Promise<XxxType>   // Query by ID
export async function createXxx(input: XxxInput): Promise<void>  // Mutation
export async function updateXxx(id, input): Promise<void>        // Mutation
export async function deleteXxx(id: string): Promise<void>       // Mutation
```

### Observer Pattern (React Context + Supabase)
`AuthContext` escucha cambios de sesión via `supabase.auth.onAuthStateChange()` y notifica a todos los consumidores automáticamente. Igual con `CartContext` cuando el usuario cambia.

### Strategy Pattern (Carrito Guest/User)
`CartContext` elige la estrategia de persistencia según el estado de auth:
- Guest → `localStorage` (`dropping_guest_cart`)
- Usuario autenticado → tabla `cart_items` en Supabase
- Al hacer login: merge automático guest → DB

### Facade Pattern (lib/)
`lib/supabaseClient.ts`, `lib/cloudinary.ts`, `lib/emailService.ts` y `lib/analytics.ts` son facades que exponen APIs simples sobre SDKs complejos de terceros.

### Composite Pattern (Componentes UI)
Los componentes en `components/ui/` son atómicos y sin lógica de negocio. Las páginas los componen en estructuras más complejas. Ejemplo: `Dialog` + `motion.div` + `Toast` se componen para crear modales animados con feedback.

### Query Key Factory Pattern
Las query keys en `constants/queryKeys.ts` son la fuente de verdad para el caché de React Query. Nunca se hardcodean strings en los componentes:

```typescript
export const QUERY_KEYS = {
  PRODUCTS: ["products"],
  PRODUCT: (slug: string) => ["products", slug],
  ORDERS:  ["orders"],
  // ...
}
```

### Skeleton Loader Pattern
Todas las páginas que cargan datos remotos muestran skeleton loaders durante el fetch en lugar de spinners o espacios en blanco.

---

## Modelos de Datos Clave

### Entidades principales

```
products ──< product_variants   (tallas + stock)
products ──< product_images     (galería CDN)
products >──< categories        (vía product_categories)

sales ──> products, product_variants   (venta single-item)
orders ──< order_items ──> products, product_variants  (venta multi-item)

payments ──> sales | orders | external_sales   (abonos)
external_sales ──> profiles    (customer_id, opcional)
refunds  ──> sales | orders    (devoluciones)

expenses ──< expense_payments  (gastos + abonos)
admin_payouts ──> profiles     (distribución ganancias)

profiles ──> auth.users        (role: "admin" | "customer")
cart_items ──> profiles, product_variants
```

### Flujo de una venta
1. Admin registra venta (SaleModal o NewOrderModal)
2. Se llama `decrement_variant_stock()` via Supabase RPC
3. Se crea registro en `sales` o `orders` + `order_items`
4. Si hay datos de cliente registrado, se envía email de confirmación
5. Se invalida `QUERY_KEYS.SALES` / `QUERY_KEYS.ORDERS` en React Query
6. El dashboard recalcula automáticamente al recargar

---

## Roles y Autenticación

| Rol | Acceso |
|-----|--------|
| `customer` | Catálogo, carrito, perfil, mis pedidos |
| `admin` | Todo lo anterior + backoffice completo |

La protección de rutas admin se hace en `App.tsx` con `<AdminRoute>`. Supabase RLS asegura que aunque alguien manipule el cliente, no pueda leer datos que no le corresponden.

---

## Branding & Design System

### Identidad visual

Dropping CR es **monocromático**: negro tinta sobre blanco hueso, sin excepciones en la
tienda pública. La estética es streetwear editorial — display condensado, mucho aire,
foto de producto grande y sin marco. El color lo pone la ropa, nunca la interfaz.

El logo (óvalo + "DROPPING" condensado + "CR") vive en `src/components/ui/Logo.tsx` como
SVG inline. El archivo original es un cuadrado negro con el logo troquelado; el componente
lo invierte con una `<mask>` para que el trazo herede `currentColor`. **Nunca recolorear el
logo con filtros CSS** — basta con `text-bone` o `text-ink-900`.

**Reducción del logo.** El mark tiene tres niveles de detalle —el anillo del óvalo, la
palabra y el "CR"— y el "CR" ocupa solo el 13% de la altura. Por debajo de ~28px se
convierte en una mancha y ensucia la palabra. Por eso `<Logo compact />` recorta el
"CR": la palabra pasa de ocupar el 82% de la caja al 100%, o sea un 22% más grande sin
cambiar la maqueta. **El header y el sidebar usan `compact`; el hero, el splash y el
footer usan el mark completo**, donde hay altura de sobra para que el "CR" se lea. No
hace falta ponerle fondo: el contraste ya es máximo, el problema es densidad de detalle.

Variantes en `public/`:
- `logo-mark.svg` — solo el mark, transparente, `currentColor`
- `logo-tile.svg` — cuadrado negro con logo blanco (favicon, OG, share)

### Paleta de colores

Una sola escala neutra. El negro base es `#0a0a0a`, no `#000` puro: vibra menos sobre
blanco y deja `ink-950` (`#000`) libre para overlays y secciones a sangre.

| Token | Hex | Uso |
|-------|-----|-----|
| `bone` | `#faf9f7` | Fondo global del sitio, texto sobre negro |
| `ink-950` | `#000000` | Hero, footer, sidebars, secciones invertidas, overlays |
| `ink-900` | `#0a0a0a` | Texto corriente, botones primarios, bordes activos |
| `ink-800` / `ink-700` | `#1a1a1a` / `#2e2e2e` | Hover de superficies oscuras |
| `ink-600` / `ink-500` | `#4a4a4a` / `#6b6b6b` | Texto secundario |
| `ink-400` | `#909090` | Texto terciario, eyebrows, placeholders |
| `ink-300` / `ink-200` | `#b8b8b8` / `#d9d9d9` | Bordes de inputs y separadores |
| `ink-100` / `ink-50` | `#ebeae8` / `#f5f4f2` | Fondos de imagen, skeletons, hovers sutiles |
| `sale` | `#c8102e` | **Un solo color, un solo significado: precio rebajado** |

**La regla del acento.** `sale` es el único color del storefront y solo puede aparecer
donde hay una rebaja: el chip de la foto, el precio con descuento y el chip del detalle.
Funciona justamente porque es escaso — hoy ~27% del catálogo está rebajado, o sea 1 de
cada 4 tarjetas. Si algún día se rebaja medio catálogo deja de ser señal y hay que
volverlo negro: se cambia un token. **Sobre fondo oscuro el acento es relleno, nunca
texto** (`#c8102e` sobre negro da 3.4:1): ahí el chip va sólido y el precio queda en
`bone`. Contraste medido: 5.9:1 con blanco encima, 5.6:1 como texto sobre `bone`.

**Alias de compatibilidad** — `brand-primary`, `brand-dark`, `brand-bg`, `brand-accent` y
`promo-*` siguen existiendo en `tailwind.config.js` mapeados a la escala `ink`, porque ~40
pantallas los usaban antes del rebranding. En código nuevo usar siempre `ink-*` / `bone`.
La escala `gray-*` de Tailwind está prohibida: es azulada y rompe la neutralidad.

**Color semántico.** La tienda pública es 100% monocromática — un estado se comunica con
etiqueta, icono o peso tipográfico, nunca con color. El **backoffice sí conserva color
semántico** (verde ingreso, rojo deuda/gasto, ámbar pendiente, paleta de `Recharts`):
ahí el color es dato, y quitarlo haría el dashboard más lento de leer.

### Tipografía

Tres familias, cada una con un trabajo:

| Familia | Clase | Trabajo |
|---------|-------|---------|
| **Anton** | `font-display` | Display condensado en caja alta: hero, títulos de sección, numerales, eyebrows, botones. Hereda la tensión del logo. |
| **Instrument Serif** | `font-serif` | Frases-acento en cursiva. Solo para copy de marca, nunca para UI. |
| **Inter** | `font-sans` (por defecto en `body`) | Todo lo funcional: nombres de producto, precios, formularios, backoffice. |

Se cargan desde Google Fonts en `index.html` (no con `@import` en CSS: bloquea menos).
`font-poppins` quedó como alias de Inter para no romper código viejo — **no usarlo en
código nuevo**.

**Clases de composición** (definidas en `index.css`, usar estas antes que reinventar):

| Clase | Equivale a |
|-------|-----------|
| `.type-display` | `font-display uppercase leading-[1.12] tracking-display` |
| `.type-eyebrow` | `font-display uppercase text-[11px] tracking-widest2` |
| `.type-accent` | `font-serif italic tracking-tight` |
| `.btn-ink` | Botón primario: fondo `ink-900`, texto `bone`, caja alta |
| `.btn-outline` | Botón secundario: borde `ink-900`, se invierte al hover |
| `.link-underline` | Subrayado que se dibuja de izquierda a derecha al hover |
| `.tnum` | `font-variant-numeric: tabular-nums` — **obligatorio en todo precio** |
| `.grain` | Grano de película sobre foto de campaña (`::after` + blend `overlay`) |

**Los títulos display escalan con `clamp()`**, no con breakpoints:
`text-[clamp(2rem,6vw,3.75rem)]`. Anton no tiene pesos: no aplicarle `font-bold`.

**No bajar el interlineado de Anton por debajo de 1.12.** Su tinta desborda la caja
tipográfica: 0.875em en mayúsculas normales y 1.101em cuando hay tilde. Cualquier valor
menor hace que un título de dos renglones se pise, y en español las mayúsculas llevan
tilde. El mismo desborde afecta a los dígitos (0.882em), que es lo que recortaba el
número del banner de promociones.

Los `h1-h6` ya **no** son italic por defecto. La cursiva es exclusiva de `font-serif`.

### Componentes UI — Patrones visuales

**Regla de radios: las secciones a sangre van cuadradas, los objetos van redondeados.**
El hero, la pieza destacada, el marquee y el footer llegan al borde del viewport y por
eso no llevan radio — uno ahí crearía esquinas raras contra el borde de la pantalla.
Todo lo que es un objeto discreto sí lo lleva:

| Token | Radio | Se usa en |
|-------|-------|-----------|
| `rounded-chip` | 6px | Badges, chips de descuento, tallas |
| `rounded-btn` | 10px | Botones, inputs, paginación, thumbs |
| `rounded-card` | 12px | Imagen de tarjeta, tiles de categoría, dropdowns |
| `rounded-panel` | 16px | Hojas inferiores (solo `rounded-t-panel`) |
| `rounded-full` | — | Avatares, puntos, el botón flotante de filtros |

**Tarjeta de producto (`ProductCard`)**
- Sin borde, sin sombra, sin fondo — se apoya directo en `bone`
- Imagen `aspect-[4/5]` sobre `bg-ink-50`; al hover se eleva 6px con sombra, hace zoom
  `1.07`, revela la segunda foto y sube la pastilla "VER PIEZA"
- Badge de estado arriba a la **izquierda** (APARTADA > AGOTADO > NUEVO): outline o negro
  sólido. Chip de descuento arriba a la **derecha**: sólido en `sale`. Nunca compiten
- **El nombre reserva siempre dos líneas** (`line-clamp-2 min-h-[34px]`) y la fila de
  precio tiene alto fijo. Sin eso, un título de una línea sube el precio y la fila de la
  grilla queda escalonada — es el defecto que más delata una tienda improvisada
- Agotado/apartado: `grayscale` + texto en `ink-400`, y sin chip de descuento
- Entra con `whileInView` disparado **240px antes** de entrar en pantalla: animar justo en
  el borde deja bloques en blanco al hacer scroll rápido en una grilla larga

**Header**
- `sticky`, `bg-bone/85 backdrop-blur-xl`, borde inferior de 1px
- `overlay` en la home: transparente sobre el hero y sólido al pasar los 40px
- Se esconde al hacer scroll hacia abajo (>160px) y reaparece al subir
- Logo centrado en absoluto; nav Anton a la izquierda; carrito y cuenta a la derecha

**Hero de la home (`HeroDrop`)**
- `h-[100svh]`, fondo `ink-950` con `grain`
- Rota hasta `MAX_HERO_SLIDES` (6) fotos en escala de grises con ken-burns lento, una cada
  4 s — nunca banco de imágenes
- Las fotos salen de `HERO_IMAGES` (`constants/app.ts`, archivos en `public/hero/`). Si
  la lista está vacía cae a las fotos más recientes del catálogo, para que la portada
  nunca quede en negro
- Logo a `78vw`, frase-acento en Instrument Serif debajo

**Tiles de categoría (`CategoryTiles`)**
- `CATEGORY_IMAGES` (`constants/app.ts`, archivos en `public/categorias/`) mapea slug →
  foto. Lo que no esté ahí usa la imagen de uno de sus productos
- Las fotos se suben **a color**: el blanco y negro lo pone CSS con `grayscale`

**Pieza destacada (`FeaturedDrop`)**
- La elige el admin con el switch "Destacar en la home" (`products.is_featured`,
  migración `20260927000000`). El índice parcial `products_single_featured` garantiza
  que solo haya una: el servicio apaga la anterior antes de encender la nueva, porque
  si no la base rechaza el update
- Sin ninguna marcada, cae a la más reciente marcada como "Nuevo" y luego al mayor
  descuento, para que la sección nunca desaparezca

**Sidebars y drawers**
- Paneles `ink-950` con texto `bone`, tipografía display para los niveles principales
- Backdrop `ink-950/40` + `backdrop-blur-[2px]`
- Entrada `spring` (stiffness 330, damping 34) desde el borde

**Modales**
- Base `@radix-ui/react-dialog` + `motion.div`
- Backdrop `bg-ink-950/55 backdrop-blur-sm`, contenedor `bg-bone shadow-lift`, sin radio

**Venta externa (`ExternalSaleModal` en Movimientos)**
- Producto, costo y precio son obligatorios; **todo lo de cliente es opcional**
- Al completar los 8 dígitos del WhatsApp se llama a `lookup_customer_profile_by_phone`:
  si hay perfil se enlaza `customer_id` en el acto, y si no, al menos se recupera el
  nombre del historial de ventas
- Si la persona se registra después, `claim_external_sales_by_phone` le enlaza las ventas
  al entrar a "Mis pedidos", igual que ya pasa con sales y orders. La función exige que
  el WhatsApp del perfil coincida: sin eso, cualquiera podría apropiarse de deuda ajena
- "Venta a pagos" la deja en `status: pending`; entra a Cobros pendientes, admite abonos
  desde ahí y se marca saldada sola al cubrir el precio
- El estado del cliente encontrado se guarda junto al teléfono que lo produjo
  (`{ phone, customer_id }`), así una búsqueda lenta no puede aplicarse a un número que
  ya cambió

**Badge "NUEVO"**
- Se activa con el check al publicar y **expira solo a los 30 días** (`NEW_BADGE_DAYS`),
  leyendo `new_since`. No hay cron: el cálculo es en el cliente
- Los links "Nuevo" y "Descuentos" del header se esconden cuando ningún producto
  califica — un filtro sin resultados es una página vacía

**Footer**
- Deliberadamente escueto: logo chico (22px), una frase, cuatro links y las redes.
  El menú completo vive en el header y en el sidebar — repetirlo abajo solo satura

**Banner de promociones (`PromoBanner`)**
- **Solo el botón "Ver promos" navega.** La tarjeta entera fue clickeable y era una
  trampa: el objetivo real de tocarla suele ser cerrarla, y terminabas en descuentos.
  La regla general: si un contenedor lleva un botón de cerrar, el contenedor no se hace
  clickeable
- Aparece al pasar el 75% del alto de la pantalla, no por temporizador: sobre el hero
  tapaba media pantalla en móvil

**Toasts**
- Siempre `ink-950` con texto `bone`. El error se distingue por una barra izquierda de
  2px, no por color

**Cinta (`Marquee`)**
- Duplica los items una vez y anima a `-50%`: el bucle es continuo con cualquier cantidad
- Vive en el tope del documento, nunca dentro del header sticky (le robaría altura fija)

**Íconos**
- `lucide-react`, `strokeWidth={1.6}` en navegación, `{2}` en acciones
- Tamaños: 19-20 header, 16 inline, 13 micro

**Scroll entre páginas**
- `<ScrollToTop />` (montado en `App.tsx`) lleva la vista arriba en cada cambio de ruta.
  React Router no lo hace solo: sin esto, salir de la home —que es larga— dejaba al
  visitante caído en mitad del catálogo, o directo en el paginador cuando la página
  destino era más corta y el navegador recortaba el scroll
- La única excepción es `state.restoreScroll`, que manda el botón "Volver al catálogo"
  del detalle de producto: ahí la gracia es caer exactamente donde estabas
- `catalog_state` (página, filtros y scroll) **solo se consume con `restoreScroll`** y se
  borra al montar. Si no, una visita nueva hereda la página y los filtros de la anterior
- La restauración va en `useLayoutEffect` y sin `requestAnimationFrame`: corre antes del
  paint —nada de parpadeo— y no depende de que el bucle de animación esté vivo

**Animaciones**
- Curva única del sistema: `cubic-bezier(0.16, 1, 0.3, 1)` → `ease-drop` en Tailwind
- Reveals de scroll con `<Reveal>` (`viewport.once: true`) — nunca re-animar al subir
- Todo respeta `prefers-reduced-motion` vía la media query global de `index.css`

**Una animación nunca puede esconder producto.** `<Reveal>` y cualquier entrada que
arranque en `opacity: 0` valen para texto y adornos: si se congelan, lo que se pierde
es decoración. La grilla de producto y los tiles de categoría usan `animate-rise`, que
anima **solo desplazamiento**: una animación interrumpida a mitad deja la prenda
visible, apenas desplazada unos píxeles. Es la diferencia entre un detalle feo y un
catálogo en blanco.

### Tono de copy

- Corto, directo, en español costarricense (voseo: "buscá", "escribinos", "elegí")
- Inglés solo en términos de marca: "drops", "drip", "fits", "streetwear"
- Labels de UI siempre en español, centralizados en `locales/es.ts`
- Precio siempre `₡` + `toLocaleString("en-US")` con la clase `.tnum`
- Los eyebrows numeran las secciones: `01 / PIEZA DESTACADA`, `02 / SELECCIÓN`

---

## Convenciones de Código

### Naming
- Archivos: `camelCase.ts` / `PascalCase.tsx`
- Componentes: `PascalCase`
- Funciones y variables: `camelCase`
- Constantes de dominio: `UPPER_SNAKE_CASE`
- Rutas URL: `kebab-case`

### Estructura de un componente página

```typescript
// 1. Imports externos
import { useState } from "react"
import { useQuery } from "@tanstack/react-query"

// 2. Imports internos (services, context, constants)
import { getProducts } from "../services/productService"
import { QUERY_KEYS } from "../constants/queryKeys"

// 3. Tipos locales
interface LocalState { ... }

// 4. Componente
export default function PageName() {
  // estado local primero
  const [state, setState] = useState(...)

  // queries y context después
  const { data, isLoading } = useQuery({ ... })

  // handlers antes del return
  function handleAction() { ... }

  // render
  return (...)
}
```

### Manejo de errores

```typescript
// En servicios — lanzar error, no retornar null
const { data, error } = await supabase.from("...").select("...")
if (error) throw new Error(error.message)

// En componentes — capturar y mostrar toast
try {
  await mutation()
  showToast("Guardado", "success")
} catch (err) {
  showToast((err as Error).message, "error")
}
```

### Tailwind

- Paleta: `text-ink-900`, `bg-bone`, `border-ink-200`… — la escala `gray-*` está prohibida
  y los alias `brand-*` solo existen por compatibilidad
- Fuentes: `font-sans` (Inter, por defecto en body), `font-display` (Anton), `font-serif`
  (Instrument Serif). Antes de escribir clases sueltas, revisar si existe una clase de
  composición (`.type-display`, `.type-eyebrow`, `.type-accent`, `.btn-ink`, `.btn-outline`)
- Mobile-first: `sm:`, `md:`, `lg:`, `xl:`
- Estados: `hover:`, `focus:`, `disabled:`, `group-hover:`
- Nunca escribir CSS custom si Tailwind lo puede resolver

### Comentarios

Solo se escribe un comentario cuando el **por qué** no es obvio: una restricción oculta, un workaround específico, un invariante que sorprendería al lector. No comentar qué hace el código — los nombres de variables y funciones deben explicarlo.

---

## Variables de Entorno

```env
# Supabase
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=

# Cloudinary
VITE_CLOUDINARY_CLOUD_NAME=
VITE_CLOUDINARY_UPLOAD_PRESET=

# Google Analytics
VITE_GA_ID=
```

Los secrets de las Edge Functions (RESEND_API_KEY, SUPABASE_SERVICE_ROLE_KEY) se configuran en el dashboard de Supabase, nunca en el frontend.

---

## Decisiones de Arquitectura Relevantes

**¿Por qué dos tablas para ventas (`sales` + `orders`)?**
`sales` nació primero para ventas manuales de un solo ítem. `orders` se agregó para soportar el carrito multi-item del cliente. Eventualmente ambas convergerán en `orders` cuando se integre la pasarela de pago.

**¿Por qué Supabase y no un backend propio?**
El negocio está en etapa MVP. Supabase provee auth, DB, RLS, Edge Functions y storage en un solo servicio sin overhead de devops. La migración a un backend propio es posible porque los servicios (`src/services/`) están desacoplados de la implementación.

**¿Por qué React Query para server state?**
Evita duplicar lógica de loading/error/caché en cada componente. Las query keys centralizadas garantizan que invalidar un query actualiza todos los componentes que lo consumen.

**¿Por qué no Redux/Zustand?**
El estado global genuinamente global es mínimo: usuario autenticado y carrito. Context API es suficiente. Zustand o Redux agregarían complejidad sin beneficio real en este scope.

**¿Por qué el precio con descuento se calcula en `discountedPrice()` y no donde se usa?**
Estaba repetido idéntico en la tarjeta, el detalle, la pieza destacada, el carrito, el
modal de venta, los dos formularios de producto y el post de Instagram. El formulario de
pedidos del admin era el único sitio que no lo tenía —su consulta ni siquiera pedía
`discount_percentage`— así que cobraba el precio de lista en piezas rebajadas. Un único
helper en `lib/formatters.ts` es lo que impide que un consumidor nuevo vuelva a quedarse
fuera.

**El catálogo es compartible: su estado vive en la URL**
`/catalogo?filter=camisetas&q=tank&tallas=M,L`. Los tres parámetros están en la constante
`PARAM` de `CatalogPage` — **renombrarlos rompe links ya compartidos por WhatsApp**, así
que se tratan como contrato público. La escritura va con `replace: true` y 400 ms de
espera: sin eso, cada letra tecleada dejaría una entrada en el historial y el botón
"atrás" habría que pulsarlo una vez por carácter.

Al abrir un link, **la URL gana sobre `catalog_state`**: quien recibe el link tiene que
ver ese filtro y no el de su propia visita anterior. Y `catalog_state` guarda la query
completa (no solo la categoría) porque "Volver al catálogo" desde un producto debe
reponer también búsqueda y tallas.

El botón **Compartir** usa `navigator.share` cuando existe —en móvil abre el menú nativo,
que es por donde sale a WhatsApp— y cae a copiar al portapapeles en escritorio. Solo se
muestra si hay algún filtro activo: un link al catálogo entero no necesita botón.

**Correos transaccionales**
Tres tipos, todos en la Edge Function `send-email`: `welcome`, `new_order` (venta manual,
pedido del carrito y venta externa) y `payment_receipt` (al registrar un abono desde
Cobros pendientes). La función resuelve el correo **por el WhatsApp**: busca el perfil con
ese número y, si no existe, omite el envío en silencio — por eso se puede llamar siempre
que haya teléfono, sin preguntar antes si la persona tiene cuenta. Los correos de auth
(confirmación, recuperación) viven aparte, en `auth-email-hook`.

**En correo no hay webfonts.** Gmail y Outlook las ignoran, así que Anton no llega: las
plantillas usan Helvetica/Arial y aproximan el display con caja alta y `letter-spacing`.
Lo que sí se rebrandeó es el color (negro tinta sobre hueso, botones `#0a0a0a`, enlaces
negros **subrayados** porque sin color el subrayado es la única señal de que son enlaces)
y los radios (10px en botones, igual que `rounded-btn`). Los estados del recibo también
son monocromos: el saldo se entiende por la etiqueta y el peso, no por verde/rojo.

**Las Edge Functions no se despliegan con el frontend.** Van por
`npx supabase functions deploy <nombre>`; es fácil cambiar una plantilla y que nunca
llegue a producción.

**Caja vs. devengado: el backoffice usa los dos, y no se mezclan**
- **Movimientos** es un log de **caja**: cada fila es plata que entró o salió, y
  "Balance neto" = ingresos − salidas reales. Una venta a crédito no aporta nada hasta
  que se abona.
- **Dashboard** y **Ganancias** son **devengado**: el ingreso se reconoce al vender,
  aunque no se haya cobrado, y lo que falta aparece en "deuda pendiente".

Las ventas externas obligaron a explicitar esta diferencia. De contado no generan filas
en `payments`, así que en caja su ingreso solo se puede leer de la venta misma; a pagos
sí las generan, y ahí el precio de la venta **no debe sumarse** o se cuenta dos veces.
Eso es lo que hace `externalSaleCashIn()`: devuelve el precio solo si la venta no es a
plazos. El discriminante incluye `total_paid > 0` y no solo el estado, porque al quedar
saldada la venta pasa a `completed` — mirando solo el estado, volvería a contarse doble.
**En una vista de caja, nunca sumar el precio de una venta externa sin pasar por ese
helper.**

**¿Por qué los abonos de una venta externa viven en `payments` y no en su propia tabla?**
`payments` es lo que alimenta el log de Movimientos, el saldo de Cobros pendientes y lo
que el cliente ve en "Mis pedidos". Una tabla aparte habría obligado a duplicar esas tres
lecturas y a mantenerlas sincronizadas. El precio es un `check` en `payments` que exige
exactamente un padre (`sale_id`, `order_id` o `external_sale_id`).

**¿Por qué una venta externa no reusa la tabla `sales`?**
`sales` cuelga de `product_variants` para nombre, talla y stock. Una venta externa no
tiene variante —ese es justo el punto— así que habría obligado a hacer nullable media
tabla y a poner condicionales en cada consulta que hoy hace el join. `external_sales` ya
existía para la contabilidad; se le agregaron los campos de cliente y estado.

**¿Por qué el cliente de una venta externa es opcional?**
El caso que la origina es vender algo suelto sin subirlo al catálogo. Obligar a
identificar al comprador convertiría un registro de 10 segundos en un formulario. Si se
llena el WhatsApp, la venta se enlaza; si no, queda como registro contable y nada más.

**¿Por qué hay dos funciones de búsqueda por teléfono?**
`lookup_customer_by_phone` devuelve solo el nombre y la usan los formularios de venta y
pedido. Para enlazar una venta externa hace falta el id del perfil, así que se agregó
`lookup_customer_profile_by_phone`, que devuelve ambos. No se cambió la primera para no
tocar dos formularios que ya funcionan.

**¿Por qué la home dejó de ser el catálogo?**
Volcar 100+ productos en la primera pantalla no vende una marca de drops limitados: el
visitante nuevo no sabe qué mirar. La home ahora es una landing editorial y el catálogo
vive en `/catalogo`. `/` con un `?filter=` viejo redirige al catálogo para no romper links
de Instagram, WhatsApp ni marcadores.

**¿Por qué el hero usa fotos del inventario y no de banco de imágenes?**
Una foto de stock delata que la tienda es una plantilla. Las fotos reales en escala de
grises con ken-burns cuestan cero, se actualizan solas con el inventario y refuerzan que
cada pieza existe físicamente.

**¿Por qué los tokens `brand-*` siguen existiendo si ya no hay marrón?**
El rebranding tocaba ~40 pantallas. Remapear los tokens en `tailwind.config.js` rebrandeó
el backoffice completo sin editarlo archivo por archivo. Son deuda consciente: se van
retirando a medida que cada pantalla se toque por otra razón.

**¿Por qué imágenes en Cloudinary y solo URLs en DB?**
Las imágenes no pasan por Supabase Storage para no depender de quotas de almacenamiento. Cloudinary provee CDN, transformaciones automáticas (WebP/AVIF, resize, quality) y delivery optimizado sin trabajo extra.

---

## Checklist para Nuevas Funcionalidades

Antes de implementar una nueva feature:

- [ ] ¿La lógica de negocio va en un `*Service.ts`? (no en el componente)
- [ ] ¿Las query keys nuevas se agregaron a `constants/queryKeys.ts`?
- [ ] ¿Los textos nuevos se centralizaron en `locales/es.ts`?
- [ ] ¿Las constantes de dominio nuevas van en `constants/domain.ts`?
- [ ] ¿El componente nuevo sigue la estructura estándar de props y naming?
- [ ] ¿Se invalida el query correspondiente después de cada mutación?
- [ ] ¿El admin route nuevo tiene protección en `App.tsx`?
- [ ] ¿Las imágenes se suben a Cloudinary (no a Supabase Storage)?
- [ ] ¿Usa `ink-*` / `bone` en vez de `gray-*` o `brand-*`?
- [ ] ¿Los precios llevan la clase `.tnum`?
- [ ] ¿Las rutas salen de `ROUTES` y no están hardcodeadas?
- [ ] ¿Las animaciones usan la curva `ease-drop` y respetan `prefers-reduced-motion`?
- [ ] Si la entrada anima opacidad, ¿lo que se oculta es decoración y no producto?
- [ ] ¿Los radios salen de los tokens (`chip`/`btn`/`card`/`panel`) y no de `rounded-xl`?
