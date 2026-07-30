#!/usr/bin/env python3
"""Regenerate sw.js from what is actually on disk.

Run it after adding or removing assets, otherwise the offline cache will either
miss new files or try to fetch ones that have gone:

    python3 tools/build-sw.py
"""
import hashlib, json, pathlib

ROOT = pathlib.Path(__file__).resolve().parent.parent
files = ['./index.html', './manifest.webmanifest']
for pat in ('src/**/*.js', 'src/**/*.css', 'assets/**/*.jpg', 'assets/**/*.png'):
    files += ['./' + str(p.relative_to(ROOT)) for p in sorted(ROOT.glob(pat))]

# hash the contents, so editing a file invalidates the cache
blob = b''.join((ROOT / f[2:]).read_bytes() for f in files)
version = hashlib.sha1(blob).hexdigest()[:8]
tpl = (ROOT / 'sw.js').read_text()
import re
tpl = re.sub(r"const CACHE = '[^']*';", "const CACHE = 'dcs-trainer-%s';" % version, tpl)
tpl = re.sub(r"const SHELL = \[[^\]]*\];", "const SHELL = " + json.dumps(files, indent=2) + ";", tpl, flags=re.S)
(ROOT / 'sw.js').write_text(tpl)
print('sw.js now precaches %d files, version %s' % (len(files), version))
