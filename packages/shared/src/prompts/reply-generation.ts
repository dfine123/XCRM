export interface ReplyGenerationInput {
  modelProfile: {
    displayName: string;
    archetype: string;
    voiceToneNotes: string;
    hardRules: string[];
  };
  account: { handle: string; status: string };
  targetPost: { authorHandle: string; content: string };
  formula: { version: number; rawPlaybook: string };
  contextNotes: { title: string; body: string; weight: number }[];
}

export function replyGenerationPrompt(input: ReplyGenerationInput): string {
  return [
    '<task>',
    'Draft a single reply to the target post below, written as the account holder.',
    'Return JSON: { copy: string, confidenceScore: number (0-1), reasoning: string }',
    '</task>',
    '',
    `<model>${input.modelProfile.displayName} (${input.modelProfile.archetype})</model>`,
    `<voice>${input.modelProfile.voiceToneNotes}</voice>`,
    `<hard_rules>${JSON.stringify(input.modelProfile.hardRules)}</hard_rules>`,
    '',
    `<account>@${input.account.handle} (${input.account.status})</account>`,
    '',
    '<target_post>',
    `From @${input.targetPost.authorHandle}:`,
    input.targetPost.content,
    '</target_post>',
    '',
    `<formula version="${input.formula.version}">${input.formula.rawPlaybook}</formula>`,
    '',
    '<context_notes>',
    ...input.contextNotes.map((n) => `- [${n.weight}] ${n.title}: ${n.body}`),
    '</context_notes>',
    '',
    'Respond with ONLY the JSON object.',
  ].join('\n');
}
