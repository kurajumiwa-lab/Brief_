#!/usr/bin/env python3
"""Phase-2 colocation mover.

Moves zero-shell-reference props (state pairs, memos, handlers) from App.tsx
into a target screen component, auto-adding shell-owned state/setter values as
props when a moved handler needs them.

Safety rails:
  * assert-only until the very end; App.tsx written once, after every check.
  * decl_end terminates either on balanced brackets / body-closers or on a
    plain ';' one-liner (the bracketless-oneline footgun that ate a neighbour).
  * final gate is always tc tsc + run-suites.sh, run manually after this.
"""
import re, sys, json

TAG, SFILE = sys.argv[1], sys.argv[2]
DRY = '--apply' not in sys.argv
# LESSON (nav suite, "Quests points to Arena"): state colocated into a
# conditionally-unmounted screen resets on every tab switch -- the shell holds
# state across UNMOUNTS, a screen cannot. States never auto-move; pass an
# explicit --state=name1,name2 allowlist after proving persistence-per-tab-
# switch is not required (or the state is consumed only while mounted).
STATE_ALLOW = set()
for a in sys.argv:
    if a.startswith('--state='):
        STATE_ALLOW = set(a.split('=', 1)[1].split(','))

app = open('App.tsx').read()
lines = app.split('\n')
joined = '\n'.join(lines)
off = [0]
for l in lines:
    off.append(off[-1] + len(l) + 1)

def mount_region(tag):
    i = next(i for i, l in enumerate(lines) if f'<{tag}' in l)
    j = i
    while '/>' not in lines[j]:
        j += 1
    return (i, j + 1)

regions = {t: mount_region(t) for t in
           ['ArenaScreen', 'MyLayerScreen', 'NearbyScreen', 'WorkflowsScreen']}
ra, rb = regions[TAG]

screen_src = open(SFILE).read()
props = re.findall(r'^\s{2}(\w+):\s',
                   re.search(r'export interface \w+Props \{(.*?)\n\}',
                             screen_src, re.S).group(1), re.M)

# ---- App declaration index ---------------------------------------------------
def find_decls():
    out = {}
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
                gen = joined[pos:j + 1].replace('\n', ' ').strip()
            if gen is None:
                head = l
                if re.search(r"useState\(\[\]\)", head): gen = '<any[]>'
                elif re.search(r"useState\((true|false)\)", head): gen = '<boolean>'
                elif re.search(r"useState\(\d", head): gen = '<number>'
                elif re.search(r"useState\((\"|')", head): gen = '<string>'
                else: gen = '<any>'
            out[m.group(1)] = ('state', i, m.group(2), gen)
            out[m.group(2)] = ('setter', i, m.group(1), gen)
            continue
        m2 = re.match(r"^  const (\w+)\s*(?::[^=]+)?= useRef", l)
        if m2:
            out[m2.group(1)] = ('ref', i, None, None)
            continue
        m3 = re.match(r"^  const (\w+) = ", l)
        if m3 and m3.group(1) not in out:
            out[m3.group(1)] = ('const', i, None, None)
            continue
        m4 = re.match(r"^  (?:async )?function (\w+)\b", l)
        if m4:
            out[m4.group(1)] = ('fn', i, None, None)
    return out

DECLS = find_decls()
SHELL_VARS = set(DECLS)

def base_of(name):
    if name in DECLS and DECLS[name][0] == 'setter':
        return DECLS[name][2]
    if re.match(r'set[A-Z]', name):
        rest = name[3:]
        b = rest[0].lower() + rest[1:]
        if b in DECLS and DECLS[b][0] == 'state':
            return b
    return name

def names_of(name):
    base = base_of(name)
    if base in DECLS and DECLS[base][0] == 'state':
        return [base, DECLS[base][2]]
    return [name]

def decl_end(i):
    depth = 0
    for k in range(i, len(lines)):
        l = lines[k]
        for ch in l:
            if ch in '{([':
                depth += 1
            elif ch in ')]}':
                depth -= 1
        r = l.rstrip()
        if depth <= 0 and r.endswith(';'):
            return k + 1
        if depth <= 0 and r.endswith(('}', ');')) and k > i:
            return k + 1
    raise RuntimeError(f'unterminated decl @{i + 1}: {lines[i][:60]}')

# ---- interface import vocab ---------------------------------------------------
imp_named = set()
for grp in re.findall(r"import \{([^}]+)\} from '[^']+'", app, re.S):
    imp_named |= {t.strip().split(' as ')[-1] for t in grp.split(',') if t.strip()}
imp_named |= set(re.findall(r"^import (\w+) from", app, re.M))
imp_named |= set(re.findall(r"import \* as (\w+) from", app))
core_names = set(re.findall(r"export (?:const|function|type|interface|class) (\w+)",
                            open('src/model/core.tsx').read()))
names_names = set(re.findall(r"export (?:const|function|type|interface|class) (\w+)",
                             open('src/ui/names.ts').read()))
