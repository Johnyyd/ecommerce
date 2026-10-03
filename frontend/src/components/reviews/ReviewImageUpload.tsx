import React, { useState, useRef } from 'react';
import { Plus, X, Upload } from '@phosphor-icons/react';
import { toast } from 'sonner';

export interface ReviewImageUploadProps {
  /** Current image files */
  images: File[];
  /** Current image preview URLs */
  imagePreviews: string[];
  /** Callback when new images are selected */
  onAddImages: (files: File[]) => void;
  /** Callback when an image is removed */
  onRemoveImage: (index: number) => void;
  /** Maximum number of images allowed */
  maxImages?: number;
  /** Whether upload is in progress */
  isUploading?: boolean;
  /** Custom accept types */
  accept?: string;
  /** Custom label */
  label?: string;
}

export const ReviewImageUpload: React.FC<ReviewImageUploadProps> = ({
  images,
  imagePreviews,
  onAddImages,
  onRemoveImage,
  maxImages = 5,
  isUploading = false,
  accept = 'image/*',
  label = 'Product Photos (Optional)'
}) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragActive, setDragActive] = useState(false);

  const triggerFileSelect = () => {
    if (images.length < maxImages && !isUploading) {
      inputRef.current?.click();
    } else if (images.length >= maxImages) {
      toast.error(`Maximum ${maxImages} images allowed`);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const remainingSlots = maxImages - images.length;
    const newFiles = files.slice(0, remainingSlots);

    if (newFiles.length > 0) {
      onAddImages(newFiles);
    }

    // Reset input value to allow selecting same file again
    if (e.target) {
      e.target.value = '';
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (images.length < maxImages && !isUploading) {
      setDragActive(true);
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (images.length >= maxImages || isUploading) return;

    const files = Array.from(e.dataTransfer.files);
    const imageFiles = files.filter(file => file.type.startsWith('image/'));
    const remainingSlots = maxImages - images.length;
    const newFiles = imageFiles.slice(0, remainingSlots);

    if (newFiles.length > 0) {
      onAddImages(newFiles);
    } else if (imageFiles.length === 0 && files.length > 0) {
      toast.error('Only image files are allowed');
    }
  };

  const handleRemoveImage = (index: number) => {
    onRemoveImage(index);
  };

  return (
    <div className="space-y-4">
      <label className="block text-xs font-medium text-zinc-600 flex items-center gap-2">
        {label}
        <span className="text-xs text-zinc-400">({images.length}/{maxImages})</span>
      </label>

      <input
        ref={inputRef}
        type="file"
        accept={accept}
        multiple
        onChange={handleFileSelect}
        className="hidden"
        id="review-image-upload"
        disabled={images.length >= maxImages || isUploading}
      />

      {/* Drop Zone / Upload Button */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={triggerFileSelect}
        className={`
          w-full md:w-1/2 px-4 py-6 border-2 border-dashed rounded-2xl
          text-center text-sm transition-all cursor-pointer
          ${dragActive ? 'border-zinc-900 bg-zinc-50 dark:bg-zinc-800/50' : 'border-zinc-200 dark:border-zinc-700 hover:border-zinc-300 hover:bg-zinc-50/50'}
          ${images.length >= maxImages || isUploading ? 'opacity-50 cursor-not-allowed' : ''}
        `}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            triggerFileSelect();
          }
        }}
        aria-label={`Upload review images. ${images.length} of ${maxImages} slots used.`}
      >
        <div className="flex flex-col items-center gap-2">
          <div className={`
            w-12 h-12 rounded-full flex items-center justify-center mx-auto
            ${dragActive ? 'bg-zinc-900 text-white' : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-400'}
            transition-colors
          `}>
            <Upload size={24} weight="bold" />
          </div>
          <div className="text-xs">
            {images.length >= maxImages
              ? 'Maximum images reached'
              : dragActive
                ? 'Drop images here'
                : 'Click or drag to add up to 5 product photos'}
          </div>
          <div className="text-[10px] text-zinc-400">
            PNG, JPG, WebP up to 5MB each
          </div>
        </div>
      </div>

      {/* Image Previews Grid */}
      {imagePreviews.length > 0 && (
        <div
          className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3"
          role="list"
          aria-label="Review image previews"
        >
          {imagePreviews.map((preview, index) => (
            <div
              key={index}
              className="relative group w-full aspect-square rounded-xl overflow-hidden bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700"
              role="listitem"
            >
              <img
                src={preview}
                alt={`${label} ${index + 1}`}
                className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                loading="lazy"
              />
              {/* Overlay with remove button */}
              <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  type="button"
                  onClick={() => handleRemoveImage(index)}
                  disabled={isUploading}
                  className="w-8 h-8 rounded-full bg-red-500 text-white text-sm flex items-center justify-center hover:bg-red-600 transition-colors shadow-lg"
                  aria-label={`Remove ${label.toLowerCase()} ${index + 1}`}
                >
                  <X size={16} weight="bold" />
                </button>
              </div>

              {/* Image number badge */}
              <div className="absolute top-1 left-1 w-5 h-5 rounded-full bg-black/50 text-white text-[10px] font-medium flex items-center justify-center">
                {index + 1}
              </div>
            </div>
          ))}

          {/* Add more placeholder if not at max */}
          {images.length < maxImages && (
            <button
              type="button"
              onClick={triggerFileSelect}
              disabled={isUploading}
              className="relative w-full aspect-square rounded-xl border-2 border-dashed border-zinc-200 dark:border-zinc-700 bg-zinc-50/50 dark:bg-zinc-800/30 flex flex-col items-center justify-center gap-1 text-zinc-400 hover:border-zinc-300 hover:bg-zinc-100/50 hover:text-zinc-500 transition-all disabled:opacity-50"
              aria-label={`Add more ${label.toLowerCase()}`}
            >
              <Plus size={20} weight="bold" />
              <span className="text-[10px]">Add more</span>
            </button>
          )}
        </div>
      )}

      {/* Upload progress indicator */}
      {isUploading && (
        <div className="flex items-center gap-2 text-xs text-zinc-500">
          <div className="w-4 h-4 border-2 border-zinc-200 border-t-zinc-900 rounded-full animate-spin" />
          <span>Uploading images...</span>
        </div>
      )}
    </div>
  );
};

