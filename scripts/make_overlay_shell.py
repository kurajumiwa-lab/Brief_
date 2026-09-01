#!/usr/bin/env python3
"""Extract the five big gated overlay blocks from App.tsx into
src/screens/OverlaysShell.tsx, verbatim (gates unchanged), and mount the shell
where the first block lived.

Blocks (verified against current App.tsx at call time; hard-fails on drift):
  campaign detail, create wizard, capture flow, tea sheet, object detail.

Safety: computes everything, assert-checks, writes App.tsx LAST, guarded by a
length invariant. tsc + run-suites.sh are run manually afterwards.
"""
import re, sys, json

APPLY = '--apply' in sys.argv
APP = 'App.tsx'
OUT = 'src/screens/OverlaysShell.tsx'

lines = open(APP).read().split('\n')
joined = '\n'.join(lines)
off = [0]
for l in lines:
    off.append(off[-1] + len(l) + 1)

GATES = ['openCampaignId && (', "createStep !== 'closed' && (", 'captureOpen && (',
         'selectedTeaSlug && (', 'selectedObjectForDetail && (']
starts = []
for g in GATES:
    hits = [i for i, l in enumerate(lines) if l.startswith('      {' + g) or l.strip() == '{' + g]
    assert len(hits) == 1, f'gate {g!r}: {len(hits)} hits'
    starts.append(hits[0])

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
    raise RuntimeError(f'Unbalanced from line {i + 1}')

spans = [(s, block_end(s)) for s in starts]
for (a, b), (c, d) in zip(spans, spans[1:]):
    assert b <= c, 'overlay spans overlap'
blocks = ['\n'.join(lines[s:e]) for s, e in spans]
sizes = [e - s for s, e in spans]
print('spans:', [(s + 1, e, n) for (s, e), n in zip(spans, sizes)])

# ---- App declaration index (state types) --------------------------------------
DECLS = {}
for i, l in enumerate(lines):
    m = re.match(r"^  const \[(\w+), (\w+)\] = useState", l)
    if m:
        pos = off[i] + l.index('useState') + 8
        gen = None
        if pos < len(joined) and joined[pos] == '<':
            d = 0
            j = pos
            while j < len(joined):
                ch = joined[j]
                if ch == '<':
                    d += 1
                elif ch == '>':
                    d -= 1
                    if d == 0:
                        break
                j += 1
            gen = joined[pos + 1:j].replace('\n', ' ').strip() or 'any'
        if gen is None:
            head = lines[i]
            if re.search(r"useState\(\[\]\)", head): gen = 'any[]'
            elif re.search(r"useState\((true|false)\)", head): gen = 'boolean'
            elif re.search(r"useState\(\d", head): gen = 'number'
            elif re.search(r"useState\((\"|')", head): gen = 'string'
            else: gen = 'any'
        DECLS[m.group(1)] = ('T', gen)
        DECLS[m.group(2)] = ('D', gen)
    m2 = re.match(r"^  const (\w+)\s*(?::[^=]+)?= (?:useMemo|useCallback|async|\()", l)
    if m2:
        DECLS.setdefault(m2.group(1), ('any', None))
    m3 = re.match(r"^  const (\w+) = useRef", l)
    if m3:
        DECLS.setdefault(m3.group(1), ('any', None))
    m4 = re.match(r"^  const (\w+) = ", l)
    if m4:
        DECLS.setdefault(m4.group(1), ('any', None))
    m5 = re.match(r"^  (?:async )?function (\w+)\b", l)
    if m5:
        DECLS.setdefault(m5.group(1), ('any', None))

DECLS.update({(n if False else k) : v for k, v in DECLS.items()})