GLOBALS = {'React','useState','useEffect','useMemo','useCallback','useRef',
           'console','window','document','localStorage','sessionStorage',
           'fetch','alert','confirm','JSON','Object','Array','Math','Date',
           'Set','Map','Promise','Number','String','Boolean','Error','URL',
           'URLSearchParams','setTimeout','clearTimeout','setInterval',
           'clearInterval','navigator','requestAnimationFrame',
           'encodeURIComponent','decodeURIComponent','location','history',
           'performance','crypto'}
TSWORDS = {'string','number','boolean','readonly','never','void','null',
           'undefined','any','unknown','keyof','Partial','Record','object',
           'symbol','bigint'}
KW = set(("const let var function return if else for while do async await new "
          "typeof in of try catch finally throw case switch break continue "
          "default export import from as this null true false undefined void "
          "delete instanceof yield class extends implements interface type "
          "satisfies").split())

def strip_noise(body):
    body = re.sub(r"/\*.*?\*/", " ", body, flags=re.S)
    body = re.sub(r"//[^\n]*", " ", body)
    body = re.sub(r"'(?:[^'\\]|\\.)*'", "''", body)
    body = re.sub(r'"(?:[^"\\]|\\.)*"', '""', body)
    body = re.sub(r"`(?:[^`\\]|\\.)*`", "``", body, flags=re.S)
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
                loc.add((t.split(':')[-1] if ':' in t else t)
                        .split('=')[0].strip())
    for m in re.finditer(r"\bfunction\s+(\w+)", body):
        loc.add(m.group(1))
    for m in re.finditer(r"\bfunction\s+\w*\s*\(([^)]*)\)", body):
        loc |= {t.strip().split(':')[0].strip().rstrip('?')
                for t in m.group(1).split(',') if re.match(r"^\w+", t.strip())}
    for m in re.finditer(r"\(([\w\s,{}[\].:'\"?]*)\)\s*(?::[^{=]+)?=>", body):
        for t in m.group(1).split(','):
            t = t.strip()
            if re.match(r"^\w+\??$", t):
                loc.add(t.rstrip('?'))
            mm = re.match(r"^\{(.+)\}$", t)
            if mm:
                for u in mm.group(1).split(','):
                    u = u.strip()
                    if u:
                        loc.add((u.split(':')[-1] if ':' in u else u)
                                .split('=')[0].strip())
    for m in re.finditer(r"^\s*(\w+)\??\s*(?::[^=()]+)?=>", body, re.M):
        loc.add(m.group(1))
    for m in re.finditer(r"\bfor\s*\(\s*(?:const|let)?\s*(\w+)", body):
        loc.add(m.group(1))
    for m in re.finditer(r"\bcatch\s*\((\w+)", body):
        loc.add(m.group(1))
    return {x for x in loc if re.match(r"^\w+$", x)}

# ---- candidacy: zero shell refs outside own decl + own mount ------------------
ROUTE_HINT = re.compile(r"activeTab|popstate|history|location|route|navigate|pathname")

candidates = []
skips = []
for name in props:
    d = DECLS.get(name) or (DECLS.get(base_of(name)) if base_of(name) in DECLS else None)
    if not d:
        skips.append((name, ['no-decl']))
        continue
    nms = names_of(name)
    di = d[1]
    scan = lines[:di] + [''] + lines[di + 1:]
    scan[ra:rb] = [''] * (rb - ra)
    text = '\n'.join(scan)
    hits = sorted({text[:m.start()].count('\n')
                   for n in nms for m in re.finditer(rf"\b{n}\b", text)})
    if hits:
        skips.append((name, [f'shell-hits:{len(hits)}']))
        continue
    if DECLS[base_of(name)][0] in ('state', 'setter') and base_of(name) not in STATE_ALLOW:
        skips.append((name, ['state-pair (use --state= to force)']))
        continue
    candidates.append(name)

# ---- dependency verification + auto-props -------------------------------------
moved_names = set()
for n in candidates:
    moved_names.update(names_of(n))
remaining_props = set(props) - moved_names

plan = []
for name in candidates:
    d = DECLS.get(name) or DECLS[base_of(name)]
    di = d[1]
    de = decl_end(di)
    raw = '\n'.join(lines[di:de])
    body = strip_noise(raw)
    loc = locals_in(raw)
    members = set(re.findall(r"\.(\w+)", body))
    colonkeys = set(re.findall(r"(?:^|[{,\s])(\w+)\s*:", body, re.M))
    typewords = set(re.findall(r":\s*([A-Za-z_]\w*)", body))
    idents = set(re.findall(r"\b([A-Za-z_]\w*)\b", body))
    known = (GLOBALS | KW | TSWORDS | imp_named | core_names | names_names |
             moved_names | remaining_props | loc | members | colonkeys |
             typewords | {'briefApi'})
    unknown = sorted(idents - known)
    addable, bad = [], []
    for u in unknown:
        if (u in SHELL_VARS
                and DECLS[u][0] in ('state', 'setter')):
            addable.append(u)
        else:
            bad.append(u)
    if bad:
        skips.append((name, bad))
        continue
    adds = []
    for u in sorted(set(addable)):
        kd, _, partner, gen = DECLS[u]
        g = (gen or '<any>')[1:-1]
        adds.append((u, g if kd == 'state' else 'SETTER:' + g))
    plan.append({'name': name, 'start': di, 'end': de, 'adds': adds})

