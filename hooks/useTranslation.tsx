import React,
{
  createContext,
  useState,
  useContext,
  ReactNode,
  useCallback
} from 'react';

// Basic translations structure
const translations = {
  pt: {
    // Login
    'login.title': 'Acessar Painel',
    'login.usernameLabel': 'Usuário',
    'login.usernamePlaceholder': 'Digite seu usuário',
    'login.passwordLabel': 'Senha',
    'login.passwordPlaceholder': 'Digite sua senha',
    'login.button': 'Entrar',

    // Events
    'events.title': 'Selecione o Evento',
    'events.createButton': 'Criar Novo Evento',
    'events.modal.createTitle': 'Criar Novo Evento',
    'events.modal.editTitle': 'Editar Evento',
    'events.modal.nameLabel': 'Nome do Evento',
    'events.modal.namePlaceholder': 'Ex: Conferência Anual 2024',
    'events.modal.saveButton': 'Salvar Alterações',
    'events.modal.createButton': 'Criar Evento',
    'events.modal.error': 'O nome do evento não pode ser vazio.',
    'events.deleteConfirm': 'Tem certeza que deseja deletar o evento "{eventName}"? Esta ação não pode ser desfeita e removerá todos os dados associados.',

    // Register
    'register.title': 'Cadastrar Colaborador',
    'register.checkingCpf': 'Verificando CPF...',
    'register.cpfAlreadyRegistered': 'Este CPF já está cadastrado neste evento.',
    'register.cpfFound': 'CPF encontrado em outro evento. Dados preenchidos.',
    'register.cpfNotFound': 'CPF não encontrado. Preencha os dados.',
    'register.errors.allFields': 'Todos os campos (nome, CPF, foto e setor) são obrigatórios.',
    'register.errors.invalidCpf': 'CPF inválido. Deve conter 11 dígitos.',
    'register.errors.subCompanyRequired': 'A seleção de uma Empresa/Unidade é obrigatória para este fornecedor.',
    'register.errors.cpfCheckError': 'Erro ao verificar o CPF. Tente novamente.',
    'register.errors.cpfCheckIndexError': 'Erro de configuração do banco de dados (índice ausente). Contate o suporte.',
    'register.form.cpfLabel': 'CPF',
    'register.form.cpfPlaceholder': '000.000.000-00',
    'register.form.nameLabel': 'Nome Completo',
    'register.form.namePlaceholder': 'Digite o nome completo',
    'register.form.supplierLabel': 'Fornecedor (Opcional)',
    'register.form.supplierPlaceholder': 'Selecione um fornecedor',
    'register.form.sectorLabel': 'Setor',
    'register.form.sectorPlaceholder': 'Selecione um setor',
    'register.form.subCompanyLabel': 'Empresa / Unidade',
    'register.form.subCompanyLabelOptional': 'Empresa / Unidade (Opcional)',
    'register.form.subCompanyPlaceholder': 'Selecione uma empresa/unidade',
    'register.form.subCompanyInputPlaceholder': 'Digite o nome da empresa',
    'register.form.button': 'Registrar',
    'register.successMessage': 'Colaborador registrado com sucesso!',
    'register.photoLocked': 'A foto não pode ser alterada pois o CPF já possui um cadastro.',

    // Webcam
    'webcam.starting': 'Iniciando câmera...',
    'webcam.captureButton': 'Capturar Foto',
    'webcam.retakeButton': 'Tirar Outra Foto',
    'webcam.uploadButton': 'Enviar Arquivo',
    
    // Status
    'status.pending': 'Pendente',
    'status.checked_in': 'Presente',
    'status.checked_out': 'Saiu',
    'status.cancelled': 'Cancelado',
    'status.substitution': 'Substituído',
    'status.substitution_request': 'Subst. Solicitada',
    'status.sector_change_request': 'Troca Solicitada',
    'status.missed': 'Ausente',
    'status.pending_approval': 'Aprovação Pendente',
    
    // Check-in View
    'checkin.searchPlaceholder': 'Buscar por nome, CPF, pulseira ou empresa...',
    'checkin.filter.searchBy.all': 'Buscar por Tudo',
    'checkin.filter.searchBy.name': 'Nome',
    'checkin.filter.searchBy.cpf': 'CPF',
    'checkin.filter.searchBy.wristband': 'Pulseira',
    'checkin.filter.allStatuses': 'Todos os Status',
    'checkin.filter.allSuppliers': 'Todos os Fornecedores',
    'checkin.stats.checkedIn': 'Presentes',
    'checkin.stats.pending': 'Pendentes',
    'checkin.stats.total': 'Total',
    'checkin.search.noResultsForTerm': 'Nenhum resultado encontrado para "{term}".',
    'checkin.search.noResultsForFilter': 'Nenhum colaborador encontrado com os filtros atuais.',
    'checkin.exportExcelButton': 'Exportar para Excel',

    // Attendee Card
    'attendeeCard.supplierLabel': 'Fornecedor',
    'attendeeCard.wristbandNumber': 'Pulseira',
    
    // Attendee Detail Modal
    'attendeeDetail.formError': 'Nome, CPF e Setor são obrigatórios.',
    'attendeeDetail.deleteConfirm': 'Tem certeza que deseja remover {name} permanentemente?',
    'attendeeDetail.wristbandsDuplicateError': 'A(s) pulseira(s) {numbers} já está(ão) em uso.',
    'attendeeDetail.wristbandUpdateSuccess': 'Pulseira(s) salva(s) com sucesso!',
    'attendeeDetail.checkinTime': 'Horário de Entrada',
    'attendeeDetail.checkoutTime': 'Horário de Saída',
    'attendeeDetail.substitutionRequestTitle': 'Aprovar Substituição',
    'attendeeDetail.originalData': 'Dados Originais',
    'attendeeDetail.newData': 'Novos Dados',
    'attendeeDetail.rejectButton': 'Rejeitar',
    'attendeeDetail.approveButton': 'Aprovar',
    'attendeeDetail.cancelButton': 'Cancelar',
    'attendeeDetail.saveButton': 'Salvar',
    'attendeeDetail.deleteButton': 'Excluir Colaborador',
    'attendeeDetail.confirmCheckout': 'Confirmar Saída',
    'attendeeDetail.reactivateCheckin': 'Reativar Check-in (Reentrada)',
    'attendeeDetail.sectorChangeRequestTitle': 'Aprovar Troca de Setor',
    'attendeeDetail.currentSector': 'Setor Atual',
    'attendeeDetail.requestedSector': 'Setor Solicitado',
    'attendeeDetail.justification': 'Justificativa',
    'attendeeDetail.rejectSectorChangeButton': 'Rejeitar Troca',
    'attendeeDetail.approveSectorChangeButton': 'Aprovar Troca',
    'attendeeDetail.approveRegistrationButton': 'Aprovar Cadastro',
    'attendeeDetail.rejectRegistrationButton': 'Rejeitar Cadastro',
    'attendeeDetail.qrCodeTitle': 'QR Code para Acesso',
    'attendeeDetail.wristbandLabel': 'Nº da Pulseira',
    'attendeeDetail.wristbandPlaceholder': 'Digite o número da pulseira',
    
    // Status Update Modal
    'statusUpdateModal.confirmCheckin': 'Confirmar Check-in',
    'statusUpdateModal.cancelRegistration': 'Cancelar Cadastro',
    'statusUpdateModal.markAsMissed': 'Marcar como Ausente',
    'statusUpdateModal.cancelCheckin': 'Cancelar Check-in',
    'statusUpdateModal.reactivateRegistration': 'Reativar Cadastro',

    // Verification Modal
    'verificationModal.title': 'Verificação Facial para',
    'verificationModal.registeredPhoto': 'Foto Cadastrada',
    'verificationModal.liveVerification': 'Verificação ao Vivo',
    'verificationModal.confirmButton': 'Confirmar Check-in Manual',
    
    // Supplier Management
    'suppliers.generateTitle': 'Gerenciar Fornecedores',
    'suppliers.generateButton': 'Criar Fornecedor',
    'suppliers.nameLabel': 'Nome do Fornecedor',
    'suppliers.namePlaceholder': 'Ex: Empresa de Limpeza',
    'suppliers.limitLabel': 'Limite de Cadastros',
    'suppliers.limitPlaceholder': 'Ex: 50',
    'suppliers.sectorsLabel': 'Setores Permitidos',
    'suppliers.noNameError': 'O nome do fornecedor é obrigatório.',
    'suppliers.noSectorsError': 'Selecione ao menos um setor.',
    'suppliers.noLimitError': 'O limite de cadastros deve ser um número maior que zero.',
    'suppliers.existingLinks': 'Fornecedores Cadastrados',
    'suppliers.noLinks': 'Nenhum fornecedor cadastrado para este evento.',
    'suppliers.registrations': 'Cadastros',
    'suppliers.active': 'Ativo',
    'suppliers.inactive': 'Inativo',
    'suppliers.disableButton': 'Desativar link',
    'suppliers.enableButton': 'Ativar link',
    'suppliers.copyButton': 'Copiar link de cadastro',
    'suppliers.editButton': 'Editar',
    'suppliers.deleteButton': 'Excluir',
    'suppliers.deleteConfirm': 'Tem certeza que deseja deletar o fornecedor "{supplierName}"? Esta ação não pode ser desfeita.',
    'suppliers.deleteErrorInUse': 'O fornecedor "{supplierName}" não pode ser excluído pois possui colaboradores cadastrados.',
    'suppliers.subCompaniesLabel': 'Empresas / Unidades (Opcional)',
    'suppliers.subCompaniesPlaceholder': 'Nome da Empresa/Unidade',
    'suppliers.subCompanySectorPlaceholder': 'Setor',
    'suppliers.addSubCompanyButton': 'Adicionar',
    'suppliers.cancelButton': 'Cancelar',
    'suppliers.saveButton': 'Salvar',
    'suppliers.adminLink.copyTooltip': 'Copiar link de visualização',
    'suppliers.adminLink.regenerateTooltip': 'Gerar novo link de visualização',

    // Company Management
    'companies.title': 'Gerenciar por Empresa/Unidade',
    'companies.noCompanies': 'Nenhuma empresa/unidade encontrada.',
    'companies.noCompaniesSubtitle': 'Cadastre colaboradores informando a empresa/unidade para agrupá-los aqui.',
    'companies.attendeeCount': '{count} colaborador(es)',
    'companies.selectAll': 'Selecionar todos',
    'companies.selectedCount': '{count} selecionado(s)',
    'companies.editSelectedButton': 'Editar Setores',
    'companies.modal.bulkUpdateTitle': 'Atualizar Setores para {count} Colaboradores',
    'companies.modal.bulkUpdateDescription': 'Selecione os novos setores que serão aplicados a todos os colaboradores selecionados. A configuração de setores atual deles será substituída.',
    'companies.modal.saveButton': 'Aplicar e Salvar',

    // Sectors
    'sectors.title': 'Gerenciar Setores',
    'sectors.createButton': 'Criar Novo Setor',
    'sectors.noSectors': 'Nenhum setor cadastrado.',
    'sectors.noSectorsSubtitle': 'Crie setores para organizar seus colaboradores.',
    'sectors.modal.createTitle': 'Criar Novo Setor',
    'sectors.modal.editTitle': 'Editar Setor',
    'sectors.modal.labelLabel': 'Nome do Setor',
    'sectors.modal.labelPlaceholder': 'Ex: Staff',
    'sectors.modal.colorLabel': 'Cor de Identificação',
    'sectors.modal.error': 'O nome do setor é obrigatório.',
    'sectors.modal.saveButton': 'Salvar Alterações',
    // FIX: Add missing translation key to fix type error.
    'sectors.modal.createButton': 'Criar Setor',
    'sectors.deleteConfirm': 'Tem certeza que deseja deletar o setor "{sectorLabel}"? Esta ação não pode ser desfeita.',
    'sectors.deleteErrorInUse': 'O setor "{sectorLabel}" não pode ser excluído pois está em uso por fornecedores ou colaboradores.',
    
    // Spreadsheet
    'spreadsheet.title': 'Importar via Planilha',
    'spreadsheet.description': 'Envie um arquivo CSV, XLS ou XLSX para cadastrar múltiplos colaboradores de uma vez.',
    'spreadsheet.requiredColumns': 'Colunas obrigatórias: <b>name</b>, <b>cpf</b>, <b>sector</b>.',
    'spreadsheet.optionalColumns': 'Colunas opcionais: <b>fornecedor</b>, <b>empresa</b>.',
    'spreadsheet.button.choose': 'Escolher Arquivo',
    'spreadsheet.button.processing': 'Processando...',
    'spreadsheet.button.downloadTemplate': 'Baixar modelo CSV',
    'spreadsheet.error.emptyFile': 'O arquivo está vazio ou não possui dados.',
    'spreadsheet.error.readFile': 'Erro ao ler o arquivo: {message}',
    'spreadsheet.error.unsupportedFile': 'Tipo de arquivo não suportado. Use .csv, .xls, or .xlsx.',

    // Supplier Registration (external page)
    'supplierRegistration.closedTitle': 'Cadastros Encerrados',
    'supplierRegistration.closedMessage': 'O link de cadastro não está ativo ou o limite de inscrições foi atingido.',
    
    // Supplier Admin (read-only view)
    'supplierAdmin.title': 'Painel do Fornecedor',
    'supplierAdmin.supplier': 'Fornecedor',
    'supplierAdmin.filter.searchPlaceholder': 'Buscar por nome...',
    'supplierAdmin.filter.allCompanies': 'Todas as Empresas',
    'supplierAdmin.registerButton': 'Novo Cadastro',
    'supplierAdmin.noAttendees': 'Nenhum colaborador cadastrado por este link ainda.',
    'supplierAdmin.requestEdit': 'Solicitar Alteração',
    'supplierAdmin.editRequested': 'Alteração Solicitada',
    'supplierAdmin.modal.title': 'Solicitar Novo Cadastro',
    'supplierAdmin.modal.submitButton': 'Enviar para Aprovação',
    'supplierAdmin.modal.successMessage': 'Solicitação de cadastro enviada com sucesso! Aguardando aprovação do administrador.',
    
    // Substitution/Edit Modal
    'editModal.title': 'Solicitar Alteração para',
    'editModal.newData': 'Informar Novos Dados',
    'editModal.submitButton': 'Enviar para Aprovação',
    'substitutionModal.formError': 'Todos os campos (nome, CPF, foto e setor) são obrigatórios.',
    
    // QR Code Scanner
    'qrScanner.title': 'Scanner de QR Code',
    'qrScanner.scanning': 'Aponte a câmera para um QR Code...',
    'qrScanner.start': 'Iniciar Leitura',
    'qrScanner.stop': 'Parar Leitura',
    'qrScanner.permissionError': 'Permissão da câmera negada. Verifique as configurações do seu navegador.',
    'qrScanner.invalidCode': 'Código QR inválido ou ilegível.',
    'qrScanner.attendeeFound': 'Colaborador encontrado!',
    'qrScanner.noAttendee': 'Nenhum colaborador encontrado com esta pulseira.',
    'qrScanner.reentry': 'Confirmar Reentrada',
    'qrScanner.scanNext': 'Ler Próximo',
    
    // Wristband Report
    'wristbandReport.title': 'Relatório de Pulseiras',
    'wristbandReport.stats.deliveredOf': '{delivered} de {total} entregues',
    'wristbandReport.searchPlaceholder': 'Buscar por nome, CPF ou pulseira...',
    'wristbandReport.filter.allSectors': 'Todos os Setores',
    'wristbandReport.list.header.name': 'Nome',
    'wristbandReport.list.header.wristband': 'Nº da Pulseira',
    'wristbandReport.list.header.sector': 'Setor',
    'wristbandReport.list.header.color': 'Cor',
    'wristbandReport.noWristbands': 'Nenhuma pulseira foi entregue ainda.',
    'wristbandReport.noResults': 'Nenhum resultado encontrado com os filtros atuais.',
    
    // Check-in Log
    'checkinLog.title': 'Histórico de Atividade',
    'checkinLog.searchPlaceholder': 'Buscar por nome ou CPF...',
    'checkinLog.header.attendee': 'Colaborador',
    'checkinLog.header.action': 'Ação',
    'checkinLog.header.timestamp': 'Horário',
    'checkinLog.action.checkin': 'Check-in',
    'checkinLog.action.checkout': 'Check-out',
    'checkinLog.noLogs': 'Nenhuma atividade de check-in ou check-out registrada ainda.',
    'checkinLog.noResults': 'Nenhum registro encontrado com os filtros atuais.',
    
    // Users
    'users.title': 'Gerenciar Usuários',
    'users.createUserButton': 'Criar Novo Usuário',
    'users.noUsers': 'Nenhum usuário cadastrado.',
    'users.deleteConfirm': 'Tem certeza que deseja deletar o usuário "{username}"?',
    'users.table.username': 'Usuário',
    'users.table.role': 'Função',
    'users.table.events': 'Eventos Vinculados',
    'users.table.actions': 'Ações',
    'users.modal.createTitle': 'Criar Novo Usuário',
    'users.modal.editTitle': 'Editar Usuário',
    'users.modal.usernameLabel': 'Nome de Usuário',
    'users.modal.passwordLabel': 'Senha',
    'users.modal.passwordPlaceholderEdit': 'Deixe em branco para não alterar',
    'users.modal.roleLabel': 'Função',
    'users.modal.eventsLabel': 'Vincular Eventos',
    'users.modal.eventsDescription': 'Este usuário só poderá acessar os eventos selecionados.',
    'users.modal.error.usernameRequired': 'O nome de usuário é obrigatório.',
    'users.modal.error.passwordRequired': 'A senha é obrigatória para novos usuários.',
    
    // Errors
    'errors.registrationLimitReached': 'O limite de cadastros para este fornecedor foi atingido.',
    'errors.generic': 'Ocorreu um erro inesperado.',
  },
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
  const [language, setLanguage] = useState<Language>('pt');

  // FIX: Loosen key type to string to support dynamic keys
  const t = useCallback((key: string, ...args: (string | number | Record<string, string | number>)[]) => {
    // FIX: Cast key to TranslationKey for object lookup to satisfy TypeScript
    let translation: string = translations[language][key as TranslationKey] || key;
    
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
  }, [language]);

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