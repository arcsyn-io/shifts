export const ptBR = {
  common: {
    language: {
      label: 'Idioma',
      portuguese: 'Português',
      english: 'English',
    },
    actions: {
      retry: 'Tentar novamente',
    },
  },
  auth: {
    loading: 'Verificando sua sessão…',
    unavailable: {
      title: 'Não foi possível verificar sua sessão',
      description:
        'O serviço de autenticação está temporariamente indisponível. Sua sessão não foi alterada.',
    },
    form: {
      eyebrow: 'Boas-vindas',
      title: 'Entre no Shift',
      description: 'Informe os dados da sua conta ArcSyn para continuar.',
      alertTitle: 'Falha ao entrar',
      invalidCredentials: 'E-mail ou senha incorretos. Tente novamente.',
      connectionError: 'Não foi possível entrar. Verifique sua conexão e tente novamente.',
      emailLabel: 'Endereço de e-mail',
      passwordLabel: 'Senha',
      invalidEmail: 'Informe um endereço de e-mail válido.',
      requiredPassword: 'Informe sua senha.',
      submit: 'Entrar',
      support: 'Precisa de ajuda para acessar sua conta? Fale com o administrador da ArcSyn.',
      footer: 'Acesso seguro fornecido pela ArcSyn',
    },
    hero: {
      eyebrow: 'Orquestração da força de trabalho',
      title: 'Todos os turnos, alinhados.',
      description:
        'Um workspace focado para coordenar pessoas, escalas e o trabalho que mantém as equipes em movimento.',
      footer: 'Projetado para operações tranquilas em qualquer escala.',
    },
  },
  home: {
    navigation: {
      label: 'Navegação principal',
      group: 'Workspace',
      home: 'Início',
      schedules: 'Escalas',
      team: 'Equipe',
      settings: 'Configurações',
    },
    topbar: {
      workspace: 'Workspace',
      overview: 'Visão geral',
      environment: 'Ambiente local',
      localUser: 'Usuário local',
    },
    header: {
      eyebrow: 'ArcSyn Shift',
      title: 'Organize sua operação em um só lugar.',
      description:
        'Este é o ponto de partida para acompanhar escalas, pessoas e rotinas da sua equipe.',
      createSchedule: 'Criar escala',
    },
    overview: {
      eyebrow: 'Visão geral',
      title: 'Seu workspace',
      status: 'Configuração inicial',
      emptyTitle: 'Tudo pronto para começar',
      emptyDescription:
        'Os resumos da operação aparecerão aqui conforme os módulos forem disponibilizados.',
    },
  },
  settings: {
    title: 'Configurações',
    description: 'Gerencie as preferências deste dispositivo.',
    close: 'Fechar configurações',
    navigationLabel: 'Seções das configurações',
    preferences: {
      title: 'Preferências',
      description: 'Personalize o idioma e a aparência do Shift.',
    },
    language: {
      title: 'Idioma',
      description: 'Escolha o idioma usado nos textos e controles da aplicação.',
      label: 'Idioma da interface',
    },
    appearance: {
      title: 'Tema',
      description: 'Escolha uma aparência. A alteração é aplicada imediatamente.',
      label: 'Tema da interface',
    },
    themes: {
      light: 'Claro',
      dark: 'Escuro',
      deepDark: 'Escuro profundo',
      corporateDark: 'Corporativo escuro',
      catppuccinMocha: 'Catppuccin Mocha',
      catppuccinLatte: 'Catppuccin Latte',
    },
  },
  status: {
    header: {
      eyebrow: 'ArcSyn Shift',
      title: 'Fundação do projeto pronta.',
      description:
        'A configuração inicial está online. As regras do produto ainda não foram implementadas.',
    },
    health: {
      checking: 'verificando…',
      unavailable: 'indisponível',
      ok: 'online',
    },
  },
  notFound: {
    title: 'Página não encontrada.',
    returnHome: 'Voltar ao início',
  },
} as const;
