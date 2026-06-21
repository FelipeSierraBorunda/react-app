# Envío de correos de reserva (recordatorio 5 min antes)

El sitio es **estático** (GitHub Pages, sin servidor propio), así que el
correo de **recordatorio 5 minutos antes** no puede salir del navegador
(puede estar cerrado). La app deja los correos en la tabla
`notificaciones` y un proceso programado los envía. Tienes dos opciones.

La tabla la crea `mejoras-schema.sql`. Cada fila tiene `enviar_en`,
`estado` (`pendiente`/`enviado`/`cancelado`) y `tipo`
(`confirmacion`/`recordatorio`).

---

## Opción A — Supabase Edge Function + pg_cron (recomendada)

1. Crea la función (necesitas la Supabase CLI):

   ```bash
   supabase functions new enviar-notificaciones
   ```

2. `supabase/functions/enviar-notificaciones/index.ts`:

   ```ts
   import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

   const supabase = createClient(
     Deno.env.get('SUPABASE_URL')!,
     Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
   );
   const RESEND_KEY = Deno.env.get('RESEND_API_KEY')!; // o tu proveedor

   Deno.serve(async () => {
     const ahora = new Date().toISOString();
     const { data: pend } = await supabase
       .from('notificaciones')
       .select('*')
       .eq('estado', 'pendiente')
       .lte('enviar_en', ahora)
       .limit(50);

     for (const n of pend ?? []) {
       const ok = await fetch('https://api.resend.com/emails', {
         method: 'POST',
         headers: { Authorization: `Bearer ${RESEND_KEY}`, 'Content-Type': 'application/json' },
         body: JSON.stringify({
           from: 'Lab I&R <lab@tu-dominio.com>',
           to: n.email,
           subject: n.asunto,
           text: n.cuerpo,
         }),
       }).then((r) => r.ok).catch(() => false);

       await supabase.from('notificaciones')
         .update({ estado: ok ? 'enviado' : 'pendiente', enviado: ok, enviado_en: ok ? new Date().toISOString() : null })
         .eq('id', n.id);
     }
     return new Response('ok');
   });
   ```

3. Despliega y prográmala cada minuto con pg_cron (SQL Editor):

   ```sql
   select cron.schedule(
     'enviar-notificaciones', '* * * * *',
     $$ select net.http_post(
          url := 'https://<PROJECT>.functions.supabase.co/enviar-notificaciones',
          headers := '{"Authorization":"Bearer <ANON_O_SERVICE_KEY>"}'::jsonb
        ); $$
   );
   ```

---

## Opción B — GitHub Action cada minuto

Un workflow (`.github/workflows/notificaciones.yml`) con
`on: schedule: - cron: '* * * * *'` que corra un script Node: lee las
filas pendientes vía la REST de Supabase y las envía con tu proveedor
(Resend, SendGrid, etc.). Mismo criterio: `estado='pendiente'` y
`enviar_en <= now()`.

> Nota: GitHub Actions programadas corren con retraso variable (no exacto
> al minuto). Para precisión usa la Opción A.

---

## Envío inmediato de la confirmación (opcional, lado cliente)

Si defines en `react-app/.env`:

```
VITE_EMAILJS_SERVICE=service_xxx
VITE_EMAILJS_TEMPLATE=template_xxx
VITE_EMAILJS_KEY=public_key_xxx
```

la app manda la **confirmación** al instante con EmailJS desde el
navegador. El recordatorio de 5 min siempre depende del proceso
programado de arriba.
