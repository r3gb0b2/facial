import React, { createContext, useContext, useState, ReactNode } from 'react';

const translations = {
  ptBR: {
    header: {
      subtitle: "Gestão de Credenciamento Facial"
    },
    webcam: {
      starting: 'Iniciando câmera...',
      captureButton: 'Capturar Foto',
      retakeButton: 'Tirar Outra Foto',
    },
    verificationModal: {
      title: 'Verificar',
      registeredPhoto: 'Foto de Cadastro',
      liveVerification: 'Verificação ao Vivo',
      confirmButton: 'Confirmar Verificação',
    },
    register: {
      title: 'Registrar Novo Participante',
      errors: {
        allFields: 'Todos os campos, incluindo a foto, são obrigatórios.',
        invalidCpf: 'CPF inválido. Deve conter 11 dígitos.',
        cpfCheckError: 'Erro ao verificar CPF. Tente novamente.',
        cpfCheckIndexError: 'Erro de configuração no Firebase. É necessário criar um índice para a busca de CPF. Veja as instruções em firebase/service.ts.',
      },
      form: {
        nameLabel: 'Nome Completo',
        namePlaceholder: 'Ex: João da Silva',
        cpfLabel: 'CPF',
        cpfPlaceholder: '000.000.000-00',
        sectorLabel: 'Setor',
        sectorPlaceholder: 'Selecione um setor',
        button: 'Registrar',
      },
      cpfFound: "CPF encontrado. Usando foto e nome existentes.",
      checkingCpf: "Verificando CPF...",
      cpfNotFound: "CPF não encontrado. Prossiga com um novo registro.",
    },
    checkin: {
      title: 'Controle de Acesso',
      searchPlaceholder: 'Buscar por nome ou CPF...',
      filterSectorPlaceholder: 'Filtrar por setor',
      noAttendees: 'Nenhum participante registrado ainda.',
      noAttendeesSubtitle: 'Comece registrando um participante na aba "Registrar".',
      noResults: 'Nenhum resultado encontrado para sua busca.',
      statusModal: {
        title: 'Atualizar Status de %s',
        checkinButton: 'Confirmar Check-in',
        cancelButton: 'Cancelar Credencial',
        substituteButton: 'Realizar Substituição',
        missedButton: 'Marcar como Ausente',
      }
    },
    suppliers: {
      title: 'Gerenciar Fornecedores',
      generateTitle: 'Gerar Novo Link de Registro',
      nameLabel: 'Nome do Fornecedor',
      namePlaceholder: 'Ex: Empresa de Limpeza ABC',
      sectorsLabel: 'Setores Permitidos',
      generateButton: 'Gerar Link',
      noSectorsError: 'Selecione pelo menos um setor.',
      noNameError: 'O nome do fornecedor é obrigatório.',
      existingLinks: 'Links Gerados',
      noLinks: 'Nenhum link de fornecedor gerado para este evento ainda.',
      copyButton: 'Copiar Link',
      copiedButton: 'Copiado!',
      disableButton: 'Desativar',
      enableButton: 'Ativar',
      statusLabel: 'Status',
      active: 'Ativo',
      inactive: 'Inativo',
    },
    fastCheckin: {
      title: 'Check-in Rápido por Face',
      button: 'Verificar Rosto',
      verifyingBatch: 'Verificando em lote...',
    },
    events: {
      title: "Selecione o Evento",
      createButton: "Criar Novo Evento",
      noEvents: "Nenhum evento encontrado.",
      noEventsSubtitle: "Crie seu primeiro evento para começar a gerenciar os participantes.",
      modal: {
        createTitle: "Criar Novo Evento",
        editTitle: "Editar Evento",
        nameLabel: "Nome do Evento",
        namePlaceholder: "Ex: Conferência Anual 2024",
        createButton: "Criar Evento",
        saveButton: "Salvar Alterações",
        error: "O nome do evento não pode ser vazio.",
      }
    },
    login: {
      title: 'Acesso Restrito',
      passwordLabel: 'Senha de Acesso',
      passwordPlaceholder: '********',
      button: 'Entrar',
    },
    supplierRegistration: {
        closedTitle: "Registros Encerrados",
        closedMessage: "O período de registro para este fornecedor foi encerrado. Entre em contato com a organização do evento."
    },
    status: {
      pending: 'Pendente',
      checked_in: 'Check-in',
      cancelled: 'Cancelado',
      substitution: 'Substituído',
      missed: 'Ausente',
    }
  },
};

const sectors = [
  { value: 'staff', label: 'Staff' },
  { value: 'security', label: 'Segurança' },
  { value: 'catering', label: 'Buffet' },
  { value: 'cleaning', label: 'Limpeza' },
  { value: 'press', label: 'Imprensa' },
  { value: 'artist', label: 'Artista' },
  { value: 'production', label: 'Produção' },
  { value: 'guest', label: 'Convidado' },
];

type Language = 'ptBR';

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string, ...args: any[]) => string;
  sectors: typeof sectors;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const LanguageProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [language] = useState<Language>('ptBR');

  const t = (key: string, ...args: any[]) => {
    const keyParts = key.split('.');
    let translation = translations[language] as any;
    try {
      for (const part of keyParts) {
        translation = translation[part];
      }
      if (typeof translation !== 'string') return key;
      return translation.replace(/%s/g, () => args.shift() || '');
    } catch (e) {
      return key;
    }
  };

  const value = { language, setLanguage: () => {}, t, sectors };

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
};

export const useTranslation = () => {
  const context = useContext(LanguageContext);
  if (context === undefined) {
    throw new Error('useTranslation must be used within a LanguageProvider');
  }
  return context;
};