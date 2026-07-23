// @vitest-environment jsdom
import { vi, describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import ChordInput from './ChordInput';
import { parseChordSequence } from '../engine/parser';

interface RenderOptions {
  value?: string;
  currentChordIndex?: number;
  isPlaying?: boolean;
}

function renderInput({ value = '', currentChordIndex = 0, isPlaying = false }: RenderOptions = {}) {
  const onChange = vi.fn();
  const parseResults = parseChordSequence(value);
  render(
    <ChordInput
      value={value}
      onChange={onChange}
      currentChordIndex={currentChordIndex}
      isPlaying={isPlaying}
      parseResults={parseResults}
    />,
  );
  return { onChange };
}

describe('ChordInput — textarea', () => {
  it('renders a text input', () => {
    renderInput();
    expect(screen.getByRole('textbox')).toBeInTheDocument();
  });

  it('fires onChange with the new value when the user types', () => {
    const { onChange } = renderInput();
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'C' } });
    expect(onChange).toHaveBeenCalledWith('C');
  });

  it('is readonly while isPlaying', () => {
    renderInput({ value: 'C Am', isPlaying: true });
    expect(screen.getByRole('textbox')).toHaveAttribute('readonly');
  });
});

describe('ChordInput — syntax highlighting overlay', () => {
  it('shows the overlay when not focused', () => {
    renderInput({ value: 'C Am' });
    // The aria-hidden overlay is present by default (unfocused, not playing)
    expect(document.querySelector('.chord-input-display')).toBeInTheDocument();
  });

  it('marks valid chord tokens with chord-token class', () => {
    renderInput({ value: 'C Am' });
    const tokens = document.querySelectorAll('.chord-token');
    expect(tokens).toHaveLength(2);
  });

  it('marks invalid chord tokens with chord-invalid class', () => {
    renderInput({ value: 'C ZZZZZ G' });
    const invalid = document.querySelectorAll('.chord-invalid');
    expect(invalid).toHaveLength(1);
    expect(invalid[0]).toHaveTextContent('ZZZZZ');
  });

  it('highlights the active chord with chord-active class', () => {
    // currentChordIndex=1 → Am is the active chord (0-based valid-chord index)
    const onChange = vi.fn();
    const value = 'C Am G';
    render(
      <ChordInput
        value={value}
        onChange={onChange}
        currentChordIndex={1}
        isPlaying={false}
        parseResults={parseChordSequence(value)}
      />,
    );
    expect(document.querySelector('.chord-active')).toHaveTextContent('Am');
  });
});
