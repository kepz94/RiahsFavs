# Riah's Fav's — Korean Fried Chicken Catering

Version 2.6

A two-file site plus a serverless email hook. Same architecture as CakedbyK:
plain HTML/CSS/JS, no build step, no framework, no bundler. You edit the file,
you push, it's live.

| File                   | What it is                                              |
|------------------------|---------------------------------------------------------|
| `index.html`           | The public site — menu, pop-ups, and the request wizard |
| `admin.html`           | The admin console — requests, events, menu, photos      |
| `api/notify.js`        | Emails the kitchen when a request comes in              |
| `firestore.rules`      | Database security rules — **must be published**         |
| `manifest.webmanifest` | Makes it installable as a phone app                     |
| `vercel.json`          | Clean URLs, and keeps `/admin.html` out of search       |

---

## Still needed before this goes live

**1. ~~The logo file.~~ Done.** `logo.png`, `icon-192.png`, `icon-512.png`
and `apple-touch-icon.png` are all in place, derived from `logo-source.png`.
To regenerate them after a logo change, crop to the alpha bounding box and
resize to 1200px wide; square icons centre the mark on `#141010`.

**2. A Firebase project.** Create one at console.firebase.google.com, then:
   - Build → Firestore Database → Create database (production mode)
   - Build → Authentication → Sign-in method → enable Google
   - Project settings → Your apps → add a Web app → copy the config object
   - Paste that config over the `CFG = { ... }` block in **both**
     `index.html` and `admin.html`. They must match exactly.
   - Authentication → Settings → Authorized domains → add your Vercel domain

**3. Publish the security rules.** Copy `firestore.rules` into
Firebase console → Firestore Database → Rules → Publish. Update the email
list inside `isAdmin()` to match `ADMIN_EMAILS` in `admin.html`.
Without this step the database is wide open.

**4. Set the admin allowlist.** In `admin.html`, `ADMIN_EMAILS` lists the
Google accounts that can open the admin. Add Riah's address.

**5. Deploy to Vercel.** Import the repo, set the root directory to this
folder, deploy. Then add these environment variables:

   | Variable         | What it's for                                  |
   |------------------|------------------------------------------------|
   | `RESEND_API_KEY` | From resend.com — sends the new-request email   |
   | `NOTIFY_TO`      | Where that email lands                          |
   | `NOTIFY_FROM`    | Optional custom sender once a domain is verified|

   Skip these and the site still works — you just won't get email alerts,
   and customers never see an error either way.

**6. Open the admin and press "Set up a new database"** (drawer → Database
tools). That writes the booking rules, serving windows, deposit policy and
the two chicken styles.

---

## Pricing is by the pan

Catering is priced **per pan**, not per guest. There is no guest count
anywhere in the request flow.

- `menu/pans` holds the pan sizes and the **chicken** price for each
  (half pan $85, full pan $140 as set by the owner).
- The customer picks a quantity for every style x pan-size combination, so
  "1 full pan sauced + 1 half pan original" is one order with two lines.
- `menu/sides` — each side carries its **own** price per pan size. Leave a
  price blank and that size simply isn't offered for that side.
- `menu/addons` — flat-price extras. Per-guest add-ons were removed along
  with the guest count; there is nothing to multiply by.

Every priced thing becomes a line in `lines[]` on the request, and the
running total, the confirmation summary, the alert email and the admin card
all read from that one list — so the number the customer saw and the number
you quote from cannot disagree.

Requests placed before this change still carry `guests` / `styles` /
`packageLabel`. The admin detects which shape a record has and renders it
accordingly, so old requests stay readable.

Sides and add-ons still ship empty. With no sides set, that section hides
itself on the site and in the request form.

## The two-week minimum

This is the one rule that differs structurally from CakedbyK, and it lives in
`settings/schedule`:

- `leadTimeDays: 14` — the earliest bookable date. Anything sooner is not
  shown at all; the customer cannot select it.
- `shortNoticeDays: 21` — bookings landing between day 14 and day 21 still go
  through, but arrive flagged **⏱ RUSH** in the admin inbox so they can be
  judged case by case.

Both are adjustable in Admin → Schedule, and every setting shows a plain-English
line underneath saying exactly what it does at its current value.

---

## Data model (Firestore)

