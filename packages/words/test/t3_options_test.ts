import assert from 'node:assert/strict';
import test from 'node:test';

import { createHtmlRenderer } from '../dist/html.js';
import {
  createHtmlSession,
  type RenderOptions,
  renderToHtml,
} from '../dist/index.js';

const dec = new TextDecoder();
const html = (
  md: string,
  options: RenderOptions & { frontmatter?: false } = {}
) => dec.decode(renderToHtml(md, options));
const complete = (md: string, options?: RenderOptions) =>
  createHtmlSession().render(md, { ...options, incomplete: true }).html;

void test('singleTilde: false strikes only runs of two tildes', () => {
  const off = { singleTilde: false };
  assert.equal(
    html('~/path, ~one~ and ~~two~~ ~~~three~~~', off),
    '<p>~/path, ~one~ and <del>two</del> ~~~three~~~</p>\n'
  );
  assert.equal(html('~one~ ~a~~', off), '<p>~one~ ~a~~</p>\n');
  assert.equal(html('~~a~', off), '<p>~~a~</p>\n');
  assert.equal(html('~one~'), '<p><del>one</del></p>\n');
  assert.equal(html('~one~', { singleTilde: true }), '<p><del>one</del></p>\n');
  // completion closes only what the parser can strike
  assert.equal(complete('~~two', off), '<p><del>two</del></p>\n');
  assert.equal(complete('~one', off), '<p>~one</p>\n');
  assert.equal(complete('a ~one', { incomplete: true }), '<p>a ~one</p>\n');
});

void test('windowsPaths keeps the backslashes of drive path destinations', () => {
  const on = { windowsPaths: true };
  assert.equal(
    html(String.raw`[x](C:\me\.t3\a.png) [y](C:/a\_b) [z](\\host\.x)`, on),
    '<p><a href="C:%5Cme%5C.t3%5Ca.png">x</a> <a href="C:/a%5C_b">y</a> ' +
      '<a href="%5Chost.x">z</a></p>\n'
  );
  assert.equal(
    html(String.raw`[x](C:\me\.t3\a.png)`),
    '<p><a href="C:%5Cme.t3%5Ca.png">x</a></p>\n'
  );
  // entity references still decode once
  for (const prefix of ['', '!']) {
    assert.match(
      html(`${prefix}[s](<C:\\R&amp;D folder\\.t3\\s.png>)`, on),
      /="C:%5CR&amp;D%20folder%5C.t3%5Cs.png"/
    );
  }
  assert.equal(
    html('[r]\n\n[r]: <C:\\work\\&amp;lt;\\.t3\\s.png>', on),
    '<p><a href="C:%5Cwork%5C&amp;lt;%5C.t3%5Cs.png">r</a></p>\n'
  );
});

void test('windowsPaths keeps escapes inside prose drive paths', () => {
  const on = { windowsPaths: true };
  assert.equal(
    html(String.raw`C:\Users\me\.t3 and "C:\" and C:\x and \*this\*`, on),
    String.raw`<p>C:\Users\me\.t3 and &quot;C:\&quot; and C:\x and *this*</p>` +
      '\n'
  );
  assert.equal(
    html(
      String.raw`one\_two C:\a\_b \*x\* *em*E:\e\_f \*z\* x:\\y a:\&amp;`,
      on
    ),
    String.raw`<p>one_two C:\a\_b *x* <em>em</em>E:\e\_f *z* x:\\y a:\&amp;amp;</p>` +
      '\n'
  );
  // a word character before the letter, or another word, is no drive
  assert.equal(
    html(String.raw`ab:\_c C: \_d`, on),
    String.raw`<p>ab:_c C: _d</p>` + '\n'
  );
  for (const space of [' ', '\t', '\u00a0', '\u2003', '\u202f', '\ufeff']) {
    assert.equal(
      html(String.raw`C:\me\_b${space}\*x\*`, on),
      String.raw`<p>C:\me\_b${space}*x*</p>` + '\n'
    );
  }
  assert.equal(
    html(String.raw`C:\Users\me\.t3`),
    String.raw`<p>C:\Users\me.t3</p>` + '\n'
  );
});

