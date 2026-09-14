import React, { useState } from 'react';
import {
  Building2, ShieldCheck, FileSpreadsheet, Layers, Search, FileCode,
  Send, Database, ShieldAlert, FolderArchive, Globe, FileBarChart, LogOut,
  ChevronDown, Check, User, Lock, Users, Calculator, TrendingUp, Key,
  BarChart3, Plug
} from 'lucide-react';
import { QueryMode, CertificadoA1, AmbienteSefaz } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { useApi } from '../hooks/useApi';

interface HeaderProps {
  activeMode: QueryMode;
  setActiveMode: (mode: QueryMode) => void;
  certificado: CertificadoA1;
  totalItems: number;
  onOpenExportFiscal?: () => void;
  ambienteSefaz: AmbienteSefaz;
  setAmbienteSefaz: (amb: AmbienteSefaz) => void;
  onOpenCertModal?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  activeMode,
  setActiveMode,
  certificado,
  totalItems,
  onOpenExportFiscal,
  ambienteSefaz,
  setAmbienteSefaz,
  onOpenCertModal,
}) => {
  const { user, empresaAtiva, empresasDisponiveis, logout, switchEmpresa, token } = useAuth();
  const { post } = useApi();
  const [isTenantDropdownOpen, setIsTenantDropdownOpen] = useState(false);
  const [isSwitching, setIsSwitching] = useState(false);
  const dropdownRef = React.useRef<HTMLDivElement>(null);

  /**
   * Extrai First Name e Last Name do colaborador conectado para exibição compacta
   */
  const getUserDisplayName = (fullName?: string, email?: string) => {
    if (!fullName) {
      if (!email) return 'Usuário Conectado';
      return email.split('@')[0];
    }
    const parts = fullName.trim().split(/\s+/).filter(Boolean);
    if (parts.length <= 2) return fullName.trim();
    return `${parts[0]} ${parts[parts.length - 1]}`;
  };

  // Outside click listener for tenant dropdown
  React.useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsTenantDropdownOpen(false);
      }
    };
    if (isTenantDropdownOpen) {
      document.addEventListener('mousedown', handleOutsideClick);
    }
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
    };
  }, [isTenantDropdownOpen]);

  const handleSelectEmpresa = async (empresa: any) => {
    if (empresa.id === empresaAtiva?.id || empresa.cnpjCompleto === empresaAtiva?.cnpjCompleto) {
      setIsTenantDropdownOpen(false);
      return;
    }

    setIsSwitching(true);
    try {
      const res = await post<{ success: boolean; accessToken: string; empresaAtiva: any }>('/auth/switch-empresa', {
        empresaId: empresa.id
      });

      if (res.ok && res.data?.accessToken && res.data?.empresaAtiva) {
        switchEmpresa(res.data.empresaAtiva, res.data.accessToken);
      } else {
        const errorMsg = res.error || (res.data as any)?.error || 'Não foi possível alternar para esta empresa no servidor.';
        alert(`Não foi possível alternar de empresa: ${errorMsg}`);
      }
    } catch (err: any) {
      console.error('Falha ao alternar empresa no backend:', err);
      alert(`Falha de conexão com o servidor ao alternar empresa: ${err.message || 'Erro de rede'}`);
    } finally {
      setIsSwitching(false);
      setIsTenantDropdownOpen(false);
    }
  };

  const getModeLabel = () => {
    switch (activeMode) {
      case 'central_kpis':
        return { title: 'Central de KPIs & Dashboards', icon: BarChart3, color: 'text-cyan-400' };
      case 'lote':
        return { title: 'Consulta em Lote (Excel)', icon: FileSpreadsheet, color: 'text-cyan-400' };
      case 'avulsa':
        return { title: 'Consulta Avulsa (Digitação)', icon: Layers, color: 'text-blue-400' };
      case 'detalhada':
        return { title: 'Consulta Rápida Direta', icon: Search, color: 'text-indigo-400' };
      case 'dfe_xml':
        return { title: 'Captura de XMLs', icon: FileCode, color: 'text-cyan-400' };
      case 'eventos_dfe':
        return { title: 'Central de Eventos DF-e', icon: Send, color: 'text-indigo-400' };
      case 'relatorios_xml':
        return { title: 'Relatórios Fiscais', icon: FileBarChart, color: 'text-cyan-400' };
      case 'tabelas_fiscais':
        return { title: 'Parâmetros & Tabelas Fiscais', icon: FileBarChart, color: 'text-indigo-400' };
      case 'conectores_municipais':
        return { title: 'Conectores Municipais', icon: Plug, color: 'text-emerald-400' };
      case 'acesso_corporativo':
        return { title: 'Gestão de Acessos', icon: Lock, color: 'text-indigo-400' };
      case 'carteira_cnpjs':
        return { title: 'Cadastro de Empresas', icon: Building2, color: 'text-emerald-400' };
      case 'apuracao_assistida':
        return { title: 'Apuração Assistida (IBS/CBS)', icon: Calculator, color: 'text-emerald-400' };
      case 'simulador_regimes':
        return { title: 'Modelador de Regimes & Ponto de Equilíbrio CPP', icon: TrendingUp, color: 'text-indigo-400' };
      default:
        return { title: 'Central de KPIs & Dashboards', icon: BarChart3, color: 'text-cyan-400' };
    }
  };

  const activeInfo = getModeLabel();
  const Icon = activeInfo.icon;

  return (
    <header className="border-b border-slate-800/80 bg-[#0b121e]/90 backdrop-blur-md sticky top-0 z-40 px-4 lg:px-6 py-3 transition-all">
      <div className="max-w-[1800px] mx-auto flex items-center justify-between gap-4">
        
        {/* Brand & Active Module Breadcrumb */}
        <div className="flex items-center gap-3 shrink-0">
          <div className="relative flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600 via-indigo-600 to-cyan-500 shadow-lg shadow-blue-500/20 text-white font-bold">
            <Building2 className="w-5 h-5 text-white" />
            <div className="absolute -top-1 -right-1 w-3 h-3 bg-emerald-400 rounded-full border-2 border-[#0f172a] animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg sm:text-xl font-bold tracking-tight text-white font-['Plus_Jakarta_Sans']">
                Radar de <span className="text-cyan-400">Conformidade Fiscal</span>
              </h1>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-slate-300 font-medium mt-0.5">
              <span>Módulo:</span>
              <span className={`font-bold flex items-center gap-1 ${activeInfo.color}`}>
                <Icon className="w-3.5 h-3.5" />
                {activeInfo.title}
              </span>
            </div>
          </div>
        </div>

        {/* Right Info Badges & Tenant Switcher */}
        <div className="flex items-center gap-3 shrink-0">
          
          {/* Tenant / Empresa Ativa Switcher Dropdown */}
          <div className="relative" ref={dropdownRef}>
            <button
              onClick={() => setIsTenantDropdownOpen(prev => !prev)}
              disabled={isSwitching}
              className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700/80 hover:border-cyan-500/60 text-xs font-semibold text-slate-200 transition-all cursor-pointer shadow-sm"
              title="Alternar Empresa / Filial Ativa"
            >
              <div className={`w-2 h-2 rounded-full ${empresaAtiva ? 'bg-emerald-400' : 'bg-amber-400'}`} />
              <div className="text-left">
                <div className="text-[10px] text-slate-400 font-medium leading-none">Empresa Ativa:</div>
                <div className="font-bold text-white truncate max-w-[160px] sm:max-w-[220px]" title={empresaAtiva?.razaoSocial}>
                  {empresaAtiva ? empresaAtiva.razaoSocial : 'Nenhuma selecionada'}
                </div>
                {user && (
                  <div 
                    className="text-[10px] text-cyan-400 font-medium leading-tight truncate max-w-[160px] sm:max-w-[220px] flex items-center gap-1 mt-0.5 tracking-tight"
                    title={`Colaborador conectado: ${user.nome || user.email} (${user.email})`}
                  >
                    <span className="opacity-75 text-[9px]">👤</span>
                    <span>{getUserDisplayName(user.nome, user.email)}</span>
                  </div>
                )}
              </div>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
            </button>

            {isTenantDropdownOpen && (
              <div className="absolute right-0 mt-2 w-72 bg-slate-900 border border-slate-800 rounded-xl shadow-2xl overflow-hidden z-50 py-1 divide-y divide-slate-800/80">
                <div className="px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-slate-400 bg-slate-950 flex items-center justify-between">
                  <span>Selecionar Empresa Ativa ({empresasDisponiveis.length})</span>
                  {user && <span className="text-cyan-400 font-mono">{user.perfil}</span>}
                </div>

                <div className="max-h-60 overflow-y-auto">
                  {empresasDisponiveis.length === 0 ? (
                    <div className="p-4 text-center text-xs text-slate-400">
                      Nenhuma empresa cadastrada na carteira.
                    </div>
                  ) : (
                    empresasDisponiveis.map(emp => {
                      const isCurrent = emp.id === empresaAtiva?.id || emp.cnpjCompleto === empresaAtiva?.cnpjCompleto;
                      return (
                        <button
                          key={emp.id}
                          onClick={() => handleSelectEmpresa(emp)}
                          className={`w-full text-left px-3 py-2 text-xs flex items-center justify-between transition-colors cursor-pointer ${
                            isCurrent
                              ? 'bg-cyan-950/60 text-cyan-300 font-bold'
                              : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                          }`}
                        >
                          <div className="truncate mr-2">
                            <div className="font-extrabold truncate text-white">{emp.razaoSocial}</div>
                            <div className="text-[10px] font-mono text-slate-400">{emp.cnpjCompleto} ({emp.uf})</div>
                          </div>
                          {isCurrent && <Check className="w-4 h-4 text-cyan-400 shrink-0" />}
                        </button>
                      );
                    })
                  )}
                </div>
              </div>
            )}
          </div>

          {/* SEFAZ Environment Toggle (Compact Icon Button with Hover Tooltip) */}
          <div className="relative group">
            <button
              onClick={() => setAmbienteSefaz(ambienteSefaz === 'producao' ? 'homologacao' : 'producao')}
              className={`p-2 rounded-xl border text-xs font-bold transition-all flex items-center justify-center cursor-pointer shadow-sm ${
                ambienteSefaz === 'producao'
                  ? 'bg-emerald-950/40 border-emerald-700/60 text-emerald-400 hover:bg-emerald-900/60'
                  : 'bg-amber-950/40 border-amber-700/60 text-amber-400 hover:bg-amber-900/60'
              }`}
              title={`Ambiente SEFAZ: ${ambienteSefaz === 'producao' ? 'Produção (tpAmb = 1)' : 'Homologação (tpAmb = 2)'} — Clique para alternar`}
              aria-label="Alternar Ambiente SEFAZ"
            >
              {ambienteSefaz === 'producao' ? (
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
              ) : (
                <Globe className="w-4 h-4 text-amber-400" />
              )}
            </button>

            {/* Hover Tooltip */}
            <div className="absolute -bottom-10 left-1/2 -translate-x-1/2 px-2.5 py-1.5 rounded-lg bg-slate-900/98 border border-slate-700 text-[11px] font-bold text-white whitespace-nowrap shadow-2xl opacity-0 scale-95 group-hover:opacity-100 group-hover:scale-100 transition-all duration-150 ease-out pointer-events-none z-50 flex items-center gap-1.5">
              <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-2 h-2 rotate-45 bg-slate-900 border-t border-l border-slate-700" />
              <span>{ambienteSefaz === 'producao' ? 'SEFAZ: Produção (tpAmb=1)' : 'SEFAZ: Homologação (tpAmb=2)'}</span>
              <span className="text-[9px] text-slate-400 font-normal">(Clique p/ alternar)</span>
            </div>
          </div>

          {/* Certificate Status (Compact Icon Button with Hover Tooltip) */}
          <div className="relative group">
            <button
              onClick={() => {
                if (onOpenCertModal) {
                  onOpenCertModal();
                } else {
                  setActiveMode('carteira_cnpjs');
                }
              }}
              className={`p-2 rounded-xl border text-xs font-semibold flex items-center justify-center transition-all cursor-pointer shadow-sm relative ${
                certificado?.valido
                  ? 'bg-emerald-950/40 border-emerald-700/60 text-emerald-300 hover:bg-emerald-900/60'
                  : 'bg-amber-950/40 border-amber-700/60 text-amber-300 hover:bg-amber-900/60'
              }`}
              title={
                certificado?.valido
                  ? `Certificado Digital A1 Ativo: Válido até ${certificado.validade ? new Date(certificado.validade).toLocaleDateString('pt-BR') : 'Período Ativo'} (${certificado.emissor || 'AC'}) — Clique para gerenciar`
                  : 'Certificado Digital Pendente — Clique para vincular arquivo .PFX'
              }
              aria-label="Certificado Digital A1"
            >
              <Key className={`w-4 h-4 ${certificado?.valido ? 'text-emerald-400' : 'text-amber-400'}`} />
              <span className={`absolute -top-1 -right-1 w-2 h-2 rounded-full ${
                certificado?.valido ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'
              }`} />
            </button>

            {/* Hover Tooltip */}
            <div className="absolute -bottom-10 left-1/2 -translate-x-1/2 px-2.5 py-1.5 rounded-lg bg-slate-900/98 border border-slate-700 text-[11px] font-bold text-white whitespace-nowrap shadow-2xl opacity-0 scale-95 group-hover:opacity-100 group-hover:scale-100 transition-all duration-150 ease-out pointer-events-none z-50 flex items-center gap-1.5">
              <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-2 h-2 rotate-45 bg-slate-900 border-t border-l border-slate-700" />
              <span className={certificado?.valido ? 'text-emerald-400' : 'text-amber-400'}>
                {certificado?.valido ? 'Certificado Digital A1 (Ativo)' : 'Certificado Digital A1 (Pendente)'}
              </span>
              <span className="text-[9px] text-slate-400 font-normal">(Clique p/ gerenciar)</span>
            </div>
          </div>

          {/* Export Fiscal (Compact Icon Button with Hover Tooltip) */}
          {onOpenExportFiscal && (
            <div className="relative group">
              <button
                onClick={onOpenExportFiscal}
                className="p-2 rounded-xl bg-gradient-to-r from-blue-900/60 via-indigo-900/60 to-cyan-900/60 hover:from-blue-800 hover:to-cyan-800 text-cyan-200 border border-cyan-500/50 hover:border-cyan-400 text-xs font-bold flex items-center justify-center shadow-md shadow-cyan-500/15 transition-all cursor-pointer"
                title="Baixar pacote completo de XMLs em .ZIP para Fiscalização ou Auditoria"
                aria-label="Baixar XMLs (.ZIP)"
              >
                <FolderArchive className="w-4 h-4 text-cyan-300" />
              </button>

              {/* Hover Tooltip */}
              <div className="absolute -bottom-10 left-1/2 -translate-x-1/2 px-2.5 py-1.5 rounded-lg bg-slate-900/98 border border-cyan-700/60 text-[11px] font-bold text-cyan-200 whitespace-nowrap shadow-2xl opacity-0 scale-95 group-hover:opacity-100 group-hover:scale-100 transition-all duration-150 ease-out pointer-events-none z-50 flex items-center gap-1">
                <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-2 h-2 rotate-45 bg-slate-900 border-t border-l border-cyan-700/60" />
                <span>Baixar XMLs (.ZIP)</span>
              </div>
            </div>
          )}

          {/* Sair do Sistema (Compact Icon Button with Hover Tooltip) */}
          <div className="relative group shrink-0">
            <button
              onClick={logout}
              className="p-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/25 text-rose-400 border border-rose-500/30 transition-all cursor-pointer shadow-sm"
              title="Sair do Sistema"
              aria-label="Sair do Sistema"
            >
              <LogOut className="w-4 h-4" />
            </button>

            {/* Hover Tooltip */}
            <div className="absolute -bottom-10 right-0 px-2.5 py-1.5 rounded-lg bg-slate-900/98 border border-rose-800 text-[11px] font-bold text-rose-300 whitespace-nowrap shadow-2xl opacity-0 scale-95 group-hover:opacity-100 group-hover:scale-100 transition-all duration-150 ease-out pointer-events-none z-50 flex items-center gap-1">
              <div className="absolute -top-1 right-3 w-2 h-2 rotate-45 bg-slate-900 border-t border-l border-rose-800" />
              <span>Sair do Sistema</span>
            </div>
          </div>
        </div>

      </div>
    </header>
  );
};