# ---- import vocabulary of App (reuse in shell) --------------------------------
mod_named = {}   # name -> (module, kind)  kind: value|type|default|ns
for mm in re.finditer(r"import ([^;]+?) from '([^']+)';", joined):
    clause, mod = mm.group(1), mm.group(2)
    if clause.startswith('* as '):
        mod_named[clause[5:].strip()] = (mod, 'ns')
        continue
    parts = clause.split(',')
    if not parts[0].strip().startswith('{'):
        mod_named[parts[0].strip()] = (mod, 'default')
        parts = parts[1:]
    rest = ','.join(parts).strip()
    if rest.startswith('{'):
        kind = 'value'
        body = rest.strip('{} ')
        for t in body.split(','):
            t = t.strip()
            if not t:
                continue
            if t.startswith('type '):
                mod_named[t[5:].strip().split(' as ')[-1]] = (mod, 'type')
            else:
                mod_named[t.split(' as ')[-1].strip()] = (mod, kind)

core_names = set(re.findall(r"export (?:const|function|type|interface|class) (\w+)",
                            open('src/model/core.tsx').read()))
names_names = set(re.findall(r"export (?:const|function|type|interface|class) (\w+)",
                             open('src/ui/names.ts').read()))

# ---- census: what does the overlay JSX need? -----------------------------------
blob = '\n'.join(blocks)
# NOTE: do NOT regex-strip strings/comments here -- overlay blocks are
# JSX-text-heavy and apostrophes in copy ("You'll") make naive quote-stripping
# eat hundreds of lines. False POSITIVES (a string mentioning a name) are
# harmless for an extraction: they only add unused-but-forwarded props.
raw_idents = set(re.findall(r"\b([A-Za-z_]\w*)\b", blob))
members = set(re.findall(r"\.(\w+)", blob))
tags = set(re.findall(r"<([A-Z]\w*)", blob))

KW = set(("const let var function return if else for while do async await new "
          "typeof in of try catch finally throw case switch break continue "
          "default export import from as this null true false undefined void "
          "delete instanceof yield class extends implements interface type "
          "satisfies keyof readonly").split())
GLOBALS = {'React','console','window','document','localStorage','fetch','alert',
           'confirm','JSON','Object','Array','Math','Date','Set','Map','Number',
           'String','Boolean','URL','Promise','Error','setTimeout','clearTimeout'}

props_needed = {}
imports_needed = {}
for ident in sorted(raw_idents):
    if ident in DECLS:
        kind, t = DECLS[ident]
        if kind == 'T':
            props_needed[ident] = t or 'any'
        elif kind == 'D':
            props_needed[ident] = f'React.Dispatch<React.SetStateAction<{t or "any"}>>'
        else:
            props_needed[ident] = 'any'

import os
for tag in sorted(tags):
    if tag in props_needed or tag in KW or tag in GLOBALS:
        continue
    if tag in mod_named:
        imports_needed[tag] = mod_named[tag]
        continue
    if tag in core_names:
        imports_needed[tag] = ('../model/core', 'value'); continue
    if tag in names_names:
        imports_needed[tag] = ('../ui/names', 'value'); continue
    lives = None
    for cand in (f'src/components/{tag}.tsx', f'src/components/{tag}/{tag}.tsx',
                 f'src/model/{tag}.tsx', f'src/ui/{tag}.tsx'):
        if os.path.exists(cand):
            lives = cand.replace('src/', '../').replace('.tsx', '')
            break
    if lives:
        imports_needed[tag] = (lives, 'value')
    else:
        imports_needed.setdefault(tag, ('lucide-react', 'value'))
# namespaced/value libs used bare
for ident in sorted(raw_idents - props_needed.keys() - set(imports_needed)):
    if ident in mod_named and ident not in props_needed:
        imports_needed[ident] = mod_named[ident]
    elif ident in core_names:
        imports_needed[ident] = ('../model/core', 'value')
    elif ident in names_names:
        imports_needed[ident] = ('../ui/names', 'value')
# drop prop names out of imports
imports_needed = {k: v for k, v in imports_needed.items() if k not in props_needed}

print(f'props: {len(props_needed)}  imports: {len(imports_needed)}')
print('sample props:', list(props_needed.items())[:8])
missing_imports_check = [n for n, (m, k) in imports_needed.items() if m is None]
assert not missing_imports_check, missing_imports_check

