import { z } from 'zod';
import { FORMATS, MAX_PLAN_BYTES, MIME } from './constants.js';

export const inputSchema = z.strictObject({
  plan: z
    .string()
    .max(MAX_PLAN_BYTES)
    .refine((value) => value.trim().length > 0, 'Plan must not be blank.')
    .refine(
      (value) => Buffer.byteLength(value, 'utf8') <= MAX_PLAN_BYTES,
      'Plan exceeds 512 KiB.',
    ),
  format: z.enum(FORMATS),
});

export const outputSchema = z.discriminatedUnion('format', [
  z.object({
    format: z.literal('.excalidraw'),
    mimeType: z.literal(MIME['.excalidraw']),
  }),
  z.object({ format: z.literal('.png'), mimeType: z.literal(MIME['.png']) }),
]);

export type VisualizeInput = z.infer<typeof inputSchema>;
