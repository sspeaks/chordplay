// @vitest-environment jsdom
// This file tests URL-state hydration in isolation from App.test.tsx because
// App.tsx captures `decodeUrlState(window.location.hash)` at module load time.
// vi.mock is hoisted before the import, so the mock intercepts that module-level
// call and seeds the component with a non-default chord sequence.
import { vi, describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

vi.mock('./engine/audio', async (importOriginal) => {
  const mod = await importOriginal<typeof import('./engine/audio')>();
  return {
    ...mod,
    ChordPlayer: vi.fn().mockImplementation(() => ({
      warmUp: vi.fn(),
      playChord: vi.fn(),
      playSequence: vi.fn().mockResolvedValue(undefined),
      stopCurrent: vi.fn(),
    })),
    renderSequenceOffline: vi.fn().mockResolvedValue(null),
  };
});

// Spread the real module to preserve DEFAULTS, encodeUrlState, etc.
// Override only decodeUrlState so the module-level initialUrlState in App.tsx
// starts with a populated chord sequence as if loaded from a shared URL.
vi.mock('./engine/urlState', async (importOriginal) => {
  const mod = await importOriginal<typeof import('./engine/urlState')>();
  return {
    ...mod,
    decodeUrlState: vi.fn().mockReturnValue({ chordText: 'C Am' }),
  };
});

import App from './App';

describe('App — URL state hydration', () => {
  it('populates the chord input from URL-encoded state', () => {
    render(<App />);
    expect(screen.getByRole('textbox')).toHaveValue('C Am');
  });

  it('shows the correct chord count for the hydrated sequence', () => {
    render(<App />);
    expect(screen.getByRole('status')).toHaveTextContent('Chord 1 of 2');
  });
});
