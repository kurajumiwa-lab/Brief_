#!/usr/bin/env python3
"""
Brief palette migration: light violet/lavender  ->  dark charcoal + orange/cyan.

Ordered in three phases so dual-role colors (#251045 ink-vs-fill, #FFFFFF
text-vs-surface) are disambiguated BEFORE the generic hex map collapses them.

Phase 1 (PRE)  : property-aware, on ORIGINAL hexes.
Phase 2 (GLOBAL): the unambiguous single-color map + catch-all for #251045/#FFFFFF.
Phase 3 (POST) : pair fixes on NEW hexes (white/light text on the orange accent).
"""
import re, sys, pathlib

ROOT = pathlib.Path("src")
SKIP_DIRS = {"assets", "styles"}  # styles/arenaArcade.css stays as-is; assets = binaries
SKIP_FILES = set()
SUFFIXES = {".ts", ".tsx", ".css", ".jsx"}

stats = {}

def sub(text, label, pattern, repl, flags=0):
    text, n = re.subn(pattern, repl, text, flags=flags)
    if n:
        stats[label] = stats.get(label, 0) + n
    return text

def process(text: str) -> str:
    # ---------- PHASE 1: PRE (original hexes) ----------
    # inline style toggles  ->  active = orange fill, inactive = dark surface
    text = sub(text, "toggle fill/card",      r"\?\s*'#251045'\s*:\s*'#FFFFFF'", "? '#FF5A1F' : '#12151A'")
    text = sub(text, "toggle fill/surface",   r"\?\s*'#251045'\s*:\s*'#F1EDF7'", "? '#FF5A1F' : '#171A20'")
    text = sub(text, "toggle fill/line",      r"\?\s*'#251045'\s*:\s*'#D6CFE4'", "? '#FF5A1F' : '#222630'")
    text = sub(text, "toggle inverted",       r"\?\s*'#F1EDF7'\s*:\s*'#251045'", "? '#171A20' : '#FF5A1F'")
    # filled buttons (both key orders)
    text = sub(text, "fill btn (bg,color)",   r"background:\s*'#251045'\s*,\s*color:\s*'#FFFFFF'", "background: '#FF5A1F', color: '#0D0F12'")
    text = sub(text, "fill btn (color,bg)",   r"color:\s*'#FFFFFF'\s*,\s*background:\s*'#251045'", "color: '#0D0F12', background: '#FF5A1F'")
    # live white -> orange
    text = sub(text, "live white fill",       r"background:\s*live\s*\?\s*'#FFFFFF'\s*:\s*'rgba\(255,255,255,0\.5\)'", "background: live ? '#FF5A1F' : 'rgba(247,247,248,0.12)'")

    # Tailwind arbitrary values (exact, no alpha) + variant prefixes
    v = r"(?:(?:hover|focus|active|group-hover|disabled|selected):)?"
    text = sub(text, "tw bg white->surface",  r"\b(" + v + r"bg)-\[#FFFFFF\]", r"\1-[#12151A]", re.I)
    text = sub(text, "tw border white->line", r"\b(" + v + r"border)-\[#FFFFFF\]", r"\1-[#222630]", re.I)
    text = sub(text, "tw text white->ink",    r"\b(" + v + r"text)-\[#FFFFFF\]", r"\1-[#F7F7F8]", re.I)
    text = sub(text, "tw bg ink->accent",     r"\b(" + v + r"bg)-\[#251045\](?!/)", r"\1-[#FF5A1F]", re.I)
    text = sub(text, "tw bg ink scrim",       r"\b(" + v + r"bg)-\[#251045\]/", r"\1-[#0D0F12]/", re.I)
    text = sub(text, "tw text ink->ink",      r"\b(" + v + r"text)-\[#251045\]", r"\1-[#F7F7F8]", re.I)

    # ---------- PHASE 2: GLOBAL hex map ----------
    HEXMAP = {
        "251045": "F7F7F8",  # ink (any remaining = text)
        "D6CFE4": "222630",  # hairline
        "FBFAFD": "12151A",  # card
        "5B2EA6": "FF5A1F",  # violet accent -> orange
        "6C3EC9": "22E6E0",  # bright violet -> cyan
        "F1EDF7": "171A20",  # light surface
        "F4F1FA": "171A20",
        "150826": "08090B",  # near-black violet
        "2A1657": "0D0F12",
        "3A2169": "1D2027",
        "E9E4F2": "1D2027",
        "E9E5F0": "1D2027",
        "E9E0F5": "1D2027",
        "E9E2F3": "1D2027",
        "E6E1EF": "1D2027",
        "E4DAF2": "1D2027",
        "E3DEEE": "1D2027",
        "D8D2E1": "08090B",
        "AE9FD6": "A7ACB5",
        "8F84A8": "6E737C",
        "4A2391": "E04D15",  # violet hover -> darker orange
        "8A3B3B": "FF5D6C",
        "B3261E": "FF5D6C",
        "B42318": "FF5D6C",
        "C0392B": "FF5D6C",
        "BE2036": "FF5D6C",
        "8A1E2D": "FF5D6C",
        "B6441C": "FFCC66",  # ember -> warning
        "2E6B3F": "38E879",  # green -> success
        "2E6B3E": "38E879",
        "00DF8F": "38E879",
        "1F7A33": "38E879",
        "FDF1F0": "171A20",  # light tints -> surface-2
        "FDF0EE": "171A20",
        "FBEDEF": "171A20",
        "F5D8DD": "171A20",
        "EAF4EC": "171A20",
        "FAF9F6": "171A20",
        "E5B558": "FFCC66",
        "B45309": "FF5A1F",
        "8A5A00": "FF5A1F",
        "7A4E00": "FF5A1F",
        "2C1C04": "0D0F12",
        "E040FB": "22E6E0",
        "D8D4CC": "6E737C",
        "FFFFFF": "F7F7F8",  # any remaining white = text/icon
    }
    for old, new in HEXMAP.items():
        text = sub(text, f"hex {old}", rf"(?<![\w#])#{old}(?![\w])", f"#{new}", re.I)

    # ---------- PHASE 2b: rgba remaps ----------
    text = sub(text, "rgba ink", r"rgba\(\s*37\s*,\s*16\s*,\s*69\s*,", "rgba(247, 247, 248,", re.I)
    text = sub(text, "rgba deep violet scrim", r"rgba\(\s*21\s*,\s*8\s*,\s*38\s*,", "rgba(8, 9, 11,", re.I)
    text = sub(text, "rgba red BE2036", r"rgba\(\s*190\s*,\s*32\s*,\s*54\s*,", "rgba(255, 93, 108,", re.I)

    # ---------- PHASE 3: POST (new hexes) ----------
    # T.primary buttons now resolve to orange via var(--m3-primary); their text must be dark.
    text = sub(text, "T.primary on-accent", r"background:\s*T\.primary\s*,\s*color:\s*'#F7F7F8'", "background: T.primary, color: '#0D0F12'")
    # any className carrying an orange fill should get dark text on it
    def fix_class(m):
        s = m.group(0)
        if re.search(r"bg-\[#FF5A1F\](?!/)", s):
            s = re.sub(r"text-\[#F7F7F8\]|text-\[#FFFFFF\]|\btext-white\b", "text-[#0D0F12]", s)
        return s
    text, n = re.subn(r'className=(?:"[^"]*"|\{[^}]*\})', fix_class, text)
    if n:
        stats["accent on-accent text"] = stats.get("accent on-accent text", 0) + n
    return text

def main():
    files = [p for p in ROOT.rglob("*")
             if p.suffix in SUFFIXES
             and not any(part in SKIP_DIRS for part in p.parts)
             and p.name not in SKIP_FILES]
    total = 0
    for p in files:
        orig = p.read_text(encoding="utf-8")
        new = process(orig)
        if new != orig:
            p.write_text(new, encoding="utf-8")
            total += 1
    print(f"files changed: {total}")
    for k in sorted(stats, key=lambda k: -stats[k]):
        print(f"  {stats[k]:>5}  {k}")

if __name__ == "__main__":
    main()
