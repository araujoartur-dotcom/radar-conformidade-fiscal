import React, { useState, useEffect } from 'react';
import {
  SlidersHorizontal, Table, Plus, Edit3, Trash2, CheckCircle2,
  AlertTriangle, FileText, Scale, Save, Percent, ShieldCheck, Search, Filter, X,
  Check, FileCheck, Layers
} from 'lucide-react';
import { useApi } from '../hooks/useApi';

interface CClassRule {
  id: string;
  cclasstrib: string;
  descricao_interna: string;
  tratamento_esperado: 'tributado' | 'aliquota_reduzida' | 'isento' | 'nao_incidencia' | 'monofasico';
  permite_credito: 'Sim' | 'Não' | 'Parcial' | 'Depende';
  aliquota_esperada: string;
  alertas?: string;
}

interface CfopRule {
  id: string;
  cfop: string;
  descricao: string;
  categoria: 'Compra' | 'Devolução' | 'Transferência' | 'Remessa' | 'Outros';
  tratamento_padrao: 'Elegível' | 'Não elegível' | 'Depende';
  exige_onerosidade: boolean;
  evidencia_minima?: string;
}

interface RegraElegibilidade {
  id: string;
  codigo_regra: string;
  nome: string;
  descricao: string;
  tipo_aquisicao: string;
  cfops_aplicaveis: string;
  resultado_padrao: string;
  evidencia_minima: string;
  base_legal: string;
}

