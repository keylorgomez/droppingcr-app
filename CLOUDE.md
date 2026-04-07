# Contexto del Proyecto: Dropping CR - MVP Catálogo

Actúa como un Tech Lead y Full-Stack Developer experto. Estamos construyendo el MVP de un catálogo web responsivo y moderno para una marca de ropa, chemas, tenis y accesorios. 

El objetivo principal es mantener los costos de infraestructura en cero, maximizar el rendimiento y mantener un código escalable y limpio.

## Stack Tecnológico Estricto
- **Frontend:** React + Vite + TypeScript (SPA pura).
- **Estilos:** Tailwind CSS.
- **UI & Componentes:** shadcn/ui + Lucide React (iconos).
- **Animaciones:** Framer Motion (usar sutilmente para transiciones modernas).
- **Backend / Base de Datos:** Supabase (PostgreSQL + Auth + Row Level Security).
- **Gestión de Imágenes:** Cloudinary (Solo URLs se guardan en la BD).
- **Estado y Fetching:** TanStack Query (React Query) + React Router v6.

## Reglas de Arquitectura (Clean Architecture)
1. **Componentes Atómicos:** Separa la UI en componentes reutilizables (ej. `/src/components/ui` para genéricos, `/src/components/catalog` para negocio).
2. **Separación de Lógica:** No mezcles consultas a Supabase dentro de los componentes React. Crea una capa de servicios (ej. `/src/services/productService.ts`).
3. **Tipado Estricto:** Define todas las interfaces de TypeScript basadas en el esquema de la base de datos de Supabase.
4. **Respuestas Concisas:** Cuando te pida generar código, entrega SOLO el código modificado o nuevo. No expliques paso a paso a menos que haya un error complejo. No asumas ni te adelantes a construir funcionalidades que no he pedido.

## Esquema de Base de Datos Inicial (Supabase)
Asume que este es el esquema relacional que maneja el negocio. Utiliza esto para generar los tipos de TypeScript y las consultas:

```sql
-- Productos principales
CREATE TABLE products (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  description TEXT,
  category TEXT NOT NULL, -- ropa, tenis, accesorios, etc.
  price_purchase DECIMAL(10, 2) NOT NULL,
  price_sale DECIMAL(10, 2) NOT NULL,
  discount_percentage INT DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Variantes (Tallas, colores y stock)
CREATE TABLE product_variants (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  product_id UUID REFERENCES products(id) ON DELETE CASCADE,
  size TEXT NOT NULL,
  color TEXT,
  stock INT DEFAULT 0
);

-- Imágenes de productos (URLs de Cloudinary)
CREATE TABLE product_images (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  product_id UUID REFERENCES products(id) ON DELETE CASCADE,
  image_url TEXT NOT NULL,
  is_primary BOOLEAN DEFAULT FALSE
);

-- Gastos operativos
CREATE TABLE expenses (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  description TEXT NOT NULL,
  amount DECIMAL(10, 2) NOT NULL,
  expense_date DATE NOT NULL DEFAULT CURRENT_DATE
);






## Identidad de Marca y Branding (Dropping CR)

Esta información es crucial para el diseño de la interfaz (UI). Cada componente debe alinearse con esta estética.

**Vibe Visual:** Minimalista y moderno, pero con una fuerte identidad 'retro-vintage' y 'streetwear' derivada de los assets gráficos. Usar transiciones fluidas de Framer Motion.

**Assets Gráficos (image_1.png - image_2.png):**
- **Mascota:** Un personaje de gota de agua estilo dibujo animado retro, caminando con gafas de sol y chaqueta de trabajo (image_1.png).
- **Logo:** Texto "DROPPING CR" con la misma gota de agua y un destello/estrella (image_2.png).

**Paleta de Colores (Extraída de image_3.png):**
- Fondo Principal / Off-White: `#ffefd1`
- Texto Primario / Marrón Oscuro / Botones (Hover): `#975023`
- Acento / Dorado-Tan / Iconos / Bordes (image_2.png): `#a26720`
- Negro / Texto secundario (image_3.png): `#001`

**Tipografía:**
- Fuente Principal: **Poppins** (Cargar de Google Fonts o local).
- Encabezados (H1-H6): `Poppins SemiBold 600 Italic`.
- Cuerpo de texto / Botones: `Poppins Regular 400`.

**Ejemplos de Botones (image_3.png):**
- Login (Primario): Fondo `#975023`, Texto Blanco (`#ffffff` o `#ffefd1`).
- Register (Secundario/Off-White): Fondo `#ffefd1`, Texto `#975023` (con borde `#a26720` si es necesario).

**Contexto de Producto (image_4.png):**
- Las fotos de productos son streetwear negro de alta calidad, a menudo con drops limitados.
- Las secciones destacadas de Instagram usan iconos dorados `#a26720`.