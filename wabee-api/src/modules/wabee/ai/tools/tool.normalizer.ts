/**
 * ToolResponseNormalizer — Normalizador de respuestas de APIs externas.
 * Convierte cualquier JSON raw en una estructura estandarizada para el LLM.
 * 
 * Soporta campos genéricos de negocio (no limitado a name/price/description/status).
 */

// Campos comunes de negocio — genérico para cualquier tipo de empresa
export interface NormalizedFieldMapping {
    // Identidad
    id?: string;
    // Presentación
    name?: string;
    title?: string;
    subtitle?: string;
    description?: string;
    // Comercial
    price?: string;
    availability?: string;
    quantity?: string;
    // Estado / operación
    status?: string;
    date?: string;
    // Ubicación
    location?: string;
    // Acciones / metadata
    actions?: string;
    imageUrl?: string;
    category?: string;
    tags?: string;
    notes?: string;
    metadata?: string;
    // Wildcard: cualquier campo adicional declarado en outputSchema
    [key: string]: string | undefined;
}

export interface ResponseMappingConfig {
    resultPath?: string;   // e.g. "data.products" o "products"
    type: 'LIST' | 'ENTITY' | 'MESSAGE' | 'STATUS' | 'list' | 'entity' | 'message' | 'status';
    fields?: NormalizedFieldMapping;
    fieldsMap?: NormalizedFieldMapping;
    summary?: string;   // Descripción del output (usada por buildOutputSchemaSummary)
}

export interface NormalizedItem {
    id?: string;
    name?: string;
    title?: string;
    subtitle?: string;
    description?: string;
    price?: string;
    availability?: string;
    quantity?: string;
    status?: string;
    date?: string;
    location?: string;
    actions?: string;
    imageUrl?: string;
    category?: string;
    tags?: string;
    notes?: string;
    metadata?: any;
    [key: string]: any;
}

export interface NormalizedResponse {
    type: 'LIST' | 'ENTITY' | 'MESSAGE' | 'STATUS';
    items: NormalizedItem[];
    count: number;
    originalRaw?: any;
}

export class ToolResponseNormalizer {

    /**
     * Normaliza un objeto JSON raw usando la configuración de mapeo.
     * Si no hay mapeo configurado, retorna el raw como ENTITY para no perder datos.
     */
    static normalize(raw: any, config: ResponseMappingConfig): NormalizedResponse {
        if (!raw) {
            return { type: this.normalizeType(config.type), items: [], count: 0 };
        }

        const normalizedType = this.normalizeType(config.type);
        const fieldMapping = config.fields || config.fieldsMap || {};

        // Extraer el nodo principal de resultados
        let dataNode = raw;
        if (config.resultPath) {
            dataNode = this.getNestedValue(raw, config.resultPath);
        }

        // Procesar: LIST
        if (normalizedType === 'LIST' && Array.isArray(dataNode)) {
            const items = dataNode.map(item => this.mapFields(item, fieldMapping));
            return { type: 'LIST', items, count: items.length, originalRaw: raw };
        }

        // Procesar: STATUS (respuesta de operación — confirmación, resultado)
        if (normalizedType === 'STATUS') {
            const item = this.mapFields(dataNode, fieldMapping);
            return { type: 'STATUS', items: [item], count: 1, originalRaw: raw };
        }

        // Procesar: MESSAGE (texto plano de la API)
        if (normalizedType === 'MESSAGE') {
            const text = typeof dataNode === 'string'
                ? dataNode
                : (dataNode?.message || dataNode?.text || JSON.stringify(dataNode));
            return { type: 'MESSAGE', items: [{ name: text, description: text }], count: 1, originalRaw: raw };
        }

        // Procesar: ENTITY (objeto único) o fallback para array no esperado
        if (normalizedType === 'ENTITY' || !Array.isArray(dataNode)) {
            const item = this.mapFields(dataNode, fieldMapping);
            return { type: 'ENTITY', items: [item], count: 1, originalRaw: raw };
        }

        // Fallback: no se pudo determinar — retornar raw tal cual como ENTITY
        return { type: 'ENTITY', items: [{ ...raw }], count: 1, originalRaw: raw };
    }

    /**
     * Mapea campos de un objeto según el fieldMapping configurado.
     * Si no hay mapeo, retorna el objeto original completo (no pierde datos).
     */
    private static mapFields(item: any, mapping: NormalizedFieldMapping): NormalizedItem {
        if (!item || typeof item !== 'object') {
            return { name: String(item ?? ''), description: String(item ?? '') };
        }

        const result: NormalizedItem = {};
        let hasMappedField = false;

        // Mapear todos los campos declarados (genérico, no hardcodeado)
        for (const [targetKey, sourcePath] of Object.entries(mapping)) {
            if (sourcePath) {
                const val = this.getNestedValue(item, sourcePath);
                if (val !== undefined) {
                    result[targetKey] = val;
                    hasMappedField = true;
                }
            }
        }

        // Si no se mapeó ningún campo, devolver el item completo (fallback seguro)
        if (!hasMappedField) {
            return { ...item };
        }

        return result;
    }

    private static normalizeType(type: string): 'LIST' | 'ENTITY' | 'MESSAGE' | 'STATUS' {
        const t = (type || 'ENTITY').toUpperCase();
        if (t === 'LIST') return 'LIST';
        if (t === 'MESSAGE') return 'MESSAGE';
        if (t === 'STATUS') return 'STATUS';
        return 'ENTITY';
    }

    /**
     * Obtiene un valor anidado usando notación de puntos: "data.user.name"
     */
    private static getNestedValue(obj: any, path: string): any {
        if (!path) return obj;
        return path.split('.').reduce((prev, curr) => {
            return prev != null ? prev[curr] : undefined;
        }, obj);
    }
}
