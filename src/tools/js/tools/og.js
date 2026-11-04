// Open Graph images: design the picture a link shows when it is shared, preview it, get the tags.
// Pasted page source is only parsed, never run, and nothing here goes online.

const OG_W = 1200, OG_H = 630;
const OG_TITLE_MAX = 60, OG_DESC_MAX = 160;
const OG_SANS = '"Instrument Sans", system-ui, sans-serif';
const OG_MONO = '"JetBrains Mono", ui-monospace, monospace';

// Black or white, whichever reads better on this colour
function ogInkOn(hex) {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  return 0.299 * r + 0.587 * g + 0.114 * b > 150 ? '#111110' : '#ffffff';
}

// Breaks text into lines of maxWidth. Past maxLines the last line ends in "…" and clipped is true.
function ogWrap(ctx, text, maxWidth, maxLines) {
  const lines = [];
  let line = '';
  for (let word of text.trim().split(/\s+/).filter(Boolean)) {
    // A single word wider than the line (a long URL, say) is cut wherever it has to be
    while (ctx.measureText(word).width > maxWidth) {
      if (line) { lines.push(line); line = ''; }
      let cut = word.length - 1;
      while (cut > 1 && ctx.measureText(word.slice(0, cut)).width > maxWidth) cut--;
      lines.push(word.slice(0, cut));
      word = word.slice(cut);
    }
    const next = line ? `${line} ${word}` : word;
    if (ctx.measureText(next).width <= maxWidth) line = next;
    else { lines.push(line); line = word; }
  }
  if (line) lines.push(line);
  if (lines.length <= maxLines) return { lines, clipped: false };
  const kept = lines.slice(0, maxLines);
  let last = kept[maxLines - 1];
  while (last && ctx.measureText(`${last}…`).width > maxWidth) last = last.slice(0, -1);
  kept[maxLines - 1] = `${last.trimEnd()}…`;
  return { lines: kept, clipped: true };
}

function ogDrawCover(ctx, img, x, y, w, hgt) {
  const scale = Math.max(w / img.naturalWidth, hgt / img.naturalHeight);
  const sw = w / scale, sh = hgt / scale;
  ctx.drawImage(img, (img.naturalWidth - sw) / 2, (img.naturalHeight - sh) / 2, sw, sh, x, y, w, hgt);
}

function ogRender(canvas, { title, desc, site, layout, bg, accent, img }) {
  const ctx = canvas.getContext('2d');
  const split = layout === 'split';
  const centred = layout === 'center';
  const photoBehind = img && !split;

  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, OG_W, OG_H);
  if (photoBehind) {
    ogDrawCover(ctx, img, 0, 0, OG_W, OG_H);
    ctx.fillStyle = 'rgba(0, 0, 0, .55)';   // keeps the text readable on any photo
    ctx.fillRect(0, 0, OG_W, OG_H);
  }
  if (split) {
    const x = 720;
    if (img) ogDrawCover(ctx, img, x, 0, OG_W - x, OG_H);
    else { ctx.fillStyle = accent; ctx.fillRect(x, 0, OG_W - x, OG_H); }
  }

  const ink = photoBehind ? '#ffffff' : ogInkOn(bg);
  const x = centred ? OG_W / 2 : split ? 64 : 80;
  const width = centred ? 1000 : split ? 592 : 1040;
  ctx.textAlign = centred ? 'center' : 'left';
  ctx.textBaseline = 'top';

  // The biggest title size that fits in three lines
  let size, fit;
  for (size of [84, 76, 68, 60, 52, 46]) {
    ctx.font = `700 ${size}px ${OG_SANS}`;
    fit = ogWrap(ctx, title, width, 3);
    if (!fit.clipped) break;
  }
  const titleLine = Math.round(size * 1.12);

  ctx.font = `400 34px ${OG_SANS}`;
  const descLines = desc ? ogWrap(ctx, desc, width, 2).lines : [];
  const descLine = 46, gap = 26, footer = site ? 90 : 0;

  const block = fit.lines.length * titleLine + (descLines.length ? gap + descLines.length * descLine : 0);
  let y = Math.max(56, (OG_H - footer - block) / 2);

  ctx.fillStyle = ink;
  ctx.font = `700 ${size}px ${OG_SANS}`;
  for (const line of fit.lines) { ctx.fillText(line, x, y); y += titleLine; }

  if (descLines.length) {
    y += gap;
    ctx.globalAlpha = 0.78;
    ctx.font = `400 34px ${OG_SANS}`;
    for (const line of descLines) { ctx.fillText(line, x, y); y += descLine; }
    ctx.globalAlpha = 1;
  }

  if (site) {
    ctx.font = `500 26px ${OG_MONO}`;
    const siteY = OG_H - 76;
    const label = ogWrap(ctx, site, width - 60, 1).lines[0];
    const textWidth = ctx.measureText(label).width;
    const markX = centred ? x - (textWidth + 56) / 2 : x;
    ctx.strokeStyle = accent;
    ctx.lineWidth = 7;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(markX + 3, siteY + 16);
    ctx.bezierCurveTo(markX + 14, siteY + 6, markX + 26, siteY + 24, markX + 41, siteY + 12);
    ctx.stroke();
    ctx.textAlign = 'left';
    ctx.fillStyle = ink;
    ctx.fillText(label, markX + 56, siteY);
  }
}

