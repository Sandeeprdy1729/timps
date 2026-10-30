/**
 * HTML text helpers shared by the desktop plugins.
 *
 * Both are single-pass: entity decoding is done once so `&amp;lt;` stays the
 * literal text `&lt;`, and tags are removed by walking the string rather than
 * re-replacing regex matches (which could leave a new `<...>` behind).
 */

const NAMED_ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
  ndash: '–',
  mdash: '—',
  hellip: '…',
  lsquo: '‘',
  rsquo: '’',
  ldquo: '“',
  rdquo: '”',
  copy: '©',
  reg: '®',
  trade: '™',
};

/** Decode HTML entities in one left-to-right pass. */
export function decodeHtmlEntities(input: string): string {
  let out = '';
  let i = 0;
  while (i < input.length) {
    const amp = input.indexOf('&', i);
    if (amp === -1) {
      out += input.slice(i);
      break;
    }
    out += input.slice(i, amp);
    const semi = input.indexOf(';', amp + 1);
    const entity = semi === -1 || semi - amp > 12 ? '' : input.slice(amp + 1, semi);
    if (!entity) {
      out += '&';
      i = amp + 1;
      continue;
    }
    const named = NAMED_ENTITIES[entity.toLowerCase()];
    if (named !== undefined) {
      out += named;
      i = semi + 1;
      continue;
    }
    if (entity.startsWith('#')) {
      const hex = entity[1] === 'x' || entity[1] === 'X';
      const code = Number.parseInt(entity.slice(hex ? 2 : 1), hex ? 16 : 10);
      if (Number.isFinite(code) && code > 0 && code <= 0x10ffff) {
        out += String.fromCodePoint(code);
        i = semi + 1;
        continue;
      }
    }
    out += '&';
    i = amp + 1;
  }
  return out;
}

/** Remove all `<...>` tags in a single pass. */
export function stripHtmlTags(html: string): string {
  let out = '';
  let i = 0;
  while (i < html.length) {
    const lt = html.indexOf('<', i);
    if (lt === -1) {
      out += html.slice(i);
      break;
    }
    out += html.slice(i, lt);
    const gt = html.indexOf('>', lt + 1);
    if (gt === -1) {
      out += html.slice(lt);
      break;
    }
    i = gt + 1;
  }
  return out;
}
