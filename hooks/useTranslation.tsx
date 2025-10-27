import React, { createContext, useContext, ReactNode } from 'react';

// A real app would load these from a JSON file or API
const translations: Record<string, string> = {
  'login.title': 'Acesso Restrito',
  'login.passwordLabel': 'Senha de Acesso',
  'login.passwordPlaceholder': 'Digite a senha',
  'login.button': 'Entrar',
  'header.subtitle': 'Gerenciamento de Credenciamento',
  'events.title': 'Seletor de Eventos',
  'events.noEvents': 'Nenhum evento encontrado.',
  'events.noEventsSubtitle': 'Comece criando um novo evento para gerenciar seus participantes.',
  'events.createButton': 'Criar Novo Evento',
  'events.modal.editTitle': 'Editar Evento',
  'events.modal.createTitle': 'Criar Novo Evento',
  'events.modal.error': 'O nome do evento não pode estar vazio.',
  'events.modal.nameLabel': 'Nome do Evento',
  'events.modal.namePlaceholder': 'Ex: Summit de Inovação 2024',
  'events.modal.saveButton': 'Salvar Alterações',
  'events.modal.createButton': 'Criar Evento',
  'admin.backButton': 'Voltar para Eventos',
  'admin.tabs.checkin': 'Check-in',
  'admin.tabs.register': 'Cadastrar',
  'admin.tabs.suppliers': 'Fornecedores',
  'admin.tabs.supplier_categories': 'Categorias',
  'admin.tabs.sectors': 'Setores',
  'checkin.searchPlaceholder': 'Buscar por nome, CPF ou pulseira...',
  'checkin.stats.checkedIn': 'Check-ins',
  'checkin.stats.pending': 'Pendentes',
  'checkin.stats.total': 'Total',
  'checkin.filter.allStatuses': 'Todos os Status',
  'status.pending': 'Pendente',
  'status.checked_in': 'Check-in Realizado',
  'status.cancelled': 'Cancelado',
  'status.substitution': 'Substituição',
  'status.missed': 'Ausente',
  'checkin.filter.allSupplierCategories': 'Todas as Categorias',
  'checkin.filter.allSuppliers': 'Todos os Fornecedores',
  'checkin.search.noResultsForTerm': 'Nenhum resultado encontrado para "{0}".',
  'checkin.search.noResultsForFilter': 'Nenhum participante encontrado com os filtros atuais.',
  'attendeeCard.supplierLabel': 'Fornecedor',
  'attendeeCard.wristbandNumber': 'Pulseira',
  'verificationModal.title': 'Verificação Facial',
  'verificationModal.registeredPhoto': 'Foto de Cadastro',
  'verificationModal.liveVerification': 'Verificação ao Vivo',
  'verificationModal.confirmButton': 'Confirmar Check-in',
  'webcam.starting': 'Iniciando webcam...',
  'webcam.retakeButton': 'Tirar Outra Foto',
  'webcam.captureButton': 'Capturar Foto',
  'sectors.modal.error': 'O nome do setor não pode estar vazio.',
  'sectors.modal.editTitle': 'Editar Setor',
  'sectors.modal.createTitle': 'Criar Novo Setor',
  'sectors.modal.labelLabel': 'Nome do Setor',
  'sectors.modal.labelPlaceholder': 'Ex: Staff, Imprensa, VIP',
  'sectors.modal.colorLabel': 'Cor de Identificação',
  'sectors.modal.saveButton': 'Salvar Alterações',
  'sectors.modal.createButton': 'Criar Setor',
  'sectors.deleteConfirm': 'Tem certeza que deseja deletar o setor "{0}"? Esta ação não pode ser desfeita.',
  'sectors.deleteErrorInUse': 'O setor "{0}" não pode ser deletado pois está em uso por participantes ou fornecedores.',
  'sectors.title': 'Gerenciamento de Setores',
  'sectors.noSectors': 'Nenhum setor cadastrado.',
  'sectors.noSectorsSubtitle': 'Crie setores para organizar seus participantes.',
  'attendeeDetail.formError': 'Nome e CPF são obrigatórios.',
  'attendeeDetail.deleteConfirm': 'Tem certeza que deseja deletar o participante "{0}"? Esta ação não pode ser desfeita.',
  'attendeeDetail.wristbandLabel': 'Número da Pulseira',
  'attendeeDetail.wristbandPlaceholder': 'Digite ou leia o código da pulseira',
  'attendeeDetail.updateWristbandButton': 'Salvar',
  'attendeeDetail.wristbandUpdateSuccess': 'Pulseira atualizada com sucesso!',
  'statusUpdateModal.confirmCheckin': 'Confirmar Check-in',
  'statusUpdateModal.cancelCheckin': 'Cancelar Check-in (Voltar para Pendente)',
  'statusUpdateModal.reactivateRegistration': 'Reativar Inscrição (Voltar para Pendente)',
  'statusUpdateModal.markAsMissed': 'Marcar como Ausente',
  'statusUpdateModal.allowSubstitution': 'Marcar para Substituição',
  'statusUpdateModal.cancelRegistration': 'Cancelar Inscrição',
  'attendeeDetail.title': 'Detalhes do Participante',
  'attendeeDetail.cancelButton': 'Cancelar',
  'attendeeDetail.saveButton': 'Salvar',
  'statusUpdateModal.currentStatus': 'Status Atual',
  'attendeeDetail.deleteButton': 'Excluir Participante',
  'statusUpdateModal.closeButton': 'Fechar',
  'supplierCategories.form.noNameError': 'O nome da categoria não pode estar vazio.',
  'supplierCategories.deleteConfirm': 'Tem certeza que deseja deletar a categoria "{0}"? Todos os fornecedores associados perderão sua categoria.',
  'supplierCategories.deleteErrorInUse': 'A categoria "{0}" não pode ser deletada pois está em uso por um ou mais fornecedores.',
  'supplierCategories.title': 'Categorias de Fornecedores',
  'supplierCategories.form.namePlaceholder': 'Nome da nova categoria',
  'supplierCategories.createButton': 'Adicionar Categoria',
  'supplierCategories.noCategories': 'Nenhuma categoria cadastrada.',
  'supplierCategories.noCategoriesSubtitle': 'Crie categorias para organizar seus fornecedores.',
  'supplierCategories.form.saveButton': 'Salvar',
  'suppliers.cancelButton': 'Cancelar',
  'register.import.errors.fileType': 'Tipo de arquivo inválido. Por favor, envie um arquivo .csv.',
  'register.import.errors.missingColumns': 'O arquivo CSV não contém as colunas obrigatórias: nome, cpf, setor.',
  'register.import.errors.parsing': 'Ocorreu um erro ao processar o arquivo. Verifique o formato e tente novamente.',
  'register.import.reportTitle': 'Relatório de Importação',
  'register.import.success': '{0} participantes importados com sucesso.',
  'register.import.errors.rowError': 'Linha {0}: {1}',
  'register.import.title': 'Importar via Planilha',
  'register.import.instructions': 'Envie um arquivo CSV com as colunas: nome, cpf, setor.',
  'register.import.downloadTemplate': 'Baixar modelo da planilha',
  'register.import.processing': 'Processando...',
  'register.import.button': 'Selecionar Arquivo CSV',
  'supplierRegistration.closedTitle': 'Inscrições Encerradas',
  'supplierRegistration.closedMessage': 'O período de inscrição para este fornecedor foi encerrado ou o limite foi atingido.',
};

const formatString = (str: string, ...args: any[]) => {
  return str.replace(/{(\d+)}/g, (match, number) => {
    return typeof args[number] !== 'undefined' ? args[number] : match;
  });
};

interface LanguageContextType {
  t: (key: string, ...args: any[]) => string;
}

const LanguageContext = createContext<LanguageContextType>({
  t: (key: string) => key,
});

export const LanguageProvider = ({ children }: { children: ReactNode }) => {
  const t = (key: string, ...args: any[]): string => {
    const translation = translations[key] || key;
    return formatString(translation, ...args);
  };

  return (
    <LanguageContext.Provider value={{ t }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useTranslation = () => useContext(LanguageContext);
