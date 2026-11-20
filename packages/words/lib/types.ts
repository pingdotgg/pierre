/** Options for the HTML renderer. */
export interface RenderOptions extends HtmlSessionOptions {
  skipHtml?: boolean;
  /**
   * Parse a leading YAML frontmatter block. The return value becomes
   * `[meta, output]`, where `meta` is `null` when the input has no frontmatter.
   */
  frontmatter?: boolean;
}

/** Parsed YAML frontmatter: usually a mapping, but any JSON value. */
export type Frontmatter =
  | { [key: string]: Frontmatter }
  | Frontmatter[]
  | string
  | number
  | boolean
  | null;

/** Options for the terminal renderer. */
export interface AnsiOptions {
  /** Wrap text at this column. With 0, the default, the terminal wraps it. */
  width?: number;
  /**
   * Let `*` and `~` emphasis open and close next to Chinese, Japanese, and
   * Korean text, as markdown-cjk-friendly does.
   */
  cjk?: boolean;
  /**
   * Read `$…$`, `$$…$$`, `$$` blocks, and `math` code blocks as math. The
   * terminal shows their TeX source.
   */
  math?: boolean;
}

/** Options for incremental HTML rendering. */
export interface HtmlSessionOptions {
  /** Complete common unfinished inline syntax. */
  incomplete?: boolean;
  /**
   * Let `*` and `~` emphasis open and close next to Chinese, Japanese, and
   * Korean text, as markdown-cjk-friendly does.
   */
  cjk?: boolean;
  /** Render `$…$`, `$$…$$`, `$$` blocks, and `math` code blocks as SVG. */
  math?: boolean;
  /**
   * With `math`, also read `\(…\)` as inline math and `\[…\]` as display
   * math, inline or as a block, as micromark-extension-llm-math does. A pipe
   * inside a table cell's math stays in the cell, as T3 Code's patched
   * micromark-extension-gfm-table keeps it.
   */
  texDelimiters?: boolean;
  /**
   * End ASCII bare URLs before CJK and Arabic punctuation (so surrounding
   * emphasis closes), allow `www.` after such punctuation, and keep trailing
   * `_` and `~` on bare URLs when they do not close emphasis or strikethrough.
   */
  autolinkBoundaries?: boolean;
  /**
   * With `false`, only a run of exactly two tildes is a strikethrough
   * delimiter, as remark-gfm's `singleTilde: false`. Defaults to `true`.
   */
  singleTilde?: boolean;
  /**
   * Keep the backslashes of Windows drive paths: a link, image, or definition
   * destination such as `C:\me\.t3\a.png` keeps every backslash, and in prose
   * an escape keeps its backslash while the word before it is a drive path.
   */
  windowsPaths?: boolean;
  /** Put the info string after a fenced code block's language on `<code>` as `data-meta`. */
  codeMeta?: boolean;
  /**
   * Add `data-sourcepos="start-end"`, UTF-8 byte offsets into the input with
   * an exclusive end, to list items, links, images, and directives.
   */
  sourcePositions?: boolean;
  /** Write raw HTML as escaped text, as remark-rehype without rehype-raw shows it. */
  escapeHtml?: boolean;
  /**
   * Keep the spaces and tabs typed at the start of each line of a paragraph
   * past its block quote markers and list item indentation, which CommonMark
   * drops, as `<span data-leading-whitespace="">` before the line's content.
   * `indent` is how many columns every line is already indented, as for
   * content cut out of an over-indented list item.
   */
  leadingWhitespace?: boolean | { readonly indent: number };
  /**
   * Names of the remark-directive text (`:name[label]{attrs}`) and leaf
   * (`::name[label]{attrs}`) directives to render, as
   * `<span>`/`<div data-directive="name" data-attributes="{JSON}">`.
   */
  directives?: readonly string[];
}

/** The result of one session render. */
export interface HtmlUpdate {
  /** Full output, built on first read. */
  html: string;
  /** HTML of completed blocks. */
  stable: string;
  /** HTML completed since the previous revision. */
  addition: string;
  /** HTML that can still change. */
  pending: string;
  /** The previous `stable` is no longer valid. */
  reset: boolean;
  /** Output version. After a skipped revision, use `stable` instead of `addition`. */
  revision: number;
}
