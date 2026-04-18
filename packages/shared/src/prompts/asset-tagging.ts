export function assetTagPrompt(): string {
  return [
    '<task>',
    'Tag this image for use in an X post. Return JSON matching:',
    '{ setting, outfit, pose, aesthetic, nsfwRating: "SFW"|"SUGGESTIVE"|"NSFW" }',
    'If a field is uncertain, omit it rather than guessing.',
    '</task>',
    'Respond with ONLY the JSON object.',
  ].join('\n');
}
