import dotenv from 'dotenv';
dotenv.config();

import { core } from '../config/core/core.infra';

async function testEmail() {
    console.log('Iniciando prueba de envío de correo interceptado...');
    
    try {
        const response = await core.notifications.send({
            to: process.env.TEST_EMAIL || 'test@example.com',
            channel: 'email',
            templateName: 'WELCOME_EMAIL', // Asegúrate de que esta exista en DB como legacy o custom
            data: {
                user_name: 'Raúl',
                org_name: 'Empresa Test',
                link: 'http://localhost:5173/dashboard'
            }
        });
        
        console.log('Resultado del envío:', response);
    } catch (error) {
        console.error('Error enviando correo de prueba:', error);
    }
}

testEmail().then(() => process.exit(0)).catch(() => process.exit(1));
