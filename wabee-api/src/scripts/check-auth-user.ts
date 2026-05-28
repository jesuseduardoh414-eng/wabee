import dotenv from 'dotenv';
dotenv.config();
import { createClient } from '@supabase/supabase-js';

async function checkAuth() {
    const supabaseUrl = process.env.SUPABASE_URL!;
    const supabaseKey = process.env.SUPABASE_SERVICE_KEY!;
    const email = 'reelsprueba1@gmail.com';

    const supabase = createClient(supabaseUrl, supabaseKey);

    try {
        console.log(`--- Verificando Auth para: ${email} ---`);
        const { data, error } = await supabase.auth.admin.listUsers();

        if (error) {
            console.error('Error listando usuarios:', error);
            return;
        }

        const user = data.users.find(u => u.email === email);
        if (!user) {
            console.log('❌ Usuario no encontrado en Supabase Auth.');
        } else {
            console.log('✅ Usuario encontrado en Supabase Auth:');
            console.log({
                id: user.id,
                email: user.email,
                email_confirmed_at: user.email_confirmed_at,
                last_sign_in_at: user.last_sign_in_at,
                created_at: user.created_at,
                banned_until: (user as any).banned_until
            });

            if (!user.email_confirmed_at) {
                console.log('⚠️ Email NO confirmado en Supabase Auth. Intentando confirmar...');
                const { data: updated, error: updateError } = await supabase.auth.admin.updateUserById(user.id, {
                    email_confirm: true
                });
                if (updateError) {
                    console.error('Error confirmando email:', updateError);
                } else {
                    console.log('✅ Email confirmado exitosamente.');
                }
            }
        }
    } catch (e: any) {
        console.error('Error imprevisto:', e.message);
    }
}

checkAuth();
