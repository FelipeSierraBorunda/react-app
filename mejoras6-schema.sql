-- =====================================================================
-- mejoras6-schema.sql — Elimina el módulo de PRÉSTAMOS.
-- ---------------------------------------------------------------------
-- ⚠️  DESTRUCTIVO E IRREVERSIBLE. Ejecútalo solo si ya NO quieres el
--     módulo de préstamos (el front ya lo quitó).
--
-- - Borra la tabla `prestamos` (histórico de préstamos y devoluciones).
-- - Quita de `componentes` las columnas de estado de préstamo.
-- - El registro en `public.auditoria` (modulo = 'prestamo') NO se toca:
--   las acciones históricas siguen visibles en la Auditoría.
--
-- Ejecútalo en Supabase → SQL Editor → New query → Run.
-- =====================================================================

DROP TABLE IF EXISTS public.prestamos CASCADE;

ALTER TABLE public.componentes
  DROP COLUMN IF EXISTS prestable,
  DROP COLUMN IF EXISTS prestado_a,
  DROP COLUMN IF EXISTS prestado_nombre,
  DROP COLUMN IF EXISTS prestado_desde,
  DROP COLUMN IF EXISTS devolver_antes;
