import { Prompts } from '@xcrm/shared';
import { getAnthropic, getAnthropicModel } from './client';
import { DraftResult, type DraftResultT } from './types';

type DraftPromptInput = Prompts.DraftPromptInput;

export class AiDraftError extends Error {
  constructor(
    message: string,
    public readonly raw?: string,
  ) {
    super(message);
    this.name = 'AiDraftError';
  }
}

export type DraftPostInput = DraftPromptInput;

/**
 * Ask Claude to produce a post draft. Text-only call — we feed asset
 * captions + tags instead of image bytes so the call stays cheap and
 * deterministic. (The operator sees the images; Claude picks by caption.)
 *
 * System prompt is ephemeral-cached per the same pattern used by
 * tagAsset() — keeps bulk generation runs cheap.
 *
 * Throws `AiDraftError` if the model response can't be parsed or if
 * `assetId` isn't in the provided pool. Caller can retry, log, or
 * surface for review.
 */
export async function draftPost(input: DraftPostInput): Promise<DraftResultT> {
  const client = getAnthropic();
  const model = getAnthropicModel();

  const userPrompt = Prompts.buildDraftPostUserPrompt(input);

  const response = await client.messages.create({
    model,
    max_tokens: 600,
    // cache_control is present in the Anthropic API but not typed on
    // the 0.27 TextBlockParam. Same cast pattern as tagAsset.
    system: [
      {
        type: 'text',
        text: Prompts.draftPostSystemPrompt(),
        cache_control: { type: 'ephemeral' },
      },
    ] as unknown as string,
    messages: [{ role: 'user', content: userPrompt }],
  });

  const textBlock = response.content.find((b) => b.type === 'text');
  if (!textBlock || textBlock.type !== 'text') {
    throw new AiDraftError('No text content in response');
  }

  const raw = textBlock.text.trim();
  const jsonStart = raw.indexOf('{');
  const jsonEnd = raw.lastIndexOf('}');
  if (jsonStart === -1 || jsonEnd === -1) {
    throw new AiDraftError('Response contained no JSON object', raw);
  }
  const candidate = raw.slice(jsonStart, jsonEnd + 1);

  let parsed: unknown;
  try {
    parsed = JSON.parse(candidate);
  } catch (e) {
    throw new AiDraftError(`Response was not valid JSON: ${(e as Error).message}`, raw);
  }

  const result = DraftResult.safeParse(parsed);
  if (!result.success) {
    throw new AiDraftError(
      `Response did not match DraftResult schema: ${result.error.message}`,
      raw,
    );
  }

  // Pool-membership guard — zod can't know about it.
  const validIds = new Set(input.assets.map((a: Prompts.DraftPromptAsset) => a.id));
  if (!validIds.has(result.data.assetId)) {
    // Zero-confidence "no fit" is allowed — in that case the caller
    // (orchestrator) should skip writing a row, not throw.
    if (result.data.confidence === 0 && input.assets.length === 0) {
      return result.data;
    }
    throw new AiDraftError(
      `assetId "${result.data.assetId}" not in the provided pool`,
      raw,
    );
  }

  return result.data;
}
