# CLAUDE.md — Dropping CR

Guía de arquitectura, principios y convenciones para este proyecto. Léelo antes de modificar cualquier parte del codebase.

---

## MVP — Qué es Dropping CR

**Dropping CR** es una plataforma de catálogo y gestión operacional para una tienda de ropa/streetwear en Costa Rica. No es un e-commerce autónomo: el pago ocurre fuera de la app (transferencia, SINPE, efectivo). La app sirve como vitrina pública y como sistema de backoffice completo para el negocio.

### Alcance actual del MVP

**Vista pública (clientes):**
- Catálogo filtrable por búsqueda y talla
- Detalle de producto con galería de imágenes y variantes
- Carrito persistente (guest en localStorage, usuario en DB)
- Perfil de usuario e historial de pedidos

**Vista admin (backoffice):**
- Dashboard con KPIs: revenue, ganancia neta, deuda pendiente, top productos
- Gestión de productos (CRUD) con variantes por talla, stock real, imágenes Cloudinary
- Gestión de categorías
- Registro de ventas (single-item: `sales`) y órdenes (multi-item: `orders`)
- Control de pagos parciales y deudas por cliente
- Movimientos: log de todos los pagos y devoluciones
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

payments ──> sales | orders    (abonos)
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

Dropping CR tiene una estética **streetwear vintage retro** con toques cálidos. El fondo crema (`#ffefd1`) junto al marrón oscuro (`#975023`) crean una sensación de marca curada y exclusiva. El copy del sitio refuerza esto: "Limited drops", "Global drip", "Ediciones limitadas".

### Paleta de colores

| Token Tailwind | Hex | Uso |
|----------------|-----|-----|
| `brand-bg` | `#ffefd1` | Fondo global del sitio (`body`), CTAs sobre fondos oscuros |
| `brand-primary` | `#975023` | Color principal — botones, logo, títulos de tarjetas, badges activos, avatar de usuario |
| `brand-accent` | `#a26720` | Dorado-tan — íconos secundarios, acentos, hover states sutiles |
| `brand-dark` | `#000011` | Texto corriente, íconos sobre fondo claro |
| `white` | `#ffffff` | Header, cards de producto, fondos de modales |
| `gray-50` | — | Fondo de imágenes placeholder |
| `gray-100` | — | Bordes de tarjetas y separadores |
| `gray-400` | — | Texto secundario, precios tachados |

**Colores de estado (no son de marca, son semánticos):**
| Color | Uso |
|-------|-----|
| `emerald-500` | Badge "NUEVO" |
| `yellow-400` | Badge "APARTADA" |
| `red-500` | Badge "% OFF", precio con descuento |
| `gray-600` | Badge "AGOTADO" |
| `gray-800/75` | Badge "Oculto" (solo admin) |

**Colores especiales (feature FWC26):**
| Color | Uso |
|-------|-----|
| `#F5C400` | Badge "FWC26" (World Cup 2026) |
| `#E8302A / #1C4F9C / #2B8C3E` | Stripe tricolor en cards de categoría fútbol |

**Nunca inventar colores fuera de esta paleta.** Si se necesita un tono nuevo, se agrega al `tailwind.config.js` bajo `brand` antes de usarlo.

---

### Tipografía

**Fuente única: Poppins** — importada de Google Fonts.

```css
/* Pesos importados */
Poppins 400 (normal)   — texto corriente, párrafos, labels
Poppins 500 (medium)   — subtítulos, labels de formulario, nav items
Poppins 600 (semibold) — encabezados, logo, precio, botones
Poppins 600 italic     — títulos de producto, slogan hero, logo mark
```

**Reglas tipográficas:**

| Elemento | Clases Tailwind |
|----------|----------------|
| Logo mark (desktop) | `font-poppins font-semibold italic text-2xl tracking-tight text-brand-primary` |
| Hero h1 | `font-poppins font-semibold italic text-4xl sm:text-5xl md:text-6xl text-[#ffefd1]` |
| Nombre de producto en card | `font-poppins font-semibold italic text-[11px] text-brand-primary` |
| Precio normal | `font-poppins font-bold text-base text-brand-dark` |
| Precio con descuento | `font-poppins font-bold text-lg text-red-500` |
| Banner typewriter | `font-poppins font-semibold text-[11px] tracking-wide text-white` |
| Labels / badges | `font-poppins font-bold text-[10px] tracking-widest uppercase` |
| Texto secundario / subtext | `font-poppins font-light text-sm text-white/70` |
| Cuerpo general | hereda de `body` → `font-poppins text-brand-dark` |

**Los `h1-h6` son `font-semibold italic` por defecto** (definido en `index.css`). Si un heading necesita no ser italic, se sobreescribe con `not-italic`.

---

### Componentes UI — Patrones visuales

**Tarjeta de producto (`ProductCard`)**
- `bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden`
- Hover: `y: -4` con `boxShadow` suavizado (spring animation)
- Imagen: `aspect-square object-cover bg-gray-50`
- Badges en esquinas absolutas: `rounded-full text-[10px] font-bold uppercase tracking-widest px-2.5 py-1`
- Dots indicadores de imagen: `bg-white` activo, `bg-white/50` inactivo, transición 300ms

**Header**
- `sticky top-0 z-30 bg-white border-b border-gray-100`
- Banner superior: `bg-brand-primary` con typewriter animado
- Layout: posicionamiento absoluto para íconos left/right, logo centrado
- Avatar usuario: `rounded-full bg-brand-primary text-white` con iniciales

**Hero**
- Imagen full-bleed `h-[90vh] min-h-[560px]`
- Overlay: `bg-black/60`
- Entrada animada: `opacity: 0 → 1, y: 24 → 0` en 700ms `easeOut`
- CTA: `rounded-full bg-[#ffefd1] text-brand-primary` con hover a `bg-white + scale(1.04)`
- Scroll hint: línea vertical `bg-white/30` animada en loop

**Botones primarios**
```
bg-brand-primary text-white font-poppins font-medium
rounded-full (CTA hero) o rounded-lg (forms/admin)
hover: brightness-95 o bg-brand-accent
disabled: opacity-50 cursor-not-allowed
```

**Modales**
- Base: `@radix-ui/react-dialog` + `motion.div` (Framer Motion)
- Backdrop: `bg-black/50`
- Contenedor: `bg-white rounded-2xl shadow-xl`
- Animación entrada: `opacity 0→1 + scale 0.95→1` o `translateY`

**Íconos**
- Librería: `lucide-react`
- Stroke width estándar: `strokeWidth={1.8}` (íconos header/nav), `strokeWidth={2}` (íconos de acción)
- Tamaños frecuentes: `size={22}` header, `size={16}` inline, `size={13}` micro (edit button)

**Animaciones (Framer Motion)**
- Cards: `spring` stiffness 320 damping 24
- Hero: `easeOut` 700ms
- Transición de imágenes: crossfade `easeInOut` 600ms
- Sidebars/drawers: slide desde el borde (`x: "100%" → 0` o similar)
- Modales: `scale + opacity`

---

### Tono de copy

- Corto, directo, en español costarricense
- Uso de inglés solo en términos de marca: "drops", "drip", "fits", "streetwear"
- Labels de UI: siempre en español (definidos en `locales/es.ts`)
- Precio siempre en colones: `₡` + `toLocaleString("en-US")`
- El copy de marketing es aspiracional pero local: "GRECIA | CR", "Envíos a todo el país"

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

- Paleta de marca: `text-brand-primary`, `bg-brand-bg`, `text-brand-accent`, `text-brand-dark`
- Fuente: `font-poppins` (por defecto en body)
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
