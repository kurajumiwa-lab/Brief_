#!/usr/bin/env python3
"""Phase 5: chrome extraction. Moves the shell's UI chrome JSX out of App.tsx:
  StatusToasts  (toastMessage flyout + spring empty-state overlay)
  DesktopRail   (left nav rail)
  DockNav       (mobile bottom dock)
Blocks are copied verbatim; props are computed by census. App inserts ONE
<StatusToasts/>, <DesktopRail/>, <DockNav/> mount at each position.
"""
import re, sys

APPLY = '--apply' in sys.argv
APP = 'App.tsx'
OUT = 'src/shell/Chrome.tsx'

lines = open(APP).read().split('\n')
joined = '\n'.join(lines)
off = [0]
for l in lines:
    off.append(off[-1] + len(l) + 1)

SPECS = {
  'StatusToasts': (['{toastMessage && (', '{springOverlayOpen && (']),
  'DesktopRail': (['DESKTOP / TABLET RAIL'], 'tag'),   # comment anchor, take the <nav after
  'DockNav': (['MOBILE DOCK'], 'comment'),             # comment anchor, take the <button + <nav after
}

def block_end(i):
    depth = 0
    started = False
    for k in range(i, len(lines)):
        for ch in lines[k]:
            if ch in '{([':
                depth += 1
                started = True
            elif ch in ')]}':
                depth -= 1
        if started and depth == 0:
            return k + 1
    raise RuntimeError(i)

# --- locate spans --------------------------------------------------------------
spans = {}   # component -> [(s,e),...]

# StatusToasts: two gated blocks
t = [i for i,l in enumerate(lines) if l.strip() == '{toastMessage && (']
s_ = [i for i,l in enumerate(lines) if l.strip() == '{springOverlayOpen && (']
assert len(t) == 1 and len(s_) == 1
spans['StatusToasts'] = [(t[0], block_end(t[0])), (s_[0], block_end(s_[0]))]

def tag_end(i, tag):
    indent = len(lines[i]) - len(lines[i].lstrip())
    closer = ' ' * indent + f'</{tag}>'
    for k in range(i + 1, len(lines)):
        if lines[k].rstrip() == closer:
            return k + 1
    raise RuntimeError(f'no </{tag}> for line {i+1}')

# DesktopRail: the comment line then the <nav that follows (tag-balanced)
c = next(i for i,l in enumerate(lines) if 'DESKTOP / TABLET RAIL' in l)
n = next(i for i in range(c, len(lines)) if re.match(r"^\s*<nav", lines[i]))
spans['DesktopRail'] = [(n, tag_end(n, 'nav'))]

# DockNav: comment -> <button ...> then <nav ...>
c = next(i for i,l in enumerate(lines) if 'MOBILE DOCK' in l)
b = next(i for i in range(c, len(lines)) if re.match(r"^\s*<button", lines[i]))
be = tag_end(b, 'button')
n2 = next(i for i in range(be, len(lines)) if re.match(r"^\s*<nav", lines[i]))
spans['DockNav'] = [(b, be), (n2, tag_end(n2, 'nav'))]

for k, v in spans.items():
    print(k, [(s+1, e, e-s) for s, e in v])
all_spans = [sp for v in spans.values() for sp in v]
for (a,b2),(cc,d) in zip(sorted(all_spans), sorted(all_spans)[1:]):
    assert b2 <= cc, 'overlap'

blocks = {k: ['\n'.join(lines[s:e]) for s, e in v] for k, v in spans.items()}

# --- census props ----------------------------------------------------------------
DECLS = {}
for i, l in enumerate(lines):
    m = re.match(r"^  const \[(\w+), (\w+)\] = useState", l)
    if m:
        DECLS[m.group(1)] = 'any'
        DECLS[m.group(2)] = 'any'
    m2 = re.match(r"^  const (\w+)", l)
    if m2:
        DECLS.setdefault(m2.group(1), 'any')
he = re.finditer(r"^  const \{([\s\S]*?)\n  \} = use\w+\(\{", joined, re.M)
for m in he:
    for n in m.group(1).split(','):
        n = n.strip()
        if n:
            DECLS[n] = 'any'

