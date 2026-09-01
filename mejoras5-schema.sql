-- =====================================================================
-- mejoras5-schema.sql — Proyectos (rubro), planificador de compras y
-- link al datasheet de cada componente.
-- ---------------------------------------------------------------------
-- Bloque INDEPENDIENTE y seguro de re-ejecutar. No borra datos.
-- Ejecútalo en Supabase → SQL Editor → New query → Run.
--
-- QUÉ AGREGA
--  1. componentes.datasheet  — URL de la hoja de datos del componente.
--  2. componentes.proyectos  — arreglo JSONB con ids de proyecto
--     (un componente puede pertenecer a varios). El catálogo vive en
--     la tabla `proyectos`.
--  3. Tabla `compras` — lista de compras / pedidos con su flujo:
--     lista → pedido → parcial/recibido → archivado (ya en inventario).
--
-- Todas las tablas nuevas usan la política public_all como el resto de
-- la app (clave publishable). Si NO ejecutas este bloque, la app sigue
-- funcionando: las secciones nuevas se ven vacías.
-- =====================================================================

-- ========== COMPONENTES: datasheet + proyectos ==========
ALTER TABLE componentes ADD COLUMN IF NOT EXISTS datasheet TEXT DEFAULT '';
ALTER TABLE componentes ADD COLUMN IF NOT EXISTS proyectos JSONB NOT NULL DEFAULT '[]'::jsonb;

-- ========== CATÁLOGO DE PROYECTOS ==========
CREATE TABLE IF NOT EXISTS public.proyectos (
  id          TEXT PRIMARY KEY,                 -- 'PRJ' + id aleatorio (lo genera la app)
  nombre      TEXT NOT NULL,
  color       TEXT NOT NULL DEFAULT '#2563EB',
  descripcion TEXT DEFAULT '',
  estado      TEXT NOT NULL DEFAULT 'activo',   -- activo | archivado
  creado      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE public.proyectos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "public_all" ON public.proyectos;
CREATE POLICY "public_all" ON public.proyectos FOR ALL USING (true) WITH CHECK (true);

-- ========== PLANIFICADOR DE COMPRAS ==========
CREATE TABLE IF NOT EXISTS public.compras (
  id               TEXT PRIMARY KEY,
  descripcion      TEXT NOT NULL,
  tipo             TEXT DEFAULT '',
  componente       TEXT DEFAULT '',        -- id de componente existente (reposición) · opcional
  "codigoFabricante" TEXT DEFAULT '',
  proyecto         TEXT DEFAULT '',        -- id de proyecto · opcional
  cantidad_sol     INTEGER NOT NULL DEFAULT 1,
  cantidad_rec     INTEGER NOT NULL DEFAULT 0,
  proveedor        TEXT DEFAULT '',
  link             TEXT DEFAULT '',        -- URL de la tienda / producto
  datasheet        TEXT DEFAULT '',
  precio_unit      NUMERIC DEFAULT 0,
  moneda           TEXT DEFAULT 'MXN',
  estado           TEXT NOT NULL DEFAULT 'lista', -- lista | pedido | parcial | recibido | archivado | cancelado
  notas            TEXT DEFAULT '',
  solicitado_por   TEXT DEFAULT '',
  solicitado_email TEXT DEFAULT '',
  creado           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  pedido_en        TIMESTAMPTZ,
  recibido_en      TIMESTAMPTZ
);
ALTER TABLE public.compras ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "public_all" ON public.compras;
CREATE POLICY "public_all" ON public.compras FOR ALL USING (true) WITH CHECK (true);
