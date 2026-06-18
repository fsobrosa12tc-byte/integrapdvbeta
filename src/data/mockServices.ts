/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { ServiceItem, ClientProfile, Transaction } from '../types';

export const MOCK_SERVICES: ServiceItem[] = [
  {
    id: 'srv-1',
    name: 'IPVA Estuadual - Exercício Corrente',
    type: 'DETRAN',
    baseValue: '485.50',
    description: 'Imposto estadual obrigatório sobre propriedade de veículos.'
  },
  {
    id: 'srv-2',
    name: 'Taxa Licenciamento Anual Detran',
    type: 'DETRAN',
    baseValue: '162.20',
    description: 'Taxa para atualização do CRLV Digital.'
  },
  {
    id: 'srv-3',
    name: 'Transferência de Propriedade Veicular',
    type: 'DETRAN',
    baseValue: '286.40',
    description: 'Taxa do governo de transferência de titularidade.'
  },
  {
    id: 'srv-4',
    name: 'Primeiro Emplacamento e Emissão CRV',
    type: 'DETRAN',
    baseValue: '350.00',
    description: 'Taxa pública para veículos novos zero quilômetro.'
  },
  {
    id: 'srv-5',
    name: 'Serviço de Acompanhamento de Emplacamento',
    type: 'OUTROS',
    baseValue: '250.00',
    description: 'Acompanhamento do processo de emplaquetagem.'
  },
  {
    id: 'srv-6',
    name: 'Assessoria no Processamento de Transferência Regional',
    type: 'OUTROS',
    baseValue: '180.00',
    description: 'Assessoria jurídica e administrativa da Marks Systems.'
  },
  {
    id: 'srv-7',
    name: 'Serviço de Liberação de Veículo Apreendido',
    type: 'OUTROS',
    baseValue: '450.00',
    description: 'Desembaraço de pendências junto aos pátios do Detran.'
  },
  {
    id: 'srv-8',
    name: 'Par de Placas Físicas Padrão Mercosul',
    type: 'OUTROS',
    baseValue: '140.00',
    description: 'Estamparia física autorizada pela regulamentação.'
  },
  {
    id: 'srv-9',
    name: 'Sedex Expresso - Entrega Documentação',
    type: 'OUTROS',
    baseValue: '32.90',
    description: 'Postagem com aviso de recebimento para o endereço do cliente.'
  }
];

export const MOCK_CLIENTS: ClientProfile[] = [
  {
    id: 'clt-1',
    name: 'Silva & Filhos Comércio de Automóveis',
    cpfCnpj: '12.345.678/0001-99',
    phone: '(51) 99912-3456',
    outstandingBalance: '1435.50',
    guiasPendentes: 5,
    category: 'Despachante Credenciado',
    status: 'Ativo'
  },
  {
    id: 'clt-2',
    name: 'Marcos de Oliveira Andrade',
    cpfCnpj: '839.201.481-22',
    phone: '(51) 98214-3849',
    outstandingBalance: '0.00',
    guiasPendentes: 0,
    category: 'Particular',
    status: 'Ativo'
  },
  {
    id: 'clt-3',
    name: 'Nacional Locadora de Frotas S.A.',
    cpfCnpj: '45.102.392/0001-44',
    phone: '(51) 98111-4040',
    outstandingBalance: '3450.00',
    guiasPendentes: 12,
    category: 'Despachante Credenciado',
    status: 'Ativo'
  },
  {
    id: 'clt-4',
    name: 'Juliana Mendes Rezende',
    cpfCnpj: '231.549.689-10',
    phone: '(51) 99344-2211',
    outstandingBalance: '0.00',
    guiasPendentes: 0,
    category: 'Particular',
    status: 'Ativo'
  }
];

