/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { jsPDF } from 'jspdf';
import Header from './components/Header';
import PdvSection from './components/PdvSection';
import FluxoCaixaSection from './components/FluxoCaixaSection';
import LoginScreen from './components/LoginScreen';
import AberturaCaixaModal from './components/AberturaCaixaModal';
import FechamentoCaixaModal from './components/FechamentoCaixaModal';
import { Transaction, RlsSession, ClientProfile, CaixaState, CashTransaction, OperatorTimelineEvent } from './types';
import { DecimalMath } from './utils/numericPrice';
import { createClient } from '@supabase/supabase-js';
const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL || '',
  import.meta.env.VITE_SUPABASE_ANON_KEY || ''
);
import { 
  Building2, Briefcase, Play, Pause, Activity, 
  ShoppingBag, HelpCircle, Shield, AlertCircle, Sparkles, CheckCircle, Lock, Coins, DollarSign,
  Printer, FileText
} from 'lucide-react';

export interface AuditReport {
  terminalId: string;
  dataOperacional: string;
  horarioAbertura: string;
  horarioFechamento: string;
  usuarioMaster: string;
  fundoTroco: string;
  entradasDinheiro: string;
  entradasPix: string;
  entradasCredito: string;
  entradasDebito: string;
  entradasBoleto: string;
  reforcos: string;
  retiradas: string;
  saldoEsperado: string;
  saldoInformado: string;
  divergencia: string;
  status: 'Quebra de Caixa' | 'Sobra de Caixa' | 'Conciliado';
  particularQty: number;
  particularTotal: string;
  b2bQty: number;
  b2bTotal: string;
  timeline?: OperatorTimelineEvent[];
}

interface Toast {
  id: string;
  title: string;
  message: string;
  type: 'success' | 'info' | 'alert';
}

const generateUUID = () => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
};

const normalizeOperationalDate = (dateVal: any): string => {
  if (!dateVal) return '';
  try {
    if (typeof dateVal === 'string' && dateVal.includes('/')) {
      const parts = dateVal.split('/');
      if (parts.length === 3) {
        return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
      }
    }
    const isoMatch = typeof dateVal === 'string' && dateVal.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (isoMatch) {
      return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;
    }
    const d = new Date(dateVal);
    if (!isNaN(d.getTime())) {
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    }
  } catch (e) {
    console.error('Erro ao normalizar data:', e);
  }
  return String(dateVal);
};

