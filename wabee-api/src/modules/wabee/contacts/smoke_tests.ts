import axios from 'axios';

const API_KEY = 'dev_tenant_key_123';
const BASE_URL = 'http://localhost:3000/v1';

const client = axios.create({
    baseURL: BASE_URL,
    headers: { 'x-tenant-key': API_KEY }
});

async function runTests() {
    console.log('🧪 Iniciando pruebas de humo para Módulo B...');

    try {
        // 0. Clean up existing test contact if any
        console.log('0. Limpiando ambiente...');
        try {
            const searchRes = await client.get('/contacts', { params: { search: '527712345678' } });
            if (searchRes.data.items.length > 0) {
                const id = searchRes.data.items[0].id;
                await client.delete(`/contacts/${id}`);
                console.log('🗑️ Contacto previo eliminado');
            }
        } catch (e: any) {
            console.log('⚠️ No se pudo limpiar el ambiente:', e.message);
        }

        // 1. Create Contact
        console.log('\n1. Creando contacto...');
        const createRes = await client.post('/contacts', {
            phone: '527712345678',
            name: 'Test Contact',
            tags: ['test', 'smoke']
        });
        const contactId = createRes.data.id;
        console.log('✅ Contacto creado:', contactId);

        // 2. Add Tags
        console.log('\n2. Agregando tags...');
        await client.post(`/contacts/${contactId}/tags:add`, {
            tags: ['new-tag', 'vip']
        });
        const contactRes = await client.get(`/contacts/${contactId}`);
        console.log('✅ Tags actualizados:', contactRes.data.tags);

        // 3. Lifecycle Update
        console.log('\n3. Actualizando ciclo de vida...');
        await client.patch(`/contacts/${contactId}/lifecycle`, {
            toStatus: 'LEAD',
            source: 'smoke-test'
        });
        console.log('✅ Ciclo de vida actualizado a LEAD');

        // 4. Groups
        console.log('\n4. Gestionando grupos...');
        const groupRes = await client.post('/contacts/groups', {
            name: 'Beta Testers',
            description: 'Group for beta testing'
        });
        const groupId = groupRes.data.id;
        await client.post(`/contacts/groups/${groupId}/contacts:add`, {
            contactIds: [contactId]
        });
        console.log('✅ Grupo creado y contacto asignado');

        // 5. Segments
        console.log('\n5. Creando y ejecutando segmento...');
        const segmentRes = await client.post('/contacts/segments', {
            name: 'VIP Leads',
            filter: {
                lifecycleStatus: ['LEAD'],
                tagsAny: ['vip']
            }
        });
        const segmentId = segmentRes.data.id;
        const execRes = await client.post(`/contacts/segments/${segmentId}/execute`);
        console.log(`✅ Segmento ejecutado. Encontrados: ${execRes.data.total}`);

        console.log('\n🎉 Todas las pruebas de humo pasaron exitosamente.');
    } catch (error: any) {
        console.error('\n❌ Prueba fallida:');
        if (error.response) {
            console.error('Status:', error.response.status);
            console.error('Data:', JSON.stringify(error.response.data, null, 2));
        } else {
            console.error('Message:', error.message);
        }
        process.exit(1);
    }
}

runTests();
