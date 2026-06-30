# Wabee — Planes y Estrategia de Precios (v2)

> **Versión 2.0 — 26 de junio de 2026.** Adaptación técnica de la v1 (`Wabee_Planes_y_Estrategia_de_Precios.docx`).
> Esta versión reconcilia los planes con lo que el sistema **realmente mide y cobra**, blinda el
> excedente contra el tipo de cambio e incluye la comisión de Stripe en el margen.
> Fuente de verdad de los límites: `planTemplate.limits` / `plan_versions.limits_json` en el **Core**.
> Wabee · wabee.website · soporte@wabee.app

---

## 1. Resumen ejecutivo

Wabee es una plataforma de marketing conversacional (WhatsApp + Web), CRM ligero, automatización e IA.
La estructura de precios se construye desde el **costo real de operación** y se posiciona frente a la
competencia directa (Respond.io, Wati, ManyChat, Cliengo).

**Modelo:** 4 niveles (Free, Starter, Pro, Business) con **cupo de plantillas incluido + excedente**.
El costo variable normal (mensajes de WhatsApp dentro de ventana de 24 h) es gratis o lo absorbe el
cupo; las **campañas masivas de marketing las paga el cliente vía excedente**, protegiendo el margen.

Precios en **MXN/mes, sin IVA**. Tipo de cambio de referencia: **18 MXN/USD** (Banxico ~17.80 a jun-2026;
se usa 18 como colchón porque los costos de Meta y Gemini son en USD).

> **Facturación únicamente MENSUAL (sin plan anual).** En el panel se captura solo el Precio Mensual;
> el Precio Anual se deja en `0`.

---

## 2. Filosofía de precios

**2.1 El costo se dispara solo con campañas de marketing.** Sin campañas masivas, servir a una cuenta
cuesta ~$15–$255 MXN de variable al mes (IA y correo son centavos; las invitaciones, ~$0). El gasto
explota únicamente con campañas de marketing por WhatsApp (una campaña de 5,000 plantillas de marketing
≈ **$2,600 MXN** de costo Meta). Ese costo no puede vivir en el precio base.

**2.2 Cupo + excedente: la campaña la paga el cliente.** Cada plan incluye un cupo de plantillas
iniciadas/mes. Al superarlo se cobra un excedente por plantilla **fijado por encima de la tarifa de Meta**.
Así, una campaña grande cubre su propio costo y deja margen, sin destruir la rentabilidad.

**2.3 El costo fijo baja con la escala.** Hoy, con pocas cuentas, el mayor gasto por usuario es el
**costo fijo prorrateado** (~$360 MXN/cuenta con ~4–5 cuentas), no el uso. Con 20+ cuentas baja a <$90 MXN.
El margen real **mejora con cada cliente nuevo**.

**2.4 La IA es casi gratis; el cupo de IA es un guardia anti-abuso, no un costo.** Un mensaje de IA
(Gemini 2.5 Flash) cuesta ~$0.0002 USD. Por eso los cupos de IA son **generosos**: su única función es
frenar abuso, no recuperar costo. Conviene que el cliente **nunca** los toque en uso normal.

---

## 3. Planes y precios

| Característica | **Free** (prueba) | **Starter** | **Pro** | **Business** |
|---|---|---|---|---|
| **Precio MXN / mes** | $0 | **$749** | **$1,799** | **$4,499** |
| Equivalente USD (÷18) | $0 | ~$42 | ~$100 | ~$250 |
| Canales WhatsApp | 1 | 1 | 3 | 10 |
| Contactos | 50 | 1,000 | 5,000 | 25,000 |
| Miembros del equipo | 1 | 3 | 10 | 25 |
| Agentes IA (perfiles) | 1 | 2 | 5 | Ilimitados |
| Automatizaciones (flujos) | 1 | 5 | 25 | Ilimitadas |
| Campañas / mes | — | 2 | 10 | Ilimitadas |
| Widgets web | 1 | 1 | 3 | 10 |
| Entrenamiento de IA (fuentes) | 1 (demo) | 3 | 10 | Ilimitado |
| **Plantillas incluidas / mes** | 1 (demo) | 100 | 500 | 2,000 |
| **Excedente por plantilla (MXN)** | — (bloqueado) | $0.95 | $0.79 | $0.65 |
| **Mensajes de IA / mes** *(cupo anti-abuso)* | 10 (demo) | 3,000 | 15,000 | 60,000 |
| Storage media | 256 MB | 5 GB | 20 GB | 100 GB |
| Integraciones CRM | — | — | Sí | Sí |
| Marketplace | Ver | Instalar | Instalar + publicar | Completo |
| Auditoría | — | — | — | Sí |
| Soporte | Comunidad | Email | Email prioritario | Prioritario + onboarding |

