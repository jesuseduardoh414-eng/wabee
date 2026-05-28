import axios from 'axios';

async function testRegister() {
    try {
        console.log('--- Probando registro ---');
        const response = await axios.post('http://localhost:3000/v1/auth/register', {
            name: 'Test Agent',
            email: `test${Date.now()}@example.com`,
            password: 'password123',
            tenantName: 'Test Org'
        });
        console.log('Registro exitoso:', response.data);
    } catch (error: any) {
        if (error.response) {
            console.error('Error de respuesta:', error.response.status, error.response.data);
        } else {
            console.error('Error de conexión:', error.message);
        }
    }
}

testRegister();
