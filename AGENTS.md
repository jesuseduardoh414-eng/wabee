# Reglas del proyecto Wabee

## Base de datos — regla fundamental

El proyecto usa **una sola base de datos PostgreSQL (Supabase)** con dos schemas separados:

| Schema | Dueño | Cliente Prisma |
|--------|-------|---------------|
| `core` | Paquete `@r4d-26/core` | `corePrisma` — solo para `CoreInternalService` |
| `wabee` | Este repositorio | `prisma` — uso libre en el código |

**Si necesitas cambiar o agregar tablas/columnas: edita únicamente `wabee-api/prisma/schema.prisma`.**

```bash
# Flujo para cambios de base de datos
npx prisma migrate dev --name descripcion_del_cambio
```

## Lo que NO se debe tocar

- `src/modules/core/generated/` — código auto-generado, se sobreescribe solo
- `node_modules/@r4d-26/core/` — paquete externo, nunca modificar
- `corePrisma` — reservado exclusivamente para `CoreInternalService`

## Lo que SÍ se puede cambiar libremente

- `wabee-api/prisma/schema.prisma` — modelos propios de Wabee
- Cualquier archivo fuera de `src/modules/core/generated/`
- El cliente `prisma` (schema `wabee`) en cualquier servicio

## Acceso al Core

Para leer o escribir datos del core (usuarios, organizaciones, roles, etc.) **nunca accedas a `corePrisma` directamente**. Usa siempre:

1. **`CoreInternalService`** — métodos estáticos tipados para lectura/escritura directa
2. **`coreAdapter`** — orquestador para operaciones de negocio (auth, invitaciones, etc.)

```typescript
// Correcto
import { CoreInternalService } from '../core/core.internal.service';
const profile = await CoreInternalService.getProfileById(userId);

// Correcto
import { coreAdapter } from '../core/core.adapter';
await coreAdapter.organizations.inviteMember(orgId, email, role, actorId);

// INCORRECTO — no hagas esto fuera de CoreInternalService
import { corePrisma } from '../../config/core/core.prisma';
const profile = await corePrisma.profile.findUnique(...);
```
