import {
  Avatar,
  Badge,
  Button,
  Card,
  PageHeader,
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
import {
  CalendarIcon,
  DashboardIcon,
  HomeIcon,
  PlusIcon,
  SettingsIcon,
  TeamIcon,
} from '@arcsyn-io/react/icons';
import logoSource from '@arcsyn-io/presentations/logo.png';
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { SettingsDialog } from '@/features/settings';

const upcomingItems = [
  { translationKey: 'navigation.schedules', icon: CalendarIcon },
  { translationKey: 'navigation.team', icon: TeamIcon },
] as const;

export function HomePage() {
  const { t } = useTranslation('home');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const settingsButtonRef = useRef<HTMLButtonElement>(null);

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
                  <SidebarMenuButton isActive tooltip={t('navigation.home')}>
                    <HomeIcon aria-hidden="true" size={17} />
                    <span>{t('navigation.home')}</span>
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
              <p className="app-topbar__title">{t('topbar.overview')}</p>
            </div>
          </div>

          <div className="app-topbar__account">
            <Badge variant="success">{t('topbar.environment')}</Badge>
            <Avatar id="local-user" name={t('topbar.localUser')} size="sm" />
          </div>
        </header>

        <div className="home-page">
          <PageHeader>
            <PageHeader.Content>
              <PageHeader.Eyebrow>{t('header.eyebrow')}</PageHeader.Eyebrow>
              <PageHeader.Title>{t('header.title')}</PageHeader.Title>
              <PageHeader.Description>{t('header.description')}</PageHeader.Description>
            </PageHeader.Content>
            <PageHeader.Actions>
              <Button leadingIcon={<PlusIcon aria-hidden="true" size={16} />} disabled>
                {t('header.createSchedule')}
              </Button>
            </PageHeader.Actions>
          </PageHeader>

          <section className="home-overview" aria-labelledby="home-overview-title">
            <div className="home-section-heading">
              <div>
                <p className="home-section-heading__eyebrow">{t('overview.eyebrow')}</p>
                <h2 id="home-overview-title">{t('overview.title')}</h2>
              </div>
              <Badge variant="neutral">{t('overview.status')}</Badge>
            </div>

            <Card className="home-empty-state">
              <Card.Content className="home-empty-state__content">
                <span className="home-empty-state__icon" aria-hidden="true">
                  <DashboardIcon size={22} />
                </span>
                <div>
                  <Card.Title as="h3">{t('overview.emptyTitle')}</Card.Title>
                  <Card.Description>{t('overview.emptyDescription')}</Card.Description>
                </div>
              </Card.Content>
            </Card>
          </section>
        </div>
      </SidebarInset>
      <SettingsDialog open={settingsOpen} onOpenChange={handleSettingsOpenChange} />
    </SidebarProvider>
  );
}
