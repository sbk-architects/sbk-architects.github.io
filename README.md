# SBK Architects: website

A one-page site for an architecture and civil construction studio. The centrepiece is a
scroll-driven 3D sequence, rendered like a photographed architectural model on the page's
ivory ground. The villa starts as a gold blueprint and is then built for real: footing
pits and bar mats, rebar cages, props and plywood decks, slabs poured floor by floor,
brick walls rising course by course inside tube-and-board scaffolding, a tower crane
slewing loads, champagne-framed glazing, lime plaster and stone washing up the walls,
and finally the garden, pool and lights for the handover. Gold lines mark each piece
while it is planned and built and fade once it is done.

```
index.html             page content (all text lives here)
work/arun-hotel.html   Arun Hotel project page (one page per featured project)
work/more.html         More work: one page for all the other projects
css/style.css          design tokens (colours, fonts, spacing) and layout
css/project.css        project page layout, plan sheets and the drawing viewer
js/main.js             smooth scroll, menu, build progress, drawings, carousel, form,
                       and the arch that carries a card into its project page
js/project.js          project pages: the arriving arch, the way back, the drawing viewer
js/build3d.js          the 3D construction scene (three.js r170 + post-processing addons)
assets/favicon.svg     browser-tab icon
assets/works/          project photographs for the Selected work cards (960 × 1200)
assets/works/<name>/   a project page's 3D views and plans
```

## Preview it

On a Mac, double-click `Start local preview.command`. It serves this folder as a small
website, opens it in your browser and prints a second address (like
`http://192.168.1.20:8000`) that phones and tablets on the same Wi-Fi can open. Keep its
window open while you browse; close it to stop. The first time, macOS may ask whether to
accept incoming network connections: choose Allow. If macOS says it cannot verify the
file, right-click it, choose Open, then Open again.

On any other computer, run a tiny server in this folder and open the address it prints:

```
python3 -m http.server 8000
```

The page needs an internet connection, because the fonts (Google Fonts) and two
libraries (three.js r170 with its post-processing addons, and Lenis 1.1.13, all from
jsDelivr) load from CDNs. Some browsers block parts of the page when `index.html` is
opened straight from the disk, so one of the servers above is the reliable way to view it.

## Save a checkpoint in git

Double-click `Save checkpoint to git.command`. The first time, it turns this folder into
a git repository holding every earlier version (from `../sbk-architects-site.bundle`).
Each time, it saves the folder as it is now as a dated checkpoint (`checkpoint-…` tag).
The first run also offers to add a GitHub repository; after that, each checkpoint is
pushed there too. git comes with Apple's Command Line Tools; the script offers to install
them if they are missing.

## Replace the placeholders before going live

Everything below is sample content.

| What | Where |
| --- | --- |
| Firm name "SBK Architects" | `index.html` (header, hero, footer, title block) and the site hoarding lettering in `js/build3d.js` (`T.hoard`) |
| City (Mysore), address and studio hours (filled in) | `index.html`: hero eyebrow, menu footer, contact details, footer title block; the city also appears on the hoarding in `js/build3d.js` |
| Phone / WhatsApp and email (filled in) | `index.html`: contact section (`tel:`, `wa.me` and `mailto:` links) and footer title block |
| Figures: 6+ years, 50+ homes, 1.5 lakh sq ft (filled in) | `index.html`, section "FIGURES" (`data-count` is the number the counter runs up to) |
| Project details (type, short description) | `index.html`, section "WORK". Add the year, area or status you want to show |
| Arun Hotel facts (status, area, floors, year) | `work/arun-hotel.html`: the title block under the hero ("Project facts") and the construction notes |
| Instagram link (filled in; add LinkedIn here later if you want) | `index.html`, footer title block, "Follow" |
| Copy for the seven build phases | `index.html`, the `chapter__card` blocks |

## Selected work

