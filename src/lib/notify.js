/* =====================================================================
   notify.js — Notificaciones de reserva con Resend
   ---------------------------------------------------------------------
   Al reservar:
   1) Envía confirmación AL INSTANTE.
   2) Programa recordatorio para 5 minutos ANTES de la reserva (Resend lo
      maneja automáticamente con el parámetro scheduled_at).

   Ambos salen en el mismo momento que el usuario hace la reserva.
   ===================================================================== */

const RESEND_KEY = import.meta.env.VITE_RESEND_KEY;
const RESEND_URL = 'https://api.resend.com/emails';

const fmt = (s) => {
  try {
    return new Date(s).toLocaleString('es', {
      weekday: 'long',
      day: '2-digit',
      month: 'long',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch (e) {
    return s;
  }
};

// Envía un correo vía Resend. Si scheduledAt es una fecha futura, lo programa.
async function sendViaResend({ to, toName, subject, text, scheduledAt }) {
  if (!RESEND_KEY) {
    console.warn('[notify] VITE_RESEND_KEY no configurada');
    return false;
  }

  try {
    const payload = {
      from: 'Lab I&R <onboarding@resend.dev>', // Resend proporciona este email por defecto
      to,
      reply_to: 'noreply@lab-ir.local',
      subject,
      text,
    };

    // Si hay una fecha futura, programa el envío (formato Unix timestamp en segundos)
    if (scheduledAt && new Date(scheduledAt) > new Date()) {
      payload.scheduled_at = Math.floor(new Date(scheduledAt).getTime() / 1000);
    }

    const res = await fetch(RESEND_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const data = await res.json();
    if (!res.ok) {
      console.error('[notify] Resend error:', data);
      return false;
    }
    console.log('[notify] Resend OK:', data.id);
    return true;
  } catch (e) {
    console.error('[notify] Resend fetch:', e);
    return false;
  }
}

// API pública: encola confirmación (inmediata) + recordatorio (5 min antes).
// Ambos se envían en el MISMO MOMENTO de la reserva (uno ya, otro programado).
export async function notifyReservaCreada({ reserva, mesaNombre }) {
  const cuandoTxt = fmt(reserva.inicio);
  const inicioDate = new Date(reserva.inicio);
  const recordarEn = new Date(inicioDate.getTime() - 5 * 60000); // 5 min antes

  const confSubject = `Reserva confirmada · ${mesaNombre}`;
  const confText = `Hola ${reserva.nombre},

Tu reserva de ${mesaNombre} para el ${cuandoTxt} quedó registrada.

Si no podrás asistir, cancélala desde el laboratorio (Croquis → Reservas).

---
Lab I&R`;

  const recSubject = `Recordatorio · ${mesaNombre} en 5 minutos`;
  const recText = `Hola ${reserva.nombre},

Tu reserva de ${mesaNombre} empieza a las ${fmt(reserva.inicio)}.

Si no podrás asistir, cancélala para liberar el lugar.

---
Lab I&R`;

  // 1) Envía confirmación AHORA
  const confOk = await sendViaResend({
    to: reserva.email,
    toName: reserva.nombre,
    subject: confSubject,
    text: confText,
  });

  // 2) Programa recordatorio para 5 min ANTES (Resend lo maneja)
  const recOk = await sendViaResend({
    to: reserva.email,
    toName: reserva.nombre,
    subject: recSubject,
    text: recText,
    scheduledAt: recordarEn.toISOString(),
  });

  return {
    confirmacionEnviada: confOk,
    recordatorioProgramado: recOk,
  };
}

// Cancela los correos programados de una reserva (si es posible).
// Nota: Resend no tiene API para cancelar correos programados aún.
// Si lo necesitas en el futuro, almacena los email IDs en una tabla.
export async function notifyReservaCancelada(reservaId) {
  // Por ahora, solo log. Si Resend añade cancelación, se actualiza aquí.
  console.log('[notify] Reserva cancelada:', reservaId);
}
