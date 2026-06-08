import { describe, it, expect } from 'vitest';
import { VOICE_PARTS } from './types';

describe('VOICE_PARTS', () => {
  it('orders barbershop roles from low to high, with Lead before Tenor', () => {
    expect(VOICE_PARTS).toEqual(['Bass', 'Bari', 'Lead', 'Tenor']);
  });
});