imp_named = set()
for grp, mod in re.findall(r"import(?: type)? \{([^}]+)\} from '([^']+)'", joined, re.S):
    imp_named |= {x.strip().split(' as ')[-1] for x in grp.split(',') if x.strip()}
imp_named |= set(re.findall(r"^import \* as (\w+) from", joined))
imp_named |= set(re.findall(r"^import (\w+) from", joined, re.M))
core_names = set(re.findall(r"export (?:const|function|type|interface|class) (\w+)", open('src/model/core.tsx').read()))
names_names = set(re.findall(r"export (?:const|function|type|interface|class) (\w+)", open('src/ui/names.ts').read()))
GLOBALS = {'React','console','window','document','localStorage','fetch','alert','JSON','Object','Array','Math','Date','Set','Map','Promise','Number','String','Boolean','Error','URL','encodeURIComponent','location','history','navigator'}
KW = set("const let var function return if else for while do async await new typeof in of try catch finally throw case switch break continue default export import from as this null true false undefined void delete instanceof yield class extends implements interface type satisfies keyof readonly".split())

def census(blob):
    clean = blob  # JSX: avoid quote-stripping (apostrophes); false positives ok as extra props? NO -- false positives as *props* are fine, as *imports* must exist
    idents = set(re.findall(r"\b([A-Za-z_]\w*)\b", clean))
    members = set(re.findall(r"\.(\w+)", clean))
    tags = set(re.findall(r"<([A-Z]\w*)", clean))
    props = set()
    imports = {}
    for n in sorted(idents):
        if n in KW or n in GLOBALS or n in members:
            continue
        if n in DECLS:
            props.add(n)
    for tg in sorted(tags):
        if tg in props or tg in GLOBALS:
            continue
        if tg in imp_named:
            continue  # reuse? Chrome is in src/shell -> same specifier depth differs; handle below
        if tg in core_names:
            imports[tg] = ('../../model/core', 'value')
        elif tg in names_names:
            imports[tg] = ('../../ui/names', 'value')
        else:
            import os
            lives = None
            for cand in (f'src/components/{tg}.tsx', f'src/components/{tg}/{tg}.tsx'):
                if os.path.exists(cand):
                    lives = cand.replace('src/', '../../')
                    break
            imports[tg] = (lives if lives else 'lucide-react', 'value')
    return props, imports

# figure module map for App-imported names so Chrome can import them from src/shell depth
mod_map = {}
for mm in re.finditer(r"import ([^;]+?) from '(\./[^']+)';", joined):
    clause, mod = mm.groups()
    if clause.startswith('* as '):
        mod_map[clause[5:].strip()] = '../' + mod[2:]
        continue
    parts = clause.split(',')
    if not parts[0].strip().startswith('{'):
        if parts[0].strip():
            mod_map[parts[0].strip()] = ('../' + mod[2:], 'default')
        parts = parts[1:]
    rest = ','.join(parts).strip()
    if rest.startswith('{'):
        for x in rest.strip('{} ').split(','):
            x = x.strip()
            if x:
                if x.startswith('type '):
                    mod_map[x[5:].strip().split(' as ')[-1]] = ('../' + mod[2:], 'type')
                else:
                    mod_map[x.split(' as ')[-1].strip()] = ('../' + mod[2:], 'value')

comp_parts = []
all_props = {}
import_lines = {}
for comp, bls in blocks.items():
    blob = '\n'.join(bls)
    props, imports = census(blob)
    # imports from App's map for capitalized idents that appear (component tags already handled);
    # but also any ident that App imported as a value used bare in JSX (lucide icons used as components etc.)
    for n in sorted(set(re.findall(r"\b([A-Z]\w*)\b", blob))):
        if n in props or n in {k for k, v in imports.items()}:
            continue
        if n in mod_map:
            imports[n] = mod_map[n]
    all_props[comp] = props
    # emit import spec per (module)
    by_mod = {}
    for nm, spec in imports.items():
        if isinstance(spec, tuple) and spec[1:]:
            mod, kind = spec
            by_mod.setdefault((mod, kind), []).append(nm)
    comp_parts.append((comp, props, imports, by_mod))

