/**
 * Script de diagnóstico para subida de KB
 * Ejecutar: node test-kb-upload.cjs
 */
const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');

// ── CONFIG ───────────────────────────────────────────────────────────────────
const API_BASE = 'http://localhost:4000/v1';
const PROFILE_ID = '62ed9aa9-b6cd-4ea6-924b-480837ddf30b';
const TENANT_ID = 'b3d4e321-ae17-4e57-a6f4-fe0eef09482d';

// Pon aquí un JWT válido (cópialo de localStorage.wabee_token en el browser)
const TOKEN = process.argv[2] || '';

// Archivo de prueba a subir (crea uno temporal si no se pasa)
const TEST_FILE = process.argv[3] || null;

// ─────────────────────────────────────────────────────────────────────────────

function createTestPdf() {
  // Crear un PDF mínimo válido en memoria
  const pdfContent = `%PDF-1.4
1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj
2 0 obj
<< /Type /Pages /Kids [3 0 R] /Count 1 >>
endobj
3 0 obj
<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R >>
endobj
4 0 obj
<< /Length 44 >>
stream
BT /F1 12 Tf 100 700 Td (Test PDF KB) Tj ET
endstream
endobj
xref
0 5
0000000000 65535 f
0000000009 00000 n
0000000058 00000 n
0000000115 00000 n
0000000206 00000 n
trailer
<< /Size 5 /Root 1 0 R >>
startxref
299
%%EOF`;
  const tmpPath = path.join(require('os').tmpdir(), 'test-wabee-kb.pdf');
  fs.writeFileSync(tmpPath, pdfContent);
  return tmpPath;
}

function multipartRequest(url, token, tenantId, filePath, fileName, mimeType) {
  return new Promise((resolve, reject) => {
    const boundary = `----FormBoundary${Date.now()}`;
    const fileContent = fs.readFileSync(filePath);

    const bodyParts = [
      `--${boundary}\r\n`,
      `Content-Disposition: form-data; name="file"; filename="${fileName}"\r\n`,
      `Content-Type: ${mimeType}\r\n`,
      `\r\n`,
    ];

    const bodyStart = Buffer.from(bodyParts.join(''));
    const bodyEnd = Buffer.from(`\r\n--${boundary}--\r\n`);
    const body = Buffer.concat([bodyStart, fileContent, bodyEnd]);

    const urlObj = new URL(url);
    const options = {
      hostname: urlObj.hostname,
      port: urlObj.port || (urlObj.protocol === 'https:' ? 443 : 80),
      path: urlObj.pathname,
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'x-tenant-id': tenantId,
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
        'Content-Length': body.length,
      },
    };

    console.log(`\n[TEST] POST ${url}`);
    console.log(`[TEST] Headers: Content-Type=multipart/form-data, x-tenant-id=${tenantId}`);
    console.log(`[TEST] File: ${fileName} (${mimeType}) ${fileContent.length} bytes`);

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        console.log(`\n[TEST] Response Status: ${res.statusCode}`);
        console.log(`[TEST] Response Body: ${data}`);
        resolve({ status: res.statusCode, body: data });
      });
    });

    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

async function run() {
  if (!TOKEN) {
    console.error('❌ Falta el JWT token. Úsalo así:');
    console.error('   node test-kb-upload.cjs <JWT_TOKEN> [ruta_al_pdf]');
    console.error('\n   Para obtener el token: abre el browser, F12, Application > Local Storage > localhost:5173 > wabee_token');
    process.exit(1);
  }

  const filePath = TEST_FILE || createTestPdf();
  const fileName = path.basename(filePath);
  const mimeType = 'application/pdf';

  console.log(`\n📤 Subiendo KB file...`);
  console.log(`   Perfil: ${PROFILE_ID}`);
  console.log(`   Tenant: ${TENANT_ID}`);
  console.log(`   Archivo: ${filePath}`);

  try {
    const result = await multipartRequest(
      `${API_BASE}/wabee/ai/ai-profiles/${PROFILE_ID}/kb/files`,
      TOKEN,
      TENANT_ID,
      filePath,
      fileName,
      mimeType
    );

    if (result.status === 201 || result.status === 200) {
      console.log('\n✅ UPLOAD EXITOSO');
    } else {
      console.log(`\n❌ UPLOAD FALLÓ (${result.status})`);
    }
  } catch (err) {
    console.error('\n❌ Error de red:', err.message);
  }

  // Cleanup temp file
  if (!TEST_FILE) {
    try { fs.unlinkSync(filePath); } catch {}
  }
}

run();