// Reads the link preview tags out of a page's HTML. DOMParser neither runs scripts nor loads images.
function ogReadTags(html) {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const meta = (attr, name) => doc.querySelector(`meta[${attr}="${name}"]`)?.getAttribute('content')?.trim() || '';
  return {
    title: meta('property', 'og:title'),
    desc: meta('property', 'og:description'),
    image: meta('property', 'og:image'),
    url: meta('property', 'og:url'),
    site: meta('property', 'og:site_name'),
    type: meta('property', 'og:type'),
    card: meta('name', 'twitter:card'),
    plainTitle: doc.querySelector('title')?.textContent.trim() || '',
    plainDesc: meta('name', 'description'),
    canonical: doc.querySelector('link[rel="canonical"]')?.getAttribute('href')?.trim() || '',
  };
}

function ogReport(tags) {
  const problems = [];
  if (!tags.title) problems.push(tags.plainTitle ? 'No og:title, apps fall back to the page title.' : 'No og:title and no page title.');
  if (!tags.desc) problems.push(tags.plainDesc ? 'No og:description, some apps fall back to the meta description.' : 'No og:description.');
  if (!tags.image) problems.push('No og:image, so links show up without a picture.');
  else if (!/^https?:\/\//i.test(tags.image)) problems.push(`og:image is not a full address (${tags.image}). It has to start with https://.`);
  if (!tags.url) problems.push('No og:url.');
  if (!tags.card) problems.push('No twitter:card, so X shows a small card at best.');
  return problems;
}

// field() wraps its control in a <label>, which would name (and click) only the first button of a group
const ogGroup = (label, control, hint) => h('div', { class: 'field', role: 'group', 'aria-label': label },
  h('span', { class: 'field-label' }, label), control, hint ? h('p', { class: 'field-hint' }, hint) : null);

const ogHost = (url) => {
  try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return ''; }
};

function ogTagsFor({ title, desc, site, url, imageUrl }) {
  const tag = (attr, name, content) => content && `<meta ${attr}="${name}" content="${escapeHtml(content)}">`;
  return [
    tag('property', 'og:type', 'website'),
    tag('property', 'og:title', title),
    tag('property', 'og:description', desc),
    tag('property', 'og:url', url),
    tag('property', 'og:site_name', site),
    tag('property', 'og:image', imageUrl),
    imageUrl && tag('property', 'og:image:width', String(OG_W)),
    imageUrl && tag('property', 'og:image:height', String(OG_H)),
    tag('name', 'twitter:card', 'summary_large_image'),
  ].filter(Boolean).join('\n');
}

