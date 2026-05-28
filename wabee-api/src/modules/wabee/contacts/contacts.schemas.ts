import { z } from 'zod';

// Enums from Prisma (redefined for Zod)
export const ContactStatusSchema = z.enum(['ACTIVE', 'BLOCKED']);
export const ContactLifecycleStatusSchema = z.enum([
    'NEW', 'LEAD', 'ACTIVE', 'CUSTOMER', 'INACTIVE', 'BLOCKED', 'ARCHIVED'
]);

export const ContactSchema = z.object({
    phone: z.string().min(8, 'Phone number too short'),
    name: z.string().min(1, 'Name is required'),
    email: z.preprocess(
        (val) => (val === '' || val === null ? undefined : val),
        z.string().email('Invalid email address').optional()
    ),
    tags: z.preprocess((val) => {
        if (typeof val === 'string' && val.trim() !== '') {
            return val.split(',').map((t) => t.trim()).filter(Boolean);
        }
        if (Array.isArray(val)) return val;
        return [];
    }, z.array(z.string()).optional().default([])),
    status: ContactStatusSchema.default('ACTIVE'),
    lifecycleStatus: ContactLifecycleStatusSchema.default('NEW'),
    externalCrmId: z.string().optional().nullable(),
    sourceSystem: z.string().optional().nullable(),
});

export const CreateContactSchema = ContactSchema;

export const UpdateContactSchema = ContactSchema.partial();

export const ContactQuerySchema = z.object({
    search: z.string().optional(),
    status: ContactStatusSchema.optional(),
    lifecycleStatus: z.union([ContactLifecycleStatusSchema, z.array(ContactLifecycleStatusSchema)]).optional(),
    tag: z.string().optional(),
    tagsAny: z.array(z.string()).optional(),
    tagsAll: z.array(z.string()).optional(),
    groupId: z.string().optional(),
    segmentId: z.string().optional(),
    page: z.coerce.number().min(1).default(1),
    pageSize: z.coerce.number().min(1).max(100).default(20),
    take: z.coerce.number().min(1).max(100).optional(),
    limit: z.coerce.number().min(1).max(100).optional(),
    skip: z.coerce.number().min(0).optional(),
    offset: z.coerce.number().min(0).optional(),
});

export const PatchLifecycleSchema = z.object({
    toStatus: ContactLifecycleStatusSchema,
    source: z.string().default('manual'),
    actorUserId: z.string().optional(),
});

export const TagsActionSchema = z.object({
    tags: z.array(z.string()).min(1, 'At least one tag is required'),
});

// Groups
export const GroupSchema = z.object({
    name: z.string().min(1, 'Name is required'),
    description: z.string().optional().nullable(),
});

export const GroupContactsSchema = z.object({
    contactIds: z.array(z.string()).min(1, 'At least one contact ID is required'),
});

// Segments
export const SavedSegmentSchema = z.object({
    name: z.string().min(1, 'Name is required'),
    description: z.string().optional().nullable(),
    filter: z.object({
        status: ContactStatusSchema.optional(),
        lifecycleStatus: z.array(ContactLifecycleStatusSchema).optional(),
        tagsAny: z.array(z.string()).optional(),
        tagsAll: z.array(z.string()).optional(),
        groupId: z.string().optional(),
        search: z.string().optional(),
    }),
});

export type CreateContactInput = z.infer<typeof CreateContactSchema>;
export type UpdateContactInput = z.infer<typeof UpdateContactSchema>;
export type ContactQueryInput = z.infer<typeof ContactQuerySchema>;
export type PatchLifecycleInput = z.infer<typeof PatchLifecycleSchema>;
export type TagsActionInput = z.infer<typeof TagsActionSchema>;
export type CreateGroupInput = z.infer<typeof GroupSchema>;
export type CreateSegmentInput = z.infer<typeof SavedSegmentSchema>;

export const UpdateSegmentSchema = SavedSegmentSchema.partial();
export type UpdateSegmentInput = z.infer<typeof UpdateSegmentSchema>;
