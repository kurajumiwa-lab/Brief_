import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

/// ═══════════════════════════════════════════════════════════════════════════
/// DISCOVER SECTION (Clean 2x2 Grid + Large Image-First Feed Cards)
/// ═══════════════════════════════════════════════════════════════════════════
/// Replaces the cluttered lower section with a modern, borderless layout.
/// Features a soft 2x2 category grid followed by edge-to-edge image feed cards.
class DiscoverSection extends StatefulWidget {
  final ValueChanged<String>? onCategorySelected;
  final ValueChanged<Map<String, dynamic>>? onCardTap;

  const DiscoverSection({
    Key? key,
    this.onCategorySelected,
    this.onCardTap,
  }) : super(key: key);

  @override
  State<DiscoverSection> createState() => _DiscoverSectionState();
}

class _DiscoverSectionState extends State<DiscoverSection> {
  String _selectedCategory = 'All';

  final List<Map<String, dynamic>> _categories = const [
    {
      'title': 'All',
      'icon': Icons.grid_view_rounded,
      'bg': Color(0xFFDCECE4), // Soft Sage / Mint
      'accent': Color(0xFF1E6B52),
    },
    {
      'title': 'Events',
      'icon': Icons.calendar_month_rounded,
      'bg': Color(0xFFF3ECE4), // Soft Warm Cream
      'accent': Color(0xFFB8621F),
    },
    {
      'title': 'Products',
      'icon': Icons.shopping_bag_outlined,
      'bg': Color(0xFFE8ECF2), // Soft Light Steel
      'accent': Color(0xFF2E4B72),
    },
    {
      'title': 'News',
      'icon': Icons.newspaper_rounded,
      'bg': Color(0xFFF2E8EB), // Soft Light Rose/Obsidian tint
      'accent': Color(0xFF7A3644),
    },
  ];

  final List<Map<String, dynamic>> _feedItems = const [
    {
      'title': 'Kilimani Weekend Market',
      'subtitle': 'Artisan food, thrift pop-ups & live acoustic set',
      'location': 'Kilimani, Nairobi',
      'time': 'Sat · 10:00 AM',
      'tag': 'FEATURED EVENT',
      'tagColor': Color(0xFFE8985E),
      'imageUrl': 'https://images.unsplash.com/photo-1511578314322-379afb476865?w=800&auto=format&fit=crop&q=80',
    },
    {
      'title': 'Westlands Tech & Clan Meetup',
      'subtitle': 'eFootball & FC Mobile tournament matchmaking',
      'location': 'The Mall, Westlands',
      'time': 'Today · 6:00 PM',
      'tag': 'COMMUNITY',
      'tagColor': Color(0xFF00BFEF),
      'imageUrl': 'https://images.unsplash.com/photo-1511882150382-421056c89033?w=800&auto=format&fit=crop&q=80',
    },
    {
      'title': 'Local Honey & Organic Harvest Drop',
      'subtitle': 'Direct farm dispatch from Nyeri & Nakuru growers',
      'location': 'CBD Hub, Nairobi',
      'time': 'Verified Dispatch',
      'tag': 'PRODUCE',
      'tagColor': Color(0xFF2ECC71),
      'imageUrl': 'https://images.unsplash.com/photo-1587049352846-4a222e784d38?w=800&auto=format&fit=crop&q=80',
    },
  ];

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        // ── SECTION HEADER ──
        Padding(
          padding: const EdgeInsets.fromLTRB(20, 16, 20, 12),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Row(
                children: const [
                  Text(
                    'DISCOVER',
                    style: TextStyle(
                      fontSize: 11,
                      fontWeight: FontWeight.w900,
                      color: Color(0xFF1A1F2E),
                      letterSpacing: 1.5,
                    ),
                  ),
                ],
              ),
              const Text(
                'Nairobi & Counties',
                style: TextStyle(
                  fontSize: 12,
                  fontWeight: FontWeight.w600,
                  color: Color(0xFF9CA3AF),
                ),
              ),
            ],
          ),
        ),

        // ── 2x2 SOFT BORDERLESS CATEGORY GRID ──
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 20),
          child: GridView.builder(
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            itemCount: _categories.length,
            gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
              crossAxisCount: 2,
              mainAxisSpacing: 12,
              crossAxisSpacing: 12,
              childAspectRatio: 1.85,
            ),
            itemBuilder: (context, index) {
              final cat = _categories[index];
              final isSelected = _selectedCategory == cat['title'];

              return GestureDetector(
                onTap: () {
                  HapticFeedback.selectionClick();
                  setState(() => _selectedCategory = cat['title']);
                  widget.onCategorySelected?.call(cat['title']);
                },
                child: AnimatedContainer(
                  duration: const Duration(milliseconds: 250),
                  padding: const EdgeInsets.all(14),
                  decoration: BoxDecoration(
                    color: isSelected
                        ? (cat['bg'] as Color)
                        : const Color(0xFFF0EDE8),
                    borderRadius: BorderRadius.circular(18),
                    boxShadow: isSelected
                        ? [
                            BoxShadow(
                              color: (cat['accent'] as Color).withOpacity(0.18),
                              blurRadius: 14,
                              offset: const Offset(0, 5),
                            ),
                          ]
                        : [
                            BoxShadow(
                              color: Colors.black.withOpacity(0.02),
                              blurRadius: 6,
                              offset: const Offset(0, 2),
                            ),
                          ],
                  ),
                  child: Row(
                    children: [
                      Container(
                        width: 36,
                        height: 36,
                        decoration: BoxDecoration(
                          color: (cat['accent'] as Color).withOpacity(0.15),
                          borderRadius: BorderRadius.circular(12),
                        ),
                        child: Icon(
                          cat['icon'] as IconData,
                          size: 18,
                          color: cat['accent'] as Color,
                        ),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Text(
                          cat['title'] as String,
                          style: TextStyle(
                            fontSize: 14,
                            fontWeight: isSelected ? FontWeight.w900 : FontWeight.w700,
                            color: const Color(0xFF1A1F2E),
                            letterSpacing: -0.2,
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              );
            },
          ),
        ),

        const SizedBox(height: 20),

        // ── LARGE IMAGE-FIRST FEED CARDS (Zero Outlines) ──
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 20),
          child: Column(
            children: _feedItems.map((item) {
              return Padding(
                padding: const EdgeInsets.only(bottom: 16),
                child: _ImageFeedCard(
                  title: item['title'] as String,
                  subtitle: item['subtitle'] as String,
                  location: item['location'] as String,
                  time: item['time'] as String,
                  tag: item['tag'] as String,
                  tagColor: item['tagColor'] as Color,
                  imageUrl: item['imageUrl'] as String,
                  onTap: () {
                    HapticFeedback.lightImpact();
                    widget.onCardTap?.call(item);
                  },
                ),
              );
            }).toList(),
          ),
        ),
      ],
    );
  }
}

