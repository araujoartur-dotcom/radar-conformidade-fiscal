import React, { useState } from 'react';
import { Search, Filter, Download, ExternalLink, ArrowUpDown, CheckCircle, AlertCircle, Clock, Eye, Copy, RefreshCw } from 'lucide-react';
import { CnpjLookupItem } from '../types';
import { exportToExcel, exportToCSV, exportToJSON } from '../utils/excel';

interface ResultadosTableProps {
  items: CnpjLookupItem[];
  onSelectItem: (item: CnpjLookupItem) => void;
  onRefreshItem: (id: string) => void;
}

export const ResultadosTable: React.FC<ResultadosTableProps> = ({
  items,
  onSelectItem,
  onRefreshItem,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('todos');
  const [sortField, setSortField] = useState<keyof CnpjLookupItem>('cnpj');
  const [sortAsc, setSortAsc] = useState<boolean>(true);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Filtering
  const filtered = items.filter(item => {
    const matchesSearch =
      (item.cnpj && item.cnpj.includes(searchTerm)) ||
      (item.razaoSocial && item.razaoSocial.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (item.ie && item.ie.includes(searchTerm)) ||
      (item.uf && item.uf.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (item.cnaePrincipal && item.cnaePrincipal.includes(searchTerm));

    if (statusFilter === 'todos') return matchesSearch;
    if (statusFilter === 'habilitado') return matchesSearch && item.situaçaoIE === 'Habilitado';
    if (statusFilter === 'ativa') return matchesSearch && item.situaçaoCNPJ === 'ATIVA';
    if (statusFilter === 'inapta') return matchesSearch && (item.situaçaoCNPJ === 'INAPTA' || item.situaçaoIE === 'Não Habilitado');
    if (statusFilter === 'pendente') return matchesSearch && item.statusConsulta === 'pendente';
    return matchesSearch;
  });

  // Sorting
  const sorted = [...filtered].sort((a, b) => {
    const valA = String(a[sortField] || '');
    const valB = String(b[sortField] || '');
    return sortAsc ? valA.localeCompare(valB) : valB.localeCompare(valA);
  });

  const toggleSort = (field: keyof CnpjLookupItem) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(true);
    }
  };

  const copyToClipboard = (text: string, id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1500);
  };

  return (
    <div className="glass-panel-glow rounded-2xl p-4 flex flex-col gap-3 shadow-2xl">
      {/* Table Header Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-2 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <div className="relative flex-1 md:w-72">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Filtrar por CNPJ, Razão Social, IE..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700/80 rounded-xl pl-9 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 font-mono"
            />
          </div>

          <div className="flex items-center gap-1.5">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-slate-900 border border-slate-700/80 rounded-xl px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-cyan-500 cursor-pointer"
            >
              <option value="todos">Todos os Status ({items.length})</option>
              <option value="ativa">Situação CNPJ ATIVA</option>
              <option value="habilitado">IE Habilitada (CCC)</option>
              <option value="inapta">Inapta / Irregular</option>
              <option value="pendente">Pendentes</option>
            </select>
          </div>
        </div>

        {/* Quick Export Actions */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-400 font-mono font-medium">
            Exibindo <strong className="text-cyan-400">{sorted.length}</strong> de {items.length}
          </span>

          <button
            onClick={() => exportToExcel(items)}
            disabled={items.length === 0}
            className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-emerald-950 hover:bg-emerald-900 text-emerald-300 text-xs font-bold border border-emerald-800/80 transition-all cursor-pointer disabled:opacity-40"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Excel (.xlsx)</span>
          </button>

          <button
            onClick={() => exportToCSV(items)}
            disabled={items.length === 0}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold border border-slate-700 transition-all cursor-pointer disabled:opacity-40"
          >
            <span>CSV</span>
          </button>

          <button
            onClick={() => exportToJSON(items)}
            disabled={items.length === 0}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold border border-slate-700 transition-all cursor-pointer disabled:opacity-40"
          >
            <span>JSON</span>
          </button>
        </div>
      </div>

      {/* Main Responsive Data Table Container */}
      <div className="overflow-x-auto max-h-[460px] overflow-y-auto rounded-xl border border-slate-800/90 bg-slate-950/60">
        <table className="w-full text-left border-collapse text-xs">
          <thead className="bg-[#0e1626] text-slate-300 font-semibold sticky top-0 z-10 border-b border-slate-800">
            <tr>
              <th className="p-2.5 font-mono cursor-pointer hover:text-cyan-300" onClick={() => toggleSort('cnpj')}>
                <div className="flex items-center gap-1">CNPJ <ArrowUpDown className="w-3 h-3 text-slate-500" /></div>
              </th>
              <th className="p-2.5 font-mono cursor-pointer hover:text-cyan-300" onClick={() => toggleSort('uf')}>
                <div className="flex items-center gap-1">UF <ArrowUpDown className="w-3 h-3 text-slate-500" /></div>
              </th>
              <th className="p-2.5 font-mono cursor-pointer hover:text-cyan-300" onClick={() => toggleSort('ie')}>
                <div className="flex items-center gap-1">IE <ArrowUpDown className="w-3 h-3 text-slate-500" /></div>
              </th>
              <th className="p-2.5 font-mono">Tipo IE</th>
              <th className="p-2.5 font-mono cursor-pointer hover:text-cyan-300" onClick={() => toggleSort('situaçaoIE')}>
                <div className="flex items-center gap-1">Situação IE <ArrowUpDown className="w-3 h-3 text-slate-500" /></div>
              </th>
              <th className="p-2.5 font-mono cursor-pointer hover:text-cyan-300" onClick={() => toggleSort('situaçaoCNPJ')}>
                <div className="flex items-center gap-1">Situação CNPJ <ArrowUpDown className="w-3 h-3 text-slate-500" /></div>
              </th>
              <th className="p-2.5 font-mono">Natureza Jurídica</th>
              <th className="p-2.5 font-mono cursor-pointer hover:text-cyan-300" onClick={() => toggleSort('razaoSocial')}>
                <div className="flex items-center gap-1">Razão Social <ArrowUpDown className="w-3 h-3 text-slate-500" /></div>
              </th>
              <th className="p-2.5 font-mono">Nome Fantasia</th>
              <th className="p-2.5 font-mono">CNAE Princ.</th>
              <th className="p-2.5 font-mono text-center">Ações</th>
            </tr>
          </thead>

          <tbody className="divide-y divide-slate-800/60 font-medium">
            {sorted.length === 0 ? (
              <tr>
                <td colSpan={11} className="py-12 text-center text-slate-500 font-mono">
                  {items.length === 0 ? 'Nenhum CNPJ carregado. Importe uma planilha Excel ou adicione na aba Avulsa.' : 'Nenhum resultado corresponde ao filtro pesquisado.'}
                </td>
              </tr>
            ) : (
              sorted.map((item) => {
                const isSuccess = item.statusConsulta === 'sucesso';
                const isError = item.statusConsulta === 'erro';
                const isPending = item.statusConsulta === 'pendente';
                const isProcessing = item.statusConsulta === 'processando';

                return (
                  <tr
                    key={item.id}
                    onClick={() => isSuccess && onSelectItem(item)}
                    className="hover:bg-slate-900/90 transition-colors cursor-pointer group text-slate-200"
                  >
                    {/* CNPJ */}
                    <td className="p-2.5 font-mono text-cyan-300 font-bold whitespace-nowrap">
                      <div className="flex items-center gap-1.5">
                        <span>{item.cnpj}</span>
                        <button
                          onClick={(e) => copyToClipboard(item.cnpj, item.id, e)}
                          className="opacity-0 group-hover:opacity-100 p-1 hover:text-white transition-opacity"
                          title="Copiar CNPJ"
                        >
                          <Copy className="w-3 h-3" />
                        </button>
                      </div>
                    </td>

                    {/* UF */}
                    <td className="p-2.5 font-mono text-slate-300 font-bold whitespace-nowrap">
                      <span className="px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700 text-[11px]">
                        {item.uf}
                      </span>
                    </td>

                    {/* IE */}
                    <td className="p-2.5 font-mono text-slate-200 whitespace-nowrap">
                      {item.ie || '-'}
                    </td>

                    {/* Tipo IE */}
                    <td className="p-2.5 text-slate-400 whitespace-nowrap text-[11px]">
                      {item.tipoIE || '-'}
                    </td>

                    {/* Situação IE */}
                    <td className="p-2.5 whitespace-nowrap">
                      {item.situaçaoIE === 'Habilitado' ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-950/80 text-emerald-400 border border-emerald-800">
                          <CheckCircle className="w-3 h-3" /> Habilitado
                        </span>
                      ) : item.situaçaoIE === 'Não Habilitado' ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-950/80 text-rose-400 border border-rose-800">
                          <AlertCircle className="w-3 h-3" /> Não Habilitado
                        </span>
                      ) : item.situaçaoIE === 'Isento' ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-950/80 text-blue-300 border border-blue-800">
                          Isento
                        </span>
                      ) : item.situaçaoIE === 'Não Contribuinte' ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-950/80 text-purple-300 border border-purple-800">
                          Não Contribuinte
                        </span>
                      ) : (
                        <span className="text-slate-500 font-mono">-</span>
                      )}
                    </td>

                    {/* Situação CNPJ */}
                    <td className="p-2.5 whitespace-nowrap">
                      {item.situaçaoCNPJ === 'ATIVA' ? (
                        <span className="font-bold text-emerald-400 text-[11px]">ATIVA</span>
                      ) : item.situaçaoCNPJ === 'INAPTA' ? (
                        <span className="font-bold text-rose-400 text-[11px]">INAPTA</span>
                      ) : item.situaçaoCNPJ === 'SUSPENSA' ? (
                        <span className="font-bold text-amber-400 text-[11px]">SUSPENSA</span>
                      ) : isPending ? (
                        <span className="text-slate-400 text-[11px] font-mono flex items-center gap-1">
                          <Clock className="w-3 h-3 text-slate-500" /> Pendente
                        </span>
                      ) : isProcessing ? (
                        <span className="text-cyan-400 text-[11px] font-mono animate-pulse flex items-center gap-1">
                          <RefreshCw className="w-3 h-3 animate-spin" /> Buscando...
                        </span>
                      ) : (
                        <span className="text-slate-500 font-mono">-</span>
                      )}
                    </td>

                    {/* Natureza Jurídica */}
                    <td className="p-2.5 text-slate-300 truncate max-w-[140px]" title={item.naturezaJuridica}>
                      {item.naturezaJuridica || '-'}
                    </td>

                    {/* Razão Social */}
                    <td className="p-2.5 font-bold text-white truncate max-w-[200px]" title={item.razaoSocial}>
                      {item.razaoSocial || (isError ? <span className="text-rose-400 font-normal">Erro na consulta</span> : '-')}
                    </td>

                    {/* Nome Fantasia */}
                    <td className="p-2.5 text-slate-400 truncate max-w-[150px]" title={item.nomeFantasia}>
                      {item.nomeFantasia || '-'}
                    </td>

                    {/* CNAE Principal */}
                    <td className="p-2.5 font-mono text-slate-300 text-[11px] whitespace-nowrap" title={item.cnaeDescricao}>
                      {item.cnaePrincipal || '-'}
                    </td>

                    {/* Actions */}
                    <td className="p-2.5 text-center whitespace-nowrap">
                      <div className="flex items-center justify-center gap-1">
                        {isSuccess && (
                          <button
                            onClick={(e) => { e.stopPropagation(); onSelectItem(item); }}
                            className="p-1.5 rounded-lg bg-slate-800 hover:bg-cyan-950 text-cyan-400 border border-slate-700 transition-colors"
                            title="Ver Ficha Cadastral Completa"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                        )}
                        <button
                          onClick={(e) => { e.stopPropagation(); onRefreshItem(item.id); }}
                          className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-colors"
                          title="Reconsultar"
                        >
                          <RefreshCw className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
