-- =====================================================================
-- lab-schema.sql — Tablas del módulo "Croquis & Ocupación"
-- ---------------------------------------------------------------------
-- Bloque INDEPENDIENTE: puedes ejecutarlo en tu base ya existente sin
-- perder datos. Crea 3 tablas nuevas: mesas, presencia, reservas.
-- Ejecútalo en Supabase → SQL Editor → New query → Run.
-- =====================================================================

-- ========== MESAS / ESPACIOS DEL LAB ==========
-- Guarda la distribución del croquis (posición, tamaño, dueños, objetos).
-- "kind" distingue mesas de zonas especiales (inventario, granja, etc.).
CREATE TABLE IF NOT EXISTS mesas (
  id        TEXT PRIMARY KEY,          -- "1".."13", "A", "B", "inv", "granja"...
  nombre    TEXT NOT NULL,
  kind      TEXT NOT NULL DEFAULT 'mesa', -- mesa | inventario | granja | brazo | almacen
  x         INT  NOT NULL DEFAULT 0,
  y         INT  NOT NULL DEFAULT 0,
  w         INT  NOT NULL DEFAULT 100,
  h         INT  NOT NULL DEFAULT 48,
  forma     TEXT NOT NULL DEFAULT 'rect', -- rect | L
  sillas    INT  NOT NULL DEFAULT 0,
  silla_dir TEXT NOT NULL DEFAULT 'bottom', -- bottom | top | left | right
  duenos    JSONB NOT NULL DEFAULT '[]'::jsonb, -- ["Yumil", ...]
  objetos   JSONB NOT NULL DEFAULT '[]'::jsonb, -- [{nombre, foto}]
  link      TEXT DEFAULT '',           -- enlace externo (granja, brazo)
  pc        BOOLEAN NOT NULL DEFAULT false,
  orden     INT NOT NULL DEFAULT 0
);

-- ----- Columnas del modo edición admin (añadir si la tabla ya existe) -----
-- max_sillas : tope de sillas por mesa (regla del lab, editable).
-- seats      : posiciones reubicables [{dx,dy,on}] (offset px respecto a la mesa).
-- color      : color de relleno de la mesa.
ALTER TABLE mesas ADD COLUMN IF NOT EXISTS max_sillas INT NOT NULL DEFAULT 2;
ALTER TABLE mesas ADD COLUMN IF NOT EXISTS seats JSONB NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE mesas ADD COLUMN IF NOT EXISTS color TEXT DEFAULT '#ffffff';

-- ========== PRESENCIA (check-in / check-out) ==========
-- Una fila por visita. salida = NULL significa que la persona sigue dentro.
CREATE TABLE IF NOT EXISTS presencia (
  id      TEXT PRIMARY KEY,
  email   TEXT NOT NULL,
  nombre  TEXT NOT NULL,
  mesa    TEXT,                         -- mesa donde se sentó (opcional)
  entrada TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  salida  TIMESTAMPTZ                   -- NULL = presente
);

-- ========== RESERVAS ==========
CREATE TABLE IF NOT EXISTS reservas (
  id       TEXT PRIMARY KEY,
  mesa     TEXT NOT NULL,
  email    TEXT NOT NULL,
  nombre   TEXT NOT NULL,
  inicio   TIMESTAMPTZ NOT NULL,
  fin      TIMESTAMPTZ NOT NULL,
  es_dueno BOOLEAN NOT NULL DEFAULT false,
  estado   TEXT NOT NULL DEFAULT 'activa', -- activa | desplazada | cancelada
  creada   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ========== ROW LEVEL SECURITY (acceso público como las otras tablas) ==========
ALTER TABLE mesas     ENABLE ROW LEVEL SECURITY;
ALTER TABLE presencia ENABLE ROW LEVEL SECURITY;
ALTER TABLE reservas  ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "public_all" ON mesas;
DROP POLICY IF EXISTS "public_all" ON presencia;
DROP POLICY IF EXISTS "public_all" ON reservas;
CREATE POLICY "public_all" ON mesas     FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "public_all" ON presencia FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "public_all" ON reservas  FOR ALL USING (true) WITH CHECK (true);

-- La distribución inicial de mesas se siembra automáticamente desde la app
-- la primera vez que abras "Croquis & Ocupación" (si la tabla está vacía).
-- No necesitas insertar filas a mano.
