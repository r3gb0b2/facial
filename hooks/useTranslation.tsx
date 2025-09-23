import React, { createContext, useContext } from 'react';

// The content of pt.json is now embedded directly to avoid import assertion issues.
const ptTranslations = {
  "header": {
    "title": "Sistema de Credenciamento Facial",
    "subtitle": "Acesso a Eventos Contínuo e Seguro"
  },
  "nav": {
    "register": "Registrar",
    "checkin": "Check-in",
    "fastCheckin": "Check-in Rápido"
  },
  "register": {
    "title": "Registro de Participante",
    "form": {
      "nameLabel": "Nome Completo",
      "namePlaceholder": "Ex: Maria da Silva",
      "emailLabel": "Endereço de Email",
      "emailPlaceholder": "Ex: maria.silva@exemplo.com",
      "sectorLabel": "Setor",
      "sectorPlaceholder": "Selecione um setor",
      "button": "Completar Registro"
    },
    "success": "Registrado {name} com sucesso!",
    "errors": {
      "allFields": "Todos os campos, incluindo uma foto, são obrigatórios.",
      "invalidEmail": "Por favor, insira um endereço de email válido.",
      "dbConnection": "Não foi possível conectar ao banco de dados. Verifique o console para mais detalhes."
    }
  },
  "checkin": {
    "title": "Check-in do Evento",
    "searchPlaceholder": "Buscar por nome...",
    "filterSectorPlaceholder": "Todos os Setores",
    "noAttendees": "Nenhum participante registrado ainda.",
    "noAttendeesSubtitle": "Vá para a aba \"Registrar\" para adicionar o primeiro participante.",
    "noResults": "Nenhum participante encontrado",
    "checkedInSuccess": "{name} fez o check-in!"
  },
  "fastCheckin": {
    "title": "Check-in Rápido por Reconhecimento Facial",
    "button": "Verificar Rosto",
    "verifying": "Verificando... Comparando com os participantes.",
    "noMatch": "Nenhum participante correspondente encontrado.",
    "noOneToScan": "Não há participantes aguardando check-in.",
    "apiPrompt": "As duas fotos a seguir são da mesma pessoa? Responda apenas 'Sim' ou 'Não'.",
    "apiYes": "sim",
    "apiError": "Ocorreu um erro ao verificar o rosto. Tente novamente."
  },
  "webcam": {
    "captureButton": "Capturar Foto",
    "retakeButton": "Tirar Novamente",
    "error": "Não foi possível acessar a webcam. Por favor, verifique as permissões e tente novamente.",
    "starting": "Iniciando câmera..."
  },
  "attendeeCard": {
    "status": {
      "registered": "Registrado",
      "checkedIn": "Check-in Realizado"
    },
    "sectorLabel": "Setor"
  },
  "verificationModal": {
    "title": "Verificação para",
    "registeredPhoto": "Foto Registrada",
    "liveVerification": "Verificação ao Vivo",
    "confirmButton": "Confirmar Check-in"
  },
  "sectors": [
    { "value": "bar", "label": "Bar" },
    { "value": "portaria", "label": "Portaria" },
    { "value": "acessos", "label": "Acessos" },
    { "value": "producao", "label": "Produção" }
  ]
};

const translations = {
  pt: ptTranslations,
};

type Sector = { value: string; label: string };

interface LanguageContextType {
  t: (key: string, replacements?: { [key: string]: string }) => string;
  sectors: Sector[];
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  
  const getNestedValue = (obj: any, key: string): any => {
    return key.split('.').reduce((o, i) => (o ? o[i] : undefined), obj);
  };

  const t = (key: string, replacements?: { [key: string]: string }): string => {
    let translation = getNestedValue(translations['pt'], key);
    if (!translation) {
        return key;
    }

    if (replacements) {
      Object.keys(replacements).forEach(placeholder => {
        translation = String(translation).replace(`{${placeholder}}`, replacements[placeholder]);
      });
    }

    return String(translation);
  };

  const sectors: Sector[] = getNestedValue(translations['pt'], 'sectors') || [];

  return (
    <LanguageContext.Provider value={{ t, sectors }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useTranslation = (): LanguageContextType => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useTranslation must be used within a LanguageProvider');
  }
  return context;
};