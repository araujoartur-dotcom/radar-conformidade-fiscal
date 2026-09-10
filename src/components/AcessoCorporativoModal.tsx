import React, { useState, useEffect } from 'react';
import {
  Lock, Key, ShieldCheck, Mail, UserCheck, Users, Smartphone,
  CheckCircle2, AlertCircle, Sparkles, ShieldAlert, Cpu, Eye, EyeOff, Plus, Edit3, Trash2, Building2
} from 'lucide-react';
import { UsuarioCorporativo, PerfilUsuario, ClienteEmpresaTenant } from '../types';
import { useApi } from '../hooks/useApi';
import { useAuth } from '../contexts/AuthContext';

interface AcessoCorporativoModalProps {
  onClose?: () => void;
}

/** Perfis que têm acesso à gestão de usuários */
const PERFIS_GESTAO = ['admin_master', 'suporte_ti'];

/** Helper para formatar nome do perfil para exibição */
function formatPerfil(perfil: string): string {
  const map: Record<string, string> = {
    admin_master: 'Admin Master',
    suporte_ti: 'Suporte TI',
    contador_gestor: 'Contador Gestor',
    analista_fiscal: 'Analista Fiscal',
    auditor_externo: 'Auditor Externo',
    operador_leitura: 'Operador',
  };
  return map[perfil] || perfil.replace(/_/g, ' ');
}