// Alternative compact version for inline use
export const ReviewImageUploadCompact: React.FC<ReviewImageUploadProps> = ({
  images,
  imagePreviews,
  onAddImages,
  onRemoveImage,
  maxImages = 5,
  isUploading = false,
  accept = 'image/*',
}) => {
  const inputRef = useRef<HTMLInputElement>(null);

  const triggerFileSelect = () => {
    if (images.length < maxImages && !isUploading) {
      inputRef.current?.click();
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const remainingSlots = maxImages - images.length;
    const newFiles = files.slice(0, remainingSlots);

    if (newFiles.length > 0) {
      onAddImages(newFiles);
    }

    if (e.target) {
      e.target.value = '';
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="text-xs font-medium text-zinc-600 flex items-center gap-1">
          Product Photos
          <span className="text-zinc-400">({images.length}/{maxImages})</span>
        </label>
        {images.length < maxImages && !isUploading && (
          <button
            type="button"
            onClick={triggerFileSelect}
            className="text-xs text-zinc-500 hover:text-zinc-700 flex items-center gap-1"
          >
            <Plus size={14} />
            Add
          </button>
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept={accept}
        multiple
        onChange={handleFileSelect}
        className="hidden"
        id="review-image-upload-compact"
        disabled={images.length >= maxImages || isUploading}
      />

      {imagePreviews.length > 0 && (
        <div className="flex gap-2 overflow-x-auto pb-2" role="list" aria-label="Review image previews">
          {imagePreviews.map((preview, index) => (
            <div
              key={index}
              className="relative w-20 h-20 flex-shrink-0 rounded-lg overflow-hidden bg-zinc-100 border border-zinc-200"
              role="listitem"
            >
              <img
                src={preview}
                alt={`Review photo ${index + 1}`}
                className="w-full h-full object-cover"
              />
              <button
                type="button"
                onClick={() => onRemoveImage(index)}
                disabled={isUploading}
                className="absolute top-1 right-1 w-5 h-5 rounded-full bg-red-500 text-white text-xs flex items-center justify-center hover:bg-red-600 transition-colors shadow-sm"
                aria-label={`Remove image ${index + 1}`}
              >
                <X size={12} weight="bold" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};