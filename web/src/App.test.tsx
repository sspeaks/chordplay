// @vitest-environment jsdom
// Mocks are hoisted before any import — they intercept App.tsx's module-level
// `const initialUrlState = decodeUrlState(window.location.hash)` call, so the
// App mounts with an empty hash and uses all DEFAULTS.
import { vi, describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

// Prevent AudioContext creation: ChordPlayer is only instantiated on user
// interaction, but keyboard navigation calls playSingleChord which would
// try to construct one. The fake replaces the class entirely.
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
    renderSequenceOffline: vi.fn().mockResolvedValue({
      numberOfChannels: 1,
      sampleRate: 44100,
      length: 100,
      duration: 100 / 44100,
      getChannelData: vi.fn().mockReturnValue(new Float32Array(100)),
    }),
  };
});

import App from './App';

describe('App — initial render', () => {
  it('renders the application heading', () => {
    render(<App />);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('♩ ChordPlay');
  });

  it('shows "No chords" counter with empty default input', () => {
    render(<App />);
    // .chord-counter is used instead of getByRole('status') because the merged
    // Toolbar (PR #18) added a second hidden role="status" span for clipboard
    // announcements, making the role selector ambiguous at App level.
    expect(document.querySelector('.chord-counter')).toHaveTextContent('No chords');
  });

  it('renders a text input for chord entry', () => {
    render(<App />);
    expect(screen.getByRole('textbox')).toBeInTheDocument();
  });
});

describe('App — chord input', () => {
  it('updates chord counter after entering valid chords', () => {
    render(<App />);
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'C Am G' } });
    expect(document.querySelector('.chord-counter')).toHaveTextContent('Chord 1 of 3');
  });

  it('shows "No chords" for all-invalid input', () => {
    render(<App />);
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'ZZZ YYY' } });
    expect(document.querySelector('.chord-counter')).toHaveTextContent('No chords');
  });
});

describe('App — keyboard navigation', () => {
  it('ArrowRight advances to the next chord', () => {
    render(<App />);
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'C Am G' } });
    // Blur textarea so the keyboard handler processes the event
    fireEvent.blur(screen.getByRole('textbox'));
    fireEvent.keyDown(window, { key: 'ArrowRight' });
    expect(document.querySelector('.chord-counter')).toHaveTextContent('Chord 2 of 3');
  });

  it('ArrowLeft moves to the previous chord', () => {
    render(<App />);
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'C Am G' } });
    fireEvent.blur(screen.getByRole('textbox'));
    fireEvent.keyDown(window, { key: 'ArrowRight' });
    fireEvent.keyDown(window, { key: 'ArrowLeft' });
    expect(document.querySelector('.chord-counter')).toHaveTextContent('Chord 1 of 3');
  });

  it('does not navigate when the textarea is focused', () => {
    render(<App />);
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'C Am G' } });
    // Fire keyDown on the textarea itself — bubbles to window with e.target=TEXTAREA
    fireEvent.keyDown(screen.getByRole('textbox'), { key: 'ArrowRight' });
    expect(document.querySelector('.chord-counter')).toHaveTextContent('Chord 1 of 3');
  });
});

describe('App — setting change propagates to rendered output', () => {
  it('clicking Just tuning makes the Just button active', () => {
    render(<App />);
    const justBtn = screen.getByRole('button', { name: 'Just' });
    // Default tuning is "equal"; Just should not be active yet
    expect(justBtn).not.toHaveClass('active');
    fireEvent.click(justBtn);
    expect(justBtn).toHaveClass('active');
    expect(screen.getByRole('button', { name: 'Equal' })).not.toHaveClass('active');
  });
});
