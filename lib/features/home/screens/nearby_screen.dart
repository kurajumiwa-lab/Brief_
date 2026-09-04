import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import '../../wairo/widgets/wairo_bookmark.dart';
import '../widgets/brief_builder_accordion.dart';
import '../widgets/discover_section.dart';

/// ═══════════════════════════════════════════════════════════════════════════
/// NEARBY SCREEN (Major UI Refactor)
/// ═══════════════════════════════════════════════════════════════════════════
/// Premium, borderless home/discovery screen integrating:
/// 1. Top-Right Hanging WAIRO Bookmark Knob (`Positioned(top: 12, right: 16)`).
/// 2. Inline "Build my Brief" Accordion with solid colored tags.
/// 3. Discover Section with 2x2 soft category grid and image-first feed cards.
class NearbyScreen extends StatefulWidget {
  final String userLocation;
  final ValueChanged<String>? onNavigateTab;

  const NearbyScreen({
    Key? key,
    this.userLocation = "Lang'ata",
    this.onNavigateTab,
  }) : super(key: key);

  @override
  State<NearbyScreen> createState() => _NearbyScreenState();
}

class _NearbyScreenState extends State<NearbyScreen> {
  int _selectedSectionTab = 0; // 0: Discover, 1: Opportunities, 2: My Shelf
  final List<String> _sectionTabs = const ['Discover', 'Opportunities', 'My Shelf'];

