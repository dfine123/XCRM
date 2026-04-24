/**
 * Generation prompt for Build D.
 *
 * Outputs the *system* prompt as a stable string so Anthropic's
 * prompt-cache can reuse it across calls. The *user* prompt is
 * assembled per-call via {@link buildDraftPostUserPrompt}.
 *
 * Output contract is strict JSON: { copy, assetId, confidence, reasoning }.
 * Callers parse with the zod schema in @xcrm/ai — don't loosen here
 * without updating both sides.
 */

export function draftPostSystemPrompt(): string {
  return [
    '<role>',
    'You are the draft-generation component of an autonomous social-media',
    'operations system. You receive: a Model profile, an Account state,',
    'active context notes with weights, and a pool of candidate Content',
    'Assets. Your job is to pick ONE asset and write the post copy.',
    '</role>',
    '',
    '<output>',
    'Respond with ONLY this JSON object and nothing else:',
    '  {',
    '    "copy": string,           // the post text',
    '    "assetId": string,        // EXACT id from the provided pool',
    '    "confidence": number,     // 0.0 .. 1.0 — your own assessment',
    '    "reasoning": string       // 1-2 sentences: why THIS asset + copy',
    '  }',
    '</output>',
    '',
    '<rules>',
    'HARD rules (never violate, regardless of confidence):',
    '  - `copy` MUST be <= 280 characters.',
    '  - `assetId` MUST match exactly one asset id from the provided pool.',
    '  - Every Hard Rule from the Model profile is absolute. If no asset',
    "    can satisfy all hard rules, return confidence 0 and explain why",
    "    in reasoning — do NOT invent an assetId.",
    '  - No emoji, hashtags, or @mentions unless voice/tone or hard rules',
    "    explicitly allow them.",
    '',
    'SOFT guidance:',
    '  - Soft preferences are steers, not binding.',
    '  - Active context notes are weighted 1..10. A 10-weight note should',
    "    dominate the output; a 1-weight note is a nudge.",
    '  - Favor assets whose caption, mood, and aesthetic fit the account',
    "    status, voice, and any active notes. Novelty is a tiebreaker,",
    "    not an override — a stale-but-perfect asset beats a fresh-but-off-tone one.",
    '',
    'CONFIDENCE calibration:',
    '  0.9+  clearly the right pick, copy is on-voice and tight',
    '  0.7-0.9 solid pick with minor judgment calls',
    '  0.5-0.7 workable but something is a stretch (fit, copy, tone)',
    '  0.3-0.5 weak — asset options were thin or voice was hard to hit',
    '  0.0-0.3 bad fit; recommend human review',
    '</rules>',
  ].join('\n');
}

/**
 * Stripped asset view the LLM sees. Keep tight — every byte is a
 * tokenizer cost on every call. `caption` is the retrieval backbone;
 * mood/lighting/aesthetic are tiebreakers; novelty tells Claude which
 * assets are least-recently-used.
 */
export type DraftPromptAsset = {
  id: string;
  caption: string | null;
  mood: string | null;
  lighting: string | null;
  aesthetic: string | null;
  nsfwRating: string | null;
  novelty: number; // 0..1
};

export type DraftPromptContextNote = {
  title: string;
  body: string;
  weight: number;
};

export type DraftPromptInput = {
  model: {
    displayName: string;
    archetype: string;
    voiceToneNotes: string;
    hardRules: string[];
    softPreferences: string[];
  };
  account: {
    handle: string;
    status: string;
    followerCount: number;
  };
  activeNotes: DraftPromptContextNote[];
  assets: DraftPromptAsset[];
};

export function buildDraftPostUserPrompt(input: DraftPromptInput): string {
  const { model, account, activeNotes, assets } = input;

  const lines: string[] = [];
  lines.push('## Model profile');
  lines.push(`Display name: ${model.displayName}`);
  lines.push(`Archetype: ${model.archetype}`);
  lines.push(`Voice / tone: ${model.voiceToneNotes || '(none supplied)'}`);
  lines.push(
    `Hard rules: ${model.hardRules.length ? model.hardRules.join(' | ') : '(none)'}`,
  );
  lines.push(
    `Soft preferences: ${model.softPreferences.length ? model.softPreferences.join(' | ') : '(none)'}`,
  );
  lines.push('');
  lines.push('## Account');
  lines.push(`Handle: @${account.handle}`);
  lines.push(`Status: ${account.status}`);
  lines.push(`Followers: ${account.followerCount}`);
  lines.push('');

  lines.push('## Active context notes');
  if (activeNotes.length === 0) {
    lines.push('(none — run on baseline signals)');
  } else {
    for (const n of activeNotes) {
      lines.push(`- [weight ${n.weight}] ${n.title}`);
      lines.push(`  ${n.body}`);
    }
  }
  lines.push('');

  lines.push('## Candidate assets');
  if (assets.length === 0) {
    lines.push('(none available — return confidence 0 and say so in reasoning)');
  } else {
    for (const a of assets) {
      const parts = [
        a.caption ?? '(no caption)',
        a.mood ? `mood: ${a.mood}` : null,
        a.lighting ? `lighting: ${a.lighting}` : null,
        a.aesthetic ? `aesthetic: ${a.aesthetic}` : null,
        a.nsfwRating ? `nsfw: ${a.nsfwRating}` : null,
        `novelty: ${a.novelty.toFixed(2)}`,
      ]
        .filter(Boolean)
        .join(' · ');
      lines.push(`- ${a.id} · ${parts}`);
    }
  }
  lines.push('');

  lines.push('## Task');
  lines.push(
    'Pick ONE asset id from the pool. Write copy for it. Return the JSON object only.',
  );
  return lines.join('\n');
}
