#!/usr/bin/env python3
"""Migrate the production component tree off stale palettes onto canonical
design tokens. Property-aware (text/bg/border differ for alpha tints);
canonical values untouched. Run from the repo root."""
import re, sys, glob

SOLID = {
    '#1A1F2E': 'var(--color-text)',
    '#64748B': 'var(--color-text-muted)',
    '#4A5568': 'var(--color-text-muted)',
    '#0C221F': 'var(--color-text)',
    '#1E293B': 'var(--color-text)',
    '#0F172A': 'var(--color-text)',
    '#5B2EA6': 'var(--color-primary)',
    '#93EE34': 'var(--color-primary)',
    '#203E31': 'var(--color-primary)',
    '#4A238A': 'var(--color-primary-strong)',
    '#4A2489': 'var(--color-primary-strong)',
    '#82D62C': 'var(--color-primary-strong)',
    '#E8985E': 'var(--color-accent)',
    '#FAFAF8': 'var(--color-surface)',
    '#F0EDE8': 'var(--color-bg)',
    '#F4F7F2': 'var(--color-surface-elevated)',
    '#FCE3EA': 'var(--color-surface-elevated)',
}

# alpha-tinted hex -> token, keyed by the property kind (text/bg/border).
ALPHA = {
    'text': {'#1A1F2E': 'var(--color-text-muted)'},
    'bg': {
        '#93EE34': 'var(--color-primary-subtle)',
        '#5B2EA6': 'var(--color-primary-subtle)',
        '#1A1F2E': 'var(--color-surface-elevated)',
        '#FCE3EA': 'var(--color-surface-elevated)',
    },
    'border': {
        '#93EE34': 'var(--color-primary)',
        '#E8985E': 'var(--color-accent)',
        '#5B2EA6': 'var(--color-primary)',
    },
}

NAME_STRONG = {
    'emerald-500': 'var(--color-success)', 'emerald-600': 'var(--color-success)',
    'emerald-700': 'var(--color-success)', 'emerald-800': 'var(--color-success)',
    'emerald-900': 'var(--color-success)',
    'amber-500': 'var(--color-warning)', 'amber-600': 'var(--color-warning)',
    'amber-700': 'var(--color-warning)', 'amber-800': 'var(--color-warning)',
    'teal-500': 'var(--color-accent)', 'teal-600': 'var(--color-accent)',
    'teal-700': 'var(--color-accent)', 'teal-800': 'var(--color-accent)',
    'teal-900': 'var(--color-accent)',
    'purple-600': 'var(--color-primary)',
}
NAME_TINT = {
    'emerald-50': 'var(--color-surface-elevated)', 'emerald-100': 'var(--color-surface-elevated)',
    'amber-50': 'var(--color-surface-elevated)', 'amber-100': 'var(--color-surface-elevated)',
    'teal-50': 'var(--color-surface-elevated)', 'teal-100': 'var(--color-surface-elevated)',
    'purple-50': 'var(--color-primary-subtle)',
}

KEEP = {'#0D1117', '#FF5A1F', '#E5E8EC', '#FFFFFF', '#F0F2F5', '#EFF1F4',
        '#DC2626', '#B45309', '#16A34A', '#2563EB', '#E64A14', '#7A8494',
        '#5A6472', '#F7F8FA'}

# arbitrary color:  [variant:]prop-[#HEX(/NN)]
ARB = re.compile(
    r'((?:[a-zA-Z0-9]+:)?(?:text|bg|border|from|to|ring|fill|stroke|shadow|divide|outline|accent))-'
    r'\[(#[0-9A-Fa-f]{6,8})\](?:/(\d+))?')

# named color:  [variant:]prop-color-shade
NAMED = re.compile(
    r'((?:[a-zA-Z0-9]+:)?(?:text|bg|border|from|to))-(emerald|amber|teal|purple)-(500|600|700|800|900|50|100)')

def kind_of(prop):
    p = prop.split(':')[-1]
    if p.startswith('text'): return 'text'
    if p.startswith('bg'): return 'bg'
    if p.startswith('border') or p.startswith('divide') or p.startswith('outline'): return 'border'
    return 'other'

def migrate(s):
    changes = 0
    def arb_repl(m):
        nonlocal changes
        prop, hexv, alpha = m.group(1), m.group(2).upper(), m.group(3)
        kind = kind_of(prop)
        if alpha is not None:
            tok = ALPHA.get(kind, {}).get(hexv) or ALPHA.get('bg', {}).get(hexv) or SOLID.get(hexv)
        else:
            if hexv in KEEP:
                return m.group(0)
            tok = SOLID.get(hexv) or SOLID.get(hexv.lower()) or SOLID.get(hexv.upper())
        if tok:
            changes += 1
            return f'{prop}-[color:{tok}]'
        return m.group(0)
    s = ARB.sub(arb_repl, s)

    def named_repl(m):
        nonlocal changes
        prop, name, shade = m.group(1), m.group(2), m.group(3)
        key = f'{name}-{shade}'
        kind = kind_of(prop)
        if kind == 'border':
            tok = 'var(--color-border)'
        else:
            tok = NAME_TINT.get(key) if shade in ('50', '100') else NAME_STRONG.get(key)
        if tok:
            changes += 1
            return f'{prop}-[color:{tok}]'
        return m.group(0)
    s = NAMED.sub(named_repl, s)

    # text-white on a primary (orange) button -> dark accent ink (the canonical
    # pairing -- orange + dark ink, never orange + white).
    def white_on_primary(line):
        nonlocal changes
        if 'bg-[color:var(--color-primary)]' in line and 'text-white' in line:
            new = line.replace('text-white', 'text-[color:var(--accent-ink)]')
            if new != line: changes += 1
            return new
        return line
    s = '\n'.join(white_on_primary(line) for line in s.split('\n'))

    return s, changes

def migrate_css(s):
    for k, v in SOLID.items():
        if k.upper() in KEEP:
            continue
        s = s.replace(k, v)
    return s

def main():
    files = sys.argv[1:]
    if not files:
        files = sorted(
            glob.glob('src/app/AppShell.tsx')
            + glob.glob('src/features/home/*.tsx')
            + glob.glob('src/features/city/*.tsx')
            + glob.glob('src/features/offers/*.tsx')
            + glob.glob('src/features/spaces/*.tsx')
            + glob.glob('src/features/requests/requests.css')
        )
    total = 0
    for f in files:
        with open(f) as fh:
            src = fh.read()
        if f.endswith('.css'):
            new = migrate_css(src)
        else:
            new, n = migrate(src)
            total += n
            print(f'{f}: {n} changes')
        with open(f, 'w') as fh:
            fh.write(new)
    print(f'TOTAL: {total} changes')

if __name__ == '__main__':
    main()
