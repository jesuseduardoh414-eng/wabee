import { coreAdapter } from '../modules/core/core.adapter';
import { corePrisma as prisma } from '../config/core/core.prisma';

async function testOnboarding() {
    const timestamp = Date.now();
    const testData = {
        name: 'Test Deferred User',
        email: `test-deferred-${timestamp}@wabee.ai`,
        password: 'password123',
        organizationName: `Test Org ${timestamp}`,
        organizationSlug: `test-org-${timestamp}`,
        acceptTerms: true
    };

    console.log('🚀 Iniciando prueba de onboarding DIFERIDO para:', testData.email);

    try {
        // 1. PASO 1: Registro (Solo Usuario + Guardar "Intención")
        const regResult = await coreAdapter.auth.register(testData as any);
        console.log('✅ Paso 1 (Registro) completado');

        const userId = (regResult as any).user.id;

        // Verificar que NO existe la organización todavía
        const initialOrg = await prisma.organization.findFirst({
            where: { name: testData.organizationName }
        });
        if (initialOrg) throw new Error('❌ Error: La organización se creó prematuramente (antes de verificar)');
        console.log('✅ Confirmado: Organización no existe todavía.');

        // Verificar que los datos están en preferences
        const profileBefore = await prisma.profile.findUnique({ where: { id: userId } });
        if (!(profileBefore?.preferences as any)?.onboarding) throw new Error('❌ No se guardaron los datos de onboarding en preferences');
        console.log('✅ Datos de onboarding guardados correctamente en preferences.');

        // 2. PASO 2: Completar Onboarding (Simula verificación de email)
        console.log('⏳ Simulando verificación de email y completando onboarding...');
        const onboardingResult = await (coreAdapter.auth as any).completeOnboarding(userId, testData.email);
        console.log('✅ Paso 2 (Onboarding) procesado');

        // 3. Verificar resultados finales
        if (!onboardingResult || !onboardingResult.organization) throw new Error('❌ No se devolvieron resultados de la creación de la organización');
        const tenantId = onboardingResult.organization.id;

        // Verificar Organización en DB
        const org = await prisma.organization.findUnique({
            where: { id: tenantId }
        });
        if (!org) throw new Error('❌ La organización no fue creada tras el onboarding');
        console.log('✅ Organización creada con éxito:', org.slug);

        // Verificar Membresía y Rol
        const membership = await prisma.organizationMember.findUnique({
            where: {
                tenantId_userId: {
                    tenantId: tenantId,
                    userId: userId
                }
            },
            include: { role: true }
        });

        if (!membership) throw new Error('❌ No se encontró la membresía');
        console.log('✅ Membresía encontrada con rol:', membership.role?.slug || 'SIN ROL');

        // Verificar limpieza de preferences
        const profileAfter = await prisma.profile.findUnique({ where: { id: userId } });
        if ((profileAfter?.preferences as any)?.onboarding) throw new Error('❌ Las preferencias de onboarding no fueron limpiadas');
        console.log('✅ Preferencias limpiadas correctamente.');

        console.log('✨ Verificación completa del flujo diferido exitosa.');

    } catch (error: any) {
        console.error('❌ Error en la prueba:', error.message);
    } finally {
        await prisma.$disconnect?.();
    }
}

testOnboarding();
