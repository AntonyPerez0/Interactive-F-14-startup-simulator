#!/usr/bin/env python3
"""Regenerate sw.js, and stamp the build, from what is actually on disk.

Run it after adding or removing files, otherwise the offline cache will either
miss new ones or try to fetch ones that have gone:

    python3 tools/build-sw.py

The build stamp is the same content hash the cache uses, so a bug report naming
a build identifies exactly what that person was running.
"""
import datetime, hashlib, json, pathlib, re

ROOT = pathlib.Path(__file__).resolve().parent.parent
STAMP = ROOT / 'src' / 'core' / 'build.js'

# What the service worker precaches. build.js is included so the app can read it
# offline, but excluded from the hash below -- it contains the hash, so counting
# it would never settle.
files = ['./index.html', './manifest.webmanifest', './favicon.ico', './favicon.svg']
for pat in ('src/**/*.js', 'src/**/*.css', 'assets/**/*.jpg', 'assets/**/*.png',
            'assets/**/*.webp'):
    files += ['./' + p.relative_to(ROOT).as_posix() for p in sorted(ROOT.glob(pat))]

stamp_rel = './' + STAMP.relative_to(ROOT).as_posix()
if stamp_rel not in files:
    files.append(stamp_rel)
files = sorted(set(files))

hashed = [f for f in files if f != stamp_rel and (ROOT / f[2:]).exists()]
blob = b''.join((ROOT / f[2:]).read_bytes() for f in hashed)
version = hashlib.sha1(blob).hexdigest()[:8]

STAMP.write_text(
    "/* Written by tools/build-sw.py. Do not edit. */\n"
    "export const BUILD = '%s';\n"
    "export const BUILT = '%s';\n" % (version, datetime.date.today().isoformat()))

sw = (ROOT / 'sw.js').read_text()
sw = re.sub(r"const CACHE = '[^']*';", "const CACHE = 'dcs-trainer-%s';" % version, sw)
sw = re.sub(r"const SHELL = \[[^\]]*\];",
            "const SHELL = " + json.dumps(files, indent=2) + ";", sw, flags=re.S)
(ROOT / 'sw.js').write_text(sw)

print('sw.js precaches %d files (%d hashed), build %s'
      % (len(files), len(hashed), version))
