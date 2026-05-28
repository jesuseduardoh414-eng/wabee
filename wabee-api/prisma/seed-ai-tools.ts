import 'dotenv/config';
import { PrismaClient, HttpMethod, ToolAuthType } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';

const prisma = new PrismaClient();

async function main() {
    // ── PARÁMETROS CONFIGURABLES (O leer de ENV/Args) ──
    const args = process.argv.slice(2);
    const tenantIdArg = args.find(a => a.startsWith('--tenantId='))?.split('=')[1];
    const profileIdArg = args.find(a => a.startsWith('--profileId='))?.split('=')[1];

    if (!tenantIdArg) {
        console.error("❌ Se requiere --tenantId=UUID");
        process.exit(1);
    }

    const tenantId = tenantIdArg;

    console.log(`\n🌱 Iniciando Seed de Herramientas IA (Fase 2A) para Tenant: ${tenantId}`);

    // 1. Validar Tenant
    const tenant = await prisma.organization.findUnique({ where: { id: tenantId } });
    if (!tenant) {
        console.error(`❌ Tenant ${tenantId} no existe.`);
        process.exit(1);
    }

    // 2. Crear o Actualizar Credencial de Prueba (API Pública de Mock)
    const credName = "DummyJSON API";
    const cred = await prisma.integrationCredential.upsert({
        where: { tenantId_name: { tenantId, name: credName } },
        update: {},
        create: {
            tenantId,
            name: credName,
            authType: ToolAuthType.NONE,
            encryptedConfig: {} as any // Sin token real por ahora
        }
    });
    console.log(`✔️ Credencial creada/verificada: ${cred.id} (${credName})`);

    // 3. Crear o Actualizar la Herramienta 'lookupCustomer' (Usaremos DummyJSON user para probar)
    const toolName = "lookupCustomer";
    const tool = await prisma.aiTool.upsert({
        where: { tenantId_name: { tenantId, name: toolName } },
        update: {
            endpointUrl: 'https://dummyjson.com/users/filter',
            method: HttpMethod.GET,
            parametersSchema: {
                type: "object",
                isActive: true
            } as any
        },
        create: {
            tenantId,
            name: toolName,
            displayName: toolName,
            description: "Herramienta de búsqueda de clientes",
            endpointUrl: 'https://dummyjson.com/users/filter',
            method: HttpMethod.GET,
            parametersSchema: {
                type: "object",
                isActive: true
            } as any
        }
    });

    console.log(`✔️ Herramienta creada/actualizada: ${tool.id} (${toolName})`);

    // 4. Asignación a un Perfil si se proporcionó --profileId
    if (profileIdArg) {
        const profile = await prisma.aiProfile.findUnique({
            where: { id: profileIdArg }
        });

        if (profile && profile.tenantId === tenantId) {
            await prisma.aiProfileTool.upsert({
                where: {
                    profileId_toolId: {
                        profileId: profile.id,
                        toolId: tool.id
                    }
                },
                update: { isActive: true },
                create: {
                    tenantId,
                    profileId: profile.id,
                    toolId: tool.id,
                    isActive: true
                }
            });
            console.log(`✔️ Herramienta asignada al perfil: ${profile.id}`);
        } else {
            console.warn(`⚠️ Perfil ${profileIdArg} no existe o no pertenece al tenant. Omitiendo asignación.`);
        }
    }

    console.log("\n✅ Seed Completado.");
    console.log("Puedes probar el ToolExecutorService manualmente con:");
    console.log(`const res = await ToolExecutorService.execute({ toolId: '${tool.id}', tenantId: '${tenantId}', payload: { key: 'email', value: 'emily.johnson@x.dummyjson.com' } });`);
}

main()
    .catch(e => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
