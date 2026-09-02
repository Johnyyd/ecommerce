import { render, screen } from '@testing-library/react';
import { Hero } from './Hero';
import { describe, it, expect } from 'vitest';

describe('Hero', () => {
  it('renders hero with main CTA', () => {
    render(<Hero />);
    expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument();
    expect(screen.getByText('Explore Collection')).toBeInTheDocument();
  });
});
