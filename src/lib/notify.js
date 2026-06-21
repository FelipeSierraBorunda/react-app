/* =====================================================================
   notify.js — Notificaciones de reserva (confirmación + recordatorio)
   ---------------------------------------------------------------------
   El sitio es estático (sin servidor propio), así que el envío real de
   correos se hace en DOS niveles:

   1) COLA EN SUPABASE (tabla "notificaciones"): al reservar encolamos un
      correo de confirmación (enviar_en = ahora) y uno de recordatorio
      (enviar_en = inicio - 5 min). Un proceso programado (Supabase Edge
      Function + pg_cron, o un GitHub Action cada minuto) lee las filas
      pendientes con enviar_en <= NOW() y las envía. Ver
      docs/edge-function-notificaciones.md.

   2) ENVÍO INMEDIATO OPCIONAL (EmailJS, lado cliente): si defines
      VITE_EMAILJS_* en .env, la confirmación se manda al instante desde
      el navegador. El recordatorio de 5 min SIEMPRE depende del proceso
      programado (el navegador puede estar cerrado a esa hora).

   Si nada está configurado, las funciones no rompen: solo encolan (o
   registran en consola) para no bloquear la reserva.
   ===================================================================== */

import { db } from './supabase.js';

const uid = () => 'n' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

const fmt = (s) => {
  try { return new Date(s).toLocaleString('es', { weekday: 'long', day: '2-digit', month: 'long', hour: '2-digit', minute: '2-digit' }); }
  catch (e) { return s; }
};

// --- EmailJS (opcional, lado cliente) -------------------------------
const EMAILJS = {
  service: import.meta.env.VITE_EMAILJS_SERVICE,
  template: import.meta.env.VITE_EMAILJS_TEMPLATE,
  key: import.meta.env.VITE_EMAILJS_KEY,
};
const emailjsReady = () => EMAILJS.service && EMAILJS.template && EMAILJS.key;

async function sendViaEmailJS({ email, nombre, asunto, cuerpo }) {
  if (!emailjsReady()) return false;
  try {
    const res = await fetch('https://api.emailjs.com/api/v1.0/email/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        service_id: EMAILJS.service,
        template_id: EMAILJS.template,
        user_id: EMAILJS.key,
        template_params: { to_email: email, to_name: nombre, subject: asunto, message: cuerpo },
      }),
    });
    return res.ok;
  } catch (e) {
    console.error('[notify] EmailJS:', e);
    return false;
  }
}

// --- API pública -----------------------------------------------------

// Encola confirmación (inmediata) + recordatorio (5 min antes). Si EmailJS
// está configurado, además manda la confirmación al instante.
export async function notifyReservaCreada({ reserva, mesaNombre }) {
  const cuandoTxt = fmt(reserva.inicio);
  const conf = {
    id: uid(), reserva_id: reserva.id, email: reserva.email, nombre: reserva.nombre, mesa: reserva.mesa,
    tipo: 'confirmacion',
    asunto: `Reserva confirmada · ${mesaNombre}`,
    cuerpo: `Hola ${reserva.nombre}, tu reserva de ${mesaNombre} para el ${cuandoTxt} quedó registrada. Si no podrás asistir, cancélala desde el laboratorio (Croquis → Reservas).`,
    enviar_en: new Date().toISOString(),
  };
  const recordarEn = new Date(new Date(reserva.inicio).getTime() - 5 * 60000);
  const rec = {
    id: uid(), reserva_id: reserva.id, email: reserva.email, nombre: reserva.nombre, mesa: reserva.mesa,
    tipo: 'recordatorio',
    asunto: `Recordatorio · ${mesaNombre} en 5 minutos`,
    cuerpo: `Hola ${reserva.nombre}, tu reserva de ${mesaNombre} empieza a las ${fmt(reserva.inicio)}. Si no podrás asistir, cancélala para liberar el lugar.`,
    enviar_en: recordarEn.toISOString(),
  };

  // 1) encolar en Supabase (best-effort)
  try { await db.insert('notificaciones', conf); } catch (e) { console.warn('[notify] cola confirmación:', e?.message); }
  try { await db.insert('notificaciones', rec); } catch (e) { console.warn('[notify] cola recordatorio:', e?.message); }

  // 2) envío inmediato de la confirmación (si hay EmailJS)
  const sent = await sendViaEmailJS(conf);
  if (sent) {
    try { await db.patch('notificaciones', 'id', conf.id, { estado: 'enviado', enviado: true, enviado_en: new Date().toISOString() }); } catch (e) {}
  }
  return { queued: true, confirmacionEnviada: sent };
}

// Cancela los correos pendientes de una reserva (al cancelarla).
export async function notifyReservaCancelada(reservaId) {
  try {
    await db.patch('notificaciones', 'reserva_id', reservaId, { estado: 'cancelado' });
  } catch (e) {
    console.warn('[notify] cancelar notifs:', e?.message);
  }
}
