import { z } from 'zod';

export const NsfwRating = z.enum(['SFW', 'SUGGESTIVE', 'NSFW']);

export const TagResult = z.object({
  setting: z.string().optional(),
  outfit: z.string().optional(),
  pose: z.string().optional(),
  aesthetic: z.string().optional(),
  nsfwRating: NsfwRating,
});

export type TagResultT = z.infer<typeof TagResult>;
