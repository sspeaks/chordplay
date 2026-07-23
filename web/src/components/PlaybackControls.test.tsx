// @vitest-environment jsdom
import { vi, describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import PlaybackControls from './PlaybackControls';

const baseProps = {
  isPlaying: false,
  tempo: 0.8,
  currentChordIndex: 0,
  totalChords: 3,
  onPlay: vi.fn(),
  onStop: vi.fn(),
  onPrev: vi.fn(),
  onNext: vi.fn(),
  onReset: vi.fn(),
  onTempoChange: vi.fn(),
};

describe('PlaybackControls — transport callbacks', () => {
  it('clicking Play fires onPlay', () => {
    const onPlay = vi.fn();
    render(<PlaybackControls {...baseProps} onPlay={onPlay} />);
    fireEvent.click(screen.getByRole('button', { name: 'Play from current chord' }));
    expect(onPlay).toHaveBeenCalledTimes(1);
  });

  it('shows Stop button when isPlaying and fires onStop', () => {
    const onStop = vi.fn();
    render(<PlaybackControls {...baseProps} isPlaying={true} onStop={onStop} />);
    const stopBtn = screen.getByRole('button', { name: 'Stop' });
    expect(stopBtn).toBeInTheDocument();
    fireEvent.click(stopBtn);
    expect(onStop).toHaveBeenCalledTimes(1);
  });

  it('clicking Previous fires onPrev', () => {
    const onPrev = vi.fn();
    render(<PlaybackControls {...baseProps} onPrev={onPrev} />);
    fireEvent.click(screen.getByRole('button', { name: 'Previous chord' }));
    expect(onPrev).toHaveBeenCalledTimes(1);
  });

  it('clicking Next fires onNext', () => {
    const onNext = vi.fn();
    render(<PlaybackControls {...baseProps} onNext={onNext} />);
    fireEvent.click(screen.getByRole('button', { name: 'Next chord' }));
    expect(onNext).toHaveBeenCalledTimes(1);
  });
});

describe('PlaybackControls — disabled state', () => {
  it('transport buttons are disabled when totalChords is 0', () => {
    render(<PlaybackControls {...baseProps} totalChords={0} />);
    expect(screen.getByRole('button', { name: 'Play from current chord' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Previous chord' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Next chord' })).toBeDisabled();
  });
});

describe('PlaybackControls — chord counter', () => {
  it('shows current position', () => {
    render(<PlaybackControls {...baseProps} currentChordIndex={1} totalChords={5} />);
    expect(screen.getByRole('status')).toHaveTextContent('Chord 2 of 5');
  });

  it('shows "No chords" when totalChords is 0', () => {
    render(<PlaybackControls {...baseProps} totalChords={0} />);
    expect(screen.getByRole('status')).toHaveTextContent('No chords');
  });
});
