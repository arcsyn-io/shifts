import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';

const webRootUrl = new URL('../', import.meta.url);
const settingsDialogUrl = new URL(
  'src/features/settings/components/SettingsDialog.tsx',
  webRootUrl,
);
const homePageUrl = new URL('src/pages/home/HomePage.tsx', webRootUrl);
const applicationShellUrl = new URL('src/pages/layouts/ApplicationShell.tsx', webRootUrl);
const loginFormUrl = new URL('src/features/auth/components/LoginForm.tsx', webRootUrl);
const globalStylesUrl = new URL('src/shared/styles/global.css', webRootUrl);

describe('settings preferences shell', () => {
  it('opens settings from the sidebar without duplicate locale controls', async () => {
    const [homePage, applicationShell, loginForm] = await Promise.all([
      readFile(homePageUrl, 'utf8'),
      readFile(applicationShellUrl, 'utf8'),
      readFile(loginFormUrl, 'utf8'),
    ]);

    expect(applicationShell).toContain('<SettingsDialog');
    expect(applicationShell).toContain('onClick={() => setSettingsOpen(true)}');
    expect(homePage).not.toContain('<LocaleSwitcher');
    expect(loginForm).not.toContain('<LocaleSwitcher');
  });

  it('uses design-system dialog and radio controls for preferences', async () => {
    const dialog = await readFile(settingsDialogUrl, 'utf8');

    expect(dialog).toContain('<Dialog.Root');
    expect(dialog).toContain('<Dialog.Content');
    expect(dialog).toContain('<LocaleSwitcher id="settings-language" />');
    expect(dialog).toContain('<RadioGroup.Root');
    expect(dialog).toContain('supportedThemes.map');
    expect(dialog).toContain('data-arcsyn-theme={option}');
  });

  it('adapts the modal navigation and previews to narrow viewports', async () => {
    const styles = await readFile(globalStylesUrl, 'utf8');
    const mobileStyles = styles.slice(styles.indexOf('@media (max-width: 39.99rem)'));

    expect(styles).toMatch(/\.settings-dialog__layout\s*\{[^}]*grid-template-columns:/s);
    expect(styles).toMatch(
      /\.settings-dialog\s*\{[^}]*grid-template-rows:\s*auto minmax\(0, 1fr\)/s,
    );
    expect(styles).toMatch(/\.settings-preferences\s*\{[^}]*overflow-y:\s*auto/s);
    expect(styles).toMatch(/\.settings-preferences\s*\{[^}]*min-block-size:\s*0/s);
    expect(styles).toMatch(/\.settings-theme-grid\s*\{[^}]*repeat\(2,/s);
    expect(mobileStyles).toMatch(
      /\.settings-dialog__layout\s*\{[^}]*grid-template-columns:\s*minmax\(0, 1fr\)/s,
    );
    expect(mobileStyles).toMatch(
      /\.settings-theme-grid\s*\{[^}]*grid-template-columns:\s*minmax\(0, 1fr\)/s,
    );
  });
});
