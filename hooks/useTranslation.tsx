// FIX: Provided full content for `hooks/useTranslation.tsx` to implement a translation context.
import React, { createContext, useContext, useState, useCallback } from 'react';

// Simple dictionary for translations
const translations = {
  pt: {
    "header.title": "Check-in Facial",
    "header.subtitle": "Gestão de Eventos e Credenciamento",
    "login.title": "Acesso Restrito",
    "login.passwordLabel": "Senha de Acesso",
    "login.passwordPlaceholder": "Digite a senha",
    "login.button": "Entrar",
    "events.title": "Selecione o Evento",
    "events.noEvents": "Nenhum evento encontrado.",
    "events.noEventsSubtitle": "Crie um novo evento para começar a gerenciar os participantes.",
    "events.createButton": "Criar Novo Evento",
    "events.modal.createTitle": "Criar Novo Evento",
    "events.modal.editTitle": "Editar Evento",
    "events.modal.nameLabel": "Nome do Evento",
    "events.modal.namePlaceholder": "Ex: Conferência de Tecnologia 2024",
    "events.modal.error": "O nome do evento não pode ficar em branco.",
    "events.modal.saveButton": "Salvar Alterações",
    "events.modal.createButton": "Criar Evento",
    "sectors.title": "Gerenciar Setores",
    "sectors.noSectors": "Nenhum setor cadastrado.",
    "sectors.noSectorsSubtitle": "Crie setores para organizar os participantes.",
    "sectors.createButton": "Adicionar Setor",
    "sectors.deleteConfirm": "Tem certeza que deseja deletar o setor \"{0}\"? Esta ação não pode ser desfeita.",
    "sectors.deleteErrorInUse": "O setor \"{0}\" não pode ser deletado pois está em uso por participantes ou fornecedores.",
    "sectors.modal.createTitle": "Criar Novo Setor",
    "sectors.modal.editTitle": "Editar Setor",
    "sectors.modal.labelLabel": "Nome do Setor",
    "sectors.modal.labelPlaceholder": "Ex: Pista, Camarote, Staff",
    "sectors.modal.error": "O nome do setor não pode ficar em branco.",
    "sectors.modal.saveButton": "Salvar",
    "sectors.modal.createButton": "Criar",
    "register.title": "Registro de Participante",
    "register.checkingCpf": "Verificando CPF...",
    "register.cpfFound": "CPF encontrado. Dados carregados.",
    "register.cpfNotFound": "CPF não encontrado. Preencha os dados.",
    "register.errors.cpfCheckError": "Erro ao verificar o CPF. Tente novamente.",
    "register.errors.cpfCheckIndexError": "Erro de configuração do banco de dados (índice ausente). Contate o suporte.",
    "register.errors.allFields": "Todos os campos, incluindo a foto, são obrigatórios.",
    "register.errors.invalidCpf": "CPF inválido. Deve conter 11 dígitos.",
    "register.form.cpfLabel": "CPF",
    "register.form.cpfPlaceholder": "000.000.000-00",
    "register.form.nameLabel": "Nome Completo",
    "register.form.namePlaceholder": "Digite o nome completo",
    "register.form.sectorLabel": "Setor",
    "register.form.sectorPlaceholder": "Selecione um setor",
    "register.form.button": "Registrar Participante",
    "checkin.title": "Lista de Participantes",
    "checkin.searchPlaceholder": "Buscar por nome ou CPF...",
    "checkin.filterSectorPlaceholder": "Todos os setores",
    "checkin.noAttendees": "Nenhum participante registrado neste evento ainda.",
    "checkin.noAttendeesSubtitle": "Use a aba 'Registrar' para adicionar novos participantes.",
    "checkin.noResults": "Nenhum participante encontrado com os filtros aplicados.",
    "checkin.statusModal.title": "Atualizar Status: {0}",
    "checkin.statusModal.checkinButton": "Confirmar Check-in",
    "checkin.statusModal.cancelButton": "Cancelar Credencial",
    "checkin.statusModal.substituteButton": "Realizar Substituição",
    "checkin.statusModal.missedButton": "Marcar como Ausente (No-show)",
    "verificationModal.title": "Verificação Facial de",
    "verificationModal.registeredPhoto": "Foto Cadastrada",
    "verificationModal.liveVerification": "Verificação ao Vivo",
    "verificationModal.confirmButton": "Confirmar Check-in",
    "webcam.starting": "Iniciando câmera...",
    "webcam.captureButton": "Capturar Foto",
    "webcam.retakeButton": "Tirar Outra Foto",
    "status.pending": "Pendente",
    "status.checked_in": "Checked-in",
    "status.cancelled": "Cancelado",
    "status.substitution": "Substituição",
    "status.missed": "Ausente",
  },
};

type Language = keyof typeof translations;
export type TranslationKey = keyof typeof translations['pt'];

interface LanguageContextType {
  language: Language;
  setLanguage: (language: Language) => void;
  t: (key: TranslationKey, ...args: (string | number)[]) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [language, setLanguage] = useState<Language>('pt');

  const t = useCallback((key: TranslationKey, ...args: (string | number)[]) => {
    let translation = translations[language][key] || key;
    if (args.length > 0) {
        args.forEach((arg, index) => {
            translation = translation.replace(`{${index}}`, String(arg));
        });
    }
    return translation;
  }, [language]);

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
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