tool({
  id: 'og-image',
  cat: 'generate',
  name: 'Open Graph images',
  desc: 'Make the picture a link shows when it is shared, and preview it.',
  intro: 'Design a 1200×630 share image, see roughly how apps show it, and copy the tags for your page. Paste a page\'s source to check the tags it already has.',
  keywords: 'open graph og image social share preview card meta tags twitter x facebook linkedin whatsapp discord link preview',
  mount(root) {
    const { work, side } = layout(root);
    const canvas = h('canvas', { class: 'og-canvas', width: OG_W, height: OG_H, role: 'img', 'aria-label': 'Preview of your share image' });
    let photo = null;

    const title = textInput({ placeholder: 'What the page is about', oninput: () => redraw() });
    const desc = textArea({ placeholder: 'One or two sentences', style: { minHeight: '76px' }, oninput: () => redraw() });
    const site = textInput({ placeholder: 'example.com', oninput: () => redraw() });
    const url = textInput({ type: 'url', placeholder: 'https://example.com/page', oninput: () => redraw() });
    const imageUrl = textInput({ type: 'url', placeholder: 'https://example.com/og-image.png', oninput: () => redraw() });
    const titleCount = h('span', { class: 'og-count' }, '0');
    const descCount = h('span', { class: 'og-count' }, '0');

    const style = segmented([['left', 'Left'], ['center', 'Centred'], ['split', 'Image right']], 'left', () => redraw(), 'Layout');
    const bg = h('input', { type: 'color', value: '#faf8f3', oninput: () => redraw(), 'aria-label': 'Background colour' });
    const accent = h('input', { type: 'color', value: '#ff8a4c', oninput: () => redraw(), 'aria-label': 'Accent colour' });
    const format = segmented([['png', 'PNG'], ['jpeg', 'JPG']], 'png', null, 'File format');

    const removePhoto = button('Remove image', () => {
      photo = null;
      zone.compact(false);
      removePhoto.hidden = true;
      redraw();
    }, 'quiet small');
    removePhoto.hidden = true;

    const zone = dropzone({
      accept: 'image/*',
      multiple: false,
      title: 'Add an image',
      hint: 'Optional. It stays on your device.',
      onFiles: async ([file]) => {
        try {
          photo = await loadImage(file);
          zone.compact(true, `Replace ${file.name}`);
          removePhoto.hidden = false;
          redraw();
        } catch (err) { toast(err.message); }
      },
    });

    // ---- How it will look in apps ----

    const cardImages = [];
    const cardImage = () => {
      const img = h('img', { alt: '' });
      cardImages.push(img);
      return img;
    };
    const textSlots = { title: [], desc: [], site: [] };
    const slot = (kind, tag, cls) => {
      const el = h(tag, { class: cls });
      textSlots[kind].push(el);
      return el;
    };
    const card = (label, ...body) => h('figure', { class: 'og-card-wrap' }, h('figcaption', {}, label), ...body);
    const cards = h('div', { class: 'og-cards' },
      card('X', h('div', { class: 'og-card og-card--overlay' }, cardImage(), slot('title', 'span', 'og-card-pill'))),
      card('Facebook, LinkedIn', h('div', { class: 'og-card' }, cardImage(), h('div', { class: 'og-card-text' },
        slot('site', 'small', 'og-card-site'), slot('title', 'strong', 'og-card-title'), slot('desc', 'p', 'og-card-desc')))),
      card('WhatsApp, Discord, Slack', h('div', { class: 'og-card og-card--chat' }, h('div', { class: 'og-card-text' },
        slot('site', 'small', 'og-card-site'), slot('title', 'strong', 'og-card-title'), slot('desc', 'p', 'og-card-desc')), cardImage())),
    );

    // ---- The tags ----

    const tagsOut = textArea({ readOnly: true, rows: 9, class: 'input og-tags', 'aria-label': 'Meta tags for your page' });
    const copyTags = button('Copy tags', () => copyText(tagsOut.value, 'Tags copied'), 'small');
    const lengthNote = h('p', { class: 'note' });

    // ---- Check an existing page ----

    const source = textArea({ placeholder: '<!doctype html>…', style: { minHeight: '110px' } });
    const findings = h('div', { class: 'og-findings' });
    const readSource = button('Check tags', () => {
      if (!source.value.trim()) { toast('Paste the page source first.'); return; }
      const tags = ogReadTags(source.value);
      title.value = tags.title || tags.plainTitle;
      desc.value = tags.desc || tags.plainDesc;
      url.value = tags.url || tags.canonical;
      site.value = tags.site || ogHost(url.value);
      imageUrl.value = /^https?:\/\//i.test(tags.image) ? tags.image : '';
      const problems = ogReport(tags);
      findings.replaceChildren(
        problems.length
          ? h('div', { class: 'error-box' }, h('strong', {}, plural(problems.length, 'thing'), ' to fix'), h('ul', {}, problems.map((p) => h('li', {}, p))))
          : h('p', { class: 'note' }, 'All the main tags are there.'),
        tags.image ? h('p', { class: 'note' }, 'The preview shows a new image, not the page\'s own. To use that one, save it and add it under Image.') : null,
      );
      redraw();
    }, 'small');

    // ---- Keeping it all in step ----

    const values = () => ({
      title: title.value.trim(),
      desc: desc.value.trim(),
      site: site.value.trim() || ogHost(url.value.trim()),
      url: url.value.trim(),
      imageUrl: imageUrl.value.trim(),
    });

    const refreshCards = debounce(() => {
      const src = canvas.toDataURL('image/jpeg', 0.8);
      cardImages.forEach((img) => { img.src = src; });
    }, 150);

    function redraw() {
      const v = values();
      ogRender(canvas, {
        title: v.title || 'What the page is about',
        desc: v.desc,
        site: v.site,
        layout: style.value,
        bg: bg.value,
        accent: accent.value,
        img: photo,
      });
      refreshCards();

      textSlots.title.forEach((el) => { el.textContent = v.title || 'What the page is about'; });
      textSlots.desc.forEach((el) => { el.textContent = v.desc; el.hidden = !v.desc; });
      textSlots.site.forEach((el) => { el.textContent = v.site; el.hidden = !v.site; });

      titleCount.textContent = `${title.value.length}/${OG_TITLE_MAX}`;
      descCount.textContent = `${desc.value.length}/${OG_DESC_MAX}`;
      const long = [];
      if (title.value.length > OG_TITLE_MAX) long.push('the title');
      if (desc.value.length > OG_DESC_MAX) long.push('the description');
      lengthNote.textContent = long.length ? `Most apps cut off ${long.join(' and ')} around this length.` : '';
      lengthNote.hidden = !long.length;

      tagsOut.value = ogTagsFor(v);
      save.disabled = copy.disabled = !v.title;
    }

    const fileName = () => (title.value.trim().toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, '').slice(0, 40) || 'og-image');
    const save = button('Download image', () => busy(save, async () => {
      const type = `image/${format.value}`;
      const blob = await canvasToBlob(canvas, type, 0.9);
      downloadBlob(blob, `${fileName()}.${format.value === 'jpeg' ? 'jpg' : 'png'}`);
      toast(`Saved, ${formatBytes(blob.size)}`);
    }), 'primary');
    const copy = button('Copy image', () => busy(copy, async () => {
      try {
        await navigator.clipboard.write([new ClipboardItem({ 'image/png': canvasToBlob(canvas, 'image/png') })]);
        toast('Image copied');
      } catch { toast('Copying images is blocked here. Download it instead.'); }
    }), 'quiet small');

    work.append(
      h('div', { class: 'panel og-form' },
        field('Title', title, { value: titleCount }),
        field('Description', desc, { value: descCount }),
        field('Site name', site, { hint: 'Leave it empty to use the page address.' }),
        lengthNote,
      ),
      h('div', { class: 'code-preview og-stage' }, canvas),
      cards,
      h('p', { class: 'note' }, 'Every app draws these a little differently, so treat them as a close guess.'),
      h('div', { class: 'panel og-form' },
        field('Page address', url),
        field('Address of the image', imageUrl, { hint: 'Where the file will be once you upload it. It has to be a full https:// address.' }),
        ogGroup('Tags for your page\'s <head>', tagsOut),
        h('div', { class: 'row' }, copyTags),
      ),
      h('div', { class: 'panel og-form' },
        field('Check an existing page', source, { hint: 'Open the page, view its source (Ctrl+U), and paste it here. It is read on your device.' }),
        h('div', { class: 'row' }, readSource),
        findings,
      ),
    );
    side.append(
      ogGroup('Layout', style),
      ogGroup('Colours', h('div', { class: 'row' }, bg, h('span', { class: 'note' }, 'background'), accent, h('span', { class: 'note' }, 'accent'))),
      ogGroup('Image', [zone, removePhoto]),
      ogGroup('File format', format, 'JPG keeps photos small. Stay under 5 MB so every app accepts it.'),
      actions(save, copy),
    );

    redraw();
    // Canvas text only uses a web font once it has loaded
    Promise.all([document.fonts.load(`700 84px ${OG_SANS}`), document.fonts.load(`400 34px ${OG_SANS}`), document.fonts.load(`500 26px ${OG_MONO}`)])
      .then(redraw, () => {});
  },
});
