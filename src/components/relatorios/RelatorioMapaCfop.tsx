import React, { useState, useEffect } from 'react';
import { MapaCfopItem } from '../../types';
import { BookOpen, Plus, ShieldCheck, CheckCircle2, XCircle, HelpCircle, Edit, Trash2, RefreshCw } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

export const RelatorioMapaCfop: React.FC = () => {
  const { token, config } = useAuth();
  const [mapaList, setMapaList] = useState<MapaCfopItem[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [loading, setLoading] = useState(false);

  // New Rule Form State
  const [newRule, setNewRule] = useState<MapaCfopItem>({
    cfop: '',
    descricao: '',
    categoria: 'Compra',
    tratamentoPadrao: 'Elegível',
    exigeOnerosidade: true,
    exigeValidaçãoCClassTrib: true,
    evidenciaMinima: 'Fatura de Compra + GRN'
  });

  const fetchMapaList = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${config?.apiUrl || ''}/api/tables/cfop`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        const items = data.data.map((item: any) => ({
          cfop: item.cfop,
          descricao: item.descricao,
          categoria: item.categoria,
          tratamentoPadrao: item.tratamento_padrao,
          exigeOnerosidade: Boolean(item.exige_onerosidade),
          exigeValidaçãoCClassTrib: Boolean(item.exige_validacao_cclasstrib),
          evidenciaMinima: item.evidencia_minima || ''
        }));
        setMapaList(items);
      }
    } catch (err) {
      console.error('Erro ao buscar CFOP', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMapaList();
  }, [token, config]);

  const filtered = mapaList.filter(item => 
    item.cfop.includes(searchTerm) || 
    item.descricao.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.categoria.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleAddRule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRule.cfop || !newRule.descricao) return;

    try {
      const response = await fetch(`${config?.apiUrl || ''}/api/tables/cfop`, {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          cfop: newRule.cfop,
          descricao: newRule.descricao,
          categoria: newRule.categoria,
          tratamento_padrao: newRule.tratamentoPadrao,
          exige_onerosidade: newRule.exigeOnerosidade,
          exige_validacao_cclasstrib: newRule.exigeValidaçãoCClassTrib,
          evidencia_minima: newRule.evidenciaMinima,
          global: false
        })
      });

      if (response.ok) {
        await fetchMapaList();
        setNewRule({
          cfop: '',
          descricao: '',
          categoria: 'Compra',
          tratamentoPadrao: 'Elegível',
          exigeOnerosidade: true,
          exigeValidaçãoCClassTrib: true,
          evidenciaMinima: 'Fatura de Compra + GRN'
        });
        setIsAdding(false);
      } else {
        alert('Erro ao adicionar regra CFOP');
      }
    } catch (err) {
      console.error(err);
      alert('Erro ao adicionar regra CFOP');
    }
  };

  const handleDeleteRule = async (cfop: string) => {
    // Para simplificar a remoção, deveríamos ter o ID. Como o estado usa CFOP, vamos encontrar o ID.
    // Ops, na listagem original, o endpoint retorna id, mas não estamos guardando no MapaCfopItem.
    // Vamos fazer um hack temporário pegando o ID de outra chamada ou ajustando.
    // Para resolver agora: O endpoint DELETE /api/tables/cfop/:id espera um ID.
    // Vou buscar o ID diretamente.
    try {
      const res = await fetch(`${config?.apiUrl || ''}/api/tables/cfop`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      const itemToDelete = data.data.find((item: any) => item.cfop === cfop);
      
      if (itemToDelete) {
        await fetch(`${config?.apiUrl || ''}/api/tables/cfop?id=${itemToDelete.id}`, {
          method: 'DELETE',
          headers: { 'Authorization': `Bearer ${token}` }
        });
        await fetchMapaList();
      }
    } catch (err) {
      console.error(err);
      alert('Erro ao excluir');
    }
  };

  return (
    <div className="space-y-4">
      <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-cyan-400" />
            6) Relatório “Mapa CFOP x Tratamento de Crédito” (Matriz de Governança Corporativa)
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Tabela mestra corporativa que define o enquadramento fiscal por CFOP no SAP/ERP, impedindo interpretações divergentes da equipe tributária.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {loading && <RefreshCw className="w-4 h-4 text-cyan-400 animate-spin" />}
          <input
            type="text"
            placeholder="Buscar CFOP ou Descrição..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 font-mono"
          />

          <button
            onClick={() => setIsAdding(!isAdding)}
            className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Adicionar CFOP</span>
          </button>
        </div>
      </div>

      {/* Add New Rule Drawer / Form */}
      {isAdding && (
        <form onSubmit={handleAddRule} className="p-4 rounded-xl bg-slate-900 border border-cyan-500/40 space-y-3">
          <div className="text-xs font-bold text-cyan-300 uppercase tracking-wider">
            Cadastrar Nova Regra Corporativa de CFOP
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-3 text-xs">
            <div>
              <label className="text-slate-400 block mb-1">Código CFOP:</label>
              <input
                type="text"
                placeholder="Ex: 1101"
                value={newRule.cfop}
                onChange={(e) => setNewRule({ ...newRule, cfop: e.target.value })}
                className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-white font-mono"
                required
              />
            </div>

            <div className="md:col-span-2">
              <label className="text-slate-400 block mb-1">Descrição Oficial:</label>
              <input
                type="text"
                placeholder="Ex: Compra para industrialização"
                value={newRule.descricao}
                onChange={(e) => setNewRule({ ...newRule, descricao: e.target.value })}
                className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-white"
                required
              />
            </div>

            <div>
              <label className="text-slate-400 block mb-1">Categoria Operacional:</label>
              <select
                value={newRule.categoria}
                onChange={(e) => setNewRule({ ...newRule, categoria: e.target.value as any })}
                className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-white font-sans"
              >
                <option value="Compra">Compra</option>
                <option value="Devolução">Devolução</option>
                <option value="Transferência">Transferência</option>
                <option value="Remessa">Remessa</option>
                <option value="Outros">Outros</option>
              </select>
            </div>

            <div>
              <label className="text-slate-400 block mb-1">Tratamento Padrão IBS/CBS:</label>
              <select
                value={newRule.tratamentoPadrao}
                onChange={(e) => setNewRule({ ...newRule, tratamentoPadrao: e.target.value as any })}
                className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-white font-sans"
              >
                <option value="Elegível">Elegível</option>
                <option value="Não elegível">Não elegível</option>
                <option value="Depende">Depende de Validação</option>
              </select>
            </div>

            <div className="md:col-span-2">
              <label className="text-slate-400 block mb-1">Evidência Mínima Exigida:</label>
              <input
                type="text"
                placeholder="Ex: Contrato de Fornecimento + NF-e Espelho"
                value={newRule.evidenciaMinima}
                onChange={(e) => setNewRule({ ...newRule, evidenciaMinima: e.target.value })}
                className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-white"
              />
            </div>

            <div className="flex items-center gap-4 pt-4">
              <label className="flex items-center gap-1.5 text-slate-300 font-sans cursor-pointer">
                <input
                  type="checkbox"
                  checked={newRule.exigeOnerosidade}
                  onChange={(e) => setNewRule({ ...newRule, exigeOnerosidade: e.target.checked })}
                  className="rounded border-slate-700"
                />
                Exige Onerosidade?
              </label>

              <label className="flex items-center gap-1.5 text-slate-300 font-sans cursor-pointer">
                <input
                  type="checkbox"
                  checked={newRule.exigeValidaçãoCClassTrib}
                  onChange={(e) => setNewRule({ ...newRule, exigeValidaçãoCClassTrib: e.target.checked })}
                  className="rounded border-slate-700"
                />
                Exige cClassTrib?
              </label>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setIsAdding(false)}
              className="px-3 py-1.5 rounded bg-slate-800 text-slate-300 text-xs font-bold"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-4 py-1.5 rounded bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs"
            >
              Salvar Regra
            </button>
          </div>
        </form>
      )}

      <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-950/80">
        <table className="w-full text-left text-xs border-collapse min-w-[1200px]">
          <thead>
            <tr className="bg-slate-900/90 border-b border-slate-800 text-slate-400 font-semibold uppercase text-[10px] tracking-wider font-mono">
              <th className="p-3">CFOP</th>
              <th className="p-3">Descrição CFOP (Tabela Oficial)</th>
              <th className="p-3">Categoria Operacional</th>
              <th className="p-3 text-center">Tratamento Padrão IBS/CBS</th>
              <th className="p-3 text-center">Exige Onerosidade?</th>
              <th className="p-3 text-center">Exige cClassTrib?</th>
              <th className="p-3">Evidência Mínima Exigida</th>
              <th className="p-3 text-center">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60 font-mono">
            {filtered.map((item) => (
              <tr key={item.cfop} className="hover:bg-slate-900/50 transition-colors">
                
                {/* CFOP */}
                <td className="p-3">
                  <span className="px-2 py-1 bg-cyan-950 text-cyan-300 border border-cyan-800 rounded font-bold text-xs">
                    {item.cfop}
                  </span>
                </td>

                {/* Descrição */}
                <td className="p-3 font-sans font-semibold text-slate-200">
                  {item.descricao}
                </td>

                {/* Categoria */}
                <td className="p-3 font-sans">
                  <span className="px-2 py-0.5 rounded bg-slate-900 text-slate-300 border border-slate-800 text-[11px] font-bold">
                    {item.categoria}
                  </span>
                </td>

                {/* Tratamento Padrão */}
                <td className="p-3 text-center font-sans">
                  {item.tratamentoPadrao === 'Elegível' ? (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-800 text-xs font-bold">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> Elegível
                    </span>
                  ) : item.tratamentoPadrao === 'Não elegível' ? (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-rose-950 text-rose-300 border border-rose-800 text-xs font-bold">
                      <XCircle className="w-3.5 h-3.5 text-rose-400" /> Não Elegível
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-950 text-amber-300 border border-amber-800 text-xs font-bold">
                      <HelpCircle className="w-3.5 h-3.5 text-amber-400" /> Depende
                    </span>
                  )}
                </td>

                {/* Exige Onerosidade */}
                <td className="p-3 text-center font-sans font-bold">
                  {item.exigeOnerosidade ? (
                    <span className="text-emerald-400">SIM</span>
                  ) : (
                    <span className="text-slate-500">NÃO</span>
                  )}
                </td>

                {/* Exige cClassTrib */}
                <td className="p-3 text-center font-sans font-bold">
                  {item.exigeValidaçãoCClassTrib ? (
                    <span className="text-cyan-400">SIM</span>
                  ) : (
                    <span className="text-slate-500">NÃO</span>
                  )}
                </td>

                {/* Evidencia Minima */}
                <td className="p-3 font-sans text-xs text-slate-300">
                  {item.evidenciaMinima}
                </td>

                {/* Ações */}
                <td className="p-3 text-center font-sans">
                  <button
                    onClick={() => handleDeleteRule(item.cfop)}
                    className="p-1 rounded bg-slate-900 hover:bg-rose-950 text-slate-400 hover:text-rose-400 border border-slate-800 transition-all cursor-pointer"
                    title="Excluir Regra"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </td>

              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
