import { Supplier } from './types';

// =================================================================================================
// 🚀 GESTÃO DE FORNECEDORES
// Adicione ou edite os fornecedores nesta lista.
// - id: O identificador único que será usado no link (URL). Ex: ?supplier=equipe-bar
// - name: O nome do fornecedor que aparecerá na página de registro.
// - sector: O valor do setor que será salvo automaticamente para os participantes registrados através deste link.
//           (O valor deve corresponder a um dos 'value' nos setores definidos em pt.json)
// =================================================================================================

export const suppliers: Supplier[] = [
  { id: 'equipe-bar', name: 'Equipe do Bar', sector: 'bar' },
  { id: 'equipe-portaria', name: 'Equipe da Portaria', sector: 'portaria' },
  { id: 'equipe-acessos', name: 'Equipe de Acessos', sector: 'acessos' },
  { id: 'equipe-producao', name: 'Equipe de Produção', sector: 'producao' },
];
