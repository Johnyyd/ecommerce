import { render, screen } from '@testing-library/react';
import { Button } from './Button';
import { describe, it, expect } from 'vitest';

describe('Button', () => {
  it('renders button with correct text', () => {
    render(<Button>Shop Now</Button>);
    expect(screen.getByText('Shop Now')).toBeInTheDocument();
  });
});
