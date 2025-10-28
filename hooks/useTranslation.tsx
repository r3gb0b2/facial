import React, { createContext, useContext, useState, ReactNode } from 'react';

// Basic translations, can be expanded.
const translations = {
  pt: {
    header: {
        title: "Check-in Facial",
        subtitle: "Gestão de Eventos Simplificada"
    },
    login: {
      title: "Acesso Restrito",
      passwordLabel: "Senha de Acesso",
      passwordPlaceholder: "Digite a senha",
      button: "Entrar",
      errors: {
        invalidPassword: "Senha inválida."
      }
    },
    events: {
        title: "Seleção de Evento",
        noEvents: "Nenhum evento encontrado.",
        noEventsSubtitle: "Crie um novo evento para começar.",
        createButton: "Criar Novo Evento",
        deleteConfirm: (eventName: string) => `Tem certeza que deseja deletar o evento "${eventName}"? Esta ação não pode ser desfeita.`,
        modal: {
            createTitle: "Criar Novo Evento",
            editTitle: "Editar Evento",
            nameLabel: "Nome do Evento",
            namePlaceholder: "Ex: Conferência Anual 2024",
            createButton: "Criar Evento",
            saveButton: "Salvar Alterações",
            error: "O nome do evento não pode ser vazio."
        },
        errors: {
            load: "Falha ao carregar eventos.",
            delete: "Falha ao deletar o evento."
        }
    },
    register: {
        title: "Cadastro de Credenciados",
        checkingCpf: "Verificando CPF...",
        cpfFound: "CPF já cadastrado. Dados carregados.",
        cpfNotFound: "CPF não encontrado. Prossiga com o cadastro.",
        cpfAlreadyRegistered: "Este participante já está cadastrado neste evento. Não é necessário registrar novamente.",
        photoLocked: "A foto está bloqueada pois o participante já possui cadastro.",
        successMessage: "Participante registrado com sucesso!",
        form: {
            cpfLabel: "CPF",
            cpfPlaceholder: "000.000.000-00",
            nameLabel: "Nome Completo",
            namePlaceholder: "Digite o nome completo",
            sectorLabel: "Setor",
            sectorPlaceholder: "Selecione um setor",
            subCompanyLabel: "Empresa / Sub-Contratada",
            subCompanyPlaceholder: "Selecione a empresa",
            button: "Registrar Participante"
        },
        errors: {
            allFields: "Todos os campos (nome, CPF, foto e setor) são obrigatórios.",
            invalidCpf: "CPF inválido.",
            subCompanyRequired: "A seleção da empresa é obrigatória.",
            cpfCheckError: "Erro ao verificar CPF.",
            cpfCheckIndexError: "Erro de configuração do banco (índice ausente). Contate o suporte.",
            submit: "Falha ao registrar participante."
        }
    },
    checkin: {
        searchPlaceholder: "Buscar por nome, CPF ou pulseira...",
        stats: {
            checkedIn: "Presentes",
            pending: "Aguardando",
            total: "Total"
        },
        filter: {
            allStatuses: "Todos os Status",
            allSuppliers: "Todos os Fornecedores"
        },
        search: {
            noResultsForTerm: (term: string) => `Nenhum resultado para "${term}".`,
            noResultsForFilter: "Nenhum participante encontrado com os filtros atuais."
        }
    },
    attendeeCard: {
        supplierLabel: "Fornecedor",
        wristbandNumber: "Pulseira"
    },
    attendeeDetail: {
        title: "Detalhes do Participante",
        wristbandLabel: "Nº da Pulseira",
        wristbandPlaceholder: "Digite ou leia o nº",
        updateWristbandButton: "Salvar",
        wristbandUpdateSuccess: "Pulseira atualizada!",
        formError: "Nome e CPF são obrigatórios.",
        deleteConfirm: (name: string) => `Tem certeza que deseja remover "${name}" do evento?`,
        cancelButton: "Cancelar",
        saveButton: "Salvar",
        deleteButton: "Remover do Evento",
    },
    verificationModal: {
        title: "Verificação Facial de",
        registeredPhoto: "Foto do Cadastro",
        liveVerification: "Verificação ao Vivo",
        confirmButton: "Confirmar Check-in Manual"
    },
    status: {
        pending: 'Aguardando',
        checked_in: 'Presente',
        cancelled: 'Cancelado',
        substitution: 'Substituição',
        missed: 'Ausente',
    },
    statusUpdateModal: {
        currentStatus: "Status Atual",
        confirmCheckin: "Confirmar Check-in",
        cancelCheckin: "Cancelar Check-in (Voltar para Aguardando)",
        reactivateRegistration: "Reativar Inscrição",
        markAsMissed: "Marcar como Ausente",
        allowSubstitution: "Permitir Substituição",
        cancelRegistration: "Cancelar Inscrição",
        closeButton: "Fechar"
    },
    webcam: {
        starting: "Iniciando câmera...",
        captureButton: "Capturar Foto",
        retakeButton: "Tirar Outra Foto",
        uploadButton: "Enviar Arquivo",
    },
    sectors: {
        title: "Gerenciar Setores",
        noSectors: "Nenhum setor cadastrado.",
        noSectorsSubtitle: "Crie setores para organizar os participantes.",
        createButton: "Adicionar Setor",
        deleteConfirm: (label: string) => `Tem certeza que deseja deletar o setor "${label}"?`,
        deleteErrorInUse: (label: string) => `O setor "${label}" não pode ser excluído pois está em uso por participantes ou fornecedores.`,
        modal: {
            createTitle: "Criar Novo Setor",
            editTitle: "Editar Setor",
            labelLabel: "Nome do Setor",
            labelPlaceholder: "Ex: Staff, Produção, Convidado",
            colorLabel: "Cor de Identificação",
            createButton: "Criar Setor",
            saveButton: "Salvar",
            error: "O nome do setor é obrigatório."
        }
    },
    suppliers: {
        title: "Gerenciar Fornecedores",
        noSuppliers: "Nenhum fornecedor cadastrado.",
        noSuppliersSubtitle: "Adicione fornecedores para liberar links de cadastro.",
        createButton: "Adicionar Fornecedor",
        registrationLink: "Link de Cadastro",
        adminLink: "Link de Visualização",
        copy: "Copiar",
        copied: "Copiado!",
        regenerateLink: "Regerar",
        confirmRegenerate: (type: string) => `Tem certeza que deseja regerar o link de ${type}? O link antigo deixará de funcionar.`,
        registrationStatus: "Cadastros",
        open: "Abertos",
        closed: "Fechados",
        toggleOpen: "Abrir cadastros",
        toggleClose: "Fechar cadastros",
        deleteConfirm: (name: string) => `Tem certeza que deseja deletar o fornecedor "${name}"?`,
        modal: {
            createTitle: "Criar Novo Fornecedor",
            editTitle: "Editar Fornecedor",
            nameLabel: "Nome do Fornecedor",
            namePlaceholder: "Ex: Empresa de Limpeza",
            sectorsLabel: "Setores Permitidos",
            sectorsPlaceholder: "Selecione um ou mais setores",
            subCompaniesLabel: "Sub-empresas (Opcional)",
            subCompaniesPlaceholder: "Nome da Empresa,Setor\nOutra Empresa,Outro Setor",
            createButton: "Criar Fornecedor",
            saveButton: "Salvar",
            error: "Nome e pelo menos um setor são obrigatórios."
        }
    },
    spreadsheet: {
        title: "Importar Participantes via Planilha",
        uploadButton: "Importar Planilha (.csv)",
        dragAndDrop: "ou arraste e solte o arquivo aqui",
        templateLink: "Baixar modelo CSV",
        importing: "Importando, por favor aguarde...",
        partialSuccess: (success: number, total: number) => `Importação parcial: ${success} de ${total} registros foram importados com sucesso.`,
        success: (count: number) => `Importação concluída! ${count} registros importados com sucesso.`,
        error: "Ocorreu um erro na importação. Verifique o console para mais detalhes.",
        errorListTitle: "Erros encontrados:",
    },
    supplierRegistration: {
        closedTitle: "Cadastros Encerrados",
        closedMessage: "O período de cadastro para este link foi encerrado pelo organizador do evento."
    },
    supplierAdmin: {
        title: "Visualização de Fornecedor",
        supplier: "Fornecedor",
        noAttendees: "Nenhum participante cadastrado por este fornecedor ainda.",
        errors: {
            invalidLink: "O link de verificação é inválido ou expirou. Por favor, solicite um novo link ao administrador."
        }
    },
    wristbandReport: {
        title: "Relatório de Pulseiras Entregues",
        searchPlaceholder: "Buscar por nome, pulseira ou CPF...",
        filter: {
            allSectors: "Todos os Setores",
        },
        stats: {
            deliveredOf: (delivered: number, total: number) => `${delivered} de ${total} entregues`
        },
        list: {
            header: {
                name: "Nome",
                wristband: "Pulseira",
                sector: "Setor",
                color: "Cor"
            }
        },
        noWristbands: "Nenhuma pulseira foi entregue ainda.",
        noResults: "Nenhum resultado encontrado para a sua busca."
    }
  }
};

type Language = keyof typeof translations;

interface LanguageContextType {
  language: Language;
  setLanguage: (language: Language) => void;
  t: (key: string, ...args: (string | number)[]) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

// Helper to access nested keys like 'header.title'
const getNestedTranslation = (language: Language, key: string): string | ((...args: any[]) => string) | undefined => {
    return key.split('.').reduce((obj: any, k) => {
        return obj && obj[k];
    }, translations[language]);
};


export const LanguageProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [language, setLanguage] = useState<Language>('pt');

  const t = (key: string, ...args: (string | number)[]) => {
    const translation = getNestedTranslation(language, key);
    if (typeof translation === 'function') {
        return translation(...args);
    }
    if (typeof translation === 'string') {
        return translation;
    }
    console.warn(`Translation key not found: ${key}`);
    return key;
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useTranslation = (): LanguageContextType => {
  const context = useContext(LanguageContext);
  if (context === undefined) {
    throw new Error('useTranslation must be used within a LanguageProvider');
  }
  return context;
};