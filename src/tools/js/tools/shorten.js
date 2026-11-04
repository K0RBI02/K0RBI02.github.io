// Short links through is.gd. A static site cannot redirect anything itself, so this is the second
// tool that goes online: the address you shorten is sent to is.gd, and only when you press the button.

const SHORT_API = 'https://is.gd/create.php';
const SHORT_ALIAS = /^[A-Za-z0-9_]{5,30}$/;

// Accepts "example.com/page" too. Returns a full http(s) address, or '' if it is not one.
function shortNormalize(text) {
  const value = text.trim();
  if (!value || /\s/.test(value)) return '';
  try {
    const url = new URL(/^[a-z][a-z0-9+.-]*:/i.test(value) && !/^[^/:]+:\d/.test(value) ? value : `https://${value}`);
    return /^https?:$/.test(url.protocol) && url.hostname.includes('.') ? url.href : '';
  } catch { return ''; }
}

function shortError(code, message) {
  if (code === 2) return 'That ending is taken or not allowed. Try a different one.';
  if (code === 3) return 'is.gd is getting too many requests from you. Wait a minute and try again.';
  if (code === 1) return message || 'is.gd did not accept that address. Check it and try again.';
  return 'is.gd could not make the link right now. Try again in a moment.';
}

async function shortCreate(url, alias) {
  const query = new URLSearchParams({ format: 'json', url });
  if (alias) query.set('shorturl', alias);
  let data;
  try {
    const response = await fetch(`${SHORT_API}?${query}`);
    data = await response.json();
  } catch {
    throw new Error('Could not reach is.gd. Check your connection and try again.');
  }
  if (!data.shorturl) throw new Error(shortError(data.errorcode, data.errormessage));
  return data.shorturl;
}

tool({
  id: 'short-url',
  cat: 'generate',
  name: 'Short links',
  desc: 'Turn a long address into a short link.',
  intro: 'Paste an address and get a short link from is.gd. No account needed, and the link does not expire.',
  keywords: 'url shortener short link shorten tiny address is.gd',
  mount(root) {
    const { work, side } = layout(root);
    const url = textInput({
      type: 'url', inputmode: 'url', autocomplete: 'off', placeholder: 'https://example.com/a/very/long/address',
      oninput: () => { problem.hidden = true; refresh(); },
      onblur: () => { problem.hidden = !url.value.trim() || !!shortNormalize(url.value); },
      onkeydown: (e) => { if (e.key === 'Enter' && !make.disabled) make.click(); },
    });
    const alias = textInput({
      autocomplete: 'off', placeholder: 'my_link',
      oninput: () => { aliasProblem.hidden = true; refresh(); },
      onblur: () => { aliasProblem.hidden = !alias.value.trim() || SHORT_ALIAS.test(alias.value.trim()); },
    });
    const problem = h('p', { class: 'field-hint short-problem', hidden: true }, 'That does not look like a web address. It should look like example.com/page.');
    const aliasProblem = h('p', { class: 'field-hint short-problem', hidden: true }, 'Use 5 to 30 letters, numbers or underscores.');
    const result = h('div', { class: 'short-result', 'aria-live': 'polite' });

    function refresh() {
      const aliasValue = alias.value.trim();
      make.disabled = !shortNormalize(url.value) || (aliasValue && !SHORT_ALIAS.test(aliasValue));
    }

    const make = button('Shorten link', () => busy(make, async () => {
      const long = shortNormalize(url.value);
      result.replaceChildren();
      try {
        const short = await shortCreate(long, alias.value.trim());
        result.replaceChildren(copyRow(short, 'Short link'), h('p', { class: 'note' }, 'Leads to ', h('span', { class: 'short-target' }, long)));
      } catch (err) {
        result.replaceChildren(h('div', { class: 'error-box' }, err.message));
      }
    }), 'primary');

    work.append(
      h('div', { class: 'panel og-form' },
        h('div', { class: 'field' }, field('Long address', url), problem),
        h('div', { class: 'field' }, field('Custom ending (optional)', alias, { hint: 'is.gd/my_link instead of random letters.' }), aliasProblem),
        h('p', { class: 'note' }, 'This tool goes online: the address is sent to is.gd when you press the button, and it stays there. Short links are public and cannot be changed or deleted, so leave out private addresses.'),
      ),
      result,
    );
    side.append(
      actions(make),
    );
    refresh();
  },
});
