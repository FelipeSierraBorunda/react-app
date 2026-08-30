# Configuración de Supabase Auth (una sola vez)

Proyecto: **hslqnrnolsjdtmrmsyzf** — panel: https://supabase.com/dashboard/project/hslqnrnolsjdtmrmsyzf

Las migraciones de base de datos ya están aplicadas
(`create_perfiles_and_handle_new_user`, `seed_auth_users_from_usuarios`,
`lock_down_handle_new_user_execute`). Falta **configurar el panel** para que
funcionen el registro y la recuperación de contraseña.

---

## 1. URLs de redirección  ← imprescindible

**Authentication → URL Configuration**

- **Site URL:**
  ```
  https://felipesierraborunda.github.io/react-app/
  ```
- **Redirect URLs** (botón *Add URL*, una por una):
  ```
  https://felipesierraborunda.github.io/react-app/
  http://localhost:5173/
  ```

Sin esto, el enlace de "recuperar contraseña" del correo da error
`redirect_to not allowed`.

---

## 2. Confirmación de correo  ← recomendado: DESACTIVAR

**Authentication → Providers → Email**

- Quita el check de **"Confirm email"** y guarda.

Motivo: el remitente de correo integrado de Supabase está limitado a
~2-3 correos/hora. Si se deja activo, cada registro nuevo necesita un correo
de confirmación y se encolará/fallará. Con esto desactivado, el registro
entra directo y el **único** uso de correo es la recuperación de contraseña.

(Si prefieres mantener la confirmación activa, el código ya lo soporta:
el modal muestra "Revisa tu correo para confirmarla".)

---

## 3. Aviso a los 22 usuarios ya existentes

Se migraron con **contraseña aleatoria** (su hash viejo no era recuperable).
Cada persona debe, una sola vez:

1. Ir a https://felipesierraborunda.github.io/react-app/
2. **Iniciar sesión → "¿Olvidaste tu contraseña?"**
3. Escribir su correo (el mismo de antes) → llega un enlace
4. Abrir el enlace → fijar su contraseña nueva

⚠️ Por el límite de ~2-3 correos/hora del remitente integrado, si avisas a
todos a la vez habrá cola. Opciones:
- pídeles que lo hagan repartidos a lo largo del día, **o**
- configura SMTP propio (paso 5).

---

## 4. Opcional — Leaked password protection

**Authentication → Policies** (o *Password settings*) → activar
**"Check against HaveIBeenPwned"**. Rechaza contraseñas ya filtradas.

---

## 5. Opcional pero recomendado a futuro — SMTP propio

Con SMTP propio desaparece el límite de correos.

**Authentication → Emails → SMTP Settings → Enable custom SMTP**

Con [Resend](https://resend.com) (plan gratis 3.000/mes):
- Host: `smtp.resend.com`  ·  Port: `465`  ·  User: `resend`
- Password: tu API key de Resend
- Sender email: una dirección de un dominio verificado en Resend
- Sender name: `Lab I&R`

No requiere cambios de código.

---

## Verificación

1. En **Authentication → Users** deben verse 22 usuarios.
2. En el **Table Editor → perfiles**, 22 filas con `inv_access = true`.
3. Registrar una cuenta de prueba en la app → aparece en *Users* y en
   *perfiles* (la crea el trigger). Bórrala luego desde *Users*.
4. "¿Olvidaste tu contraseña?" con esa cuenta → llega el correo (o míralo en
   **Authentication → Logs**) → el enlace abre la pantalla "Nueva contraseña".
