/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { 
  ArrowUpRight, ArrowDownLeft, TrendingUp, DollarSign,
  Activity, Calendar, Filter, RotateCcw, Eye, Search,
  CheckCircle2, AlertTriangle, XCircle, CreditCard, Award, FileSpreadsheet,
  Clock, Users, Coins, Printer, FileText, Lock
} from 'lucide-react';
import { Transaction, CashFlowMetrics, RlsSession, ClientProfile, CaixaState } from '../types';
import { DecimalMath } from '../utils/numericPrice';
import { jsPDF } from 'jspdf';
import { supabase } from '../utils/supabaseClient';

interface OperatorUser {
  id: string;
  name: string;
  email: string;
  role: 'Master' | 'Gerente' | 'Financeiro' | 'Operador';
  status: 'Ativo' | 'Inativo';
  createdAt: string;
}

interface FluxoCaixaSectionProps {
  transactions: Transaction[];
  onUnloadTransaction: (txId: string) => void;
  rlsSession: RlsSession;
  clients: ClientProfile[];
  caixaState: CaixaState;
  setClients?: React.Dispatch<React.SetStateAction<ClientProfile[]>>;
  isMaster?: boolean;
  onRegisterDespachante?: (name: string, cnpj: string, phone: string) => Promise<ClientProfile | null>;
  onRegisterUser?: (name: string, email: string, role: any) => Promise<any | null>;
  historicalClosings: any[];
  setHistoricalClosings: React.Dispatch<React.SetStateAction<any[]>>;
  faturamentoDiaMaster?: string;
  isMobile?: boolean;
}

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

const parseOperationalDate = (dateStr: string): string => {
  const parts = dateStr.split('/');
  if (parts.length === 3) {
    return `${parts[2]}-${parts[1]}-${parts[0]}`;
  }
  return dateStr;
};

