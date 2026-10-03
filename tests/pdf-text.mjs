import { inflateSync } from 'node:zlib';

// Test-only extraction of the renderer's embedded-font PDF streams. Not a general PDF parser.
export function pdfText(buffer) {
  const source = buffer.toString('latin1');
  const objects = new Map([...source.matchAll(/(\d+) 0 obj([\s\S]*?)endobj/g)].map(match => [match[1], match[2]]));
  const streams = new Map();
  for (const [id, object] of objects) {
    const start = object.match(/stream\r?\n/);
    const length = object.match(/\/Length (\d+)( 0 R)?/);
    const size = length && Number(length[2] ? objects.get(length[1])?.trim() : length[1]);
    if (start && size && object.includes('/FlateDecode')) streams.set(id, inflateSync(Buffer.from(object.slice(start.index + start[0].length, start.index + start[0].length + size), 'latin1')).toString());
  }
  const fonts = new Map();
  for (const [id, object] of objects) {
    const reference = object.match(/\/ToUnicode (\d+) 0 R/);
    if (!reference) continue;
    const map = new Map();
    for (const range of (streams.get(reference[1]) || '').matchAll(/<([a-f\d]+)>\s*<[a-f\d]+>\s*\[([^\]]+)\]/gi)) {
      let glyph = parseInt(range[1], 16);
      for (const value of range[2].matchAll(/<([a-f\d]+)>/gi)) {
        const units = value[1].match(/.{4}/g).map(unit => parseInt(unit, 16));
        map.set(glyph++, String.fromCharCode(...units));
      }
    }
    fonts.set(id, map);
  }
  const resources = new Map([...source.matchAll(/\/(F\d+) (\d+) 0 R/g)].map(match => [match[1], fonts.get(match[2])]));
  let text = '';
  for (const stream of streams.values()) {
    if (!/\bBT\b/.test(stream)) continue;
    let font;
    for (const token of stream.matchAll(/\/(F\d+) [\d.]+ Tf|<([a-f\d]+)>|\bET\b/gi)) {
      if (token[1]) font = resources.get(token[1]);
      else if (token[2]) for (const glyph of token[2].match(/.{4}/g) || []) text += font?.get(parseInt(glyph, 16)) || '';
      else text += '\n';
    }
  }
  return text;
}
