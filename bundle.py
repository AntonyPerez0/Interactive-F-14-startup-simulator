#!/usr/bin/env python3
"""
Flatten the project into one self-contained HTML file.

The project runs as-is over http (GitHub Pages, or `npm run dev`). This is only
for handing someone a single file to double-click, or for file:// where the
browser blocks ES module imports.

    python3 tools/bundle.py            -> dist/trainer.html

Each module becomes an IIFE returning its exports; imports become destructuring
from the already-evaluated module. Dependencies are emitted first.
"""
import base64, pathlib, re, sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
EXPORTS = {}
OUT  = ROOT / 'dist' / 'trainer.html'

IMPORT_RE = re.compile(
    r"^\s*import\s+(?:(?P<ns>\*\s+as\s+\w+)|(?P<named>\{[^}]*\})|(?P<def>\w+))"
    r"\s+from\s+'(?P<spec>[^']+)';?\s*$", re.M)


def resolve(spec, importer):
    p = (importer.parent / spec).resolve()
    if not p.exists():
        sys.exit('cannot resolve %s from %s' % (spec, importer))
    return p


def collect(entry, seen=None, order=None):
    seen = set() if seen is None else seen
    order = [] if order is None else order
    if entry in seen:
        return order
    seen.add(entry)
    for m in IMPORT_RE.finditer(entry.read_text()):
        collect(resolve(m.group('spec'), entry), seen, order)
    order.append(entry)
    return order


def modname(path):
    return '__m_' + re.sub(r'\W', '_', str(path.relative_to(ROOT)).rsplit('.', 1)[0])


def transform(path):
    src = path.read_text()
    names = set()

    def imp(m):
        dep = modname(resolve(m.group('spec'), path))
        if m.group('ns'):
            return 'const %s = %s;' % (m.group('ns').split()[-1], dep)
        if m.group('named'):
            # `import { a as b }` becomes `const { a: b }` — destructuring renames
            # with a colon, not `as`
            names = m.group('named').strip('{} ').split(',')
            fields = ', '.join(n.strip().replace(' as ', ': ') for n in names if n.strip())
            return 'const { %s } = %s;' % (fields, dep)
        return 'const %s = %s.default;' % (m.group('def'), dep)
    src = IMPORT_RE.sub(imp, src)

    if re.search(r'^\s*export\s+default\s', src, re.M):
        src = re.sub(r'^\s*export\s+default\s+', 'const __default = ', src, flags=re.M)
        names.add('default')
    # JS identifiers may start with $ or _, which \w alone will not match
    for m in re.finditer(r'^\s*export\s+(?:const|let|var)\s+([A-Za-z_$][\w$]*)', src, re.M):
        names.add(m.group(1))
    for m in re.finditer(r'^\s*export\s+(?:async\s+)?function\s+([A-Za-z_$][\w$]*)', src, re.M):
        names.add(m.group(1))
    EXPORTS[path] = names
    src = re.sub(r'^(\s*)export\s+', r'\1', src, flags=re.M)

    fields = ', '.join(('default: __default' if n == 'default' else n) for n in sorted(names))
    return ('\n/* ===== %s ===== */\nconst %s = (function () {\n%s\nreturn { %s };\n})();\n'
            % (path.relative_to(ROOT), modname(path), src, fields))


def verify(mods):
    """Every name a module imports must actually be exported by its dependency."""
    bad = []
    for m in mods:
        for im in IMPORT_RE.finditer(m.read_text()):
            if not im.group('named'):
                continue
            dep = resolve(im.group('spec'), m)
            wanted = [w.strip().split(' as ')[0].strip()
                      for w in im.group('named').strip('{} ').split(',') if w.strip()]
            for w in wanted:
                if w not in EXPORTS.get(dep, set()):
                    bad.append('%s imports %s from %s, which does not export it'
                               % (m.relative_to(ROOT), w, dep.relative_to(ROOT)))
    if bad:
        for b in bad:
            print('  ERROR ' + b)
        sys.exit(1)


def check(js):
    """Run the flattened script through node so a bad transform fails the build."""
    import shutil, subprocess, tempfile
    node = shutil.which('node')
    if not node:
        print('  (node not found — skipping the syntax check)')
        return
    with tempfile.NamedTemporaryFile('w', suffix='.js', delete=False) as fh:
        fh.write(js)
        path = fh.name
    r = subprocess.run([node, '--check', path], capture_output=True, text=True)
    if r.returncode:
        print('BUNDLE DOES NOT PARSE:\n' + r.stderr[:900])
        sys.exit(1)


def main():
    entry = ROOT / 'src' / 'core' / 'app.js'
    mods = collect(entry)
    body = ''.join(transform(m) for m in mods)
    verify(mods)

    html = (ROOT / 'index.html').read_text()
    css = (ROOT / 'src' / 'core' / 'style.css').read_text()

    def datauri(rel):
        p = ROOT / rel
        mime = 'image/jpeg' if p.suffix in ('.jpg', '.jpeg') else 'image/png'
        return 'data:%s;base64,%s' % (mime, base64.b64encode(p.read_bytes()).decode())

    # asset paths may be single or double quoted, so catch both
    for asset in sorted({a for a in re.findall(r"['\"](assets/[^'\"]+)['\"]", body)}):
        uri = datauri(asset)
        body = body.replace("'%s'" % asset, "'%s'" % uri)
        body = body.replace('"%s"' % asset, '"%s"' % uri)

    # A single file cannot resolve sibling paths, so inline the one icon worth
    # keeping and drop the links that would only 404.
    svg = ROOT / 'favicon.svg'
    if svg.exists():
        uri = 'data:image/svg+xml;base64,' + base64.b64encode(svg.read_bytes()).decode()
        html = re.sub(r'<link rel="icon" href="favicon\.svg"[^>]*>',
                      '<link rel="icon" href="%s" type="image/svg+xml">' % uri, html)
    html = re.sub(r'<link rel="icon" href="(?!data:)[^"]*"[^>]*>\s*', '', html)
    html = re.sub(r'<link rel="apple-touch-icon"[^>]*>\s*', '', html)
    html = re.sub(r'<link rel="manifest"[^>]*>\s*', '', html)

    html = html.replace('<link rel="stylesheet" href="src/core/style.css">',
                        '<style>\n' + css + '\n</style>')
    html = html.replace('<script type="module" src="src/core/app.js"></script>',
                        '<script>\n' + body + '\n</script>')

    # never ship a bundle that will not parse
    check(body)

    OUT.parent.mkdir(exist_ok=True)
    OUT.write_text(html)
    print('wrote %s  (%.2f MB, %d modules)'
          % (OUT.relative_to(ROOT), OUT.stat().st_size / 1e6, len(mods)))


if __name__ == '__main__':
    main()
