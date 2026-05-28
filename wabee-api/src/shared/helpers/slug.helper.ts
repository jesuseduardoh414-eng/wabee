import { CoreInternalService } from '../../modules/core/core.internal.service';

/**
 * Genera un slug a partir de una cadena de texto.
 */
export function slugify(text: string): string {
    return text
        .toString()
        .toLowerCase()
        .trim()
        .replace(/\s+/g, '-')     // Reemplazar espacios con -
        .replace(/[^\w-]+/g, '')  // Eliminar caracteres no alfanuméricos
        .replace(/--+/g, '-');    // Reemplazar múltiples - con uno solo
}

/**
 * Genera un slug único para una organización, resolviendo colisiones.
 */
export async function generateUniqueSlug(baseName: string): Promise<string> {
    const baseSlug = slugify(baseName);
    let slug = baseSlug;
    let counter = 1;

    while (true) {
        const existing = await CoreInternalService.getOrganizationBySlug(slug);

        if (!existing) {
            return slug;
        }

        slug = `${baseSlug}-${counter}`;
        counter++;
    }
}