void test('codeMeta puts the info string after the language on <code>', () => {
  const on = { codeMeta: true };
  const source = '```ts  title="x" \\* &amp;  \n1\n```\n\n```ts\n2\n```\n';
  assert.equal(
    html(source, on),
    '<pre><code class="language-ts" data-meta="title=&quot;x&quot; * &amp;">1\n' +
      '</code></pre>\n<pre><code class="language-ts">2\n</code></pre>\n'
  );
  assert.doesNotMatch(html(source), /data-meta/);
  assert.match(
    createHtmlSession().render('```ts title="x"\n1', on).html,
    /<code class="language-ts" data-meta="title=&quot;x&quot;">/
  );
  const formatted = createHtmlRenderer(on).render(source, false).html;
  assert.match(
    formatted,
    /<code data-markdown="code" class="language-ts" data-meta="title=&quot;x&quot; \* &amp;">/
  );
  assert.equal(formatted.match(/data-meta/g)?.length, 1);
});

/** Each element with a source position, and the source bytes it covers. */
function spans(source: string, output: string): string[] {
  const bytes = new TextEncoder().encode(source);
  return [...output.matchAll(/<(\w+)[^>]*?data-sourcepos="(\d+)-(\d+)"/g)].map(
    ([, tag, start, end]) =>
      `${tag} ${dec.decode(bytes.slice(Number(start), Number(end)))}`
  );
}

void test('sourcePositions marks list items, links, images, and code', () => {
  const on = { sourcePositions: true };
  const source = [
    '- ü [l](u) <http://x.y> www.z.com ![i](p "t") [r]',
    '- b',
    '',
    '  ```js',
    '  x',
    '  ```  ',
    '- # h ##',
    '> 1. q',
    '>    lazy',
    '',
    '[r]: /v',
    '',
    '|[a](b) \\| [c](d)|',
    '|-|',
    '',
    '-',
    '',
    '    indented',
    '    code',
    '',
    '```',
    'open',
  ].join('\n');
  assert.deepEqual(spans(source, html(source, on)), [
    'li - ü [l](u) <http://x.y> www.z.com ![i](p "t") [r]',
    'a [l](u)',
    'a <http://x.y>',
    'a www.z.com',
    'img ![i](p "t")',
    'a [r]',
    'li - b\n\n  ```js\n  x\n  ```  ',
    'pre ```js\n  x\n  ```  ',
    'li - # h ##',
    'li 1. q\n>    lazy',
    'a [a](b)',
    'a [c](d)',
    'li -',
    'pre     indented\n    code',
    'pre ```\nopen',
  ]);
  assert.doesNotMatch(html(source), /data-sourcepos/);
  // raw HTML passes through untouched
  assert.equal(html('<a href="x">y</a>', on), '<p><a href="x">y</a></p>\n');
});

void test('sourcePositions count from the start of a session', () => {
  const on = { sourcePositions: true };
  const source =
    'ü [a](b)\n\n- x [c](d)\n\nmore\n\n```ts\nline\n```\n\nend [e](f)\n';
  const session = createHtmlSession();
  let last = '';
  for (let i = 1; i <= source.length; i++)
    last = session.render(source.slice(0, i), on).html;
  assert.equal(last, html(source, on));
  // an open fence grows its position as it streams
  const fence = createHtmlSession();
  fence.render('```\na', on);
  assert.deepEqual(spans('```\nab', fence.render('```\nab', on).html), [
    'pre ```\nab',
  ]);
  const formatted = createHtmlRenderer(on).render(source, false).html;
  assert.deepEqual(spans(source, formatted), spans(source, last));
});

const attributes = (output: string): unknown[] =>
  [...output.matchAll(/data-attributes="([^"]*)"/g)].map(([, value]) =>
    JSON.parse(
      value
        .replaceAll('&quot;', '"')
        .replaceAll('&lt;', '<')
        .replaceAll('&gt;', '>')
        .replaceAll('&amp;', '&')
    )
  );

