import { access, readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';

const webRootUrl = new URL('../', import.meta.url);
const packageJsonUrl = new URL('package.json', webRootUrl);
const logoComponentUrl = new URL('src/features/auth/components/ArcSynLogo.tsx', webRootUrl);
const legacyBrandUrl = new URL('src/features/auth/components/ArcSynBrand.tsx', webRootUrl);
const loginFormUrl = new URL('src/features/auth/components/LoginForm.tsx', webRootUrl);
const loginHeroUrl = new URL('src/features/auth/components/LoginHero.tsx', webRootUrl);
const globalStylesUrl = new URL('src/shared/styles/global.css', webRootUrl);

describe('login logo contract', () => {
  it('declares the official presentations package at the reviewed exact version', async () => {
    const packageJson = JSON.parse(await readFile(packageJsonUrl, 'utf8')) as {
      dependencies?: Record<string, string>;
    };

    expect(packageJson.dependencies?.['@arcsyn-io/presentations']).toBe('0.1.0');
  });

  it('renders only the official bundled image with the accessible name ArcSyn', async () => {
    const component = await readFile(logoComponentUrl, 'utf8');

    expect(component).toContain("import logoSource from '@arcsyn-io/presentations/logo.png';");
    expect(component).toMatch(
      /<img\s+className="arcsyn-logo__image"\s+src=\{logoSource\}\s+alt="ArcSyn"\s*\/>/,
    );
    expect(component).not.toMatch(/from ['"]@arcsyn-io\/presentations['"]/);
    expect(component).not.toMatch(/<svg|data:image|https?:\/\//);
    expect(component).not.toMatch(/alt=""|aria-label=/);
  });

  it('uses ArcSynLogo in both responsive positions and removes the local brand', async () => {
    const [loginForm, loginHero] = await Promise.all([
      readFile(loginFormUrl, 'utf8'),
      readFile(loginHeroUrl, 'utf8'),
    ]);

    for (const consumer of [loginForm, loginHero]) {
      expect(consumer).toContain(
        "import { ArcSynLogo } from '@/features/auth/components/ArcSynLogo';",
      );
      expect(consumer).toContain('<ArcSynLogo />');
      expect(consumer).not.toContain('ArcSynBrand');
    }

    await expect(access(legacyBrandUrl)).rejects.toThrow();
  });

  it('preserves the 52rem handoff and the image proportion', async () => {
    const styles = await readFile(globalStylesUrl, 'utf8');
    const desktopStyles = styles.slice(styles.indexOf('@media (min-width: 52rem)'));

    expect(styles).toMatch(/\.login-hero\s*\{[^}]*display:\s*none;/s);
    expect(styles).toMatch(/\.arcsyn-logo\s*\{[^}]*overflow:\s*hidden;/s);
    expect(styles).toMatch(
      /\.arcsyn-logo__image\s*\{[^}]*block-size:\s*auto;[^}]*display:\s*block;/s,
    );
    expect(styles).not.toMatch(/\.arcsyn-brand(?:__mark)?/);
    expect(desktopStyles).toMatch(/\.login-card__brand\s*\{[^}]*display:\s*none;/s);
    expect(desktopStyles).toMatch(/\.login-hero\s*\{[^}]*display:\s*grid;/s);
  });
});
