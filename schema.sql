DROP TABLE IF EXISTS transacciones CASCADE;
DROP TABLE IF EXISTS changelog CASCADE;
DROP TABLE IF EXISTS componentes CASCADE;
DROP TABLE IF EXISTS usuarios CASCADE;

-- ========== COMPONENTES ==========
CREATE TABLE componentes (
  id TEXT PRIMARY KEY,
  "codigoInterno" TEXT,
  contenedor TEXT,
  cajon INTEGER,
  posicion INTEGER,
  tipo TEXT,
  "codigoFabricante" TEXT,
  descripcion TEXT,
  cantidad INTEGER,
  "espacioOcupado" TEXT,
  notas TEXT
);

-- ========== USUARIOS ==========
CREATE TABLE usuarios (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  nombre TEXT NOT NULL,
  pass TEXT NOT NULL,
  creado TIMESTAMPTZ DEFAULT NOW()
);

-- ========== TRANSACCIONES ==========
CREATE TABLE transacciones (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  email TEXT,
  usuario TEXT,
  type TEXT,
  codigo TEXT,
  descripcion TEXT,
  tipo TEXT,
  cantidad INTEGER,
  contenedor TEXT,
  ts TIMESTAMPTZ DEFAULT NOW()
);

-- ========== CHANGELOG ==========
CREATE TABLE changelog (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  usuario TEXT,
  type TEXT,
  codigo TEXT,
  descripcion TEXT,
  tipo TEXT,
  cantidad INTEGER,
  ts TIMESTAMPTZ DEFAULT NOW()
);

-- ========== ROW LEVEL SECURITY ==========
ALTER TABLE componentes ENABLE ROW LEVEL SECURITY;
ALTER TABLE usuarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE transacciones ENABLE ROW LEVEL SECURITY;
ALTER TABLE changelog ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public_all" ON componentes FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "public_all" ON usuarios FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "public_all" ON transacciones FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "public_all" ON changelog FOR ALL USING (true) WITH CHECK (true);

-- ========== TIPOS PERSONALIZADOS ==========
-- Bloque independiente: puedes ejecutar SOLO esto en una base ya creada
-- sin perder datos. Guarda los tipos de componente que crea el admin
-- (nombre + color de recuadro). Los tipos "base" siguen en el código.
CREATE TABLE IF NOT EXISTS tipos (
  nombre TEXT PRIMARY KEY,
  color  TEXT NOT NULL,
  creado TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE tipos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "public_all" ON tipos;
CREATE POLICY "public_all" ON tipos FOR ALL USING (true) WITH CHECK (true);

-- ========== MÓDULO LABORATORIO (mesas · presencia · reservas) ==========
-- Bloque independiente: ejecútalo en una base ya creada SIN perder datos.
-- La primera vez que se abre el croquis, la app siembra la distribución
-- por defecto en "mesas" si está vacía.

-- Mesas / zonas del croquis (incluye inventario, granja, brazo, almacén).
CREATE TABLE IF NOT EXISTS mesas (
  id        TEXT PRIMARY KEY,
  nombre    TEXT NOT NULL,
  kind      TEXT DEFAULT 'mesa',          -- mesa | inventario | granja | brazo | almacen
  x         REAL DEFAULT 40,
  y         REAL DEFAULT 40,
  w         REAL DEFAULT 100,
  h         REAL DEFAULT 48,
  forma     TEXT DEFAULT 'rect',          -- rect | L
  sillas    INTEGER DEFAULT 0,
  silla_dir TEXT DEFAULT 'bottom',        -- bottom | top | left | right
  duenos    JSONB DEFAULT '[]'::jsonb,    -- ["Yumil", ...] (1-2)
  objetos   JSONB DEFAULT '[]'::jsonb,    -- [{"nombre":"Osciloscopio"}, ...]
  link      TEXT DEFAULT '',
  pc        BOOLEAN DEFAULT false,
  orden     INTEGER DEFAULT 60
);

-- Columnas del modo edición admin (seguro re-ejecutar).
ALTER TABLE mesas ADD COLUMN IF NOT EXISTS max_sillas INT NOT NULL DEFAULT 2;
ALTER TABLE mesas ADD COLUMN IF NOT EXISTS max_duenos INT NOT NULL DEFAULT 2;
ALTER TABLE mesas ADD COLUMN IF NOT EXISTS seats JSONB NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE mesas ADD COLUMN IF NOT EXISTS color TEXT DEFAULT '#ffffff';

-- Presencia: un registro por check-in. salida=NULL ⇒ la persona sigue dentro.
CREATE TABLE IF NOT EXISTS presencia (
  id      TEXT PRIMARY KEY,
  email   TEXT,
  nombre  TEXT,
  mesa    TEXT,
  entrada TIMESTAMPTZ DEFAULT NOW(),
  salida  TIMESTAMPTZ
);

-- Reservas por horario (regla dueño/externo gestionada en la app).
CREATE TABLE IF NOT EXISTS reservas (
  id       TEXT PRIMARY KEY,
  mesa     TEXT,
  email    TEXT,
  nombre   TEXT,
  inicio   TIMESTAMPTZ,
  fin      TIMESTAMPTZ,
  es_dueno BOOLEAN DEFAULT false,
  estado   TEXT DEFAULT 'activa',         -- activa | desplazada | cancelada
  creada   TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE mesas     ENABLE ROW LEVEL SECURITY;
ALTER TABLE presencia ENABLE ROW LEVEL SECURITY;
ALTER TABLE reservas  ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "public_all" ON mesas;
DROP POLICY IF EXISTS "public_all" ON presencia;
DROP POLICY IF EXISTS "public_all" ON reservas;
CREATE POLICY "public_all" ON mesas     FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "public_all" ON presencia FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "public_all" ON reservas  FOR ALL USING (true) WITH CHECK (true);

-- ========== SALA DEL JUEGO (distribución compartida del croquis pixel) ==========
-- Una sola fila (id='lab') con TODA la configuración editada dentro del juego:
-- posición, tamaño, color, textura, rotación, espejo y sillas de cada mueble.
-- Así las ediciones que haga cualquiera son las mismas para todos.
CREATE TABLE IF NOT EXISTS sala (
  id          TEXT PRIMARY KEY,
  config      JSONB NOT NULL DEFAULT '{}'::jsonb,
  actualizado TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE sala ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "public_all" ON sala;
CREATE POLICY "public_all" ON sala FOR ALL USING (true) WITH CHECK (true);
