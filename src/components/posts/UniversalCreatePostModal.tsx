import React, { useState } from 'react';
import {
  X,
  Plus,
  ImagePlus,
  DollarSign,
  MapPin,
  Clock,
  Tag,
  Megaphone,
  CalendarDays,
  CheckCircle2,
  ShieldCheck,
  Sparkles,
  Trash2,
  ArrowRight,
  UploadCloud,
  FileText
} from 'lucide-react';
import { soundEngine } from '../../utils/SoundEngine';

// =========================================================================
// 1. DATA MODELS & ENUMS
// =========================================================================

export type PostType = 'event' | 'product' | 'announcement';

export interface Post {
  id: string;
  title: string;
  description: string;
  imageUrls: string[];
  type: PostType;
  createdAt: string;
  createdBy: string;
  
  // Event-specific fields
  eventDate?: string;
  eventTime?: string;
  location?: string;
  gateFeeKes?: number;
  
  // Product-specific fields
  priceKes?: number;
  category?: string;
  isAvailable?: boolean;
  stockUnits?: number;
}

// =========================================================================
// 2. REUSABLE WIDGETS
// =========================================================================

interface CustomTextFieldProps {
  label: string;
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
  icon?: React.ReactNode;
  maxLines?: number;
  type?: 'text' | 'number' | 'date' | 'time';
  required?: boolean;
}

export function CustomTextField({
  label,
  value,
  onChange,
  placeholder,
  icon,
  maxLines = 1,
  type = 'text',
  required = false
}: CustomTextFieldProps) {
  return (
    <div className="space-y-1.5 text-xs">
      <label className="font-bold text-gray-700 block">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      <div className="relative flex items-center">
        {icon && (
          <div className="absolute left-3 top-3 text-gray-400 pointer-events-none">
            {icon}
          </div>
        )}
        {maxLines > 1 ? (
          <textarea
            rows={maxLines}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            className={`w-full bg-gray-50 border border-gray-200 rounded-2xl p-3 text-xs text-[#0D1117] outline-none focus:border-[#2563EB] focus:bg-white transition-all ${
              icon ? 'pl-9' : ''
            }`}
          />
        ) : (
          <input
            type={type}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            className={`w-full bg-gray-50 border border-gray-200 rounded-2xl py-2.5 px-3 text-xs text-[#0D1117] outline-none focus:border-[#2563EB] focus:bg-white transition-all ${
              icon ? 'pl-9' : ''
            }`}
          />
        )}
      </div>
    </div>
  );
}

interface MultiImagePickerProps {
  maxImages?: number;
  images: string[];
  onImagesChange: (images: string[]) => void;
}

