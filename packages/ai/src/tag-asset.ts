import { Prompts } from '@xcrm/shared';
import { getAnthropic, getAnthropicModel } from './client';
import { TagResult, type TagResultT } from './types';

export class AiTagError extends Error {
  constructor(
    message: string,
    public readonly raw?: string,
  ) {
    super(message);
    this.name = 'AiTagError';
  }
}

export type TagInput = {
  bytes: Buffer;
  /**
   * A MIME type Anthropic's vision supports: image/png, image/jpeg,
   * image/gif, image/webp. Callers should map Drive mime → these before
   * calling.
   */
  mime: 'image/png' | 'image/jpeg' | 'image/gif' | 'image/webp';
};

/**
 * Ask Claude to tag a single image. Returns a TagResult or throws
 * AiTagError if the model response can't be parsed.
 *
 * The system prompt is marked ephemeral-cached so bulk folder syncs
 * hit the prompt cache and stay cheap.
 */
export async function tagAsset({ bytes, mime }: TagInput): Promise<TagResultT> {
  const client = getAnthropic();
  const model = getAnthropicModel();

  const response = await client.messages.create({
    model,
    max_tokens: 512,
    // cache_control on system blocks is supported by the API but not yet in
    // the 0.27 SDK's TextBlockParam type — cast until we bump the SDK.
    system: [
      {
        type: 'text',
        text: Prompts.assetTagPrompt(),
        cache_control: { type: 'ephemeral' },
      },
    ] as unknown as string,
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'image',
            source: {
              type: 'base64',
              media_type: mime,
              data: bytes.toString('base64'),
            },
          },
          { type: 'text', text: 'Return only the JSON object.' },
        ],
      },
    ],
  });

  const textBlock = response.content.find((b) => b.type === 'text');
  if (!textBlock || textBlock.type !== 'text') {
    throw new AiTagError('No text content in response');
  }

  const raw = textBlock.text.trim();
  const jsonStart = raw.indexOf('{');
  const jsonEnd = raw.lastIndexOf('}');
  if (jsonStart === -1 || jsonEnd === -1) {
    throw new AiTagError('Response contained no JSON object', raw);
  }
  const candidate = raw.slice(jsonStart, jsonEnd + 1);

  let parsed: unknown;
  try {
    parsed = JSON.parse(candidate);
  } catch (e) {
    throw new AiTagError(`Response was not valid JSON: ${(e as Error).message}`, raw);
  }

  const result = TagResult.safeParse(parsed);
  if (!result.success) {
    throw new AiTagError(
      `Response did not match TagResult schema: ${result.error.message}`,
      raw,
    );
  }
  return result.data;
}
