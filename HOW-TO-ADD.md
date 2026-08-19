# Adding the F/A-18C — drag and drop, no terminal

**Yes, you can just drop these in.** Everything is pre-built, including the
service worker, so there is nothing to run afterwards.

There are 20 files. Some are new, six replace existing ones. That is fine and
expected — GitHub overwrites by path.

---

## The easy way: GitHub in a browser

1. Open **https://github.com/AntonyPerez0/Interactive-F-14-startup-simulator**
2. **Add file** → **Upload files**
3. Open this folder on your computer and select **everything inside it** —
   `assets`, `src`, `tests`, `tools`, `package.json`, `sw.js`, `README.md`,
   `CREDITS.md`. **Do not** upload `HOW-TO-ADD.md` (this file) unless you want
   it in the repo.
4. Drag them onto the page. GitHub keeps the folder structure — you should see
   paths like `src/aircraft/fa18c/index.js` in the list.
5. Commit message: `Add the F/A-18C Hornet`
6. **Commit changes**

Cloudflare rebuilds in a minute or two. Open the site, and the Hornet is in the
hangar next to the Tomcat.

> **Drag the CONTENTS, not the folder.** If you drag the folder itself you get
> `dropin/src/aircraft/...` and nothing loads. If that happens, delete the
> `dropin` folder in GitHub and upload again.

---

## If you use git on your machine

```bash
cd ~/path/to/Interactive-F-14-startup-simulator
cp -r /path/to/this/folder/* .
rm HOW-TO-ADD.md
npm test        # optional, but it will say: F/A-18C checks passed
git add -A
git commit -m "Add the F/A-18C Hornet"
git push
```

---

## What replaces what

**Six existing files are overwritten.** All six are meant to be:

| file | why |
| --- | --- |
| `src/aircraft/registry.js` | imports the Hornet and hangs it on the catalogue entry that was already there waiting — three lines |
| `package.json` | adds `tests/fa18c.mjs` to `npm test` |
| `sw.js` | the offline cache list, so the Hornet works offline. **Pre-generated** — normally `python3 tools/build-sw.py` |
| `src/core/build.js` | the build stamp that goes with that `sw.js` |
| `README.md` | adds the Hornet's procedure table |
| `CREDITS.md` | adds the Hornet's sources, and the open question about the cockpit drawing |

**Fourteen files are new**, all under paths that did not exist:
`src/aircraft/fa18c/`, `assets/fa18c/`, `tests/fa18c.mjs`,
`tools/compose-fa18c.py`.

Nothing about the F-14B changes.

---

## Checking it worked

Once Cloudflare has redeployed:

- The hangar says **2 of 19** aircraft built, not 1 of 19
- Picking the Hornet gives four tabs: **Front Panel · Gear & Pedestal · Left
  Console · Right Console**
- The bottom strip reads RPM, EGT, FF, HYD A/B, BRAKE PSI, APU, INS ALIGN,
  BLEED AIR, and nine caution captions
- **Cold start** is 57 steps and the first one is the ejection seat

You can also jump straight there:
`https://your-site/?aircraft=fa18c`

### If something looks wrong

**The Hornet is greyed out in the hangar.** `src/aircraft/registry.js` did not
upload. Check it in GitHub — it should have `import fa18c` near the top.

**Grey boxes instead of a cockpit.** The four files in `assets/fa18c/` did not
upload. They are about 250 KB each.

**It works but is stale after you push again.** Hard-refresh once
(`Ctrl`/`Cmd + Shift + R`). The service worker fetches code network-first, so
this should be rare.

**Anything else** — the browser console will say. Send me what it says.

---

## One open item, before it goes public

The cockpit drawing these views are cut from carries **no attribution at all** —
no signature, watermark or copyright line. That is not the same as being free to
publish; an unmarked file is more often one whose notice was cropped than one
that was released.

Worth five minutes finding where `FA18C_1.0.png` came from and what licence it
had. `CREDITS.md` now says so plainly, which is the honest position until you
know. If it turns out not to be usable, `tools/compose-fa18c.py` re-cuts the
views from any replacement drawing and regenerates the hotspots with them — no
procedure, systems or test changes.
