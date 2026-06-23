/* =====================================================================
   LangContext — Multiidioma (Español / English)
   ---------------------------------------------------------------------
   Diccionario plano por clave. Uso:
     const { t, lang, setLang, toggle } = useLang();
     t('nav.inventory')           -> "Inventario" | "Inventory"
     t('game.coins', { n: 30 })   -> interpolación con {n}
   El idioma se guarda en localStorage ('lab_lang').
   ===================================================================== */

import { createContext, useContext, useState, useCallback, useMemo } from 'react';

const DICT = {
  es: {
    'common.save': 'Guardar', 'common.saving': 'Guardando…', 'common.cancel': 'Cancelar',
    'common.close': 'Cerrar', 'common.add': 'Añadir', 'common.delete': 'Eliminar',
    'common.edit': 'Editar', 'common.back': 'Volver', 'common.search': 'Buscar…',
    'common.all': 'Todos', 'common.none': 'Ninguno', 'common.loading': 'Cargando…',
    'common.login': 'Iniciar sesión', 'common.logout': 'Salir',

    'nav.home': 'Menú principal', 'nav.physical': 'Vista Física', 'nav.inventory': 'Inventario',
    'nav.stats': 'Estadísticas', 'nav.addComp': '+ Agregar componente', 'nav.account': 'Mi cuenta',
    'nav.admin': 'Panel administrador', 'nav.croquis': 'Croquis', 'nav.labstats': '📊 Estadísticas',
    'nav.menu': 'Menú', 'nav.toMenu': 'Ir al menú principal',
    'nav.loans': 'Préstamos', 'nav.audit': 'Auditoría', 'nav.virtualLab': '🎮 Lab virtual',

    'menu.subtitle': 'Selecciona un módulo para empezar.',
    'menu.inventory': 'Inventario', 'menu.inventoryDesc': 'Componentes, vista física y estadísticas del almacén.',
    'menu.croquis': 'Croquis & Ocupación', 'menu.croquisDesc': 'Plano del laboratorio, disponibilidad de lugares y reservas.',
    'menu.farm': 'Granja FPGA', 'menu.farmDesc': 'Acceso a la granja de FPGAs del laboratorio.',
    'menu.farmStat': 'Enlace por configurar',
    'menu.game': 'El laboratorio: EL JUEGO', 'menu.gameDesc': 'Explora el lab con tu avatar, gana monedas, personaliza y responde el quiz. Requiere cuenta y computadora.', 'menu.gameStat': '🎮 Requiere cuenta',
    'menu.comps': '{n} componentes', 'menu.occ': '{a}/{b} ocupados · {n} dentro',
    'menu.admin': 'Panel administrativo', 'menu.adminDesc': 'Acceso al inventario, auditoría, tipos de componente y respaldo del sistema.', 'menu.adminStat': '🛡️ Solo administradores',

    'admin.title': 'Panel administrativo', 'admin.tabUsers': 'Usuarios y registro', 'admin.tabAudit': 'Auditoría',
    'admin.tabTypes': 'Tipos de componente', 'admin.tabBackup': 'Respaldo',

    'account.avatar': 'Mi avatar', 'account.avatarHint': 'Personaliza cómo te ven en el laboratorio virtual. Se guarda en tu perfil.',
    'account.body': 'Cuerpo y rostro', 'account.equipOwned': 'Equipar (lo que ya tienes)', 'account.getMore': 'Consigue más en el OXXO del juego.',

    'croquis.map': 'Plano', 'croquis.reservations': 'Reservas', 'croquis.game': 'Laboratorio virtual',
    'croquis.editPlan': 'Editar plano', 'croquis.exitEdit': 'Salir de edición',

    'game.title': 'El laboratorio: EL JUEGO', 'game.coins': '{n} monedas', 'game.shop': 'Tienda',
    'game.pets': 'Mascotas', 'game.employee': 'Empleado de la semana', 'game.move': 'Muévete con WASD',
    'game.you': 'Tú', 'game.buy': 'Comprar', 'game.owned': 'Adquirido', 'game.equip': 'Equipar', 'game.lounge': 'Descanso',
    'game.equipped': 'Equipado', 'game.notEnough': 'Monedas insuficientes',
    'game.earnHint': 'Ganas 10 monedas por cada 30 min dentro del laboratorio.',
    'game.mustCheckin': 'Haz check-in en una mesa para entrar al laboratorio virtual.',
    'game.noEmployee': 'Aún sin datos esta semana.',
    'game.hoursWeek': '{h} h esta semana',
    'game.desktopOnly': 'El laboratorio virtual solo se juega en computadora o laptop (necesitas teclado para moverte con WASD). Ábrelo desde una compu para entrar.',
    'game.customize': 'Personalizar', 'game.shopHint': 've a la puerta (OXXO) para comprar',
    'game.outfits': 'Ropa', 'game.hats': 'Sombreros', 'game.floors': 'Pisos', 'game.auras': 'Auras',
    'game.free': 'Gratis', 'game.previewHint': 'los cambios se ven al instante',
    'game.hair': 'Pelo', 'game.hairColor': 'Color de pelo', 'game.skin': 'Tono de piel',
    'game.enter': 'Entrar', 'game.enterHint': 'acércate a un módulo y pulsa E para entrar', 'game.myDesk': 'Mi escritorio',
    'game.badgeHint': 'Insignia por monedas gastadas', 'game.newBadge': '¡Nueva insignia: {n}!', 'game.prizeGot': '+{n} 🪙 ¡Empleado de la semana!',
    'game.deco': 'Decoración', 'game.toNext': '{n} 🪙 para {b}', 'game.maxBadge': 'insignia máxima',
    'game.quizTitle': 'Quiz del laboratorio', 'game.answer': 'Responder', 'game.createQ': 'Crear pregunta',
    'game.quizLogin': 'Inicia sesión para participar en el quiz.', 'game.noQuiz': 'No hay preguntas activas. ¡Crea la primera!',
    'game.yourQ': 'Tu pregunta', 'game.gotIt': '✅ ¡Correcto! +{n} 🪙', 'game.wrong': '❌ Respuesta incorrecta',
    'game.byAuthor': 'por {a}', 'game.createHint': '3 opciones, marca la correcta. Vive 24 h y se responde una sola vez por persona.',
    'game.question': 'Pregunta', 'game.markCorrect': 'Marcar como correcta', 'game.option': 'Opción', 'game.reward': 'Premio',
    'game.published': '¡Publicada!', 'game.publish': 'Publicar pregunta', 'game.quizRules': 'No puedes responder tu propia pregunta. La recompensa solo se da una vez.',

    'loan.title': 'Préstamos', 'loan.consumable': 'Consumible', 'loan.loanable': 'Prestable',
    'loan.available': 'Disponible', 'loan.lent': 'Prestado', 'loan.overdue': 'Retrasado',
    'loan.lend': 'Prestar', 'loan.return': 'Devolver', 'loan.lentTo': 'Prestado a',
    'loan.due': 'Devolver antes de', 'loan.history': 'Historial de préstamos',
    'loan.equipment': 'Equipo prestable', 'loan.consumables': 'Consumibles',
    'loan.markLoanable': 'Es equipo prestable (no consumible)',

    'audit.title': 'Auditoría', 'audit.who': 'Quién', 'audit.action': 'Acción',
    'audit.detail': 'Detalle', 'audit.when': 'Cuándo', 'audit.empty': 'Sin registros todavía.',
    'audit.where': 'Dónde', 'audit.recent': 'Recientes (7 d)',
    'audit.all': 'Todas las acciones',
  },
  en: {
    'common.save': 'Save', 'common.saving': 'Saving…', 'common.cancel': 'Cancel',
    'common.close': 'Close', 'common.add': 'Add', 'common.delete': 'Delete',
    'common.edit': 'Edit', 'common.back': 'Back', 'common.search': 'Search…',
    'common.all': 'All', 'common.none': 'None', 'common.loading': 'Loading…',
    'common.login': 'Sign in', 'common.logout': 'Sign out',

    'nav.home': 'Main menu', 'nav.physical': 'Physical view', 'nav.inventory': 'Inventory',
    'nav.stats': 'Statistics', 'nav.addComp': '+ Add component', 'nav.account': 'My account',
    'nav.admin': 'Admin panel', 'nav.croquis': 'Floor plan', 'nav.labstats': '📊 Statistics',
    'nav.menu': 'Menu', 'nav.toMenu': 'Go to main menu',
    'nav.loans': 'Loans', 'nav.audit': 'Audit log', 'nav.virtualLab': '🎮 Virtual lab',

    'menu.subtitle': 'Pick a module to start.',
    'menu.inventory': 'Inventory', 'menu.inventoryDesc': 'Components, physical view and warehouse stats.',
    'menu.croquis': 'Floor plan & Occupancy', 'menu.croquisDesc': 'Lab layout, seat availability and reservations.',
    'menu.farm': 'FPGA Farm', 'menu.farmDesc': 'Access to the lab FPGA farm.',
    'menu.farmStat': 'Link to configure',
    'menu.game': 'The Lab: THE GAME', 'menu.gameDesc': 'Explore the lab with your avatar, earn coins, customize and take the quiz. Requires an account and a computer.', 'menu.gameStat': '🎮 Account required',
    'menu.comps': '{n} components', 'menu.occ': '{a}/{b} occupied · {n} inside',
    'menu.admin': 'Admin panel', 'menu.adminDesc': 'Inventory access, audit log, component types and system backup.', 'menu.adminStat': '🛡️ Admins only',

    'admin.title': 'Admin panel', 'admin.tabUsers': 'Users & log', 'admin.tabAudit': 'Audit log',
    'admin.tabTypes': 'Component types', 'admin.tabBackup': 'Backup',

    'account.avatar': 'My avatar', 'account.avatarHint': 'Customize how others see you in the virtual lab. Saved to your profile.',
    'account.body': 'Body & face', 'account.equipOwned': 'Equip (what you own)', 'account.getMore': 'Get more at the in-game OXXO.',

    'croquis.map': 'Map', 'croquis.reservations': 'Reservations', 'croquis.game': 'Virtual lab',
    'croquis.editPlan': 'Edit plan', 'croquis.exitEdit': 'Exit edit mode',

    'game.title': 'The Lab: THE GAME', 'game.coins': '{n} coins', 'game.shop': 'Shop',
    'game.pets': 'Pets', 'game.employee': 'Employee of the week', 'game.move': 'Move with WASD',
    'game.you': 'You', 'game.buy': 'Buy', 'game.owned': 'Owned', 'game.equip': 'Equip', 'game.lounge': 'Lounge',
    'game.equipped': 'Equipped', 'game.notEnough': 'Not enough coins',
    'game.earnHint': 'Earn 10 coins for every 30 min inside the lab.',
    'game.mustCheckin': 'Check in at a table to enter the virtual lab.',
    'game.noEmployee': 'No data yet this week.',
    'game.hoursWeek': '{h} h this week',
    'game.desktopOnly': 'The virtual lab is playable only on a computer or laptop (you need a keyboard to move with WASD). Open it on a desktop to enter.',
    'game.customize': 'Customize', 'game.shopHint': 'walk to the door (OXXO) to shop',
    'game.outfits': 'Outfits', 'game.hats': 'Hats', 'game.floors': 'Floors', 'game.auras': 'Auras',
    'game.free': 'Free', 'game.previewHint': 'changes apply instantly',
    'game.hair': 'Hair', 'game.hairColor': 'Hair color', 'game.skin': 'Skin tone',
    'game.enter': 'Enter', 'game.enterHint': 'walk up to a module and press E to enter', 'game.myDesk': 'My desk',
    'game.badgeHint': 'Badge by coins spent', 'game.newBadge': 'New badge: {n}!', 'game.prizeGot': '+{n} 🪙 Employee of the week!',
    'game.deco': 'Decoration', 'game.toNext': '{n} 🪙 to {b}', 'game.maxBadge': 'max badge',
    'game.quizTitle': 'Lab quiz', 'game.answer': 'Answer', 'game.createQ': 'Create question',
    'game.quizLogin': 'Sign in to take part in the quiz.', 'game.noQuiz': 'No active questions. Create the first one!',
    'game.yourQ': 'Your question', 'game.gotIt': '✅ Correct! +{n} 🪙', 'game.wrong': '❌ Wrong answer',
    'game.byAuthor': 'by {a}', 'game.createHint': '3 options, mark the correct one. Lives 24 h, one answer per person.',
    'game.question': 'Question', 'game.markCorrect': 'Mark as correct', 'game.option': 'Option', 'game.reward': 'Reward',
    'game.published': 'Published!', 'game.publish': 'Publish question', 'game.quizRules': 'You cannot answer your own question. Reward is granted once.',

    'loan.title': 'Loans', 'loan.consumable': 'Consumable', 'loan.loanable': 'Loanable',
    'loan.available': 'Available', 'loan.lent': 'On loan', 'loan.overdue': 'Overdue',
    'loan.lend': 'Lend', 'loan.return': 'Return', 'loan.lentTo': 'Lent to',
    'loan.due': 'Return before', 'loan.history': 'Loan history',
    'loan.equipment': 'Loanable equipment', 'loan.consumables': 'Consumables',
    'loan.markLoanable': 'This is loanable equipment (not consumable)',

    'audit.title': 'Audit log', 'audit.who': 'Who', 'audit.action': 'Action',
    'audit.detail': 'Detail', 'audit.when': 'When', 'audit.empty': 'No records yet.',
    'audit.where': 'Where', 'audit.recent': 'Recent (7d)',
    'audit.all': 'All actions',
  },
};

const LangContext = createContext(null);
export const useLang = () => useContext(LangContext) || { lang: 'es', t: (k) => k, setLang: () => {}, toggle: () => {} };

export function LangProvider({ children }) {
  const [lang, setLangState] = useState(() => localStorage.getItem('lab_lang') || 'es');

  const setLang = useCallback((l) => {
    setLangState(l);
    try { localStorage.setItem('lab_lang', l); } catch (e) {}
  }, []);

  const toggle = useCallback(() => setLang(lang === 'es' ? 'en' : 'es'), [lang, setLang]);

  const t = useCallback((key, vars) => {
    let s = (DICT[lang] && DICT[lang][key]) || (DICT.es[key]) || key;
    if (vars) for (const k in vars) s = s.replace(new RegExp(`\\{${k}\\}`, 'g'), vars[k]);
    return s;
  }, [lang]);

  const value = useMemo(() => ({ lang, setLang, toggle, t }), [lang, setLang, toggle, t]);
  return <LangContext.Provider value={value}>{children}</LangContext.Provider>;
}
