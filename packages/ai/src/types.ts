import { z } from 'zod';

export const NsfwRating = z.enum(['SFW', 'SUGGESTIVE', 'NSFW']);

/**
 * Structured vision tags produced by `tagAsset()`. All fields except
 * `nsfwRating` are optional — the model is instructed to omit rather
 * than guess. ContentAsset.autoTags stores this as JSON, so extending
 * the schema is backward-compatible: older records keep their shape
 * and simply lack the new fields.
 *
 * The `caption` field is the single most load-bearing one for
 * generation-side retrieval: one sentence that describes the image
 * with enough signal to match a post's theme. Future semantic search
 * (pgvector + embeddings) will index it.
 */
export const TagResult = z.object({
  // Core (existed pre-intelligence pass)
  setting: z.string().optional(),
  outfit: z.string().optional(),
  pose: z.string().optional(),
  aesthetic: z.string().optional(),
  nsfwRating: NsfwRating,

  // Richer vision attributes
  mood: z.string().optional(),
  lighting: z.string().optional(),
  colorPalette: z.array(z.string()).max(6).optional(),
  dominantSubject: z.string().optional(),
  composition: z.string().optional(),

  // Detail-level signals
  textInImage: z.string().nullable().optional(),
  faceCount: z.number().int().min(0).max(20).optional(),

  // Retrieval backbone — one-sentence description
  caption: z.string().optional(),
});

export type TagResultT = z.infer<typeof TagResult>;