void test('directives renders the listed text and leaf directives', () => {
  const on = {
    directives: ['codex-file-citation', 'codex-followup', 'artifact-template'],
  };
  assert.equal(
    html(
      'See :codex-file-citation[**a** `b`]{path="/a/b.ts" line_start="3" line_end="5"} ' +
        'and :codex-followup[Do it]{prompt="Run the tests"}.',
      on
    ),
    '<p>See <span data-directive="codex-file-citation" data-attributes="' +
      '{&quot;path&quot;:&quot;/a/b.ts&quot;,&quot;line_start&quot;:&quot;3&quot;,' +
      '&quot;line_end&quot;:&quot;5&quot;}"><strong>a</strong> <code>b</code></span> ' +
      'and <span data-directive="codex-followup" data-attributes="' +
      '{&quot;prompt&quot;:&quot;Run the tests&quot;}">Do it</span>.</p>\n'
  );
  assert.equal(
    html(
      'para\n::artifact-template{name="x" kind="y"}  \n- ::artifact-template[*l*]',
      on
    ),
    '<p>para</p>\n<div data-directive="artifact-template" data-attributes="' +
      '{&quot;name&quot;:&quot;x&quot;,&quot;kind&quot;:&quot;y&quot;}"></div>\n' +
      '<ul>\n<li>\n<div data-directive="artifact-template" data-attributes="{}">' +
      '<em>l</em></div>\n</li>\n</ul>\n'
  );
  // unlisted names, other text after a leaf, and the option off stay text
  for (const source of [
    ':other[a] ::artifact-template',
    '::artifact-template{name="x"} trailing',
    'a::codex-followup 10:30',
  ])
    assert.equal(
      html(source, on),
      `<p>${source.replaceAll('"', '&quot;')}</p>\n`
    );
  assert.equal(
    html(':codex-followup[a]{b="c"}'),
    '<p>:codex-followup[a]{b=&quot;c&quot;}</p>\n'
  );
});