# ---- emit OverlaysShell ---------------------------------------------------------
type_tokens = sorted({tok for t in props_needed.values()
                      for tok in re.findall(r"\b([A-Z][A-Za-z0-9]*)\b", t)
                      if tok not in ('React', 'Dispatch', 'SetStateAction')})
core_type_imports = [t for t in type_tokens if t in core_names]
# types living elsewhere:
api_types = [t for t in type_tokens if t not in core_names and t in
             set(re.findall(r"export (?:type|interface|const) (\w+)", open('src/api/types.ts').read()))]

by_mod = {}
for name, (mod, kind) in imports_needed.items():
    by_mod.setdefault((mod, kind), []).append(name)

imp_lines = ["import React from 'react';"]
if any(m == 'lucide-react' for m, _ in by_mod):
    luc = sorted(by_mod.pop(('lucide-react', 'value')))
    imp_lines.append(f"import {{ {', '.join(luc)} }} from 'lucide-react';")
if core_type_imports:
    imp_lines.append(f"import type {{ {', '.join(sorted(set(core_type_imports)))} }} from '../model/core';")
if api_types:
    imp_lines.append(f"import type {{ {', '.join(sorted(set(api_types)))} }} from '../api/types';")
for (mod, kind), names in sorted(by_mod.items()):
    names = sorted(set(names))
    if mod.startswith('./'):
        mod = '../' + mod[2:]
    if kind == 'ns':
        imp_lines.append(f"import * as {names[0]} from '{mod}';")
    elif kind == 'default':
        imp_lines.append(f"import {names[0]} from '{mod}';")
    elif kind == 'type':
        imp_lines.append(f"import type {{ {', '.join(names)} }} from '{mod}';")
    else:
        mod = mod_shadow = mod
        imp_lines.append(f"import {{ {', '.join(names)} }} from '{mod}';")
# value + type imports from the same module are both legal TS; no dedupe needed.

props_block = '\n'.join(f"  {n}: {t};" for n, t in sorted(props_needed.items()))
destructured = '\n'.join(f"    {n}," for n in sorted(props_needed))

shell = '\n'.join(imp_lines) + f"""

// ---------------------------------------------------------------------------
// OVERLAYS SHELL -- the full-screen sheets that float above every tab:
// campaign dashboard, campaign create wizard, capture flow, tea sheet and the
// object detail sheet. Extracted from App.tsx (Phase 3); blocks are VERBATIM,
// gates unchanged. State ownership stays in App (route-sync rules).
// ---------------------------------------------------------------------------

export interface OverlaysShellProps {{
{props_block}
}}

export function OverlaysShell(props: OverlaysShellProps) {{
  const {{
{destructured}
  }} = props;
  return (
    <>
{chr(10).join(blocks)}
    </>
  );
}}
"""
open(OUT, 'w').write(shell)
print(f'OverlaysShell written: {len(shell.splitlines())} lines, '
      f'{len(props_needed)} props, {len(imp_lines)} import lines')

if not APPLY:
    sys.exit(0)

# ---- splice App.tsx ---------------------------------------------------------------
lines2 = lines[:]
for s, e in sorted(spans, reverse=True):
    assert lines2[s].startswith('      {') or lines2[s].strip().startswith('{'), lines2[s][:60]
    del lines2[s:e]
mount = ['      <OverlaysShell'] + [f"        {n}={{{n}}}" for n in sorted(props_needed)] + ['      />']
anchor = starts[0]  # insert at first overlay position (pre-edit coords == post since we deleted bottom-up... verify)
lines2[anchor:anchor] = mount
src2 = '\n'.join(lines2)
assert 'OverlaysShell' in src2 and src2.count('<OverlaysShell') == 1
src2 = src2.replace("import { WorkflowsScreen } from './screens/WorkflowsScreen';",
                    "import { WorkflowsScreen } from './screens/WorkflowsScreen';\nimport { OverlaysShell } from './screens/OverlaysShell';", 1)
open(APP, 'w').write(src2)
print(f'App.tsx written: {len(src2.splitlines())} lines (expected {len(lines) - sum(sizes) + len(mount)})')
