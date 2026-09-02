#!/usr/bin/env python3
"""
Light theme migration: dark charcoal + orange/cyan -> WHITE page + orange/blue.

Global hex remap (each old hex maps to exactly one new value). Dual-role colors
resolve correctly because BOTH their roles stay dark/light consistently:
  #0D0F12 (on-accent text AND scrim)  -> #0D1117 (stays dark)
  #08090B (scrim/overlay)             -> #0D1117 (stays dark)
  #F7F7F8 (ink)                       -> #0D1117 (dark ink)
The ONE exception is white text over dark image overlays (hero cards) — those
are reverted to white by hand after this script (see the follow-up fixes).

Surface flip:
  #12151A (card)  -> #FFFFFF
  #171A20 (raised)-> #F0F2F5
  #1D2027 (elev)  -> #EFF1F4
  #222630 (line)  -> #E5E8EC
Accents:
  #22E6E0 (cyan)  -> #2563EB (blue)
  #FF5A1F (orange)-> KEEP
Semantic (white-readable):
  #38E879 -> #16A34A   #FF5D6C -> #DC2626   #FFCC66 -> #B45309
  #A7ACB5 -> #5A6472   #8A93A6 -> #7A8494   #E04D15 -> #C2410C
"""
import re, pathlib

ROOT = pathlib.Path("src")
SKIP_DIRS = {"assets", "styles"}  # arenaArcade.css is a scoped dark arcade theme
SUFFIXES = {".ts", ".tsx"}

HEXMAP = {
    "12151A": "FFFFFF",
    "171A20": "F0F2F5",
    "1D2027": "EFF1F4",
    "222630": "E5E8EC",
    "F7F7F8": "0D1117",
    "0D0F12": "0D1117",
    "08090B": "0D1117",
    "22E6E0": "2563EB",
    "38E879": "16A34A",
    "FF5D6C": "DC2626",
    "FFCC66": "B45309",
    "A7ACB5": "5A6472",
    "8A93A6": "7A8494",
    "E04D15": "C2410C",
    "6E737C": "7A8494",
    "9CA3AF": "5A6472",
    "D1D5DB": "E5E8EC",
    "6B7280": "5A6472",
    "374151": "0D1117",
    "52525B": "5A6472",
    "3556A8": "2563EB",
}

RGBA_MAP = [
    ("rgba(247, 247, 248", "rgba(13, 17, 23"),
    ("rgba(247,247,248", "rgba(13,17,23"),
    ("rgba(8, 9, 11", "rgba(13, 17, 23"),
    ("rgba(8,9,11", "rgba(13,17,23"),
]

stats = {}

def sub(text, label, old, new):
    text, n = re.subn(re.escape(old), new, text, flags=re.IGNORECASE)
    if n:
        stats[label] = stats.get(label, 0) + n
    return text

def process(text):
    for old, new in HEXMAP.items():
        # word-boundary: don't replace #HEX inside a longer hex (none exist, but safe)
        text = sub(text, f"#{old}", f"#{old}", f"#{new}")
    for old, new in RGBA_MAP:
        text = sub(text, f"rgba {old}", old, new)
    return text

def main():
    files = [p for p in ROOT.rglob("*") if p.suffix in SUFFIXES
             and not any(part in SKIP_DIRS for part in p.parts)]
    changed = 0
    for p in files:
        orig = p.read_text(encoding="utf-8")
        new = process(orig)
        if new != orig:
            p.write_text(new, encoding="utf-8")
            changed += 1
    print(f"files changed: {changed}")
    for k in sorted(stats, key=lambda k: -stats[k]):
        print(f"  {stats[k]:>5}  {k}")

if __name__ == "__main__":
    main()
