export const en = {
  common: {
    language: {
      label: 'Language',
      portuguese: 'Português',
      english: 'English',
    },
    actions: {
      retry: 'Try again',
    },
  },
  auth: {
    loading: 'Checking your session…',
    unavailable: {
      title: "We couldn't verify your session",
      description:
        'The authentication service is temporarily unavailable. Your session has not been changed.',
    },
    form: {
      eyebrow: 'Welcome back',
      title: 'Sign in to Shift',
      description: 'Enter your ArcSyn account details to continue.',
      alertTitle: 'Sign-in failed',
      invalidCredentials: 'Email or password is incorrect. Please try again.',
      connectionError: "We couldn't sign you in. Check your connection and try again.",
      emailLabel: 'Email address',
      passwordLabel: 'Password',
      invalidEmail: 'Enter a valid email address.',
      requiredPassword: 'Enter your password.',
      submit: 'Sign in',
      support: 'Need help accessing your account? Contact your ArcSyn administrator.',
      footer: 'Secure access powered by ArcSyn',
    },
    hero: {
      eyebrow: 'Workforce orchestration',
      title: 'Every shift, aligned.',
      description:
        'One focused workspace to coordinate people, schedules, and the work that keeps teams moving.',
      footer: 'Designed for calm operations at any scale.',
    },
  },
  home: {
    navigation: {
      label: 'Main navigation',
      group: 'Workspace',
      home: 'Home',
      schedules: 'Schedules',
      team: 'Team',
      settings: 'Settings',
    },
    topbar: {
      workspace: 'Workspace',
      overview: 'Overview',
      environment: 'Local environment',
      localUser: 'Local user',
    },
    header: {
      eyebrow: 'ArcSyn Shift',
      title: 'Organize your operation in one place.',
      description: 'This is your starting point for tracking schedules, people, and team routines.',
      createSchedule: 'Create schedule',
    },
    overview: {
      eyebrow: 'Overview',
      title: 'Your workspace',
      status: 'Initial setup',
      emptyTitle: 'Everything is ready to begin',
      emptyDescription: 'Operation summaries will appear here as modules become available.',
    },
  },
  settings: {
    title: 'Settings',
    description: 'Manage preferences for this device.',
    close: 'Close settings',
    navigationLabel: 'Settings sections',
    preferences: {
      title: 'Preferences',
      description: 'Customize Shift language and appearance.',
    },
    language: {
      title: 'Language',
      description: 'Choose the language used throughout the application.',
      label: 'Interface language',
    },
    appearance: {
      title: 'Theme',
      description: 'Choose an appearance. Changes are applied immediately.',
      label: 'Interface theme',
    },
    themes: {
      light: 'Light',
      dark: 'Dark',
      deepDark: 'Deep Dark',
      corporateDark: 'Corporate Dark',
      catppuccinMocha: 'Catppuccin Mocha',
      catppuccinLatte: 'Catppuccin Latte',
    },
  },
  status: {
    header: {
      eyebrow: 'ArcSyn Shift',
      title: 'Project foundation ready.',
      description:
        'The initial stack configuration is online. Product rules have not been implemented yet.',
    },
    health: {
      checking: 'checking…',
      unavailable: 'unavailable',
      ok: 'online',
    },
  },
  notFound: {
    title: 'Page not found.',
    returnHome: 'Return home',
  },
} as const;
