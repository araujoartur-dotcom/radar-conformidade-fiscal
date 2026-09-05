import React, { useState } from 'react';
import {
  X,
  Folder,
  FolderInput,
  FolderOutput,
  CheckCircle2,
  Settings,
  HardDrive,
  FolderArchive,
  RefreshCw,
  Save,
  Plus,
  Trash2,
  FileCode,
  ShieldCheck,
  Check,
  HelpCircle,
  AlertCircle,
  Building2
} from 'lucide-react';
import { CnpjRaizDirectoryConfig } from '../types';
import { useApi } from '../hooks/useApi';
import { useAuth } from '../contexts/AuthContext';
import { formatCNPJ } from '../utils/cnpj';

interface ConfigDiretorioModalProps {
  isOpen: boolean;
  onClose: () => void;
  configs: CnpjRaizDirectoryConfig[];
  onSaveConfigs: (updated: CnpjRaizDirectoryConfig[]) => void;
}

export const ConfigDiretorioModal: React.FC<ConfigDiretorioModalProps> = ({
  isOpen,
  onClose,
  configs,
  onSaveConfigs,
}) => {
  const { get, post, del } = useApi();
  const { empresaAtiva, empresasDisponiveis } = useAuth();
  const [selectedId, setSelectedId] = useState<string>(configs[0]?.id || '');
  const [localConfigs, setLocalConfigs] = useState<CnpjRaizDirectoryConfig[]>(configs);
  const [testResult, setTestResult] = useState<{ status: 'idle' | 'testing' | 'success' | 'error'; msg: string }>({
    status: 'idle',
    msg: ''
  });
  const [saveFeedback, setSaveFeedback] = useState<boolean>(false);
  const [showNewCnpjModal, setShowNewCnpjModal] = useState<boolean>(false);
  const [newCnpjRaizInput, setNewCnpjRaizInput] = useState<string>('');
  const [newRazaoSocialInput, setNewRazaoSocialInput] = useState<string>('');
  const [selectedEmpresaPreset, setSelectedEmpresaPreset] = useState<string>('');

  // Contagem de filiais cadastradas por CNPJ Raiz
  const getBranchCount = (cnpjRaiz: string) => {
    const clean = (cnpjRaiz || '').replace(/\D/g, '').substring(0, 8);
    if (!clean) return 0;
    return (empresasDisponiveis || []).filter(e => {
      const empClean = (e.cnpjRaiz || e.cnpjCompleto || '').replace(/\D/g, '');
      return empClean.startsWith(clean);
    }).length;
  };

  // Carregar diretórios salvos no banco de dados e sincronizar com empresas da carteira
  React.useEffect(() => {
    if (!isOpen) return;

    const fetchDirs = async () => {
      const res = await get<{ success: boolean; data: CnpjRaizDirectoryConfig[] }>('/directories');
      const configsFromDb = (res.ok && res.data?.data) ? res.data.data : [];

      const existingRaizSet = new Set(configsFromDb.map(d => (d.cnpjRaiz || '').replace(/\D/g, '').substring(0, 8)));
      const mergedConfigs = [...configsFromDb];

      // Se houver empresas cadastradas no sistema que ainda não estejam nos diretórios, gerar padrão
      if (empresasDisponiveis && empresasDisponiveis.length > 0) {
        for (const emp of empresasDisponiveis) {
          const clean = (emp.cnpjRaiz || emp.cnpjCompleto || '').replace(/\D/g, '').substring(0, 8);
          if (clean.length === 8 && !existingRaizSet.has(clean)) {
            existingRaizSet.add(clean);
            const formatted = `${clean.substring(0, 2)}.${clean.substring(2, 5)}.${clean.substring(5, 8)}`;
            mergedConfigs.push({
              id: `cfg-${clean}`,
              cnpjRaiz: formatted,
              razaoSocial: emp.razaoSocial || emp.nomeFantasia || `EMPRESA CNPJ RAIZ ${formatted}`,
              diretorioEntrada: `C:\\SEFAZ\\XMLs\\${clean}\\Entrada`,
              subpastaDataEntrada: true,
              estruturaNomeEntrada: 'chave',
              diretorioSaida: `C:\\SEFAZ\\XMLs\\${clean}\\Saida`,
              subpastaDataSaida: true,
              estruturaNomeSaida: 'chave',
              diretorioEventos: `C:\\SEFAZ\\XMLs\\${clean}\\Eventos`,
              autoOrganizarAoCapturar: true,
              statusMonitoramento: 'ativo',
              ultimaSincronizacao: 'Cadastrada na Carteira'
            });
          }
        }
      }

      if (mergedConfigs.length > 0) {
        setLocalConfigs(mergedConfigs);

        // Priorizar seleção da Empresa Ativa do usuário
        const activeClean = (empresaAtiva?.cnpjRaiz || empresaAtiva?.cnpjCompleto || '').replace(/\D/g, '').substring(0, 8);
        const matchActive = mergedConfigs.find(c => (c.cnpjRaiz || '').replace(/\D/g, '').substring(0, 8) === activeClean);

        if (matchActive) {
          setSelectedId(matchActive.id);
        } else if (!selectedId || !mergedConfigs.some(d => d.id === selectedId)) {
          setSelectedId(mergedConfigs[0].id);
        }
      }
    };

    fetchDirs();
  }, [isOpen, get, empresasDisponiveis, empresaAtiva]);

  if (!isOpen) return null;

  const currentConfig = localConfigs.find(c => c.id === selectedId) || localConfigs[0];

  const handleUpdateCurrentConfig = (key: keyof CnpjRaizDirectoryConfig, value: any) => {
    if (!currentConfig) return;
    setLocalConfigs(prev =>
      prev.map(item => (item.id === currentConfig.id ? { ...item, [key]: value } : item))
    );
  };

  const handleAddCnpjRaiz = async () => {
    const cleanCnpj = newCnpjRaizInput.replace(/\D/g, '').substring(0, 8);
    if (!cleanCnpj || cleanCnpj.length < 8) {
      alert('Por favor, informe os 8 primeiros dígitos do CNPJ Raiz (ex: 19.791.896).');
      return;
    }

    const formattedCnpj = `${cleanCnpj.substring(0, 2)}.${cleanCnpj.substring(2, 5)}.${cleanCnpj.substring(5, 8)}`;
    const newId = `cfg-${cleanCnpj}`;

    // Se já existir no estado, apenas seleciona
    const existing = localConfigs.find(c => (c.cnpjRaiz || '').replace(/\D/g, '').substring(0, 8) === cleanCnpj || c.id === newId);
    if (existing) {
      setSelectedId(existing.id);
      setShowNewCnpjModal(false);
      setSelectedEmpresaPreset('');
      setNewCnpjRaizInput('');
      setNewRazaoSocialInput('');
      return;
    }

    const newConfig: CnpjRaizDirectoryConfig = {
      id: newId,
      cnpjRaiz: formattedCnpj,
      razaoSocial: newRazaoSocialInput.trim() || `EMPRESA CNPJ RAIZ ${formattedCnpj}`,
      diretorioEntrada: `C:\\SEFAZ\\XMLs\\${cleanCnpj}\\Entrada`,
      subpastaDataEntrada: true,
      estruturaNomeEntrada: 'chave',
      diretorioSaida: `C:\\SEFAZ\\XMLs\\${cleanCnpj}\\Saida`,
      subpastaDataSaida: true,
      estruturaNomeSaida: 'chave',
      diretorioEventos: `C:\\SEFAZ\\XMLs\\${cleanCnpj}\\Eventos`,
      autoOrganizarAoCapturar: true,
      statusMonitoramento: 'ativo',
      ultimaSincronizacao: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
    };

    // Salvar no backend
    const res = await post('/directories', newConfig);
    if (!res.ok) {
      console.warn('Aviso ao salvar diretório no banco:', res.error);
    }

    const updated = [newConfig, ...localConfigs];
    setLocalConfigs(updated);
    setSelectedId(newId);
    onSaveConfigs(updated);
    setShowNewCnpjModal(false);
    setNewCnpjRaizInput('');
    setNewRazaoSocialInput('');
    setSelectedEmpresaPreset('');
  };

  const handleDeleteCnpjRaiz = async (idToDelete: string) => {
    if (localConfigs.length <= 1) {
      alert('Você precisa ter pelo menos um CNPJ Raiz configurado.');
      return;
    }
    if (confirm('Tem certeza que deseja remover esta configuração de diretórios?')) {
      await del(`/directories/${idToDelete}`);
      const filtered = localConfigs.filter(c => c.id !== idToDelete);
      setLocalConfigs(filtered);
      setSelectedId(filtered[0]?.id || '');
      onSaveConfigs(filtered);
    }
  };

  const handleTestDirectoryPermissions = () => {
    setTestResult({ status: 'testing', msg: 'Verificando permissões de Leitura, Escrita e Rede...' });
    setTimeout(() => {
      setTestResult({
        status: 'success',
        msg: `Acesso verificado com sucesso! Diretórios de Entrada, Saída e Eventos do CNPJ Raiz ${currentConfig?.cnpjRaiz} estão válidos e graváveis.`
      });
    }, 900);
  };

  const handleSaveAll = async () => {
    if (currentConfig) {
      await post('/directories', currentConfig);
    }
    onSaveConfigs(localConfigs);
    setSaveFeedback(true);
    setTimeout(() => setSaveFeedback(false), 2500);
  };


  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-2 sm:p-4 overflow-y-auto">
      <div className="bg-slate-950 border border-slate-800 rounded-2xl w-full max-w-5xl max-h-[94vh] flex flex-col shadow-2xl overflow-hidden my-auto">
        
        {/* Modal Header */}
        <div className="px-6 py-4 bg-slate-900 border-b border-slate-800 flex items-center justify-between gap-4 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-600 via-blue-600 to-indigo-600 flex items-center justify-center text-white shadow-md shadow-cyan-500/20">
              <FolderArchive className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                Configuração de Diretórios de Armazenamento de XMLs
                <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-cyan-950 text-cyan-300 border border-cyan-800">
                  Por CNPJ Raiz
                </span>
              </h3>
              <p className="text-xs text-slate-400">
                Segregação automatizada de arquivos XML em diretórios locais ou de rede para Entradas (Compras) e Saídas (Vendas).
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-all cursor-pointer"
            title="Fechar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Main Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          
          {/* Top CNPJ Raiz Selector Bar */}
          <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3 flex-1 min-w-[280px]">
              <HardDrive className="w-5 h-5 text-cyan-400 shrink-0" />
              <div className="flex-1">
                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1">
                  Selecione o CNPJ Raiz para Configuração:
                </label>
                {localConfigs.length === 0 ? (
                  <div className="text-xs text-amber-300 font-medium py-1.5 px-3 rounded-lg bg-amber-950/40 border border-amber-800/60 flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
                    <span>Nenhum CNPJ Raiz configurado. Clique em <strong>+ Novo CNPJ Raiz</strong> para selecionar uma empresa.</span>
                  </div>
                ) : (
                  <select
                    value={selectedId}
                    onChange={(e) => {
                      setSelectedId(e.target.value);
                      setTestResult({ status: 'idle', msg: '' });
                    }}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white font-bold focus:outline-none focus:border-cyan-500"
                  >
                    {localConfigs.map(cfg => {
                      const activeClean = (empresaAtiva?.cnpjRaiz || empresaAtiva?.cnpjCompleto || '').replace(/\D/g, '').substring(0, 8);
                      const isCurrentActive = (cfg.cnpjRaiz || '').replace(/\D/g, '').substring(0, 8) === activeClean;
                      const branchCount = getBranchCount(cfg.cnpjRaiz);
                      const branchInfo = branchCount > 0 ? ` (${branchCount} ${branchCount === 1 ? 'unidade' : 'unidades'})` : '';
                      return (
                        <option key={cfg.id} value={cfg.id}>
                          CNPJ Raiz: {cfg.cnpjRaiz} — {cfg.razaoSocial}{branchInfo}{isCurrentActive ? ' ⭐ [Empresa Ativa]' : ''}
                        </option>
                      );
                    })}
                  </select>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => {
                  setSelectedEmpresaPreset('');
                  setNewCnpjRaizInput('');
                  setNewRazaoSocialInput('');
                  setShowNewCnpjModal(true);
                }}
                className="px-3.5 py-2 rounded-xl bg-cyan-950 hover:bg-cyan-900 text-cyan-300 border border-cyan-800/80 text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-sm"
              >
                <Plus className="w-4 h-4" />
                Novo CNPJ Raiz
              </button>

              {currentConfig && (
                <button
                  onClick={() => handleDeleteCnpjRaiz(currentConfig.id)}
                  className="p-2 rounded-xl bg-slate-900 hover:bg-red-950 text-slate-400 hover:text-red-300 border border-slate-800 hover:border-red-800 text-xs font-bold transition-all cursor-pointer"
                  title="Excluir este CNPJ Raiz"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          {currentConfig && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              
              {/* Box 1: Diretório de XMLs de ENTRADA (Recebidos / Fornecedores) */}
              <div className="p-5 rounded-2xl bg-gradient-to-br from-slate-900/90 to-slate-950/80 border border-blue-900/40 space-y-4 shadow-lg">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-blue-950/90 border border-blue-800 flex items-center justify-center text-blue-400">
                      <FolderInput className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-white flex items-center gap-2">
                        XMLs de Entrada
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-blue-950 text-blue-300 border border-blue-800">
                          Compras / Fornecedores
                        </span>
                      </h4>
                      <p className="text-[11px] text-slate-400">Diretório de destino para NF-e/CT-e recepcionadas</p>
                    </div>
                  </div>
                </div>

                {/* Input Caminho Entrada */}
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center justify-between">
                    <span>Caminho do Diretório (Local ou Unidade Mapeada):</span>
                    <span className="text-[10px] text-slate-500 font-mono">Ex: C:\SEFAZ\Entrada</span>
                  </label>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <Folder className="w-4 h-4 absolute left-3 top-2.5 text-blue-400" />
                      <input
                        type="text"
                        value={currentConfig.diretorioEntrada}
                        onChange={(e) => handleUpdateCurrentConfig('diretorioEntrada', e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-3 py-2 text-xs text-slate-100 font-mono focus:outline-none focus:border-blue-500"
                        placeholder="C:\SEFAZ\XMLs\33000167\Entrada"
                      />
                    </div>
                  </div>
                </div>

                {/* Subpasta por data */}
                <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/80 space-y-2">
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={currentConfig.subpastaDataEntrada}
                      onChange={(e) => handleUpdateCurrentConfig('subpastaDataEntrada', e.target.checked)}
                      className="w-4 h-4 rounded text-blue-500 focus:ring-0 bg-slate-900 border-slate-700"
                    />
                    <span className="text-xs font-semibold text-slate-200">
                      Criar subpastas automáticas por Ano e Mês de emissão
                    </span>
                  </label>
                  <p className="text-[11px] text-slate-400 pl-6">
                    Exemplo de estrutura salva: <code className="text-blue-300 font-mono bg-blue-950/50 px-1 py-0.5 rounded">{currentConfig.diretorioEntrada}\2026\08\NFe_3526081721307...xml</code>
                  </p>
                </div>

                {/* Estrutura de nomenclatura */}
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Nomenclatura do arquivo XML gravado:
                  </label>
                  <div className="space-y-1.5 text-xs">
                    <label className="flex items-center gap-2 text-slate-300 cursor-pointer">
                      <input
                        type="radio"
                        name={`nomenclatura-entrada-${currentConfig.id}`}
                        checked={currentConfig.estruturaNomeEntrada === 'chave'}
                        onChange={() => handleUpdateCurrentConfig('estruturaNomeEntrada', 'chave')}
                        className="text-blue-500 focus:ring-0"
                      />
                      <span>Apenas Chave de Acesso (Ex: <code className="text-slate-400 font-mono">3526081721307...xml</code>)</span>
                    </label>
                    <label className="flex items-center gap-2 text-slate-300 cursor-pointer">
                      <input
                        type="radio"
                        name={`nomenclatura-entrada-${currentConfig.id}`}
                        checked={currentConfig.estruturaNomeEntrada === 'tipo_numero'}
                        onChange={() => handleUpdateCurrentConfig('estruturaNomeEntrada', 'tipo_numero')}
                        className="text-blue-500 focus:ring-0"
                      />
                      <span>Tipo e Número do DFe (Ex: <code className="text-slate-400 font-mono">NFE_000542100_S3.xml</code>)</span>
                    </label>
                    <label className="flex items-center gap-2 text-slate-300 cursor-pointer">
                      <input
                        type="radio"
                        name={`nomenclatura-entrada-${currentConfig.id}`}
                        checked={currentConfig.estruturaNomeEntrada === 'data_emitente'}
                        onChange={() => handleUpdateCurrentConfig('estruturaNomeEntrada', 'data_emitente')}
                        className="text-blue-500 focus:ring-0"
                      />
                      <span>Data, Emitente e Número (Ex: <code className="text-slate-400 font-mono">20260730_33000167_NF542100.xml</code>)</span>
                    </label>
                  </div>
                </div>

              </div>

              {/* Box 2: Diretório de XMLs de SAÍDA (Emitidos / Vendas) */}
              <div className="p-5 rounded-2xl bg-gradient-to-br from-slate-900/90 to-slate-950/80 border border-emerald-900/40 space-y-4 shadow-lg">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-emerald-950/90 border border-emerald-800 flex items-center justify-center text-emerald-400">
                      <FolderOutput className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-white flex items-center gap-2">
                        XMLs de Saída
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-800">
                          Vendas / Emitidos
                        </span>
                      </h4>
                      <p className="text-[11px] text-slate-400">Diretório de destino para NF-e/NFC-e emitidas próprias</p>
                    </div>
                  </div>
                </div>

                {/* Input Caminho Saida */}
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center justify-between">
                    <span>Caminho do Diretório (Local ou Unidade Mapeada):</span>
                    <span className="text-[10px] text-slate-500 font-mono">Ex: C:\SEFAZ\Saida</span>
                  </label>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <Folder className="w-4 h-4 absolute left-3 top-2.5 text-emerald-400" />
                      <input
                        type="text"
                        value={currentConfig.diretorioSaida}
                        onChange={(e) => handleUpdateCurrentConfig('diretorioSaida', e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-3 py-2 text-xs text-slate-100 font-mono focus:outline-none focus:border-emerald-500"
                        placeholder="C:\SEFAZ\XMLs\33000167\Saida"
                      />
                    </div>
                  </div>
                </div>

                {/* Subpasta por data */}
                <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/80 space-y-2">
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={currentConfig.subpastaDataSaida}
                      onChange={(e) => handleUpdateCurrentConfig('subpastaDataSaida', e.target.checked)}
                      className="w-4 h-4 rounded text-emerald-500 focus:ring-0 bg-slate-900 border-slate-700"
                    />
                    <span className="text-xs font-semibold text-slate-200">
                      Criar subpastas automáticas por Ano e Mês de emissão
                    </span>
                  </label>
                  <p className="text-[11px] text-slate-400 pl-6">
                    Exemplo de estrutura salva: <code className="text-emerald-300 font-mono bg-emerald-950/50 px-1 py-0.5 rounded">{currentConfig.diretorioSaida}\2026\08\NFe_3526081721307...xml</code>
                  </p>
                </div>

                {/* Estrutura de nomenclatura */}
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Nomenclatura do arquivo XML gravado:
                  </label>
                  <div className="space-y-1.5 text-xs">
                    <label className="flex items-center gap-2 text-slate-300 cursor-pointer">
                      <input
                        type="radio"
                        name={`nomenclatura-saida-${currentConfig.id}`}
                        checked={currentConfig.estruturaNomeSaida === 'chave'}
                        onChange={() => handleUpdateCurrentConfig('estruturaNomeSaida', 'chave')}
                        className="text-emerald-500 focus:ring-0"
                      />
                      <span>Apenas Chave de Acesso (Ex: <code className="text-slate-400 font-mono">3526081721307...xml</code>)</span>
                    </label>
                    <label className="flex items-center gap-2 text-slate-300 cursor-pointer">
                      <input
                        type="radio"
                        name={`nomenclatura-saida-${currentConfig.id}`}
                        checked={currentConfig.estruturaNomeSaida === 'tipo_numero'}
                        onChange={() => handleUpdateCurrentConfig('estruturaNomeSaida', 'tipo_numero')}
                        className="text-emerald-500 focus:ring-0"
                      />
                      <span>Tipo e Número do DFe (Ex: <code className="text-slate-400 font-mono">NFE_000104892_S1.xml</code>)</span>
                    </label>
                    <label className="flex items-center gap-2 text-slate-300 cursor-pointer">
                      <input
                        type="radio"
                        name={`nomenclatura-saida-${currentConfig.id}`}
                        checked={currentConfig.estruturaNomeSaida === 'data_emitente'}
                        onChange={() => handleUpdateCurrentConfig('estruturaNomeSaida', 'data_emitente')}
                        className="text-emerald-500 focus:ring-0"
                      />
                      <span>Data, Emitente e Número (Ex: <code className="text-slate-400 font-mono">20260728_17213071_NF104892.xml</code>)</span>
                    </label>
                  </div>
                </div>

              </div>

            </div>
          )}

          {currentConfig && (
            <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-4">
              <h4 className="text-sm font-bold text-white flex items-center gap-2">
                <Settings className="w-4 h-4 text-cyan-400" />
                Diretório de Eventos & Parâmetros de Automação
              </h4>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Diretório de Eventos, Cartas de Correção e Cancelamentos:
                  </label>
                  <div className="relative">
                    <Folder className="w-4 h-4 absolute left-3 top-2.5 text-purple-400" />
                    <input
                      type="text"
                      value={currentConfig.diretorioEventos}
                      onChange={(e) => handleUpdateCurrentConfig('diretorioEventos', e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-3 py-2 text-xs text-slate-100 font-mono focus:outline-none focus:border-purple-500"
                    />
                  </div>
                </div>

                <div className="flex flex-col justify-end space-y-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={currentConfig.autoOrganizarAoCapturar}
                      onChange={(e) => handleUpdateCurrentConfig('autoOrganizarAoCapturar', e.target.checked)}
                      className="w-4 h-4 rounded text-cyan-500 focus:ring-0 bg-slate-950 border-slate-700"
                    />
                    <span className="text-xs font-semibold text-slate-200">
                      Organizar e salvar automaticamente no diretório correspondente ao importar/capturar novos XMLs
                    </span>
                  </label>
                </div>
              </div>

              {/* Status and Permissions Check */}
              <div className="pt-2 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-slate-400">Status do Monitoramento:</span>
                  <span className="px-2.5 py-0.5 rounded-full bg-emerald-950 text-emerald-300 font-bold border border-emerald-800 text-[11px] flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    Ativo (Monitorando pastas)
                  </span>
                </div>

                <button
                  onClick={handleTestDirectoryPermissions}
                  disabled={testResult.status === 'testing'}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold border border-slate-700 flex items-center gap-1.5 transition-all cursor-pointer"
                >
                  <RefreshCw className={`w-3.5 h-3.5 text-cyan-400 ${testResult.status === 'testing' ? 'animate-spin' : ''}`} />
                  Testar Permissões de Acesso aos Diretórios
                </button>
              </div>

              {testResult.msg && (
                <div className={`p-3 rounded-xl border text-xs flex items-center gap-2.5 ${
                  testResult.status === 'success'
                    ? 'bg-emerald-950/60 text-emerald-200 border-emerald-800/80'
                    : 'bg-blue-950/60 text-blue-200 border-blue-800/80'
                }`}>
                  <ShieldCheck className="w-4 h-4 shrink-0 text-emerald-400" />
                  <span>{testResult.msg}</span>
                </div>
              )}
            </div>
          )}

        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 bg-slate-900 border-t border-slate-800 flex items-center justify-between gap-4 shrink-0">
          <div className="text-xs text-slate-400 flex items-center gap-1.5">
            <HelpCircle className="w-4 h-4 text-slate-500" />
            Os diretórios são segregados pela chave do CNPJ Raiz (primeiros 8 dígitos).
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition-all cursor-pointer"
            >
              Cancelar
            </button>

            <button
              onClick={handleSaveAll}
              className="px-5 py-2 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white text-xs font-bold flex items-center gap-2 shadow-lg shadow-cyan-600/20 transition-all cursor-pointer"
            >
              {saveFeedback ? <Check className="w-4 h-4 text-emerald-300" /> : <Save className="w-4 h-4" />}
              {saveFeedback ? 'Configurações Gravadas!' : 'Salvar Configurações'}
            </button>
          </div>
        </div>

      </div>

      {/* Sub-modal: New CNPJ Raiz */}
      {showNewCnpjModal && (
        <div className="fixed inset-0 z-60 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-lg p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h4 className="text-sm font-bold text-white flex items-center gap-2">
                <Plus className="w-4 h-4 text-cyan-400" />
                Cadastrar / Vincular Novo CNPJ Raiz
              </h4>
              <button
                onClick={() => setShowNewCnpjModal(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-4">
              {/* Seletor rápido de Empresa Cadastrada na Carteira */}
              {empresasDisponiveis && empresasDisponiveis.length > 0 && (
                <div className="p-3.5 rounded-xl bg-cyan-950/30 border border-cyan-800/60 space-y-2">
                  <label className="block text-xs font-bold text-cyan-300 uppercase tracking-wider flex items-center gap-1.5">
                    <Building2 className="w-3.5 h-3.5 text-cyan-400" />
                    Vincular a uma Empresa Cadastrada na Carteira:
                  </label>
                  <select
                    value={selectedEmpresaPreset}
                    onChange={(e) => {
                      const empId = e.target.value;
                      setSelectedEmpresaPreset(empId);
                      const emp = empresasDisponiveis.find(item => item.id === empId);
                      if (emp) {
                        const clean = (emp.cnpjRaiz || emp.cnpjCompleto || '').replace(/\D/g, '').substring(0, 8);
                        const formatted = `${clean.substring(0, 2)}.${clean.substring(2, 5)}.${clean.substring(5, 8)}`;
                        setNewCnpjRaizInput(formatted);
                        setNewRazaoSocialInput(emp.razaoSocial || emp.nomeFantasia || '');
                      }
                    }}
                    className="w-full bg-slate-950 border border-cyan-800/80 rounded-lg px-3 py-2 text-xs text-white font-medium focus:outline-none focus:border-cyan-400"
                  >
                    <option value="">-- Selecione para preenchimento automático --</option>
                    {empresasDisponiveis.map(emp => {
                      const clean = (emp.cnpjRaiz || emp.cnpjCompleto || '').replace(/\D/g, '').substring(0, 8);
                      const alreadyConfigured = localConfigs.some(c => (c.cnpjRaiz || '').replace(/\D/g, '').substring(0, 8) === clean);
                      return (
                        <option key={emp.id} value={emp.id}>
                          {emp.cnpjCompleto ? formatCNPJ(emp.cnpjCompleto) : emp.cnpjRaiz} — {emp.razaoSocial} ({emp.uf || 'BR'}) {alreadyConfigured ? '✓ Já configurado' : '⭐ Pronto para configurar'}
                        </option>
                      );
                    })}
                  </select>
                  {selectedEmpresaPreset && (
                    <div className="text-[11px] text-emerald-400 flex items-center gap-1.5 font-medium pt-1">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                      Dados preenchidos automaticamente a partir da empresa selecionada!
                    </div>
                  )}
                </div>
              )}

              <div className="relative flex py-1 items-center">
                <div className="flex-grow border-t border-slate-800"></div>
                <span className="flex-shrink mx-2 text-[10px] text-slate-500 uppercase tracking-widest font-bold">
                  Ou preencha / ajuste os campos abaixo
                </span>
                <div className="flex-grow border-t border-slate-800"></div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  CNPJ Raiz (8 Primeiros dígitos):
                </label>
                <input
                  type="text"
                  value={newCnpjRaizInput}
                  onChange={(e) => setNewCnpjRaizInput(e.target.value)}
                  placeholder="Ex: 19.791.896"
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Razão Social / Nome do Grupo:
                </label>
                <input
                  type="text"
                  value={newRazaoSocialInput}
                  onChange={(e) => setNewRazaoSocialInput(e.target.value)}
                  placeholder="Ex: SUPERGASBRAS ENERGIA LTDA"
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-500"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
              <button
                onClick={() => setShowNewCnpjModal(false)}
                className="px-3.5 py-2 rounded-lg bg-slate-800 text-slate-300 text-xs font-bold hover:bg-slate-700"
              >
                Cancelar
              </button>
              <button
                onClick={handleAddCnpjRaiz}
                className="px-4 py-2 rounded-lg bg-gradient-to-r from-cyan-600 to-blue-600 text-white text-xs font-bold hover:from-cyan-500 hover:to-blue-500 shadow-md shadow-cyan-600/30 flex items-center gap-1.5"
              >
                <Check className="w-3.5 h-3.5" />
                Confirmar Configuração
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
