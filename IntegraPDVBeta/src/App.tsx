/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { jsPDF } from 'jspdf';
import Header from './components/Header';
import PdvSection from './components/PdvSection';
import FluxoCaixaSection from './components/FluxoCaixaSection';
import LoginScreen from './components/LoginScreen';
import AberturaCaixaModal from './components/AberturaCaixaModal';
import FechamentoCaixaModal from './components/FechamentoCaixaModal';
import { Transaction, RlsSession, ClientProfile, CaixaState, CashTransaction, OperatorTimelineEvent } from './types';
import { INITIAL_TRANSACTIONS, MOCK_CLIENTS } from './data/mockServices';
import { DecimalMath } from './utils/numericPrice';
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

export default function App() {
  // Global Transactions in-memory database
  const [transactions, setTransactions] = useState<Transaction[]>(() => {
    const saved = localStorage.getItem('transactions');
    return saved ? JSON.parse(saved) : INITIAL_TRANSACTIONS;
  });

  useEffect(() => {
    localStorage.setItem('transactions', JSON.stringify(transactions));
  }, [transactions]);

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

  // Global Clients Database for B2B accounts outstanding balance
  const [clients, setClients] = useState<ClientProfile[]>(() => {
    const saved = localStorage.getItem('clients');
    return saved ? JSON.parse(saved) : MOCK_CLIENTS;
  });

  // Active View Tab: 'PDV' | 'DASHBOARD'
  const [activeTab, setActiveTab] = useState<'PDV' | 'DASHBOARD'>('PDV');

  // Form inline para sangria/suprimento
  const [showSangriaForm, setShowSangriaForm] = useState<boolean>(false);
  const [showSuprimentoForm, setShowSuprimentoForm] = useState<boolean>(false);
  const [cashOpValue, setCashOpValue] = useState<string>('');
  const [cashOpReason, setCashOpReason] = useState<string>('');

  // Authentication & Access Governance State
  const [userSession, setUserSession] = useState<RlsSession | null>(() => {
    const saved = localStorage.getItem('userSession');
    return saved ? JSON.parse(saved) : null;
  });
  const [isMaster, setIsMaster] = useState<boolean>(() => {
    const saved = localStorage.getItem('isMaster');
    return saved ? JSON.parse(saved) : false;
  });

  // Módulo de Abertura de Caixa State (RF001)
  const [caixaState, setCaixaState] = useState<CaixaState>(() => {
    const saved = localStorage.getItem('caixaState');
    return saved ? JSON.parse(saved) : {
      status: 'fechado',
      dataAbertura: null,
      fundoTroco: '0.00',
      operadorName: null,
      sangrias: [],
      suprimentos: []
    };
  });

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

  const handleSwitchActiveOperator = (email: string, pass: string): boolean => {
    const trimmedEmail = email.trim().toLowerCase();
    
    // Master check
    if (trimmedEmail === 'fsobrosa.12tc@gmail.com' && pass === 'Antonio2@26') {
      const nextSession: RlsSession = {
        userId: 'usr-master',
        userName: 'Antônio Marques',
        userRole: 'Master',
        email: 'fsobrosa.12tc@gmail.com',
        currentTenantId: 'BR-POA-MAIN-9',
        rlsPolicyApplied: 'SELECT * FROM transactions WHERE tenant_id = current_tenant(); (FULL COMMITTED ACCESSIBILITY)'
      };

      const leavingName = rlsSession.userName;
      const leavingEmail = rlsSession.email || 'ana.caixa@marks.com';
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
        operadorEmail: nextSession.email || 'fsobrosa.12tc@gmail.com',
        action: 'Retorno / Assunção de Turno',
        details: `${nowStr} - ${nextSession.userName} (${nextSession.email}) assumiu a operação do caixa.`
      };

      setCaixaState(prev => {
        const currentTimeline = prev.timeline || [];
        return {
          ...prev,
          timeline: [...currentTimeline, outEvent, inEvent]
        };
      });

      setUserSession(nextSession);
      setIsMaster(true);
      addToast('Acesso Concedido', 'Operador trocado para Antônio Marques!', 'success');
      return true;
    }

    // Operator check
    const saved = localStorage.getItem('simulated_operators');
    const list = saved ? JSON.parse(saved) : [
      {
        name: 'Carlos Gerente (Supervisor)',
        email: 'carlos.gerente@marks.com',
        password: 'gerente123',
        role: 'Gerente'
      },
      {
        name: 'Juliana Financeiro (Admin)',
        email: 'juliana.fin@marks.com',
        password: 'financeiro123',
        role: 'Financeiro'
      },
      {
        name: 'Ana Carolina (Caixa)',
        email: 'ana.caixa@marks.com',
        password: 'caixa123',
        role: 'Operador'
      }
    ];

    const found = list.find((op: any) => op.email.trim().toLowerCase() === trimmedEmail && op.password === pass);
    if (found) {
      const nextSession: RlsSession = {
        userId: `usr-op-${Date.now()}`,
        userName: found.name,
        userRole: found.role || 'Operador',
        email: found.email,
        currentTenantId: 'BR-POA-MAIN-9',
        rlsPolicyApplied: found.role === 'Operador'
          ? 'SELECT * FROM current_orders WHERE created_by_id = authenticated_user_id(); (RESTRICTED TO SELF CREATED)'
          : 'SELECT * FROM transactions WHERE tenant_id = current_tenant(); (FULL COMMITTED ACCESSIBILITY)'
      };

      const leavingName = rlsSession.userName;
      const leavingEmail = rlsSession.email || 'ana.caixa@marks.com';
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
        return {
          ...prev,
          timeline: [...currentTimeline, outEvent, inEvent]
        };
      });

      setUserSession(nextSession);
      setIsMaster(found.role !== 'Operador');
      addToast('Acesso Concedido', `Operador trocado para ${found.name} (${found.role})!`, 'success');
      return true;
    }

    addToast('Acesso Negado', 'E-mail ou senha do operador inválidos.', 'alert');
    return false;
  };

  // Simulated active Postgres RLS Session (synced with userSession)
  const [rlsSession, setRlsSession] = useState<RlsSession>(() => {
    const saved = localStorage.getItem('rlsSession');
    return saved ? JSON.parse(saved) : {
      userId: 'usr-101',
      userName: 'Antônio Marques',
      userRole: 'Administrador',
      currentTenantId: 'BR-POA-MAIN-9',
      rlsPolicyApplied: 'SELECT * FROM transactions WHERE tenant_id = current_tenant(); (FULL COMMITTED ACCESSIBILITY)'
    };
  });

  // Sync state changes with localStorage
  useEffect(() => {
    if (userSession) {
      localStorage.setItem('userSession', JSON.stringify(userSession));
    } else {
      localStorage.removeItem('userSession');
    }
  }, [userSession]);

  useEffect(() => {
    localStorage.setItem('isMaster', JSON.stringify(isMaster));
  }, [isMaster]);

  useEffect(() => {
    localStorage.setItem('caixaState', JSON.stringify(caixaState));
  }, [caixaState]);

  // No automatic printing to avoid pop-up blocking issues in preview frame. PDF generated purely client-side on user click.

  useEffect(() => {
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

  // Realtime Faturamento Diário calculation (numeric(10,2) precision)
  const faturamentoDiario = transactions
    .filter(tx => {
      if (tx.status === 'CANCELLED') return false;
      const txDate = new Date(tx.timestamp).toLocaleDateString('pt-BR');
      const todayDate = new Date().toLocaleDateString('pt-BR');
      return txDate === todayDate;
    })
    .reduce((sum, tx) => DecimalMath.add(sum, tx.netTotal), '0.00');

  // --- REQUISITE ACTIONS ---
  const handleAddTransaction = (newTx: Transaction) => {
    // Inserts new tx to database
    setTransactions(prev => [newTx, ...prev]);

    // RF003: If finalized as 'BOLETO' (Faturamento a Prazo), increment saldo_devedor
    if (newTx.paymentMethod === 'BOLETO') {
      setClients(prevClients => 
        prevClients.map(c => {
          if (c.cpfCnpj === newTx.clientCpfCnpj) {
            const currentBal = c.outstandingBalance || '0.00';
            const nextBal = DecimalMath.add(currentBal, newTx.netTotal);
            return { ...c, outstandingBalance: nextBal };
          }
          return c;
        })
      );
    }

    addToast(
      'Baixa Registrada',
      `Transação ${newTx.sequenceId} pelo valor de ${DecimalMath.formatBRL(newTx.netTotal)} gravada no Banco PostgreSQL.`,
      'success'
    );
  };

  const handleUnloadTransaction = (txId: string) => {
    const target = transactions.find(t => t.id === txId);
    if (target) {
      // Reverse or cancel transaction simulating PostgreSQL RLS check
      setTransactions(prev => 
        prev.map(tx => tx.id === txId ? { ...tx, status: 'CANCELLED' } : tx)
      );

      // Decrement balance if we're cancelling/refunding a BOLETO payment
      if (target.paymentMethod === 'BOLETO' && target.status !== 'CANCELLED') {
        setClients(prevClients => 
          prevClients.map(c => {
            if (c.cpfCnpj === target.clientCpfCnpj) {
              const currentBal = c.outstandingBalance || '0.00';
              const nextBal = DecimalMath.sub(currentBal, target.netTotal);
              const safeBal = parseFloat(nextBal) < 0 ? '0.00' : nextBal;
              return { ...c, outstandingBalance: safeBal };
            }
            return c;
          })
        );
      }

      addToast(
        'Transação Estornada',
        `Estorno e contingência do cupom ${target.sequenceId} aplicados com sucesso.`,
        'alert'
      );
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
      operatorName: rlsSession.userName,
      operadorLogadoId: rlsSession.userId
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
      operatorName: rlsSession.userName,
      operadorLogadoId: rlsSession.userId
    };
    setCaixaState(prev => ({
      ...prev,
      suprimentos: [...prev.suprimentos, sup]
    }));
    addToast('Reforço Registrado', `Reforço de ${DecimalMath.formatBRL(value)} realizado para: ${reason}.`, 'success');
  };

  const handleConfirmCloseCaixa = (report: any) => {
    // 1. Compile real time data operated during this shift
    let cashSum = '0.00';
    let pixSum = '0.00';
    let creditSum = '0.00';
    let debitSum = '0.00';
    let boletoSum = '0.00';

    let particularCount = 0;
    let particularSum = '0.00';
    let b2bCount = 0;
    let b2bSum = '0.00';

    const tOpen = caixaState.dataAbertura ? new Date(caixaState.dataAbertura).getTime() : 0;

    transactions.forEach(tx => {
      // Filter transactions processed in current session
      const txTime = new Date(tx.timestamp).getTime();
      if ((tOpen === 0 || txTime >= tOpen) && tx.status !== 'CANCELLED') {
        const method = tx.paymentMethod;
        const amount = tx.netTotal;

        if (method === 'CASH') cashSum = DecimalMath.add(cashSum, amount);
        else if (method === 'PIX') pixSum = DecimalMath.add(pixSum, amount);
        else if (method === 'CREDIT_CARD') creditSum = DecimalMath.add(creditSum, amount);
        else if (method === 'DEBIT_CARD') debitSum = DecimalMath.add(debitSum, amount);
        else if (method === 'BOLETO') boletoSum = DecimalMath.add(boletoSum, amount);

        const isParticular = tx.clientCategory === 'Particular' || tx.clientCategory === 'particular-temp' || !tx.clientCategory || tx.clientCategory === 'Particular (Consumidor)';
        if (isParticular) {
          particularCount++;
          particularSum = DecimalMath.add(particularSum, amount);
        } else {
          b2bCount++;
          b2bSum = DecimalMath.add(b2bSum, amount);
        }
      }
    });

    const totalSangriasCents = caixaState.sangrias.reduce((sum, s) => sum + DecimalMath.toCents(s.value), 0);
    const totalSangrias = DecimalMath.fromCents(totalSangriasCents);

    const totalSuprimentosCents = caixaState.suprimentos.reduce((sum, s) => sum + DecimalMath.toCents(s.value), 0);
    const totalSuprimentos = DecimalMath.fromCents(totalSuprimentosCents);

    const compiled: AuditReport = {
      terminalId: 'Passo Fundo - Caixa 01',
      dataOperacional: new Date().toLocaleDateString('pt-BR'),
      horarioAbertura: caixaState.dataAbertura ? new Date(caixaState.dataAbertura).toLocaleTimeString('pt-BR') : '08:00:00',
      horarioFechamento: new Date().toLocaleTimeString('pt-BR'),
      usuarioMaster: rlsSession.email || 'fsobrosa.12tc@gmail.com',
      fundoTroco: caixaState.fundoTroco || '0.00',
      entradasDinheiro: cashSum,
      entradasPix: pixSum,
      entradasCredito: creditSum,
      entradasDebito: debitSum,
      entradasBoleto: boletoSum,
      reforcos: totalSuprimentos,
      retiradas: totalSangrias,
      saldoEsperado: report.saldoEsperado,
      saldoInformado: report.valorInformado,
      divergencia: report.divergencia,
      status: report.status,
      particularQty: particularCount,
      particularTotal: particularSum,
      b2bQty: b2bCount,
      b2bTotal: b2bSum,
      timeline: caixaState.timeline || []
    };

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

    setCaixaState({
      status: 'fechado',
      dataAbertura: null,
      fundoTroco: '0.00',
      operadorName: null,
      sangrias: [],
      suprimentos: []
    });

    setShowFechamentoModal(false);

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
    localStorage.removeItem('transactions');

    // Clear actual physical cash register shift state, maintaining fechado status and resetting fundoTroco to 0.00
    const closedState: CaixaState = {
      status: 'fechado',
      dataAbertura: null,
      fundoTroco: '0.00',
      operadorName: null,
      sangrias: [],
      suprimentos: []
    };
    setCaixaState(closedState);
    localStorage.removeItem('caixaState');
    localStorage.removeItem('global_caixa_compartilhado');
    localStorage.removeItem('pdv_cart');
    localStorage.removeItem('pdv_checkoutStage');

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
    doc.text(`Terminal ID: Passo Fundo - Caixa 01`, leftMargin, currentY);
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
    setUserSession(null);
    setIsMaster(false);
    setCaixaState({
      status: 'fechado',
      dataAbertura: null,
      fundoTroco: '0.00',
      operadorName: null,
      sangrias: [],
      suprimentos: []
    });
    localStorage.removeItem('userSession');
    localStorage.removeItem('isMaster');
    localStorage.removeItem('caixaState');
    localStorage.removeItem('rlsSession');
    addToast('Sessão Encerrada', 'Você saiu do sistema de governança com segurança.', 'info');
  };

  if (!userSession) {
    return (
      <div className="min-h-screen bg-brand-navy-deep text-slate-100 flex flex-col justify-center items-center">
        <LoginScreen 
          onLoginSuccess={(session, isMasterUser) => {
            setUserSession(session);
            setIsMaster(isMasterUser);

            const globalCaixaStr = localStorage.getItem('global_caixa_compartilhado');
            let globalCaixa = null;
            if (globalCaixaStr) {
              try {
                globalCaixa = JSON.parse(globalCaixaStr);
              } catch (e) {}
            }

            if (globalCaixa && globalCaixa.status === 'aberto') {
              setCaixaState(globalCaixa);
              if (isMasterUser) {
                // Supervisor access: popup showing details of active operator
                setAlreadyOpenDetails({
                  name: globalCaixa.operadorName || 'Operador',
                  email: globalCaixa.operadorEmail || 'ana.caixa@marks.com',
                  fundoTroco: globalCaixa.fundoTroco || '150.00'
                });
                setShowAlreadyOpenPopup(true);
              } else {
                // Operator: lock screen for session interruption
                setIsScreenLocked(true);
              }
            } else {
              setCaixaState({
                status: 'fechado',
                dataAbertura: null,
                fundoTroco: '0.00',
                operadorName: session.userName,
                sangrias: [],
                suprimentos: []
              });
            }

            if (!isMasterUser) {
              setActiveTab('PDV');
            }
          }}
        />

        {/* Real-time floating Toast Stack (bottom right corner) */}
        <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-2.5 max-w-sm w-full font-mono">
          {toasts.map(t => {
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
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-brand-navy-deep text-slate-100 flex flex-col selection:bg-brand-emerald selection:text-brand-navy-deep">
      
      {/* 1. Header component */}
      <Header 
        currentSession={rlsSession} 
        onChangeSession={setRlsSession} 
        onLogout={handleLogout}
        caixaState={caixaState}
        isMaster={isMaster}
      />

      {/* Closed Cash Register modal overlay */}
      {caixaState.status === 'fechado' && (
        <AberturaCaixaModal 
          currentSession={rlsSession}
          onLogout={handleLogout}
          onOpenCaixaSuccess={(fundo, t) => {
            const newCaixaState: CaixaState = {
              status: 'aberto',
              dataAbertura: t,
              fundoTroco: fundo,
              operadorName: rlsSession.userName,
              operadorEmail: rlsSession.email || 'ana.caixa@marks.com',
              sangrias: [],
              suprimentos: [],
              timeline: [
                {
                  timestamp: new Date(t).toLocaleTimeString('pt-BR'),
                  operadorName: rlsSession.userName,
                  operadorEmail: rlsSession.email || 'ana.caixa@marks.com',
                  action: 'Abertura de Caixa',
                  details: `Início de Turno operacional com Fundo de Troco de ${DecimalMath.formatBRL(fundo)}.`
                }
              ]
            };
            setCaixaState(newCaixaState);
            localStorage.setItem('caixaState', JSON.stringify(newCaixaState));
            localStorage.setItem('global_caixa_compartilhado', JSON.stringify(newCaixaState));
            addToast('Caixa Aberto', `Terminal operacional inicializado com fundo de troco de ${DecimalMath.formatBRL(fundo)}.`, 'success');
          }}
        />
      )}

      {/* 2. Secondary cockpit utility controls */}
      <div className={`bg-brand-navy-card/40 border-b border-brand-navy-bright py-2.5 px-4 transition-all duration-300 ${caixaState.status === 'fechado' ? 'blur-sm pointer-events-none opacity-40' : ''}`}>
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

              <button
                id="fluxo-financeiro-tab-btn"
                onClick={() => {
                  if (!isMaster) {
                    addToast(
                      'Acesso Negado',
                      'Apenas Administradores Master têm acesso ao módulo de Fluxo de Caixa / Serviços corporativos.',
                      'alert'
                    );
                    return;
                  }
                  setActiveTab('DASHBOARD');
                }}
                className={`px-4 py-1.5 rounded text-xs font-semibold tracking-wide flex items-center gap-2 transition-all cursor-pointer ${
                  activeTab === 'DASHBOARD' 
                    ? 'bg-brand-emerald text-brand-navy-deep font-bold shadow' 
                    : !isMaster 
                      ? 'text-slate-600 cursor-not-allowed opacity-50'
                      : 'text-slate-400 hover:text-slate-200'
                }`}
                title={!isMaster ? 'Módulo Restrito a Administradores Master' : 'Visualizar Fluxo de Caixa'}
              >
                <Activity className="w-4 h-4" />
                {!isMaster && <Lock className="w-3.5 h-3.5 text-red-500 animate-pulse" />}
                Painel BI Master Realtime
              </button>
            </div>

            {/* KPI Faturamento Diário */}
            <div className="bg-brand-navy-deep border border-brand-emerald/10 rounded-lg px-4 py-1.5 flex items-center gap-3 shadow-md shadow-brand-emerald/5 animate-fade-in self-start md:self-center">
              <div className="p-1.5 bg-brand-emerald/10 text-brand-emerald rounded-lg border border-brand-emerald/20 flex-shrink-0">
                <Activity className="w-4 h-4 animate-pulse" />
              </div>
              <div>
                <span className="text-[10px] font-semibold text-slate-400 block leading-none mb-1">Faturamento diário</span>
                <span className="text-sm font-mono font-black text-brand-emerald block leading-none">
                  {DecimalMath.formatBRL(faturamentoDiario)}
                </span>
              </div>
            </div>

            {/* Turno operational Actions (Sangria, Suprimento e Fechamento) */}
            {caixaState.status === 'aberto' && (
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
                  Operador: {rlsSession.userName}
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
      <main className={`flex-1 max-w-7xl w-full mx-auto p-4 md:p-6 pb-20 transition-all duration-300 ${caixaState.status === 'fechado' ? 'blur-sm pointer-events-none opacity-40' : ''}`}>
        
        {activeTab === 'PDV' ? (
          <div className="space-y-4">
            <PdvSection 
              key={pdvKey}
              onAddTransaction={handleAddTransaction} 
              rlsSession={rlsSession} 
              clients={clients}
              setClients={setClients}
              isMaster={isMaster}
              onAlternarOperador={() => setShowAlternarModal(true)}
              caixaState={caixaState}
            />
          </div>
        ) : (
          <FluxoCaixaSection 
            transactions={transactions} 
            onUnloadTransaction={handleUnloadTransaction}
            rlsSession={rlsSession}
            clients={clients}
            caixaState={caixaState}
            setClients={setClients}
            isMaster={isMaster}
          />
        )}

      </main>

      {showFechamentoModal && (
        <FechamentoCaixaModal
          caixaState={caixaState}
          transactions={transactions}
          onClose={() => setShowFechamentoModal(false)}
          onConfirmCloseCaixa={handleConfirmCloseCaixa}
          currentSession={rlsSession}
          onLogout={handleLogout}
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
              onSubmit={(e) => {
                e.preventDefault();
                const isLogged = handleSwitchActiveOperator(alternarEmail, alternarPass);
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
                <span className="text-slate-200 font-bold font-mono">Passo Fundo - Caixa 01</span>
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
              {caixaState.fundoTroco && (
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-500 font-mono">Fundo de Troco:</span>
                  <span className="text-slate-200 font-bold font-mono">{DecimalMath.formatBRL(caixaState.fundoTroco)}</span>
                </div>
              )}
            </div>

            <form 
              onSubmit={(e) => {
                e.preventDefault();
                setUnlockError('');
                
                const trimmedEmail = (userSession.email || '').trim().toLowerCase();
                let isAuthorized = false;

                // Verifies Master credentials
                if (trimmedEmail === 'fsobrosa.12tc@gmail.com') {
                  if (unlockPassword === 'Antonio2@26') {
                    isAuthorized = true;
                  }
                } else {
                  // Verify standard database operators
                  const saved = localStorage.getItem('simulated_operators');
                  const list = saved ? JSON.parse(saved) : [
                    {
                      name: 'Carlos Gerente (Supervisor)',
                      email: 'carlos.gerente@marks.com',
                      password: 'gerente123',
                      role: 'Gerente'
                    },
                    {
                      name: 'Juliana Financeiro (Admin)',
                      email: 'juliana.fin@marks.com',
                      password: 'financeiro123',
                      role: 'Financeiro'
                    },
                    {
                      name: 'Ana Carolina (Caixa)',
                      email: 'ana.caixa@marks.com',
                      password: 'caixa123',
                      role: 'Operador'
                    }
                  ];

                  const found = list.find((op: any) => op.email.trim().toLowerCase() === trimmedEmail);
                  if (found && found.password === unlockPassword) {
                    isAuthorized = true;
                  }
                }

                if (isAuthorized) {
                  setIsScreenLocked(false);
                  setUnlockPassword('');
                  addToast('Acesso Restabelecido', 'Seus controles comerciais e sacola foram totalmente restaurados.', 'success');
                } else {
                  setUnlockError('Senha de segurança inválida ou expirada.');
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
        {toasts.map(t => {
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
      )()}

    </div>
  );
}
