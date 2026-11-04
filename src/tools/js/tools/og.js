// Open Graph images: design the picture a link shows when it is shared, preview it, get the tags.
// Making an image stays on the device. Checking a website goes online: browsers may not read other
// sites, so microlink.io fetches the page's <head> for us. Whatever comes back is only parsed, never run.

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

// Shows a preview large, on top of everything. <dialog> brings Esc and focus handling with it.
function ogShowLarge(content) {
  const dialog = h('dialog', { class: 'og-zoom', 'aria-label': 'Larger preview' },
    h('div', { class: 'og-zoom-body' }, content),
    iconBtn('remove', 'Close', () => dialog.close(), 'og-zoom-close'),
  );
  dialog.addEventListener('close', () => dialog.remove());
  dialog.addEventListener('click', (e) => { if (e.target === dialog) dialog.close(); });   // the backdrop
  document.body.append(dialog);
  dialog.showModal();
}

// Makes el open a large version of itself, by click or keyboard
function ogZoomable(el, label, content) {
  el.classList.add('og-zoomable');
  el.setAttribute('role', 'button');
  el.setAttribute('tabindex', '0');
  el.setAttribute('aria-label', label);
  el.addEventListener('click', () => ogShowLarge(content()));
  el.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    e.preventDefault();
    ogShowLarge(content());
  });
  return el;
}

// The three "how apps show it" cards, used by both modes
function ogCards() {
  const images = [], slots = { title: [], desc: [], site: [] };
  const media = () => {
    const img = h('img', { alt: '', referrerpolicy: 'no-referrer', hidden: true });
    const empty = h('span', {}, 'No image');
    images.push({ img, empty });
    return h('div', { class: 'og-card-media' }, img, empty);
  };
  const slot = (kind, tag, cls) => {
    const el = h(tag, { class: cls });
    slots[kind].push(el);
    return el;
  };
  const text = () => h('div', { class: 'og-card-text' }, slot('site', 'small', 'og-card-site'), slot('title', 'strong', 'og-card-title'), slot('desc', 'p', 'og-card-desc'));
  const card = (label, body) => h('figure', { class: 'og-card-wrap' }, h('figcaption', {}, label),
    ogZoomable(body, `Show the ${label} preview larger`, () => {
      const copy = body.cloneNode(true);
      ['role', 'tabindex', 'aria-label'].forEach((name) => copy.removeAttribute(name));
      copy.classList.remove('og-zoomable');
      return copy;
    }));
  const el = h('div', { class: 'og-cards' },
    card('X', h('div', { class: 'og-card og-card--overlay' }, media(), slot('title', 'span', 'og-card-pill'))),
    card('Facebook, LinkedIn', h('div', { class: 'og-card' }, media(), text())),
    card('WhatsApp, Discord, Slack', h('div', { class: 'og-card og-card--chat' }, text(), media())),
  );
  return {
    el,
    setText({ title, desc, site }) {
      slots.title.forEach((s) => { s.textContent = title; });
      slots.desc.forEach((s) => { s.textContent = desc; s.hidden = !desc; });
      slots.site.forEach((s) => { s.textContent = site; s.hidden = !site; });
    },
    setImage(src, emptyText = 'No image') {
      images.forEach(({ img, empty }) => {
        img.hidden = !src;
        empty.hidden = !!src;
        empty.textContent = emptyText;
        if (src) img.src = src; else img.removeAttribute('src');
      });
    },
  };
}

// Gets a page's <head> through microlink.io. The free plan only allows a few requests a day.
async function ogFetchHead(url) {
  const query = new URLSearchParams({ url, meta: 'false', 'data.head.selector': 'head', 'data.head.attr': 'html' });
  let response, body;
  try {
    response = await fetch(`https://api.microlink.io/?${query}`);
    body = await response.json();
  } catch {
    if (response?.status === 429) throw new Error('The free checks for today are used up. Try again tomorrow, or paste the page source below.');
    throw new Error('Could not reach the checking service. Check your connection, or paste the page source below.');
  }
  if (response.status === 429) throw new Error('The free checks for today are used up. Try again tomorrow, or paste the page source below.');
  if (body.status !== 'success' || !body.data?.head) throw new Error('That page could not be read. It may be private or block automated visits. You can paste its source below.');
  return `<html><head>${body.data.head}</head></html>`;
}

const ogHeading = (text) => h('div', { class: 'panel-head' }, h('h2', {}, text));

