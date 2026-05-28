import { z } from 'zod';

export const GroupSchema = z.object({
    name: z.string().min(1, 'Name is required'),
    description: z.string().optional().nullable(),
});

export const UpdateGroupSchema = GroupSchema.partial();

export const GroupContactsSchema = z.object({
    contactIds: z.array(z.string()).min(1, 'At least one contact ID is required'),
});

export type CreateGroupInput = z.infer<typeof GroupSchema>;
export type UpdateGroupInput = z.infer<typeof UpdateGroupSchema>;
export type GroupContactsInput = z.infer<typeof GroupContactsSchema>;
