-- =====================================================================
-- mejoras2-schema.sql — Préstamos (equipo no consumible), auditoría
-- y juego (monedas / personalización del laboratorio virtual).
-- ---------------------------------------------------------------------
-- Bloque INDEPENDIENTE y seguro de re-ejecutar. No borra datos.
-- Ejecútalo en Supabase → SQL Editor → New query → Run.
-- =====================================================================

-- ========== COMPONENTES: préstamo (equipo no consumible) ==========
-- 'prestable' distingue equipo (FPGA, multímetro, osciloscopio…) de los
-- consumibles (resistencias, capacitores…). El estado de préstamo vive en
-- el propio componente; el histórico va en la tabla 'prestamos'.
ALTER TABLE componentes ADD COLUMN IF NOT EXISTS prestable      BOOLEAN DEFAULT false;
ALTER TABLE componentes ADD COLUMN IF NOT EXISTS prestado_a     TEXT DEFAULT '';
ALTER TABLE componentes ADD COLUMN IF NOT EXISTS prestado_nombre TEXT DEFAULT '';
ALTER TABLE componentes ADD COLUMN IF NOT EXISTS prestado_desde TIMESTAMPTZ;
ALTER TABLE componentes ADD COLUMN IF NOT EXISTS devolver_antes TIMESTAMPTZ;

-- Histórico de préstamos (cada préstamo y su devolución).
CREATE TABLE IF NOT EXISTS prestamos (
  id          TEXT PRIMARY KEY,
  componente  TEXT NOT NULL,
  codigo      TEXT,
  descripcion TEXT,
  email       TEXT,            -- a quién se prestó
  usuario     TEXT,
  por_email   TEXT,            -- quién registró el préstamo
  por_usuario TEXT,
  desde       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  devolver_antes TIMESTAMPTZ,
  hasta       TIMESTAMPTZ,     -- cuándo se devolvió (null = sigue prestado)
  estado      TEXT NOT NULL DEFAULT 'activo'  -- activo | devuelto
);
CREATE INDEX IF NOT EXISTS prestamos_activos ON prestamos (estado);

-- ========== AUDITORÍA (registro unificado de acciones) ==========
-- Log central: inventario, préstamos, laboratorio (check-in/out, reservas),
-- cuentas y admin. Cada acción registra quién, qué, sobre qué y cuándo.
CREATE TABLE IF NOT EXISTS auditoria (
  id       TEXT PRIMARY KEY,
  ts       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  email    TEXT,
  usuario  TEXT,
  modulo   TEXT,              -- inventario | prestamo | lab | cuenta | admin
  accion   TEXT,              -- agregar | modificar | eliminar | usar | prestar | devolver | entrar | salir | reservar | cancelar | acceso
  objeto   TEXT,              -- código / nombre del objeto afectado
  detalle  TEXT
);
CREATE INDEX IF NOT EXISTS auditoria_ts ON auditoria (ts DESC);

-- ========== JUEGO: monedas y personalización del laboratorio virtual ==========
-- Progreso del avatar de cada usuario: monedas, ítems comprados y equipados.
CREATE TABLE IF NOT EXISTS juego (
  email     TEXT PRIMARY KEY,
  monedas    INTEGER NOT NULL DEFAULT 0,
  comprados  JSONB NOT NULL DEFAULT '[]'::jsonb,   -- ids de ítems adquiridos
  equipado   JSONB NOT NULL DEFAULT '{}'::jsonb,   -- { skin, sombrero, mascota, escritorio }
  ult_recompensa TIMESTAMPTZ,                       -- última vez que se otorgaron monedas
  actualizado TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ========== RLS público (igual que el resto) ==========
ALTER TABLE prestamos ENABLE ROW LEVEL SECURITY;
ALTER TABLE auditoria ENABLE ROW LEVEL SECURITY;
ALTER TABLE juego     ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "public_all" ON prestamos;
DROP POLICY IF EXISTS "public_all" ON auditoria;
DROP POLICY IF EXISTS "public_all" ON juego;
CREATE POLICY "public_all" ON prestamos FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "public_all" ON auditoria FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "public_all" ON juego     FOR ALL USING (true) WITH CHECK (true);
