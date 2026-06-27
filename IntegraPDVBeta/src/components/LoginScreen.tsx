/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Shield, Key, Mail, UserPlus, Lock, ArrowRight, Eye, EyeOff, Sparkles, Server } from 'lucide-react';
import { RlsSession } from '../types';

interface LoginScreenProps {
  onLoginSuccess: (session: RlsSession, isMaster: boolean) => void;
}

export interface SimulatedOperator {
  name: string;
  email: string;
  password: string;
  createdAt: string;
  role: 'Gerente' | 'Financeiro' | 'Operador';
}

export default function LoginScreen({ onLoginSuccess }: LoginScreenProps) {
  // Credentials
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Operator profile creation state
  const [opName, setOpName] = useState('');
  const [opEmail, setOpEmail] = useState('');
  const [opPassword, setOpPassword] = useState('');
  const [opRole, setOpRole] = useState<'Gerente' | 'Financeiro' | 'Operador'>('Operador');
  
  // Fields for Creator Authentication (to check creator permissions)
  const [creatorEmail, setCreatorEmail] = useState('');
  const [creatorPassword, setCreatorPassword] = useState('');

  const [operators, setOperators] = useState<SimulatedOperator[]>(() => {
    const saved = localStorage.getItem('simulated_operators');
    if (saved) return JSON.parse(saved);
    return [
      {
        name: 'Carlos Gerente (Supervisor)',
        email: 'carlos.gerente@marks.com',
        password: 'gerente123',
        createdAt: '2026-06-09T00:00:00Z',
        role: 'Gerente'
      },
      {
        name: 'Juliana Financeiro (Admin)',
        email: 'juliana.fin@marks.com',
        password: 'financeiro123',
        createdAt: '2026-06-09T00:00:00Z',
        role: 'Financeiro'
      },
      {
        name: 'Ana Carolina (Caixa)',
        email: 'ana.caixa@marks.com',
        password: 'caixa123',
        createdAt: '2026-06-09T00:00:00Z',
        role: 'Operador'
      }
    ];
  });

  React.useEffect(() => {
    localStorage.setItem('simulated_operators', JSON.stringify(operators));
  }, [operators]);

  const [isCreatingOperator, setIsCreatingOperator] = useState(false);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    const trimmedEmail = email.trim().toLowerCase();

    // 1. Strict Master verification
    if (trimmedEmail === 'fsobrosa.12tc@gmail.com' && password === 'Antonio2@26') {
      setSuccessMsg('Autenticação de Administrador Master confirmada!');
      
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

    // 2. Simulated Operator verification
    const foundOp = operators.find(op => op.email.trim().toLowerCase() === trimmedEmail && op.password === password);
    if (foundOp) {
      setSuccessMsg(`Autenticação de ${foundOp.role} confirmada! Carregando terminal...`);
      setTimeout(() => {
        onLoginSuccess({
          userId: `usr-op-${Date.now()}`,
          userName: foundOp.name,
          userRole: foundOp.role,
          currentTenantId: 'BR-POA-MAIN-9',
          rlsPolicyApplied: foundOp.role === 'Operador'
            ? 'SELECT * FROM current_orders WHERE created_by_id = authenticated_user_id(); (RESTRICTED TO SELF CREATED)'
            : 'SELECT * FROM transactions WHERE tenant_id = current_tenant(); (FULL COMMITTED ACCESSIBILITY)',
          email: foundOp.email.trim().toLowerCase()
        }, foundOp.role !== 'Operador'); // isMaster flag passed: true if Gerente/Financeiro, false if Operador to limit access
      }, 1000);
      return;
    }

    // Fallback error
    setErrorMsg('Acesso negado. Credenciais inválidas ou não registradas.');
  };

  const handleCreateOperatorProfile = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    if (!opName || !opEmail || !opPassword || !creatorEmail || !creatorPassword) {
      setErrorMsg('Preecha todos os campos requeridos, incluindo as credenciais do criador.');
      return;
    }

    if (operators.some(op => op.email.toLowerCase() === opEmail.toLowerCase()) || opEmail.toLowerCase() === 'fsobrosa.12tc@gmail.com') {
      setErrorMsg('Identificador de acesso indisponível.');
      return;
    }

    // Identify creator role through credentials
    const cleanCreatorEmail = creatorEmail.trim().toLowerCase();
    let creatorRole: 'Master' | 'Gerente' | 'Financeiro' | 'Operador' | null = null;
    let creatorName = '';

    if (cleanCreatorEmail === 'fsobrosa.12tc@gmail.com' && creatorPassword === 'Antonio2@26') {
      creatorRole = 'Master';
      creatorName = 'Antônio Marques';
    } else {
      const matchOp = operators.find(op => op.email.trim().toLowerCase() === cleanCreatorEmail && op.password === creatorPassword);
      if (matchOp) {
        creatorRole = matchOp.role;
        creatorName = matchOp.name;
      }
    }

    if (!creatorRole) {
      setErrorMsg('Credenciais do Criador/Autorizador inválidas. Falha na autenticação.');
      return;
    }

    // Apply strict RBAC creation permissions matrix
    if (opRole === 'Gerente') {
      // 1. Gerente: Criado exclusivamente pelo Master
      if (creatorRole !== 'Master') {
        setErrorMsg('Permissão Negada: Apenas o Administrador Master tem autorização para criar perfis de Gerente.');
        return;
      }
    } else if (opRole === 'Financeiro') {
      // 2. Financeiro: Criado pelo Master ou por um Gerente
      if (creatorRole !== 'Master' && creatorRole !== 'Gerente') {
        setErrorMsg('Permissão Negada: Apenas o Administrador Master ou um Gerente ativo podem autorizar a criação de contas do Financeiro.');
        return;
      }
    } else if (opRole === 'Operador') {
      // 3. Operador: Criado pelo Master, Gerente ou Financeiro
      if (creatorRole !== 'Master' && creatorRole !== 'Gerente' && creatorRole !== 'Financeiro') {
        setErrorMsg('Permissão Negada: Apenas Master, Gerentes ou membros do Financeiro possuem autorização para criar Operadores.');
        return;
      }
    }

    const newOp: SimulatedOperator = {
      name: opName,
      email: opEmail.toLowerCase().trim(),
      password: opPassword,
      createdAt: new Date().toISOString(),
      role: opRole
    };

    setOperators([...operators, newOp]);
    setSuccessMsg(`Sucesso! Perfil '${opName}' (${opRole}) criado, autorizado por ${creatorName}.`);
    
    // Clear operator form
    setOpName('');
    setOpEmail('');
    setOpPassword('');
    setCreatorEmail('');
    setCreatorPassword('');
    setOpRole('Operador');
    setIsCreatingOperator(false);
  };

  // Quick helper to auto-fill credentials for testing
  const autoFillMaster = () => {
    setEmail('fsobrosa.12tc@gmail.com');
    setPassword('Antonio2@26');
    setErrorMsg('');
  };

  const autoFillOperator = (op: SimulatedOperator) => {
    setEmail(op.email);
    setPassword(op.password);
    setErrorMsg('');
  };

  return (
    <div className="min-h-screen bg-brand-navy-deep flex flex-col lg:grid lg:grid-cols-12 w-full text-slate-100 font-sans select-none overflow-x-hidden">
      
      {/* LEFT COLUMN: Branding & Context (55% on large screens) */}
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

      {/* RIGHT COLUMN: Minimal Form (45% on large screens) */}
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

          {/* Validation Feedback with discret Elegant Banner */}
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

          {/* Dynamic Content: Login vs operator creator */}
          {!isCreatingOperator ? (
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
                className="w-full bg-brand-emerald hover:bg-brand-emerald/90 text-[#04070d] font-display font-black text-xs uppercase tracking-widest py-3.5 rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-brand-emerald/10 cursor-pointer transition-all"
              >
                <span>Acessar Sistema</span>
                <ArrowRight className="w-4 h-4" />
              </button>

              {/* Demo Credentials Section (Blends into corporatum design) */}
              <div className="pt-6 border-t border-brand-navy-bright/35 space-y-3">
                <span className="block text-[9px] uppercase font-mono font-bold text-slate-500 tracking-widest">
                  Acesso rápido para demonstração:
                </span>
                
                <div className="grid grid-cols-1 gap-2.5">
                  <button
                    type="button"
                    onClick={autoFillMaster}
                    className="p-3 bg-brand-navy-deep/30 border border-brand-navy-bright/70 hover:border-brand-emerald/40 rounded-xl text-left transition-all active:scale-[0.99] cursor-pointer"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-100">Administrador (Master)</span>
                      <span className="text-[9px] font-mono bg-brand-emerald/10 border border-brand-emerald/30 text-brand-emerald px-1.5 py-0.5 rounded font-black">MASTER</span>
                    </div>
                    <div className="text-[10px] text-slate-400 font-mono mt-1 space-y-0.5">
                      <p>Conta: fsobrosa.12tc@gmail.com</p>
                      <p>Senha: Antonio2@26</p>
                    </div>
                  </button>

                  {operators.map((op, idx) => {
                    const isGerente = op.role === 'Gerente';
                    const isFin = op.role === 'Financeiro';
                    
                    return (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => autoFillOperator(op)}
                        className="p-3 bg-brand-navy-deep/15 border border-brand-navy-bright/40 hover:border-brand-accent/40 rounded-xl text-left transition-all active:scale-[0.99] cursor-pointer"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-slate-200">{op.name}</span>
                          <span className={`text-[9px] font-mono px-1.5 py-0.5 rounded font-black border ${
                            isGerente 
                              ? 'bg-cyan-500/10 border-cyan-500/30 text-cyan-400' 
                              : isFin 
                              ? 'bg-purple-500/10 border-purple-500/30 text-purple-400' 
                              : 'bg-amber-500/10 border-amber-500/30 text-amber-400'
                          }`}>
                            {op.role?.toUpperCase() || 'OPERADOR'}
                          </span>
                        </div>
                        <div className="text-[10px] text-slate-400 font-mono mt-1 space-y-0.5">
                          <p>Conta: {op.email}</p>
                          <p>Senha: {op.password}</p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </form>
          ) : (
            /* Create simulated Operator Account */
            <form onSubmit={handleCreateOperatorProfile} className="space-y-4">
              <div className="bg-brand-navy-deep/30 border border-brand-navy-bright/60 p-4 rounded-xl text-xs text-slate-300 leading-relaxed font-sans space-y-1">
                <p className="font-bold text-slate-200">🔒 Governança de Cargos e Permissões (RBAC)</p>
                <p className="text-[11px] text-slate-400">
                  Cadastre novas credenciais. Sob as normas da Portaria RS 45/2026, toda criação requer que a credencial autorizadora de um superior hierárquico seja preenchida abaixo.
                </p>
              </div>

              <div className="space-y-1">
                <label className="block text-[10px] uppercase font-mono text-slate-450 font-bold" htmlFor="op-new-name">
                  Nome Completo
                </label>
                <input
                  id="op-new-name"
                  type="text"
                  required
                  placeholder="Ex: Carlos Silva"
                  value={opName}
                  onChange={(e) => setOpName(e.target.value)}
                  className="w-full bg-brand-navy-deep/40 border border-brand-navy-bright rounded-lg py-2.5 px-3 text-xs text-slate-200 focus:outline-none focus:border-brand-emerald"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-[10px] uppercase font-mono text-slate-450 font-bold" htmlFor="op-new-role">
                  Cargo / Perfil Hierárquico
                </label>
                <select
                  id="op-new-role"
                  value={opRole}
                  onChange={(e) => setOpRole(e.target.value as any)}
                  className="w-full bg-brand-navy-deep/40 border border-brand-navy-bright text-slate-200 rounded-lg py-2.5 px-3 text-xs focus:outline-none focus:border-brand-emerald"
                >
                  <option value="Operador" className="bg-brand-navy-card">Operador (Acesso limitado ao PDV Atendimento)</option>
                  <option value="Financeiro" className="bg-brand-navy-card">Financeiro (Acesso total + Relatórios)</option>
                  <option value="Gerente" className="bg-brand-navy-card">Gerente (Privilégios totais administrativos)</option>
                </select>
                <p className="text-[10px] text-slate-400 italic">
                  {opRole === 'Gerente' && '⚠️ Requer autorização estrita do Administrador Master.'}
                  {opRole === 'Financeiro' && '⚠️ Requer autorização do Master ou de um Gerente ativo.'}
                  {opRole === 'Operador' && 'Autorizável por Master, Gerente ou Financeiro.'}
                </p>
              </div>

              <div className="space-y-1">
                <label className="block text-[10px] uppercase font-mono text-slate-450 font-bold" htmlFor="op-new-email">
                  E-mail de Login
                </label>
                <input
                  id="op-new-email"
                  type="email"
                  required
                  placeholder="Ex: carlos@marks.com"
                  value={opEmail}
                  onChange={(e) => setOpEmail(e.target.value)}
                  className="w-full bg-brand-navy-deep/40 border border-brand-navy-bright rounded-lg py-2.5 px-3 text-xs font-mono text-slate-200 focus:outline-none focus:border-brand-emerald"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-[10px] uppercase font-mono text-slate-450 font-bold" htmlFor="op-new-pass">
                  Senha de Acesso
                </label>
                <input
                  id="op-new-pass"
                  type="password"
                  required
                  placeholder="Defina a senha..."
                  value={opPassword}
                  onChange={(e) => setOpPassword(e.target.value)}
                  className="w-full bg-brand-navy-deep/40 border border-brand-navy-bright rounded-lg py-2.5 px-3 text-xs font-mono text-slate-200 focus:outline-none focus:border-brand-emerald"
                />
              </div>

              {/* AUTORIZADOR CREDENTIALS CLUSTER */}
              <div className="border border-brand-navy-bright/60 bg-brand-navy-deep/20 rounded-xl p-3.5 space-y-2.5">
                <span className="block text-[10px] uppercase font-mono font-bold text-brand-emerald tracking-wider">
                  🔑 Assinatura Digital do Supervisor (Autorizar Criação)
                </span>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div className="space-y-0.5">
                    <label className="block text-[9px] uppercase font-mono text-slate-500 font-bold" htmlFor="creator-email">
                      E-mail do Superior
                    </label>
                    <input
                      id="creator-email"
                      type="email"
                      required
                      placeholder="Ex: fsobrosa.12tc@gmail.com"
                      value={creatorEmail}
                      onChange={(e) => setCreatorEmail(e.target.value)}
                      className="w-full bg-brand-navy-deep border border-brand-navy-bright/70 rounded py-1.5 px-2 text-[11px] font-mono text-slate-300 focus:outline-none focus:border-brand-emerald"
                    />
                  </div>

                  <div className="space-y-0.5">
                    <label className="block text-[9px] uppercase font-mono text-slate-500 font-bold" htmlFor="creator-pass">
                      Senha do Superior
                    </label>
                    <input
                      id="creator-pass"
                      type="password"
                      required
                      placeholder="Defina a senha..."
                      value={creatorPassword}
                      onChange={(e) => setCreatorPassword(e.target.value)}
                      className="w-full bg-brand-navy-deep border border-brand-navy-bright/70 rounded py-1.5 px-2 text-[11px] font-mono text-slate-300 focus:outline-none focus:border-brand-emerald"
                    />
                  </div>
                </div>
              </div>

              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setIsCreatingOperator(false);
                    setErrorMsg('');
                    setSuccessMsg('');
                  }}
                  className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs py-2.5 rounded-lg transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 bg-brand-emerald hover:bg-brand-emerald/90 text-[#04070d] font-bold text-xs py-2.5 rounded-lg transition-colors cursor-pointer"
                >
                  Registrar e Conceder Perfil
                </button>
              </div>
            </form>
          )}

        </div>
      </div>
    </div>
  );
}
