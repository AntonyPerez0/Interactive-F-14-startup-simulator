# Putting the site online — the long version

Written so you can follow it without knowing anything. Every step says which
website you are on and what you are looking for.

Nothing here needs a terminal, and nothing costs money.

**Two websites are involved:**

| | | what it does |
|---|---|---|
| **github.com** | where your files live | you upload the site here |
| **dash.cloudflare.com** | where the site is served from | reads your files from GitHub |

Cloudflare menus get renamed every so often. If a label does not match exactly,
look for something that does the same job — the shape of the steps does not change.

---

# Before you start

You need three things:

1. **A GitHub account with a repository** for this site.
2. **A Cloudflare account.** You have this.
3. **The zip of the site**, unzipped on your computer. Inside is a folder called
   `trainer`. **Open it.** The files you will upload are the ones *inside* that
   folder, not the folder itself.

Inside `trainer` you should see roughly this:

```
index.html          manifest.webmanifest    sw.js
README.md           DEPLOY.md               package.json
src/    assets/    functions/    tests/    tools/
```

If you see a folder called `trainer` and nothing else, you are one level too high.
Go into it.

---

# Part 1 — Upload the files

### You are on: **github.com**

**1.1** Go to your repository. The address looks like
`github.com/your-username/your-repo-name`.

**1.2** If there are old files there from before, delete them first so nothing
stale is left behind:

- click a file
- click the **⋯** button, top right of the file view
- choose **Delete file**
- scroll down, click the green **Commit changes**
- repeat for anything left over

You can skip this if the repository is empty.

**1.3** Click **Add file** (grey button, near the top right), then **Upload
files**.

**1.4** Open the `trainer` folder on your computer. Select **everything inside
it** — Ctrl+A on Windows, Cmd+A on a Mac — and drag it all onto the dashed box
in the browser.

Folders keep their structure. It may take a minute; the cockpit photos are the
slow part.

**1.5** Scroll to the bottom. Type something in the message box like
`upload site`. Click the green **Commit changes**.

**1.6** Check the result. Your repository page should now list, among others:

```
assets     functions     src     tools     index.html
```

> **The one that matters is `functions`.** That is the visitor counter. If it is
> missing, you dragged the wrong level — go back to 1.4.

---

# Part 2 — Create the site on Cloudflare

### You are on: **dash.cloudflare.com**

**2.1** Log in.

**2.2** In the left sidebar find **Workers & Pages**. Click it.

**2.3** Click the blue **Create** button. You will get a page with tabs across
the top — **Workers** and **Pages**. Click **Pages**.

**2.4** Click **Connect to Git**.

**2.5** Click **Connect GitHub**. A GitHub window opens asking for permission.

- choose your account
- either **All repositories**, or **Only select repositories** and pick this one
- click **Install & Authorize**

You come back to Cloudflare automatically.

**2.6** Your repository is now in the list. Select it, then click **Begin setup**.

**2.7** This is the only screen where a wrong answer causes trouble. Set it up
exactly like this:

| Field | What to put |
|---|---|
| Project name | anything, lowercase, no spaces — becomes `thatname.pages.dev` |
| Production branch | `main` |
| Framework preset | **None** |
| Build command | **empty — delete anything in it** |
| Build output directory | `/` |

> There is nothing to compile here. The site is ready-made files, so Cloudflare
> only has to copy them. If you put something in **Build command**, the deploy
> will fail.

**2.8** Click **Save and Deploy**.

**2.9** Wait. You will see a log scrolling. After a minute or two it says
**Success**.

**2.10** Click the link it gives you — `your-project.pages.dev`. **The site
should load.**

Stop here and check it works before doing anything else. If it does, the hard
part is over.

---

# Part 3 — Use your own domain

Skip this whole part if `.pages.dev` is fine for now. You can come back later.

### You are on: **dash.cloudflare.com**

**3.1** Open your Pages project: **Workers & Pages**, click its name.

**3.2** Click the **Custom domains** tab.

**3.3** Click **Set up a custom domain**.

**3.4** Type the address you want people to use, for example
`trainer.yourdomain.com` or `yourdomain.com`. Click **Continue**.

**3.5** Cloudflare shows you what it is about to do. Click **Activate domain**.

**If your domain is already on your Cloudflare account**, that is the entire
step. Cloudflare sets up the DNS and the certificate by itself.

**If it is not**, Cloudflare will tell you. Add the domain as a site in
Cloudflare first — **Add a site** on the dashboard home, follow the instructions
to change nameservers at whoever you bought the domain from, wait for it to say
**Active**, then come back to 3.1.

**3.6** Wait a few minutes for the padlock. The domain shows as **Active** when
it is ready.

