import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';

const indexHtmlUrl = new URL('../index.html', import.meta.url);

describe('document shell', () => {
  it('declares a mobile viewport and the required HTML document metadata', async () => {
    const document = await readFile(indexHtmlUrl, 'utf8');

    expect(document).toMatch(/^<!doctype html>/i);
    expect(document).toMatch(/<html lang="en">/i);
    expect(document).toMatch(/<meta charset="UTF-8"\s*\/?>/i);
    expect(document).toMatch(
      /<meta name="viewport" content="width=device-width, initial-scale=1"\s*\/?>/i,
    );
    expect(document).toContain('<title>ArcSyn Shift</title>');
    expect(document).toContain('<div id="root"></div>');
    expect(document).toContain('<script type="module" src="/src/main.tsx"></script>');
  });
});