export default function App() {
  // Global Transactions in-memory database
  const [transactions, setTransactions] = useState<Transaction[]>([]);

  // Global Clients Database for B2B accounts outstanding balance
  const [clients, setClients] = useState<ClientProfile[]>([]);

  // Trava de segurança para carregamento inicial de dados
  const [isDataLoaded, setIsDataLoaded] = useState(false);

  // Terminal IP state for dynamic capture
  const [terminalIp, setTerminalIp] = useState('127.0.0.1');
  const [terminalId] = useState<string>(() => {
    return localStorage.getItem('integra_terminal_id') || 'Caixa_01';
  });

  useEffect(() => {
    const fetchIp = async () => {
      try {
        const res = await fetch('https://api.ipify.org?format=json');
        const data = await res.json();
        if (data && data.ip) {
          setTerminalIp(data.ip);
        }
      } catch (err) {
        console.error('Erro ao obter IP do terminal:', err);
      }
    };
    fetchIp();
  }, []);

  // Contador em tempo real de caixas com status Aberto (sem filtro de data para consistência inter-dia)
  const fetchActiveBoxesCount = async () => {
    try {
      const { count, error } = await supabase
        .from('controle_turnos')
        .select('*', { count: 'exact' })
        .eq('status_turno', 'Aberto');
      
      if (error) throw error;

      setActiveBoxesCount(count || 0);
    } catch (e) {
      console.error('ERRO BI MASTER Caixas Ativos:', e);
      setActiveBoxesCount(0); // Garante que mostre 0 em caso de erro
    }
  };

  // Isolamento do cálculo de faturamento do dia para Master/Admin (com cruzamento em memória contra erros 400 do PostgREST)
  const fetchActiveTurnoFinanceData = async () => {
    try {
      // 1. SELECT na tabela controle_turnos para obter os turnos
      const { data: turnosData, error: turnosError } = await supabase
        .from('controle_turnos')
        .select('*');

      if (turnosError) throw turnosError;

      // Filtra em memória os turnos abertos
      const turnosAbertos = (turnosData || []).filter((t: any) => 
        t && (t.status === 'Aberto' || t.status_turno === 'Aberto')
      );

      // Política de completo zeramento: se não houver nenhum caixa aberto
      if (turnosAbertos.length === 0) {
        setFaturamentoDiaMaster('0.00');
        // Para garantir que o BI Central zere Pix, Dinheiro e Cartão também, removemos quaisquer turnos 'Aberto' do historicalClosings
        setHistoricalClosings(prev => prev.map(c => (c && (c.status === 'Aberto' || c.status_turno === 'Aberto')) ? { ...c, status: 'Fechado' } : c));
        return;
      }

      // 2. SELECT na tabela transacoes para buscar transações criadas hoje (D+0)
      const hojeInicio = new Date();
      hojeInicio.setHours(0,0,0,0);
      const hojeISO = hojeInicio.toISOString();

      // Buscamos apenas os campos necessários de forma simples, omitindo chaves estrangeiras que podem falhar no banco
      const { data: txs, error: txsError } = await supabase
        .from('transacoes')
        .select('valor_liquido, valor_bruto, status_conciliacao, criado_em, operador_email, data_operacional, terminal_id')
        .gte('criado_em', hojeISO);

      if (txsError) throw txsError;

      if (!txs || txs.length === 0) {
        setFaturamentoDiaMaster('0.00');
        return;
      }

      let sum = 0;
      txs.forEach((tx: any) => {
        if (!tx) return;
        if (tx.status_conciliacao === 'CANCELLED' || tx.status === 'CANCELLED') return;
        if (!tx.criado_em && !tx.data_operacional) return;

        // Cruzamento na memória da aplicação baseando-se no data_operacional, operador e terminal
        const matchedTurno = turnosAbertos.find((t: any) => 
          t &&
          t.data_operacional &&
          tx.data_operacional &&
          normalizeOperationalDate(t.data_operacional) === normalizeOperationalDate(tx.data_operacional) &&
          (t.terminal_id === tx.terminal_id || t.terminalId === tx.terminal_id) &&
          (t.usuario_master === tx.operador_email || t.operador_email === tx.operador_email)
        );

        if (matchedTurno) {
          const val = parseFloat(tx.valor_liquido || tx.valor_bruto || '0') || 0;
          sum += val;
        }
      });

      setFaturamentoDiaMaster(sum.toFixed(2));
    } catch (e) {
      console.error('ERRO BI MASTER:', e);
      // Mantém o valor anterior em memória
    }
  };

  const fetchInitialData = async (isSilent = false) => {
    if (!isSilent) {
      setIsDataLoaded(false);
    }
    // Desativação de cache e limpeza de persistência para evitar valores colados
    setTransactions([]);
    setClients([]);
    setHistoricalClosings([]);
    try {
      // 1. Buscar transações
      const { data: txData, error: txError } = await supabase
        .from('transacoes')
        .select('*')
        .order('criado_em', { ascending: false });
      if (txError) throw txError;

      // 2. Buscar despachantes
      const { data: clientData, error: clientError } = await supabase
        .from('despachantes')
        .select('*')
        .order('razao_social');
      if (clientError) throw clientError;

      // 3. Buscar atas de fechamento de turnos
      const { data: turnosData, error: turnosError } = await supabase
        .from('controle_turnos')
        .select('*')
        .order('horario', { ascending: false });
      if (turnosError) throw turnosError;

      // Validação estrita contra nulos ou indefinidos (Anti-Zeroing) antes de atualizar os estados
      if (!txData || !clientData || !turnosData) {
        console.warn('Dados inválidos ou incompletos recebidos do Supabase. Ignorando atualização de estados.');
        setIsDataLoaded(true);
        return;
      }

      // Atualiza os estados locais simultaneamente
      setTransactions(txData.map((tx: any) => {
        const calculatedIssqn = tx.issqn ? parseFloat(tx.issqn).toFixed(2) : (parseFloat(tx.valor_bruto || '0') * 0.02).toFixed(2);
        const netTotalVal = parseFloat(tx.valor_liquido || tx.valor_bruto || '0').toFixed(2);
        const brutoVal = parseFloat(tx.valor_bruto || '0').toFixed(2);
        const activeStatus = tx.status_conciliacao || 'PAID';

        const rawClientName = tx.cliente_nome || 'Particular (Consumidor)';
        
        // Regex extrator do CPF/CNPJ acoplado no nome
        const cpfCnpjMatch = rawClientName.match(/\((?:CPF|CNPJ):\s*([^\)]+)\)/i);
        const clientCpfCnpj = cpfCnpjMatch ? cpfCnpjMatch[1].trim() : '000.000.000-00';
        const clientName = rawClientName.replace(/\s*\((?:CPF|CNPJ):[^\)]+\)/i, '').trim();

        const mappedItems = tx.itens || [{
          serviceName: 'Serviço Operacional - Liquidação Balcão',
          type: 'GERAL',
          value: brutoVal,
          quantity: 1,
          subtotal: brutoVal
        }];

        const detranSub = tx.detran_subtotal ? parseFloat(tx.detran_subtotal).toFixed(2) : '0.00';
        const honorariosSub = tx.honorarios_subtotal ? parseFloat(tx.honorarios_subtotal).toFixed(2) : '0.00';
        const otherSub = tx.other_subtotal ? parseFloat(tx.other_subtotal).toFixed(2) : brutoVal;

        // Reconciliação do relacionamento de turno em memória (procura turno correspondente pelo operador/usuario_master, data operacional e terminal)
        const matchedTurno = turnosData.find((t: any) => 
          normalizeOperationalDate(t.data_operacional) === normalizeOperationalDate(tx.data_operacional) &&
          (t.usuario_master === tx.operador_email || t.operador_email === tx.operador_email) &&
          t.terminal_id === tx.terminal_id
        );

        return {
          id: tx.id,
          sequenceId: `PDV-${tx.id.substring(0, 4).toUpperCase()}`,
          timestamp: tx.criado_em || new Date().toISOString(),
          clientName,
          clientCpfCnpj,
          clientCategory: (() => {
            if (tx.cliente_categoria) return tx.cliente_categoria;
            const isRegisteredDespachante = clientData.some((c: any) => c.cnpj === clientCpfCnpj || c.razao_social === clientName);
            return isRegisteredDespachante ? 'Despachante Credenciado' : 'Particular';
          })(),
          items: mappedItems,
          detranSubtotal: detranSub,
          honorariosSubtotal: honorariosSub,
          otherSubtotal: otherSub,
          netTotal: netTotalVal,
          issqn: calculatedIssqn,
          paymentMethod: tx.forma_pagamento || 'CASH',
          installments: 1,
          status: activeStatus,
          createdBy: {
            userId: 'op-user',
            userName: tx.operador_email || 'Operador',
            userRole: 'Operador',
            rlsScope: ''
          },
          overrideLogs: [],
          operadorEmail: tx.operador_email,
          terminalIp: tx.terminal_ip,
          terminalId: tx.terminal_id,
          valorBruto: brutoVal,
          valorLiquido: netTotalVal,
          hashAuditoria: tx.hash_auditoria,
          turno_id: matchedTurno ? matchedTurno.id : null
        };
      }));

      setClients(clientData.map((c: any) => {
        let debits = parseFloat(c.saldo_devedor || '0').toFixed(2);
        let credits = '0.00';

        txData.forEach((tx: any) => {
          if (tx.status_conciliacao !== 'CANCELLED' && tx.status !== 'CANCELLED') {
            const rawClientName = tx.cliente_nome || 'Particular (Consumidor)';
            const cpfCnpjMatch = rawClientName.match(/\((?:CPF|CNPJ):\s*([^\)]+)\)/i);
            const clientCpfCnpj = cpfCnpjMatch ? cpfCnpjMatch[1].trim() : '000.000.000-00';
            const clientName = rawClientName.replace(/\s*\((?:CPF|CNPJ):[^\)]+\)/i, '').trim();

            const isThisClient = (clientCpfCnpj !== '000.000.000-00' && clientCpfCnpj === c.cnpj) || clientName === c.razao_social;

            if (isThisClient) {
              const txItems = tx.itens || [];
              const hasConvenioItem = txItems.some((item: any) => item.type === 'CONVÊNIO');
              const txVal = parseFloat(tx.valor_liquido || tx.valor_bruto || '0').toFixed(2);

              if (hasConvenioItem) {
                if (tx.forma_pagamento === 'BOLETO') {
                  debits = DecimalMath.add(debits, txVal);
                } else {
                  credits = DecimalMath.add(credits, txVal);
                }
              }
            }
          }
        });

        const netBalance = DecimalMath.sub(debits, credits);
        const finalOutstanding = parseFloat(netBalance) < 0 ? '0.00' : netBalance;

        return {
          id: c.id,
          name: c.razao_social,
          cpfCnpj: c.cnpj,
          phone: c.telefone,
          outstandingBalance: finalOutstanding,
          guiasPendentes: 0,
          category: 'Despachante Credenciado',
          status: 'Ativo'
        };
      }));

      // Log de diagnóstico para auditoria (indicando quantos débitos e créditos ele encontrou no banco)
      let totalDebitos = 0;
      let totalCreditos = 0;
      txData.forEach((tx: any) => {
        if (tx.status_conciliacao !== 'CANCELLED' && tx.status !== 'CANCELLED') {
          const txItems = tx.itens || [];
          const hasConvenioItem = txItems.some((item: any) => item.type === 'CONVÊNIO');
          if (hasConvenioItem) {
            const val = parseFloat(tx.valor_liquido || tx.valor_bruto || '0');
            if (tx.forma_pagamento === 'BOLETO') {
              totalDebitos += val;
            } else {
              totalCreditos += val;
            }
          }
        }
      });
      console.log(`[AUDITORIA CONVÊNIO] Débitos históricos: R$ ${totalDebitos.toFixed(2)} | Créditos históricos: R$ ${totalCreditos.toFixed(2)}`);

      setHistoricalClosings(turnosData.map((item: any) => ({
        id: item.id,
        terminalId: item.terminal_id,
        dataOperacional: item.data_operacional,
        horarioAbertura: item.horario_abertura,
        horarioFechamento: item.horario_fechamento,
        usuarioMaster: item.usuario_master,
        fundoTroco: parseFloat(item.fundo_troco || '0').toFixed(2),
        entradasDinheiro: parseFloat(item.entradas_dinheiro || '0').toFixed(2),
        entradasPix: parseFloat(item.entradas_pix || '0').toFixed(2),
        entradasCredito: parseFloat(item.entradas_credito || '0').toFixed(2),
        entradasDebito: parseFloat(item.entradas_debito || '0').toFixed(2),
        entradasBoleto: parseFloat(item.entradas_boleto || '0').toFixed(2),
        reforcos: parseFloat(item.reforcos || '0').toFixed(2),
        retiradas: parseFloat(item.retiradas || '0').toFixed(2),
        saldoEsperado: parseFloat(item.saldo_esperado || '0').toFixed(2),
        saldoInformado: parseFloat(item.saldo_informado || '0').toFixed(2),
        divergencia: parseFloat(item.divergencia || '0').toFixed(2),
        status: item.status,
        particularQty: item.particular_qty,
        particularTotal: parseFloat(item.particular_total || '0').toFixed(2),
        b2bQty: item.b2b_qty,
        b2bTotal: parseFloat(item.b2b_total || '0').toFixed(2),
        timeline: item.timeline || []
      })));

      // Contar caixas ativos em tempo real
      await fetchActiveBoxesCount();

      setIsDataLoaded(true);
    } catch (err: any) {
      console.error('Erro ao carregar dados do Supabase no App:', err);
      setIsDataLoaded(true);
      // Retém os valores anteriores sem sobrescrevê-los
    }
  };

  useEffect(() => {
    fetchInitialData();
  }, []);

  // Print audit report state
  const [printReport, setPrintReport] = useState<AuditReport | null>(null);
  const [pdvKey, setPdvKey] = useState<number>(0);
  const [isShiftAlreadyReset, setIsShiftAlreadyReset] = useState<boolean>(false);

  // Helper helper to generate deterministic secure hash for closing report
  const getCurrentSecureHash = (report: AuditReport | null) => {
    if (!report) return '';
    const emailStr = (report.usuarioMaster || 'fsobrosa.12tc@gmail.com').toUpperCase();
    const hashString = `PF0018-${emailStr}-${report.dataOperacional}-${report.horarioFechamento}-${report.saldoEsperado}-${report.saldoInformado}`.toUpperCase();
    let hashVal = 0;
    for (let i = 0; i < hashString.length; i++) {
      hashVal = (hashVal << 5) - hashVal + hashString.charCodeAt(i);
      hashVal |= 0;
    }
    const shortHash = Math.abs(hashVal).toString(16).slice(0, 8).toUpperCase();
    return `MARKS-PF0018-${emailStr}-${shortHash}`;
  };

  const generateSha256 = async (text: string): Promise<string> => {
    const msgBuffer = new TextEncoder().encode(text);
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('').toUpperCase();
  };

  // Helper to generate deterministic secure hash for transactions
  const generateTransactionHash = async (tx: any): Promise<string> => {
    const opEmail = tx.operador_email || tx.operadorEmail || 'op';
    const cliNome = tx.cliente_nome || tx.clientName || 'cli';
    const formPag = tx.forma_pagamento || tx.paymentMethod || 'CASH';
    const valBrut = tx.valor_bruto || tx.netTotal || '0.00';
    const ip = tx.terminal_ip || tx.terminalIp || '127.0.0.1';
    const rawString = `${tx.id}-${opEmail}-${cliNome}-${formPag}-${valBrut}-${ip}-${tx.criado_em || tx.timestamp}`.toUpperCase();
    const sha = await generateSha256(rawString);
    return `MARKS-SHA256-${sha.slice(0, 16)}`;
  };

  // Active View Tab: 'PDV' | 'DASHBOARD'
  const [activeTab, setActiveTab] = useState<'PDV' | 'DASHBOARD'>('PDV');

  // Form inline para sangria/suprimento
  const [showSangriaForm, setShowSangriaForm] = useState<boolean>(false);
  const [showSuprimentoForm, setShowSuprimentoForm] = useState<boolean>(false);
  const [cashOpValue, setCashOpValue] = useState<string>('');
  const [cashOpReason, setCashOpReason] = useState<string>('');

  // Authentication & Access Governance State
  const [userSession, setUserSession] = useState<RlsSession | null>(() => {
    const saved = sessionStorage.getItem('userSession') || localStorage.getItem('userSession');
    return saved ? JSON.parse(saved) : null;
  });
  const [isMaster, setIsMaster] = useState<boolean>(() => {
    const saved = sessionStorage.getItem('isMaster') || localStorage.getItem('isMaster');
    return saved ? JSON.parse(saved) : false;
  });

  // Módulo de Abertura de Caixa State (RF001)
  const [caixaState, setCaixaState] = useState<CaixaState>(() => {
    try {
      const saved = sessionStorage.getItem('caixaState') || localStorage.getItem('caixaState');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && typeof parsed === 'object') {
          return {
            status: parsed.status || 'fechado',
            dataAbertura: parsed.dataAbertura || null,
            fundoTroco: parsed.fundoTroco || '0.00',
            operadorName: parsed.operadorName || null,
            sangrias: parsed.sangrias || [],
            suprimentos: parsed.suprimentos || [],
            turno_id: parsed.turno_id || null,
            timeline: parsed.timeline || []
          };
        }
      }
    } catch (e) {
      console.error('Erro ao inicializar caixaState:', e);
    }
    return {
      status: 'fechado',
      dataAbertura: null,
      fundoTroco: '0.00',
      operadorName: null,
      sangrias: [],
      suprimentos: [],
      turno_id: null,
      timeline: []
    };
  });

  // Estado elevado das atas de fechamento para atualizar em realtime
  const [historicalClosings, setHistoricalClosings] = useState<any[]>([]);

  // Estado para contagem dinâmica de caixas com turno aberto
  const [activeBoxesCount, setActiveBoxesCount] = useState<number>(0);

  // Estado isolado para o faturamento gerencial do dia (Master)
  const [faturamentoDiaMaster, setFaturamentoDiaMaster] = useState<string>('0.00');

  const [showFechamentoModal, setShowFechamentoModal] = useState<boolean>(false);
  
  // Disaster recovery and session lock screen states
  const [isScreenLocked, setIsScreenLocked] = useState<boolean>(() => {
    const session = localStorage.getItem('userSession');
    const caixa = localStorage.getItem('caixaState');
    if (session && caixa) {
      try {
        const parsedCaixa = JSON.parse(caixa);
        if (parsedCaixa.status === 'aberto') {
          return true; // Lock immediately on start to prevent unauthenticated access
        }
      } catch (e) {
        // ignore
      }
    }
    return false;
  });
  const [unlockPassword, setUnlockPassword] = useState<string>('');
  const [unlockError, setUnlockError] = useState<string>('');

  // Shared cash register (Caixa Compartilhado) detection popup states
  const [showAlreadyOpenPopup, setShowAlreadyOpenPopup] = useState<boolean>(false);
  const [alreadyOpenDetails, setAlreadyOpenDetails] = useState<{ name: string; email: string; fundoTroco: string } | null>(null);
  
  // States for lunch rotation operator-switching
  const [showAlternarModal, setShowAlternarModal] = useState<boolean>(false);
  const [alternarEmail, setAlternarEmail] = useState<string>('');
  const [alternarPass, setAlternarPass] = useState<string>('');

  const handleSwitchActiveOperator = async (email: string, pass: string): Promise<boolean> => {
    const trimmedEmail = email.trim().toLowerCase();
    let userFound = null;

    if (trimmedEmail === 'fsobrosa.12tc@gmail.com' && pass === 'Antonio2@26') {
      userFound = {
        id: 'usr-master',
        nome: 'Antônio Marques',
        funcao: 'Master',
        email: 'fsobrosa.12tc@gmail.com',
        status: 'Ativo'
      };
    } else {
      try {
        const { data: usuario, error } = await supabase
          .from('usuarios')
          .select('*')
          .eq('email', trimmedEmail)
          .eq('senha_provisoria', pass)
          .eq('status', 'Ativo')
          .maybeSingle();

        if (error) throw error;
        if (!usuario) return false;

        userFound = usuario;
      } catch (err) {
        console.error('Erro ao buscar operador alternativo no Supabase:', err);
        return false;
      }
    }

    if (userFound) {
      const nextSession: RlsSession = {
        userId: userFound.id,
        userName: userFound.nome || userFound.name || 'Operador',
        userRole: userFound.funcao || userFound.role || 'Operador',
        email: userFound.email,
        currentTenantId: 'BR-POA-MAIN-9',
        rlsPolicyApplied: (userFound.funcao || userFound.role) === 'Operador'
          ? 'SELECT * FROM current_orders WHERE created_by_id = authenticated_user_id(); (RESTRICTED TO SELF CREATED)'
          : 'SELECT * FROM transactions WHERE tenant_id = current_tenant(); (FULL COMMITTED ACCESSIBILITY)'
      };

      const leavingName = rlsSession?.userName || 'Operador';
      const leavingEmail = rlsSession?.email || 'ana.caixa@marks.com';
      const nowStr = new Date().toLocaleTimeString('pt-BR');

      const outEvent = {
        timestamp: nowStr,
        operadorName: leavingName,
        operadorEmail: leavingEmail,
        action: 'Saída da Operação / Pausa',
        details: `${nowStr} - ${leavingName} (${leavingEmail}) saiu da operação de caixa para pausa.`
      };

      const inEvent = {
        timestamp: nowStr,
        operadorName: nextSession.userName,
        operadorEmail: nextSession.email || 'ana.caixa@marks.com',
        action: 'Retorno / Assunção de Turno',
        details: `${nowStr} - ${nextSession.userName} (${nextSession.email}) assumiu a operação do caixa.`
      };

      setCaixaState(prev => {
        const currentTimeline = prev.timeline || [];
        const newState = {
          ...prev,
          operadorName: nextSession.userName,
          operadorEmail: nextSession.email,
          timeline: [...currentTimeline, outEvent, inEvent]
        };
        localStorage.setItem('caixaState', JSON.stringify(newState));
        localStorage.setItem('global_caixa_compartilhado', JSON.stringify(newState));
        return newState;
      });

      setUserSession(nextSession);
      setRlsSession(nextSession);
      setIsMaster((userFound.funcao || userFound.role) !== 'Operador');

      // Sobrescrever localStorage para persistência imediata
      localStorage.setItem('userSession', JSON.stringify(nextSession));
      localStorage.setItem('rlsSession', JSON.stringify(nextSession));
      localStorage.setItem('isMaster', JSON.stringify((userFound.funcao || userFound.role) !== 'Operador'));
      localStorage.setItem('integra_user', JSON.stringify(userFound));

      // Refresh dos KPIs com isolamento via recarregamento de transações
      await fetchInitialData();

      addToast('Acesso Concedido', `Balcão assumido por ${userFound.nome || userFound.name}!`, 'success');
      return true;
    }

    addToast('Acesso Negado', 'E-mail ou senha do operador inválidos.', 'alert');
    return false;
  };

  // Simulated active Postgres RLS Session (synced with userSession)
  const [rlsSession, setRlsSession] = useState<RlsSession | null>(() => {
    const saved = sessionStorage.getItem('rlsSession') || localStorage.getItem('rlsSession');
    return saved ? JSON.parse(saved) : null;
  });

  const rlsSessionRef = useRef(rlsSession);
  const userSessionRef = useRef(userSession);
  const caixaStateRef = useRef(caixaState);
  const transactionsRef = useRef(transactions);

  useEffect(() => {
    rlsSessionRef.current = rlsSession;
  }, [rlsSession]);

  useEffect(() => {
    userSessionRef.current = userSession;
  }, [userSession]);

  useEffect(() => {
    caixaStateRef.current = caixaState;
  }, [caixaState]);

  useEffect(() => {
    transactionsRef.current = transactions;
  }, [transactions]);

  // Sync state changes with sessionStorage & localStorage
  useEffect(() => {
    if (userSession) {
      sessionStorage.setItem('userSession', JSON.stringify(userSession));
      localStorage.setItem('userSession', JSON.stringify(userSession));
    } else {
      sessionStorage.removeItem('userSession');
      localStorage.removeItem('userSession');
    }
  }, [userSession]);

  useEffect(() => {
    sessionStorage.setItem('isMaster', JSON.stringify(isMaster));
    localStorage.setItem('isMaster', JSON.stringify(isMaster));
  }, [isMaster]);

  useEffect(() => {
    sessionStorage.setItem('caixaState', JSON.stringify(caixaState));
    localStorage.setItem('caixaState', JSON.stringify(caixaState));
  }, [caixaState]);

  // No automatic printing to avoid pop-up blocking issues in preview frame. PDF generated purely client-side on user click.

  useEffect(() => {
    sessionStorage.setItem('rlsSession', JSON.stringify(rlsSession));
    localStorage.setItem('rlsSession', JSON.stringify(rlsSession));
  }, [rlsSession]);

  useEffect(() => {
    localStorage.setItem('clients', JSON.stringify(clients));
  }, [clients]);

  // Sync rlsSession with authenticated userSession
  useEffect(() => {
    if (userSession) {
      setRlsSession(userSession);
    }
  }, [userSession]);

  // Hook de Polling de Contingência de 15 segundos para perfis gerenciais (Master, Gerente, Financeiro)
  useEffect(() => {
    const role = rlsSession?.userRole || userSession?.userRole || '';
    const isMasterOrAdmin = ['Master', 'Gerente', 'Financeiro'].includes(role);

    if (!isMasterOrAdmin) return;

    console.log('Iniciando Polling híbrido de 15s de contingência para BI Master...');
    const intervalId = setInterval(async () => {
      console.log('Executando Polling híbrido silencioso...');
      try {
        await fetchActiveBoxesCount();
        await fetchActiveTurnoFinanceData();
        await fetchInitialData(true);
      } catch (error) {
        console.error("ERRO BI MASTER:", error);
      }
    }, 15000);

    return () => {
      console.log('Limpando Polling híbrido de 15s.');
      clearInterval(intervalId);
    };
  }, [rlsSession, userSession]);

  // Automated Realtime WebSocket simulator controller
  const [simulatorActive, setSimulatorActive] = useState<boolean>(false);

  // Action notification stack
  const [toasts, setToasts] = useState<Toast[]>([]);

  // Push notification helper
  const addToast = (title: string, message: string, type: 'success' | 'info' | 'alert' = 'success') => {
    const id = `toast-${Date.now()}`;
    setToasts(prev => [...prev, { id, title, message, type }]);
    
    // Auto remove toast after 5 seconds
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 5000);
  };

  // Realtime Faturamento Diário calculation (numeric(10,2) precision) - D+0 ATÔMICO
  const faturamentoDiario = (() => {
    const role = rlsSession?.userRole || userSession?.userRole || '';
    const isMasterOrAdmin = ['Master', 'Gerente', 'Financeiro'].includes(role);

    // Se não for Master/Gerente/Financeiro, exige caixa aberto e sessão ativa
    if (!isMasterOrAdmin) {
      if (!caixaState || caixaState.status === 'fechado' || !userSession?.email || !caixaState.turno_id) return '0.00';
    }

    // Obter IDs dos turnos ativos (com status "Aberto") a partir do historicalClosings
    const activeTurnos = (historicalClosings || [])
      .filter((c: any) => c.status === 'Aberto' || c.status_turno === 'Aberto');

    const activeTurnoIds = activeTurnos.map((c: any) => c.id);

    if (isMasterOrAdmin && activeTurnos.length === 0) {
      return '0.00';
    }

    const safeTxs = transactions || [];

    return safeTxs
      .filter(tx => {
        if (!tx) return false;
        if (tx.status === 'CANCELLED') return false;
        if (isMasterOrAdmin) {
          // Cruzamento robusto em memória contra erros de FK nula
          let isMatched = false;
          if (tx.turno_id && activeTurnoIds.includes(tx.turno_id)) {
            isMatched = true;
          } else {
            isMatched = activeTurnos.some((t: any) => 
              normalizeOperationalDate(t.dataOperacional || t.data_operacional) === normalizeOperationalDate(tx.data_operacional || tx.timestamp) &&
              (t.terminalId === tx.terminalId || t.terminal_id === tx.terminalId || t.terminalId === tx.terminal_id || t.terminal_id === tx.terminal_id) &&
              (t.usuarioMaster === tx.operadorEmail || t.operador_email === tx.operadorEmail || t.usuarioMaster === tx.operador_email || t.operador_email === tx.operador_email)
            );
          }

          if (!isMatched) {
            return false;
          }

          if (!tx.timestamp) return false;
          const txDateObj = new Date(tx.timestamp);
          if (isNaN(txDateObj.getTime())) return false;

          const now = new Date();
          const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
          const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
          return txDateObj >= todayStart && txDateObj <= todayEnd;
        }

        // Se for operador comum
        if (caixaState?.status === 'fechado') return false;

        // Deve pertencer estritamente ao operador ativo no momento
        const isMyTx = userSession?.email === tx.operadorEmail || userSession?.email === tx.operador_email;
        if (!isMyTx) return false;

        // Deve pertencer ao turno ativo atual (ou via cruzamento alternativo)
        const isCurrentTurno = tx.turno_id === caixaState?.turno_id;
        const isMatchedAlternative = normalizeOperationalDate(caixaState?.dataAbertura) === normalizeOperationalDate(tx.data_operacional || tx.timestamp) &&
          (terminalId === tx.terminalId || terminalId === tx.terminal_id);

        if (!isCurrentTurno && !isMatchedAlternative) {
          return false;
        }

        // E o status do turno associado à transação ou ao caixaState deve ser ABERTO
        const txTurnoId = tx.turno_id || caixaState?.turno_id;
        const matchedTurnoObj = historicalClosings?.find(h => h.id === txTurnoId);
        const isTurnoAberto = matchedTurnoObj ? (matchedTurnoObj.status === 'Aberto' || matchedTurnoObj.status_turno === 'Aberto') : (caixaState?.status === 'aberto');
        
        return isTurnoAberto;
      })
      .reduce((sum, tx) => {
        if (!tx) return sum;
        const raw = tx.netTotal?.toString()?.replace(',', '.') || '0';
        const parsed = parseFloat(raw);
        return sum + (isNaN(parsed) ? 0 : parsed);
      }, 0).toFixed(2);
  })();

  // --- REQUISITE ACTIONS ---
  const handleAddTransaction = async (newTx: Transaction) => {
    const calculatedIssqn = newTx.issqn || (parseFloat(newTx.netTotal) * 0.02 / 1.02).toFixed(2);
    const valLiquido = parseFloat(newTx.netTotal).toFixed(2);
    const valBruto = (parseFloat(valLiquido) - parseFloat(calculatedIssqn)).toFixed(2);
    
    let cliNomeCompleto = newTx.clientName;
    if (newTx.clientCpfCnpj && newTx.clientCpfCnpj !== '000.000.000-00') {
      const docLabel = newTx.clientCpfCnpj.length > 14 ? 'CNPJ' : 'CPF';
      cliNomeCompleto = `${newTx.clientName} (${docLabel}: ${newTx.clientCpfCnpj})`;
    }

    // Criamos o objeto de payload completo incluindo terminal_id, data_operacional e horario (reconciliados de forma nativa)
    const mappedTx: any = {
      id: newTx.id,
      operador_email: userSession?.email || 'fsobrosa.12tc@gmail.com',
      terminal_id: terminalId,
      terminal_ip: terminalIp || '127.0.0.1',
      cliente_nome: cliNomeCompleto,
      forma_pagamento: newTx.paymentMethod,
      valor_bruto: parseFloat(valBruto),
      valor_liquido: parseFloat(valLiquido),
      issqn: parseFloat(calculatedIssqn),
      hash_auditoria: '',
      itens: newTx.items,
      status_conciliacao: newTx.status || 'PAID',
      turno_id: newTx.turno_id || caixaState?.turno_id || null,
      data_operacional: (() => {
        try {
          if (caixaState?.dataAbertura) {
            const d = new Date(caixaState.dataAbertura);
            if (!isNaN(d.getTime())) return d.toISOString().split('T')[0];
          }
        } catch (e) {}
        return new Date().toISOString().split('T')[0];
      })(),
      horario: new Date().toLocaleTimeString('pt-BR')
    };

    try {
      const generatedHash = await generateTransactionHash(mappedTx);
      mappedTx.hash_auditoria = generatedHash;
    } catch (hashErr) {
      console.warn("Erro ao gerar hash de auditoria:", hashErr);
    }

    let insertError = null;
    let fallbackUsed = false;
    let schemaCacheNotice = false;

    try {
      // Tentativa 1: Inserção com o payload completo
      const { error } = await supabase
        .from('transacoes')
        .insert([mappedTx]);
      
      if (error) throw error;
    } catch (err: any) {
      console.warn("Primeira tentativa de inserção falhou. Iniciando contingência...", err);
      const errMsg = (err.message || "").toLowerCase();
      const isTerminalIdError = errMsg.includes("terminal_id") || errMsg.includes("cache") || errMsg.includes("esquema") || errMsg.includes("schema") || errMsg.includes("não foi possível encontrar a coluna");

      if (isTerminalIdError || err.code === '42703') {
        fallbackUsed = true;
        schemaCacheNotice = true;
        // Tentativa 2: Remover 'terminal_id'
        const contingencyTx = { ...mappedTx };
        delete contingencyTx.terminal_id;
        
        try {
          const { error: err2 } = await supabase
            .from('transacoes')
            .insert([contingencyTx]);
          
          if (err2) throw err2;
        } catch (err2: any) {
          insertError = err2;
        }
      } else {
        insertError = err;
      }
    }

    if (insertError) {
      const isSchemaError = (insertError.message || "").toLowerCase().includes("cache") || (insertError.message || "").toLowerCase().includes("esquema") || (insertError.message || "").toLowerCase().includes("schema") || insertError.code === '42703';
      if (isSchemaError) {
        addToast(
          'Erro de Esquema',
          'Não foi possível registrar a venda devido a uma divergência de esquema no banco. Certifique-se de adicionar a coluna terminal_id via painel do Supabase.',
          'alert'
        );
      } else {
        addToast('Erro ao Salvar', `Falha ao gravar transação no banco: ${insertError.message || insertError}`, 'alert');
      }
      return;
    }

    // Se o insert funcionou (seja via fluxo normal ou contingência):
    try {
      const enrichedTx: Transaction = {
        ...newTx,
        issqn: calculatedIssqn,
        operadorEmail: mappedTx.operador_email,
        terminalIp: mappedTx.terminal_ip,
        valorBruto: valBruto,
        valorLiquido: valLiquido,
        hashAuditoria: mappedTx.hash_auditoria,
        terminalId: fallbackUsed ? undefined : terminalId,
        turno_id: caixaState?.turno_id || null
      };

      setTransactions(prev => [enrichedTx, ...prev]);

      // === PIPELINE ATÔMICO DE PERSISTÊNCIA MULTI-TABELA (Promise.allSettled) ===
      const nowISO = new Date().toISOString();
      const serviceDesc = (enrichedTx?.items || []).map((i: any) => `${i?.quantity || 1}x ${i?.serviceName || 'Serviço'}`).join(', ') || 'Atendimento PDV';

      const insertPromises = [
        // 1. Livro Razão de Repasses (com segregação do ISSQN 2% Passo Fundo/RS)
        supabase.from('livro_razao_repasses').insert([{
          venda_id: enrichedTx.id,
          valor_bruto: parseFloat(valBruto),
          valor_liquido: parseFloat(valLiquido),
          issqn_retido: parseFloat(calculatedIssqn),
          descricao: serviceDesc,
          turno_id: caixaState?.turno_id || null,
          terminal_id: terminalId,
          data_registro: nowISO
        }]),
        // 2. Conformidade de Caixa (espelho rígido para malha fina)
        supabase.from('conformidade_caixa').insert([{
          venda_id: enrichedTx.id,
          hash_auditoria: mappedTx.hash_auditoria,
          operador_nome: rlsSession?.userName || 'Operador',
          operador_email: rlsSession?.email || '',
          turno_id: caixaState?.turno_id || null,
          terminal_id: terminalId,
          data_registro: nowISO
        }]),
        // 3. Livro de Conferências Auditadas
        supabase.from('livro_conferencias_auditadas').insert([{
          venda_id: enrichedTx.id,
          hash_auditoria: mappedTx.hash_auditoria,
          valor_liquido: parseFloat(valLiquido),
          forma_pagamento: newTx.paymentMethod,
          turno_id: caixaState?.turno_id || null,
          data_registro: nowISO
        }]),
        // 4. Logs Diários Feed (Feed de Atendimentos em Tempo Real D+0)
        supabase.from('logs_diarios_feed').insert([{
          venda_id: enrichedTx.id,
          operador_nome: rlsSession?.userName || 'Operador',
          cliente_nome: newTx.clientName,
          valor_liquido: parseFloat(valLiquido),
          forma_pagamento: newTx.paymentMethod,
          terminal_id: terminalId,
          turno_id: caixaState?.turno_id || null,
          data_registro: nowISO
        }])
      ];

      // Executa todos em paralelo sem bloquear a interface
      try {
        const results = await Promise.allSettled(insertPromises);
        results.forEach((result, idx) => {
          if (result.status === 'rejected' || (result.status === 'fulfilled' && result.value?.error)) {
            const tabelasRef = ['livro_razao_repasses', 'conformidade_caixa', 'livro_conferencias_auditadas', 'logs_diarios_feed'];
            const err = result.status === 'rejected' ? result.reason : result.value?.error;
            console.warn(`Aviso: Falha ao persistir em ${tabelasRef[idx]} (tabela pode não existir).`, err);
          }
        });
      } catch (pipelineErr) {
        console.warn('Aviso: Pipeline de auditoria multi-tabela encontrou um erro geral.', pipelineErr);
      }
      // =======================================================================

      const hasConvenioItem = (newTx.items || []).some((item: any) => item.type === 'CONVÊNIO');

      // Se for faturamento ordinário em boleto ou faturamento de guias em boleto (Débito)
      const isDebit = newTx.paymentMethod === 'BOLETO';

      if (isDebit) {
        const targetClient = clients.find(c => c.cpfCnpj === newTx.clientCpfCnpj);
        if (targetClient) {
          const currentBal = targetClient.outstandingBalance || '0.00';
          const nextBal = DecimalMath.add(currentBal, newTx.netTotal);

          const { error: balanceError } = await supabase
            .from('despachantes')
            .update({ saldo_devedor: nextBal })
            .eq('id', targetClient.id);

          if (balanceError) throw balanceError;

          setClients(prevClients => 
            prevClients.map(c => c.id === targetClient.id ? { ...c, outstandingBalance: nextBal } : c)
          );
        }
      }

      // Se for um recebimento/pagamento de convênio efetuado (Crédito/Amortização de saldo devedor)
      const isCredit = hasConvenioItem && newTx.paymentMethod !== 'BOLETO';

      if (isCredit) {
        const targetClient = clients.find(c => c.cpfCnpj === newTx.clientCpfCnpj);
        if (targetClient) {
          const currentBal = targetClient.outstandingBalance || '0.00';
          const nextBal = DecimalMath.sub(currentBal, newTx.netTotal);
          const safeBal = parseFloat(nextBal) < 0 ? '0.00' : nextBal;

          const { error: balanceError } = await supabase
            .from('despachantes')
            .update({ saldo_devedor: safeBal })
            .eq('id', targetClient.id);

          if (balanceError) throw balanceError;

          setClients(prevClients => 
            prevClients.map(c => c.id === targetClient.id ? { ...c, outstandingBalance: safeBal } : c)
          );
        }
      }

      addToast(
        'Baixa Registrada',
        `Transação ${newTx.sequenceId} pelo valor de ${DecimalMath.formatBRL(newTx.netTotal)} gravada no Banco PostgreSQL.`,
        'success'
      );

      // Re-executar o fetch imediatamente para limpar e atualizar os estados
      await fetchInitialData(true);
    } catch (err: any) {
      addToast('Erro pós-registro', `Transação gravada, mas falhou ao atualizar a interface: ${err.message || err}`, 'alert');
    }
  };

  const generatePasswordExact8 = (): string => {
    const uppers = "ABCDEFGHJKLMNPQRSTUVWXYZ";
    const lowers = "abcdefghijkmnopqrstuvwxyz";
    const digits = "23456789";
    
    const arrUppers = uppers.split('');
    const arrLowers = lowers.split('');
    const arrDigits = digits.split('');
    
    const picked: string[] = [];
    
    const draw = (arr: string[]) => {
      const idx = Math.floor(Math.random() * arr.length);
      const char = arr[idx];
      arr.splice(idx, 1);
      return char;
    };
    
    picked.push(draw(arrUppers));
    picked.push(draw(arrLowers));
    picked.push(draw(arrDigits));
    
    const remainingPool = [...arrUppers, ...arrLowers, ...arrDigits];
    for (let i = 0; i < 5; i++) {
      picked.push(draw(remainingPool));
    }
    
    for (let i = picked.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [picked[i], picked[j]] = [picked[j], picked[i]];
    }
    
    return picked.join('');
  };

  const handleRegisterDespachante = async (name: string, cnpj: string, phone: string): Promise<ClientProfile | null> => {
    try {
      const newClientData = {
        razao_social: name,
        cnpj: cnpj,
        telefone: phone,
        saldo_devedor: 0.00
      };

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
        addToast('Cadastro Realizado', 'Despachante cadastrado com sucesso!', 'success');
        return mappedClient;
      }
      return null;
    } catch (err: any) {
      addToast('Erro ao Cadastrar', 'Não foi possível cadastrar o despachante no momento.', 'alert');
      return null;
    }
  };

  const handleRegisterUser = async (name: string, email: string, role: string) => {
    const passwordTemp = generatePasswordExact8();
    try {
      const newUserData = {
        nome: name,
        email: email,
        senha_provisoria: passwordTemp,
        funcao: role,
        status: 'Ativo'
      };

      const { data, error } = await supabase
        .from('usuarios')
        .insert([newUserData])
        .select()
        .single();

      if (error) throw error;

      if (data) {
        addToast('Cadastro Realizado', 'Usuário cadastrado com sucesso!', 'success');
        return {
          id: data.id,
          name: data.nome,
          email: data.email,
          role: data.funcao,
          status: data.status,
          createdAt: data.criado_em,
          passwordTemp
        };
      }
      return null;
    } catch (err: any) {
      addToast('Erro ao Cadastrar', 'Não foi possível cadastrar o usuário no momento.', 'alert');
      return null;
    }
  };

  const handleUnloadTransaction = async (txId: string) => {
    const target = transactions.find(t => t.id === txId);
    if (target) {
      try {
        const { error } = await supabase
          .from('transacoes')
          .update({ status_conciliacao: 'CANCELLED' })
          .eq('id', txId);

        if (error) throw error;

        setTransactions(prev => 
          prev.map(tx => tx.id === txId ? { ...tx, status: 'CANCELLED' } : tx)
        );

        const hasConvenioItem = (target.items || []).some((item: any) => item.type === 'CONVÊNIO');

        // Se estornou um débito (qualquer transação em BOLETO)
        const isDebit = target.paymentMethod === 'BOLETO';

        if (isDebit && target.status !== 'CANCELLED') {
          const targetClient = clients.find(c => c.cpfCnpj === target.clientCpfCnpj);
          if (targetClient) {
            const currentBal = targetClient.outstandingBalance || '0.00';
            const nextBal = DecimalMath.sub(currentBal, target.netTotal);
            const safeBal = parseFloat(nextBal) < 0 ? '0.00' : nextBal;

            const { error: balanceError } = await supabase
              .from('despachantes')
              .update({ saldo_devedor: safeBal })
              .eq('id', targetClient.id);

            if (balanceError) throw balanceError;

            setClients(prevClients => 
              prevClients.map(c => c.id === targetClient.id ? { ...c, outstandingBalance: safeBal } : c)
            );
          }
        }

        // Se estornou um pagamento/baixa de convênio (Crédito)
        const isCredit = hasConvenioItem && target.paymentMethod !== 'BOLETO';

        if (isCredit && target.status !== 'CANCELLED') {
          const targetClient = clients.find(c => c.cpfCnpj === target.clientCpfCnpj);
          if (targetClient) {
            const currentBal = targetClient.outstandingBalance || '0.00';
            const nextBal = DecimalMath.add(currentBal, target.netTotal);

            const { error: balanceError } = await supabase
              .from('despachantes')
              .update({ saldo_devedor: nextBal })
              .eq('id', targetClient.id);

            if (balanceError) throw balanceError;

            setClients(prevClients => 
              prevClients.map(c => c.id === targetClient.id ? { ...c, outstandingBalance: nextBal } : c)
            );
          }
        }

        addToast(
          'Transação Estornada',
          `Estorno e contingência do cupom ${target.sequenceId} aplicados com sucesso.`,
          'alert'
        );
      } catch (err: any) {
        addToast('Erro no Estorno', `Falha ao estornar transação no banco: ${err.message || err}`, 'alert');
      }
    }
  };

  // --- REALTIME TRANSACTIONS MANAGER ---

  const handleAddSangria = (value: string, reason: string) => {
    const srv: CashTransaction = {
      id: `sang-${Date.now()}`,
      type: 'SANGRIA',
      value: parseFloat(value).toFixed(2),
      reason,
      timestamp: new Date().toISOString(),
      operatorName: rlsSession?.userName || 'Operador',
      operadorLogadoId: rlsSession?.userId || ''
    };
    setCaixaState(prev => ({
      ...prev,
      sangrias: [...prev.sangrias, srv]
    }));
    addToast('Retirada Registrada', `Retirada de ${DecimalMath.formatBRL(value)} realizada: ${reason}.`, 'alert');
  };

  const handleAddSuprimento = (value: string, reason: string) => {
    const sup: CashTransaction = {
      id: `supr-${Date.now()}`,
      type: 'SUPRIMENTO',
      value: parseFloat(value).toFixed(2),
      reason,
      timestamp: new Date().toISOString(),
      operatorName: rlsSession?.userName || 'Operador',
      operadorLogadoId: rlsSession?.userId || ''
    };
    setCaixaState(prev => ({
      ...prev,
      suprimentos: [...prev.suprimentos, sup]
    }));
    addToast('Reforço Registrado', `Reforço de ${DecimalMath.formatBRL(value)} realizado para: ${reason}.`, 'success');
  };

  const handleConfirmCloseCaixa = async (report: any) => {
    // 1. Compile real time data operated during this shift
    const tOpenVal = caixaState?.dataAbertura ? new Date(caixaState.dataAbertura).getTime() : 0;
    const tOpen = isNaN(tOpenVal) ? 0 : tOpenVal;
    const currentOperatorEmail = rlsSession?.email || '';

    // Buscar transações reais do terminal atual para esse turno direto do Supabase por segurança contra perda de estado local
    let finalShiftTxs = [];
    try {
      const { data: dbTxs, error: dbTxsErr } = await supabase
        .from('transacoes')
        .select('*')
        .eq('terminal_id', terminalId)
        .gte('criado_em', caixaState?.dataAbertura || new Date(0).toISOString())
        .order('criado_em', { ascending: false });
      
      if (dbTxsErr) throw dbTxsErr;
      if (dbTxs) {
        finalShiftTxs = dbTxs.map((tx: any) => {
          const calculatedIssqn = tx.issqn ? parseFloat(tx.issqn).toFixed(2) : (parseFloat(tx.valor_bruto || '0') * 0.02).toFixed(2);
          const netTotalVal = parseFloat(tx.valor_liquido || tx.valor_bruto || '0').toFixed(2);
          const brutoVal = parseFloat(tx.valor_bruto || '0').toFixed(2);
          const activeStatus = tx.status_conciliacao || 'PAID';

          const rawClientName = tx.cliente_nome || 'Particular (Consumidor)';
          const cpfCnpjMatch = rawClientName.match(/\((?:CPF|CNPJ):\s*([^\)]+)\)/i);
          const clientCpfCnpj = cpfCnpjMatch ? cpfCnpjMatch[1].trim() : '000.000.000-00';
          const clientName = rawClientName.replace(/\s*\((?:CPF|CNPJ):[^\)]+\)/i, '').trim();

          return {
            id: tx.id,
            sequenceId: `PDV-${tx.id.substring(0, 4).toUpperCase()}`,
            timestamp: tx.criado_em || new Date().toISOString(),
            clientName,
            clientCpfCnpj,
            clientCategory: tx.cliente_categoria || (clientCpfCnpj !== '000.000.000-00' && clientCpfCnpj.length > 14 ? 'Despachante Credenciado' : 'Particular'),
            items: tx.itens || [],
            detranSubtotal: tx.detran_subtotal ? parseFloat(tx.detran_subtotal).toFixed(2) : '0.00',
            honorariosSubtotal: tx.honorarios_subtotal ? parseFloat(tx.honorarios_subtotal).toFixed(2) : '0.00',
            otherSubtotal: tx.other_subtotal ? parseFloat(tx.other_subtotal).toFixed(2) : brutoVal,
            netTotal: netTotalVal,
            issqn: calculatedIssqn,
            paymentMethod: tx.forma_pagamento || 'CASH',
            installments: 1,
            status: activeStatus,
            createdBy: {
              userId: 'op-user',
              userName: tx.operador_email || 'Operador',
              userRole: 'Operador',
              rlsScope: ''
            },
            operadorEmail: tx.operador_email,
            terminalIp: tx.terminal_ip,
            valorBruto: brutoVal,
            valorLiquido: netTotalVal,
            hashAuditoria: tx.hash_auditoria,
            terminalId: tx.terminal_id
          };
        });
      }
    } catch (dbErr) {
      console.error('Erro ao buscar transações do turno no Supabase para fechamento:', dbErr);
    }

    // Isolar as transações do Turno atual deste terminal localmente caso a busca direta falhe
    const localActiveShiftTransactions = transactions.filter(tx => {
      if (!tx || !tx.timestamp) return false;
      const txTime = new Date(tx.timestamp).getTime();
      if (isNaN(txTime)) return false;
      const isTerminalTx = tx.terminalId === terminalId;
      return isTerminalTx && (tOpen === 0 || txTime >= tOpen) && tx.status !== 'CANCELLED';
    });

    const activeShiftTransactions = finalShiftTxs.length > 0 ? finalShiftTxs : localActiveShiftTransactions;

    const cashSumVal = activeShiftTransactions.filter(t => t && ['CASH', 'DINHEIRO'].includes((t.paymentMethod as string || '').trim().toUpperCase())).reduce((sum, tx) => sum + parseFloat(tx.netTotal?.toString().replace(',', '.') || '0'), 0);
    const pixSumVal = activeShiftTransactions.filter(t => t && (t.paymentMethod as string || '').trim().toUpperCase() === 'PIX').reduce((sum, tx) => sum + parseFloat(tx.netTotal?.toString().replace(',', '.') || '0'), 0);
    const creditSumVal = activeShiftTransactions.filter(t => t && ['CREDIT_CARD', 'CREDITO', 'CRÉDITO', 'CARD'].includes((t.paymentMethod as string || '').trim().toUpperCase())).reduce((sum, tx) => sum + parseFloat(tx.netTotal?.toString().replace(',', '.') || '0'), 0);
    const debitSumVal = activeShiftTransactions.filter(t => t && ['DEBIT_CARD', 'DEBITO', 'DÉBITO'].includes((t.paymentMethod as string || '').trim().toUpperCase())).reduce((sum, tx) => sum + parseFloat(tx.netTotal?.toString().replace(',', '.') || '0'), 0);
    const boletoSumVal = activeShiftTransactions.filter(t => t && (t.paymentMethod as string || '').trim().toUpperCase() === 'BOLETO').reduce((sum, tx) => sum + parseFloat(tx.netTotal?.toString().replace(',', '.') || '0'), 0);

    let particularCount = 0;
    let b2bCount = 0;
    const particularSumVal = activeShiftTransactions.reduce((sum, tx) => {
      if (!tx) return sum;
      const isParticular = tx.clientCategory === 'Particular' || tx.clientCategory === 'particular-temp' || !tx.clientCategory || tx.clientCategory === 'Particular (Consumidor)';
      if (isParticular) {
        particularCount++;
        return sum + parseFloat(tx.netTotal?.toString().replace(',', '.') || '0');
      }
      return sum;
    }, 0);
    const b2bSumVal = activeShiftTransactions.reduce((sum, tx) => {
      if (!tx) return sum;
      const isParticular = tx.clientCategory === 'Particular' || tx.clientCategory === 'particular-temp' || !tx.clientCategory || tx.clientCategory === 'Particular (Consumidor)';
      if (!isParticular) {
        b2bCount++;
        return sum + parseFloat(tx.netTotal?.toString().replace(',', '.') || '0');
      }
      return sum;
    }, 0);

    const totalSangriasNum = (caixaState?.sangrias || [])
      .reduce((sum, s) => sum + parseFloat(s?.value?.toString().replace(',', '.') || '0'), 0);

    const totalSuprimentosNum = (caixaState?.suprimentos || [])
      .reduce((sum, s) => sum + parseFloat(s?.value?.toString().replace(',', '.') || '0'), 0);

    const compiled: AuditReport = {
      terminalId: terminalId,
      dataOperacional: new Date().toISOString().split('T')[0],
      horarioAbertura: (() => {
        try {
          if (caixaState?.dataAbertura) {
            const d = new Date(caixaState.dataAbertura);
            if (!isNaN(d.getTime())) return d.toLocaleTimeString('pt-BR');
          }
        } catch (e) {}
        return '08:00:00';
      })(),
      horarioFechamento: new Date().toLocaleTimeString('pt-BR'),
      usuarioMaster: rlsSession?.email || 'fsobrosa.12tc@gmail.com',
      fundoTroco: caixaState?.fundoTroco || '0.00',
      entradasDinheiro: cashSumVal.toFixed(2),
      entradasPix: pixSumVal.toFixed(2),
      entradasCredito: creditSumVal.toFixed(2),
      entradasDebito: debitSumVal.toFixed(2),
      entradasBoleto: boletoSumVal.toFixed(2),
      reforcos: totalSuprimentosNum.toFixed(2),
      retiradas: totalSangriasNum.toFixed(2),
      saldoEsperado: report.saldoEsperado,
      saldoInformado: report.valorInformado,
      divergencia: report.divergencia,
      status: report.status,
      particularQty: particularCount,
      particularTotal: particularSumVal.toFixed(2),
      b2bQty: b2bCount,
      b2bTotal: b2bSumVal.toFixed(2),
      timeline: caixaState?.timeline || []
    };

    try {
      if (!caixaState.turno_id) {
        throw new Error('Identificador de turno (turno_id) não encontrado.');
      }

      const { error } = await supabase
        .from('controle_turnos')
        .update({
          horario_fechamento: compiled.horarioFechamento,
          usuario_master: compiled.usuarioMaster,
          fundo_troco: parseFloat(compiled.fundoTroco),
          entradas_dinheiro: parseFloat(compiled.entradasDinheiro),
          entradas_pix: parseFloat(compiled.entradasPix),
          entradas_credito: parseFloat(compiled.entradasCredito),
          entradas_debito: parseFloat(compiled.entradasDebito),
          entradas_boleto: parseFloat(compiled.entradasBoleto),
          reforcos: parseFloat(compiled.reforcos),
          retiradas: parseFloat(compiled.retiradas),
          saldo_esperado: parseFloat(compiled.saldoEsperado),
          saldo_informado: parseFloat(compiled.saldoInformado),
          divergencia: parseFloat(compiled.divergencia),
          status: compiled.status, // Gravando status final (ex: 'Conciliado', 'Quebra de Caixa', etc.)
          status_turno: 'Fechado',
          particular_qty: compiled.particularQty,
          particular_total: parseFloat(compiled.particularTotal),
          b2b_qty: compiled.b2bQty,
          b2b_total: parseFloat(compiled.b2bTotal),
          timeline: compiled.timeline
        })
        .eq('id', caixaState.turno_id);

      if (error) throw error;
      addToast('Ata Salva', 'Ata de fechamento de turno gravada no banco Supabase.', 'success');
    } catch (err: any) {
      console.error('Erro ao salvar ata de fechamento no Supabase (fazendo fallback para insert):', err);
      // Fallback de contingência caso o registro inicial não exista por falha de rede na abertura
      try {
        const { error: insertError } = await supabase
          .from('controle_turnos')
          .insert([{
            id: caixaState.turno_id || undefined,
            terminal_id: compiled.terminalId,
            data_operacional: compiled.dataOperacional,
            horario_abertura: compiled.horarioAbertura,
            horario_fechamento: compiled.horarioFechamento,
            usuario_master: compiled.usuarioMaster,
            fundo_troco: parseFloat(compiled.fundoTroco),
            entradas_dinheiro: parseFloat(compiled.entradasDinheiro),
            entradas_pix: parseFloat(compiled.entradasPix),
            entradas_credito: parseFloat(compiled.entradasCredito),
            entradas_debito: parseFloat(compiled.entradasDebito),
            entradas_boleto: parseFloat(compiled.entradasBoleto),
            reforcos: parseFloat(compiled.reforcos),
            retiradas: parseFloat(compiled.retiradas),
            saldo_esperado: parseFloat(compiled.saldoEsperado),
            saldo_informado: parseFloat(compiled.saldoInformado),
            divergencia: parseFloat(compiled.divergencia),
            status: compiled.status,
            status_turno: 'Fechado',
            particular_qty: compiled.particularQty,
            particular_total: parseFloat(compiled.particularTotal),
            b2b_qty: compiled.b2bQty,
            b2b_total: parseFloat(compiled.b2bTotal),
            timeline: compiled.timeline
          }]);
        if (insertError) throw insertError;
        addToast('Ata Salva (Fallback)', 'Ata de fechamento de turno gravada no banco Supabase via inserção secundária.', 'success');
      } catch (fallbackErr: any) {
        console.error('Falha no fallback de inserção:', fallbackErr);
        addToast('Erro ao Salvar Ata', `A ata foi concluída mas falhou no banco: ${fallbackErr.message || fallbackErr}`, 'alert');
      }
    }

    // Save compiled closing report to historical closings
    const existingClosingsStr = localStorage.getItem('marks_closing_reports') || '[]';
    const existingClosings = JSON.parse(existingClosingsStr);
    existingClosings.unshift(compiled);
    localStorage.setItem('marks_closing_reports', JSON.stringify(existingClosings));

    setPrintReport(null);
    setIsShiftAlreadyReset(false);

    // Call system reset right now because they have already viewed it inside the modal step 3!
    handleSystemResetOnClosingReport();

    addToast(
      'Turno Encerrado',
      `Caixa fechado com status: ${report.status}. Esperado: ${DecimalMath.formatBRL(report.saldoEsperado)} | Informado: ${DecimalMath.formatBRL(report.valorInformado)}.`,
      report.status === 'Conciliado' ? 'success' : 'alert'
    );

    // === ZERAMENTO SÍNCRONO E IMEDIATO ===
    const closedFinalState: CaixaState = {
      status: 'fechado',
      dataAbertura: null,
      fundoTroco: '0.00',
      operadorName: null,
      sangrias: [],
      suprimentos: [],
      turno_id: null
    };
    setCaixaState(closedFinalState);
    setTransactions([]);
    setActiveBoxesCount(prev => Math.max(0, prev - 1));
    setShowFechamentoModal(false);
    localStorage.removeItem('caixaState');
    localStorage.removeItem('global_caixa_compartilhado');
    localStorage.removeItem('transactions');
    sessionStorage.removeItem('caixaState');
    sessionStorage.removeItem('global_caixa_compartilhado');
    sessionStorage.removeItem('transactions');

    // Focus visor on main PDV screen
    setTimeout(() => {
      const visorInput = document.getElementById('visor') as HTMLInputElement | null;
      if (visorInput) {
        visorInput.focus();
      }
    }, 150);
  };

  const handleSystemResetOnClosingReport = () => {
    if (isShiftAlreadyReset) return;
    setIsShiftAlreadyReset(true);

    // Clear faturamento diário counters
    setTransactions([]);
    setActiveBoxesCount(prev => Math.max(0, prev - 1));
    localStorage.removeItem('transactions');
    sessionStorage.removeItem('transactions');

    // Clear actual physical cash register shift state, maintaining fechado status and resetting fundoTroco to 0.00
    const closedState: CaixaState = {
      status: 'fechado',
      dataAbertura: null,
      fundoTroco: '0.00',
      operadorName: null,
      sangrias: [],
      suprimentos: [],
      turno_id: null
    };
    setCaixaState(closedState);
    localStorage.removeItem('caixaState');
    localStorage.removeItem('global_caixa_compartilhado');
    localStorage.removeItem('pdv_cart');
    localStorage.removeItem('pdv_checkoutStage');
    sessionStorage.removeItem('caixaState');
    sessionStorage.removeItem('global_caixa_compartilhado');
    sessionStorage.removeItem('pdv_cart');
    sessionStorage.removeItem('pdv_checkoutStage');

    // Increment pdvKey to remount / reset PdvSection
    setPdvKey(prev => prev + 1);

    addToast(
      'Sistema Reiniciado',
      'Faturamento diário zerado com sucesso. Fundo de troco e sacola de atendimentos limpos para a próxima abertura operacional de pista!',
      'success'
    );
  };

  const handleExportPDF = () => {
    if (!printReport) return;
    
    // Automatically trigger background reset upon downloading the document
    handleSystemResetOnClosingReport();
    
    // Generate secure hash
    const secureHash = getCurrentSecureHash(printReport);

    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });

    // Margins and Layout Constants
    const leftMargin = 20;
    const rightMargin = 190;
    let currentY = 20;

    // Header border accents
    doc.setDrawColor(16, 185, 129); // #10b981 (Brand Emerald)
    doc.setLineWidth(1.5);
    doc.line(leftMargin, currentY, rightMargin, currentY);
    currentY += 8;

    // Header Logo Box & Title
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(15);
    doc.setTextColor(15, 23, 42); // slate-900
    doc.text('Marks Systems - CRVA 0018 Passo Fundo/RS', 105, currentY, { align: 'center' });
    currentY += 8;

    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(13);
    doc.setTextColor(30, 41, 59); // slate-800
    doc.text('ATA DE ENCERRAMENTO E AUDITORIA DE CAIXA', 105, currentY, { align: 'center' });
    currentY += 8;

    // Horizontal separator line
    doc.setDrawColor(226, 232, 240); // slate-200
    doc.setLineWidth(0.5);
    doc.line(leftMargin, currentY, rightMargin, currentY);
    currentY += 6;

    // Left Column Metadata vs Right Column Metadata
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(71, 85, 105); // slate-600

    doc.text('1. DADOS DE IDENTIFICAÇÃO E RASTREABILIDADE', leftMargin, currentY);
    currentY += 6;

    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(15, 23, 42); // slate-900

    // Draw 2 column data info
    doc.text(`Terminal ID: ${printReport.terminalId}`, leftMargin, currentY);
    doc.text(`Abertura: ${printReport.horarioAbertura}`, 110, currentY);
    currentY += 5;

    doc.text(`Data Operacional: ${printReport.dataOperacional}`, leftMargin, currentY);
    doc.text(`Fechamento: ${printReport.horarioFechamento}`, 110, currentY);
    currentY += 5;

    doc.text(`Gerente/Responsável: ${printReport.usuarioMaster}`, leftMargin, currentY);
    currentY += 5;

    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(8);
    const hashText = `HASH DE AUDITORIA (INTEGRAL DIGITAL): ${secureHash}`;
    const splitHash = doc.splitTextToSize(hashText, rightMargin - leftMargin);
    doc.text(splitHash, leftMargin, currentY);
    doc.setFont('Helvetica', 'normal');
    currentY += (splitHash.length * 4.5) + 6;

    // Accounting Section Title
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(71, 85, 105);
    doc.text('2. AUDITORIA DOS VALORES CONTÁBEIS (ESPECIFICAÇÕES DOS FLUXOS DE CAIXA)', leftMargin, currentY);
    currentY += 6;

    // Table drawing
    doc.setDrawColor(203, 213, 225); // slate-300
    doc.setLineWidth(0.3);
    
    // Table header background
    doc.setFillColor(241, 245, 249); // slate-100
    doc.rect(leftMargin, currentY, rightMargin - leftMargin, 6, 'F');
    
    // Table header texts
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(15, 23, 42);
    doc.text('Descrição da Operação', leftMargin + 3, currentY + 4);
    doc.text('Sentido', 110, currentY + 4, { align: 'center' });
    doc.text('Valor Consolidado', rightMargin - 3, currentY + 4, { align: 'right' });
    currentY += 6;

    // Table Rows helper
    const addTableRow = (desc: string, sign: string, val: string) => {
      doc.setFont('Helvetica', 'normal');
      doc.text(desc, leftMargin + 3, currentY + 4);
      doc.text(sign, 110, currentY + 4, { align: 'center' });
      doc.setFont('Helvetica', 'bold');
      doc.text(val, rightMargin - 3, currentY + 4, { align: 'right' });
      doc.line(leftMargin, currentY + 6, rightMargin, currentY + 6);
      currentY += 6;
    };

    addTableRow('Fundo de Troco de Abertura', '[Fundo Inicial]', DecimalMath.formatBRL(printReport.fundoTroco));
    addTableRow('(+) Entradas em Dinheiro Espécie', '(+)', DecimalMath.formatBRL(printReport.entradasDinheiro));
    addTableRow('(+) Entradas via PIX Instantâneo', '(+)', DecimalMath.formatBRL(printReport.entradasPix));
    addTableRow('(+) Entradas via Cartão de Crédito', '(+)', DecimalMath.formatBRL(printReport.entradasCredito));
    addTableRow('(+) Entradas via Cartão de Débito', '(+)', DecimalMath.formatBRL(printReport.entradasDebito));
    addTableRow('(+) Entradas faturadas via Boleto (B2B)', '(Prazo)', DecimalMath.formatBRL(printReport.entradasBoleto));
    addTableRow('(+) Suprimentos (Aportes/Reforços)', '(+)', DecimalMath.formatBRL(printReport.reforcos));
    addTableRow('(-) Sangrias (Retiradas Extraordinárias)', '(-)', DecimalMath.formatBRL(printReport.retiradas));

    // Totals Vergleich
    currentY += 2;
    doc.setFillColor(248, 250, 252); // slate-50
    doc.rect(leftMargin, currentY, rightMargin - leftMargin, 14, 'F');
    doc.line(leftMargin, currentY, rightMargin, currentY);
    doc.line(leftMargin, currentY + 14, rightMargin, currentY + 14);

    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(30, 41, 59);

    doc.text('SALDO ESPERADO EM LIVRO-CAIXA:', leftMargin + 3, currentY + 5.5);
    doc.text(DecimalMath.formatBRL(printReport.saldoEsperado), rightMargin - 3, currentY + 5.5, { align: 'right' });

    doc.text('DECLARAÇÃO FISCAL DE CONTAGEM FÍSICA:', leftMargin + 3, currentY + 10.5);
    doc.text(DecimalMath.formatBRL(printReport.saldoInformado), rightMargin - 3, currentY + 10.5, { align: 'right' });
    currentY += 19;

    // 3. DEMONSTRATIVO B2B vs CLIENTES DE BALCÃO
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(71, 85, 105);
    doc.text('3. DEMONSTRATIVO DE OPERAÇÕES B2B VS CLIENTES DE BALCÃO', leftMargin, currentY);
    currentY += 6;

    doc.setDrawColor(226, 232, 240);
    doc.rect(leftMargin, currentY, 82, 14);
    doc.rect(108, currentY, 82, 14);

    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(100, 116, 139);
    doc.text('CLIENTES PARTICULARES (BALCÃO)', leftMargin + 3, currentY + 4.5);
    doc.text('DESPACHANTES CREDENCIADOS (B2B)', 108 + 3, currentY + 4.5);

    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(15, 23, 42);
    doc.text(DecimalMath.formatBRL(printReport.particularTotal), leftMargin + 3, currentY + 9.5);
    doc.text(DecimalMath.formatBRL(printReport.b2bTotal), 108 + 3, currentY + 9.5);

    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.text(`${printReport.particularQty} atendimentos liquidados`, leftMargin + 3, currentY + 12.5);
    doc.text(`${printReport.b2bQty} serviços corporativos faturados`, 108 + 3, currentY + 12.5);
    currentY += 20;

    // 4. PARIDADE & DIVERGENCIA APURADA
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(71, 85, 105);
    doc.text('4. AUDITORIA DE PARIDADE & CONCILIAÇÃO FINAL', leftMargin, currentY);
    currentY += 6;

    // Banner styled rect based on status
    if (printReport.status === 'Conciliado') {
      doc.setFillColor(209, 250, 229); // light green bg
      doc.setDrawColor(16, 185, 129); // green border
    } else {
      doc.setFillColor(254, 226, 226); // light red bg
      doc.setDrawColor(239, 68, 68); // red border
    }
    doc.rect(leftMargin, currentY, rightMargin - leftMargin, 16, 'FD');

    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(8);
    if (printReport.status === 'Conciliado') {
      doc.setTextColor(6, 95, 70); // green text
      doc.text('SISTEMA CONCILIADO COM SUCESSO - DIVERGÊNCIA APURADA: R$ 0,00', leftMargin + 5, currentY + 6);
      doc.setFont('Helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.text('Todas as entradas e saídas foram certificadas pela Marks Systems com 100% de paridade.', leftMargin + 5, currentY + 11);
    } else {
      doc.setTextColor(153, 27, 27); // red text
      const sigLabel = printReport.status === 'Quebra de Caixa' ? 'PREJUÍZO / DIVERGÊNCIA APURADA: -' : 'SOBRA DE CAIXA EXCEDENTE: +';
      doc.text(`${sigLabel}${DecimalMath.formatBRL(printReport.divergencia)} (${printReport.status.toUpperCase()})`, leftMargin + 5, currentY + 6);
      doc.setFont('Helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.text('Evento registrado automaticamente no livro de auditoria interna da Marks Systems corporativa.', leftMargin + 5, currentY + 11);
    }
    currentY += 24;

    // 5. SIGNATURES (Operador, Supervisor, Conferente)
    // Ensure the container is exactly placed
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(71, 85, 105);
    doc.text('5. VALIDAÇÃO INTEGRAL E ASSINATURAS REQUISITADAS', leftMargin, currentY);
    currentY += 12;

    // Let's draw 3 signature blocks side by side
    const blockWidth = 50;
    const startX = leftMargin + 2;
    const spacing = 10;

    // Block 1: Operador de Caixa
    doc.setDrawColor(148, 163, 184); // slate-400
    doc.setLineWidth(0.3);
    doc.line(startX, currentY, startX + blockWidth, currentY);
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(15, 23, 42);
    doc.text('OPERADOR DE CAIXA', startX + blockWidth / 2, currentY + 4.5, { align: 'center' });
    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(100, 116, 139);
    doc.text('Abertura, Lançamentos e Caixa', startX + blockWidth / 2, currentY + 8, { align: 'center' });

    // Block 2: Supervisor de Turno
    const midX = startX + blockWidth + spacing;
    doc.line(midX, currentY, midX + blockWidth, currentY);
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(15, 23, 42);
    doc.text('SUPERVISOR / GERENTE', midX + blockWidth / 2, currentY + 4.5, { align: 'center' });
    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(100, 116, 139);
    doc.text('Homologação e Validação do Turno', midX + blockWidth / 2, currentY + 8, { align: 'center' });

    // Block 3: Conferente Financeiro
    const rightX = midX + blockWidth + spacing;
    doc.line(rightX, currentY, rightX + blockWidth, currentY);
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(15, 23, 42);
    doc.text('CONFERENTE FINANCEIRO', rightX + blockWidth / 2, currentY + 4.5, { align: 'center' });
    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(100, 116, 139);
    doc.text('Conciliação Bancária PIX e Cartões', rightX + blockWidth / 2, currentY + 8, { align: 'center' });

    currentY += 18;

    // Print Footer chancel security text
    doc.setFont('Helvetica', 'italic');
    doc.setFontSize(7);
    doc.setTextColor(148, 163, 184); // slate-400
    const legalText = `Certidão gerada digitalmente pelo agente Marks Systems em ${new Date().toLocaleString('pt-BR')}.`;
    doc.text(legalText, 105, currentY, { align: 'center' });
    doc.text('Conforme regulamentações, arquivar esta ata física ou digital por pelo menos 5 anos.', 105, currentY + 4, { align: 'center' });

    // Save/Download PDF named properly
    const filename = `ATA-CONCILIACAO-${printReport.dataOperacional.replace(/\//g, '-')}-${printReport.terminalId}.pdf`;
    doc.save(filename);
  };

  const handleLogout = () => {
    // 1. Limpeza completa das memórias locais e de sessão do navegador
    localStorage.clear();
    sessionStorage.clear();

    // 2. Zeramento imediato de todos os estados do React para valores nulos ou vazios
    setUserSession(null);
    setIsMaster(false);
    setTransactions([]);
    setClients([]);
    setActiveBoxesCount(0);
    setHistoricalClosings([]);
    setToasts([]);
    setPrintReport(null);
    setIsShiftAlreadyReset(false);
    setActiveTab('PDV');
    setShowSangriaForm(false);
    setShowSuprimentoForm(false);
    setCashOpValue('');
    setCashOpReason('');
    setIsScreenLocked(false);
    setUnlockPassword('');
    setUnlockError('');
    setShowAlreadyOpenPopup(false);
    setAlreadyOpenDetails(null);
    setShowAlternarModal(false);
    setAlternarEmail('');
    setAlternarPass('');

    setCaixaState({
      status: 'fechado',
      dataAbertura: null,
      fundoTroco: '0.00',
      operadorName: null,
      sangrias: [],
      suprimentos: [],
      turno_id: null
    });
  };

  // === GUARD CLAUSE DE SEGURANÇA: BARREIRA DE AUTENTICAÇÃO ABSOLUTA (EARLY RETURN) ===
  if (!userSession || !userSession.email) {
    return (
      <div className="min-h-screen bg-brand-navy-deep text-slate-100 flex flex-col justify-center items-center">
        <LoginScreen 
          onLoginSuccess={(session, isMasterUser) => {
            setUserSession(session);
            setIsMaster(isMasterUser);

            const globalCaixaStr = sessionStorage.getItem('global_caixa_compartilhado') || localStorage.getItem('global_caixa_compartilhado');
            let globalCaixa: any = null;
            if (globalCaixaStr) {
              try {
                globalCaixa = JSON.parse(globalCaixaStr);
              } catch (e) { /* parse seguro */ }
            }

            if (globalCaixa && globalCaixa.status === 'aberto') {
              setCaixaState(globalCaixa);
              if (isMasterUser) {
                setAlreadyOpenDetails({
                  name: globalCaixa.operadorName || 'Operador',
                  email: globalCaixa.operadorEmail || 'ana.caixa@marks.com',
                  fundoTroco: globalCaixa.fundoTroco || '150.00'
                });
                setShowAlreadyOpenPopup(true);
              } else {
                setIsScreenLocked(true);
              }
            } else {
              setCaixaState({
                status: 'fechado',
                dataAbertura: null,
                fundoTroco: '0.00',
                operadorName: session.userName,
                sangrias: [],
                suprimentos: [],
                turno_id: null
              });
            }

            if (!isMasterUser) {
              setActiveTab('PDV');
            } else {
              setActiveTab('DASHBOARD');
            }

            // Recarregar dados do Supabase
            fetchInitialData();
          }}
        />

        {/* Real-time floating Toast Stack (bottom right corner) */}
        <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-2.5 max-w-sm w-full font-mono">
          {(toasts || []).map(t => {
            const isSuccess = t.type === 'success';
            const isAlert = t.type === 'alert';

            return (
              <div 
                key={t.id} 
                className="bg-brand-navy-card/95 border border-brand-navy-bright rounded-xl p-4 shadow-2xl backdrop-blur-md flex items-start gap-3 text-xs animate-slide-in relative overflow-hidden"
              >
                {/* Colored left bar */}
                <div className={`absolute top-0 bottom-0 left-0 w-1 ${
                  isSuccess ? 'bg-brand-emerald' : isAlert ? 'bg-brand-crimson' : 'bg-brand-accent'
                }`} />

                <div className="p-1 rounded bg-slate-800 text-slate-300">
                  {isSuccess && <CheckCircle className="w-4 h-4 text-brand-emerald" />}
                  {isAlert && <AlertCircle className="w-4 h-4 text-brand-crimson" />}
                  {!isSuccess && !isAlert && <Sparkles className="w-4 h-4 text-brand-accent" />}
                </div>

                <div className="flex-1 pl-1">
                  <p className="font-bold text-slate-100">{t.title}</p>
                  <p className="text-slate-400 mt-1 leading-relaxed text-[11px]">{t.message}</p>
                </div>

                <button
                  onClick={() => setToasts(prev => (prev || []).filter(item => item.id !== t.id))}
                  className="text-slate-500 hover:text-slate-300 font-bold"
                >
                  ×
                </button>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // === BARREIRA DE CARREGAMENTO DE DADOS DO OPERADOR / MASTER ===
  if (!isDataLoaded || !rlsSession) {
    return (
      <div className="min-h-screen bg-[#0B0F19] flex items-center justify-center text-white font-mono">
        Carregando Caixa...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-brand-navy-deep text-slate-100 flex flex-col selection:bg-brand-emerald selection:text-brand-navy-deep">
      
      {/* 1. Header component */}
      <Header 
        currentSession={rlsSession as RlsSession} 
        onChangeSession={(session) => setRlsSession(session)} 
        onLogout={handleLogout}
        caixaState={caixaState}
        isMaster={isMaster}
        faturamentoDiario={isMaster ? faturamentoDiaMaster : faturamentoDiario}
        activeBoxesCount={activeBoxesCount}
      />

      {/* Closed Cash Register modal overlay */}
      {caixaState?.status === 'fechado' && !['Master', 'Gerente', 'Financeiro'].includes(rlsSession?.userRole || userSession?.userRole || '') && (
        <AberturaCaixaModal 
          currentSession={rlsSession}
          onLogout={handleLogout}
          onOpenCaixaSuccess={async (fundo, t) => {
            const newTurnoId = generateUUID();
            const newCaixaState: CaixaState = {
              status: 'aberto',
              dataAbertura: t,
              fundoTroco: fundo,
              operadorName: rlsSession?.userName || 'Operador',
              operadorEmail: rlsSession?.email || 'ana.caixa@marks.com',
              sangrias: [],
              suprimentos: [],
              turno_id: newTurnoId, // Gerando turno_id único (UUID)
              timeline: [
                {
                  timestamp: new Date(t).toLocaleTimeString('pt-BR'),
                  operadorName: rlsSession?.userName || 'Operador',
                  operadorEmail: rlsSession?.email || 'ana.caixa@marks.com',
                  action: 'Abertura de Caixa',
                  details: `Início de Turno operacional com Fundo de Troco de ${DecimalMath.formatBRL(fundo)}.`
                }
              ]
            };

            // Inserção imediata do turno no Supabase para permitir monitoramento
            try {
              const { error: insertTurnoError } = await supabase
                .from('controle_turnos')
                .insert([{
                  id: newTurnoId,
                  terminal_id: terminalId,
                  data_operacional: new Date().toISOString().split('T')[0],
                  horario_abertura: new Date(t).toLocaleTimeString('pt-BR'),
                  usuario_master: rlsSession?.email || 'fsobrosa.12tc@gmail.com',
                  fundo_troco: parseFloat(fundo),
                  status: 'Aberto',
                  status_turno: 'Aberto',
                  timeline: newCaixaState.timeline,
                  entradas_dinheiro: 0,
                  entradas_pix: 0,
                  entradas_credito: 0,
                  entradas_debito: 0,
                  entradas_boleto: 0,
                  reforcos: 0,
                  retiradas: 0,
                  saldo_esperado: parseFloat(fundo),
                  saldo_informado: 0,
                  divergencia: 0,
                  particular_qty: 0,
                  particular_total: 0,
                  b2b_qty: 0,
                  b2b_total: 0
                }]);

              if (insertTurnoError) throw insertTurnoError;
            } catch (err: any) {
              console.error('Erro ao registrar abertura de turno no Supabase:', err);
              addToast('Erro ao Registrar Turno', `Não foi possível abrir o turno no banco: ${err.message || err}`, 'alert');
            }

            setCaixaState(newCaixaState);
            localStorage.setItem('caixaState', JSON.stringify(newCaixaState));
            localStorage.setItem('global_caixa_compartilhado', JSON.stringify(newCaixaState));
            addToast('Caixa Aberto', `Terminal operacional inicializado com fundo de troco de ${DecimalMath.formatBRL(fundo)}.`, 'success');
          }}
        />
      )}

      {/* 2. Secondary cockpit utility controls */}
      <div className={`bg-brand-navy-card/40 border-b border-brand-navy-bright py-2.5 px-4 transition-all duration-300 ${caixaState?.status === 'fechado' && !['Master', 'Gerente', 'Financeiro'].includes(rlsSession?.userRole || userSession?.userRole || '') ? 'blur-sm pointer-events-none opacity-40' : ''}`}>
        <div className="max-w-7xl mx-auto flex flex-col gap-3">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
            {/* Sub-navigation views switcher */}
            <div className="flex items-center gap-1.5 p-1 bg-brand-navy-deep border border-brand-navy-bright rounded-lg self-start">
              <button
                id="pdv-checkout-tab-btn"
                onClick={() => setActiveTab('PDV')}
                className={`px-4 py-1.5 rounded text-xs font-semibold tracking-wide flex items-center gap-2 transition-all cursor-pointer ${
                  activeTab === 'PDV' 
                    ? 'bg-brand-emerald text-brand-navy-deep font-bold shadow' 
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <ShoppingBag className="w-4 h-4" />
                Terminal PDV (Atendimento)
              </button>

              {isMaster && (
                <button
                  id="fluxo-financeiro-tab-btn"
                  onClick={() => {
                    setActiveTab('DASHBOARD');
                  }}
                  className={`px-4 py-1.5 rounded text-xs font-semibold tracking-wide flex items-center gap-2 transition-all cursor-pointer ${
                    activeTab === 'DASHBOARD' 
                      ? 'bg-brand-emerald text-brand-navy-deep font-bold shadow' 
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                  title="Visualizar Fluxo de Caixa"
                >
                  <Activity className="w-4 h-4" />
                  Painel BI Master Realtime
                </button>
              )}
            </div>
            {/* Turno operational Actions (Sangria, Suprimento e Fechamento) */}
            {caixaState?.status === 'aberto' && (
              <div className="flex flex-wrap items-center gap-2 md:self-center">
                 {/* Aporte (Suprimento) */}
                <button
                  onClick={() => {
                    setShowSuprimentoForm(!showSuprimentoForm);
                    setShowSangriaForm(false);
                    setCashOpValue('');
                    setCashOpReason('');
                  }}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-lg border font-mono transition-all flex items-center gap-1.5 cursor-pointer ${
                    showSuprimentoForm
                      ? 'bg-brand-emerald/20 border-brand-emerald text-brand-emerald'
                      : 'bg-brand-navy-deep border-brand-navy-bright/10 text-slate-300 hover:text-slate-100'
                  }`}
                >
                  <Coins className="w-4 h-4 text-brand-emerald" />
                  + Reforço
                </button>

                {/* Retirada (Sangria) */}
                <button
                  onClick={() => {
                    setShowSangriaForm(!showSangriaForm);
                    setShowSuprimentoForm(false);
                    setCashOpValue('');
                    setCashOpReason('');
                  }}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-lg border font-mono transition-all flex items-center gap-1.5 cursor-pointer ${
                    showSangriaForm
                      ? 'bg-red-500/20 border-red-500/80 text-red-400'
                      : 'bg-brand-navy-deep border-brand-navy-bright/10 text-slate-300 hover:text-slate-100'
                  }`}
                >
                  <DollarSign className="w-4 h-4 text-red-400" />
                  - Retirada
                </button>

                {/* Encerrar Turno (Fechamento) */}
                <button
                  onClick={() => setShowFechamentoModal(true)}
                  className="px-4 py-1.5 bg-red-600 hover:bg-red-500 border border-red-500/10 rounded-lg text-xs font-bold tracking-wide flex items-center gap-2 cursor-pointer transition-all shadow-md shadow-red-950/40"
                >
                  <Lock className="w-4 h-4 animate-pulse text-white" />
                  Encerrar Turno (Fechamento Cego)
                </button>

              </div>
            )}

          </div>

          {/* Inline Operation Drawer for Sangria / Suprimento */}
          {(showSangriaForm || showSuprimentoForm) && (
            <div className="bg-brand-navy-deep/85 border border-brand-navy-bright/10 p-5 rounded-lg mt-1.5 space-y-3 animate-slide-in max-w-xl">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold tracking-wider text-slate-200">
                  {showSangriaForm ? '🚨 Lançamento extraordinário de retirada' : '💰 Cadastro de reforço de moedas'}
                </span>
                <span className="text-[10px] font-mono text-slate-400">
                  Operador: {rlsSession?.userName || 'Operador'}
                </span>
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">R$</span>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="0,00"
                    value={cashOpValue}
                    onChange={(e) => setCashOpValue(e.target.value)}
                    className="w-full bg-brand-navy-card border border-brand-navy-bright rounded-lg py-2 pl-8 pr-3 text-xs font-bold font-mono text-slate-100 focus:outline-none focus:border-brand-emerald"
                  />
                </div>
                
                <input
                  type="text"
                  placeholder={showSangriaForm ? "Ex: Recolhimento de valores" : "Ex: Troco inicial extra"}
                  value={cashOpReason}
                  onChange={(e) => setCashOpReason(e.target.value)}
                  className="w-full sm:col-span-2 bg-brand-navy-card border border-brand-navy-bright rounded-lg py-2 px-3 text-xs text-slate-200 focus:outline-none focus:border-brand-emerald"
                />
              </div>

              <div className="flex justify-end gap-2">
                <button
                  onClick={() => {
                    setShowSangriaForm(false);
                    setShowSuprimentoForm(false);
                  }}
                  className="px-3 py-1.5 text-[11px] text-slate-400 hover:text-slate-200 font-mono"
                >
                  Cancelar
                </button>
                <button
                  onClick={() => {
                    if (!cashOpValue || isNaN(parseFloat(cashOpValue)) || parseFloat(cashOpValue) <= 0) {
                      alert("Por favor, forneça um valor válido.");
                      return;
                    }
                    if (!cashOpReason.trim()) {
                      alert("Por favor, preencha a justificativa.");
                      return;
                    }
                    
                    if (showSangriaForm) {
                      handleAddSangria(cashOpValue, cashOpReason);
                      setShowSangriaForm(false);
                    } else {
                      handleAddSuprimento(cashOpValue, cashOpReason);
                      setShowSuprimentoForm(false);
                    }
                    setCashOpValue('');
                    setCashOpReason('');
                  }}
                  className="bg-brand-emerald text-brand-navy-deep text-xs font-bold px-4 py-1.5 rounded-lg font-sans shadow"
                >
                  Confirmar Operação
                </button>
              </div>
            </div>
          )}

        </div>
      </div>

      {/* 3. Primary Workspace Screen viewports */}
      <main className={`flex-1 max-w-7xl w-full mx-auto p-4 md:p-6 pb-20 transition-all duration-300 ${caixaState?.status === 'fechado' && !['Master', 'Gerente', 'Financeiro'].includes(rlsSession?.userRole || userSession?.userRole || '') ? 'blur-sm pointer-events-none opacity-40' : ''}`}>
        
        {activeTab === 'PDV' ? (
          <div className="space-y-4">
            <PdvSection 
              key={pdvKey}
              onAddTransaction={handleAddTransaction} 
              rlsSession={rlsSession as RlsSession} 
              clients={clients}
              setClients={setClients}
              isMaster={isMaster}
              onAlternarOperador={() => setShowAlternarModal(true)}
              caixaState={caixaState}
              addToast={addToast}
            />
          </div>
        ) : (
          isMaster ? (
            <FluxoCaixaSection 
              transactions={transactions} 
              onUnloadTransaction={handleUnloadTransaction}
              rlsSession={rlsSession as RlsSession}
              clients={clients}
              caixaState={caixaState}
              setClients={setClients}
              isMaster={isMaster}
              onRegisterDespachante={handleRegisterDespachante}
              onRegisterUser={handleRegisterUser}
              historicalClosings={historicalClosings}
              setHistoricalClosings={setHistoricalClosings}
              faturamentoDiaMaster={faturamentoDiaMaster}
            />
          ) : null
        )}

      </main>

      {showFechamentoModal && (
        <FechamentoCaixaModal
          caixaState={caixaState}
          transactions={transactions}
          onClose={() => setShowFechamentoModal(false)}
          onConfirmCloseCaixa={handleConfirmCloseCaixa}
          currentSession={rlsSession as RlsSession}
          onLogout={handleLogout}
          addToast={addToast}
        />
      )}

      {/* MODAL COMPACTO DE ALTERNAR OPERADOR (ROTATIVO DE ALMOÇO) */}
      {showAlternarModal && (
        <div className="fixed inset-0 z-[100] bg-brand-navy-deep/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-brand-navy-card border border-brand-navy-bright/30 p-6 rounded-2xl max-w-sm w-full space-y-5 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-brand-navy-bright/10">
              <div className="flex items-center gap-2">
                <Shield className="w-5 h-5 text-brand-emerald" />
                <h2 className="text-sm font-bold text-white">Alternar Operador</h2>
              </div>
              <button 
                onClick={() => {
                  setShowAlternarModal(false);
                  setAlternarEmail('');
                  setAlternarPass('');
                }}
                className="text-slate-400 hover:text-slate-200 text-xs font-semibold cursor-pointer"
              >
                [X] Fechar
              </button>
            </div>
            
            <p className="text-xs text-slate-400 leading-relaxed">
              Troca rápida de turno de caixa (ex: horário de almoço). O caixa corrente permanecerá aberto sem zerar o subtotal acumulado.
            </p>

            <form 
              onSubmit={async (e) => {
                e.preventDefault();
                const isLogged = await handleSwitchActiveOperator(alternarEmail, alternarPass);
                if (isLogged) {
                  setShowAlternarModal(false);
                  setAlternarEmail('');
                  setAlternarPass('');
                }
              }}
              className="space-y-4 text-left"
            >
              <div>
                <label className="block text-[11px] font-semibold text-slate-300 mb-1">E-mail do Operador</label>
                <input 
                  type="email" 
                  required
                  value={alternarEmail}
                  onChange={e => setAlternarEmail(e.target.value)}
                  className="w-full bg-brand-navy-deep border border-brand-navy-bright/10 rounded-lg p-2.5 text-xs focus:outline-none focus:border-brand-emerald/40 text-slate-200"
                  placeholder="Ex: ana.caixa@marks.com"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-300 mb-1">Senha</label>
                <input 
                  type="password" 
                  required
                  value={alternarPass}
                  onChange={e => setAlternarPass(e.target.value)}
                  className="w-full bg-brand-navy-deep border border-brand-navy-bright/10 rounded-lg p-2.5 text-xs focus:outline-none focus:border-brand-emerald/40 text-slate-200"
                  placeholder="••••••••"
                />
              </div>
              <button type="submit" className="w-full py-2.5 bg-brand-emerald hover:bg-emerald-400 text-brand-navy-deep text-xs font-bold rounded-lg transition cursor-pointer">
                Confirmar e Assumir Balcão
              </button>
            </form>
          </div>
        </div>
      )}

      {/* DISASTER RECOVERY & SENSE OF SECURITY LOCK-SCREEN: Sessions Interrupted/Abrupt Tab Closures */}
      {isScreenLocked && userSession && (
        <div className="fixed inset-0 z-[200] bg-brand-navy-deep/95 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-brand-navy-card border border-brand-navy-bright p-8 rounded-2xl max-w-md w-full space-y-6 shadow-2xl relative text-center">
            
            {/* Pulsating Shield Key Icon */}
            <div className="mx-auto w-16 h-16 bg-brand-emerald/15 rounded-full flex items-center justify-center border border-brand-emerald/35 animate-pulse mb-2">
              <Lock className="w-8 h-8 text-brand-emerald" />
            </div>

            <div className="space-y-2">
              <h1 className="text-lg font-mono font-black text-white tracking-wide uppercase">
                Sessão Interrompida Detectada
              </h1>
              <p className="text-xs font-mono text-brand-emerald font-bold uppercase tracking-wider">
                Caixa em Andamento
              </p>
              <p className="text-xs text-slate-400 leading-relaxed max-w-sm mx-auto">
                O navegador detectou o encerramento abrupto ou falta de energia com turno ativo.
                Insira a senha do operador responsável para reativar o faturamento exatamente de onde parou.
              </p>
            </div>

            {/* Operator info card */}
            <div className="bg-brand-navy-deep border border-brand-navy-bright/35 p-4 rounded-xl text-left space-y-2.5">
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-500 font-mono">Unidade Fiscal:</span>
                <span className="text-slate-200 font-bold font-mono text-[11px]">CRVA 0018 Passo Fundo/RS</span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-500 font-mono">Terminal ID:</span>
                <span className="text-slate-200 font-bold font-mono">{terminalId}</span>
              </div>
              <div className="border-t border-brand-navy-bright/10 my-1 pt-1.5" />
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-500 font-mono">Operador:</span>
                <span className="text-brand-emerald font-black font-mono">{userSession.userName}</span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-500 font-mono">E-mail de Acesso:</span>
                <span className="text-slate-300 font-mono text-[11px] select-all">{userSession.email || 'ana.caixa@marks.com'}</span>
              </div>
              {caixaState?.fundoTroco && (
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-500 font-mono">Fundo de Troco:</span>
                  <span className="text-slate-200 font-bold font-mono">{DecimalMath.formatBRL(caixaState?.fundoTroco)}</span>
                </div>
              )}
            </div>

            <form 
              onSubmit={async (e) => {
                e.preventDefault();
                setUnlockError('');
                
                const trimmedEmail = (userSession?.email || '').trim().toLowerCase();
                let isAuthorized = false;
                let userFound = null;

                try {
                  // Verifies Master credentials
                  if (trimmedEmail === 'fsobrosa.12tc@gmail.com' && unlockPassword === 'Antonio2@26') {
                    isAuthorized = true;
                    userFound = {
                      id: 'usr-master',
                      nome: 'Antônio Marques',
                      funcao: 'Master',
                      email: 'fsobrosa.12tc@gmail.com',
                      status: 'Ativo'
                    };
                  } else {
                    // Consulta real no Supabase
                    const { data: usuario, error } = await supabase
                      .from('usuarios')
                      .select('*')
                      .eq('email', trimmedEmail)
                      .eq('senha_provisoria', unlockPassword)
                      .eq('status', 'Ativo')
                      .maybeSingle();

                    if (error) throw error;
                    if (!usuario) {
                      setUnlockError('Senha de segurança inválida ou expirada.');
                      return;
                    }
                    userFound = usuario;
                    isAuthorized = true;
                  }

                  if (isAuthorized && userFound) {
                    const nextSession: RlsSession = {
                      userId: userFound.id,
                      userName: userFound.nome || userFound.name || 'Operador',
                      userRole: userFound.funcao || userFound.role || 'Operador',
                      email: userFound.email,
                      currentTenantId: 'BR-POA-MAIN-9',
                      rlsPolicyApplied: (userFound.funcao || userFound.role) === 'Operador'
                        ? 'SELECT * FROM current_orders WHERE created_by_id = authenticated_user_id(); (RESTRICTED TO SELF CREATED)'
                        : 'SELECT * FROM transactions WHERE tenant_id = current_tenant(); (FULL COMMITTED ACCESSIBILITY)'
                    };
                    
                    setUserSession(nextSession);
                    setRlsSession(nextSession);
                    setIsMaster((userFound.funcao || userFound.role) !== 'Operador');

                    // Sobrescrever localStorage para persistência imediata
                    localStorage.setItem('userSession', JSON.stringify(nextSession));
                    localStorage.setItem('rlsSession', JSON.stringify(nextSession));
                    localStorage.setItem('isMaster', JSON.stringify((userFound.funcao || userFound.role) !== 'Operador'));
                    localStorage.setItem('integra_user', JSON.stringify(userFound));

                    setIsScreenLocked(false);
                    setUnlockPassword('');
                    addToast('Acesso Restabelecido', 'Seus controles comerciais e sacola foram totalmente restaurados.', 'success');
                  } else {
                    setUnlockError('Senha de segurança inválida ou expirada.');
                  }
                } catch (err: any) {
                  console.error('Erro ao destravar sessão:', err);
                  setUnlockError('Erro de comunicação. Tente novamente.');
                }
              }}
              className="space-y-4 text-left"
            >
              <div>
                <label className="block text-[10px] font-semibold text-slate-400 font-mono uppercase tracking-wider mb-1">
                  Senha de Acesso do Operador
                </label>
                <input 
                  type="password" 
                  required
                  autoFocus
                  value={unlockPassword}
                  onChange={(e) => setUnlockPassword(e.target.value)}
                  className="w-full bg-brand-navy-deep border border-brand-navy-bright rounded-lg p-3 text-sm focus:outline-none focus:border-brand-emerald focus:ring-1 focus:ring-brand-emerald text-white font-mono placeholder:text-slate-600"
                  placeholder="Digite sua senha física..."
                />
                {unlockError && (
                  <p className="text-brand-crimson text-xs font-mono font-semibold mt-1.5 flex items-center gap-1">
                    <span className="inline-block w-1.5 h-1.5 rounded-full bg-brand-crimson animate-ping" />
                    {unlockError}
                  </p>
                )}
              </div>

              <div className="flex gap-3">
                <button 
                  type="button"
                  onClick={() => {
                    handleLogout();
                    setIsScreenLocked(false);
                    setUnlockPassword('');
                    setUnlockError('');
                  }}
                  className="flex-1 py-3 text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold rounded-lg transition-all cursor-pointer"
                >
                  Sair do Caixa
                </button>
                <button 
                  type="submit" 
                  className="flex-[2] py-3 text-xs bg-brand-emerald hover:bg-emerald-400 text-brand-navy-deep font-bold rounded-lg transition-all shadow-lg hover:shadow-brand-emerald/15 cursor-pointer"
                >
                  Destravar Operação [ENTER]
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* POP-UP DE INFORMAÇÃO: Caixa Operacional Já Ativo (Prevents duplicate opening by Managers/Financeiros) */}
      {showAlreadyOpenPopup && alreadyOpenDetails && (
        <div className="fixed inset-0 z-[110] bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-brand-navy-card border border-brand-navy-bright p-8 rounded-2xl max-w-md w-full space-y-6 shadow-2xl relative text-center">
            
            <div className="mx-auto w-14 h-14 bg-brand-accent/15 rounded-full flex items-center justify-center border border-brand-accent/30 text-brand-accent animate-pulse">
              <Building2 className="w-7 h-7" />
            </div>

            <div className="space-y-1.5">
              <h2 className="text-base font-black font-mono text-white uppercase tracking-wide">
                Caixa Operacional Já Ativo
              </h2>
              <p className="text-xs text-slate-400">
                Uma abertura de pista já foi consolidada para os terminais físicos hoje.
                A abertura repetida de "Fundo de Troco" foi bloqueada eletronicamente.
              </p>
            </div>

            {/* Open cashier metadata */}
            <div className="bg-brand-navy-deep border border-brand-navy-bright/45 p-4 rounded-xl text-left space-y-2.5 text-xs">
              <div className="flex justify-between items-center">
                <span className="text-slate-500 font-mono">Operador Ativo:</span>
                <span className="text-white font-extrabold font-mono">{alreadyOpenDetails.name}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500 font-mono">E-mail Operador:</span>
                <span className="text-brand-emerald font-mono">{alreadyOpenDetails.email}</span>
              </div>
              <div className="border-t border-brand-navy-bright/10 my-1 pt-1.5" />
              <div className="flex justify-between items-center">
                <span className="text-slate-500 font-mono">Unidade Fiscal:</span>
                <span className="text-slate-300 font-mono">CRVA 0018 Passo Fundo/RS</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500 font-mono">Fundo de Troco Inicial:</span>
                <span className="text-slate-100 font-bold font-mono text-sm">
                  {DecimalMath.formatBRL(alreadyOpenDetails.fundoTroco)}
                </span>
              </div>
            </div>

            <div className="text-slate-400 text-[11px] leading-relaxed bg-brand-navy-deep/20 p-3 rounded-lg border border-brand-navy-bright/10 text-left">
              💡 <strong>Regra de Supervisão Ativada:</strong> Como Supervisor (Gerente/Financeiro),
              o sistema liberará acesso imediato para validar relatórios, analisar auditadores, faturamento e sacolas.
            </div>

            <button
              onClick={() => setShowAlreadyOpenPopup(false)}
              className="w-full py-3 bg-brand-emerald hover:bg-emerald-400 text-brand-navy-deep text-xs font-bold rounded-lg transition-all shadow-md cursor-pointer"
            >
              Entrar no Painel de Supervisão
            </button>
          </div>
        </div>
      )}

      {/* 4. Real-time floating Toast Stack (bottom right corner) */}
      <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-2.5 max-w-sm w-full font-mono">
        {(toasts || []).map(t => {
          const isSuccess = t.type === 'success';
          const isAlert = t.type === 'alert';

          return (
            <div 
              key={t.id} 
              className="bg-brand-navy-card/95 border border-brand-navy-bright rounded-xl p-4 shadow-2xl backdrop-blur-md flex items-start gap-3 text-xs animate-slide-in relative overflow-hidden"
            >
              {/* Colored left bar */}
              <div className={`absolute top-0 bottom-0 left-0 w-1 ${
                isSuccess ? 'bg-brand-emerald' : isAlert ? 'bg-brand-crimson' : 'bg-brand-accent'
              }`} />

              <div className="p-1 rounded bg-slate-800 text-slate-300">
                {isSuccess && <CheckCircle className="w-4 h-4 text-brand-emerald" />}
                {isAlert && <AlertCircle className="w-4 h-4 text-brand-crimson" />}
                {!isSuccess && !isAlert && <Sparkles className="w-4 h-4 text-brand-accent" />}
              </div>

              <div className="flex-1 pl-1">
                <p className="font-bold text-slate-100">{t.title}</p>
                <p className="text-slate-400 mt-1 leading-relaxed text-[11px]">{t.message}</p>
              </div>

              <button
                onClick={() => setToasts(prev => prev.filter(item => item.id !== t.id))}
                className="text-slate-500 hover:text-slate-300 font-bold"
              >
                ×
              </button>
            </div>
          );
        })}
      </div>

      {/* 4. ATA DE ENCERRAMENTO E AUDITORIA DE CAIXA (SISTEMA DE IMPRESSÃO WEB) */}
      {printReport && (
        <div className="print-report-container fixed inset-0 z-[150] bg-black/60 backdrop-blur-[8px] overflow-y-auto flex items-start justify-center p-4 md:p-8 print:absolute print:bg-white print:text-black print:p-0 print:m-0 print:overflow-hidden">
          
          <div className="bg-brand-navy-card border border-brand-navy-bright w-full max-w-4xl rounded-2xl shadow-2xl p-6 md:p-10 space-y-8 animate-scale-up print:border-none print:shadow-none print:p-0 print:text-black print:bg-white">
            
            {/* Header controls (printed hidden) */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-brand-navy-bright/10 print:hidden">
              <div className="flex items-center gap-2 text-brand-emerald">
                <FileText className="w-5 h-5 text-brand-emerald animate-pulse" />
                <h2 className="text-base font-bold text-slate-100">Ata de Auditoria de Encerramento (PDF)</h2>
              </div>
              <div className="flex items-center gap-2">
                <button
                  id="print-again-btn"
                  onClick={handleExportPDF}
                  className="bg-brand-emerald hover:bg-emerald-400 text-brand-navy-deep text-xs font-bold px-5 py-2.5 rounded-lg flex items-center gap-1.5 transition cursor-pointer shadow-lg hover:shadow-brand-emerald/10"
                >
                  <Printer className="w-4 h-4" />
                  Salvar Ata em PDF / Imprimir
                </button>
                <button
                  id="close-report-btn"
                  onClick={() => {
                    handleSystemResetOnClosingReport();
                    setPrintReport(null);
                    // Focus visor reference for next day cursor persistence!
                    setTimeout(() => {
                      const visorInput = document.getElementById('visor') as HTMLInputElement | null;
                      if (visorInput) {
                        visorInput.focus();
                      }
                    }, 50);
                  }}
                  className="bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold px-4 py-2.5 rounded-lg transition cursor-pointer"
                >
                  Concluir e Liberar Sistema
                </button>
              </div>
            </div>

            {/* REPORT BODY */}
            <div className="space-y-6 text-slate-300 print:text-black">
              {/* Header Title Block */}
              <div className="text-center space-y-3 border-b border-dashed border-slate-700/60 pb-6 print:border-black/30">
                <div className="flex justify-center items-center gap-2.5 mb-1">
                  <div className="w-10 h-10 bg-brand-emerald/15 rounded-lg flex items-center justify-center border border-brand-emerald/30">
                    <Building2 className="w-6 h-6 text-brand-emerald animate-pulse" />
                  </div>
                  <div className="text-left leading-none">
                    <span className="font-sans font-black tracking-widest text-slate-100 text-base">MARKS SYSTEMS - CRVA 0018 PASSO FUNDO/RS</span>
                  </div>
                </div>
                <h1 className="text-xl md:text-2xl font-mono tracking-wider font-extrabold text-slate-100 print:text-black uppercase">
                  Ata de Encerramento e Auditoria de Caixa
                </h1>
                <div className="flex flex-wrap items-center justify-center gap-4 text-xs font-mono text-slate-400 print:text-black/70 mt-2">
                  <span>Terminal ID: <strong className="text-slate-200 print:text-black">{printReport.terminalId}</strong></span>
                  <span>●</span>
                  <span>Data Operacional: <strong className="text-slate-200 print:text-black">{printReport.dataOperacional}</strong></span>
                  <span>●</span>
                  <span>Autenticação: <strong className="text-brand-emerald font-bold">{getCurrentSecureHash(printReport)}</strong></span>
                </div>
              </div>

              {/* SECTION A: METADADOS */}
              <div className="space-y-3 bg-brand-navy-deep/50 p-4 rounded-xl border border-brand-navy-bright/60 print:bg-transparent print:border-black/10 print:p-0">
                <h3 className="text-xs font-bold tracking-wider font-mono text-brand-emerald uppercase print:text-black">
                  1. Metadados Operacionais do Servidor
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs font-mono">
                  <div className="space-y-1">
                    <span className="text-slate-500 block">Horário Abertura</span>
                    <strong className="text-slate-200 print:text-black">{printReport.horarioAbertura}</strong>
                  </div>
                  <div className="space-y-1">
                    <span className="text-slate-500 block">Horário Fechamento</span>
                    <strong className="text-slate-200 print:text-black">{printReport.horarioFechamento}</strong>
                  </div>
                  <div className="space-y-1">
                    <span className="text-slate-500 block">Usuário Master Logado</span>
                    <strong className="text-slate-200 print:text-black">{printReport.usuarioMaster}</strong>
                  </div>
                  <div className="space-y-1">
                    <span className="text-slate-500 block">Certificado de Autenticidade</span>
                    <strong className="text-brand-emerald print:text-black font-bold">● MARKS SECURE OK</strong>
                  </div>
                </div>
              </div>

              {/* SECTION B: DEMONSTRATIVO CONTÁBIL */}
              <div className="space-y-4">
                <h3 className="text-xs font-bold tracking-wider font-mono text-brand-emerald uppercase print:text-black">
                  2. Demonstrativo Contábil Rígido (Faturamento Físico)
                </h3>
                <div className="border border-brand-navy-bright/60 rounded-xl overflow-hidden print:border-black/30 text-xs font-mono">
                  <div className="grid grid-cols-3 bg-slate-800/50 p-3 font-bold border-b border-brand-navy-bright/10 print:bg-slate-100 print:text-black print:border-black/30">
                    <span>Equação Patrimonial</span>
                    <span className="text-right">Sinal</span>
                    <span className="text-right">Valor Operado</span>
                  </div>
                  
                  <div className="divide-y divide-brand-navy-bright/10 print:divide-black/20">
                    <div className="grid grid-cols-3 p-3">
                      <span>Fundo de Troco de Abertura</span>
                      <span className="text-right text-slate-400">[Inicial]</span>
                      <span className="text-right font-bold text-slate-100 print:text-black">{DecimalMath.formatBRL(printReport.fundoTroco)}</span>
                    </div>

                    <div className="grid grid-cols-3 p-3">
                      <span>(+) Entradas em Dinheiro Espécie</span>
                      <span className="text-right text-brand-emerald font-bold">(+)</span>
                      <span className="text-right font-bold text-slate-100 print:text-black">{DecimalMath.formatBRL(printReport.entradasDinheiro)}</span>
                    </div>

                    <div className="grid grid-cols-3 p-3">
                      <span>(+) Entradas via PIX Instantâneo</span>
                      <span className="text-right text-brand-emerald font-bold">(+)</span>
                      <span className="text-right font-bold text-slate-100 print:text-black">{DecimalMath.formatBRL(printReport.entradasPix)}</span>
                    </div>

                    <div className="grid grid-cols-3 p-3">
                      <span>(+) Entradas via Cartão de Crédito</span>
                      <span className="text-right text-brand-emerald font-bold">(+)</span>
                      <span className="text-right font-bold text-slate-100 print:text-black">{DecimalMath.formatBRL(printReport.entradasCredito)}</span>
                    </div>

                    <div className="grid grid-cols-3 p-3">
                      <span>(+) Entradas via Cartão de Débito</span>
                      <span className="text-right text-brand-emerald font-bold">(+)</span>
                      <span className="text-right font-bold text-slate-100 print:text-black">{DecimalMath.formatBRL(printReport.entradasDebito)}</span>
                    </div>

                    <div className="grid grid-cols-3 p-3">
                      <span>(+) Entradas via Boleto (Faturamento B2B)</span>
                      <span className="text-right text-slate-500 font-bold">(Prazo)</span>
                      <span className="text-right font-bold text-slate-100 print:text-black">{DecimalMath.formatBRL(printReport.entradasBoleto)}</span>
                    </div>

                    <div className="grid grid-cols-3 p-3">
                      <span>(+) Suprimentos (Aportes / Reforços)</span>
                      <span className="text-right text-brand-emerald font-bold">(+)</span>
                      <span className="text-right font-bold text-slate-100 print:text-black">{DecimalMath.formatBRL(printReport.reforcos)}</span>
                    </div>

                    <div className="grid grid-cols-3 p-3">
                      <span>(-) Sangrias (Retiradas Extraordinárias)</span>
                      <span className="text-right text-red-400 font-bold">(-)</span>
                      <span className="text-right font-bold text-slate-100 print:text-black">{DecimalMath.formatBRL(printReport.retiradas)}</span>
                    </div>
                  </div>

                  {/* Foot total values comparison */}
                  <div className="p-4 bg-slate-800/80 border-t-2 border-brand-navy-bright font-bold grid grid-cols-3 text-sm print:bg-transparent print:border-t-2 print:border-black/30">
                    <span className="text-slate-200 print:text-black">Saldo de Caixa Esperado:</span>
                    <span></span>
                    <span className="text-right text-slate-100 print:text-black font-extrabold">{DecimalMath.formatBRL(printReport.saldoEsperado)}</span>
                  </div>

                  <div className="p-4 bg-slate-800/40 border-t border-brand-navy-bright/20 font-bold grid grid-cols-3 text-sm print:bg-transparent print:border-t print:border-black/20">
                    <span className="text-slate-200 print:text-black">Contagem Física Informada:</span>
                    <span></span>
                    <span className="text-right text-slate-100 print:text-black font-extrabold">{DecimalMath.formatBRL(printReport.saldoInformado)}</span>
                  </div>
                </div>
              </div>

              {/* SECTION C: DEMONSTRATIVO B2B */}
              <div className="space-y-3">
                <h3 className="text-xs font-bold tracking-wider font-mono text-brand-emerald uppercase print:text-black">
                  2.1. Demonstrativo B2B vs Clientes de Balcão
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="bg-brand-navy-deep/40 p-4 rounded-xl border border-brand-navy-bright/20 flex flex-col justify-between space-y-3 print:border-black/20 print:p-0">
                    <span className="text-[10px] text-slate-400 uppercase font-mono font-bold tracking-wider">Clientes Particulares (Balcão)</span>
                    <div className="font-mono">
                      <p className="text-xl font-bold font-sans text-slate-100 print:text-black">{DecimalMath.formatBRL(printReport.particularTotal)}</p>
                      <p className="text-xs text-slate-400 mt-1">{printReport.particularQty} atendimentos de balcão liquidados</p>
                    </div>
                  </div>

                  <div className="bg-brand-navy-deep/40 p-4 rounded-xl border border-brand-navy-bright/20 flex flex-col justify-between space-y-3 print:border-black/20 print:p-0">
                    <span className="text-[10px] text-slate-400 uppercase font-mono font-bold tracking-wider">Despachantes Credenciados (B2B Corporativo)</span>
                    <div className="font-mono">
                      <p className="text-xl font-bold font-sans text-slate-100 print:text-black">{DecimalMath.formatBRL(printReport.b2bTotal)}</p>
                      <p className="text-xs text-slate-400 mt-1">{printReport.b2bQty} serviços corporativos faturados</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* SECTION D: DIVERGENCIA & ALERT VERIFICATION */}
              <div className="space-y-3">
                <h3 className="text-xs font-bold tracking-wider font-mono text-brand-emerald uppercase print:text-black">
                  2.2. Auditoria de Paridade & Divergência
                </h3>
                <div className={`p-4 rounded-xl border font-mono text-xs flex flex-col md:flex-row md:items-center justify-between gap-4 ${
                  printReport.status === 'Conciliado' 
                    ? 'bg-brand-emerald/10 border-brand-emerald/30 text-brand-emerald' 
                    : 'bg-red-500/10 border-red-500/30 text-red-400'
                } print:border-black/40 print:text-black print:bg-transparent`}>
                  <div className="space-y-1 text-slate-300 print:text-black">
                    <span className="text-[10px] uppercase font-bold text-slate-400 print:text-black">Divergência Apurada</span>
                    <p className="text-base font-extrabold">{DecimalMath.formatBRL(printReport.divergencia)} ({printReport.status})</p>
                  </div>
                  
                  <div className="text-right">
                    <span className="text-[10px] uppercase font-bold text-slate-400 print:text-black block mb-1">Status Governança</span>
                    <span className={`px-2.5 py-1 rounded text-[10px] font-bold uppercase ${
                      printReport.status === 'Conciliado'
                        ? 'bg-brand-emerald/20 text-brand-emerald border border-brand-emerald/30'
                        : 'bg-red-500/20 text-red-500 border border-red-500/30'
                    } print:text-black print:border-black print:bg-transparent`}>
                      {printReport.status === 'Conciliado' ? 'CAIXA INTEGRALMENTE CONCILIADO' : 'ATENÇÃO: INCONSISTÊNCIA DETECTADA'}
                    </span>
                  </div>
                </div>
              </div>

              {/* SECTION E: SECURITY MESSAGE & SIGNATURES */}
              <div className="pt-12 border-t border-dashed border-slate-700/60 font-mono text-xs text-slate-400 print:border-black/30 print:text-black space-y-8">
                
                <h3 className="text-xs font-bold tracking-wider font-mono text-brand-emerald uppercase print:text-black text-center">
                  3. Validação e Assinaturas de Responsabilidade
                </h3>

                <div className="flex flex-col items-center space-y-12 pt-6 max-w-sm mx-auto">
                  {/* Linha 1: Operador de Caixa */}
                  <div className="w-full flex flex-col items-center">
                    <div className="w-full border-b border-slate-700/60 print:border-black/50 mb-2"></div>
                    <p className="font-bold text-slate-200 print:text-black text-center text-xs uppercase tracking-wide">
                      Operador de Caixa
                    </p>
                    <p className="text-[10px] text-slate-500 print:text-black/80 text-center mt-1 leading-normal">
                      Responsável pela abertura, lançamentos e contagem física.
                    </p>
                  </div>

                  {/* Linha 2: Supervisor / Gerente de Turno */}
                  <div className="w-full flex flex-col items-center">
                    <div className="w-full border-b border-slate-700/60 print:border-black/50 mb-2"></div>
                    <p className="font-bold text-slate-200 print:text-black text-center text-xs uppercase tracking-wide">
                      Supervisor / Gerente de Turno
                    </p>
                    <p className="text-[10px] text-slate-500 print:text-black/80 text-center mt-1 leading-normal">
                      Responsável pela homologação e validação do encerramento.
                    </p>
                  </div>

                  {/* Linha 3: Conferente Financeiro */}
                  <div className="w-full flex flex-col items-center">
                    <div className="w-full border-b border-slate-700/60 print:border-black/50 mb-2"></div>
                    <p className="font-bold text-slate-200 print:text-black text-center text-xs uppercase tracking-wide">
                      Conferente Financeiro
                    </p>
                    <p className="text-[10px] text-slate-500 print:text-black/80 text-center mt-1 leading-normal">
                      Responsável pela conciliação bancária dos valores de PIX e Cartões.
                    </p>
                  </div>
                </div>

                {/* Footer and Security Message */}
                <div className="pt-8 border-t border-brand-navy-bright/10 print:border-black/10 text-center">
                  <p className="text-[10px] leading-relaxed text-slate-500 print:text-black/75">
                    Este relatório de encerramento foi chancelado digitalmente pelo sistema de auditoria Marks Systems.
                    <br />
                    A guarda física das vias impressas deve ser mantida por 5 (cinco) anos conforme diretrizes regulamentares locais.
                  </p>
                </div>
              </div>

            </div>

          </div>
        </div>
      )}

    </div>
  );
}
