import { env } from '../../../config/env';

async function listGeminiModels() {
    const apiKey = env.GEMINI_API_KEY;
    if (!apiKey) {
        console.error('❌ GEMINI_API_KEY not found in .env');
        return;
    }

    const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;
    console.log(`🔍 Listing models from: ${url.replace(apiKey, 'HIDDEN')}`);

    try {
        const res = await fetch(url);
        const data = await res.json() as any;

        if (!res.ok) {
            console.error('❌ Error listing models:', data);
            return;
        }

        const models = data.models || [];
        console.log(`✅ Found ${models.length} models:`);
        models.forEach((m: any) => {
            console.log(`   - ${m.name} (Supports: ${m.supportedGenerationMethods?.join(', ')})`);
        });

    } catch (err: any) {
        console.error('❌ Fatal error:', err.message);
    }
}

listGeminiModels();
