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
      title: 'Suas organizações',
      description: 'Escolha um ambiente, aceite um convite ou crie uma nova organização.',
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
  organizations: {
    roles: {
      owner: 'Owner',
      admin: 'Admin',
      member: 'Membro',
    },
    actions: {
      retry: 'Tentar novamente',
      acceptInvitation: 'Aceitar convite',
      createOrganization: 'Criar organização',
      returnHome: 'Voltar às organizações',
      sendInvitation: 'Convidar pessoa',
      revoke: 'Revogar acesso',
    },
    home: {
      organizations: {
        eyebrow: 'Ambientes',
        title: 'Organizações acessíveis',
        count: '{{count}} organização(ões)',
      },
      invitations: {
        eyebrow: 'Aguardando você',
        title: 'Convites pendentes',
        expires: 'Expira em {{date}}',
      },
      create: {
        eyebrow: 'Novo ambiente',
        title: 'Criar organização',
        description:
          'O slug define o endereço permanente da organização e não poderá ser alterado.',
      },
    },
    workspace: {
      eyebrow: 'Organização',
      description: 'Ambiente /{{slug}}',
      fallbackTitle: 'Organização',
    },
    invite: {
      title: 'Convidar uma pessoa',
      description: 'Neste MVP, somente contas ArcSyn já existentes podem receber um convite.',
    },
    members: {
      eyebrow: 'Acesso',
      title: 'Membros',
      count: '{{count}} membro(s)',
      you: 'Você',
      changeRoleLabel: 'Alterar papel de {{email}}',
      revokeConfirmation: 'Revogar o acesso de {{email}}?',
    },
    fields: {
      nameLabel: 'Nome da organização',
      nameError: 'Informe um nome com até 80 caracteres.',
      slugLabel: 'Slug',
      slugPlaceholder: 'minha-organizacao',
      slugDescription: 'Use de 3 a 39 caracteres: letras minúsculas, números e hífens.',
      slugError: 'Informe um slug válido com letras minúsculas, números e hífens.',
      emailLabel: 'E-mail da conta',
      emailError: 'Informe um endereço de e-mail válido.',
      roleLabel: 'Papel',
      roleError: 'Selecione um papel permitido.',
    },
    states: {
      loadingOrganizations: 'Carregando organizações…',
      loadingInvitations: 'Carregando convites…',
      loadingOrganization: 'Carregando organização…',
      loadingMembers: 'Carregando membros…',
      organizationsErrorTitle: 'Não foi possível carregar suas organizações',
      organizationsErrorDescription: 'Verifique sua conexão e tente novamente.',
      organizationsEmptyTitle: 'Você ainda não participa de uma organização',
      organizationsEmptyDescription: 'Crie uma organização abaixo ou aceite um convite pendente.',
      invitationsErrorTitle: 'Não foi possível carregar seus convites',
      invitationsErrorDescription: 'Tente novamente sem recarregar a página.',
      invitationsEmptyTitle: 'Nenhum convite pendente',
      invitationsEmptyDescription: 'Novos convites aparecerão aqui.',
      acceptErrorTitle: 'Não foi possível aceitar o convite',
      acceptErrorDescription:
        'O convite pode ter expirado ou sido cancelado. Atualize a lista e tente novamente.',
      createErrorTitle: 'Não foi possível criar a organização',
      createErrorDescription: 'Revise os dados. O slug pode já estar em uso.',
      organizationUnavailableTitle: 'Organização indisponível',
      organizationUnavailableDescription:
        'Este endereço não existe ou você não possui acesso a ele.',
      organizationErrorTitle: 'Não foi possível carregar a organização',
      organizationErrorDescription: 'Verifique sua conexão e tente novamente.',
      mutationErrorTitle: 'Não foi possível concluir a ação',
      mutationErrorDescription: 'Seu acesso pode ter mudado. Atualize os dados e tente novamente.',
      invitationConflictDescription: 'Já existe um convite pendente para esta conta.',
      invitationSuccessTitle: 'Convite criado',
      invitationSuccessDescription: 'A pessoa já pode aceitar o convite na página inicial.',
      membersErrorTitle: 'Não foi possível carregar os membros',
      membersErrorDescription: 'Verifique sua conexão e tente novamente.',
      membersEmptyTitle: 'Nenhum membro disponível',
      membersEmptyDescription: 'Os membros ativos aparecerão aqui.',
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