imps = []
for comp, props, imports, by_mod in comp_parts:
    for (mod, kind), ns in sorted(by_mod.items()):
        ns = sorted(set(ns))
        if kind == 'type':
            imps.append(f"import type {{ {', '.join(ns)} }} from '{mod}';")
        elif kind == 'default':
            imps.append(f"import {ns[0]} from '{mod}';")
        else:
            imps.append(f"import {{ {', '.join(ns)} }} from '{mod}';")
imps = ["import React from 'react';"] + list(dict.fromkeys(imps))

parts = []
parts.append('\n'.join(imps))
parts.append("""
// ---------------------------------------------------------------------------
// CHROME -- App shell furniture: toasts, spring overlay, desktop rail, mobile
// dock. Extracted verbatim from App.tsx (Phase 5). All state lives in App /
// hooks; these only render.
// ---------------------------------------------------------------------------
""")
for comp, props, imports, by_mod in comp_parts:
    bls = blocks[comp]
    body = '\n\n'.join(bls)
    if comp == 'StatusToasts':
        wrapper = f"""export function StatusToasts(props: {{ {', '.join(f'{n}: any' for n in sorted(props))} }}) {{
  const {{ {', '.join(sorted(props))} }} = props;
  return (
    <>
{body}
    </>
  );
}}"""
    else:
        wrapper = f"""export function {comp}(props: {{ {', '.join(f'{n}: any' for n in sorted(props))} }}) {{
  const {{ {', '.join(sorted(props))} }} = props;
  return (
    <>
{body}
    </>
  );
}}"""
    parts.append(wrapper)
out_src = '\n\n'.join(parts) + '\n'
open(OUT, 'w').write(out_src)
print('wrote', OUT, len(out_src.splitlines()), 'lines')
for comp in blocks:
    print(' ', comp, 'props:', sorted(all_props[comp]))

if not APPLY:
    sys.exit(0)

lines2 = lines[:]
for s, e in sorted(all_spans, reverse=True):
    del lines2[s:e]
src2 = '\n'.join(lines2)
# mounts: StatusToasts at old toast position; rail where it was; dock where it was
def mount(comp, props):
    return f"      <{comp} " + ' '.join(f"{n}={{{n}}}" for n in sorted(props)) + " />"
# find anchors by leftover context: insert before the Roofless comment for toasts; rail by 'Main Stream' nav? we deleted positions; simpler: use relative orders.
newlines = src2.split('\n')
i_spring_comment = next(i for i,l in enumerate(newlines) if 'Spring-animated' in l or 'Toast' == l.strip().replace('{/*','').replace('*/}','').strip())
# insert StatusToasts right before the '{/* DESKTOP' comment's parent div? safest place: right after 'return (<div' find the div open line then after it
i_ret = next(i for i,l in enumerate(newlines) if l.startswith('  return ('))
i_mount = None
for i in range(i_ret, len(newlines)):
    if re.match(r"^    <div", newlines[i]):
        i_mount = i + 1
        break
newlines[i_mount:i_mount] = ['', mount('StatusToasts', all_props['StatusToasts'])]
# rail: insert where flex-1 flex div opens? we need it INSIDE the flex container; find '<div className="flex-1 flex w-full">'
i_flex = next(i for i,l in enumerate(newlines) if 'flex-1 flex w-full' in l)
newlines[i_flex+1:i_flex+1] = ['', mount('DesktopRail', all_props['DesktopRail'])]
# dock: before the CAMPAIGN DASHBOARD comment
i_dock = next(i for i,l in enumerate(newlines) if 'CAMPAIGN DASHBOARD' in l)
newlines[i_dock:i_dock] = [mount('DockNav', all_props['DockNav']), '']
src3 = '\n'.join(newlines)
src3 = src3.replace("import { OverlaysShell } from './screens/OverlaysShell';",
    "import { OverlaysShell } from './screens/OverlaysShell';\nimport { StatusToasts, DesktopRail, DockNav } from './shell/Chrome';", 1)
open(APP, 'w').write(src3)
print('App.tsx now', len(src3.splitlines()), 'lines')
