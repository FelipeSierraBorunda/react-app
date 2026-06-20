# Inventario Lab — App React (Vite + Supabase)

Migración del prototipo (un solo HTML) a una app React modular y escalable.
**Supabase se conserva** como backend; solo cambia la organización del front.

---

## ⚡ ACTUALIZAR LA PÁGINA EN LÍNEA (lo más usado)

Cada vez que cambies algo y quieras publicarlo en GitHub Pages:

```bash
cd react-app        # entra a la carpeta del proyecto
npm run deploy      # compila y sube a GitHub Pages
```

Espera 1-2 minutos y recarga la página con **Ctrl + Shift + R**
(para limpiar la caché del navegador).

🔗 Tu página: https://felipesierraborunda.github.io/react-app/

> `npm run deploy` hace dos cosas solo: compila tu código (`npm run build`)
> y sube el resultado a la rama `gh-pages`. No necesitas hacer nada más.

---

## 1. Requisitos

- Node.js 18 o superior (incluye `npm`).

## 2. Arranque rápido

```bash
cd react-app
cp .env.example .env      # pega aquí tu URL y KEY de Supabase
npm install
npm run dev               # abre http://localhost:5173
```

Para compilar a producción:

```bash
npm run build             # genera /dist (estático, súbelo a Vercel/Netlify/etc.)
npm run preview           # previsualiza el build local
```

## 3. Base de datos

El esquema está en `schema.sql` (mismas tablas que el prototipo:
`componentes`, `usuarios`, `transacciones`, `changelog`). Si tu proyecto de
Supabase ya las tiene, **no** lo vuelvas a correr (borra los datos).

---

## 4. Estructura

```
src/
  lib/                  ← lógica pura, sin React (reutilizable y testeable)
    supabase.js           cliente REST (lee credenciales de .env)
    constants.js          contenedores, tipos, colores, helpers
    inventory.js          CRUD de componentes + registro de actividad
    auth.js               registro / login / sesión
  context/              ← estado global vía React Context
    AuthContext.jsx       sesión + modo admin
    InventoryContext.jsx  componentes, transacciones, changelog
  components/           ← piezas de UI reutilizables
    Nav.jsx               barra superior + pestañas (según rol)
    AuthModal.jsx         login / registro
    Placeholder.jsx       marcador de "por migrar"
  views/                ← una pantalla por archivo
    TableView.jsx         ✅ MIGRADA — inventario con filtros/orden/CRUD
    AccountView.jsx       ✅ MIGRADA — perfil, actividad, "convertir en admin"
    VisualView.jsx        ⬜ stub — vista física de contenedores
    ManageView.jsx        ⬜ parcial — alta de componente (funcional, básica)
    StatsView.jsx         ⬜ básica — gráficas por tipo
    AdminPanel.jsx        ⬜ básica — changelog global
  App.jsx               layout + "router" por estado
  theme.js              tokens visuales (colores, botones, tarjetas)
  main.jsx              punto de entrada (envuelve con los Providers)
```

### El patrón (cópialo para migrar el resto)

1. **Datos** entran por un hook de contexto: `useInventory()` / `useAuth()`.
2. **Cálculos** (filtrar, ordenar, agrupar) con `useMemo`.
3. **Acciones** (escribir) llaman a `add/edit/remove/use` del contexto, que
   escriben en Supabase y actualizan el estado de inmediato.
4. La UI nunca habla con Supabase directo — siempre vía `lib/` + contexto.

`TableView.jsx` y `AccountView.jsx` son los moldes completos. Las demás
vistas traen un esqueleto funcional con comentarios `[POR MIGRAR]` indicando
qué falta traer del prototipo.

---

## 5. Próximos pasos sugeridos

- **Roles en BD**: hoy el admin se valida con una contraseña fija
  (`ADMIN_PASSWORD` en `constants.js`). Pásalo a una columna `rol` en
  `usuarios` y valida contra Supabase.
- **Supabase Auth**: reemplaza el hash casero de `auth.js` por
  `supabase.auth.signUp / signInWithPassword` (hashing del lado del servidor).
- **URLs reales**: cambia el switch de `App.jsx` por `react-router-dom`.
- **Realtime**: suscríbete a cambios de `componentes` para multiusuario en vivo.
```
```
El prototipo original (un solo archivo) sigue en la raíz del proyecto por si
necesitas consultar alguna pantalla aún no migrada.