# block route-sync effects from losing names: never auto-add a setter whose
# state also lives on another screen (multi-mount) -- cheap guard:
plan_sane = []
for p in plan:
    ok = True
    for u, _ in p['adds']:
        base = u if u in DECLS and DECLS[u][0] == 'state' else base_of(u)
        nms = names_of(u)
        for t, (sa, sb) in regions.items():
            if t == TAG:
                continue
            seg = '\n'.join(lines[sa:sb])
            if any(re.search(rf"\b{n}\b", seg) for n in nms):
                ok = False
    if ok:
        plan_sane.append(p)
    else:
        skips.append((p['name'], ['multi-screen dep: ' + ','.join(u for u, _ in p['adds'])]))
plan = plan_sane

print('PLAN:')
for p in plan:
    print(f"  {p['name']} lines {p['start'] + 1}-{p['end']}"
          + (f"  adds: {p['adds']}" if p['adds'] else ''))
print('SKIPS:')
for s in skips:
    print('  ', s)

if DRY:
    sys.exit(0)

# ---- apply --------------------------------------------------------------------
# overlap check (dedupe first: value and setter of one pair share a span)
seen = set()
plan = [p for p in plan if not ((p['start'], p['end']) in seen
                                or seen.add((p['start'], p['end'])))]
spans = sorted((p['start'], p['end']) for p in plan)
for (a, b), (c, d) in zip(spans, spans[1:]):
    assert b <= c, 'overlapping spans'
moved_text = [lines[s:e] for s, e in spans]
names_moving = set()
for p in plan:
    names_moving.update(names_of(p['name']))

# belt: nothing in the shell may still reference a moved name
scan_lines = lines[:ra] + [''] * (rb - ra) + lines[rb:]
for s, e in spans:
    for k in range(s, e):
        scan_lines[k] = ''
scan_text = '\n'.join(scan_lines)
for n in names_moving:
    assert not re.search(rf"\b{n}\b", scan_text), f'shell still refs {n}'

add_props = {}
for p in plan:
    for u, t in p['adds']:
        if t.startswith('SETTER:'):
            add_props[u] = (f"React.Dispatch<React.SetStateAction<{t[7:]}>>")
        else:
            add_props[u] = t

sc = open(SFILE).read()
for n in sorted(names_moving, key=len, reverse=True):
    sc = re.sub(rf"^  {re.escape(n)}: [^\n]+\n", '', sc, count=1, flags=re.M)
    sc = re.sub(rf"^    {re.escape(n)},\n", '', sc, count=1, flags=re.M)
iface = re.search(r'export interface (\w+Props) \{\n', sc)
sc = sc.replace(iface.group(0),
                iface.group(0) + ''.join(
                    f"  {n}: {t};\n" for n, t in sorted(add_props.items())), 1)
anchor = sc.index('  } = props;')
sc = sc[:anchor] + ''.join(f"    {n},\n" for n in sorted(add_props)) + sc[anchor:]
close_i = sc.index('  } = props;') + len('  } = props;')
insert_text = ('\n\n  // -- colocated from App (ownership pass) -----------------\n'
               + '\n\n'.join('\n'.join(b).rstrip() for b in moved_text) + '\n')
sc = sc[:close_i] + insert_text + sc[close_i:]
moved_blob = '\n'.join(sum(moved_text, []))
hooks = sorted({h for h in ['useState', 'useEffect', 'useMemo', 'useCallback', 'useRef']
                if re.search(rf"\b{h}\(", moved_blob)})
existing_hooks = re.match(r"import React, \{ ([^}]+)\} from 'react';", sc)
if hooks and existing_hooks:
    merged = sorted(set(existing_hooks.group(1).split(', ')) | set(hooks))
    sc = sc.replace(existing_hooks.group(0),
                    f"import React, {{ {', '.join(merged)} }} from 'react';", 1)
elif hooks:
    sc = sc.replace("import React from 'react';",
                    f"import React, {{ {', '.join(hooks)} }} from 'react';", 1)
open(SFILE, 'w').write(sc)

ops = [(s, e, []) for s, e in spans]
nm_pat = '|'.join(sorted(names_moving, key=len, reverse=True))
if nm_pat:
    for k in range(ra, rb):
        if re.match(rf"^\s+({nm_pat})=\{{", lines[k]):
            ops.append((k, k + 1, []))
ops.append((rb - 1, rb - 1,
            [f"            {n}={{{n}}}" for n in sorted(add_props)]))
ops.sort(key=lambda o: o[0], reverse=True)
for s, e, rep in ops:
    lines[s:e] = rep
open('App.tsx', 'w').write('\n'.join(lines))
print(f'APPLIED. App.tsx now {len(lines)} lines; moved {len(plan)} decls, '
      f'added {len(add_props)} props')
