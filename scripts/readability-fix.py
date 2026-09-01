#!/usr/bin/env python3
"""
Readability fix: two contrast bugs from the dark-palette migration.

1. DARK-ON-DARK  -- my fix_class over-matched inside ternary classNames and
   rewrote the *else* branch's `text-[#F7F7F8]/xx` back to `text-[#0D0F12]/xx`
   (dark ink) on dark surfaces. Those are invisible. Restore them to light ink.

2. FAINT WHITE  -- white text at 30-50% opacity on near-black is 2.5-4.8:1,
   unreadable at 9-12px. Raise the floor to /60 (6.8:1, AA) and /50 -> /70.

Scoped to text-* and hover:text-* only. Background/border alpha overlays are
left alone. `text-[#0D0F12]` (full) and `/90` sit on orange and stay.
"""
import re, pathlib, sys

ROOT = pathlib.Path("src")
SUFFIXES = {".ts", ".tsx"}

stats = {}

def sub(text, label, pattern, repl):
    text, n = re.subn(pattern, repl, text)
    if n:
        stats[label] = stats.get(label, 0) + n
    return text

def process(text):
    # --- 1. dark-on-dark (alpha variants, on dark surfaces) ---
    text = sub(text, "dark ink /40 -> light /60", r"text-\[#0D0F12\]/40", "text-[#F7F7F8]/60")
    text = sub(text, "dark ink /60 -> light /70", r"text-\[#0D0F12\]/60", "text-[#F7F7F8]/70")
    text = sub(text, "dark ink /70 -> light /70", r"text-\[#0D0F12\]/70", "text-[#F7F7F8]/70")
    # hover full-opacity dark -> light (these sit on dark surfaces)
    text = sub(text, "dark ink hover -> light", r"hover:text-\[#0D0F12\]", "hover:text-[#F7F7F8]")

    # --- 2. faint white text: raise the floor ---
    text = sub(text, "white /30 -> /60", r"text-\[#F7F7F8\]/30", "text-[#F7F7F8]/60")
    text = sub(text, "white /35 -> /60", r"text-\[#F7F7F8\]/35", "text-[#F7F7F8]/60")
    text = sub(text, "white /40 -> /60", r"text-\[#F7F7F8\]/40", "text-[#F7F7F8]/60")
    text = sub(text, "white /45 -> /60", r"text-\[#F7F7F8\]/45", "text-[#F7F7F8]/60")
    text = sub(text, "white /50 -> /70", r"text-\[#F7F7F8\]/50", "text-[#F7F7F8]/70")
    return text

def main():
    files = [p for p in ROOT.rglob("*") if p.suffix in SUFFIXES]
    changed = 0
    for p in files:
        orig = p.read_text(encoding="utf-8")
        new = process(orig)
        if new != orig:
            p.write_text(new, encoding="utf-8")
            changed += 1
    print(f"files changed: {changed}")
    for k in sorted(stats, key=lambda k: -stats[k]):
        print(f"  {stats[k]:>4}  {k}")

if __name__ == "__main__":
    main()
