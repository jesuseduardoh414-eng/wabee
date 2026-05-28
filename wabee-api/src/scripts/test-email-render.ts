/**
 * Script de prueba de renderizado de correos personalizados.
 * NO requiere SMTP ni conexión de red. Genera archivos HTML locales
 * que se pueden abrir en el navegador para verificar el diseño.
 *
 * Uso:
 *   npx ts-node -e "require('./src/scripts/test-email-render.ts')"
 *   o bien: npx tsx src/scripts/test-email-render.ts
 */

import * as fs from 'fs';
import * as path from 'path';

// ─── Importar servicios de renderizado directamente (sin DB) ─────────────────
import { EmailTemplateRendererService } from '../modules/wabee/email-customization/email-template-renderer.service';
import type { EmailGlobalConfig } from '../modules/wabee/email-customization/email-branding.service';

// ─── Config de Branding de prueba (simula lo que Devolvería la DB) ────────────
const MOCK_BRANDING_DEFAULT: EmailGlobalConfig = {
    identidad: {
        brandName: 'WABEE',
        senderName: 'Notificaciones WABEE',
        supportEmail: 'soporte@wabee.app',
        brandLogo: undefined,
        globalFooter: '© {{current_year}} WABEE. Todos los derechos reservados.',
    },
    layout: {
        bg: '#F8FAFC',
        card: '#FFFFFF',
        border: '#E2E8F0',
        buttonBg: '#2563EB',
        buttonText: '#FFFFFF',
        subjectLabel: '#64748B',
    },
    texts: {
        title: { color: '#0F172A', font: 'Inter' },
        paragraph: { color: '#334155', font: 'Inter' },
        button: { color: '#FFFFFF', font: 'Inter' },
        footer: { color: '#64748B', font: 'Inter' },
    },
};

const MOCK_BRANDING_CUSTOM: EmailGlobalConfig = {
    identidad: {
        brandName: 'MiEmpresa Corp',
        senderName: 'Tech MiEmpresa',
        supportEmail: 'soporte@miempresa.com',
        brandLogo: 'https://via.placeholder.com/200x50/6366F1/FFFFFF?text=MiEmpresa',
        globalFooter: '© {{current_year}} MiEmpresa Corp. Aviso de privacidad.',
    },
    layout: {
        bg: '#0F0F1A',
        card: '#1A1A2E',
        border: '#2D2D4A',
        buttonBg: '#6366F1',
        buttonText: '#FFFFFF',
        subjectLabel: '#94A3B8',
    },
    texts: {
        title: { color: '#F8FAFC', font: 'Poppins' },
        paragraph: { color: '#CBD5E1', font: 'Inter' },
        button: { color: '#FFFFFF', font: 'Poppins' },
        footer: { color: '#64748B', font: 'Inter' },
    },
};

// ─── Casos de prueba ──────────────────────────────────────────────────────────
interface TestCase {
    name: string;
    branding: EmailGlobalConfig;
    templateContent: {
        body: string;
        title?: string;
        cta?: string;
        footer?: string;
    };
    dynamicData: Record<string, any>;
}

const testCases: TestCase[] = [
    {
        name: '01_password_reset_default_branding',
        branding: MOCK_BRANDING_DEFAULT,
        templateContent: {
            title: 'Restablece tu contraseña',
            body: '<p>Hola <strong>{{user_name}}</strong>,</p><p>Recibimos una solicitud para restablecer la contraseña de tu cuenta en <strong>{{brand_name}}</strong>.</p><p>Si no fuiste tú, puedes ignorar este correo con seguridad.</p>',
            cta: 'Restablecer Contraseña',
            footer: 'Este enlace expirará en 2 horas.',
        },
        dynamicData: {
            user_name: 'Raúl Crescencio',
            link: 'http://localhost:5173/reset-password?token=abc123test',
        },
    },
    {
        name: '02_invitation_custom_branding',
        branding: MOCK_BRANDING_CUSTOM,
        templateContent: {
            title: 'Te han invitado a {{org_name}}',
            body: '<p>Hola <strong>{{user_name}}</strong>,</p><p><strong>{{inviter_name}}</strong> te ha invitado a unirte a la plataforma de <strong>{{org_name}}</strong> como <strong>{{role}}</strong>.</p><p>Haz clic en el botón para aceptar la invitación.</p>',
            cta: 'Aceptar Invitación',
        },
        dynamicData: {
            user_name: 'Carlos García',
            inviter_name: 'María López',
            org_name: 'MiEmpresa Corp',
            role: 'Agente',
            link: 'http://localhost:5173/invitations/accept?token=xyz789test',
        },
    },
    {
        name: '03_welcome_with_logo',
        branding: MOCK_BRANDING_CUSTOM,
        templateContent: {
            title: '¡Bienvenido a {{brand_name}}!',
            body: '<p>Hola <strong>{{user_name}}</strong>,</p><p>Tu cuenta ha sido creada exitosamente. Ya puedes comenzar a usar todas las funcionalidades de la plataforma.</p><ul><li>📥 Gestiona tu bandeja de entrada unificada</li><li>📋 Administra contactos y equipos</li><li>🤖 Activa agentes con IA</li></ul>',
            cta: 'Ir al Dashboard',
        },
        dynamicData: {
            user_name: 'Nuevo Usuario',
            link: 'http://localhost:5173/dashboard',
        },
    },
    {
        name: '04_no_cta_simple_notification',
        branding: MOCK_BRANDING_DEFAULT,
        templateContent: {
            title: 'Notificación del Sistema',
            body: '<p>Este es un correo de notificación automática.</p><p>Tu organización <strong>{{org_name}}</strong> ha sido actualizada con los nuevos parámetros del plan.</p>',
        },
        dynamicData: {
            org_name: 'Empresa Demo',
        },
    },
];

