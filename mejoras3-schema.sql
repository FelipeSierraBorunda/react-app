-- =====================================================================
-- mejoras3-schema.sql — Laboratorio virtual: quiz colaborativo, insignias
-- y decoración. Bloque INDEPENDIENTE y seguro de re-ejecutar (no borra datos).
-- Ejecútalo en Supabase → SQL Editor → New query → Run.
-- =====================================================================

-- ========== JUEGO: gasto acumulado (para insignias) y decoración ==========
ALTER TABLE juego ADD COLUMN IF NOT EXISTS gastado    INTEGER NOT NULL DEFAULT 0;
ALTER TABLE juego ADD COLUMN IF NOT EXISTS deco       JSONB NOT NULL DEFAULT '[]'::jsonb;  -- objetos en tu escritorio
ALTER TABLE juego ADD COLUMN IF NOT EXISTS premio_sem TEXT DEFAULT '';                      -- semana ya premiada (YYYY-Www)

-- ========== QUIZ: preguntas creadas por los usuarios ==========
-- Cada pregunta tiene 3 opciones y vive 24 h. Se responde UNA sola vez por usuario.
CREATE TABLE IF NOT EXISTS quiz_preguntas (
  id            TEXT PRIMARY KEY,
  autor_email   TEXT,
  autor_nombre  TEXT,
  texto         TEXT NOT NULL,
  opciones      JSONB NOT NULL,           -- ["a","b","c"]
  correcta      INTEGER NOT NULL,         -- índice 0..2
  premio        INTEGER NOT NULL DEFAULT 15,
  creado        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expira        TIMESTAMPTZ NOT NULL
);
CREATE INDEX IF NOT EXISTS quiz_expira ON quiz_preguntas (expira);

-- Respuestas (una por usuario y pregunta).
CREATE TABLE IF NOT EXISTS quiz_respuestas (
  id        TEXT PRIMARY KEY,
  pregunta  TEXT NOT NULL,
  email     TEXT NOT NULL,
  nombre    TEXT,
  opcion    INTEGER NOT NULL,
  correcta  BOOLEAN NOT NULL,
  ts        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (pregunta, email)
);

-- ========== RLS público ==========
ALTER TABLE quiz_preguntas  ENABLE ROW LEVEL SECURITY;
ALTER TABLE quiz_respuestas ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "public_all" ON quiz_preguntas;
DROP POLICY IF EXISTS "public_all" ON quiz_respuestas;
CREATE POLICY "public_all" ON quiz_preguntas  FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "public_all" ON quiz_respuestas FOR ALL USING (true) WITH CHECK (true);
