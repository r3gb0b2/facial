import React, { createContext, useContext, useState, ReactNode, PropsWithChildren } from 'react';

// Basic dictionary structure
const translations = {
  pt: {
    // Header & General
    'header.title': 'Reconhecimento Facial',
    'header.subtitle': 'Gestão de Credenciamento',

    // Login
    'login.title': 'Acesso Restrito',
    'login.passwordLabel': 'Senha de Acesso',
    'login.passwordPlaceholder': 'Digite sua senha',
    'login.button': 'Entrar',

    // Events
    'events.title': 'Gerenciador de Eventos',
    'events.noEvents': 'Nenhum evento encontrado.',
    'events.noEventsSubtitle': 'Crie um novo evento para começar a gerenciar os participantes.',
    'events.createButton': 'Criar Novo Evento',
    'events.modal.createTitle': 'Criar Novo Evento',
    'events.modal.editTitle': 'Editar Evento',
    'events.modal.nameLabel': 'Nome do Evento',
    'events.modal.namePlaceholder': 'Ex: Conferência Anual 2024',
    'events.modal.error': 'O nome do evento não pode ser vazio.',
    'events.modal.saveButton': 'Salvar Alterações',
    'events.modal.createButton': 'Criar Evento',

    // Admin
    'admin.tabs.checkin': 'Check-in',
    'admin.tabs.register': 'Cadastrar',
    'admin.tabs.suppliers': 'Fornecedores',
    'admin.tabs.supplierCategories': 'Categorias',
    'admin.tabs.sectors': 'Setores',
    'admin.backButton': 'Voltar para Eventos',

    // Check-in
    'checkin.searchPlaceholder': 'Buscar por nome, CPF ou pulseira...',
    'checkin.stats.checkedIn': 'Presentes',
    'checkin.stats.pending': 'Aguardando',
    'checkin.stats.total': 'Total',
    'checkin.filter.status': 'Filtrar por Status',
    'checkin.filter.supplier': 'Filtrar por Fornecedor',
    'checkin.filter.category': 'Filtrar por Categoria',
    'checkin.filter.allStatuses': 'Todos os Status',
    'checkin.filter.allSuppliers': 'Todos os Fornecedores',
    'checkin.filter.allCategories': 'Todas as Categorias',
    'checkin.search.noResultsForTerm': (term: string) => `Nenhum cadastro encontrado para "${term}".`,
    'checkin.search.noResultsForFilter': 'Nenhum participante encontrado para os filtros selecionados.',


    // Register
    'register.title': 'Cadastrar Participante',
    'register.titleSupplier': (categoryName: string) => `Cadastro de: ${categoryName}`,
    'register.checkingCpf': 'Verificando CPF...',
    'register.cpfFound': 'CPF encontrado. Dados carregados.',
    'register.cpfNotFound': 'CPF não encontrado. Preencha os dados.',
    'register.errors.cpfCheckError': 'Erro ao verificar CPF.',
    'register.errors.cpfCheckIndexError': 'Erro de índice no Firestore. Crie o índice para CPF.',
    'register.errors.allFields': 'Todos os campos são obrigatórios, incluindo a foto.',
    'register.errors.invalidCpf': 'CPF inválido. Deve conter 11 dígitos.',
    'register.errors.noCompanySelected': 'Por favor, selecione sua empresa.',
    'register.errors.limitReachedForCompany': 'O limite de cadastros para esta empresa foi atingido.',
    'register.form.cpfLabel': 'CPF',
    'register.form.cpfPlaceholder': '000.000.000-00',
    'register.form.nameLabel': 'Nome Completo',
    'register.form.namePlaceholder': 'Digite o nome do participante',
    'register.form.sectorLabel': 'Setor',
    'register.form.sectorPlaceholder': 'Selecione um setor',
    'register.form.selectCompanyLabel': 'Selecione sua Empresa',
    'register.form.selectCompanyPlaceholder': 'Escolha uma opção',
    'register.form.button': 'Confirmar Cadastro',
    'register.import.title': 'Importar via Planilha (.csv)',
    'register.import.instructions': 'A planilha deve conter as colunas: nome, cpf, setor.',
    'register.import.downloadTemplate': 'Baixar modelo da planilha',
    'register.import.button': 'Selecionar Arquivo CSV',
    'register.import.processing': 'Processando...',
    'register.import.reportTitle': 'Relatório de Importação',
    'register.import.success': (count: number) => `${count} participante(s) importado(s) com sucesso.`,
    'register.import.errors.fileType': 'Tipo de arquivo inválido. Por favor, envie um arquivo .csv.',
    'register.import.errors.missingColumns': 'A planilha está faltando colunas obrigatórias (nome, cpf, setor).',
    'register.import.errors.parsing': 'Erro ao processar o arquivo.',
    'register.import.errors.rowError': (row: number, message: string) => `Linha ${row}: ${message}`,
    'register.successMessage': 'Cadastro realizado com sucesso!',

    // Suppliers
    'suppliers.generateByCategoryTitle': 'Gerar Link por Categoria',
    'suppliers.selectCategory': 'Selecione uma categoria',
    'suppliers.copyLinkButton': 'Copiar Link da Categoria',
    'suppliers.addCompanyTitle': 'Adicionar Nova Empresa',
    'suppliers.companyNameLabel': 'Nome da Empresa',
    'suppliers.companyNamePlaceholder': 'Ex: Empresa de Segurança Ltda.',
    'suppliers.limitLabel': 'Limite de Cadastros',
    'suppliers.limitPlaceholder': 'Ex: 50',
    'suppliers.sectorsLabel': 'Setores Permitidos',
    'suppliers.addButton': 'Adicionar Empresa',
    'suppliers.existingCompanies': 'Empresas Cadastradas',
    'suppliers.noCompanies': 'Nenhuma empresa cadastrada ainda.',
    'suppliers.registrations': 'Cadastros',
    'suppliers.active': 'Ativo',
    'suppliers.inactive': 'Inativo',
    'suppliers.copyButton': 'Copiar',
    'suppliers.copiedButton': 'Copiado!',
    'suppliers.disableButton': 'Desativar',
    'suppliers.enableButton': 'Ativar',
    'suppliers.editButton': 'Editar',
    'suppliers.deleteButton': 'Deletar',
    'suppliers.cancelButton': 'Cancelar',
    'suppliers.saveButton': 'Salvar',
    'suppliers.noNameError': 'O nome da empresa é obrigatório.',
    'suppliers.noCategoryError': 'Selecione uma categoria.',
    'suppliers.noSectorsError': 'Selecione ao menos um setor.',
    'suppliers.noLimitError': 'O limite de cadastro deve ser um número maior que zero.',
    'suppliers.deleteConfirm': (name: string) => `Tem certeza que deseja deletar a empresa "${name}"? Esta ação não pode ser desfeita.`,
    'suppliers.deleteErrorInUse': (name: string) => `A empresa "${name}" não pode ser excluída pois já possui participantes cadastrados.`,
    
    // Supplier Categories
    'supplierCategories.title': 'Categorias de Fornecedores',
    'supplierCategories.noCategories': 'Nenhuma categoria cadastrada.',
    'supplierCategories.noCategoriesSubtitle': 'Adicione categorias para agrupar suas empresas.',
    'supplierCategories.createButton': 'Criar Nova Categoria',
    'supplierCategories.deleteConfirm': (name: string) => `Tem certeza que deseja deletar a categoria "${name}"?`,
    'supplierCategories.deleteErrorInUse': (name: string) => `A categoria "${name}" não pode ser excluída pois possui empresas vinculadas.`,
    'supplierCategories.modal.createTitle': 'Criar Nova Categoria',
    'supplierCategories.modal.editTitle': 'Editar Categoria',
    'supplierCategories.modal.nameLabel': 'Nome da Categoria',
    'supplierCategories.modal.namePlaceholder': 'Ex: Food Truck, Segurança, Limpeza',
    'supplierCategories.modal.error': 'O nome da categoria não pode ser vazio.',

    // Sectors
    'sectors.title': 'Gerenciar Setores',
    'sectors.noSectors': 'Nenhum setor cadastrado.',
    'sectors.noSectorsSubtitle': 'Adicione setores para organizar os participantes.',
    'sectors.createButton': 'Criar Novo Setor',
    'sectors.deleteConfirm': (label: string) => `Tem certeza que deseja deletar o setor "${label}"? Esta ação não pode ser desfeita.`,
    'sectors.deleteErrorInUse': (label: string) => `O setor "${label}" não pode ser excluído pois está em uso por participantes ou fornecedores.`,
    'sectors.modal.createTitle': 'Criar Novo Setor',
    'sectors.modal.editTitle': 'Editar Setor',
    'sectors.modal.labelLabel': 'Nome do Setor',
    'sectors.modal.labelPlaceholder': 'Ex: Staff, Imprensa, Convidado',
    'sectors.modal.colorLabel': 'Cor da Pulseira',
    'sectors.modal.saveButton': 'Salvar',
    'sectors.modal.createButton': 'Criar Setor',

    // Statuses
    'status.pending': 'PENDENTE',
    'status.checked_in': 'CHECK-IN',
    'status.cancelled': 'CANCELADO',
    'status.substitution': 'SUBSTITUIÇÃO',
    'status.missed': 'AUSENTE',

    // Webcam
    'webcam.starting': 'Iniciando câmera...',
    'webcam.retakeButton': 'Tirar Outra Foto',
    'webcam.captureButton': 'Capturar Foto',
    'webcam.uploadButton': 'Carregar da Galeria',

    // Modals
    'verificationModal.title': 'Verificação de',
    'verificationModal.registeredPhoto': 'Foto Cadastrada',
    'verificationModal.liveVerification': 'Verificação ao Vivo',
    'verificationModal.confirmButton': 'Confirmar Check-in',
    'statusUpdateModal.title': 'Alterar Status',
    'statusUpdateModal.currentStatus': 'Status Atual:',
    'statusUpdateModal.confirmCheckin': 'Confirmar Check-in',
    'statusUpdateModal.cancelCheckin': 'Cancelar Check-in',
    'statusUpdateModal.markAsMissed': 'Marcar como Ausente',
    'statusUpdateModal.allowSubstitution': 'Permitir Substituição',
    'statusUpdateModal.cancelRegistration': 'Cancelar Inscrição',
    'statusUpdateModal.reactivateRegistration': 'Reativar Inscrição',
    'statusUpdateModal.closeButton': 'Fechar',
    'attendeeDetail.title': 'Detalhes do Participante',
    'attendeeDetail.editButton': 'Editar',
    'attendeeDetail.saveButton': 'Salvar',
    'attendeeDetail.updateWristbandButton': 'Atualizar',
    'attendeeDetail.cancelButton': 'Cancelar',
    'attendeeDetail.deleteButton': 'Excluir Cadastro',
    'attendeeDetail.deleteConfirm': (name: string) => `Tem certeza que deseja excluir o cadastro de "${name}"? Esta ação removerá a foto e todos os dados.`,
    'attendeeDetail.formError': 'Nome e CPF são obrigatórios.',
    'attendeeDetail.wristbandLabel': 'Nº da Pulseira (Opcional)',
    'attendeeDetail.wristbandPlaceholder': 'Digite o número',
    'attendeeDetail.wristbandUpdateSuccess': 'Pulseira atualizada com sucesso!',
    'attendeeCard.wristbandNumber': 'Pulseira',
    'attendeeCard.supplierLabel': 'Empresa',

    // Supplier Registration View
    'supplierRegistration.closedTitle': 'Cadastro Encerrado',
    'supplierRegistration.closedMessage': 'O link de cadastro não está mais ativo ou todas as vagas foram preenchidas.',
  },
};

type Language = 'pt';

type TranslationKey = keyof typeof translations.pt;

const LanguageContext = createContext<{
  language: Language;
  t: (key: TranslationKey, ...args: any[]) => string;
}>({
  language: 'pt',
  t: (key) => key,
});

export const LanguageProvider = ({ children }: PropsWithChildren<{}>) => {
  const [currentLanguage] = useState<Language>('pt');

  const t = (key: TranslationKey, ...args: any[]): string => {
    const translation = translations[currentLanguage][key];
    if (typeof translation === 'function') {
        return (translation as (...args: any[]) => string)(...args);
    }
    return translation || key;
  };

  return (
    <LanguageContext.Provider value={{ language: currentLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useTranslation = () => useContext(LanguageContext);