export const TabelasFiscaisPanel: React.FC = () => {
  const { get, post, put, del } = useApi();
  const [activeTab, setActiveTab] = useState<'cclasstrib' | 'cfop' | 'aliquotas' | 'regras'>('cclasstrib');
  
  // cClassTrib State
  const [cClassRules, setCClassRules] = useState<CClassRule[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [editingCClass, setEditingCClass] = useState<CClassRule | null>(null);
  
  // Add cClass Modal State
  const [showAddCClass, setShowAddCClass] = useState(false);
  const [newCode, setNewCode] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newTratamento, setNewTratamento] = useState<CClassRule['tratamento_esperado']>('tributado');
  const [newCredito, setNewCredito] = useState<CClassRule['permite_credito']>('Sim');
  const [newAliquota, setNewAliquota] = useState('26.5%');

  // CFOP State & Modals
  const [cfopRules, setCfopRules] = useState<CfopRule[]>([]);
  const [showAddCfop, setShowAddCfop] = useState(false);
  const [editingCfop, setEditingCfop] = useState<CfopRule | null>(null);
  const [newCfopCode, setNewCfopCode] = useState('');
  const [newCfopDesc, setNewCfopDesc] = useState('');
  const [newCfopCat, setNewCfopCat] = useState<CfopRule['categoria']>('Compra');
  const [newCfopTrat, setNewCfopTrat] = useState<CfopRule['tratamento_padrao']>('Elegível');
  const [newCfopOneroso, setNewCfopOneroso] = useState(true);
  const [newCfopEvidencia, setNewCfopEvidencia] = useState('');

  // Regras de Elegibilidade
  const [regras, setRegras] = useState<RegraElegibilidade[]>([]);

  // Reference Rates State
  const [aliquotaCbs, setAliquotaCbs] = useState<number>(8.8);
  const [aliquotaIbs, setAliquotaIbs] = useState<number>(17.7);
  const [reducao60, setReducao60] = useState<number>(60.0);
  const [rateSaveSuccess, setRateSaveSuccess] = useState(false);

  // ── LOAD DATA FROM API ─────────────────────────────────
  const reloadData = async () => {
    const resClass = await get<{ success: boolean; data: CClassRule[] }>('/tables/cclasstrib');
    if (resClass.ok && resClass.data?.data) {
      setCClassRules(resClass.data.data);
    }
    
    const resCfop = await get<{ success: boolean; data: CfopRule[] }>('/tables/cfop');
    if (resCfop.ok && resCfop.data?.data) {
      setCfopRules(resCfop.data.data);
    }

    const resRegras = await get<{ success: boolean; data: RegraElegibilidade[] }>('/tables/regras');
    if (resRegras.ok && resRegras.data?.data) {
      setRegras(resRegras.data.data);
    }

    const resAliquota = await get<{ data: any[] }>('/tables/aliquotas/vigente');
    if (resAliquota.ok && resAliquota.data?.data) {
      const cbs = resAliquota.data.data.find((a: any) => a.tipo_tributo === 'CBS');
      const ibs = resAliquota.data.data.find((a: any) => a.tipo_tributo === 'IBS');
      if (cbs) setAliquotaCbs(Number(cbs.aliquota_referencia));
      if (ibs) setAliquotaIbs(Number(ibs.aliquota_referencia));
    }
  };

  useEffect(() => {
    reloadData();
  }, []);

  const handleSaveRates = async (e: React.FormEvent) => {
    e.preventDefault();
    const hoje = new Date().toISOString().slice(0, 10);
    await post('/tables/aliquotas', { competencia_inicio: hoje, tipo_tributo: 'CBS', aliquota_referencia: aliquotaCbs, descricao: 'CBS Referência' });
    await post('/tables/aliquotas', { competencia_inicio: hoje, tipo_tributo: 'IBS', aliquota_referencia: aliquotaIbs, descricao: 'IBS Referência' });
    
    setRateSaveSuccess(true);
    setTimeout(() => setRateSaveSuccess(false), 3000);
  };

  const handleAddCClass = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCode || !newDesc) {
      alert('Informe o código cClassTrib de 6 dígitos e a descrição.');
      return;
    }

    const cleanCode = newCode.replace(/\D/g, '').padStart(6, '0');
    
    const res = await post('/tables/cclasstrib', {
      cclasstrib: cleanCode,
      descricao_interna: newDesc,
      tratamento_esperado: newTratamento,
      permite_credito: newCredito,
      aliquota_esperada: newAliquota || `${(aliquotaCbs + aliquotaIbs).toFixed(1)}%`
    });

    if (res.ok) {
      await reloadData();
      setNewCode('');
      setNewDesc('');
      setShowAddCClass(false);
    } else {
      alert(res.error || 'Erro ao criar cClassTrib');
    }
  };

  const handleSaveEditCClass = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCClass) return;

    const cleanCode = editingCClass.cclasstrib.replace(/\D/g, '').padStart(6, '0');

    const res = await put(`/tables/cclasstrib/${editingCClass.id}`, {
      cclasstrib: cleanCode,
      descricao_interna: editingCClass.descricao_interna,
      tratamento_esperado: editingCClass.tratamento_esperado,
      permite_credito: editingCClass.permite_credito,
      aliquota_esperada: editingCClass.aliquota_esperada,
      alertas: editingCClass.alertas
    });

    if (res.ok) {
      await reloadData();
      setEditingCClass(null);
    } else {
      alert(res.error || 'Erro ao atualizar cClassTrib');
    }
  };

  const handleDeleteCClass = async (id: string) => {
    if (confirm('Tem certeza que deseja excluir esta regra de cClassTrib?')) {
      const res = await del(`/tables/cclasstrib/${id}`);
      if (res.ok) {
        setCClassRules(prev => prev.filter(c => c.id !== id));
      } else {
        alert(res.error || 'Erro ao excluir cClassTrib');
      }
    }
  };

  const handleAddCfop = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCfopCode || !newCfopDesc) {
      alert('Informe o código CFOP e a descrição.');
      return;
    }

    const res = await post('/tables/cfop', {
      cfop: newCfopCode.trim(),
      descricao: newCfopDesc.trim(),
      categoria: newCfopCat,
      tratamento_padrao: newCfopTrat,
      exige_onerosidade: newCfopOneroso,
      evidencia_minima: newCfopEvidencia
    });

    if (res.ok) {
      await reloadData();
      setNewCfopCode('');
      setNewCfopDesc('');
      setNewCfopEvidencia('');
      setShowAddCfop(false);
    } else {
      alert(res.error || 'Erro ao salvar CFOP');
    }
  };

  const handleSaveEditCfop = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCfop) return;

    const res = await put(`/tables/cfop/${editingCfop.id}`, {
      cfop: editingCfop.cfop,
      descricao: editingCfop.descricao,
      categoria: editingCfop.categoria,
      tratamento_padrao: editingCfop.tratamento_padrao,
      exige_onerosidade: editingCfop.exige_onerosidade,
      evidencia_minima: editingCfop.evidencia_minima
    });

    if (res.ok) {
      await reloadData();
      setEditingCfop(null);
    } else {
      alert(res.error || 'Erro ao atualizar CFOP');
    }
  };

  const handleDeleteCfop = async (id: string) => {
    if (confirm('Tem certeza que deseja desativar este CFOP?')) {
      const res = await del(`/tables/cfop/${id}`);
      if (res.ok) {
        setCfopRules(prev => prev.filter(c => c.id !== id));
      } else {
        alert(res.error || 'Erro ao desativar CFOP');
      }
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="p-6 rounded-2xl bg-gradient-to-r from-slate-900 via-slate-950 to-indigo-950 border border-slate-800 shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-950 border border-cyan-800 text-cyan-300 text-xs font-bold mb-2">
            <SlidersHorizontal className="w-3.5 h-3.5 text-cyan-400" />
            Parâmetros Fiscais & Motor de Regras Tributárias (6 Dígitos cClassTrib)
          </div>
          <h2 className="text-2xl font-extrabold text-white tracking-tight">
            Gestão de Tabelas, Parâmetros e Regras Fiscais
          </h2>
          <p className="text-xs text-slate-300 max-w-3xl mt-1">
            Atualize as alíquotas de referência da Reforma Tributária (CBS/IBS), cadastre e edite os códigos oficiais de <strong>cClassTrib (6 dígitos)</strong>, configure matrizes de crédito por <strong>CFOP</strong> e audite as <strong>Regras de Elegibilidade</strong>.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {activeTab === 'cclasstrib' && (
            <button
              onClick={() => setShowAddCClass(true)}
              className="px-4 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs flex items-center gap-2 shadow-lg shadow-cyan-600/20 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Novo cClassTrib (6 Dígitos)</span>
            </button>
          )}

          {activeTab === 'cfop' && (
            <button
              onClick={() => setShowAddCfop(true)}
              className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs flex items-center gap-2 shadow-lg shadow-indigo-600/20 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Novo CFOP</span>
            </button>
          )}
        </div>
      </div>

      {/* Module Tabs Selector */}
      <div className="flex items-center bg-slate-900/90 p-1.5 rounded-2xl border border-slate-800 gap-2">
        <button
          onClick={() => setActiveTab('cclasstrib')}
          className={`flex-1 py-2.5 px-4 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer ${
            activeTab === 'cclasstrib'
              ? 'bg-blue-600 text-white shadow-md'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Table className="w-4 h-4" />
          <span>Classificação cClassTrib (6 Dígitos)</span>
        </button>

        <button
          onClick={() => setActiveTab('cfop')}
          className={`flex-1 py-2.5 px-4 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer ${
            activeTab === 'cfop'
              ? 'bg-indigo-600 text-white shadow-md'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Scale className="w-4 h-4" />
          <span>Matriz de Tratamento CFOP ({cfopRules.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('regras')}
          className={`flex-1 py-2.5 px-4 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer ${
            activeTab === 'regras'
              ? 'bg-teal-600 text-white shadow-md'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <ShieldCheck className="w-4 h-4" />
          <span>Regras de Elegibilidade ({regras.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('aliquotas')}
          className={`flex-1 py-2.5 px-4 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer ${
            activeTab === 'aliquotas'
              ? 'bg-purple-600 text-white shadow-md'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Percent className="w-4 h-4" />
          <span>Alíquotas de Referência CBS/IBS</span>
        </button>
      </div>

      {/* TAB 1: cClassTrib Rules (6 Digits) */}
      {activeTab === 'cclasstrib' && (
        <div className="p-6 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-4 shadow-lg">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="relative w-full sm:w-96">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Filtrar por código 6 dígitos ou descrição..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-cyan-500"
              />
            </div>
            <div className="text-xs text-slate-400 font-mono">
              Total de Códigos Cadastrados: <strong className="text-white">{cClassRules.length}</strong>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left text-slate-300">
              <thead className="bg-slate-950 text-slate-400 font-bold uppercase tracking-wider text-[10px] border-b border-slate-800">
                <tr>
                  <th className="p-3">cClassTrib (6D)</th>
                  <th className="p-3">Descrição Operação RTC</th>
                  <th className="p-3">Tratamento Tributário</th>
                  <th className="p-3">Gera Crédito</th>
                  <th className="p-3">Alíquota Esperada</th>
                  <th className="p-3">Alertas & Regras</th>
                  <th className="p-3 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-mono">
                {cClassRules
                  .filter(c => c.cclasstrib.includes(searchTerm) || c.descricao_interna.toLowerCase().includes(searchTerm.toLowerCase()))
                  .map((rule) => (
                    <tr key={rule.id} className="hover:bg-slate-800/40">
                      <td className="p-3 font-extrabold text-cyan-400 text-sm">{rule.cclasstrib}</td>
                      <td className="p-3 font-sans text-white font-semibold max-w-xs">{rule.descricao_interna}</td>
                      <td className="p-3 font-sans">
                        <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-bold text-[10px] uppercase">
                          {rule.tratamento_esperado.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="p-3 font-sans">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          rule.permite_credito === 'Sim' ? 'bg-emerald-950 text-emerald-300 border border-emerald-800' : 'bg-rose-950 text-rose-300 border border-rose-800'
                        }`}>
                          {rule.permite_credito}
                        </span>
                      </td>
                      <td className="p-3 text-slate-200">{rule.aliquota_esperada}</td>
                      <td className="p-3 font-sans text-[11px] text-slate-400 max-w-xs truncate">{rule.alertas || '-'}</td>
                      <td className="p-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => setEditingCClass({ ...rule })}
                            className="p-1.5 rounded-lg bg-slate-800 hover:bg-blue-600 text-slate-400 hover:text-white transition-all cursor-pointer"
                            title="Editar Regra"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeleteCClass(rule.id)}
                            className="p-1.5 rounded-lg bg-slate-800 hover:bg-rose-600 text-slate-400 hover:text-white transition-all cursor-pointer"
                            title="Excluir"
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
      )}

      {/* TAB 2: CFOP Matrix CRUD */}
      {activeTab === 'cfop' && (
        <div className="p-6 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-4 shadow-lg">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Scale className="w-5 h-5 text-indigo-400" />
              Matriz de CFOP x Elegibilidade de Crédito
            </h3>
            <span className="text-xs text-slate-400 font-mono">Total CFOPs: {cfopRules.length}</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left text-slate-300">
              <thead className="bg-slate-950 text-slate-400 font-bold uppercase text-[10px] border-b border-slate-800">
                <tr>
                  <th className="p-3">CFOP</th>
                  <th className="p-3">Descrição Operação</th>
                  <th className="p-3">Categoria</th>
                  <th className="p-3">Tratamento Padrão</th>
                  <th className="p-3">Exige Onerosidade</th>
                  <th className="p-3">Evidência Mínima</th>
                  <th className="p-3 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-mono">
                {cfopRules.map((cf) => (
                  <tr key={cf.id} className="hover:bg-slate-800/40">
                    <td className="p-3 font-extrabold text-indigo-300 text-sm">{cf.cfop}</td>
                    <td className="p-3 font-sans text-white font-semibold">{cf.descricao}</td>
                    <td className="p-3 font-sans">
                      <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-bold text-[10px]">{cf.categoria}</span>
                    </td>
                    <td className="p-3 font-sans">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        cf.tratamento_padrao === 'Elegível'
                          ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                          : 'bg-rose-950 text-rose-300 border border-rose-800'
                      }`}>
                        {cf.tratamento_padrao}
                      </span>
                    </td>
                    <td className="p-3 font-sans text-slate-400">{cf.exige_onerosidade ? 'Sim (Exige Evidência)' : 'Não'}</td>
                    <td className="p-3 font-sans text-[11px] text-slate-400 max-w-xs truncate">{cf.evidencia_minima || '-'}</td>
                    <td className="p-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => setEditingCfop({ ...cf })}
                          className="p-1.5 rounded-lg bg-slate-800 hover:bg-blue-600 text-slate-400 hover:text-white transition-all cursor-pointer"
                          title="Editar CFOP"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDeleteCfop(cf.id)}
                          className="p-1.5 rounded-lg bg-slate-800 hover:bg-rose-600 text-slate-400 hover:text-white transition-all cursor-pointer"
                          title="Desativar"
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
      )}

      {/* TAB 3: Regras de Elegibilidade */}
      {activeTab === 'regras' && (
        <div className="p-6 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-4 shadow-lg">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-teal-400" />
                Regras Automatizadas de Auditoria e Elegibilidade ao Crédito
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Regras aplicadas no motor de conformidade para aprovar ou glosar créditos na entrada de XMLs.
              </p>
            </div>
            <span className="text-xs text-slate-400 font-mono">Regras Ativas: {regras.length}</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left text-slate-300">
              <thead className="bg-slate-950 text-slate-400 font-bold uppercase text-[10px] border-b border-slate-800">
                <tr>
                  <th className="p-3">Código</th>
                  <th className="p-3">Nome da Regra</th>
                  <th className="p-3">Tipo / Aquisição</th>
                  <th className="p-3">CFOPs Cobertos</th>
                  <th className="p-3">Resultado</th>
                  <th className="p-3">Evidência Mínima Exigida</th>
                  <th className="p-3">Base Legal</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {regras.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-800/40 font-sans">
                    <td className="p-3 font-mono font-extrabold text-teal-400">{r.codigo_regra}</td>
                    <td className="p-3 font-bold text-white max-w-xs">{r.nome}</td>
                    <td className="p-3 text-slate-300">{r.tipo_aquisicao}</td>
                    <td className="p-3 font-mono text-[11px] text-cyan-300">{r.cfops_aplicaveis}</td>
                    <td className="p-3">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        r.resultado_padrao === 'Elegível'
                          ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                          : 'bg-rose-950 text-rose-300 border border-rose-800'
                      }`}>
                        {r.resultado_padrao}
                      </span>
                    </td>
                    <td className="p-3 text-slate-400 max-w-xs truncate">{r.evidencia_minima}</td>
                    <td className="p-3 font-mono text-[10px] text-slate-500">{r.base_legal}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 4: Reference Tax Rates Parameters */}
      {activeTab === 'aliquotas' && (
        <form onSubmit={handleSaveRates} className="p-6 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-6 max-w-2xl">
          <h3 className="text-base font-bold text-white flex items-center gap-2 border-b border-slate-800 pb-3">
            <Percent className="w-5 h-5 text-purple-400" />
            Parâmetros Nacionais de Alíquotas (CBS & IBS)
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div>
              <label className="font-bold text-slate-300 block mb-1">Alíquota CBS Padrão (Federal %)</label>
              <input
                type="number"
                step="0.1"
                value={aliquotaCbs}
                onChange={(e) => setAliquotaCbs(Number(e.target.value))}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-slate-200 font-mono focus:outline-none focus:border-purple-500"
                required
              />
            </div>

            <div>
              <label className="font-bold text-slate-300 block mb-1">Alíquota IBS Padrão (Estadual/Municipal %)</label>
              <input
                type="number"
                step="0.1"
                value={aliquotaIbs}
                onChange={(e) => setAliquotaIbs(Number(e.target.value))}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-slate-200 font-mono focus:outline-none focus:border-purple-500"
                required
              />
            </div>

            <div>
              <label className="font-bold text-slate-300 block mb-1">Percentual Redução Cesta Básica (%)</label>
              <input
                type="number"
                step="1"
                value={reducao60}
                onChange={(e) => setReducao60(Number(e.target.value))}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-slate-200 font-mono focus:outline-none"
                required
              />
            </div>

            <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 flex flex-col justify-center">
              <span className="text-[10px] text-slate-400 font-mono">Alíquota Combinada Calculada:</span>
              <strong className="text-lg font-extrabold text-emerald-400 font-mono mt-0.5">
                {(aliquotaCbs + aliquotaIbs).toFixed(1)}%
              </strong>
            </div>
          </div>

          <div className="flex items-center justify-between pt-3 border-t border-slate-800">
            {rateSaveSuccess ? (
              <span className="text-xs text-emerald-400 font-bold flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4" />
                Parâmetros atualizados com sucesso no sistema!
              </span>
            ) : (
              <span className="text-[11px] text-slate-400">
                Estes valores alimentam os relatórios e cruzamentos fiscais.
              </span>
            )}

            <button
              type="submit"
              className="px-5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs flex items-center gap-2 shadow-lg shadow-purple-600/20 cursor-pointer"
            >
              <Save className="w-4 h-4" />
              <span>Salvar Parâmetros Fiscais</span>
            </button>
          </div>
        </form>
      )}

      {/* Modal Add cClassTrib */}
      {showAddCClass && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Plus className="w-5 h-5 text-cyan-400" />
                Cadastrar Código cClassTrib (6 Dígitos)
              </h3>
              <button onClick={() => setShowAddCClass(false)} className="text-slate-400 hover:text-white text-xs font-bold">✕</button>
            </div>

            <form onSubmit={handleAddCClass} className="space-y-3 text-xs">
              <div>
                <label className="font-bold text-slate-300 block mb-1">Código cClassTrib (6 dígitos ex: 000001, 100001) *</label>
                <input
                  type="text"
                  maxLength={6}
                  placeholder="000001"
                  value={newCode}
                  onChange={(e) => setNewCode(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-slate-200 font-mono text-sm focus:outline-none focus:border-cyan-500"
                  required
                />
              </div>

              <div>
                <label className="font-bold text-slate-300 block mb-1">Descrição da Operação Fiscal *</label>
                <input
                  type="text"
                  placeholder="Ex: Alimentos Básicos da Cesta Nacional..."
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-slate-200 focus:outline-none"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-300 block mb-1">Tratamento Fisco</label>
                  <select
                    value={newTratamento}
                    onChange={(e) => setNewTratamento(e.target.value as any)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-slate-200 focus:outline-none"
                  >
                    <option value="tributado">Tributado Integral</option>
                    <option value="aliquota_reduzida">Alíquota Reduzida</option>
                    <option value="isento">Isenção / Imunidade</option>
                    <option value="nao_incidencia">Não Incidência</option>
                    <option value="monofasico">Monofásico</option>
                  </select>
                </div>

                <div>
                  <label className="font-bold text-slate-300 block mb-1">Permite Crédito?</label>
                  <select
                    value={newCredito}
                    onChange={(e) => setNewCredito(e.target.value as any)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-slate-200 focus:outline-none"
                  >
                    <option value="Sim">Sim</option>
                    <option value="Não">Não</option>
                    <option value="Depende">Depende</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
                <button type="button" onClick={() => setShowAddCClass(false)} className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 font-bold">Cancelar</button>
                <button type="submit" className="px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold">Salvar Regra</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Edit cClassTrib */}
      {editingCClass && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Edit3 className="w-5 h-5 text-blue-400" />
                Editar Código cClassTrib ({editingCClass.cclasstrib})
              </h3>
              <button onClick={() => setEditingCClass(null)} className="text-slate-400 hover:text-white text-xs font-bold">✕</button>
            </div>

            <form onSubmit={handleSaveEditCClass} className="space-y-3 text-xs">
              <div>
                <label className="font-bold text-slate-300 block mb-1">Código cClassTrib (6 dígitos)</label>
                <input
                  type="text"
                  maxLength={6}
                  value={editingCClass.cclasstrib}
                  onChange={(e) => setEditingCClass({ ...editingCClass, cclasstrib: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-slate-200 font-mono focus:outline-none"
                  required
                />
              </div>

              <div>
                <label className="font-bold text-slate-300 block mb-1">Descrição</label>
                <input
                  type="text"
                  value={editingCClass.descricao_interna}
                  onChange={(e) => setEditingCClass({ ...editingCClass, descricao_interna: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-slate-200 focus:outline-none"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-300 block mb-1">Tratamento</label>
                  <select
                    value={editingCClass.tratamento_esperado}
                    onChange={(e) => setEditingCClass({ ...editingCClass, tratamento_esperado: e.target.value as any })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-slate-200 focus:outline-none"
                  >
                    <option value="tributado">Tributado</option>
                    <option value="aliquota_reduzida">Alíquota Reduzida</option>
                    <option value="isento">Isento</option>
                    <option value="nao_incidencia">Não Incidência</option>
                    <option value="monofasico">Monofásico</option>
                  </select>
                </div>

                <div>
                  <label className="font-bold text-slate-300 block mb-1">Permite Crédito</label>
                  <select
                    value={editingCClass.permite_credito}
                    onChange={(e) => setEditingCClass({ ...editingCClass, permite_credito: e.target.value as any })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-slate-200 focus:outline-none"
                  >
                    <option value="Sim">Sim</option>
                    <option value="Não">Não</option>
                    <option value="Depende">Depende</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-300 block mb-1">Alertas e Observações</label>
                <textarea
                  value={editingCClass.alertas || ''}
                  onChange={(e) => setEditingCClass({ ...editingCClass, alertas: e.target.value })}
                  rows={2}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-slate-200 focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
                <button type="button" onClick={() => setEditingCClass(null)} className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 font-bold">Cancelar</button>
                <button type="submit" className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold">Salvar Alterações</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Add CFOP */}
      {showAddCfop && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Plus className="w-5 h-5 text-indigo-400" />
                Cadastrar Novo CFOP
              </h3>
              <button onClick={() => setShowAddCfop(false)} className="text-slate-400 hover:text-white text-xs font-bold">✕</button>
            </div>

            <form onSubmit={handleAddCfop} className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-300 block mb-1">Código CFOP (4 dígitos) *</label>
                  <input
                    type="text"
                    maxLength={4}
                    placeholder="1102"
                    value={newCfopCode}
                    onChange={(e) => setNewCfopCode(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-slate-200 font-mono text-sm focus:outline-none focus:border-indigo-500"
                    required
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-300 block mb-1">Categoria</label>
                  <select
                    value={newCfopCat}
                    onChange={(e) => setNewCfopCat(e.target.value as any)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-slate-200 focus:outline-none"
                  >
                    <option value="Compra">Compra</option>
                    <option value="Devolução">Devolução</option>
                    <option value="Transferência">Transferência</option>
                    <option value="Remessa">Remessa</option>
                    <option value="Outros">Outros</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-300 block mb-1">Descrição do CFOP *</label>
                <input
                  type="text"
                  placeholder="Ex: Compra para comercialização..."
                  value={newCfopDesc}
                  onChange={(e) => setNewCfopDesc(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-slate-200 focus:outline-none"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-300 block mb-1">Tratamento Padrão</label>
                  <select
                    value={newCfopTrat}
                    onChange={(e) => setNewCfopTrat(e.target.value as any)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-slate-200 focus:outline-none"
                  >
                    <option value="Elegível">Elegível</option>
                    <option value="Não elegível">Não elegível</option>
                    <option value="Depende">Depende</option>
                  </select>
                </div>

                <div className="flex items-center pt-5">
                  <label className="flex items-center gap-2 text-slate-300 font-bold cursor-pointer">
                    <input
                      type="checkbox"
                      checked={newCfopOneroso}
                      onChange={(e) => setNewCfopOneroso(e.target.checked)}
                      className="rounded border-slate-700 bg-slate-950 text-indigo-500 focus:ring-0"
                    />
                    <span>Exige Onerosidade?</span>
                  </label>
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-300 block mb-1">Evidência Mínima Exigida</label>
                <input
                  type="text"
                  placeholder="Ex: XML NF-e + Fatura Comercial"
                  value={newCfopEvidencia}
                  onChange={(e) => setNewCfopEvidencia(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-slate-200 focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
                <button type="button" onClick={() => setShowAddCfop(false)} className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 font-bold">Cancelar</button>
                <button type="submit" className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold">Salvar CFOP</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Edit CFOP */}
      {editingCfop && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Edit3 className="w-5 h-5 text-indigo-400" />
                Editar CFOP ({editingCfop.cfop})
              </h3>
              <button onClick={() => setEditingCfop(null)} className="text-slate-400 hover:text-white text-xs font-bold">✕</button>
            </div>

            <form onSubmit={handleSaveEditCfop} className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-300 block mb-1">CFOP</label>
                  <input
                    type="text"
                    maxLength={4}
                    value={editingCfop.cfop}
                    onChange={(e) => setEditingCfop({ ...editingCfop, cfop: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-slate-200 font-mono focus:outline-none"
                    required
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-300 block mb-1">Categoria</label>
                  <select
                    value={editingCfop.categoria}
                    onChange={(e) => setEditingCfop({ ...editingCfop, categoria: e.target.value as any })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-slate-200 focus:outline-none"
                  >
                    <option value="Compra">Compra</option>
                    <option value="Devolução">Devolução</option>
                    <option value="Transferência">Transferência</option>
                    <option value="Remessa">Remessa</option>
                    <option value="Outros">Outros</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-300 block mb-1">Descrição</label>
                <input
                  type="text"
                  value={editingCfop.descricao}
                  onChange={(e) => setEditingCfop({ ...editingCfop, descricao: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-slate-200 focus:outline-none"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-300 block mb-1">Tratamento Padrão</label>
                  <select
                    value={editingCfop.tratamento_padrao}
                    onChange={(e) => setEditingCfop({ ...editingCfop, tratamento_padrao: e.target.value as any })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-slate-200 focus:outline-none"
                  >
                    <option value="Elegível">Elegível</option>
                    <option value="Não elegível">Não elegível</option>
                    <option value="Depende">Depende</option>
                  </select>
                </div>

                <div className="flex items-center pt-5">
                  <label className="flex items-center gap-2 text-slate-300 font-bold cursor-pointer">
                    <input
                      type="checkbox"
                      checked={editingCfop.exige_onerosidade}
                      onChange={(e) => setEditingCfop({ ...editingCfop, exige_onerosidade: e.target.checked })}
                      className="rounded border-slate-700 bg-slate-950 text-indigo-500 focus:ring-0"
                    />
                    <span>Exige Onerosidade</span>
                  </label>
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-300 block mb-1">Evidência Mínima Exigida</label>
                <input
                  type="text"
                  value={editingCfop.evidencia_minima || ''}
                  onChange={(e) => setEditingCfop({ ...editingCfop, evidencia_minima: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-slate-200 focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
                <button type="button" onClick={() => setEditingCfop(null)} className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 font-bold">Cancelar</button>
                <button type="submit" className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold">Salvar Alterações</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
