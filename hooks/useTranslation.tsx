import React,
{
  createContext,
  useState,
  useContext,
  ReactNode,
  useCallback
} from 'react';
import ptTranslations from '../locales/pt.json';

// Basic translations structure
const translations = {
  pt: ptTranslations.pt,
};

type Language = 'pt';
type TranslationKey = keyof typeof translations.pt;

interface LanguageContextType {
  language: Language;
  setLanguage: (language: Language) => void;
  // FIX: Loosen type to allow dynamic keys from template literals
  t: (key: string, ...args: any[]) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const LanguageProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  // FIX: Renamed 'language' to 'currentLanguage' to avoid potential conflicts with the 'Language' type.
  const [currentLanguage, setCurrentLanguage] = useState<Language>('pt');

  // FIX: Loosen key type to string to support dynamic keys
  const t = useCallback((key: string, ...args: (string | number | Record<string, string | number>)[]) => {
    // FIX: Cast key to TranslationKey for object lookup to satisfy TypeScript
    // FIX: Use the renamed state variable 'currentLanguage'.
    let translation: string = translations[currentLanguage][key as TranslationKey] || key;
    
    if (args.length > 0) {
        // Handle named placeholders e.g., t('key', { name: 'world' })
        if (typeof args[0] === 'object' && args[0] !== null && !Array.isArray(args[0])) {
            const params = args[0] as Record<string, string | number>;
            translation = Object.entries(params).reduce(
                (acc, [paramKey, paramValue]) => acc.replace(new RegExp(`{${paramKey}}`, 'g'), String(paramValue)),
                translation
            );
        } 
        // Handle positional placeholders e.g., t('key', 'world', '!')
        else {
            args.forEach((arg, index) => {
                translation = translation.replace(new RegExp(`\\{${index}\\}`, 'g'), String(arg));
            });
            // Handle simple replacement for a single non-object argument, e.g., t('key', 'world')
            if (args.length === 1) {
                translation = translation.replace(/\{[a-zA-Z0-9_]+\}/, String(args[0]));
            }
        }
    }
    
    return translation;
  }, [currentLanguage]);

  return (
    <LanguageContext.Provider value={{ language: currentLanguage, setLanguage: setCurrentLanguage, t }}>
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