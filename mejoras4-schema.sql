-- =====================================================================
-- mejoras4-schema.sql — Contenedores (cajas) personalizados compartidos
-- ---------------------------------------------------------------------
-- Bloque INDEPENDIENTE y seguro de re-ejecutar. No borra datos.
-- Ejecútalo en Supabase → SQL Editor → New query → Run.
--
-- PROBLEMA QUE RESUELVE
-- Las "cajas nuevas" que se creaban en la vista de inventario solo se
-- guardaban en el localStorage del navegador de quien las creaba, así
-- que no aparecían para las demás cuentas (ni en otro dispositivo).
-- Ahora viven en esta tabla, compartida como el resto (política
-- public_all + clave publishable).
--
-- MIGRACIÓN DE LAS CAJAS VIEJAS
-- La app sube automáticamente a esta tabla las cajas que aún tenga en
-- localStorage la primera vez que se abre el inventario tras el deploy,
-- y luego limpia ese localStorage. No hay que copiar nada a mano.
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.contenedores (
  id           TEXT PRIMARY KEY,                       -- 'U' + id aleatorio (lo genera la app)
  name         TEXT NOT NULL,
  type         TEXT NOT NULL DEFAULT 'caja_libre',     -- gabinete | truper | caja12 | caja_libre
  compartments INTEGER,                                -- nº de cajones/divisiones (NULL en caja libre)
  image        TEXT,                                   -- URL de imagen (opcional)
  creado       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.contenedores ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "public_all" ON public.contenedores;
CREATE POLICY "public_all" ON public.contenedores FOR ALL USING (true) WITH CHECK (true);
