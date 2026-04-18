/**
 * Post generation prompt. Versioned via git — prompt changes are code reviewed.
 * Inputs are structured; we avoid a plugin system (spec §7).
 */

export interface PostGenerationInput {
  modelProfile: {
    displayName: string;
    archetype: string;
    voiceToneNotes: string;
    hardRules: string[];
    softPreferences: string[];
  };
  accountState: {
    handle: string;
    status: string;
    followerCount: number;
    recentPosts: { copy: string; postedAt: string; engagementRate: number }[];
  };
  formula: {
    version: number;
    rawPlaybook: string;
    hookPatterns?: unknown;
    hashtagStrategy?: unknown;
    lengthTargets?: unknown;
  };
  contextNotes: { title: string; body: string; weight: number }[];
  insightRules: { title: string; description: string }[];
  availableAssets: { id: string; autoTags: unknown }[];
  campContext: { currentCampAccountHandles: string[] } | null;
}

export function postGenerationPrompt(input: PostGenerationInput): string {
  return [
    '<task>',
    'Draft a single X post for the account below.',
    'Return JSON matching the schema: { copy: string, suggestedAssetIds: string[], confidenceScore: number (0-1), reasoning: string }',
    '</task>',
    '',
    '<model>',
    `Display name: ${input.modelProfile.displayName}`,
    `Archetype: ${input.modelProfile.archetype}`,
    `Voice/tone: ${input.modelProfile.voiceToneNotes}`,
    `Hard rules (never violate): ${JSON.stringify(input.modelProfile.hardRules)}`,
    `Soft preferences: ${JSON.stringify(input.modelProfile.softPreferences)}`,
    '</model>',
    '',
    '<account>',
    `Handle: @${input.accountState.handle}`,
    `Status: ${input.accountState.status}`,
    `Followers: ${input.accountState.followerCount}`,
    `Recent posts: ${JSON.stringify(input.accountState.recentPosts, null, 2)}`,
    '</account>',
    '',
    '<formula version="' + input.formula.version + '">',
    input.formula.rawPlaybook,
    input.formula.hookPatterns ? `Hook patterns: ${JSON.stringify(input.formula.hookPatterns)}` : '',
    input.formula.hashtagStrategy ? `Hashtags: ${JSON.stringify(input.formula.hashtagStrategy)}` : '',
    input.formula.lengthTargets ? `Length targets: ${JSON.stringify(input.formula.lengthTargets)}` : '',
    '</formula>',
    '',
    '<context_notes>',
    ...input.contextNotes.map((n) => `- [weight ${n.weight}] ${n.title}: ${n.body}`),
    '</context_notes>',
    '',
    '<insights>',
    ...input.insightRules.map((r) => `- ${r.title}: ${r.description}`),
    '</insights>',
    '',
    '<available_assets>',
    JSON.stringify(input.availableAssets, null, 2),
    '</available_assets>',
    '',
    input.campContext
      ? `<camp>\nCurrent camp: ${input.campContext.currentCampAccountHandles.join(', ')}\n</camp>`
      : '',
    '',
    'Respond with ONLY the JSON object, no prose.',
  ]
    .filter(Boolean)
    .join('\n');
}
