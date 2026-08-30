-- =====================================================================
-- auth-schema.sql — Autenticación con Supabase Auth + tabla `perfiles`
-- ---------------------------------------------------------------------
-- Reemplaza el login casero (tabla `usuarios` con `pass` hasheado en el
-- navegador) por Supabase Auth. Ahora Supabase hashea la contraseña en
-- el servidor y da "recuperar contraseña" por correo.
--
-- Este bloque YA fue aplicado al proyecto hslqnrnolsjdtmrmsyzf mediante
-- migraciones (2026-08-29/30). Se deja aquí como documentación y para
-- poder recrearlo en otro proyecto. Es seguro re-ejecutarlo.
--
-- La tabla vieja `usuarios` NO se borra: queda como respaldo histórico
-- (la app dejó de leerla). Ninguna tabla tiene FK a `usuarios`.
-- =====================================================================

-- ========== PERFILES (1 fila por usuario de Supabase Auth) ==========
-- id = auth.users.id. `inv_access` = permiso para ver el inventario
-- privado (lo activa el admin desde el panel). El resto de tablas
-- (transacciones, changelog, presencia, reservas, juego, prestamos,
-- quiz_*, auditoria) siguen enlazando al usuario por email/nombre.
create table if not exists public.perfiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  email      text unique not null,
  nombre     text,
  inv_access boolean not null default false,
  creado     timestamptz not null default now()
);

alter table public.perfiles enable row level security;

-- Acceso público como el resto de tablas de la app (clave publishable).
drop policy if exists "public_all" on public.perfiles;
create policy "public_all" on public.perfiles for all using (true) with check (true);

-- ========== ALTA AUTOMÁTICA DEL PERFIL AL REGISTRARSE ==========
-- Al crear un usuario en auth.users (supabase.auth.signUp), se inserta
-- su fila en `perfiles` tomando el nombre de raw_user_meta_data.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.perfiles (id, email, nombre)
  values (new.id, new.email, new.raw_user_meta_data->>'nombre')
  on conflict (id) do nothing;
  return new;
end;
$$;

-- La función solo debe correr como trigger, nunca vía RPC público.
revoke execute on function public.handle_new_user() from anon, authenticated, public;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ========== MIGRACIÓN DE LOS 22 USUARIOS EXISTENTES ==========
-- Ya ejecutada. Por cada fila de `usuarios` (email válido, sin duplicar)
-- se creó su cuenta en auth.users + auth.identities con una contraseña
-- ALEATORIA y email_confirmed_at = now(); el trigger creó su `perfiles`
-- y luego se copió `inv_access` desde `usuarios`.
--
-- Como la contraseña es aleatoria, cada persona debe entrar UNA vez con
-- "¿Olvidaste tu contraseña?" para fijar la suya. El hash viejo no es
-- migrable (era un hash casero, no bcrypt).
--
-- Ver el bloque completo en las migraciones:
--   seed_auth_users_from_usuarios
--   lock_down_handle_new_user_execute
