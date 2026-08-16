import React, { useState, useMemo } from 'react';
import {
  FileCheck2,
  AlertOctagon,
  Upload,
  RefreshCw,
  FileSpreadsheet,
  AlertTriangle,
  CheckCircle2,
  DollarSign,
  Building2,
  Layers,
  ArrowRight,
  Filter,
  Search,
  Eye,
  FileText,
  ShieldAlert,
} from 'lucide-react';
import { DfeXmlItem } from '../types';
import {
  parseSpedFiscalTxt,
  cruzarSefazComSped,
  RelatorioCruzamentoSped,
  DivergenciaSpedItem,
} from '../utils/spedCruzamento';
import { exportToExcel } from '../utils/excel';

interface SpedCruzamentoPanelProps {
  dfeList: DfeXmlItem[];
}

export const SpedCruzamentoPanel: React.FC<SpedCruzamentoPanelProps> = ({ dfeList }) => {
  const [spedFileContent, setSpedFileContent] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<'todas' | 'omissoes' | 'valores' | 'participantes'>('todas');
  const [searchTerm, setSearchTerm] = useState<string>('');

  // Se nenhum arquivo foi carregado ainda, cria um SPED base de exemplo a partir dos DF-e para demonstração inicial
  const resultadoCruzamento: RelatorioCruzamentoSped | null = useMemo(() => {
    if (!spedFileContent) {
      // Se não houver arquivo carregado, cria cruzamento com lista de DF-e existente
      const sampleSpedText = `|0000|017|0|01082026|31082026|EMPRESA MATRIZ FISCAL LTDA|05791622002061|SP|128661585|3550308|||A|0|
|0005|MATRIZ FISCAL|01310100|AVENIDA PAULISTA|1000|CONJ 501|BELA VISTA|1132000000||fiscal@empresa.com.br|
|0100|CONTADOR RESPONSAVEL|12345678900|SP-123456/O-0|00123456000199|01310100|AV PAULISTA|1000||BELA VISTA|1132000000||contabil@auditoria.com.br|3550308|
${dfeList.slice(0, Math.max(1, Math.floor(dfeList.length / 2))).map((d, i) =>
  `|0150|FORN-${i+1}|${d.emitenteNome}|1058|${d.emitenteCnpj.replace(/\D/g, '')}|${d.emitenteIe || ''}|3550308||||
|C100|0|1|FORN-${i+1}|55|00|1|${d.numero}|${d.chaveAcesso}|01082026|02082026|${d.valorTotal.toFixed(2)}|1|0|0|${d.valorTotal.toFixed(2)}|000|0|0|0|0|${d.valorIcms.toFixed(2)}|0|0|0|0|${d.valorPis.toFixed(2)}|${d.valorCofins.toFixed(2)}|0|0|`
).join('\n')}`;
      
      const parsed = parseSpedFiscalTxt(sampleSpedText);
      return cruzarSefazComSped(dfeList, parsed);
    }

    try {
      const parsed = parseSpedFiscalTxt(spedFileContent);
      return cruzarSefazComSped(dfeList, parsed);
    } catch {
      return null;
    }
  }, [spedFileContent, dfeList]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    setIsProcessing(true);

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      setSpedFileContent(content);
      setIsProcessing(false);
    };
    reader.readAsText(file, 'ISO-8859-1');
  };

  const divergenciasFiltradas = useMemo(() => {
    if (!resultadoCruzamento) return [];
    return resultadoCruzamento.divergencias.filter((d) => {
      const matchTab =
        activeTab === 'todas' ||
        (activeTab === 'omissoes' && d.tipoDivergencia === 'OMISSAO_SEFAZ_NAO_NO_SPED') ||
        (activeTab === 'valores' && d.tipoDivergencia === 'DIVERGENCIA_VALOR') ||
        (activeTab === 'participantes' && d.tipoDivergencia === 'PARTICIPANTE_NAO_CADASTRADO');

      const matchSearch =
        d.chaveAcesso.includes(searchTerm) ||
        d.numero.includes(searchTerm) ||
        d.fornecedorNome.toLowerCase().includes(searchTerm.toLowerCase()) ||
        d.fornecedorCnpj.includes(searchTerm);

      return matchTab && matchSearch;
    });
  }, [resultadoCruzamento, activeTab, searchTerm]);

  const handleExportRelatorio = () => {
    if (!resultadoCruzamento) return;

    const dataExcel = resultadoCruzamento.divergencias.map((d) => ({
      'Tipo de Apontamento': d.tipoDivergencia,
      'Gravidade / Risco': d.gravidade,
      'Chave de Acesso': d.chaveAcesso,
      'Número': d.numero,
      'Data Emissão': d.dataEmissao,
      'CNPJ Fornecedor': d.fornecedorCnpj,
      'Razão Social': d.fornecedorNome,
      'Valor SEFAZ (R$)': d.valorSefaz,
      'Valor SPED (R$)': d.valorSped,
      'Diferença (R$)': d.diferenca,
      'Descrição': d.descricao,
      'Recomendação': d.recomendacao,
    }));

    exportToExcel(dataExcel, `CRUZAMENTO_SPED_SEFAZ_${new Date().toISOString().split('T')[0]}`);
  };

  return (
    <div className="space-y-6">
      {/* HEADER & UPLOAD SECTION */}
      <div className="p-5 rounded-3xl bg-slate-900 border border-slate-800 shadow-xl flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-600 to-purple-600 flex items-center justify-center text-white shadow-lg shadow-indigo-500/20">
            <FileCheck2 className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-extrabold text-white">
                Cruzamento Automatizado SPED Fiscal x SEFAZ
              </h2>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold font-mono bg-indigo-950 text-indigo-300 border border-indigo-800">
                AUDIT C100 / 0150
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Auditoria de Omissão de Entradas, divergências de valores e conciliação de participantes.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 w-full lg:w-auto">
          <label className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold flex items-center gap-2 shadow-md cursor-pointer transition-all">
            <Upload className="w-4 h-4" />
            <span>{fileName ? `Arquivo: ${fileName}` : 'Carregar TXT do SPED (EFD)'}</span>
            <input
              type="file"
              accept=".txt"
              onChange={handleFileUpload}
              className="hidden"
            />
          </label>

          <button
            type="button"
            onClick={handleExportRelatorio}
            disabled={!resultadoCruzamento || resultadoCruzamento.divergencias.length === 0}
            className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-bold flex items-center gap-1.5 shadow-md cursor-pointer transition-all"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>Exportar Divergências (Excel)</span>
          </button>
        </div>
      </div>

      {resultadoCruzamento && (
        <>
          {/* SUMMARY CARDS */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Card 1: Notas Conciliadas */}
            <div className="p-5 rounded-3xl bg-slate-900 border border-slate-800 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-slate-400 uppercase">Notas Conciliadas</span>
                <div className="w-8 h-8 rounded-xl bg-emerald-950 border border-emerald-800 flex items-center justify-center text-emerald-400">
                  <CheckCircle2 className="w-4 h-4" />
                </div>
              </div>
              <div className="text-2xl font-extrabold font-mono text-emerald-400">
                {resultadoCruzamento.totalNotasConciliadas} / {resultadoCruzamento.totalNotasSefaz}
              </div>
              <div className="text-[11px] text-slate-400">
                Presentes tanto na SEFAZ quanto no SPED
              </div>
            </div>

            {/* Card 2: Omissões de Entrada (CRÍTICO) */}
            <div className="p-5 rounded-3xl bg-slate-900 border border-red-900/60 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-red-400 uppercase">Omissões de Entrada</span>
                <div className="w-8 h-8 rounded-xl bg-red-950 border border-red-800 flex items-center justify-center text-red-400">
                  <AlertOctagon className="w-4 h-4" />
                </div>
              </div>
              <div className="text-2xl font-extrabold font-mono text-red-400">
                {resultadoCruzamento.totalOmissoesEntrada}
              </div>
              <div className="text-[11px] text-red-300 font-bold">
                Valor Omitido: R$ {resultadoCruzamento.valorTotalOmitido.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </div>
            </div>

            {/* Card 3: Divergências de Valores */}
            <div className="p-5 rounded-3xl bg-slate-900 border border-slate-800 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-slate-400 uppercase">Divergências de Valor</span>
                <div className="w-8 h-8 rounded-xl bg-amber-950 border border-amber-800 flex items-center justify-center text-amber-400">
                  <AlertTriangle className="w-4 h-4" />
                </div>
              </div>
              <div className="text-2xl font-extrabold font-mono text-amber-400">
                {resultadoCruzamento.totalDivergenciasValor}
              </div>
              <div className="text-[11px] text-slate-400">
                Diferença entre SEFAZ e C100 escriturado
              </div>
            </div>

            {/* Card 4: Participantes Faltantes (0150) */}
            <div className="p-5 rounded-3xl bg-slate-900 border border-slate-800 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-slate-400 uppercase">Falta no Reg. 0150</span>
                <div className="w-8 h-8 rounded-xl bg-purple-950 border border-purple-800 flex items-center justify-center text-purple-400">
                  <Building2 className="w-4 h-4" />
                </div>
              </div>
              <div className="text-2xl font-extrabold font-mono text-purple-300">
                {resultadoCruzamento.totalParticipantesFaltantes}
              </div>
              <div className="text-[11px] text-slate-400">
                Fornecedores ausentes na tabela de participantes
              </div>
            </div>
          </div>

          {/* TABLE OF DIVERGENCES */}
          <div className="p-6 rounded-3xl bg-slate-900/90 border border-slate-800 shadow-xl space-y-4">
            {/* Filter Tabs & Search */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
              <div className="flex flex-wrap items-center gap-2">
                {[
                  { id: 'todas', label: `Todos os Apontamentos (${resultadoCruzamento.divergencias.length})` },
                  { id: 'omissoes', label: `Omissões C100 (${resultadoCruzamento.totalOmissoesEntrada})` },
                  { id: 'valores', label: `Divergência Valores (${resultadoCruzamento.totalDivergenciasValor})` },
                  { id: 'participantes', label: `Participantes 0150 (${resultadoCruzamento.totalParticipantesFaltantes})` },
                ].map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setActiveTab(t.id as any)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                      activeTab === t.id
                        ? 'bg-indigo-600 text-white shadow-md'
                        : 'bg-slate-950 text-slate-400 hover:text-slate-200 border border-slate-800'
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>

              <div className="relative w-full sm:w-64">
                <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder="Buscar por chave, número ou CNPJ..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
                />
              </div>
            </div>

            {/* Table */}
            <div className="overflow-x-auto custom-scrollbar">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400 font-bold bg-slate-950/40">
                    <th className="p-3">Gravidade</th>
                    <th className="p-3">Tipo de Inconsistência</th>
                    <th className="p-3">NF-e / Chave</th>
                    <th className="p-3">Fornecedor</th>
                    <th className="p-3 text-right">Valor SEFAZ</th>
                    <th className="p-3 text-right">Valor SPED</th>
                    <th className="p-3">Recomendação Fiscal</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {divergenciasFiltradas.length > 0 ? (
                    divergenciasFiltradas.map((d) => (
                      <tr key={d.id} className="hover:bg-slate-800/40 transition-colors">
                        <td className="p-3">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              d.gravidade === 'CRITICO'
                                ? 'bg-red-950 text-red-400 border border-red-800'
                                : d.gravidade === 'ALERTA'
                                ? 'bg-amber-950 text-amber-400 border border-amber-800'
                                : 'bg-blue-950 text-blue-400 border border-blue-800'
                            }`}
                          >
                            {d.gravidade}
                          </span>
                        </td>
                        <td className="p-3 font-semibold text-slate-200">
                          {d.descricao}
                        </td>
                        <td className="p-3">
                          <div className="font-bold text-white">NF-e {d.numero}</div>
                          <div className="font-mono text-[10px] text-slate-500">
                            {d.chaveAcesso ? `${d.chaveAcesso.substring(0, 20)}...` : '-'}
                          </div>
                        </td>
                        <td className="p-3">
                          <div className="font-bold text-slate-200 truncate max-w-[180px]">{d.fornecedorNome}</div>
                          <div className="font-mono text-[10px] text-slate-500">{d.fornecedorCnpj}</div>
                        </td>
                        <td className="p-3 text-right font-mono font-bold text-cyan-400">
                          R$ {d.valorSefaz.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </td>
                        <td className="p-3 text-right font-mono font-bold text-slate-400">
                          R$ {d.valorSped.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </td>
                        <td className="p-3 text-[11px] text-slate-400 max-w-[240px]">
                          {d.recomendacao}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={7} className="p-8 text-center text-slate-500">
                        Nenhuma divergência encontrada para este filtro.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
