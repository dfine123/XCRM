import {
  AccountStatus,
  AgencyStatus,
  PhoneDeviceStatus,
  PostStatus,
  ReplyStatus,
  RepostStatus,
} from '@xcrm/db';
import type { Hue } from '@xcrm/ui';

/**
 * Hue assignments for entity statuses. Badge colors stay consistent
 * across list views, detail headers, and timeline entries.
 *
 * Keep these aligned with OPS_HUES / VA_HUES semantics — we aren't
 * introducing new colors, just reusing the rainbow palette.
 */

export const AGENCY_STATUS_HUE: Record<AgencyStatus, Hue> = {
  PROSPECT: 60, // amber — uncommitted
  ACTIVE: 135, // green — paying
  PAUSED: 25, // red-orange — attention
  CHURNED: null, // neutral — done
};

export const ACCOUNT_STATUS_HUE: Record<AccountStatus, Hue> = {
  PROSPECT: 60,
  FRESH_BUILD: 210, // blue — warming up
  ACQUIRED_AGED: 210,
  ACQUIRED_IN_NICHE: 210,
  TAKEOVER: 210,
  ACTIVE_RAMPING: 100, // green-yellow — climbing
  ACTIVE_ESTABLISHED: 135, // green — steady
  ACTIVE_MATURE: 170, // teal — mature
  PAUSED: 25,
  OFFBOARDING: 320, // magenta — exiting
  ARCHIVED: null,
  QUARANTINED: 25, // red-orange — problem
};

export const PHONE_STATUS_HUE: Record<PhoneDeviceStatus, Hue> = {
  ACTIVE: 135,
  OFFLINE: null,
  MAINTENANCE: 60,
};

export const POST_STATUS_HUE: Record<PostStatus, Hue> = {
  DRAFT: null,
  PENDING_APPROVAL: 60,
  APPROVED: 100,
  SCHEDULED: 210,
  POSTED: 135,
  FAILED: 25,
  CANCELLED: null,
};

export const REPLY_STATUS_HUE: Record<ReplyStatus, Hue> = {
  DRAFT: null,
  APPROVED: 100,
  SCHEDULED: 210,
  POSTED: 135,
  FAILED: 25,
  CANCELLED: null,
};

export const REPOST_STATUS_HUE: Record<RepostStatus, Hue> = {
  SCHEDULED: 210,
  POSTED: 135,
  SKIPPED: null,
  FAILED: 25,
};
