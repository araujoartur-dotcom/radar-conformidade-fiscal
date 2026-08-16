import React, { useState } from 'react';
import {
  Building2, ShieldCheck, FileSpreadsheet, Layers, Search, FileCode,
  Send, Database, ShieldAlert, FolderArchive, Globe, FileBarChart, LogOut,
  ChevronDown, Check, User, Lock
} from 'lucide-react';
import { QueryMode, CertificadoA1, AmbienteSefaz } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { useApi } from '../hooks/useApi';

interface HeaderProps {
  activeMode: QueryMode;
  setActiveMode: (mode: QueryMode) => void;
  certificado: CertificadoA1;
  totalItems: number;
  onOpenDirConfig?: () => void;
  ambienteSefaz: AmbienteSefaz;
  setAmbienteSefaz: (amb: AmbienteSefaz) => void;
}

export const Header: React.FC<HeaderProps> = ({
  activeMode,
  certificado,
  totalItems,
  onOpenDirConfig,
  ambienteSefaz,
  setAmbienteSefaz,
}) => {
  const { user, empresaAtiva, empresasDisponiveis, logout, switchEmpresa } = useAuth();
  const { post } = useApi();
  const [isTenantDropdownOpen, setIsTenantDropdownOpen] = useState(false);
  const [isSwitching, setIsSwitching] = useState(false);
  const dropdownRef = React.useRef<HTMLDivElement>(null);

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
    if (empresa.id === empresaAtiva?.id) {
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
      }
    } catch (err) {
      console.error('Falha ao alternar empresa:', err);
    } finally {
      setIsSwitching(false);
      setIsTenantDropdownOpen(false);
    }
  };

  const getModeLabel = () => {
    switch (activeMode) {
      case 'lote':
        return { title: 'Consulta em Lote (Excel)', icon: FileSpreadsheet, color: 'text-cyan-400' };
      case 'avulsa':
        return { title: 'Consulta Avulsa (Digitação)', icon: Layers, color: 'text-blue-400' };
      case 'detalhada':
        return { title: 'Consulta Rápida Direta', icon: Search, color: 'text-indigo-400' };
      case 'dfe_xml':
        return { title: 'Captura XML (NF-e, NFS-e e CT-e)', icon: FileCode, color: 'text-cyan-400' };
      case 'eventos_dfe':
        return { title: 'Central de Eventos DF-e', icon: Send, color: 'text-indigo-400' };
      case 'integracao_erp':
        return { title: 'Integração SAP / ERP', icon: Database, color: 'text-emerald-400' };
      case 'auditoria_fiscal':
        return { title: 'Auditoria Fiscal & Conformidade', icon: ShieldAlert, color: 'text-amber-400' };
      case 'relatorios_xml':
        return { title: 'Relatórios Fiscais', icon: FileBarChart, color: 'text-cyan-400' };
      case 'tabelas_fiscais':
        return { title: 'Parâmetros & Tabelas Fiscais', icon: FileBarChart, color: 'text-indigo-400' };
      case 'acesso_corporativo':
        return { title: 'Gestão de Acessos', icon: Lock, color: 'text-indigo-400' };
      case 'carteira_cnpjs':
        return { title: 'Cadastro de Empresas', icon: Building2, color: 'text-emerald-400' };
      case 'parceiros_negocio':
        return { title: 'Parceiros de Negócio (MDM Fiscal)', icon: Users, color: 'text-cyan-400' };
      case 'observabilidade_dlq':
        return { title: 'Observabilidade & Filas (DLQ)', icon: Layers, color: 'text-blue-400' };
      default:
        return { title: 'Painel de Auditoria', icon: Building2, color: 'text-cyan-400' };
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
                <div className="font-bold text-white truncate max-w-[160px] sm:max-w-[220px]">
                  {empresaAtiva ? empresaAtiva.razaoSocial : 'Nenhuma selecionada'}
                </div>
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
                      const isCurrent = emp.id === empresaAtiva?.id;
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

          {/* SEFAZ Environment Switcher (Homologação x Produção) */}
          <div className="flex items-center bg-slate-950 p-1 rounded-xl border border-slate-800 shadow-inner">
            <button
              onClick={() => setAmbienteSefaz('homologacao')}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                ambienteSefaz === 'homologacao'
                  ? 'bg-amber-500 text-slate-950 shadow-md font-extrabold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              title="Ambiente de Testes / Homologação (tpAmb = 2) — Sem Valor Fiscal"
            >
              <Globe className="w-3.5 h-3.5" />
              <span>Homologação</span>
              {ambienteSefaz === 'homologacao' && (
                <span className="text-[9px] font-mono bg-slate-950/40 text-slate-950 px-1 rounded font-bold">
                  tpAmb=2
                </span>
              )}
            </button>

            <button
              onClick={() => setAmbienteSefaz('producao')}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                ambienteSefaz === 'producao'
                  ? 'bg-emerald-500 text-slate-950 shadow-md font-extrabold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              title="Ambiente Oficial de Produção (tpAmb = 1) — Com Validade Jurídica / Fiscal"
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Produção</span>
              {ambienteSefaz === 'producao' && (
                <span className="text-[9px] font-mono bg-slate-950/40 text-slate-950 px-1 rounded font-bold">
                  tpAmb=1
                </span>
              )}
            </button>
          </div>

          {onOpenDirConfig && (
            <button
              onClick={onOpenDirConfig}
              className="px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-cyan-300 border border-slate-700 hover:border-cyan-500/50 text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
              title="Configurar diretórios de armazenamento de XMLs por CNPJ Raiz"
            >
              <FolderArchive className="w-4 h-4 text-cyan-400" />
              <span className="hidden md:inline">Diretórios XMLs</span>
              <span className="text-[10px] font-mono text-slate-400 bg-slate-950 px-1.5 py-0.5 rounded border border-slate-800">
                CNPJ Raiz
              </span>
            </button>
          )}

          {/* User badge and Logout */}
          <button
            onClick={logout}
            className="p-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 transition-all cursor-pointer shadow-sm ml-1"
            title="Sair do Sistema"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>

      </div>
    </header>
  );
};
