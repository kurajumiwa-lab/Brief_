#!/usr/bin/env python3
"""
Readability fix #2: dark-on-dark in INACTIVE/else branches.

The first pass only fixed text-[#0D0F12]/NN (alpha) and hover:text-[#0D0F12].
It missed FULL-opacity dark ink sitting on dark surfaces in ternary classNames
-- the inactive branch of tab/chip/filter buttons. Those read as invisible
unless the orange active state is applied (exactly the "only visible with the
orange overlay" report).

Patterns fixed (all dark background + dark text = unreadable):
  bg-[#12151A] text-[#0D0F12]   -> bg-[#12151A] text-[#F7F7F8]/70   (inactive pill)
  bg-[#171A20] text-[#0D0F12]   -> bg-[#171A20] text-[#F7F7F8]/70   (inactive pill)
  text-[#0D0F12] hover:bg-[#171A20] -> text-[#F7F7F8]/70 hover:bg-[#171A20]
Plus one hover chip whose resting state was dark-on-dark and whose hover
flipped to light-on-orange (both wrong): fix both directions.

Active branches (bg-[#FF5A1F] text-[#0D0F12]) are correct and untouched.
"""
import re, pathlib

ROOT = pathlib.Path("src")
SUFFIXES = {".ts", ".tsx"}

stats = {}

def sub(text, label, pattern, repl):
    text, n = re.subn(pattern, repl, text)
    if n:
        stats[label] = stats.get(label, 0) + n
    return text

def process(text):
    text = sub(text, "surface pill inactive", r"bg-\[#12151A\] text-\[#0D0F12\]", "bg-[#12151A] text-[#F7F7F8]/70")
    text = sub(text, "surface-2 pill inactive", r"bg-\[#171A20\] text-\[#0D0F12\]", "bg-[#171A20] text-[#F7F7F8]/70")
    text = sub(text, "ghost tab inactive", r"text-\[#0D0F12\] hover:bg-\[#171A20\]", "text-[#F7F7F8]/70 hover:bg-[#171A20]")
    # the hover chip: resting dark-on-dark, hover light-on-orange (both wrong)
    text = sub(
        text,
        "hover chip both directions",
        r"text-\[10px\] font-bold text-\[#0D0F12\] transition-colors hover:bg-\[#FF5A1F\] hover:text-\[#F7F7F8\]",
        "text-[10px] font-bold text-[#F7F7F8]/80 transition-colors hover:bg-[#FF5A1F] hover:text-[#0D0F12]"
    )
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
