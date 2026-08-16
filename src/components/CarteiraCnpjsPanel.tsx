import React, { useState, useEffect } from 'react';
import {
  Building2, ShieldCheck, Key, FileCheck, Layers, Plus, Search,
  CheckCircle2, AlertTriangle, Lock, RefreshCw, Upload, Sparkles, Filter,
  Users, Trash2, ArrowUpRight, Database, FolderCheck, Check, Edit3, Eye, EyeOff
} from 'lucide-react';
import { ClienteEmpresaTenant, CertificadoA1 } from '../types';
import { useApi } from '../hooks/useApi';
import { useAuth } from '../contexts/AuthContext';

interface CarteiraCnpjsPanelProps {
  selectedTenantCnpj: string;
  onSelectTenantCnpj: (cnpj: string) => void;
  certificado: CertificadoA1;
  setCertificado: (cert: CertificadoA1) => void;
}

export const INITIAL_TENANTS: ClienteEmpresaTenant[] = [];

export const CarteiraCnpjsPanel: React.FC<CarteiraCnpjsPanelProps> = ({
  selectedTenantCnpj,
  onSelectTenantCnpj,
  certificado,
  setCertificado
}) => {
  const { get, post, put, del, uploadFile } = useApi();
  const {
    switchEmpresa,
    empresaAtiva,
    setEmpresaAtiva,
    setEmpresasDisponiveis,
    removerEmpresa,
    adicionarEmpresa,
    atualizarEmpresa
  } = useAuth();
  const [tenants, setTenants] = useState<ClienteEmpresaTenant[]>([]);

  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedGroupFilter, setSelectedGroupFilter] = useState('todos');

  // Modal Novo CNPJ / Cliente
  const [showAddModal, setShowAddModal] = useState(false);
  const [newCnpj, setNewCnpj] = useState('');
  const [newRazaoSocial, setNewRazaoSocial] = useState('');
  const [newNomeFantasia, setNewNomeFantasia] = useState('');
  const [newGrupo, setNewGrupo] = useState('Carteira Geral');
  const [newUf, setNewUf] = useState('SP');
  const [newRegime, setNewRegime] = useState<'Real' | 'Presumido' | 'Simples Nacional' | 'MEI'>('Real');

  // Modal Editar CNPJ
  const [editingTenant, setEditingTenant] = useState<ClienteEmpresaTenant | null>(null);

  // Modal Ativar Certificado A1 (.PFX)
  const [certModalTenant, setCertModalTenant] = useState<ClienteEmpresaTenant | null>(null);
  const [certFile, setCertFile] = useState<File | null>(null);
  const [certPassword, setCertPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isCertSubmitting, setIsCertSubmitting] = useState(false);
  const certFileInputRef = React.useRef<HTMLInputElement>(null);

  // ── CARREGAR EMPRESAS DO BANCO DE DADOS ─────────────────
  const loadTenants = async () => {
    setIsLoading(true);
    const res = await get<{ success: boolean; data: ClienteEmpresaTenant[] }>('/tenants');
    if (res.ok && res.data?.data) {
      const list = res.data.data;
      setTenants(list);

      const formattedEmpresas = list.map(t => ({
        id: t.id,
        cnpjRaiz: t.cnpjRaiz,
        cnpjCompleto: t.cnpjCompleto,
        razaoSocial: t.razaoSocial,
        nomeFantasia: t.nomeFantasia,
        uf: t.uf,
        regimeTributario: t.regimeTributario
      }));
      setEmpresasDisponiveis(formattedEmpresas);

      // Se a empresa ativa atual não existe mais na lista (por exemplo, foi excluída), limpa ou seleciona a primeira
      if (empresaAtiva && !list.some(t => t.id === empresaAtiva.id || t.cnpjCompleto === empresaAtiva.cnpjCompleto)) {
        setEmpresaAtiva(formattedEmpresas.length > 0 ? formattedEmpresas[0] : null);
      } else if (!empresaAtiva && formattedEmpresas.length > 0) {
        setEmpresaAtiva(formattedEmpresas[0]);
      }
    }
    setIsLoading(false);
  };

  useEffect(() => {
    loadTenants();
  }, []);

  // ── SUBMIT CERTIFICADO A1 (Arquivo + Senha Juntos) ─────────
  const handleCertSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!certFile || !certModalTenant || !certPassword) return;

    const formData = new FormData();
    formData.append('certificado', certFile);
    formData.append('tenantId', certModalTenant.id);
    formData.append('senha', certPassword);

    setIsCertSubmitting(true);
    const res = await uploadFile('/config/certificate/upload', formData);
    setIsCertSubmitting(false);

    if (res.ok && res.data?.data) {
      const certData = res.data.data;

      setTenants(prev => prev.map(t => {
        if (t.id === certModalTenant.id || t.cnpjCompleto === certModalTenant.cnpjCompleto) {
          return {
            ...t,
            certificadoA1: certData,
            statusConexaoSefaz: 'ativo'
          };
        }
        return t;
      }));

      onSelectTenantCnpj(certModalTenant.cnpjCompleto);
      setCertificado({
        fileName: certData.fileName,
        status: certData.status,
        validade: certData.validade,
        cnpj: certModalTenant.cnpjCompleto,
        razãoSocial: certModalTenant.razaoSocial,
        tipo: 'e-CNPJ A1'
      });

      setCertModalTenant(null);
      setCertFile(null);
      setCertPassword('');
      alert('Certificado A1 vinculado e ativado com sucesso!');
    } else {
      alert(res.error || 'Erro ao enviar e ativar certificado.');
    }
  };

  const deferredSearchTerm = React.useDeferredValue(searchTerm);

  const groupsAvailable = Array.from(new Set(tenants.map(t => t.grupoContabilCliente || 'Sem Grupo')));

  const tenantsFiltered = tenants.filter(t => {
    const matchesSearch =
      t.cnpjCompleto.toLowerCase().includes(deferredSearchTerm.toLowerCase()) ||
      t.razaoSocial.toLowerCase().includes(deferredSearchTerm.toLowerCase()) ||
      t.nomeFantasia.toLowerCase().includes(deferredSearchTerm.toLowerCase());
    const matchesGroup = selectedGroupFilter === 'todos' || t.grupoContabilCliente === selectedGroupFilter;
    return matchesSearch && matchesGroup;
  });

  // ── CRIAR EMPRESA (Backend) ─────────────────────────────
  const handleAddTenant = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCnpj || !newRazaoSocial) {
      alert('Informe o CNPJ e a Razão Social.');
      return;
    }

    const res = await post('/tenants', {
      cnpjCompleto: newCnpj,
      razaoSocial: newRazaoSocial,
      nomeFantasia: newNomeFantasia || newRazaoSocial,
      uf: newUf,
      regimeTributario: newRegime,
      grupoContabilCliente: newGrupo
    });

    if (res.ok && res.data?.data) {
      const created = res.data.data;
      setTenants(prev => [created, ...prev]);
      adicionarEmpresa({
        id: created.id,
        cnpjRaiz: created.cnpjRaiz,
        cnpjCompleto: created.cnpjCompleto,
        razaoSocial: created.razaoSocial,
        nomeFantasia: created.nomeFantasia,
        uf: created.uf,
        regimeTributario: created.regimeTributario
      });
      onSelectTenantCnpj(created.cnpjCompleto);
      setSearchTerm('');
      setSelectedGroupFilter('todos');
      setShowAddModal(false);
      setNewCnpj('');
      setNewRazaoSocial('');
      setNewNomeFantasia('');
    } else {
      alert(res.error || 'Erro ao cadastrar empresa.');
    }
  };

  const handleOpenEdit = (tenant: ClienteEmpresaTenant) => {
    setEditingTenant({ ...tenant });
  };

  // ── EDITAR EMPRESA (Backend) ────────────────────────────
  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTenant) return;

    const res = await put(`/tenants/${editingTenant.id}`, {
      razaoSocial: editingTenant.razaoSocial,
      nomeFantasia: editingTenant.nomeFantasia,
      uf: editingTenant.uf,
      regimeTributario: editingTenant.regimeTributario,
    });

    if (res.ok) {
      setTenants(prev => prev.map(t => t.id === editingTenant.id ? editingTenant : t));
      atualizarEmpresa({
        id: editingTenant.id,
        cnpjRaiz: editingTenant.cnpjRaiz,
        cnpjCompleto: editingTenant.cnpjCompleto,
        razaoSocial: editingTenant.razaoSocial,
        nomeFantasia: editingTenant.nomeFantasia,
        uf: editingTenant.uf,
        regimeTributario: editingTenant.regimeTributario
      });
      if (selectedTenantCnpj === editingTenant.cnpjCompleto) {
        setCertificado({ ...certificado, razãoSocial: editingTenant.razaoSocial });
      }
      setEditingTenant(null);
    } else {
      alert(res.error || 'Erro ao atualizar empresa.');
    }
  };

  // ── EXCLUIR EMPRESA (Backend) ───────────────────────────
  const handleDeleteTenant = async (id: string, cnpj: string, razao: string) => {
    if (confirm(`Tem certeza que deseja excluir o cliente ${razao} (${cnpj}) da carteira?`)) {
      const res = await del(`/tenants/${id}`);
      if (res.ok) {
        setTenants(prev => prev.filter(t => t.id !== id));
        removerEmpresa(id);
        if (selectedTenantCnpj === cnpj) {
          onSelectTenantCnpj('');
          setCertificado({
            fileName: '',
            cnpj: '',
            razãoSocial: '',
            tipo: 'e-CNPJ A1',
            validade: '',
            status: 'pendente'
          });
        }
      } else {
        alert(res.error || 'Erro ao excluir empresa.');
      }
    }
  };

  return (
    <div className="space-y-6">

      {/* Filters & Action Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-4 rounded-2xl bg-slate-900/80 border border-slate-800">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
          <input
            type="search"
            name="search_query_company_no_autofill"
            autoComplete="new-password"
            data-lpignore="true"
            data-1p-ignore="true"
            data-bwignore="true"
            data-form-type="other"
            placeholder="Buscar por CNPJ, Razão Social ou Fantasia..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-8 py-2 text-xs text-slate-200 focus:outline-none focus:border-cyan-500"
          />
          {searchTerm && (
            <button
              type="button"
              onClick={() => setSearchTerm('')}
              className="absolute right-2.5 top-2 text-slate-400 hover:text-white text-xs font-bold p-1 cursor-pointer"
              title="Limpar busca"
            >
              ✕
            </button>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto text-xs justify-between sm:justify-end">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-slate-400" />
            <span className="text-slate-400 font-semibold">Grupo / Carteira:</span>
            <select
              value={selectedGroupFilter}
              onChange={(e) => setSelectedGroupFilter(e.target.value)}
              className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-200 font-medium focus:outline-none"
            >
              <option value="todos">Todos os Grupos ({tenants.length})</option>
              {groupsAvailable.map(g => (
                <option key={g} value={g}>{g}</option>
              ))}
            </select>
          </div>

          <button
            onClick={() => setShowAddModal(true)}
            className="px-4 py-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-extrabold text-xs flex items-center gap-2 shadow-lg shadow-blue-600/30 cursor-pointer shrink-0"
          >
            <Plus className="w-4 h-4 text-cyan-300" />
            <span>Novo CNPJ</span>
          </button>
        </div>
      </div>

      {/* CNPJs Tenants Grid */}
      {tenantsFiltered.length === 0 && (
        <div className="p-12 text-center rounded-2xl bg-slate-900/60 border border-slate-800 space-y-3">
          <Building2 className="w-12 h-12 text-slate-600 mx-auto" />
          <h3 className="text-base font-bold text-white">
            {searchTerm || selectedGroupFilter !== 'todos'
              ? 'Nenhuma empresa encontrada para o filtro atual'
              : 'Nenhum CNPJ cadastrado na carteira'}
          </h3>
          <div className="text-xs text-slate-400 max-w-md mx-auto">
            {searchTerm || selectedGroupFilter !== 'todos' ? (
              <div className="flex flex-col gap-2 items-center">
                <span>Filtro digitado: <strong className="text-cyan-300">"{searchTerm}"</strong></span>
                <button
                  type="button"
                  onClick={() => { setSearchTerm(''); setSelectedGroupFilter('todos'); }}
                  className="mt-1 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-cyan-300 font-bold text-xs cursor-pointer border border-slate-700"
                >
                  ✕ Limpar Filtro de Busca
                </button>
              </div>
            ) : (
              <span>Para iniciar, clique no botão <strong className="text-cyan-300">"+ Novo CNPJ"</strong> acima. Após salvar a empresa, insira a senha e ative o certificado digital A1 (.PFX).</span>
            )}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {tenantsFiltered.map(tenant => {
          const isSelected = tenant.cnpjCompleto === selectedTenantCnpj;
          return (
            <div
              key={tenant.id}
              className={`p-5 rounded-2xl border transition-all space-y-4 ${isSelected
                  ? 'bg-gradient-to-br from-slate-900 via-indigo-950/80 to-slate-900 border-cyan-400 shadow-xl shadow-cyan-500/10 ring-1 ring-cyan-400/40'
                  : 'bg-slate-900/80 border-slate-800 hover:border-slate-700'
                }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono font-extrabold px-2.5 py-0.5 rounded bg-blue-950 text-cyan-300 border border-blue-800">
                      {tenant.cnpjCompleto}
                    </span>
                    <span className="text-[10px] font-mono text-slate-400 bg-slate-950 px-2 py-0.5 rounded border border-slate-800">
                      UF: {tenant.uf}
                    </span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-purple-950 text-purple-300 border border-purple-800">
                      {tenant.regimeTributario}
                    </span>
                  </div>

                  <h3 className="text-sm font-extrabold text-white leading-snug">
                    {tenant.razaoSocial}
                  </h3>
                  <div className="text-xs text-slate-400">
                    Fantasia: <strong className="text-slate-200">{tenant.nomeFantasia}</strong>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  {isSelected ? (
                    <span className="px-3 py-1 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-700 text-[10px] font-bold flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                      Ativo Agora
                    </span>
                  ) : (
                    <button
                      onClick={async () => {
                        onSelectTenantCnpj(tenant.cnpjCompleto);
                        if (tenant.id) {
                          const res = await post<{ success: boolean; accessToken: string; empresaAtiva: any }>('/auth/switch-empresa', {
                            empresaId: tenant.id
                          });
                          if (res.ok && res.data?.accessToken && res.data?.empresaAtiva) {
                            switchEmpresa(res.data.empresaAtiva, res.data.accessToken);
                          }
                        }
                        if (tenant.certificadoA1) {
                          setCertificado({
                            fileName: tenant.certificadoA1.fileName,
                            cnpj: tenant.cnpjCompleto,
                            razãoSocial: tenant.razaoSocial,
                            tipo: 'e-CNPJ A1',
                            validade: tenant.certificadoA1.validade,
                            status: 'valido'
                          });
                        } else {
                          setCertificado({
                            fileName: '',
                            cnpj: tenant.cnpjCompleto,
                            razãoSocial: tenant.razaoSocial,
                            tipo: 'e-CNPJ A1',
                            validade: '',
                            status: 'pendente'
                          });
                        }
                      }}
                      className="px-3 py-1 rounded-xl bg-slate-800 hover:bg-cyan-600 hover:text-white text-slate-300 text-xs font-bold transition-all cursor-pointer"
                    >
                      Selecionar
                    </button>
                  )}

                  <button
                    onClick={() => handleOpenEdit(tenant)}
                    className="p-1.5 rounded-lg bg-slate-800 hover:bg-blue-600 text-slate-400 hover:text-white transition-all cursor-pointer"
                    title="Editar dados da empresa"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                  </button>

                  <button
                    onClick={() => handleDeleteTenant(tenant.id, tenant.cnpjCompleto, tenant.razaoSocial)}
                    className="p-1.5 rounded-lg bg-slate-800 hover:bg-rose-600 text-slate-400 hover:text-white transition-all cursor-pointer"
                    title="Excluir empresa da carteira"
                  >
                    <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                  </button>
                </div>
              </div>

              {/* Group & Cert Details */}
              <div className="grid grid-cols-2 gap-2 text-[11px] pt-2 border-t border-slate-800">
                <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800/80">
                  <span className="text-slate-400 block text-[10px]">Carteira Contábil:</span>
                  <span className="font-bold text-slate-200 truncate block">{tenant.grupoContabilCliente || 'Geral'}</span>
                </div>

                <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800/80">
                  <span className="text-slate-400 block text-[10px]">Doc. Capturados:</span>
                  <span className="font-mono font-bold text-cyan-300">{tenant.totalDocumentosCapturados.toLocaleString('pt-BR')} XMLs</span>
                </div>
              </div>

              {/* Certificate A1 Status Box */}
              <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 flex items-center justify-between text-xs mt-3">
                <div className="flex items-center gap-2.5">
                  <Key className={`w-4 h-4 ${tenant.certificadoA1 ? 'text-emerald-400' : 'text-amber-400'}`} />
                  <div>
                    <div className="font-bold text-white text-[11px]">
                      {tenant.certificadoA1 ? 'Certificado Digital A1 Ativo' : 'Certificado A1 Pendente'}
                    </div>
                    <div className="text-[10px] text-slate-400 font-mono">
                      {tenant.certificadoA1 ? `${tenant.certificadoA1.fileName} (Venc: ${tenant.certificadoA1.validade})` : 'Nenhum certificado .PFX vinculado'}
                    </div>
                  </div>
                </div>

                {!tenant.certificadoA1 ? (
                  <button
                    type="button"
                    onClick={() => {
                      setCertModalTenant(tenant);
                      setCertFile(null);
                      setCertPassword('');
                    }}
                    className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-extrabold text-xs flex items-center gap-1.5 shadow-md shadow-indigo-500/20 transition-all cursor-pointer shrink-0"
                  >
                    <Upload className="w-3.5 h-3.5 text-cyan-300" />
                    <span>Ativar Certificado A1</span>
                  </button>
                ) : (
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold font-mono bg-emerald-950 text-emerald-300 border border-emerald-800">
                      Ativo
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setCertModalTenant(tenant);
                        setCertFile(null);
                        setCertPassword('');
                      }}
                      className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-[11px] font-bold transition-all cursor-pointer"
                      title="Substituir por um novo certificado A1"
                    >
                      Trocar .PFX
                    </button>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Modal Add New Tenant CNPJ */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Building2 className="w-5 h-5 text-cyan-400" />
                Cadastrar CNPJ na Carteira
              </h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-slate-400 hover:text-white text-xs font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleAddTenant} className="space-y-3 text-xs">
              <div>
                <label className="font-bold text-slate-300 block mb-1">CNPJ do Cliente / Filial *</label>
                <input
                  type="text"
                  placeholder="00.000.000/0000-00"
                  value={newCnpj}
                  onChange={(e) => setNewCnpj(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-600 rounded-xl px-3 py-2 text-slate-200 font-mono focus:outline-none focus:border-cyan-500"
                  required
                />
              </div>

              <div>
                <label className="font-bold text-slate-300 block mb-1">Razão Social *</label>
                <input
                  type="text"
                  placeholder="Razão Social da Empresa..."
                  value={newRazaoSocial}
                  onChange={(e) => setNewRazaoSocial(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:border-cyan-500"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-300 block mb-1">Nome Fantasia</label>
                  <input
                    type="text"
                    placeholder="Nome Fantasia..."
                    value={newNomeFantasia}
                    onChange={(e) => setNewNomeFantasia(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-slate-200 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-300 block mb-1">UF da Matriz/Filial</label>
                  <select
                    value={newUf}
                    onChange={(e) => setNewUf(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-slate-200 font-mono focus:outline-none"
                  >
                    {['SP', 'RJ', 'MG', 'RS', 'PR', 'SC', 'BA', 'DF', 'PE', 'CE', 'AM', 'GO'].map(u => (
                      <option key={u} value={u}>{u}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-300 block mb-1">Grupo Contábil / Cliente</label>
                  <input
                    type="text"
                    value={newGrupo}
                    onChange={(e) => setNewGrupo(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-slate-200 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-300 block mb-1">Regime Tributário</label>
                  <select
                    value={newRegime}
                    onChange={(e) => setNewRegime(e.target.value as any)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-slate-200 focus:outline-none"
                  >
                    <option value="Real">Lucro Real</option>
                    <option value="Presumido">Lucro Presumido</option>
                    <option value="Simples Nacional">Simples Nacional</option>
                    <option value="MEI">MEI</option>
                  </select>
                </div>
              </div>

              <div className="pt-3 flex items-center justify-end gap-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 hover:text-white font-bold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold"
                >
                  Salvar e Alocar CNPJ
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Modal Editar CNPJ / Cliente */}
      {editingTenant && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Edit3 className="w-5 h-5 text-blue-400" />
                Editar Dados da Empresa
              </h3>
              <button
                onClick={() => setEditingTenant(null)}
                className="text-slate-400 hover:text-white text-xs font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="space-y-3 text-xs">
              <div>
                <label className="font-bold text-slate-300 block mb-1">CNPJ (Somente Leitura)</label>
                <input
                  type="text"
                  value={editingTenant.cnpjCompleto}
                  disabled
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-500 font-mono"
                />
              </div>

              <div>
                <label className="font-bold text-slate-300 block mb-1">Razão Social *</label>
                <input
                  type="text"
                  value={editingTenant.razaoSocial}
                  onChange={(e) => setEditingTenant({ ...editingTenant, razaoSocial: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:border-cyan-500"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-300 block mb-1">Nome Fantasia</label>
                  <input
                    type="text"
                    value={editingTenant.nomeFantasia}
                    onChange={(e) => setEditingTenant({ ...editingTenant, nomeFantasia: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-slate-200 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-300 block mb-1">UF da Matriz/Filial</label>
                  <select
                    value={editingTenant.uf}
                    onChange={(e) => setEditingTenant({ ...editingTenant, uf: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-slate-200 font-mono focus:outline-none"
                  >
                    {['SP', 'RJ', 'MG', 'RS', 'PR', 'SC', 'BA', 'DF', 'PE', 'CE', 'AM', 'GO'].map(u => (
                      <option key={u} value={u}>{u}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-300 block mb-1">Grupo Contábil / Cliente</label>
                  <input
                    type="text"
                    value={editingTenant.grupoContabilCliente || ''}
                    onChange={(e) => setEditingTenant({ ...editingTenant, grupoContabilCliente: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-slate-200 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-300 block mb-1">Regime Tributário</label>
                  <select
                    value={editingTenant.regimeTributario}
                    onChange={(e) => setEditingTenant({ ...editingTenant, regimeTributario: e.target.value as any })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-slate-200 focus:outline-none"
                  >
                    <option value="Real">Lucro Real</option>
                    <option value="Presumido">Lucro Presumido</option>
                    <option value="Simples Nacional">Simples Nacional</option>
                    <option value="MEI">MEI</option>
                  </select>
                </div>
              </div>

              <div className="pt-3 flex items-center justify-end gap-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setEditingTenant(null)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 hover:text-white font-bold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold"
                >
                  Salvar Alterações
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Ativar / Vincular Certificado Digital A1 */}
      {certModalTenant && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-indigo-950 border border-indigo-800 text-indigo-400">
                  <Key className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-white">
                    Vincular Certificado Digital A1
                  </h3>
                  <p className="text-xs text-cyan-300 font-mono">
                    {certModalTenant.razaoSocial} ({certModalTenant.cnpjCompleto})
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setCertModalTenant(null)}
                className="text-slate-400 hover:text-white text-sm font-bold p-1 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCertSubmit} className="space-y-4 text-xs">
              {/* Step 1: File selection */}
              <div>
                <label className="font-bold text-slate-300 block mb-1.5 flex items-center justify-between">
                  <span>1. Selecione o arquivo do Certificado (.PFX ou .P12) *</span>
                  {certFile && (
                    <span className="text-[10px] text-emerald-400 font-normal flex items-center gap-1">
                      <Check className="w-3 h-3" /> Arquivo pronto
                    </span>
                  )}
                </label>
                <div
                  onClick={() => certFileInputRef.current?.click()}
                  className={`p-5 border-2 border-dashed rounded-xl cursor-pointer transition-all flex flex-col items-center justify-center gap-2 text-center ${
                    certFile
                      ? 'border-emerald-500/60 bg-emerald-950/20 text-emerald-300 shadow-inner'
                      : 'border-slate-700 hover:border-indigo-500 bg-slate-950/60 hover:bg-slate-950 text-slate-400'
                  }`}
                >
                  <input
                    ref={certFileInputRef}
                    type="file"
                    accept=".pfx,.p12,.pem"
                    className="hidden"
                    onChange={(e) => {
                      if (e.target.files?.[0]) setCertFile(e.target.files[0]);
                    }}
                  />
                  {certFile ? (
                    <div className="flex flex-col items-center gap-1">
                      <div className="flex items-center gap-2 text-xs font-bold text-white">
                        <FileCheck className="w-5 h-5 text-emerald-400" />
                        <span className="font-mono">{certFile.name}</span>
                      </div>
                      <span className="text-[10px] text-slate-400 font-mono">
                        Tamanho: {(certFile.size / 1024).toFixed(1)} KB (Clique para trocar de arquivo)
                      </span>
                    </div>
                  ) : (
                    <>
                      <Upload className="w-7 h-7 text-indigo-400" />
                      <span className="text-xs font-semibold text-slate-200">
                        Clique aqui para escolher o arquivo .PFX ou .P12
                      </span>
                      <span className="text-[10px] text-slate-500 font-mono">
                        Padrão ICP-Brasil (e-CNPJ A1)
                      </span>
                    </>
                  )}
                </div>
              </div>

              {/* Step 2: Password */}
              <div>
                <label className="font-bold text-slate-300 block mb-1.5">
                  2. Senha do Certificado Digital A1 *
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="new-password"
                    data-lpignore="true"
                    data-1p-ignore="true"
                    data-bwignore="true"
                    placeholder="Digite a senha de proteção do arquivo..."
                    value={certPassword}
                    onChange={(e) => setCertPassword(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-9 pr-10 py-2.5 text-xs text-white placeholder-slate-500 font-mono focus:outline-none focus:border-indigo-500"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white text-xs cursor-pointer p-1"
                    title={showPassword ? 'Ocultar senha' : 'Ver senha'}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <p className="text-[10px] text-slate-500 mt-1.5 flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <span>A senha e a chave privada são criptografadas com AES-256-GCM no cofre seguro.</span>
                </p>
              </div>

              <div className="pt-3 flex items-center justify-end gap-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setCertModalTenant(null)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={!certFile || !certPassword || isCertSubmitting}
                  className="px-5 py-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-extrabold text-xs shadow-lg shadow-indigo-600/30 transition-all cursor-pointer disabled:opacity-40 flex items-center gap-2"
                >
                  {isCertSubmitting ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      <span>Validando e Ativando...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4 text-cyan-300" />
                      <span>Validar e Ativar Certificado</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