---

# Part 4 — Switch on the visitor counter

This shows "3 here" in the top bar. It needs a small free database.

**Skip this part if you do not want it.** The site works perfectly without it and
the chip simply never appears.

### You are on: **dash.cloudflare.com**

**4.1** In the left sidebar, find the storage section — it is called **Storage &
Databases**, or on older dashboards you will find **D1** under **Workers &
Pages**. Click **D1 SQL Database**.

**4.2** Click **Create database**.

**4.3** Name it exactly:

```
trainer-presence
```

Click **Create**.

**4.4** You are now looking at your empty database. Click the **Console** tab.

**4.5** Paste this into the box, exactly as written:

```sql
CREATE TABLE IF NOT EXISTS presence (id TEXT PRIMARY KEY, seen INTEGER);
```

Click **Execute**. It should report success.

**4.5b** Paste this second line in and Execute it as well. It keeps the counts
fast as the table grows:

```sql
CREATE INDEX IF NOT EXISTS presence_seen ON presence (seen);
```

That is the database done.

**4.6** Now connect it to the site. Go back to **Workers & Pages** and click your
Pages project.

**4.7** Click **Settings**, then find **Functions**, then **D1 database
bindings**. Click **Add binding**.

**4.8** Fill in:

| Field | What to put |
|---|---|
| Variable name | `PRESENCE` |
| D1 database | `trainer-presence` |

> **It must be `PRESENCE`**, all capitals, spelled that way. That is the name the
> code looks for. Anything else and the counter stays hidden.

Click **Save**.

**4.9** The site needs redeploying to pick the binding up. Click the
**Deployments** tab, find the newest one, click the **⋯** on its right, and
choose **Retry deployment**.

**4.10** Wait for it to finish, then open your site. The chip should appear in
the top bar reading **1 here** — that is you.

The aircraft screen also gains a line showing **total visitors**, **this month**
and **here now**. It stays hidden until there is something to show, so on day one
you will see 1 visitor, which is correct and slightly lonely.

---

# Part 5 — Check everything

Open your site and go through this list:

- [ ] it loads, with a padlock in the address bar
- [ ] the first screen shows the F-14 in colour and other aircraft greyed out
- [ ] click the F-14, then a procedure — the checklist appears
- [ ] click a switch in the cockpit — it moves and the step ticks off
- [ ] press **Menu**, come back — your times are remembered
- [ ] if you did Part 4, the counter shows in the top bar

If all of that works, you are finished.

---

# From now on

**To update the site**, upload the changed files to GitHub the same way as Part 1.
Cloudflare notices within seconds and redeploys on its own. You never touch
Cloudflare again.

**Watch it happen** under **Deployments** in your Pages project.

**If a change does not show up**, it is almost always the cache. Hard-refresh
first: Ctrl+Shift+R on Windows, Cmd+Shift+R on a Mac.

**Turn off GitHub Pages** if you had it running, so there is only one live copy:
on github.com, your repo → **Settings** → **Pages** → set Source to **None**.

---

# When something goes wrong

| What you see | What it is | Fix |
|---|---|---|
| Deploy fails, log mentions a build command | Something is in **Build command** | Settings → Builds → clear it, redeploy |
| Site loads but is unstyled | **Build output directory** is wrong | It must be `/` |
| 404 on the whole site | Files went up inside a folder | Repo root must show `index.html`, not `trainer` |
| Counter never appears | Binding name wrong, or no redeploy | Must be `PRESENCE`; then retry the deployment |
| Counter shows 0 | The table was not created | Redo 4.4 and 4.5 |
| Domain will not activate | Domain is not on this Cloudflare account | Add it as a site first |
| Old version keeps showing | Cache | Hard-refresh; then Caching → Purge Everything |
| Cockpit photos missing | `assets` did not upload | Check the repo has an `assets` folder |

---

# A custom domain through Cloudflare

Two things have to line up: GitHub has to believe the domain is yours so it can
issue a certificate, and Cloudflare has to not get in the way while that happens.
Doing it in the wrong order is the usual reason people end up in a redirect loop.

## 1. Point the domain at Cloudflare

If the domain is registered elsewhere, add it as a site in Cloudflare and change
the nameservers at your registrar to the two Cloudflare gives you. Wait until the
dashboard says **Active** before going further.

## 2. Add the DNS record — grey cloud for now

**Subdomain**, e.g. `trainer.example.com` — one CNAME:

```
Type   CNAME
Name   trainer
Target <your-username>.github.io
Proxy  DNS only        <- grey cloud, this matters
```

**Apex**, e.g. `example.com` — four A records, all with the same name `@`:

