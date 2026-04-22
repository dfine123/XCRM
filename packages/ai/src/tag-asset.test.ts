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

  it('parses the full richer schema (caption, mood, lighting, palette, etc.)', async () => {
    create.mockResolvedValue({
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            setting: 'hotel balcony at dusk',
            outfit: 'cream linen robe',
            pose: 'leaning on railing, looking out',
            aesthetic: 'quiet-luxury',
            mood: 'wistful',
            lighting: 'golden-hour',
            colorPalette: ['cream', 'terracotta', 'sage', 'navy'],
            dominantSubject: 'full-body model, three-quarter view',
            composition: 'rule-of-thirds',
            textInImage: null,
            faceCount: 1,
            caption:
              'A model in a cream linen robe leans on a hotel balcony railing at golden hour, looking wistfully at the horizon with warm terracotta light behind her.',
            nsfwRating: 'SFW',
          }),
        },
      ],
    });

    const { tagAsset } = await import('./tag-asset');
    const result = await tagAsset({
      bytes: Buffer.from('fake'),
      mime: 'image/jpeg',
    });
    expect(result.mood).toBe('wistful');
    expect(result.lighting).toBe('golden-hour');
    expect(result.colorPalette).toEqual(['cream', 'terracotta', 'sage', 'navy']);
    expect(result.faceCount).toBe(1);
    expect(result.textInImage).toBeNull();
    expect(result.caption?.startsWith('A model')).toBe(true);
  });

  it('is backward-compatible with the old (pre-intelligence) shape', async () => {
    create.mockResolvedValue({
      content: [
        {
          type: 'text',
          text: '{"setting":"beach","nsfwRating":"SFW"}',
        },
      ],
    });
    const { tagAsset } = await import('./tag-asset');
    const result = await tagAsset({
      bytes: Buffer.from('fake'),
      mime: 'image/jpeg',
    });
    expect(result.setting).toBe('beach');
    expect(result.caption).toBeUndefined();
    expect(result.mood).toBeUndefined();
  });

  it('rejects out-of-range faceCount', async () => {
    create.mockResolvedValue({
      content: [{ type: 'text', text: '{"nsfwRating":"SFW","faceCount":-1}' }],
    });
    const { tagAsset, AiTagError } = await import('./tag-asset');
    await expect(
      tagAsset({ bytes: Buffer.from('fake'), mime: 'image/jpeg' }),
    ).rejects.toBeInstanceOf(AiTagError);
  });
});
