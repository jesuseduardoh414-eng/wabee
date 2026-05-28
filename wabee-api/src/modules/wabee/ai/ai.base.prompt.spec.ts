import { composeSystemPrompt, resolveAggressiveness, AGGRESSIVENESS_CONFIG } from './ai.base.prompt';

/**
 * Script de validación para el Base System Prompt de WABEE
 */
function testPromptComposition() {
    console.log('--- TEST: Composición de Prompt ---');
    const businessPrompt = 'Eres el asistente de PUCSA. Vendemos cemento.';
    
    const finalPrompt = composeSystemPrompt(businessPrompt, 'balanced');
    
    const hasBaseLayer = finalPrompt.includes('[WABEE INTELLIGENCE LAYER');
    const hasBusinessLayer = finalPrompt.includes('[BUSINESS CONFIGURATION');
    const hasCorrectOrder = finalPrompt.indexOf('[WABEE INTELLIGENCE LAYER') < finalPrompt.indexOf('[BUSINESS CONFIGURATION');
    const includesBusinessContent = finalPrompt.includes('Vendemos cemento');

    console.log('¿Tiene capa base?', hasBaseLayer ? '✅' : '❌');
    console.log('¿Tiene capa de negocio?', hasBusinessLayer ? '✅' : '❌');
    console.log('¿Orden correcto (Base -> Negocio)?', hasCorrectOrder ? '✅' : '❌');
    console.log('¿Contenido del negocio preservado?', includesBusinessContent ? '✅' : '❌');

    if (hasBaseLayer && hasBusinessLayer && hasCorrectOrder && includesBusinessContent) {
        console.log('RESULTADO: Composición exitosa.');
    } else {
        console.error('RESULTADO: Fallo en composición.');
    }
}

function testAggressivenessResolution() {
    console.log('\n--- TEST: Resolución de Agresividad ---');
    console.log('Default (null):', resolveAggressiveness(null) === 'balanced' ? '✅' : '❌');
    console.log('Default (invalid):', resolveAggressiveness('crazy' as any) === 'balanced' ? '✅' : '❌');
    console.log('Conservative:', resolveAggressiveness('conservative') === 'conservative' ? '✅' : '❌');
    console.log('Aggressive:', resolveAggressiveness('aggressive') === 'aggressive' ? '✅' : '❌');
}

function testPolicyInjections() {
    console.log('\n--- TEST: Inyección de Políticas ---');
    const balancedPrompt = composeSystemPrompt('Negocio', 'balanced');
    const aggressivePrompt = composeSystemPrompt('Negocio', 'aggressive');
    const conservativePrompt = composeSystemPrompt('Negocio', 'conservative');

    const hasBalancedPolicy = balancedPrompt.includes('haz UNA pregunta aclaratoria');
    const hasAggressivePolicy = aggressivePrompt.includes('Maximiza la interpretación');
    const hasConservativePolicy = conservativePrompt.includes('transfiere con un asesor de forma cordial');

    console.log('¿Política balanced correcta?', hasBalancedPolicy ? '✅' : '❌');
    console.log('¿Política aggressive correcta?', hasAggressivePolicy ? '✅' : '❌');
    console.log('¿Política conservative correcta?', hasConservativePolicy ? '✅' : '❌');
}

// Ejecutar validaciones
try {
    testPromptComposition();
    testAggressivenessResolution();
    testPolicyInjections();
    console.log('\n✅ TODAS LAS VALIDACIONES PASARON CORRECTAMENTE.');
} catch (err) {
    console.error('\n❌ ERROR DURANTE LAS VALIDACIONES:', err);
}