export const INITIAL_TRANSACTIONS: Transaction[] = [
  {
    id: 'tx-1',
    sequenceId: 'INT-4001',
    timestamp: '2026-06-13T09:15:00.000Z',
    clientName: 'Marcos de Oliveira Andrade',
    clientCpfCnpj: '839.201.481-22',
    clientCategory: 'Particular',
    items: [
      { serviceName: 'Taxa Licenciamento Anual Detran', type: 'DETRAN', value: '162.20', quantity: 1, subtotal: '162.20' },
      { serviceName: 'Assessoria no Processamento de Transferência Regional', type: 'OUTROS', value: '180.00', quantity: 1, subtotal: '180.00' }
    ],
    detranSubtotal: '162.20',
    honorariosSubtotal: '180.00',
    otherSubtotal: '0.00',
    netTotal: '342.20',
    paymentMethod: 'PIX',
    installments: 1,
    status: 'PAID',
    createdBy: {
      userId: 'usr-102',
      userName: 'Ana Caixa',
      userRole: 'Operador',
      rlsScope: 'TENANT_PASS_FUNDO_01'
    }
  },
  {
    id: 'tx-2',
    sequenceId: 'INT-4002',
    timestamp: '2026-06-13T11:30:00.000Z',
    clientName: 'Juliana Mendes Rezende',
    clientCpfCnpj: '231.549.689-10',
    clientCategory: 'Particular',
    items: [
      { serviceName: 'Par de Placas Físicas Padrão Mercosul', type: 'OUTROS', value: '140.00', quantity: 1, subtotal: '140.00' },
      { serviceName: 'Serviço de Acompanhamento de Emplacamento', type: 'OUTROS', value: '250.00', quantity: 1, subtotal: '250.00' }
    ],
    detranSubtotal: '0.00',
    honorariosSubtotal: '390.00',
    otherSubtotal: '0.00',
    netTotal: '390.00',
    paymentMethod: 'CASH',
    installments: 1,
    status: 'PAID',
    createdBy: {
      userId: 'usr-102',
      userName: 'Ana Caixa',
      userRole: 'Operador',
      rlsScope: 'TENANT_PASS_FUNDO_01'
    }
  },
  {
    id: 'tx-3',
    sequenceId: 'INT-4003',
    timestamp: '2026-06-13T14:45:00.000Z',
    clientName: 'Silva & Filhos Comércio de Automóveis',
    clientCpfCnpj: '12.345.678/0001-99',
    clientCategory: 'Despachante Credenciado',
    items: [
      { serviceName: 'IPVA Estuadual - Exercício Corrente', type: 'DETRAN', value: '485.50', quantity: 2, subtotal: '971.00' },
      { serviceName: 'Assessoria no Processamento de Transferência Regional', type: 'OUTROS', value: '180.00', quantity: 2, subtotal: '360.00' }
    ],
    detranSubtotal: '971.00',
    honorariosSubtotal: '360.00',
    otherSubtotal: '0.00',
    netTotal: '1331.00',
    paymentMethod: 'CREDIT_CARD',
    installments: 3,
    status: 'PAID',
    createdBy: {
      userId: 'usr-102',
      userName: 'Ana Caixa',
      userRole: 'Operador',
      rlsScope: 'TENANT_PASS_FUNDO_01'
    }
  },
  {
    id: 'tx-4',
    sequenceId: 'INT-4004',
    timestamp: '2026-06-13T16:20:00.000Z',
    clientName: 'Nacional Locadora de Frotas S.A.',
    clientCpfCnpj: '45.102.392/0001-44',
    clientCategory: 'Despachante Credenciado',
    items: [
      { serviceName: 'Transferência de Propriedade Veicular', type: 'DETRAN', value: '286.40', quantity: 3, subtotal: '859.20' },
      { serviceName: 'Assessoria no Processamento de Transferência Regional', type: 'OUTROS', value: '180.00', quantity: 3, subtotal: '540.00' }
    ],
    detranSubtotal: '859.20',
    honorariosSubtotal: '540.00',
    otherSubtotal: '0.00',
    netTotal: '1399.20',
    paymentMethod: 'BOLETO',
    installments: 1,
    status: 'PENDING',
    createdBy: {
      userId: 'usr-102',
      userName: 'Ana Caixa',
      userRole: 'Operador',
      rlsScope: 'TENANT_PASS_FUNDO_01'
    }
  },
  {
    id: 'tx-5',
    sequenceId: 'INT-4005',
    timestamp: '2026-06-12T10:10:00.000Z',
    clientName: 'Silva & Filhos Comércio de Automóveis',
    clientCpfCnpj: '12.345.678/0001-99',
    clientCategory: 'Despachante Credenciado',
    items: [
      { serviceName: 'Primeiro Emplacamento e Emissão CRV', type: 'DETRAN', value: '350.00', quantity: 2, subtotal: '700.00' },
      { serviceName: 'Par de Placas Físicas Padrão Mercosul', type: 'OUTROS', value: '140.00', quantity: 2, subtotal: '280.00' }
    ],
    detranSubtotal: '700.00',
    honorariosSubtotal: '280.00',
    otherSubtotal: '0.00',
    netTotal: '980.00',
    paymentMethod: 'PIX',
    installments: 1,
    status: 'PAID',
    createdBy: {
      userId: 'usr-102',
      userName: 'Ana Caixa',
      userRole: 'Operador',
      rlsScope: 'TENANT_PASS_FUNDO_01'
    }
  },
  {
    id: 'tx-6',
    sequenceId: 'INT-4006',
    timestamp: '2026-06-12T15:30:00.000Z',
    clientName: 'Marcos de Oliveira Andrade',
    clientCpfCnpj: '839.201.481-22',
    clientCategory: 'Particular',
    items: [
      { serviceName: 'Sedex Expresso - Entrega Documentação', type: 'OUTROS', value: '32.90', quantity: 1, subtotal: '32.90' },
      { serviceName: 'Serviço de Liberação de Veículo Apreendido', type: 'OUTROS', value: '450.00', quantity: 1, subtotal: '450.00' }
    ],
    detranSubtotal: '0.00',
    honorariosSubtotal: '482.90',
    otherSubtotal: '0.00',
    netTotal: '482.90',
    paymentMethod: 'DEBIT_CARD',
    installments: 1,
    status: 'PAID',
    createdBy: {
      userId: 'usr-102',
      userName: 'Ana Caixa',
      userRole: 'Operador',
      rlsScope: 'TENANT_PASS_FUNDO_01'
    }
  },
  {
    id: 'tx-7',
    sequenceId: 'INT-4007',
    timestamp: '2026-06-11T09:40:00.000Z',
    clientName: 'Nacional Locadora de Frotas S.A.',
    clientCpfCnpj: '45.102.392/0001-44',
    clientCategory: 'Despachante Credenciado',
    items: [
      { serviceName: 'Transferência de Propriedade Veicular', type: 'DETRAN', value: '286.40', quantity: 2, subtotal: '572.80' }
    ],
    detranSubtotal: '572.80',
    honorariosSubtotal: '0.00',
    otherSubtotal: '0.00',
    netTotal: '572.80',
    paymentMethod: 'CASH',
    installments: 1,
    status: 'PAID',
    createdBy: {
      userId: 'usr-102',
      userName: 'Ana Caixa',
      userRole: 'Operador',
      rlsScope: 'TENANT_PASS_FUNDO_01'
    }
  },
  {
    id: 'tx-8',
    sequenceId: 'INT-4008',
    timestamp: '2026-06-09T14:15:00.000Z',
    clientName: 'Juliana Mendes Rezende',
    clientCpfCnpj: '231.549.689-10',
    clientCategory: 'Particular',
    items: [
      { serviceName: 'Assessoria no Processamento de Transferência Regional', type: 'OUTROS', value: '180.00', quantity: 1, subtotal: '180.00' }
    ],
    detranSubtotal: '0.00',
    honorariosSubtotal: '180.00',
    otherSubtotal: '0.00',
    netTotal: '180.00',
    paymentMethod: 'PIX',
    installments: 1,
    status: 'PAID',
    createdBy: {
      userId: 'usr-102',
      userName: 'Ana Caixa',
      userRole: 'Operador',
      rlsScope: 'TENANT_PASS_FUNDO_01'
    }
  },
  {
    id: 'tx-9',
    sequenceId: 'INT-4009',
    timestamp: '2026-06-03T11:00:00.000Z',
    clientName: 'Nacional Locadora de Frotas S.A.',
    clientCpfCnpj: '45.102.392/0001-44',
    clientCategory: 'Despachante Credenciado',
    items: [
      { serviceName: 'IPVA Estuadual - Exercício Corrente', type: 'DETRAN', value: '485.50', quantity: 2, subtotal: '971.00' },
      { serviceName: 'Primeiro Emplacamento e Emissão CRV', type: 'DETRAN', value: '350.00', quantity: 2, subtotal: '700.00' }
    ],
    detranSubtotal: '1671.00',
    honorariosSubtotal: '0.00',
    otherSubtotal: '0.00',
    netTotal: '1671.00',
    paymentMethod: 'BOLETO',
    installments: 1,
    status: 'PAID',
    createdBy: {
      userId: 'usr-102',
      userName: 'Ana Caixa',
      userRole: 'Operador',
      rlsScope: 'TENANT_PASS_FUNDO_01'
    }
  },
  {
    id: 'tx-10',
    sequenceId: 'INT-4010',
    timestamp: '2026-05-20T16:00:00.000Z',
    clientName: 'Juliana Mendes Rezende',
    clientCpfCnpj: '231.549.689-10',
    clientCategory: 'Particular',
    items: [
      { serviceName: 'Serviço de Liberação de Veículo Apreendido', type: 'OUTROS', value: '450.00', quantity: 1, subtotal: '450.00' }
    ],
    detranSubtotal: '0.00',
    honorariosSubtotal: '450.00',
    otherSubtotal: '0.00',
    netTotal: '450.00',
    paymentMethod: 'CREDIT_CARD',
    installments: 1,
    status: 'PAID',
    createdBy: {
      userId: 'usr-102',
      userName: 'Ana Caixa',
      userRole: 'Operador',
      rlsScope: 'TENANT_PASS_FUNDO_01'
    }
  }
];

