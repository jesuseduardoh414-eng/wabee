import dotenv from 'dotenv';
dotenv.config();
import { prisma } from '../config/core/core.prisma';

async function run() {
    const templateName = 'ORG_INVITATION';
    // Nota: El core espera ORG_INVITATION. 
    // Lo crearemos con el contenido adecuado y el link dinámico al frontend local.

    const content = `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #333;">
        <h1 style="color: #121208;">¡Hola {{user_name}}!</h1>
        <p style="font-size: 16px; line-height: 1.5;">
            <strong>{{inviter_name}}</strong> te ha invitado a unirte a la organización 
            <span style="color: #ead018; font-weight: bold;">{{org_name}}</span> en <strong>WABEE</strong>.
        </p>
        <p style="font-size: 16px; line-height: 1.5; margin-bottom: 30px;">
            Al unirte, podrás colaborar con el equipo y gestionar las operaciones de la centralita.
        </p>
        <div style="text-align: center; margin-bottom: 30px;">
            <a href="http://localhost:5173/invitations/accept?token={{token}}" 
               style="background-color: #ead018; color: #121208; padding: 14px 28px; text-decoration: none; border-radius: 12px; font-weight: bold; font-size: 16px; display: inline-block; box-shadow: 0 4px 14px rgba(234,208,24,0.3);">
                Aceptar Invitación
            </a>
        </div>
        <p style="font-size: 14px; color: #666;">
            Este enlace expirará el día {{expires_at}}. Si no esperabas esta invitación, puedes ignorar este correo.
        </p>
        <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
        <p style="font-size: 12px; color: #999; text-align: center;">
            &copy; 2026 WABEE - Producto Cero.
        </p>
    </div>
    `;

    try {
        // Buscar si existe ORG_INVITATION por nombre (y channel email)
        const existing = await (prisma as any).notificationTemplate.findFirst({
            where: { name: templateName, channel: 'email' }
        });

        if (existing) {
            await (prisma as any).notificationTemplate.update({
                where: { id: existing.id },
                data: {
                    content,
                    subject: '¡Te han invitado a unirte a {{org_name}} en WABEE!',
                    isActive: true
                }
            });
            console.log(`✅ Plantilla ${templateName} (ID: ${existing.id}) actualizada.`);
        } else {
            const created = await (prisma as any).notificationTemplate.create({
                data: {
                    name: templateName,
                    subject: '¡Te han invitado a unirte a {{org_name}} en WABEE!',
                    content,
                    channel: 'email',
                    isActive: true
                }
            });
            console.log(`✅ Plantilla ${templateName} creada.`);
        }

        // También borramos la vieja si existe y tiene un nombre distinto (evitar conflicto)
        await (prisma as any).notificationTemplate.deleteMany({
            where: {
                AND: [
                    { name: { contains: 'invitation' } },
                    { name: { not: templateName } }
                ]
            }
        });
        console.log(`✅ Plantilla vieja 'invitation' eliminada.`);

    } catch (error) {
        console.error('❌ Error actualizando plantilla:', error);
    } finally {
        await (prisma as any).$disconnect();
    }
}

run();
