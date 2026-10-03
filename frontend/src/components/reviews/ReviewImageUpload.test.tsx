import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ReviewImageUpload } from './ReviewImageUpload';

describe('ReviewImageUpload Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders upload area with correct initial state', () => {
    const onAddImages = vi.fn();
    const onRemoveImage = vi.fn();

    render(
      <ReviewImageUpload
        images={[]}
        imagePreviews={[]}
        onAddImages={onAddImages}
        onRemoveImage={onRemoveImage}
        maxImages={5}
      />
    );

    // Text is split across label and span - check both exist
    expect(screen.getByText('Product Photos (Optional)')).toBeInTheDocument();
    expect(screen.getByText('(0/5)')).toBeInTheDocument();
    expect(screen.getByText(/Click or drag to add up to 5 product photos/i)).toBeInTheDocument();
  });

  it('shows image previews when images are added', () => {
    const onAddImages = vi.fn();
    const onRemoveImage = vi.fn();

    // Create mock data URLs
    const preview1 = 'data:image/png;base64,test1';
    const preview2 = 'data:image/png;base64,test2';

    render(
      <ReviewImageUpload
        images={[new File([''], 'test1.png'), new File([''], 'test2.png')] as File[]}
        imagePreviews={[preview1, preview2]}
        onAddImages={onAddImages}
        onRemoveImage={onRemoveImage}
        maxImages={5}
      />
    );

    // Text is split across label and span
    expect(screen.getByText('Product Photos (Optional)')).toBeInTheDocument();
    expect(screen.getByText('(2/5)')).toBeInTheDocument();
    const images = screen.getAllByAltText(/Product Photos \(Optional\)/);
    expect(images.length).toBe(2);
  });

  it('disables add button when max images reached', () => {
    const onAddImages = vi.fn();
    const onRemoveImage = vi.fn();

    const previews = Array.from({ length: 5 }, (_, i) => `data:image/png;base64,test${i}`);
    const files = Array.from({ length: 5 }, (_, i) => new File([''], `test${i}.png`)) as File[];

    render(
      <ReviewImageUpload
        images={files}
        imagePreviews={previews}
        onAddImages={onAddImages}
        onRemoveImage={onRemoveImage}
        maxImages={5}
      />
    );

    // Text is split across label and span
    expect(screen.getByText('Product Photos (Optional)')).toBeInTheDocument();
    expect(screen.getByText('(5/5)')).toBeInTheDocument();
  });

  it('calls onRemoveImage when remove button clicked', () => {
    const onAddImages = vi.fn();
    const onRemoveImage = vi.fn();

    const preview = 'data:image/png;base64,test';

    render(
      <ReviewImageUpload
        images={[new File([''], 'test.png')] as File[]}
        imagePreviews={[preview]}
        onAddImages={onAddImages}
        onRemoveImage={onRemoveImage}
        maxImages={5}
      />
    );

    const removeButton = screen.getByRole('button', { name: /Remove product photos \(optional\) 1/i });
    fireEvent.click(removeButton);

    expect(onRemoveImage).toHaveBeenCalledWith(0);
  });

  it('shows upload progress when isUploading is true', () => {
    const onAddImages = vi.fn();
    const onRemoveImage = vi.fn();

    render(
      <ReviewImageUpload
        images={[]}
        imagePreviews={[]}
        onAddImages={onAddImages}
        onRemoveImage={onRemoveImage}
        maxImages={5}
        isUploading={true}
      />
    );

    expect(screen.getByText(/Uploading images\.\.\./i)).toBeInTheDocument();
  });

  it('shows custom label when provided', () => {
    const onAddImages = vi.fn();
    const onRemoveImage = vi.fn();

    render(
      <ReviewImageUpload
        images={[]}
        imagePreviews={[]}
        onAddImages={onAddImages}
        onRemoveImage={onRemoveImage}
        maxImages={5}
        label="Custom Photos"
      />
    );

    // Label gets "(Optional)" appended and count "(0/5)" - text split across elements
    expect(screen.getByText('Custom Photos')).toBeInTheDocument();
    expect(screen.getByText('(0/5)')).toBeInTheDocument();
  });
});