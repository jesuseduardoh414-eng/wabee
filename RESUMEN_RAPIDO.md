# 📋 Wabee - Resumen Rápido

## 🎯 ¿Qué es Wabee?
Es una plataforma CRM + Comunicaciones que integra WhatsApp, automatización de campañas e IA. Permite gestionar contactos, enviar mensajes masivos y analizar interacciones.

## 🏗️ Arquitectura

### Backend (wabee-api)
- **Framework**: Express.js (Node.js)
- **Lenguaje**: TypeScript
- **Base de datos**: PostgreSQL (Supabase)
- **ORM**: Prisma
- **Puerto**: 4000
- **Autenticación**: JWT
- **Integraciones**: WhatsApp/Meta, Stripe, Gemini AI

### Frontend (wabee-web)
- **Framework**: React 18
- **Build tool**: Vite
- **Estilos**: Tailwind CSS
- **Router**: React Router
- **State**: Zustand + React Query
- **Puerto**: 5173
- **Lenguaje**: TypeScript

---

## 🚀 Guía Rápida de Ejecución

### Requisitos
- Node.js 18+ (recomendado 20 LTS)
- npm 9+
- PostgreSQL 12+ (o Supabase)
- Git

### Instalación (5 minutos)

```bash
# 1. Clonar repo
git clone <repo-url>
cd wabee

# 2. Backend
cd wabee-api
npm install
cp .env.example .env  # Configurar variables

# 3. Frontend
cd ../wabee-web
npm install
```

### Ejecutar en Desarrollo

**Terminal 1 - Backend:**
```bash
cd wabee-api
npm run dev
# http://localhost:4000
```

**Terminal 2 - Frontend:**
```bash
cd wabee-web
npm run dev
# http://localhost:5173
```

---

## 📁 Estructura Principal

```
wabee/
├── wabee-api/           # Backend (Express + TypeScript)
│   ├── src/
│   │   ├── modules/     # Módulos de negocio
│   │   ├── config/      # Configuración
│   │   └── index.ts     # Punto de entrada
│   ├── prisma/          # Esquema y migraciones BD
│   └── .env             # Variables de entorno
│
├── wabee-web/           # Frontend (React + Vite)
│   ├── src/
│   │   ├── components/  # Componentes React
│   │   ├── pages/       # Páginas
│   │   └── store/       # Estado global
│   └── tsconfig.json
│
└── .git/                # Control de versiones
```

---

## 🔧 Comandos Principales

### Backend
```bash
npm run dev              # Desarrollo con hot reload
npm run build           # Compilar TypeScript
npm start               # Producción
npm run prisma:migrate  # Ejecutar migraciones
npm run prisma:studio   # Abrir GUI de BD
```

### Frontend
```bash
npm run dev             # Desarrollo
npm run build           # Build de producción
npm run preview         # Previsualizar build
npm run lint            # Verificar código
```

---

## ⚙️ Variables de Entorno Críticas

| Variable | Valor por defecto |
|----------|------------------|
| DATABASE_URL | PostgreSQL connection string |
| PORT | 4000 |
| CORS_ORIGIN | http://localhost:5173 |
| JWT_SECRET | Tu clave secreta |
| SUPABASE_URL | URL de Supabase |
| GEMINI_API_KEY | Para funciones de IA |

---

## 📊 Módulos Principales

El backend está organizado por módulos:
- **auth** - Autenticación y JWT
- **billing** - Pagos con Stripe
- **wabee** - Funcionalidad principal
  - **contacts** - Gestión de contactos
  - **campaigns** - Campañas de marketing
  - **inbox** - Mensajería WhatsApp
  - **ai** - Integración Gemini
  - **analytics** - Reportes y análisis
  - **webwidget** - Widget para sitios web

---

## 🐛 Troubleshooting Común

| Problema | Solución |
|----------|----------|
| Puerto 4000 en uso | Cambiar PORT en .env o matar proceso |
| Error Prisma "column does not exist" | `npm run prisma:migrate` |
| Cannot find module | Eliminar node_modules y `npm install` |
| Frontend no se conecta | Verificar CORS_ORIGIN en .env |

---

## 📚 Documentación Completa

Abre el archivo: **Analisis_Wabee_Guia_Local.docx**

Contiene:
- ✅ Guía detallada de instalación
- ✅ Configuración completa de variables
- ✅ Descripción de arquitectura
- ✅ Estructura detallada de carpetas
- ✅ Solución de problemas avanzada
- ✅ Próximos pasos para comprender el código

---

## 💡 Próximos Pasos

1. **Ejecutar localmente** siguiendo la guía rápida arriba
2. **Explorar Prisma Studio** para entender la BD
3. **Revisar los módulos** en `src/modules/`
4. **Estudiar la autenticación** JWT en `src/middleware/`
5. **Analizar integraciones** (WhatsApp, Stripe, IA)

---

**Documento generado**: 2026-05-19  
**Proyecto**: Wabee (CRM + Comunicaciones)  
**Versiones**: Node 18+, React 18, TypeScript
