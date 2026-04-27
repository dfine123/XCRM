'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { prisma } from '@xcrm/db';
import { requireUser } from '@/lib/session';

export type EngagementFormState = { error?: string; ok?: boolean } | null;

const schema = z.object({
  postId: z.string().min(1),
  likes: z.coerce.number().int().min(0).default(0),
  reposts: z.coerce.number().int().min(0).default(0),
  replies: z.coerce.number().int().min(0).default(0),
  bookmarks: z.coerce.number().int().min(0).default(0),
  impressions: z.coerce.number().int().min(0).default(0),
  profileClicks: z.coerce.number().int().min(0).default(0),
});

/**
 * Manual-entry path for Build G. Operator pastes numbers, we insert a
 * fresh `PostEngagement` snapshot. Multiple snapshots per post are
 * fine — the recompute service reads the latest per post.
 *
 * The same row could be posted via the source-agnostic
 * `/api/engagement/ingest` endpoint when a real ingestor lands; this
 * action exists for the in-product manual flow.
 */
export async function recordEngagement(
  _prev: EngagementFormState,
  formData: FormData,
): Promise<EngagementFormState> {
  await requireUser();
  const parsed = schema.safeParse({
    postId: formData.get('postId'),
    likes: formData.get('likes') ?? 0,
    reposts: formData.get('reposts') ?? 0,
    replies: formData.get('replies') ?? 0,
    bookmarks: formData.get('bookmarks') ?? 0,
    impressions: formData.get('impressions') ?? 0,
    profileClicks: formData.get('profileClicks') ?? 0,
  });
  if (!parsed.success) {
    return {
      error: parsed.error.issues
        .map((i) => `${i.path.join('.')}: ${i.message}`)
        .join('; '),
    };
  }

  const post = await prisma.post.findFirst({
    where: { id: parsed.data.postId, deletedAt: null },
    select: { id: true, accountId: true, account: { select: { modelId: true } } },
  });
  if (!post) return { error: 'Post not found.' };

  await prisma.postEngagement.create({
    data: {
      postId: post.id,
      likes: parsed.data.likes,
      reposts: parsed.data.reposts,
      replies: parsed.data.replies,
      bookmarks: parsed.data.bookmarks,
      impressions: parsed.data.impressions,
      profileClicks: parsed.data.profileClicks,
    },
  });

  revalidatePath('/console/engagement');
  revalidatePath(`/console/models/${post.account.modelId}`);
  return { ok: true };
}
