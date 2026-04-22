/**
 * Vision-tagging prompt for ContentAsset ingest.
 *
 * Goals:
 *   - Keep the tag schema rich enough that the generation-side LLM can
 *     pick the right asset from a pool without re-seeing the image.
 *   - Make every field independently useful for filtering/retrieval.
 *   - Never force a guess — omit > fabricate.
 *
 * The output JSON is persisted to ContentAsset.autoTags. Existing records
 * with the pre-intelligence shape remain readable; new fields are additive.
 */
export function assetTagPrompt(): string {
  return [
    '<task>',
    'Tag this image for use by an autonomous content agent that picks',
    'assets for X posts. Return ONLY a JSON object with these fields.',
    '',
    'Required:',
    '  nsfwRating        "SFW" | "SUGGESTIVE" | "NSFW"',
    '',
    'Recommended (omit if truly uncertain — do not guess):',
    '  setting           one-phrase location/environment; e.g. "hotel balcony", "forest trail", "kitchen counter"',
    '  outfit            one-phrase clothing description; e.g. "cream sweater + jeans", "black bikini", "none"',
    '  pose              one-phrase pose/action; e.g. "seated reading", "mid-laugh", "standing hand-on-hip"',
    '  aesthetic         overall style keyword; e.g. "clean-girl", "cottagecore", "streetwear", "bombshell"',
    '  mood              emotional register; e.g. "playful", "wistful", "confident", "cozy", "intimate"',
    '  lighting          lighting conditions; e.g. "golden-hour", "overcast", "studio-soft", "harsh-midday", "indoor-warm", "low-light"',
    '  colorPalette      array of 3-5 dominant color words (descriptive, not hex); e.g. ["cream","terracotta","sage"]',
    '  dominantSubject   what fills the frame; e.g. "full-body model mid-shot", "close-up face", "hands with coffee cup", "empty scene — food flatlay"',
    '  composition       framing; e.g. "portrait", "landscape", "flatlay", "POV", "over-the-shoulder", "rule-of-thirds"',
    '  textInImage       any legible text in the image, transcribed verbatim. Use null if there is no text.',
    '  faceCount         integer count of distinct human faces visible. 0 if none.',
    '  caption           ONE SENTENCE (15-30 words) describing the image as if writing retrieval-quality alt-text. Include setting, subject, mood, and one distinctive visual detail.',
    '',
    'Rules:',
    '  - JSON only. No prose, no markdown fences.',
    '  - Omit any optional field you cannot confidently fill.',
    '  - Keep strings concise; avoid generic filler.',
    '</task>',
  ].join('\n');
}
