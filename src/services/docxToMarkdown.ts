// No static imports; this module uses dynamic imports to keep initial bundle small

/**
 * DOCX to Markdown conversion service.
 *
 * All heavy business logic and dynamic imports live here to keep UI components lean and testable.
 */

export interface ConvertOptions {
  /** Inline images as data URLs in Markdown. Default: true */
  inlineImages?: boolean;
  /** Optional Mammoth style map overrides. */
  styleMap?: string[];
}

let loaded = false;

// Structural types (kept local to avoid adding .d.ts files)
type MammothImageEl = { read: (type: string) => Promise<string>; contentType: string };
type MammothModule = {
  convertToHtml: (
    input: { arrayBuffer: ArrayBuffer },
    options?: { styleMap?: string[]; convertImage?: unknown },
  ) => Promise<{ value: string }>;
  images: { inline: (handler: (el: MammothImageEl) => Promise<{ src: string }>) => unknown };
};
type TurndownCtor = new (options?: unknown) => { turndown: (html: string) => string };

let mammothMod: MammothModule | undefined;
let TurndownServiceCtor: TurndownCtor | undefined;

/**
 * Loads browser-friendly modules on-demand (cached after first call).
 */
export async function ensureLoaded(): Promise<boolean> {
  if (loaded) return true;
  try {
    const m = (await import('mammoth')) as unknown as { default?: MammothModule } & MammothModule;
    mammothMod = (m as { default?: MammothModule } & MammothModule).default ?? m;
  } catch {
    loaded = false;
    return false;
  }
  try {
    const t = (await import('turndown')) as unknown as { default?: TurndownCtor } & TurndownCtor;
    TurndownServiceCtor = (t as { default?: TurndownCtor } & TurndownCtor).default ?? t;
  } catch {
    loaded = false;
    return false;
  }
  loaded = !!mammothMod && !!TurndownServiceCtor;
  return loaded;
}

/**
 * Returns whether dependencies are ready.
 */
export function isReady(): boolean {
  return loaded;
}

/**
 * Convert a DOCX ArrayBuffer to Markdown.
 */
export async function convertDocxArrayBufferToMarkdown(
  arrayBuffer: ArrayBuffer,
  opts: ConvertOptions = {},
): Promise<string> {
  if (!loaded) {
    const ok = await ensureLoaded();
    if (!ok) throw new Error('Conversion dependencies are not available.');
  }

  if (!mammothMod || !TurndownServiceCtor) {
    throw new Error('Conversion dependencies are not available.');
  }

  const styleMap: string[] = opts.styleMap ?? [
    'p[style-name="Title"] => h1:fresh',
    'p[style-name="Subtitle"] => h2:fresh',
  ];

  const result = await mammothMod.convertToHtml(
    { arrayBuffer },
    {
      styleMap,
      convertImage:
        (opts.inlineImages ?? true)
          ? mammothMod.images.inline(async (element: MammothImageEl) => {
              const buffer = await element.read('base64');
              const contentType = element.contentType;
              return { src: `data:${contentType};base64,${buffer}` };
            })
          : undefined,
    },
  );

  const html: string = result?.value ?? '';
  const turndown = new TurndownServiceCtor({
    headingStyle: 'atx',
    codeBlockStyle: 'fenced',
    emDelimiter: '*',
  });
  return turndown.turndown(html);
}

/**
 * Convenience wrapper to convert a File to Markdown.
 */
export async function convertDocxFileToMarkdown(
  file: File,
  opts?: ConvertOptions,
): Promise<string> {
  const buffer = await file.arrayBuffer();
  return convertDocxArrayBufferToMarkdown(buffer, opts);
}