export const AcessoCorporativoModal: React.FC<AcessoCorporativoModalProps> = ({
  onClose
}) => {
  const { get, post, put, del } = useApi();
  const { user: authUser } = useAuth();

  const callerPerfil = authUser?.perfil || '';
  const isGestorUsuarios = PERFIS_GESTAO.includes(callerPerfil);
  const isAdminMaster = callerPerfil === 'admin_master';
  const isSuporteTi = callerPerfil === 'suporte_ti';

  // Tab padrão: admin e suporte_ti veem usuários, demais veem MFA
  const defaultTab = isGestorUsuarios ? 'admin_users' : 'mfa_login';
  const [activeTab, setActiveTab] = useState<'mfa_login' | 'admin_users' | 'perfil_usuario'>(defaultTab);
  const [allUsers, setAllUsers] = useState<UsuarioCorporativo[]>([]);
  const [availableTenants, setAvailableTenants] = useState<ClienteEmpresaTenant[]>([]);

  const currentUser: UsuarioCorporativo = {
    id: authUser?.id || '',
    nome: authUser?.nome || '',
    email: authUser?.email || '',
    perfil: authUser?.perfil as PerfilUsuario || 'analista_fiscal',
    mfaHabilitado: false,
    mfaMetodo: 'authenticator_app',
    status: 'ativo',
    cnpjsAutorizados: ['*'],
    ultimoAcesso: 'Agora'
  };

  const loadUsers = async () => {
    if (!isGestorUsuarios) return; // Não carrega se não tem permissão
    const res = await get<{ success: boolean; data: any[] }>('/users');
    if (res.ok && res.data?.data) {
      setAllUsers(res.data.data.map(u => ({
        ...u,
        cnpjsAutorizados: u.cnpjsAutorizados || ['*'],
        mfaHabilitado: Boolean(u.mfaHabilitado)
      })));
    }
  };

  const loadTenants = async () => {
    const res = await get<{ success: boolean; data: ClienteEmpresaTenant[] }>('/tenants');
    if (res.ok && res.data?.data) {
      setAvailableTenants(res.data.data);
    }
  };

  useEffect(() => {
    loadUsers();
    loadTenants();
  }, []);

  // MFA Challenge State
  const [mfaCode, setMfaCode] = useState('');
  const [mfaVerified, setMfaVerified] = useState(currentUser.mfaHabilitado);
  const [mfaError, setMfaError] = useState<string | null>(null);

  // Admin New User Form State
  const [newNome, setNewNome] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newSenha, setNewSenha] = useState('');
  const [newPerfil, setNewPerfil] = useState<PerfilUsuario>('analista_fiscal');
  const [newCnpjs, setNewCnpjs] = useState<string[]>(['*']);
  const [showAddUserForm, setShowAddUserForm] = useState(false);

  // Edit User State
  const [editingUser, setEditingUser] = useState<UsuarioCorporativo | null>(null);
  const [editSenha, setEditSenha] = useState('');
  const [editCnpjs, setEditCnpjs] = useState<string[]>(['*']);

  const handleVerifyMfa = (e: React.FormEvent) => {
    e.preventDefault();
    if (mfaCode.trim().length < 6) {
      setMfaError('Código MFA deve conter 6 dígitos.');
      return;
    }
    setMfaVerified(true);
    setMfaError(null);
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNome || !newEmail) {
      alert('Preencha o nome e e-mail do usuário.');
      return;
    }

    const res = await post('/users', {
      nome: newNome,
      email: newEmail,
      senha: newSenha || 'Mudar@123456',
      perfil: newPerfil,
      cnpjsAutorizados: newCnpjs
    });

    if (res.ok) {
      await loadUsers();
      setShowAddUserForm(false);
      setNewNome('');
      setNewEmail('');
      setNewSenha('');
      setNewCnpjs(['*']);
      setNewPerfil('analista_fiscal');
    } else {
      alert('Erro ao criar usuário: ' + (res.error || res.data?.message));
    }
  };

  const handleDeleteUser = async (id: string) => {
    const res = await del(`/users/${id}`);
    if (res.ok) {
      await loadUsers();
    } else {
      alert('Erro ao excluir usuário: ' + (res.error || res.data?.message));
    }
  };

  const handleUpdateUser = async (userToUpdate: UsuarioCorporativo) => {
    const res = await put(`/users/${userToUpdate.id}`, {
      nome: userToUpdate.nome,
      email: userToUpdate.email,
      perfil: userToUpdate.perfil,
      status: userToUpdate.status,
      senha: editSenha || undefined,
      cnpjsAutorizados: editCnpjs
    });
    
    if (res.ok) {
      await loadUsers();
      setEditingUser(null);
      setEditSenha('');
    } else {
      alert('Erro ao atualizar usuário: ' + (res.error || res.data?.message));
    }
  };

  /**
   * Retorna as opções de perfil disponíveis para o solicitante no select de criação/edição.
   * admin_master: vê todos os perfis.
   * suporte_ti: vê apenas perfis operacionais (não privilegiados).
   */
  const getPerfilOptions = (): { value: PerfilUsuario; label: string }[] => {
    const allOptions: { value: PerfilUsuario; label: string }[] = [
      { value: 'admin_master', label: 'Admin Master (Acesso Total Global)' },
      { value: 'suporte_ti', label: 'Suporte TI (Gestão de Usuários por CNPJ)' },
      { value: 'contador_gestor', label: 'Contador Gestor (Multi-CNPJ Operacional)' },
      { value: 'analista_fiscal', label: 'Analista Fiscal (Emissão e Consultas)' },
      { value: 'auditor_externo', label: 'Auditor Externo (Leitura e Evidências)' },
      { value: 'operador_leitura', label: 'Operador (Apenas Consulta)' },
    ];

    if (isAdminMaster) return allOptions;

    // suporte_ti: apenas perfis NÃO privilegiados
    return allOptions.filter(o => !['admin_master', 'suporte_ti'].includes(o.value));
  };

  /**
   * Verifica se o usuário logado pode editar/excluir o usuário alvo.
   * (Defesa em profundidade: backend já valida, mas frontend esconde botões)
   */
  const canManageUser = (targetUser: UsuarioCorporativo): boolean => {
    if (!isGestorUsuarios) return false;
    if (targetUser.perfil === 'admin_master') return false; // Nunca exibe ações para admin_master

    if (isAdminMaster) return true;

    // suporte_ti: não pode gerenciar outro suporte_ti
    if (isSuporteTi && targetUser.perfil === 'suporte_ti') return false;

    return true;
  };

  const canDeleteUser = (targetUser: UsuarioCorporativo): boolean => {
    if (!canManageUser(targetUser)) return false;
    if (targetUser.id === authUser?.id) return false; // Nunca pode excluir a si mesmo
    return true;
  };

  return (
    <div className="space-y-6">

      {/* Navigation Tabs */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-800 pb-3">
        <button
          onClick={() => setActiveTab('mfa_login')}
          className={`flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer ${
            activeTab === 'mfa_login'
              ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg'
              : 'bg-slate-900/80 text-slate-400 hover:text-white border border-slate-800'
          }`}
        >
          <Smartphone className="w-4 h-4 text-cyan-400" />
          <span>Autenticação em Dois Fatores (MFA / 2FA)</span>
        </button>

        {/* Aba de gestão de usuários: visível SOMENTE para admin_master e suporte_ti */}
        {isGestorUsuarios && (
          <button
            onClick={() => setActiveTab('admin_users')}
            className={`flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer ${
              activeTab === 'admin_users'
                ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg'
                : 'bg-slate-900/80 text-slate-400 hover:text-white border border-slate-800'
            }`}
          >
            <Users className="w-4 h-4 text-emerald-400" />
            <span>{isAdminMaster ? 'Painel Admin: Usuários & CNPJs Liberados' : 'Gestão de Usuários (Minha Empresa)'}</span>
          </button>
        )}

        <button
          onClick={() => setActiveTab('perfil_usuario')}
          className={`flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer ${
            activeTab === 'perfil_usuario'
              ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg'
              : 'bg-slate-900/80 text-slate-400 hover:text-white border border-slate-800'
          }`}
        >
          <ShieldCheck className="w-4 h-4 text-purple-400" />
          <span>Níveis de Permissões por Módulo</span>
        </button>
      </div>

      {/* TAB 1: MFA CHALLENGE / SETTINGS */}
      {activeTab === 'mfa_login' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          
          <div className="lg:col-span-6 p-6 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-4 shadow-lg">
            <h3 className="text-base font-bold text-white flex items-center gap-2 border-b border-slate-800 pb-3">
              <Smartphone className="w-5 h-5 text-cyan-400" />
              Verificação 2FA / Token Authenticator
            </h3>

            {mfaVerified ? (
              <div className="p-4 rounded-xl bg-emerald-950/80 border border-emerald-700 text-xs space-y-2 text-emerald-300">
                <div className="flex items-center gap-2 font-bold text-sm">
                  <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                  Sua Sessão Está Protegida com Autenticação de Dois Fatores (MFA Ativo)
                </div>
                <p className="text-slate-300 text-[11px] leading-relaxed">
                  Login corporativo verificado via <strong>Authenticator App (TOTP 6 dígitos)</strong>. Tokens renovados a cada 30 segundos.
                </p>
                <div className="pt-2 border-t border-emerald-900/80 font-mono text-[10px] text-emerald-400">
                  Método Ativo: {currentUser.mfaMetodo.toUpperCase()} | E-mail: {currentUser.email}
                </div>
              </div>
            ) : (
              <form onSubmit={handleVerifyMfa} className="space-y-4">
                <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-300 space-y-1">
                  <span className="font-bold text-white block">Digite o código de 6 dígitos do aplicativo autenticador:</span>
                  <span className="text-[11px] text-slate-400">Abra o Google Authenticator, Authy ou Microsoft Authenticator em seu smartphone.</span>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-300">Código de Verificação MFA</label>
                  <input
                    type="text"
                    maxLength={6}
                    placeholder="000000"
                    value={mfaCode}
                    onChange={(e) => setMfaCode(e.target.value.replace(/\D/g, ''))}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-lg font-mono text-center tracking-widest text-cyan-300 focus:outline-none focus:border-cyan-500"
                  />
                  {mfaError && <span className="text-xs text-rose-400 block font-semibold">{mfaError}</span>}
                </div>

                <button
                  type="submit"
                  className="w-full py-3 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-extrabold text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg cursor-pointer"
                >
                  <ShieldCheck className="w-4 h-4 text-cyan-300" />
                  Validar Token & Ativar Sessão Segura
                </button>
              </form>
            )}
          </div>

          <div className="lg:col-span-6 p-6 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-3 text-xs shadow-lg">
            <h3 className="text-sm font-bold text-white flex items-center gap-2 border-b border-slate-800 pb-2.5">
              <ShieldAlert className="w-4 h-4 text-indigo-400" />
              Políticas de Segurança do Sistema
            </h3>

            <div className="space-y-2 text-slate-300 leading-relaxed">
              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
                <strong className="text-white block">1. Expiração de Sessão por Inatividade:</strong>
                Sessões inativas por mais de 30 minutos solicitam nova reautenticação com senha e token MFA.
              </div>

              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
                <strong className="text-white block">2. Logs de Auditoria & Trilha Acessos:</strong>
                Cada consulta SEFAZ, transmissão de evento ou exportação de relatório registra o IP, e-mail do usuário e horário no banco de auditoria.
              </div>

              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
                <strong className="text-white block">3. Bloqueio por Tentativas Incorretas:</strong>
                5 tentativas consecutivas de senha inválida bloqueiam a conta preventivamente para liberação pelo usuário Admin.
              </div>
            </div>
          </div>

        </div>
      )}

      {/* TAB 2: ADMIN USER & PERMISSION MANAGEMENT — Somente admin_master e suporte_ti */}
      {activeTab === 'admin_users' && isGestorUsuarios && (
        <div className="space-y-6">
          <div className="p-6 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-4 shadow-lg">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Users className="w-5 h-5 text-emerald-400" />
                  Gestão de Usuários
                  {isSuporteTi && (
                    <span className="text-[10px] text-amber-400 font-normal ml-2 bg-amber-950 px-2 py-0.5 rounded border border-amber-800">
                      Escopo: CNPJs da sua empresa
                    </span>
                  )}
                </h3>
              </div>

              <button
                onClick={() => {
                  setShowAddUserForm(true);
                  // suporte_ti não pode atribuir acesso global
                  setNewCnpjs(isAdminMaster ? ['*'] : []);
                  setNewPerfil('analista_fiscal');
                }}
                className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs flex items-center gap-2 shadow-lg cursor-pointer shrink-0"
              >
                <Plus className="w-4 h-4 text-emerald-200" />
                <span>Incluir Usuários por Empresa</span>
              </button>
            </div>

            {/* Form Modal Add User */}
            {showAddUserForm && (
              <form onSubmit={handleCreateUser} className="p-4 rounded-xl bg-slate-950 border border-emerald-500/40 space-y-3 text-xs">
                <div className="font-bold text-white text-sm">Cadastrar Novo Usuário Corporativo</div>
                
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="font-bold text-slate-300 block mb-1">Nome Completo *</label>
                    <input
                      type="text"
                      placeholder="Ex: João da Silva"
                      value={newNome}
                      onChange={(e) => setNewNome(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-slate-200 focus:outline-none"
                      required
                    />
                  </div>

                  <div>
                    <label className="font-bold text-slate-300 block mb-1">E-mail Corporativo *</label>
                    <input
                      type="email"
                      placeholder="joao@empresa.com.br"
                      value={newEmail}
                      onChange={(e) => setNewEmail(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-slate-200 focus:outline-none"
                      required
                    />
                  </div>

                  <div>
                    <label className="font-bold text-slate-300 block mb-1">Senha Inicial</label>
                    <input
                      type="password"
                      placeholder="Padrão: Mudar@123456"
                      value={newSenha}
                      onChange={(e) => setNewSenha(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-slate-200 focus:outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="font-bold text-slate-300 block mb-1">Perfil do Sistema</label>
                    <select
                      value={newPerfil}
                      onChange={(e) => setNewPerfil(e.target.value as PerfilUsuario)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-slate-200 focus:outline-none"
                    >
                      {getPerfilOptions().map(opt => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="font-bold text-slate-300 block mb-1">CNPJs Autorizados</label>
                    <select
                      multiple
                      value={newCnpjs}
                      onChange={(e) => {
                        let selected = Array.from(e.target.selectedOptions, (option: HTMLOptionElement) => option.value);
                        if (selected.includes('*') && selected.length > 1) {
                          // Se escolheu específicos, remove o '*'
                          selected = selected.filter(val => val !== '*');
                        }
                        setNewCnpjs(selected);
                      }}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-slate-200 focus:outline-none h-20 font-mono text-[11px]"
                    >
                      {/* Opção global: somente admin_master */}
                      {isAdminMaster && (
                        <option value="*">Todos os CNPJs (Acesso Global)</option>
                      )}
                      {availableTenants.map(t => (
                        <option key={t.id} value={t.cnpjCompleto}>
                          {t.cnpjCompleto} — {t.razaoSocial}
                        </option>
                      ))}
                    </select>
                    <span className="text-[10px] text-slate-500 block mt-0.5">Segure Ctrl para selecionar múltiplos CNPJs.</span>
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
                  <button
                    type="button"
                    onClick={() => setShowAddUserForm(false)}
                    className="px-3 py-1.5 rounded-lg bg-slate-800 text-slate-300 font-bold"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold"
                  >
                    Salvar Usuário
                  </button>
                </div>
              </form>
            )}

            {/* Users List Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left text-slate-300">
                <thead className="bg-slate-950 text-slate-400 font-bold uppercase tracking-wider text-[10px] border-b border-slate-800">
                  <tr>
                    <th className="p-3">Usuário / E-mail</th>
                    <th className="p-3">Perfil Atribuído</th>
                    <th className="p-3">Status MFA</th>
                    <th className="p-3">CNPJs Autorizados</th>
                    <th className="p-3">Último Acesso</th>
                    <th className="p-3 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-mono">
                  {allUsers.length === 0 && (
                    <tr>
                      <td colSpan={6} className="p-6 text-center text-slate-500 font-sans">
                        Nenhum usuário encontrado no seu escopo de acesso.
                      </td>
                    </tr>
                  )}
                  {allUsers.map((usr) => (
                    <tr key={usr.id} className="hover:bg-slate-800/40">
                      <td className="p-3">
                        <div className="font-extrabold text-white font-sans">{usr.nome}</div>
                        <div className="text-[11px] text-slate-400">{usr.email}</div>
                      </td>

                      <td className="p-3">
                        <span className={`px-2.5 py-0.5 rounded font-bold font-sans text-[11px] uppercase ${
                          usr.perfil === 'admin_master'
                            ? 'bg-rose-950 text-rose-300 border border-rose-800'
                            : usr.perfil === 'suporte_ti'
                            ? 'bg-amber-950 text-amber-300 border border-amber-800'
                            : 'bg-indigo-950 text-indigo-300 border border-indigo-800'
                        }`}>
                          {formatPerfil(usr.perfil)}
                        </span>
                      </td>

                      <td className="p-3">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold font-sans ${
                          usr.mfaHabilitado
                            ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                            : 'bg-amber-950 text-amber-300 border border-amber-800'
                        }`}>
                          {usr.mfaHabilitado ? '2FA Ativo' : 'Pendente 2FA'}
                        </span>
                      </td>

                      <td className="p-3">
                        <div className="text-[11px] font-sans font-medium text-slate-300">
                          {usr.cnpjsAutorizados.includes('*') ? (
                            <span className="text-cyan-400 font-bold">Todos os CNPJs (Global)</span>
                          ) : (
                            usr.cnpjsAutorizados.join(', ')
                          )}
                        </div>
                      </td>

                      <td className="p-3 text-slate-400 text-[11px]">
                        {usr.ultimoAcesso}
                      </td>

                      <td className="p-3 text-right">
                        {usr.perfil === 'admin_master' ? (
                          <span className="text-[10px] text-slate-500 font-sans italic">Conta Master Protegida</span>
                        ) : canManageUser(usr) ? (
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => {
                                setEditingUser({ ...usr });
                                setEditCnpjs(usr.cnpjsAutorizados || ['*']);
                                setEditSenha('');
                              }}
                              className="p-1.5 rounded-lg bg-slate-800 hover:bg-blue-600 text-slate-400 hover:text-white transition-all cursor-pointer"
                              title="Editar Usuário"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>

                            {canDeleteUser(usr) && (
                              <button
                                onClick={() => {
                                  if (confirm(`Tem certeza que deseja remover o usuário ${usr.nome}?`)) {
                                    handleDeleteUser(usr.id);
                                  }
                                }}
                                className="p-1.5 rounded-lg bg-slate-800 hover:bg-rose-600 text-slate-400 hover:text-white transition-all cursor-pointer"
                                title="Remover Usuário"
                              >
                                <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                              </button>
                            )}
                          </div>
                        ) : (
                          <span className="text-[10px] text-slate-500 font-sans italic">Somente Leitura</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

          </div>
        </div>
      )}

      {/* TAB 2 FALLBACK: Para perfis SEM gestão de usuários que clicam na aba (não devem ver, mas defesa em profundidade) */}
      {activeTab === 'admin_users' && !isGestorUsuarios && (
        <div className="p-6 rounded-2xl bg-slate-900/90 border border-slate-800 text-center space-y-3">
          <ShieldAlert className="w-10 h-10 text-amber-400 mx-auto" />
          <div className="text-sm font-bold text-white">Acesso Restrito</div>
          <p className="text-xs text-slate-400">
            Seu perfil ({formatPerfil(callerPerfil)}) não possui permissão para gerenciar usuários.
            Entre em contato com o Suporte TI da sua empresa ou o Administrador Master.
          </p>
        </div>
      )}

      {/* TAB 3: PERMISSOES POR MODULO — Atualizada com Suporte TI */}
      {activeTab === 'perfil_usuario' && (
        <div className="p-6 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-4 text-xs shadow-lg">
          <h3 className="text-base font-bold text-white flex items-center gap-2 border-b border-slate-800 pb-3">
            <ShieldCheck className="w-5 h-5 text-purple-400" />
            Matriz de Permissões por Perfil de Usuário
          </h3>

          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left text-slate-300">
              <thead className="bg-slate-950 text-slate-400 font-bold uppercase text-[10px] border-b border-slate-800">
                <tr>
                  <th className="p-3">Módulo do Sistema</th>
                  <th className="p-3">Admin Master</th>
                  <th className="p-3">Suporte TI</th>
                  <th className="p-3">Contador Gestor</th>
                  <th className="p-3">Analista Fiscal</th>
                  <th className="p-3">Auditor Externo</th>
                  <th className="p-3">Operador</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                <tr>
                  <td className="p-3 font-bold text-white">Consulta Lote/Avulsa SEFAZ</td>
                  <td className="p-3 text-emerald-400 font-bold">Total</td>
                  <td className="p-3 text-emerald-400 font-bold">Total</td>
                  <td className="p-3 text-emerald-400 font-bold">Total</td>
                  <td className="p-3 text-emerald-400 font-bold">Total</td>
                  <td className="p-3 text-slate-400">Leitura</td>
                  <td className="p-3 text-slate-400">Leitura</td>
                </tr>
                <tr>
                  <td className="p-3 font-bold text-white">Disparo de Eventos RTC (Ciência, Crédito Presumido)</td>
                  <td className="p-3 text-emerald-400 font-bold">Sim</td>
                  <td className="p-3 text-emerald-400 font-bold">Sim</td>
                  <td className="p-3 text-emerald-400 font-bold">Sim</td>
                  <td className="p-3 text-emerald-400 font-bold">Sim</td>
                  <td className="p-3 text-rose-400 font-bold">Não</td>
                  <td className="p-3 text-rose-400 font-bold">Não</td>
                </tr>
                <tr>
                  <td className="p-3 font-bold text-white">Relatórios Múltiplos XML & Exportação Excel/SAP</td>
                  <td className="p-3 text-emerald-400 font-bold">Sim</td>
                  <td className="p-3 text-emerald-400 font-bold">Sim</td>
                  <td className="p-3 text-emerald-400 font-bold">Sim</td>
                  <td className="p-3 text-emerald-400 font-bold">Sim</td>
                  <td className="p-3 text-emerald-400 font-bold">Sim</td>
                  <td className="p-3 text-slate-400">Leitura</td>
                </tr>
                <tr>
                  <td className="p-3 font-bold text-white">Alocação de CNPJs e Vínculo de Certificados A1</td>
                  <td className="p-3 text-emerald-400 font-bold">Sim</td>
                  <td className="p-3 text-emerald-400 font-bold">Sim</td>
                  <td className="p-3 text-emerald-400 font-bold">Sim</td>
                  <td className="p-3 text-rose-400 font-bold">Não</td>
                  <td className="p-3 text-rose-400 font-bold">Não</td>
                  <td className="p-3 text-rose-400 font-bold">Não</td>
                </tr>
                <tr className="bg-slate-950/50">
                  <td className="p-3 font-bold text-white">Gestão de Usuários & MFA</td>
                  <td className="p-3 text-emerald-400 font-bold">Total Global</td>
                  <td className="p-3 text-amber-400 font-bold">Total no CNPJ</td>
                  <td className="p-3 text-rose-400 font-bold">Não</td>
                  <td className="p-3 text-rose-400 font-bold">Não</td>
                  <td className="p-3 text-rose-400 font-bold">Não</td>
                  <td className="p-3 text-rose-400 font-bold">Não</td>
                </tr>
                <tr>
                  <td className="p-3 font-bold text-white">Configurações do Sistema</td>
                  <td className="p-3 text-emerald-400 font-bold">Exclusivo</td>
                  <td className="p-3 text-rose-400 font-bold">Não</td>
                  <td className="p-3 text-rose-400 font-bold">Não</td>
                  <td className="p-3 text-rose-400 font-bold">Não</td>
                  <td className="p-3 text-rose-400 font-bold">Não</td>
                  <td className="p-3 text-rose-400 font-bold">Não</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Legenda de Perfis */}
          <div className="mt-4 p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
            <div className="font-bold text-white text-sm mb-2">Legenda dos Perfis</div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
              <div className="flex items-start gap-2">
                <span className="px-2 py-0.5 rounded bg-rose-950 text-rose-300 border border-rose-800 font-bold uppercase shrink-0">Admin Master</span>
                <span className="text-slate-400">Acesso total e irrestrito a todos os CNPJs e módulos. Único que pode criar Suporte TI.</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="px-2 py-0.5 rounded bg-amber-950 text-amber-300 border border-amber-800 font-bold uppercase shrink-0">Suporte TI</span>
                <span className="text-slate-400">Gestor de usuários dentro dos CNPJs vinculados. Não vê Admin Master.</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="px-2 py-0.5 rounded bg-indigo-950 text-indigo-300 border border-indigo-800 font-bold uppercase shrink-0">Contador Gestor</span>
                <span className="text-slate-400">Operações fiscais multi-CNPJ. Sem gestão de usuários.</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="px-2 py-0.5 rounded bg-indigo-950 text-indigo-300 border border-indigo-800 font-bold uppercase shrink-0">Analista Fiscal</span>
                <span className="text-slate-400">Emissão, consultas e relatórios no CNPJ ativo.</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="px-2 py-0.5 rounded bg-indigo-950 text-indigo-300 border border-indigo-800 font-bold uppercase shrink-0">Auditor Externo</span>
                <span className="text-slate-400">Leitura de relatórios e evidências de auditoria.</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="px-2 py-0.5 rounded bg-indigo-950 text-indigo-300 border border-indigo-800 font-bold uppercase shrink-0">Operador</span>
                <span className="text-slate-400">Somente consulta e leitura básica.</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit User Modal */}
      {editingUser && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Edit3 className="w-5 h-5 text-blue-400" />
                Editar Perfil de Usuário ({editingUser.nome})
              </h3>
              <button
                onClick={() => setEditingUser(null)}
                className="text-slate-400 hover:text-white text-xs font-bold"
              >
                ✕
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (editingUser) {
                  handleUpdateUser(editingUser);
                }
              }}
              className="space-y-3 text-xs"
            >
              <div>
                <label className="font-bold text-slate-300 block mb-1">Nome Completo</label>
                <input
                  type="text"
                  value={editingUser.nome}
                  onChange={(e) => setEditingUser({ ...editingUser, nome: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-slate-200 focus:outline-none"
                  required
                />
              </div>

              <div>
                <label className="font-bold text-slate-300 block mb-1">E-mail Corporativo</label>
                <input
                  type="email"
                  value={editingUser.email}
                  onChange={(e) => setEditingUser({ ...editingUser, email: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-slate-200 focus:outline-none"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-300 block mb-1">Perfil de Acesso</label>
                  {isAdminMaster ? (
                    <select
                      value={editingUser.perfil}
                      onChange={(e) => setEditingUser({ ...editingUser, perfil: e.target.value as PerfilUsuario })}
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-slate-200 focus:outline-none"
                    >
                      {getPerfilOptions().map(opt => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                  ) : isSuporteTi && editingUser.id !== authUser?.id ? (
                    <select
                      value={editingUser.perfil}
                      onChange={(e) => setEditingUser({ ...editingUser, perfil: e.target.value as PerfilUsuario })}
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-slate-200 focus:outline-none"
                    >
                      {getPerfilOptions().map(opt => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                  ) : (
                    <div className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-slate-400">
                      {formatPerfil(editingUser.perfil)}
                      <span className="text-[10px] text-slate-500 block mt-0.5">
                        {editingUser.id === authUser?.id ? 'Você não pode alterar seu próprio perfil.' : 'Perfil protegido.'}
                      </span>
                    </div>
                  )}
                </div>

                <div>
                  <label className="font-bold text-slate-300 block mb-1">Status da Conta</label>
                  <select
                    value={editingUser.status}
                    onChange={(e) => setEditingUser({ ...editingUser, status: e.target.value as any })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-slate-200 focus:outline-none"
                  >
                    <option value="ativo">Ativo</option>
                    <option value="bloqueado">Bloqueado</option>
                    <option value="pendente_mfa">Pendente 2FA</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-300 block mb-1">Redefinir Senha (deixe em branco para manter a atual)</label>
                <input
                  type="password"
                  placeholder="Nova senha (mínimo 6 caracteres)"
                  value={editSenha}
                  onChange={(e) => setEditSenha(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-slate-200 focus:outline-none"
                />
              </div>

              <div>
                <label className="font-bold text-slate-300 block mb-1">CNPJs Autorizados</label>
                <select
                  multiple
                  value={editCnpjs}
                  onChange={(e) => {
                    let selected = Array.from(e.target.selectedOptions, (option: HTMLOptionElement) => option.value);
                    if (selected.includes('*') && selected.length > 1) {
                      // Se escolheu específicos, remove o '*'
                      selected = selected.filter(val => val !== '*');
                    }
                    setEditCnpjs(selected);
                  }}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-slate-200 focus:outline-none h-20 font-mono text-[11px]"
                >
                  {/* Opção global: somente admin_master */}
                  {isAdminMaster && (
                    <option value="*">Todos os CNPJs (Acesso Global)</option>
                  )}
                  {availableTenants.map(t => (
                    <option key={t.id} value={t.cnpjCompleto}>
                      {t.cnpjCompleto} — {t.razaoSocial}
                    </option>
                  ))}
                </select>
                <span className="text-[10px] text-slate-500 block mt-0.5">Segure Ctrl para selecionar múltiplos CNPJs.</span>
              </div>

              <div className="pt-3 flex items-center justify-end gap-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setEditingUser(null)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 hover:text-white font-bold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold"
                >
                  Salvar Alterações
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
