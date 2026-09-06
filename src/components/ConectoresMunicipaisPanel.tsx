import React, { useState, useEffect } from 'react';
import {
  Search,
  Plug,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Settings,
  MapPin,
  Key,
  X,
  Shield,
  KeyRound,
  Lock,
  Info,
  Plus,
  Trash2,
  Globe,
  RefreshCw,
  ExternalLink,
  Sliders,
  Check,
  Building2,
  Server
} from 'lucide-react';
import { MunicipioConector, TipoAutenticacaoConector } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { getApiBaseUrl } from '../utils/apiConfig';

const ALL_UFS = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA',
  'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN',
  'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO'
];

const PROVEDORES_PADRAO = [
  'PMSP (Nota do Milhão)',
  'Nota Carioca (ABRASF 1.0)',
  'BHISS (ABRASF 2.04)',
  'Curitiba (ABRASF 2.04)',
  'NFSE POA (ABRASF 2.04)',
  'ISSONLINE (DSF)',
  'Ginfes (ABRASF)',
  'Betha Sistemas',
  'IPM Saúde e Gestão',
  'WebISS',
  'ISSNET',
  'Fiorilli',
  'Pronim',
  'Outro (Personalizado)'
];

export const ConectoresMunicipaisPanel: React.FC = () => {
  const { token } = useAuth();
  const [municipios, setMunicipios] = useState<MunicipioConector[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedUf, setSelectedUf] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<'todos' | 'ativo' | 'inativo' | 'configuracao_pendente'>('todos');

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingConector, setEditingConector] = useState<MunicipioConector | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

  // Form State
  const [formData, setFormData] = useState<{
    ibge: string;
    municipio: string;
    uf: string;
    provedor: string;
    provedorCustom: string;
    tecnologia: 'SOAP' | 'REST';
    endpoint_producao: string;
    endpoint_homologacao: string;
    tipoAutenticacao: TipoAutenticacaoConector;
    token_api: string;
    usuario: string;
    senha: string;
    status: 'ativo' | 'inativo' | 'configuracao_pendente';
  }>({
    ibge: '',
    municipio: '',
    uf: 'SP',
    provedor: 'ABRASF 2.04',
    provedorCustom: '',
    tecnologia: 'SOAP',
    endpoint_producao: '',
    endpoint_homologacao: '',
    tipoAutenticacao: 'certificado_a1',
    token_api: '',
    usuario: '',
    senha: '',
    status: 'ativo'
  });

  const getEffectiveToken = () => {
    return token || localStorage.getItem('@RadarFiscal:token') || localStorage.getItem('radar_fiscal_token') || '';
  };

  // Carregar lista de conectores do backend
  const carregarConectores = async () => {
    setIsLoading(true);
    setErrorMsg('');
    try {
      const response = await fetch(`${getApiBaseUrl()}/nfse/conectores`, {
        headers: {
          'Authorization': `Bearer ${getEffectiveToken()}`
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();
      if (data.success && Array.isArray(data.conectores)) {
        setMunicipios(data.conectores);
      } else {
        throw new Error(data.error || 'Erro ao obter conectores.');
      }
    } catch (err: any) {
      console.error('Erro ao carregar conectores:', err);
      setErrorMsg(`Não foi possível carregar os conectores municipais: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    carregarConectores();
  }, []);

  // Abrir Modal para Cadastro de Nova Prefeitura
  const handleOpenNew = () => {
    setEditingConector(null);
    setFormData({
      ibge: '',
      municipio: '',
      uf: 'SP',
      provedor: 'ABRASF 2.04',
      provedorCustom: '',
      tecnologia: 'SOAP',
      endpoint_producao: '',
      endpoint_homologacao: '',
      tipoAutenticacao: 'certificado_a1',
      token_api: '',
      usuario: '',
      senha: '',
      status: 'ativo'
    });
    setSaveError('');
    setIsModalOpen(true);
  };

  // Abrir Modal para Edição de Conector Existente
  const handleOpenEdit = (m: MunicipioConector) => {
    setEditingConector(m);
    const isStandardProvedor = PROVEDORES_PADRAO.includes(m.provedor);
    setFormData({
      ibge: m.ibge || '',
      municipio: m.municipio || '',
      uf: m.uf || 'SP',
      provedor: isStandardProvedor ? m.provedor : 'Outro (Personalizado)',
      provedorCustom: isStandardProvedor ? '' : m.provedor,
      tecnologia: m.tecnologia || 'SOAP',
      endpoint_producao: m.endpoint_producao || m.urlProducao || '',
      endpoint_homologacao: m.endpoint_homologacao || m.urlHomologacao || '',
      tipoAutenticacao: m.tipoAutenticacao || 'certificado_a1',
      token_api: m.token_api || '',
      usuario: m.usuario || '',
      senha: m.senha || '',
      status: (m.status === 'erro_autenticacao' ? 'configuracao_pendente' : m.status) as any
    });
    setSaveError('');
    setIsModalOpen(true);
  };

  // Salvar (POST ou PUT)
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaveError('');

    const cleanIbge = formData.ibge.replace(/\D/g, '');
    if (cleanIbge.length !== 7) {
      setSaveError('O Código IBGE deve conter exatamente 7 dígitos numéricos.');
      return;
    }

    if (!formData.municipio.trim()) {
      setSaveError('Informe o nome do município.');
      return;
    }

    const finalProvedor = formData.provedor === 'Outro (Personalizado)'
      ? (formData.provedorCustom.trim() || 'Padrão Próprio')
      : formData.provedor;

    setIsSaving(true);
    try {
      const isEditing = !!editingConector?.id;
      const url = isEditing
        ? `${getApiBaseUrl()}/nfse/conectores/${editingConector.id}`
        : `${getApiBaseUrl()}/nfse/conectores`;
      const method = isEditing ? 'PUT' : 'POST';

      const payload = {
        ibge: cleanIbge,
        municipio: formData.municipio.trim(),
        uf: formData.uf.toUpperCase(),
        provedor: finalProvedor,
        tecnologia: formData.tecnologia,
        endpoint_producao: formData.endpoint_producao.trim(),
        endpoint_homologacao: formData.endpoint_homologacao.trim(),
        tipo_autenticacao: formData.tipoAutenticacao,
        token_api: formData.token_api.trim(),
        usuario: formData.usuario.trim(),
        senha: formData.senha.trim(),
        status: formData.status
      };

      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${getEffectiveToken()}`
        },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Falha ao salvar conector municipal.');
      }

      setIsModalOpen(false);
      await carregarConectores();
    } catch (err: any) {
      setSaveError(err.message || 'Erro ao processar requisição.');
    } finally {
      setIsSaving(false);
    }
  };

  // Alternar Rápido Ativo / Inativo
  const handleToggleStatus = async (m: MunicipioConector) => {
    if (!m.id) return;
    const nextStatus = m.status === 'ativo' ? 'inativo' : 'ativo';

    // Atualização otimista
    setMunicipios(prev => prev.map(item => item.id === m.id ? { ...item, status: nextStatus } : item));

    try {
      const res = await fetch(`${getApiBaseUrl()}/nfse/conectores/${m.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${getEffectiveToken()}`
        },
        body: JSON.stringify({ status: nextStatus })
      });
      if (!res.ok) {
        throw new Error('Falha ao alternar status.');
      }
    } catch (err) {
      console.error('Erro ao alternar status:', err);
      // Reverter se falhar
      setMunicipios(prev => prev.map(item => item.id === m.id ? { ...item, status: m.status } : item));
    }
  };

  // Excluir Conector
  const handleDelete = async (m: MunicipioConector) => {
    if (!m.id) return;
    const confirm = window.confirm(`Deseja realmente remover o conector municipal de ${m.municipio} - ${m.uf}?`);
    if (!confirm) return;

    try {
      const res = await fetch(`${getApiBaseUrl()}/nfse/conectores/${m.id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${getEffectiveToken()}`
        }
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Falha ao excluir.');
      }
      setMunicipios(prev => prev.filter(item => item.id !== m.id));
    } catch (err: any) {
      alert(`Erro ao excluir: ${err.message}`);
    }
  };

  // Filtros
  const filtered = municipios.filter(m => {
    const matchUf = selectedUf ? m.uf === selectedUf : true;
    const matchSearch =
      m.municipio.toLowerCase().includes(searchTerm.toLowerCase()) ||
      m.ibge.includes(searchTerm) ||
      m.provedor.toLowerCase().includes(searchTerm.toLowerCase());
    const matchStatus = selectedStatus === 'todos' ? true : m.status === selectedStatus;
    return matchUf && matchSearch && matchStatus;
  });

  const countAtivos = municipios.filter(m => m.status === 'ativo').length;
  const countPendentes = municipios.filter(m => m.status === 'configuracao_pendente').length;

  const getStatusBadge = (status: MunicipioConector['status']) => {
    switch (status) {
      case 'ativo':
        return (
          <span className="px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[10px] font-bold flex items-center gap-1.5 shadow-sm shadow-emerald-950">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            ATIVO
          </span>
        );
      case 'inativo':
        return (
          <span className="px-2.5 py-1 rounded-full bg-slate-500/20 text-slate-400 border border-slate-500/30 text-[10px] font-bold flex items-center gap-1.5">
            <XCircle className="w-3 h-3" /> INATIVO
          </span>
        );
      case 'configuracao_pendente':
        return (
          <span className="px-2.5 py-1 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/30 text-[10px] font-bold flex items-center gap-1.5">
            <AlertCircle className="w-3 h-3" /> PENDENTE
          </span>
        );
      case 'erro_autenticacao':
        return (
          <span className="px-2.5 py-1 rounded-full bg-rose-500/20 text-rose-400 border border-rose-500/30 text-[10px] font-bold flex items-center gap-1.5">
            <AlertCircle className="w-3 h-3" /> ERRO
          </span>
        );
    }
  };

  return (
    <div className="flex flex-col gap-6 h-full animate-in fade-in duration-300">
      {/* Header Principal */}
      <div className="glass-panel-glow rounded-2xl p-6 flex flex-col lg:flex-row lg:items-center justify-between gap-5 border border-slate-800 shadow-xl bg-slate-900/60 backdrop-blur-xl">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <Plug className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
                Conectores Municipais (NFS-e)
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Catálogo de integrações diretas com prefeituras para captura de Notas Tomadas e Prestadas por WebServices (SOAP / REST).
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-xs">
            <span className="text-slate-400">Total:</span>
            <span className="text-white font-bold">{municipios.length}</span>
          </div>

          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-emerald-950/40 border border-emerald-800/40 text-xs">
            <span className="text-emerald-400">Varredura Ativa:</span>
            <span className="text-emerald-300 font-bold">{countAtivos} prefeituras</span>
          </div>

          {countPendentes > 0 && (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-amber-950/40 border border-amber-800/40 text-xs">
              <span className="text-amber-400">Pendentes:</span>
              <span className="text-amber-300 font-bold">{countPendentes}</span>
            </div>
          )}

          <button
            onClick={carregarConectores}
            disabled={isLoading}
            title="Atualizar Lista"
            className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors border border-slate-700"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-emerald-400' : ''}`} />
          </button>

          <button
            onClick={handleOpenNew}
            className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs flex items-center gap-2 shadow-lg shadow-emerald-900/30 transition-all hover:scale-[1.02] active:scale-[0.98]"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
            Adicionar Prefeitura
          </button>
        </div>
      </div>

      {/* Toolbar & Filtros */}
      <div className="glass-panel-glow rounded-2xl p-4 flex flex-wrap gap-3 items-center justify-between border border-slate-800 bg-slate-900/40">
        <div className="flex items-center gap-3 w-full md:max-w-md relative">
          <Search className="w-4 h-4 text-slate-500 absolute left-3.5" />
          <input
            type="text"
            placeholder="Buscar por município, código IBGE ou provedor..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-4 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition-colors"
          />
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <select
            value={selectedUf}
            onChange={(e) => setSelectedUf(e.target.value)}
            className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-300 focus:outline-none focus:border-emerald-500"
          >
            <option value="">Todas as UFs</option>
            {ALL_UFS.map(uf => <option key={uf} value={uf}>{uf}</option>)}
          </select>

          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value as any)}
            className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-300 focus:outline-none focus:border-emerald-500"
          >
            <option value="todos">Todos os Status</option>
            <option value="ativo">Apenas Ativos</option>
            <option value="configuracao_pendente">Pendentes</option>
            <option value="inativo">Inativos</option>
          </select>
        </div>
      </div>

      {/* Feedback de Erro */}
      {errorMsg && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-xs text-rose-300 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{errorMsg}</span>
          </div>
          <button
            onClick={carregarConectores}
            className="px-3 py-1 bg-rose-500/20 hover:bg-rose-500/30 rounded-lg text-rose-200 font-semibold"
          >
            Tentar Novamente
          </button>
        </div>
      )}

      {/* Grid de Prefeituras */}
      {isLoading ? (
        <div className="py-24 text-center flex flex-col items-center justify-center text-slate-500 gap-3">
          <RefreshCw className="w-8 h-8 animate-spin text-emerald-500" />
          <p className="text-xs font-medium">Carregando catálogo de conectores municipais...</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 pb-12">
          {filtered.map(m => {
            const endpointPreview = m.endpoint_producao || m.urlProducao || '';
            return (
              <div
                key={m.id || m.ibge}
                className={`rounded-2xl p-5 flex flex-col gap-4 border transition-all ${
                  m.status === 'ativo'
                    ? 'bg-slate-900/70 border-slate-700/60 hover:border-emerald-500/60 shadow-lg shadow-slate-950/50'
                    : 'bg-slate-900/30 border-slate-800/80 hover:border-slate-700 opacity-90'
                }`}
              >
                {/* Topo do Card */}
                <div className="flex justify-between items-start gap-2">
                  <div className="flex items-start gap-3">
                    <div className="p-2.5 rounded-xl bg-slate-800/80 text-emerald-400 mt-0.5 border border-slate-700/50">
                      <MapPin className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="font-bold text-white text-sm leading-tight flex items-center gap-2">
                        {m.municipio} - {m.uf}
                      </h3>
                      <p className="text-[11px] text-slate-400 mt-0.5 font-mono">IBGE: {m.ibge}</p>
                    </div>
                  </div>
                  {getStatusBadge(m.status)}
                </div>

                {/* Detalhes Técnicos */}
                <div className="bg-slate-950/60 rounded-xl p-3 border border-slate-800/80 flex flex-col gap-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400 flex items-center gap-1.5">
                      <Shield className="w-3.5 h-3.5 text-slate-500" /> Padrão:
                    </span>
                    <strong className="text-slate-200 font-semibold truncate max-w-[160px]">{m.provedor}</strong>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-slate-400 flex items-center gap-1.5">
                      <Server className="w-3.5 h-3.5 text-slate-500" /> Protocolo:
                    </span>
                    <span className="px-1.5 py-0.5 rounded bg-slate-800 text-[10px] font-mono font-bold text-emerald-400">
                      {m.tecnologia || 'SOAP'}
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-slate-400 flex items-center gap-1.5">
                      <KeyRound className="w-3.5 h-3.5 text-slate-500" /> Autenticação:
                    </span>
                    <strong className="text-slate-300 uppercase text-[10px]">
                      {m.tipoAutenticacao ? m.tipoAutenticacao.replace('_', ' ') : 'CERTIFICADO A1'}
                    </strong>
                  </div>

                  {endpointPreview && (
                    <div className="pt-1.5 border-t border-slate-800/60 flex items-center gap-1.5 text-[10px] text-slate-400">
                      <Globe className="w-3 h-3 text-slate-500 shrink-0" />
                      <span className="truncate font-mono" title={endpointPreview}>
                        {endpointPreview}
                      </span>
                    </div>
                  )}
                </div>

                {/* Barra de Ações do Card */}
                <div className="mt-auto pt-2 flex items-center gap-2">
                  <button
                    onClick={() => handleToggleStatus(m)}
                    className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 border ${
                      m.status === 'ativo'
                        ? 'bg-slate-800 hover:bg-rose-950/40 text-slate-300 hover:text-rose-300 border-slate-700 hover:border-rose-800'
                        : 'bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border-emerald-500/30'
                    }`}
                  >
                    {m.status === 'ativo' ? (
                      <>
                        <XCircle className="w-3.5 h-3.5 text-slate-400" /> Desativar
                      </>
                    ) : (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-400" /> Ativar Varredura
                      </>
                    )}
                  </button>

                  <button
                    onClick={() => handleOpenEdit(m)}
                    title="Editar endpoints e credenciais"
                    className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition-colors"
                  >
                    <Settings className="w-4 h-4" />
                  </button>

                  <button
                    onClick={() => handleDelete(m)}
                    title="Remover prefeitura"
                    className="p-2 rounded-xl bg-slate-800 hover:bg-rose-900/40 text-slate-400 hover:text-rose-400 border border-slate-700 hover:border-rose-700 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}

          {filtered.length === 0 && (
            <div className="col-span-full py-20 text-center flex flex-col items-center justify-center text-slate-500 gap-3">
              <Search className="w-12 h-12 opacity-20" />
              <p className="text-sm">Nenhum conector encontrado com os filtros atuais.</p>
              <button
                onClick={handleOpenNew}
                className="mt-2 px-4 py-2 rounded-xl bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 border border-emerald-500/30 text-xs font-bold flex items-center gap-1.5"
              >
                <Plus className="w-3.5 h-3.5" /> Cadastrar este Município
              </button>
            </div>
          )}
        </div>
      )}

      {/* Modal de Cadastro & Edição */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            
            {/* Modal Header */}
            <div className="p-5 border-b border-slate-800 flex justify-between items-center bg-gradient-to-r from-slate-900 via-slate-900 to-emerald-950/30">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-emerald-500/20 text-emerald-400">
                  <Plug className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">
                    {editingConector ? `Editar: ${editingConector.municipio} - ${editingConector.uf}` : 'Adicionar Nova Prefeitura'}
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Configure endpoints SOAP/REST e parâmetros para captura de NFS-e
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body Form */}
            <form onSubmit={handleSave} className="p-6 flex flex-col gap-4 overflow-y-auto">
              {saveError && (
                <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-xs text-rose-300 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                  <span>{saveError}</span>
                </div>
              )}

              {/* Seção 1: Identificação */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="text-[11px] font-bold text-slate-400 uppercase">Código IBGE (7 dígitos) *</label>
                  <input
                    type="text"
                    required
                    maxLength={7}
                    placeholder="Ex: 3550308"
                    value={formData.ibge}
                    onChange={e => setFormData({ ...formData, ibge: e.target.value.replace(/\D/g, '') })}
                    disabled={!!editingConector}
                    className="w-full mt-1 bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white font-mono focus:border-emerald-500 focus:outline-none disabled:opacity-60"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="text-[11px] font-bold text-slate-400 uppercase">Nome do Município *</label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: São Paulo"
                    value={formData.municipio}
                    onChange={e => setFormData({ ...formData, municipio: e.target.value })}
                    className="w-full mt-1 bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:border-emerald-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="text-[11px] font-bold text-slate-400 uppercase">UF *</label>
                  <select
                    value={formData.uf}
                    onChange={e => setFormData({ ...formData, uf: e.target.value })}
                    className="w-full mt-1 bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:border-emerald-500 focus:outline-none"
                  >
                    {ALL_UFS.map(uf => <option key={uf} value={uf}>{uf}</option>)}
                  </select>
                </div>

                <div className="sm:col-span-2">
                  <label className="text-[11px] font-bold text-slate-400 uppercase">Padrão / Provedor Fiscal *</label>
                  <select
                    value={formData.provedor}
                    onChange={e => setFormData({ ...formData, provedor: e.target.value })}
                    className="w-full mt-1 bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:border-emerald-500 focus:outline-none"
                  >
                    {PROVEDORES_PADRAO.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
              </div>

              {formData.provedor === 'Outro (Personalizado)' && (
                <div>
                  <label className="text-[11px] font-bold text-slate-400 uppercase">Nome do Provedor Customizado</label>
                  <input
                    type="text"
                    placeholder="Ex: WebISS 2.0 / Padrão Próprio"
                    value={formData.provedorCustom}
                    onChange={e => setFormData({ ...formData, provedorCustom: e.target.value })}
                    className="w-full mt-1 bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:border-emerald-500 focus:outline-none"
                  />
                </div>
              )}

              {/* Seção 2: Tecnologia e Endpoints */}
              <div className="pt-2 border-t border-slate-800/80">
                <div className="flex items-center justify-between mb-2">
                  <label className="text-[11px] font-bold text-slate-400 uppercase">Protocolo de Comunicação</label>
                  <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800">
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, tecnologia: 'SOAP' })}
                      className={`px-3 py-1 rounded-lg text-xs font-bold transition-colors ${
                        formData.tecnologia === 'SOAP' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      SOAP (WSDL)
                    </button>
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, tecnologia: 'REST' })}
                      className={`px-3 py-1 rounded-lg text-xs font-bold transition-colors ${
                        formData.tecnologia === 'REST' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      REST (API)
                    </button>
                  </div>
                </div>

                <div className="flex flex-col gap-3">
                  <div>
                    <label className="text-[11px] font-bold text-slate-400 uppercase">URL Produção (WSDL ou Endpoint Base)</label>
                    <input
                      type="url"
                      placeholder="https://nfe.prefeitura.exemplo.gov.br/ws/lotenfe.asmx?wsdl"
                      value={formData.endpoint_producao}
                      onChange={e => setFormData({ ...formData, endpoint_producao: e.target.value })}
                      className="w-full mt-1 bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white font-mono focus:border-emerald-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-bold text-slate-400 uppercase">URL Homologação (Opcional)</label>
                    <input
                      type="url"
                      placeholder="https://homologacao.prefeitura.exemplo.gov.br/ws/lotenfe.asmx"
                      value={formData.endpoint_homologacao}
                      onChange={e => setFormData({ ...formData, endpoint_homologacao: e.target.value })}
                      className="w-full mt-1 bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white font-mono focus:border-emerald-500 focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* Seção 3: Autenticação */}
              <div className="pt-2 border-t border-slate-800/80 flex flex-col gap-3">
                <div>
                  <label className="text-[11px] font-bold text-slate-400 uppercase">Método de Autenticação *</label>
                  <select
                    value={formData.tipoAutenticacao}
                    onChange={e => setFormData({ ...formData, tipoAutenticacao: e.target.value as any })}
                    className="w-full mt-1 bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:border-emerald-500 focus:outline-none"
                  >
                    <option value="certificado_a1">Certificado Digital A1 da Empresa (mTLS Seguro)</option>
                    <option value="token_api">Token de Integração / API Key</option>
                    <option value="usuario_senha">Login Web (Usuário e Senha)</option>
                    <option value="certificado_token">Certificado A1 + Token de Integração</option>
                  </select>
                </div>

                {(formData.tipoAutenticacao === 'certificado_a1' || formData.tipoAutenticacao === 'certificado_token') && (
                  <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-300 flex items-start gap-2.5">
                    <Shield className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                    <span>
                      O robô utilizará o <strong>Certificado Digital A1</strong> cadastrado no Cofre Seguro da Empresa ativa para assinar e autenticar as conexões mTLS.
                    </span>
                  </div>
                )}

                {(formData.tipoAutenticacao === 'token_api' || formData.tipoAutenticacao === 'certificado_token') && (
                  <div>
                    <label className="text-[11px] font-bold text-slate-400 uppercase">Token de Integração (API Key)</label>
                    <div className="relative mt-1">
                      <Key className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-2.5" />
                      <input
                        type="text"
                        placeholder="Cole o Token gerado no portal da prefeitura..."
                        value={formData.token_api}
                        onChange={e => setFormData({ ...formData, token_api: e.target.value })}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-xs text-white focus:border-emerald-500 focus:outline-none"
                      />
                    </div>
                  </div>
                )}

                {formData.tipoAutenticacao === 'usuario_senha' && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-[11px] font-bold text-slate-400 uppercase">Usuário / Login</label>
                      <input
                        type="text"
                        placeholder="Login de acesso..."
                        value={formData.usuario}
                        onChange={e => setFormData({ ...formData, usuario: e.target.value })}
                        className="w-full mt-1 bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:border-emerald-500 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-bold text-slate-400 uppercase">Senha</label>
                      <div className="relative mt-1">
                        <Lock className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-2.5" />
                        <input
                          type="password"
                          placeholder="••••••••"
                          value={formData.senha}
                          onChange={e => setFormData({ ...formData, senha: e.target.value })}
                          className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-xs text-white focus:border-emerald-500 focus:outline-none"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Seção 4: Status */}
              <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold text-white block">Status do Conector</span>
                  <span className="text-[11px] text-slate-400">
                    Se ativo, fará parte da varredura automática unificada de NFS-e tomadas.
                  </span>
                </div>
                <select
                  value={formData.status}
                  onChange={e => setFormData({ ...formData, status: e.target.value as any })}
                  className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-white focus:border-emerald-500"
                >
                  <option value="ativo">Ativo (Em Varredura)</option>
                  <option value="configuracao_pendente">Pendente de Configuração</option>
                  <option value="inativo">Inativo</option>
                </select>
              </div>

              {/* Modal Actions */}
              <div className="pt-4 border-t border-slate-800 flex justify-end gap-3 mt-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-300 hover:text-white hover:bg-slate-800 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-bold shadow-lg shadow-emerald-900/30 transition-all flex items-center gap-2"
                >
                  {isSaving ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      Gravando...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      Salvar Conector Municipal
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

export default ConectoresMunicipaisPanel;
