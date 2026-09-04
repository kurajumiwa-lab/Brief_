import React, { useState } from 'react';
import {
  Sparkles,
  CalendarDays,
  ShoppingBag,
  Megaphone,
  User,
  MessageCircle,
  Send,
  X,
  Plus,
  MapPin,
  Clock,
  Tag,
  Share2,
  Check,
  ExternalLink,
  Users,
  Bike
} from 'lucide-react';
import {
  DepthBackground,
  GlassCard,
  FloatingPill,
  VisualToggle,
  VisualToggleOption
} from '../components/ui';
import { AppPalette } from '../styles/appPalette';
import { UniversalCreatePostModal, Post } from '../components/posts/UniversalCreatePostModal';
import { soundEngine } from '../utils/SoundEngine';

export interface DiscoverPost {
  id: string;
  title: string;
  description: string;
  image: string;
  price?: string;
  date?: string;
  time?: string;
  location?: string;
  type: 'event' | 'product' | 'announcement';
  author: string;
  phone?: string;
  telegram?: string;
}

export const INITIAL_DISCOVER_POSTS: DiscoverPost[] = [
  {
    id: 'post-1',
    title: 'Kilimani Weekend Creators Market & Live Acoustic',
    description: 'Join local artisans, organic coffee roasters, and live vinyl DJs at the Kilimani Community Grounds. Over 40 verified creative vendors.',
    image: 'https://images.unsplash.com/photo-1540555700478-4be289fbecef?w=800&auto=format&fit=crop',
    date: 'Saturday',
    time: '11:00 AM',
    location: 'Kilimani Grounds, Nairobi',
    type: 'event',
    author: 'Kilimani Arts Collective',
    phone: '+254712345678',
    telegram: 'kilimani_arts'
  },
  {
    id: 'post-2',
    title: 'Handcrafted Ceramic Stoneware Mug Set',
    description: 'Locally sculpted Kenyan clay mugs with wood-fired glaze. Dishwasher safe, high-durability kitchenware crafted in Karen.',
    image: 'https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?w=800&auto=format&fit=crop',
    price: 'KES 2,400',
    location: 'Karen Studio Hub',
    type: 'product',
    author: 'Clay & Co. Karen',
    phone: '+254722998877',
    telegram: 'clay_studio_ke'
  },
  {
    id: 'post-3',
    title: 'Westlands Neighborhood Clean-up & Tree Planting',
    description: 'Civic community drive to green the Rhapta Road wetland corridor. Gloves, seedlings, and refreshments provided by local resident chama.',
    image: 'https://images.unsplash.com/photo-1542601906990-b4d3fb778b09?w=800&auto=format&fit=crop',
    date: 'Jun 18',
    time: '08:30 AM',
    location: 'Rhapta Road, Westlands',
    type: 'event',
    author: 'Westlands Green Committee',
    phone: '+254700112233',
    telegram: 'westlands_civic'
  },
  {
    id: 'post-4',
    title: 'Pure Raw Organic Honey (1kg Jar)',
    description: 'Unprocessed acacia forest honey harvested sustainably from Kitui County. 100% pure certified by Kenya Organic Agriculture Network.',
    image: 'https://images.unsplash.com/photo-1587049352846-4a222e784d38?w=800&auto=format&fit=crop',
    price: 'KES 950',
    location: 'CBD Pick-up Point',
    type: 'product',
    author: 'Kitui Pure Harvest',
    phone: '+254733445566',
    telegram: 'kitui_honey'
  }
];

