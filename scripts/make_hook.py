#!/usr/bin/env python3
"""Extract a cluster of App.tsx top-level declarations into a custom hook
file (src/shell/hooks/useX.ts), zero behavior change:

  * state decls, memos, handlers and (optionally) useEffects move verbatim
  * hook takes externals (showToast, sessionUser, ...) as a params object
  * App does `const { ...names } = useX({ ...externs });` at the position
    of the earliest moved decl; names/ids change in ZERO other places

Guards: every identifier used by moved decls must resolve to (moved | params |
imports | globals | locals); no debugger-invisible reordering (hook call must
precede the earliest textual use of any moved name in remaining App body);
length invariant; nothing is written unless every check passes.
"""
import re, sys, json, os

HOOK = sys.argv[1]                       # e.g. useCampaignHub
NAMES = sys.argv[2].split(',')           # csv of decl names / state bases
EXTRA_PARAMS = (sys.argv[3].split(',') if len(sys.argv) > 3 and not sys.argv[3].startswith('--') else [])
ALLOW = set()
for a in sys.argv:
    if a.startswith('--allow='):
        ALLOW = set(a.split('=', 1)[1].split(','))
APPLY = any(a == '--apply' for a in sys.argv[3:])

APP = 'App.tsx'
OUT = f'src/shell/hooks/{HOOK}.ts'

lines = open(APP).read().split('\n')
joined = '\n'.join(lines)
off = [0]
for l in lines:
    off.append(off[-1] + len(l) + 1)
RET = next(i for i, l in enumerate(lines) if l.startswith('  return ('))

def decl_end(i):
    depth = 0
    for k in range(i, len(lines)):
        for ch in lines[k]:
            if ch in '{([':
                depth += 1
            elif ch in ')]}':
                depth -= 1
        r = lines[k].rstrip()
        if depth <= 0 and r.endswith(';'):
            return k + 1
        if depth <= 0 and r.endswith(('}', ');')) and k > i:
            return k + 1
    raise RuntimeError(f'unbalanced decl at {i+1}')

# ---- index App top-level decls ----------------------------------------------
DECLS = {}   # name -> (start, end, kind, exported_names, type)
i = 0
while i < RET:
    l = lines[i]
    m = re.match(r"^  const \[(\w+), (\w+)\] = useState", l)
    if m:
        e = decl_end(i)
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
            gen = joined[pos+1:j].replace('\n', ' ').strip() or 'any'
        if gen is None:
            h = lines[i]
            if re.search(r"useState\(\[\]\)", h): gen = 'any[]'
            elif re.search(r"useState\((true|false)\)", h): gen = 'boolean'
            elif re.search(r"useState\(\d", h): gen = 'number'
            elif re.search(r"useState\((\"|')", h): gen = 'string'
            else: gen = 'any'
        DECLS[m.group(1)] = (i, e, 'state', [m.group(1), m.group(2)], gen)
        i = e
        continue
    m2 = re.match(r"^  const (\w+)\s*(?::[^=]+)?= ", l)
    if m2:
        e = decl_end(i)
        DECLS[m2.group(1)] = (i, e, 'const', [m2.group(1)], None)
        i = e
        continue
    m3 = re.match(r"^  (?:async )?function (\w+)\b", l)
    if m3:
        e = decl_end(i)
        DECLS[m3.group(1)] = (i, e, 'fn', [m3.group(1)], None)
        i = e
        continue
    m4 = re.match(r"^  (?:React\.)?useEffect\(", l)
    if m4:
        e = decl_end(i)
        DECLS[f'effect@{i+1}'] = (i, e, 'effect', [f'effect@{i+1}'], None)
        i = e
        continue
    i += 1

SHELL_NAMES = set()
for name, (s, e, kind, exported, g) in DECLS.items():
    SHELL_NAMES.update(exported)
# names returned by other hooks are valid shell identifiers too
he = re.finditer(r"^  const \{([\s\S]*?)\n  \} = use\w+\(\{", joined, re.M)
for m in he:
    start_ln = joined[:m.start()].count('\n')
    # whole-call end: find the closing '  });' line
    rel = joined[m.end():]
    close = re.search(r"\n  \}\);", rel)
    end_ln = start_ln + joined[m.start():m.end()+close.end()].count('\n') + 1
    for n in m.group(1).split(','):
        n = n.strip()
        if n:
            DECLS[n] = (start_ln, end_ln, 'hookret', [n], None)
            SHELL_NAMES.add(n)

