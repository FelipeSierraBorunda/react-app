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