> **Cambios vs v1:** cupos de IA subidos (1k/5k/20k → 3k/15k/60k) para que el perfil real no los toque;
> excedente Pro $0.75→$0.79 y Business $0.55→$0.65 por seguridad cambiaria (ver §6).

---

## 4. Detalle de cada plan

**4.1 Free — captación.** No es un plan operativo: es una demo para conocer la plataforma. Permite **1
plantilla**, la IA responde hasta **10 mensajes** y se entrena con **1 fuente**. Limita a 1 canal y 50
contactos. Su costo es casi puro fijo; su objetivo es demostrar valor y convertir.

**4.2 Starter — $749/mes (negocio chico).** Cubre el perfil ligero: un canal, automatizaciones básicas e
IA. Costo de servir ~$405 MXN, **margen ~46%**. Excedente alto ($0.95) porque a este volumen las campañas
son la excepción.

**4.3 Pro — $1,799/mes (en crecimiento).** Varios canales y equipo. Perfil medio. Costo de servir ~$500
MXN, **margen ~72%**. Incluye integraciones CRM y publicación en Marketplace.

**4.4 Business — $4,499/mes (alto volumen).** Operaciones grandes con campañas frecuentes. Costo base
(sin campañas masivas) ~$780 MXN, **margen ~83%**. Cupo amplio (2,000 plantillas) y el menor excedente
($0.65, con piso seguro) para clientes de mucho envío.

---

## 5. Costos y márgenes

Costo real de servir vs precio (MXN/mes, **uso típico sin campañas masivas**, ya **incluyendo Stripe**).
El "costo de servir" usa el consumo **típico** del perfil, no el cupo máximo (el cupo solo es guardia).

| Plan | Precio | Fijo prorrateado | Variable (IA + plantillas + correo) | Stripe (3.6% + $3) | **Costo total** | **Margen** |
|---|---|---|---|---|---|---|
| Free | $0 | ~$360 | ~$1 | $0 | **~$361** | Demo / adquisición |
| Starter | $749 | ~$360 | ~$15 | ~$30 | **~$405** | **~46%** |
| Pro | $1,799 | ~$360 | ~$72 | ~$68 | **~$500** | **~72%** |
| Business | $4,499 | ~$360 | ~$255 | ~$165 | **~$780** | **~83%** |

**Notas de costo:**
- **Fijo (~$360/cuenta)** asume ~4–5 cuentas. Componentes (USD/mes): Supabase Pro $25, Render $7–25,
  Redis $0–10, correo (SES) ~$0, dominio ~$1.5. Total ~$40–80 USD → ÷ cuentas × 18. **Baja con escala.**
- **IA** a ~$0.0002 USD/mensaje (Gemini 2.5 Flash, sin thinking). Despreciable.
- **Plantillas incluidas** costeadas a tarifa Utilidad (~$0.008 USD). El marketing va por excedente.
- **Stripe México:** 3.6% + $3 MXN por cargo (tarjeta nacional). Si cobras en USD/tarjeta extranjera, ajustar.
- **No incluye IVA.** Se agrega en factura.

El detalle itemizado y el simulador editable viven en `Wabee_Modelo_Precios.xlsx`
(hojas *Costo por perfil*, *Márgenes*, *Simulador excedentes*).

---

## 6. Política de plantillas incluidas y excedentes

**Tarifas Meta WhatsApp México 2025** (por plantilla iniciada): Servicio **gratis**, Utilidad ~$0.008 USD,
Autenticación ~$0.0135 USD, **Marketing ~$0.029 USD** (≈ **$0.52 MXN** a 18 MXN/USD). El servicio dentro
de la ventana de 24 h abierta por el cliente es gratis e ilimitado.

**Regla de oro del excedente:** nunca por debajo de
`tarifa_marketing_MXN × 1.25` (colchón de FX + margen). Con tarifa $0.52 MXN → **piso ≈ $0.65 MXN**.
Por eso Business se fija en $0.65 (no $0.55): a $0.55 el margen era ~5% y **quedaba bajo agua** si Meta
subía o el peso pasaba de ~19 MXN/USD.

| Plan | Excedente | Margen sobre costo Meta |
|---|---|---|
| Starter | $0.95 | ~45% |
| Pro | $0.79 | ~34% |
| Business | $0.65 | ~20% (piso seguro) |

**Ejemplo (Business, campaña de 5,000 plantillas de marketing):** incluidas 2,000, excedente 3,000.
Cobro: 3,000 × $0.65 = **$1,950 MXN**. Costo Meta del excedente: ~$1,566 MXN. **Ganancia neta ~$384 MXN.**
La campaña se paga sola y deja margen real (vs ~$84 MXN con el $0.55 de la v1).

> ⚠️ **El excedente NO es un centro de utilidad**, es protección de margen. La ganancia del negocio está
> en la suscripción base, no en las campañas. No diseñar promesas comerciales sobre el excedente.