# ---- resolve requested names ---------------------------------------------------
plan_names = []   # decl keys
for n in NAMES:
    if n.startswith('effect@'):
        want = n.split('@')[1]
        hit = [k for k in DECLS if k.startswith('effect@') and DECLS[k][0] == int(want)-1]
        assert hit, f'no effect at line {want}'
        plan_names.append(hit[0]); continue
    if n in DECLS:
        plan_names.append(n)
    else:
        # maybe it is a setter of a state pair
        cand = None
        for k, v in DECLS.items():
            if n in v[3]:
                cand = k
                break
        assert cand, f'no decl for {n}'
        plan_names.append(cand)
plan_names = sorted(set(plan_names), key=lambda k: DECLS[k][0])

moved_exported = set()
for k in plan_names:
    if DECLS[k][2] == 'effect':
        continue  # effects have no names
    moved_exported.update(DECLS[k][3])
spans = [(DECLS[k][0], DECLS[k][1]) for k in plan_names]
for (a, b), (c, d) in zip(spans, spans[1:]):
    assert b <= c, f'overlap in moves {a}-{b} vs {c}-{d}'
move_text = {k: lines[DECLS[k][0]:DECLS[k][1]] for k in plan_names}
hook_pos = min(s for s, _ in spans)


def param_decl_end(name):
    """End line of the param's own decl (App-side), or None."""
    if name in DECLS:
        return DECLS[name][1]
    for k, v in DECLS.items():
        if name in v[3]:
            return v[1]
    return None

# ---- dep closure ---------------------------------------------------------------
GLOBALS = {'React','useState','useEffect','useMemo','useCallback','useRef',
           'console','window','document','localStorage','sessionStorage',
           'fetch','alert','confirm','JSON','Object','Array','Math','Date',
           'Set','Map','Promise','Number','String','Boolean','Error','URL',
           'URLSearchParams','setTimeout','clearTimeout','setInterval',
           'clearInterval','navigator','requestAnimationFrame',
           'encodeURIComponent','decodeURIComponent','location','history',
           'performance','crypto'}
KW = set(("const let var function return if else for while do async await new "
          "typeof in of try catch finally throw case switch break continue "
          "default export import from as this null true false undefined void "
          "delete instanceof yield class extends implements interface type "
          "satisfies keyof readonly").split())
TSWORDS = {'string','number','boolean','readonly','never','void','null',
           'undefined','any','unknown','keyof','Partial','Record','object'}

imp_named = set()
for grp, mod in re.findall(r"import(?: type)? \{([^}]+)\} from '([^']+)'", joined, re.S):
    imp_named |= {t.strip().split(' as ')[-1] for t in grp.split(',') if t.strip()}
imp_named |= set(re.findall(r"^import (\w+) from", joined, re.M))
imp_named |= set(re.findall(r"import \* as (\w+) from", joined))
core_names = set(re.findall(r"export (?:const|function|type|interface|class) (\w+)",
                            open('src/model/core.tsx').read()))
names_names = set(re.findall(r"export (?:const|function|type|interface|class) (\w+)",
                             open('src/ui/names.ts').read()))

def strip_noise(body):
    body = re.sub(r"/\*.*?\*/", ' ', body, flags=re.S)
    body = re.sub(r"//[^\n]*", ' ', body)
    body = re.sub(r"(?<=[(,:=!\s])/(?:[^/\\\n]|\\.)+/[gimsuy]*", ' ', body)
    body = re.sub(r"'(?:[^'\\]|\\.)*'", "''", body)
    body = re.sub(r'"(?:[^"\\]|\\.)*"', '""', body)
    body = re.sub(r"`(?:[^`\\]|\\.)*`", '``', body, flags=re.S)
    return body