Selected work holds the projects with a page of their own (Arun Hotel, Shukavana,
Apollo Hospital, Abhishek Emerald Enclave, Mahadev's Residence, Chandrashekar's
Residency, Kiran Babu's Residency). Its last card, "View more", opens `work/more.html`: one page for all the
other projects (Ravi's Farm House, Guruprasad Residence, Ashraya Residency, Commercial
Shopping Complex, Gopal Raju's Commercial Complex, Hemanth Reddy's Residence), each with
its card, a description and pictures (and plans, where there are some) that open larger. Guruprasad Residence also keeps its full page with plans and notes,
linked from its entry ("Plans and notes").

Each card plays its line elevation when it scrolls into view, then reveals the
photograph from the ground up; hovering a card with a mouse plays it again. The
photographs are in `assets/works` (cropped to the card's 4:5 arch). The drawings are
the `arun`, `shukavana`, `chandrashekar`, `mahadev`, `kiranbabu`, `guruprasad`, `gopalraju`, `ashraya`,
`commercial`, `apollo`, `emerald`, `generic` and `more` (the passage of arches on the View
more card) entries in `DRAW` in `js/main.js`.
To add a featured project, copy an `<article class="work work--link">` block on the home
page (before the View more card). To add one of the other projects, copy an
`<article class="work more-item">` block in `work/more.html`: its card photograph (4:5,
about 960 × 1200 px) goes in `assets/works/<name>.jpg`; its pictures go in
`assets/works/<name>/`, each a small `thumb-N.jpg` (640 px wide) for the page and the
full picture for the viewer (`data-full`). Projects on the View more page use the plain
`generic` drawing (`data-elevation="generic"`); only featured projects get a drawing traced
over their own picture. The `arun` drawing is traced over its photograph in the photograph's own 960 × 1200
frame (see `VIEW`), so the lines land exactly on the picture that follows them; so are
`shukavana`, `chandrashekar`, `mahadev`, `kiranbabu`, `guruprasad` and `gopalraju` (most of
`kiranbabu`'s edges are line segments found in the photograph itself, listed in its `T`). In
`guruprasad` and `shukavana`, the sign lettering fades in part-way through the drawing.

## Project pages

A card can open its own page. Click it and the page fades to paper around the card's
arch; on the project page the arch then opens out into the hero picture: it grows, its
round top squares off and the whole 3D view appears around the card's crop, while the
words arrive. "Selected work" (or the browser's back button) closes the picture into
the card's arch again. With "reduce motion" switched on, these are plain page changes.

There are eight so far, each with its images in `assets/works/<name>/` (Guruprasad
Residence's is reached from More work, and its back links return there):

- `work/arun-hotel.html`: a wide hero, the 3D street view filling the first screen
- `work/abhishek-emerald-enclave.html`: a tall hero (`p-hero--tall`), the card's own
  front elevation beside the words, for a picture that is taller than it is wide
- `work/apollo-hospital.html`: a wide hero, a gallery of further 3D views (`p-views`)
  and wide plans set across the page under their notes (`p-sheet--wide`)
- `work/shukavana.html`: the tall hero set to the picture's own shape
  (`style="--ar: 1.196; --maxw: 56vw"`: width ÷ height, and a cap so the words keep
  room), a gallery of five 3D views and notes on how it is crafted; no plans
- `work/guruprasad-residence.html`: a wide hero (the 3D view), ground and first
  floor plans with notes, and notes on how it is put together
- `work/chandrashekar-residency.html`: a wide hero narrowed to show the whole corner
  view (`--hero-max: 1.72` in its `<head>`: the widest the picture may be, as width ÷
  height), the front view, the pooja room with notes, and construction notes
- `work/mahadev-residence.html`: a wide hero (the corner at dusk), a gallery of three
  more 3D views (the front by day and at dusk, the other corner by day) and construction notes
- `work/kiran-babu-residency.html`: a wide hero (the corner at night), a gallery of three
  more 3D views (the front at night, the corner and the front by day) and construction notes

The "Next project" links follow the cards: Arun Hotel → Shukavana → Apollo Hospital →
Abhishek Emerald Enclave → Mahadev's Residence → Chandrashekar's Residency → Kiran Babu's
Residency → back to Arun Hotel.

To add another project:

1. Copy whichever page suits the picture (wide or tall) to `work/<name>.html`, and point
   the "Next project" links at the end of the pages along the chain. Change the title, description,
   words, facts (the title block) and the plan sheets. Each plan is a
   `<button class="p-plan" data-zoom ...>` around its image; add `p-plan--white` when the
   drawing sits on white, so the white takes the page's paper colour.
2. Put the images in `assets/works/<name>/`. Point the hero `<img>` and `data-hero-src`
   on `<body>` at the 3D view, and set `--pos` in the page's `<head>`: where the card's
   4:5 crop sits in that view, as a percentage across (the crop's left edge ÷ (view width
   − crop width)) and a height for the wide screens (30% keeps the tops of buildings).
   With that, the card's crop and the full view line up exactly as the arch opens.
3. On the home page, give the project's card the class `work--link`, and link its title:
   `<h3><a class="work__link" href="work/<name>.html" data-expand data-prefetch="(the 3D view)">Name</a></h3>`.
4. Optional: replace `--lqip` in the page's `<head>` with a tiny copy of the 3D view
   (about 48 × 27 px, as a data URI). It covers the frame or two before the picture is
   decoded; without it that moment shows a plain tint.

## Connect the enquiry form

The form validates and shows a thank-you message, but sends nothing until it has
somewhere to go. Create a free form endpoint (Formspree, Getform, Basin or similar),
then paste its URL into `js/main.js`:

```js
const FORM_ENDPOINT = 'https://formspree.io/f/your-id';
```

Submissions are posted as normal form data, so they arrive in your inbox.

## Tweak the 3D build (`js/build3d.js`)

- `MAT` lists the materials. Each `surface({ a, b, ... })` has a construction look (`a`)
  and a finished look (`b`) that it changes to when the finish wash passes: concrete to
  lime plaster, brick to plaster, concrete to sandstone and so on. `ca` / `cb` tint them,
  `ra` / `rb` set roughness. The textures (`T.concrete`, `T.brick`, `T.stone`, `T.grass`…)
  are generated in code, so there are no image files to manage.
- Pieces are boxes, `add('batch', [x0, x1, y0, y1, z0, z1], {...})` in metres. `t` / `d`
  set when a piece appears and for how long (0 to 1 over the whole scroll), `p` / `pd`
  when concrete is poured into it, `o` / `od` when temporary works come down.
- Phases map to scroll in `js/main.js` (`PH`): Drawing 0.04, Foundation 0.16,
  Frame 0.30, Masonry 0.50, Envelope 0.62, Finishes 0.74, Handover 0.88.
- `KEYS` is the camera path: azimuth, elevation, distance and framing per phase.
- The hoarding lettering is drawn in `T.hoard`; change the name there too.

Quality adapts to the device. Desktops get ambient occlusion, a soft bloom on the lit
windows and 2048 px shadows; phones, tablets and small machines render directly with
lighter shadows and textures. If frames run slow, the resolution drops, then the ambient
occlusion switches off. The scene pauses when it is off screen, and shows a static line
elevation if WebGL is unavailable. With "reduce motion" switched on, the camera stays
still and each chapter shows its finished state.

## Publish

It is a static site: upload the folder to Netlify (drag and drop), Vercel, GitHub
Pages, Cloudflare Pages or any ordinary web host. No build step.

## Credits

three.js (MIT), Lenis (MIT). Fonts from Google Fonts under the SIL Open Font
License: Noto Serif Display, Archivo, Ballet.
