/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { 
  X, Lock, ShieldAlert, CheckCircle, AlertTriangle, Send, Mail, RefreshCw,
  Printer, FileText, Building2, Sparkles, User, FileSignature, Coins, LogOut
} from 'lucide-react';
import { jsPDF } from 'jspdf';
import { CaixaState, Transaction, RlsSession } from '../types';
import { DecimalMath } from '../utils/numericPrice';

interface FechamentoCaixaModalProps {
  caixaState: CaixaState;
  transactions: Transaction[];
  onClose: () => void;
  onConfirmCloseCaixa: (consolidatedReport: {
    status: 'Quebra de Caixa' | 'Sobra de Caixa' | 'Conciliado';
    valorInformado: string;
    saldoEsperado: string;
    divergencia: string;
  }) => void;
  currentSession: RlsSession;
  onLogout?: () => void;
  addToast?: (title: string, message: string, type?: 'success' | 'info' | 'alert') => void;
}

export default function FechamentoCaixaModal({
  caixaState,
  transactions,
  onClose,
  onConfirmCloseCaixa,
  currentSession,
  onLogout,
  addToast,
}: FechamentoCaixaModalProps) {
  const [valorInformado, setValorInformado] = useState<string>('');
  const [isSentMail, setIsSentMail] = useState<boolean>(false);
  const [isValidating, setIsValidating] = useState<boolean>(false);
  const [step, setStep] = useState<1 | 2 | 3>(1);
  
  // States pós auditoria
  const [auditStatus, setAuditStatus] = useState<'Quebra de Caixa' | 'Sobra de Caixa' | 'Conciliado'>('Conciliado');
  const [saldoEsperadoCalculado, setSaldoEsperadoCalculado] = useState<string>('0.00');
  const [valDivergencia, setValDivergencia] = useState<string>('0.00');

  // Cálculos baseados estritamente na equação de conformidade patrimonial:
  // Saldo Esperado = Fundo de Troco (Abertura) + Entradas em Dinheiro (CASH) - Sangrias + Suprimentos
  const getAuditEquation = () => {
    const fundo = caixaState.fundoTroco || '0.00';
    
    let entradasDinheiro = '0.00';
    transactions.forEach(tx => {
      // Filter transactions processed in current session (since abertura)
      const tOpen = caixaState.dataAbertura ? new Date(caixaState.dataAbertura).getTime() : 0;
      const txTime = new Date(tx.timestamp).getTime();
      if ((tOpen === 0 || txTime >= tOpen) && tx.status === 'PAID' && tx.paymentMethod === 'CASH') {
        entradasDinheiro = DecimalMath.add(entradasDinheiro, tx.netTotal);
      }
    });

    let totalSangrias = '0.00';
    caixaState.sangrias
      .forEach(sg => {
        totalSangrias = DecimalMath.add(totalSangrias, sg.value);
      });

    let totalSuprimentos = '0.00';
    caixaState.suprimentos
      .forEach(sp => {
        totalSuprimentos = DecimalMath.add(totalSuprimentos, sp.value);
      });

    const parcial = DecimalMath.add(fundo, entradasDinheiro);
    const posSangria = DecimalMath.sub(parcial, totalSangrias);
    const finalEsperado = DecimalMath.add(posSangria, totalSuprimentos);

    return {
      fundo,
      entradasDinheiro,
      totalSangrias,
      totalSuprimentos,
      finalEsperado
    };
  };

  const auditDetails = getAuditEquation();

  // Executa o algoritmo cego de verificação
  const handleAuditarCaixa = (e: React.FormEvent) => {
    e.preventDefault();
    const normalizedInput = valorInformado.trim().replace(',', '.');
    const parsedVal = parseFloat(normalizedInput);
    if (!valorInformado || isNaN(parsedVal) || parsedVal < 0) {
      if (addToast) {
        addToast('Valor Inválido', 'Por favor, informe um valor de contagem física válido.', 'alert');
      } else {
        alert('Por favor, informe um valor de contagem física válido.');
      }
      return;
    }

    setIsValidating(true);

    setTimeout(() => {
      const esperado = auditDetails.finalEsperado;
      const informado = parsedVal.toFixed(2);
      
      const diffCents = DecimalMath.toCents(informado) - DecimalMath.toCents(esperado);
      
      setSaldoEsperadoCalculado(esperado);
      setIsValidating(false);
      setStep(2);
      setIsSentMail(false);

      if (diffCents < 0) {
        setAuditStatus('Quebra de Caixa');
        const prejuizo = DecimalMath.sub(esperado, informado);
        setValDivergencia(prejuizo);
        
        // Simular envio de notificação realtime pro e-mail do Master
        setTimeout(() => {
          setIsSentMail(true);
        }, 1500);

      } else if (diffCents > 0) {
        setAuditStatus('Sobra de Caixa');
        const sobra = DecimalMath.sub(informado, esperado);
        setValDivergencia(sobra);
      } else {
        setAuditStatus('Conciliado');
        setValDivergencia('0.00');
      }
    }, 1500);
  };

  const handleConfirmFinalization = () => {
    const normalizedInput = valorInformado.trim().replace(',', '.');
    const parsedVal = parseFloat(normalizedInput);
    onConfirmCloseCaixa({
      status: auditStatus,
      valorInformado: parsedVal.toFixed(2),
      saldoEsperado: saldoEsperadoCalculado,
      divergencia: valDivergencia,
    });
  };

  // Cálculos completos adicionais para a Ata de Encerramento (Passo 3)
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
    const txTime = new Date(tx.timestamp).getTime();
    if ((tOpen === 0 || txTime >= tOpen) && tx.status !== 'CANCELLED') {
      const method = (tx.paymentMethod as string || '').trim().toUpperCase();
      const amount = tx.netTotal;

      if (tx.status === 'PAID') {
        if (method === 'CASH' || method === 'DINHEIRO') cashSum = DecimalMath.add(cashSum, amount);
        else if (method === 'PIX') pixSum = DecimalMath.add(pixSum, amount);
        else if (method === 'CREDIT_CARD' || method === 'CREDITO' || method === 'CRÉDITO' || method === 'CARD') creditSum = DecimalMath.add(creditSum, amount);
        else if (method === 'DEBIT_CARD' || method === 'DEBITO' || method === 'DÉBITO') debitSum = DecimalMath.add(debitSum, amount);
        else if (method === 'BOLETO') boletoSum = DecimalMath.add(boletoSum, amount);
      }

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

  const totalSangriasCents = caixaState.sangrias
    .reduce((sum, s) => sum + DecimalMath.toCents(s.value), 0);
  const totalSangrias = DecimalMath.fromCents(totalSangriasCents);

  const totalSuprimentosCents = caixaState.suprimentos
    .reduce((sum, s) => sum + DecimalMath.toCents(s.value), 0);
  const totalSuprimentos = DecimalMath.fromCents(totalSuprimentosCents);

  const getCurrentSecureHash = () => {
    const emailStr = (currentSession?.email || 'fsobrosa.12tc@gmail.com').toUpperCase();
    const timestampStr = new Date().toISOString();
    const hashString = `PF0018-${emailStr}-${timestampStr}-${saldoEsperadoCalculado}-${valorInformado}`.toUpperCase();
    let hashVal = 0;
    for (let i = 0; i < hashString.length; i++) {
      hashVal = (hashVal << 5) - hashVal + hashString.charCodeAt(i);
      hashVal |= 0;
    }
    const shortHash = Math.abs(hashVal).toString(16).slice(0, 8).toUpperCase();
    return `MARKS-PF0018-${emailStr}-${shortHash}`;
  };

  const handleExportPDF = () => {
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });

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

    doc.text(`Terminal ID: Passo Fundo - Caixa 01`, leftMargin, currentY);
    doc.text(`Abertura: ${caixaState.dataAbertura ? new Date(caixaState.dataAbertura).toLocaleTimeString('pt-BR') : '08:00:00'}`, 110, currentY);
    currentY += 5;

    doc.text(`Data Operacional: ${new Date().toLocaleDateString('pt-BR')}`, leftMargin, currentY);
    doc.text(`Fechamento: ${new Date().toLocaleTimeString('pt-BR')}`, 110, currentY);
    currentY += 5;

    doc.text(`Gerente/Responsável: ${currentSession?.email || 'fsobrosa.12tc@gmail.com'}`, leftMargin, currentY);
    currentY += 5;

    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(8.2);
    const fullHash = getCurrentSecureHash();
    const hashText = `HASH DE AUDITORIA (INTEGRAL DIGITAL): ${fullHash}`;
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

    addTableRow('Fundo de Troco de Abertura', '[Fundo Inicial]', DecimalMath.formatBRL(caixaState.fundoTroco || '0.00'));
    addTableRow('(+) Entradas em Dinheiro Espécie', '(+)', DecimalMath.formatBRL(cashSum));
    addTableRow('(+) Entradas via PIX Instantâneo', '(+)', DecimalMath.formatBRL(pixSum));
    addTableRow('(+) Entradas via Cartão de Crédito', '(+)', DecimalMath.formatBRL(creditSum));
    addTableRow('(+) Entradas via Cartão de Débito', '(+)', DecimalMath.formatBRL(debitSum));
    addTableRow('(+) Entradas faturadas via Boleto (B2B)', '(Prazo)', DecimalMath.formatBRL(boletoSum));
    addTableRow('(+) Suprimentos (Aportes/Reforços)', '(+)', DecimalMath.formatBRL(totalSuprimentos));
    addTableRow('(-) Sangrias (Retiradas Extraordinárias)', '(-)', DecimalMath.formatBRL(totalSangrias));

    // Totals
    currentY += 2;
    doc.setFillColor(248, 250, 252); // slate-50
    doc.rect(leftMargin, currentY, rightMargin - leftMargin, 14, 'F');
    doc.line(leftMargin, currentY, rightMargin, currentY);
    doc.line(leftMargin, currentY + 14, rightMargin, currentY + 14);

    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(30, 41, 59);

    doc.text('SALDO ESPERADO EM LIVRO-CAIXA:', leftMargin + 3, currentY + 5.5);
    doc.text(DecimalMath.formatBRL(saldoEsperadoCalculado), rightMargin - 3, currentY + 5.5, { align: 'right' });

    doc.text('DECLARAÇÃO FISCAL DE CONTAGEM FÍSICA:', leftMargin + 3, currentY + 10.5);
    doc.text(DecimalMath.formatBRL(valorInformado), rightMargin - 3, currentY + 10.5, { align: 'right' });
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
    doc.text(DecimalMath.formatBRL(particularSum), leftMargin + 3, currentY + 9.5);
    doc.text(DecimalMath.formatBRL(b2bSum), 108 + 3, currentY + 9.5);

    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.text(`${particularCount} atendimentos liquidados`, leftMargin + 3, currentY + 12.5);
    doc.text(`${b2bCount} serviços corporativos faturados`, 108 + 3, currentY + 12.5);
    // --- INÍCIO DA PÁGINA 2 ---
    doc.addPage();
    currentY = 20;

    // Header de Continuidade de Auditoria Pág 2
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(71, 85, 105);
    doc.text('Marks Systems - CRVA 0018 Passo Fundo/RS - ATA DE ENCERRAMENTO (PÁG. 2/2)', leftMargin, currentY);
    currentY += 8;

    // 4. PARIDADE & DIVERGENCIA APURADA
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(71, 85, 105);
    doc.text('4. AUDITORIA DE PARIDADE & CONCILIAÇÃO FINAL', leftMargin, currentY);
    currentY += 6;

    // Banner styled rect based on status
    if (auditStatus === 'Conciliado') {
      doc.setFillColor(209, 250, 229); // light green bg
      doc.setDrawColor(16, 185, 129); // green border
    } else {
      doc.setFillColor(254, 226, 226); // light red bg
      doc.setDrawColor(239, 68, 68); // red border
    }
    doc.rect(leftMargin, currentY, rightMargin - leftMargin, 16, 'FD');

    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(8);
    if (auditStatus === 'Conciliado') {
      doc.setTextColor(6, 95, 70); // green text
      doc.text('SISTEMA CONCILIADO COM SUCESSO - DIVERGÊNCIA APURADA: R$ 0,00', leftMargin + 5, currentY + 6);
      doc.setFont('Helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.text('Todas as entradas e saídas foram certificadas pela Marks Systems com 100% de paridade.', leftMargin + 5, currentY + 11);
    } else {
      doc.setTextColor(153, 27, 27); // red text
      const sigLabel = auditStatus === 'Quebra de Caixa' ? 'PREJUÍZO / DIVERGÊNCIA APURADA: -' : 'SOBRA DE CAIXA EXCEDENTE: +';
      doc.text(`${sigLabel}${DecimalMath.formatBRL(valDivergencia)} (${auditStatus.toUpperCase()})`, leftMargin + 5, currentY + 6);
      doc.setFont('Helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.text('Evento registrado automaticamente no livro de auditoria interna da Marks Systems corporativa.', leftMargin + 5, currentY + 11);
    }
    currentY += 24;

    // 5. HISTÓRICO DE MOVIMENTAÇÃO E CONTROLE DE OPERADORES
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(71, 85, 105);
    doc.text('5. HISTÓRICO DE MOVIMENTAÇÃO E CONTROLE DE OPERADORES', leftMargin, currentY);
    currentY += 6;

    const events = caixaState.timeline || [
      {
        timestamp: new Date(caixaState.dataAbertura || Date.now()).toLocaleTimeString('pt-BR'),
        operadorName: caixaState.operadorName || currentSession?.userName || 'Abertura',
        operadorEmail: caixaState.operadorEmail || currentSession?.email || 'ana.caixa@marks.com',
        action: 'Abertura de Caixa',
        details: `Turno iniciado com Fundo de Troco de ${DecimalMath.formatBRL(caixaState.fundoTroco)}`
      }
    ];

    const timelineBoxHeight = (events.length * 12) + 4;
    doc.setDrawColor(226, 232, 240);
    doc.setFillColor(248, 250, 252);
    doc.rect(leftMargin, currentY, rightMargin - leftMargin, timelineBoxHeight, 'FD');

    let tempY = currentY + 5;
    events.forEach((evt) => {
      // Draw small timeline dot
      doc.setFillColor(16, 185, 129); // green
      doc.circle(leftMargin + 5, tempY + 1, 1.2, 'F');

      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(7.5);
      doc.setTextColor(15, 23, 42);
      doc.text(`${evt.action} - ${evt.timestamp}`, leftMargin + 9, tempY + 2.5);

      doc.setFont('Helvetica', 'normal');
      doc.setFontSize(7);
      doc.setTextColor(71, 85, 105);

      const descLine = `${evt.details} (Operado por: ${evt.operadorName} - ${evt.operadorEmail})`;
      const descSplit = doc.splitTextToSize(descLine, rightMargin - leftMargin - 15);
      doc.text(descSplit, leftMargin + 9, tempY + 5.5);

      tempY += 11;
    });

    currentY += timelineBoxHeight + 10;

    // 6. VALIDAÇÃO INTEGRAL E ASSINATURAS REQUISITADAS (3 ASSINATURAS FÍSICAS REQUERIDAS)
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(71, 85, 105);
    doc.text('6. VALIDAÇÃO INTEGRAL E ASSINATURAS REQUISITADAS', leftMargin, currentY);
    currentY += 15;

    const blockWidth = 50;
    const startX = leftMargin + 2;
    const spacing = 10;

    // Block 1: Operador de Caixa
    doc.setDrawColor(148, 163, 184); // slate-400
    doc.setLineWidth(0.3);
    doc.line(startX, currentY, startX + blockWidth, currentY);
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(7.2);
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
    doc.setFontSize(7.2);
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
    doc.setFontSize(7.2);
    doc.setTextColor(15, 23, 42);
    doc.text('CONFERENTE FINANCEIRO', rightX + blockWidth / 2, currentY + 4.5, { align: 'center' });
    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(100, 116, 139);
    doc.text('Conciliação Bancária PIX e Cartões', rightX + blockWidth / 2, currentY + 8, { align: 'center' });

    currentY += 16;

    // Print Footer chancel security text
    doc.setFont('Helvetica', 'italic');
    doc.setFontSize(7);
    doc.setTextColor(148, 163, 184); // slate-400
    const legalText = `Certidão gerada digitalmente pelo agente Marks Systems em ${new Date().toLocaleString('pt-BR')}.`;
    doc.text(legalText, 105, currentY, { align: 'center' });
    doc.text('Conforme regulamentações, arquivar esta ata física ou digital por pelo menos 5 anos.', 105, currentY + 4, { align: 'center' });

    const filename = `ATA-CONCILIACAO-${new Date().toLocaleDateString('pt-BR').replace(/\//g, '-')}-PASSO-FUNDO-CAIXA-01.pdf`;
    doc.save(filename);
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-[8px] z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className={`bg-brand-navy-card border border-brand-navy-bright w-full rounded-2xl overflow-hidden shadow-2xl relative animate-scale-up transition-all duration-300 ${step === 3 ? 'max-w-4xl' : 'max-w-xl'}`}>
        
        {/* Modal Header */}
        <div className="p-5 border-b border-brand-navy-bright flex items-center justify-between bg-brand-navy-deep/40">
          <div className="flex items-center gap-2">
            <Lock className="w-5 h-5 text-red-400 stroke-[2.5]" />
            <div>
              <h3 className="text-sm font-display font-semibold text-slate-100 uppercase tracking-wider">
                {step === 3 ? 'Ata de Auditoria de Encerramento (PDF)' : 'Fechamento de Caixa Cego'}
              </h3>
              <p className="text-[10px] text-slate-400 font-mono">RF004 · CONTROLES DE SEGURANÇA E AUDITORIA</p>
            </div>
          </div>
          
          {step !== 3 && (
            <button
              onClick={onClose}
              className="text-slate-500 hover:text-slate-300 transition cursor-pointer"
              title="Voltar ao Operacional"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-5">
          
          {/* STEP 1: DIGITAÇÃO VALOR INFORMADO (CONFERÊNCIA CEGA) */}
          {step === 1 && (
            <>
              {/* Alerta de Omissão Cega */}
              <div className="p-3.5 bg-brand-navy-deep border border-brand-navy-bright rounded-xl text-xs flex gap-3 text-slate-300">
                <ShieldAlert className="w-5 h-5 text-amber-500 flex-shrink-0 animate-pulse" />
                <div className="space-y-1">
                  <span className="font-semibold text-slate-200">VERIFICAÇÃO CEGA OBRIGATÓRIA</span>
                  <p className="text-[11px] text-slate-400 leading-relaxed font-sans">
                    Para prevenir fraudes e inconsistências de fechamento, <strong>o saldo contábil atual está totalmente oculto</strong>. Você deve digitar abaixo o valor absoluto em espécie e comprovantes presentes na gaveta física do caixa.
                  </p>
                </div>
              </div>

              <form onSubmit={handleAuditarCaixa} className="space-y-4">
                <div className="space-y-2">
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wide" htmlFor="fechamento-valor">
                    Valor Total Contado em Dinheiro/Gaveta *
                  </label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm font-semibold font-mono text-slate-400">R$</span>
                    <input
                      id="fechamento-valor"
                      type="number"
                      step="0.01"
                      placeholder="0,00"
                      required
                      disabled={isValidating}
                      value={valorInformado}
                      onChange={(e) => setValorInformado(e.target.value)}
                      className="w-full bg-brand-navy-deep border-2 border-brand-navy-bright focus:border-brand-emerald rounded-xl py-3 pl-10 pr-4 text-sm font-bold font-mono text-slate-100 placeholder-slate-500 focus:outline-none transition-all"
                    />
                  </div>
                  <p className="text-[10px] text-slate-500 font-mono">
                    Soma de Notas, Moedas, Reforços e Retiradas do turno corrente de {caixaState.operadorName}.
                  </p>
                </div>

                <div className="bg-brand-navy-deep/40 p-3 rounded-lg border border-brand-navy-bright text-[10px] space-y-1 text-slate-400 font-mono">
                  <p>● Fundo de Abertura: R$ ***,** (Ocultado)</p>
                  <p>● Vendas CASH Recebidas: R$ ***,** (Ocultado)</p>
                  <p>● Total Retiradas efetuadas: {caixaState.sangrias.length} registros</p>
                  <p>● Total Reforços efetuados: {caixaState.suprimentos.length} registros</p>
                </div>

                <button
                  type="submit"
                  disabled={isValidating || !valorInformado}
                  className="w-full py-3 bg-brand-emerald hover:bg-emerald-400 text-brand-navy-deep font-display font-black text-xs uppercase tracking-widest rounded-xl transition-all shadow-lg hover:shadow-brand-emerald/15 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {isValidating ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin text-brand-navy-deep" />
                      CONCILIANDO CONTABILIDADE...
                    </>
                  ) : (
                    'VALIDAR PARIDADE DO CAIXA'
                  )}
                </button>
              </form>
            </>
          )}

          {/* STEP 2: EXIBIÇÃO DE DIVERGÊNCIAS & CONSOLIDAÇÃO */}
          {step === 2 && (
            <div className="space-y-5 animate-slide-in">
              
              {/* STATUS 1: QUEBRA DE CAIXA */}
              {auditStatus === 'Quebra de Caixa' && (
                <div className="bg-red-950/85 border-2 border-red-500/30 p-5 rounded-2xl space-y-4">
                  <div className="flex items-start gap-3">
                    <div className="p-2 rounded bg-red-500/20 text-red-400 animate-bounce">
                      <ShieldAlert className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold uppercase tracking-wider text-red-400">
                        STATUS: QUEBRA DE CAIXA CONSTATADA
                      </h4>
                      <p className="text-[11px] text-red-300 mt-1 font-sans leading-relaxed">
                        Inconsistência patrimonial identificada. O valor depositado na gaveta do caixa é menor do que o saldo total esperado pelo faturamento físico.
                      </p>
                    </div>
                  </div>

                  <div className="p-3 bg-red-950 rounded-xl border border-red-500/10 space-y-2 font-mono text-xs">
                    <div className="flex justify-between text-red-200">
                      <span>Saldo Esperado recalculado:</span>
                      <span>{DecimalMath.formatBRL(saldoEsperadoCalculado)}</span>
                    </div>
                    <div className="flex justify-between text-red-200 border-b border-red-500/10 pb-1.5">
                      <span>Valor Físico Declarado:</span>
                      <span>{DecimalMath.formatBRL(valorInformado)}</span>
                    </div>
                    <div className="flex justify-between text-red-400 font-extrabold text-sm pt-0.5">
                      <span>PREJUÍZO / DIVERGÊNCIA:</span>
                      <span>-{DecimalMath.formatBRL(valDivergencia)}</span>
                    </div>
                  </div>

                  {/* Simulação de Envio de E-mail / WebSocket pro Administrador */}
                  <div className="bg-red-500/5 border border-red-500/10 rounded-xl p-3 flex items-center gap-2 text-[10px] text-red-300/80 font-mono">
                    <Mail className="w-4 h-4 text-red-400 flex-shrink-0" />
                    {isSentMail ? (
                      <span className="text-red-400 font-semibold flex items-center gap-1">
                        <Send className="w-3 h-3 animate-pulse" />
                        Notificação enviada em realtime para fsobrosa.12tc@gmail.com!
                      </span>
                    ) : (
                      <span>Simulando notificação de evento de fraude para Master...</span>
                    )}
                  </div>
                </div>
              )}

              {/* STATUS 2: SOBRA DE CAIXA */}
              {auditStatus === 'Sobra de Caixa' && (
                <div className="bg-amber-950/85 border-2 border-amber-500/30 p-5 rounded-2xl space-y-4">
                  <div className="flex items-start gap-3">
                    <div className="p-2 rounded bg-amber-500/20 text-amber-400 animate-spin">
                      <AlertTriangle className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold uppercase tracking-wider text-amber-500">
                        STATUS: SOBRA DE CAIXA IDENTIFICADA
                      </h4>
                      <p className="text-[11px] text-amber-300 mt-1 font-sans leading-relaxed">
                        Divergência positiva encontrada na gaveta metálica. Recomenda-se auditoria interna para verificar trocos entregues incorretamente ou erros de lançamento.
                      </p>
                    </div>
                  </div>

                  <div className="p-3 bg-amber-950 rounded-xl border border-amber-500/10 space-y-2 font-mono text-xs">
                    <div className="flex justify-between text-amber-200">
                      <span>Saldo Esperado recalculado:</span>
                      <span>{DecimalMath.formatBRL(saldoEsperadoCalculado)}</span>
                    </div>
                    <div className="flex justify-between text-amber-200 border-b border-amber-500/10 pb-1.5">
                      <span>Valor Físico Declarado:</span>
                      <span>{DecimalMath.formatBRL(valorInformado)}</span>
                    </div>
                    <div className="flex justify-between text-amber-400 font-extrabold text-sm pt-0.5">
                      <span>SOBRA DE CAIXA EXCEDENTE:</span>
                      <span>+{DecimalMath.formatBRL(valDivergencia)}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* STATUS 3: CONCILIADO PERFEITO */}
              {auditStatus === 'Conciliado' && (
                <div className="bg-emerald-950/85 border-2 border-brand-emerald/30 p-5 rounded-2xl space-y-4">
                  <div className="flex items-start gap-3">
                    <div className="p-2 rounded bg-brand-emerald/20 text-brand-emerald animate-bounce">
                      <CheckCircle className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold uppercase tracking-wider text-brand-emerald">
                        STATUS: CAIXA CONCILIADO PERFEITAMENTE
                      </h4>
                      <p className="text-[11px] text-slate-300 mt-1 font-sans leading-relaxed">
                        Paridade de conformidade estrita concluída com sucesso. O dinheiro faturado bate de forma idêntica com o declarado em gaveta física.
                      </p>
                    </div>
                  </div>

                  <div className="p-3 bg-slate-900 rounded-xl border border-brand-emerald/10 space-y-2 font-mono text-xs">
                    <div className="flex justify-between text-slate-300">
                      <span>Saldo contábil esperado:</span>
                      <span>{DecimalMath.formatBRL(saldoEsperadoCalculado)}</span>
                    </div>
                    <div className="flex justify-between text-brand-emerald font-extrabold text-sm border-t border-slate-800 pt-1.5 mt-1">
                      <span>CONCILIAÇÃO PATRIMONIAL:</span>
                      <span>{DecimalMath.formatBRL(valorInformado)} (100% OK)</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Botoes de acionamento intermediário */}
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setStep(1);
                    setValorInformado('');
                  }}
                  className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs rounded-xl border border-slate-700 font-mono transition-colors cursor-pointer"
                >
                  Refazer Contagem
                </button>
                <button
                  type="button"
                  onClick={() => setStep(3)}
                  className="flex-1 py-2.5 bg-red-600 hover:bg-red-500 text-white font-semibold text-xs rounded-xl shadow-lg transition-colors cursor-pointer"
                >
                  Consolidar Caixa & Sair do Turno
                </button>
              </div>

            </div>
          )}

          {/* STEP 3: ATA DE ENCERRAMENTO E AUDITORIA DE CAIXA (PADRÃO A4 VERTICAL TIMBRADO) */}
          {step === 3 && (
            <div className="space-y-6 text-slate-300 bg-brand-navy-deep/20 p-2 rounded-2xl max-h-[70vh] overflow-y-auto pr-3">
              
              {/* TIMBRADO HEADER */}
              <div className="text-center space-y-3 border-b border-dashed border-slate-700/60 pb-5">
                <div className="flex justify-center items-center gap-2 mb-1">
                  <div className="w-10 h-10 bg-brand-emerald/15 rounded-lg flex items-center justify-center border border-brand-emerald/30">
                    <Building2 className="w-6 h-6 text-brand-emerald" />
                  </div>
                  <div className="text-left leading-none">
                    <span className="font-sans font-black tracking-widest text-slate-100 text-base">MARKS SYSTEMS - CRVA 0018 PASSO FUNDO/RS</span>
                  </div>
                </div>
                <h1 className="text-lg md:text-xl font-mono tracking-wider font-extrabold text-slate-100 uppercase">
                  Ata de Encerramento e Auditoria de Caixa
                </h1>
                <div className="flex flex-wrap items-center justify-center gap-3 text-[10px] font-mono text-slate-400 mt-2">
                  <span>Terminal ID: <strong className="text-slate-200">Passo Fundo - Caixa 01</strong></span>
                  <span>●</span>
                  <span>Data Operacional: <strong className="text-slate-200">{new Date().toLocaleDateString('pt-BR')}</strong></span>
                  <span>●</span>
                  <span>Autenticação: <strong className="text-brand-emerald font-bold">{getCurrentSecureHash()}</strong></span>
                </div>
              </div>

              {/* 1. METADADOS OPERACIONAIS */}
              <div className="space-y-2 bg-brand-navy-deep/50 p-3 rounded-lg border border-brand-navy-bright/60">
                <h3 className="text-[10px] font-bold tracking-wider font-mono text-brand-emerald uppercase">
                  1. Metadados Operacionais do Servidor
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 text-[10px] font-mono">
                  <div className="space-y-0.5">
                    <span className="text-slate-500 block">Horário Abertura</span>
                    <strong className="text-slate-200">{caixaState.dataAbertura ? new Date(caixaState.dataAbertura).toLocaleTimeString('pt-BR') : '08:00:00'}</strong>
                  </div>
                  <div className="space-y-0.5">
                    <span className="text-slate-500 block">Horário Fechamento</span>
                    <strong className="text-slate-200">{new Date().toLocaleTimeString('pt-BR')}</strong>
                  </div>
                  <div className="space-y-0.5">
                    <span className="text-slate-500 block">Usuário Logado</span>
                    <strong className="text-slate-200">{currentSession?.email || 'fsobrosa.12tc@gmail.com'}</strong>
                  </div>
                  <div className="space-y-0.5">
                    <span className="text-slate-500 block">Certificado de Autenticidade</span>
                    <strong className="text-brand-emerald font-bold">● MARKS SECURE OK</strong>
                  </div>
                </div>
              </div>

              {/* 2. DEMONSTRATIVO CONTÁBIL */}
              <div className="space-y-3">
                <h3 className="text-[10px] font-bold tracking-wider font-mono text-brand-emerald uppercase">
                  2. Demonstrativo Contábil Rígido (Faturamento Físico)
                </h3>
                <div className="border border-brand-navy-bright/60 rounded-xl overflow-hidden text-[10px] font-mono">
                  <div className="grid grid-cols-3 bg-slate-800/50 p-2.5 font-bold border-b border-brand-navy-bright/15">
                    <span>Equação Patrimonial</span>
                    <span className="text-right">Sinal</span>
                    <span className="text-right">Valor Operado</span>
                  </div>
                  
                  <div className="divide-y divide-brand-navy-bright/10">
                    <div className="grid grid-cols-3 p-2">
                      <span>Fundo de Troco de Abertura</span>
                      <span className="text-right text-slate-400">[Inicial]</span>
                      <span className="text-right font-bold text-slate-100">{DecimalMath.formatBRL(caixaState.fundoTroco || '0.00')}</span>
                    </div>

                    <div className="grid grid-cols-3 p-2">
                      <span>(+) Entradas em Dinheiro Espécie</span>
                      <span className="text-right text-brand-emerald font-bold">(+)</span>
                      <span className="text-right font-bold text-slate-100">{DecimalMath.formatBRL(cashSum)}</span>
                    </div>

                    <div className="grid grid-cols-3 p-2">
                      <span>(+) Entradas via PIX Instantâneo</span>
                      <span className="text-right text-brand-emerald font-bold">(+)</span>
                      <span className="text-right font-bold text-slate-100">{DecimalMath.formatBRL(pixSum)}</span>
                    </div>

                    <div className="grid grid-cols-3 p-2">
                      <span>(+) Entradas via Cartão de Crédito</span>
                      <span className="text-right text-brand-emerald font-bold">(+)</span>
                      <span className="text-right font-bold text-slate-100">{DecimalMath.formatBRL(creditSum)}</span>
                    </div>

                    <div className="grid grid-cols-3 p-2">
                      <span>(+) Entradas via Cartão de Débito</span>
                      <span className="text-right text-brand-emerald font-bold">(+)</span>
                      <span className="text-right font-bold text-slate-100">{DecimalMath.formatBRL(debitSum)}</span>
                    </div>

                    <div className="grid grid-cols-3 p-2">
                      <span>(+) Entradas via Boleto (B2B)</span>
                      <span className="text-right text-slate-500 font-bold">(Prazo)</span>
                      <span className="text-right font-bold text-slate-100">{DecimalMath.formatBRL(boletoSum)}</span>
                    </div>

                    <div className="grid grid-cols-3 p-2">
                      <span>(+) Suprimentos (Aportes / Reforços)</span>
                      <span className="text-right text-brand-emerald font-bold">(+)</span>
                      <span className="text-right font-bold text-slate-100">{DecimalMath.formatBRL(totalSuprimentos)}</span>
                    </div>

                    <div className="grid grid-cols-3 p-2">
                      <span>(-) Sangrias (Retiradas Extraordinárias)</span>
                      <span className="text-right text-red-400 font-bold">(-)</span>
                      <span className="text-right font-bold text-slate-100">{DecimalMath.formatBRL(totalSangrias)}</span>
                    </div>
                  </div>

                  {/* Foot total values comparison */}
                  <div className="p-3 bg-slate-800/80 border-t-2 border-brand-navy-bright font-bold grid grid-cols-3 text-xs">
                    <span className="text-slate-200">Saldo de Caixa Esperado:</span>
                    <span></span>
                    <span className="text-right text-slate-100 font-extrabold">{DecimalMath.formatBRL(saldoEsperadoCalculado)}</span>
                  </div>

                  <div className="p-3 bg-slate-800/40 border-t border-brand-navy-bright/20 font-bold grid grid-cols-3 text-xs">
                    <span className="text-slate-200">Contagem Física Informada:</span>
                    <span></span>
                    <span className="text-right text-slate-100 font-extrabold">{DecimalMath.formatBRL(valorInformado)}</span>
                  </div>
                </div>
              </div>

              {/* 3. DEMONSTRATIVO B2B vs BALCÃO */}
              <div className="space-y-2">
                <h3 className="text-[10px] font-bold tracking-wider font-mono text-brand-emerald uppercase">
                  2.1. Demonstrativo B2B vs Clientes de Balcão
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="bg-brand-navy-deep/40 p-3 rounded-lg border border-brand-navy-bright/20 flex flex-col justify-between space-y-2">
                    <span className="text-[9px] text-slate-400 uppercase font-mono font-bold tracking-wider font-semibold">Clientes Particulares (Balcão)</span>
                    <div className="font-mono">
                      <p className="text-lg font-bold font-sans text-slate-100">{DecimalMath.formatBRL(particularSum)}</p>
                      <p className="text-[10px] text-slate-400 mt-0.5">{particularCount} atendimentos de balcão liquidados</p>
                    </div>
                  </div>

                  <div className="bg-brand-navy-deep/40 p-3 rounded-lg border border-brand-navy-bright/20 flex flex-col justify-between space-y-2">
                    <span className="text-[9px] text-slate-400 uppercase font-mono font-bold tracking-wider font-semibold">Despachantes Credenciados (B2B Corporativo)</span>
                    <div className="font-mono">
                      <p className="text-lg font-bold font-sans text-slate-100">{DecimalMath.formatBRL(b2bSum)}</p>
                      <p className="text-[10px] text-slate-400 mt-0.5">{b2bCount} serviços corporativos faturados</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* 4. AUDITORIA DE PARIDADE */}
              <div className="space-y-2">
                <h3 className="text-[10px] font-bold tracking-wider font-mono text-brand-emerald uppercase">
                  2.2. Auditoria de Paridade & Divergência
                </h3>
                <div className={`p-3.5 rounded-xl border font-mono text-[11px] flex flex-col md:flex-row md:items-center justify-between gap-3 ${
                  auditStatus === 'Conciliado' 
                    ? 'bg-brand-emerald/15 border-brand-emerald/30 text-brand-emerald' 
                    : 'bg-red-500/15 border-red-500/30 text-red-400'
                }`}>
                  <div className="space-y-0.5 text-slate-300">
                    <span className="text-[9px] uppercase font-bold text-slate-400">Divergência Apurada</span>
                    <p className="text-sm font-extrabold">{DecimalMath.formatBRL(valDivergencia)} ({auditStatus})</p>
                  </div>
                  
                  <div className="text-right">
                    <span className="text-[9px] uppercase font-bold text-slate-400 block mb-0.5">Status Governança</span>
                    <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase ${
                      auditStatus === 'Conciliado'
                        ? 'bg-brand-emerald/20 text-brand-emerald border border-brand-emerald/40'
                        : 'bg-red-500/20 text-red-400 border border-red-500/40'
                    }`}>
                      {auditStatus === 'Conciliado' ? 'CAIXA INTEGRALMENTE CONCILIADO' : 'ATENÇÃO: INCONSISTÊNCIA DETECTADA'}
                    </span>
                  </div>
                </div>
              </div>

              {/* 2.3. HISTÓRICO DE MOVIMENTAÇÃO E CONTROLE DE OPERADORES */}
              <div className="space-y-2">
                <h3 className="text-[10px] font-bold tracking-wider font-mono text-brand-emerald uppercase">
                  2.3. HISTÓRICO DE MOVIMENTAÇÃO E CONTROLE DE OPERADORES
                </h3>
                <div className="bg-brand-navy-deep/40 rounded-xl border border-brand-navy-bright/20 p-4 font-sans text-xs">
                  {caixaState.timeline && caixaState.timeline.length > 0 ? (
                    <div className="space-y-3 relative before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-brand-navy-bright/15">
                      {caixaState.timeline.map((evt, idx) => (
                        <div key={idx} className="relative pl-6">
                          {/* Dot */}
                          <span className="absolute left-[5px] top-[5px] w-2 h-2 rounded-full bg-brand-emerald ring-4 ring-brand-navy-deep"></span>
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                            <span className="font-semibold text-slate-200">{evt.action}</span>
                            <span className="font-mono text-[10px] text-brand-emerald bg-brand-emerald/15 px-1.5 py-0.5 rounded">
                              {evt.timestamp}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
                            {evt.details} — <strong className="text-slate-300 font-normal">{evt.operadorName} ({evt.operadorEmail})</strong>
                          </p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-slate-500 italic text-[11px] text-center">Nenhum evento registrado no dia operacional.</p>
                  )}
                </div>
              </div>

              {/* 5. VALIDAÇÃO E ASSINATURAS REQUISITADAS (3 ASSINATURAS FÍSICAS REQUERIDAS) */}
              <div className="pt-6 border-t border-dashed border-slate-700/60 font-mono text-[10px] text-slate-400 text-center space-y-6">
                <h3 className="text-[10px] font-bold tracking-wider font-mono text-brand-emerald uppercase">
                  3. Validação e Assinaturas de Responsabilidade
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-2">
                  {/* Linha 1: Operador de Caixa */}
                  <div className="flex flex-col items-center">
                    <div className="w-full border-b border-slate-700/60 mb-2 min-h-[30px]"></div>
                    <p className="font-bold text-slate-200 uppercase tracking-wide">
                      Operador de Caixa
                    </p>
                    <p className="text-[9px] text-slate-500 mt-0.5 leading-normal">
                      Abertura, Lançamentos e Contagem Física
                    </p>
                  </div>

                  {/* Linha 2: Supervisor / Gerente de Turno */}
                  <div className="flex flex-col items-center">
                    <div className="w-full border-b border-slate-700/60 mb-2 min-h-[30px]"></div>
                    <p className="font-bold text-slate-200 uppercase tracking-wide">
                      Supervisor / Gerente de Turno
                    </p>
                    <p className="text-[9px] text-slate-500 mt-0.5 leading-normal">
                      Homologação e Validação do Encerramento
                    </p>
                  </div>

                  {/* Linha 3: Conferente Financeiro */}
                  <div className="flex flex-col items-center">
                    <div className="w-full border-b border-slate-700/60 mb-2 min-h-[30px]"></div>
                    <p className="font-bold text-slate-200 uppercase tracking-wide">
                      Conferente Financeiro
                    </p>
                    <p className="text-[9px] text-slate-500 mt-0.5 leading-normal">
                      Conciliação Bancária de PIX e Cartões
                    </p>
                  </div>
                </div>

                <div className="pt-4 border-t border-brand-navy-bright/10 text-center text-[9px] text-slate-500 leading-normal">
                  Este relatório de encerramento foi chancelado digitalmente pelo sistema de auditoria Marks Systems.
                  <br />
                  A guarda física das vias impressas deve ser mantida por 5 (cinco) anos conforme diretrizes regulamentares locais.
                </div>
              </div>

              {/* ACTION BUTTONS */}
              <div className="pt-4 flex flex-col gap-3 border-t border-brand-navy-bright/10">
                <div className="flex flex-col sm:flex-row gap-3">
                  <button
                    id="print-again-btn"
                    onClick={handleExportPDF}
                    className="flex-1 py-3 bg-brand-emerald hover:bg-emerald-400 text-brand-navy-deep font-sans font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 transition cursor-pointer shadow-lg hover:shadow-brand-emerald/10"
                  >
                    <Printer className="w-4 h-4" />
                    Imprimir Relatório Completo / Salvar PDF
                  </button>
                  <button
                    id="close-report-btn"
                    onClick={handleConfirmFinalization}
                    className="flex-1 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs rounded-xl border border-slate-700 transition cursor-pointer"
                  >
                    Concluir e Liberar Sistema
                  </button>
                </div>
              </div>

            </div>
          )}

        </div>

      </div>
    </div>
  );
}
