# The upload flattened — here is the fix

## What happened

GitHub put every file in the **root** of the repo instead of in its folder. So
you have `controls.js` at the top level, where it should be
`src/aircraft/fa18c/controls.js`.

That happens when you pick files with the **Choose your files** link. The file
picker cannot see folders, so it uploads their contents flat. Dragging the
**folders themselves** onto the page is what preserves the structure.

## What it means right now

The site is fine and the Tomcat is untouched — but:

- The hangar still says **1 of 18 built** and the Hornet is greyed out, because
  `src/aircraft/registry.js` never got replaced (the new one landed at the root
  as `registry.js`).
- The offline cache is broken. `sw.js` DID land correctly, and it lists
  `assets/fa18c/front.jpg` and friends — which are not at those paths, so the
  cache install fails. Online is unaffected.
- `npm test` fails, because `tests/fa18c.mjs` is at the root.

## Fix it in the browser — one upload

You do **not** need to delete anything first.

1. Repo → **Add file** → **Upload files**
2. Open the unzipped folder in Finder / File Explorer
3. Select **only these four folders** — `assets`, `src`, `tests`, `tools` —
   and **drag them onto the GitHub page**.
   Drag the folder icons. Do not open them, and do not use *Choose your files*.
4. Before committing, check the list shows paths like
   `src/aircraft/fa18c/index.js` — with slashes in them. If it shows bare
   `index.js`, the structure was lost again; cancel and drag the folders.
5. Commit: `Move the F/A-18C files into their folders`

That is the whole functional fix. The Hornet appears, `npm test` passes and the
offline cache is correct.

## Then tidy the root

Nineteen stray files are left over. Nothing loads them, so this is housekeeping
rather than urgent — but it is confusing to leave them.

For each: click it in GitHub → **trash icon** → **Commit changes**.

```
HOW-TO-ADD.md      _common.js         build.js
carrier-launch.js  case1-landing.js   cold-start.js
combat.js          compose-fa18c.py   controls.js
fa18c.mjs          front.jpg          gauges.js
index.js           lcon.jpg           lower.jpg
rcon.jpg           registry.js        shutdown.js
systems.js
```

**Leave `sw.js`, `package.json`, `index.html`, `README.md` and `CREDITS.md`
alone** — those live at the root and are already correct.

## Or do the whole thing with git, in one commit

If you have a terminal, this fixes and tidies in one go:

```bash
cd ~/path/to/Interactive-F-14-startup-simulator
git pull

# put the files where they belong
cp -r /path/to/unzipped/{assets,src,tests,tools} .

# remove the flattened copies from the root
git rm -f HOW-TO-ADD.md _common.js build.js carrier-launch.js case1-landing.js \
          cold-start.js combat.js compose-fa18c.py controls.js fa18c.mjs \
          front.jpg gauges.js index.js lcon.jpg lower.jpg rcon.jpg \
          registry.js shutdown.js systems.js

npm test            # should say: F/A-18C checks passed
git add -A && git commit -m "Move the F/A-18C files into their folders" && git push
```

## How to know it worked

After Cloudflare redeploys:

- The hangar says **2 of 18 built**
- The **F/A-18C Hornet** card is white, not grey, and reads **5 PROCEDURES**
- Clicking it gives four tabs: Front Panel · Gear & Pedestal · Left Console ·
  Right Console

I ran this exact fix against a clone of your repo as it stands right now, and
the full suite passes.