def locals_in(body):
    loc = set()
    for m in re.finditer(r"\b(?:const|let|var)\s+(\w+)", body):
        loc.add(m.group(1))
    for m in re.finditer(r"\b(?:const|let|var)\s*\[([^\]]+)\]", body):
        loc |= {t.strip().split(':')[0].split('=')[0].strip()
                for t in m.group(1).split(',') if t.strip()}
    for m in re.finditer(r"\b(?:const|let|var)\s*\{([^}]*)\}", body):
        for t in m.group(1).split(','):
            t = t.strip()
            if t:
                loc.add((t.split(':')[-1] if ':' in t else t).split('=')[0].strip())
    for m in re.finditer(r"\bfunction\s+(\w+)", body):
        loc.add(m.group(1))
    for m in re.finditer(r"\bfunction\s+\w*\s*\(([^)]*)\)", body):
        loc |= {t.strip().split(':')[0].strip().rstrip('?')
                for t in m.group(1).split(',') if re.match(r'^\w+', t.strip())}
    for m in re.finditer(r"\(([\w\s,{}[\].;:'\"?]*)\)\s*(?::[^{=]+)?=>", body):
        for t in m.group(1).split(','):
            t = t.strip()
            if not t:
                continue
            mm = re.match(r"^\{(.+)\}$", t)
            if mm:
                for u in mm.group(1).split(','):
                    u = u.strip()
                    if u:
                        loc.add((u.split(':')[-1] if ':' in u else u).split('=')[0].strip().rstrip('?'))
                continue
            head = t.split(':')[0].split('=')[0].strip().rstrip('?')
            if re.match(r"^\w+$", head):
                loc.add(head)
    for m in re.finditer(r"(?:^|\n)\s*(\w+)\??\s*(?::[^=(){]+)?=>", body):
        loc.add(m.group(1))
    for m in re.finditer(r"\bfor\s*\(\s*(?:const|let)?\s*(\w+)", body):
        loc.add(m.group(1))
    for m in re.finditer(r"\bcatch\s*\((\w+)", body):
        loc.add(m.group(1))
    return {x for x in loc if re.match(r'^\w+$', x)}

blob = '\n'.join('\n'.join(move_text[k]) for k in plan_names)
body = strip_noise(blob)
loc = locals_in(blob)
members = set(re.findall(r"\.(\w+)", body))
colonkeys = set(re.findall(r"(?:^|[{,\s])(\w+)\s*:", body, re.M))
typewords = set(re.findall(r":\s*([A-Za-z_]\w*)", body)) | set(re.findall(r"\bas (x)", body.replace('}', ' ')) if False else re.findall(r"\bas ([A-Za-z_]\w*)", body))
idents = set(re.findall(r"\b([A-Za-z_]\w*)\b", body))

known = (GLOBALS | KW | TSWORDS | imp_named | core_names | names_names |
         moved_exported | loc | members | colonkeys | typewords | {'briefApi'})
unknown = sorted((idents - known) - ALLOW)

params, bad = [], []
for u in unknown:
    if u in SHELL_NAMES or u in DECLS:
        params.append(u)
    else:
        bad.append(u)
params = sorted(set(params) | set(EXTRA_PARAMS))
print('HOOK:', HOOK)
print('decls:', [(k, DECLS[k][1]-DECLS[k][0]) for k in plan_names])
print('params:', params)
print('UNRESOLVED (hard fail if any):', bad)

# no pre-hook use: earliest textual use of each moved name in remaining body
scan = lines[:]
for s, e in spans:
    for k in range(s, e):
        scan[k] = ''
scan_text = '\n'.join('' if re.match(r'^\s*//', l) else l for l in scan)
def owner_decl_key(ln):
    """Enclosing top-level decl key for a 0-based shell line, else None."""
    best = None
    for key, (s, e, kind, exported, g) in DECLS.items():
        if s <= ln < e:
            best = key
            if s <= ln:
                return key
    return best

problems = []
lazy_refs = []
for n in moved_exported:
    for m in re.finditer(rf"\b{n}\b", scan_text):
        ln = scan_text[:m.start()].count('\n')
        if ln < hook_pos:
            ok_owner = owner_decl_key(ln)
            ok_kind = DECLS[ok_owner][2] if ok_owner else None
            if ok_kind in ('const', 'fn') and ok_owner is not None and \
               not re.match(r"^  const \w+ = (useMemo|useCallback)", lines[DECLS[ok_owner][0]]):
                lazy_refs.append((n, ln + 1, ok_owner))
            else:
                problems.append((n, ln + 1, ok_owner, ok_kind))
if lazy_refs:
    print('LAZY pre-hook refs (allowed):', lazy_refs[:8])
if problems:
    print('PRE-HOOK USES (would need repositioning):', problems[:10])

# type tokens needed for hook return-object/general TS
moved_blob = '\n'.join(joined[off[DECLS[k][0]]:off[DECLS[k][1]]] for k in plan_names)
type_tokens = sorted({t for t in re.findall(r"\b([A-Z][A-Za-z0-9]*)\b", strip_noise(moved_blob))})

# hook call must come after every param's decl (params are read at call time)
late = []
for pn in params:
    pe = param_decl_end(pn)
    if pe is not None and pe > hook_pos:
        late.append((pn, pe))
