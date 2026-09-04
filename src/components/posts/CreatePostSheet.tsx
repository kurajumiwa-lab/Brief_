import React, { useState } from 'react';
import {
  CalendarDays,
  ShoppingBag,
  Megaphone,
  ArrowLeft,
  X,
  ImagePlus,
  Plus,
  Sparkles,
  CheckCircle2,
  Trash2
} from 'lucide-react';
import { AppPalette, AppTypography, AppSpacing } from '../../styles/appPalette';
import { VisualToggle, VisualToggleOption } from '../ui/VisualToggle';
import { soundEngine } from '../../utils/SoundEngine';
import type { Post } from './UniversalCreatePostModal';

export interface CreatePostSheetProps {
  isOpen: boolean;
  onClose: () => void;
  onPostCreated?: (post: any) => void;
}

export const CreatePostSheet: React.FC<CreatePostSheetProps> = ({
  isOpen,
  onClose,
  onPostCreated
}) => {
  const [step, setStep] = useState<0 | 1>(0);
  const [postType, setPostType] = useState<number>(0);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [images, setImages] = useState<string[]>([]);
  const [isPublishing, setIsPublishing] = useState(false);

  if (!isOpen) return null;

  const typeOptions: VisualToggleOption[] = [
    { id: 'event', label: 'Event', icon: <CalendarDays className="w-8 h-8" /> },
    { id: 'product', label: 'Product', icon: <ShoppingBag className="w-8 h-8" /> },
    { id: 'announce', label: 'Announce', icon: <Megaphone className="w-8 h-8" /> }
  ];

  const samplePhotos = [
    'https://images.unsplash.com/photo-1540555700478-4be289fbecef?w=800&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?w=800&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1542601906990-b4d3fb778b09?w=800&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1587049352846-4a222e784d38?w=800&auto=format&fit=crop'
  ];

  const handleAddPhoto = () => {
    if (images.length >= 5) return;
    soundEngine.play('tap');
    const picked = samplePhotos[images.length % samplePhotos.length];
    setImages([...images, picked]);
  };

  const handleRemovePhoto = (idx: number, e: React.MouseEvent) => {
    e.stopPropagation();
    soundEngine.play('tap');
    setImages(images.filter((_, i) => i !== idx));
  };

  const handleNextStep = () => {
    soundEngine.play('tap');
    setStep(1);
  };

  const handlePrevStep = () => {
    soundEngine.play('tap');
    setStep(0);
  };

  const handlePublish = () => {
    if (!title.trim()) {
      soundEngine.play('defeat');
      return;
    }

    soundEngine.play('victory');
    setIsPublishing(true);

    const typeNames = ['event', 'product', 'announcement'] as const;
    const resolvedType = typeNames[postType];

    const newPost = {
      id: `post-${Date.now()}`,
      title: title.trim(),
      description: description.trim() || 'Shared via Brief mobile creator.',
      imageUrls: images.length > 0 ? images : [samplePhotos[0]],
      type: resolvedType,
      createdAt: new Date().toISOString(),
      createdBy: 'You (Verified Member)'
    };

    setTimeout(() => {
      setIsPublishing(false);
      onPostCreated?.(newPost);
      onClose();
    }, 450);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex flex-col justify-end p-0 animate-fadeIn"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-xl mx-auto rounded-t-[32px] overflow-hidden shadow-2xl max-h-[90vh] flex flex-col animate-slideUp transition-all"
        style={{ backgroundColor: AppPalette.surface }}
      >
        {/* Drag Handle */}
        <div className="w-full flex justify-center pt-3 pb-2">
          <div className="w-10 h-1 rounded-full bg-[#1A1F2E]/20" />
        </div>

        {/* Header with Back/Close and Step Indicator */}
        <div className="px-6 py-2 flex items-center justify-between">
          <button
            type="button"
            onClick={step === 1 ? handlePrevStep : onClose}
            className="w-9 h-9 rounded-full flex items-center justify-center text-[#6B7280] hover:text-[#1A1F2E] hover:bg-black/5 transition-colors cursor-pointer"
            aria-label={step === 1 ? 'Go back' : 'Close sheet'}
          >
            {step === 1 ? <ArrowLeft className="w-5 h-5" /> : <X className="w-5 h-5" />}
          </button>

          {/* Minimal Pill Dots Step Indicator */}
          <div className="flex items-center space-x-1.5">
            {[0, 1].map((i) => (
              <div
                key={i}
                className="h-2 rounded-full transition-all duration-300"
                style={{
                  width: step === i ? '24px' : '8px',
                  backgroundColor: step >= i ? AppPalette.primary : AppPalette.surfaceAlt
                }}
              />
            ))}
          </div>

          <div className="w-9" /> {/* Visual balance */}
        </div>

        {/* Sheet Body Container */}
        <div className="p-6 overflow-y-auto flex-1">
          
          {/* ================= STEP 0: TYPE SELECTION ================= */}
          {step === 0 && (
            <div className="space-y-6 animate-fadeIn">
              <div className="space-y-1">
                <h2 className="text-2xl font-extrabold text-[#1A1F2E]">
                  What are you sharing?
                </h2>
                <p className="text-xs text-[#6B7280]">
                  Select the category that best matches your post.
                </p>
              </div>

              <VisualToggle
                options={typeOptions}
                selectedIndex={postType}
                onChanged={(idx) => setPostType(idx)}
              />

              <div className="pt-6">
                <button
                  type="button"
                  onClick={handleNextStep}
                  className="w-full py-4 rounded-2xl text-white font-bold text-[15px] tracking-wide shadow-lg transition-transform active:scale-98 cursor-pointer"
                  style={{
                    backgroundColor: AppPalette.primary,
                    boxShadow: '0 8px 24px rgba(11, 110, 110, 0.35)'
                  }}
                >
                  Continue
                </button>
              </div>
            </div>
          )}

          {/* ================= STEP 1: DETAILS & IMAGES ================= */}
          {step === 1 && (
            <div className="space-y-5 animate-fadeIn">
              <div className="space-y-1">
                <h2 className="text-2xl font-extrabold text-[#1A1F2E]">
                  Add the details
                </h2>
                <p className="text-xs text-[#6B7280]">
                  Upload photos and describe what you are offering to the community.
                </p>
              </div>

              {/* Image-First: Large Tap Area or Horizontal Row */}
              {images.length === 0 ? (
                <div
                  onClick={handleAddPhoto}
                  className="w-full h-40 rounded-[20px] flex flex-col items-center justify-center cursor-pointer transition-all hover:bg-[#E8E4DD]/70 border-2 border-dashed border-[#0B6E6E]/30"
                  style={{ backgroundColor: 'rgba(232, 228, 221, 0.5)' }}
                >
                  <ImagePlus className="w-12 h-12 text-[#0B6E6E]/60 mb-2" />
                  <span className="text-sm font-bold text-[#0B6E6E]">
                    Tap to add photos
                  </span>
                  <span className="text-[11px] text-[#9CA3AF] mt-0.5">
                    Up to 5 images
                  </span>
                </div>
              ) : (
                <div className="flex items-center space-x-3 overflow-x-auto pb-2">
                  {images.map((img, idx) => (
                    <div
                      key={idx}
                      className="relative w-24 h-28 rounded-2xl overflow-hidden shrink-0 shadow-md group"
                    >
                      <img
                        src={img}
                        alt={`Upload ${idx + 1}`}
                        className="w-full h-full object-cover"
                      />
                      <button
                        type="button"
                        onClick={(e) => handleRemovePhoto(idx, e)}
                        className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-red-600 text-white flex items-center justify-center shadow-md cursor-pointer hover:bg-red-700"
                        aria-label="Remove photo"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}

                  {images.length < 5 && (
                    <button
                      type="button"
                      onClick={handleAddPhoto}
                      className="w-24 h-28 rounded-2xl flex flex-col items-center justify-center shrink-0 cursor-pointer transition-colors"
                      style={{ backgroundColor: 'rgba(232, 228, 221, 0.5)' }}
                      aria-label="Add more photos"
                    >
                      <Plus className="w-6 h-6 text-[#9CA3AF]" />
                      <span className="text-[10px] text-[#9CA3AF] font-bold mt-1">Add More</span>
                    </button>
                  )}
                </div>
              )}

              {/* Title Field */}
              <div className="space-y-1">
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Give it a title..."
                  className="w-full p-4 rounded-2xl text-base font-bold text-[#1A1F2E] placeholder-[#9CA3AF] outline-none border-none shadow-sm focus:ring-2 focus:ring-[#0B6E6E]"
                  style={{ backgroundColor: AppPalette.surfaceAlt }}
                />
              </div>

              {/* Description Field */}
              <div className="space-y-1">
                <textarea
                  rows={3}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Tell people more..."
                  className="w-full p-4 rounded-2xl text-sm text-[#1A1F2E] placeholder-[#9CA3AF] outline-none border-none shadow-sm focus:ring-2 focus:ring-[#0B6E6E] resize-none"
                  style={{ backgroundColor: AppPalette.surfaceAlt }}
                />
              </div>

              {/* Publish Button */}
              <div className="pt-3 pb-2">
                <button
                  type="button"
                  onClick={handlePublish}
                  disabled={isPublishing}
                  className="w-full py-4 rounded-2xl text-white font-bold text-[15px] tracking-wide shadow-lg transition-transform active:scale-98 cursor-pointer disabled:opacity-50"
                  style={{
                    background: `linear-gradient(135deg, ${AppPalette.primary} 0%, ${AppPalette.primaryLight} 100%)`,
                    boxShadow: '0 8px 24px rgba(11, 110, 110, 0.4)'
                  }}
                >
                  {isPublishing ? 'Publishing…' : 'Publish'}
                </button>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
};
