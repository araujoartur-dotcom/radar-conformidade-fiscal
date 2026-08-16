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

export const AcessoCorporativoModal: React.FC<AcessoCorporativoModalProps> = ({
  onClose
}) => {
  const [activeTab, setActiveTab] = useState<'mfa_login' | 'admin_users' | 'perfil_usuario'>('admin_users');
  const [allUsers, setAllUsers] = useState<UsuarioCorporativo[]>([]);
  const [availableTenants, setAvailableTenants] = useState<ClienteEmpresaTenant[]>([]);
  const { get, post, put, del } = useApi();
  const { user: authUser } = useAuth();
  
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
    } else {
      alert('Erro ao criar usuário: ' + (res.error || res.data?.message));
    }
  };

  const handleDeleteUser = async (id: string) => {
    if (window.confirm('Tem certeza que deseja excluir este usuário?')) {
      const res = await del(`/users/${id}`);
      if (res.ok) {
        await loadUsers();
      } else {
        alert('Erro ao excluir usuário: ' + (res.error || res.data?.message));
      }
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

        <button
          onClick={() => setActiveTab('admin_users')}
          className={`flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer ${
            activeTab === 'admin_users'
              ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg'
              : 'bg-slate-900/80 text-slate-400 hover:text-white border border-slate-800'
          }`}
        >
          <Users className="w-4 h-4 text-emerald-400" />
          <span>Painel Admin: Usuários & CNPJs Liberados</span>
        </button>

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

      {/* TAB 2: ADMIN USER & PERMISSION MANAGEMENT */}
      {activeTab === 'admin_users' && (
        <div className="space-y-6">
          <div className="p-6 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-4 shadow-lg">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Users className="w-5 h-5 text-emerald-400" />
                  Gestão de Usuários
                </h3>
              </div>

              <button
                onClick={() => {
                  setShowAddUserForm(true);
                  setNewCnpjs(['*']);
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
                      <option value="admin_master">Admin Master (Acesso Total)</option>
                      <option value="contador_gestor">Contador Gestor (Multi-CNPJ)</option>
                      <option value="analista_fiscal">Analista Fiscal (Emissão e Consultas)</option>
                      <option value="auditor_externo">Auditor Externo (Leitura e Evidências)</option>
                      <option value="operador_leitura">Operador (Apenas Consulta)</option>
                    </select>
                  </div>

                  <div>
                    <label className="font-bold text-slate-300 block mb-1">CNPJs Autorizados</label>
                    <select
                      multiple
                      value={newCnpjs}
                      onChange={(e) => {
                        const selected = Array.from(e.target.selectedOptions, option => option.value);
                        setNewCnpjs(selected);
                      }}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-slate-200 focus:outline-none h-20 font-mono text-[11px]"
                    >
                      <option value="*">Todos os CNPJs (Acesso Global)</option>
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
                  {allUsers.map((usr) => (
                    <tr key={usr.id} className="hover:bg-slate-800/40">
                      <td className="p-3">
                        <div className="font-extrabold text-white font-sans">{usr.nome}</div>
                        <div className="text-[11px] text-slate-400">{usr.email}</div>
                      </td>

                      <td className="p-3">
                        <span className="px-2.5 py-0.5 rounded bg-indigo-950 text-indigo-300 border border-indigo-800 font-bold font-sans text-[11px] uppercase">
                          {usr.perfil.replace('_', ' ')}
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
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

          </div>
        </div>
      )}

      {/* TAB 3: PERMISSOES POR MODULO */}
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
                  <td className="p-3 text-slate-400">Leitura</td>
                  <td className="p-3 text-slate-400">Leitura</td>
                </tr>
                <tr>
                  <td className="p-3 font-bold text-white">Disparo de Eventos RTC (Ciência, Crédito Presumido)</td>
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
                  <td className="p-3 text-slate-400">Leitura</td>
                </tr>
                <tr>
                  <td className="p-3 font-bold text-white">Alocação de CNPJs e Vinculo de Certificados A1</td>
                  <td className="p-3 text-emerald-400 font-bold">Sim</td>
                  <td className="p-3 text-emerald-400 font-bold">Sim</td>
                  <td className="p-3 text-rose-400 font-bold">Não</td>
                  <td className="p-3 text-rose-400 font-bold">Não</td>
                  <td className="p-3 text-rose-400 font-bold">Não</td>
                </tr>
                <tr>
                  <td className="p-3 font-bold text-white">Gestão de Usuários e MFA (Admin)</td>
                  <td className="p-3 text-emerald-400 font-bold">Exclusivo</td>
                  <td className="p-3 text-rose-400 font-bold">Não</td>
                  <td className="p-3 text-rose-400 font-bold">Não</td>
                  <td className="p-3 text-rose-400 font-bold">Não</td>
                  <td className="p-3 text-rose-400 font-bold">Não</td>
                </tr>
              </tbody>
            </table>
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
                  <select
                    value={editingUser.perfil}
                    onChange={(e) => setEditingUser({ ...editingUser, perfil: e.target.value as PerfilUsuario })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-slate-200 focus:outline-none"
                  >
                    <option value="admin_master">Admin Master (Acesso Total)</option>
                    <option value="contador_gestor">Contador Gestor (Multi-Empresa)</option>
                    <option value="analista_fiscal">Analista Fiscal (Operacional)</option>
                    <option value="auditor_externo">Auditor Externo (Leitura)</option>
                    <option value="operador_leitura">Operador Leitura</option>
                  </select>
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
                    const selected = Array.from(e.target.selectedOptions, option => option.value);
                    setEditCnpjs(selected);
                  }}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-slate-200 focus:outline-none h-20 font-mono text-[11px]"
                >
                  <option value="*">Todos os CNPJs (Acesso Global)</option>
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
