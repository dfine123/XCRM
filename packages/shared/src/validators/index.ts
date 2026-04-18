import { z } from 'zod';
import {
  AccountStatus,
  AgencyStatus,
  Archetype,
  ContractTier,
  UserRole,
  AgencyUserRole,
  AssetType,
  FormulaStatus,
  PostStatus,
  TaskAction,
  TaskStatus,
} from '@xcrm/db';

// Enum validators keyed off Prisma-generated enums.
export const userRoleSchema = z.nativeEnum(UserRole);
export const agencyUserRoleSchema = z.nativeEnum(AgencyUserRole);
export const agencyStatusSchema = z.nativeEnum(AgencyStatus);
export const archetypeSchema = z.nativeEnum(Archetype);
export const contractTierSchema = z.nativeEnum(ContractTier);
export const accountStatusSchema = z.nativeEnum(AccountStatus);
export const assetTypeSchema = z.nativeEnum(AssetType);
export const formulaStatusSchema = z.nativeEnum(FormulaStatus);
export const postStatusSchema = z.nativeEnum(PostStatus);
export const taskActionSchema = z.nativeEnum(TaskAction);
export const taskStatusSchema = z.nativeEnum(TaskStatus);

export const createAgencySchema = z.object({
  name: z.string().min(1).max(200),
  slug: z
    .string()
    .min(2)
    .max(60)
    .regex(/^[a-z0-9-]+$/, 'lowercase, digits, hyphens only'),
  status: agencyStatusSchema.default('PROSPECT'),
});

export const createModelSchema = z.object({
  agencyId: z.string().min(1),
  displayName: z.string().min(1).max(120),
  realName: z.string().min(1).max(200),
  archetype: archetypeSchema,
  voiceToneNotes: z.string().default(''),
  hardRules: z.array(z.string()).default([]),
  softPreferences: z.array(z.string()).default([]),
});

export const createAccountSchema = z.object({
  modelId: z.string().min(1),
  handle: z
    .string()
    .min(1)
    .max(15)
    .regex(/^[A-Za-z0-9_]+$/, 'X handle characters only, no @'),
  status: accountStatusSchema.default('PROSPECT'),
  phoneDeviceId: z.string().nullable().optional(),
});

export const tagSchema = z.object({
  setting: z.string().optional(),
  outfit: z.string().optional(),
  pose: z.string().optional(),
  aesthetic: z.string().optional(),
  nsfwRating: z.enum(['SFW', 'SUGGESTIVE', 'NSFW']).optional(),
});

export const assetAutoTagsSchema = tagSchema.passthrough();

export const postGenerationMetaSchema = z.object({
  formulaVersion: z.number().int().positive().optional(),
  activeContextNoteIds: z.array(z.string()).default([]),
  insightRuleIds: z.array(z.string()).default([]),
  confidenceScore: z.number().min(0).max(1).optional(),
  reasoning: z.string().optional(),
});

export const escalationReasonSchema = z.enum([
  'ASSET_MISSING',
  'COPY_BROKEN',
  'ACCOUNT_LOCKED',
  'PLATFORM_ERROR',
  'POLICY_CONCERN',
  'OTHER',
]);
