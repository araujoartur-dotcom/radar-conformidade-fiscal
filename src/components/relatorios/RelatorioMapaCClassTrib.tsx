import React, { useState, useEffect } from 'react';
import { MapaCClassTribItem } from '../../types';
import { Tag, Plus, CheckCircle2, XCircle, HelpCircle, AlertTriangle, Trash2, RefreshCw } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { getApiBaseUrl } from '../../utils/apiConfig';

export const RelatorioMapaCClassTrib: React.FC = () => {
  const { token, config } = useAuth();
  const [mapaList, setMapaList] = useState<MapaCClassTribItem[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [loading, setLoading] = useState(false);

  const [newItem, setNewItem] = useState<MapaCClassTribItem>({
    cClassTrib: '',
    descricaoInterna: '',
    tratamentoEsperado: 'tributado',
    permiteCredito: 'Sim',
    aliquotaEsperada: '26.5%',
    alertas: 'Conferir enquadramento tributário'
  });

  const fetchMapaList = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${getApiBaseUrl()}/tables/cclasstrib`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        const items = data.data.map((item: any) => ({
          cClassTrib: item.cclasstrib,
          descricaoInterna: item.descricao_interna,
          tratamentoEsperado: item.tratamento_esperado,
          permiteCredito: item.permite_credito,
          aliquotaEsperada: item.aliquota_esperada || '',
          alertas: item.alertas || ''
        }));
        setMapaList(items);
      }
    } catch (err) {
      console.error('Erro ao buscar cClassTrib', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMapaList();
  }, [token, config]);

  const filtered = mapaList.filter(item => 
    item.cClassTrib.includes(searchTerm) || 
    item.descricaoInterna.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleAddItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newItem.cClassTrib || !newItem.descricaoInterna) return;

    try {
      const response = await fetch(`${getApiBaseUrl()}/tables/cclasstrib`, {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          cclasstrib: newItem.cClassTrib,
          descricao_interna: newItem.descricaoInterna,
          tratamento_esperado: newItem.tratamentoEsperado,
          permite_credito: newItem.permiteCredito,
          aliquota_esperada: newItem.aliquotaEsperada,
          alertas: newItem.alertas,
          global: false
        })
      });

      if (response.ok) {
        await fetchMapaList();
        setNewItem({
          cClassTrib: '',
          descricaoInterna: '',
          tratamentoEsperado: 'tributado',
          permiteCredito: 'Sim',
          aliquotaEsperada: '26.5%',
          alertas: 'Conferir enquadramento tributário'
        });
        setIsAdding(false);
      } else {
        alert('Erro ao adicionar regra cClassTrib');
      }
    } catch (err) {
      console.error(err);
      alert('Erro ao adicionar regra cClassTrib');
    }
  };

  const handleDeleteItem = async (code: string) => {
    try {
      const res = await fetch(`${getApiBaseUrl()}/tables/cclasstrib`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      const itemToDelete = data.data.find((item: any) => item.cclasstrib === code);
      
      if (itemToDelete) {
        await fetch(`${getApiBaseUrl()}/tables/cclasstrib?id=${itemToDelete.id}`, {
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
            <Tag className="w-4 h-4 text-amber-400" />
            7) Relatório “Mapa cClassTrib x Alíquota/Base/Regra” (Interpretação da Classificação Tributária)
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Padronização corporativa da interpretação da tag <span className="font-mono text-cyan-300">&lt;cClassTrib&gt;</span> exigida na Reforma Tributária para apuração de IBS/CBS.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {loading && <RefreshCw className="w-4 h-4 text-amber-400 animate-spin" />}
          <input
            type="text"
            placeholder="Buscar cClassTrib..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 font-mono"
          />

          <button
            onClick={() => setIsAdding(!isAdding)}
            className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Adicionar cClassTrib</span>
          </button>
        </div>
      </div>

      {isAdding && (
        <form onSubmit={handleAddItem} className="p-4 rounded-xl bg-slate-900 border border-amber-500/40 space-y-3">
          <div className="text-xs font-bold text-amber-300 uppercase tracking-wider">
            Cadastrar Novo Enquadramento cClassTrib
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-3 text-xs">
            <div>
              <label className="text-slate-400 block mb-1">Código cClassTrib:</label>
              <input
                type="text"
                placeholder="Ex: 0002"
                value={newItem.cClassTrib}
                onChange={(e) => setNewItem({ ...newItem, cClassTrib: e.target.value })}
                className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-white font-mono"
                required
              />
            </div>

            <div className="md:col-span-2">
              <label className="text-slate-400 block mb-1">Descrição Interna:</label>
              <input
                type="text"
                placeholder="Ex: Alíquota reduzida de educação"
                value={newItem.descricaoInterna}
                onChange={(e) => setNewItem({ ...newItem, descricaoInterna: e.target.value })}
                className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-white"
                required
              />
            </div>

            <div>
              <label className="text-slate-400 block mb-1">Tratamento Esperado:</label>
              <select
                value={newItem.tratamentoEsperado}
                onChange={(e) => setNewItem({ ...newItem, tratamentoEsperado: e.target.value as any })}
                className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-white font-sans"
              >
                <option value="tributado">Tributado Integral</option>
                <option value="aliquota_reduzida">Alíquota Reduzida</option>
                <option value="isento">Isento / Imune</option>
                <option value="nao_incidencia">Não Incidência</option>
                <option value="monofasico">Monofásico / Específico</option>
              </select>
            </div>

            <div>
              <label className="text-slate-400 block mb-1">Permite Crédito?</label>
              <select
                value={newItem.permiteCredito}
                onChange={(e) => setNewItem({ ...newItem, permiteCredito: e.target.value as any })}
                className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-white font-sans"
              >
                <option value="Sim">Sim</option>
                <option value="Não">Não</option>
                <option value="Parcial">Parcial</option>
                <option value="Depende">Depende de Regra</option>
              </select>
            </div>

            <div>
              <label className="text-slate-400 block mb-1">Alíquota Esperada:</label>
              <input
                type="text"
                placeholder="Ex: 10.6% ou Origem no Doc"
                value={newItem.aliquotaEsperada}
                onChange={(e) => setNewItem({ ...newItem, aliquotaEsperada: e.target.value })}
                className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-white font-mono"
              />
            </div>

            <div className="md:col-span-2">
              <label className="text-slate-400 block mb-1">Alertas & Restrições:</label>
              <input
                type="text"
                placeholder="Ex: Se CFOP for remessa, bloquear crédito"
                value={newItem.alertas}
                onChange={(e) => setNewItem({ ...newItem, alertas: e.target.value })}
                className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-white"
              />
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
              Salvar cClassTrib
            </button>
          </div>
        </form>
      )}

      <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-950/80">
        <table className="w-full text-left text-xs border-collapse min-w-[1200px]">
          <thead>
            <tr className="bg-slate-900/90 border-b border-slate-800 text-slate-400 font-semibold uppercase text-[10px] tracking-wider font-mono">
              <th className="p-3">cClassTrib</th>
              <th className="p-3">Descrição Interna (Curta e Objetiva)</th>
              <th className="p-3">Tratamento Esperado</th>
              <th className="p-3 text-center">Permite Crédito?</th>
              <th className="p-3">Alíquota Esperada</th>
              <th className="p-3">Alertas & Regras Específicas</th>
              <th className="p-3 text-center">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60 font-mono">
            {filtered.map((item) => (
              <tr key={item.cClassTrib} className="hover:bg-slate-900/50 transition-colors">
                
                {/* Code */}
                <td className="p-3">
                  <span className="px-2 py-1 bg-amber-950 text-amber-300 border border-amber-800 rounded font-bold text-xs">
                    {item.cClassTrib}
                  </span>
                </td>

                {/* Descricao */}
                <td className="p-3 font-sans font-semibold text-slate-200">
                  {item.descricaoInterna}
                </td>

                {/* Tratamento */}
                <td className="p-3 font-sans">
                  <span className="capitalize px-2 py-0.5 rounded bg-slate-900 text-slate-300 border border-slate-800 text-[11px] font-bold">
                    {item.tratamentoEsperado.replace('_', ' ')}
                  </span>
                </td>

                {/* Permite Crédito */}
                <td className="p-3 text-center font-sans">
                  {item.permiteCredito === 'Sim' ? (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-800 text-xs font-bold">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> Sim
                    </span>
                  ) : item.permiteCredito === 'Não' ? (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-rose-950 text-rose-300 border border-rose-800 text-xs font-bold">
                      <XCircle className="w-3.5 h-3.5 text-rose-400" /> Não
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-950 text-amber-300 border border-amber-800 text-xs font-bold">
                      <HelpCircle className="w-3.5 h-3.5 text-amber-400" /> {item.permiteCredito}
                    </span>
                  )}
                </td>

                {/* Aliquota */}
                <td className="p-3 text-cyan-300 font-bold">
                  {item.aliquotaEsperada}
                </td>

                {/* Alertas */}
                <td className="p-3 font-sans text-xs text-amber-300 flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                  <span>{item.alertas}</span>
                </td>

                {/* Ações */}
                <td className="p-3 text-center font-sans">
                  <button
                    onClick={() => handleDeleteItem(item.cClassTrib)}
                    className="p-1 rounded bg-slate-900 hover:bg-rose-950 text-slate-400 hover:text-rose-400 border border-slate-800 transition-all cursor-pointer"
                    title="Excluir"
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