```
185.199.108.153
185.199.109.153
185.199.110.153
185.199.111.153
```

and if you want IPv6, four AAAA records:

```
2606:50c0:8000::153
2606:50c0:8001::153
2606:50c0:8002::153
2606:50c0:8003::153
```

All **DNS only** for now. Check these against GitHub's current documentation —
they are stable but not guaranteed forever.

## 3. Tell GitHub

Repo → **Settings → Pages → Custom domain** → type the domain → **Save**.

That writes a `CNAME` file into your repo, which is expected — leave it there. If
you later re-upload the site by drag and drop, make sure you do not delete it.

GitHub will check DNS and then issue a certificate. It usually takes a few
minutes and can take up to an hour. When it is done, **Enforce HTTPS** stops
being greyed out. Tick it.

## 4. Only now turn the proxy on, if you want it

Flip the record to **Proxied** (orange cloud), then in **SSL/TLS**:

- set the mode to **Full** or **Full (strict)**
- **never Flexible** — Flexible talks to GitHub over plain HTTP, GitHub redirects
  to HTTPS, and you get an infinite redirect loop. This is the single most common
  way this setup breaks.

**Always Use HTTPS** and **Automatic HTTPS Rewrites** are both fine to leave on.

Proxying is optional. It buys you Cloudflare's cache and analytics and hides the
origin; leaving it grey works perfectly well and is one less thing to go wrong.

## 5. Remember the cache after each deploy

With the proxy on, Cloudflare caches in front of Pages, and Pages already sends a
ten minute cache header on HTML. So a push may not show up straight away.

Either purge after deploying — **Caching → Configuration → Purge Everything** —
or add a cache rule that bypasses the cache for `/` and `/index.html`.

The site's own service worker is network-first for code, so it will not strand
anyone on an old build. Cloudflare's edge cache is now the more likely reason a
change does not appear.

## If it does not work

- **Redirect loop** — SSL/TLS mode is Flexible. Set it to Full.
- **Certificate never issues** — the record is proxied. Set it back to DNS only
  until GitHub finishes, then proxy it again.
- **404 on a custom domain** — the `CNAME` file is missing from the repo root.
- **Old version keeps showing** — purge the Cloudflare cache.
- **Site works, subpages 404** — you are on an apex domain without `www`; make
  sure the Pages custom domain matches exactly what you typed in DNS.

## A bonus, now that you are on Cloudflare

The visitor counter in `tools/presence-worker.js` can live on your own domain
instead of a `workers.dev` URL. Deploy it, then add a Worker route for
`example.com/api/presence*`, and set `PRESENCE_URL` in `src/core/config.js` to
`/api/presence`. Same origin, so no CORS at all.



---

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



---

# The visitor counter

A chip in the top bar reading "7 here". It is off unless there is something
behind it, and it fails quietly rather than holding the page up.

On **Cloudflare Pages** the endpoint ships with the site — `functions/api/presence.js`
is deployed automatically. It needs somewhere to keep the list, which is a free
D1 database:

```bash
npx wrangler d1 create trainer-presence

npx wrangler d1 execute trainer-presence --remote \
  --command "CREATE TABLE IF NOT EXISTS presence (id TEXT PRIMARY KEY, seen INTEGER)"
```

Then in the Pages project: **Settings → Functions → D1 database bindings**, add
one with variable name `PRESENCE` pointing at `trainer-presence`. Redeploy and
the chip appears.

`PRESENCE_URL` in `src/core/config.js` is already `/api/presence`. Same origin,
so there is no CORS to configure.

## What it stores

One row per visitor: a random id the browser generates for itself, and a
timestamp. No addresses, no cookies, nothing that identifies anyone. Rows older
than the window are swept away.

## Whether it fits in the free tier

The client beats every 45 seconds against a 150 second window, so someone who
closes the tab drops off within about two minutes.

| visit length | writes | visits/day within the free 100,000 |
|---|---|---|
| 10 minutes | 14 | ~7,100 |
| 20 minutes | 27 | ~3,700 |
| an hour | 80 | ~1,250 |

Function requests are capped at 100,000/day too, and one beat is one request, so
the two limits bite at the same point. If you ever get near it, raise `BEAT` in
`src/core/presence.js` — going from 45 to 90 seconds halves both.

Nothing here bills you if you exceed it; the counter simply stops updating.

## On GitHub Pages instead

Pages Functions do not exist there, so you would deploy `tools/presence-worker.js`
as a standalone Cloudflare Worker and put its URL in `PRESENCE_URL`. That version
uses a Durable Object, which has been on the Workers free plan since April 2025.
It works, but it is two deploys instead of one — another reason Cloudflare Pages
is the easier host if you want this feature.