/// ── Large Edge-to-Edge Image Card with Gradient Overlay ──
class _ImageFeedCard extends StatelessWidget {
  final String title;
  final String subtitle;
  final String location;
  final String time;
  final String tag;
  final Color tagColor;
  final String imageUrl;
  final VoidCallback onTap;

  const _ImageFeedCard({
    required this.title,
    required this.subtitle,
    required this.location,
    required this.time,
    required this.tag,
    required this.tagColor,
    required this.imageUrl,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        height: 240,
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(24),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withOpacity(0.12),
              blurRadius: 18,
              offset: const Offset(0, 8),
            ),
          ],
        ),
        child: ClipRRect(
          borderRadius: BorderRadius.circular(24),
          child: Stack(
            fit: StackFit.expand,
            children: [
              // Background Image
              Image.network(
                imageUrl,
                fit: BoxFit.cover,
                errorBuilder: (_, __, ___) => Container(
                  color: const Color(0xFF2D3548),
                  child: const Center(
                    child: Icon(Icons.image_outlined, color: Colors.white54, size: 40),
                  ),
                ),
              ),

              // Soft Gradient Overlay (Light top, rich dark bottom for readability)
              Container(
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    begin: Alignment.topCenter,
                    end: Alignment.bottomCenter,
                    stops: const [0.0, 0.45, 1.0],
                    colors: [
                      Colors.black.withOpacity(0.15),
                      Colors.black.withOpacity(0.35),
                      Colors.black.withOpacity(0.88),
                    ],
                  ),
                ),
              ),

              // Top Tag Chip
              Positioned(
                top: 16,
                left: 16,
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                  decoration: BoxDecoration(
                    color: tagColor.withOpacity(0.9),
                    borderRadius: BorderRadius.circular(50),
                    boxShadow: [
                      BoxShadow(
                        color: Colors.black.withOpacity(0.2),
                        blurRadius: 6,
                        offset: const Offset(0, 2),
                      ),
                    ],
                  ),
                  child: Text(
                    tag,
                    style: const TextStyle(
                      fontSize: 10,
                      fontWeight: FontWeight.w900,
                      color: Colors.white,
                      letterSpacing: 0.8,
                    ),
                  ),
                ),
              ),

              // Bottom Content Zone
              Positioned(
                left: 18,
                right: 18,
                bottom: 18,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text(
                      title,
                      style: const TextStyle(
                        fontSize: 20,
                        fontWeight: FontWeight.w900,
                        color: Colors.white,
                        letterSpacing: -0.3,
                        height: 1.15,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      subtitle,
                      style: TextStyle(
                        fontSize: 13,
                        fontWeight: FontWeight.w500,
                        color: Colors.white.withOpacity(0.85),
                        height: 1.3,
                      ),
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                    ),
                    const SizedBox(height: 10),
                    Row(
                      children: [
                        Icon(
                          Icons.location_on_rounded,
                          size: 14,
                          color: Colors.white.withOpacity(0.75),
                        ),
                        const SizedBox(width: 4),
                        Text(
                          location,
                          style: TextStyle(
                            fontSize: 11,
                            fontWeight: FontWeight.w600,
                            color: Colors.white.withOpacity(0.75),
                          ),
                        ),
                        const SizedBox(width: 14),
                        Icon(
                          Icons.access_time_filled_rounded,
                          size: 13,
                          color: Colors.white.withOpacity(0.75),
                        ),
                        const SizedBox(width: 4),
                        Text(
                          time,
                          style: TextStyle(
                            fontSize: 11,
                            fontWeight: FontWeight.w600,
                            color: Colors.white.withOpacity(0.75),
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
