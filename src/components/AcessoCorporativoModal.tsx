import React, { useState, useEffect } from 'react';
import {
  Lock, ShieldCheck, Mail, UserCheck, Users, CheckCircle2, AlertCircle,
  Sparkles, ShieldAlert, Plus, Edit3, Trash2, Building2, Check, Sliders,
  Layers, Zap, BarChart3, FileCode, Calculator, FileBarChart, FileSpreadsheet,
  Database, Plug, RefreshCw, Key
} from 'lucide-react';
import { UsuarioCorporativo, PerfilUsuario, ClienteEmpresaTenant, QueryMode } from '../types';
import { useApi } from '../hooks/useApi';
import { useAuth } from '../contexts/AuthContext';
import {
  GRUPOS_MODULOS, TODOS_MODULOS, PRESETS_ACESSO, parseModulosList, ModuloInfo, PresetAcesso
} from '../utils/permissions';

interface AcessoCorporativoModalProps {
  onClose?: () => void;
}

/** Perfis que têm acesso à gestão de usuários e colaboradores */
const PERFIS_GESTAO = ['admin_master', 'suporte_ti', 'contador_gestor'];

/** Helper para formatar nome do perfil para exibição */
function formatPerfil(perfil: string): string {
  const map: Record<string, string> = {
    admin_master: 'Admin Master',
    suporte_ti: 'Suporte TI',
    contador_gestor: 'Contador Gestor',
    analista_fiscal: 'Analista Fiscal',
    auditor_externo: 'Auditor Externo',
    operador_leitura: 'Operador / Cliente',
  };
  return map[perfil] || perfil.replace(/_/g, ' ');
}

