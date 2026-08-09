import {
  Avatar,
  Badge,
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarRail,
  SidebarTrigger,
} from '@arcsyn-io/react';
import { CalendarIcon, HomeIcon, SettingsIcon, TeamIcon } from '@arcsyn-io/react/icons';
import logoSource from '@arcsyn-io/presentations/logo.png';
import { type ReactNode, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { useSessionQuery } from '@/features/auth';
import { SettingsDialog } from '@/features/settings';

interface ApplicationShellProps {
  activeArea: 'home' | 'organization';
  contextTitle: string;
  children: ReactNode;
}

const upcomingItems = [
  { translationKey: 'navigation.schedules', icon: CalendarIcon },
  { translationKey: 'navigation.team', icon: TeamIcon },
] as const;

export function ApplicationShell({ activeArea, contextTitle, children }: ApplicationShellProps) {
  const { t } = useTranslation('home');
  const session = useSessionQuery();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const settingsButtonRef = useRef<HTMLButtonElement>(null);
  const userLabel = session.data?.principal.email ?? t('topbar.localUser');

  const handleSettingsOpenChange = (open: boolean) => {
    setSettingsOpen(open);
    if (!open) requestAnimationFrame(() => settingsButtonRef.current?.focus());
  };

  return (
    <SidebarProvider className="app-shell">
      <Sidebar collapsible="icon" label={t('navigation.label')}>
        <SidebarHeader className="app-sidebar__header">
          <div className="app-sidebar__brand" aria-label="ArcSyn Shift">
            <div className="app-sidebar__brand-logo">
              <img src={logoSource} alt="ArcSyn" />
            </div>
            <span className="app-sidebar__product">Shift</span>
          </div>
        </SidebarHeader>

        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupLabel>{t('navigation.group')}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    asChild
                    isActive={activeArea === 'home'}
                    tooltip={t('navigation.home')}
                  >
                    <Link to="/">
                      <HomeIcon aria-hidden="true" size={17} />
                      <span>{t('navigation.home')}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                {upcomingItems.map(({ translationKey, icon: Icon }) => (
                  <SidebarMenuItem key={translationKey}>
                    <SidebarMenuButton disabled tooltip={t(translationKey)}>
                      <Icon aria-hidden="true" size={17} />
                      <span>{t(translationKey)}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>

        <SidebarFooter>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton
                ref={settingsButtonRef}
                tooltip={t('navigation.settings')}
                onClick={() => setSettingsOpen(true)}
              >
                <SettingsIcon aria-hidden="true" size={17} />
                <span>{t('navigation.settings')}</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>
        <SidebarRail />
      </Sidebar>

      <SidebarInset className="app-main">
        <header className="app-topbar">
          <div className="app-topbar__context">
            <SidebarTrigger />
            <span className="app-topbar__divider" aria-hidden="true" />
            <div>
              <p className="app-topbar__eyebrow">{t('topbar.workspace')}</p>
              <p className="app-topbar__title">{contextTitle}</p>
            </div>
          </div>

          <div className="app-topbar__account">
            <Badge variant="success">{t('topbar.environment')}</Badge>
            <Avatar id={session.data?.principal.id ?? 'local-user'} name={userLabel} size="sm" />
          </div>
        </header>
        {children}
      </SidebarInset>
      <SettingsDialog open={settingsOpen} onOpenChange={handleSettingsOpenChange} />
    </SidebarProvider>
  );
}
