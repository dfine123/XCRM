import { describe, it, expect, vi, beforeEach } from 'vitest';

const create = vi.fn();

vi.mock('@anthropic-ai/sdk', () => {
  return {
    default: vi.fn().mockImplementation(() => ({
      messages: { create },
    })),
  };
});

describe('tagAsset', () => {
  beforeEach(() => {
    create.mockReset();
    process.env.ANTHROPIC_API_KEY = 'test-key';
  });

  it('parses a well-formed JSON response', async () => {
    create.mockResolvedValue({
      content: [
        {
          type: 'text',
          text: '{"setting":"beach","outfit":"bikini","pose":"standing","aesthetic":"sunny","nsfwRating":"SUGGESTIVE"}',
        },
      ],
    });

    const { tagAsset } = await import('./tag-asset');
    const result = await tagAsset({
      bytes: Buffer.from('fake'),
      mime: 'image/jpeg',
    });
    expect(result.setting).toBe('beach');
    expect(result.nsfwRating).toBe('SUGGESTIVE');
    expect(create).toHaveBeenCalledTimes(1);
  });

  it('tolerates whitespace + surrounding prose', async () => {
    create.mockResolvedValue({
      content: [
        {
          type: 'text',
          text: 'Here you go:\n{"nsfwRating":"SFW"}\nLet me know if you need more.',
        },
      ],
    });
    const { tagAsset } = await import('./tag-asset');
    const result = await tagAsset({
      bytes: Buffer.from('fake'),
      mime: 'image/png',
    });
    expect(result.nsfwRating).toBe('SFW');
  });

  it('throws AiTagError on non-JSON output', async () => {
    create.mockResolvedValue({
      content: [{ type: 'text', text: 'sorry, I cannot help with that.' }],
    });
    const { tagAsset, AiTagError } = await import('./tag-asset');
    await expect(
      tagAsset({ bytes: Buffer.from('fake'), mime: 'image/jpeg' }),
    ).rejects.toBeInstanceOf(AiTagError);
  });

  it('throws AiTagError when schema does not match', async () => {
    create.mockResolvedValue({
      content: [{ type: 'text', text: '{"nsfwRating":"UNKNOWN_RATING"}' }],
    });
    const { tagAsset, AiTagError } = await import('./tag-asset');
    await expect(
      tagAsset({ bytes: Buffer.from('fake'), mime: 'image/jpeg' }),
    ).rejects.toBeInstanceOf(AiTagError);
  });

  it('sets cache_control on the system prompt', async () => {
    create.mockResolvedValue({
      content: [{ type: 'text', text: '{"nsfwRating":"SFW"}' }],
    });
    const { tagAsset } = await import('./tag-asset');
    await tagAsset({ bytes: Buffer.from('fake'), mime: 'image/webp' });
    const call = create.mock.calls[0]![0];
    expect(call.system[0].cache_control).toEqual({ type: 'ephemeral' });
  });
});
