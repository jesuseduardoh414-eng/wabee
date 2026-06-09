// @ts-nocheck
import dotenv from 'dotenv';
import nodemailer from 'nodemailer';

dotenv.config();

/**
 * Prueba de conexión y envío SMTP usando las credenciales del .env.
 *
 * Uso:
 *   npx ts-node src/scripts/test-smtp.ts destino@gmail.com
 *
 * Si no se pasa destino, envía a SMTP_USER (a sí mismo).
 */
async function main() {
    const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM } = process.env;

    if (!SMTP_HOST || !SMTP_PORT || !SMTP_USER || !SMTP_PASS) {
        console.error('❌ Faltan variables SMTP en el .env');
        process.exit(1);
    }

    const to = process.argv[2] || SMTP_USER;
    const port = Number(SMTP_PORT);

    console.log(`→ Host:   ${SMTP_HOST}:${port}`);
    console.log(`→ User:   ${SMTP_USER}`);
    console.log(`→ From:   ${SMTP_FROM}`);
    console.log(`→ To:     ${to}`);
    console.log('');

    const transporter = nodemailer.createTransport({
        host: SMTP_HOST,
        port,
        secure: port === 465, // 465 = SSL, 587 = STARTTLS
        auth: { user: SMTP_USER, pass: SMTP_PASS },
    });

    console.log('Verificando conexión/credenciales...');
    await transporter.verify();
    console.log('✅ Conexión y autenticación OK');

    console.log('Enviando correo de prueba...');
    const info = await transporter.sendMail({
        from: SMTP_FROM,
        to,
        subject: 'Prueba SMTP Wabee ✔',
        text: 'Este es un correo de prueba enviado desde la configuración SMTP de Wabee.',
        html: '<p>Este es un correo de prueba enviado desde la configuración SMTP de <b>Wabee</b>.</p>',
    });

    console.log('✅ Correo enviado. messageId:', info.messageId);
    console.log('   Revisa la bandeja (y la carpeta de spam) de:', to);
}

main().catch((err) => {
    console.error('❌ Error SMTP:', err.message);
    if (err.code) console.error('   code:', err.code);
    if (err.response) console.error('   response:', err.response);
    process.exit(1);
});
