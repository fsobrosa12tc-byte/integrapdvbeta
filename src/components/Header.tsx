/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { ShieldCheck, User, Clock, CheckCircle, Database, LogOut, Wallet, ChevronDown, Monitor } from 'lucide-react';
import { RlsSession } from '../types';

interface HeaderProps {
  currentSession: RlsSession;
  onChangeSession: (session: RlsSession) => void;
  onLogout?: () => void;
  caixaState?: {
    status: 'aberto' | 'fechado';
    dataAbertura: string | null;
    fundoTroco: string;
    operadorName: string | null;
  };
  isMaster?: boolean;
  faturamentoDiario?: string;
  activeBoxesCount?: number;
}

export default function Header({ 
  currentSession, 
  onChangeSession, 
  onLogout,
  caixaState,
  isMaster = true,
  faturamentoDiario = '0.00',
  activeBoxesCount = 0
}: HeaderProps) {
  const [ping, setPing] = useState<number>(14);
  const [pulse, setPulse] = useState<boolean>(true);
  const [timeStr, setTimeStr] = useState<string>('');
  const [dropdownOpen, setDropdownOpen] = useState<boolean>(false);

  // Simula flutuação de latência do Supabase em Realtime
  useEffect(() => {
    const interval = setInterval(() => {
      setPing(prev => {
        const delta = Math.floor(Math.random() * 9) - 4;
        const next = prev + delta;
        return next > 4 && next < 50 ? next : 12;
      });
      setPulse(p => !p);
    }, 1500);
    return () => clearInterval(interval);
  }, []);

  // Relógio do sistema em tempo real
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setTimeStr(now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  const handleRoleChange = (role: 'Master' | 'Gerente' | 'Financeiro' | 'Operador') => {
    let tenant = 'BR-POA-MAIN-9';
    let policy = '';

    if (role === 'Master') {
      policy = 'SELECT * FROM transactions WHERE tenant_id = current_tenant(); (FULL COMMITTED ACCESSIBILITY)';
    } else if (role === 'Gerente') {
      policy = 'SELECT * FROM transactions WHERE tenant_id = current_tenant(); (FULL COMMITTED ACCESSIBILITY)';
    } else if (role === 'Financeiro') {
      policy = 'SELECT * FROM cashflow WHERE assigned_branch = current_branch() AND role_clearance = TRUE; (MUTED SALARY EXCLUDED)';
    } else {
      policy = 'SELECT * FROM current_orders WHERE created_by_id = authenticated_user_id(); (RESTRICTED TO SELF CREATED)';
    }

    onChangeSession({
      userId: role === 'Master' ? 'usr-master' : role === 'Gerente' ? 'usr-gerente-carlos' : role === 'Financeiro' ? 'usr-fin-juliana' : 'usr-op-ana',
      userName: role === 'Master' ? 'Antônio Marques' : role === 'Gerente' ? 'Carlos Gerente' : role === 'Financeiro' ? 'Juliana Financeiro' : 'Ana Carolina (Caixa)',
      userRole: role,
      currentTenantId: tenant,
      rlsPolicyApplied: policy,
      email: role === 'Master' ? 'fsobrosa.12tc@gmail.com' : role === 'Gerente' ? 'carlos.gerente@marks.com' : role === 'Financeiro' ? 'juliana.fin@marks.com' : 'ana.caixa@marks.com'
    });
  };

  const cleanName = (currentSession?.userName || 'Operador').split('(')[0].trim();

  return (
    <header className="border-b border-brand-navy-bright bg-brand-navy-card/90 backdrop-blur-md px-5 py-2.5 sticky top-0 z-40 transition-colors duration-200">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        
        {/* Brand Logo & Name */}
        <div className="flex items-center gap-2.5">
          <div className="relative flex items-center justify-center w-10 h-10 rounded bg-gradient-to-tr from-brand-emerald/25 to-brand-accent/20 border border-brand-emerald/40 shadow-[0_0_15px_rgba(16,185,129,0.15)] overflow-hidden">
            <Database className="w-4.5 h-4.5 text-brand-emerald animate-pulse" />
            <div className="absolute inset-0 bg-brand-emerald/5 animate-ping duration-1000 pointer-events-none" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-display font-bold text-base tracking-tight text-slate-100">Integra PDV</span>
              <span className="text-[9px] uppercase font-mono px-1 py-0.5 rounded bg-brand-navy-bright border border-slate-700/60 text-slate-400 font-semibold tracking-wider">v2.4 LTS</span>
            </div>
            <p className="text-[10px] text-slate-400 font-medium tracking-tight">
              Powered by <span className="text-brand-emerald font-semibold">Marks Systems</span>
            </p>
          </div>
        </div>

        {/* Realtime Telemetry Hub & RLS Monitor */}
        <div className="flex flex-wrap items-center gap-3 bg-brand-navy-deep/80 border border-brand-navy-bright/70 rounded-lg p-1.5 md:p-2 relative overflow-hidden">
          {/* New Cash Opening indicators */}
          {caixaState && (
            <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-[11px] font-mono border ${
              caixaState.status === 'aberto'
                ? 'bg-brand-emerald/10 border-brand-emerald/20 text-brand-emerald'
                : 'bg-red-500/10 border-red-500/20 text-red-400 font-bold animate-pulse'
            }`}>
              <Wallet className="w-3.5 h-3.5" />
              <span>
                CAIXA: {caixaState.status === 'aberto' ? (
                  <>
                    ABERTO - <span style={{ fontFamily: "'JetBrains Mono', monospace" }}>R$ {parseFloat(caixaState.fundoTroco || '0').toFixed(2).replace('.', ',')}</span>
                  </>
                ) : (
                  'BLOQUEADO/FECHADO'
                )}
              </span>
            </div>
          )}

          {/* Faturamento Diário Global */}
          {faturamentoDiario !== undefined && (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded text-[11px] font-mono border bg-brand-navy-bright/20 border-slate-700/50 text-slate-350">
              <span className="text-[10px] text-slate-400 font-sans uppercase font-bold tracking-wider">Faturamento:</span>
              <span className="font-bold text-brand-emerald font-mono">
                {parseFloat(faturamentoDiario) > 0 
                  ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(parseFloat(faturamentoDiario))
                  : 'R$ 0,00'}
              </span>
            </div>
          )}

          {/* RLS Status pill removido conforme solicitação */}

          <div className="flex items-center gap-2 text-xs font-mono text-slate-400 pl-2 border-l border-brand-navy-bright/60">
            <Clock className="w-3.5 h-3.5 text-brand-emerald" />
            <span>{timeStr || 'Carregando...'}</span>
          </div>
        </div>

        {/* Container para Caixas Ativos e Perfil */}
        <div className="flex items-center gap-3">
          {/* Caixas Ativos Indicator */}
          {['Master', 'Gerente', 'Financeiro'].includes(currentSession?.userRole || '') && (
            <div className="flex items-center gap-2 bg-brand-navy-deep border border-brand-navy-bright px-3.5 py-1.5 rounded-xl text-xs font-semibold text-slate-200">
              <Monitor className="w-4 h-4 text-brand-emerald" />
              <div className="relative flex h-1.5 w-1.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-brand-emerald opacity-75"></span>
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-brand-emerald"></span>
              </div>
              <span className="text-slate-400 font-sans">Caixas Ativos:</span>
              <strong className="text-brand-emerald font-mono">{activeBoxesCount}</strong>
            </div>
          )}

          {/* Card Compacto de Sessão Oficial */}
          <div className="relative">
            <button
              onClick={() => setDropdownOpen(!dropdownOpen)}
              className="flex items-center gap-2.5 bg-brand-navy-deep border border-brand-navy-bright p-2 rounded-xl hover:border-brand-emerald/40 transition-all cursor-pointer text-slate-200"
            >
              {/* Avatar com contorno Verde Esmeralda */}
              <div className="w-8 h-8 rounded-full border-2 border-brand-emerald flex items-center justify-center bg-brand-navy-bright text-brand-emerald shadow-[0_0_8px_rgba(16,185,129,0.2)]">
                <User className="w-4 h-4" />
              </div>
              
              {/* Detalhes do Usuário */}
              <div className="flex flex-col text-left">
                <span className="text-xs font-bold text-slate-100">{cleanName}</span>
                <span className="text-[9px] font-mono text-brand-emerald uppercase tracking-wider leading-none mt-0.5">
                  {(currentSession?.userRole || 'Operador').toUpperCase()}
                </span>
              </div>

              {/* Chevron de seta */}
              <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform ${dropdownOpen ? 'rotate-180' : ''}`} />
            </button>

            {/* Dropdown Menu Sair do Sistema */}
            {dropdownOpen && (
              <>
                {/* Captura de clique fora */}
                <div 
                  className="fixed inset-0 z-40 cursor-default" 
                  onClick={() => setDropdownOpen(false)} 
                />
                <div className="absolute right-0 mt-2 w-48 bg-brand-navy-card border border-brand-navy-bright rounded-xl shadow-2xl overflow-hidden z-50 animate-fade-in">
                  <button
                    onClick={() => {
                      setDropdownOpen(false);
                      if (onLogout) onLogout();
                    }}
                    className="w-full flex items-center gap-2.5 px-4 py-3 text-xs text-red-400 hover:bg-brand-navy-deep transition-colors font-semibold text-left border-none cursor-pointer"
                  >
                    <LogOut className="w-4 h-4 text-red-400" />
                    <span>Sair do Sistema</span>
                  </button>
                </div>
              </>
            )}
          </div>
        </div>

      </div>
    </header>
  );
}