tool({
  id: 'og-image',
  cat: 'generate',
  name: 'Open Graph images',
  desc: 'Check the picture a link shows when it is shared, or make your own.',
  intro: 'Check what a website shows when its link is shared, or make a share image for your own page.',
  keywords: 'open graph og image social share preview card meta tags twitter x facebook linkedin whatsapp discord link preview checker',
  mount(root) {
    const { work, side } = layout(root);
    const makeView = h('div', { class: 'og-view' });
    const checkView = h('div', { class: 'og-view' });

    function setMode(mode) {
      makeView.hidden = mode !== 'make';
      checkView.hidden = mode !== 'check';
      side.hidden = mode !== 'make';   // the design options belong to the image only
      side.parentElement.classList.toggle('og-single', mode !== 'make');
      modeSwitch.set(mode, false);
    }
    const modeSwitch = segmented([['check', 'Check a website'], ['make', 'Make an image']], 'check', setMode, 'What do you want to do?');
    modeSwitch.classList.add('og-mode');
    root.insertBefore(modeSwitch, root.firstChild);

    // ---------- Make an image ----------

    const canvas = h('canvas', { class: 'og-canvas', width: OG_W, height: OG_H, role: 'img', 'aria-label': 'Preview of your share image' });
    ogZoomable(canvas, 'Show your share image larger', () => h('img', { class: 'og-canvas', src: canvas.toDataURL('image/png'), alt: 'Your share image' }));
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

    const makeCards = ogCards();
    const tagsOut = textArea({ readOnly: true, rows: 9, class: 'input og-tags', 'aria-label': 'Meta tags for your page' });
    const copyTags = button('Copy tags', () => copyText(tagsOut.value, 'Tags copied'), 'small');
    const lengthNote = h('p', { class: 'note' });

    const values = () => ({
      title: title.value.trim(),
      desc: desc.value.trim(),
      site: site.value.trim() || ogHost(url.value.trim()),
      url: url.value.trim(),
      imageUrl: imageUrl.value.trim(),
    });

    const refreshCards = debounce(() => makeCards.setImage(canvas.toDataURL('image/jpeg', 0.8)), 150);

    function redraw() {
      const v = values();
      const shownTitle = v.title || 'What the page is about';
      ogRender(canvas, { title: shownTitle, desc: v.desc, site: v.site, layout: style.value, bg: bg.value, accent: accent.value, img: photo });
      refreshCards();
      makeCards.setText({ title: shownTitle, desc: v.desc, site: v.site });

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
      const blob = await canvasToBlob(canvas, `image/${format.value}`, 0.9);
      downloadBlob(blob, `${fileName()}.${format.value === 'jpeg' ? 'jpg' : 'png'}`);
      toast(`Saved, ${formatBytes(blob.size)}`);
    }), 'primary');
    const copy = button('Copy image', () => busy(copy, async () => {
      try {
        await navigator.clipboard.write([new ClipboardItem({ 'image/png': canvasToBlob(canvas, 'image/png') })]);
        toast('Image copied');
      } catch { toast('Copying images is blocked here. Download it instead.'); }
    }), 'quiet small');

    makeView.append(
      h('div', { class: 'panel og-form' },
        ogHeading('1. Write your text'),
        field('Title', title, { value: titleCount }),
        field('Description', desc, { value: descCount }),
        field('Site name', site, { hint: 'Shown at the bottom of the image.' }),
        lengthNote,
      ),
      ogHeading('2. See your image'),
      h('div', { class: 'code-preview og-stage' }, canvas),
      makeCards.el,
      h('p', { class: 'note' }, 'Click a preview to see it larger. Every app draws these a little differently, so treat them as a close guess.'),
      h('div', { class: 'panel og-form' },
        ogHeading('3. Add it to your page'),
        h('p', { class: 'note' }, 'Upload the image to your website, fill in both addresses, and paste the tags into your page\'s <head>.'),
        field('Page address', url),
        field('Address of the image', imageUrl, { hint: 'It has to be a full https:// address.' }),
        ogGroup('Tags', tagsOut),
        h('div', { class: 'row' }, copyTags),
      ),
    );
    side.append(
      ogHeading('Design your image'),
      ogGroup('Layout', style),
      ogGroup('Colours', h('div', { class: 'row' }, bg, h('span', { class: 'note' }, 'background'), accent, h('span', { class: 'note' }, 'accent'))),
      ogGroup('Image', [zone, removePhoto]),
      ogGroup('File format', format, 'JPG keeps photos small. Stay under 5 MB so every app accepts it.'),
      actions(save, copy),
    );

    // ---------- Check a website ----------

    const address = textInput({
      type: 'url', inputmode: 'url', autocomplete: 'off', placeholder: 'https://example.com',
      oninput: () => { addressProblem.hidden = true; checkBtn.disabled = !shortNormalize(address.value); },
      onblur: () => { addressProblem.hidden = !address.value.trim() || !!shortNormalize(address.value); },
      onkeydown: (e) => { if (e.key === 'Enter' && !checkBtn.disabled) checkBtn.click(); },
    });
    const addressProblem = h('p', { class: 'field-hint short-problem', hidden: true }, 'That does not look like a web address. It should look like example.com/page.');
    const report = h('div', { class: 'og-view' });

    function showReport(html, { pageUrl = '', loadNow = false } = {}) {
      const tags = ogReadTags(html);
      const shown = {
        title: tags.title || tags.plainTitle || 'No title',
        desc: tags.desc || tags.plainDesc,
        url: tags.url || tags.canonical || pageUrl,
      };
      shown.site = tags.site || ogHost(shown.url);
      const problems = ogReport(tags);
      const canLoad = /^https:\/\//i.test(tags.image);

      const cards = ogCards();
      cards.setText(shown);
      cards.setImage(canLoad && loadNow ? tags.image : '', canLoad ? 'Image not loaded yet' : 'No image');
      const loadImageBtn = button('Load the page\'s image', () => {
        cards.setImage(tags.image);
        loadImageBtn.hidden = true;
      }, 'small');

      const reuse = button('Make a new image with this text', () => {
        title.value = tags.title || tags.plainTitle;
        desc.value = shown.desc;
        site.value = shown.site;
        url.value = shown.url;
        imageUrl.value = '';
        redraw();
        setMode('make');
        modeSwitch.scrollIntoView({ block: 'nearest' });
      }, 'small');

      report.replaceChildren(
        ogHeading('What this page shows'),
        problems.length
          ? h('div', { class: 'error-box' }, h('strong', {}, plural(problems.length, 'thing'), ' to fix'), h('ul', {}, problems.map((p) => h('li', {}, p))))
          : h('p', { class: 'note' }, 'All the main tags are there.'),
        cards.el,
        h('p', { class: 'note' }, 'Click a preview to see it larger.'),
        h('div', { class: 'row' }, canLoad && !loadNow ? loadImageBtn : null, reuse),
      );
    }

    const checkBtn = button('Check website', () => busy(checkBtn, async () => {
      const page = shortNormalize(address.value);
      report.replaceChildren();
      fallback.hidden = true;
      try {
        showReport(await ogFetchHead(page), { pageUrl: page, loadNow: true });
      } catch (err) {
        report.replaceChildren(h('div', { class: 'error-box' }, err.message));
        fallback.hidden = false;
      }
    }), 'primary');
    checkBtn.disabled = true;

    // Only offered when the link did not work
    const source = textArea({ placeholder: '<!doctype html>…', style: { minHeight: '120px' } });
    const fallback = h('div', { class: 'panel og-form', hidden: true },
      ogHeading('Paste the page source instead'),
      h('p', { class: 'note' }, 'Open the website on a computer, press Ctrl+U (⌥⌘U on a Mac), copy everything and paste it here. This stays on your device.'),
      field('Page source', source),
      h('div', { class: 'row' }, button('Check this source', () => {
        const html = source.value.trim();
        if (!html.includes('<')) { toast('Paste the page source first.'); return; }
        showReport(html);
      }, 'small')),
    );

    checkView.append(
      h('div', { class: 'panel og-form' },
        h('div', { class: 'field' }, field('Website address', address), addressProblem),
        h('p', { class: 'note' }, 'This goes online: the address is sent to microlink.io, which reads the page, and the page\'s image loads from its website. Only a few checks a day are free.'),
        h('div', { class: 'row' }, checkBtn),
      ),
      report,
      fallback,
    );

    work.append(makeView, checkView);
    setMode('check');
    redraw();
    // Canvas text only uses a web font once it has loaded
    Promise.all([document.fonts.load(`700 84px ${OG_SANS}`), document.fonts.load(`400 34px ${OG_SANS}`), document.fonts.load(`500 26px ${OG_MONO}`)])
      .then(redraw, () => {});

    return () => document.querySelector('.og-zoom')?.remove();
  },
});
