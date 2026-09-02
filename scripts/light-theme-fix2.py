#!/usr/bin/env python3
"""Post-migration fixes: over-image white text + placeholder gradients.

The global remap flipped ink white->dark. Text that sits OVER a dark image
scrim/overlay must STAY white; 'no image' placeholder gradients must be
consistent (dark for hero cards that keep white text, light for avatar tiles).
"""
import pathlib

def edit(path, pairs):
    p = pathlib.Path(path)
    t = p.read_text(encoding="utf-8")
    for old, new in pairs:
        if old not in t:
            print(f"  MISS in {path}: {old[:60]}...")
            continue
        t = t.replace(old, new)
    p.write_text(t, encoding="utf-8")

# 1. NearbyScreen hero cards — keep dark placeholder + white text over scrim.
edit("src/screens/NearbyScreen.tsx", [
    # "Happening nearby" rail: placeholder dark, title/meta/vendors white.
    ('<div className="absolute inset-0 bg-gradient-to-br from-[#EFF1F4] to-[#0D1117]" />\n                          )}\n                          <div className="absolute inset-0 bg-gradient-to-t from-[#0D1117]/90 via-[#0D1117]/10 to-transparent" />\n                          <div className="absolute inset-x-3 bottom-3">\n                            <h3 className="line-clamp-2 text-[14px] font-semibold leading-snug text-[#0D1117]">',
     '<div className="absolute inset-0 bg-gradient-to-br from-[#232A36] to-[#0D1117]" />\n                          )}\n                          <div className="absolute inset-0 bg-gradient-to-t from-[#0D1117]/90 via-[#0D1117]/10 to-transparent" />\n                          <div className="absolute inset-x-3 bottom-3">\n                            <h3 className="line-clamp-2 text-[14px] font-semibold leading-snug text-[#FFFFFF]">'),
    ('<p className="mt-0.5 text-[10px] font-semibold text-[#0D1117]/80">\n                                  {[dist, loc].filter(Boolean).join(\' · \')}',
     '<p className="mt-0.5 text-[10px] font-semibold text-[#FFFFFF]/80">\n                                  {[dist, loc].filter(Boolean).join(\' · \')}'),
    ('<p className="mt-1 text-[10px] font-semibold text-[#0D1117]">\n                                {vendors.length} {vendors.length === 1 ? \'vendor\' : \'vendors\'} inside',
     '<p className="mt-1 text-[10px] font-semibold text-[#FFFFFF]">\n                                {vendors.length} {vendors.length === 1 ? \'vendor\' : \'vendors\'} inside'),
    # Legacy grid: placeholder dark, expired badge white text, title/meta white.
    ('<div className="absolute inset-0 bg-gradient-to-br from-[#EFF1F4] to-[#0D1117]" />\n                              )}\n                            <div className="absolute inset-0 bg-gradient-to-t from-[#0D1117]/95 via-[#0D1117]/20 to-[#0D1117]/05" />',
     '<div className="absolute inset-0 bg-gradient-to-br from-[#232A36] to-[#0D1117]" />\n                              )}\n                            <div className="absolute inset-0 bg-gradient-to-t from-[#0D1117]/95 via-[#0D1117]/20 to-[#0D1117]/05" />'),
    ("? 'bg-[#0D1117]/80 text-[#0D1117]'", "? 'bg-[#0D1117]/80 text-[#FFFFFF]'"),
    ('<h3 className="line-clamp-3 pr-2 text-[14px] font-semibold leading-snug text-[#0D1117]">',
     '<h3 className="line-clamp-3 pr-2 text-[14px] font-semibold leading-snug text-[#FFFFFF]">'),
    ('<p className="mt-1 text-[9px] font-semibold text-[#0D1117]/75 truncate">',
     '<p className="mt-1 text-[9px] font-semibold text-[#FFFFFF]/75 truncate">'),
])

# 2. StandaloneBanner — text over dark scrim -> white.
edit("src/components/StandaloneBanner.tsx", [
    ('<div className="relative flex min-h-[190px] flex-col justify-between p-4 text-[#0D1117]">',
     '<div className="relative flex min-h-[190px] flex-col justify-between p-4 text-[#FFFFFF]">'),
    ('{banner.location && <span className="max-w-[45%] truncate text-[9px] font-bold text-[#0D1117]/70">{banner.location}</span>}',
     '{banner.location && <span className="max-w-[45%] truncate text-[9px] font-bold text-[#FFFFFF]/70">{banner.location}</span>}'),
    ('{banner.body && <p className="mt-1 line-clamp-2 max-w-xl text-[11px] leading-snug text-[#0D1117]/75">{banner.body}</p>}',
     '{banner.body && <p className="mt-1 line-clamp-2 max-w-xl text-[11px] leading-snug text-[#FFFFFF]/75">{banner.body}</p>}'),
])

# 3. Avatar/cover placeholder tiles -> light gradient + dark text.
for f in ["src/components/CollectionPage.tsx", "src/components/EntityPage.tsx",
          "src/components/CollectionsSurface.tsx", "src/components/FollowingSurface.tsx",
          "src/components/LocationPage.tsx", "src/components/RelatedContent.tsx",
          "src/components/SearchResults.tsx"]:
    edit(f, [
        ("from-[#EFF1F4] to-[#0D1117]", "from-[#EFF1F4] to-[#E5E8EC]"),
        ("from-[#EFF1F4] via-[#FF5A1F] to-[#0D1117]", "from-[#FFF4EC] via-[#FFE4D1] to-[#FFD9C2]"),
        ("from-[#EFF1F4] via-[#0D1117] to-[#0D1117]", "from-[#EFF1F4] via-[#F0F2F5] to-[#E5E8EC]"),
        ("text-[#F0F2F5]", "text-[#5A6472]"),
    ])

print("done")
