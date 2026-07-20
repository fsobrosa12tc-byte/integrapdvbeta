/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface ServiceItem {
  id: string;
  name: string;
  type: string;
  baseValue: string; // Keep as string for precision calculations (postgres numeric)
  description: string;
}

export interface SelectedService {
  service: ServiceItem;
  quantity: number;
  customValue: string; // Allowing modifications on professional fees (HONORARIO)
  observation?: string;
}

export interface ClientProfile {
  id: string;
  name: string;
  cpfCnpj: string;
  phone?: string; // Telefone do despachante/cliente
  outstandingBalance?: string; // Saldo devedor da conta corrente do despachante
  guiasPendentes?: number; // Quantidade de guias pendentes de faturamento
  category: 'Despachante Credenciado' | 'Particular' | 'Revenda de Veículos';
  status: 'Ativo' | 'Bloqueado';
}

export interface Transaction {
  id: string;
  sequenceId: string; // Friendly visible numeric ID (e.g., INT-3049)
  timestamp: string;
  clientName: string;
  clientCpfCnpj: string;
  clientCategory: string;
  items: {
    serviceName: string;
    type: string;
    value: string; // numeric(10,2) format
    quantity: number;
    subtotal: string;
    observation?: string;
  }[];
  detranSubtotal: string; // PostgreSQL numeric style
  honorariosSubtotal: string;
  otherSubtotal: string;
  netTotal: string; // net amount
  issqn?: string; // Imposto municipal Passo Fundo (2%)
  paymentMethod: 'PIX' | 'CREDIT_CARD' | 'DEBIT_CARD' | 'BOLETO' | 'CASH';
  installments: number;
  status: 'PAID' | 'PENDING' | 'CANCELLED';
  createdBy: {
    userId: string;
    userName: string;
    userRole: 'Master' | 'Gerente' | 'Financeiro' | 'Operador' | 'Administrador' | 'Atendente';
    rlsScope: string; // simulated RLS query tenant boundaries
  };
  overrideLogs?: {
    operatorId: string;
    operatorName: string;
    supervisorId: string;
    supervisorName: string;
    supervisorRole: string;
    action: string;
    timestamp: string;
  }[];
  operadorEmail?: string;
  terminalIp?: string;
  valorBruto?: string;
  valorLiquido?: string;
  hashAuditoria?: string;
  terminalId?: string;
  turno_id?: string | null;
}

export interface CashFlowMetrics {
  totalInflow: string;     // total paid volume
  totalPending: string;     // future receivables
  totalDetranFees: string;  // state tax transfer volume (high flow, low margin)
  totalHonorarios: string;  // high margin service charge (actual revenue)
  operatingBalance: string; // net balance
  transactionCount: number;
  averageTicket: string;
}

export interface CashTransaction {
  id: string;
  type: 'SANGRIA' | 'SUPRIMENTO';
  value: string;
  reason: string;
  timestamp: string;
  operatorName: string;
  operadorLogadoId?: string;
}

export interface OperatorTimelineEvent {
  timestamp: string;
  operadorName: string;
  operadorEmail: string;
  action: string; // e.g. "Abertura de Turno", "Saída da Operação", "Retorno/Assunção de Turno"
  details: string;
}

export interface CaixaState {
  status: 'aberto' | 'fechado';
  dataAbertura: string | null;
  fundoTroco: string;
  operadorName: string | null;
  operadorEmail?: string | null;
  sangrias: CashTransaction[];
  suprimentos: CashTransaction[];
  timeline?: OperatorTimelineEvent[];
  turno_id?: string | null;
}

export interface RlsSession {
  userId: string;
  userName: string;
  userRole: 'Master' | 'Gerente' | 'Financeiro' | 'Operador' | 'Administrador' | 'Atendente';
  currentTenantId: string; // simulated Tenant ID
  rlsPolicyApplied: string; // Human description of active standard Row Level Security
  email?: string;
}