**Free no permite excedente:** al llegar a 1 plantilla se bloquea el envío proactivo (HTTP 402).

---

## 7. Comparativa con la competencia (junio 2026)

| Plataforma | Rango (USD/mes) | Modelo de cobro |
|---|---|---|
| Respond.io | $79 – $279 | Por contactos activos (MAC) + mensajes aparte |
| Wati | $59 – $279 | Suscripción + mensajes +20% sobre Meta + add-ons |
| ManyChat | Free – $69 | Por contactos + add-on de IA + fees de WhatsApp |
| Cliengo | $24 – $300 | Por conversaciones/agentes + WhatsApp API |
| **Wabee** | **~$42 – $250** | **Cupo de plantillas + excedente (la campaña la paga el cliente)** |

Wabee queda **competitivo** en el rango del mercado, con una ventaja clara: el costo de campañas se
**traslada de forma transparente** al cliente, en vez de inflar el precio base o esconderse en un recargo
sobre Meta (como Wati +20%).

---

## 8. Estado de implementación (qué falta para activar el modelo)

El producto **ya mide y limita por código** (`LimitsService`): canales, contactos, agentes IA,
campañas/mes, miembros (incluye invitaciones), storage, y feature flags por módulo. Faltan **dos
medidores** para poder facturar cupo + excedente:

1. **Mensajes de IA por periodo** — contador mensual para limitar/medir el consumo de Gemini.
2. **Plantillas iniciadas por periodo** — contador con cupo incluido y cálculo de excedente facturable.

Diseño técnico detallado (modelos Prisma `BillingUsageEvent` / `BillingMonthlyUsage`, `UsageMeterService`,
puntos de enganche): ver `Documentacion/Diseno_Facturacion_IA_y_Plantillas.md`.

**Pendientes para que esto sea operable (orden sugerido):**
1. Crear los 2 medidores + `UsageMeterService` y correr la migración (`schema.prisma`, schema `wabee`).
2. **Reescribir `seed-plans.ts`** con estos 4 planes y las claves nuevas (hoy siembra 3 planes viejos:
   FREE / Básico $2,500 / Crecimiento $3,000 — **no coinciden con este documento**).
3. Enganchar el conteo en `ai.audit.service.ts`, `campaign.worker.ts` y `whatsapp.outbound.service.ts`.
4. Quota-guard para `aiMessagesPerMonth` (handoff al agotar) y `templatesIncludedPerMonth` (bloqueo/excedente).
5. Job de cierre de periodo que reporte el excedente a Stripe (metered / cargo al renovar).

### 8.1 Claves de límites canónicas por plan (para `seed-plans.ts` / `limits_json`)

| Clave (`limits`) | Free | Starter | Pro | Business |
|---|---|---|---|---|
| `users` | 1 | 3 | 10 | 25 |
| `channels` | 1 | 1 | 3 | 10 |
| `contacts` | 50 | 1000 | 5000 | 25000 |
| `aiProfiles` | 1 | 2 | 5 | -1 |
| `automations` | 1 | 5 | 25 | -1 |
| `campaignsPerMonth` | 0 | 2 | 10 | -1 |
| `webWidgets` | 1 | 1 | 3 | 10 |
| `storageMb` | 256 | 5120 | 20480 | 102400 |
| `aiTrainingSources` | 1 | 3 | 10 | -1 |
| `aiMessagesPerMonth` | 10 | 3000 | 15000 | 60000 |
| `templatesIncludedPerMonth` | 1 | 100 | 500 | 2000 |
| `templateOveragePriceMxn` | 0 | 0.95 | 0.79 | 0.65 |

> Convención del código: `-1` = ilimitado; `0`/ausente = bloqueado (`LimitsService.check`).
> Módulos (`modules_json`): Free y Starter activan inbox/contactos/plantillas/IA/widgets; Pro y Business
> suman `integrationsTools`/CRM; Business suma `audit`.

---

## 9. Notas y consideraciones

- **Verificar el caveat de IA de Meta:** confirmar en el Billing Hub si el beneficio de conversaciones de
  **servicio gratis** se pierde al activar IA en el número. Si los entrantes empiezan a costar, recalcular
  el costo variable de todos los planes.
- **Tipo de cambio:** Meta y Gemini cobran en USD. Revisar el FX trimestralmente y ajustar el excedente con
  la regla de §6 si el peso se deprecia.
- **Validar la relación conversación → mensajes de IA** con datos reales antes de cerrar los cupos de IA
  (una conversación = varios turnos). Los cupos actuales se fijaron generosos para evitar handoffs.
- **Revisión trimestral:** costos reales vs supuestos; recalibrar cupos y excedentes.
- **IVA:** todos los precios son sin impuesto.
- Las cifras de competencia son de referencia pública a junio 2026 y pueden cambiar.