export const AcessoCorporativoModal: React.FC<AcessoCorporativoModalProps> = ({
  onClose
}) => {
  const { get, post, put, del } = useApi();
  const { user: authUser, empresaAtiva } = useAuth();

  const callerPerfil = authUser?.perfil || '';
  const isGestorUsuarios = PERFIS_GESTAO.includes(callerPerfil);
  const isAdminMaster = callerPerfil === 'admin_master';
  const isSuporteTi = callerPerfil === 'suporte_ti';
  const isContadorGestor = callerPerfil === 'contador_gestor';

  const [activeTab, setActiveTab] = useState<'usuarios' | 'matriz'>('usuarios');
  const [allUsers, setAllUsers] = useState<UsuarioCorporativo[]>([]);
  const [availableTenants, setAvailableTenants] = useState<ClienteEmpresaTenant[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState<{ tipo: 'sucesso' | 'erro'; texto: string } | null>(null);

  // Form State: Novo Usuário
  const [showAddUserForm, setShowAddUserForm] = useState(false);
  const [newNome, setNewNome] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newSenha, setNewSenha] = useState('');
  const [newPerfil, setNewPerfil] = useState<PerfilUsuario>('analista_fiscal');
  const [newCnpjs, setNewCnpjs] = useState<string[]>([]);
  const [newPermissao, setNewPermissao] = useState<'total' | 'escrita' | 'leitura'>('escrita');
  const [newModulos, setNewModulos] = useState<QueryMode[]>([
    'central_kpis', 'dfe_xml', 'eventos_dfe', 'apuracao_assistida', 'relatorios_xml', 'tabelas_fiscais'
  ]);
  const [isCreatingUser, setIsCreatingUser] = useState(false);

  // Edit User State
  const [editingUser, setEditingUser] = useState<UsuarioCorporativo | null>(null);
  const [editSenha, setEditSenha] = useState('');
  const [editCnpjs, setEditCnpjs] = useState<string[]>([]);
  const [editPermissao, setEditPermissao] = useState<'total' | 'escrita' | 'leitura'>('escrita');
  const [editModulos, setEditModulos] = useState<QueryMode[]>([]);
  const [isUpdatingUser, setIsUpdatingUser] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  const loadUsers = async () => {
    if (!isGestorUsuarios) return;
    setIsLoading(true);
    try {
      const res = await get<{ success: boolean; data: any[] }>('/users');
      if (res.ok && res.data?.data) {
        setAllUsers(res.data.data.map(u => ({
          ...u,
          cnpjsAutorizados: u.cnpjsAutorizados || ['*'],
          modulosPermitidos: u.modulosPermitidos || '*'
        })));
      }
    } catch (err: any) {
      console.error('Erro ao carregar usuários:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const loadTenants = async () => {
    try {
      const res = await get<{ success: boolean; data: ClienteEmpresaTenant[] }>('/tenants');
      if (res.ok && res.data?.data) {
        setAvailableTenants(res.data.data);
      }
    } catch (err: any) {
      console.error('Erro ao carregar empresas:', err);
    }
  };

  useEffect(() => {
    loadUsers();
    loadTenants();
  }, []);

  const showNotification = (tipo: 'sucesso' | 'erro', texto: string) => {
    setFeedbackMsg({ tipo, texto });
    setTimeout(() => setFeedbackMsg(null), 4000);
  };

  // Aplica um preset pré-definido no formulário de criação
  const applyPresetCreate = (preset: PresetAcesso) => {
    setNewPerfil(preset.perfil);
    setNewPermissao(preset.permissao);
    setNewModulos(preset.modulos);
    showNotification('sucesso', `Perfil "${preset.nome}" aplicado com sucesso!`);
  };

  // Aplica um preset pré-definido no formulário de edição
  const applyPresetEdit = (preset: PresetAcesso) => {
    if (editingUser) {
      setEditingUser({ ...editingUser, perfil: preset.perfil });
    }
    setEditPermissao(preset.permissao);
    setEditModulos(preset.modulos);
    showNotification('sucesso', `Perfil "${preset.nome}" aplicado com sucesso!`);
  };

  const toggleModuloCreate = (modId: QueryMode) => {
    setNewModulos(prev =>
      prev.includes(modId) ? prev.filter(id => id !== modId) : [...prev, modId]
    );
  };

  const toggleGrupoCreate = (modulosDoGrupo: ModuloInfo[]) => {
    const ids = modulosDoGrupo.map(m => m.id);
    const todosMarcados = ids.every(id => newModulos.includes(id));
    if (todosMarcados) {
      setNewModulos(prev => prev.filter(id => !ids.includes(id)));
    } else {
      setNewModulos(prev => Array.from(new Set([...prev, ...ids])));
    }
  };

  const toggleModuloEdit = (modId: QueryMode) => {
    setEditModulos(prev =>
      prev.includes(modId) ? prev.filter(id => id !== modId) : [...prev, modId]
    );
  };

  const toggleGrupoEdit = (modulosDoGrupo: ModuloInfo[]) => {
    const ids = modulosDoGrupo.map(m => m.id);
    const todosMarcados = ids.every(id => editModulos.includes(id));
    if (todosMarcados) {
      setEditModulos(prev => prev.filter(id => !ids.includes(id)));
    } else {
      setEditModulos(prev => Array.from(new Set([...prev, ...ids])));
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNome || !newEmail) {
      alert('Preencha o nome e e-mail do colaborador.');
      return;
    }

    setIsCreatingUser(true);
    try {
      const res = await post('/users', {
        nome: newNome,
        email: newEmail,
        senha: newSenha || 'Mudar@123456',
        perfil: newPerfil,
        cnpjsAutorizados: newCnpjs,
        permissao: newPermissao,
        modulosPermitidos: newModulos
      });

      if (res.ok) {
        showNotification('sucesso', `Colaborador ${newNome} criado com sucesso!`);
        await loadUsers();
        setShowAddUserForm(false);
        setNewNome('');
        setNewEmail('');
        setNewSenha('');
        setNewCnpjs([]);
        setNewPerfil('analista_fiscal');
        setNewPermissao('escrita');
        setNewModulos(['central_kpis', 'dfe_xml', 'eventos_dfe', 'apuracao_assistida', 'relatorios_xml', 'tabelas_fiscais']);
      } else {
        const errorMsg = (res.data as any)?.message || res.error || 'Erro desconhecido ao cadastrar colaborador.';
        showNotification('erro', errorMsg);
        alert(`Erro ao cadastrar colaborador:\n\n${errorMsg}\n\nVerifique os dados preenchidos ou suas permissões.`);
      }
    } finally {
      setIsCreatingUser(false);
    }
  };

  const handleUpdateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;

    setEditError(null);
    setIsUpdatingUser(true);
    try {
      const res = await put(`/users/${editingUser.id}`, {
        nome: editingUser.nome,
        email: editingUser.email,
        perfil: editingUser.perfil,
        status: editingUser.status,
        senha: editSenha || undefined,
        cnpjsAutorizados: editCnpjs,
        permissao: editPermissao,
        modulosPermitidos: editModulos
      });

      if (res.ok) {
        showNotification('sucesso', `Dados e acessos de "${editingUser.nome}" atualizados com sucesso!`);
        await loadUsers();
        setEditingUser(null);
        setEditSenha('');
        setEditError(null);
      } else {
        const errorMsg = (res.data as any)?.message || res.error || 'Erro inesperado ao atualizar usuário.';
        setEditError(errorMsg);
        showNotification('erro', errorMsg);
      }
    } catch (err: any) {
      const errorMsg = err.message || 'Falha de comunicação com o servidor ao salvar alterações.';
      setEditError(errorMsg);
      showNotification('erro', errorMsg);
    } finally {
      setIsUpdatingUser(false);
    }
  };

  const handleDeleteUser = async (id: string, nome: string) => {
    if (!confirm(`Tem certeza que deseja remover o colaborador "${nome}"?`)) return;
    const res = await del(`/users/${id}`);
    if (res.ok) {
      showNotification('sucesso', `Colaborador "${nome}" removido com sucesso.`);
      await loadUsers();
    } else {
      const errorMsg = (res.data as any)?.message || res.error || 'Erro inesperado ao excluir usuário.';
      showNotification('erro', errorMsg);
      alert(`Erro ao excluir colaborador:\n\n${errorMsg}`);
    }
  };

  const getPerfilOptions = (): { value: PerfilUsuario; label: string }[] => {
    const allOptions: { value: PerfilUsuario; label: string }[] = [
      { value: 'admin_master', label: 'Admin Master (Acesso Total Global)' },
      { value: 'suporte_ti', label: 'Suporte TI (Gestão de Usuários por CNPJ)' },
      { value: 'contador_gestor', label: 'Contador Gestor (Multi-CNPJ Operacional)' },
      { value: 'analista_fiscal', label: 'Analista Fiscal (Emissão e Consultas)' },
      { value: 'auditor_externo', label: 'Auditor Externo (Leitura e Evidências)' },
      { value: 'operador_leitura', label: 'Operador / Cliente (Apenas Consulta)' },
    ];

    if (isAdminMaster) return allOptions;
    if (isSuporteTi) return allOptions.filter(o => !['admin_master', 'suporte_ti'].includes(o.value));
    if (isContadorGestor) return allOptions.filter(o => ['analista_fiscal', 'auditor_externo', 'operador_leitura'].includes(o.value));
    return [];
  };

  const canManageUser = (targetUser: UsuarioCorporativo): boolean => {
    if (!isGestorUsuarios) return false;
    if (targetUser.perfil === 'admin_master') return false;
    if (isAdminMaster) return true;
    if (isSuporteTi && targetUser.perfil === 'suporte_ti') return false;
    if (isContadorGestor && ['admin_master', 'suporte_ti'].includes(targetUser.perfil)) return false;
    return true;
  };

  return (
    <div className="space-y-6">

      {/* Notification Toast */}
      {feedbackMsg && (
        <div className={`p-3.5 rounded-xl border text-xs flex items-center gap-2 animate-in fade-in duration-200 ${
          feedbackMsg.tipo === 'sucesso'
            ? 'bg-emerald-950/90 border-emerald-700/80 text-emerald-200'
            : 'bg-rose-950/90 border-rose-700/80 text-rose-200'
        }`}>
          {feedbackMsg.tipo === 'sucesso' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
          )}
          <span>{feedbackMsg.texto}</span>
        </div>
      )}

      {/* Navigation Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveTab('usuarios')}
            className={`flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer ${
              activeTab === 'usuarios'
                ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg'
                : 'bg-slate-900/80 text-slate-400 hover:text-white border border-slate-800'
            }`}
          >
            <Users className="w-4 h-4 text-emerald-400" />
            <span>
              {isAdminMaster
                ? 'Painel Admin: Gestão de Usuários Globais'
                : isContadorGestor
                ? 'Gestão da Minha Equipe & Colaboradores'
                : 'Gestão de Usuários'}
            </span>
            {allUsers.length > 0 && (
              <span className="ml-1 px-1.5 py-0.5 rounded-full bg-slate-800 text-[10px] text-slate-300 font-mono">
                {allUsers.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('matriz')}
            className={`flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer ${
              activeTab === 'matriz'
                ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg'
                : 'bg-slate-900/80 text-slate-400 hover:text-white border border-slate-800'
            }`}
          >
            <ShieldCheck className="w-4 h-4 text-purple-400" />
            <span>Matriz de Permissões & Perfis Prontos</span>
          </button>
        </div>

        {activeTab === 'usuarios' && isGestorUsuarios && (
          <button
            onClick={() => setShowAddUserForm(!showAddUserForm)}
            className="flex items-center gap-1.5 px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl transition-all shadow-md cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>{showAddUserForm ? 'Fechar Formulário' : isContadorGestor ? 'Novo Colaborador' : 'Novo Usuário'}</span>
          </button>
        )}
      </div>

      {/* ============================================================ */}
      {/* TAB 1: GESTÃO DE USUÁRIOS & CONCESSÃO DE ACESSO              */}
      {/* ============================================================ */}
      {activeTab === 'usuarios' && (
        <div className="space-y-6">

          {/* Form: Cadastrar Novo Colaborador com Checkboxes Organizados */}
          {showAddUserForm && (
            <form onSubmit={handleCreateUser} className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-5 shadow-2xl animate-in fade-in duration-200">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-emerald-950/80 border border-emerald-700 flex items-center justify-center text-emerald-400">
                    <UserCheck className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-white">
                      {isContadorGestor ? 'Cadastrar Novo Colaborador da Carteira' : 'Cadastrar Novo Usuário no Sistema'}
                    </h4>
                    <p className="text-[11px] text-slate-400">
                      Defina os dados de acesso e selecione os botões/módulos autorizados através dos checkboxes.
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setShowAddUserForm(false)}
                  className="text-slate-400 hover:text-white text-xs font-bold cursor-pointer"
                >
                  ✕
                </button>
              </div>

              {/* Dados Básicos */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 text-xs">
                <div>
                  <label className="font-bold text-slate-300 block mb-1">Nome Completo *</label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: Carlos Silva"
                    value={newNome}
                    onChange={(e) => setNewNome(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-300 block mb-1">E-mail Corporativo *</label>
                  <input
                    type="email"
                    required
                    placeholder="carlos@empresa.com.br"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-300 block mb-1">Senha Inicial Provisória</label>
                  <input
                    type="password"
                    placeholder="Padrão: Mudar@123456"
                    value={newSenha}
                    onChange={(e) => setNewSenha(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              {/* Perfis Prontos (Atalhos de 1 Clique) */}
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-xs font-bold text-slate-300">
                  <Sparkles className="w-4 h-4 text-cyan-400" />
                  <span>Perfis Prontos (Clique para preencher os checkboxes automaticamente):</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-5 gap-2">
                  {PRESETS_ACESSO.map(preset => (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => applyPresetCreate(preset)}
                      className="p-2.5 rounded-xl bg-slate-950 hover:bg-slate-800/80 border border-slate-800 hover:border-cyan-500/60 text-left transition-all cursor-pointer group flex flex-col justify-between"
                    >
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-base">{preset.icone}</span>
                          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-slate-900 text-cyan-300 border border-slate-700">
                            {preset.badge}
                          </span>
                        </div>
                        <div className="font-bold text-white text-[11px] group-hover:text-cyan-300">
                          {preset.nome}
                        </div>
                        <div className="text-[10px] text-slate-400 mt-0.5 line-clamp-2">
                          {preset.descricao}
                        </div>
                      </div>
                      <div className="mt-2 pt-1 border-t border-slate-800/60 text-[9px] font-mono text-emerald-400">
                        {preset.modulos.length} módulos • {preset.permissao.toUpperCase()}
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Nível de Ação Operacional */}
              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
                <label className="font-bold text-slate-300 block text-xs">
                  Nível de Operação Pós-Clique (O que o usuário pode fazer nas telas autorizadas):
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                  <label className={`p-2.5 rounded-lg border cursor-pointer flex items-center gap-2.5 transition-all ${
                    newPermissao === 'total'
                      ? 'bg-emerald-950/60 border-emerald-600 text-white'
                      : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                  }`}>
                    <input
                      type="radio"
                      name="newPermissao"
                      value="total"
                      checked={newPermissao === 'total'}
                      onChange={() => setNewPermissao('total')}
                      className="text-emerald-500"
                    />
                    <div>
                      <span className="font-bold block text-emerald-300">Total (Completo)</span>
                      <span className="text-[10px] text-slate-400">Pode configurar, apurar e alterar cadastros</span>
                    </div>
                  </label>

                  <label className={`p-2.5 rounded-lg border cursor-pointer flex items-center gap-2.5 transition-all ${
                    newPermissao === 'escrita'
                      ? 'bg-cyan-950/60 border-cyan-600 text-white'
                      : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                  }`}>
                    <input
                      type="radio"
                      name="newPermissao"
                      value="escrita"
                      checked={newPermissao === 'escrita'}
                      onChange={() => setNewPermissao('escrita')}
                      className="text-cyan-500"
                    />
                    <div>
                      <span className="font-bold block text-cyan-300">Escrita (Operacional)</span>
                      <span className="text-[10px] text-slate-400">Importar XMLs, manifestar notas e conciliar</span>
                    </div>
                  </label>

                  <label className={`p-2.5 rounded-lg border cursor-pointer flex items-center gap-2.5 transition-all ${
                    newPermissao === 'leitura'
                      ? 'bg-amber-950/60 border-amber-600 text-white'
                      : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                  }`}>
                    <input
                      type="radio"
                      name="newPermissao"
                      value="leitura"
                      checked={newPermissao === 'leitura'}
                      onChange={() => setNewPermissao('leitura')}
                      className="text-amber-500"
                    />
                    <div>
                      <span className="font-bold block text-amber-300">Leitura (Consulta)</span>
                      <span className="text-[10px] text-slate-400">Somente visualizar e exportar relatórios</span>
                    </div>
                  </label>
                </div>
              </div>

              {/* Matriz de Checkboxes dos Módulos / Botões */}
              <div className="space-y-3">
                <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                  <div className="flex items-center gap-2">
                    <Sliders className="w-4 h-4 text-emerald-400" />
                    <span className="font-bold text-white text-xs">
                      Conjunto de Botões / Módulos Autorizados na Barra Lateral:
                    </span>
                    <span className="px-2 py-0.5 rounded-full bg-emerald-950 border border-emerald-700 text-emerald-300 font-mono text-[10px]">
                      {newModulos.length} de {TODOS_MODULOS.length} selecionados
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setNewModulos(TODOS_MODULOS.map(m => m.id))}
                      className="text-[10px] text-cyan-400 hover:text-cyan-300 font-bold cursor-pointer"
                    >
                      Selecionar Todos
                    </button>
                    <span className="text-slate-600">•</span>
                    <button
                      type="button"
                      onClick={() => setNewModulos([])}
                      className="text-[10px] text-slate-400 hover:text-white cursor-pointer"
                    >
                      Limpar Seleção
                    </button>
                  </div>
                </div>

                {/* Grupos de Módulos */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-3.5">
                  {GRUPOS_MODULOS.map((grupo, gIdx) => {
                    const todosDoGrupoMarcados = grupo.modulos.every(m => newModulos.includes(m.id));
                    const marcadosNoGrupo = grupo.modulos.filter(m => newModulos.includes(m.id)).length;

                    return (
                      <div key={gIdx} className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
                        <div className="flex items-center justify-between border-b border-slate-800/80 pb-1.5">
                          <span className="font-bold text-slate-200 text-[11px] uppercase tracking-wider">
                            {grupo.titulo}
                          </span>
                          <button
                            type="button"
                            onClick={() => toggleGrupoCreate(grupo.modulos)}
                            className="text-[10px] text-slate-400 hover:text-cyan-400 cursor-pointer font-mono"
                          >
                            {todosDoGrupoMarcados ? 'Desmarcar Grupo' : 'Marcar Grupo'} ({marcadosNoGrupo}/{grupo.modulos.length})
                          </button>
                        </div>

                        <div className="space-y-1.5">
                          {grupo.modulos.map(mod => {
                            const isChecked = newModulos.includes(mod.id);

                            return (
                              <label
                                key={mod.id}
                                className={`p-2 rounded-lg border cursor-pointer flex items-start gap-2.5 transition-all ${
                                  isChecked
                                    ? 'bg-slate-900/90 border-emerald-700/60 text-white'
                                    : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:bg-slate-900/50'
                                }`}
                              >
                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                  onChange={() => toggleModuloCreate(mod.id)}
                                  className="mt-0.5 rounded border-slate-700 bg-slate-900 text-emerald-500 focus:ring-0 cursor-pointer"
                                />
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-center gap-1.5">
                                    <span className={`font-bold text-xs ${isChecked ? 'text-emerald-300' : 'text-slate-300'}`}>
                                      {mod.label}
                                    </span>
                                    {mod.badge && (
                                      <span className="text-[9px] px-1 py-0.2 rounded bg-slate-800 text-cyan-300 font-mono">
                                        {mod.badge}
                                      </span>
                                    )}
                                  </div>
                                  <p className="text-[10px] text-slate-400 line-clamp-1 mt-0.5">
                                    {mod.descricao}
                                  </p>
                                </div>
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Vínculo de Empresas da Carteira */}
              <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 font-bold text-slate-300">
                    <Building2 className="w-4 h-4 text-cyan-400" />
                    <span>Empresas da Carteira Vinculadas a este Colaborador:</span>
                  </div>

                  <div className="flex items-center gap-2 text-[10px]">
                    <button
                      type="button"
                      onClick={() => setNewCnpjs(availableTenants.map(t => t.cnpjCompleto))}
                      className="text-cyan-400 hover:text-cyan-300 font-bold cursor-pointer"
                    >
                      Vincular a Todas
                    </button>
                    <span className="text-slate-600">•</span>
                    <button
                      type="button"
                      onClick={() => setNewCnpjs([])}
                      className="text-slate-400 hover:text-white cursor-pointer"
                    >
                      Desvincular Todas
                    </button>
                  </div>
                </div>

                {availableTenants.length === 0 ? (
                  <p className="text-slate-500 text-[11px]">Nenhuma empresa cadastrada na carteira ainda.</p>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 max-h-36 overflow-y-auto custom-scrollbar p-1">
                    {availableTenants.map(tenant => {
                      const isVinculada = newCnpjs.includes(tenant.cnpjCompleto);

                      return (
                        <label
                          key={tenant.id}
                          className={`p-2 rounded-lg border cursor-pointer flex items-center gap-2 text-[11px] transition-all ${
                            isVinculada
                              ? 'bg-slate-900 border-cyan-700/60 text-white'
                              : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={isVinculada}
                            onChange={() => {
                              setNewCnpjs(prev =>
                                prev.includes(tenant.cnpjCompleto)
                                  ? prev.filter(c => c !== tenant.cnpjCompleto)
                                  : [...prev, tenant.cnpjCompleto]
                              );
                            }}
                            className="rounded border-slate-700 bg-slate-900 text-cyan-500 focus:ring-0"
                          />
                          <div className="min-w-0 truncate">
                            <span className="font-bold truncate block">{tenant.razaoSocial}</span>
                            <span className="font-mono text-[10px] text-slate-400">{tenant.cnpjCompleto}</span>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                )}
                <span className="text-[10px] text-emerald-400 block mt-1">
                  {newCnpjs.length === 0
                    ? '💡 Nenhuma empresa selecionada: colaborador será salvo sem vínculos imediatos (cadastro pendente de atribuição).'
                    : `✅ ${newCnpjs.length} empresa(s) selecionada(s) para este colaborador.`}
                </span>
              </div>

              {/* Botões do Formulário */}
              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowAddUserForm(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 font-bold hover:text-white cursor-pointer"
                >
                  Cancelar
                </button>

                <button
                  type="submit"
                  disabled={isCreatingUser}
                  className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold flex items-center gap-2 shadow-lg cursor-pointer"
                >
                  {isCreatingUser ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                  <span>Salvar {isContadorGestor ? 'Colaborador' : 'Usuário'}</span>
                </button>
              </div>
            </form>
          )}

          {/* Lista de Colaboradores e Usuários */}
          <div className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-4 shadow-lg">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Users className="w-4 h-4 text-cyan-400" />
                  {isContadorGestor ? 'Equipe Fiscal & Colaboradores Cadastrados' : 'Usuários do Sistema'}
                  <span className="px-2 py-0.5 rounded-full bg-cyan-950 border border-cyan-800 text-cyan-300 font-mono text-[10px]">
                    {allUsers.length}
                  </span>
                </h3>
                <p className="text-[11px] text-slate-400">
                  Gerencie as autorizações de acesso, altere permissões e defina quais botões cada membro pode carregar.
                </p>
              </div>

              <button
                type="button"
                onClick={loadUsers}
                disabled={isLoading}
                className="text-slate-400 hover:text-white flex items-center gap-1 text-xs cursor-pointer"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-cyan-400' : ''}`} />
                <span>Atualizar</span>
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left text-slate-300">
                <thead className="bg-slate-950 text-slate-400 font-bold uppercase tracking-wider text-[10px] border-b border-slate-800">
                  <tr>
                    <th className="p-3">Colaborador / E-mail</th>
                    <th className="p-3">Perfil Atribuído</th>
                    <th className="p-3">Nível Operacional</th>
                    <th className="p-3">Módulos Autorizados</th>
                    <th className="p-3">Empresas Autorizadas</th>
                    <th className="p-3 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-mono">
                  {allUsers.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="p-8 text-center text-slate-500 font-sans">
                        Nenhum colaborador cadastrado no seu escopo. Clique em "Novo Colaborador" acima.
                      </td>
                    </tr>
                  ) : (
                    allUsers.map((usr) => {
                      const modulosUser = parseModulosList(usr.modulosPermitidos);
                      const isFullModules = modulosUser.length >= TODOS_MODULOS.length;
                      const userPermissao = usr.empresasVinculadas?.[0]?.permissao || 'total';

                      return (
                        <tr key={usr.id} className="hover:bg-slate-800/40 transition-colors">
                          <td className="p-3 font-sans">
                            <div className="font-extrabold text-white">{usr.nome}</div>
                            <div className="text-[11px] text-slate-400">{usr.email}</div>
                          </td>

                          <td className="p-3">
                            <span className={`px-2 py-0.5 rounded font-bold font-sans text-[10px] uppercase ${
                              usr.perfil === 'admin_master'
                                ? 'bg-rose-950 text-rose-300 border border-rose-800'
                                : usr.perfil === 'suporte_ti'
                                ? 'bg-amber-950 text-amber-300 border border-amber-800'
                                : usr.perfil === 'contador_gestor'
                                ? 'bg-purple-950 text-purple-300 border border-purple-800'
                                : 'bg-indigo-950 text-indigo-300 border border-indigo-800'
                            }`}>
                              {formatPerfil(usr.perfil)}
                            </span>
                          </td>

                          <td className="p-3 font-sans">
                            <span className={`px-2 py-0.5 rounded font-bold text-[10px] ${
                              userPermissao === 'total'
                                ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                                : userPermissao === 'escrita'
                                ? 'bg-cyan-950 text-cyan-300 border border-cyan-800'
                                : 'bg-amber-950 text-amber-300 border border-amber-800'
                            }`}>
                              {userPermissao === 'total' ? 'TOTAL' : userPermissao === 'escrita' ? 'ESCRITA' : 'LEITURA'}
                            </span>
                          </td>

                          <td className="p-3 font-sans">
                            {isFullModules ? (
                              <span className="text-[11px] text-emerald-400 font-bold flex items-center gap-1">
                                <Check className="w-3 h-3" /> Todos os Módulos ({TODOS_MODULOS.length})
                              </span>
                            ) : (
                              <span className="text-[11px] text-cyan-300 font-mono">
                                {modulosUser.length} de {TODOS_MODULOS.length} botões liberados
                              </span>
                            )}
                          </td>

                          <td className="p-3 font-sans">
                            {usr.perfil === 'admin_master' || (usr.cnpjsAutorizados && usr.cnpjsAutorizados.includes('*')) ? (
                              <span className="text-[11px] text-emerald-400 font-bold">Acesso Global (*)</span>
                            ) : (usr.cnpjsAutorizados?.length || 0) === 0 ? (
                              <span className="text-[11px] text-amber-400 font-medium">Pendente de Vínculo</span>
                            ) : (
                              <span className="text-[11px] text-slate-300">
                                {usr.cnpjsAutorizados.length} empresa(s)
                              </span>
                            )}
                          </td>

                          <td className="p-3 text-right">
                            {canManageUser(usr) ? (
                              <div className="flex items-center justify-end gap-1.5">
                                <button
                                  onClick={() => {
                                    setEditingUser({ ...usr });
                                    setEditCnpjs(usr.cnpjsAutorizados || []);
                                    setEditPermissao(usr.empresasVinculadas?.[0]?.permissao || 'escrita');
                                    setEditModulos(parseModulosList(usr.modulosPermitidos));
                                    setEditSenha('');
                                    setEditError(null);
                                  }}
                                  className="p-1.5 rounded-lg bg-slate-800 hover:bg-cyan-600 text-slate-400 hover:text-white transition-all cursor-pointer"
                                  title="Editar Acessos & Módulos"
                                >
                                  <Edit3 className="w-3.5 h-3.5" />
                                </button>

                                {usr.id !== authUser?.id && (
                                  <button
                                    onClick={() => handleDeleteUser(usr.id, usr.nome)}
                                    className="p-1.5 rounded-lg bg-slate-800 hover:bg-rose-600 text-slate-400 hover:text-white transition-all cursor-pointer"
                                    title="Remover Colaborador"
                                  >
                                    <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                                  </button>
                                )}
                              </div>
                            ) : (
                              <span className="text-[10px] text-slate-500 font-sans italic">Protegido</span>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* TAB 2: MATRIZ DE PERMISSÕES & PERFIS PRONTOS                 */}
      {/* ============================================================ */}
      {activeTab === 'matriz' && (
        <div className="space-y-5">
          <div className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-4 shadow-lg">
            <div className="border-b border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-purple-400" />
                Matriz de Governança e Segregação de Funções (Perfis Prontos)
              </h3>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Modelos de acesso baseados nos papéis operacionais da empresa. Ao cadastrar um colaborador, você pode aplicar um perfil pronto ou personalizar livremente via checkboxes.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {PRESETS_ACESSO.map(preset => (
                <div key={preset.id} className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-2xl">{preset.icone}</span>
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-900 text-cyan-300 border border-slate-700">
                        {preset.badge}
                      </span>
                    </div>

                    <h4 className="font-bold text-white text-xs">{preset.nome}</h4>
                    <p className="text-[11px] text-slate-400 mt-1">{preset.descricao}</p>
                  </div>

                  <div className="pt-2 border-t border-slate-800/80 space-y-1.5">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-slate-500">Nível Operacional:</span>
                      <span className="font-bold text-emerald-400 uppercase">{preset.permissao}</span>
                    </div>
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-slate-500">Módulos Liberados:</span>
                      <span className="font-mono text-slate-300 font-bold">{preset.modulos.length} módulos</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* MODAL DE EDIÇÃO DE ACESSOS DO COLABORADOR (COM CHECKBOXES)    */}
      {/* ============================================================ */}
      {editingUser && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-4xl w-full p-5 sm:p-6 space-y-5 shadow-2xl my-auto max-h-[92vh] overflow-y-auto custom-scrollbar">
            
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-cyan-950/80 border border-cyan-700 flex items-center justify-center text-cyan-400">
                  <Edit3 className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">
                    Editar Acessos & Módulos: <span className="text-cyan-300">{editingUser.nome}</span>
                  </h3>
                  <p className="text-[11px] text-slate-400">{editingUser.email}</p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setEditingUser(null)}
                className="text-slate-400 hover:text-white text-xs font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Banner de Erro Descritivo Local */}
            {editError && (
              <div className="p-3.5 rounded-xl bg-rose-950/90 border border-rose-700/80 text-rose-200 text-xs flex items-start gap-2.5 animate-in fade-in duration-200">
                <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <div className="font-bold text-rose-300">Não foi possível salvar as alterações:</div>
                  <p className="text-rose-200 leading-relaxed font-sans">{editError}</p>
                  <div className="text-[11px] text-rose-300/80 font-sans mt-1">
                    💡 <strong>Como resolver:</strong> Verifique se você possui permissão sobre este colaborador e suas empresas vinculadas. Se o cadastro foi modificado recentemente, recarregue a listagem de usuários e tente novamente.
                  </div>
                </div>
              </div>
            )}

            <form onSubmit={handleUpdateUser} className="space-y-4 text-xs">
              {/* Dados Básicos */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="font-bold text-slate-300 block mb-1">Nome Completo</label>
                  <input
                    type="text"
                    required
                    value={editingUser.nome}
                    onChange={(e) => setEditingUser({ ...editingUser, nome: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:border-cyan-500"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-300 block mb-1">E-mail</label>
                  <input
                    type="email"
                    required
                    value={editingUser.email}
                    onChange={(e) => setEditingUser({ ...editingUser, email: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:border-cyan-500"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-300 block mb-1">Redefinir Senha (opcional)</label>
                  <input
                    type="password"
                    placeholder="Em branco para manter atual"
                    value={editSenha}
                    onChange={(e) => setEditSenha(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:border-cyan-500"
                  />
                </div>
              </div>

              {/* Perfis Prontos (Atalhos de 1 Clique para Edição) */}
              <div className="space-y-1.5">
                <div className="flex items-center gap-1.5 font-bold text-slate-300 text-[11px]">
                  <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Aplicar Perfil Pronto com 1 Clique:</span>
                </div>

                <div className="flex flex-wrap gap-2">
                  {PRESETS_ACESSO.map(preset => (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => applyPresetEdit(preset)}
                      className="px-2.5 py-1 rounded-lg bg-slate-950 hover:bg-slate-800 border border-slate-800 hover:border-cyan-500 text-[11px] text-slate-300 hover:text-white flex items-center gap-1.5 cursor-pointer transition-all"
                    >
                      <span>{preset.icone}</span>
                      <span className="font-bold">{preset.nome}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Nível de Operação */}
              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
                <label className="font-bold text-slate-300 block text-xs">
                  Nível de Operação Pós-Clique:
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <label className={`p-2.5 rounded-lg border cursor-pointer flex items-center gap-2 transition-all ${
                    editPermissao === 'total'
                      ? 'bg-emerald-950/60 border-emerald-600 text-white'
                      : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                  }`}>
                    <input
                      type="radio"
                      name="editPermissao"
                      value="total"
                      checked={editPermissao === 'total'}
                      onChange={() => setEditPermissao('total')}
                      className="text-emerald-500"
                    />
                    <div>
                      <span className="font-bold block text-emerald-300">Total (Completo)</span>
                      <span className="text-[10px] text-slate-400">Configurações e apuração</span>
                    </div>
                  </label>

                  <label className={`p-2.5 rounded-lg border cursor-pointer flex items-center gap-2 transition-all ${
                    editPermissao === 'escrita'
                      ? 'bg-cyan-950/60 border-cyan-600 text-white'
                      : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                  }`}>
                    <input
                      type="radio"
                      name="editPermissao"
                      value="escrita"
                      checked={editPermissao === 'escrita'}
                      onChange={() => setEditPermissao('escrita')}
                      className="text-cyan-500"
                    />
                    <div>
                      <span className="font-bold block text-cyan-300">Escrita (Operacional)</span>
                      <span className="text-[10px] text-slate-400">XMLs, eventos e lançamentos</span>
                    </div>
                  </label>

                  <label className={`p-2.5 rounded-lg border cursor-pointer flex items-center gap-2 transition-all ${
                    editPermissao === 'leitura'
                      ? 'bg-amber-950/60 border-amber-600 text-white'
                      : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                  }`}>
                    <input
                      type="radio"
                      name="editPermissao"
                      value="leitura"
                      checked={editPermissao === 'leitura'}
                      onChange={() => setEditPermissao('leitura')}
                      className="text-amber-500"
                    />
                    <div>
                      <span className="font-bold block text-amber-300">Leitura (Consulta)</span>
                      <span className="text-[10px] text-slate-400">Apenas relatórios e consultas</span>
                    </div>
                  </label>
                </div>
              </div>

              {/* Matriz de Checkboxes dos Módulos */}
              <div className="space-y-2.5">
                <div className="flex items-center justify-between border-b border-slate-800 pb-1.5">
                  <div className="flex items-center gap-2">
                    <Sliders className="w-4 h-4 text-cyan-400" />
                    <span className="font-bold text-white text-xs">
                      Módulos / Botões Autorizados para este Colaborador:
                    </span>
                    <span className="px-2 py-0.5 rounded-full bg-cyan-950 border border-cyan-700 text-cyan-300 font-mono text-[10px]">
                      {editModulos.length} de {TODOS_MODULOS.length} liberados
                    </span>
                  </div>

                  <div className="flex items-center gap-2 text-[10px]">
                    <button
                      type="button"
                      onClick={() => setEditModulos(TODOS_MODULOS.map(m => m.id))}
                      className="text-cyan-400 hover:text-cyan-300 font-bold cursor-pointer"
                    >
                      Selecionar Todos
                    </button>
                    <span className="text-slate-600">•</span>
                    <button
                      type="button"
                      onClick={() => setEditModulos([])}
                      className="text-slate-400 hover:text-white cursor-pointer"
                    >
                      Limpar
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {GRUPOS_MODULOS.map((grupo, gIdx) => {
                    const todosMarcados = grupo.modulos.every(m => editModulos.includes(m.id));
                    const qtdMarcados = grupo.modulos.filter(m => editModulos.includes(m.id)).length;

                    return (
                      <div key={gIdx} className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
                        <div className="flex items-center justify-between border-b border-slate-800/80 pb-1">
                          <span className="font-bold text-slate-200 text-[11px] uppercase tracking-wider">
                            {grupo.titulo}
                          </span>
                          <button
                            type="button"
                            onClick={() => toggleGrupoEdit(grupo.modulos)}
                            className="text-[10px] text-slate-400 hover:text-cyan-400 cursor-pointer font-mono"
                          >
                            {todosMarcados ? 'Desmarcar' : 'Marcar'} ({qtdMarcados}/{grupo.modulos.length})
                          </button>
                        </div>

                        <div className="space-y-1">
                          {grupo.modulos.map(mod => {
                            const isChecked = editModulos.includes(mod.id);

                            return (
                              <label
                                key={mod.id}
                                className={`p-1.5 rounded-lg border cursor-pointer flex items-center gap-2 transition-all ${
                                  isChecked
                                    ? 'bg-slate-900 border-cyan-700/60 text-white'
                                    : 'bg-slate-950/60 border-slate-800/60 text-slate-400 hover:bg-slate-900/40'
                                }`}
                              >
                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                  onChange={() => toggleModuloEdit(mod.id)}
                                  className="rounded border-slate-700 bg-slate-900 text-cyan-500 focus:ring-0 cursor-pointer"
                                />
                                <div className="min-w-0 flex-1 truncate">
                                  <span className={`font-bold text-xs truncate ${isChecked ? 'text-cyan-300' : 'text-slate-300'}`}>
                                    {mod.label}
                                  </span>
                                </div>
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Vínculo de Empresas */}
              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-300 block text-xs">
                    Empresas da Carteira Vinculadas:
                  </span>
                  <div className="flex items-center gap-2 text-[10px]">
                    <button
                      type="button"
                      onClick={() => setEditCnpjs(availableTenants.map(t => t.cnpjCompleto))}
                      className="text-cyan-400 hover:text-cyan-300 cursor-pointer font-bold"
                    >
                      Todas ({availableTenants.length})
                    </button>
                    <span className="text-slate-600">•</span>
                    <button
                      type="button"
                      onClick={() => setEditCnpjs([])}
                      className="text-slate-400 hover:text-white cursor-pointer"
                    >
                      Nenhuma
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 max-h-32 overflow-y-auto custom-scrollbar p-1">
                  {availableTenants.map(tenant => {
                    const isVinculada = editCnpjs.includes(tenant.cnpjCompleto);

                    return (
                      <label
                        key={tenant.id}
                        className={`p-2 rounded-lg border cursor-pointer flex items-center gap-2 text-[11px] transition-all ${
                          isVinculada
                            ? 'bg-slate-900 border-cyan-700/60 text-white'
                            : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isVinculada}
                          onChange={() => {
                            setEditCnpjs(prev =>
                              prev.includes(tenant.cnpjCompleto)
                                ? prev.filter(c => c !== tenant.cnpjCompleto)
                                : [...prev, tenant.cnpjCompleto]
                            );
                          }}
                          className="rounded border-slate-700 bg-slate-900 text-cyan-500 focus:ring-0"
                        />
                        <div className="min-w-0 truncate">
                          <span className="font-bold truncate block">{tenant.razaoSocial}</span>
                          <span className="font-mono text-[10px] text-slate-400">{tenant.cnpjCompleto}</span>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* Botões do Modal */}
              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setEditingUser(null)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 hover:text-white font-bold cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isUpdatingUser}
                  className="px-5 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white font-bold flex items-center gap-2 shadow-lg cursor-pointer"
                >
                  {isUpdatingUser ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                  <span>Salvar Alterações</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