  void _showToast(String message) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(
          message,
          style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 13),
        ),
        backgroundColor: const Color(0xFF1A1F2E),
        behavior: SnackBarBehavior.floating,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        duration: const Duration(seconds: 2),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFE8E4DD), // Warm Linen Surface
      body: Stack(
        children: [
          // ═══ MAIN SCROLLABLE FEED ═══
          SafeArea(
            bottom: false,
            child: CustomScrollView(
              physics: const BouncingScrollPhysics(),
              slivers: [
                // ── 1. COMPACT HEADER (With Right Padding for Bookmark) ──
                SliverToBoxAdapter(
                  child: Padding(
                    padding: const EdgeInsets.fromLTRB(20, 16, 80, 8),
                    child: Row(
                      children: [
                        // Avatar
                        Container(
                          width: 44,
                          height: 44,
                          decoration: BoxDecoration(
                            shape: BoxShape.circle,
                            gradient: const LinearGradient(
                              colors: [Color(0xFF8B4FFF), Color(0xFFE85D75)],
                            ),
                            boxShadow: [
                              BoxShadow(
                                color: const Color(0xFF8B4FFF).withOpacity(0.3),
                                blurRadius: 10,
                                offset: const Offset(0, 4),
                              ),
                            ],
                          ),
                          child: const Center(
                            child: Text(
                              'L',
                              style: TextStyle(
                                fontSize: 18,
                                fontWeight: FontWeight.w900,
                                color: Colors.white,
                              ),
                            ),
                          ),
                        ),
                        const SizedBox(width: 14),

                        // Title / Location
                        Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              'AROUND YOU · ${widget.userLocation.toUpperCase()}',
                              style: const TextStyle(
                                fontSize: 10,
                                fontWeight: FontWeight.w800,
                                color: Color(0xFF6B7280),
                                letterSpacing: 1.2,
                              ),
                            ),
                            const SizedBox(height: 2),
                            const Text(
                              'Home',
                              style: TextStyle(
                                fontSize: 24,
                                fontWeight: FontWeight.w900,
                                color: Color(0xFF1A1F2E),
                                letterSpacing: -0.5,
                              ),
                            ),
                          ],
                        ),
                      ],
                    ),
                  ),
                ),

                // ── 2. BRIEF BUILDER ACCORDION (Inline expansion) ──
                SliverToBoxAdapter(
                  child: BriefBuilderAccordion(
                    onSaved: (selection) {
                      final cities = selection['cities']?.length ?? 0;
                      final interests = selection['interests']?.length ?? 0;
                      _showToast('Brief calibrated: $cities places, $interests topics');
                    },
                    onOpenCollections: () => _showToast('Opening Collections'),
                    onOpenFollowing: () => _showToast('Opening Following feed'),
                    onOpenUpdates: () => _showToast('Checking Updates'),
                  ),
                ),

                // ── 3. TOP SECTION SWITCHER TABS ──
                SliverToBoxAdapter(
                  child: Padding(
                    padding: const EdgeInsets.fromLTRB(20, 4, 20, 8),
                    child: Container(
                      padding: const EdgeInsets.all(4),
                      decoration: BoxDecoration(
                        color: const Color(0xFF1A1F2E).withOpacity(0.06),
                        borderRadius: BorderRadius.circular(50),
                      ),
                      child: Row(
                        children: List.generate(_sectionTabs.length, (idx) {
                          final isSelected = _selectedSectionTab == idx;
                          return Expanded(
                            child: GestureDetector(
                              onTap: () {
                                HapticFeedback.selectionClick();
                                setState(() => _selectedSectionTab = idx);
                              },
                              child: AnimatedContainer(
                                duration: const Duration(milliseconds: 250),
                                curve: Curves.easeOutCubic,
                                padding: const EdgeInsets.symmetric(vertical: 9),
                                decoration: BoxDecoration(
                                  color: isSelected ? const Color(0xFF1A1F2E) : Colors.transparent,
                                  borderRadius: BorderRadius.circular(50),
                                  boxShadow: isSelected
                                      ? [
                                          BoxShadow(
                                            color: Colors.black.withOpacity(0.12),
                                            blurRadius: 8,
                                            offset: const Offset(0, 3),
                                          ),
                                        ]
                                      : null,
                                ),
                                child: Center(
                                  child: Text(
                                    _sectionTabs[idx],
                                    style: TextStyle(
                                      fontSize: 12,
                                      fontWeight: isSelected ? FontWeight.w800 : FontWeight.w600,
                                      color: isSelected ? Colors.white : const Color(0xFF6B7280),
                                    ),
                                  ),
                                ),
                              ),
                            ),
                          );
                        }),
                      ),
                    ),
                  ),
                ),

                // ── 4. LOWER SECTION: CLEAN DISCOVER SECTION ──
                if (_selectedSectionTab == 0)
                  SliverToBoxAdapter(
                    child: DiscoverSection(
                      onCategorySelected: (cat) => _showToast('Category: $cat'),
                      onCardTap: (card) => _showToast('Selected: ${card['title']}'),
                    ),
                  ),

                if (_selectedSectionTab == 1)
                  SliverToBoxAdapter(
                    child: Padding(
                      padding: const EdgeInsets.all(20),
                      child: Container(
                        padding: const EdgeInsets.all(24),
                        decoration: BoxDecoration(
                          color: const Color(0xFFFAFAF8),
                          borderRadius: BorderRadius.circular(24),
                          boxShadow: [
                            BoxShadow(
                              color: Colors.black.withOpacity(0.04),
                              blurRadius: 16,
                              offset: const Offset(0, 6),
                            ),
                          ],
                        ),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: const [
                            Text(
                              'Verified Opportunities',
                              style: TextStyle(
                                fontSize: 18,
                                fontWeight: FontWeight.w900,
                                color: Color(0xFF1A1F2E),
                              ),
                            ),
                            SizedBox(height: 6),
                            Text(
                              'Gigs, skills workshops, and local tournament prize pools.',
                              style: TextStyle(fontSize: 13, color: Color(0xFF6B7280)),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ),

                if (_selectedSectionTab == 2)
                  SliverToBoxAdapter(
                    child: Padding(
                      padding: const EdgeInsets.all(20),
                      child: Container(
                        padding: const EdgeInsets.all(24),
                        decoration: BoxDecoration(
                          color: const Color(0xFFFAFAF8),
                          borderRadius: BorderRadius.circular(24),
                          boxShadow: [
                            BoxShadow(
                              color: Colors.black.withOpacity(0.04),
                              blurRadius: 16,
                              offset: const Offset(0, 6),
                            ),
                          ],
                        ),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: const [
                            Text(
                              'My Shelf',
                              style: TextStyle(
                                fontSize: 18,
                                fontWeight: FontWeight.w900,
                                color: Color(0xFF1A1F2E),
                              ),
                            ),
                            SizedBox(height: 6),
                            Text(
                              'Your saved events, active courier routes, and bookmarked listings.',
                              style: TextStyle(fontSize: 13, color: Color(0xFF6B7280)),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ),

                // Bottom Spacing for Floating Nav Bars
                const SliverToBoxAdapter(child: SizedBox(height: 120)),
              ],
            ),
          ),

          // ═══ TOP-RIGHT HANGING WAIRO BOOKMARK KNOB ═══
          const Positioned(
            top: 12,
            right: 16,
            child: WairoBookmark(),
          ),
        ],
      ),
    );
  }
}
