import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

/// ═══════════════════════════════════════════════════════════════════════════
/// BRIEF BUILDER ACCORDION
/// ═══════════════════════════════════════════════════════════════════════════
/// Expandable inline accordion that allows users to calibrate their daily
/// Brief by places and topics of interest. Pushes content down smoothly without
/// intrusive modal overlays. Zero thin borders — pure surface contrast.
class BriefBuilderAccordion extends StatefulWidget {
  final ValueChanged<Map<String, Set<String>>>? onSaved;
  final VoidCallback? onOpenCollections;
  final VoidCallback? onOpenFollowing;
  final VoidCallback? onOpenUpdates;

  const BriefBuilderAccordion({
    Key? key,
    this.onSaved,
    this.onOpenCollections,
    this.onOpenFollowing,
    this.onOpenUpdates,
  }) : super(key: key);

  @override
  State<BriefBuilderAccordion> createState() => _BriefBuilderAccordionState();
}

class _BriefBuilderAccordionState extends State<BriefBuilderAccordion>
    with SingleTickerProviderStateMixin {
  bool _isExpanded = false;

  final Set<String> _selectedCities = {'Machakos'};
  final Set<String> _selectedInterests = {'Jobs', 'Knowledge'};

  final List<String> _cities = const [
    'Nairobi', 'Mombasa', 'Kisumu', 'Nakuru',
    'Eldoret', 'Thika', 'Naivasha', 'Nyeri',
    'Machakos', 'Kilimani', 'Westlands', 'Kileleshwa',
    'Lavington', 'Karen', "Lang'ata", 'Kasarani'
  ];

  final List<String> _interests = const [
    'Knowledge', 'Experience', 'Food', 'Jobs',
    'Business', 'Community', 'Health', 'Education',
    'Entertainment', 'Transport'
  ];

  void _toggleExpansion() {
    HapticFeedback.lightImpact();
    setState(() => _isExpanded = !_isExpanded);
  }

  void _toggleCity(String city) {
    HapticFeedback.selectionClick();
    setState(() {
      if (_selectedCities.contains(city)) {
        _selectedCities.remove(city);
      } else {
        _selectedCities.add(city);
      }
    });
  }

  void _toggleInterest(String interest) {
    HapticFeedback.selectionClick();
    setState(() {
      if (_selectedInterests.contains(interest)) {
        _selectedInterests.remove(interest);
      } else {
        _selectedInterests.add(interest);
      }
    });
  }

  void _handleSave() {
    HapticFeedback.mediumImpact();
    setState(() => _isExpanded = false);
    widget.onSaved?.call({
      'cities': _selectedCities,
      'interests': _selectedInterests,
    });
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        // ── TOP STRIP: Trigger + Auxiliary Pills ──
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 8),
          child: Row(
            children: [
              // 1. "Build my Brief" Interactive Trigger
              GestureDetector(
                onTap: _toggleExpansion,
                child: AnimatedContainer(
                  duration: const Duration(milliseconds: 300),
                  curve: Curves.easeOutCubic,
                  padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                  decoration: BoxDecoration(
                    color: _isExpanded
                        ? const Color(0xFFB8621F) // Copper Active
                        : Colors.white,
                    borderRadius: BorderRadius.circular(14),
                    boxShadow: [
                      BoxShadow(
                        color: _isExpanded
                            ? const Color(0xFFB8621F).withOpacity(0.3)
                            : Colors.black.withOpacity(0.05),
                        blurRadius: _isExpanded ? 14 : 8,
                        offset: const Offset(0, 3),
                      ),
                    ],
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(
                        Icons.tune_rounded,
                        size: 16,
                        color: _isExpanded ? Colors.white : const Color(0xFF1A1F2E),
                      ),
                      const SizedBox(width: 8),
                      Text(
                        'Build my Brief',
                        style: TextStyle(
                          fontSize: 12,
                          fontWeight: FontWeight.w800,
                          color: _isExpanded ? Colors.white : const Color(0xFF1A1F2E),
                          letterSpacing: 0.3,
                        ),
                      ),
                    ],
                  ),
                ),
              ),

              const SizedBox(width: 10),

              // 2. Auxiliary Minimal Action Pills
              Expanded(
                child: SingleChildScrollView(
                  scrollDirection: Axis.horizontal,
                  physics: const BouncingScrollPhysics(),
                  child: Row(
                    children: [
                      _MinimalActionPill(
                        icon: Icons.bookmark_border_rounded,
                        label: 'Collections',
                        onTap: widget.onOpenCollections,
                      ),
                      const SizedBox(width: 8),
                      _MinimalActionPill(
                        icon: Icons.people_outline_rounded,
                        label: 'Following',
                        onTap: widget.onOpenFollowing,
                      ),
                      const SizedBox(width: 8),
                      _MinimalActionPill(
                        icon: Icons.notifications_none_rounded,
                        label: 'Updates',
                        onTap: widget.onOpenUpdates,
                      ),
                    ],
                  ),
                ),
              ),
            ],
          ),
        ),

        // ── INLINE ANIMATED EXPANSION AREA (Zero Full-Screen Popups) ──
        AnimatedSize(
          duration: const Duration(milliseconds: 320),
          curve: Curves.easeOutCubic,
          alignment: Alignment.topCenter,
          child: _isExpanded
              ? _buildAccordionBody()
              : const SizedBox(width: double.infinity, height: 0),
        ),
      ],
    );
  }

  Widget _buildAccordionBody() {
    return Container(
      margin: const EdgeInsets.fromLTRB(20, 8, 20, 16),
      padding: const EdgeInsets.all(22),
      decoration: BoxDecoration(
        color: const Color(0xFFFAFAF8), // Warm Linen Surface
        borderRadius: BorderRadius.circular(24),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.06),
            blurRadius: 20,
            offset: const Offset(0, 8),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Header & Skip Action
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: const [
                    Text(
                      'Make this your Brief',
                      style: TextStyle(
                        fontSize: 20,
                        fontWeight: FontWeight.w900,
                        color: Color(0xFF1A1F2E),
                        letterSpacing: -0.5,
                      ),
                    ),
                    SizedBox(height: 4),
                    Text(
                      'Your daily city briefing: ordered around the places and things you follow. Skip anytime — nothing is blocked.',
                      style: TextStyle(
                        fontSize: 12,
                        height: 1.4,
                        color: Color(0xFF6B7280),
                        fontWeight: FontWeight.w500,
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 12),
              GestureDetector(
                onTap: _toggleExpansion,
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 7),
                  decoration: BoxDecoration(
                    color: Colors.black.withOpacity(0.07),
                    borderRadius: BorderRadius.circular(50),
                  ),
                  child: const Text(
                    'Skip',
                    style: TextStyle(
                      fontSize: 12,
                      fontWeight: FontWeight.w700,
                      color: Color(0xFF4A5568),
                    ),
                  ),
                ),
              ),
            ],
          ),

          const SizedBox(height: 24),

          // Section 1: Cities
          _buildSectionHeader('WHERE DO YOU WANT YOUR BRIEF?'),
          const SizedBox(height: 12),
          Wrap(
            spacing: 8,
            runSpacing: 10,
            children: _cities.map((city) {
              final isSelected = _selectedCities.contains(city);
              return _SolidTag(
                label: city,
                isSelected: isSelected,
                onTap: () => _toggleCity(city),
              );
            }).toList(),
          ),

          const SizedBox(height: 24),

          // Section 2: Interests
          _buildSectionHeader('WHAT DO YOU CARE ABOUT?'),
          const SizedBox(height: 12),
          Wrap(
            spacing: 8,
            runSpacing: 10,
            children: _interests.map((interest) {
              final isSelected = _selectedInterests.contains(interest);
              return _SolidTag(
                label: interest,
                isSelected: isSelected,
                onTap: () => _toggleInterest(interest),
              );
            }).toList(),
          ),

          const SizedBox(height: 24),

          // Action Footer
          Row(
            children: [
              GestureDetector(
                onTap: _handleSave,
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 13),
                  decoration: BoxDecoration(
                    color: const Color(0xFFB8621F), // Copper
                    borderRadius: BorderRadius.circular(16),
                    boxShadow: [
                      BoxShadow(
                        color: const Color(0xFFB8621F).withOpacity(0.35),
                        blurRadius: 12,
                        offset: const Offset(0, 4),
                      ),
                    ],
                  ),
                  child: const Text(
                    'Build my Brief',
                    style: TextStyle(
                      color: Colors.white,
                      fontSize: 13,
                      fontWeight: FontWeight.w800,
                      letterSpacing: 0.2,
                    ),
                  ),
                ),
              ),
              const SizedBox(width: 14),
              const Expanded(
                child: Text(
                  'Pick anything, or skip — your feed stays global.',
                  style: TextStyle(
                    fontSize: 11,
                    color: Color(0xFF9CA3AF),
                    fontWeight: FontWeight.w500,
                  ),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildSectionHeader(String title) {
    return Row(
      children: [
        Container(
          width: 6,
          height: 6,
          decoration: const BoxDecoration(
            color: Color(0xFF1A1F2E),
            shape: BoxShape.circle,
          ),
        ),
        const SizedBox(width: 8),
        Text(
          title,
          style: const TextStyle(
            fontSize: 10,
            fontWeight: FontWeight.w800,
            color: Color(0xFF1A1F2E),
            letterSpacing: 1.2,
          ),
        ),
      ],
    );
  }
}

/// ── Solid colored tag without thin borders ──
class _SolidTag extends StatelessWidget {
  final String label;
  final bool isSelected;
  final VoidCallback onTap;

  const _SolidTag({
    required this.label,
    required this.isSelected,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 200),
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
        decoration: BoxDecoration(
          color: isSelected
              ? const Color(0xFFB8621F) // Solid Copper (Selected)
              : const Color(0xFFE5E7EB), // Solid Grey (Unselected)
          borderRadius: BorderRadius.circular(50),
          boxShadow: isSelected
              ? [
                  BoxShadow(
                    color: const Color(0xFFB8621F).withOpacity(0.28),
                    blurRadius: 8,
                    offset: const Offset(0, 3),
                  ),
                ]
              : null,
        ),
        child: Text(
          label,
          style: TextStyle(
            fontSize: 12,
            fontWeight: isSelected ? FontWeight.w800 : FontWeight.w600,
            color: isSelected ? Colors.white : const Color(0xFF374151),
          ),
        ),
      ),
    );
  }
}

/// ── Minimal Action Pill ──
class _MinimalActionPill extends StatelessWidget {
  final IconData icon;
  final String label;
  final VoidCallback? onTap;

  const _MinimalActionPill({
    required this.icon,
    required this.label,
    this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
        decoration: BoxDecoration(
          color: Colors.white.withOpacity(0.7),
          borderRadius: BorderRadius.circular(14),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withOpacity(0.03),
              blurRadius: 6,
              offset: const Offset(0, 2),
            ),
          ],
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icon, size: 14, color: const Color(0xFF6B7280)),
            const SizedBox(width: 6),
            Text(
              label,
              style: const TextStyle(
                fontSize: 12,
                fontWeight: FontWeight.w600,
                color: Color(0xFF6B7280),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
