import { PostStatus, ReplyStatus, RepostStatus } from '@xcrm/db';

export const POST_STATUS_TRANSITIONS: Record<PostStatus, PostStatus[]> = {
  DRAFT: [PostStatus.PENDING_APPROVAL, PostStatus.APPROVED, PostStatus.CANCELLED],
  PENDING_APPROVAL: [PostStatus.APPROVED, PostStatus.DRAFT, PostStatus.CANCELLED],
  APPROVED: [PostStatus.SCHEDULED, PostStatus.DRAFT, PostStatus.CANCELLED],
  SCHEDULED: [PostStatus.POSTED, PostStatus.FAILED, PostStatus.CANCELLED],
  POSTED: [],
  FAILED: [PostStatus.SCHEDULED, PostStatus.CANCELLED],
  CANCELLED: [],
};

export const REPLY_STATUS_TRANSITIONS: Record<ReplyStatus, ReplyStatus[]> = {
  DRAFT: [ReplyStatus.APPROVED, ReplyStatus.CANCELLED],
  APPROVED: [ReplyStatus.SCHEDULED, ReplyStatus.DRAFT, ReplyStatus.CANCELLED],
  SCHEDULED: [ReplyStatus.POSTED, ReplyStatus.FAILED, ReplyStatus.CANCELLED],
  POSTED: [],
  FAILED: [ReplyStatus.SCHEDULED, ReplyStatus.CANCELLED],
  CANCELLED: [],
};

export const REPOST_STATUS_TRANSITIONS: Record<RepostStatus, RepostStatus[]> = {
  SCHEDULED: [RepostStatus.POSTED, RepostStatus.FAILED, RepostStatus.SKIPPED],
  POSTED: [],
  SKIPPED: [],
  FAILED: [RepostStatus.SCHEDULED, RepostStatus.SKIPPED],
};

export function canTransitionPost(from: PostStatus, to: PostStatus): boolean {
  return POST_STATUS_TRANSITIONS[from]?.includes(to) ?? false;
}

export function canTransitionReply(from: ReplyStatus, to: ReplyStatus): boolean {
  return REPLY_STATUS_TRANSITIONS[from]?.includes(to) ?? false;
}

export function canTransitionRepost(from: RepostStatus, to: RepostStatus): boolean {
  return REPOST_STATUS_TRANSITIONS[from]?.includes(to) ?? false;
}
