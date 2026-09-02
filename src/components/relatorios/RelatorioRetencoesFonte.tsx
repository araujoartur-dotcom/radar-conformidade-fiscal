import React, { useState } from 'react';
import { XmlItemDetailReport } from '../../types';
import { 
  Receipt, ShieldCheck, AlertTriangle, CheckCircle2, 
  HelpCircle, Building2, MapPin, DollarSign, Scale, 
  Search, Filter, ArrowUpRight, FileSpreadsheet, Eye, Info
} from 'lucide-react';

interface RelatorioRetencoesFonteProps {
  items: XmlItemDetailReport[];
  onOpenDetail?: (item: XmlItemDetailReport) => void;
}

export const RelatorioRetencoesFonte: React.FC<RelatorioRetencoesFonteProps> = ({ items, onOpenDetail }) => {
  const [selectedFilter, setSelectedFilter] = useState<'todos' | 'com_retencao' | 'apenas_divergencias' | 'irrf' | 'crf' | 'inss' | 'iss'>('todos');
  const [searchTerm, setSearchTerm] = useState('');
  const [modalItem, setModalItem] = useState<XmlItemDetailReport | null>(null);

  // Considerar todos os itens que sejam NFS-e ou que possuam retenções
  const servicoItems = items.filter(it => 
    it.tipoDoc === 'NFS-e' || 
    (it.totalRetencoes && it.totalRetencoes > 0) || 
    it.cfop === '1933' || 
    it.cfop === '2933' ||
    it.tipoAquisicao === 'servico' ||
    (it.descricaoItem && it.descricaoItem.toLowerCase().includes('serviço'))
  );

  // Fallback: se não houver registros categorizados como serviço mas houver registros em geral, mostrar todos para auditoria
  const dataset = servicoItems.length > 0 ? servicoItems : items;

  // Filtragem
  const filteredDataset = dataset.filter(it => {
    // Termo de busca
    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      const matchKey = it.chaveAcesso.toLowerCase().includes(q);
      const matchForn = it.fornecedorRazao.toLowerCase().includes(q) || it.fornecedorCnpj.includes(q);
      const matchDesc = (it.discriminacaoServico || it.descricaoItem || '').toLowerCase().includes(q);
      const matchNum = it.numeroSerie.toLowerCase().includes(q);
      const matchCod = (it.codigoServicoLc116 || '').toLowerCase().includes(q);
      if (!matchKey && !matchForn && !matchDesc && !matchNum && !matchCod) return false;
    }

    // Filtros Rápidos
    const totalRet = it.totalRetencoes || (
      (it.valorIrrf || 0) + (it.valorInss || 0) + (it.valorIssRetido || 0) + 
      (it.valorCsllRetido || 0) + (it.valorPisRetido || 0) + (it.valorCofinsRetido || 0)
    );

    if (selectedFilter === 'com_retencao') return totalRet > 0;
    if (selectedFilter === 'apenas_divergencias') return it.diagnosticoRetencao === 'DIVERGENCIA_ALIQUOTA' || it.diagnosticoRetencao === 'FALTA_RETENCAO';
    if (selectedFilter === 'irrf') return (it.valorIrrf || 0) > 0;
    if (selectedFilter === 'crf') return ((it.valorCsllRetido || 0) + (it.valorPisRetido || 0) + (it.valorCofinsRetido || 0)) > 0;
    if (selectedFilter === 'inss') return (it.valorInss || 0) > 0;
    if (selectedFilter === 'iss') return (it.valorIssRetido || 0) > 0;

    return true;
  });

  // KPIs e Totalizadores
  const totalValorBruto = filteredDataset.reduce((acc, it) => acc + (it.valorBrutoItem || it.valorLiquidoItem || 0), 0);
  const totalIrrf = filteredDataset.reduce((acc, it) => acc + (it.valorIrrf || 0), 0);
  const totalPis = filteredDataset.reduce((acc, it) => acc + (it.valorPisRetido || 0), 0);
  const totalCofins = filteredDataset.reduce((acc, it) => acc + (it.valorCofinsRetido || 0), 0);
  const totalCsll = filteredDataset.reduce((acc, it) => acc + (it.valorCsllRetido || 0), 0);
  const totalCrf = totalPis + totalCofins + totalCsll;
  const totalInss = filteredDataset.reduce((acc, it) => acc + (it.valorInss || 0), 0);
  const totalIss = filteredDataset.reduce((acc, it) => acc + (it.valorIssRetido || 0), 0);
  const totalRetencoesGeral = totalIrrf + totalCrf + totalInss + totalIss;
  const totalValorLiquido = Math.max(0, totalValorBruto - totalRetencoesGeral);
  const totalDivergencias = filteredDataset.filter(it => it.diagnosticoRetencao === 'DIVERGENCIA_ALIQUOTA' || it.diagnosticoRetencao === 'FALTA_RETENCAO').length;

  return (
    <div className="space-y-4">
      {/* Top Banner de Governança e Legislação */}
      <div className="p-5 rounded-2xl bg-gradient-to-r from-slate-900 via-slate-900 to-indigo-950/60 border border-slate-800 shadow-xl">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-500/20 text-amber-300 border border-amber-500/30">
                Relatório #9 • NFS-e & Serviços
              </span>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                Cruzamento Matriz Fiscal
              </span>
            </div>
            <h3 className="text-base font-bold text-white mt-1.5 flex items-center gap-2">
              <Receipt className="w-5 h-5 text-amber-400" />
              9) Relatório “Retenções na Fonte em Serviços (NFS-e)” — Auditoria de Conformidade
            </h3>
            <p className="text-xs text-slate-400 mt-1 max-w-4xl">
              Auditoria e conciliação das retenções federais (<strong className="text-slate-300">IRRF DARF 1708</strong>, <strong className="text-slate-300">CRF/PCC 4,65% DARF 5952</strong>), previdenciárias (<strong className="text-slate-300">INSS 11% DCTFWeb</strong>) e municipais (<strong className="text-slate-300">ISSQN Retido</strong>) confrontadas com a Matriz Parametrizada da Lei nº 10.833/03, RIR/2018 e LC nº 116/03.
            </p>
          </div>

          {/* Badges de Base Legal */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-[11px] text-slate-300">
              <span className="text-slate-500 block text-[9px] uppercase font-mono">CRF Global</span>
              <span className="font-bold text-cyan-400">4,65%</span> (PIS/COF/CSLL)
            </div>
            <div className="px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-[11px] text-slate-300">
              <span className="text-slate-500 block text-[9px] uppercase font-mono">IRRF Fonte</span>
              <span className="font-bold text-amber-400">1,50% / 1,00%</span>
            </div>
            <div className="px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-[11px] text-slate-300">
              <span className="text-slate-500 block text-[9px] uppercase font-mono">INSS Mão de Obra</span>
              <span className="font-bold text-emerald-400">11,00%</span>
            </div>
            <div className="px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-[11px] text-slate-300">
              <span className="text-slate-500 block text-[9px] uppercase font-mono">ISSQN Local</span>
              <span className="font-bold text-purple-400">2% a 5%</span>
            </div>
          </div>
        </div>
      </div>

      {/* KPI Cockpit de Retenções */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
        {/* Total Bruto */}
        <div className="p-3.5 rounded-xl bg-slate-900/90 border border-slate-800/80 shadow-md">
          <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Total Serviços</div>
          <div className="text-sm font-black text-white mt-1 font-mono">
            R$ {totalValorBruto.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div className="text-[10px] text-slate-500 mt-0.5">{filteredDataset.length} notas analisadas</div>
        </div>

        {/* IRRF Retido */}
        <div className="p-3.5 rounded-xl bg-slate-900/90 border border-amber-900/30 shadow-md">
          <div className="text-[10px] text-amber-400 font-bold uppercase tracking-wider flex items-center justify-between">
            <span>IRRF (1,5% / 1%)</span>
            <span className="text-[9px] px-1 rounded bg-amber-500/20 text-amber-300 font-mono">1708</span>
          </div>
          <div className="text-sm font-black text-amber-300 mt-1 font-mono">
            R$ {totalIrrf.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div className="text-[10px] text-slate-500 mt-0.5">Art. 714 RIR/2018</div>
        </div>

        {/* CRF / PCC Global */}
        <div className="p-3.5 rounded-xl bg-slate-900/90 border border-cyan-900/30 shadow-md">
          <div className="text-[10px] text-cyan-400 font-bold uppercase tracking-wider flex items-center justify-between">
            <span>CRF/PCC (4,65%)</span>
            <span className="text-[9px] px-1 rounded bg-cyan-500/20 text-cyan-300 font-mono">5952</span>
          </div>
          <div className="text-sm font-black text-cyan-300 mt-1 font-mono">
            R$ {totalCrf.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div className="text-[10px] text-slate-500 mt-0.5">Lei 10.833/03</div>
        </div>

        {/* INSS 11% */}
        <div className="p-3.5 rounded-xl bg-slate-900/90 border border-emerald-900/30 shadow-md">
          <div className="text-[10px] text-emerald-400 font-bold uppercase tracking-wider flex items-center justify-between">
            <span>INSS (11%)</span>
            <span className="text-[9px] px-1 rounded bg-emerald-500/20 text-emerald-300 font-mono">DCTFWeb</span>
          </div>
          <div className="text-sm font-black text-emerald-300 mt-1 font-mono">
            R$ {totalInss.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div className="text-[10px] text-slate-500 mt-0.5">Lei 8.212/1991</div>
        </div>

        {/* ISSQN Retido */}
        <div className="p-3.5 rounded-xl bg-slate-900/90 border border-purple-900/30 shadow-md">
          <div className="text-[10px] text-purple-400 font-bold uppercase tracking-wider flex items-center justify-between">
            <span>ISSQN Retido</span>
            <span className="text-[9px] px-1 rounded bg-purple-500/20 text-purple-300 font-mono">DAM</span>
          </div>
          <div className="text-sm font-black text-purple-300 mt-1 font-mono">
            R$ {totalIss.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div className="text-[10px] text-slate-500 mt-0.5">LC nº 116/2003</div>
        </div>

        {/* Total Retenções */}
        <div className="p-3.5 rounded-xl bg-indigo-950/40 border border-indigo-800/50 shadow-md">
          <div className="text-[10px] text-indigo-300 font-bold uppercase tracking-wider">Total Retido</div>
          <div className="text-sm font-black text-indigo-300 mt-1 font-mono">
            R$ {totalRetencoesGeral.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div className="text-[10px] text-indigo-400/80 mt-0.5">Líquido: R$ {totalValorLiquido.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}</div>
        </div>

        {/* Inconsistências / Alertas */}
        <div className={`p-3.5 rounded-xl border shadow-md ${totalDivergencias > 0 ? 'bg-amber-950/30 border-amber-800/60' : 'bg-slate-900/90 border-slate-800'}`}>
          <div className="text-[10px] text-amber-400 font-bold uppercase tracking-wider flex items-center gap-1">
            <AlertTriangle className="w-3 h-3 text-amber-400" />
            <span>Riscos / Glosas</span>
          </div>
          <div className={`text-sm font-black mt-1 font-mono ${totalDivergencias > 0 ? 'text-amber-400' : 'text-emerald-400'}`}>
            {totalDivergencias} {totalDivergencias === 1 ? 'Alerta' : 'Alertas'}
          </div>
          <div className="text-[10px] text-slate-500 mt-0.5">{totalDivergencias > 0 ? 'Exige saneamento' : '100% Conforme'}</div>
        </div>
      </div>

      {/* Barra de Filtros e Busca Rápida */}
      <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            onClick={() => setSelectedFilter('todos')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              selectedFilter === 'todos' 
                ? 'bg-amber-500 text-slate-950 shadow-md' 
                : 'bg-slate-800/80 text-slate-300 hover:bg-slate-700'
            }`}
          >
            Todos ({dataset.length})
          </button>
          <button
            onClick={() => setSelectedFilter('com_retencao')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              selectedFilter === 'com_retencao' 
                ? 'bg-indigo-600 text-white shadow-md' 
                : 'bg-slate-800/80 text-slate-300 hover:bg-slate-700'
            }`}
          >
            Com Retenção Destacada
          </button>
          <button
            onClick={() => setSelectedFilter('apenas_divergencias')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1 ${
              selectedFilter === 'apenas_divergencias' 
                ? 'bg-amber-600 text-white shadow-md' 
                : 'bg-slate-800/80 text-amber-300 hover:bg-slate-700'
            }`}
          >
            <AlertTriangle className="w-3 h-3" />
            Divergências ({totalDivergencias})
          </button>
          <button
            onClick={() => setSelectedFilter('irrf')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              selectedFilter === 'irrf' 
                ? 'bg-amber-500/30 text-amber-200 border border-amber-500/50' 
                : 'bg-slate-800/80 text-slate-300 hover:bg-slate-700'
            }`}
          >
            IRRF 1,5%
          </button>
          <button
            onClick={() => setSelectedFilter('crf')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              selectedFilter === 'crf' 
                ? 'bg-cyan-500/30 text-cyan-200 border border-cyan-500/50' 
                : 'bg-slate-800/80 text-slate-300 hover:bg-slate-700'
            }`}
          >
            CRF/PCC 4,65%
          </button>
          <button
            onClick={() => setSelectedFilter('inss')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              selectedFilter === 'inss' 
                ? 'bg-emerald-500/30 text-emerald-200 border border-emerald-500/50' 
                : 'bg-slate-800/80 text-slate-300 hover:bg-slate-700'
            }`}
          >
            INSS 11%
          </button>
          <button
            onClick={() => setSelectedFilter('iss')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              selectedFilter === 'iss' 
                ? 'bg-purple-500/30 text-purple-200 border border-purple-500/50' 
                : 'bg-slate-800/80 text-slate-300 hover:bg-slate-700'
            }`}
          >
            ISSQN Retido
          </button>
        </div>

        {/* Input de Busca */}
        <div className="relative min-w-[240px]">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Buscar prestador, CNPJ, serviço, chave..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 font-sans"
          />
        </div>
      </div>

      {/* Tabela Analítica de Retenções na Fonte */}
      <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-950/80 shadow-2xl">
        <table className="w-full text-left text-xs border-collapse min-w-[1750px]">
          <thead>
            <tr className="bg-slate-900/95 border-b border-slate-800 text-slate-400 font-semibold uppercase text-[10px] tracking-wider font-mono">
              <th className="p-3">Doc / Chave / Prestador</th>
              <th className="p-3">Código LC 116 & Discriminação</th>
              <th className="p-3 text-right">Valor Bruto (R$)</th>
              <th className="p-3 text-right">IRRF (1,5% / 1%)</th>
              <th className="p-3 text-right">CRF (4,65%)</th>
              <th className="p-3 text-right">INSS (11% / 3,5%)</th>
              <th className="p-3 text-right">ISS Retido</th>
              <th className="p-3 text-right">Total Retido</th>
              <th className="p-3 text-right">Líquido a Pagar</th>
              <th className="p-3 text-center">Diagnóstico Matriz</th>
              <th className="p-3 text-center">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60 font-mono">
            {filteredDataset.length === 0 ? (
              <tr>
                <td colSpan={11} className="p-8 text-center text-slate-500 font-sans">
                  Nenhum registro de serviço ou retenção na fonte localizado para os filtros selecionados.
                </td>
              </tr>
            ) : (
              filteredDataset.map((it) => {
                const valorBruto = it.valorBrutoItem || it.valorLiquidoItem || 0;
                const irrf = it.valorIrrf || 0;
                const inss = it.valorInss || 0;
                const iss = it.valorIssRetido || 0;
                const csll = it.valorCsllRetido || 0;
                const pis = it.valorPisRetido || 0;
                const cofins = it.valorCofinsRetido || 0;
                const crf = pis + cofins + csll;
                const totalRet = it.totalRetencoes || (irrf + inss + iss + crf);
                const valorLiq = it.valorLiquidoServico || Math.max(0, valorBruto - totalRet);

                const hasDivergence = it.diagnosticoRetencao === 'DIVERGENCIA_ALIQUOTA' || it.diagnosticoRetencao === 'FALTA_RETENCAO';

                return (
                  <tr 
                    key={it.id} 
                    className={`hover:bg-slate-900/60 transition-colors ${
                      hasDivergence ? 'bg-amber-950/15' : totalRet > 0 ? 'bg-indigo-950/10' : ''
                    }`}
                  >
                    {/* Doc / Prestador */}
                    <td className="p-3">
                      <div className="font-bold text-white flex items-center gap-1.5">
                        <span className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 font-mono text-[9px] border border-amber-500/30">
                          {it.tipoDoc}
                        </span>
                        <span>{it.numeroSerie}</span>
                        <span className="text-[10px] text-slate-400 font-normal">({it.competencia})</span>
                      </div>
                      <div className="text-xs text-slate-200 font-sans font-semibold truncate max-w-[260px] mt-0.5" title={it.fornecedorRazao}>
                        {it.fornecedorRazao}
                      </div>
                      <div className="text-[10px] text-slate-400 font-mono flex items-center gap-2 mt-0.5">
                        <span>CNPJ: {it.fornecedorCnpj}</span>
                        <span className="text-slate-600">•</span>
                        <span>UF: {it.fornecedorUf}</span>
                      </div>
                    </td>

                    {/* Código LC 116 e Discriminação */}
                    <td className="p-3 font-sans">
                      <div className="flex items-center gap-1.5 font-mono">
                        <span className="px-2 py-0.5 rounded bg-slate-900 text-amber-300 font-bold text-[10px] border border-slate-700">
                          Item {it.codigoServicoLc116 || '17.01'}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-300 line-clamp-2 max-w-[280px] mt-1" title={it.discriminacaoServico || it.descricaoItem}>
                        {it.discriminacaoServico || it.descricaoItem || 'Prestação de Serviços Profissionais / Técnicos'}
                      </div>
                    </td>

                    {/* Valor Bruto */}
                    <td className="p-3 text-right text-slate-100 font-bold text-xs">
                      R$ {valorBruto.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>

                    {/* IRRF */}
                    <td className="p-3 text-right">
                      {irrf > 0 ? (
                        <div>
                          <div className="font-bold text-amber-300">
                            R$ {irrf.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </div>
                          <div className="text-[9px] text-slate-400">
                            Aliq: {it.aliquotaIrrf || 1.5}%
                          </div>
                        </div>
                      ) : (
                        <span className="text-slate-600 text-[11px]">—</span>
                      )}
                    </td>

                    {/* CRF / PCC 4,65% */}
                    <td className="p-3 text-right">
                      {crf > 0 ? (
                        <div>
                          <div className="font-bold text-cyan-300">
                            R$ {crf.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </div>
                          <div className="text-[9px] text-slate-400">
                            4,65% (P+C+CSLL)
                          </div>
                        </div>
                      ) : (
                        <span className="text-slate-600 text-[11px]">—</span>
                      )}
                    </td>

                    {/* INSS 11% */}
                    <td className="p-3 text-right">
                      {inss > 0 ? (
                        <div>
                          <div className="font-bold text-emerald-300">
                            R$ {inss.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </div>
                          <div className="text-[9px] text-slate-400">
                            Aliq: {it.aliquotaInss || 11}%
                          </div>
                        </div>
                      ) : (
                        <span className="text-slate-600 text-[11px]">—</span>
                      )}
                    </td>

                    {/* ISS Retido */}
                    <td className="p-3 text-right">
                      {iss > 0 ? (
                        <div>
                          <div className="font-bold text-purple-300">
                            R$ {iss.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </div>
                          <div className="text-[9px] text-slate-400">
                            Aliq: {it.aliquotaIssRetido || 5}%
                          </div>
                        </div>
                      ) : (
                        <span className="text-slate-600 text-[11px]">—</span>
                      )}
                    </td>

                    {/* Total Retido */}
                    <td className="p-3 text-right">
                      <div className={`font-black ${totalRet > 0 ? 'text-indigo-300' : 'text-slate-500'}`}>
                        R$ {totalRet.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </div>
                    </td>

                    {/* Líquido a Pagar */}
                    <td className="p-3 text-right">
                      <div className="font-black text-emerald-400">
                        R$ {valorLiq.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </div>
                    </td>

                    {/* Diagnóstico Matriz */}
                    <td className="p-3 text-center font-sans">
                      {it.diagnosticoRetencao === 'DIVERGENCIA_ALIQUOTA' ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30" title={it.motivoDiagnosticoRetencao}>
                          <AlertTriangle className="w-3 h-3" />
                          Divergência
                        </span>
                      ) : it.diagnosticoRetencao === 'FALTA_RETENCAO' ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-500/20 text-red-300 border border-red-500/30" title={it.motivoDiagnosticoRetencao}>
                          <AlertTriangle className="w-3 h-3" />
                          Falta Retenção
                        </span>
                      ) : it.diagnosticoRetencao === 'DISPENSADO_LIMITE' ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-800 text-slate-300 border border-slate-700" title={it.motivoDiagnosticoRetencao}>
                          Dispensa &le; R$10
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                          <CheckCircle2 className="w-3 h-3" />
                          Conforme
                        </span>
                      )}
                    </td>

                    {/* Ações */}
                    <td className="p-3 text-center">
                      <button
                        onClick={() => {
                          setModalItem(it);
                          if (onOpenDetail) onOpenDetail(it);
                        }}
                        className="px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-700 text-xs flex items-center gap-1 mx-auto transition-all font-sans"
                        title="Ver memória de cálculo e fundamentação jurídica"
                      >
                        <Eye className="w-3 h-3 text-amber-400" />
                        Auditar
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Modal de Detalhamento / Memória de Cálculo de Retenção */}
      {modalItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-2xl w-full p-6 shadow-2xl space-y-5">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Receipt className="w-5 h-5 text-amber-400" />
                <h4 className="text-base font-bold text-white font-sans">
                  Memória de Auditoria de Retenções na Fonte
                </h4>
              </div>
              <button
                onClick={() => setModalItem(null)}
                className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-all text-xs px-2"
              >
                ✕ Fechar
              </button>
            </div>

            <div className="space-y-4 text-xs font-sans">
              {/* Prestador e Documento */}
              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
                <div className="flex justify-between items-center">
                  <span className="text-slate-400 font-mono uppercase text-[10px]">Documento</span>
                  <span className="font-bold text-amber-400">{modalItem.tipoDoc} nº {modalItem.numeroSerie}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-400 font-mono uppercase text-[10px]">Prestador</span>
                  <span className="text-white font-semibold">{modalItem.fornecedorRazao} ({modalItem.fornecedorCnpj})</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-400 font-mono uppercase text-[10px]">Chave de Acesso</span>
                  <span className="text-slate-300 font-mono text-[10px]">{modalItem.chaveAcesso}</span>
                </div>
              </div>

              {/* Quadro Comparativo de Tributos Retidos */}
              <div className="border border-slate-800 rounded-xl overflow-hidden">
                <table className="w-full text-left">
                  <thead className="bg-slate-950 text-slate-400 text-[10px] uppercase font-mono">
                    <tr>
                      <th className="p-2.5">Tributo Retido</th>
                      <th className="p-2.5">Alíquota Legal</th>
                      <th className="p-2.5 text-right">Valor Retido (R$)</th>
                      <th className="p-2.5">Guia / Obrigação</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800 font-mono">
                    <tr>
                      <td className="p-2.5 text-amber-300 font-bold font-sans">IRRF Fonte</td>
                      <td className="p-2.5 text-slate-300">1,50% (Art. 714 RIR/2018)</td>
                      <td className="p-2.5 text-right font-bold text-white">R$ {(modalItem.valorIrrf || 0).toFixed(2)}</td>
                      <td className="p-2.5 text-slate-400 font-sans">DARF 1708 (Reinf / DCTFWeb)</td>
                    </tr>
                    <tr>
                      <td className="p-2.5 text-cyan-300 font-bold font-sans">CRF/PCC (PIS/COFINS/CSLL)</td>
                      <td className="p-2.5 text-slate-300">4,65% (Art. 30 Lei 10.833/03)</td>
                      <td className="p-2.5 text-right font-bold text-white">
                        R$ {((modalItem.valorCsllRetido || 0) + (modalItem.valorPisRetido || 0) + (modalItem.valorCofinsRetido || 0)).toFixed(2)}
                      </td>
                      <td className="p-2.5 text-slate-400 font-sans">DARF 5952 (Reinf / DCTFWeb)</td>
                    </tr>
                    <tr>
                      <td className="p-2.5 text-emerald-300 font-bold font-sans">INSS Previdenciário</td>
                      <td className="p-2.5 text-slate-300">11,00% (Art. 31 Lei 8.212/91)</td>
                      <td className="p-2.5 text-right font-bold text-white">R$ {(modalItem.valorInss || 0).toFixed(2)}</td>
                      <td className="p-2.5 text-slate-400 font-sans">EFD-Reinf / DCTFWeb</td>
                    </tr>
                    <tr>
                      <td className="p-2.5 text-purple-300 font-bold font-sans">ISSQN Municipal</td>
                      <td className="p-2.5 text-slate-300">2% a 5% (LC 116/03)</td>
                      <td className="p-2.5 text-right font-bold text-white">R$ {(modalItem.valorIssRetido || 0).toFixed(2)}</td>
                      <td className="p-2.5 text-slate-400 font-sans">DAM Municipal (Tomador Substituto)</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Diagnóstico */}
              <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 space-y-1">
                <div className="text-[10px] text-slate-400 font-mono uppercase">Parecer de Conformidade</div>
                <div className="text-slate-200 text-xs">
                  {modalItem.motivoDiagnosticoRetencao || 'Documento validado com aderência às matrizes federais e municipais.'}
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setModalItem(null)}
                className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs transition-all font-sans"
              >
                Concluir Auditoria
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
