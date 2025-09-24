import React, { createContext, useContext, useState, ReactNode } from 'react';

// For simplicity, we'll keep translations in this file. In a larger app, they would be in separate JSON files.
const translations = {
  ptBR: {
    header: {
      title: "Check-in Facial",
      subtitle: "Gestão de Eventos Simplificada",
    },
    nav: {
      register: "Cadastrar",
      checkin: "Check-in",
      admin: "Admin",
      backToEvents: "Voltar para Eventos"
    },
    webcam: {
      starting: "Iniciando câmera...",
      captureButton: "Capturar Foto",
      retakeButton: "Tirar Outra Foto",
    },
    register: {
      title: "Cadastro de Participante",
      form: {
        nameLabel: "Nome Completo",
        namePlaceholder: "Ex: João da Silva",
        cpfLabel: "CPF",
        cpfPlaceholder: "000.000.000-00",
        sectorLabel: "Setor",
        sectorPlaceholder: "Selecione um setor",
        button: "Cadastrar Participante"
      },
      errors: {
        allFields: "Todos os campos, incluindo a foto, são obrigatórios.",
        invalidCpf: "O CPF informado é inválido.",
        duplicateCpf: "Já existe um participante com este CPF neste evento.",
        generic: "Ocorreu um erro ao cadastrar. Tente novamente."
      },
      success: "Participante cadastrado com sucesso!"
    },
    checkin: {
      title: "Lista de Participantes",
      searchPlaceholder: "Buscar por nome ou CPF...",
      filterSectorPlaceholder: "Filtrar por setor",
      noAttendees: "Nenhum participante cadastrado.",
      noAttendeesSubtitle: "Use a aba 'Cadastrar' para adicionar o primeiro.",
      noResults: "Nenhum participante encontrado com os filtros atuais.",
      statusModal: {
        title: (name: string) => `Alterar Status de ${name}`,
        checkinButton: "Realizar Check-in",
        cancelButton: "Cancelar Inscrição",
        substituteButton: "Substituir",
        missedButton: "Marcar como Faltou"
      },
      statusUpdateSuccess: (name: string) => `Status de ${name} atualizado com sucesso!`,
      success: (name: string) => `Check-in de ${name} realizado com sucesso!`,
    },
    attendeeCard: {
        sectorLabel: "Setor",
        status: {
            checkedIn: "Check-in realizado",
            registered: "Registrado",
            cancelled: "Cancelado",
            substitution: "Substituição",
            missed: "Faltou"
        }
    },
    admin: {
        title: "Painel Administrativo",
        form: {
            title: "Adicionar Fornecedor",
            nameLabel: "Nome do Fornecedor/Empresa",
            namePlaceholder: "Ex: Fotografia VIP",
            sectorLabel: "Setor(es) de Acesso",
            button: "Adicionar Fornecedor"
        },
        list: {
            title: "Links de Cadastro para Fornecedores",
            noSuppliers: "Nenhum fornecedor cadastrado ainda."
        },
        buttons: {
            copyLink: "Copiar Link",
            copied: "Copiado!"
        },
        errors: {
            allFields: "Nome e ao menos um setor são obrigatórios.",
            duplicate: "Já existe um fornecedor com este nome/link.",
            generic: "Erro ao adicionar fornecedor."
        },
        success: {
            supplierAdded: "Fornecedor adicionado com sucesso!",
            linkCopied: "Link copiado para a área de transferência!"
        }
    },
    events: {
        title: "Seletor de Eventos",
        noEvents: "Nenhum evento encontrado.",
        noEventsSubtitle: "Crie seu primeiro evento para começar.",
        createButton: "Criar Novo Evento",
        modal: {
            createTitle: "Criar Novo Evento",
            editTitle: "Editar Evento",
            nameLabel: "Nome do Evento",
            namePlaceholder: "Ex: Conferência de Tecnologia 2024",
            createButton: "Criar Evento",
            saveButton: "Salvar Alterações",
            error: "O nome do evento não pode estar em branco."
        },
        deleteConfirm: (name: string) => `Você tem certeza que quer excluir o evento "${name}"? Esta ação não pode ser desfeita.`
    },
    login: {
        title: "Acesso Restrito",
        passwordLabel: "Senha",
        passwordPlaceholder: "Digite a senha do admin",
        button: "Entrar",
        error: "Senha incorreta."
    }
  },
};

const sectors = [
    { value: 'pista', label: 'Pista' },
    { value: 'pista-premium', label: 'Pista Premium' },
    { value: 'camarote', label: 'Camarote' },
    { value: 'backstage', label: 'Backstage' },
    { value: 'staff', label: 'Staff' },
];

type Translations = typeof translations.ptBR;

interface LanguageContextType {
  language: string;
  setLanguage: (language: string) => void;
  t: (key: string, ...args: any[]) => string;
  sectors: typeof sectors;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const LanguageProvider = ({ children }: { children: ReactNode }) => {
  const [language, setLanguage] = useState('ptBR');

  const t = (key: string, ...args: any[]): string => {
    const keys = key.split('.');
    let result: any = translations[language as keyof typeof translations];
    for (const k of keys) {
      result = result?.[k];
      if (result === undefined) {
        console.warn(`Translation key not found: ${key}`);
        return key;
      }
    }
    if (typeof result === 'function') {
        return result(...args);
    }
    return result;
  };

  const value = { language, setLanguage, t, sectors };

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useTranslation = () => {
  const context = useContext(LanguageContext);
  if (context === undefined) {
    throw new Error('useTranslation must be used within a LanguageProvider');
  }
  return context;
};