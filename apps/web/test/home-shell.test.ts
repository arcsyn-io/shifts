import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';

const webRootUrl = new URL('../', import.meta.url);
const homePageUrl = new URL('src/pages/home/HomePage.tsx', webRootUrl);
const globalStylesUrl = new URL('src/shared/styles/global.css', webRootUrl);

describe('home application shell', () => {
  it('composes the top bar and responsive side navigation with design-system components', async () => {
    const page = await readFile(homePageUrl, 'utf8');

    expect(page).toContain("import logoSource from '@arcsyn-io/presentations/logo.png';");
    expect(page).toContain('<img src={logoSource} alt="ArcSyn" />');
    expect(page).toContain('<span className="app-sidebar__product">Shift</span>');
    expect(page).toContain('<SidebarProvider');
    expect(page).toContain('<Sidebar collapsible="icon"');
    expect(page).toContain('<SidebarTrigger />');
    expect(page).toContain('className="app-topbar"');
    expect(page).toContain('<PageHeader>');
    expect(page).toContain('<Card className="home-empty-state">');
  });

  it('keeps the shell usable in narrow viewports', async () => {
    const styles = await readFile(globalStylesUrl, 'utf8');
    const mobileStyles = styles.slice(styles.indexOf('@media (max-width: 39.99rem)'));

    expect(styles).toMatch(/\.app-main\s*\{[^}]*min-block-size:\s*100dvh;/s);
    expect(styles).toMatch(/\.app-topbar\s*\{[^}]*position:\s*sticky;/s);
    expect(styles).toMatch(
      /\.arcsyn-sidebar__panel,\s*\.arcsyn-sidebar--mobile\s*\{[^}]*radial-gradient[^}]*linear-gradient/s,
    );
    expect(mobileStyles).toMatch(/\.home-page\s*\{[^}]*padding:/s);
    expect(mobileStyles).toMatch(/\.home-empty-state__content\s*\{[^}]*flex-direction:\s*column;/s);
  });
});