// ─── Ejecutar pruebas ─────────────────────────────────────────────────────────
async function runRenderTests() {
    const outputDir = path.resolve(__dirname, '../../test-email-renders');
    
    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
    }

    console.log('');
    console.log('╔══════════════════════════════════════════════════════════════╗');
    console.log('║         WABEE - Motor de Correos Personalizados              ║');
    console.log('║                  Test de Renderizado                         ║');
    console.log('╚══════════════════════════════════════════════════════════════╝');
    console.log('');

    let passed = 0;
    let failed = 0;

    for (const testCase of testCases) {
        try {
            // Verificar interpolación de variables
            const interpolatedTitle = testCase.templateContent.title
                ? EmailTemplateRendererService.interpolate(testCase.templateContent.title, {
                    ...testCase.dynamicData,
                    current_year: new Date().getFullYear().toString(),
                    brand_name: testCase.branding.identidad.brandName,
                  })
                : '';

            // Renderizar HTML completo
            const { html } = EmailTemplateRendererService.render(
                testCase.branding,
                {
                    code: testCase.name,
                    subject: testCase.templateContent.title || 'Notificación del sistema',
                    ...testCase.templateContent
                },
                testCase.dynamicData
            );

            // Guardar archivo HTML
            const filePath = path.join(outputDir, `${testCase.name}.html`);
            fs.writeFileSync(filePath, html, 'utf8');

            // Verificaciones básicas de integridad del output
            const checks = [
                { name: 'DOCTYPE presente', pass: html.includes('<!DOCTYPE html>') },
                { name: 'Brand name presente', pass: html.includes(testCase.branding.identidad.brandName) },
                { name: 'Color de fondo aplicado', pass: html.includes(testCase.branding.layout.bg) },
                { name: 'Color del botón aplicado', pass: html.includes(testCase.branding.layout.buttonBg) },
                {
                    name: 'Variables interpoladas (no se deben ver {{}})',
                    pass: !html.match(/\{\{[^}]+\}\}/)
                },
                {
                    name: 'Logo o nombre de marca renderizado',
                    pass: (testCase.branding.identidad.brandLogo
                        ? html.includes(`<img src="${testCase.branding.identidad.brandLogo}"`)
                        : html.includes(`<h2`) && html.includes(testCase.branding.identidad.brandName))
                },
            ];

            const allPassed = checks.every(c => c.pass);

            if (allPassed) {
                passed++;
                console.log(`✅ PASS: ${testCase.name}`);
            } else {
                failed++;
                console.log(`❌ FAIL: ${testCase.name}`);
                checks.filter(c => !c.pass).forEach(c => {
                    console.log(`   └── ✗ ${c.name}`);
                });
            }

            console.log(`   📄 Archivo: ${filePath}`);

            // Verificar interpolación del título
            if (testCase.templateContent.title) {
                const hasVariables = /\{\{[^}]+\}\}/.test(interpolatedTitle);
                if (hasVariables) {
                    console.log(`   ⚠️  Advertencia: el título aún contiene variables sin resolver: "${interpolatedTitle}"`);
                } else {
                    console.log(`   📝 Título: "${interpolatedTitle}"`);
                }
            }
            console.log('');

        } catch (err: any) {
            failed++;
            console.log(`❌ ERROR: ${testCase.name}`);
            console.log(`   └── ${err.message}`);
            console.log('');
        }
    }

    // ── Resumen ───────────────────────────────────────────────────────────────
    console.log('──────────────────────────────────────────────────────────────');
    console.log(`📊 Resultados: ${passed} pasados / ${testCases.length} total`);

    if (failed === 0) {
        console.log('✅ Todos los renders completados exitosamente.');
        console.log(`📂 Archivos HTML generados en: ${outputDir}`);
        console.log('   Abre los archivos .html en tu navegador para revisar el diseño.');
    } else {
        console.log(`⚠️  ${failed} prueba(s) fallaron. Revisa los errores de arriba.`);
        process.exit(1);
    }

    console.log('');
}

runRenderTests().catch((err) => {
    console.error('Error crítico en test-email-render:', err);
    process.exit(1);
});