void test('directives parse attributes and labels as remark-directive does', () => {
  const on = { directives: ['x'] };
  const output = html(
    ':x :x{a=1 b} :x{ c = "2" } :x{q=\'it"s &amp; <b>\'} :x{n="d\ne\u0001"} :x{bad"} :x[open',
    on
  );
  assert.deepEqual(attributes(output), [
    {},
    { a: '1', b: '' },
    { c: '2' },
    { q: 'it"s & <b>' },
    { n: 'd\ne\u0001' },
    {},
    {},
  ]);
  assert.match(output, /<\/span>\{bad&quot;\} <span[^>]*><\/span>\[open<\/p>/);
  // a label may hold brackets and links, but a name ends at a letter
  assert.equal(
    html(':x[[n] [l](u)] :xé', on),
    '<p><span data-directive="x" data-attributes="{}">[n] <a href="u">l</a></span> :xé</p>\n'
  );
});

void test('directives carry source positions and stream', () => {
  const on = {
    directives: ['codex-file-citation', 'artifact-template'],
    sourcePositions: true,
  };
  const source =
    'Intro :codex-file-citation[x]{path="/a"} :codex-file-citation\n\n' +
    '::artifact-template{name="x"}\n\nend\n';
  assert.deepEqual(spans(source, html(source, on)), [
    'span :codex-file-citation[x]{path="/a"}',
    'span :codex-file-citation',
    'div ::artifact-template{name="x"}',
  ]);
  for (const incomplete of [false, true]) {
    const session = createHtmlSession();
    let last = '';
    for (let i = 1; i <= source.length; i++)
      last = session.render(source.slice(0, i), { ...on, incomplete }).html;
    assert.equal(last, html(source, on));
  }
  assert.deepEqual(
    spans(source, createHtmlRenderer(on).render(source, false).html),
    spans(source, html(source, on))
  );
});

void test('directive names share the id prefix room', () => {
  const names = ['n'.repeat(200)];
  assert.throws(
    () =>
      createHtmlRenderer({
        idPrefix: 'p'.repeat(4000),
        directives: names,
      }).render(`:${names[0]}`, false),
    RangeError
  );
  // the names change between renders, and a long prefix fits without them
  assert.match(
    html(`:${names[0]}`, { directives: names }),
    /<span data-directive/
  );
  assert.equal(html(':n', { directives: ['m'] }), '<p>:n</p>\n');
  assert.match(
    createHtmlRenderer({ idPrefix: 'p'.repeat(4000) }).render(
      '[^1]\n\n[^1]: x',
      false
    ).html,
    /pppp/
  );
});

void test('escapeHtml writes raw HTML as escaped text', () => {
  const on = { escapeHtml: true };
  assert.equal(
    html('a <b>x</b> & <img src=y onerror=z> `<i>`', on),
    '<p>a &lt;b&gt;x&lt;/b&gt; &amp; &lt;img src=y onerror=z&gt; <code>&lt;i&gt;</code></p>\n'
  );
  assert.equal(
    html('<details>\n<summary>s</summary>\n\n**md**\n</details>', on),
    '&lt;details&gt;\n&lt;summary&gt;s&lt;/summary&gt;\n<p><strong>md</strong></p>\n&lt;/details&gt;\n'
  );
  // autolinks are not raw HTML
  assert.equal(html('<https://a.dev>', on), '<p><a href="https://a.dev">https://a.dev</a></p>\n');
  assert.equal(html('a <b>x</b>'), '<p>a <b>x</b></p>\n');
});

void test('leadingWhitespace keeps what was typed past container structure', () => {
  const on = { leadingWhitespace: true };
  const ws = (s: string) => `<span data-leading-whitespace="">${s}</span>`;
  assert.equal(
    html('Plan\n   one\n\ttab\n \t mixed', on),
    `<p>Plan\n${ws('   ')}one\n${ws('\t')}tab\n${ws(' \t ')}mixed</p>\n`
  );
  assert.equal(html('  First\r\nnext', on), `<p>${ws('  ')}First\nnext</p>\n`);
  assert.equal(
    html('a  \n   hard\\\n  escaped', on),
    `<p>a<br />\n${ws('   ')}hard<br />\n${ws('  ')}escaped</p>\n`
  );
  // only whitespace past each container's own markers and indentation counts
  for (const [source, line] of [
    ['- item\n  continued', 'continued'],
    ['- item\ncontinued', 'continued'],
    ['- item\n continued', 'continued'],
    ['- item\n    more', `${ws('  ')}more`],
    ['- item\n\tsplit', `${ws('  ')}split`],
    ['-\tx\n\t  y', `${ws('  ')}y`],
    ['10.  x\n       y', `${ws('  ')}y`],
    ['-    x\n         y', `${ws('    ')}y`],
    ['- [ ] task\n      under', `${ws('    ')}under`],
    ['> - item\n>     more', `${ws('  ')}more`],
    ['- a\n  - b\n      c', `${ws('  ')}c`],
  ]) {
    assert.ok(html(source, on).includes(`\n${line}</li>`), source);
  }
  assert.equal(html('> a\n>    b', on), `<blockquote>\n<p>a\n${ws('   ')}b</p>\n</blockquote>\n`);
  assert.equal(html('> a\n   lazy', on), '<blockquote>\n<p>a\nlazy</p>\n</blockquote>\n');
  assert.match(html('- > a\n  >    b', on), new RegExp(`<p>a\\n${ws('   ')}b</p>`));
  // converting to HTML trims what follows a line break, which the span replaces
  assert.equal(html('a\n &#32;b', on), `<p>a\n${ws(' ')}b</p>\n`);
  assert.equal(html('a\n   ` npm i`', on), `<p>a\n${ws('   ')}<code>npm i</code></p>\n`);
  assert.equal(
    html('a\n  [ docs](u) **&#32;b**', on),
    `<p>a\n${ws('  ')}<a href="u">docs</a> <strong> b</strong></p>\n`
  );
  // no span where the line still starts with whitespace or a line break
  assert.equal(html('a\n   ***&#32;b***', on), '<p>a\n<em><strong> b</strong></em></p>\n');
  assert.equal(html('  &#32;b', on), '<p> b</p>\n');
  assert.equal(html('a\n  \\\nb', on), '<p>a\n<br />\nb</p>\n');
  // code, headings, footnotes and alert markers keep CommonMark's reading
  assert.equal(html('Plan\n\n    code\n      deeper', on), html('Plan\n\n    code\n      deeper'));
  assert.equal(html('a\n  b\n---', on), '<h2>a\nb</h2>\n');
  assert.doesNotMatch(html('x[^1]\n\n[^1]: a\n    b', on), /leading/);
  assert.equal(
    html('>  [!NOTE]\n>    body', on),
    `<blockquote>\n<p>[!NOTE]\n${ws('   ')}body</p>\n</blockquote>\n`
  );
  // indent: lines already indented, as content cut out of a list item
  assert.equal(
    html('first\n  continued\n    deeper', { leadingWhitespace: { indent: 2 } }),
    `<p>first\ncontinued\n${ws('  ')}deeper</p>\n`
  );
  assert.equal(html('Plan\n   one'), '<p>Plan\none</p>\n');
  const session = createHtmlSession();
  session.render('Plan\n', on);
  assert.equal(session.render('Plan\n   one', on).html, `<p>Plan\n${ws('   ')}one</p>\n`);
  assert.equal(session.render('Plan\n   one').html, '<p>Plan\none</p>\n');
});

void test('texDelimiters reads \\(…\\) and \\[…\\] as math', () => {
  const on = { math: true, texDelimiters: true };
  const formulas = (md: string, options: RenderOptions = on) =>
    [...html(md, options).matchAll(/<svg [^>]*?display:(\w+)[^>]*?aria-label="([^"]*)"/g)].map(
      ([, display, tex]) => `${display}:${tex.trim()}`
    );
  assert.deepEqual(
    formulas('\\[\nE = mc^2\n\\]\n\nand \\(a\\) or \\[b\\] or \\[1, 2\\] inline'),
    ['block:E = mc^2', 'inline:a', 'block:b']
  );
  assert.match(html('\\[1, 2\\] inline', on), /<p>\[1, 2\] inline<\/p>/);
  // a backtick ends the scan; an escaped backslash is content
  assert.deepEqual(formulas('\\(a `b` c\\) \\(x\\\\\\)'), ['inline:x\\\\']);
  assert.deepEqual(formulas('\\\\(a\\)'), []);
  // display blocks: a line ending in `\]` closes, blank lines stay inside
  assert.deepEqual(formulas('p\n\\[\nq\n\\]'), ['block:q']);
  assert.deepEqual(formulas('\\[\nx \\]'), ['block:x']);
  assert.deepEqual(formulas('- \\[\n  a\n\n  b\n  \\]'), ['block:a\n\nb']);
  assert.deepEqual(formulas('> \\[\n> z\n\n> \\]'), []);
  // a pipe in a cell's math stays in the cell
  assert.deepEqual(formulas('| a | b |\n| - | - |\n| $x|y$ | \\(p|q\\) |'), [
    'inline:x|y',
    'inline:p|q',
  ]);
  assert.match(html('| a | b |\n| - | - |\n| `$x|y$` | c |', on), /<td>`\$x<\/td>/);
  // off, or without math, a backslash escapes as before
  for (const options of [{ math: true }, { texDelimiters: true }]) {
    assert.equal(html('\\(a\\) \\[b\\]', options), '<p>(a) [b]</p>\n');
    assert.match(html('| a | b |\n| - | - |\n| $x|y$ | c |', options), /<td>\$x<\/td>/);
  }
});

void test('sourcePositions gives math its whole source range', () => {
  const on = { math: true, texDelimiters: true, sourcePositions: true };
  const source = [
    'é $x$ \\(ü\\) $$y$$',
    '',
    '\\[',
    'k \\]',
    '',
    '$$',
    'm',
    '$$  ',
    '',
    '```math',
    'z',
    '```',
    '',
    '| a |',
    '| - |',
    '| \\(p|q\\) |',
    '',
    '$$',
    'open',
  ].join('\n');
  const output = html(source, on);
  const bytes = new TextEncoder().encode(source);
  assert.deepEqual(
    [...output.matchAll(/<svg [^>]*?data-sourcepos="(\d+)-(\d+)"/g)].map(([, start, end]) =>
      dec.decode(bytes.slice(Number(start), Number(end)))
    ),
    ['$x$', '\\(ü\\)', '$$y$$', '\\[\nk \\]', '$$\nm\n$$  ', '```math\nz\n```', '\\(p|q\\)']
  );
  // With texDelimiters, a math block still open at EOF stays prose (no SVG).
  assert.equal(output.match(/<svg /g)?.length, 7);
  // Without texDelimiters, an open `$$` block still renders without a range.
  const openPlain = html('$$\nopen', { math: true, sourcePositions: true });
  assert.equal(openPlain.match(/<svg /g)?.length, 1);
  assert.doesNotMatch(openPlain, /data-sourcepos/);
  assert.doesNotMatch(html('$x$', { math: true }), /data-sourcepos/);
});