export const DiscoverSection: React.FC<{
  onSelectPost?: (post: DiscoverPost) => void;
}> = ({ onSelectPost }) => {
  const [selectedCategory, setSelectedCategory] = useState<number>(0);

  const categories: VisualToggleOption[] = [
    { id: 'all', label: 'All', icon: <Sparkles className="w-5 h-5" /> },
    { id: 'events', label: 'Events', icon: <CalendarDays className="w-5 h-5" /> },
    { id: 'wairo', label: 'WAIRO', icon: <Bike className="w-5 h-5" /> },
    { id: 'chamas', label: 'Chamas', icon: <Users className="w-5 h-5" /> }
  ];

  const filteredPosts = INITIAL_DISCOVER_POSTS.filter((p) => {
    if (selectedCategory === 1) return p.type === 'event';
    if (selectedCategory === 2) return p.type === 'product';
    return true;
  });

  return (
    <div className="space-y-6 pt-4">
      {/* 2x2 Clean Minimal Switcher Grid */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-black uppercase tracking-wider text-[#1A1F2E]">
            Neighborhood Discover
          </span>
          <span className="text-[10px] font-mono font-bold text-[#6B7280]">
            ESTATE FEED
          </span>
        </div>

        <VisualToggle
          options={categories}
          selectedIndex={selectedCategory}
          onChanged={(idx) => {
            soundEngine.play('tap');
            setSelectedCategory(idx);
          }}
        />
      </div>

      {/* Large Full-Width Image Cards with Soft Bottom Gradient Overlays */}
      <div className="space-y-4">
        {filteredPosts.map((post) => (
          <div
            key={post.id}
            onClick={() => onSelectPost?.(post)}
            className="group relative aspect-[16/10] w-full rounded-3xl overflow-hidden shadow-lg cursor-pointer transition-transform duration-300 hover:scale-[1.01] active:scale-[0.99] bg-[#1A1F2E]"
          >
            <img
              src={post.image}
              alt={post.title}
              loading="lazy"
              className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-transparent pointer-events-none" />

            {post.price && (
              <div className="absolute top-3.5 right-3.5 px-3 py-1.5 rounded-full bg-[#B8621F] text-white text-xs font-black shadow-md">
                {post.price}
              </div>
            )}
            {post.date && (
              <div className="absolute top-3.5 right-3.5 px-3 py-1.5 rounded-full bg-white/20 backdrop-blur-md text-white text-xs font-bold flex items-center space-x-1 shadow-md">
                <CalendarDays className="w-3.5 h-3.5" />
                <span>{post.date}</span>
              </div>
            )}

            <div className="absolute bottom-4 left-4 right-4 text-white space-y-1">
              <div className="flex items-center space-x-2">
                <span className="text-[9px] font-mono uppercase px-2 py-0.5 rounded-full bg-white/20 text-white font-black">
                  {post.type.toUpperCase()}
                </span>
                <span className="text-[11px] text-gray-300 flex items-center space-x-1">
                  <MapPin className="w-3 h-3 text-[#E8985E]" />
                  <span>{post.location}</span>
                </span>
              </div>

              <h3 className="text-base sm:text-lg font-black text-white leading-snug drop-shadow-md">
                {post.title}
              </h3>
              <p className="text-xs text-gray-200 line-clamp-1 leading-relaxed opacity-90">
                {post.description}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export const DiscoverScreen: React.FC = () => {
  const [selectedCategory, setSelectedCategory] = useState<number>(0);
  const [scrollOffset, setScrollOffset] = useState<number>(0);
  const [posts, setPosts] = useState<DiscoverPost[]>(INITIAL_DISCOVER_POSTS);
  const [activeDetailPost, setActiveDetailPost] = useState<DiscoverPost | null>(null);
  const [createPostModalOpen, setCreatePostModalOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const categories: VisualToggleOption[] = [
    { id: 'all', label: 'All', icon: <Sparkles className="w-6 h-6" /> },
    { id: 'events', label: 'Events', icon: <CalendarDays className="w-6 h-6" /> },
    { id: 'products', label: 'Products', icon: <ShoppingBag className="w-6 h-6" /> },
    { id: 'news', label: 'News', icon: <Megaphone className="w-6 h-6" /> }
  ];

  const filteredPosts = posts.filter((p) => {
    if (selectedCategory === 1) return p.type === 'event';
    if (selectedCategory === 2) return p.type === 'product';
    if (selectedCategory === 3) return p.type === 'announcement';
    return true;
  });

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const handlePostCreated = (newPost: Post) => {
    const converted: DiscoverPost = {
      id: newPost.id,
      title: newPost.title,
      description: newPost.description,
      image: newPost.imageUrls[0] || 'https://images.unsplash.com/photo-1540555700478-4be289fbecef?w=800&auto=format&fit=crop',
      price: newPost.type === 'product' ? `KES ${newPost.priceKes}` : undefined,
      date: newPost.type === 'event' ? newPost.eventDate : undefined,
      time: newPost.type === 'event' ? newPost.eventTime : undefined,
      location: newPost.district,
      type: newPost.type,
      author: newPost.createdBy,
      phone: '+254700000000'
    };
    setPosts([converted, ...posts]);
    showToast(`Published "${newPost.title}" to Discover Feed!`);
  };

  const openWhatsApp = (phone: string, title: string) => {
    soundEngine.play('heavyTap');
    const cleanPhone = phone.replace(/\D/g, '');
    const url = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(`Hi, I am reaching out regarding "${title}" on Brief.`)}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const openTelegram = (handle: string, title: string) => {
    soundEngine.play('heavyTap');
    const cleanHandle = handle.replace('@', '');
    const url = `https://t.me/${cleanHandle}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="relative min-h-screen w-full bg-[#F0EDE8] overflow-x-hidden font-sans">
      <DepthBackground scrollOffset={scrollOffset} className="min-h-screen">
        <div
          onScroll={(e) => setScrollOffset((e.target as HTMLDivElement).scrollTop)}
          className="relative max-w-xl mx-auto px-4 sm:px-6 pt-6 pb-36 min-h-screen overflow-y-auto"
        >
          {/* Header */}
          <header className="pt-2 pb-6 space-y-6">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <span className="text-sm font-medium text-[#F0EDE8]/70 block">
                  Good morning
                </span>
                <h1 className="text-3xl font-extrabold tracking-tight text-[#F0EDE8]">
                  Discover
                </h1>
              </div>

              <button
                type="button"
                onClick={() => soundEngine.play('tap')}
                className="w-12 h-12 rounded-full flex items-center justify-center text-white cursor-pointer transition-transform active:scale-95"
                style={{
                  backgroundColor: AppPalette.accent,
                  boxShadow: '0 8px 24px rgba(232, 152, 94, 0.45)'
                }}
                aria-label="User Profile"
              >
                <User className="w-6 h-6" />
              </button>
            </div>

            <VisualToggle
              options={categories}
              selectedIndex={selectedCategory}
              onChanged={(idx) => setSelectedCategory(idx)}
            />
          </header>

          {/* Post Shelf */}
          <main className="space-y-4">
            {filteredPosts.map((post, idx) => (
              <GlassCard
                key={post.id}
                padding="0px"
                animationDelayMs={100 + idx * 80}
                onTap={() => setActiveDetailPost(post)}
                className="overflow-hidden group rounded-[20px]"
              >
                <div className="relative aspect-[16/10] w-full overflow-hidden rounded-t-[20px] bg-[#E8E4DD]">
                  <img
                    src={post.image}
                    alt={post.title}
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent pointer-events-none" />

                  {post.price && (
                    <div className="absolute top-3 right-3 px-3 py-1.5 rounded-full text-white text-xs font-bold tracking-wide shadow-md"
                      style={{ backgroundColor: AppPalette.accent }}
                    >
                      {post.price}
                    </div>
                  )}

                  {post.date && (
                    <div className="absolute top-3 right-3 px-3 py-1.5 rounded-full text-white text-xs font-bold flex items-center space-x-1 shadow-md"
                      style={{ backgroundColor: AppPalette.primary }}
                    >
                      <CalendarDays className="w-3.5 h-3.5" />
                      <span>{post.date}</span>
                    </div>
                  )}

                  <div className="absolute bottom-3 left-3 bg-black/60 backdrop-blur-sm text-white px-2.5 py-1 rounded-lg text-[11px] font-mono flex items-center space-x-1">
                    <MapPin className="w-3 h-3 text-[#E8985E]" />
                    <span>{post.location || 'Nairobi Hub'}</span>
                  </div>
                </div>

                <div className="p-4 space-y-1.5 bg-[#FAFAF8]">
                  <h3 className="text-base font-bold text-[#1A1F2E] leading-snug group-hover:text-[#0B6E6E] transition-colors">
                    {post.title}
                  </h3>
                  <p className="text-xs text-[#6B7280] line-clamp-2 leading-relaxed">
                    {post.description}
                  </p>
                  <span className="text-[11px] text-[#9CA3AF] font-medium pt-1 block">
                    Tap to view details & contact seller
                  </span>
                </div>
              </GlassCard>
            ))}
          </main>
        </div>
      </DepthBackground>

      {/* Floating Action Pill */}
      <div className="fixed bottom-6 left-0 right-0 flex justify-center z-40 pointer-events-none">
        <div className="pointer-events-auto">
          <FloatingPill
            icon={<Plus className="w-6 h-6 text-white" />}
            label="Create"
            onTap={() => setCreatePostModalOpen(true)}
          />
        </div>
      </div>

      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-5 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 rounded-2xl bg-[#1A1F2E] text-white text-xs font-bold shadow-2xl flex items-center space-x-2 animate-fadeIn border border-white/10">
          <Check className="w-4 h-4 text-[#2ECC71]" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Post Detail Bottom Sheet */}
      {activeDetailPost && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex flex-col justify-end p-0 animate-fadeIn"
          onClick={() => setActiveDetailPost(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-xl mx-auto bg-[#FAFAF8] text-[#1A1F2E] rounded-t-[32px] overflow-hidden shadow-2xl max-h-[88vh] flex flex-col animate-slideUp"
          >
            <div className="w-full flex justify-center pt-3 pb-1">
              <div className="w-10 h-1 rounded-full bg-[#1A1F2E]/20" />
            </div>

            <div className="overflow-y-auto flex-1 pb-6">
              <div className="relative aspect-video w-full overflow-hidden bg-[#E8E4DD]">
                <img
                  src={activeDetailPost.image}
                  alt={activeDetailPost.title}
                  className="w-full h-full object-cover"
                />
                <button
                  type="button"
                  onClick={() => {
                    soundEngine.play('tap');
                    setActiveDetailPost(null);
                  }}
                  className="absolute top-3 right-3 w-9 h-9 rounded-full bg-black/60 hover:bg-black/80 text-white flex items-center justify-center cursor-pointer transition-colors"
                  aria-label="Close details"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="p-6 space-y-4">
                <div className="space-y-1">
                  <div className="flex items-center space-x-2">
                    <span
                      className={`px-2.5 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider text-white ${
                        activeDetailPost.type === 'event'
                          ? 'bg-[#0B6E6E]'
                          : 'bg-[#E8985E]'
                      }`}
                    >
                      {activeDetailPost.type}
                    </span>
                    <span className="text-xs text-[#6B7280] font-mono">
                      By {activeDetailPost.author}
                    </span>
                  </div>

                  <h2 className="text-2xl font-extrabold text-[#1A1F2E] leading-tight pt-1">
                    {activeDetailPost.title}
                  </h2>
                </div>

                <p className="text-sm text-[#6B7280] leading-relaxed">
                  {activeDetailPost.description}
                </p>

                <div className="pt-2 space-y-2">
                  <span className="text-xs font-bold text-[#1A1F2E] block">
                    Contact Organizer / Seller Directly:
                  </span>
                  
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => openWhatsApp(activeDetailPost.phone || '+254700000000', activeDetailPost.title)}
                      className="py-3.5 px-4 rounded-2xl text-white font-bold text-xs flex items-center justify-center space-x-2 shadow-lg transition-transform active:scale-95 cursor-pointer"
                      style={{ backgroundColor: '#25D366' }}
                    >
                      <MessageCircle className="w-4 h-4 fill-current" />
                      <span>WhatsApp</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => openTelegram(activeDetailPost.telegram || 'brief_kenya', activeDetailPost.title)}
                      className="py-3.5 px-4 rounded-2xl text-white font-bold text-xs flex items-center justify-center space-x-2 shadow-lg transition-transform active:scale-95 cursor-pointer"
                      style={{ backgroundColor: '#0088CC' }}
                    >
                      <Send className="w-4 h-4" />
                      <span>Telegram</span>
                    </button>
                  </div>
                </div>

              </div>
            </div>
          </div>
        </div>
      )}

      {createPostModalOpen && (
        <UniversalCreatePostModal
          isOpen={createPostModalOpen}
          onClose={() => setCreatePostModalOpen(false)}
          onPostCreated={handlePostCreated}
        />
      )}
    </div>
  );
};
