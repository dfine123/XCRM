import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { DraftPostInput } from './draft-post';

const create = vi.fn();

vi.mock('@anthropic-ai/sdk', () => ({
  default: vi.fn().mockImplementation(() => ({
    messages: { create },
  })),
}));

function makeInput(overrides?: Partial<DraftPostInput>): DraftPostInput {
  return {
    model: {
      displayName: 'Ava',
      archetype: 'BLONDE_THIRST',
      voiceToneNotes: 'casual, witty',
      hardRules: ['no politics'],
      softPreferences: ['prefer outdoor shots'],
    },
    account: {
      handle: 'ava_daily',
      status: 'ACTIVE_ESTABLISHED',
      followerCount: 12_400,
    },
    activeNotes: [],
    assets: [
      {
        id: 'asset-1',
        caption: 'Hotel balcony at dusk, cream robe',
        mood: 'wistful',
        lighting: 'golden-hour',
        aesthetic: 'quiet-luxury',
        nsfwRating: 'SFW',
        novelty: 1,
      },
      {
        id: 'asset-2',
        caption: 'Coffee and newspaper flatlay',
        mood: 'cozy',
        lighting: 'indoor-warm',
        aesthetic: 'clean-girl',
        nsfwRating: 'SFW',
        novelty: 0.8,
      },
    ],
    ...overrides,
  };
}

describe('draftPost', () => {
  beforeEach(() => {
    create.mockReset();
    process.env.ANTHROPIC_API_KEY = 'test-key';
  });

  it('parses a well-formed JSON response', async () => {
    create.mockResolvedValue({
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            copy: 'Dusk settles in. Slow evening, cream and terracotta.',
            assetId: 'asset-1',
            confidence: 0.85,
            reasoning: 'Mood and lighting fit a quiet-luxury late-day post.',
          }),
        },
      ],
    });

    const { draftPost } = await import('./draft-post');
    const result = await draftPost(makeInput());
    expect(result.assetId).toBe('asset-1');
    expect(result.confidence).toBeCloseTo(0.85);
    expect(create).toHaveBeenCalledTimes(1);
  });

  it('tolerates surrounding prose', async () => {
    create.mockResolvedValue({
      content: [
        {
          type: 'text',
          text:
            'Sure thing:\n' +
            JSON.stringify({
              copy: 'Morning coffee, morning paper.',
              assetId: 'asset-2',
              confidence: 0.72,
              reasoning: 'Clean-girl fits the voice.',
            }) +
            '\nThat should work.',
        },
      ],
    });
    const { draftPost } = await import('./draft-post');
    const result = await draftPost(makeInput());
    expect(result.assetId).toBe('asset-2');
  });

  it('throws AiDraftError on non-JSON output', async () => {
    create.mockResolvedValue({
      content: [{ type: 'text', text: 'sorry, I cannot help with that.' }],
    });
    const { draftPost, AiDraftError } = await import('./draft-post');
    await expect(draftPost(makeInput())).rejects.toBeInstanceOf(AiDraftError);
  });

  it('rejects copy > 280 chars (schema guard)', async () => {
    create.mockResolvedValue({
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            copy: 'x'.repeat(300),
            assetId: 'asset-1',
            confidence: 0.5,
            reasoning: 'test',
          }),
        },
      ],
    });
    const { draftPost, AiDraftError } = await import('./draft-post');
    await expect(draftPost(makeInput())).rejects.toBeInstanceOf(AiDraftError);
  });

  it('rejects confidence out of range', async () => {
    create.mockResolvedValue({
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            copy: 'ok',
            assetId: 'asset-1',
            confidence: 1.5,
            reasoning: 'test',
          }),
        },
      ],
    });
    const { draftPost, AiDraftError } = await import('./draft-post');
    await expect(draftPost(makeInput())).rejects.toBeInstanceOf(AiDraftError);
  });

  it('rejects assetId not in the pool', async () => {
    create.mockResolvedValue({
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            copy: 'ok',
            assetId: 'asset-does-not-exist',
            confidence: 0.9,
            reasoning: 'test',
          }),
        },
      ],
    });
    const { draftPost, AiDraftError } = await import('./draft-post');
    await expect(draftPost(makeInput())).rejects.toBeInstanceOf(AiDraftError);
  });

  it('allows confidence-0 "no assets fit" with empty pool', async () => {
    create.mockResolvedValue({
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            copy: 'none',
            assetId: 'asset-does-not-exist',
            confidence: 0,
            reasoning: 'Empty pool — nothing to pick.',
          }),
        },
      ],
    });
    const { draftPost } = await import('./draft-post');
    const input = makeInput({ assets: [] });
    const result = await draftPost(input);
    expect(result.confidence).toBe(0);
  });

  it('sets cache_control on the system prompt', async () => {
    create.mockResolvedValue({
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            copy: 'ok',
            assetId: 'asset-1',
            confidence: 0.5,
            reasoning: 'x',
          }),
        },
      ],
    });
    const { draftPost } = await import('./draft-post');
    await draftPost(makeInput());
    const call = create.mock.calls[0]![0];
    expect(call.system[0].cache_control).toEqual({ type: 'ephemeral' });
  });
});
