import dotenv from 'dotenv';
dotenv.config();
import { createClient } from '@supabase/supabase-js';

async function resetPassword() {
    const supabaseUrl = process.env.SUPABASE_URL!;
    const supabaseKey = process.env.SUPABASE_SERVICE_KEY!;
    const email = 'reelsprueba1@gmail.com';
    const newPassword = 'WABEE123!'; // Contraseña temporal

    const supabase = createClient(supabaseUrl, supabaseKey);

    try {
        console.log(`--- Reseteando Contraseña para: ${email} ---`);
        const { data: users, error: listError } = await supabase.auth.admin.listUsers();

        if (listError) throw listError;

        const user = users.users.find(u => u.email === email);
        if (!user) {
            console.log('❌ Usuario no encontrado.');
            return;
        }

        const { data, error } = await supabase.auth.admin.updateUserById(user.id, {
            password: newPassword
        });

        if (error) {
            console.error('Error al resetear contraseña:', error.message);
        } else {
            console.log('✅ Contraseña reseteada exitosamente a:', newPassword);
            console.log('Por favor, indica al usuario que intente loguear con esta nueva contraseña.');
        }
    } catch (e: any) {
        console.error('Error imprevisto:', e.message);
    }
}

resetPassword();
