// @vitest-environment jsdom
import { vi, describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import Toolbar from './Toolbar';

const baseProps = {
  voiceLeading: 'smooth' as const,
  playStyle: 'block' as const,
  soundMode: 'organ' as const,
  tuning: 'equal' as const,
  notationMode: 'standard' as const,
  selectedKey: { root: 'C' as const, quality: 'major' as const },
  syntaxHelpOpen: false,
  gravityCenter: 57,
  targetSpread: 12,
  onVoiceLeadingChange: vi.fn(),
  onPlayStyleChange: vi.fn(),
  onSoundModeChange: vi.fn(),
  onTuningChange: vi.fn(),
  onNotationModeChange: vi.fn(),
  onKeyChange: vi.fn(),
  onToggleSyntaxHelp: vi.fn(),
  onExportWav: vi.fn(),
  exportDisabled: false,
  isExporting: false,
  onGravityCenterChange: vi.fn(),
  onTargetSpreadChange: vi.fn(),
};

describe('Toolbar — tuning setting', () => {
  it('clicking Just calls onTuningChange with "just"', () => {
    const onTuningChange = vi.fn();
    render(<Toolbar {...baseProps} onTuningChange={onTuningChange} />);
    fireEvent.click(screen.getByRole('button', { name: 'Just' }));
    expect(onTuningChange).toHaveBeenCalledWith('just');
  });

  it('active tuning is reflected in the button classes', () => {
    render(<Toolbar {...baseProps} tuning="just" />);
    expect(screen.getByRole('button', { name: 'Just' })).toHaveClass('active');
    expect(screen.getByRole('button', { name: 'Equal' })).not.toHaveClass('active');
  });

  it('Equal button is active when tuning is equal', () => {
    render(<Toolbar {...baseProps} tuning="equal" />);
    expect(screen.getByRole('button', { name: 'Equal' })).toHaveClass('active');
    expect(screen.getByRole('button', { name: 'Just' })).not.toHaveClass('active');
  });
});

describe('Toolbar — notation mode setting', () => {
  it('clicking Roman calls onNotationModeChange with "roman"', () => {
    const onNotationModeChange = vi.fn();
    render(<Toolbar {...baseProps} onNotationModeChange={onNotationModeChange} />);
    fireEvent.click(screen.getByRole('button', { name: 'Roman' }));
    expect(onNotationModeChange).toHaveBeenCalledWith('roman');
  });

  it('active notation mode is shown as active button', () => {
    render(<Toolbar {...baseProps} notationMode="roman" />);
    expect(screen.getByRole('button', { name: 'Roman' })).toHaveClass('active');
    expect(screen.getByRole('button', { name: 'Standard' })).not.toHaveClass('active');
  });
});
