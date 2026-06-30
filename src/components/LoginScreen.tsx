/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Shield, Key, Mail, Lock, ArrowRight, Eye, EyeOff, Sparkles } from 'lucide-react';
import { RlsSession } from '../types';
import { supabase } from '../utils/supabaseClient';

interface LoginScreenProps {
  onLoginSuccess: (session: RlsSession, isMaster: boolean) => void;
}

export default function LoginScreen({ onLoginSuccess }: LoginScreenProps) {
  // Credentials
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');
    setIsLoading(true);

    const trimmedEmail = email.trim().toLowerCase();

    // 1. Strict Master verification
    if (trimmedEmail === 'fsobrosa.12tc@gmail.com' && password === 'Antonio2@26') {
      setSuccessMsg('Autenticação de Administrador Master confirmada!');
      setIsLoading(false);
      setTimeout(() => {
        onLoginSuccess({
          userId: 'usr-master',
          userName: 'Antônio Marques',
          userRole: 'Master',
          currentTenantId: 'BR-POA-MAIN-9',
          rlsPolicyApplied: 'SELECT * FROM transactions WHERE tenant_id = current_tenant(); (FULL COMMITTED ACCESSIBILITY)',
          email: 'fsobrosa.12tc@gmail.com'
        }, true);
      }, 1000);
      return;
    }

    try {
      // 2. Validate against public.usuarios in Supabase using correct column names
      const { data: user, error } = await supabase
        .from('usuarios')
        .select('*')
        .eq('email', trimmedEmail)
        .eq('senha_provisoria', password)
        .eq('status', 'Ativo')
        .maybeSingle();

      if (error) {
        throw new Error(error.message);
      }

      if (user) {
        // === TRAVA DE SEGURANÇA MOBILE: bloqueia operador no celular ANTES de concluir login ===
        const funcaoNorm = (user.funcao || '').trim().toUpperCase();
        const isMobileDevice = typeof window !== 'undefined' && window.innerWidth < 768;
        const isOperadorRole = funcaoNorm === 'OPERADOR' || funcaoNorm === 'CAIXA';

        if (isMobileDevice && isOperadorRole) {
          setErrorMsg('Acesso restrito ao computador. Esta versão móvel é exclusiva para auditoria gerencial do Master.');
          setIsLoading(false);
          return;
        }

        setSuccessMsg(`Autenticação de ${user.funcao} confirmada! Carregando terminal...`);
        setTimeout(() => {
          onLoginSuccess({
            userId: user.id,
            userName: user.nome, // mapped from 'nome'
            userRole: user.funcao, // mapped from 'funcao'
            currentTenantId: 'BR-POA-MAIN-9',
            rlsPolicyApplied: (user.funcao || '').trim().toUpperCase() === 'OPERADOR' || (user.funcao || '').trim().toUpperCase() === 'CAIXA'
              ? 'SELECT * FROM current_orders WHERE created_by_id = authenticated_user_id(); (RESTRICTED TO SELF CREATED)'
              : 'SELECT * FROM transactions WHERE tenant_id = current_tenant(); (FULL COMMITTED ACCESSIBILITY)',
            email: user.email
          }, !isOperadorRole);
        }, 1000);
      } else {
        setErrorMsg('Acesso negado. Credenciais inválidas ou conta inativa.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-brand-navy-deep flex flex-col lg:grid lg:grid-cols-12 w-full text-slate-100 font-sans select-none overflow-x-hidden">
      
      {/* LEFT COLUMN: Branding & Context */}
      <div className="lg:col-span-7 bg-gradient-to-br from-[#070b13] via-[#09101b] to-brand-navy-card/90 p-8 md:p-16 lg:p-20 flex flex-col justify-between border-b lg:border-b-0 lg:border-r border-brand-navy-bright/40 relative overflow-hidden">
        
        {/* Absolute glow overlays */}
        <div className="absolute -top-10 -left-10 w-96 h-96 bg-brand-emerald/5 rounded-full filter blur-[120px] pointer-events-none" />
        <div className="absolute bottom-10 right-10 w-96 h-96 bg-brand-accent/5 rounded-full filter blur-[120px] pointer-events-none" />

        {/* Company Header */}
        <div className="relative z-10 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-brand-emerald/10 border border-brand-emerald/20 flex items-center justify-center shadow-[0_0_20px_rgba(16,185,129,0.08)]">
              <Shield className="w-5 h-5 text-brand-emerald animate-pulse" />
            </div>
            <div>
              <span className="font-display font-black text-xl tracking-wider text-slate-100 block">
                INTEGRA <span className="text-brand-emerald">PDV</span>
              </span>
              <span className="block text-[9px] text-slate-400 font-semibold tracking-widest font-mono uppercase">
                Desenvolvido por Marks Systems
              </span>
            </div>
          </div>
        </div>

        {/* Core Institutional Context */}
        <div className="relative z-10 my-12 lg:my-auto max-w-2xl">
          <span className="inline-flex items-center gap-2 px-3 py-1 bg-brand-emerald/10 border border-brand-emerald/20 text-brand-emerald rounded-full text-[10px] font-mono font-bold uppercase tracking-widest mb-6 shadow-sm">
            <Sparkles className="w-3 h-3" />
            Segurança de Camada Corporativa
          </span>
          
          <h1 className="text-2xl md:text-3xl lg:text-4xl font-display font-extrabold text-slate-100 tracking-tight leading-tight">
            Gestão integrada de caixa, recebimentos e liquidez ponta a ponta
          </h1>
          
          <p className="text-sm md:text-base text-slate-300 font-sans leading-relaxed tracking-wide mt-6">
            Bem-vindo ao Integra PDV. Uma plataforma inteligente de frente de caixa e controle de fluxo de caixa em tempo real, projetada para unificar a operação do seu negócio, otimizar a gestão de parceiros B2B e garantir o controle absoluto da sua liquidez financeira.
          </p>
        </div>

        {/* Disclaimer Footer of Left Column */}
        <div className="relative z-10 text-[11px] font-mono text-slate-500 border-t border-brand-navy-bright/30 pt-6 flex items-center justify-between">
          <span>COCKPIT INTELIGENTE v2.6.4</span>
          <span>© {new Date().getFullYear()} MARKS SYSTEMS</span>
        </div>
      </div>

      {/* RIGHT COLUMN: Minimal Form */}
      <div className="lg:col-span-5 bg-[#04070d] flex flex-col justify-center p-8 md:p-16 lg:p-12 xl:p-16 relative">
        <div className="max-w-md w-full mx-auto space-y-8 relative z-10">
          
          {/* Form Switcher & Title Header */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-display font-bold text-slate-100 tracking-tight flex items-center gap-2">
                <Lock className="w-4 h-4 text-brand-emerald" />
                Acesso ao Sistema
              </h2>
            </div>
            <p className="text-xs text-slate-400">
              Insira suas credenciais corporativas registradas para acessar seu terminal.
            </p>
          </div>

          {errorMsg && (
            <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-xs text-red-400 font-mono transition-all">
              <span>{errorMsg}</span>
            </div>
          )}
          {successMsg && (
            <div className="p-3 bg-brand-emerald/10 border border-brand-emerald/20 rounded-xl text-xs text-brand-emerald font-mono transition-all">
              <span>{successMsg}</span>
            </div>
          )}

          {/* Dynamic Content: Login */}
          <form onSubmit={handleLogin} className="space-y-5">
            
            <div className="space-y-1.5">
              <label className="block text-[10px] uppercase font-mono text-slate-400 font-bold tracking-wider" htmlFor="login-email">
                Identificador (E-mail)
              </label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-slate-500" />
                <input
                  id="login-email"
                  type="email"
                  required
                  disabled={isLoading}
                  placeholder="Ex: fsobrosa.12tc@gmail.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-brand-navy-deep/40 border border-brand-navy-bright/80 focus:border-brand-emerald/85 rounded-xl py-3 pl-10 pr-4 text-xs font-mono text-slate-200 placeholder-slate-600 focus:outline-none transition-all"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex justify-between items-center">
                <label className="block text-[10px] uppercase font-mono text-slate-400 font-bold tracking-wider" htmlFor="login-pass">
                  Senha Corporativa
                </label>
              </div>
              <div className="relative">
                <Key className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-slate-500" />
                <input
                  id="login-pass"
                  type={showPassword ? 'text' : 'password'}
                  required
                  disabled={isLoading}
                  placeholder="Sua senha..."
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-brand-navy-deep/40 border border-brand-navy-bright/80 focus:border-brand-emerald/85 rounded-xl py-3 pl-10 pr-10 text-xs font-mono text-slate-200 placeholder-slate-600 focus:outline-none transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-brand-emerald hover:bg-brand-emerald/90 text-[#04070d] font-display font-black text-xs uppercase tracking-widest py-3.5 rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-brand-emerald/10 cursor-pointer transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <span>{isLoading ? 'Autenticando...' : 'Acessar Sistema'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>

          </form>

        </div>
      </div>
    </div>
  );
}