void test('texDelimiters handles blank lines, unclosed blocks, shell vars, code, links, and tables', () => {
  const on = { math: true, texDelimiters: true };
  // Blank lines inside $$ blocks stay inside the formula, unless closing a quote.
  assert.match(html('$$\na = 1 \\\\\n\nb = 2\n$$', on), /^<svg /);
  assert.doesNotMatch(html('> $$\n> a = 1\n\nb = 2\n$$', on), /<svg /);
  // Unclosed $$, \[, and ```math stay prose / code while streaming.
  assert.equal(html('$$\n\\frac{a}{b}', on), '<p>$$\n\\frac{a}{b}</p>\n');
  assert.equal(html('\\[\nx^2\n- y', on), '<p>[\nx^2</p>\n<ul>\n<li>y</li>\n</ul>\n');
  assert.equal(html('```math\nx^2', on), '<pre><code class="language-math">x^2\n</code></pre>\n');
  // Shell variables, adjacent code spans, and links with `$` stay prose.
  for (const prose of [
    'Set $HOME,$PATH and $HOME,${PATH} and $HOME,$(pwd) and $HOME,$? before running.',
    'Pay $5,$10 now.',
  ]) {
    assert.doesNotMatch(html(prose, on), /<svg /, prose);
  }
  assert.equal(
    html('Set $FOO to `$BAR` then $BAZ.', on),
    '<p>Set $FOO to <code>$BAR</code> then $BAZ.</p>\n'
  );
  assert.equal(
    html('Set $TOKEN, then open [users](https://graph.microsoft.com/v1.0/users?$select=id).', on),
    '<p>Set $TOKEN, then open <a href="https://graph.microsoft.com/v1.0/users?$select=id">users</a>.</p>\n'
  );
  assert.equal(
    html('Set $TOKEN, then open <https://graph.microsoft.com/v1.0/users?$select=id>.', on),
    '<p>Set $TOKEN, then open <a href="https://graph.microsoft.com/v1.0/users?$select=id">https://graph.microsoft.com/v1.0/users?$select=id</a>.</p>\n'
  );
  assert.equal(html('Sum $a +\nb$ here.', on), '<p>Sum $a +\nb$ here.</p>\n');
  // Formulas ending in a comma before whitespace or punctuation still parse.
  assert.equal(html('Where $x = 1,$ with $y,$ and $z,$.', on).match(/<svg /g)?.length, 3);
  // Literal `$` in link URLs, code spans, or HTML inside GFM table cells keeps cells intact.
  const literalTable = html(
    '| [a](https://example.com/$x) | `$x` | <span title="$x">a</span> | y$ |\n| --- | --- | --- | --- |',
    on
  );
  assert.match(literalTable, /^<table>/);
  assert.equal(literalTable.match(/<th>/g)?.length, 4);
  assert.doesNotMatch(literalTable, /<svg /);
  const linkMathTable = html(
    '| First | Second |\n| --- | --- |\n| [norm $|x|$](https://example.com/$path) | y$ |',
    on
  );
  assert.match(linkMathTable, /<td>y\$<\/td>/);
  assert.equal(linkMathTable.match(/<svg /g)?.length, 1);
  // Control bytes inside math do not trap with an out-of-bounds table load.
  for (const byte of ['\u0001', '\u0007', '\u001b', '\u001f']) {
    assert.match(html(`Pasted: $a${byte}b + c$`, on), /<svg /);
  }
});

