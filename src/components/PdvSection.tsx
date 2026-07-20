/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { 
  UserPlus, Search, ShoppingBag, Plus, Minus, Trash2, Pencil,
  CreditCard, CheckSquare, Sparkles, DollarSign, QrCode, 
  Calculator, User, Briefcase, ChevronRight, HelpCircle, Lock, Keyboard, ShieldAlert, X
} from 'lucide-react';
import { ServiceItem, SelectedService, ClientProfile, Transaction, RlsSession, CaixaState } from '../types';
import { DecimalMath } from '../utils/numericPrice';
import { supabase } from '../utils/supabaseClient';

interface PdvSectionProps {
  key?: number | string;
  onAddTransaction: (tx: Transaction) => void;
  rlsSession: RlsSession;
  clients: ClientProfile[];
  setClients: React.Dispatch<React.SetStateAction<ClientProfile[]>>;
  isMaster?: boolean;
  onAlternarOperador?: () => void;
  caixaState?: CaixaState;
  addToast?: (title: string, message: string, type?: 'success' | 'info' | 'alert') => void;
}

const PORTARIA_45_SERVICES = [
  { name: 'Alteração: Alteração de endereço de entrega de documento', type: 'GERAL', base_value: '14.10', description: 'Portaria 45/2026' },
  { name: 'Autenticação: Autenticação de originalidade de documentos veiculares arquivados', type: 'GERAL', base_value: '6.50', description: 'Portaria 45/2026' },
  { name: 'Autorização: Autorização para circular - motofrete', type: 'GERAL', base_value: '14.10', description: 'Portaria 45/2026' },
  { name: 'Autorização: Autorização para fabricação de placa veicular dianteira', type: 'GERAL', base_value: '14.10', description: 'Portaria 45/2026' },
  { name: 'Busca: Busca e fornecimento de cópias de documentos veiculares', type: 'GERAL', base_value: '11.20', description: 'Portaria 45/2026' },
  { name: 'Cancelamento: Cancelamento/suspensão de comunicação de venda', type: 'GERAL', base_value: '6.50', description: 'Portaria 45/2026' },
  { name: 'Certidão: Certidão de documento de circulação provisório (DCPPO)', type: 'GERAL', base_value: '14.10', description: 'Portaria 45/2026' },
  { name: 'Certidão: Certidão de registro de veículo automotor', type: 'GERAL', base_value: '14.10', description: 'Portaria 45/2026' },
  { name: 'Digitalização (01 folha): Digitalização de documento veicular', type: 'GERAL', base_value: '2.40', description: 'Portaria 45/2026' },
  { name: 'Digitalização (02 folhas): Digitalização de documento veicular', type: 'GERAL', base_value: '4.80', description: 'Portaria 45/2026' },
  { name: 'Digitalização (03 folhas): Digitalização de documento veicular', type: 'GERAL', base_value: '7.20', description: 'Portaria 45/2026' },
  { name: 'Digitalização (04 folhas): Digitalização de documento veicular', type: 'GERAL', base_value: '9.60', description: 'Portaria 45/2026' },
  { name: 'Digitalização (05 folhas): Digitalização de documento veicular', type: 'GERAL', base_value: '12.00', description: 'Portaria 45/2026' },
  { name: 'Digitalização (06 folhas): Digitalização de documento veicular', type: 'GERAL', base_value: '14.40', description: 'Portaria 45/2026' },
  { name: 'Digitalização (07 folhas): Digitalização de documento veicular', type: 'GERAL', base_value: '16.80', description: 'Portaria 45/2026' },
  { name: 'Digitalização (08 folhas): Digitalização de documento veicular', type: 'GERAL', base_value: '19.20', description: 'Portaria 45/2026' },
  { name: 'Digitalização (09 folhas - Teto): Digitalização de documento veicular', type: 'GERAL', base_value: '21.30', description: 'Portaria 45/2026' },
  { name: 'Digitalização (10 folhas ou mais - Máximo): Digitalização de documento veicular', type: 'GERAL', base_value: '21.30', description: 'Portaria 45/2026' },
  { name: 'Fornecimento: Fornecimento de autorização SISCSV', type: 'GERAL', base_value: '45.50', description: 'Portaria 45/2026' },
  { name: 'Impressão: Impressão de Certidão Negativa de Débitos do INSS', type: 'GERAL', base_value: '6.50', description: 'Portaria 45/2026' },
  { name: 'Impressão: Impressão de Dados de Infrações de Trânsito', type: 'GERAL', base_value: '6.50', description: 'Portaria 45/2026' },
  { name: 'Impressão: Impressão de Demonstrativo de Pagamento', type: 'GERAL', base_value: '6.50', description: 'Portaria 45/2026' },
  { name: 'Impressão: Impressão de GAD-E', type: 'GERAL', base_value: '6.50', description: 'Portaria 45/2026' },
  { name: 'Impressão: Impressão de situação de envio de documentos', type: 'GERAL', base_value: '6.50', description: 'Portaria 45/2026' },
  { name: 'Inclusão: Inclusão de Restrição Administrativa de Transferência', type: 'GERAL', base_value: '45.50', description: 'Portaria 45/2026' },
  { name: 'Inclusão: Inclusão de Restrição de Averbação de Execução', type: 'GERAL', base_value: '45.50', description: 'Portaria 45/2026' },
  { name: 'Liberação: Liberação de Restrição de Arrolamento de Bens', type: 'GERAL', base_value: '6.50', description: 'Portaria 45/2026' },
  { name: 'Liberação: Liberação de Restrição de Averbação de Execução', type: 'GERAL', base_value: '6.50', description: 'Portaria 45/2026' },
  { name: 'Liberação: Liberação de Restrição de Transferência', type: 'GERAL', base_value: '6.50', description: 'Portaria 45/2026' },
  { name: 'Reativação: Reativação de veículos desativados', type: 'GERAL', base_value: '6.50', description: 'Portaria 45/2026' },
  { name: 'Reclassificação: Reclassificação de veículo acidentado/sinistrado', type: 'GERAL', base_value: '6.50', description: 'Portaria 45/2026' },
  { name: 'Registro: Registro de CSV anual de GNV', type: 'GERAL', base_value: '45.50', description: 'Portaria 45/2026' },
  { name: 'Reimpressão: Reimpressão de GAD-E', type: 'GERAL', base_value: '6.50', description: 'Portaria 45/2026' }
];

