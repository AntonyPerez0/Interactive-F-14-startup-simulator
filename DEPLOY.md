# Putting this in your repo

The project replaces the single `index.html` you were deploying. `index.html` is
still the entry point, still at the repo root, so GitHub Pages needs no change.

## Option A — the GitHub website, no git needed

1. Unzip the download. You get a folder called `trainer`.
2. **Open** that folder so you can see what is inside it. You want the contents at
   the repo root, not a `trainer/` folder inside your repo.
3. On your repo page: **Add file → Upload files**.
4. Select everything inside `trainer` — `index.html`, `src`, `assets`, `tests`,
   `tools`, `package.json`, `README.md`, `DEPLOY.md` — and drag the whole
   selection onto the drop zone. Folders keep their structure.
5. Write a commit message and **Commit changes**. The new `index.html` overwrites
   the old single-file one automatically.

Hidden files are not included when you drag a folder, so add the one that matters
by hand:

6. **Add file → Create new file**, name it exactly `.nojekyll`, leave it empty,
   commit. (Nothing in the project starts with an underscore any more, so this is
   a guard rather than a fix — but it costs one commit and prevents a confusing
   failure later.)

Afterwards the repo root should look like:

```
index.html   src/   assets/   tests/   tools/   package.json   README.md   .nojekyll
```

If you end up with `trainer/index.html` instead, you dragged the folder rather
than its contents. Delete it and repeat step 4.

### Editing later

Press `.` on the repo page to open **github.dev** — VS Code in the browser. You
can create folders, drag files in and edit several at once, then commit from the
sidebar. Much less painful than the upload page once you start adding procedures.

## Option B — git clone

From inside your existing clone:

```bash
git rm index.html                       # the old single-file build
unzip ~/Downloads/dcs-cockpit-trainer.zip -d /tmp
cp -r /tmp/trainer/. .                  # the trailing dot copies the contents, not the folder
git add -A
git commit -m "Restructure into a proper project"
git push
```

That keeps your history. If you would rather start clean, delete everything
except `.git` first.

## Check before you push

```bash
npm test                                # both suites, no browser needed
npm run dev                             # http://localhost:8000
```

Opening `index.html` off disk will **not** work — browsers block ES module
imports over `file://`. That is what the dev server and the bundle are for.

## GitHub Pages settings

Settings → Pages → **Deploy from a branch** → `main` / `/ (root)`.

If you had that set for the old single file, nothing changes. Give it a minute
after the push, then hard-refresh — Pages caches aggressively.

## Things that will bite you

- **`.nojekyll` must be committed.** Without it Pages runs Jekyll, which drops
  files and folders whose names begin with an underscore. Nothing in the project
  starts with one today, but it costs nothing to keep the guard.
- **Commit `assets/`.** The photos are real files now rather than base64 inside
  the HTML. If they are missing you get a working page with blank cockpits.
- **`dist/` is gitignored.** Run `npm run bundle` when you want the single-file
  version; there is no need to commit it.

## Handing someone a single file

```bash
npm run bundle          # -> dist/trainer.html
```

One file, images inlined, no server needed. Useful for Discord or a USB stick,
but not how you should deploy the site — the separate assets cache far better.
