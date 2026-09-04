import React from 'react';
import {
  Shield, Lock, Upload, Play, Pause, Square, Trash2, Download, Sliders, CheckCircle2, KeyRound, RefreshCw,
  FileSpreadsheet, Layers, Search, FileCode, Send, Database, ShieldAlert, ChevronRight, FileBarChart,
  Building2, Users, BarChart3, TrendingUp, Sparkles, FileCheck2, PanelLeftClose, PanelLeftOpen
} from 'lucide-react';
import { CertificadoA1, BatchStats, QueryMode } from '../types';

interface SidebarCertificadoProps {
  activeMode: QueryMode;
  setActiveMode: (mode: QueryMode) => void;
  certificado: CertificadoA1;
  setCertificado: (cert: CertificadoA1) => void;
  rateLimit: number;
  setRateLimit: (limit: number) => void;
  isProcessing: boolean;
  isPaused: boolean;
  stats: BatchStats;
  onStart: () => void;
  onPause: () => void;
  onCancel: () => void;
  onClear: () => void;
  onExport: () => void;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
}

export const SidebarCertificado: React.FC<SidebarCertificadoProps> = ({
  activeMode,
  setActiveMode,
  certificado,
  setCertificado,
  rateLimit,
  setRateLimit,
  isProcessing,
  isPaused,
  stats,
  onStart,
  onPause,
  onCancel,
  onClear,
  onExport,
  isCollapsed = false,
  onToggleCollapse,
}) => {
  const navGroups = [
    {
      title: 'Painel Executivo & BI Fiscal',
      items: [
        { id: 'central_kpis' as QueryMode, label: 'Central de KPIs & Dashboards', icon: BarChart3, accent: 'cyan', badge: 'BI' },
      ]
    },
    {
      title: 'Acesso & Multi-Tenant CNPJ',
      items: [
        { id: 'acesso_corporativo' as QueryMode, label: 'Gestão de Acessos', icon: Lock, accent: 'cyan' },
        { id: 'carteira_cnpjs' as QueryMode, label: 'Cadastro de Empresas', icon: Building2, accent: 'emerald' },
        { id: 'parceiros_negocio' as QueryMode, label: 'Parceiros de Negócio (MDM)', icon: Users, accent: 'cyan' },
      ]
    },
    {
      title: 'Consultas Cadastrais (CCC)',
      items: [
        { id: 'lote' as QueryMode, label: 'Consulta em Lote (Excel)', icon: FileSpreadsheet, badge: stats.total > 0 ? `${stats.total}` : undefined },
        { id: 'detalhada' as QueryMode, label: 'Consulta Rápida Direta', icon: Search },
      ]
    },
    {
      title: 'Documentos Fiscais (DF-e)',
      items: [
        { id: 'dfe_xml' as QueryMode, label: 'XMLs & Ref. Tributária', icon: FileCode, accent: 'cyan' },
        { id: 'eventos_dfe' as QueryMode, label: 'Central de Eventos DF-e', icon: Send, accent: 'indigo' },
      ]
    },
    {
      title: 'Relatórios Fiscais (SAP / ERP)',
      items: [
        { id: 'relatorios_xml' as QueryMode, label: 'Relatórios Fiscais', icon: FileBarChart, accent: 'cyan' },
        { id: 'tabelas_fiscais' as QueryMode, label: 'Parâmetros & Tabelas Fiscais', icon: Sliders, accent: 'indigo' },
      ]
    },
    {
      title: 'Governança & Integrações',
      items: [
        { id: 'cruzamento_sped' as QueryMode, label: 'Conciliação SPED Fiscal', icon: FileCheck2, accent: 'indigo', badge: 'SPED' },
        { id: 'integracao_erp' as QueryMode, label: 'Integração SAP / ERP', icon: Database, accent: 'emerald' },
        { id: 'auditoria_fiscal' as QueryMode, label: 'Auditoria & Conformidade', icon: ShieldAlert, accent: 'amber' },
        { id: 'observabilidade_dlq' as QueryMode, label: 'Observabilidade & DLQ', icon: Layers, accent: 'purple', badge: 'FILAS' },
      ]
    }
  ];

  return (
    <aside className="w-full flex flex-col gap-4">
      {/* Primary Sidebar Activity Navigation */}
      <div className={`glass-panel-glow rounded-2xl flex flex-col gap-3 transition-all duration-300 ${isCollapsed ? 'p-2 items-center' : 'p-4'}`}>
        {/* Header with Title & Collapse/Expand Button */}
        <div className={`flex items-center border-b border-slate-800 pb-2.5 w-full ${isCollapsed ? 'justify-center' : 'justify-between'}`}>
          {!isCollapsed && (
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse shrink-0" />
              <span className="text-xs font-bold uppercase tracking-wider text-slate-200 truncate">
                Menu de Atividades
              </span>
            </div>
          )}

          {onToggleCollapse && (
            <button
              onClick={onToggleCollapse}
              className={`p-1.5 rounded-lg text-slate-400 hover:text-cyan-300 hover:bg-slate-800/80 transition-all cursor-pointer ${
                isCollapsed ? 'text-cyan-400 bg-slate-800/60' : ''
              }`}
              title={isCollapsed ? 'Expandir Menu Lateral' : 'Recolher Menu (Expandir Área Principal)'}
              aria-label={isCollapsed ? 'Expandir Menu Lateral' : 'Recolher Menu'}
            >
              {isCollapsed ? (
                <PanelLeftOpen className="w-4 h-4 text-cyan-400 hover:scale-110 transition-transform" />
              ) : (
                <PanelLeftClose className="w-4 h-4 hover:scale-110 transition-transform" />
              )}
            </button>
          )}
        </div>

        {/* Navigation Group Items */}
        <div className="flex flex-col gap-3 w-full">
          {navGroups.map((group, gIdx) => (
            <div key={gIdx} className="space-y-1 w-full">
              {isCollapsed ? (
                gIdx > 0 && <div className="my-1.5 border-t border-slate-800/60 w-full" />
              ) : (
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 px-2 py-0.5">
                  {group.title}
                </div>
              )}

              <div className="space-y-1 w-full">
                {group.items.map(item => {
                  const Icon = item.icon;
                  const isActive = activeMode === item.id;

                  return (
                    <button
                      key={item.id}
                      onClick={() => setActiveMode(item.id)}
                      title={item.label + (item.badge ? ` (${item.badge})` : '')}
                      className={`w-full flex items-center rounded-xl text-xs font-semibold transition-all cursor-pointer group relative ${
                        isCollapsed ? 'justify-center p-2.5' : 'justify-between px-3 py-2.5'
                      } ${
                        isActive
                          ? 'bg-gradient-to-r from-blue-600 via-indigo-600 to-cyan-600 text-white shadow-lg shadow-blue-600/30 border border-cyan-400/40'
                          : 'text-slate-300 hover:text-white hover:bg-slate-800/80 border border-transparent'
                      }`}
                    >
                      <div className={`flex items-center gap-2.5 ${isCollapsed ? 'justify-center' : 'min-w-0'}`}>
                        <Icon className={`shrink-0 transition-transform group-hover:scale-110 ${
                          isCollapsed ? 'w-5 h-5' : 'w-4 h-4'
                        } ${
                          isActive
                            ? 'text-white'
                            : item.accent === 'cyan' ? 'text-cyan-400'
                            : item.accent === 'indigo' ? 'text-indigo-400'
                            : item.accent === 'emerald' ? 'text-emerald-400'
                            : item.accent === 'amber' ? 'text-amber-400'
                            : 'text-slate-400 group-hover:text-cyan-400'
                        }`} />
                        {!isCollapsed && <span className="truncate">{item.label}</span>}
                      </div>

                      {!isCollapsed && (
                        <div className="flex items-center gap-1.5 shrink-0">
                          {item.badge && (
                            <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold font-mono ${
                              isActive ? 'bg-white/20 text-white' : 'bg-slate-800 text-cyan-400 border border-slate-700'
                            }`}>
                              {item.badge}
                            </span>
                          )}
                          <ChevronRight className={`w-3.5 h-3.5 transition-transform ${
                            isActive ? 'text-white translate-x-0.5' : 'text-slate-600 group-hover:text-slate-400 group-hover:translate-x-0.5'
                          }`} />
                        </div>
                      )}

                      {/* Small floating badge indicator dot when collapsed */}
                      {isCollapsed && item.badge && (
                        <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-cyan-400 ring-2 ring-slate-900" />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </aside>
  );
};

