import { render, screen } from '@testing-library/react';
import { Navbar } from './Navbar';
import { describe, it, expect } from 'vitest';

describe('Navbar', () => {
  it('renders floating navbar', () => {
    render(<Navbar />);
    expect(screen.getByRole('navigation')).toBeInTheDocument();
  });
});
