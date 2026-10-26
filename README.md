# k0rbi02.github.io

My little corner of the web: a terminal that installs me, a canvas that zooms out, and the small things I build.

Live at **https://k0rbi02.github.io**

## Projects

The projects shown on the site live in [`projects.json`](projects.json). To add one, add a block:

```json
{
  "name": "My Project",
  "description": "One sentence about what it does.",
  "icon": "icons/my-project.svg",
  "color": "peach",
  "demo": "https://…",
  "code": "https://github.com/K0RBI02/…"
}
```

- `color`: `peach`, `cream`, `apricot`, `blue`, or any CSS colour
- `demo` / `code` are optional; for other buttons use `"links": [{ "label": "…", "url": "…" }]`
- icons are SVGs in [`icons/`](icons); use `currentColor` for the strokes so they work in dark mode

## Run locally

The page loads `projects.json`, so it needs a small web server:

```bash
npx http-server -p 4321 .
```

Plain HTML, CSS and JavaScript, no build step.