export default function FluxoCaixaSection({ 
  transactions, 
  onUnloadTransaction, 
  rlsSession, 
  clients, 
  caixaState,
  setClients,
  isMaster = false,
  onRegisterDespachante,
  onRegisterUser,
  historicalClosings,
  setHistoricalClosings,
  faturamentoDiaMaster,
  isMobile = false
}: FluxoCaixaSectionProps) {
  const hasCrudAccess = isMaster || rlsSession?.userRole === 'Master' || rlsSession?.userRole === 'Gerente' || rlsSession?.userRole === 'Financeiro';

  const isOperator = rlsSession?.userRole === 'Operador' || (!isMaster && !hasCrudAccess);
  if (isOperator) {
    return (
      <div className="p-8 text-center text-slate-400 font-mono text-xs bg-brand-navy-card border border-brand-navy-bright/10 rounded-2xl">
        Área restrita de supervisão. Acesso não autorizado para operadores de pista.
      </div>
    );
  }

  const canResetPassword = (targetRole: string) => {
    const callerRole = rlsSession.userRole;
    if (callerRole === 'Master') return true;
    if (callerRole === 'Gerente') {
      return targetRole !== 'Master' && targetRole !== 'Gerente';
    }
    return false;
  };

  const handleResetUserPassword = async (user: OperatorUser) => {
    const passwordTemp = generatePasswordExact8();
    try {
      const { error } = await supabase
        .from('usuarios')
        .update({ senha_provisoria: passwordTemp })
        .eq('id', user.id);

      if (error) throw error;

      setCreatedUserModal({
        name: user.name,
        email: user.email,
        passwordTemp
      });

      addToastLocal('Sucesso', `Nova senha definitiva gerada para ${user.name}!`);
    } catch (err: any) {
      addToastLocal('Erro', `Falha ao redefinir senha: ${err.message || err}`);
    }
  };

  // Sub-abas de Dashboard: CONTABIL (Conciliação & Livro Caixa) vs BI_MASTER (BI Analytics Realtime exclusivo Master) vs HISTORICO_ATAS
  const [subTab, setSubTab] = useState<'CONTABIL' | 'BI_MASTER' | 'HISTORICO_ATAS'>('CONTABIL');

  // Forçar sub-aba BI_MASTER no mobile
  useEffect(() => {
    if (isMobile) {
      setSubTab('BI_MASTER');
    }
  }, [isMobile]);

  // Filtros de Alta Performance para Consulta Histórica de Atas
  const [histStartDate, setHistStartDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() - 7); // Últimos 7 dias por padrão
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${d.getFullYear()}-${month}-${day}`;
  });
  const [histEndDate, setHistEndDate] = useState<string>(() => {
    const d = new Date();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${d.getFullYear()}-${month}-${day}`;
  });
  const [filterOperatorEmail, setFilterOperatorEmail] = useState<string>('ALL');
  const [filterTerminalId, setFilterTerminalId] = useState<string>('ALL');

  // Modal de Reemissão Centralizado em Tela Cheia
  const [viewHistoryAta, setViewHistoryAta] = useState<any | null>(null);

  // Estados para o Relatório de Emolumentos Mensal
  const [emolumentosMesAtual, setEmolumentosMesAtual] = useState<any[]>([]);
  const [historicoEmolumentos, setHistoricoEmolumentos] = useState<any[]>([]);
  const [selectedMesReferencia, setSelectedMesReferencia] = useState<string>('ATUAL');
  const [isSavingEmolumentos, setIsSavingEmolumentos] = useState(false);

  // Local notification setup for Fintech-like alerts (avoids window.alert inside iframe)
  const [localToast, setLocalToast] = useState<{title: string, message: string} | null>(null);
  const addToastLocal = (title: string, message: string) => {
    setLocalToast({ title, message });
    setTimeout(() => setLocalToast(null), 4000);
  };

  // Premium Confirmation Modal State
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    confirmText?: string;
    cancelText?: string;
    type?: 'danger' | 'warning' | 'success';
    onConfirm: () => void | Promise<void>;
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {}
  });

  const generateHash = (report: any) => {
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

  const reissuePdfDownload = (report: any) => {
    if (!report) return;

    const secureHash = generateHash(report);
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });

    const leftMargin = 20;
    const rightMargin = 190;
    let currentY = 20;

    // Header border style
    doc.setDrawColor(16, 185, 129); // #10b981 (Brand Emerald)
    doc.setLineWidth(1.5);
    doc.line(leftMargin, currentY, rightMargin, currentY);
    currentY += 8;

    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(14);
    doc.setTextColor(15, 23, 42); 
    doc.text('Marks Systems - CRVA 0018 Passo Fundo/RS', 105, currentY, { align: 'center' });
    currentY += 8;

    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(30, 41, 59); 
    doc.text('REEMISSÃO SEGUNDA VIA - ATA DE ENCERRAMENTO E AUDITORIA', 105, currentY, { align: 'center' });
    currentY += 8;

    doc.setDrawColor(226, 232, 240); 
    doc.setLineWidth(0.5);
    doc.line(leftMargin, currentY, rightMargin, currentY);
    currentY += 6;

    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(71, 85, 105);
    doc.text('1. DADOS DE IDENTIFICAÇÃO DO TERMINAL', leftMargin, currentY);
    currentY += 6;

    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(15, 23, 42); 

    doc.text(`Terminal ID: ${report.terminalId}`, leftMargin, currentY);
    doc.text(`Horário Abertura: ${report.horarioAbertura || '08:00:00'}`, 115, currentY);
    currentY += 5;

    doc.text(`Data Operacional: ${report.dataOperacional}`, leftMargin, currentY);
    doc.text(`Horário Fechamento: ${report.horarioFechamento}`, 115, currentY);
    currentY += 5;

    doc.text(`Responsável Fechamento: ${report.usuarioMaster}`, leftMargin, currentY);
    currentY += 6;

    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(15, 23, 42);
    const hashText = `ASSINATURA DIGITAL HASH INTEGRAL REESCRITA CONFORME FISCAL: ${secureHash}`;
    const splitHash = doc.splitTextToSize(hashText, rightMargin - leftMargin);
    doc.text(splitHash, leftMargin, currentY);
    currentY += (splitHash.length * 4) + 6;

    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(71, 85, 105);
    doc.text('2. TRANSPOSIÇÃO DE MOVIMENTAÇÃO CONTÁBIL INTEGRAL', leftMargin, currentY);
    currentY += 6;

    doc.setDrawColor(203, 213, 225); 
    doc.setLineWidth(0.3);
    doc.setFillColor(241, 245, 249); 
    doc.rect(leftMargin, currentY, rightMargin - leftMargin, 6, 'F');
    
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(15, 23, 42);
    doc.text('Parâmetro Operacional', leftMargin + 3, currentY + 4);
    doc.text('Tipo', 115, currentY + 4, { align: 'center' });
    doc.text('Valor Consolidado', rightMargin - 3, currentY + 4, { align: 'right' });
    currentY += 6;

    const addTableRow = (desc: string, sign: string, val: string) => {
      doc.setFont('Helvetica', 'normal');
      doc.setFontSize(8);
      doc.text(desc, leftMargin + 3, currentY + 4);
      doc.text(sign, 115, currentY + 4, { align: 'center' });
      doc.setFont('Helvetica', 'bold');
      doc.text(val, rightMargin - 3, currentY + 4, { align: 'right' });
      doc.line(leftMargin, currentY + 6, rightMargin, currentY + 6);
      currentY += 6;
    };

    addTableRow('Fundo de Troco de Abertura', '[Fundo]', DecimalMath.formatBRL(report.fundoTroco));
    addTableRow('(+) Entradas em Dinheiro Espécie', '(+)', DecimalMath.formatBRL(report.entradasDinheiro));
    addTableRow('(+) Entradas via PIX Instantâneo', '(+)', DecimalMath.formatBRL(report.entradasPix));
    addTableRow('(+) Entradas via Cartão de Crédito', '(+)', DecimalMath.formatBRL(report.entradasCredito));
    addTableRow('(+) Entradas via Cartão de Débito', '(+)', DecimalMath.formatBRL(report.entradasDebito));
    addTableRow('(+) Entradas faturadas via Boleto (B2B)', '[Prazo]', DecimalMath.formatBRL(report.entradasBoleto));
    addTableRow('(+) Suprimentos (Aportes/Reforços)', '(+)', DecimalMath.formatBRL(report.reforcos));
    addTableRow('(-) Sangrias (Retiradas Extraordinárias)', '(-)', DecimalMath.formatBRL(report.retiradas));

    currentY += 2;
    doc.setFillColor(248, 250, 252); 
    doc.rect(leftMargin, currentY, rightMargin - leftMargin, 13, 'F');
    doc.line(leftMargin, currentY, rightMargin, currentY);
    doc.line(leftMargin, currentY + 13, rightMargin, currentY + 13);

    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(30, 41, 59);

    doc.text('SALDO ESPERADO EM LIVRO-CAIXA DIGITAL:', leftMargin + 3, currentY + 5);
    doc.text(DecimalMath.formatBRL(report.saldoEsperado), rightMargin - 3, currentY + 5, { align: 'right' });

    doc.text('CONTAGEM FÍSICA DECLARADA EM AUDITORIA:', leftMargin + 3, currentY + 10);
    doc.text(DecimalMath.formatBRL(report.saldoInformado), rightMargin - 3, currentY + 10, { align: 'right' });
    currentY += 17;

    // Rastro de Operadores (Timeline table/list inside PDF)
    if (report.timeline && report.timeline.length > 0) {
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(8.5);
      doc.setTextColor(71, 85, 105);
      doc.text('3. RASTRO DE OPERADORES & TRANSIÇÕES OPERACIONAIS (LUNCH ROTATION)', leftMargin, currentY);
      currentY += 6;

      report.timeline.forEach((evt: any) => {
        if (currentY > 265) {
          doc.addPage();
          currentY = 20;
        }
        doc.setFont('Helvetica', 'bold');
        doc.setFontSize(7.5);
        doc.setTextColor(15, 23, 42);
        doc.text(`[${evt.timestamp}] - ${evt.action}`, leftMargin + 2, currentY + 3.5);
        
        doc.setFont('Helvetica', 'normal');
        doc.setFontSize(7.5);
        doc.setTextColor(71, 85, 105);
        doc.text(`Operador: ${evt.operadorName} (${evt.operadorEmail})`, leftMargin + 35, currentY + 3.5);
        
        currentY += 5.5;
      });
      currentY += 4;
    }

    if (currentY > 240) {
      doc.addPage();
      currentY = 20;
    }

    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(71, 85, 105);
    doc.text('4. AUDITORIA DE PARIDADE & CONCILIAÇÃO FINAL', leftMargin, currentY);
    currentY += 5;

    const isBatido = DecimalMath.toCents(report.divergencia) === 0;
    if (isBatido) {
      doc.setFillColor(209, 250, 229); 
      doc.setDrawColor(16, 185, 129); 
    } else {
      doc.setFillColor(254, 226, 226); 
      doc.setDrawColor(239, 68, 68); 
    }
    doc.rect(leftMargin, currentY, rightMargin - leftMargin, 12, 'FD');

    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(8);
    if (isBatido) {
      doc.setTextColor(6, 95, 70); 
      doc.text('SISTEMA CONCILIADO COM TOTAL PARIDADE COM SISTEMAS AUXILIARES OPERACIONAIS - R$ 0,00', leftMargin + 4, currentY + 4.5);
      doc.setFont('Helvetica', 'normal');
      doc.setFontSize(7);
      doc.text('As movimentações físicas efetuadas nos turnos de almoço batem precisamente com o relatório digital.', leftMargin + 4, currentY + 9);
    } else {
      doc.setTextColor(153, 27, 27); 
      const labelText = report.status === 'Quebra de Caixa' ? 'QUEBRA APURADA: ' : 'SOBRA APURADA: +';
      doc.text(`INCONSISTÊNCIA DETECTADA - ${labelText}${DecimalMath.formatBRL(report.divergencia)}`, leftMargin + 4, currentY + 4.5);
      doc.setFont('Helvetica', 'normal');
      doc.setFontSize(7);
      doc.text('Auditado retroativamente de forma digital para compensações operacionais adequadas.', leftMargin + 4, currentY + 9);
    }
    currentY += 17;

    if (currentY > 245) {
      doc.addPage();
      currentY = 20;
    }

    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(71, 85, 105);
    doc.text('5. ASSINATURAS FÍSICAS REQUISITADAS', leftMargin, currentY);
    currentY += 12;

    const bWidth = 48;
    const sX = leftMargin + 3;
    const gap = 12;

    // Block 1
    doc.setDrawColor(148, 163, 184); 
    doc.setLineWidth(0.3);
    doc.line(sX, currentY, sX + bWidth, currentY);
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(15, 23, 42);
    doc.text('OPERADOR DE CAIXA', sX + bWidth / 2, currentY + 4, { align: 'center' });

    // Block 2
    const mX = sX + bWidth + gap;
    doc.line(mX, currentY, mX + bWidth, currentY);
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(15, 23, 42);
    doc.text('SUPERVISOR / GERENTE', mX + bWidth / 2, currentY + 4, { align: 'center' });

    // Block 3
    const rX = mX + bWidth + gap;
    doc.line(rX, currentY, rX + bWidth, currentY);
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(15, 23, 42);
    doc.text('CONFERENTE FINANCEIRO', rX + bWidth / 2, currentY + 4, { align: 'center' });

    currentY += 14;

    doc.setFont('Helvetica', 'italic');
    doc.setFontSize(7);
    doc.setTextColor(148, 163, 184);
    doc.text(`Segunda via reemitida retroativamente para rastro fiscal em ${new Date().toLocaleString('pt-BR')}.`, 105, currentY, { align: 'center' });

    const filename = `ATA-CONCILIACAO-REEMISSAO-${report.dataOperacional.replace(/\//g, '-')}-${report.terminalId.replace(/\s+/g, '_')}.pdf`;
    doc.save(filename);
  };

  const handleReimprimirCupom = (tx: Transaction) => {
    const hasPrintPermission = isMaster || rlsSession.userRole === 'Master' || rlsSession.userRole === 'Gerente' || rlsSession.userRole === 'Financeiro';
    if (!hasPrintPermission) {
      addToastLocal('Acesso Negado', 'Permissão insuficiente para reemitir cupons fiscais.');
      return;
    }

    const itemsCount = tx.items.length;
    const obsCount = tx.items.filter(i => i.observation).length;
    const heightMm = Math.max(160, 120 + (itemsCount * 8) + (obsCount * 4));

    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: [80, heightMm]
    });

    let currentY = 10;
    
    // Cabeçalho da Reimpressão
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(239, 68, 68); // Vermelho
    doc.text('**REIMPRESSÃO - SEGUNDA VIA DE AUDITORIA**', 40, currentY, { align: 'center' });
    currentY += 5;

    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(15, 23, 42); 
    doc.text('MARKS SYSTEMS S.A.', 40, currentY, { align: 'center' });
    currentY += 4;

    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(100, 116, 139); 
    doc.text('IntegraPDV Ecosystem Integration', 40, currentY, { align: 'center' });
    currentY += 3.5;
    doc.text('CNPJ: 10.392.482/0001-90 | POA - RS', 40, currentY, { align: 'center' });
    currentY += 5;

    // Divisória tracejada
    doc.setDrawColor(203, 213, 225); 
    doc.setLineWidth(0.2);
    doc.line(6, currentY, 74, currentY);
    currentY += 5;

    // Metadados
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(71, 85, 105); 
    doc.text('DADOS DA TRANSAÇÃO ORIGINAL', 6, currentY);
    currentY += 4.5;

    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(15, 23, 42);

    doc.text(`Sequência No:`, 6, currentY);
    doc.setFont('Helvetica', 'bold');
    doc.text(tx.sequenceId, 74, currentY, { align: 'right' });
    currentY += 3.5;

    doc.setFont('Helvetica', 'normal');
    doc.text(`Operador original:`, 6, currentY);
    doc.text(tx.createdBy?.userName || 'N/A', 74, currentY, { align: 'right' });
    currentY += 3.5;

    doc.text(`Data Emissão original:`, 6, currentY);
    doc.text(new Date(tx.timestamp).toLocaleString('pt-BR'), 74, currentY, { align: 'right' });
    currentY += 3.5;

    doc.text(`Cliente/B2B:`, 6, currentY);
    doc.setFont('Helvetica', 'bold');
    doc.setTextColor(16, 185, 129); 
    const truncatedName = tx.clientName.length > 28 ? tx.clientName.slice(0, 25) + '...' : tx.clientName;
    doc.text(truncatedName, 74, currentY, { align: 'right' });
    doc.setTextColor(15, 23, 42);
    currentY += 3.5;

    doc.setFont('Helvetica', 'normal');
    doc.text(`CNPJ/CPF:`, 6, currentY);
    doc.text(tx.clientCpfCnpj, 74, currentY, { align: 'right' });
    currentY += 5;

    // Linha divisória
    doc.line(6, currentY, 74, currentY);
    currentY += 5;

    // Itens
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(71, 85, 105);
    doc.text('TAXAS E ENCARGOS PRESTADOS', 6, currentY);
    currentY += 4.5;

    tx.items.forEach(item => {
      doc.setFont('Helvetica', 'normal');
      doc.setFontSize(7);
      doc.setTextColor(15, 23, 42);

      const serviceNameTrunc = item.serviceName.length > 32 ? item.serviceName.slice(0, 29) + '...' : item.serviceName;
      doc.text(`${item.quantity}x ${serviceNameTrunc}`, 6, currentY);
      
      doc.setFont('Helvetica', 'bold');
      doc.text(DecimalMath.formatBRL(item.subtotal), 74, currentY, { align: 'right' });
      currentY += 3.5;

      doc.setFont('Helvetica', 'italic');
      doc.setFontSize(6);
      doc.setTextColor(148, 163, 184);
      doc.text(`(${item.type === 'DETRAN' ? 'OPERACIONAL' : item.type})`, 6, currentY);
      currentY += 3.5;

      if (item.observation) {
        doc.setFont('Helvetica', 'italic');
        doc.setFontSize(6);
        doc.setTextColor(100, 116, 139);
        const obsTrunc = item.observation.length > 40 ? item.observation.slice(0, 37) + '...' : item.observation;
        doc.text(`* Obs: ${obsTrunc}`, 8, currentY);
        currentY += 3.5;
      }
      currentY += 0.5;
    });

    currentY += 2;
    doc.line(6, currentY, 74, currentY);
    currentY += 5;

    // Detalhamento dos valores
    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(100, 116, 139);

    doc.text('Subtotal de Serviços:', 6, currentY);
    doc.text(DecimalMath.formatBRL(DecimalMath.add(tx.detranSubtotal, tx.otherSubtotal)), 74, currentY, { align: 'right' });
    currentY += 3.5;

    if (tx.issqn && parseFloat(tx.issqn) > 0) {
      doc.text('ISSQN Municipal (2%):', 6, currentY);
      doc.text(DecimalMath.formatBRL(tx.issqn), 74, currentY, { align: 'right' });
      currentY += 3.5;
    }

    currentY += 2.5;

    // Total Geral
    doc.setFillColor(241, 245, 249); 
    doc.rect(6, currentY, 68, 10, 'F');
    doc.setDrawColor(203, 213, 225);
    doc.rect(6, currentY, 68, 10, 'D');

    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(71, 85, 105);
    doc.text('TOTAL LÍQUIDO:', 10, currentY + 6.5);
    
    doc.setFontSize(9);
    doc.setTextColor(16, 185, 129); 
    doc.text(DecimalMath.formatBRL(tx.netTotal), 70, currentY + 6.5, { align: 'right' });
    currentY += 15;

    // Rodapé
    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(100, 116, 139);
    doc.text(`Meio de Liquidação: ${tx.paymentMethod === 'BOLETO' ? 'Faturamento B2B' : tx.paymentMethod}`, 40, currentY, { align: 'center' });
    currentY += 3.5;

    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(15, 23, 42);
    
    const hashOriginal = tx.hashAuditoria || tx.id.toUpperCase();
    const hashText = `AUT AUTENTICAÇÃO: ${hashOriginal}`;
    const splitHash = doc.splitTextToSize(hashText, 66);
    doc.text(splitHash, 40, currentY, { align: 'center' });
    currentY += (splitHash.length * 4) + 2;

    doc.setFont('Helvetica', 'italic');
    doc.setFontSize(6);
    doc.setTextColor(148, 163, 184);
    doc.text(`Segunda via reemitida em ${new Date().toLocaleString('pt-BR')}`, 40, currentY, { align: 'center' });

    const pdfUrl = doc.output('bloburl');
    
    // Cria um iframe invisível para abrir a janela de impressão nativa do sistema
    const iframe = document.createElement('iframe');
    iframe.style.display = 'none';
    iframe.src = pdfUrl.toString();
    document.body.appendChild(iframe);
    
    iframe.onload = () => {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
      // Remove o iframe do DOM depois de um tempo curto
      setTimeout(() => {
        document.body.removeChild(iframe);
      }, 5000);
    };
    
    addToastLocal('Sucesso', 'Segunda via de auditoria enviada para impressão!');
  };

  // Advanced temporal select filters for BI Master (Hoje, Ontem, Últimos 7 Dias, Mês Atual e Período Personalizado)
  const [activeDateFilter, setActiveDateFilter] = useState<'HOJE' | 'ONTEM' | '7DIAS' | 'MES' | 'CUSTOM'>('HOJE');
  
  const getTodayDateString = () => {
    const d = new Date();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${d.getFullYear()}-${month}-${day}`;
  };
  
  const [customStartDate, setCustomStartDate] = useState<string>(() => {
    const d = new Date();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${d.getFullYear()}-${month}-${day}`;
  });
  const [customEndDate, setCustomEndDate] = useState<string>(() => {
    const d = new Date();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${d.getFullYear()}-${month}-${day}`;
  });
  const [dismissedDivergences, setDismissedDivergences] = useState<string[]>([]);

  // Master dispatcher management states
  const [showAddClientForm, setShowAddClientForm] = useState(false);
  const [clientFormName, setClientFormName] = useState('');
  const [clientFormCpfCnpj, setClientFormCpfCnpj] = useState('');
  const [clientFormPhone, setClientFormPhone] = useState('');
  const [clientFormCategory, setClientFormCategory] = useState<'Despachante Credenciado' | 'Revenda de carros'>('Despachante Credenciado');

  const [editingClientId, setEditingClientId] = useState<string | null>(null);
  const [editFormName, setEditFormName] = useState('');
  const [editFormPhone, setEditFormPhone] = useState('');
  const [editFormStatus, setEditFormStatus] = useState<'Ativo' | 'Inativo'>('Ativo');
  const [editFormBalance, setEditFormBalance] = useState('0.00');

  // Master operator management states
  const [operatorUsers, setOperatorUsers] = useState<OperatorUser[]>([]);

  useEffect(() => {
    const fetchOperators = async () => {
      try {
        const { data, error } = await supabase
          .from('usuarios')
          .select('*')
          .order('nome');
        if (error) throw error;
        if (data) {
          setOperatorUsers(data.map((u: any) => ({
            id: u.id,
            name: u.nome,
            email: u.email,
            role: u.funcao,
            status: u.status,
            createdAt: u.criado_em || u.createdAt
          })));
        }
      } catch (err) {
        console.error('Erro ao buscar operadores:', err);
      }
    };

    fetchOperators();
  }, []);

  // Efeito para carregar Relatório de Emolumentos
  useEffect(() => {
    const fetchEmolumentos = async () => {
      // 1. Calcula o mês atual a partir de transactions (D+0 a D-30 no mesmo mês)
      const now = new Date();
      const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      
      const grouped = transactions.reduce((acc: any, tx) => {
        if (tx.status === 'CANCELLED' || (tx as any).status_conciliacao === 'CANCELLED') return acc;
        
        // Verifica se é do mês atual
        const txDate = new Date(tx.timestamp || (tx as any).criado_em);
        const txMonth = `${txDate.getFullYear()}-${String(txDate.getMonth() + 1).padStart(2, '0')}`;
        
        if (txMonth === currentMonth) {
          tx.items?.forEach((item: any) => {
            if (!acc[item.name]) acc[item.name] = { name: item.name, qty: 0, total: 0 };
            acc[item.name].qty += item.quantity || 1;
            acc[item.name].total += parseFloat(item.subtotal || item.customValue || '0');
          });
        }
        return acc;
      }, {});
      
      const arr = Object.values(grouped).sort((a: any, b: any) => b.total - a.total);
      setEmolumentosMesAtual(arr);

      // 2. Busca histórico do Supabase
      try {
        const { data, error } = await supabase
          .from('historico_emolumentos_mensal')
          .select('*')
          .order('mes_referencia', { ascending: false });
          
        if (!error && data) {
          setHistoricoEmolumentos(data);
        }
      } catch (e) {
        console.error('Erro ao buscar historico de emolumentos:', e);
      }
    };
    
    fetchEmolumentos();
  }, [transactions]);

  const handleSalvarCompetenciaMensal = async () => {
    const now = new Date();
    const mesRef = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    
    // Check se já existe
    if (historicoEmolumentos.some(h => h.mes_referencia === mesRef)) {
      addToastLocal('Aviso', `A competência de ${mesRef} já está registrada no histórico!`);
      return;
    }
    
    const totalMes = emolumentosMesAtual.reduce((sum, item) => sum + item.total, 0);
    
    setIsSavingEmolumentos(true);
    try {
      const { error } = await supabase
        .from('historico_emolumentos_mensal')
        .insert({
          mes_referencia: mesRef,
          total_emolumentos: totalMes,
          dados_consolidados: emolumentosMesAtual,
          fechado_por: rlsSession?.email || 'Sistema'
        });
        
      if (error) throw error;
      
      addToastLocal('Sucesso', `Competência de ${mesRef} salva com sucesso!`);
      
      // Refresh
      const { data } = await supabase
        .from('historico_emolumentos_mensal')
        .select('*')
        .order('mes_referencia', { ascending: false });
      if (data) setHistoricoEmolumentos(data);
      
    } catch (e: any) {
      console.error('Erro ao salvar competência:', e);
      addToastLocal('Erro', 'Falha ao salvar a competência (A tabela foi criada no Supabase?)');
    } finally {
      setIsSavingEmolumentos(false);
    }
  };
  const [showAddUserForm, setShowAddUserForm] = useState(false);
  const [userFormName, setUserFormName] = useState('');
  const [userFormEmail, setUserFormEmail] = useState('');
  const [userFormRole, setUserFormRole] = useState<'Master' | 'Gerente' | 'Financeiro' | 'Operador'>('Operador');
  const [editUserFormId, setEditUserFormId] = useState<string | null>(null);
  const [editUserFormName, setEditUserFormName] = useState('');
  const [editUserFormRole, setEditUserFormRole] = useState<'Master' | 'Gerente' | 'Financeiro' | 'Operador'>('Operador');
  const [editUserFormStatus, setEditUserFormStatus] = useState<'Ativo' | 'Inativo'>('Ativo');

  // Success Modal for newly created operator login details
  const [createdUserModal, setCreatedUserModal] = useState<{ name: string, email: string, passwordTemp: string } | null>(null);

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

  // 1. Dynamic range filter function for BI Master Realtime
  const getBiFilteredTransactions = (): Transaction[] => {
    const isMasterOrAdmin = ['Master', 'Gerente', 'Financeiro'].includes(rlsSession?.userRole || '');
    if (caixaState?.status === 'fechado' && !isMasterOrAdmin) return [];

    // Obter IDs dos turnos ativos (com status "Aberto") a partir do controle_turnos (historicalClosings)
    const activeTurnos = (historicalClosings || [])
      .filter((c: any) => c.status === 'Aberto' || c.status_turno === 'Aberto');

    const activeTurnoIds = activeTurnos.map((c: any) => c.id);

    // Se todos os turnos estiverem fechados ou bloqueados, zera todas as transações operacionais na tela do Master
    if (activeTurnos.length === 0) {
      return [];
    }
    
    return transactions.filter(tx => {
      if (!tx) return false;
      if (tx.status === 'CANCELLED') return false;

      // Cruzamento estrito de dados por turno_id ativo
      let isMatched = false;
      if (tx.turno_id) {
        isMatched = activeTurnoIds.includes(tx.turno_id);
      } else {
        // Fallback para dados legados de teste que não possuem turno_id
        const opEmail = (tx.operadorEmail || '').toLowerCase();
        const hasClosedTurno = (historicalClosings || []).some((h: any) => 
          (h.status === 'Fechado' || h.status === 'CONCILIADO' || h.status_turno === 'CONCILIADO') &&
          (h.usuario_master || h.operador_email || '').toLowerCase() === opEmail
        );

        if (!hasClosedTurno) {
          isMatched = activeTurnos.some((t: any) => 
            normalizeOperationalDate(t.dataOperacional || t.data_operacional) === normalizeOperationalDate(tx.timestamp) &&
            (t.terminalId === tx.terminalId || t.terminal_id === tx.terminalId) &&
            (t.usuarioMaster === tx.operadorEmail || t.operador_email === tx.operadorEmail)
          );
        }
      }

      if (!isMatched) {
        return false;
      }

      const txDateObj = new Date(tx.timestamp);
      if (isNaN(txDateObj.getTime())) return false;
      
      // Setup relative date references matching our current operational date
      const now = new Date();
      
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
      const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
      
      const yesterdayStart = new Date(todayStart);
      yesterdayStart.setDate(yesterdayStart.getDate() - 1);
      const yesterdayEnd = new Date(todayStart);
      yesterdayEnd.setMilliseconds(-1);

      const sevenDaysAgoStart = new Date(todayStart);
      sevenDaysAgoStart.setDate(sevenDaysAgoStart.getDate() - 6);

      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);

      if (activeDateFilter === 'HOJE') {
        return txDateObj >= todayStart && txDateObj <= todayEnd;
      } else if (activeDateFilter === 'ONTEM') {
        return txDateObj >= yesterdayStart && txDateObj <= yesterdayEnd;
      } else if (activeDateFilter === '7DIAS') {
        return txDateObj >= sevenDaysAgoStart && txDateObj <= todayEnd;
      } else if (activeDateFilter === 'MES') {
        return txDateObj >= monthStart && txDateObj <= todayEnd;
      } else if (activeDateFilter === 'CUSTOM') {
        if (!customStartDate || !customEndDate) return true;
        const sDate = new Date(customStartDate + 'T00:00:00.000Z');
        const eDate = new Date(customEndDate + 'T23:59:59.999Z');
        return txDateObj >= sDate && txDateObj <= eDate;
      }
      return true;
    });
  };

  const biFilteredTx = getBiFilteredTransactions();

  // KPI calculados síncronamente via useMemo compartilhando a mesma fonte de dados realtime (transactions)
  const biKpis = React.useMemo(() => {
    let conv = '0.00';
    if (clients) {
      clients.forEach(c => {
        if (c.category !== 'Particular') {
          conv = DecimalMath.add(conv, parseFloat(c.outstandingBalance || '0').toFixed(2));
        }
      });
    }

    // Obter IDs dos turnos ativos (com status "Aberto") a partir do controle_turnos (historicalClosings)
    const activeTurnoIds = (historicalClosings || [])
      .filter((c: any) => c.status === 'Aberto')
      .map((c: any) => c.id);

    // Se todos os turnos estiverem fechados ou bloqueados, força todos os KPIs a zerarem, exceto convênio B2B
    if (activeTurnoIds.length === 0) {
      return {
        faturamentoDia: '0.00',
        dinheiro: '0.00',
        pix: '0.00',
        cartoes: '0.00',
        conveniosAberto: conv,
        sangrias: '0.00'
      };
    }

    let sang = '0.00';
    if (historicalClosings) {
      historicalClosings.forEach((c: any) => {
        const closingDateIso = parseOperationalDate(c.dataOperacional);
        let matchDate = false;
        const now = new Date();
        const todayStr = now.toLocaleDateString('pt-BR');
        
        const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
        const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
        const yesterdayStart = new Date(todayStart);
        yesterdayStart.setDate(yesterdayStart.getDate() - 1);
        const yesterdayEnd = new Date(todayStart);
        yesterdayEnd.setMilliseconds(-1);
        const sevenDaysAgoStart = new Date(todayStart);
        sevenDaysAgoStart.setDate(sevenDaysAgoStart.getDate() - 6);
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);

        if (activeDateFilter === 'HOJE') {
          matchDate = c.dataOperacional === todayStr;
        } else if (activeDateFilter === 'ONTEM') {
          const yesterday = new Date();
          yesterday.setDate(yesterday.getDate() - 1);
          matchDate = c.dataOperacional === yesterday.toLocaleDateString('pt-BR');
        } else if (activeDateFilter === '7DIAS') {
          const limitIso = `${sevenDaysAgoStart.getFullYear()}-${String(sevenDaysAgoStart.getMonth() + 1).padStart(2, '0')}-${String(sevenDaysAgoStart.getDate()).padStart(2, '0')}`;
          matchDate = closingDateIso >= limitIso;
        } else if (activeDateFilter === 'MES') {
          const limitIso = `${monthStart.getFullYear()}-${String(monthStart.getMonth() + 1).padStart(2, '0')}-01`;
          matchDate = closingDateIso >= limitIso;
        } else if (activeDateFilter === 'CUSTOM') {
          if (customStartDate && customEndDate) {
            matchDate = closingDateIso >= customStartDate && closingDateIso <= customEndDate;
          } else {
            matchDate = true;
          }
        }

        // Além de bater a data, o turno correspondente na lista deve estar aberto (status === 'Aberto')
        if (matchDate && c.status === 'Aberto') {
          sang = DecimalMath.add(sang, parseFloat(c.retiradas || '0').toFixed(2));
        }
      });
    }

    const isTodayRange = activeDateFilter === 'HOJE' || 
      (activeDateFilter === 'CUSTOM' && 
       customStartDate <= new Date().toISOString().split('T')[0] && 
       customEndDate >= new Date().toISOString().split('T')[0]);

    if (isTodayRange && caixaState && caixaState.status === 'aberto' && caixaState.sangrias) {
      caixaState.sangrias.forEach((s: any) => {
        sang = DecimalMath.add(sang, parseFloat(s.value || '0').toFixed(2));
      });
    }

    // Calcular volumes a partir das transações filtradas da aba BI (biFilteredTx)
    let pixVolumeCents = 0;
    let cashVolumeCents = 0;
    let creditVolumeCents = 0;
    let debitVolumeCents = 0;
    let cardVolumeCents = 0; // combined
    let faturadosVolumeCents = 0;
    let overallCents = 0;

    biFilteredTx.forEach(tx => {
      if (tx.status !== 'CANCELLED') {
        const amt = DecimalMath.toCents(tx.netTotal ?? '0');
        overallCents += amt;
        const pm = (tx.paymentMethod as string || '').trim().toUpperCase();
        if (pm === 'PIX') pixVolumeCents += amt;
        else if (pm === 'CASH' || pm === 'DINHEIRO') cashVolumeCents += amt;
        else if (pm === 'CREDIT_CARD' || pm === 'CREDITO' || pm === 'CRÉDITO' || pm === 'CARD') { creditVolumeCents += amt; cardVolumeCents += amt; }
        else if (pm === 'DEBIT_CARD' || pm === 'DEBITO' || pm === 'DÉBITO') { debitVolumeCents += amt; cardVolumeCents += amt; }
        else if (pm === 'BOLETO') faturadosVolumeCents += amt;
      }
    });

    const isMasterOrAdmin = ['Master', 'Gerente', 'Financeiro'].includes(rlsSession?.userRole || '');
    return {
      faturamentoDia: (isMasterOrAdmin && faturamentoDiaMaster !== undefined) ? faturamentoDiaMaster : DecimalMath.fromCents(overallCents),
      dinheiro: DecimalMath.fromCents(cashVolumeCents),
      pix: DecimalMath.fromCents(pixVolumeCents),
      cartoes: DecimalMath.fromCents(cardVolumeCents),
      conveniosAberto: conv,
      sangrias: sang
    };
  }, [biFilteredTx, clients, historicalClosings, caixaState, activeDateFilter, customStartDate, customEndDate, faturamentoDiaMaster, rlsSession, transactions]);

  const convenioAbertoTotal = React.useMemo(() => {
    let conv = '0.00';
    if (clients) {
      clients.forEach(c => {
        if (c.category !== 'Particular') {
          conv = DecimalMath.add(conv, parseFloat(c.outstandingBalance || '0').toFixed(2));
        }
      });
    }
    return conv;
  }, [clients]);

  // Filters
  const [filterPayment, setFilterPayment] = useState<string>('ALL');
  const [filterStatus, setFilterStatus] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Selected Transaction for receipt view
  const [viewTxDetail, setViewTxDetail] = useState<Transaction | null>(null);

  // Compute metrics dynamically from memory based on PostgreSQL numeric standard (via DecimalMath)
  const computeMetrics = (): CashFlowMetrics => {
    let totalIn = '0.00';
    let totalPend = '0.00';
    let totalDetran = '0.00';
    let totalHon = '0.00';

    const activeTx = transactions;

    activeTx.forEach(tx => {
      if (tx.status === 'PAID') {
        totalIn = DecimalMath.add(totalIn, tx.netTotal);
        totalDetran = DecimalMath.add(totalDetran, tx.detranSubtotal);
        totalHon = DecimalMath.add(totalHon, tx.honorariosSubtotal);
      } else if (tx.status === 'PENDING') {
        totalPend = DecimalMath.add(totalPend, tx.netTotal);
      }
    });

    const count = activeTx.length;
    const avg = count > 0 ? DecimalMath.fromCents(Math.round(DecimalMath.toCents(totalIn) / count)) : '0.00';

    return {
      totalInflow: totalIn,
      totalPending: totalPend,
      totalDetranFees: totalDetran,
      totalHonorarios: totalHon,
      operatingBalance: DecimalMath.sub(totalIn, totalDetran), // True profit/revenue margin
      transactionCount: count,
      averageTicket: avg
    };
  };

  const metrics = computeMetrics();

  // Helper calculations for RF003 physical cash auditing
  const getPhysicalCashTotal = () => {
    let physicalCashPaid = '0.00';
    transactions.forEach(tx => {
      if (tx.paymentMethod === 'CASH' && tx.status === 'PAID') {
        physicalCashPaid = DecimalMath.add(physicalCashPaid, tx.netTotal);
      }
    });
    
    const initialFundo = caixaState?.fundoTroco || '0.00';
    const totalGaveta = DecimalMath.add(initialFundo, physicalCashPaid);
    
    return {
      initialFundo,
      physicalCashPaid,
      totalGaveta
    };
  };

  const getBoletoFaturamentoTotal = () => {
    let totalBoleto = '0.00';
    transactions.forEach(tx => {
      if (tx.paymentMethod === 'BOLETO' && tx.status !== 'CANCELLED') {
        totalBoleto = DecimalMath.add(totalBoleto, tx.netTotal);
      }
    });
    return totalBoleto;
  };

  const cashAudit = getPhysicalCashTotal();
  const boletoTotal = getBoletoFaturamentoTotal();

  // Filter logic
  const filteredLedger = transactions.filter(tx => {
    const matchesPayment = filterPayment === 'ALL' || tx.paymentMethod === filterPayment;
    const matchesStatus = filterStatus === 'ALL' || tx.status === filterStatus;
    const matchesSearch = 
      tx.clientName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      tx.clientCpfCnpj.includes(searchQuery) ||
      tx.sequenceId.toLowerCase().includes(searchQuery.toLowerCase()) ||
      tx.createdBy.userName.toLowerCase().includes(searchQuery.toLowerCase());
    
    return matchesPayment && matchesStatus && matchesSearch;
  });

  // Export spreadsheet mock action
  const handleExportMock = () => {
    addToastLocal('Relatório Disponível', 'Download do relatório fiscal autorizado.');
  };

  // Percent for visual charts
  const getSubtotalsDistribution = () => {
    const totalCents = DecimalMath.toCents(metrics.totalInflow);
    if (totalCents === 0) return { detran: 50, honorario: 0, other: 50 };
    
    const detranCents = DecimalMath.toCents(metrics.totalDetranFees);
    const detranPercent = Math.round((detranCents / totalCents) * 100);
    
    return {
      detran: detranPercent,
      honorario: 0,
      other: Math.max(0, 100 - detranPercent)
    };
  };

  const dist = getSubtotalsDistribution();

  // Processamento de dados para BI Master Realtime (RF005)
  const rankedClientsWithBalance = [...clients]
    .filter(c => (c.outstandingBalance && parseFloat(c.outstandingBalance) > 0) || c.category === 'Despachante Credenciado')
    .sort((a, b) => parseFloat(b.outstandingBalance || '0') - parseFloat(a.outstandingBalance || '0'))
    .slice(0, 5); // top 5



  // Volumes por meio de pagamento baseados no filtro temporal ativo
  let pixVolumeCents = 0;
  let cashVolumeCents = 0;
  let creditVolumeCents = 0;
  let debitVolumeCents = 0;
  let cardVolumeCents = 0; // combined
  let faturadosVolumeCents = 0;
  let overallCents = 0;

  biFilteredTx.forEach(tx => {
    if (tx.status !== 'CANCELLED') {
      const amt = DecimalMath.toCents(tx.netTotal ?? '0');
      overallCents += amt;
      const pm = (tx.paymentMethod as string || '').trim().toUpperCase();
      if (pm === 'PIX') pixVolumeCents += amt;
      else if (pm === 'CASH' || pm === 'DINHEIRO') cashVolumeCents += amt;
      else if (pm === 'CREDIT_CARD' || pm === 'CREDITO' || pm === 'CRÉDITO' || pm === 'CARD') { creditVolumeCents += amt; cardVolumeCents += amt; }
      else if (pm === 'DEBIT_CARD' || pm === 'DEBITO' || pm === 'DÉBITO') { debitVolumeCents += amt; cardVolumeCents += amt; }
      else if (pm === 'BOLETO') faturadosVolumeCents += amt;
    }
  });

  const getPercent = (cents: number) => {
    if (overallCents === 0) return 0;
    return Math.round((cents / overallCents) * 100);
  };

  const pixP = getPercent(pixVolumeCents);



  // Find any active/undismissed discrepancy alerts
  const activeAlerts = historicalClosings.filter(
    (c: any) => 
      c.status !== 'Conciliado' && 
      parseFloat(c.divergencia) !== 0 &&
      !dismissedDivergences.includes(`${c.dataOperacional}-${c.horarioFechamento}-${c.usuarioMaster}`)
  );

  const getHourlyActivity = () => {
    const buckets = [
      { label: '08h-10h', count: 0, total: '0.00' },
      { label: '10h-12h', count: 0, total: '0.00' },
      { label: '12h-14h', count: 0, total: '0.00' },
      { label: '14h-16h', count: 0, total: '0.00' },
      { label: '16h-18h', count: 0, total: '0.00' }
    ];

    biFilteredTx.forEach(tx => {
      if (tx.status !== 'CANCELLED') {
        const date = new Date(tx.timestamp);
        const hour = date.getHours();
        const amt = tx.netTotal;
        if (hour >= 8 && hour < 10) { buckets[0].count++; buckets[0].total = DecimalMath.add(buckets[0].total, amt); }
        else if (hour >= 10 && hour < 12) { buckets[1].count++; buckets[1].total = DecimalMath.add(buckets[1].total, amt); }
        else if (hour >= 12 && hour < 14) { buckets[2].count++; buckets[2].total = DecimalMath.add(buckets[2].total, amt); }
        else if (hour >= 14 && hour < 16) { buckets[3].count++; buckets[3].total = DecimalMath.add(buckets[3].total, amt); }
        else if (hour >= 16 && hour < 18) { buckets[4].count++; buckets[4].total = DecimalMath.add(buckets[4].total, amt); }
      }
    });

    return buckets;
  };

  const hourlyData = getHourlyActivity();

  const biParticularRevenue = biFilteredTx
    .filter(tx => tx.status !== 'CANCELLED' && (tx.clientCategory === 'Particular' || tx.clientCategory === 'Particular (Consumidor)' || tx.clientCategory === 'particular-temp' || !tx.clientCategory))
    .reduce((sum, tx) => DecimalMath.add(sum, tx.netTotal), '0.00');

  const biB2bRevenue = biFilteredTx
    .filter(tx => tx.status !== 'CANCELLED' && tx.clientCategory !== 'Particular' && tx.clientCategory !== 'Particular (Consumidor)' && tx.clientCategory !== 'particular-temp' && tx.clientCategory)
    .reduce((sum, tx) => DecimalMath.add(sum, tx.netTotal), '0.00');

  const biParticularCount = biFilteredTx
    .filter(tx => tx.status !== 'CANCELLED' && (tx.clientCategory === 'Particular' || tx.clientCategory === 'Particular (Consumidor)' || tx.clientCategory === 'particular-temp' || !tx.clientCategory))
    .length;

  const biB2bCount = biFilteredTx
    .filter(tx => tx.status !== 'CANCELLED' && tx.clientCategory !== 'Particular' && tx.clientCategory !== 'Particular (Consumidor)' && tx.clientCategory !== 'particular-temp' && tx.clientCategory)
    .length;



  const filteredClosings = historicalClosings.filter((c: any) => {
    if (histStartDate || histEndDate) {
      const closingDateIso = parseOperationalDate(c.dataOperacional);
      if (histStartDate && closingDateIso < histStartDate) return false;
      if (histEndDate && closingDateIso > histEndDate) return false;
    }
    if (filterOperatorEmail !== 'ALL' && c.usuarioMaster !== filterOperatorEmail) {
      return false;
    }
    if (filterTerminalId !== 'ALL' && c.terminalId !== filterTerminalId) {
      return false;
    }
    return true;
  });

  const uniqueOperators = Array.from(new Set(historicalClosings.map((c: any) => c.usuarioMaster))) as string[];
  const uniqueTerminals = Array.from(new Set(historicalClosings.map((c: any) => c.terminalId))) as string[];

  return (
    <div className="space-y-6">

      {/* Sub-Tabs Selector inside Dashboard */}
      {!isMobile && (
        <div className="flex border-b border-brand-navy-bright gap-4 pb-px">
          <button
            onClick={() => setSubTab('CONTABIL')}
            className={`pb-2.5 px-1 text-xs font-bold uppercase tracking-wider relative transition-all cursor-pointer ${
              subTab === 'CONTABIL' 
                ? 'text-brand-emerald border-b-2 border-brand-emerald' 
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            🗃️ Conciliação & Livro Caixa
          </button>
          <button
            onClick={() => setSubTab('BI_MASTER')}
            className={`pb-2.5 px-1 text-xs font-bold uppercase tracking-wider relative transition-all cursor-pointer flex items-center gap-1.5 ${
              subTab === 'BI_MASTER' 
                ? 'text-brand-emerald border-b-2 border-brand-emerald' 
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <TrendingUp className="w-4 h-4 text-brand-emerald animate-pulse" />
            📊 BI Analítico Master (Tempo Real)
          </button>
          <button
            onClick={() => setSubTab('HISTORICO_ATAS')}
            className={`pb-2.5 px-1 text-xs font-bold uppercase tracking-wider relative transition-all cursor-pointer flex items-center gap-1.5 ${
              subTab === 'HISTORICO_ATAS' 
                ? 'text-brand-emerald border-b-2 border-brand-emerald' 
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Clock className="w-4 h-4 text-brand-emerald" />
            🧾 Histórico e Atas de Caixa
          </button>
        </div>
      )}

      {subTab === 'CONTABIL' ? (
        <>
          {/* REESTRUTURAÇÃO COMPLETA SOB ESTÉTICA DARK FINTECH - DE ACORDO COM REQUISITOS DO USUÁRIO */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 my-6">
            
            {/* ========================================================== */}
            {/* Bloco 1: CONTAS CORRENTES DE DESPACHANTES (B2B)            */}
            {/* ========================================================== */}
            <div className="bg-brand-navy-card border border-brand-navy-bright rounded-2xl p-5 shadow-lg flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-brand-navy-bright border border-slate-700/60 text-slate-400 font-semibold tracking-wider">
                      Gestão Contábil de Convênios CODESP
                    </span>
                    <h4 className="font-display font-semibold text-base text-slate-100 mt-2 tracking-tight">
                      Contas Correntes de Despachantes
                    </h4>
                  </div>
                  <div className="p-1.5 rounded bg-brand-emerald/10 text-brand-emerald">
                    <Users className="w-5 h-5" />
                  </div>
                </div>
                
                <p className="text-xs text-slate-400 mb-4 font-sans leading-relaxed">
                  Contas correntes de empresas parceiras credenciadas no B2B com faturamento a prazo. Acompanhe os saldos acumulados e limite de riscos operacionais.
                </p>

                {/* Listagem de Empresas Parceiras */}
                <div className="divide-y divide-brand-navy-bright/60">
                  {clients.filter(c => c.category !== 'Particular').map(client => {
                    const activeBalance = client.outstandingBalance || '0.00';
                    const isEditing = editingClientId === client.id;

                    if (isEditing) {
                      return (
                        <div key={client.id} className="py-4 space-y-3 bg-brand-navy-deep/60 rounded-xl p-3 my-2 border border-brand-emerald/30">
                          <div className="flex justify-between items-center pb-1 border-b border-brand-navy-bright/45">
                            <span className="text-[9px] font-mono font-bold text-brand-emerald uppercase">Ajustar Despachante Parceiro</span>
                            <button
                              type="button"
                              onClick={() => setEditingClientId(null)}
                              className="text-[10px] font-mono font-bold text-slate-400 hover:text-slate-200 uppercase cursor-pointer"
                            >
                              [Fechar]
                            </button>
                          </div>
                          
                          <div className="grid grid-cols-2 gap-2 text-xs">
                            <div className="space-y-1">
                              <label className="text-[9px] font-mono text-slate-400 uppercase font-sans">Razão Social</label>
                              <input
                                type="text"
                                value={editFormName}
                                onChange={(e) => setEditFormName(e.target.value)}
                                className="w-full bg-brand-navy-card border border-brand-navy-bright rounded px-2 py-1 text-slate-100 font-sans focus:outline-none focus:border-brand-emerald"
                              />
                            </div>
                            <div className="space-y-1">
                              <label className="text-[9px] font-mono text-slate-400 uppercase font-sans">Telefone</label>
                              <input
                                type="text"
                                value={editFormPhone}
                                onChange={(e) => setEditFormPhone(e.target.value)}
                                className="w-full bg-brand-navy-card border border-brand-navy-bright rounded px-2 py-1 text-slate-100 font-mono focus:outline-none focus:border-brand-emerald"
                              />
                            </div>
                            <div className="space-y-1">
                              <label className="text-[9px] font-mono text-slate-400 uppercase font-sans">Status</label>
                              <select
                                value={editFormStatus}
                                onChange={(e) => setEditFormStatus(e.target.value as any)}
                                className="w-full bg-brand-navy-card border border-brand-navy-bright rounded px-2 py-1 text-slate-100 font-sans focus:outline-none focus:border-brand-emerald"
                              >
                                <option value="Ativo">Ativo</option>
                                <option value="Inativo">Inativo</option>
                              </select>
                            </div>
                            <div className="space-y-1">
                              <label className="text-[9px] font-mono text-slate-400 uppercase font-sans">Saldo Devedor (R$)</label>
                              <input
                                type="text"
                                value={editFormBalance}
                                onChange={(e) => setEditFormBalance(e.target.value.replace(/[^0-9.]/g, ''))}
                                className="w-full bg-brand-navy-card border border-brand-navy-bright rounded px-2 py-1 text-slate-100 font-mono focus:outline-none focus:border-brand-emerald"
                              />
                            </div>
                          </div>

                          <div className="flex justify-end gap-2 pt-1">
                            <button
                              type="button"
                              onClick={async () => {
                                const parsedVal = parseFloat(editFormBalance);
                                if (isNaN(parsedVal) || parsedVal < 0) {
                                  addToastLocal('Erro', 'Informe um saldo devedor válido!');
                                  return;
                                }
                                try {
                                  const { error } = await supabase
                                    .from('despachantes')
                                    .update({
                                      razao_social: editFormName.trim(),
                                      telefone: editFormPhone.trim(),
                                      saldo_devedor: parsedVal
                                    })
                                    .eq('id', client.id);
                                  if (error) throw error;

                                  setClients?.(prev => prev.map(c => c.id === client.id ? {
                                    ...c,
                                    name: editFormName.trim(),
                                    phone: editFormPhone.trim(),
                                    status: editFormStatus,
                                    outstandingBalance: parsedVal.toFixed(2)
                                  } : c));
                                  setEditingClientId(null);
                                  addToastLocal('Sucesso', 'Cadastro de parceiro atualizado.');
                                } catch (err: any) {
                                  addToastLocal('Erro', `Falha ao salvar no banco: ${err.message || err}`);
                                }
                              }}
                              className="px-3 py-1 bg-brand-emerald text-brand-navy-deep font-bold rounded text-xs hover:bg-emerald-400 cursor-pointer"
                            >
                              Salvar Alterações
                            </button>
                          </div>
                        </div>
                      );
                    }

                    return (
                      <div key={client.id} className="py-3 flex items-center justify-between gap-4">
                        <div className="space-y-1">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-sm font-semibold text-slate-100 leading-tight">{client.name}</span>
                            <span className={`text-[9px] font-bold font-mono px-1.5 py-0.5 rounded ${client.status === 'Ativo' ? 'bg-brand-emerald/10 text-brand-emerald border border-brand-emerald/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'}`}>
                              {client.status}
                            </span>
                          </div>
                          
                          <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-slate-400 font-mono">
                            <span className="text-slate-500 font-sans">CNPJ:</span> <span className="font-semibold text-slate-300">{client.cpfCnpj}</span>
                            {client.phone && (
                              <>
                                <span className="text-slate-600 font-sans">| Tel:</span> <span className="text-slate-300">{client.phone}</span>
                              </>
                            )}
                          </div>

                          {/* Controles para MASTER/GERENCIAL */}
                          {hasCrudAccess && (
                            <div className="flex items-center gap-2 mt-1">
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingClientId(client.id);
                                  setEditFormName(client.name);
                                  setEditFormPhone(client.phone || '');
                                  setEditFormStatus(client.status || 'Ativo');
                                  setEditFormBalance(client.outstandingBalance || '0.00');
                                }}
                                className="text-[9px] uppercase font-mono px-2 py-0.5 rounded bg-brand-navy-deep border border-brand-navy-bright text-slate-350 hover:text-brand-emerald hover:border-brand-emerald/40 transition-colors cursor-pointer"
                              >
                                Editar
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setConfirmModal({
                                    isOpen: true,
                                    title: 'Excluir Despachante',
                                    message: `Deseja realmente excluir o credenciamento do despachante "${client.name}"?`,
                                    confirmText: 'Excluir',
                                    cancelText: 'Cancelar',
                                    type: 'danger',
                                    onConfirm: async () => {
                                      try {
                                        const { error } = await supabase
                                          .from('despachantes')
                                          .delete()
                                          .eq('id', client.id);
                                        if (error) throw error;
                                        setClients?.(prev => prev.filter(c => c.id !== client.id));
                                        addToastLocal('Sucesso', 'Removido com sucesso.');
                                      } catch (err: any) {
                                        addToastLocal('Erro', `Falha ao remover do banco: ${err.message || err}`);
                                      }
                                    }
                                  });
                                }}
                                className="text-[9px] uppercase font-mono px-2 py-0.5 rounded bg-brand-navy-deep border border-brand-navy-bright text-red-400 hover:text-red-300 hover:border-red-500/40 transition-colors cursor-pointer"
                              >
                                Excluir
                              </button>
                            </div>
                          )}
                        </div>

                        <div className="text-right flex-shrink-0">
                          <span className="block text-[8px] uppercase font-mono text-slate-400 font-bold tracking-wider mb-0.5">Saldo Devedor</span>
                          <span className={`text-sm font-mono font-bold ${parseFloat(activeBalance) > 0 ? 'text-amber-500 font-extrabold' : 'text-slate-400'}`}>
                            {DecimalMath.formatBRL(activeBalance)}
                          </span>
                        </div>
                      </div>
                    );
                  })}

                  {clients.filter(c => c.category !== 'Particular').length === 0 && (
                    <p className="text-center text-xs text-slate-500 py-6 font-mono">
                      Nenhum despachante parceiro credenciado registrado no sistema.
                    </p>
                  )}
                </div>
              </div>

              {/* Botão de cadastro e formulário correspondente */}
              {hasCrudAccess && (
                <div className="mt-4 pt-4 border-t border-brand-navy-bright/60">
                  {!showAddClientForm ? (
                    <button
                      type="button"
                      onClick={() => setShowAddClientForm(true)}
                      className="w-full py-2 bg-brand-navy-deep hover:bg-brand-navy-bright border border-brand-emerald/30 text-brand-emerald hover:text-emerald-400 font-bold rounded-xl text-[11px] uppercase font-mono tracking-wider flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                    >
                      [+] Cadastrar Novo Despachante Parceiro
                    </button>
                  ) : (
                    <div className="p-3 border border-brand-emerald/30 bg-brand-navy-deep/80 rounded-xl space-y-3 animate-fade-in text-xs">
                      <div className="flex justify-between items-center pb-1 border-b border-brand-navy-bright/40">
                        <span className="font-mono font-bold text-brand-emerald uppercase text-[9px]">Abertura de Credenciamento B2B</span>
                        <button
                          type="button"
                          onClick={() => setShowAddClientForm(false)}
                          className="text-[9px] uppercase font-mono text-slate-450 hover:text-slate-200 cursor-pointer"
                        >
                          [Cancelar]
                        </button>
                      </div>

                      <div className="space-y-2">
                        <div className="space-y-1">
                          <label className="text-[9px] font-mono text-slate-400 uppercase">Razão Social / Nome Fantasia</label>
                          <input
                            placeholder="Ex: Primula Despachos e Assessoria"
                            value={clientFormName}
                            onChange={(e) => setClientFormName(e.target.value)}
                            className="w-full bg-brand-navy-card border border-brand-navy-bright rounded px-3 py-1.5 text-slate-100 font-sans focus:outline-none focus:border-brand-emerald"
                          />
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                          <div className="space-y-1">
                            <label className="text-[9px] font-mono text-slate-400 uppercase">CNPJ Parceiro</label>
                            <input
                              placeholder="Ex: 11.222.333/0001-44"
                              value={clientFormCpfCnpj}
                              onChange={(e) => setClientFormCpfCnpj(e.target.value)}
                              className="w-full bg-brand-navy-card border border-brand-navy-bright rounded px-2.5 py-1.5 text-slate-100 font-mono focus:outline-none focus:border-brand-emerald"
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-[9px] font-mono text-slate-400 uppercase">Telefone de Contato</label>
                            <input
                              placeholder="Ex: (51) 99122-3838"
                              value={clientFormPhone}
                              onChange={(e) => setClientFormPhone(e.target.value)}
                              className="w-full bg-brand-navy-card border border-brand-navy-bright rounded px-2.5 py-1.5 text-slate-100 font-mono focus:outline-none focus:border-brand-emerald"
                            />
                          </div>
                        </div>

                        <div className="space-y-1">
                          <label className="text-[9px] font-mono text-slate-400 uppercase block">Categoria de Atendimento</label>
                          <select
                            value={clientFormCategory}
                            onChange={(e) => setClientFormCategory(e.target.value as any)}
                            className="w-full bg-brand-navy-card border border-brand-navy-bright rounded px-2 py-1.5 text-slate-100 font-sans focus:outline-none focus:border-brand-emerald cursor-pointer"
                          >
                            <option value="Despachante Credenciado">Despachante Credenciado</option>
                            <option value="Revenda de carros">Revenda de carros (B2B)</option>
                          </select>
                        </div>
                      </div>

                      <div className="flex justify-end gap-2 pt-1">
                        <button
                          type="button"
                          onClick={async () => {
                            if (!clientFormName.trim() || !clientFormCpfCnpj.trim()) {
                              addToastLocal('Erro', 'Nome e CNPJ são obrigatórios!');
                              return;
                            }
                            try {
                              if (onRegisterDespachante) {
                                const result = await onRegisterDespachante(
                                  clientFormName.trim(),
                                  clientFormCpfCnpj.trim(),
                                  clientFormPhone.trim()
                                );
                                if (result) {
                                  setClientFormName('');
                                  setClientFormCpfCnpj('');
                                  setClientFormPhone('');
                                  setShowAddClientForm(false);
                                }
                              } else {
                                const newClt: ClientProfile = {
                                  id: `clt-${Date.now()}`,
                                  name: clientFormName.trim(),
                                  cpfCnpj: clientFormCpfCnpj.trim(),
                                  phone: clientFormPhone.trim(),
                                  category: clientFormCategory,
                                  status: 'Ativo',
                                  outstandingBalance: '0.00'
                                };
                                const { error } = await supabase
                                  .from('despachantes')
                                  .insert([{
                                    razao_social: newClt.name,
                                    cnpj: newClt.cpfCnpj,
                                    telefone: newClt.phone,
                                    saldo_devedor: parseFloat(newClt.outstandingBalance || '0')
                                  }]);
                                if (error) throw error;
                                setClients?.(prev => [newClt, ...prev]);
                                addToastLocal('Sucesso', 'Novo parceiro credenciado com sucesso!');
                                setClientFormName('');
                                setClientFormCpfCnpj('');
                                setClientFormPhone('');
                                setShowAddClientForm(false);
                              }
                            } catch (err: any) {
                              addToastLocal('Erro', `Falha ao cadastrar: ${err.message || err}`);
                            }
                          }}
                          className="px-4 py-1.5 bg-brand-emerald text-brand-navy-deep font-bold rounded text-xs hover:bg-emerald-400 cursor-pointer"
                        >
                          Gravar Despachante B2B
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* ========================================================== */}
            {/* Bloco 2: GESTÃO DE ACESSOS & OPERADORES                     */}
            {/* ========================================================== */}
            <div className="bg-brand-navy-card border border-brand-navy-bright rounded-2xl p-5 shadow-lg flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-brand-navy-bright border border-slate-700/60 text-slate-400 font-semibold tracking-wider">
                      Painel Administrativo de Usuários
                    </span>
                    <h4 className="font-display font-semibold text-base text-slate-100 mt-2 tracking-tight">
                      Gestão de Acessos & Operadores
                    </h4>
                  </div>
                  <div className="p-1.5 rounded bg-brand-emerald/10 text-brand-emerald">
                    <Lock className="w-5 h-5" />
                  </div>
                </div>

                <p className="text-xs text-slate-400 mb-4 font-sans leading-relaxed">
                  Gerenciamento da equipe operacional e níveis de restrição no terminal. Controle quem pode liberar sangrias, registrar repasses ou assinar atas diárias.
                </p>

                {/* Edit Form de Usuário Operador Inline */}
                {editUserFormId && (
                  <div className="p-3 border border-brand-emerald/30 bg-brand-navy-deep/70 rounded-xl space-y-3 mb-4 animate-fade-in text-xs">
                    <div className="flex justify-between items-center pb-1 border-b border-brand-navy-bright/40">
                      <span className="font-mono font-bold text-brand-emerald uppercase text-[9px]">Ajustar Usuário Ativo</span>
                      <button
                        type="button"
                        onClick={() => setEditUserFormId(null)}
                        className="text-[9px] uppercase font-mono text-slate-450 cursor-pointer"
                      >
                        [Fechar]
                      </button>
                    </div>

                    <div className="space-y-2">
                      <div className="space-y-1">
                        <label className="text-[9px] font-mono text-slate-400 uppercase">Nome Completo</label>
                        <input
                          type="text"
                          value={editUserFormName}
                          onChange={(e) => setEditUserFormName(e.target.value)}
                          className="w-full bg-brand-navy-card border border-brand-navy-bright rounded px-2.5 py-1 text-slate-100 font-sans focus:outline-none focus:border-brand-emerald"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-1">
                          <label className="text-[9px] font-mono text-slate-400 uppercase block">Função / Nível</label>
                          <select
                            value={editUserFormRole}
                            onChange={(e) => {
                              const val = e.target.value as any;
                              if (rlsSession.userRole === 'Financeiro' && val !== 'Operador') {
                                addToastLocal('Erro', 'O Financeiro pode gerenciar unicamente Operadores.');
                                return;
                              }
                              setEditUserFormRole(val);
                            }}
                            className="w-full bg-brand-navy-card border border-brand-navy-bright rounded px-2 py-1 text-slate-100 focus:outline-none"
                          >
                            <option value="Operador">Operador (Atendimento)</option>
                            {(rlsSession.userRole === 'Master' || rlsSession.userRole === 'Gerente') && (
                              <>
                                <option value="Financeiro">Financeiro</option>
                                <option value="Gerente">Gerente</option>
                              </>
                            )}
                          </select>
                        </div>
                        <div className="space-y-1">
                          <label className="text-[9px] font-mono text-slate-400 uppercase block">Status</label>
                          <select
                            value={editUserFormStatus}
                            onChange={(e) => setEditUserFormStatus(e.target.value as any)}
                            className="w-full bg-brand-navy-card border border-brand-navy-bright rounded px-2 py-1 text-slate-100 focus:outline-none"
                          >
                            <option value="Ativo">Ativo</option>
                            <option value="Inativo">Inativo</option>
                          </select>
                        </div>
                      </div>
                    </div>

                    <div className="flex justify-end gap-2 pt-1">
                      <button
                        type="button"
                        onClick={async () => {
                          if (!editUserFormName.trim()) {
                            addToastLocal('Erro', 'Nome não pode ser vazio!');
                            return;
                          }
                          const targetUser = operatorUsers.find(u => u.id === editUserFormId);
                          if (targetUser) {
                            if (targetUser.role === 'Master' || targetUser.email === 'fsobrosa.12tc@gmail.com') {
                              addToastLocal('Erro', 'O Administrador Master é indivisível, vitalício e imutável.');
                              return;
                            }
                            if (rlsSession.userRole === 'Financeiro' && (targetUser.role !== 'Operador' || editUserFormRole !== 'Operador')) {
                              addToastLocal('Erro', 'O Financeiro pode cadastrar e gerenciar unicamente perfis de Operador.');
                              return;
                            }
                            if (rlsSession.userRole === 'Gerente' && editUserFormRole === 'Master') {
                              addToastLocal('Erro', 'O Gerente está bloqueado de interagir com contas Master.');
                              return;
                            }

                            try {
                              const { error } = await supabase
                                .from('usuarios')
                                .update({
                                  nome: editUserFormName.trim(),
                                  funcao: editUserFormRole,
                                  status: editUserFormStatus
                                })
                                .eq('id', editUserFormId);

                              if (error) throw error;

                              setOperatorUsers(prev => prev.map(u => u.id === editUserFormId ? {
                                ...u,
                                name: editUserFormName.trim(),
                                role: editUserFormRole,
                                status: editUserFormStatus
                              } : u));

                              setEditUserFormId(null);
                              addToastLocal('Sucesso', 'Permissões do usuário gravadas no banco de dados!');
                            } catch (err: any) {
                              addToastLocal('Erro', `Erro ao atualizar usuário: ${err.message || err}`);
                            }
                          }
                        }}
                        className="px-3 py-1 bg-brand-emerald text-brand-navy-deep font-bold rounded text-xs hover:bg-emerald-400"
                      >
                        Gravar Alterações
                      </button>
                    </div>
                  </div>
                )}

                {/* Listagem de Operadores e Colaboradores */}
                <div className="divide-y divide-brand-navy-bright/60">
                  {operatorUsers.map(user => {
                    // Badge Styling
                    let roleBadgeColor = 'bg-brand-emerald/15 text-brand-emerald border-brand-emerald/25';
                    if (user.role === 'Master') roleBadgeColor = 'bg-rose-500/15 text-rose-400 border-rose-500/25';
                    if (user.role === 'Gerente') roleBadgeColor = 'bg-amber-500/15 text-amber-400 border-amber-500/25';
                    if (user.role === 'Financeiro') roleBadgeColor = 'bg-indigo-500/15 text-indigo-400 border-indigo-500/25';

                    return (
                      <div key={user.id} className="py-2.5 flex items-center justify-between gap-4">
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-semibold text-slate-100 leading-tight">{user.name}</span>
                            <span className={`text-[8.5px] font-mono uppercase px-1.5 py-0.5 rounded border font-bold ${roleBadgeColor}`}>
                              {user.role}
                            </span>
                          </div>

                          <div className="flex flex-wrap items-center gap-x-2 text-[11px] font-mono text-slate-400">
                            <span className="text-slate-500 font-sans">E-mail:</span>
                            <span className="text-slate-200">{user.email}</span>
                            <span className="text-slate-600">|</span>
                            <span className={`text-[10px] font-bold ${user.status === 'Ativo' ? 'text-brand-emerald' : 'text-slate-500'}`}>
                              ● {user.status}
                            </span>
                          </div>

                          {/* Controles Administrativos */}
                          {hasCrudAccess && !editUserFormId && user.role !== 'Master' && user.email !== 'fsobrosa.12tc@gmail.com' && (
                            <div className="flex items-center gap-2 mt-1">
                              <button
                                type="button"
                                onClick={() => {
                                  if (user.role === 'Master' || user.email === 'fsobrosa.12tc@gmail.com') {
                                    addToastLocal('Erro de Segurança', 'O Administrador Master é indivisível, vitalício e imutável.');
                                    return;
                                  }
                                  if (rlsSession.userRole === 'Financeiro' && user.role !== 'Operador') {
                                    addToastLocal('Erro de Segurança', 'O Financeiro pode cadastrar, editar e excluir UNICAMENTE perfis de Operador.');
                                    return;
                                  }
                                  if (rlsSession.userRole === 'Gerente' && user.role === 'Master') {
                                    addToastLocal('Erro de Segurança', 'Gerentes estão terminantemente bloqueados de interagir com contas Master.');
                                    return;
                                  }
                                  setEditUserFormId(user.id);
                                  setEditUserFormName(user.name);
                                  setEditUserFormRole(user.role);
                                  setEditUserFormStatus(user.status);
                                }}
                                className="text-[9px] uppercase font-mono px-2 py-0.5 rounded bg-brand-navy-deep border border-brand-navy-bright text-slate-350 hover:text-brand-emerald hover:border-brand-emerald/40 transition-colors cursor-pointer"
                              >
                                Alterar Nível & Conta
                              </button>

                              {canResetPassword(user.role) && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setConfirmModal({
                                      isOpen: true,
                                      title: 'Redefinir Senha',
                                      message: `Deseja realmente gerar uma nova senha de segurança definitiva para "${user.name}"?`,
                                      confirmText: 'Confirmar',
                                      cancelText: 'Cancelar',
                                      type: 'warning',
                                      onConfirm: () => {
                                        handleResetUserPassword(user);
                                      }
                                    });
                                  }}
                                  className="text-[9px] uppercase font-mono px-2 py-0.5 rounded bg-brand-navy-deep border border-brand-navy-bright text-brand-emerald hover:text-emerald-450 hover:border-brand-emerald/45 transition-colors cursor-pointer"
                                >
                                  Redefinir Senha
                                </button>
                              )}

                              <button
                                type="button"
                                onClick={() => {
                                  if (user.role === 'Master' || user.email === 'fsobrosa.12tc@gmail.com') {
                                    addToastLocal('Erro de Segurança', 'O Administrador Master é indivisível, vitalício e imutável.');
                                    return;
                                  }
                                  if (rlsSession.userRole === 'Financeiro' && user.role !== 'Operador') {
                                    addToastLocal('Erro de Segurança', 'O Financeiro pode cadastrar, editar e excluir UNICAMENTE perfis de Operador.');
                                    return;
                                  }
                                  if (rlsSession.userRole === 'Gerente' && user.role === 'Master') {
                                    addToastLocal('Erro de Segurança', 'Gerentes estão terminantemente bloqueados de interagir com contas Master.');
                                    return;
                                  }
                                  
                                  setConfirmModal({
                                    isOpen: true,
                                    title: 'Revogar Acesso',
                                    message: `Deseja realmente inativar/remover o acesso de "${user.name}"?`,
                                    confirmText: 'Inativar',
                                    cancelText: 'Cancelar',
                                    type: 'danger',
                                    onConfirm: async () => {
                                      try {
                                        const { error } = await supabase
                                          .from('usuarios')
                                          .delete()
                                          .eq('id', user.id);

                                        if (error) throw error;

                                        setOperatorUsers(prev => prev.filter(u => u.id !== user.id));
                                        addToastLocal('Sucesso', 'Acesso revogado no banco de dados.');
                                      } catch (err: any) {
                                        addToastLocal('Erro', `Erro ao revogar acesso: ${err.message || err}`);
                                      }
                                    }
                                  });
                                }}
                                className="text-[9px] uppercase font-mono px-2 py-0.5 rounded bg-brand-navy-deep border border-brand-navy-bright text-red-400 hover:text-red-300 hover:border-red-500/40 transition-colors cursor-pointer"
                              >
                                Revogar
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Botão de cadastro de novo operador focado em segurança de senhas */}
              {hasCrudAccess && (
                <div className="mt-4 pt-4 border-t border-brand-navy-bright/60">
                  {!showAddUserForm ? (
                    <button
                      type="button"
                      onClick={() => setShowAddUserForm(true)}
                      className="w-full py-2 bg-brand-navy-deep hover:bg-brand-navy-bright border border-brand-emerald/30 text-brand-emerald hover:text-emerald-400 font-bold rounded-xl text-[11px] uppercase font-mono tracking-wider flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                    >
                      [+] Cadastrar Novo Usuário/Operador
                    </button>
                  ) : (
                    <div className="p-3 border border-brand-emerald/30 bg-brand-navy-deep/80 rounded-xl space-y-3 animate-fade-in text-xs">
                      <div className="flex justify-between items-center pb-1 border-b border-brand-navy-bright/40">
                        <span className="font-mono font-bold text-brand-emerald uppercase text-[9px]">Inserir Credencial de Segurança</span>
                        <button
                          type="button"
                          onClick={() => setShowAddUserForm(false)}
                          className="text-[9px] uppercase font-mono text-slate-450 hover:text-slate-200 cursor-pointer"
                        >
                          [Cancelar]
                        </button>
                      </div>

                      <div className="space-y-2">
                        <div className="space-y-1">
                          <label className="text-[9px] font-mono text-slate-400 uppercase">Nome do Usuário</label>
                          <input
                            placeholder="Ex: Amanda Santos da Silva"
                            value={userFormName}
                            onChange={(e) => setUserFormName(e.target.value)}
                            className="w-full bg-brand-navy-card border border-brand-navy-bright rounded px-3 py-1.5 text-slate-100 font-sans focus:outline-none focus:border-brand-emerald"
                          />
                        </div>

                        <div className="space-y-1">
                          <label className="text-[9px] font-mono text-slate-400 uppercase">E-mail Corporativo</label>
                          <input
                            type="email"
                            placeholder="Ex: amanda.caixa@marks.com.br"
                            value={userFormEmail}
                            onChange={(e) => setUserFormEmail(e.target.value)}
                            className="w-full bg-brand-navy-card border border-brand-navy-bright rounded px-3 py-1.5 text-slate-100 font-mono focus:outline-none focus:border-brand-emerald"
                          />
                        </div>

                        <div className="space-y-1">
                          <label className="text-[9px] font-mono text-slate-400 uppercase block">Hierarquia / Nível de Acesso</label>
                          <select
                            value={userFormRole}
                            onChange={(e) => {
                              const selectedVal = e.target.value as any;
                              if (rlsSession.userRole === 'Financeiro' && selectedVal !== 'Operador') {
                                addToastLocal('Erro', 'O Financeiro pode cadastrar unicamente perfis de Operador.');
                                return;
                              }
                              setUserFormRole(selectedVal);
                            }}
                            className="w-full bg-brand-navy-card border border-brand-navy-bright rounded px-2 py-1.5 text-slate-100 font-sans focus:outline-none focus:border-brand-emerald cursor-pointer"
                          >
                            <option value="Operador">Operador (Abertura/Fechamento diário)</option>
                            {(rlsSession.userRole === 'Master' || rlsSession.userRole === 'Gerente') && (
                              <>
                                <option value="Financeiro">Financeiro (Auditoria e Conciliações)</option>
                                <option value="Gerente">Gerente (Cancelamentos, Paridade, Sangria)</option>
                              </>
                            )}
                          </select>
                        </div>

                        <div className="p-2 py-1.5 bg-brand-navy-deep border border-brand-navy-bright rounded text-[10px] text-slate-400 font-mono leading-tight flex items-start gap-1.5">
                          <span className="text-brand-emerald">🔒</span>
                          <span>
                            <strong>LÓGICA DE SENHA SEGURA:</strong> O campo de senha não é digitado manualmente. O sistema de criptografia Marks gera automaticamente uma credencial forte de primeiro acesso de 8 dígitos alfanuméricos únicos.
                          </span>
                        </div>
                      </div>

                      <div className="flex justify-end gap-2 pt-1">
                        <button
                          type="button"
                          onClick={async () => {
                            if (!userFormName.trim() || !userFormEmail.trim()) {
                              addToastLocal('Erro', 'Nome do usuário e E-mail são obrigatórios.');
                              return;
                            }
                            if (!userFormEmail.includes('@') || !userFormEmail.includes('.')) {
                              addToastLocal('Erro', 'Digite um e-mail com formato válido!');
                              return;
                            }

                            if (userFormEmail.trim().toLowerCase() === 'fsobrosa.12tc@gmail.com') {
                              addToastLocal('Erro', 'O e-mail do Administrador Master é reservado.');
                              return;
                            }

                            // Hierarchy checks
                            if (userFormRole === 'Master') {
                              addToastLocal('Erro', 'Não é permitido criar um usuário Master.');
                              return;
                            }
                            if (rlsSession.userRole === 'Financeiro' && userFormRole !== 'Operador') {
                              addToastLocal('Erro', 'Perímetro Negado: O Financeiro pode cadastrar somente Operadores.');
                              return;
                            }
                            if (rlsSession.userRole === 'Gerente' && userFormRole === 'Master') {
                              addToastLocal('Erro', 'Perímetro Negado: Gerente não pode cadastrar Master.');
                              return;
                            }

                            const passwordTemp = generatePasswordExact8();

                            try {
                              if (onRegisterUser) {
                                const result = await onRegisterUser(
                                  userFormName.trim(),
                                  userFormEmail.trim().toLowerCase(),
                                  userFormRole
                                );
                                if (result) {
                                  const mappedUser: OperatorUser = {
                                    id: result.id,
                                    name: result.name,
                                    email: result.email,
                                    role: result.role,
                                    status: result.status,
                                    createdAt: result.createdAt
                                  };
                                  setOperatorUsers(prev => [mappedUser, ...prev]);
                                  setCreatedUserModal({
                                    name: mappedUser.name,
                                    email: mappedUser.email,
                                    passwordTemp: result.passwordTemp
                                  });
                                  setUserFormName('');
                                  setUserFormEmail('');
                                  setUserFormRole('Operador');
                                  setShowAddUserForm(false);
                                }
                              } else {
                                const newUserData = {
                                  nome: userFormName.trim(),
                                  email: userFormEmail.trim().toLowerCase(),
                                  senha_provisoria: passwordTemp,
                                  funcao: userFormRole,
                                  status: 'Ativo',
                                  criado_em: new Date().toISOString()
                                };

                                const { data, error } = await supabase
                                  .from('usuarios')
                                  .insert([newUserData])
                                  .select()
                                  .single();

                                if (error) throw error;

                                if (data) {
                                  const mappedUser: OperatorUser = {
                                    id: data.id,
                                    name: data.nome,
                                    email: data.email,
                                    role: data.funcao,
                                    status: data.status,
                                    createdAt: data.criado_em
                                  };
                                  setOperatorUsers(prev => [mappedUser, ...prev]);
                                  
                                  setCreatedUserModal({
                                    name: mappedUser.name,
                                    email: mappedUser.email,
                                    passwordTemp
                                  });
                                }

                                // Reset
                                setUserFormName('');
                                setUserFormEmail('');
                                setUserFormRole('Operador');
                                setShowAddUserForm(false);
                                addToastLocal('Sucesso', 'Operador cadastrado com sucesso!');
                              }
                            } catch (err: any) {
                              addToastLocal('Erro', `Falha ao cadastrar: ${err.message || err}`);
                            }
                          }}
                          className="px-4 py-1.5 bg-brand-emerald text-brand-navy-deep font-bold rounded text-xs hover:bg-emerald-400 cursor-pointer"
                        >
                          Confirmar e Gravar Usuário
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

          </div>

          {/* SUCESS MODAL POPUP PARA SALVAR CREDENCIAIS D+0 DE OPERADORES - RENDERIZAÇÃO ABSOLUTA COM BLUR */}
          {createdUserModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-fade-in">
              <div style={{ borderRadius: '16px' }} className="bg-brand-navy-card border-2 border-brand-emerald rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-5 animate-scale-up text-slate-100">
                <div className="flex items-center gap-3 border-b border-brand-navy-bright pb-3">
                  <div className="p-2 rounded bg-brand-emerald/10 text-brand-emerald">
                    <Lock className="w-6 h-6 animate-pulse" />
                  </div>
                  <div>
                    <h3 className="font-display font-bold text-base text-slate-100 uppercase tracking-tight">
                      Usuário Criado com Sucesso!
                    </h3>
                    <p className="text-[10px] text-brand-emerald uppercase font-mono tracking-wider">
                      Credenciais de Acesso Definitivo
                    </p>
                  </div>
                </div>

                <div className="bg-blue-900/10 border border-blue-500/20 text-slate-300 text-xs p-3.5 rounded-xl space-y-1 font-sans">
                  <p className="font-semibold text-brand-emerald uppercase font-mono text-[9px]">⚠️ Atenção / Regras Críticas:</p>
                  <p>Salve as credenciais de acesso definitivo (A senha só será exibida nesta tela por motivos de segurança).</p>
                </div>

                <div className="space-y-3">
                  {/* Email */}
                  <div className="space-y-1 bg-brand-navy-deep p-3 rounded-xl border border-brand-navy-bright/60 relative">
                    <span className="text-[9px] uppercase font-mono text-slate-400 font-semibold block">E-mail de Login</span>
                    <div className="flex items-center justify-between mt-1 gap-2">
                      <span className="font-mono text-xs text-slate-100 font-bold select-all truncate">{createdUserModal.email}</span>
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(createdUserModal.email);
                          addToastLocal('Sucesso', 'E-mail de acesso copiado!');
                        }}
                        className="flex-shrink-0 px-2.5 py-1 text-[9px] font-mono font-bold uppercase bg-brand-navy-bright hover:bg-slate-700 text-brand-emerald rounded transition-all cursor-pointer"
                      >
                        Copiar
                      </button>
                    </div>
                  </div>

                  {/* Senha */}
                  <div className="space-y-1 bg-brand-navy-deep p-3 rounded-xl border border-brand-navy-bright/60 relative">
                    <span className="text-[9px] uppercase font-mono text-amber-500 font-semibold block">Senha Definitiva Gerada</span>
                    <div className="flex items-center justify-between mt-1 gap-2">
                      <span className="font-mono text-sm text-amber-400 font-bold bg-amber-500/5 px-2 py-0.5 rounded border border-amber-500/15 tracking-wide select-all">
                        {createdUserModal.passwordTemp}
                      </span>
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(createdUserModal.passwordTemp);
                          addToastLocal('Sucesso', 'Senha definitiva copiada!');
                        }}
                        className="flex-shrink-0 px-2.5 py-1 text-[9px] font-mono font-bold uppercase bg-brand-navy-bright hover:bg-slate-700 text-amber-500 rounded transition-all cursor-pointer"
                      >
                        Copiar
                      </button>
                    </div>
                  </div>
                </div>

                <div className="bg-brand-navy-deep p-3 rounded-xl border border-brand-navy-bright/60 text-[10px] text-slate-400 font-mono leading-relaxed">
                  💡 <span className="font-semibold text-slate-200">Regra de Autenticação:</span> O fluxo de login no sistema é realizado estritamente informando o E-mail de cadastro acompanhado da Senha correspondente.
                </div>

                <div className="pt-2 border-t border-brand-navy-bright/60">
                  <button
                    onClick={() => setCreatedUserModal(null)}
                    className="w-full py-2.5 bg-brand-emerald text-brand-navy-deep font-sans font-extrabold text-xs uppercase tracking-wider rounded-xl hover:bg-emerald-400 transition-colors cursor-pointer"
                  >
                    [✓] Copiei as Credenciais e Fechar
                  </button>
                </div>
              </div>
            </div>
          )}
        

      {/* 3. RELATÓRIO DE EMOLUMENTOS MENSAL (FORCE VISIBLE FOR MASTERS) */}
      {hasCrudAccess && (
        <div className="bg-brand-navy-card border border-brand-navy-bright rounded-2xl shadow-lg p-5 mb-6 animate-fade-in">
          <div className="flex justify-between items-center mb-4">
            <div>
              <h3 className="font-display font-semibold text-sm text-slate-200 uppercase tracking-wider flex items-center gap-2">
                <FileText className="w-4.5 h-4.5 text-brand-emerald" />
                Relatório de Emolumentos
              </h3>
              <p className="text-[11px] text-slate-400">Consolidado de serviços do mês selecionado</p>
            </div>
            <div className="flex gap-2 items-center">
              <select
                value={selectedMesReferencia}
                onChange={(e) => setSelectedMesReferencia(e.target.value)}
                className="bg-brand-navy-deep border border-brand-navy-bright rounded-lg px-3 py-1.5 text-xs text-slate-200 font-sans focus:outline-none focus:border-brand-emerald cursor-pointer"
              >
                <option value="ATUAL">Mês Atual (Tempo Real)</option>
                {historicoEmolumentos.map(h => (
                  <option key={h.id || h.mes_referencia} value={h.mes_referencia}>{h.mes_referencia} (Fechado)</option>
                ))}
              </select>
              {selectedMesReferencia === 'ATUAL' && (
                <button
                  onClick={handleSalvarCompetenciaMensal}
                  disabled={isSavingEmolumentos || emolumentosMesAtual.length === 0}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-brand-emerald hover:bg-emerald-400 text-brand-navy-deep font-bold font-sans text-xs rounded-lg transition-colors cursor-pointer disabled:opacity-50"
                >
                  <Lock className="w-3.5 h-3.5" />
                  {isSavingEmolumentos ? 'Salvando...' : 'Fechar Competência'}
                </button>
              )}
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead>
                <tr className="border-b border-brand-navy-bright text-slate-400 uppercase font-sans tracking-wide text-[10px] bg-brand-navy-deep/40">
                  <th className="py-2.5 px-4 font-bold">Serviço / Identificação</th>
                  <th className="py-2.5 px-4 text-center font-bold">Qtd no Mês</th>
                  <th className="py-2.5 px-4 text-right font-bold">Faturamento (Emolumentos)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-brand-navy-bright/40 font-mono">
                {(selectedMesReferencia === 'ATUAL' 
                  ? emolumentosMesAtual 
                  : (historicoEmolumentos.find(h => h.mes_referencia === selectedMesReferencia)?.dados_consolidados || [])
                ).map((item: any, idx: number) => (
                  <tr key={idx} className="hover:bg-brand-navy-deep/20 text-slate-300">
                    <td className="py-2 px-4 font-sans font-medium text-slate-200">{item.name}</td>
                    <td className="py-2 px-4 text-center text-slate-400">{item.qty} un</td>
                    <td className="py-2 px-4 text-right font-bold text-brand-emerald">{DecimalMath.formatBRL(item.total || item.total_emolumentos)}</td>
                  </tr>
                ))}
                {(selectedMesReferencia === 'ATUAL' ? emolumentosMesAtual : (historicoEmolumentos.find(h => h.mes_referencia === selectedMesReferencia)?.dados_consolidados || [])).length === 0 && (
                  <tr>
                    <td colSpan={3} className="text-center py-6 text-slate-500 font-sans">Nenhum emolumento registrado neste período.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          {selectedMesReferencia !== 'ATUAL' && (
            <div className="mt-3 flex justify-between items-center text-[10px] font-mono text-slate-500">
              <span>Total de Emolumentos: <strong className="text-brand-emerald">{DecimalMath.formatBRL(historicoEmolumentos.find(h => h.mes_referencia === selectedMesReferencia)?.total_emolumentos || 0)}</strong></span>
              <span>Fechado por: {historicoEmolumentos.find(h => h.mes_referencia === selectedMesReferencia)?.fechado_por || 'Sistema'}</span>
            </div>
          )}
        </div>
      )}

      {/* CORE TRANSACTION LEDGER (HISTÓRICO REALTIME) */}
      <div className="bg-brand-navy-card border border-brand-navy-bright rounded-2xl shadow-lg overflow-hidden">
        
        {/* Table header commands */}
        <div className="p-5 border-b border-brand-navy-bright flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h3 className="font-display font-semibold text-sm text-slate-200 uppercase tracking-wider flex items-center gap-2">
              <Activity className="w-4.5 h-4.5 text-brand-emerald" />
              Livro Razão de Caixa & Repasses (Realtime Ledger)
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">Listagem unificada de todas as taxas recolhidas e serviços.</p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Search inputs */}
            <div className="relative w-full sm:w-48">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
              <input
                id="ledger-search"
                type="text"
                placeholder="Pesquisar lançamento..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-brand-navy-deep border border-brand-navy-bright rounded-lg pl-8 pr-3 py-1.5 text-xs text-slate-200 placeholder-slate-400 focus:outline-none"
              />
            </div>

            {/* Payment Method Filter */}
            <select
              id="filter-payment-select"
              value={filterPayment}
              onChange={(e) => setFilterPayment(e.target.value)}
              className="bg-brand-navy-deep border border-brand-navy-bright rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none"
              title="Filtrar por meio de pagamento"
            >
              <option value="ALL">Todo Pagamentos</option>
              <option value="PIX">Pix</option>
              <option value="CREDIT_CARD">Cartão Crédito</option>
              <option value="BOLETO">Boleto</option>
              <option value="CASH">Dinheiro</option>
            </select>

            {/* Status Selector */}
            <select
              id="filter-status-select"
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="bg-brand-navy-deep border border-brand-navy-bright rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none"
              title="Filtrar por Status"
            >
              <option value="ALL">Qualquer Status</option>
              <option value="PAID">Liquidado (Pago)</option>
              <option value="PENDING">Aberto (Pendente)</option>
              <option value="CANCELLED">Cancelado / Estornado</option>
            </select>

            {/* Export data */}
            <button
              onClick={handleExportMock}
              className="p-1.5 bg-brand-navy-bright hover:bg-slate-700 text-slate-300 rounded-lg border border-slate-700/60 font-medium text-xs flex items-center gap-1.5 transition-all"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-brand-emerald" />
              Exportar
            </button>
          </div>
        </div>

        {/* Ledger Table */}
        <div className="overflow-x-auto">
          {filteredLedger.length > 0 ? (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-brand-navy-deep/40 text-slate-400 text-[11px] font-mono uppercase tracking-wider border-b border-brand-navy-bright/80">
                  <th className="py-3 px-5">ID / Emissão</th>
                  <th className="py-3 px-5">Cliente Beneficiário</th>
                  <th className="py-3 px-5">Subtotal de Serviços</th>
                  <th className="py-3 px-5">ISSQN (2%)</th>
                  <th className="py-3 px-5">VALOR LÍQUIDO</th>
                  <th className="py-3 px-5">Canal</th>
                  <th className="py-3 px-5">Status</th>
                  <th className="py-3 px-5 text-right">Controles</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-brand-navy-bright/50 text-slate-300 text-xs">
                {filteredLedger.map((tx) => {
                  const isPaid = tx.status === 'PAID';
                  const isPending = tx.status === 'PENDING';
                  const isCancelled = tx.status === 'CANCELLED';

                  return (
                    <tr key={tx.id} className="hover:bg-brand-navy-bright/20 transition-all font-mono">
                      
                      {/* ID / Sequencer */}
                      <td className="py-3.5 px-5">
                        <span className="font-bold text-slate-100 block">{tx.sequenceId}</span>
                        <span className="text-[10px] text-slate-500">{new Date(tx.timestamp).toLocaleString('pt-BR')}</span>
                      </td>

                      {/* Client */}
                      <td className="py-3.5 px-5 font-sans">
                        <span className="font-semibold text-slate-200 block truncate max-w-[200px]">{tx.clientName}</span>
                        <span className="text-[10px] text-slate-500 font-mono block mt-0.5">{tx.clientCpfCnpj}</span>
                      </td>

                      {/* Subtotal de Serviços */}
                      <td className="py-3.5 px-5 text-brand-emerald">
                        {DecimalMath.formatBRL(DecimalMath.add(tx.detranSubtotal, tx.otherSubtotal))}
                      </td>

                      {/* ISSQN (2%) */}
                      <td className="py-3.5 px-5 text-slate-450">
                        {tx.issqn && parseFloat(tx.issqn) > 0 ? DecimalMath.formatBRL(tx.issqn) : 'R$ 0,00'}
                      </td>

                      {/* Net Total */}
                      <td className="py-3.5 px-5 text-slate-100 font-bold text-sm">
                        {DecimalMath.formatBRL(tx.netTotal)}
                      </td>

                      {/* Payment Mode */}
                      <td className="py-3.5 px-5">
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-brand-navy-deep border border-slate-700/50">
                          {tx.paymentMethod}
                        </span>
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-5">
                        {isPaid && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-brand-emerald bg-brand-emerald/10 border border-brand-emerald/20 px-2 py-0.5 rounded-full">
                            <span className="w-1.5 h-1.5 rounded-full bg-brand-emerald" />
                            PAGO
                          </span>
                        )}
                        {isPending && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-500 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-full">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                            PENDENTE
                          </span>
                        )}
                        {isCancelled && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-brand-crimson bg-brand-crimson/10 border border-brand-crimson/20 px-2 py-0.5 rounded-full">
                            <span className="w-1.5 h-1.5 rounded-full bg-brand-crimson" />
                            REFUNDED
                          </span>
                        )}
                      </td>

                      {/* Quick Commands */}
                      <td className="py-3.5 px-5 text-right space-x-1.5">
                        <button
                          onClick={() => setViewTxDetail(tx)}
                          className="p-1 text-slate-400 hover:text-brand-emerald hover:bg-brand-navy-deep rounded transition"
                          title="Detalhar Lançamento"
                        >
                          <Eye className="w-4 h-4" />
                        </button>

                        <button
                          disabled={isCancelled}
                          onClick={() => {
                            if (window.confirm(`Deseja realmente estornar a transação ${tx.sequenceId}? Esta ação alterará os repasses.`)) {
                              onUnloadTransaction(tx.id);
                            }
                          }}
                          className={`p-1 rounded transition ${
                            isCancelled 
                              ? 'text-slate-600 cursor-not-allowed' 
                              : 'text-slate-400 hover:text-brand-crimson hover:bg-brand-navy-deep'
                          }`}
                          title={isCancelled ? 'Transação já cancelada.' : 'Estornar / Cancelar'}
                        >
                          <RotateCcw className="w-4 h-4" />
                        </button>
                      </td>

                    </tr>
                  );
                })}
              </tbody>
            </table>
          ) : (
            <div className="p-16 text-center text-slate-500 text-xs">
              Nenhuma transação correspondente aos filtros foi encontrada no Banco Postgres.
            </div>
          )}
        </div>

      </div>

      {/* DETAIL MODAL DRILL DOWN */}
      {viewTxDetail && (
        <div className="fixed inset-0 bg-brand-navy-deep/80 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-brand-navy-card border border-brand-navy-bright rounded-2xl max-w-lg w-full overflow-hidden shadow-2xl relative">
            
            <div className="bg-brand-navy-bright/60 p-4 border-b border-brand-navy-bright flex justify-between items-center">
              <div>
                <h4 className="font-display font-semibold text-sm text-slate-100">
                  Visualizador de Documentos (DQL Explode)
                </h4>
                <p className="text-[10px] font-mono text-slate-400 mt-1">Tenant ID: {viewTxDetail.id}</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleReimprimirCupom(viewTxDetail)}
                  className="text-xs bg-brand-emerald hover:bg-emerald-400 text-brand-navy-deep font-bold px-3 py-1.5 rounded flex items-center gap-1.5 transition cursor-pointer shadow-lg shadow-brand-emerald/10 hover:shadow-brand-emerald/20"
                >
                  <Printer className="w-3.5 h-3.5" />
                  Reimprimir Cupom
                </button>
                <button
                  onClick={() => setViewTxDetail(null)}
                  className="text-xs bg-brand-navy-deep px-2.5 py-1.5 text-slate-400 hover:text-slate-200 border border-brand-navy-bright/80 rounded cursor-pointer"
                >
                  Fechar
                </button>
              </div>
            </div>

            <div className="p-5 space-y-4">
              
              {/* Profile Block */}
              <div className="bg-brand-navy-deep border border-brand-navy-bright/80 p-3.5 rounded-xl text-xs space-y-1">
                <p className="text-[10px] uppercase font-mono text-slate-400">Dados do Cliente B2B</p>
                <p className="text-sm font-semibold text-slate-200">{viewTxDetail.clientName}</p>
                <p className="text-slate-400 font-mono">Documentação Fiscal: {viewTxDetail.clientCpfCnpj}</p>
                <p className="text-slate-400">Canal Executivo de Origem: {viewTxDetail.clientCategory}</p>
              </div>

              {/* Items Breakdown */}
              <div className="space-y-2">
                <span className="text-[10px] uppercase font-mono font-semibold text-slate-400 block pb-1 border-b border-brand-navy-bright/45">
                  Demonstrativo e Quotas do Guia
                </span>
                
                <div className="max-h-36 overflow-y-auto space-y-2.5 pr-1 font-mono text-xs">
                  {viewTxDetail.items.map((item, idx) => (
                    <div key={idx} className="flex justify-between items-start text-[11px] bg-brand-navy-deep/60 p-2 rounded">
                      <div>
                        <p className="text-slate-200 font-semibold">{item.quantity}x {item.serviceName}</p>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className="text-[9px] uppercase font-mono font-bold bg-slate-800 text-slate-400 px-1 rounded-sm">
                            {item.type === 'DETRAN' ? 'OPERACIONAL' : item.type}
                          </span>
                          {item.observation && (
                            <span className="text-[9px] italic text-slate-400">
                              (Obs: {item.observation})
                            </span>
                          )}
                        </div>
                      </div>
                      <span className="font-bold text-slate-100">{DecimalMath.formatBRL(item.subtotal)}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Security parameters */}
              <div className="p-3 bg-slate-900 border border-brand-navy-bright rounded-xl text-[11px] font-mono space-y-1">
                <p className="font-semibold text-brand-emerald">🔐 PARÂMETROS RLS COMPROVADOS:</p>
                <p className="text-slate-400">Atribuído ao Usuário: {viewTxDetail.createdBy.userName} ({viewTxDetail.createdBy.userRole})</p>
                <p className="text-slate-400">Autorização Auditoria: CONECTADO [POSTGRES_DQL_SESSION]</p>
                <p className="text-amber-500 font-bold truncate">Limitação SQL: {viewTxDetail.createdBy.rlsScope}</p>
              </div>

              {/* Cash Totals Summary */}
              <div className="pt-3 border-t border-brand-navy-bright flex justify-between items-end">
                <div>
                  <span className="text-[10px] uppercase font-mono font-bold text-slate-400">Pagamento:</span>
                  <span className="text-xs text-slate-200 block font-bold">{viewTxDetail.paymentMethod} {viewTxDetail.installments > 1 ? `(${viewTxDetail.installments}x)` : ''}</span>
                </div>
                <div className="text-right flex flex-col items-end gap-1">
                  {viewTxDetail.issqn && parseFloat(viewTxDetail.issqn) > 0 && (
                    <span className="text-[10px] text-slate-450 font-mono">
                      ISSQN (2%): {DecimalMath.formatBRL(viewTxDetail.issqn)}
                    </span>
                  )}
                  <span className="text-[10px] uppercase font-mono font-bold text-slate-400">VALOR TOTAL LÍQUIDO:</span>
                  <span className="text-lg font-mono font-bold text-brand-emerald block">
                    {DecimalMath.formatBRL(viewTxDetail.netTotal)}
                  </span>
                </div>
              </div>

            </div>

          </div>
        </div>
      )}

    </>
  ) : subTab === 'BI_MASTER' ? (
    /* ==================== CAMADA DE BI MASTER REALTIME (RF005) ==================== */
    <div className="space-y-6 animate-fade-in font-sans transition-all text-slate-100">
      
      {/* 1. SELETOR DE PERÍODO TEMPORAL AVANÇADO (FILTROS RAPIDOS + CUSTOM RANGE) */}
      <div className="bg-brand-navy-card border border-brand-navy-bright/60 p-4 rounded-xl flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 shadow-lg">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Calendar className="w-4.5 h-4.5 text-brand-emerald" />
            <span className="font-display font-bold text-sm text-slate-200">Filtros Temporais Avançados</span>
          </div>
          <p className="text-[11px] text-slate-400">Selecione o range temporal das transações para atualizar o Cockpit BI.</p>
        </div>
        
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setActiveDateFilter('HOJE')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold uppercase tracking-wider font-mono transition-all border cursor-pointer ${
              activeDateFilter === 'HOJE'
                ? 'bg-brand-emerald/15 text-brand-emerald border-brand-emerald/40 shadow-sm'
                : 'bg-brand-navy-deep text-slate-400 border-brand-navy-bright/40 hover:text-slate-200 hover:bg-brand-navy-bright/10'
            }`}
          >
            Hoje
          </button>
          <button
            onClick={() => setActiveDateFilter('ONTEM')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold uppercase tracking-wider font-mono transition-all border cursor-pointer ${
              activeDateFilter === 'ONTEM'
                ? 'bg-brand-emerald/15 text-brand-emerald border-brand-emerald/40 shadow-sm'
                : 'bg-brand-navy-deep text-slate-400 border-brand-navy-bright/40 hover:text-slate-200 hover:bg-brand-navy-bright/10'
            }`}
          >
            Ontem
          </button>
          <button
            onClick={() => setActiveDateFilter('7DIAS')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold uppercase tracking-wider font-mono transition-all border cursor-pointer ${
              activeDateFilter === '7DIAS'
                ? 'bg-brand-emerald/15 text-brand-emerald border-brand-emerald/40 shadow-sm'
                : 'bg-brand-navy-deep text-slate-400 border-brand-navy-bright/40 hover:text-slate-200 hover:bg-brand-navy-bright/10'
            }`}
          >
            Últimos 7 Dias
          </button>
          <button
            onClick={() => setActiveDateFilter('MES')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold uppercase tracking-wider font-mono transition-all border cursor-pointer ${
              activeDateFilter === 'MES'
                ? 'bg-brand-emerald/15 text-brand-emerald border-brand-emerald/40 shadow-sm'
                : 'bg-brand-navy-deep text-slate-400 border-brand-navy-bright/40 hover:text-slate-200 hover:bg-brand-navy-bright/10'
            }`}
          >
            Mês Atual
          </button>
          <button
            onClick={() => setActiveDateFilter('CUSTOM')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold uppercase tracking-wider font-mono transition-all border cursor-pointer ${
              activeDateFilter === 'CUSTOM'
                ? 'bg-brand-emerald/15 text-brand-emerald border-brand-emerald/40 shadow-sm'
                : 'bg-brand-navy-deep text-slate-400 border-brand-navy-bright/40 hover:text-slate-200 hover:bg-brand-navy-bright/10'
            }`}
          >
            Personalizado
          </button>

          {activeDateFilter === 'CUSTOM' && (
            <div className="flex items-center gap-2 animate-fade-in pl-2 border-l border-brand-navy-bright/40">
              <input
                type="date"
                value={customStartDate}
                onChange={(e) => setCustomStartDate(e.target.value)}
                className="bg-brand-navy-deep text-slate-200 border border-brand-navy-bright/50 px-2 py-1 rounded text-xs focus:outline-none focus:border-brand-emerald font-mono"
              />
              <span className="text-slate-500 font-mono text-xs">até</span>
              <input
                type="date"
                value={customEndDate}
                onChange={(e) => setCustomEndDate(e.target.value)}
                className="bg-brand-navy-deep text-slate-200 border border-brand-navy-bright/50 px-2 py-1 rounded text-xs focus:outline-none focus:border-brand-emerald font-mono"
              />
            </div>
          )}
        </div>
      </div>

      {/* 2. SENSOR LÓGICO: ALERTA DE QUEBRA DE CAIXA (DIVERGÊNCIAS DETECTADAS NAS CONFERÊNCIAS CEGAS) */}
      {activeAlerts.map((closing: any, idx: number) => {
        const uniqueKey = `${closing.dataOperacional}-${closing.horarioFechamento}-${closing.usuarioMaster}`;
        const valNum = parseFloat(closing.divergencia);
        const isQuebra = valNum < 0;
        const statusType = isQuebra ? 'Quebra de Caixa' : 'Sobra de Caixa';
        
        return (
          <div 
            key={uniqueKey} 
            className="p-4 bg-red-950/40 border border-red-500/30 rounded-2xl flex flex-col sm:flex-row sm:items-center sm:justify-between text-xs gap-3 animate-pulse shadow-md"
          >
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-red-500/15 text-red-400">
                <AlertTriangle className="w-5 h-5 animate-bounce" />
              </div>
              <div className="space-y-1">
                <h5 className="font-display font-extrabold text-red-400 uppercase tracking-wide text-[11px]">
                  Alerta Crítico de Conformidade Fiscal · {statusType}
                </h5>
                <p className="text-slate-350 font-sans leading-relaxed">
                  Atenção: Divergência de <strong className="font-mono text-red-400">{DecimalMath.formatBRL(closing.divergencia)}</strong> detectada no <strong className="text-slate-100">Caixa 01</strong> · Operador: <strong className="font-mono text-brand-emerald">{closing.usuarioMaster}</strong> · Fechamento às {closing.horarioFechamento} de {closing.dataOperacional}.
                </p>
              </div>
            </div>
            
            <button
              onClick={() => {
                setDismissedDivergences(prev => [...prev, uniqueKey]);
              }}
              className="bg-red-500/25 hover:bg-red-500/40 text-red-300 border border-red-500/35 hover:border-red-500/50 font-mono text-[9px] uppercase font-semibold px-2.5 py-1.5 rounded-lg transition-all cursor-pointer shadow-inner self-start sm:self-center"
            >
              Auditar & Resolver Alerta
            </button>
          </div>
        );
      })}

      {/* Ambient Realtime Status Ribbon if no critical undismissed alerts */}
      {activeAlerts.length === 0 && (
        <div className="p-4 bg-brand-emerald/5 border border-brand-emerald/10 rounded-xl flex flex-col sm:flex-row sm:items-center sm:justify-between text-xs gap-3 shadow-inner">
          <div className="flex items-center gap-2.5">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-brand-emerald opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-brand-emerald"></span>
            </span>
            <p className="text-slate-300 leading-tight">
              <strong>SISTEMA CONCILIADO E LIVRE DE ALERTAS</strong> · Todas as conferências cegas e auditorias de encerramento de turno bateram com precisão centesimal de R$ 0,00.
            </p>
          </div>
          <span className="bg-brand-navy-deep px-2.5 py-1 border border-brand-navy-bright/45 rounded text-[9px] font-mono uppercase text-brand-emerald font-bold">
            Audit Level Active
          </span>
        </div>
      )}

      {/* 3. CARDS DE KPI DE ALTA PRECISÃO NO TOPO DO PAINEL - CENTRALIZAÇÃO E NOVA DISTRIBUIÇÃO DOS 7 KPIS */}
      <div className="space-y-5">
        
        {/* LINHA 1 (INDICADORES DE LIQUIDEZ E COMPLEMENTARIEDADE - ENFATIZADOS) */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
          
          {/* Card 1: FATURAMENTO BRUTO DO DIA */}
          <div className="md:col-span-2 col-span-1 bg-brand-navy-card border border-brand-navy-bright p-5 rounded-2xl shadow-lg relative overflow-hidden group transition-all duration-200 hover:border-brand-emerald/40">
            <div className="flex justify-between items-start">
              <div className="space-y-0.5">
                <span className="text-[10px] font-sans font-medium uppercase text-slate-400 tracking-wider">
                  Faturamento Bruto do Dia
                </span>
                <p className="text-[9px] text-slate-500 font-sans leading-none">Total absoluto de todas as entradas do dia corrente</p>
              </div>
              <div className="p-1.5 rounded bg-brand-emerald/10 text-brand-emerald">
                <TrendingUp className="w-4 h-4" />
              </div>
            </div>
            <h3 className="text-xl font-mono font-bold text-brand-emerald tracking-tight mt-3">
              {DecimalMath.formatBRL(biKpis.faturamentoDia)}
            </h3>
            <div className="flex items-center gap-1 text-[8px] font-mono text-slate-400 mt-2 border-t border-brand-navy-bright/30 pt-1.5 justify-between">
              <span className="text-brand-emerald font-bold">● REALTIME CONSOLIDADO</span>
              <span>Exclui faturamento a prazo (boleto)</span>
            </div>
          </div>

          {/* Card 2: TOTAL EM DINHEIRO */}
          <div className="bg-brand-navy-card border border-brand-navy-bright p-5 rounded-2xl shadow-lg relative overflow-hidden group transition-all duration-200 hover:border-amber-500/40">
            <div className="flex justify-between items-start">
              <div className="space-y-0.5">
                <span className="text-[10px] font-sans font-medium uppercase text-slate-400 tracking-wider">
                  Total em Dinheiro
                </span>
                <p className="text-[9px] text-slate-500 font-sans leading-none">Espécie contida fisicamente nas gavetas</p>
              </div>
              <div className="p-1.5 rounded bg-amber-500/10 text-amber-500">
                <Coins className="w-4 h-4" />
              </div>
            </div>
            <h3 className="text-lg font-mono font-bold text-amber-500 tracking-tight mt-3">
              {DecimalMath.formatBRL(biKpis.dinheiro)}
            </h3>
            <div className="flex justify-between text-[8px] font-mono text-slate-400 mt-2 border-t border-brand-navy-bright/30 pt-1.5">
              <span>Gaveta Física</span>
              <span className="text-amber-500 bg-amber-500/10 px-1 rounded font-bold text-[8px]">REAL</span>
            </div>
          </div>

          {/* Card 3: STATUS DE CONCILIAÇÃO */}
          <div className="bg-brand-navy-card border border-brand-navy-bright p-5 rounded-2xl shadow-lg relative overflow-hidden group transition-all duration-200 hover:border-teal-500/40">
            <div className="flex justify-between items-start">
              <div className="space-y-0.5">
                <span className="text-[10px] font-sans font-medium uppercase text-slate-400 tracking-wider">
                  Status de Conciliação
                </span>
                <p className="text-[9px] text-slate-500 font-sans leading-none">Diferença Proj vs Real</p>
              </div>
              <div className="p-1.5 rounded bg-teal-500/10 text-teal-400">
                <CheckCircle2 className="w-3.5 h-3.5" />
              </div>
            </div>
            {(() => {
              const totalDivergencia = historicalClosings.reduce((sum, c) => DecimalMath.add(sum, c.divergencia || '0.00'), '0.00');
              const hasError = DecimalMath.toCents(totalDivergencia) !== 0;
              
              return (
                <div className="mt-3">
                  {hasError ? (
                    <h3 className="text-lg font-mono font-bold text-red-500 animate-pulse tracking-tight">
                      {DecimalMath.formatBRL(totalDivergencia)}
                    </h3>
                  ) : (
                    <h3 className="text-lg font-mono font-bold text-brand-emerald tracking-tight">
                      R$ 0,00 - Caixa Conciliado
                    </h3>
                  )}
                  <div className="mt-2 border-t border-brand-navy-bright/30 pt-1.5 flex items-center justify-between">
                    {hasError ? (
                      <span className="bg-red-500/15 text-red-400 font-sans text-[8px] px-1 rounded font-extrabold tracking-tight uppercase animate-pulse leading-none py-0.5">
                        Divergência Detectada
                      </span>
                    ) : (
                      <span className="bg-teal-500/15 text-teal-450 font-sans text-[8px] px-1 rounded font-extrabold tracking-tight uppercase leading-none py-0.5">
                        Caixa Conciliado
                      </span>
                    )}
                  </div>
                </div>
              );
            })()}
          </div>

        </div>

        {/* LINHA 2 (MEIOS DE PAGAMENTO E FLUXO OPERACIONAL - 4 COLUNAS IGUAIS) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          
          {/* Card 4: TOTAL EM PIX */}
          <div className="bg-brand-navy-card border border-brand-navy-bright p-5 rounded-2xl shadow-lg relative overflow-hidden group transition-all duration-200 hover:border-brand-accent/40">
            <div className="flex justify-between items-start">
              <div className="space-y-0.5">
                <span className="text-[10px] font-sans font-medium uppercase text-slate-400 tracking-wider">
                  Total em PIX
                </span>
                <p className="text-[9px] text-slate-500 font-sans leading-none">Valores recebidos via QR Code</p>
              </div>
              <div className="p-1 rounded bg-brand-accent/10 text-brand-accent">
                <TrendingUp className="w-3.5 h-3.5" />
              </div>
            </div>
            <h3 className="text-lg font-mono font-bold text-brand-accent tracking-tight mt-3">
              {DecimalMath.formatBRL(biKpis.pix)}
            </h3>
            <div className="flex justify-between text-[8px] font-mono text-slate-400 mt-2 border-t border-brand-navy-bright/30 pt-1.5">
              <span>PIX Contábil</span>
              <span className="text-brand-accent font-bold text-[8px]">QR CODE</span>
            </div>
          </div>

          {/* Card 5: TOTAL EM CARTÕES */}
          <div className="bg-brand-navy-card border border-brand-navy-bright p-5 rounded-2xl shadow-lg relative overflow-hidden group transition-all duration-200 hover:border-blue-500/40">
            <div className="flex justify-between items-start">
              <div className="space-y-0.5">
                <span className="text-[10px] font-sans font-medium uppercase text-slate-400 tracking-wider">
                  Total em Cartões
                </span>
                <p className="text-[9px] text-slate-500 font-sans leading-none">Crédito/Débito consolidados</p>
              </div>
              <div className="p-1 rounded bg-blue-500/10 text-blue-500">
                <CreditCard className="w-3.5 h-3.5" />
              </div>
            </div>
            <h3 className="text-lg font-mono font-bold text-blue-400 tracking-tight mt-3">
              {DecimalMath.formatBRL(biKpis.cartoes)}
            </h3>
            <div className="flex justify-between text-[8px] font-mono text-slate-400 mt-2 border-t border-brand-navy-bright/30 pt-1.5">
              <span>Maquininhas POS</span>
              <span className="text-blue-400 font-bold text-[8px]">DEB/CRE</span>
            </div>
          </div>

          {/* Card 6: CONVÊNIO DESPACHANTES (EM ABERTO) */}
          <div className="bg-brand-navy-card border border-brand-navy-bright p-5 rounded-2xl shadow-lg relative overflow-hidden group transition-all duration-200 hover:border-pink-500/40">
            <div className="flex justify-between items-start">
              <div className="space-y-0.5">
                <span className="text-[10px] font-sans font-medium uppercase text-slate-400 tracking-wider">
                  Convênio Despachantes (Aberto)
                </span>
                <p className="text-[9px] text-slate-500 font-sans leading-none">Saldo totalizador de débitos B2B</p>
              </div>
              <div className="p-1 rounded bg-pink-500/10 text-pink-500">
                <Users className="w-3.5 h-3.5" />
              </div>
            </div>
            <h3 className="text-lg font-mono font-bold text-pink-400 tracking-tight mt-3">
              {DecimalMath.formatBRL(convenioAbertoTotal)}
            </h3>
            <div className="flex justify-between text-[8px] font-mono text-slate-400 mt-2 border-t border-brand-navy-bright/30 pt-1.5">
              <span>Contas Correntes B2B</span>
              <span className="text-pink-400 font-bold uppercase text-[7px]">Inflow B2B</span>
            </div>
          </div>

          {/* Card 7: FLUXO DE SANGRIAS */}
          <div className="bg-brand-navy-card border border-brand-navy-bright p-5 rounded-2xl shadow-lg relative overflow-hidden group transition-all duration-200 hover:border-purple-500/40">
            <div className="flex justify-between items-start">
              <div className="space-y-0.5">
                <span className="text-[10px] font-sans font-medium uppercase text-slate-400 tracking-wider">
                  Fluxo de Sangrias
                </span>
                <p className="text-[9px] text-slate-500 font-sans leading-none">Total de retiradas manuais</p>
              </div>
              <div className="p-1 rounded bg-purple-500/10 text-purple-500">
                <ArrowDownLeft className="w-3.5 h-3.5" />
              </div>
            </div>
            <h3 className="text-lg font-mono font-bold text-purple-400 tracking-tight mt-3">
              {DecimalMath.formatBRL(biKpis.sangrias)}
            </h3>
            <div className="flex justify-between text-[8px] font-mono text-slate-400 mt-2 border-t border-brand-navy-bright/30 pt-1.5">
              <span>Retiradas Gerenciais</span>
              <span className="text-purple-400 font-bold uppercase text-[7px]">SAÍDAS</span>
            </div>
          </div>

        </div>

      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Gráfico A: Rosca/Pizza por Meio de Pagamento */}
        <div className="bg-brand-navy-card border border-brand-navy-bright/60 p-5 rounded-2xl shadow-lg flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-1.5 text-brand-emerald">
              <span className="w-1.5 h-1.5 bg-brand-emerald rounded-full animate-ping" />
              <h4 className="font-display font-extrabold text-[11px] uppercase tracking-wider text-slate-200">
                Participação por Meio de Pagamento
              </h4>
            </div>
            <p className="text-[10px] text-slate-400 mt-1 leading-normal">
              Representatividade percentual das transações liquidadas no balcão físico de Passo Fundo.
            </p>
          </div>

          <div className="flex flex-col items-center justify-center space-y-4 py-4">
            <div className="relative w-36 h-36 flex items-center justify-center">
              {/* Concentric Progress Rings (Multi Arc Representation for extreme visual premium quality) */}
              <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                <circle cx="50" cy="50" r="40" fill="transparent" stroke="#040811" strokeWidth="8" />
                
                {/* Dynamically layered concentric colored progress arcs */}
                {/* Ring 1: Pix (Emerald) */}
                <circle cx="50" cy="50" r="40" fill="transparent" stroke="#10b981" strokeWidth="8" 
                  strokeDasharray="251.2" strokeDashoffset={251.2 - (251.2 * pixP) / 100} 
                  strokeLinecap="round" className="transition-all duration-500"
                />
                
                {/* Inner track for cards */}
                <circle cx="50" cy="50" r="30" fill="transparent" stroke="#040811" strokeWidth="6" />
                <circle cx="50" cy="50" r="30" fill="transparent" stroke="#3b82f6" strokeWidth="6" 
                  strokeDasharray="188.4" strokeDashoffset={188.4 - (188.4 * getPercent(cardVolumeCents)) / 100} 
                  strokeLinecap="round" className="transition-all duration-500"
                />
                
                {/* Inner track for Cash */}
                <circle cx="50" cy="50" r="22" fill="transparent" stroke="#040811" strokeWidth="5" />
                <circle cx="50" cy="50" r="22" fill="transparent" stroke="#f59e0b" strokeWidth="5" 
                  strokeDasharray="138.2" strokeDashoffset={138.2 - (138.2 * getPercent(cashVolumeCents)) / 100} 
                  strokeLinecap="round" className="transition-all duration-500"
                />
              </svg>
              
              <div className="absolute text-center bg-brand-navy-deep/80 px-2.5 py-1.5 rounded-xl border border-brand-navy-bright/10 text-slate-100">
                <span className="text-md font-black font-mono block leading-none">{pixP}%</span>
                <span className="text-[7px] font-mono uppercase text-slate-400 block mt-0.5">PIX LÍDER</span>
              </div>
            </div>

            {/* Scoreboard List styled with JetBrains Mono */}
            <div className="w-full space-y-1.5 font-mono text-[10px] bg-brand-navy-deep/60 p-3 rounded-xl border border-brand-navy-bright/35">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-brand-emerald" />
                  <span className="text-slate-300 font-sans">PIX</span>
                </div>
                <span className="text-slate-100 font-bold">{pixP}% ({DecimalMath.formatBRL(DecimalMath.fromCents(pixVolumeCents))})</span>
              </div>
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-blue-500" />
                  <span className="text-slate-300 font-sans">Cartões (DEB/CRÉD)</span>
                </div>
                <span className="text-slate-100 font-bold">{getPercent(cardVolumeCents)}% ({DecimalMath.formatBRL(DecimalMath.fromCents(cardVolumeCents))})</span>
              </div>
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-amber-500" />
                  <span className="text-slate-300 font-sans">Espécie (Dinheiro)</span>
                </div>
                <span className="text-slate-100 font-bold">{getPercent(cashVolumeCents)}% ({DecimalMath.formatBRL(DecimalMath.fromCents(cashVolumeCents))})</span>
              </div>
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-purple-500" />
                  <span className="text-slate-300 font-sans">Boleto (Convênio)</span>
                </div>
                <span className="text-slate-100 font-bold">{getPercent(faturadosVolumeCents)}% ({DecimalMath.formatBRL(DecimalMath.fromCents(faturadosVolumeCents))})</span>
              </div>
            </div>
          </div>
        </div>

        {/* Gráfico B: Linha Dinâmica de Produtividade Horária */}
        <div className="bg-brand-navy-card border border-brand-navy-bright/60 p-5 rounded-2xl shadow-lg flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-1.5 text-brand-emerald">
              <Clock className="w-4 h-4 text-brand-accent" />
              <h4 className="font-display font-extrabold text-[11px] uppercase tracking-wider text-slate-200">
                Curva de Produtividade Horária (Picos)
              </h4>
            </div>
            <p className="text-[10px] text-slate-400 mt-1 leading-normal">
              Representação em tempo real dos picos de caixa para escala otimizada e intervalos de equipe.
            </p>
          </div>

          <div className="relative py-4">
            <svg viewBox="0 0 500 130" className="w-full h-auto overflow-visible">
              <defs>
                <linearGradient id="neonGlowLine" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.45" />
                  <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.0" />
                </linearGradient>
              </defs>

              {/* Gridlines */}
              <line x1="40" y1="110" x2="460" y2="110" stroke="#101827" strokeWidth="1" />
              <line x1="40" y1="70" x2="460" y2="70" stroke="#1f2937" strokeWidth="0.5" strokeDasharray="3" />
              <line x1="40" y1="30" x2="460" y2="30" stroke="#1f2937" strokeWidth="0.5" strokeDasharray="3" />

              {/* programmatically scale and draw the smooth spline area */}
              {(() => {
                const maxVal = Math.max(...hourlyData.map(h => parseFloat(h.total)), 1.00);
                
                const points = hourlyData.map((h, i) => {
                  const x = 50 + i * 100;
                  const v = parseFloat(h.total);
                  const y = 110 - (v / maxVal) * 80;
                  return { x, y, val: h.total, count: h.count };
                });

                const strokeD = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
                const fillD = `${strokeD} L 450 110 L 50 110 Z`;

                return (
                  <>
                    <path d={fillD} fill="url(#neonGlowLine)" className="transition-all duration-500" />
                    <path d={strokeD} fill="none" stroke="#3b82f6" strokeWidth="3" className="transition-all duration-500" />
                    
                    {points.map((p, i) => (
                      <g key={i} className="group cursor-pointer">
                        <circle cx={p.x} cy={p.y} r="5" fill="#3b82f6" stroke="#0a0f1d" strokeWidth="2" />
                        <text x={p.x} y={p.y - 12} textAnchor="middle" fill="#f1f5f9" fontSize="9" className="font-mono font-bold hidden group-hover:block bg-brand-navy-deep px-1 rounded">
                          {DecimalMath.formatBRL(p.val)}
                        </text>
                      </g>
                    ))}
                  </>
                );
              })()}
            </svg>

            <div className="flex justify-between px-3 text-[8px] font-mono text-slate-500 uppercase mt-2">
              {hourlyData.map((h, i) => (
                <div key={i} className="text-center font-mono space-y-0.5">
                  <span className="block text-slate-400 font-semibold">{h.label}</span>
                  <span className="text-[7px] text-slate-500 font-normal">{h.count} vds</span>
                </div>
              ))}
            </div>
          </div>

          <div className="pt-3 border-t border-brand-navy-bright flex items-center justify-between text-xs bg-brand-navy-deep/30 p-2.5 rounded-xl">
            <div className="font-mono text-[9px]">
              <span className="text-slate-500 block uppercase">Canal Principal</span>
              <span className="text-slate-200 font-sans font-semibold">Passo Fundo - Balcão Principal</span>
            </div>
            <div className="text-right font-mono text-[9px]">
              <span className="text-slate-500 block uppercase">SLA Monitor</span>
              <span className="text-brand-emerald font-sans font-bold">EXCELENTE (99.8%)</span>
            </div>
          </div>
        </div>

        {/* Gráfico C: Barras Comparativas Particular vs Despachantes */}
        <div className="bg-brand-navy-card border border-brand-navy-bright/60 p-5 rounded-2xl shadow-lg flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-1.5 text-brand-emerald">
              <Users className="w-4 h-4 text-pink-400" />
              <h4 className="font-display font-extrabold text-[11px] uppercase tracking-wider text-slate-200">
                Particular vs Despachantes B2B
              </h4>
            </div>
            <p className="text-[10px] text-slate-400 mt-1 leading-normal">
              Comparativo de receita acumulada por tipo de cliente para otimização de campanhas comerciais.
            </p>
          </div>

          {(() => {
            const partRev = parseFloat(biParticularRevenue);
            const b2bRev = parseFloat(biB2bRevenue);
            const maxVal = Math.max(partRev, b2bRev, 1.00);
            
            const partRatio = (partRev / maxVal) * 100;
            const b2bRatio = (b2bRev / maxVal) * 100;

            return (
              <div className="space-y-5 py-4">
                
                {/* Bar 1: Particular */}
                <div className="space-y-1.5">
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-slate-300 font-sans text-[11px] font-semibold flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded bg-brand-emerald" />
                      Particular (B2C) · <span className="font-mono text-[9px] text-slate-500">{biParticularCount} vds</span>
                    </span>
                    <span className="font-mono font-bold text-brand-emerald">{DecimalMath.formatBRL(biParticularRevenue)}</span>
                  </div>
                  <div className="w-full bg-brand-navy-deep h-3.5 rounded-full overflow-hidden border border-brand-navy-bright/10 p-0.5">
                    <div 
                      className="bg-brand-emerald h-full rounded-full transition-all duration-500 shadow-lg shadow-brand-emerald/10"
                      style={{ width: `${Math.max(partRatio, 6)}%` }}
                    />
                  </div>
                </div>

                {/* Bar 2: Despachantes */}
                <div className="space-y-1.5">
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-slate-300 font-sans text-[11px] font-semibold flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded bg-brand-accent" />
                      Despachantes B2B · <span className="font-mono text-[9px] text-slate-500">{biB2bCount} vds</span>
                    </span>
                    <span className="font-mono font-bold text-brand-accent">{DecimalMath.formatBRL(biB2bRevenue)}</span>
                  </div>
                  <div className="w-full bg-brand-navy-deep h-3.5 rounded-full overflow-hidden border border-brand-navy-bright/10 p-0.5">
                    <div 
                      className="bg-brand-accent h-full rounded-full transition-all duration-500 shadow-lg shadow-brand-accent/10"
                      style={{ width: `${Math.max(b2bRatio, 6)}%` }}
                    />
                  </div>
                </div>

              </div>
            );
          })()}

          <p className="text-[9px] text-slate-500 italic text-center font-mono bg-brand-navy-deep/20 py-2 rounded">
            Despachantes respondem pela maior fatia de receita total no balanço acumulado.
          </p>
        </div>

      </div>

      {/* 5. PAINEL DE MONITORIZAÇÃO DE CONFORMIDADE E ALERTAS (O LIVRO COMPLETO DE CLOSURES) */}
      {!isMobile && (
        <>
          <div className="bg-brand-navy-card p-5 border border-brand-navy-bright rounded-2xl shadow-lg">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
          <div>
            <h4 className="font-display font-semibold text-xs text-slate-200 uppercase tracking-wider flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-brand-accent opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-brand-accent"></span>
              </span>
              Conformidade de Caixa & Livro de Conferências Auditadas
            </h4>
            <p className="text-[10px] text-slate-400 font-sans pl-4">
              Registro histórico de auditorias operacionais e conferências cegas executadas ao fim de turnos.
            </p>
          </div>
          
          <button 
            onClick={() => {
              // Action helper: provide simulated test closure trigger
              const simulatedDivergentReport = {
                terminalId: 'Passo Fundo - Caixa 01',
                dataOperacional: new Date().toLocaleDateString('pt-BR'),
                horarioAbertura: '12:00:00',
                horarioFechamento: new Date().toLocaleTimeString('pt-BR'),
                usuarioMaster: rlsSession.email || 'operador.balcao@marks.com',
                fundoTroco: caixaState.fundoTroco || '150.00',
                entradasDinheiro: '110.00',
                entradasPix: '50.00',
                entradasCredito: '0.00',
                entradasDebito: '0.00',
                entradasBoleto: '0.00',
                reforcos: '0.00',
                retiradas: '0.00',
                saldoEsperado: '260.00',
                saldoInformado: '240.00', // -R$ 20.00 divergence!
                divergencia: '-20.00',
                status: 'Quebra de Caixa',
                particularQty: 2,
                particularTotal: '160.00',
                b2bQty: 1,
                b2bTotal: '100.00'
              };
              const stored = localStorage.getItem('marks_closing_reports') || '[]';
              const parsed = JSON.parse(stored);
              parsed.unshift(simulatedDivergentReport);
              localStorage.setItem('marks_closing_reports', JSON.stringify(parsed));
              // Trigger app alert reload
              window.dispatchEvent(new Event('storage'));
              addToastLocal('Simulação Concluída', 'Divergência registrada com sucesso.');
              // Quick force component redraw by toggling active element state
              setActiveDateFilter('HOJE');
            }}
            className="text-[9px] uppercase font-mono font-bold px-2.5 py-1.5 bg-brand-navy-deep hover:bg-brand-navy-bright border border-brand-navy-bright/70 hover:border-brand-emerald text-brand-emerald rounded-lg transition-all cursor-pointer"
          >
            Simular Divergência de Turno (Para Auditoria)
          </button>
        </div>

        <div className="overflow-x-auto w-full">
          <table className="w-full text-xs font-mono">
            <thead>
              <tr className="border-b border-brand-navy-bright/60 pb-2.5 text-slate-400">
                <th className="text-left font-bold py-2 font-sans text-[11px]">Data / Hora</th>
                <th className="text-left font-bold font-sans text-[11px]">Operador Responsável</th>
                <th className="text-center font-bold font-sans text-[11px]">Esperado</th>
                <th className="text-center font-bold font-sans text-[11px]">Informed (Cego)</th>
                <th className="text-center font-bold font-sans text-[11px]">Divergência</th>
                <th className="text-center font-bold font-sans text-[11px]">Status Auditoria</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-brand-navy-bright/30">
              {historicalClosings.map((c: any, index: number) => {
                const isDivergent = parseFloat(c.divergencia) !== 0;
                return (
                  <tr key={index} className="hover:bg-brand-navy-deep/40 transition-colors text-slate-300">
                    <td className="py-3 font-mono font-medium text-slate-400">
                      {c.dataOperacional} <span className="text-[10px] text-slate-600 font-sans block">{c.horarioFechamento}</span>
                    </td>
                    <td className="align-middle">
                      <span className="font-bold text-slate-200">{c.usuarioMaster}</span>
                      <span className="text-[9px] text-slate-500 font-mono block uppercase">{c.terminalId || 'Caixa 01'}</span>
                    </td>
                    <td className="text-center py-3 font-mono align-middle">
                      {DecimalMath.formatBRL(c.saldoEsperado)}
                    </td>
                    <td className="text-center py-3 font-mono align-middle">
                      {DecimalMath.formatBRL(c.saldoInformado)}
                    </td>
                    <td className={`text-center py-3 font-mono font-bold align-middle ${
                      isDivergent ? 'text-red-400 animate-pulse' : 'text-slate-400 font-normal'
                    }`}>
                      {DecimalMath.formatBRL(c.divergencia)}
                    </td>
                    <td className="text-center py-3 align-middle">
                      <span className={`px-2.5 py-1 rounded text-[10px] font-bold uppercase tracking-wider ${
                        c.status === 'Conciliado' || c.status === 'Livre' || !isDivergent
                          ? 'bg-brand-emerald/10 text-brand-emerald' 
                          : 'bg-red-500/10 text-red-400'
                      }`}>
                        {c.status || 'Conferência Cega'}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* 6. TABELA DE FEED DE LOGS DIÁRIOS AO VIVO */}
      <div className="bg-brand-navy-card p-5 border border-brand-navy-bright rounded-2xl shadow-lg">
        <h4 className="font-display font-semibold text-xs text-slate-200 uppercase tracking-wider mb-4 flex items-center gap-2">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-brand-emerald opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-brand-emerald"></span>
          </span>
          Logs Diários: Feed de Atendimentos do Caixa (Tempo Real - D+0)
        </h4>
        <div className="overflow-x-auto w-full">
          <table className="w-full text-xs font-mono">
            <thead>
              <tr className="border-b border-brand-navy-bright/60 pb-2.5 text-slate-400">
                <th className="text-left font-bold py-2 font-sans text-[11px]">Friendly ID</th>
                <th className="text-left font-bold font-sans text-[11px]">Hora / Data</th>
                <th className="text-left font-bold font-sans text-[11px]">Operador</th>
                <th className="text-left font-bold font-sans text-[11px]">Cliente Beneficiário</th>
                <th className="text-center font-bold font-sans text-[11px]">Canal</th>
                <th className="text-center font-bold font-sans text-[11px]">Método</th>
                <th className="text-right font-bold font-sans text-[11px]">Valor Líquido</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-brand-navy-bright/35">
              {biFilteredTx.map(tx => (
                <tr key={tx.id} className="hover:bg-brand-navy-deep/40 transition-colors text-slate-300">
                  <td className="py-2.5 text-slate-400 font-mono font-semibold">{tx.sequenceId}</td>
                  <td>
                    <span className="font-mono text-slate-300 block">{new Date(tx.timestamp).toLocaleTimeString('pt-BR')}</span>
                    <span className="text-[9px] text-slate-500 font-mono font-normal">{new Date(tx.timestamp).toLocaleDateString('pt-BR')}</span>
                  </td>
                  <td className="text-slate-300 font-medium">{tx.createdBy.userName}</td>
                  <td className="font-bold text-slate-100">{tx.clientName}</td>
                  <td className="text-center font-bold text-brand-emerald text-[9px] uppercase tracking-wide">Passo Fundo</td>
                  <td className="text-center">
                    <span className={`px-2 py-0.5 rounded text-[9px] font-bold font-mono ${
                      tx.paymentMethod === 'PIX' ? 'bg-brand-emerald/15 text-brand-emerald' :
                      tx.paymentMethod === 'CASH' ? 'bg-amber-500/15 text-amber-500' :
                      tx.paymentMethod === 'BOLETO' ? 'bg-purple-500/15 text-purple-500' : 'bg-blue-500/15 text-blue-500'
                    }`}>
                      {tx.paymentMethod}
                    </span>
                  </td>
                  <td className="text-right font-bold text-brand-emerald font-mono">{DecimalMath.formatBRL(tx.netTotal)}</td>
                </tr>
              ))}
              {biFilteredTx.length === 0 && (
                <tr>
                  <td colSpan={7} className="text-center py-8 text-slate-500 font-mono">
                    Nenhuma transação financeira processada pelo terminal no intervalo selecionado.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
        </>
      )}

    </div>
  ) : (
    /* ==================== HISTÓRICO DE ATAS DE CAIXA (SISTEMA INTEGRAL) ==================== */
    <div className="space-y-6 animate-fade-in font-sans transition-all text-slate-100">
      
      {/* 1. RESTRIÇÃO DE AUTORIZAÇÃO DE PAPEL (Master, Gerente e Financeiro) */}
      {!hasCrudAccess ? (
        <div className="bg-brand-navy-card border border-red-500/30 p-8 rounded-2xl shadow-lg text-center space-y-4 max-w-lg mx-auto my-12">
          <div className="mx-auto bg-red-500/10 text-red-500 w-16 h-16 rounded-full flex items-center justify-center">
            <Lock className="w-8 h-8" />
          </div>
          <h3 className="font-display font-bold text-lg text-slate-100">Acesso Restrito ao Histórico</h3>
          <p className="text-xs text-slate-400 leading-relaxed">
            Esta seção de governança e auditoria retroativa está limitada aos usuários com atribuição de nível <span className="text-brand-emerald font-bold">Master</span>, <span className="text-brand-emerald font-bold">Gerente</span> ou <span className="text-brand-emerald font-bold">Financeiro</span>. Por favor, entre em contato com a administração da Marks Systems se achar que isto é um engano.
          </p>
        </div>
      ) : (
        <>
          {/* 1. FILTROS DE BUSCA DE ALTA PERFORMANCE */}
          <div className="bg-brand-navy-card border border-brand-navy-bright p-5 rounded-2xl shadow-lg space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 border-b border-brand-navy-bright/60 pb-3">
              <div>
                <h3 className="font-display font-semibold text-sm text-slate-200 uppercase tracking-wider flex items-center gap-2">
                  <Clock className="w-4.5 h-4.5 text-brand-emerald" />
                  Histórico e Consulta de Atas de Caixa
                </h3>
                <p className="text-[11px] text-slate-400">Rastreabilidade integral retroativa e conciliação para fiscalização.</p>
              </div>
              <div className="flex items-center gap-2 text-xs font-mono bg-brand-navy-deep px-3 py-1.5 rounded-lg border border-brand-navy-bright/60 font-medium">
                <span className="text-slate-400 uppercase">Total Arquivados:</span>
                <span className="font-bold text-brand-emerald">{historicalClosings.length} Atas</span>
              </div>
            </div>

            {/* SELETORES DE ALTA PERFORMANCE */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 animate-fade-in">
              {/* Filtro Período Início */}
              <div className="space-y-1.5">
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 font-sans" htmlFor="hist-start-date">
                  Data Inicial (Operacional)
                </label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    id="hist-start-date"
                    type="date"
                    value={histStartDate}
                    onChange={(e) => setHistStartDate(e.target.value)}
                    className="w-full bg-brand-navy-deep border border-brand-navy-bright rounded-xl pl-10 pr-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-brand-emerald font-mono"
                  />
                </div>
              </div>

              {/* Filtro Período Fim */}
              <div className="space-y-1.5">
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 font-sans" htmlFor="hist-end-date">
                  Data Final (Operacional)
                </label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    id="hist-end-date"
                    type="date"
                    value={histEndDate}
                    onChange={(e) => setHistEndDate(e.target.value)}
                    className="w-full bg-brand-navy-deep border border-brand-navy-bright rounded-xl pl-10 pr-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-brand-emerald font-mono"
                  />
                </div>
              </div>

              {/* Filtro Operador */}
              <div className="space-y-1.5">
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 font-sans" htmlFor="hist-operator-select">
                  Operador do Turno
                </label>
                <select
                  id="hist-operator-select"
                  value={filterOperatorEmail}
                  onChange={(e) => setFilterOperatorEmail(e.target.value)}
                  className="w-full bg-brand-navy-deep border border-brand-navy-bright rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-brand-emerald font-sans cursor-pointer"
                >
                  <option value="ALL">Visualizar Todos Operadores</option>
                  {uniqueOperators.map((email) => (
                    <option key={email} value={email}>{email}</option>
                  ))}
                </select>
              </div>

              {/* Filtro Terminal ID */}
              <div className="space-y-1.5">
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 font-sans" htmlFor="hist-terminal-select">
                  Terminal ID (Canal)
                </label>
                <select
                  id="hist-terminal-select"
                  value={filterTerminalId}
                  onChange={(e) => setFilterTerminalId(e.target.value)}
                  className="w-full bg-brand-navy-deep border border-brand-navy-bright rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-brand-emerald font-sans cursor-pointer"
                >
                  <option value="ALL">Visualizar Todos Terminais</option>
                  {uniqueTerminals.map((term) => (
                    <option key={term} value={term}>{term}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Quick Reset Controls */}
            <div className="flex justify-end pt-2">
              <button
                onClick={() => {
                  setHistStartDate('2026-06-12');
                  setHistEndDate('2026-06-13');
                  setFilterOperatorEmail('ALL');
                  setFilterTerminalId('ALL');
                }}
                className="text-xs text-brand-emerald font-semibold uppercase hover:underline flex items-center gap-1.5 cursor-pointer font-sans"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Limpar Todos Filtros Retroativos
              </button>
            </div>
          </div>

          {/* 2. TABELA DE RESULTADOS HISTÓRICOS */}
          <div className="bg-brand-navy-card border border-brand-navy-bright rounded-2xl shadow-lg overflow-hidden">
            <div className="p-5 border-b border-brand-navy-bright flex justify-between items-center bg-brand-navy-card">
              <div className="font-sans">
                <h4 className="font-bold text-xs uppercase tracking-wider text-slate-300">Atas de Fechamento Registradas no Banco</h4>
                <p className="text-[10px] text-slate-400">Exibindo registros conciliados no filtro ativo.</p>
              </div>
            </div>

            <div className="overflow-x-auto w-full">
              <table className="w-full text-xs text-left">
                <thead>
                  <tr className="border-b border-brand-navy-bright text-slate-400 uppercase font-sans tracking-wide text-[10px] bg-brand-navy-deep/40">
                    <th className="py-3 px-4 font-bold text-slate-400">Data Operacional / Fim</th>
                    <th className="py-3 px-4 font-bold text-slate-400">Terminal & Operador</th>
                    <th className="py-3 px-4 text-center font-bold text-slate-400">Resultado Auditoria</th>
                    <th className="py-3 px-4 font-bold text-slate-400">Garantia / Hash</th>
                    <th className="py-3 px-4 text-right font-bold text-slate-400">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-brand-navy-bright/40 font-sans">
                  {filteredClosings.map((c: any, index: number) => {
                    const isBatido = DecimalMath.toCents(c.divergencia) === 0;
                    const fullHash = generateHash(c);
                    const truncatedHash = fullHash.slice(0, 15) + '...';

                    return (
                      <tr key={index} className="hover:bg-brand-navy-deep/20 transition-colors text-slate-300">
                        {/* Data e hora */}
                        <td className="py-3.5 px-4 font-mono">
                          <span className="font-bold text-slate-100 block">{c.dataOperacional}</span>
                          <span className="text-[10px] text-slate-500 block">Fechado às {c.horarioFechamento}</span>
                        </td>

                        {/* Terminal e Operador */}
                        <td className="py-3.5 px-4">
                          <span className="font-semibold text-slate-200 block text-[11px]">{c.terminalId}</span>
                          <span className="text-[10px] text-slate-400 block font-mono font-medium">{c.usuarioMaster}</span>
                        </td>

                        {/* Auditoria Status */}
                        <td className="py-3.5 px-4 text-center font-mono">
                          {isBatido ? (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-brand-emerald/15 text-brand-emerald font-bold border border-brand-emerald/20 text-[10px]">
                              <span className="w-1.5 h-1.5 rounded-full bg-brand-emerald animate-pulse"></span>
                              R$ 0,00 - Batido
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-red-500/15 text-red-400 font-bold border border-red-500/20 text-[10px]">
                              <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse"></span>
                              {parseFloat(c.divergencia) > 0 ? '+' : ''}{DecimalMath.formatBRL(c.divergencia)} — {c.status || 'Divergente'}
                            </span>
                          )}
                        </td>

                        {/* Hash */}
                        <td className="py-3.5 px-4 font-mono text-[10px] text-slate-400">
                          <div className="flex items-center gap-1.5" title={fullHash}>
                            <Lock className="w-3 h-3 text-brand-emerald/70 flex-shrink-0" />
                            <span className="text-slate-400">{truncatedHash}</span>
                          </div>
                        </td>

                        {/* Ações */}
                        <td className="py-3.5 px-4 text-right">
                          <button
                            onClick={() => setViewHistoryAta(c)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-brand-emerald hover:bg-emerald-400 text-brand-navy-deep font-bold font-sans text-[11px] rounded-lg transition-colors cursor-pointer shadow-sm hover:shadow-brand-emerald/10 uppercase"
                          >
                            <Printer className="w-3.5 h-3.5" />
                            Reemitir Ata em PDF
                          </button>
                        </td>
                      </tr>
                    );
                  })}

                  {filteredClosings.length === 0 && (
                    <tr>
                      <td colSpan={5} className="text-center py-12 text-slate-500 font-mono">
                        Nenhum caixa encerrado foi encontrado com os filtros selecionados.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>


        </>
      )}

      {/* 4. MODAL DETALHADO DE REEMISSÃO DE ATA HISTÓRICA */}
      {viewHistoryAta && (
        <div className="fixed inset-0 z-[100] overflow-y-auto bg-slate-950/95 backdrop-blur-md flex items-center justify-center p-4 md:p-8 animate-fade-in font-sans">
          
          {/* Inner scroll container layout */}
          <div className="bg-brand-navy-deep max-w-4xl w-full rounded-2xl border border-brand-navy-bright shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            
            {/* Header controls inside modal */}
            <div className="p-5 border-b border-brand-navy-bright bg-brand-navy-card flex items-center justify-between">
              <div>
                <h3 className="font-display font-semibold text-xs uppercase tracking-wider text-slate-300 flex items-center gap-2">
                  <Printer className="w-4 h-4 text-brand-emerald" />
                  REEMISSÃO RETROATIVA DE ATA DE ENCERRAMENTO E AUDITORIA
                </h3>
                <p className="text-[10px] text-slate-400">Visualização de segurança idêntica ao timbrado da Marks Systems CRVA 0018.</p>
              </div>
              
              <button 
                onClick={() => setViewHistoryAta(null)}
                className="p-1.5 px-3 text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg cursor-pointer font-sans"
              >
                Fechar Painel (Esc)
              </button>
            </div>

            {/* Document Simulator Body - aesthetically stunning white sheet for formal printing */}
            <div className="p-6 md:p-12 overflow-y-auto flex-1 bg-white text-slate-900 font-sans space-y-6">
              
              {/* Header timbrado Marks Systems */}
              <div className="border-b-4 border-emerald-500 pb-4 text-center space-y-1">
                <h1 className="font-sans font-extrabold text-lg uppercase tracking-tight text-slate-900">
                  Marks Systems - Passo Fundo/RS
                </h1>
                <p className="text-xs font-bold text-slate-600">
                  MARCO REGULATÓRIO INTERNO E GOVERNANÇA DE REPASSES
                </p>
                <div className="text-[10px] bg-slate-100 text-slate-700 py-1.5 px-2.5 rounded font-mono inline-block font-bold">
                  2ª VIA DE SEGURANÇA REEMITIDA RETROATIVAMENTE PARA GOVERNANÇA E AUDITORIA FISCAL
                </div>
              </div>

              {/* Identification details */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs border-b border-slate-200 pb-4">
                <div className="space-y-1.5">
                  <p><strong className="text-slate-500">Terminal ID:</strong> <span className="font-semibold text-slate-800 font-mono">{viewHistoryAta.terminalId}</span></p>
                  <p><strong className="text-slate-500">Data Operacional:</strong> <span className="font-bold text-slate-800 font-mono">{viewHistoryAta.dataOperacional}</span></p>
                  <p><strong className="text-slate-500">Responsável Encerramento:</strong> <span className="font-bold text-slate-800 font-mono">{viewHistoryAta.usuarioMaster}</span></p>
                </div>
                <div className="space-y-1.5 md:text-right">
                  <p><strong className="text-slate-500">Horário Abertura:</strong> <span className="font-mono text-slate-800">{viewHistoryAta.horarioAbertura || '08:00:00'}</span></p>
                  <p><strong className="text-slate-500">Horário Fechamento:</strong> <span className="font-mono text-slate-800">{viewHistoryAta.horarioFechamento}</span></p>
                  <p><strong className="text-slate-500">Emissão da Guia:</strong> <span className="font-mono text-slate-500">{new Date().toLocaleString('pt-BR')}</span></p>
                </div>
              </div>

              {/* Digital Hash multiline */}
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-[10px] font-mono text-slate-600 relative overflow-hidden bg-gradient-to-r from-slate-50 to-slate-100">
                <div className="font-bold text-emerald-600 mb-1 flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5" />
                  ASSINATURA DE SEGURANÇA HASH DIGITAL CONSOLIDADA (INTEGRAL):
                </div>
                <p className="break-all leading-normal text-slate-700 select-all font-bold">
                  {generateHash(viewHistoryAta)}
                </p>
              </div>

              {/* Ledger breakdown table */}
              <div className="space-y-2">
                <h4 className="text-[11px] font-bold tracking-wider text-slate-500 uppercase font-sans">
                  Demo de Fluxo e Parâmetros de Caixa Realizados no Dia Operacional
                </h4>
                <div className="border border-slate-200 rounded-lg overflow-hidden text-xs">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="bg-slate-50 font-bold border-b border-slate-200 text-slate-600">
                        <th className="p-2.5">Indicador de Caixa</th>
                        <th className="p-2.5 text-center">Tipo</th>
                        <th className="p-2.5 text-right font-bold">Valor Financeiro</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-mono text-slate-800">
                      <tr>
                        <td className="p-2 text-slate-600 font-sans">Fundo de Troco Inicial de Abertura</td>
                        <td className="p-2 text-center text-slate-500">[Fundo]</td>
                        <td className="p-2 text-right text-slate-900 font-semibold">{DecimalMath.formatBRL(viewHistoryAta.fundoTroco)}</td>
                      </tr>
                      <tr>
                        <td className="p-2 text-slate-600 font-sans">(+) Entradas de Caixa em Dinheiro Espécie</td>
                        <td className="p-2 text-center text-emerald-600 font-bold">(+)</td>
                        <td className="p-2 text-right text-emerald-700 font-bold">+{DecimalMath.formatBRL(viewHistoryAta.entradasDinheiro)}</td>
                      </tr>
                      <tr>
                        <td className="p-2 text-slate-600 font-sans">(+) Recebimentos via PIX Instantâneo</td>
                        <td className="p-2 text-center text-emerald-600 font-bold">(+)</td>
                        <td className="p-2 text-right text-emerald-700 font-bold">+{DecimalMath.formatBRL(viewHistoryAta.entradasPix)}</td>
                      </tr>
                      <tr>
                        <td className="p-2 text-slate-600 font-sans">(+) Recebimentos via Cartão Crédito (POS)</td>
                        <td className="p-2 text-center text-emerald-600 font-bold">(+)</td>
                        <td className="p-2 text-right text-emerald-700 font-bold">+{DecimalMath.formatBRL(viewHistoryAta.entradasCredito)}</td>
                      </tr>
                      <tr>
                        <td className="p-2 text-slate-600 font-sans">(+) Recebimentos via Cartão Débito (POS)</td>
                        <td className="p-2 text-center text-emerald-600 font-bold">(+)</td>
                        <td className="p-2 text-right text-emerald-700 font-bold">+{DecimalMath.formatBRL(viewHistoryAta.entradasDebito)}</td>
                      </tr>
                      <tr>
                        <td className="p-2 text-slate-600 font-sans">(+) Faturamento Boleto (Prazo B2B)</td>
                        <td className="p-2 text-center text-slate-500">[Fatur.]</td>
                        <td className="p-2 text-right text-slate-900 font-semibold">{DecimalMath.formatBRL(viewHistoryAta.entradasBoleto)}</td>
                      </tr>
                      <tr>
                        <td className="p-2 text-slate-600 font-sans">(+) Reforços / Aportes Realizados</td>
                        <td className="p-2 text-center text-emerald-600 font-bold">(+)</td>
                        <td className="p-2 text-right text-emerald-700 font-bold">+{DecimalMath.formatBRL(viewHistoryAta.reforcos)}</td>
                      </tr>
                      <tr>
                        <td className="p-2 text-slate-600 font-sans">(-) Sangrias Realizadas</td>
                        <td className="p-2 text-center text-red-650 text-red-600 font-bold">(-)</td>
                        <td className="p-2 text-right text-red-700 font-bold">-{DecimalMath.formatBRL(viewHistoryAta.retiradas)}</td>
                      </tr>
                      
                      {/* Expected vs physical details */}
                      <tr className="bg-slate-50 border-t border-slate-200">
                        <td className="p-2.5 font-sans font-bold text-slate-700">SALDO GAVETA ESPERADO</td>
                        <td></td>
                        <td className="p-2.5 text-right font-bold text-slate-950 font-mono">{DecimalMath.formatBRL(viewHistoryAta.saldoEsperado)}</td>
                      </tr>
                      <tr className="bg-slate-50">
                        <td className="p-2.5 font-sans font-bold text-slate-700">CONTAGEM FÍSICA DECLARADA</td>
                        <td></td>
                        <td className="p-2.5 text-right font-bold text-slate-950 font-mono">{DecimalMath.formatBRL(viewHistoryAta.saldoInformado)}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              {/* RASTRO DE OPERADORES & TRANSIÇÕES OPERACIONAIS */}
              <div className="space-y-2">
                <h4 className="text-[11px] font-bold tracking-wider text-slate-500 uppercase font-sans">
                  3. Histórico de Transição de Controles & Almoço (Lunch Rotation Auditoria)
                </h4>
                <div className="border border-slate-200 rounded-lg p-4 bg-slate-50 text-slate-800">
                  {viewHistoryAta.timeline && viewHistoryAta.timeline.length > 0 ? (
                    <div className="space-y-3 relative before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-300">
                      {viewHistoryAta.timeline.map((evt: any, idx: number) => (
                        <div key={idx} className="relative pl-6 text-xs">
                          <span className="absolute left-[5px] top-[5px] w-2 h-2 rounded-full bg-emerald-500 ring-4 ring-slate-50"></span>
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                            <span className="font-bold text-slate-800">{evt.action}</span>
                            <span className="font-mono text-[10px] text-emerald-700 bg-emerald-100 px-1.5 py-0.5 rounded font-bold">
                              {evt.timestamp}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-600 mt-1">
                            {evt.details} — <span className="font-semibold text-slate-700">{evt.operadorName} ({evt.operadorEmail})</span>
                          </p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-slate-500 italic text-[11px] text-center">Nenhum rastro de operador recuperado para este caixa.</p>
                  )}
                </div>
              </div>

              {/* AUDITORIA DE PARIDADE E CONCILIAÇÃO FINAL */}
              <div className="space-y-2">
                <h4 className="text-[11px] font-bold tracking-wider text-slate-500 uppercase font-sans">
                  4. Auditoria de Paridade e Conciliação Final
                </h4>
                {DecimalMath.toCents(viewHistoryAta.divergencia) === 0 ? (
                  <div className="bg-emerald-50 border border-emerald-300 p-3.5 rounded-lg text-xs text-emerald-800 font-medium">
                    <p className="font-bold text-emerald-900 mb-1">CONCILIADO COM 100% PARIDADE FISCAL (SEM DIVERGÊNCIAS)</p>
                    <p className="text-[11px]">Auditado retroativamente de forma digital sem identificar inconsistências com os sistemas operacionais auxiliares no dia de operação.</p>
                  </div>
                ) : (
                  <div className="bg-red-50 border border-red-300 p-3.5 rounded-lg text-xs text-red-800 font-medium">
                    <p className="font-bold text-red-950 mb-1 font-sans">DIVERGÊNCIA APURADA: {viewHistoryAta.status === 'Quebra de Caixa' ? 'QUEBRA' : 'SOBRA'} DE {DecimalMath.formatBRL(viewHistoryAta.divergencia)}</p>
                    <p className="text-[11px] font-sans">Inconsistência física identificada entre as leituras digitais consolidadas e os valores recolhidos. Evento anotado para desfecho administrativo.</p>
                  </div>
                )}
              </div>

              {/* Assinaturas físicas do documento */}
              <div className="pt-8 border-t border-dashed border-slate-300 font-mono text-[10px] text-slate-500">
                <p className="text-center font-bold mb-8 uppercase text-slate-600 font-sans">
                  5. Linhas de Chancelas & Assinaturas Físicas Requeridas
                </p>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8 pt-4">
                  {/* Assinatura 1 */}
                  <div className="flex flex-col items-center">
                    <div className="w-full border-b border-slate-400 mb-2 min-h-[35px]"></div>
                    <p className="font-bold text-slate-800 font-sans">OPERADOR DE CAIXA</p>
                    <p className="text-[9px] text-slate-400 font-sans">Responsável Operacional</p>
                  </div>

                  {/* Assinatura 2 */}
                  <div className="flex flex-col items-center">
                    <div className="w-full border-b border-slate-400 mb-2 min-h-[35px]"></div>
                    <p className="font-bold text-slate-800 font-sans">SUPERVISOR / GERENTE</p>
                    <p className="text-[9px] text-slate-400 font-sans">Homologador Marks Systems</p>
                  </div>

                  {/* Assinatura 3 */}
                  <div className="flex flex-col items-center">
                    <div className="w-full border-b border-slate-400 mb-2 min-h-[35px]"></div>
                    <p className="font-bold text-slate-800 font-sans">CONFERENTE FINANCEIRO</p>
                    <p className="text-[9px] text-slate-400 font-sans">Auditoria Backoffice</p>
                  </div>
                </div>

                <div className="pt-8 text-center text-[9px] text-slate-400 border-t border-slate-100 mt-6 leading-relaxed font-sans">
                  Este documento de reemissão fiscal retroativo segue os padrões exigidos legalmente.
                  <br />
                  Chancelado automaticamente pelo sistema de auditoria Marks Systems e gerido por algoritmo criptográfico.
                </div>
              </div>

            </div>

            {/* Bottom Actions of Modal */}
            <div className="p-5 border-t border-brand-navy-bright bg-brand-navy-card flex flex-col sm:flex-row gap-3">
              <button
                onClick={() => reissuePdfDownload(viewHistoryAta)}
                className="flex-1 py-3 bg-brand-emerald hover:bg-emerald-400 text-brand-navy-deep font-sans font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 transition cursor-pointer shadow-lg hover:shadow-brand-emerald/10 uppercase"
              >
                <Printer className="w-4 h-4" />
                Fazer Download do PDF (jsPDF) / Imprimir
              </button>
              
              <button
                onClick={() => setViewHistoryAta(null)}
                className="py-3 px-6 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs rounded-xl border border-slate-700 transition cursor-pointer font-sans"
              >
                Fechar Visualização
              </button>
            </div>

          </div>
        </div>
      )}

      {/* Local Toast Area for in-app alert feedback (avoiding window.alert in iframe) */}
      {localToast && (
        <div className="fixed bottom-6 right-6 z-[110] bg-brand-navy-card border border-brand-emerald/40 p-4 rounded-xl shadow-2xl flex items-start gap-3 animate-fade-in max-w-sm">
          <div className="p-1 bg-brand-emerald/15 text-brand-emerald rounded-lg">
            <CheckCircle2 className="w-5 h-5 animate-bounce" />
          </div>
          <div className="font-sans">
            <h5 className="text-xs font-bold text-slate-200 uppercase">{localToast.title}</h5>
            <p className="text-[11px] text-slate-400 mt-0.5 leading-relaxed">{localToast.message}</p>
          </div>
        </div>
      )}

      {/* ConfirmModal Customizado Premium */}
      {confirmModal.isOpen && (
        <div className="fixed inset-0 z-[130] bg-brand-navy-deep/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-brand-navy-card border border-brand-navy-bright/35 p-6 rounded-2xl max-w-sm w-full space-y-5 shadow-2xl animate-fade-in">
            <div className="flex items-center gap-2.5 pb-3 border-b border-brand-navy-bright/10">
              <div className={`p-1.5 rounded-lg ${
                confirmModal.type === 'danger' 
                  ? 'bg-red-500/10 text-red-400 border border-red-500/20' 
                  : confirmModal.type === 'warning'
                    ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                    : 'bg-brand-emerald/10 text-brand-emerald border border-brand-emerald/20'
              }`}>
                <AlertTriangle className="w-5 h-5" />
              </div>
              <h2 className="text-sm font-bold text-white">{confirmModal.title}</h2>
            </div>
            
            <p className="text-xs text-slate-350 leading-relaxed font-sans">
              {confirmModal.message}
            </p>

            <div className="flex gap-3 pt-1">
              <button 
                type="button"
                onClick={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
                className="flex-1 py-2.5 text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-lg transition-all cursor-pointer font-sans"
              >
                {confirmModal.cancelText || 'Cancelar'}
              </button>
              <button 
                type="button"
                onClick={async () => {
                  try {
                    await confirmModal.onConfirm();
                  } catch (e) {
                    console.error('Erro na ação de confirmação:', e);
                  } finally {
                    setConfirmModal(prev => ({ ...prev, isOpen: false }));
                  }
                }}
                className={`flex-1 py-2.5 text-xs font-bold rounded-lg transition-all shadow-lg cursor-pointer font-sans ${
                  confirmModal.type === 'danger'
                    ? 'bg-red-500 hover:bg-red-400 text-white shadow-red-500/10'
                    : confirmModal.type === 'warning'
                      ? 'bg-amber-500 hover:bg-amber-400 text-brand-navy-deep shadow-amber-500/10'
                      : 'bg-brand-emerald hover:bg-emerald-400 text-brand-navy-deep shadow-brand-emerald/10'
                }`}
              >
                {confirmModal.confirmText || 'Confirmar'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  )}

</div>
);
}