```
settings/schedule   booking rules, serving windows, blocked dates
settings/policy     deposit percent, pay-in-full threshold
settings/business   tagline, service area, socials, contact
settings/cause      the "why we do this" section (off until written)
settings/hero       what sits at the top of the homepage — see below
menu/styles         the two chicken styles
menu/packages       per-guest tiers — empty until Riah adds them
menu/sides          empty; the section hides itself when empty
menu/addons         empty; the section hides itself when empty
weeks/{monday}      per-week booked count, capacity override, closures
requests/{auto}     one catering request, pending → quoted → confirmed → completed
events/{auto}       pop-ups: host, venue, address, date, times, photo
gallery/{auto}      photos for the "From the fryer" strip
```

### The homepage hero

`settings/hero` carries a `kind`, and only one kind is live at a time:

| `kind`  | What the top of the page shows                                    |
|---------|-------------------------------------------------------------------|
| `none`  | The brandmark, headline and buttons on the flat gradient          |
| `photo` | A boxed photo card above the headline                             |
| `reel`  | A boxed Instagram reel embed above the headline                   |
| `video` | **A looping video filling the hero, headline sitting over it**    |

The film (`kind: 'video'`, added in 2.2) is a separate layer from the boxed
photo/reel card, and the two cannot both be showing: `heroMarkup()` returns
nothing for `video`, so `body.has-hero` stays off and only `body.has-film`
turns on. Setting the hero back to a photo or a reel restores 2.1 behaviour
exactly.

```
hero.film = {
  url:    'https://…/hero.mp4'  direct link to the file — .mp4/.webm/.mov/.m4v
  poster: '<data URL>'          still frame; compressed in the browser like any photo
  scrim:  0-90                  how much darkness sits over the video
  height: 50-100                hero height as a percent of the screen
  y:      0-100                 which part of the frame shows through the crop
}
```

**The video is not stored in Firestore.** A document caps at 1 MB, so unlike
photos the film is referenced by URL — the file lives in the repo root and is
served by Vercel like any other static asset.

### The film is retired (2.6) — the mechanism stays

The autoplay video hero ran from 2.3 to 2.5 and was retired in 2.6. `hero.mp4`
and `hero-poster.jpg` are gone from the repo, and the branch override in
`index.html` is switched off:

```js
var HERO_FILM = { url: null, poster: null, scrim: 55, height: 100, y: 50 };
```

With `url` null the override does nothing and **`settings/hero` is back in
charge**, so Admin → Homepage hero controls the top of the page again — every
kind (`none`, `photo`, `reel`, `video`) behaves normally.

The `video` kind itself is untouched and still works. To bring a film back:
set the hero to a video in the admin, or commit a file and point `HERO_FILM.url`
at it again. If you do, re-encode as H.264 High / yuv420p with `+faststart` and
no audio track — HEVC will not play in Chrome or Firefox, and audio is dead
weight on a hero that must be muted to autoplay at all.

**Known limit, for whoever asks next:** iOS Low Power Mode blocks auto-playing
video at OS level. Muted, `playsinline` and `autoplay` set correctly changes
nothing, and no override exists. That is why a still frame mattered, and it is
not a bug worth chasing again.

Images are compressed in the browser and stored as data URLs directly in
Firestore — same approach as CakedbyK, so there's no Storage bucket to
configure or pay for. Each image is scaled and re-encoded until it fits well
under the 1 MB document ceiling.

---

## Design notes

The palette is taken from the logo: the gold → orange → red gradient of the
wordmark, the ribbon's blue, and the plumeria's cream.

**The site is dark on purpose.** "FAV'S" in the logo is white with a thin
outline, so it disappears against a light background. Every surface the
brandmark sits on is near-black. Don't place the logo on a light surface.

---

## Deploying

This repository is self-contained — plain static files plus one serverless
function. Nothing to build, nothing to install.

On Vercel: import `kepz94/RiahsFavs`, leave the root directory at the default,
leave the framework preset as "Other", and deploy. `api/notify.js` is picked up
automatically.

---

## Dev checks

`tools/` holds checks that must be run, not trusted. It has its own
`package.json` on purpose — the repo root stays zero-config static so Vercel
never tries to build the site.

```bash
cd tools && npm install
npm run check              # iOS sticky-zoom guard
npm run check:self-test    # proves the check can actually fail
```

**The iOS sticky-zoom guard.** iOS zooms the page when a form control under
16px is focused, and in an installed PWA there is no address bar, so the zoom
sticks and the whole screen stays magnified. The guard asserts every
input/select/textarea computes to at least 16px, and that no page suppresses
the symptom with `maximum-scale` or `user-scalable=no` (which would disable
pinch-zoom for everyone, including people who need it).

The size lives in one token, `--t-control`, defined in both files. Don't lower
it, and don't let a type-scale pass sweep it up with the other sizes — that is
exactly how this bug comes back.
