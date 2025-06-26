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