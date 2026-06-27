/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { KeyRound, Radio, ShieldCheck, DollarSign, Calendar, Clock, AlertTriangle, Play, LogOut } from 'lucide-react';
import { RlsSession } from '../types';

interface AberturaCaixaModalProps {
  currentSession: RlsSession;
  onOpenCaixaSuccess: (fundoTroco: string, timestamp: string) => void;
  onLogout?: () => void;
}

export default function AberturaCaixaModal({ currentSession, onOpenCaixaSuccess, onLogout }: AberturaCaixaModalProps) {
  const [fundoTroco, setFundoTroco] = useState('');
  const [inputError, setInputError] = useState('');
  const [automaticTime, setAutomaticTime] = useState('');

  // 100% automatic derived date and time clock
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      const formatted = now.toLocaleString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
      });
      setAutomaticTime(formatted);
    };

    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setInputError('');

    // Clean value using absolute sanitization
    let rawVal = fundoTroco;
    // Remove "R$" symbol
    rawVal = rawVal.replace(/R\$/g, '');
    // Remove white spaces
    rawVal = rawVal.replace(/\s+/g, '');
    
    if (/^\d+$/.test(rawVal)) {
      rawVal = `${rawVal}.00`;
    } else {
      const parts = rawVal.split(',');
      if (parts.length === 2) {
        const integerPart = parts[0].replace(/\./g, '');
        const decimalPart = parts[1].slice(0, 2).padEnd(2, '0');
        rawVal = `${integerPart}.${decimalPart}`;
      } else {
        rawVal = rawVal.replace(/\./g, '');
      }
    }

    const parsed = parseFloat(rawVal);
    if (isNaN(parsed) || parsed < 0) {
      setInputError('Por favor, informe um valor de fundo de troco válido (ex: 150,00).');
      return;
    }

    // Call success handler
    // Returns string normalized with dot as decimal separator
    onOpenCaixaSuccess(parsed.toFixed(2), new Date().toISOString());
  };

  return (
    <div className="fixed inset-0 z-50 bg-brand-navy-deep/95 backdrop-blur-md flex items-center justify-center p-4">
      
      {/* Absolute glow design layer */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-brand-emerald/10 rounded-full filter blur-[120px] pointer-events-none" />

      <div className="bg-brand-navy-card border border-brand-navy-bright/80 w-full max-w-lg rounded-2xl shadow-2xl relative overflow-hidden flex flex-col">
        
        {/* Top styling accent */}
        <div className="h-1.5 w-full bg-gradient-to-r from-brand-emerald to-brand-accent" />

        <div className="p-6 flex-1 flex flex-col justify-between">
          
          {/* Header */}
          <div>
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-lg bg-brand-emerald/15 border border-brand-emerald/30 text-brand-emerald">
                <KeyRound className="w-6 h-6 animate-pulse" />
              </div>
              <div>
                <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-brand-navy-bright border border-slate-700/60 text-slate-400 font-semibold tracking-wider">
                  RF001 · Requisito Obrigatório
                </span>
                <h2 className="text-xl font-display font-bold text-slate-100 tracking-tight mt-0.5">
                  Abertura de Caixa & Turno Operacional
                </h2>
              </div>
            </div>

            {/* Block message alert */}
            <div className="mt-5 p-4 bg-amber-500/10 border border-amber-500/20 text-slate-300 rounded-xl text-xs space-y-2 leading-relaxed">
              <div className="flex items-center gap-2 text-amber-500 font-bold font-mono uppercase tracking-wider text-[10px]">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>Bloqueio Sistemático de Segurança</span>
              </div>
              <p>
                O terminal de ponto de venda do despachante encontra-se <strong>FECHADO</strong>. Declare o fundo de caixa (fundo de troco) disponível fisicamente na gaveta para auditoria de conciliação diária antes de liberar as vendas.
              </p>
            </div>

            {/* Locked dynamic security strip */}
            <div className="mt-4 flex items-center justify-between text-[11px] font-mono bg-brand-navy-deep/80 p-2.5 border border-slate-800 rounded-lg text-slate-400">
              <span className="flex items-center gap-1.5">
                <Radio className="w-3.5 h-3.5 text-brand-emerald animate-pulse" />
                Operador: <span className="font-bold text-slate-200">{currentSession?.userName || 'Operador'}</span>
              </span>
              <span className="text-brand-emerald font-bold">● {currentSession?.userRole || 'Operador'}</span>
            </div>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            
            {/* Automatic Dynamic Local Timestamp (System Derived) */}
            <div>
              <label className="block text-[10px] uppercase font-mono text-slate-400 font-bold mb-1.5">
                Data e Hora de Preenchimento (100% Automático)
              </label>
              <div className="relative">
                <Calendar className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-brand-emerald" />
                <input
                  type="text"
                  readOnly
                  disabled
                  value={automaticTime}
                  className="w-full bg-brand-navy-deep/70 border border-brand-navy-bright rounded-lg py-2.5 pl-10 pr-4 text-xs text-slate-300 font-mono focus:outline-none cursor-not-allowed select-none opacity-80"
                  title="Horário do sistema auditado de forma imutável pelo operador"
                />
              </div>
              <p className="text-[10px] text-slate-500 font-mono mt-1">
                * Carimbo UTC auditável e criptografado pela governança do despachante.
              </p>
            </div>

            {/* Fundo de Troco (User Filled) */}
            <div>
              <label className="block text-[10px] uppercase font-mono text-slate-300 font-bold mb-1.5">
                Declare o Fundo de Troco Inicial (R$) *
              </label>
              <div className="relative">
                <input
                  id="fundo-troco-input"
                  type="text"
                  required
                  autoFocus
                  placeholder="R$ 0,00"
                  value={fundoTroco}
                  onFocus={(e) => {
                    if (fundoTroco === 'R$ 0,00' || !fundoTroco) {
                      e.target.select();
                    }
                  }}
                  onChange={(e) => {
                    // Force real-time BRL mask
                    const masked = formatBRLMask(e.target.value);
                    setFundoTroco(masked);
                  }}
                  onBlur={() => {
                    let val = fundoTroco.replace(/R\$\s*/g, '').trim();
                    if (!val || val === '0,00') {
                      setFundoTroco('R$ 0,00');
                      return;
                    }
                    if (/^\d+$/.test(val)) {
                      const num = parseInt(val, 10);
                      setFundoTroco(`R$ ${num.toLocaleString('pt-BR')},00`);
                    } else {
                      let cleanVal = val.replace(/\./g, ',');
                      const parts = cleanVal.split(',');
                      const integerPart = parts[0].replace(/\D/g, '') || '0';
                      let decimalPart = parts[1] ? parts[1].replace(/\D/g, '') : '00';
                      if (decimalPart.length === 1) decimalPart += '0';
                      decimalPart = decimalPart.substring(0, 2);

                      const num = parseInt(integerPart, 10);
                      setFundoTroco(`R$ ${num.toLocaleString('pt-BR')},${decimalPart}`);
                    }
                  }}
                  className="w-full bg-brand-navy-deep border border-brand-navy-bright focus:border-brand-emerald rounded-lg py-2.5 px-4 text-xs text-slate-100 font-bold font-mono focus:outline-none placeholder-slate-500 text-center"
                />
              </div>
              <p className="text-[10px] text-slate-400 mt-1.5">
                * Digite o saldo monetário físico na gaveta metálica para conferência da Marks Systems.
              </p>
            </div>

            {inputError && (
              <p className="text-red-400 text-[11px] font-mono mt-1.5 bg-red-500/5 p-2 rounded border border-red-500/10">
                ⚠ {inputError}
              </p>
            )}

            {/* Launch shift button */}
            <button
              type="submit"
              id="iniciar-turno-btn"
              className="w-full bg-brand-emerald hover:bg-brand-emerald/90 text-brand-navy-deep font-bold text-xs py-3 rounded-lg flex items-center justify-center gap-2 shadow-lg shadow-brand-emerald/15 cursor-pointer transition-all mt-4"
            >
              <Play className="w-3.5 h-3.5 fill-brand-navy-deep" />
              <span>Iniciar Turno Operacional</span>
            </button>

            {onLogout && (
              <button
                type="button"
                id="sair-sistema-btn"
                onClick={onLogout}
                className="w-full border border-red-500/20 hover:border-red-500/80 hover:bg-red-500/5 text-slate-300 hover:text-white font-bold text-xs py-3 rounded-lg flex items-center justify-center gap-2 cursor-pointer transition-all mt-2.5"
                title="Sair do Sistema e retornar para tela de login"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Sair do Sistema</span>
              </button>
            )}
          </form>

          {/* Footer safety message */}
          <div className="mt-5 pt-4 border-t border-brand-navy-bright/60 flex items-center justify-center text-[10px] font-mono text-slate-500 gap-1.5">
            <ShieldCheck className="w-4 h-4 text-brand-emerald" />
            <span>CERTIFICADO DE CONFLITOS MARKS AUDITING</span>
          </div>

        </div>

      </div>
    </div>
  );
}
