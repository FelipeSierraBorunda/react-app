-- =====================================================================
-- mejoras-schema.sql — Mejoras: módulos, almacenamiento jerárquico,
-- control de acceso al inventario y notificaciones de reservas.
-- ---------------------------------------------------------------------
-- Bloque INDEPENDIENTE y seguro de re-ejecutar (IF NOT EXISTS / IF EXISTS).
-- No borra datos. Ejecútalo en Supabase → SQL Editor → New query → Run.
-- =====================================================================

-- ========== MESAS / MÓDULOS ==========
-- 'descripcion' para módulos (granja, brazo, módulo genérico).
-- kind ahora admite también 'modulo'.
ALTER TABLE mesas ADD COLUMN IF NOT EXISTS descripcion TEXT DEFAULT '';

-- ========== COMPONENTES: ubicación general (mesa/módulo) ==========
-- 'mesa' = id de la mesa/módulo donde está el componente cuando está SUELTO.
-- Cuando el componente vive en un contenedor (gabinete/caja), su mesa se
-- deriva de la mesa asignada a ese contenedor (tabla ajustes · cont_mesa).
ALTER TABLE componentes ADD COLUMN IF NOT EXISTS mesa TEXT DEFAULT '';

-- ========== USUARIOS: acceso al inventario ==========
-- El inventario es privado: requiere sesión + aprobación del admin.
-- El croquis y la granja quedan abiertos a invitados.
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS inv_access BOOLEAN NOT NULL DEFAULT false;

-- ========== AJUSTES (clave/valor) ==========
-- Tabla genérica para configuraciones compartidas. Hoy guarda:
--   clave='cont_mesa'  valor={ "G1":"inv", "C1":"6", ... }  (contenedor → mesa)
CREATE TABLE IF NOT EXISTS ajustes (
  clave TEXT PRIMARY KEY,
  valor JSONB NOT NULL DEFAULT '{}'::jsonb,
  actualizado TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ========== NOTIFICACIONES (cola de correos de reserva) ==========
-- La app encola aquí los correos; un proceso programado (Edge Function +
-- pg_cron, o GitHub Action) los envía cuando enviar_en <= NOW().
--   tipo: 'confirmacion' (enviar_en = ahora) | 'recordatorio' (inicio - 5min)
CREATE TABLE IF NOT EXISTS notificaciones (
  id         TEXT PRIMARY KEY,
  reserva_id TEXT NOT NULL,
  email      TEXT NOT NULL,
  nombre     TEXT,
  mesa       TEXT,
  tipo       TEXT NOT NULL,             -- confirmacion | recordatorio
  asunto     TEXT,
  cuerpo     TEXT,
  enviar_en  TIMESTAMPTZ NOT NULL,
  enviado    BOOLEAN NOT NULL DEFAULT false,
  enviado_en TIMESTAMPTZ,
  estado     TEXT NOT NULL DEFAULT 'pendiente', -- pendiente | enviado | cancelado
  creada     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS notif_pendientes ON notificaciones (enviar_en) WHERE estado = 'pendiente';

-- ========== RLS público (igual que el resto) ==========
ALTER TABLE ajustes        ENABLE ROW LEVEL SECURITY;
ALTER TABLE notificaciones ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "public_all" ON ajustes;
DROP POLICY IF EXISTS "public_all" ON notificaciones;
CREATE POLICY "public_all" ON ajustes        FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "public_all" ON notificaciones FOR ALL USING (true) WITH CHECK (true);

-- Sugerencia: marca como admin a tu cuenta para darte acceso al inventario
-- automáticamente (opcional). Cambia el correo:
-- UPDATE usuarios SET inv_access = true WHERE email = 'tu-correo@ejemplo.com';
