// FIX: Implemented the useTranslation hook and LanguageProvider to resolve module not found errors.
import React, { createContext, useContext, ReactNode } from 'react';

// Basic dictionary for Portuguese translations based on keys found in the app.
const translations = {
  'webcam.starting': 'Iniciando câmera...',
  'webcam.retakeButton': 'Tirar Outra Foto',
  'webcam.captureButton': 'Capturar Foto',
  'webcam.uploadButton': 'Enviar Arquivo',
  'status.pending': 'Pendente',
  'status.checked_in': 'Check-in Realizado',
  'status.cancelled': 'Cancelado',
  'status.substitution': 'Substituição',
  'status.missed': 'Ausente',
  'attendeeCard.supplierLabel': 'Fornecedor',
  'attendeeCard.wristbandNumber': 'Pulseira',
  'verificationModal.title': 'Verificação Facial para',
  'verificationModal.registeredPhoto': 'Foto Cadastrada',
  'verificationModal.liveVerification': 'Verificação ao Vivo',
  'verificationModal.confirmButton': 'Confirmar Check-in',
  'register.checkingCpf': 'Verificando CPF...',
  'register.cpfFound': 'CPF encontrado. Dados preenchidos.',
  'register.cpfNotFound': 'CPF não encontrado. Prossiga com o cadastro.',
  'register.errors.cpfCheckError': 'Erro ao verificar CPF.',
  'register.errors.noCompanySelected': 'Por favor, selecione uma empresa.',
  'register.errors.allFields': 'Todos os campos são obrigatórios.',
  'register.errors.invalidCpf': 'CPF inválido.',
  'register.successMessage': 'Participante registrado com sucesso!',
  'register.title': 'Registrar Novo Participante',
  'register.titleSupplier': 'Registrar para {0}',
  'register.form.selectCompanyLabel': 'Selecione a Empresa',
  'register.form.selectCompanyPlaceholder': 'Escolha uma empresa...',
  'register.form.cpfLabel': 'CPF',
  'register.form.cpfPlaceholder': '000.000.000-00',
  'register.form.nameLabel': 'Nome Completo',
  'register.form.namePlaceholder': 'Digite o nome completo',
  'register.form.sectorLabel': 'Setor',
  'register.form.sectorPlaceholder': 'Selecione um setor',
  'register.form.button': 'Registrar Participante',
  'checkin.searchPlaceholder': 'Buscar por nome, CPF ou pulseira...',
  'checkin.stats.checkedIn': 'Check-ins',
  'checkin.stats.pending': 'Pendentes',
  'checkin.stats.total': 'Total',
  'checkin.filter.allStatuses': 'Todos os Status',
  'checkin.filter.allCategories': 'Todas as Categorias',
  'checkin.filter.allSuppliers': 'Todos os Fornecedores',
  'checkin.search.noResultsForTerm': 'Nenhum resultado para "{0}".',
  'checkin.search.noResultsForFilter': 'Nenhum participante encontrado com os filtros atuais.',
  'events.modal.error': 'O nome do evento não pode ficar em branco.',
  'events.modal.editTitle': 'Editar Evento',
  'events.modal.createTitle': 'Criar Novo Evento',
  'events.modal.nameLabel': 'Nome do Evento',
  'events.modal.namePlaceholder': 'Ex: Evento de Lançamento 2024',
  'events.modal.saveButton': 'Salvar Alterações',
  'events.modal.createButton': 'Criar Evento',
  'events.title': 'Gerenciador de Eventos',
  'header.subtitle': 'Selecione um evento para começar ou crie um novo.',
  'events.noEvents': 'Nenhum evento encontrado.',
  'events.noEventsSubtitle': 'Crie seu primeiro evento para começar a gerenciar os participantes.',
  'login.title': 'Acesso Administrativo',
  'login.passwordLabel': 'Senha de Acesso',
  'login.passwordPlaceholder': 'Digite sua senha',
  'login.button': 'Entrar',
  'supplierRegistration.closedTitle': 'Inscrições Encerradas',
  'supplierRegistration.closedMessage': 'O período de inscrições para este link foi encerrado ou o limite foi atingido. Entre em contato com o organizador do evento.',
  'suppliers.noNameError': 'O nome da empresa é obrigatório.',
  'suppliers.noCategoryError': 'A categoria é obrigatória.',
  'suppliers.noSectorsError': 'Selecione pelo menos um setor.',
  'suppliers.noLimitError': 'O limite de inscrições deve ser um número maior que zero.',
  'suppliers.deleteConfirm': 'Tem certeza que deseja deletar o fornecedor "{0}"? Esta ação não pode ser desfeita.',
  'suppliers.deleteErrorInUse': 'O fornecedor "{0}" não pode ser deletado pois já possui participantes cadastrados.',
  'suppliers.generateByCategoryTitle': 'Link de Inscrição por Categoria',
  'suppliers.selectCategory': 'Selecione uma categoria...',
  'suppliers.copiedButton': 'Copiado!',
  'suppliers.copyLinkButton': 'Copiar Link',
  'suppliers.addCompanyTitle': 'Adicionar Novo Fornecedor',
  'admin.tabs.supplierCategories': 'Categoria',
  'suppliers.companyNameLabel': 'Nome da Empresa',
  'suppliers.companyNamePlaceholder': 'Ex: Empresa de Segurança',
  'suppliers.limitLabel': 'Limite de Inscrições',
  'suppliers.limitPlaceholder': 'Ex: 50',
  'suppliers.sectorsLabel': 'Setores Permitidos',
  'suppliers.addButton': 'Adicionar Fornecedor',
  'suppliers.existingCompanies': 'Fornecedores Existentes',
  'suppliers.cancelButton': 'Cancelar',
  'suppliers.saveButton': 'Salvar',
  'suppliers.active': 'Ativo',
  'suppliers.inactive': 'Inativo',
  'suppliers.registrations': 'Inscrições',
  'suppliers.disableButton': 'Desativar',
  'suppliers.enableButton': 'Ativar',
  'suppliers.noCompanies': 'Nenhum fornecedor cadastrado.',
  'sectors.modal.error': 'O nome do setor é obrigatório.',
  'sectors.modal.editTitle': 'Editar Setor',
  'sectors.modal.createTitle': 'Criar Novo Setor',
  'sectors.modal.labelLabel': 'Nome do Setor',
  'sectors.modal.labelPlaceholder': 'Ex: Staff',
  'sectors.modal.colorLabel': 'Cor de Identificação',
  'sectors.modal.createButton': 'Criar Setor',
  'sectors.deleteConfirm': 'Tem certeza que deseja deletar o setor "{0}"? Setores em uso por participantes ou fornecedores não podem ser deletados.',
  'sectors.deleteErrorInUse': 'O setor "{0}" não pode ser deletado pois está em uso.',
  'sectors.title': 'Gerenciamento de Setores',
  'sectors.noSectors': 'Nenhum setor encontrado.',
  'sectors.noSectorsSubtitle': 'Crie setores para organizar seus participantes.',
  'register.import.errors.fileType': 'Tipo de arquivo inválido. Por favor, envie um arquivo .csv.',
  'register.import.errors.missingColumns': 'O arquivo CSV não contém as colunas necessárias (nome, cpf, setor).',
  'register.import.errors.parsing': 'Ocorreu um erro ao processar o arquivo.',
  'register.import.downloadTemplate': 'Baixar modelo de planilha (.csv)',
  'register.import.title': 'Importar via Planilha',
  'register.import.instructions': 'Importe múltiplos participantes de uma vez usando um arquivo .csv com as colunas: nome, cpf, setor.',
  'register.import.processing': 'Processando...',
  'register.import.button': 'Escolher Arquivo .csv',
  'register.import.reportTitle': 'Relatório de Importação',
  'register.import.success': '{0} participantes importados com sucesso.',
  'register.import.errors.rowError': 'Linha {0}: {1}',
  'attendeeDetail.formError': 'Nome e CPF são obrigatórios.',
  'attendeeDetail.deleteConfirm': 'Tem certeza que deseja deletar permanentemente o participante "{0}"?',
  'attendeeDetail.updateWristbandButton': 'Atualizar',
  'attendeeDetail.wristbandUpdateSuccess': 'Pulseira atualizada!',
  'statusUpdateModal.confirmCheckin': 'Confirmar Check-in',
  'attendeeDetail.wristbandLabel': 'Número da Pulseira',
  'attendeeDetail.wristbandPlaceholder': 'Digite o número da pulseira',
  'statusUpdateModal.cancelCheckin': 'Cancelar Check-in (Voltar para Pendente)',
  'statusUpdateModal.reactivateRegistration': 'Reativar Cadastro (Voltar para Pendente)',
  'statusUpdateModal.markAsMissed': 'Marcar como Ausente',
  'statusUpdateModal.allowSubstitution': 'Liberar para Substituição',
  'statusUpdateModal.cancelRegistration': 'Cancelar Inscrição',
  'attendeeDetail.title': 'Detalhes do Participante',
  'attendeeDetail.cancelButton': 'Cancelar',
  'attendeeDetail.saveButton': 'Salvar',
  'statusUpdateModal.currentStatus': 'Status Atual',
  'attendeeDetail.deleteButton': 'Deletar Participante',
  'statusUpdateModal.closeButton': 'Fechar',
  'supplierCategories.modal.error': 'O nome da categoria é obrigatório.',
  'supplierCategories.modal.editTitle': 'Editar Categoria',
  'supplierCategories.modal.createTitle': 'Criar Nova Categoria',
  'supplierCategories.modal.nameLabel': 'Nome da Categoria',
  'supplierCategories.modal.namePlaceholder': 'Ex: Limpeza, Segurança, Buffet',
  'supplierCategories.deleteErrorInUse': 'A categoria "{0}" não pode ser deletada pois possui fornecedores associados.',
  'supplierCategories.deleteConfirm': 'Tem certeza que deseja deletar a categoria "{0}"?',
  'supplierCategories.title': 'Gerenciar Categorias de Fornecedores',
  'supplierCategories.noCategories': 'Nenhuma categoria encontrada.',
  'supplierCategories.noCategoriesSubtitle': 'Crie categorias para organizar seus fornecedores.',
  'supplierCategories.createButton': 'Criar Nova Categoria',
};

type LanguageContextType = {
  t: (key: string, ...args: any[]) => string;
};

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const LanguageProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const t = (key: string, ...args: any[]): string => {
    let translation = (translations as any)[key] || key;
    if (args.length > 0) {
        args.forEach((arg, index) => {
            translation = translation.replace(`{${index}}`, arg);
        });
    }
    return translation;
  };

  return (
    <LanguageContext.Provider value={{ t }}>
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