export default function PdvSection({ onAddTransaction, rlsSession, clients, setClients, isMaster = false, onAlternarOperador, caixaState, addToast }: PdvSectionProps) {
  const isLockedForSupervisor = !!(caixaState && caixaState?.status === 'aberto' && (rlsSession?.userRole === 'Gerente' || rlsSession?.userRole === 'Financeiro'));

  const showToast = (title: string, message: string, type: 'success' | 'info' | 'alert' = 'info') => {
    if (addToast) {
      addToast(title, message, type);
    } else {
      console.log(`[Toast Fallback] ${title}: ${message}`);
    }
  };

  // Conversão de valores reais e máscaras monetárias
  const formatBRLMask = (val: string): string => {
    const cleanNumbers = val.replace(/\D/g, '');
    if (!cleanNumbers) return 'R$ 0,00';
    const numeric = parseInt(cleanNumbers, 10);
    const value = (numeric / 100).toFixed(2);
    const parts = value.split('.');
    const integerPart = parts[0];
    const decimalPart = parts[1];
    
    // Milhares com ponto
    const formattedInteger = Number(integerPart).toLocaleString('pt-BR');
    return `R$ ${formattedInteger},${decimalPart}`;
  };

  const floatStringToBRLMask = (floatStr: string): string => {
    const rawCents = Math.round((parseFloat(floatStr) || 0) * 100);
    return formatBRLMask(rawCents.toString());
  };

  const parseBRLMaskToFloatStr = (maskStr: string): string => {
    const cleanNumbers = maskStr.replace(/\D/g, '');
    if (!cleanNumbers) return '0.00';
    const cents = parseInt(cleanNumbers, 10);
    return (cents / 100).toFixed(2);
  };

  // State for showing service auto-suggestions in Atendimento panel
  const [showServiceSuggestions, setShowServiceSuggestions] = useState(false);

  // Catalog Services State with official list of CRVA services
  const [services, setServices] = useState<ServiceItem[]>([]);

  useEffect(() => {
    const fetchServices = async () => {
      try {
        const { data, error } = await supabase
          .from('servicos')
          .select('*')
          .order('name');
        if (error) throw error;
        
        const isUpToDate = data && data.length === PORTARIA_45_SERVICES.length && data.some(s => s.name.startsWith('Alteração: Alteração'));
        
        if (!data || !isUpToDate) {
          // Limpa qualquer dado genérico anterior
          await supabase.from('servicos').delete().neq('id', '00000000-0000-0000-0000-000000000000');
          // Insere os novos dados
          const { error: insertError } = await supabase.from('servicos').insert(PORTARIA_45_SERVICES);
          if (insertError) throw insertError;
          
          // Re-busca os serviços inseridos
          const { data: refreshedData } = await supabase
            .from('servicos')
            .select('*')
            .order('name');
            
          if (refreshedData) {
            setServices(refreshedData.map((s: any) => ({
              id: s.id,
              name: s.name,
              type: s.type,
              baseValue: parseFloat(s.base_value || '0').toFixed(2),
              description: s.description || ''
            })));
          }
        } else {
          setServices(data.map((s: any) => ({
            id: s.id,
            name: s.name,
            type: s.type,
            baseValue: parseFloat(s.base_value || '0').toFixed(2),
            description: s.description || ''
          })));
        }
      } catch (err) {
        console.error('Erro ao carregar catálogo de serviços:', err);
        // Fallback local caso haja falhas no Supabase (evita exibir o estado vazio no painel)
        setServices(PORTARIA_45_SERVICES.map((s: any, index) => ({
          id: `local-srv-${index}`,
          name: s.name,
          type: s.type,
          baseValue: parseFloat(s.base_value || '0').toFixed(2),
          description: s.description || ''
        })));
      }
    };
    fetchServices();
  }, []);

  // States for new service creation (Master Only)
  const [newServiceName, setNewServiceName] = useState('');
  const [newServiceValue, setNewServiceValue] = useState('R$ 0,00');
  const [newServiceType, setNewServiceType] = useState<string>('GERAL');

  // States for Editing service inline
  const [editingServiceId, setEditingServiceId] = useState<string | null>(null);
  const [editingServiceName, setEditingServiceName] = useState('');
  const [editingServiceValue, setEditingServiceValue] = useState('R$ 0,00');
  const [editingServiceType, setEditingServiceType] = useState('GERAL');
  const [deleteServiceConfirm, setDeleteServiceConfirm] = useState<ServiceItem | null>(null);

  const hasCrudAccess = isMaster || rlsSession?.userRole === 'Master' || rlsSession?.userRole === 'Gerente' || rlsSession?.userRole === 'Financeiro';

  const sanitizeServiceValue = (valStr: string): string => {
    // Clean R$ symbols and whitespaces
    let cleaned = valStr.replace(/R\$\s*/gi, '').trim();
    if (!cleaned) return '0.00';
    
    if (cleaned.includes(',')) {
      cleaned = cleaned.replace(/\./g, '').replace(',', '.');
    } else if (!cleaned.includes('.')) {
      cleaned = `${cleaned}.00`;
    }
    const valFloat = parseFloat(cleaned);
    return isNaN(valFloat) ? '0.00' : valFloat.toFixed(2);
  };

  // Active States
  const [customerType, setCustomerType] = useState<'PARTICULAR' | 'B2B'>('PARTICULAR');
  const [selectedClient, setSelectedClient] = useState<ClientProfile | null>({
    id: 'particular-temp',
    name: 'Particular (Consumidor)',
    cpfCnpj: '000.000.000-00',
    phone: '',
    category: 'Particular',
    status: 'Ativo',
    outstandingBalance: '0.00'
  });
  const [searchClientQuery, setSearchClientQuery] = useState('');

  const handleTransitionCustomerType = (type: 'PARTICULAR' | 'B2B') => {
    setCustomerType(type);
    if (type === 'PARTICULAR') {
      setSelectedClient({
        id: 'particular-temp',
        name: particularClientName.trim() || 'Particular (Consumidor)',
        cpfCnpj: '000.000.000-00',
        phone: '',
        category: 'Particular',
        status: 'Ativo',
        outstandingBalance: '0.00'
      });
    } else {
      setSelectedClient(null);
      setParticularClientName('');
    }
    if (type === 'PARTICULAR' && paymentMethod === 'BOLETO') {
      setPaymentMethod('PIX');
    }
  };

  // Faturamento de Guia (Convênio) Module States
  const [atendimentoMode, setAtendimentoMode] = useState<'LANCHAMENTO' | 'FATURAMENTO_GUIA'>('LANCHAMENTO');
  const [selectedDebtor, setSelectedDebtor] = useState<ClientProfile | null>(null);
  const [debtorHistory, setDebtorHistory] = useState<any[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);

  const handleSelectDebtor = async (client: ClientProfile) => {
    if (selectedDebtor?.id === client.id) {
      setSelectedDebtor(null);
      setDebtorHistory([]);
      return;
    }
    
    setSelectedDebtor(client);
    setIsLoadingHistory(true);
    setDebtorHistory([]);
    
    try {
      const { data, error } = await supabase
        .from('transacoes')
        .select('id, valor_bruto, valor_liquido, criado_em, operador_email, itens, cliente_nome, forma_pagamento, status_conciliacao, status')
        .eq('forma_pagamento', 'BOLETO')
        .neq('status_conciliacao', 'CANCELLED')
        .neq('status', 'CANCELLED')
        .order('criado_em', { ascending: false });
        
      if (error) throw error;
      
      const history = (data || []).filter(tx => {
         const rawClientName = tx.cliente_nome || 'Particular (Consumidor)';
         const cpfCnpjMatch = rawClientName.match(/\((?:CPF|CNPJ):\s*([^\)]+)\)/i);
         const clientCpfCnpj = cpfCnpjMatch ? cpfCnpjMatch[1].trim() : '000.000.000-00';
         const clientName = rawClientName.replace(/\s*\((?:CPF|CNPJ):[^\)]+\)/i, '').trim();

         const isThisClient = (clientCpfCnpj !== '000.000.000-00' && clientCpfCnpj === client.cpfCnpj) || clientName === client.name;
         
         if (isThisClient) {
            const txItems = tx.itens || [];
            return txItems.some((item: any) => item.type === 'CONVÊNIO');
         }
         return false;
      });
      
      setDebtorHistory(history);
    } catch (err) {
      console.error('Erro ao carregar histórico do despachante:', err);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  // Helper toast notifier (using window/element triggers or state if needed, but we have onAddTransaction/etc. Let's make a mini toast triggered in UI or simply alert/toast if appropriate)
  const [showConvenioToast, setShowConvenioToast] = useState(false);
  const [convenioToastMsg, setConvenioToastMsg] = useState('');
  const [showClientDropdown, setShowClientDropdown] = useState(false);

  // Client Dynamic Registration Form Toggle & State
  const [isRegisteringClient, setIsRegisteringClient] = useState(false);
  const [newClientName, setNewClientName] = useState('');
  const [newClientCpfCnpj, setNewClientCpfCnpj] = useState('');
  const [newClientPhone, setNewClientPhone] = useState('');
  const [newClientCategory, setNewClientCategory] = useState<'Particular' | 'Revenda de Veículos' | 'Despachante Credenciado'>('Particular');

  // Search & Filters on Services
  const [selectedServiceTab, setSelectedServiceTab] = useState<string>('ALL');
  const [searchServiceQuery, setSearchServiceQuery] = useState('');

  // Shopping Cart Bag Local Storage Recovery for disaster resilience
  const [cart, setCart] = useState<SelectedService[]>(() => {
    try {
      const saved = localStorage.getItem('pdv_cart');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // Checkout Stages: 'CART' | 'PAYMENT' | 'FINISHED'
  const [checkoutStage, setCheckoutStage] = useState<'CART' | 'PAYMENT'>(() => {
    try {
      const saved = localStorage.getItem('pdv_checkoutStage');
      return (saved as 'CART' | 'PAYMENT') || 'CART';
    } catch {
      return 'CART';
    }
  });

  useEffect(() => {
    localStorage.setItem('pdv_cart', JSON.stringify(cart));
  }, [cart]);

  useEffect(() => {
    localStorage.setItem('pdv_checkoutStage', checkoutStage);
  }, [checkoutStage]);

  const [paymentMethod, setPaymentMethod] = useState<'PIX' | 'CREDIT_CARD' | 'DEBIT_CARD' | 'BOLETO' | 'CASH'>('PIX');
  
  // Payment Details
  const [installments, setInstallments] = useState<number>(1);
  const [cashReceived, setCashReceived] = useState<string>('');
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const [pixStatus, setPixStatus] = useState<'WAITING' | 'CONFIRMED'>('WAITING');
  const [pixQrCodeUrl, setPixQrCodeUrl] = useState<string | null>(null);
  const [isGeneratingQr, setIsGeneratingQr] = useState<boolean>(false);

  // Active Created Receipt Preview
  const [recentlyCreatedTx, setRecentlyCreatedTx] = useState<Transaction | null>(null);

  // --- PRECISION MATHEMATICS COMPUTING (numeric 10,2) ---
  // DECLARADO AQUI (antes de qualquer useEffect que usa totals) para evitar erro de hoisting
  const calculateCartTotals = () => {
    let detranSub = '0.00';
    let honorarioSub = '0.00';
    let outerSub = '0.00';

    cart.forEach(item => {
      const subtotalItem = DecimalMath.mul(item.customValue || '0.00', item.quantity);
      if (item.service.type === 'DETRAN') {
        detranSub = DecimalMath.add(detranSub, subtotalItem);
      } else {
        outerSub = DecimalMath.add(outerSub, subtotalItem);
      }
    });

    const brutoSum = DecimalMath.add(detranSub, outerSub);
    const issqnCents = Math.round(DecimalMath.toCents(brutoSum) * 0.02);
    const issqnValue = DecimalMath.fromCents(issqnCents);
    const netSum = DecimalMath.add(brutoSum, issqnValue);

    return {
      detranSub,
      honorarioSub,
      outerSub,
      brutoSum,
      issqnValue,
      netSum
    };
  };

  // Calculado imediatamente após ser declarada — seguro para uso em qualquer hook abaixo
  const totals = calculateCartTotals();

  // Effect to apply autofocus immediately on "Valores recebidos" when "CASH" (Dinheiro) is selected as payment method
  useEffect(() => {
    if (paymentMethod === 'CASH' && checkoutStage === 'PAYMENT') {
      const focusTimer = setTimeout(() => {
        const el = document.getElementById('received-amount');
        if (el) {
          el.focus();
          (el as HTMLInputElement).select();
        }
      }, 50);
      return () => clearTimeout(focusTimer);
    }
  }, [paymentMethod, checkoutStage]);

  // Geração de QR Code dinâmico desativada a favor do fluxo de Pix simplificado sem exibição de imagens.

  // --- PAINEL DE DIGITAÇÃO DE VALORES RÁPIDO (RF002) ---
  const [typedQty, setTypedQty] = useState<number>(1);
  const [typedSingleUnitValue, setTypedSingleUnitValue] = useState<string>('0.00');
  const [typedValue, setTypedValue] = useState<string>('R$ 0,00');
  const [particularClientName, setParticularClientName] = useState<string>('');
  const [particularClientCpf, setParticularClientCpf] = useState<string>('');
  const [showB2BModal, setShowB2BModal] = useState<boolean>(false);
  const [searchB2BQuery, setSearchB2BQuery] = useState<string>('');
  const [typedServiceName, setTypedServiceName] = useState<string>('');
  const [typedServiceType, setTypedServiceType] = useState<string>('DETRAN');
  const [typedServiceObservation, setTypedServiceObservation] = useState<string>('');

  // List of accumulated services before launching to cart
  const [accumulatedServices, setAccumulatedServices] = useState<{
    id: string;
    name: string;
    type: string;
    value: string;
    quantity: number;
    unitValue: string;
    observation?: string;
  }[]>([]);

  // Ref for the launching value display input (for constant keyboard cursor focus)
  const typedValueInputRef = useRef<HTMLInputElement>(null);

  // Ref to track the width of the main sidebar/cart column on resize
  const sidebarRef = useRef<HTMLDivElement>(null);
  const [sidebarWidth, setSidebarWidth] = useState<number>(380);
  const [isDesktop, setIsDesktop] = useState<boolean>(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const media = window.matchMedia('(min-width: 1024px)');
    setIsDesktop(media.matches);
    const listener = (e: MediaQueryListEvent) => setIsDesktop(e.matches);
    media.addEventListener('change', listener);
    return () => media.removeEventListener('change', listener);
  }, []);

  useEffect(() => {
    if (!sidebarRef.current) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setSidebarWidth(entry.contentRect.width);
      }
    });
    observer.observe(sidebarRef.current);
    return () => {
      observer.disconnect();
    };
  }, []);

  const formatCpfMask = (value: string) => {
    const clean = value.replace(/\D/g, '');
    if (clean.length <= 3) return clean;
    if (clean.length <= 6) return `${clean.slice(0, 3)}.${clean.slice(3)}`;
    if (clean.length <= 9) return `${clean.slice(0, 3)}.${clean.slice(3, 6)}.${clean.slice(6)}`;
    return `${clean.slice(0, 3)}.${clean.slice(3, 6)}.${clean.slice(6, 9)}-${clean.slice(9, 11)}`;
  };

  // Real-time synchronization of visor display from unit value and quantity
  useEffect(() => {
    const floatUnit = parseFloat(typedSingleUnitValue) || 0;
    const totalFloat = floatUnit * typedQty;
    setTypedValue(floatStringToBRLMask(totalFloat.toFixed(2)));
  }, [typedSingleUnitValue, typedQty]);

  // Auto-focus value input on mount and whenever the document is clicked
  useEffect(() => {
    // Focus visor on mount
    typedValueInputRef.current?.focus();

    const handleGlobalFocusRestoration = (e: MouseEvent) => {
      // Small timeout to allow activeElement to update
      setTimeout(() => {
        const activeEl = document.activeElement;
        const isInputHoveredOrFocused =
          activeEl && (
            activeEl.tagName === 'INPUT' || 
            activeEl.tagName === 'TEXTAREA' || 
            activeEl.tagName === 'SELECT' ||
            activeEl.getAttribute('contenteditable') === 'true'
          );
        
        if (!isInputHoveredOrFocused) {
          typedValueInputRef.current?.focus();
        }
      }, 50);
    };

    document.addEventListener('click', handleGlobalFocusRestoration);
    return () => {
      document.removeEventListener('click', handleGlobalFocusRestoration);
    };
  }, []);

  const handleAccumulateService = () => {
    if (isLockedForSupervisor) {
      showToast('Acesso Negado', 'Lançamento bloqueado para perfis de gerência e financeiro sob caixa alheio.', 'alert');
      return;
    }
    const floatStr = parseBRLMaskToFloatStr(typedValue);
    const numericVal = parseFloat(floatStr);
    if (isNaN(numericVal) || numericVal <= 0) {
      showToast('Valor Inválido', 'Por favor, digite um valor válido maior que R$ 0,00 para acumular.', 'alert');
      typedValueInputRef.current?.focus();
      return;
    }

    if (!selectedClient) {
      showToast('Identificação Requerida', 'Por favor, identifique quem está comprando antes de acumular serviços.', 'alert');
      typedValueInputRef.current?.focus();
      return;
    }

    const newItem = {
      id: `acc-srv-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      name: typedServiceName.trim() || `Lançamento ${typedServiceType}`,
      type: typedServiceType,
      value: floatStr,
      quantity: typedQty,
      unitValue: typedSingleUnitValue,
      observation: typedServiceObservation.trim()
    };

    setAccumulatedServices(prev => [...prev, newItem]);

    // reset fields
    setTypedQty(1);
    setTypedSingleUnitValue('0.00');
    setTypedValue('R$ 0,00');
    setTypedServiceName('');
    setTypedServiceObservation('');
    
    // Auto focus immediately
    setTimeout(() => {
      typedValueInputRef.current?.focus();
    }, 50);
  };

  const handleAddTypedServiceToCart = () => {
    if (isLockedForSupervisor) {
      showToast('Acesso Negado', 'Lançamento bloqueado para perfis de gerência e financeiro sob caixa alheio.', 'alert');
      return;
    }
    if (!selectedClient) {
      showToast('Identificação Requerida', 'Por favor, identifique quem está comprando.', 'alert');
      typedValueInputRef.current?.focus();
      return;
    }

    // Parse current typed values in case operator did not click '+' but wants to launch directly
    const floatStr = parseBRLMaskToFloatStr(typedValue);
    const numericVal = parseFloat(floatStr);
    const hasCurrentTyped = !isNaN(numericVal) && numericVal > 0;

    if (accumulatedServices.length === 0 && !hasCurrentTyped) {
      showToast('Sacola Vazia', 'Nenhum serviço acumulado ou digitado para lançar na sacola.', 'alert');
      typedValueInputRef.current?.focus();
      return;
    }

    const newCartItems: SelectedService[] = [];

    // 1. Add all accumulated items
    accumulatedServices.forEach(item => {
      const customSrv: ServiceItem = {
        id: `typed-srv-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
        name: item.name,
        type: item.type,
        baseValue: item.unitValue,
        description: 'Lançamento acumulado via Painel Expresso'
      };
      newCartItems.push({ 
        service: customSrv, 
        quantity: item.quantity, 
        customValue: item.unitValue,
        observation: item.observation
      });
    });

    // 2. Add currently typed item if valid
    if (hasCurrentTyped) {
      const customSrv: ServiceItem = {
        id: `typed-srv-${Date.now()}`,
        name: typedServiceName.trim() || `Lançamento ${typedServiceType}`,
        type: typedServiceType,
        baseValue: typedSingleUnitValue,
        description: 'Lançamento expresso via Painel de Digitação Rápida'
      };
      newCartItems.push({ 
        service: customSrv, 
        quantity: typedQty, 
        customValue: typedSingleUnitValue,
        observation: typedServiceObservation.trim()
      });
    }

    // Append all at once
    setCart(prev => [...prev, ...newCartItems]);

    // Reset everything
    setAccumulatedServices([]);
    setTypedQty(1);
    setTypedSingleUnitValue('0.00');
    setTypedValue('R$ 0,00');
    setTypedServiceName('');
    setTypedServiceObservation('');

    // Auto focus immediately
    setTimeout(() => {
      typedValueInputRef.current?.focus();
    }, 50);
  };

  // --- CLIENT SELECTION HANDLERS ---
  const filteredClients = clients.filter(c => 
    c.name.toLowerCase().includes(searchClientQuery.toLowerCase()) ||
    c.cpfCnpj.includes(searchClientQuery)
  );

  const handleSelectClient = (client: ClientProfile) => {
    setSelectedClient(client);
    setSearchClientQuery('');
    setShowClientDropdown(false);
    
    // Auto reset faturamento if client is not Despachante
    if (client.category !== 'Despachante Credenciado' && paymentMethod === 'BOLETO') {
      setPaymentMethod('PIX');
    }
  };

  const handleRegisterClient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newClientName || !newClientCpfCnpj || !newClientPhone) {
      showToast('Campos Obrigatórios', 'Por favor, preencha todos os campos obrigatórios.', 'alert');
      return;
    }

    const newClientData = {
      razao_social: newClientName,
      cnpj: newClientCpfCnpj,
      telefone: newClientPhone,
      saldo_devedor: 0.00
    };

    try {
      const { data, error } = await supabase
        .from('despachantes')
        .insert([newClientData])
        .select()
        .single();

      if (error) throw error;

      if (data) {
        const mappedClient: ClientProfile = {
          id: data.id,
          name: data.razao_social,
          cpfCnpj: data.cnpj,
          phone: data.telefone,
          outstandingBalance: parseFloat(data.saldo_devedor || '0').toFixed(2),
          guiasPendentes: 0,
          category: 'Despachante Credenciado',
          status: 'Ativo'
        };
        setClients(prev => [mappedClient, ...prev]);
        setSelectedClient(mappedClient);
        showToast('Despachante Cadastrado', 'Despachante cadastrado com sucesso!', 'success');
      }
      
      // reset form
      setNewClientName('');
      setNewClientCpfCnpj('');
      setNewClientPhone('');
      setIsRegisteringClient(false);
    } catch (err: any) {
      showToast('Erro ao Cadastrar', 'Não foi possível cadastrar o despachante.', 'alert');
    }
  };

  // --- SERVICE ADD/REMOVE TO CART ---
  // Click on a service in the Catalog will populate Atendimento fields automatically
  const handleAddServiceToCart = (srv: ServiceItem) => {
    if (isLockedForSupervisor) {
      showToast('Acesso Negado', 'Lançamento bloqueado para perfis de gerência e financeiro sob caixa alheio.', 'alert');
      return;
    }
    setTypedServiceName(srv.name);
    setTypedSingleUnitValue(srv.baseValue);
    setTypedServiceType(srv.type);

    // Force focus back to the value input
    setTimeout(() => {
      const visorEl = document.getElementById('visor');
      if (visorEl) {
        visorEl.focus();
      } else {
        typedValueInputRef.current?.focus();
      }
    }, 80);
  };

  // Automatically fill Atendimento fields based on search bar query
  useEffect(() => {
    const query = searchServiceQuery.trim().toLowerCase();
    if (query) {
      const match = services.find(s => 
        s.name.toLowerCase().includes(query) || 
        s.description.toLowerCase().includes(query)
      );
      if (match) {
        setTypedServiceName(match.name);
        setTypedSingleUnitValue(match.baseValue);
        setTypedServiceType(match.type);
      }
    }
  }, [searchServiceQuery, services]);

  // --- SUPERVISOR AUTHORIZATION OVERRIDE (RBAC) ---
  const [showOverrideModal, setShowOverrideModal] = useState(false);
  const [overrideAction, setOverrideAction] = useState<{
    type: 'REMOVE' | 'DECREASE_QTY' | 'CHANGE_PRICE';
    srvId: string;
    payload?: any;
  } | null>(null);
  const [supervisorEmail, setSupervisorEmail] = useState('');
  const [supervisorPassword, setSupervisorPassword] = useState('');
  const [overrideNewPrice, setOverrideNewPrice] = useState('R$ 0,00');
  const [overrideError, setOverrideError] = useState('');
  const [activeOverrideLogs, setActiveOverrideLogs] = useState<{
    operatorId: string;
    operatorName: string;
    supervisorId: string;
    supervisorName: string;
    supervisorRole: string;
    action: string;
    timestamp: string;
  }[]>([]);

  const handleUpdateQuantity = (srvId: string, delta: number) => {
    // SECURITY GATE: Intercept quantity decreases for Operator/Atendente roles
    if (delta < 0 && (rlsSession?.userRole === 'Operador' || rlsSession?.userRole === 'Atendente')) {
      const itemToEdit = cart.find(item => item.service.id === srvId);
      if (itemToEdit && itemToEdit.quantity > 1) {
        setOverrideAction({
          type: 'DECREASE_QTY',
          srvId,
          payload: { delta }
        });
        setOverrideError('');
        setSupervisorEmail('');
        setSupervisorPassword('');
        setShowOverrideModal(true);
        return;
      }
    }

    const updatedCart = cart.map(item => {
      if (item.service.id === srvId) {
        const nextQ = item.quantity + delta;
        return { ...item, quantity: nextQ > 0 ? nextQ : 1 };
      }
      return item;
    });
    setCart(updatedCart);
  };

  const handleUpdateCustomValue = (srvId: string, newVal: string) => {
    // Permite alteração de serviços e outros itens (prevenindo quebra de digitação)
    const cleaned = newVal.replace(/[^0-9.]/g, '');
    const updatedCart = cart.map(item => {
      if (item.service.id === srvId) {
        return { ...item, customValue: cleaned };
      }
      return item;
    });
    setCart(updatedCart);
  };

  const handleRemoveFromCart = (srvId: string) => {
    // SECURITY GATE: Intercept item removals for Operator/Atendente roles
    if (rlsSession?.userRole === 'Operador' || rlsSession?.userRole === 'Atendente') {
      const itemToEdit = cart.find(item => item.service.id === srvId);
      if (itemToEdit) {
        setOverrideAction({
          type: 'REMOVE',
          srvId
        });
        setOverrideError('');
        setSupervisorEmail('');
        setSupervisorPassword('');
        setShowOverrideModal(true);
        return;
      }
    }

    setCart(cart.filter(item => item.service.id !== srvId));
  };

  const handleApproveOverride = async () => {
    setOverrideError('');
    const emailStr = supervisorEmail.trim().toLowerCase();
    const passStr = supervisorPassword;

    let approvedSupervisor: any = null;

    // 1. Strict Master verification
    if (emailStr === 'fsobrosa.12tc@gmail.com' && passStr === 'Antonio2@26') {
      approvedSupervisor = {
        id: 'usr-master',
        name: 'Antônio Marques',
        role: 'Master'
      };
    } else {
      // 2. Verify against Supabase usuarios table
      try {
        const { data: user } = await supabase
          .from('usuarios')
          .select('*')
          .eq('email', emailStr)
          .eq('password', passStr)
          .eq('status', 'Ativo')
          .maybeSingle();

        if (user && (user.role === 'Master' || user.role === 'Gerente' || user.role === 'Financeiro')) {
          approvedSupervisor = {
            id: user.id,
            name: user.name,
            role: user.role
          };
        }
      } catch (err) {
        console.error('Erro ao validar supervisor para override:', err);
      }
    }

    if (!approvedSupervisor) {
      setOverrideError('Acesso Negado: Credenciais inválidas ou cargo insuficiente.');
      return;
    }

    // Capture override logs for audit!
    const logItem = {
      operatorId: rlsSession?.userId || '',
      operatorName: rlsSession?.userName || 'Operador',
      supervisorId: approvedSupervisor?.id || '',
      supervisorName: approvedSupervisor?.name || 'Supervisor',
      supervisorRole: approvedSupervisor?.role || 'Supervisor',
      action: '',
      timestamp: new Date().toISOString()
    };

    // Execute the pending action!
    if (overrideAction) {
      const { type, srvId, payload } = overrideAction;
      
      if (type === 'DECREASE_QTY') {
        const delta = payload.delta;
        logItem.action = `Redução da quantidade do serviço (ID: ${srvId}) por ${delta}`;
        
        const updatedCart = cart.map(item => {
          if (item.service.id === srvId) {
            const nextQ = item.quantity + delta;
            return { ...item, quantity: nextQ > 0 ? nextQ : 1 };
          }
          return item;
        });
        setCart(updatedCart);
      } else if (type === 'REMOVE') {
        const itemToRemove = cart.find(i => i.service.id === srvId);
        logItem.action = `Exclusão do serviço "${itemToRemove?.service.name || srvId}" da sacola`;
        setCart(cart.filter(item => item.service.id !== srvId));
      } else if (type === 'CHANGE_PRICE') {
        const cleanPriceStr = sanitizeServiceValue(overrideNewPrice);
        const itemToModify = cart.find(i => i.service.id === srvId);
        logItem.action = `Alteração de valor do item "${itemToModify?.service.name || srvId}" para R$ ${cleanPriceStr}`;
        setCart(cart.map(item => {
          if (item.service.id === srvId) {
            return { ...item, customValue: cleanPriceStr };
          }
          return item;
        }));
      }

      // Add override log
      setActiveOverrideLogs(prev => [...prev, logItem]);
    }

    // Close modal & reset fields
    setShowOverrideModal(false);
    setOverrideAction(null);
    setSupervisorEmail('');
    setSupervisorPassword('');
    setOverrideNewPrice('R$ 0,00');
  };

  // calculateCartTotals e totals foram movidos para antes dos useEffects (linha ~282)
  // para evitar o erro: "Cannot access 'totals' before initialization"

  // --- CHECKOUT DISABLED CHECKS ---
  const isCashInsufficient = paymentMethod === 'CASH' && (parseFloat(cashReceived.toString().replace(',', '.') || '0') < parseFloat(totals.netSum.toString().replace(',', '.') || '0'));
  const isCheckoutDisabled = isCashInsufficient;

  // --- SERVICE FILTERING ---
  const filteredServices = services.filter(srv => {
    const matchesTab = selectedServiceTab === 'ALL' || srv.type === selectedServiceTab;
    const matchesSearch = srv.name.toLowerCase().includes(searchServiceQuery.toLowerCase()) || 
                          srv.description.toLowerCase().includes(searchServiceQuery.toLowerCase());
    return matchesTab && matchesSearch;
  });

  // --- PIX CONFIRMATION SIMULATOR ---
  const handlePixSimulate = () => {
    setIsProcessingPayment(true);
    setPixStatus('WAITING');
    setTimeout(() => {
      setPixStatus('CONFIRMED');
      setIsProcessingPayment(false);
    }, 2500);
  };

  // --- FINISH ORDER ---
  const handleFinishTransaction = () => {
    if (!selectedClient) return;
    if (cart.length === 0) return;

    // Constrói objeto de transação real simulado com RLS
    const txItems = cart.map(item => {
      const sub = DecimalMath.mul(item.customValue, item.quantity);
      return {
        serviceName: item.service.name,
        type: item.service.type,
        value: parseFloat(item.customValue).toFixed(2),
        quantity: item.quantity,
        subtotal: sub,
        observation: item.observation || ''
      };
    });

    const txId = self.crypto.randomUUID();
    const friendlyNumber = `PDV-${Math.floor(1000 + Math.random() * 9000)}`;

    const issqnValue = totals.issqnValue;

    const newTx: Transaction = {
      id: txId,
      sequenceId: friendlyNumber,
      timestamp: new Date().toISOString(),
      clientName: selectedClient.name,
      clientCpfCnpj: selectedClient.cpfCnpj,
      clientCategory: selectedClient.category,
      items: txItems,
      detranSubtotal: totals.detranSub,
      honorariosSubtotal: '0.00',
      otherSubtotal: totals.outerSub,
      netTotal: totals.netSum,
      issqn: issqnValue,
      paymentMethod,
      installments: paymentMethod === 'CREDIT_CARD' ? installments : 1,
      status: paymentMethod === 'BOLETO' ? 'PENDING' : 'PAID',
      createdBy: {
        userId: rlsSession?.userId || '',
        userName: rlsSession?.userName || 'Operador',
        userRole: rlsSession?.userRole || 'Operador',
        rlsScope: rlsSession?.rlsPolicyApplied || ''
      },
      overrideLogs: activeOverrideLogs
    };

    // Liquidate debtor balance if this is a Convênio payment
    const hasConvenioItem = cart.some(item => item.service.type === 'CONVÊNIO');
    if (hasConvenioItem && selectedClient && selectedClient.id !== 'particular-temp') {
      setClients(prev => prev.map(c => {
        if (c.id === selectedClient.id) {
          return {
            ...c,
            outstandingBalance: '0.00',
            guiasPendentes: 0
          };
        }
        return c;
      }));
    }

    onAddTransaction(newTx);
    setRecentlyCreatedTx(newTx);
    
    // Clear and reset state - Expurgo Completo de Valores Fantasmas
    setCart([]);
    setAccumulatedServices([]);
    setActiveOverrideLogs([]);
    setCheckoutStage('CART');
    setCashReceived('');
    setPixStatus('WAITING');
    setInstallments(1);
    
    // Clear and reset client identification to completely hide it from the empty cart view
    setParticularClientName('');
    setParticularClientCpf('');
    setSelectedClient({
      id: 'particular-temp',
      name: 'Particular (Consumidor)',
      cpfCnpj: '000.000.000-00',
      phone: '',
      category: 'Particular',
      status: 'Ativo',
      outstandingBalance: '0.00'
    });
    setCustomerType('PARTICULAR');

    // Reset explicitamente os campos de digitação rápida do painel do guichê
    setTypedQty(1);
    setTypedSingleUnitValue('0.00');
    setTypedValue('R$ 0,00');
    setTypedServiceName('');
    setTypedServiceObservation('');
    setSelectedDebtor(null);

    // Auto-focus back to the value visor for continuous keyboard input
    setTimeout(() => {
      const visorEl = document.getElementById('visor');
      if (visorEl) {
        visorEl.focus();
      } else {
        typedValueInputRef.current?.focus();
      }
    }, 150);
  };

  // Calcula parcelamento do Cartão de Crédito
  const creditCardInstallmentText = () => {
    if (installments === 1) return `1x de ${DecimalMath.formatBRL(totals.netSum)} sem juros`;
    // Simula 1.5% de taxa por parcela no cartão de crédito comercial Fintech
    const calculatedSum = DecimalMath.mul(totals.netSum, 1 + (installments * 0.01));
    const termValue = DecimalMath.fromCents(Math.round(DecimalMath.toCents(calculatedSum) / installments));
    return `${installments}x de ${DecimalMath.formatBRL(termValue)} (C/ Juros do Operador)`;
  };

  // Troco para dinheiro
  const changeValue = () => {
    if (!cashReceived) return 'R$ 0,00';
    const receivedVal = parseFloat(cashReceived.toString().replace(',', '.') || '0');
    const totalVal = parseFloat(totals.netSum.toString().replace(',', '.') || '0');
    const diff = receivedVal - totalVal;
    if (isNaN(diff) || diff < 0) return 'R$ 0,00 (Insuficiente)';
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(diff);
  };

  return (
    <div id="pdv-checkout-anchor" className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start relative">
      
      {/* CENTRALIZED CASHIER ALERT POPUP FOR SUPERVISORS */}
      {caixaState && caixaState?.status === 'aberto' && (rlsSession?.userRole === 'Gerente' || rlsSession?.userRole === 'Financeiro') && (
        <div className="fixed top-24 left-1/2 -translate-x-1/2 z-[40] w-full max-w-xl px-4 animate-bounce">
          <div className="bg-brand-navy-deep/95 border-2 border-brand-emerald text-slate-100 p-4 rounded-xl shadow-[0_8px_32px_rgba(16,185,129,0.3)] flex items-center gap-3 backdrop-blur-md">
            <div className="p-2 bg-brand-emerald/15 rounded-lg text-brand-emerald">
              <Sparkles className="w-5 h-5 animate-pulse" />
            </div>
            <div className="flex-1">
              <h4 className="font-sans font-bold text-xs text-brand-emerald uppercase tracking-wider">
                Caixa Centralizado Ativo · Modo Supervisão
              </h4>
              <p className="text-[11px] text-slate-350 leading-relaxed font-sans mt-0.5">
                O operador <strong className="text-white">{caixaState.operadorName || 'Simulado'}</strong> iniciou o turno com fundo de <strong className="font-mono text-brand-emerald">{DecimalMath.formatBRL(caixaState.fundoTroco)}</strong>. Nova inserção está travada; acompanhe o fluxo operacional.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* LEFT COLUMN: Service Inventory selection & Client Association (7 cols) */}
      <div className="lg:col-span-7 flex flex-col gap-6">
        
        {/* PAINEL DE DIGITAÇÃO DE VALORES UNIFICADO */}
        <div className="bg-brand-navy-card/50 rounded-2xl p-6 md:p-8 shadow-[0_4px_20px_rgba(0,0,0,0.2)] flex flex-col gap-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-brand-navy-bright/10 pb-4">
            <div>
              <h3 className="font-sans font-bold text-base text-slate-200 flex items-center gap-2">
                <Calculator className="w-4.5 h-4.5 text-brand-emerald animate-pulse" />
                Atendimento
              </h3>
              <p className="text-[11px] text-slate-400 mt-0.5">Lançamento de atendimento expresso ou faturamento de guias</p>
            </div>
            
            {/* Dynamic tab selector for Atendimento Mode */}
            <div className="flex bg-brand-navy-deep p-1 rounded-lg border border-brand-navy-bright/10 text-xs gap-1">
              <button
                type="button"
                onClick={() => setAtendimentoMode('LANCHAMENTO')}
                className={`px-3 py-1.5 font-bold rounded-lg transition-all cursor-pointer ${
                  atendimentoMode === 'LANCHAMENTO'
                    ? 'bg-brand-emerald text-brand-navy-deep shadow-sm shadow-brand-emerald/10'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Lançamento Expresso
              </button>
              <button
                type="button"
                id="tab-convenio-btn"
                onClick={() => setAtendimentoMode('FATURAMENTO_GUIA')}
                className={`px-3 py-1.5 font-bold rounded-lg transition-all cursor-pointer ${
                  atendimentoMode === 'FATURAMENTO_GUIA'
                    ? 'bg-brand-emerald text-brand-navy-deep shadow-sm shadow-brand-emerald/10'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Faturamento de Guia
              </button>
            </div>

            {onAlternarOperador && (
              <button 
                type="button"
                onClick={onAlternarOperador}
                className="text-xs font-semibold px-3 py-1.5 bg-brand-navy-deep hover:bg-brand-navy-bright border border-brand-emerald/20 text-brand-emerald rounded-lg transition-all flex items-center gap-1.5 cursor-pointer hover:border-brand-emerald/40 hover:bg-brand-navy-deep/60 self-start sm:self-auto"
              >
                <User className="w-3.5 h-3.5 text-brand-emerald" />
                Alternar Operador
              </button>
            )}
          </div>

          {atendimentoMode === 'LANCHAMENTO' ? (
            <>
              {/* Sub Row 1: Premium Visor Value (Ajuste do Visor) */}
              <div className="grid grid-cols-1 md:grid-cols-12 gap-5 items-end">
                {/* Premium visor scaled to span the full grid width for premium alignment */}
                <div className="md:col-span-12 flex flex-col gap-1.5">
                  <label className="block text-xs font-semibold text-slate-300">Valor do lançamento (R$)</label>
                  <div className="bg-slate-950 border border-slate-900 rounded-lg px-3.5 py-2.5 shadow-inner flex items-center justify-between relative">
                    <span className="text-[9px] font-mono text-slate-500 absolute top-1.5 left-3 tracking-wider">Visor</span>
                    <div className="flex items-center gap-1 font-mono text-xl text-brand-emerald font-bold ml-auto mt-1">
                      <input
                        ref={typedValueInputRef}
                        id="visor"
                        autoFocus
                        type="text"
                        value={typedValue}
                        onChange={(e) => {
                          const masked = formatBRLMask(e.target.value);
                          setTypedValue(masked);
                          const totalFloat = parseFloat(parseBRLMaskToFloatStr(masked)) || 0;
                          const unitFloat = totalFloat / typedQty;
                          setTypedSingleUnitValue(unitFloat.toFixed(4));
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleAccumulateService();
                          }
                        }}
                        className="bg-transparent text-right font-mono text-brand-emerald font-bold focus:outline-none w-44 py-0 border-b border-transparent focus:border-brand-emerald/30"
                        placeholder="R$ 0,00"
                      />
                      <span className="w-1.5 h-5 bg-brand-emerald/90 animate-pulse block" />
                    </div>
                  </div>
                </div>
              </div>

              {/* Sub Row 2: Service Identification details and Quantity Selector */}
              <div className="space-y-2">
                <div className="flex gap-2 items-end">
                  {/* COMPACT QUANTITY INPUT WITH +/- ARROWS (RF001) */}
                  <div className="w-20 md:w-24 shrink-0 flex flex-col gap-1.5" id="qty-selector-container">
                    <label className="block text-xs font-semibold text-slate-300">Qtd</label>
                    <div className="flex items-center justify-between bg-brand-navy-deep border border-brand-navy-bright/10 rounded-lg h-9 px-1.5 focus-within:border-brand-emerald/60 transition-colors">
                      <button
                        type="button"
                        onClick={() => setTypedQty(prev => Math.max(1, prev - 1))}
                        className="text-slate-400 hover:text-white hover:bg-slate-800 transition rounded w-5 h-5 flex items-center justify-center font-bold font-mono text-xs select-none cursor-pointer"
                        id="qty-decrement-btn"
                        title="Diminuir quantidade"
                      >
                        -
                      </button>
                      <input
                        type="number"
                        id="qty-input"
                        min="1"
                        value={typedQty}
                        onChange={(e) => {
                          const val = parseInt(e.target.value, 10);
                          setTypedQty(isNaN(val) || val <= 0 ? 1 : val);
                        }}
                        className="bg-transparent text-center font-mono text-xs font-bold text-slate-100 focus:outline-none w-full [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                      />
                      <button
                        type="button"
                        onClick={() => setTypedQty(prev => prev + 1)}
                        className="text-slate-400 hover:text-white hover:bg-slate-800 transition rounded w-5 h-5 flex items-center justify-center font-bold font-mono text-xs select-none cursor-pointer"
                        id="qty-increment-btn"
                        title="Aumentar quantidade"
                      >
                        +
                      </button>
                    </div>
                  </div>

                  {/* Service Input Block */}
                  <div className="flex-1 min-w-0 flex flex-col gap-1.5">
                    <label className="block text-xs font-semibold text-slate-300">Nome / Identificação do serviço</label>
                    <div className="flex gap-2 relative">
                      <div className="relative flex-1 min-w-0">
                        <input
                          type="text"
                          id="typed-service-name-input"
                          value={typedServiceName}
                          onChange={(e) => {
                            setTypedServiceName(e.target.value);
                            setShowServiceSuggestions(true);
                          }}
                          onFocus={() => setShowServiceSuggestions(true)}
                          onBlur={() => {
                            // Sligth delay to let autocomplete clicks register
                            setTimeout(() => setShowServiceSuggestions(false), 240);
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              const query = typedServiceName.trim().toLowerCase();
                              const filtered = services.filter(s => s.name.toLowerCase().includes(query));
                              if (filtered.length > 0 && showServiceSuggestions) {
                                e.preventDefault();
                                const match = filtered[0];
                                setTypedServiceName(match.name);
                                setTypedSingleUnitValue(match.baseValue);
                                setTypedServiceType(match.type);
                                setShowServiceSuggestions(false);
                                setTimeout(() => {
                                  typedValueInputRef.current?.focus();
                                }, 50);
                              } else {
                                e.preventDefault();
                                handleAccumulateService();
                              }
                            } else if (e.key === 'Escape') {
                              setShowServiceSuggestions(false);
                            }
                          }}
                          placeholder="Ex: Alteração de endereço..."
                          className="w-full bg-brand-navy-deep border border-brand-navy-bright/10 rounded-lg px-3.5 py-2 text-xs font-mono text-slate-200 placeholder-slate-500 focus:outline-none focus:border-brand-emerald"
                        />

                        {/* Autocomplete Suggestions box */}
                        {showServiceSuggestions && typedServiceName.trim().length > 0 && (
                          <div 
                            className="absolute z-50 left-0 right-0 mt-1 max-h-48 overflow-y-auto bg-slate-900 border border-brand-navy-bright/10 rounded-lg shadow-2xl p-1 divide-y divide-slate-800/40"
                            onMouseDown={(e) => e.preventDefault()}
                          >
                            {services
                              .filter(s => s.name.toLowerCase().includes(typedServiceName.toLowerCase()))
                              .slice(0, 6)
                              .map((srv) => (
                                <button
                                  key={srv.id}
                                  type="button"
                                  onClick={() => {
                                    setTypedServiceName(srv.name);
                                    setTypedSingleUnitValue(srv.baseValue);
                                    setTypedServiceType(srv.type);
                                    setShowServiceSuggestions(false);
                                    setTimeout(() => {
                                      const visorEl = document.getElementById('visor');
                                      if (visorEl) {
                                        visorEl.focus();
                                      } else {
                                        typedValueInputRef.current?.focus();
                                      }
                                    }, 80);
                                  }}
                                  className="w-full text-left px-3 py-2 text-[11px] text-slate-300 hover:text-white hover:bg-brand-emerald/15 transition-all flex items-center justify-between rounded-lg font-sans"
                                >
                                  <span className="truncate pr-2 font-medium">{srv.name}</span>
                                  <span className="text-[10px] text-brand-emerald font-mono font-bold flex-shrink-0">
                                    {DecimalMath.formatBRL(srv.baseValue)}
                                  </span>
                                </button>
                              ))}
                            {services.filter(s => s.name.toLowerCase().includes(typedServiceName.toLowerCase())).length === 0 && (
                              <div className="px-3 py-2 text-[10px] text-slate-500 font-mono">
                                Nenhum serviço correspondente no catálogo
                              </div>
                            )}
                          </div>
                        )}
                      </div>

                      <button
                        type="button"
                        onClick={handleAccumulateService}
                        title="Acumular serviço para o mesmo cliente"
                        className="bg-brand-navy-bright hover:bg-slate-800 border border-brand-emerald/20 text-brand-emerald px-4 rounded-lg flex items-center justify-center font-bold text-lg cursor-pointer h-9 transition-colors shrink-0"
                        id="pdv-accumulate-service-btn"
                      >
                        +
                      </button>
                    </div>
                    {/* Campo de informações complementares antes de acumular (Pilar 2) */}
                    <div className="mt-2.5">
                      <input
                        type="text"
                        placeholder="Informações complementares para este item (Opcional)..."
                        value={typedServiceObservation}
                        onChange={(e) => setTypedServiceObservation(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleAccumulateService();
                          }
                        }}
                        className="w-full bg-brand-navy-deep border border-brand-navy-bright/10 focus:border-brand-emerald/40 rounded-lg px-3.5 py-2 text-xs font-mono text-slate-200 placeholder-slate-500 focus:outline-none transition-all"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Visual list of accumulated items (RF003 / RF004) */}
              {accumulatedServices.length > 0 && (
                <div className="bg-brand-navy-deep/60 rounded-lg p-3 border border-brand-navy-bright/10 space-y-2 animate-fade-in">
                  <div className="flex justify-between items-center text-[10px] font-mono text-slate-400 tracking-wide">
                    <span>Múltiplos serviços acumulados ({accumulatedServices.length})</span>
                    <span className="font-bold text-brand-emerald bg-brand-emerald/10 px-2 py-0.5 rounded">
                      Subtotal: {DecimalMath.formatBRL(accumulatedServices.reduce((sum, s) => sum + parseFloat(s.value), 0).toFixed(2))}
                    </span>
                  </div>
                  <div className="max-h-24 overflow-y-auto divide-y divide-brand-navy-bright/40 pr-1 space-y-1">
                    {accumulatedServices.map((item) => (
                      <div key={item.id} className="flex justify-between items-center text-xs py-1.5 first:pt-0">
                        <div className="truncate flex items-center flex-wrap gap-1">
                          <span className="text-brand-emerald font-bold font-mono text-[11px] mr-1">{item.quantity}x</span>
                          <span className="font-medium text-slate-200">{item.name}</span>
                          <span className="text-[8px] font-mono text-brand-emerald bg-brand-navy-bright/20 px-1.5 py-0.5 rounded">
                            {item.type === 'DETRAN' ? 'OPERACIONAL' : item.type}
                          </span>
                          <span className="text-[8px] font-mono text-slate-400 bg-slate-900/60 px-1 py-0.5 rounded">
                            ({selectedClient?.name || 'Particular'})
                          </span>
                          {item.observation && (
                            <span className="text-[8.5px] font-mono text-amber-400 bg-amber-500/5 border border-amber-500/25 px-2 py-0.5 rounded max-w-[160px] truncate animate-pulse" title={item.observation}>
                              Obs: {item.observation}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-slate-300">{DecimalMath.formatBRL(item.value)}</span>
                          <button
                            type="button"
                            onClick={() => setAccumulatedServices(prev => prev.filter(s => s.id !== item.id))}
                            className="text-red-400 hover:text-red-300 transition-colors text-[10px] font-mono font-bold cursor-pointer"
                            id={`remove-accumulated-${item.id}`}
                          >
                            [Remover]
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Sub Row 3: Integrated Customer Identification Block */}
              <div className="pt-4 border-t border-brand-navy-bright/10 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pb-2">
                  <h4 className="text-xs font-semibold text-slate-300">Identificação de quem está comprando</h4>
                  
                  {/* Toggle Switch / Button Group Elegante */}
                  <div className="flex bg-brand-navy-deep p-1 rounded-lg border border-brand-navy-bright/10 self-start sm:self-auto">
                    <button
                      type="button"
                      onClick={() => handleTransitionCustomerType('PARTICULAR')}
                      className={`px-3 py-1.5 text-[11px] font-semibold rounded-md transition-all cursor-pointer ${
                        customerType === 'PARTICULAR'
                          ? 'bg-brand-emerald text-brand-navy-deep shadow-sm shadow-brand-emerald/10'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      Cliente particular
                    </button>
                    <button
                      type="button"
                      onClick={() => handleTransitionCustomerType('B2B')}
                      className={`px-3 py-1.5 text-[11px] font-semibold rounded-md transition-all cursor-pointer ${
                        customerType === 'B2B'
                          ? 'bg-brand-emerald text-brand-navy-deep shadow-sm shadow-brand-emerald/10'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      Despachante B2B
                    </button>
                  </div>
                </div>

                {/* Comportamento de exibição condicional com transição suave nativa baseada em opacity */}
                <div className="relative overflow-hidden transition-all duration-300">
                  {customerType === 'PARTICULAR' ? (
                    <div className="animate-fade-in space-y-2.5">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-medium text-slate-400">Cliente particular (Balcão de rua)</span>
                      </div>
                      
                      {/* Nome do Cliente Particular */}
                      <div className="relative">
                        <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                        <input
                          type="text"
                          placeholder="Nome do cliente particular..."
                          value={particularClientName}
                          onChange={(e) => {
                            const val = e.target.value;
                            setParticularClientName(val);
                            setSelectedClient(prev => ({
                              ...prev,
                              name: val.trim() || 'Particular (Consumidor)'
                            }));
                          }}
                          className="w-full bg-brand-navy-deep border border-brand-navy-bright/10 focus:border-brand-emerald/40 rounded-lg pl-9 pr-3 py-2 text-xs text-slate-200 placeholder-slate-500 focus:outline-none transition-all"
                        />
                      </div>

                      {/* CPF do Cliente Particular com Máscara em tempo real */}
                      <div className="relative">
                        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                        <input
                          type="text"
                          placeholder="CPF do cliente (000.000.000-00)..."
                          value={particularClientCpf}
                          onChange={(e) => {
                            const masked = formatCpfMask(e.target.value);
                            setParticularClientCpf(masked);
                            setSelectedClient(prev => ({
                              ...prev,
                              cpfCnpj: masked || '000.000.000-00'
                            }));
                          }}
                          className="w-full bg-brand-navy-deep border border-brand-navy-bright/10 focus:border-brand-emerald/40 rounded-lg pl-9 pr-3 py-2 text-xs text-slate-200 placeholder-slate-500 focus:outline-none transition-all font-mono"
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="animate-fade-in space-y-2.5">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-medium text-slate-400">Despachantes B2B credenciados</span>
                      </div>

                      {/* Botão de seleção B2B */}
                      <button
                        type="button"
                        onClick={() => {
                          setSearchB2BQuery('');
                          setShowB2BModal(true);
                        }}
                        className="w-full bg-brand-navy-deep border border-brand-navy-bright/20 hover:border-brand-emerald/40 text-xs font-semibold py-2.5 px-3.5 rounded-lg text-slate-300 hover:text-slate-100 transition-all flex items-center justify-between cursor-pointer"
                      >
                        <span className="flex items-center gap-2">
                          <User className="w-4 h-4 text-brand-emerald" />
                          {selectedClient && selectedClient.id !== 'particular-temp' 
                            ? selectedClient.name 
                            : 'Clique para selecionar despachante...'}
                        </span>
                        <span className="text-[10px] text-brand-emerald font-mono font-bold bg-brand-emerald/10 px-2 py-0.5 rounded">
                          {selectedClient && selectedClient.id !== 'particular-temp' ? 'Selecionado' : 'Selecionar'}
                        </span>
                      </button>

                      {/* Resumo do despachante selecionado */}
                      {selectedClient && selectedClient.id !== 'particular-temp' && (
                        <div className="mt-2 p-2.5 bg-brand-navy-bright/40 border border-brand-emerald/15 rounded-lg space-y-1 animate-fade-in text-[11px]">
                          <span className="text-[9px] font-mono text-brand-emerald font-bold tracking-wider block">Despachante ativo selecionado</span>
                          <p className="font-semibold text-slate-200">{selectedClient.name}</p>
                          <p className="text-slate-400 font-mono text-[10px]">CPF/CNPJ: {selectedClient.cpfCnpj} · Categoria: {selectedClient.category}</p>
                          {parseFloat(selectedClient.outstandingBalance || '0') > 0 && (
                            <span className="inline-block mt-1 text-[9px] font-mono text-red-400 bg-red-950/40 border border-red-900/30 px-1.5 py-0.5 rounded">
                              Saldo Devedor: {DecimalMath.formatBRL(selectedClient.outstandingBalance || '0.00')}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>

              </div>

              {/* Sub Row 5: Action Button to launch service */}
              <button
                type="button"
                id="add-typed-to-cart-btn"
                onClick={handleAddTypedServiceToCart}
                className="w-full mt-2.5 py-3 px-4 bg-brand-navy-bright/60 border border-brand-emerald/10 text-brand-emerald hover:bg-brand-emerald hover:text-brand-navy-deep hover:border-transparent rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer shadow-sm shadow-brand-emerald/5"
              >
                <Plus className="w-4 h-4" />
                Lançar na sacola do cupom
              </button>
            </>
          ) : (
            /* FATURAMENTO DE GUIA (CONVÊNIO) MODE PANEL */
            <div className="space-y-4 animate-fade-in">
              <div className="bg-brand-navy-bright/20 border border-brand-emerald/10 p-4 rounded-xl space-y-1">
                <span className="text-[10px] font-mono font-bold text-brand-emerald uppercase tracking-wider block">🔒 Consolidação de Débitos</span>
                <p className="text-xs text-slate-350 leading-relaxed font-sans">
                  Selecione um despachante credenciado abaixo para listar e faturar todos os seus débitos em aberto. O valor total consolidado será adicionado na sacola de atendimentos.
                </p>
              </div>

              {/* Dynamic Toast feedback */}
              {showConvenioToast && (
                <div className="p-3 bg-brand-emerald/20 border border-brand-emerald/35 text-brand-emerald rounded-lg text-xs font-semibold animate-pulse flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-brand-emerald" />
                  <span>{convenioToastMsg}</span>
                </div>
              )}

              {/* Debtor List Table */}
              <div className="border border-brand-navy-bright/10 rounded-xl overflow-hidden">
                <table className="w-full text-left text-xs text-slate-300">
                  <thead className="bg-brand-navy-deep text-[10px] uppercase text-slate-400 font-mono tracking-wider">
                    <tr>
                      <th className="px-4 py-3 font-semibold">Parceiro / Razão Social</th>
                      <th className="px-4 py-3 text-center font-semibold">Guias</th>
                      <th className="px-4 py-3 text-right font-semibold font-mono">Total Devido</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-brand-navy-bright/15 bg-brand-navy-deep/20">
                    {clients.filter(c => c.category !== 'Particular' && ((c.guiasPendentes && c.guiasPendentes > 0) || parseFloat(c.outstandingBalance || '0') > 0)).length > 0 ? (
                      clients
                        .filter(c => c.category !== 'Particular' && ((c.guiasPendentes && c.guiasPendentes > 0) || parseFloat(c.outstandingBalance || '0') > 0))
                        .map(client => {
                          const isSelected = selectedDebtor?.id === client.id;
                          return (
                            <React.Fragment key={client.id}>
                              <tr
                                onClick={() => handleSelectDebtor(client)}
                                className={`cursor-pointer transition-colors ${
                                  isSelected
                                    ? 'bg-brand-emerald/10 text-brand-emerald'
                                    : 'hover:bg-brand-navy-deep/40 text-slate-300'
                                }`}
                              >
                                <td className="px-4 py-3">
                                  <span className={`block font-semibold ${isSelected ? 'text-brand-emerald' : 'text-slate-200'}`}>
                                    {client.name}
                                  </span>
                                  <span className="text-[9px] text-slate-500 font-mono block mt-0.5">{client.cpfCnpj} · {client.category}</span>
                                </td>
                                <td className="px-4 py-3 text-center font-mono font-bold text-slate-200">
                                  {client.guiasPendentes || 0}
                                </td>
                                <td className="px-4 py-3 text-right font-mono font-bold tracking-tight text-slate-100">
                                  <span className="text-brand-emerald">{DecimalMath.formatBRL(client.outstandingBalance || '0.00')}</span>
                                </td>
                              </tr>
                              {isSelected && (
                                <tr>
                                  <td colSpan={3} className="px-4 py-4 bg-brand-navy-deep/60 border-t border-brand-navy-bright/10">
                                    <div className="space-y-3">
                                      <h4 className="text-[11px] font-bold text-brand-emerald uppercase tracking-wider">Histórico de Lançamentos em Aberto</h4>
                                      {isLoadingHistory ? (
                                        <div className="text-xs text-slate-400">Carregando detalhes...</div>
                                      ) : debtorHistory.length > 0 ? (
                                        <div className="max-h-48 overflow-y-auto space-y-2 pr-1">
                                          {debtorHistory.map(tx => (
                                            <div key={tx.id} className="flex justify-between items-center bg-brand-navy-bright/20 p-2 rounded-lg border border-brand-navy-bright/10">
                                              <div className="flex flex-col">
                                                <span className="text-xs text-slate-200 font-medium">{new Date(tx.criado_em).toLocaleString('pt-BR')}</span>
                                                <span className="text-[10px] text-slate-400 font-mono">Operador: {tx.operador_email}</span>
                                              </div>
                                              <span className="text-brand-emerald font-bold font-mono text-xs">{DecimalMath.formatBRL(tx.valor_liquido || tx.valor_bruto || '0')}</span>
                                            </div>
                                          ))}
                                        </div>
                                      ) : (
                                        <div className="text-xs text-slate-400">Nenhum detalhe encontrado para o saldo atual.</div>
                                      )}
                                    </div>
                                  </td>
                                </tr>
                              )}
                            </React.Fragment>
                          );
                        })
                    ) : (
                      <tr>
                        <td colSpan={3} className="text-center py-6 text-slate-500 font-mono italic">
                          Parabéns! Nenhum parceiro B2B possui pendências ativas.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Action Button */}
              <button
                type="button"
                id="efetuar-pagamento-convenio-btn"
                disabled={!selectedDebtor}
                onClick={() => {
                  if (!selectedDebtor) return;
                  
                  // Setup checkout details
                  setSelectedClient(selectedDebtor);
                  setCustomerType('B2B');
                  
                  // Consolidate values
                  const consolidatedValue = parseFloat(selectedDebtor.outstandingBalance || '0.00').toFixed(2);
                  const debtService: ServiceItem = {
                    id: `srv-convenio-${selectedDebtor.id}-${Date.now()}`,
                    name: `Faturamento de Guias Acumuladas - Convênio`,
                    type: `CONVÊNIO`,
                    description: `Faturamento de convenios: ${selectedDebtor.guiasPendentes || 0} guias pendentes do parceiro.`,
                    baseValue: '0.00'
                  };
                  
                  const cartItem: SelectedService = {
                    service: debtService,
                    quantity: 1,
                    customValue: consolidatedValue
                  };
                  
                  setCart([cartItem]);
                  setPaymentMethod('BOLETO'); // Locks payment method to Boleto (Faturamento) for B2B Guia
                  setCheckoutStage('CART'); // Redirect focus directly to checkout view
                  
                  // Render temporary feedback alert toast
                  setConvenioToastMsg(`Sucesso! Débito de R$ ${parseFloat(consolidatedValue).toLocaleString('pt-BR', {minimumFractionDigits: 2})} carregado para ${selectedDebtor.name}.`);
                  setShowConvenioToast(true);
                  setTimeout(() => {
                    setShowConvenioToast(false);
                  }, 4000);
                  
                  setSelectedDebtor(null);
                }}
                className={`w-full py-3.5 px-4 rounded-xl text-xs font-bold font-sans uppercase tracking-wider transition-all duration-150 flex items-center justify-center gap-2 ${
                  selectedDebtor
                    ? 'bg-brand-emerald hover:bg-emerald-400 text-brand-navy-deep cursor-pointer shadow-lg shadow-brand-emerald/10'
                    : 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700/50'
                }`}
              >
                <ShoppingBag className="w-4 h-4" />
                Efetuar Pagamento de Convênio
              </button>
            </div>
          )}
        </div>

        {/* SERVICES INVENTORY GRID */}
        <div className="bg-brand-navy-card/50 rounded-2xl p-6 md:p-8 shadow-[0_4px_20px_rgba(0,0,0,0.2)] flex-grow flex flex-col lg:min-h-0 min-h-[480px] overflow-hidden">
          
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
            <div>
              <h3 className="font-sans font-bold text-base text-slate-200 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-brand-accent" />
                Catálogo de Serviços Integrado
              </h3>
              <p className="text-[11px] text-slate-400 mt-0.5">Clique nos itens para adicionar à sacola do caixa.</p>
            </div>

            {/* Search items input */}
            <div className="relative w-full sm:w-60">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
              <input
                id="service-search"
                type="text"
                placeholder="Pesquisar serviços..."
                value={searchServiceQuery}
                onChange={(e) => setSearchServiceQuery(e.target.value)}
                className="w-full bg-brand-navy-deep border border-brand-navy-bright/10 rounded-lg pl-8 pr-3 py-1.5 text-xs text-slate-200 placeholder-slate-400 focus:outline-none focus:border-brand-emerald/60"
              />
            </div>
          </div>



          {/* Items Table / Grid */}
          <div className="flex-grow overflow-y-auto lg:max-h-none pr-1 space-y-2.5 min-h-0">
            {filteredServices.length > 0 ? (
              filteredServices.map(srv => {
                const isDetran = srv.type === 'DETRAN';

                if (editingServiceId === srv.id) {
                  return (
                    <div
                      key={srv.id}
                      onClick={(e) => e.stopPropagation()}
                      className="flex flex-col gap-3 p-4 bg-brand-navy-card border border-brand-emerald/30 rounded-lg animate-fade-in"
                    >
                      <div className="text-[10px] font-mono font-bold text-brand-emerald uppercase tracking-wider">
                        ✏️ Editando Serviço
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <div className="flex flex-col gap-1">
                          <label className="text-[9px] font-sans font-semibold text-slate-400 uppercase tracking-wider">
                            Categoria/Tipo
                          </label>
                          <input
                            type="text"
                            value={editingServiceType}
                            onChange={(e) => {
                              const forbiddenWords = /detran|taxa|governo|governamental/gi;
                              setEditingServiceType(e.target.value.replace(forbiddenWords, ''));
                            }}
                            className="w-full bg-brand-navy-deep border border-brand-navy-bright/20 rounded-lg py-1.5 px-3 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-brand-emerald font-sans"
                          />
                        </div>
                        <div className="flex flex-col gap-1">
                          <label className="text-[9px] font-sans font-semibold text-slate-400 uppercase tracking-wider">
                            Descrição do Item
                          </label>
                          <input
                            type="text"
                            value={editingServiceName}
                            onChange={(e) => {
                              const forbiddenWords = /detran|taxa|governo|governamental/gi;
                              setEditingServiceName(e.target.value.replace(forbiddenWords, ''));
                            }}
                            className="w-full bg-brand-navy-deep border border-brand-navy-bright/20 rounded-lg py-1.5 px-3 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-brand-emerald font-sans"
                          />
                        </div>
                        <div className="flex flex-col gap-1">
                          <label className="text-[9px] font-sans font-semibold text-slate-400 uppercase tracking-wider">
                            Valor do Serviço
                          </label>
                          <input
                            type="text"
                            value={editingServiceValue}
                            onChange={(e) => {
                              setEditingServiceValue(e.target.value);
                            }}
                            onBlur={() => {
                              const sanitized = sanitizeServiceValue(editingServiceValue);
                              const formatted = floatStringToBRLMask(sanitized);
                              setEditingServiceValue(formatted);
                            }}
                            className="w-full bg-brand-navy-deep border border-brand-navy-bright/20 rounded-lg py-1.5 px-3 text-xs text-slate-100 focus:outline-none focus:border-brand-emerald font-mono font-bold text-center"
                          />
                        </div>
                      </div>
                      <div className="flex justify-end gap-2 mt-1">
                        <button
                          type="button"
                          onClick={() => setEditingServiceId(null)}
                          className="bg-slate-705 bg-slate-800 text-slate-300 hover:text-white font-bold text-[10px] uppercase py-1 px-3 rounded-md transition-all cursor-pointer font-sans"
                        >
                          Cancelar
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            const trimmedName = editingServiceName.trim();
                            const trimmedType = editingServiceType.trim() || 'GERAL';
                            const cleanValueStr = sanitizeServiceValue(editingServiceValue);
                            const numericValue = parseFloat(cleanValueStr);

                            if (!trimmedName || isNaN(numericValue) || numericValue <= 0) {
                              showToast('Campos Inválidos', 'Por favor, informe uma descrição detalhada e um valor válido maior que zero.', 'alert');
                              return;
                            }

                            const updateSrv = async () => {
                              try {
                                const { error } = await supabase
                                  .from('servicos')
                                  .update({
                                    name: trimmedName,
                                    type: trimmedType,
                                    base_value: numericValue.toFixed(2)
                                  })
                                  .eq('id', srv.id);
                                if (error) throw error;

                                setServices(prev => prev.map(s => {
                                  if (s.id === srv.id) {
                                    return {
                                      ...s,
                                      name: trimmedName,
                                      type: trimmedType,
                                      baseValue: numericValue.toFixed(2)
                                    };
                                  }
                                  return s;
                                }));
                                setEditingServiceId(null);
                                showToast('Serviço Atualizado', 'Operação realizada!', 'success');
                              } catch (err: any) {
                                showToast('Erro ao Atualizar', 'Não foi possível atualizar o serviço.', 'alert');
                              }
                            };
                            updateSrv();
                          }}
                          className="bg-brand-emerald text-brand-navy-deep hover:bg-emerald-400 font-bold text-[10px] uppercase py-1 px-3 rounded-md transition-all cursor-pointer font-sans"
                        >
                          Salvar
                        </button>
                      </div>
                    </div>
                  );
                }

                return (
                  <div
                    key={srv.id}
                    onClick={() => handleAddServiceToCart(srv)}
                    className="flex items-center justify-between p-3.5 bg-brand-navy-deep/40 border border-brand-navy-bright/10 hover:border-brand-emerald/20 rounded-lg cursor-pointer hover:bg-brand-navy-deep/90 transition-all duration-150 group"
                  >
                    <div className="flex-1 pr-4">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-slate-100 group-hover:text-brand-emerald transition-colors">
                          {srv.name}
                        </span>
                        
                        <span className={`text-[9px] uppercase font-mono px-1.5 py-0.5 rounded-full font-bold ${
                          isDetran 
                            ? 'bg-amber-500/10 text-amber-500 border border-amber-500/10'
                            : 'bg-slate-700/20 text-slate-400 border border-slate-700/20'
                        }`}>
                          {srv.type === 'DETRAN' ? 'OPERACIONAL' : srv.type}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400 mt-1 line-clamp-1">{srv.description}</p>
                    </div>

                    <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                      <span className="font-mono text-xs md:text-sm font-bold text-slate-200 mr-2">
                        {DecimalMath.formatBRL(srv.baseValue)}
                      </span>
                      
                      {hasCrudAccess && (
                        <>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditingServiceId(srv.id);
                              setEditingServiceName(srv.name);
                              setEditingServiceType(srv.type);
                              setEditingServiceValue(floatStringToBRLMask(srv.baseValue));
                            }}
                            className="p-1.5 rounded-md bg-brand-navy-bright border border-brand-emerald/15 text-brand-emerald hover:text-emerald-300 hover:bg-brand-emerald/10 transition cursor-pointer"
                            title="Editar serviço"
                          >
                            <Pencil className="w-3" />
                          </button>
                          
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setDeleteServiceConfirm(srv);
                            }}
                            className="p-1.5 rounded-md bg-brand-navy-bright border border-red-500/10 text-red-400 hover:text-red-350 hover:bg-red-500/10 transition cursor-pointer"
                            title="Excluir do catálogo"
                          >
                            <Trash2 className="w-3" />
                          </button>
                        </>
                      )}
                      
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleAddServiceToCart(srv);
                        }}
                        className="p-1.5 rounded-md bg-brand-navy-bright text-slate-400 hover:text-brand-emerald hover:bg-brand-emerald/10 transition-all cursor-pointer"
                        title="Adicionar à sacola"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="p-12 text-center text-slate-500 text-xs">
                Nenhum serviço correspondente encontrado para '{searchServiceQuery}'
              </div>
            )}
          </div>

          {/* MASTER RESERVED SECTION FOR CREATING AND MUTATING SERVICES */}
          {hasCrudAccess ? (
            <div className="mt-6 bg-brand-navy-card/80 border border-brand-navy-bright/10 p-5 rounded-[16px] shadow-2xl space-y-4 animate-fade-in text-slate-200">
              <span className="text-xs uppercase font-mono font-bold text-brand-emerald block tracking-wider">
                [+] Painel de Cadastro de Serviços
              </span>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Campo 1: Categoria/Tipo do Serviço */}
                <div className="flex flex-col gap-1.5 animate-fade-in">
                  <label className="text-[10px] font-sans font-semibold text-slate-400 uppercase tracking-wider">
                    Categoria/Tipo do Serviço
                  </label>
                  <input
                    type="text"
                    placeholder="Ex: Geral, Acessório, Profissional"
                    value={newServiceType}
                    onChange={(e) => {
                      // Prevent any insertion of DETRAN or Taxa Governamental words
                      const forbiddenWords = /detran|taxa|governo|governamental/gi;
                      setNewServiceType(e.target.value.replace(forbiddenWords, ''));
                    }}
                    className="w-full bg-brand-navy-deep border border-brand-navy-bright/10 rounded-lg py-2 px-3 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-brand-emerald font-sans"
                  />
                </div>

                {/* Campo 2: Descrição do Item */}
                <div className="flex flex-col gap-1.5 animate-fade-in">
                  <label className="text-[10px] font-sans font-semibold text-slate-400 uppercase tracking-wider">
                    Descrição do Item
                  </label>
                  <input
                    type="text"
                    placeholder="Ex: Vistoria Especial, Placa Mercosul"
                    value={newServiceName}
                    onChange={(e) => {
                      const forbiddenWords = /detran|taxa|governo|governamental/gi;
                      setNewServiceName(e.target.value.replace(forbiddenWords, ''));
                    }}
                    className="w-full bg-brand-navy-deep border border-brand-navy-bright/10 rounded-lg py-2 px-3 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-brand-emerald font-sans"
                  />
                </div>

                {/* Campo 3: Valor do Serviço */}
                <div className="flex flex-col gap-1.5 animate-fade-in">
                  <label className="text-[10px] font-sans font-semibold text-slate-400 uppercase tracking-wider">
                    Valor do Serviço
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      step="0.01"
                      placeholder="R$ 0,00"
                      value={newServiceValue}
                      onFocus={(e) => {
                        if (newServiceValue === 'R$ 0,00') {
                          e.target.select();
                        }
                      }}
                      onChange={(e) => {
                        // Apply precision real-time BRL currency mask
                        const masked = formatBRLMask(e.target.value);
                        setNewServiceValue(masked);
                      }}
                      onBlur={() => {
                        const sanitized = sanitizeServiceValue(newServiceValue);
                        const formatted = floatStringToBRLMask(sanitized);
                        setNewServiceValue(formatted);
                      }}
                      className="w-full bg-brand-navy-deep border border-brand-navy-bright/10 rounded-lg py-2 px-3 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-brand-emerald font-mono font-bold text-center"
                    />
                  </div>
                </div>
              </div>
              <div className="flex pt-1">
                <button
                  type="button"
                  onClick={() => {
                    const trimmedName = newServiceName.trim();
                    const trimmedType = newServiceType.trim() || 'GERAL';
                    
                    // Parse Portuguese format R$ XX,XX to float safely through robust sanitization
                    const cleanValueStr = sanitizeServiceValue(newServiceValue);
                    const numericValue = parseFloat(cleanValueStr);

                    if (!trimmedName || isNaN(numericValue) || numericValue <= 0) {
                      showToast('Campos Inválidos', 'Por favor, informe uma descrição detalhada do serviço e um valor monetário válido maior que zero.', 'alert');
                      return;
                    }
                    const newSrvData = {
                      name: trimmedName,
                      type: trimmedType,
                      base_value: numericValue.toFixed(2),
                      description: 'Serviço profissional regulamentado cadastrado nas diretrizes Marks Systems.'
                    };

                    const insertSrv = async () => {
                      try {
                        const { data, error } = await supabase
                          .from('servicos')
                          .insert([newSrvData])
                          .select()
                          .single();
                        if (error) throw error;
                        if (data) {
                          setServices(prev => [...prev, {
                            id: data.id,
                            name: data.name,
                            type: data.type,
                            baseValue: parseFloat(data.base_value || '0').toFixed(2),
                            description: data.description || ''
                          }]);
                        }
                        setNewServiceName('');
                        setNewServiceValue('R$ 0,00');
                        setNewServiceType('GERAL');
                        showToast('Serviço Cadastrado', 'Operação realizada!', 'success');
                      } catch (err: any) {
                        showToast('Erro ao Cadastrar', 'Não foi possível salvar o serviço no catálogo.', 'alert');
                      }
                    };
                    insertSrv();
                  }}
                  className="flex-grow bg-brand-emerald text-brand-navy-deep hover:bg-emerald-400 font-bold text-xs py-2 px-4 rounded-lg transition-all text-center flex items-center justify-center gap-1.5 cursor-pointer font-sans"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Salvar Serviço
                </button>
              </div>
            </div>
          ) : (
            <div className="mt-4 pt-3 border-t border-brand-navy-bright/10 flex items-center justify-center gap-2 text-[10px] text-slate-500 font-mono tracking-widest">
              <Lock className="w-3 h-3 text-slate-600 animate-pulse" />
              <span>Governança: catálogo restrito a administradores e supervisores</span>
            </div>
          )}

        </div>

      </div>

      {/* RIGHT COLUMN: Interactive Shopping Cart Bag & Checkout (5 cols) */}
      <div ref={sidebarRef} className="lg:col-span-5 lg:sticky lg:top-24 flex flex-col bg-brand-navy-card/60 border border-brand-navy-bright/10 rounded-2xl overflow-hidden shadow-[0_4px_20px_rgba(0,0,0,0.2)] h-[calc(100vh-120px)] max-h-[85vh] relative">
        
        {/* BLOCO A: Topo/Cabeçalho (Identificação do Cliente) - Sempre fixo no topo do card */}
        <div id="cart-block-a" className="flex-shrink-0 bg-brand-navy-deep/20 border-b border-brand-navy-bright/10">
          {/* Cart Header */}
          <div className="px-6 py-4 flex items-center justify-between border-b border-brand-navy-bright/10">
            <div className="flex items-center gap-2">
              <ShoppingBag className="w-5 h-5 text-brand-emerald" />
              <h4 className="font-sans font-bold text-sm md:text-base text-slate-100 uppercase tracking-wider">
                Sacola de Atendimentos
              </h4>
            </div>
            <span className="text-xs font-mono font-bold bg-brand-navy-deep text-brand-emerald px-2.5 py-1 rounded-full border border-brand-navy-bright/10">
              {cart.reduce((s, c) => s + c.quantity, 0)} {cart.reduce((s, c) => s + c.quantity, 0) === 1 ? 'item' : 'itens'}
            </span>
          </div>

          {/* CABEÇALHO DE IDENTIFICAÇÃO DESTACADO DO CLIENTE */}
          {cart.length > 0 && (
            <div className="px-6 py-3.5 flex items-center gap-3 animate-fade-in bg-brand-navy-deep/40">
              <div className="p-2 bg-brand-emerald/10 text-brand-emerald rounded-lg border border-brand-emerald/20 flex-shrink-0">
                <User className="w-4 h-4" />
              </div>
              <div className="flex-1 min-w-0">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Identificação do atendimento</span>
                <p className="text-xs font-extrabold text-slate-100 truncate mt-0.5">
                  {customerType === 'PARTICULAR' ? (
                    <span>Cliente: <span className="text-brand-emerald">{particularClientName.trim() || 'Particular (Consumidor)'}</span></span>
                  ) : (
                    <span>Despachante: <span className="text-brand-emerald">{selectedClient?.name || 'Não Selecionado'}</span></span>
                  )}
                </p>
              </div>
              <span className="font-sans text-[10px] font-bold py-0.5 px-2 rounded-md bg-slate-800 text-slate-300">
                {customerType === 'PARTICULAR' ? 'Particular' : 'B2B'}
              </span>
            </div>
          )}
        </div>

        {cart.length === 0 ? (
          <div id="cart-block-b-empty" className="flex-1 flex flex-col items-center justify-center gap-3 text-slate-500 py-16 px-6 bg-transparent">
            <ShoppingBag className="w-12 h-12 text-slate-700 stroke-1" />
            <div className="text-center">
              <p className="text-xs font-semibold text-slate-400">Sacola Vazia</p>
              <p className="text-[11px] text-slate-500 mt-1 max-w-xs mx-auto">
                Digite um valor no Painel ou clique no catálogo à esquerda para acumular taxas e serviços.
              </p>
            </div>
            <button
              id="focus-visor-btn-empty"
              onClick={() => {
                const visorEl = document.getElementById('visor');
                if (visorEl) (visorEl as HTMLInputElement).focus();
              }}
              className="mt-2 px-3 py-1.5 text-xs font-semibold bg-brand-navy-deep hover:bg-brand-navy-bright text-slate-300 rounded-lg border border-brand-navy-bright/10 transition cursor-pointer"
            >
              Focar no visor [F]
            </button>
          </div>
        ) : (
          <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
            
            {/* BLOCO B (Centro/Itens): Scrollable list of Items */}
            <div id="cart-block-b" className="space-y-2.5 overflow-y-auto flex-1 p-6 pr-4 min-h-[100px]" style={{ paddingBottom: isDesktop ? '180px' : '24px' }}>
              {cart.map((item, idx) => {
                const itemSubtotal = DecimalMath.mul(item.customValue || '0.00', item.quantity);

                return (
                  <div key={item.service.id + idx} className="p-4 bg-brand-navy-deep/40 rounded-lg border border-brand-navy-bright/10 space-y-3 relative">
                    
                    {/* Item title and removal */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-1">
                        <p className="text-xs font-semibold text-slate-100 line-clamp-1">
                          <span className="text-brand-emerald font-bold font-mono mr-1.5">{item.quantity}x</span>
                          {item.service.name}
                        </p>
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="text-[9px] font-mono font-bold bg-slate-850 text-slate-400 px-1.5 py-0.5 rounded-sm">
                            {item.service.type === 'DETRAN' ? 'OPERACIONAL' : item.service.type}
                          </span>
                          <span className="text-[9px] font-mono text-slate-400">
                            (sendo {DecimalMath.formatBRL(item.customValue)} a unidade)
                          </span>
                        </div>
                      </div>
                      
                      <button
                        onClick={() => handleRemoveFromCart(item.service.id)}
                        className="text-slate-400 hover:text-brand-crimson p-1 rounded-md hover:bg-brand-navy-bright transition-colors cursor-pointer"
                        title="Remover item da sacola"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {/* Informações complementares estáticas do item (Pilar 2) */}
                    {item.observation && (
                      <div className="bg-brand-navy-deep border border-brand-navy-bright/10 rounded-lg p-2.5 text-[10px] text-slate-350 italic">
                        <span className="text-[9px] font-sans font-bold text-brand-emerald not-italic uppercase tracking-wide mr-1.5">Info Complementar:</span>
                        {item.observation}
                      </div>
                    )}

                    {/* Quantity controls and Price customizer */}
                    <div className="flex items-center justify-between pt-1 border-t border-brand-navy-bright/10">
                      
                      {/* Quantities */}
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleUpdateQuantity(item.service.id, -1)}
                          className="p-1 rounded-md bg-brand-navy-bright text-slate-300 hover:bg-slate-700 transition cursor-pointer"
                        >
                          <Minus className="w-3 h-3" />
                         </button>
                        <span className="text-xs font-bold font-mono text-slate-200">{item.quantity}</span>
                        <button
                          onClick={() => handleUpdateQuantity(item.service.id, 1)}
                          className="p-1 rounded-md bg-brand-navy-bright text-slate-300 hover:bg-slate-700 transition cursor-pointer"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>

                      {/* Custom Price customizer inline */}
                      <div className="flex items-center gap-1">
                        <span className="text-[10px] text-slate-400 font-semibold">Preço R$:</span>
                        <div className="relative flex items-center pr-4">
                          <input
                            type="text"
                            value={item.customValue}
                            disabled={item.service.type === 'DETRAN' || rlsSession?.userRole === 'Operador' || rlsSession?.userRole === 'Atendente'}
                            onChange={(e) => handleUpdateCustomValue(item.service.id, e.target.value)}
                            className={`w-18 bg-brand-navy-deep border ${item.service.type === 'DETRAN' ? 'border-brand-navy-bright/10 text-slate-400' : 'border-slate-850 text-slate-200 focus:border-brand-emerald/40'} rounded-md px-1.5 py-0.5 text-center text-xs font-mono font-bold`}
                            title={item.service.type === 'DETRAN' ? 'Valores regulados são imutáveis.' : (rlsSession?.userRole === 'Operador' || rlsSession?.userRole === 'Atendente') ? 'Acesso restrito: Requer supervisor' : 'Clique para customizar'}
                          />
                          {(rlsSession?.userRole === 'Operador' || rlsSession?.userRole === 'Atendente') && item.service.type !== 'DETRAN' && (
                            <button
                              type="button"
                              onClick={() => {
                                setOverrideAction({
                                  type: 'CHANGE_PRICE',
                                  srvId: item.service.id,
                                  payload: { currentVal: item.customValue }
                                });
                                setOverrideNewPrice(floatStringToBRLMask(item.customValue));
                                setOverrideError('');
                                setSupervisorEmail('');
                                setSupervisorPassword('');
                                setShowOverrideModal(true);
                              }}
                              className="absolute right-0.5 p-0.5 hover:text-red-400 cursor-pointer text-red-500 animate-pulse"
                              title="Solicitar alteração de valor ao supervisor"
                            >
                              <Lock className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                      </div>

                    </div>

                    {/* Simple detail breakdown display line */}
                    <div className="flex justify-between items-center text-[10px] font-mono text-slate-400 bg-black/20 p-1.5 px-2 rounded-md">
                      <span>Total do Serviço</span>
                      <span className="text-brand-emerald font-bold">{DecimalMath.formatBRL(itemSubtotal)}</span>
                    </div>

                  </div>
                );
              })}
            </div>

            {/* BLOCO C (Base/Fechamento): Totals + Payment methods + Button - LOCKED AT BOTTOM */}
            <div 
              id="cart-block-c" 
              className="flex-shrink-0 border-t border-brand-navy-bright/10 p-6 pt-4 bg-brand-navy-card space-y-4 shadow-[0_-8px_24px_rgba(3,7,18,0.25)] mt-auto lg:rounded-b-2xl"
              style={isDesktop ? {
                position: 'fixed',
                bottom: '20px',
                right: '20px',
                width: `${sidebarWidth}px`,
                backgroundColor: '#0f172a',
                border: '1px solid rgba(30, 41, 59, 0.5)',
                borderRadius: '1rem',
                zIndex: 999
              } : {}}
            >
              
              {/* Subtotal of the cart */}
              <div className="bg-brand-navy-deep/40 rounded-lg p-4 border border-brand-navy-bright/10 space-y-2">
                <div className="flex justify-between items-center text-xs text-slate-400">
                  <span>Subtotal de Serviços:</span>
                  <span className="font-mono font-bold text-slate-200">
                    {DecimalMath.formatBRL(DecimalMath.add(totals.detranSub, totals.outerSub))}
                  </span>
                </div>

                <div className="border-t border-brand-navy-bright/10 pt-3 flex justify-between items-center">
                  <span className="text-xs font-bold text-slate-200">Valor total geral:</span>
                  <span className="text-base font-bold text-brand-emerald font-mono">
                    {DecimalMath.formatBRL(totals.netSum)}
                  </span>
                </div>
              </div>

              {/* ACTION ADVANCE TO PAYMENT MODAL */}
              <div className="pt-2">
                <button
                  id="checkout-advance-btn"
                  type="button"
                  onClick={() => setCheckoutStage('PAYMENT')}
                  className="w-full py-4 bg-brand-emerald hover:bg-emerald-400 text-brand-navy-deep font-sans font-extrabold text-xs uppercase tracking-wider rounded-lg transition cursor-pointer shadow-lg shadow-brand-emerald/10 hover:shadow-brand-emerald/20 flex items-center justify-center gap-2"
                >
                  <CheckSquare className="w-4 h-4" />
                  Ir para Encerramento
                </button>
              </div>

            </div>

          </div>
        )}

      </div>

      {/* ENCERRAMENTO DO ATENDIMENTO - MODAL OVERLAY (CENTRALIZADO E OFUSCADO) */}
      {checkoutStage === 'PAYMENT' && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-[8px] z-[990] flex items-center justify-center p-4 overflow-y-auto">
          <div 
            id="encerramento-atendimento-modal"
            className="bg-brand-navy-card border border-brand-navy-bright w-[480px] max-w-[90vw] rounded-2xl shadow-2xl relative animate-scale-up text-slate-300 overflow-hidden"
          >
            {/* Modal Header */}
            <div className="p-5 border-b border-brand-navy-bright flex items-center justify-between bg-brand-navy-deep/40">
              <div className="flex items-center gap-2">
                <CheckSquare className="w-5 h-5 text-brand-emerald" />
                <h3 className="text-sm font-bold text-slate-100 uppercase tracking-wider">Encerramento do Atendimento</h3>
              </div>
              <button
                type="button"
                onClick={() => setCheckoutStage('CART')}
                className="text-slate-400 hover:text-slate-200 p-1.5 rounded-lg hover:bg-slate-800 transition cursor-pointer"
                title="Cancelar e voltar"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-4">
              
              {/* Client Identification Summary */}
              <div className="bg-brand-navy-deep/50 p-3 rounded-lg border border-brand-navy-bright/10 text-xs">
                <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">Identificação do Atendimento</span>
                <p className="text-xs font-semibold text-slate-200 mt-1 truncate">
                  {customerType === 'PARTICULAR' ? (
                    <span>Cliente: <span className="text-brand-emerald font-bold">{particularClientName.trim() || 'Particular (Consumidor)'}</span></span>
                  ) : (
                    <span>Despachante: <span className="text-brand-emerald font-bold">{selectedClient?.name || 'Não Selecionado'}</span></span>
                  )}
                </p>
              </div>

              {/* Financial Totals Details */}
              {(() => {
                return (
                  <div className="bg-brand-navy-deep/20 p-4 rounded-lg border border-brand-navy-bright/10 space-y-2 text-xs">
                    <div className="flex justify-between items-center text-slate-400">
                      <span className="font-sans font-medium text-slate-400">Subtotal de Serviços:</span>
                      <span className="font-mono font-bold text-slate-200">
                        {DecimalMath.formatBRL(DecimalMath.add(totals.detranSub, totals.outerSub))}
                      </span>
                    </div>

                    <div className="flex justify-between items-center text-slate-400">
                      <span className="font-sans font-medium text-slate-450 text-[11px]">ISSQN (2% Passo Fundo):</span>
                      <span className="font-mono text-slate-350 font-bold">{DecimalMath.formatBRL(totals.issqnValue)}</span>
                    </div>

                    <div className="border-t border-brand-navy-bright/10 pt-2.5 flex justify-between items-center">
                      <span className="font-sans font-bold text-slate-100 uppercase text-[10px] tracking-wider">Valor Total Líquido:</span>
                      <span className="text-lg font-black text-brand-emerald font-mono">
                        {DecimalMath.formatBRL(totals.netSum)}
                      </span>
                    </div>
                  </div>
                );
              })()}

              {/* Integrated Finance Selector */}
              <div className="space-y-3">
                <span className="text-[10px] uppercase font-mono font-bold tracking-wider text-slate-400 block">
                  Método de liquidação do atendimento
                </span>
                
                <div className="grid grid-cols-2 gap-1.5">
                  {[
                    { id: 'PIX', label: 'PIX' },
                    { id: 'CREDIT_CARD', label: 'Cartão de Crédito' },
                    { id: 'DEBIT_CARD', label: 'Cartão de Débito' },
                    { id: 'CASH', label: 'Dinheiro' },
                    ...(customerType === 'B2B' && selectedClient?.category === 'Despachante Credenciado' ? [{ id: 'BOLETO', label: 'Faturamento de Guia' }] : [])
                  ].map(m => {
                    const isActive = paymentMethod === m.id;
                    return (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => {
                          setPaymentMethod(m.id as any);
                          if (m.id === 'CASH') {
                            setTimeout(() => {
                              document.getElementById('received-amount')?.focus();
                            }, 100);
                          }
                        }}
                        className={`py-2 px-3 rounded-lg border text-[11px] text-left font-semibold transition-all flex items-center justify-between cursor-pointer ${
                          isActive
                            ? 'bg-brand-emerald/10 border-brand-emerald/40 text-brand-emerald'
                            : 'bg-brand-navy-deep border-brand-navy-bright/10 text-slate-300 hover:bg-slate-800'
                        }`}
                      >
                        <span>{m.label}</span>
                        {isActive && <div className="w-1.5 h-1.5 rounded-full bg-brand-emerald" />}
                      </button>
                    );
                  })}
                </div>

                {/* Mode Details Section */}
                <div className="bg-brand-navy-deep/40 border border-brand-navy-bright/10 p-4 rounded-lg text-xs space-y-2">
                  
                  {paymentMethod === 'PIX' && (
                    <p className="text-[10px] text-slate-400 text-center font-mono py-4">
                      PIX selecionado como forma de pagamento. Prossiga para encerrar o atendimento.
                    </p>
                  )}

                  {paymentMethod === 'CREDIT_CARD' && (
                    <div className="flex items-center justify-between gap-1.5">
                      <div>
                        <span className="text-[9px] text-slate-400 font-semibold block mb-1">Prestações</span>
                        <select
                          value={installments}
                          aria-label="Parcelas"
                          onChange={(e) => setInstallments(parseInt(e.target.value))}
                          className="bg-brand-navy-card border border-brand-navy-bright/10 rounded-md py-1 px-2.5 text-slate-200 text-xs focus:outline-none"
                        >
                          {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(num => (
                            <option key={num} value={num}>{num === 1 ? '1x (À Vista)' : `${num}x`}</option>
                          ))}
                        </select>
                      </div>
                      <span className="text-[10px] font-semibold text-slate-300 font-mono text-right font-bold">
                        {creditCardInstallmentText()}
                      </span>
                    </div>
                  )}

                  {paymentMethod === 'DEBIT_CARD' && (
                    <p className="text-[10px] text-slate-400 text-center font-mono">
                      Aguardando inserção do cartão no terminal pinpad físico... (Taxa: 0.85%)
                    </p>
                  )}

                  {paymentMethod === 'BOLETO' && (
                    <p className="text-[10px] text-slate-400 text-center font-mono">
                      Faturado D+3 para Despachantes Credenciados. Liberação de guias permitida.
                    </p>
                  )}

                  {paymentMethod === 'CASH' && (
                    <div className="space-y-2.5">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] text-slate-400 font-mono font-bold uppercase tracking-wider">Dinheiro recebido (R$):</span>
                        <input
                          id="received-amount"
                          type="text"
                          inputMode="decimal"
                          pattern="[0-9]*[.,]?[0-9]*"
                          step="0.01"
                          placeholder="0.00"
                          value={cashReceived}
                          onChange={(e) => {
                            let cleanInput = e.target.value.replace(',', '.').replace(/[^0-9.]/g, '');
                            const parts = cleanInput.split('.');
                            if (parts.length > 2) {
                              cleanInput = parts[0] + '.' + parts.slice(1).join('');
                            }
                            setCashReceived(cleanInput);
                          }}
                          className="w-24 bg-brand-navy-card border border-brand-navy-bright/30 rounded-md px-1.5 py-1 text-right font-mono text-xs text-slate-200 focus:outline-none focus:border-brand-emerald/75 transition-all font-bold shadow-inner"
                        />
                      </div>
                      
                      {/* EXIBIÇÃO DO TROCO EM JETBRAINS MONO */}
                      <div className="flex justify-between items-center py-2 px-3 bg-brand-navy-deep/40 rounded-lg border border-brand-navy-bright/10 text-[11px] font-mono">
                        <span className="text-slate-400 font-extrabold uppercase">Troco:</span>
                        <span id="change-display" className={`font-black text-xs ${parseFloat(cashReceived.toString().replace(',', '.') || '0') >= parseFloat(totals.netSum.toString().replace(',', '.') || '0') ? 'text-brand-emerald animate-pulse' : 'text-red-400'}`}>
                          {changeValue()}
                        </span>
                      </div>
                    </div>
                  )}

                </div>
              </div>

            </div>

            {/* Modal Footer / Action Button */}
            <div className="p-5 bg-brand-navy-deep/40 border-t border-brand-navy-bright">
              <button
                id="checkout-finalize-btn"
                type="button"
                disabled={isCheckoutDisabled}
                onClick={handleFinishTransaction}
                className="w-full py-3.5 bg-brand-emerald hover:bg-emerald-400 text-brand-navy-deep font-sans font-bold text-xs rounded-lg transition cursor-pointer shadow-lg shadow-brand-emerald/10 hover:shadow-brand-emerald/20 flex items-center justify-center gap-1.5 disabled:bg-slate-800 disabled:text-slate-500 disabled:cursor-not-allowed"
                title={
                  isCashInsufficient 
                    ? 'Dinheiro pago pelo cliente insuficiente para cobrir o total geral da sacola.' 
                    : 'Finalizar Atendimento'
                }
              >
                <CheckSquare className="w-4 h-4" />
                Encerrar Atendimento e Emitir Cupom
              </button>
            </div>

          </div>
        </div>
      )}

      {/* RETAINED BILL MODAL - Renders beautifully if recentlyCreatedTx is set */}
      {recentlyCreatedTx && (
        <div className="fixed inset-0 bg-brand-navy-deep/82 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in overflow-y-auto">
          <div className="bg-slate-950 text-slate-300 rounded-2xl max-w-lg w-full p-6 shadow-2xl relative border border-brand-navy-bright/50 my-8">
            
            {/* Stamp simulation */}
            <div className="absolute top-4 right-4 bg-brand-emerald/10 text-brand-emerald border border-brand-emerald/30 font-mono text-[9px] uppercase px-2 py-0.5 rounded font-bold">
              Postgres RLS Logged
            </div>

            {/* Container das duas vias */}
            <div className="space-y-6 max-h-[70vh] overflow-y-auto pr-1">
              
              {/* 1ª VIA - ESTABELECIMENTO */}
              <div className="p-4 bg-slate-900/60 rounded-xl border border-dashed border-slate-800 space-y-4">
                <div className="text-center border-b border-dashed border-slate-700 pb-3">
                  <div className="inline-flex py-0.5 px-2 bg-brand-emerald/10 text-brand-emerald rounded text-[9px] uppercase font-mono font-bold tracking-wider mb-2">
                    1ª Via - Estabelecimento
                  </div>
                  <h4 className="font-display font-bold text-base text-slate-100 tracking-tight">MARKS SYSTEMS S.A.</h4>
                  <p className="text-[9px] text-slate-400 font-mono uppercase mt-0.5">IntegraPDV Ecosystem Integration</p>
                  <p className="text-[9px] text-slate-400 font-mono mt-0.5">CNPJ: 10.392.482/0001-90 | POA - RS</p>
                </div>

                {/* Invoice Metadata */}
                <div className="py-2 border-b border-dashed border-slate-700 text-[11px] font-mono space-y-1 text-slate-400">
                  <div className="flex justify-between">
                    <span>Sequência No:</span>
                    <span className="font-bold text-slate-100">{recentlyCreatedTx.sequenceId}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Operador:</span>
                    <span className="text-slate-100">{recentlyCreatedTx.createdBy.userName} ({recentlyCreatedTx.createdBy.userRole})</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Data Emissão:</span>
                    <span className="text-slate-100">{new Date(recentlyCreatedTx.timestamp).toLocaleString('pt-BR')}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Cliente/B2B:</span>
                    <span className="text-brand-emerald max-w-[200px] text-right truncate font-bold">{recentlyCreatedTx.clientName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>CNPJ/CPF:</span>
                    <span className="text-slate-100">{recentlyCreatedTx.clientCpfCnpj}</span>
                  </div>
                </div>

                {/* List of services executed */}
                <div className="py-2 border-b border-dashed border-slate-700 text-xs space-y-1.5">
                  <span className="text-[9px] font-mono font-bold text-slate-400 uppercase tracking-wide block">Taxas e Encargos Prestados:</span>
                  <div className="space-y-1 font-mono text-slate-300">
                    {recentlyCreatedTx.items.map((item, id) => (
                      <div key={id} className="space-y-0.5">
                        <div className="flex justify-between text-[11px]">
                          <span className="truncate max-w-[240px] text-slate-400">{item.quantity}x {item.serviceName}</span>
                          <span className="font-bold text-slate-100">{DecimalMath.formatBRL(item.subtotal)}</span>
                        </div>
                        {item.observation && (
                          <div className="text-[9.5px] italic text-slate-500 font-sans pl-3 text-left">
                            * Obs: {item.observation}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Breakdown */}
                <div className="py-2 border-b border-dashed border-slate-700 text-[10px] font-mono space-y-1 text-slate-400">
                  <div className="flex justify-between">
                    <span>Subtotal de Serviços:</span>
                    <span>{DecimalMath.formatBRL(DecimalMath.add(recentlyCreatedTx.detranSubtotal, recentlyCreatedTx.otherSubtotal))}</span>
                  </div>
                  {recentlyCreatedTx.issqn && parseFloat(recentlyCreatedTx.issqn) > 0 && (
                    <div className="flex justify-between">
                      <span>ISSQN Municipal (2%):</span>
                      <span>{DecimalMath.formatBRL(recentlyCreatedTx.issqn)}</span>
                    </div>
                  )}
                </div>

                {/* Sub-total */}
                <div className="flex justify-between items-center bg-slate-900 border border-slate-800 p-2.5 rounded-lg">
                  <span className="text-[10px] font-bold text-slate-400">VALOR TOTAL LÍQUIDO:</span>
                  <span className="text-sm font-mono font-bold text-brand-emerald">{DecimalMath.formatBRL(recentlyCreatedTx.netTotal)}</span>
                </div>

                <div className="text-[9px] text-slate-500 font-mono text-center space-y-0.5">
                  <p>Meio de Liquidação: {recentlyCreatedTx.paymentMethod === 'BOLETO' ? 'Faturamento' : recentlyCreatedTx.paymentMethod} {recentlyCreatedTx.installments > 1 ? `(${recentlyCreatedTx.installments}x)` : ''}</p>
                  <p>AUT AUTENTICAÇÃO: {recentlyCreatedTx.id.toUpperCase()}</p>
                </div>
              </div>

              {/* Linha divisória de rasgar papel cupom */}
              <div className="relative flex items-center justify-center my-4">
                <div className="absolute inset-0 flex items-center" aria-hidden="true">
                  <div className="w-full border-t border-dashed border-brand-navy-bright" />
                </div>
                <span className="relative px-3 bg-slate-1500 text-[10px] font-mono text-slate-500 uppercase font-bold tracking-widest flex items-center gap-1">
                  ✂️ CORTE DE VIA ✂️
                </span>
              </div>

              {/* 2ª VIA - CLIENTE */}
              <div className="p-4 bg-slate-900/60 rounded-xl border border-dashed border-slate-800 space-y-4">
                <div className="text-center border-b border-dashed border-slate-700 pb-3">
                  <div className="inline-flex py-0.5 px-2 bg-brand-emerald/10 text-brand-emerald rounded text-[9px] uppercase font-mono font-bold tracking-wider mb-2">
                    2ª Via - Cliente
                  </div>
                  <h4 className="font-display font-bold text-base text-slate-100 tracking-tight">MARKS SYSTEMS S.A.</h4>
                  <p className="text-[9px] text-slate-400 font-mono uppercase mt-0.5">IntegraPDV Ecosystem Integration</p>
                  <p className="text-[9px] text-slate-400 font-mono mt-0.5">CNPJ: 10.392.482/0001-90 | POA - RS</p>
                </div>

                {/* Invoice Metadata */}
                <div className="py-2 border-b border-dashed border-slate-700 text-[11px] font-mono space-y-1 text-slate-400">
                  <div className="flex justify-between">
                    <span>Sequência No:</span>
                    <span className="font-bold text-slate-100">{recentlyCreatedTx.sequenceId}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Operador:</span>
                    <span className="text-slate-100">{recentlyCreatedTx.createdBy.userName} ({recentlyCreatedTx.createdBy.userRole})</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Data Emissão:</span>
                    <span className="text-slate-100">{new Date(recentlyCreatedTx.timestamp).toLocaleString('pt-BR')}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Cliente/B2B:</span>
                    <span className="text-brand-emerald max-w-[200px] text-right truncate font-bold">{recentlyCreatedTx.clientName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>CNPJ/CPF:</span>
                    <span className="text-slate-100">{recentlyCreatedTx.clientCpfCnpj}</span>
                  </div>
                </div>

                {/* List of services executed */}
                <div className="py-2 border-b border-dashed border-slate-700 text-xs space-y-1.5">
                  <span className="text-[9px] font-mono font-bold text-slate-400 uppercase tracking-wide block">Taxas e Encargos Prestados:</span>
                  <div className="space-y-1 font-mono text-slate-300">
                    {recentlyCreatedTx.items.map((item, id) => (
                      <div key={id} className="space-y-0.5">
                        <div className="flex justify-between text-[11px]">
                          <span className="truncate max-w-[240px] text-slate-400">{item.quantity}x {item.serviceName}</span>
                          <span className="font-bold text-slate-100">{DecimalMath.formatBRL(item.subtotal)}</span>
                        </div>
                        {item.observation && (
                          <div className="text-[9.5px] italic text-slate-500 font-sans pl-3 text-left">
                            * Obs: {item.observation}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Breakdown */}
                <div className="py-2 border-b border-dashed border-slate-700 text-[10px] font-mono space-y-1 text-slate-400">
                  <div className="flex justify-between">
                    <span>Subtotal de Serviços:</span>
                    <span>{DecimalMath.formatBRL(DecimalMath.add(recentlyCreatedTx.detranSubtotal, recentlyCreatedTx.otherSubtotal))}</span>
                  </div>
                  {recentlyCreatedTx.issqn && parseFloat(recentlyCreatedTx.issqn) > 0 && (
                    <div className="flex justify-between">
                      <span>ISSQN Municipal (2%):</span>
                      <span>{DecimalMath.formatBRL(recentlyCreatedTx.issqn)}</span>
                    </div>
                  )}
                </div>

                {/* Sub-total */}
                <div className="flex justify-between items-center bg-slate-900 border border-slate-800 p-2.5 rounded-lg">
                  <span className="text-[10px] font-bold text-slate-400">VALOR TOTAL LÍQUIDO:</span>
                  <span className="text-sm font-mono font-bold text-brand-emerald">{DecimalMath.formatBRL(recentlyCreatedTx.netTotal)}</span>
                </div>

                <div className="text-[9px] text-slate-500 font-mono text-center space-y-0.5">
                  <p>Meio de Liquidação: {recentlyCreatedTx.paymentMethod === 'BOLETO' ? 'Faturamento' : recentlyCreatedTx.paymentMethod} {recentlyCreatedTx.installments > 1 ? `(${recentlyCreatedTx.installments}x)` : ''}</p>
                  <p>AUT AUTENTICAÇÃO: {recentlyCreatedTx.id.toUpperCase()}</p>
                </div>
              </div>

            </div>

            {/* Ações de fechamento e impressão */}
            <div className="mt-5 pt-3 border-t border-brand-navy-bright/60 text-center">
              <button
                id="receipt-close-btn"
                onClick={() => {
                  setRecentlyCreatedTx(null);
                  setTimeout(() => {
                    typedValueInputRef.current?.focus();
                  }, 100);
                }}
                className="w-full py-2.5 bg-brand-emerald text-brand-navy-deep font-display font-bold rounded-xl text-xs hover:bg-emerald-400 transition cursor-pointer shadow-lg shadow-brand-emerald/10 flex items-center justify-center gap-1.5"
              >
                Concluído · Imprimir 2 Vias
              </button>
            </div>

          </div>
        </div>
      )}

      {/* SUPERVISOR SECURITY OVERRIDE MODAL (RBAC) */}
      {showOverrideModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-md bg-brand-navy-card/95 border border-red-500/30 rounded-2xl p-6 shadow-2xl relative space-y-4">
            
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-red-500/10 border border-red-500/25 rounded-xl text-red-500 animate-pulse">
                <ShieldAlert className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-display font-black text-sm uppercase tracking-wide text-slate-100">
                  Ação Restrita
                </h3>
                <p className="text-xs text-slate-400 font-sans">
                  Autorização de Supervisor Requerida
                </p>
              </div>
            </div>

            <div className="bg-brand-navy-deep/40 rounded-xl p-3 border border-brand-navy-bright/60 space-y-1">
              <span className="block text-[10px] font-mono uppercase tracking-wider text-slate-400">Tipo de Quebra:</span>
              <p className="text-xs font-mono font-bold text-red-400">
                {overrideAction?.type === 'REMOVE' 
                  ? '🗑️ EXCLUSÃO DEFINITIVA DE ITEM NA SACOLA' 
                  : overrideAction?.type === 'DECREASE_QTY'
                  ? '📉 REDUÇÃO DA QUANTIDADE UNITÁRIA DE ITEM'
                  : '🔧 MODIFICAÇÃO DE VALOR PREVIAMENTE REGISTRADO'}
              </p>
            </div>

            {/* Error banner */}
            {overrideError && (
              <div className="p-3 bg-red-500/10 border border-red-500/30 text-red-400 text-xs font-semibold rounded-lg">
                ⚠️ {overrideError}
              </div>
            )}

            <div className="space-y-3.5">
              {overrideAction?.type === 'CHANGE_PRICE' && (
                <div className="space-y-1 bg-brand-navy-deep/60 p-3 rounded-xl border border-brand-emerald/20">
                  <label className="block text-[10px] uppercase font-sans text-brand-emerald font-extrabold">
                    Novo Valor Autorizado pelo Supervisor (R$)
                  </label>
                  <input
                    id="override-sup-newprice"
                    type="text"
                    value={overrideNewPrice}
                    onChange={(e) => {
                      const raw = e.target.value.replace(/[^0-9]/g, '');
                      if (!raw) {
                        setOverrideNewPrice('R$ 0,00');
                        return;
                      }
                      const cents = parseInt(raw, 10);
                      const floatVal = cents / 100;
                      setOverrideNewPrice(floatStringToBRLMask(floatVal.toFixed(2)));
                    }}
                    className="w-full bg-brand-navy-card border border-brand-emerald/40 text-brand-emerald rounded-lg py-2 px-3 text-sm font-mono font-bold text-center focus:outline-none"
                  />
                </div>
              )}

              <div className="space-y-1">
                <label className="block text-[10px] uppercase font-mono text-slate-400 font-extrabold" htmlFor="override-sup-email">
                  E-mail do Supervisor (Master / Gerente / Financeiro)
                </label>
                <input
                  id="override-sup-email"
                  type="email"
                  placeholder="supervisor@corporativo.com"
                  value={supervisorEmail}
                  onChange={(e) => setSupervisorEmail(e.target.value)}
                  className="w-full bg-brand-navy-deep border border-brand-navy-bright rounded-lg py-2.5 px-3 text-xs text-slate-200 font-mono focus:outline-none focus:border-red-500/65"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-[10px] uppercase font-mono text-slate-400 font-extrabold" htmlFor="override-sup-pass">
                  Senha / PIN de Autorização
                </label>
                <input
                  id="override-sup-pass"
                  type="password"
                  placeholder="••••••••"
                  value={supervisorPassword}
                  onChange={(e) => setSupervisorPassword(e.target.value)}
                  className="w-full bg-brand-navy-deep border border-brand-navy-bright rounded-lg py-2.5 px-3 text-xs text-slate-200 font-mono focus:outline-none focus:border-red-500/65"
                />
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  setShowOverrideModal(false);
                  setOverrideAction(null);
                  setSupervisorEmail('');
                  setSupervisorPassword('');
                  setOverrideNewPrice('R$ 0,00');
                  setOverrideError('');
                }}
                className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs rounded-xl cursor-pointer"
              >
                Cancelar Operação
              </button>
              <button
                type="button"
                onClick={handleApproveOverride}
                className="flex-1 py-2.5 bg-red-500 hover:bg-red-600 text-white font-bold text-xs rounded-xl cursor-pointer shadow-lg shadow-red-500/10"
              >
                Liberar com Biometria
              </button>
            </div>

          </div>
        </div>
      )}

      {/* EXCLUSION CONFIRMATION MODAL */}
      {deleteServiceConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-fade-in">
          <div className="w-full max-w-md bg-brand-navy-deep border border-red-500/30 rounded-2xl p-6 shadow-2xl relative space-y-4">
            
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-red-500/10 border border-red-500/25 rounded-xl text-red-500 animate-pulse">
                <ShieldAlert className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-sans font-black text-sm uppercase tracking-wide text-slate-100">
                  Confirmação de Exclusão
                </h3>
                <p className="text-[10px] text-slate-400 font-sans uppercase tracking-wider">
                  Módulo de Governança e Auditoria
                </p>
              </div>
            </div>

            <div className="p-4 bg-brand-navy-card border border-brand-navy-bright/30 rounded-xl space-y-2">
              <p className="text-xs text-slate-200 leading-relaxed font-sans">
                Atenção: Deseja excluir o serviço <span className="text-red-400 font-bold">"{deleteServiceConfirm.name}"</span>?
              </p>
              <div className="pt-2 flex items-center justify-between border-t border-brand-navy-bright/15">
                <span className="text-[9px] font-mono text-slate-400 uppercase">Valor Base:</span>
                <span className="text-xs font-mono font-bold text-brand-emerald">
                  {DecimalMath.formatBRL(deleteServiceConfirm.baseValue)}
                </span>
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDeleteServiceConfirm(null)}
                className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-sans font-bold text-xs rounded-xl cursor-pointer transition-all uppercase tracking-wider"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={async () => {
                  try {
                    const { error } = await supabase
                      .from('servicos')
                      .delete()
                      .eq('id', deleteServiceConfirm.id);
                    if (error) throw error;
                    setServices(prev => prev.filter(s => s.id !== deleteServiceConfirm.id));
                    setDeleteServiceConfirm(null);
                    showToast('Serviço Removido', 'Operação realizada!', 'success');
                  } catch (err: any) {
                    showToast('Erro ao Excluir', 'Não foi possível remover o serviço do catálogo.', 'alert');
                  }
                }}
                className="flex-1 py-2.5 bg-red-600 hover:bg-red-500 text-white font-sans font-bold text-xs rounded-xl cursor-pointer transition-all shadow-lg shadow-red-600/10 uppercase tracking-wider"
              >
                Sim, Confirmar Exclusão
              </button>
            </div>

          </div>
        </div>
      )}

      {/* Modal B2B Desfocado de Seleção */}
      {showB2BModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-md transition-all duration-300">
          <div className="w-full max-w-lg bg-[#0d1117] border border-brand-navy-bright/60 rounded-2xl shadow-2xl p-6 relative animate-zoom-in text-slate-100">
            {/* Cabeçalho */}
            <div className="flex justify-between items-center pb-4 border-b border-brand-navy-bright/20 mb-4">
              <h3 className="text-sm font-bold text-brand-emerald uppercase tracking-wider flex items-center gap-2">
                <User className="w-4.5 h-4.5" />
                Selecionar Despachante Parceiro B2B
              </h3>
              <button
                type="button"
                onClick={() => setShowB2BModal(false)}
                className="text-xs bg-brand-navy-deep hover:bg-slate-800 border border-brand-navy-bright/35 text-slate-400 hover:text-slate-200 px-3 py-1.5 rounded-lg transition-colors cursor-pointer"
              >
                Fechar
              </button>
            </div>

            {/* Input de Busca no Modal */}
            <div className="relative mb-4">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <input
                type="text"
                placeholder="Buscar por razão social, nome ou CNPJ..."
                value={searchB2BQuery}
                onChange={(e) => setSearchB2BQuery(e.target.value)}
                className="w-full bg-brand-navy-deep border border-brand-navy-bright/30 focus:border-brand-emerald/60 rounded-xl pl-9 pr-4 py-2.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none transition-all font-mono"
              />
            </div>

            {/* Lista com Rolagem */}
            <div className="max-h-60 overflow-y-auto space-y-2 pr-1">
              {clients
                .filter(c => c.category !== 'Particular' && 
                  (c.name.toLowerCase().includes(searchB2BQuery.toLowerCase()) || 
                   c.cpfCnpj.includes(searchB2BQuery))
                )
                .map((client) => {
                  const isSelected = selectedClient?.id === client.id;
                  return (
                    <button
                      key={client.id}
                      type="button"
                      onClick={() => {
                        setSelectedClient(client);
                        setParticularClientName('');
                        setShowB2BModal(false);
                        if (paymentMethod === 'BOLETO' && client.category !== 'Despachante Credenciado') {
                          setPaymentMethod('PIX');
                        }
                      }}
                      className={`w-full text-left p-3 rounded-xl border transition-all flex items-center justify-between cursor-pointer ${
                        isSelected
                          ? 'bg-brand-emerald/10 border-brand-emerald/40 text-brand-emerald font-bold'
                          : 'bg-brand-navy-deep/40 border-brand-navy-bright/10 text-slate-300 hover:bg-brand-navy-card/60 hover:border-brand-navy-bright/35'
                      }`}
                    >
                      <div>
                        <span className="block font-semibold text-xs text-slate-200">{client.name}</span>
                        <span className="block text-[10px] text-slate-500 font-mono mt-0.5">
                          {client.cpfCnpj} · {client.category}
                        </span>
                        {parseFloat(client.outstandingBalance || '0') > 0 && (
                          <span className="inline-block mt-1 text-[9px] font-mono text-red-400 bg-red-950/40 border border-red-900/30 px-1.5 py-0.5 rounded">
                            Saldo Devedor: {DecimalMath.formatBRL(client.outstandingBalance || '0.00')}
                          </span>
                        )}
                      </div>
                      {isSelected && <div className="w-2.5 h-2.5 rounded-full bg-brand-emerald shadow-[0_0_10px_rgba(16,185,129,0.5)]" />}
                    </button>
                  );
                })}
              {clients.filter(c => c.category !== 'Particular' && 
                (c.name.toLowerCase().includes(searchB2BQuery.toLowerCase()) || 
                 c.cpfCnpj.includes(searchB2BQuery))
              ).length === 0 && (
                <p className="text-xs text-slate-500 text-center py-6 font-sans">Nenhum despachante parceiro encontrado.</p>
              )}
            </div>

            {/* Footer do Modal */}
            <div className="mt-4 pt-4 border-t border-brand-navy-bright/20 flex justify-end">
              <button
                type="button"
                onClick={() => setShowB2BModal(false)}
                className="bg-brand-navy-bright hover:bg-slate-800 text-xs font-semibold px-4 py-2 rounded-xl text-slate-350 hover:text-white transition-all cursor-pointer"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
