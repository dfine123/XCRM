import { loadCandidateAssets } from './candidate-assets';

export type AssetAlternative = {
  id: string;
  caption: string | null;
  mood: string | null;
  aesthetic: string | null;
  novelty: number;
};

/**
 * Top-N alternative assets the operator could swap into a draft, used
 * by the Edit & Approve form. Reuses Build D's candidate-asset
 * predicate so we get the same exclusion rules (already-committed,
 * already-used-on-this-account, soft-deleted, etc.).
 *
 * `excludeAssetId` lets the caller drop the post's current pick from
 * the suggestions — operator already sees that one.
 */
export async function getAssetAlternativesForAccount(
  accountId: string,
  opts: { excludeAssetId?: string; count?: number } = {},
): Promise<AssetAlternative[]> {
  const count = opts.count ?? 6;
  const pool = await loadCandidateAssets(accountId);
  return pool
    .filter((a) => a.id !== opts.excludeAssetId)
    .slice(0, count)
    .map((a) => ({
      id: a.id,
      caption: a.caption,
      mood: a.mood,
      aesthetic: a.aesthetic,
      novelty: a.novelty,
    }));
}