void test('autolinkBoundaries keeps trailing _/~ and stops at CJK/Arabic punctuation', () => {
  const on = { autolinkBoundaries: true };
  const link = (url: string) =>
    `<a href="${/^www\./i.test(url) ? `http://${url}` : url}">${url}</a>`;
  for (const [markdown, expected] of [
    ['See https://x.com/dimasike_ next', `<p>See ${link('https://x.com/dimasike_')} next</p>\n`],
    ['See http://example.com/name__ next', `<p>See ${link('http://example.com/name__')} next</p>\n`],
    ['See https://example.com/name~ next', `<p>See ${link('https://example.com/name~')} next</p>\n`],
    ['See https://example.com/name__~~_. next', `<p>See ${link('https://example.com/name__~~_')}. next</p>\n`],
    ['See www.example.com/name_ next', `<p>See ${link('www.example.com/name_')} next</p>\n`],
    ['*https://x.com/dimasike_*', `<p><em>${link('https://x.com/dimasike_')}</em></p>\n`],
    ['_https://x.com/dimasike_', `<p><em>${link('https://x.com/dimasike')}</em></p>\n`],
    ['__https://x.com/dimasike__', `<p><strong>${link('https://x.com/dimasike')}</strong></p>\n`],
    ['~~https://example.com/name_~~', `<p><del>${link('https://example.com/name_')}</del></p>\n`],
    ['~~https://example.com/name~~', `<p><del>${link('https://example.com/name')}</del></p>\n`],
    ['_https://example.com/name~_', `<p><em>${link('https://example.com/name~')}</em></p>\n`],
    ['foo _bar_ https://x.com/dimasike_', `<p>foo <em>bar</em> ${link('https://x.com/dimasike_')}</p>\n`],
    ['Mail person@example.com_', '<p>Mail person@example.com_</p>\n'],
    ['打开 http://localhost:18780，然后刷新', `<p>打开 ${link('http://localhost:18780')}，然后刷新</p>\n`],
    ['可以看了：**http://localhost:18780**（已重启）。', `<p>可以看了：<strong>${link('http://localhost:18780')}</strong>（已重启）。</p>\n`],
    ['__http://localhost:18780__，*http://localhost:3000*，~~http://localhost:3001~~。',
      `<p><strong>${link('http://localhost:18780')}</strong>，<em>${link('http://localhost:3000')}</em>，<del>${link('http://localhost:3001')}</del>。</p>\n`],
    ['http://a.com。http://b.com，www.c.com、person@example.com。',
      `<p>${link('http://a.com')}。${link('http://b.com')}，${link('www.c.com')}、<a href="mailto:person@example.com">person@example.com</a>。</p>\n`],
    ['「www.example.com」', `<p>「${link('www.example.com')}」</p>\n`],
    ['https://example.com/a_。下一句', `<p>${link('https://example.com/a_')}。下一句</p>\n`],
    ['https://example.com/a.，下一句', `<p>${link('https://example.com/a')}.，下一句</p>\n`],
    ['https://zh.wikipedia.org/wiki/北京（城市）',
      '<p><a href="https://zh.wikipedia.org/wiki/%E5%8C%97%E4%BA%AC%EF%BC%88%E5%9F%8E%E5%B8%82%EF%BC%89">https://zh.wikipedia.org/wiki/北京（城市）</a></p>\n'],
    ['منشور على https://example.com/report، ونسخته', `<p>منشور على ${link('https://example.com/report')}، ونسخته</p>\n`],
    ['هل يعمل **http://localhost:3000**؟ نعم؛ www.example.com۔',
      `<p>هل يعمل <strong>${link('http://localhost:3000')}</strong>؟ نعم؛ ${link('www.example.com')}۔</p>\n`],
  ] as const) {
    assert.equal(html(markdown, on), expected, markdown);
  }
  // Off by default: standard GFM trims trailing `_` and runs past CJK punctuation.
  assert.equal(html('See https://x.com/dimasike_ next'), `<p>See ${link('https://x.com/dimasike')}_ next</p>\n`);
  assert.equal(
    html('打开 http://localhost:18780，然后刷新'),
    '<p>打开 <a href="http://localhost:18780%EF%BC%8C%E7%84%B6%E5%90%8E%E5%88%B7%E6%96%B0">http://localhost:18780，然后刷新</a></p>\n'
  );
  // Session round-trip preserves the flag.
  assert.equal(
    createHtmlSession().render('See https://x.com/dimasike_\n\n', on).html,
    `<p>See ${link('https://x.com/dimasike_')}</p>\n`
  );
});
