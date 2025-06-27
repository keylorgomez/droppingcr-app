# 🛒 DroppingCR - E-commerce Full Stack

Proyecto de tienda web desarrollado con:

- 🧠 Backend: Node.js + Express + MongoDB (Atlas)
- 💻 Frontend: React + Vite
- ☁️ Base de datos: MongoDB Atlas
- 🧪 Levantamiento unificado: `concurrently`

---

## 📦 Estructura del proyecto
```
droppingcr-app/
├── api/           # Backend Express
├── frontend/      # Frontend React
├── .gitignore
├── package.json   # Script raíz para levantar ambos entornos
├── LICENSE
└── README.md
```

# 🔧 Cómo levantar el entorno local

## 🚀 Requisitos
- Node.js **v20.x** o superior  
  Verificá en la terminal con: `node -v`
- MongoDB Atlas (configurar archivo `.env` en `/api`)

## ⚙️ Instalación

1. Clonar el repo:
```bash
git clone https://github.com/keylorgomez/droppingcr-app.git
cd droppingcr-app
```

2. Instalar dependencias (Ejecutar los siguientes comandos):
```bash
 npm install               # para instalar concurrently en la raíz
 cd api && npm install     # dependencias del backend
 cd ../frontend && npm install  # dependencias del frontend
 cd ..                     # volver a la raíz
```

3. Crear archivo `.env` dentro de `/api` con la URI de MongoDB.
- Dentro de la carpeta /api, crear un archivo llamado .env con esta estructura (solicitar usuario, contraseña y nombre del Cluster):
```env
MONGO_URI=mongodb+srv://<usuario>:<contraseña>@<cluster>.mongodb.net/tienda?retryWrites=true&w=majority&appName=TuCluster
PORT=5000
```

4. Levantar frontend y backend con un solo comando:
```bash
cd droppingcr-app
npm run dev
```

## Scripts útiles (opcionales):
1. Levantar solo el backend
```bash
cd api
npm run dev
```

2. Levantar solo el frontend
```bash
cd frontend
npm run dev
```


## NOTAS:
- El backend está conectado a MongoDB Atlas.
- El frontend usa Axios y src/api.js para conectarse a la API.
- Recordá no subir .env ni node_modules/ al repositorio. Ya están ignorados por .gitignore.

## 🔌 Puertos por defecto de cada servicio

- Frontend: [http://localhost:5173](http://localhost:5173)
- Backend API: [http://localhost:5000/api](http://localhost:5000/api)


## 🧑‍💻 Guía de uso de Git en este proyecto

Este proyecto sigue la metodología **GitHub Flow** y utiliza una convención clara para nombres de ramas y commits. Aquí encontrarás los pasos, comandos y buenas prácticas para colaborar correctamente.

---

### 🚀 Flujo de trabajo: GitHub Flow

1. La rama principal es `main`.
2. Toda nueva funcionalidad, fix o cambio debe realizarse desde una **nueva rama** creada desde `main`.
3. Se prohíbe hacer `merge` manual a `main`. Usamos `rebase` para mantener el historial limpio.
4. Los cambios deben integrarse mediante **Pull Requests (PR)** que sigan una estructura definida.

---

### 🌿 Nombres de ramas (convención)

Usamos prefijos para el tipo de trabajo seguido por el ID de historia de Linear:

| Tipo           | Prefijo | Ejemplo de rama                         |
|----------------|---------|-----------------------------------------|
| Feature        | `ft/`   | `ft/DRO-21-login-validations`           |
| Fix            | `fx/`   | `fx/DRO-22-fix-header-error`            |
| Refactor       | `rf/`   | `rf/DRO-23-clean-form-component`        |
| Hotfix         | `hot/`  | `hot/DRO-24-crash-on-login`             |
| Chore / config | `ch/`   | `ch/DRO-25-update-eslint-config`        |

---

### 📦 Comandos esenciales de Git

#### 1. Obtener la última versión de `main`
```bash
git checkout main
git pull origin main
```

#### 2. Crear una nueva rama desde `main`
```bash
git checkout -b ft/DRO-XX-nombre-descriptivo
```

#### 3. Verificar en qué rama estás
```bash
git branch
```

#### 4. Agregar archivos al staging
- Solo uno específico:
```bash
git add ruta/al/archivo.js
```

- Todos los archivos modificados:
```bash
git add .
```

#### 5. Hacer un commit con convención
```bash
git commit -m "feat(DRO-21): agregar validación de login"
```

| Tipo común de commit | Ejemplo |
|----------------------|---------|
| feat     | Nueva funcionalidad |
| fix      | Corrección de errores |
| refactor | Reestructuración sin cambiar funcionalidad |
| chore    | Cambios menores (config, build, etc) |

---

### 🧼 Rebase antes de hacer push

#### Siempre hacer `pull --rebase` de main antes de enviar tus cambios:
```bash
git checkout main
git pull origin main
git checkout ft/DRO-XX-nombre
git rebase main
```

#### Si hay conflictos, Git te pedirá resolverlos y continuar:
```bash
git status           # Ver archivos en conflicto
# Edita los archivos, resuelve conflictos
git add archivo-resuelto.js
git rebase --continue
```

---

### 🚫 No usar `git merge`

Usamos `rebase` para mantener un historial limpio y lineal. **No uses `git merge` entre ramas.**

---

### 📤 Enviar tus cambios al repositorio

```bash
git push origin ft/DRO-XX-nombre
```

---

### ✏️ Renombrar una rama (si fue mal nombrada)

```bash
git branch -m nombre-antiguo nuevo-nombre
```

---

### 🔁 Hacer un Pull Request (PR)

1. Abre un PR desde tu rama hacia `main`.
2. El título debe contener el ID de Linear:  
   Ejemplo: `feat: validación de login (DRO-21)`
3. Completa el template de PR con:
   - Descripción del cambio
   - Link a la historia
   - Evidencia (captura, gif, etc.)
4. Se necesitan **2 aprobaciones**, incluyendo la del propietario (`@keylorgomez`).

---

### ✅ Revisión y merge

1. Una vez aprobado, hacé `rebase` de nuevo con `main`:
```bash
git checkout ft/DRO-XX-nombre
git pull origin main --rebase
```
2. Verificá que todo esté funcionando.
3. El equipo puede hacer `Squash and merge` desde el PR.

---

Con esta guía, aseguramos que todos trabajemos bajo una misma estructura clara, ordenada y profesional.