export function MultiImagePicker({
  maxImages = 5,
  images,
  onImagesChange
}: MultiImagePickerProps) {
  const handleAddSampleImage = () => {
    soundEngine.play('tap');
    if (images.length >= maxImages) return;
    const samplePhotos = [
      'https://images.unsplash.com/photo-1540555700478-4be289fbecef?w=400&auto=format&fit=crop',
      'https://images.unsplash.com/photo-1511556532299-8f662fc26c06?w=400&auto=format&fit=crop',
      'https://images.unsplash.com/photo-1526778548025-fa2f459cd5c1?w=400&auto=format&fit=crop',
      'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=400&auto=format&fit=crop'
    ];
    const picked = samplePhotos[images.length % samplePhotos.length];
    onImagesChange([...images, picked]);
  };

  const handleRemoveImage = (index: number) => {
    soundEngine.play('tap');
    onImagesChange(images.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-2 text-xs">
      <div className="flex items-center justify-between">
        <label className="font-bold text-gray-700">Photos & Media</label>
        <span className="text-[10px] text-gray-500 font-mono">
          {images.length}/{maxImages} images
        </span>
      </div>

      <div className="flex items-center space-x-2 overflow-x-auto pb-1">
        {images.map((img, idx) => (
          <div key={idx} className="relative w-20 h-20 rounded-2xl overflow-hidden border border-gray-200 shrink-0 group">
            <img src={img} alt="Upload preview" className="w-full h-full object-cover" />
            <button
              type="button"
              onClick={() => handleRemoveImage(idx)}
              className="absolute top-1 right-1 w-5 h-5 rounded-full bg-red-600 text-white flex items-center justify-center cursor-pointer shadow-md hover:bg-red-700 transition-colors"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        ))}

        {images.length < maxImages && (
          <button
            type="button"
            onClick={handleAddSampleImage}
            className="w-20 h-20 rounded-2xl bg-gray-50 border-2 border-dashed border-gray-300 hover:border-[#2563EB] flex flex-col items-center justify-center text-gray-500 hover:text-[#2563EB] cursor-pointer transition-colors shrink-0"
          >
            <ImagePlus className="w-5 h-5" />
            <span className="text-[9px] font-bold mt-1">Add Photo</span>
          </button>
        )}
      </div>
    </div>
  );
}

// =========================================================================
// 3. MAIN UNIFIED POST CREATION SCREEN & MODAL
// =========================================================================

interface UniversalCreatePostModalProps {
  isOpen?: boolean;
  initialPostType?: PostType;
  onClose: () => void;
  onPostCreated?: (post: Post) => void;
}

export function UniversalCreatePostModal({
  isOpen = true,
  initialPostType = 'event',
  onClose,
  onPostCreated
}: UniversalCreatePostModalProps) {
  const [postType, setPostType] = useState<PostType>(initialPostType);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [images, setImages] = useState<string[]>([
    'https://images.unsplash.com/photo-1540555700478-4be289fbecef?w=400&auto=format&fit=crop'
  ]);
  
  // Event Fields
  const [eventDate, setEventDate] = useState('Tomorrow');
  const [eventTime, setEventTime] = useState('18:00');
  const [location, setLocation] = useState('Westlands Sarit Centre');
  const [gateFeeKes, setGateFeeKes] = useState<string>('500');

  // Product Fields
  const [priceKes, setPriceKes] = useState<string>('1200');
  const [category, setCategory] = useState<string>('Electronics');
  const [stockUnits, setStockUnits] = useState<string>('5');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');

  if (!isOpen) return null;

  const categories = ['Electronics', 'Clothing & Fashion', 'Food & Produce', 'Home & Decor', 'Professional Services', 'Other'];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    soundEngine.play('victory');
    setIsSubmitting(true);

    const newPost: Post = {
      id: `post-${Date.now()}`,
      title: title.trim(),
      description: description.trim() || 'No description provided.',
      imageUrls: images,
      type: postType,
      createdAt: new Date().toISOString(),
      createdBy: 'You (Verified Member)',
      eventDate: postType === 'event' ? eventDate : undefined,
      eventTime: postType === 'event' ? eventTime : undefined,
      location: postType === 'event' ? location : undefined,
      gateFeeKes: postType === 'event' && gateFeeKes ? Number(gateFeeKes) : undefined,
      priceKes: postType === 'product' && priceKes ? Number(priceKes) : undefined,
      category: postType === 'product' ? category : undefined,
      stockUnits: postType === 'product' && stockUnits ? Number(stockUnits) : undefined,
      isAvailable: true
    };

    setTimeout(() => {
      setIsSubmitting(false);
      setSuccessMsg(`✓ ${postType.toUpperCase()} published successfully to Brief local feed!`);
      onPostCreated?.(newPost);
      setTimeout(() => {
        onClose();
      }, 1400);
    }, 600);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="w-full max-w-lg bg-[#FFFFFF] text-[#0D1117] rounded-3xl border border-[#E5E8EC] shadow-2xl overflow-hidden my-auto animate-scaleUp">
        
        {/* ================= HEADER ================= */}
        <div className="bg-[#0D1117] text-white p-5 flex items-center justify-between">
          <div className="space-y-0.5">
            <span className="text-[10px] font-mono uppercase tracking-wider text-[#FF5A1F] font-black">
              UNIVERSAL PUBLISHER
            </span>
            <h3 className="font-black text-base text-white">
              {postType === 'event' ? 'Publish Event & Gathering' : postType === 'product' ? 'List Marketplace Product' : 'Broadcast Announcement'}
            </h3>
          </div>

          <button
            type="button"
            onClick={() => { soundEngine.play('tap'); onClose(); }}
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white cursor-pointer transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* ================= POST TYPE SELECTOR TABS ================= */}
        <div className="flex border-b border-gray-100 bg-gray-50/70 p-2 gap-1.5">
          {[
            { id: 'event', label: '📅 Event / Popup' },
            { id: 'product', label: '🛍️ Product / Duka' },
            { id: 'announcement', label: '📢 Announcement' }
          ].map(tab => (
            <button
              key={tab.id}
              type="button"
              onClick={() => { soundEngine.play('tap'); setPostType(tab.id as PostType); }}
              className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer text-center ${
                postType === tab.id
                  ? 'bg-white text-[#0D1117] shadow-sm font-black border border-gray-200'
                  : 'text-gray-500 hover:text-gray-900'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* ================= FORM BODY ================= */}
        <form onSubmit={handleSubmit} className="p-5 sm:p-6 space-y-4 max-h-[75vh] overflow-y-auto">
          
          <CustomTextField
            label="Title"
            required
            placeholder={
              postType === 'event'
                ? 'e.g. Kilimani Weekend Creators Market'
                : postType === 'product'
                ? 'e.g. Organic Farm Avocados (Box of 12)'
                : 'e.g. Community Road Maintenance Meeting'
            }
            value={title}
            onChange={setTitle}
          />

          <CustomTextField
            label="Description & Details"
            required
            maxLines={3}
            placeholder="Provide context, schedule, pricing breakdown, or contact instructions..."
            value={description}
            onChange={setDescription}
          />

          {/* Reusable Image Picker */}
          <MultiImagePicker
            maxImages={5}
            images={images}
            onImagesChange={setImages}
          />

          {/* ================= CONDITIONAL FIELDS BY TYPE ================= */}
          
          {/* EVENT FIELDS */}
          {postType === 'event' && (
            <div className="p-3.5 rounded-2xl bg-blue-50/70 border border-blue-100 space-y-3">
              <div className="flex items-center space-x-1.5 text-blue-900 font-bold text-xs">
                <CalendarDays className="w-4 h-4 text-blue-600" />
                <span>Event Schedule & Venue</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <CustomTextField
                  label="Date & Schedule"
                  placeholder="e.g. Saturday, 14 June"
                  value={eventDate}
                  onChange={setEventDate}
                  icon={<CalendarDays className="w-3.5 h-3.5" />}
                />
                <CustomTextField
                  label="Start Time"
                  placeholder="e.g. 18:00 EAT"
                  value={eventTime}
                  onChange={setEventTime}
                  icon={<Clock className="w-3.5 h-3.5" />}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <CustomTextField
                  label="Venue / Landmark"
                  placeholder="e.g. Westlands Sarit Hub"
                  value={location}
                  onChange={setLocation}
                  icon={<MapPin className="w-3.5 h-3.5" />}
                />
                <CustomTextField
                  label="Gate Fee (KES)"
                  placeholder="0 for Free"
                  type="number"
                  value={gateFeeKes}
                  onChange={setGateFeeKes}
                  icon={<DollarSign className="w-3.5 h-3.5" />}
                />
              </div>
            </div>
          )}

          {/* PRODUCT FIELDS */}
          {postType === 'product' && (
            <div className="p-3.5 rounded-2xl bg-emerald-50/70 border border-emerald-100 space-y-3">
              <div className="flex items-center space-x-1.5 text-emerald-900 font-bold text-xs">
                <Tag className="w-4 h-4 text-emerald-600" />
                <span>Pricing & Inventory</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <CustomTextField
                  label="Price (KES)"
                  required
                  type="number"
                  placeholder="e.g. 1200"
                  value={priceKes}
                  onChange={setPriceKes}
                  icon={<DollarSign className="w-3.5 h-3.5" />}
                />

                <div className="space-y-1.5 text-xs">
                  <label className="font-bold text-gray-700">Category</label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full bg-white border border-gray-200 rounded-2xl py-2.5 px-3 text-xs outline-none focus:border-[#2563EB]"
                  >
                    {categories.map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* ANNOUNCEMENT FIELDS */}
          {postType === 'announcement' && (
            <div className="p-3.5 rounded-2xl bg-amber-50/70 border border-amber-100 space-y-2">
              <div className="flex items-center space-x-1.5 text-amber-900 font-bold text-xs">
                <Megaphone className="w-4 h-4 text-amber-600" />
                <span>Civic & Community Scope</span>
              </div>
              <p className="text-[11px] text-amber-800 leading-relaxed">
                Announcements are highlighted in the local neighborhood bulletin and town district feed with verified member authorship.
              </p>
            </div>
          )}

          {successMsg && (
            <div className="p-3 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold flex items-center space-x-2 animate-fadeIn">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-3.5 rounded-2xl bg-[#0D1117] hover:bg-[#1E293B] text-white font-black text-xs uppercase tracking-wider shadow-lg flex items-center justify-center space-x-2 cursor-pointer disabled:opacity-50 transition-all active:scale-95"
          >
            <Sparkles className="w-4 h-4 text-[#FF5A1F]" />
            <span>{isSubmitting ? 'Publishing to Feed…' : `Publish ${postType.toUpperCase()}`}</span>
          </button>
        </form>

      </div>
    </div>
  );
}