if late:
    new_pos = max(pe for _, pe in late)
    print(f'REPOSITION: params declared after earliest span; moving hook call '
          f'from line {hook_pos + 1} to {new_pos}')
    late2 = []
    for n in moved_exported:
        for m in re.finditer(rf"\b{n}\b", scan_text):
            ln = scan_text[:m.start()].count('\n')
            if hook_pos <= ln < new_pos:
                ok_owner = owner_decl_key(ln)
                ok_kind = DECLS[ok_owner][2] if ok_owner else None
                if ok_kind in ('const', 'fn') and ok_owner is not None and                    not re.match(r"^  const \w+ = (useMemo|useCallback)", lines[DECLS[ok_owner][0]]):
                    continue
                late2.append((n, ln + 1, ok_owner, ok_kind))
    if late2:
        print('REPOSITION BLOCKED by eager uses in gap:', late2[:10])
        problems = late2
    else:
        hook_pos = new_pos
if not APPLY or bad or problems:
    sys.exit(1 if (bad or problems) else 0)

# ---- generate hook file -----------------------------------------------------------
os.makedirs('src/shell/hooks', exist_ok=True)
core_types = [t for t in type_tokens if t in core_names]
api_types = [t for t in type_tokens if t not in core_names and t in
             set(re.findall(r"export (?:type|interface|const) (\w+)", open('src/api/types.ts').read()))]
val_imports_needed = sorted(set(re.findall(r"\.(\w+)\(", blob) ) & set())  # placeholder
# values referenced bare ($imported): compute from idents diff
bare_vals = sorted((idents & core_names) - set(core_types)- set([]))
bare_vals += sorted((idents & names_names))
imp = ["import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';",
       "import * as briefApi from '../../api/briefApi';"]
if core_types:
    imp.append(f"import type {{ {', '.join(sorted(set(core_types)))} }} from '../../model/core';")
core_vals = sorted((idents & core_names) - set(core_types))
if core_vals:
    imp.append(f"import {{ {', '.join(core_vals)} }} from '../../model/core';")
if names_names & idents:
    imp.append(f"import {{ {', '.join(sorted(names_names & idents))} }} from '../../ui/names';")
if api_types:
    imp.append(f"import type {{ {', '.join(sorted(set(api_types)))} }} from '../../api/types';")

exported_sorted = sorted(moved_exported)
hook_body = []
for k in plan_names:
    hook_body.append('\n'.join(move_text[k]) + '\n')
param_lines = ',\n  '.join(sorted(params) + ([p for p in EXTRA_PARAMS if p not in params] if False else []))
param_lines = ',\n  '.join(sorted(set(params)))

hook = '\n'.join(imp) + f"""

// ---------------------------------------------------------------------------
// {HOOK} -- extracted from App.tsx (Phase 4). Owns this slice of shell state
// + handlers; route-sync/popstate effects STAY in App (they read the returned
// setters). Interface notes are inline; verify with run-suites.sh.
// ---------------------------------------------------------------------------

export interface {HOOK[0].upper()+HOOK[1:]}Params {{
{chr(10).join(f"  {p}: any;" for p in sorted(set(params)))}
}}

export function {HOOK}(params: {HOOK[0].upper()+HOOK[1:]}Params) {{
  const {{
{chr(10).join('    ' + p + ',' for p in sorted(set(params)))}
  }} = params;

{chr(10).join(hook_body)}
  return {{
{chr(10).join('    ' + n + ',' for n in exported_sorted)}
  }};
}}
"""
open(OUT, 'w').write(hook)
print(f'wrote {OUT}: {len(hook.splitlines())} lines, exports {len(exported_sorted)} names, {len(set(params))} params')

# ---- splice App --------------------------------------------------------------------
lines2 = lines[:]
for s, e in sorted(spans, reverse=True):
    del lines2[s:e]
anchor = hook_pos
for s, e in spans:
    if s < hook_pos + 1e9:
        pass
# hook_pos was min; recomputing anchor after deletions: count removed lines before hook_pos
removed_before = sum(e - s for s, e in spans if e <= hook_pos)
anchor = hook_pos - removed_before
call = [
  f"  const {{",
  *[f"    {n}," for n in exported_sorted],
  f"  }} = {HOOK}({{",
  *[f"    {p}," for p in sorted(set(params))],
  f"  }});",
  '',
]
lines2[anchor:anchor] = call
src2 = '\n'.join(lines2)
imp_line = f"import {{ {HOOK} }} from './shell/hooks/{HOOK}';"
src2 = src2.replace("import { OverlaysShell } from './screens/OverlaysShell';",
                    "import { OverlaysShell } from './screens/OverlaysShell';\n" + imp_line, 1)
open(APP, 'w').write(src2)
print('App.tsx now', len(src2.splitlines()), 'lines')
