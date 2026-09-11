import React, { useState, useMemo } from 'react';
import {
  Calculator, TrendingUp, Users, DollarSign, ShieldAlert, CheckCircle2, AlertTriangle,
  Info, HelpCircle, ArrowRight, ArrowUpRight, ArrowDownRight, Layers, FileText,
  Sliders, ChevronDown, ChevronUp, BarChart3, Building2, Truck, RefreshCw, Sparkles
} from 'lucide-react';
import { Empresa } from '../contexts/AuthContext';
import {
  TABELAS_SIMPLES,
  ATIVIDADES_LUCRO_PRESUMIDO,
  ENCARGOS_PADRAO_POR_ATIVIDADE,
  AtividadePresumido,
  TabelaSimplesAnexo
} from '../data/parametrosFiscaisRegimes';

interface SimuladorRegimesPanelProps {
  empresaAtiva?: Empresa | null;
}

export const SimuladorRegimesPanel: React.FC<SimuladorRegimesPanelProps> = ({ empresaAtiva }) => {
  // Aba Ativa: 'comparativo_dre' | 'break_even_cpp'
  const [activeTab, setActiveTab] = useState<'comparativo_dre' | 'break_even_cpp'>('comparativo_dre');

  // Parâmetros Gerais
  const [atividadeKey, setAtividadeKey] = useState<string>('transporte_cargas');
  const [anexoSimplesKey, setAnexoSimplesKey] = useState<string>('transporte_cargas');
  const [anoTransicao, setAnoTransicao] = useState<string>('2027');

  // Valores Financeiros Mensais e Anuais
  const [rbt12, setRbt12] = useState<number>(1800000); // 1,8 milhão
  const [faturamentoMes, setFaturamentoMes] = useState<number>(150000);
  const [comprasInsumosMes, setComprasInsumosMes] = useState<number>(65000);
  const [folhaSalariosMes, setFolhaSalariosMes] = useState<number>(25000);
  const [outrasDespesasMes, setOutrasDespesasMes] = useState<number>(15000);
  const [outrasReceitasAdicoes, setOutrasReceitasAdicoes] = useState<number>(0);
  const [aliquotaIvaGeral, setAliquotaIvaGeral] = useState<number>(27.91);

  // Parâmetros de Cadeia (Fornecedor x Cliente)
  const [pctCompraRegimeGeral, setPctCompraRegimeGeral] = useState<number>(85); // 85% compras do Regime Geral (geram crédito)
  const [pctVendaB2B, setPctVendaB2B] = useState<number>(90); // 90% vendas para PJs tomadoras de crédito

  // Parâmetros Específicos para a Aba 2: Ponto de Equilíbrio CPP
  const [salarioBaseColaborador, setSalarioBaseColaborador] = useState<number>(2800);
  const [qtdColaboradoresAtual, setQtdColaboradoresAtual] = useState<number>(9);
  const [maxColaboradoresSimulacao, setMaxColaboradoresSimulacao] = useState<number>(30);
  const [inssPatronalPct, setInssPatronalPct] = useState<number>(20.0);
  const [ratFapPct, setRatFapPct] = useState<number>(3.0);
  const [sistemaSTerceirosPct, setSistemaSTerceirosPct] = useState<number>(5.2);

  // Modal / Drawer de Memória de Cálculo
  const [showMemoriaCalculo, setShowMemoriaCalculo] = useState<boolean>(false);

  // Sincronizar atividade ao mudar
  const handleAtividadeChange = (novaAtividadeKey: string) => {
    setAtividadeKey(novaAtividadeKey);
    const ativ = ATIVIDADES_LUCRO_PRESUMIDO.find(a => a.id === novaAtividadeKey);
    if (ativ) {
      setAnexoSimplesKey(ativ.anexoSimplesPadrao);
      const encargos = ENCARGOS_PADRAO_POR_ATIVIDADE[novaAtividadeKey] || ENCARGOS_PADRAO_POR_ATIVIDADE.padrao;
      setInssPatronalPct(encargos.inssPatronal * 100);
      setRatFapPct(encargos.ratFap * 100);
      setSistemaSTerceirosPct(encargos.sistemaSTerceiros * 100);
    }
  };

  // Quadrantes da Matriz
  const applyScenario = (cenario: number) => {
    if (cenario === 1) {
      setPctCompraRegimeGeral(90);
      setPctVendaB2B(90);
    } else if (cenario === 2) {
      setPctCompraRegimeGeral(15);
      setPctVendaB2B(90);
    } else if (cenario === 3) {
      setPctCompraRegimeGeral(85);
      setPctVendaB2B(10);
    } else if (cenario === 4) {
      setPctCompraRegimeGeral(10);
      setPctVendaB2B(10);
    }
  };

  // Helpers de Formatação
  const formatMoney = (val: number) => {
    return val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };

  const formatPct = (val: number) => {
    return (val * 100).toFixed(2) + '%';
  };

  // ==========================================================================
  // CÁLCULO 1: ENQUADRAMENTO SIMPLES NACIONAL (LC 123/2006 & LC 214/227)
  // ==========================================================================
  const simplesCalculo = useMemo(() => {
    const tabela: TabelaSimplesAnexo = TABELAS_SIMPLES[anexoSimplesKey] || TABELAS_SIMPLES.anexo1;
    const faixas = tabela.faixas;

    let faixaIdx = 0;
    for (let i = 0; i < faixas.length; i++) {
      if (rbt12 <= faixas[i].limite || i === faixas.length - 1) {
        faixaIdx = i;
        break;
      }
    }

    const faixaConfig = faixas[faixaIdx];
    const aliqNominal = faixaConfig.aliqNominal;
    const deducao = faixaConfig.deducao;

    // Fórmula legal: [(RBT12 * AliqNominal) - Deducao] / RBT12
    const aliqEfetiva = rbt12 > 0 ? Math.max(0, ((rbt12 * aliqNominal) - deducao) / rbt12) : aliqNominal;

    // Repartição do CPP dentro do DAS
    const pctReparticaoCpp = faixaConfig.reparticao.cpp || 0;

    // Fração de partilha IBS e CBS da Reforma (LC 214)
    const partilhaArray = tabela.partilhaReforma[anoTransicao] || tabela.partilhaReforma['2027'];
    const fracaoIBSCBS = partilhaArray[faixaIdx] || 0.155;

    // Fração de IBS/CBS que sai do DAS
    const aliqEfetivaIBSCBS = aliqEfetiva * fracaoIBSCBS;
    // DAS Residual (IRPJ, CSLL, CPP etc.)
    const aliqResidualDAS = Math.max(0, aliqEfetiva - aliqEfetivaIBSCBS);

    // Valores do Mês
    const impostoTradicional = faturamentoMes * aliqEfetiva;
    const dasResidual = faturamentoMes * aliqResidualDAS;

    // CPP embutido no Simples
    const cppEmbutidoSimples = faturamentoMes * aliqEfetiva * pctReparticaoCpp;

    // Crédito transferido na nota para o cliente B2B
    const receitaB2B = faturamentoMes * (pctVendaB2B / 100);
    const creditoClienteTradicional = receitaB2B * aliqEfetivaIBSCBS;

    // Simples Híbrido: Débito e Crédito de IBS/CBS
    const aliqIvaDecimal = aliquotaIvaGeral / 100;
    const debitoIvaHibrido = faturamentoMes * aliqIvaDecimal;

    const comprasRG = comprasInsumosMes * (pctCompraRegimeGeral / 100);
    const comprasSimples = comprasInsumosMes * (1 - (pctCompraRegimeGeral / 100));

    // Crédito de Insumos: Regime Geral pleno + crédito Simples
    const creditoIvaEntrada = (comprasRG * aliqIvaDecimal) + (comprasSimples * aliqEfetivaIBSCBS);
    const saldoIvaHibrido = Math.max(0, debitoIvaHibrido - creditoIvaEntrada);

    const impostoTotalHibrido = dasResidual + saldoIvaHibrido;
    const creditoClienteHibrido = receitaB2B * aliqIvaDecimal;

    return {
      faixaNumero: faixaIdx + 1,
      aliqNominal,
      deducao,
      aliqEfetiva,
      fracaoIBSCBS,
      aliqEfetivaIBSCBS,
      aliqResidualDAS,
      pctReparticaoCpp,
      impostoTradicional,
      dasResidual,
      debitoIvaHibrido,
      creditoIvaEntrada,
      saldoIvaHibrido,
      impostoTotalHibrido,
      creditoClienteTradicional,
      creditoClienteHibrido,
      cppEmbutidoSimples
    };
  }, [anexoSimplesKey, rbt12, faturamentoMes, comprasInsumosMes, aliquotaIvaGeral, pctCompraRegimeGeral, pctVendaB2B, anoTransicao]);

  // ==========================================================================
  // CÁLCULO 2: LUCRO PRESUMIDO & REGIME NORMAL (LEI 9.249/1995 & REFORMA)
  // ==========================================================================
  const presumidoCalculo = useMemo(() => {
    const ativ = ATIVIDADES_LUCRO_PRESUMIDO.find(a => a.id === atividadeKey) || ATIVIDADES_LUCRO_PRESUMIDO[1];
    const presuncaoIrpj = ativ.presuncaoIrpj;
    const presuncaoCsll = ativ.presuncaoCsll;

    // 1. Base de Cálculo IRPJ: (Faturamento * Presunção) + Adições
    const baseIrpj = (faturamentoMes * presuncaoIrpj) + outrasReceitasAdicoes;
    // IRPJ Básico (15%)
    const irpjBasico = baseIrpj * 0.15;
    // Adicional de IRPJ (10% sobre o que exceder R$ 20.000/mês ou R$ 60.000/trimestre)
    const excedenteIrpj = Math.max(0, baseIrpj - 20000);
    const irpjAdicional = excedenteIrpj * 0.10;
    const irpjTotal = irpjBasico + irpjAdicional;

    // 2. Base de Cálculo CSLL: (Faturamento * Presunção) + Adições
    const baseCsll = (faturamentoMes * presuncaoCsll) + outrasReceitasAdicoes;
    // CSLL Alíquota Geral (9%)
    const csllTotal = baseCsll * 0.09;

    // 3. IBS e CBS pós-Reforma (Não-Cumulativo Pleno)
    const aliqIvaDecimal = aliquotaIvaGeral / 100;
    const debitoIvaPresumido = faturamentoMes * aliqIvaDecimal;
    const comprasRG = comprasInsumosMes * (pctCompraRegimeGeral / 100);
    const comprasSimples = comprasInsumosMes * (1 - (pctCompraRegimeGeral / 100));

    const creditoIvaPresumido = (comprasRG * aliqIvaDecimal) + (comprasSimples * simplesCalculo.aliqEfetivaIBSCBS);
    const saldoIvaPresumido = Math.max(0, debitoIvaPresumido - creditoIvaPresumido);

    // 4. Encargos Previdenciários Patronais sobre a Folha
    const totalEncargosPct = (inssPatronalPct + ratFapPct + sistemaSTerceirosPct) / 100;
    const cppPatronalFolhaPresumido = folhaSalariosMes * totalEncargosPct;

    // Total de Tributos do Mês no Lucro Presumido
    const totalTributosPresumido = saldoIvaPresumido + irpjTotal + csllTotal + cppPatronalFolhaPresumido;

    // Crédito transferido para clientes PJ no Presumido (Crédito Integral)
    const receitaB2B = faturamentoMes * (pctVendaB2B / 100);
    const creditoClientePresumido = receitaB2B * aliqIvaDecimal;

    return {
      ativ,
      presuncaoIrpj,
      presuncaoCsll,
      baseIrpj,
      irpjBasico,
      excedenteIrpj,
      irpjAdicional,
      irpjTotal,
      baseCsll,
      csllTotal,
      debitoIvaPresumido,
      creditoIvaPresumido,
      saldoIvaPresumido,
      totalEncargosPct,
      cppPatronalFolhaPresumido,
      totalTributosPresumido,
      creditoClientePresumido
    };
  }, [atividadeKey, faturamentoMes, comprasInsumosMes, folhaSalariosMes, outrasReceitasAdicoes, aliquotaIvaGeral, pctCompraRegimeGeral, pctVendaB2B, inssPatronalPct, ratFapPct, sistemaSTerceirosPct, simplesCalculo.aliqEfetivaIBSCBS]);

  // ==========================================================================
  // CÁLCULO 3: MINI-DRE GERENCIAL & CAIXA LÍQUIDO DOS 3 REGIMES
  // ==========================================================================
  const dreComparativo = useMemo(() => {
    // 1. Simples Tradicional
    const impostoVendasTrad = simplesCalculo.impostoTradicional;
    const recLiquidaTrad = faturamentoMes - impostoVendasTrad;
    const margemBrutaTrad = recLiquidaTrad - comprasInsumosMes;
    // No Simples Anexo I, II, III e Frete Comutado, o CPP já está no DAS, não paga patronal sobre a folha
    const encargosFolhaTrad = anexoSimplesKey === 'anexo4' ? (folhaSalariosMes * 0.20) : 0;
    const despesasTotaisTrad = outrasDespesasMes + folhaSalariosMes + encargosFolhaTrad;
    const resultadoLiquidoTrad = margemBrutaTrad - despesasTotaisTrad;
    const margemLiquidaPctTrad = faturamentoMes > 0 ? (resultadoLiquidoTrad / faturamentoMes) * 100 : 0;

    // 2. Simples Híbrido
    const impostoVendasHib = simplesCalculo.impostoTotalHibrido;
    const recLiquidaHib = faturamentoMes - impostoVendasHib;
    const margemBrutaHib = recLiquidaHib - comprasInsumosMes;
    const encargosFolhaHib = anexoSimplesKey === 'anexo4' ? (folhaSalariosMes * 0.20) : 0;
    const despesasTotaisHib = outrasDespesasMes + folhaSalariosMes + encargosFolhaHib;
    const resultadoLiquidoHib = margemBrutaHib - despesasTotaisHib;
    const margemLiquidaPctHib = faturamentoMes > 0 ? (resultadoLiquidoHib / faturamentoMes) * 100 : 0;

    // 3. Lucro Presumido
    const impostoVendasPres = presumidoCalculo.saldoIvaPresumido;
    const recLiquidaPres = faturamentoMes - impostoVendasPres;
    const margemBrutaPres = recLiquidaPres - comprasInsumosMes;
    const despesasTotaisPres = outrasDespesasMes + folhaSalariosMes + presumidoCalculo.cppPatronalFolhaPresumido;
    const irpjCsllPres = presumidoCalculo.irpjTotal + presumidoCalculo.csllTotal;
    const resultadoLiquidoPres = margemBrutaPres - despesasTotaisPres - irpjCsllPres;
    const margemLiquidaPctPres = faturamentoMes > 0 ? (resultadoLiquidoPres / faturamentoMes) * 100 : 0;

    // Total de Carga Tributária Global de Cada Regime
    const totalTributosGlobalTrad = impostoVendasTrad + encargosFolhaTrad;
    const totalTributosGlobalHib = impostoVendasHib + encargosFolhaHib;
    const totalTributosGlobalPres = presumidoCalculo.totalTributosPresumido;

    return {
      trad: {
        recBruta: faturamentoMes,
        impostosVendas: impostoVendasTrad,
        recLiquida: recLiquidaTrad,
        comprasInsumos: comprasInsumosMes,
        margemBruta: margemBrutaTrad,
        outrasDespesas: outrasDespesasMes,
        folhaSalarios: folhaSalariosMes,
        encargosPatronais: encargosFolhaTrad,
        irpjCsll: 0, // Incluso no DAS
        resultadoLiquido: resultadoLiquidoTrad,
        margemLiquidaPct: margemLiquidaPctTrad,
        totalTributos: totalTributosGlobalTrad,
        creditoCliente: simplesCalculo.creditoClienteTradicional
      },
      hib: {
        recBruta: faturamentoMes,
        impostosVendas: impostoVendasHib,
        recLiquida: recLiquidaHib,
        comprasInsumos: comprasInsumosMes,
        margemBruta: margemBrutaHib,
        outrasDespesas: outrasDespesasMes,
        folhaSalarios: folhaSalariosMes,
        encargosPatronais: encargosFolhaHib,
        irpjCsll: 0, // Incluso no DAS Residual
        resultadoLiquido: resultadoLiquidoHib,
        margemLiquidaPct: margemLiquidaPctHib,
        totalTributos: totalTributosGlobalHib,
        creditoCliente: simplesCalculo.creditoClienteHibrido
      },
      pres: {
        recBruta: faturamentoMes,
        impostosVendas: impostoVendasPres,
        recLiquida: recLiquidaPres,
        comprasInsumos: comprasInsumosMes,
        margemBruta: margemBrutaPres,
        outrasDespesas: outrasDespesasMes,
        folhaSalarios: folhaSalariosMes,
        encargosPatronais: presumidoCalculo.cppPatronalFolhaPresumido,
        irpjCsll: irpjCsllPres,
        resultadoLiquido: resultadoLiquidoPres,
        margemLiquidaPct: margemLiquidaPctPres,
        totalTributos: totalTributosGlobalPres,
        creditoCliente: presumidoCalculo.creditoClientePresumido
      }
    };
  }, [faturamentoMes, comprasInsumosMes, outrasDespesasMes, folhaSalariosMes, anexoSimplesKey, simplesCalculo, presumidoCalculo]);

  // ==========================================================================
  // CÁLCULO 4: SIMULADOR DE PONTO DE EQUILÍBRIO CPP (EQUIPE X REGIME)
  // ==========================================================================
  const breakEvenCpp = useMemo(() => {
    // CPP no Simples Nacional: Faturamento * AliqEfetiva * % CPP
    const cppSimplesTotal = simplesCalculo.cppEmbutidoSimples;

    // Encargos Unitários por Colaborador Fora do Simples:
    const totalEncargosTaxa = (inssPatronalPct + ratFapPct + sistemaSTerceirosPct) / 100;
    const cppUnitarioForaSimples = salarioBaseColaborador * totalEncargosTaxa;

    // Ponto de Equilíbrio Analítico: N* = CPP_Simples / Custo_Unitario_Fora
    const pontoEquilibrioExato = cppUnitarioForaSimples > 0 ? (cppSimplesTotal / cppUnitarioForaSimples) : 0;
    const pontoEquilibrioArredondado = Math.round(pontoEquilibrioExato);

    // Tabela Evolutiva de 1 até maxColaboradoresSimulacao
    const evolucaoColaboradores = [];
    for (let n = 1; n <= maxColaboradoresSimulacao; n++) {
      const folhaBruta = n * salarioBaseColaborador;
      const cppForaSimples = folhaBruta * totalEncargosTaxa;
      const diferenca = cppForaSimples - cppSimplesTotal; // Positivo = Simples é mais barato

      evolucaoColaboradores.push({
        n,
        folhaBruta,
        cppSimples: cppSimplesTotal,
        cppForaSimples,
        diferenca,
        maisVantajoso: diferenca >= 0 ? 'Simples Nacional' : 'Lucro Presumido/Real'
      });
    }

    // Diagnóstico da Equipe Atual
    const custoEquipeAtualSimples = cppSimplesTotal;
    const custoEquipeAtualFora = qtdColaboradoresAtual * cppUnitarioForaSimples;
    const economiaEquipeAtual = custoEquipeAtualFora - custoEquipeAtualSimples;

    return {
      cppSimplesTotal,
      cppUnitarioForaSimples,
      totalEncargosTaxa,
      pontoEquilibrioExato,
      pontoEquilibrioArredondado,
      custoEquipeAtualSimples,
      custoEquipeAtualFora,
      economiaEquipeAtual,
      evolucaoColaboradores
    };
  }, [simplesCalculo.cppEmbutidoSimples, inssPatronalPct, ratFapPct, sistemaSTerceirosPct, salarioBaseColaborador, maxColaboradoresSimulacao, qtdColaboradoresAtual]);

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* HEADER EXECUTIVO */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950/40 to-slate-900 border border-slate-800/80 rounded-2xl p-6 relative overflow-hidden shadow-xl">
        <div className="absolute -right-10 -top-10 w-80 h-80 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-wider uppercase bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                Planejamento Tributário & DRE
              </span>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-wider uppercase bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                Reforma LC 214 / LC 227
              </span>
            </div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-2.5">
              <Calculator className="w-7 h-7 text-indigo-400" />
              Modelador de Regimes & Ponto de Equilíbrio CPP
            </h1>
            <p className="text-sm text-slate-400 mt-1 max-w-3xl">
              Análise decisória multicritério entre <strong>Simples Nacional Tradicional</strong>, <strong>Simples Híbrido</strong> e <strong>Lucro Presumido/Real</strong>, com Mini-DRE Gerencial, Comutação de Frete (Art. 18, § 5º-E) e cálculo do Break-Even previdenciário de colaboradores.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowMemoriaCalculo(!showMemoriaCalculo)}
              className="flex items-center gap-2 px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl text-xs font-semibold transition"
            >
              <FileText className="w-4 h-4 text-indigo-400" />
              {showMemoriaCalculo ? 'Ocultar Fundamentação' : 'Ver Memória Jurídica'}
            </button>
          </div>
        </div>

        {/* NAVEGADOR DE ABAS */}
        <div className="flex items-center gap-2 mt-6 pt-4 border-t border-slate-800/80">
          <button
            onClick={() => setActiveTab('comparativo_dre')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition ${
              activeTab === 'comparativo_dre'
                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30'
                : 'bg-slate-800/60 text-slate-400 hover:text-slate-200 hover:bg-slate-800'
            }`}
          >
            <BarChart3 className="w-4 h-4" />
            1. Modelador Estratégico & Mini-DRE (3 Cenários)
          </button>

          <button
            onClick={() => setActiveTab('break_even_cpp')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition ${
              activeTab === 'break_even_cpp'
                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30'
                : 'bg-slate-800/60 text-slate-400 hover:text-slate-200 hover:bg-slate-800'
            }`}
          >
            <Users className="w-4 h-4" />
            2. Ponto de Equilíbrio CPP (Equipe x Regime)
          </button>
        </div>
      </div>

      {/* MEMÓRIA DE CÁLCULO & FUNDAMENTAÇÃO LEGAL (DRAWER/CARD) */}
      {showMemoriaCalculo && (
        <div className="bg-slate-900 border border-indigo-500/40 rounded-2xl p-5 text-xs text-slate-300 space-y-3 shadow-2xl animate-in slide-in-from-top-4 duration-200">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <h3 className="text-sm font-bold text-indigo-300 flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-indigo-400" />
              Fundamentação Legal e Memória de Cálculo Auditável
            </h3>
            <span className="text-[10px] text-slate-500 font-mono">Normas: LC 123/06 • Lei 9.249/95 • LC 214/25 • RIR/18</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
            <div className="bg-slate-950/60 p-3.5 rounded-xl border border-slate-800 space-y-1.5">
              <span className="font-bold text-emerald-400 uppercase text-[11px] block">1. Simples Nacional (LC 123/2006)</span>
              <p className="text-[11px] text-slate-400">
                <strong>Alíquota Efetiva:</strong> [(RBT12 × Alíquota Nominal) - Dedução] ÷ RBT12.
              </p>
              <p className="text-[11px] text-slate-400">
                <strong>Transporte de Cargas (Art. 18, § 5º-E):</strong> Base Anexo III, deduzindo ISS (32% a 33,5%) e somando ICMS do Anexo I (33,5% a 34%).
              </p>
              <p className="text-[11px] text-slate-400">
                <strong>Reforma (LC 214):</strong> Desonera fração IBS/CBS do DAS no Híbrido, mantendo o DAS residual.
              </p>
            </div>

            <div className="bg-slate-950/60 p-3.5 rounded-xl border border-slate-800 space-y-1.5">
              <span className="font-bold text-amber-400 uppercase text-[11px] block">2. Lucro Presumido (Lei 9.249/1995)</span>
              <p className="text-[11px] text-slate-400">
                <strong>Presunções Oficiais:</strong> Combustíveis 1,6% IRPJ / 12% CSLL; Transporte Cargas 8% IRPJ / 12% CSLL; Serviços 32%.
              </p>
              <p className="text-[11px] text-slate-400">
                <strong>Adicional IRPJ (Art. 623 RIR/18):</strong> 10% sobre a parcela da base presumida que exceder R$ 20.000,00/mês.
              </p>
              <p className="text-[11px] text-slate-400">
                <strong>Adições:</strong> Outras receitas e ganhos de capital tributados a 100% (sem aplicar percentual de presunção).
              </p>
            </div>

            <div className="bg-slate-950/60 p-3.5 rounded-xl border border-slate-800 space-y-1.5">
              <span className="font-bold text-cyan-400 uppercase text-[11px] block">3. Previdenciário / CPP (Break-Even)</span>
              <p className="text-[11px] text-slate-400">
                <strong>No Simples (Anexos I a III, V):</strong> CPP inclusa no DAS. Custo não varia com novas contratações.
              </p>
              <p className="text-[11px] text-slate-400">
                <strong>Fora do Simples:</strong> INSS patronal (20%) + RAT/FAP (1% a 3%) + Terceiros (5,2% a 5,8%) sobre folha.
              </p>
              <p className="text-[11px] text-slate-400">
                <strong>Ponto de Equilíbrio:</strong> N* = CPP Simples ÷ (Salário Médio × % Encargos).
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* ABA 1: MODELADOR ESTRATÉGICO & MINI-DRE (3 CENÁRIOS) */}
      {/* ==================================================================== */}
      {activeTab === 'comparativo_dre' && (
        <div className="space-y-6">
          {/* MATRIZ DECISÓRIA DE 4 QUADRANTES (FORNECEDOR X CLIENTE) */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-bold text-white flex items-center gap-2">
                <Layers className="w-4 h-4 text-indigo-400" />
                Matriz Decisória: Fornecedor (Entrada) × Cliente (Saída)
              </h2>
              <span className="text-[11px] text-slate-400">Clique no quadrante para carregar premissas automáticas</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <div
                onClick={() => applyScenario(1)}
                className={`p-3.5 rounded-xl border cursor-pointer transition-all hover:scale-[1.02] ${
                  pctCompraRegimeGeral >= 60 && pctVendaB2B >= 60
                    ? 'bg-emerald-950/40 border-emerald-500/80 shadow-lg shadow-emerald-900/20'
                    : 'bg-slate-950/60 border-slate-800 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Cenário 1</span>
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-300">Simples Híbrido</span>
                </div>
                <h4 className="text-xs font-bold text-white mt-1.5 mb-1">Trânsito Livre de Crédito</h4>
                <p className="text-[11px] text-slate-400 line-clamp-2">
                  <strong>Entrada:</strong> Regime Geral (Crédito Pleno)<br />
                  <strong>Saída:</strong> PJ Tomadora de Crédito B2B
                </p>
              </div>

              <div
                onClick={() => applyScenario(2)}
                className={`p-3.5 rounded-xl border cursor-pointer transition-all hover:scale-[1.02] ${
                  pctCompraRegimeGeral < 40 && pctVendaB2B >= 60
                    ? 'bg-rose-950/40 border-rose-500/80 shadow-lg shadow-rose-900/20'
                    : 'bg-slate-950/60 border-slate-800 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Cenário 2</span>
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-500/20 text-rose-300">Risco / Reprecificar</span>
                </div>
                <h4 className="text-xs font-bold text-white mt-1.5 mb-1">O Estrangulador de Margem</h4>
                <p className="text-[11px] text-slate-400 line-clamp-2">
                  <strong>Entrada:</strong> Simples / Folha Elevada (Pouco Crédito)<br />
                  <strong>Saída:</strong> PJ Tomadora que exige Crédito
                </p>
              </div>

              <div
                onClick={() => applyScenario(3)}
                className={`p-3.5 rounded-xl border cursor-pointer transition-all hover:scale-[1.02] ${
                  pctCompraRegimeGeral >= 60 && pctVendaB2B < 40
                    ? 'bg-amber-950/40 border-amber-500/80 shadow-lg shadow-amber-900/20'
                    : 'bg-slate-950/60 border-slate-800 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Cenário 3</span>
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-300">Simples Tradicional</span>
                </div>
                <h4 className="text-xs font-bold text-white mt-1.5 mb-1">A Armadilha de Custo</h4>
                <p className="text-[11px] text-slate-400 line-clamp-2">
                  <strong>Entrada:</strong> Regime Geral (Gera Crédito)<br />
                  <strong>Saída:</strong> Consumidor Final (PF) / Varejo B2C
                </p>
              </div>

              <div
                onClick={() => applyScenario(4)}
                className={`p-3.5 rounded-xl border cursor-pointer transition-all hover:scale-[1.02] ${
                  pctCompraRegimeGeral < 40 && pctVendaB2B < 40
                    ? 'bg-blue-950/40 border-blue-500/80 shadow-lg shadow-blue-900/20'
                    : 'bg-slate-950/60 border-slate-800 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Cenário 4</span>
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-500/20 text-blue-300">Simples Tradicional</span>
                </div>
                <h4 className="text-xs font-bold text-white mt-1.5 mb-1">Zona de Conforto</h4>
                <p className="text-[11px] text-slate-400 line-clamp-2">
                  <strong>Entrada:</strong> Simples / Serviços Locais<br />
                  <strong>Saída:</strong> Consumidor Final (PF)
                </p>
              </div>
            </div>
          </div>

          {/* PAINEL DIVIDIDO: PARÂMETROS À ESQUERDA | COMPARATIVO E DRE À DIREITA */}
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
            {/* COLUNA ESQUERDA: PARÂMETROS COMPLETOS (5 COLUNAS) */}
            <div className="xl:col-span-5 space-y-4">
              <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 space-y-4 shadow-sm">
                <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2 border-b border-slate-800 pb-3">
                  <Sliders className="w-4 h-4 text-indigo-400" />
                  Parâmetros de Entrada & Enquadramento
                </h3>

                {/* Seletor de Atividade do Lucro Presumido */}
                <div>
                  <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                    Atividade Econômica Oficial (Lei 9.249/95 & LC 123/06)
                  </label>
                  <select
                    value={atividadeKey}
                    onChange={(e) => handleAtividadeChange(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                  >
                    {ATIVIDADES_LUCRO_PRESUMIDO.map((ativ) => (
                      <option key={ativ.id} value={ativ.id}>
                        {ativ.nome} ({ativ.artigoLegal.split(';')[0]})
                      </option>
                    ))}
                  </select>
                  <p className="text-[10px] text-indigo-400 mt-1">
                    Presunção IRPJ: <strong>{(presumidoCalculo.presuncaoIrpj * 100).toFixed(1)}%</strong> | Presunção CSLL: <strong>{(presumidoCalculo.presuncaoCsll * 100).toFixed(1)}%</strong>
                  </p>
                </div>

                {/* Seletor de Anexo do Simples Nacional */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                      Tabela do Simples Nacional
                    </label>
                    <select
                      value={anexoSimplesKey}
                      onChange={(e) => setAnexoSimplesKey(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                    >
                      {Object.values(TABELAS_SIMPLES).map((t) => (
                        <option key={t.id} value={t.id}>{t.nome}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                      Ano de Transição da Reforma
                    </label>
                    <select
                      value={anoTransicao}
                      onChange={(e) => setAnoTransicao(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                    >
                      <option value="2027">2027 / 2028 (CBS 0,9% / IBS 0,1%)</option>
                      <option value="2029">2029 (Início Redução ICMS/ISS)</option>
                      <option value="2030">2030</option>
                      <option value="2031">2031</option>
                      <option value="2032">2032 (Último ano transição)</option>
                      <option value="2033">2033 em diante (Regime Pleno)</option>
                    </select>
                  </div>
                </div>

                {/* RBT12 e Faturamento Mensal */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                      RBT12 - Receita 12 Meses (R$)
                    </label>
                    <input
                      type="number"
                      value={rbt12}
                      step={50000}
                      onChange={(e) => setRbt12(Number(e.target.value) || 0)}
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-indigo-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                      Faturamento do Mês (R$)
                    </label>
                    <input
                      type="number"
                      value={faturamentoMes}
                      step={10000}
                      onChange={(e) => setFaturamentoMes(Number(e.target.value) || 0)}
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                </div>

                {/* Custos de Insumos e Folha de Pagamento */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                      Compras / Insumos / Diesel (R$)
                    </label>
                    <input
                      type="number"
                      value={comprasInsumosMes}
                      step={5000}
                      onChange={(e) => setComprasInsumosMes(Number(e.target.value) || 0)}
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-indigo-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                      Folha Salarial Bruta (R$)
                    </label>
                    <input
                      type="number"
                      value={folhaSalariosMes}
                      step={2000}
                      onChange={(e) => setFolhaSalariosMes(Number(e.target.value) || 0)}
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                </div>

                {/* Outras Despesas e Adições à Base de Cálculo */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                      Outras Despesas Operacionais (R$)
                    </label>
                    <input
                      type="number"
                      value={outrasDespesasMes}
                      step={2000}
                      onChange={(e) => setOutrasDespesasMes(Number(e.target.value) || 0)}
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-indigo-500"
                    />
                    <small className="text-[10px] text-slate-500">Aluguéis, softwares, contador, luz</small>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                      Adições / Ganhos de Capital (R$)
                    </label>
                    <input
                      type="number"
                      value={outrasReceitasAdicoes}
                      step={1000}
                      onChange={(e) => setOutrasReceitasAdicoes(Number(e.target.value) || 0)}
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-indigo-500"
                    />
                    <small className="text-[10px] text-slate-500">Tributado 100% no IRPJ/CSLL Presumido</small>
                  </div>
                </div>

                {/* Sliders B2B e Regime Geral */}
                <div className="space-y-3 pt-2 border-t border-slate-800">
                  <div>
                    <div className="flex justify-between text-[11px] mb-1">
                      <span className="text-slate-300">% Compras de Fornecedores do <strong>Regime Geral</strong>:</span>
                      <span className="font-bold text-indigo-400">{pctCompraRegimeGeral}%</span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={100}
                      value={pctCompraRegimeGeral}
                      onChange={(e) => setPctCompraRegimeGeral(Number(e.target.value))}
                      className="w-full accent-indigo-500 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
                    />
                    <small className="text-[10px] text-slate-500">Gera crédito integral de IBS/CBS na entrada</small>
                  </div>

                  <div>
                    <div className="flex justify-between text-[11px] mb-1">
                      <span className="text-slate-300">% Vendas para <strong>Empresas PJ</strong> (B2B tomadora de crédito):</span>
                      <span className="font-bold text-indigo-400">{pctVendaB2B}%</span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={100}
                      value={pctVendaB2B}
                      onChange={(e) => setPctVendaB2B(Number(e.target.value))}
                      className="w-full accent-indigo-500 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
                    />
                    <small className="text-[10px] text-slate-500">Clientes que exigem crédito fiscal na nota fiscal</small>
                  </div>
                </div>
              </div>

              {/* CARD DE ENQUADRAMENTO DA FAIXA OFICIAL */}
              <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-4 space-y-3">
                <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center justify-between">
                  <span>Enquadramento Oficial Simples Nacional</span>
                  <span className="px-2 py-0.5 bg-indigo-500/20 text-indigo-300 rounded font-mono">
                    {simplesCalculo.faixaNumero}ª Faixa da LC 123
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="p-2 bg-slate-950/80 rounded-xl border border-slate-800">
                    <span className="text-[10px] text-slate-400 block">Alíq. Nominal</span>
                    <strong className="text-xs text-white font-mono">{formatPct(simplesCalculo.aliqNominal)}</strong>
                  </div>
                  <div className="p-2 bg-slate-950/80 rounded-xl border border-slate-800">
                    <span className="text-[10px] text-slate-400 block">Dedução Oficial</span>
                    <strong className="text-xs text-amber-400 font-mono">{formatMoney(simplesCalculo.deducao)}</strong>
                  </div>
                  <div className="p-2 bg-slate-950/80 rounded-xl border border-slate-800">
                    <span className="text-[10px] text-slate-400 block">Alíq. Efetiva DAS</span>
                    <strong className="text-xs text-emerald-400 font-mono">{formatPct(simplesCalculo.aliqEfetiva)}</strong>
                  </div>
                </div>

                <div className="text-[11px] bg-slate-950/60 p-3 rounded-xl border border-slate-800 text-slate-400 leading-relaxed">
                  <strong>Partilha Reforma (LC 214/227):</strong> Do total do DAS, <span className="text-indigo-300 font-bold">{formatPct(simplesCalculo.fracaoIBSCBS)}</span> representam IBS e CBS em {anoTransicao}. No Simples Híbrido, essa parcela é desonerada da guia do DAS ({formatPct(simplesCalculo.aliqResidualDAS)} residual).
                </div>
              </div>
            </div>

            {/* COLUNA DIREITA: COMPARATIVO DOS 3 REGIMES & MINI-DRE (7 COLUNAS) */}
            <div className="xl:col-span-7 space-y-4">
              {/* KPIS DE DESTAQUE */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 relative overflow-hidden">
                  <span className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Simples Tradicional</span>
                  <div className="text-xl font-extrabold text-white font-mono">
                    {formatMoney(dreComparativo.trad.totalTributos)}
                  </div>
                  <span className="text-[11px] text-emerald-400 mt-1 block">
                    Resultado: {formatMoney(dreComparativo.trad.resultadoLiquido)} ({dreComparativo.trad.margemLiquidaPct.toFixed(1)}%)
                  </span>
                </div>

                <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 relative overflow-hidden">
                  <span className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Simples Híbrido</span>
                  <div className="text-xl font-extrabold text-indigo-300 font-mono">
                    {formatMoney(dreComparativo.hib.totalTributos)}
                  </div>
                  <span className="text-[11px] text-indigo-400 mt-1 block">
                    Resultado: {formatMoney(dreComparativo.hib.resultadoLiquido)} ({dreComparativo.hib.margemLiquidaPct.toFixed(1)}%)
                  </span>
                </div>

                <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 relative overflow-hidden">
                  <span className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Lucro Presumido</span>
                  <div className="text-xl font-extrabold text-cyan-300 font-mono">
                    {formatMoney(dreComparativo.pres.totalTributos)}
                  </div>
                  <span className="text-[11px] text-cyan-400 mt-1 block">
                    Resultado: {formatMoney(dreComparativo.pres.resultadoLiquido)} ({dreComparativo.pres.margemLiquidaPct.toFixed(1)}%)
                  </span>
                </div>
              </div>

              {/* DEMONSTRAÇÃO DO RESULTADO DO EXERCÍCIO (MINI-DRE COMPARATIVO) */}
              <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-sm">
                <div className="flex items-center justify-between mb-4 border-b border-slate-800 pb-3">
                  <div>
                    <h3 className="text-sm font-bold text-white flex items-center gap-2">
                      <DollarSign className="w-4 h-4 text-emerald-400" />
                      Mini-DRE Gerencial Comparativo (Caixa Líquido Pós-Tributos)
                    </h3>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Visão contábil e financeira real: do faturamento bruto até o que sobra no bolso do empresário
                    </p>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-slate-800 text-slate-400">
                        <th className="py-2.5 text-left font-semibold">Estrutura do DRE Gerencial</th>
                        <th className="py-2.5 text-right font-semibold">Simples Tradicional</th>
                        <th className="py-2.5 text-right font-semibold">Simples Híbrido</th>
                        <th className="py-2.5 text-right font-semibold">Lucro Presumido</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 font-mono text-[11px]">
                      {/* 1. Receita Bruta */}
                      <tr>
                        <td className="py-2 text-slate-300 font-sans font-medium">
                          (+) Faturamento Bruto do Mês
                        </td>
                        <td className="py-2 text-right text-slate-200">{formatMoney(dreComparativo.trad.recBruta)}</td>
                        <td className="py-2 text-right text-slate-200">{formatMoney(dreComparativo.hib.recBruta)}</td>
                        <td className="py-2 text-right text-slate-200">{formatMoney(dreComparativo.pres.recBruta)}</td>
                      </tr>

                      {/* 2. Impostos sobre Vendas / Frete */}
                      <tr>
                        <td className="py-2 text-rose-400 font-sans font-medium">
                          (-) Tributos s/ Vendas (DAS / IBS-CBS)
                        </td>
                        <td className="py-2 text-right text-rose-400">- {formatMoney(dreComparativo.trad.impostosVendas)}</td>
                        <td className="py-2 text-right text-rose-400">- {formatMoney(dreComparativo.hib.impostosVendas)}</td>
                        <td className="py-2 text-right text-rose-400">- {formatMoney(dreComparativo.pres.impostosVendas)}</td>
                      </tr>

                      {/* 3. Receita Líquida */}
                      <tr className="bg-slate-950/40 font-bold">
                        <td className="py-2 text-slate-300 font-sans">(=) Receita Operacional Líquida</td>
                        <td className="py-2 text-right text-white">{formatMoney(dreComparativo.trad.recLiquida)}</td>
                        <td className="py-2 text-right text-white">{formatMoney(dreComparativo.hib.recLiquida)}</td>
                        <td className="py-2 text-right text-white">{formatMoney(dreComparativo.pres.recLiquida)}</td>
                      </tr>

                      {/* 4. Custos Diretos de Insumos / Mercadorias / Diesel */}
                      <tr>
                        <td className="py-2 text-slate-400 font-sans">
                          (-) Insumos / Mercadorias / Diesel
                        </td>
                        <td className="py-2 text-right text-slate-400">- {formatMoney(dreComparativo.trad.comprasInsumos)}</td>
                        <td className="py-2 text-right text-slate-400">- {formatMoney(dreComparativo.hib.comprasInsumos)}</td>
                        <td className="py-2 text-right text-slate-400">- {formatMoney(dreComparativo.pres.comprasInsumos)}</td>
                      </tr>

                      {/* 5. Margem Bruta */}
                      <tr className="bg-slate-950/40 font-bold">
                        <td className="py-2 text-slate-300 font-sans">(=) Margem Bruta Operacional</td>
                        <td className="py-2 text-right text-white">{formatMoney(dreComparativo.trad.margemBruta)}</td>
                        <td className="py-2 text-right text-white">{formatMoney(dreComparativo.hib.margemBruta)}</td>
                        <td className="py-2 text-right text-white">{formatMoney(dreComparativo.pres.margemBruta)}</td>
                      </tr>

                      {/* 6. Despesas Operacionais e Administrativas */}
                      <tr>
                        <td className="py-2 text-slate-400 font-sans">
                          (-) Outras Despesas Operacionais (Aluguel, Luz, etc.)
                        </td>
                        <td className="py-2 text-right text-slate-400">- {formatMoney(dreComparativo.trad.outrasDespesas)}</td>
                        <td className="py-2 text-right text-slate-400">- {formatMoney(dreComparativo.hib.outrasDespesas)}</td>
                        <td className="py-2 text-right text-slate-400">- {formatMoney(dreComparativo.pres.outrasDespesas)}</td>
                      </tr>

                      {/* 7. Folha de Salários Bruta */}
                      <tr>
                        <td className="py-2 text-slate-400 font-sans">
                          (-) Folha Salarial da Equipe
                        </td>
                        <td className="py-2 text-right text-slate-400">- {formatMoney(dreComparativo.trad.folhaSalarios)}</td>
                        <td className="py-2 text-right text-slate-400">- {formatMoney(dreComparativo.hib.folhaSalarios)}</td>
                        <td className="py-2 text-right text-slate-400">- {formatMoney(dreComparativo.pres.folhaSalarios)}</td>
                      </tr>

                      {/* 8. Encargos Previdenciários Patronais (CPP / INSS) */}
                      <tr>
                        <td className="py-2 text-amber-300 font-sans">
                          (-) Encargos Patronais Folha (CPP/INSS/RAT/Sistema S)
                        </td>
                        <td className="py-2 text-right text-emerald-400">
                          {dreComparativo.trad.encargosPatronais === 0 ? 'R$ 0,00 (incluso DAS)' : `- ${formatMoney(dreComparativo.trad.encargosPatronais)}`}
                        </td>
                        <td className="py-2 text-right text-emerald-400">
                          {dreComparativo.hib.encargosPatronais === 0 ? 'R$ 0,00 (incluso DAS)' : `- ${formatMoney(dreComparativo.hib.encargosPatronais)}`}
                        </td>
                        <td className="py-2 text-right text-amber-300 font-bold">
                          - {formatMoney(dreComparativo.pres.encargosPatronais)}
                        </td>
                      </tr>

                      {/* 9. IRPJ e CSLL no Lucro Presumido */}
                      <tr>
                        <td className="py-2 text-rose-400 font-sans">
                          (-) IRPJ Presumido (c/ Adic. 10%) + CSLL (9%)
                        </td>
                        <td className="py-2 text-right text-slate-500">(incluso no DAS)</td>
                        <td className="py-2 text-right text-slate-500">(incluso no DAS)</td>
                        <td className="py-2 text-right text-rose-400">- {formatMoney(dreComparativo.pres.irpjCsll)}</td>
                      </tr>

                      {/* 10. RESULTADO LÍQUIDO FINAL */}
                      <tr className="bg-indigo-950/40 border-t-2 border-indigo-500 text-sm font-extrabold">
                        <td className="py-3 text-white font-sans">
                          (=) RESULTADO LÍQUIDO FINAL (Caixa Real)
                        </td>
                        <td className={`py-3 text-right ${dreComparativo.trad.resultadoLiquido >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                          {formatMoney(dreComparativo.trad.resultadoLiquido)}
                        </td>
                        <td className={`py-3 text-right ${dreComparativo.hib.resultadoLiquido >= 0 ? 'text-indigo-300' : 'text-rose-400'}`}>
                          {formatMoney(dreComparativo.hib.resultadoLiquido)}
                        </td>
                        <td className={`py-3 text-right ${dreComparativo.pres.resultadoLiquido >= 0 ? 'text-cyan-300' : 'text-rose-400'}`}>
                          {formatMoney(dreComparativo.pres.resultadoLiquido)}
                        </td>
                      </tr>

                      {/* 11. Margem Líquida % */}
                      <tr className="bg-slate-950/80 font-bold">
                        <td className="py-2 text-slate-300 font-sans">Margem Líquida Real (%)</td>
                        <td className="py-2 text-right text-emerald-400">{dreComparativo.trad.margemLiquidaPct.toFixed(1)}%</td>
                        <td className="py-2 text-right text-indigo-300">{dreComparativo.hib.margemLiquidaPct.toFixed(1)}%</td>
                        <td className="py-2 text-right text-cyan-300">{dreComparativo.pres.margemLiquidaPct.toFixed(1)}%</td>
                      </tr>

                      {/* 12. Crédito Transferido para Clientes PJ B2B */}
                      <tr className="bg-emerald-950/20 text-emerald-300 font-bold border-t border-emerald-800/60">
                        <td className="py-2.5 font-sans flex items-center gap-1.5">
                          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                          Crédito Fiscal Transferido para Clientes B2B
                        </td>
                        <td className="py-2.5 text-right font-mono">{formatMoney(dreComparativo.trad.creditoCliente)}</td>
                        <td className="py-2.5 text-right font-mono text-emerald-400">{formatMoney(dreComparativo.hib.creditoCliente)}</td>
                        <td className="py-2.5 text-right font-mono text-emerald-400">{formatMoney(dreComparativo.pres.creditoCliente)}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              {/* DIAGNÓSTICO ESTRATÉGICO AUTOMATIZADO */}
              <div className={`p-4 rounded-2xl border ${
                dreComparativo.trad.resultadoLiquido > dreComparativo.hib.resultadoLiquido && pctVendaB2B < 50
                  ? 'bg-emerald-950/40 border-emerald-500/80 text-emerald-200'
                  : pctVendaB2B >= 60 && pctCompraRegimeGeral >= 60
                  ? 'bg-indigo-950/40 border-indigo-500/80 text-indigo-200'
                  : 'bg-amber-950/40 border-amber-500/80 text-amber-200'
              }`}>
                <div className="flex items-center gap-2 font-bold text-sm mb-1">
                  <Sparkles className="w-4 h-4" />
                  Diagnóstico Estratégico do Radar de Conformidade
                </div>
                <p className="text-xs leading-relaxed opacity-90">
                  {pctVendaB2B >= 60 && pctCompraRegimeGeral >= 60 ? (
                    <>
                      <strong>Recomendação: Simples Híbrido (IBS/CBS por Fora).</strong> Sua empresa fatura predominantemente para PJs ({pctVendaB2B}%) e adquire {pctCompraRegimeGeral}% dos seus insumos com crédito pleno no Regime Geral. A vantagem comercial gerada na nota para os seus clientes ({formatMoney(dreComparativo.hib.creditoCliente)} em créditos) neutraliza o impacto de caixa e fortalece sua retenção de clientes contra concorrentes do Lucro Real.
                    </>
                  ) : pctVendaB2B >= 60 && pctCompraRegimeGeral < 50 ? (
                    <>
                      <strong>Alerta de Risco Crítico de Caixa:</strong> Seus clientes PJ demandam crédito fiscal pleno ({pctVendaB2B}% B2B), mas suas compras não geram lastro de créditos suficiente ({pctCompraRegimeGeral}% no Regime Geral). Ir para o Híbrido sem renegociar preços provocará queda de margem líquida de {dreComparativo.trad.margemLiquidaPct.toFixed(1)}% para {dreComparativo.hib.margemLiquidaPct.toFixed(1)}%. Reprecifique suas tabelas de frete/produtos antes de oficializar a opção.
                    </>
                  ) : (
                    <>
                      <strong>Recomendação: Manter Simples Tradicional (Tudo no DAS).</strong> A maior parte das suas vendas destina-se a clientes que não tomam crédito tributário ({100 - pctVendaB2B}% consumidor final/varejo). O Simples Tradicional maximiza seu resultado líquido de caixa ({formatMoney(dreComparativo.trad.resultadoLiquido)}) e poupa a empresa da complexidade do débito e crédito da Reforma.
                    </>
                  )}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* ABA 2: SIMULADOR PONTO DE EQUILÍBRIO CPP (EQUIPE X REGIME) */}
      {/* ==================================================================== */}
      {activeTab === 'break_even_cpp' && (
        <div className="space-y-6">
          {/* BANNER DE ALERTA DE EXCEÇÃO JURÍDICA: ANEXO IV */}
          {anexoSimplesKey === 'anexo4' && (
            <div className="bg-amber-950/60 border border-amber-500/80 rounded-2xl p-4 flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
              <div>
                <h4 className="text-xs font-bold text-amber-300">
                  Exceção Legal da LC 123/2006 (Art. 18, § 5º-C) — Anexo IV
                </h4>
                <p className="text-xs text-slate-300 mt-1">
                  Nas atividades enquadradas no <strong>Anexo IV</strong> (construção civil, obras, vigilância, limpeza e advocacia), a <strong>Contribuição Previdenciária Patronal (CPP) NÃO está inclusa na guia do DAS</strong>. As empresas desse anexo recolhem o INSS patronal de 20% diretamente na folha de pagamento via DCTFWeb/GPS, não existindo diferencial de custo de CPP frente ao Lucro Presumido ou Real.
                </p>
              </div>
            </div>
          )}

          {/* PARÂMETROS DO SIMULADOR DE CPP */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 space-y-4">
            <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2 border-b border-slate-800 pb-3">
              <Users className="w-4 h-4 text-indigo-400" />
              Parâmetros de Custo Previdenciário (CPP) da Equipe
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                  Faturamento do Mês (R$)
                </label>
                <input
                  type="number"
                  value={faturamentoMes}
                  step={10000}
                  onChange={(e) => setFaturamentoMes(Number(e.target.value) || 0)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-indigo-500"
                />
                <small className="text-[10px] text-slate-500">Base para calcular o CPP no DAS</small>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                  Salário-Base Médio p/ Colaborador (R$)
                </label>
                <input
                  type="number"
                  value={salarioBaseColaborador}
                  step={200}
                  onChange={(e) => setSalarioBaseColaborador(Number(e.target.value) || 0)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-indigo-500"
                />
                <small className="text-[10px] text-slate-500">Salário médio contratado na CLT</small>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                  Colaboradores na Equipe Atual
                </label>
                <input
                  type="number"
                  value={qtdColaboradoresAtual}
                  min={1}
                  max={100}
                  onChange={(e) => setQtdColaboradoresAtual(Number(e.target.value) || 1)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-indigo-500"
                />
                <small className="text-[10px] text-slate-500">Quantidade real de funcionários hoje</small>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                  Encargos Patronais Totais Fora do Simples
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    value={inssPatronalPct + ratFapPct + sistemaSTerceirosPct}
                    readOnly
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-indigo-400 font-bold font-mono"
                  />
                  <span className="text-xs text-slate-400 font-mono">%</span>
                </div>
                <small className="text-[10px] text-slate-500">INSS 20% + RAT {ratFapPct}% + Terceiros {sistemaSTerceirosPct}%</small>
              </div>
            </div>

            {/* SLIDER DE AJUSTE FINO DE ENCARGOS PATRONAIS */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-3 border-t border-slate-800 text-xs">
              <div>
                <label className="text-[11px] text-slate-400">INSS Patronal Básico:</label>
                <div className="flex items-center gap-2 mt-1">
                  <input
                    type="number"
                    value={inssPatronalPct}
                    step={0.5}
                    onChange={(e) => setInssPatronalPct(Number(e.target.value))}
                    className="bg-slate-950 border border-slate-800 rounded-lg px-2 py-1 text-white font-mono w-20 text-center"
                  />
                  <span className="text-slate-500 text-[10px]">(Geral 20%)</span>
                </div>
              </div>

              <div>
                <label className="text-[11px] text-slate-400">RAT / FAP Ajustado:</label>
                <div className="flex items-center gap-2 mt-1">
                  <input
                    type="number"
                    value={ratFapPct}
                    step={0.5}
                    onChange={(e) => setRatFapPct(Number(e.target.value))}
                    className="bg-slate-950 border border-slate-800 rounded-lg px-2 py-1 text-white font-mono w-20 text-center"
                  />
                  <span className="text-slate-500 text-[10px]">(1% a 3%)</span>
                </div>
              </div>

              <div>
                <label className="text-[11px] text-slate-400">Sistema S / Terceiros:</label>
                <div className="flex items-center gap-2 mt-1">
                  <input
                    type="number"
                    value={sistemaSTerceirosPct}
                    step={0.1}
                    onChange={(e) => setSistemaSTerceirosPct(Number(e.target.value))}
                    className="bg-slate-950 border border-slate-800 rounded-lg px-2 py-1 text-white font-mono w-20 text-center"
                  />
                  <span className="text-slate-500 text-[10px]">(Frete 5,2% | Comércio 5,8%)</span>
                </div>
              </div>
            </div>
          </div>

          {/* CARD DE VEREDITO E PONTO DE EQUILÍBRIO (BREAK-EVEN POINT) */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-gradient-to-br from-indigo-950/60 to-slate-900 border border-indigo-500/50 rounded-2xl p-5 shadow-xl">
              <span className="text-[10px] font-bold text-indigo-300 uppercase tracking-wider block mb-1">
                Ponto de Equilíbrio Exato (N*)
              </span>
              <div className="text-3xl font-extrabold text-white font-mono flex items-baseline gap-2">
                {breakEvenCpp.pontoEquilibrioArredondado} <span className="text-sm font-normal text-slate-400">colaboradores</span>
              </div>
              <p className="text-xs text-indigo-200/90 mt-2">
                Com até <strong>{breakEvenCpp.pontoEquilibrioArredondado - 1} funcionários</strong>, o Lucro Presumido/Real custa menos em previdência. A partir de <strong>{breakEvenCpp.pontoEquilibrioArredondado} colaboradores</strong>, o Simples Nacional passa a ser mais vantajoso.
              </p>
            </div>

            <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                CPP Embutido no Simples (Constante)
              </span>
              <div className="text-2xl font-bold text-emerald-400 font-mono">
                {formatMoney(breakEvenCpp.cppSimplesTotal)} <span className="text-xs text-slate-400 font-normal">/mês</span>
              </div>
              <p className="text-xs text-slate-400 mt-2">
                Representa <strong>{(simplesCalculo.pctReparticaoCpp * 100).toFixed(1)}%</strong> do seu DAS ({formatPct(simplesCalculo.aliqEfetiva)} de alíquota efetiva). Não aumenta mesmo que contrate 100 funcionários.
              </p>
            </div>

            <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                Diagnóstico da Sua Equipe Atual ({qtdColaboradoresAtual} func.)
              </span>
              <div className={`text-2xl font-bold font-mono ${breakEvenCpp.economiaEquipeAtual >= 0 ? 'text-emerald-400' : 'text-amber-400'}`}>
                {breakEvenCpp.economiaEquipeAtual >= 0 ? '+ ' : '- '}
                {formatMoney(Math.abs(breakEvenCpp.economiaEquipeAtual))} <span className="text-xs text-slate-400 font-normal">/mês</span>
              </div>
              <p className="text-xs text-slate-400 mt-2">
                {breakEvenCpp.economiaEquipeAtual >= 0 ? (
                  <span className="text-emerald-300">
                    O Simples Nacional está gerando uma <strong>economia de {formatMoney(breakEvenCpp.economiaEquipeAtual)}/mês</strong> em relação aos encargos que pagaria no Presumido.
                  </span>
                ) : (
                  <span className="text-amber-300">
                    Para a equipe enxuta atual ({qtdColaboradoresAtual} colaboradores), a fatia de CPP no Simples é <strong>{formatMoney(Math.abs(breakEvenCpp.economiaEquipeAtual))} mais cara</strong> do que no Regime Normal.
                  </span>
                )}
              </p>
            </div>
          </div>

          {/* GRÁFICO SVG INTERATIVO DE CURVAS CRUZADAS */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-3">
              <div>
                <h4 className="text-sm font-bold text-white flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-indigo-400" />
                  Gráfico das Curvas de Custo Previdenciário (Simples vs Regime Normal)
                </h4>
                <p className="text-[11px] text-slate-400">
                  Cruzamento da linha constante do Simples com a reta ascendente do Regime Normal
                </p>
              </div>

              <div className="flex items-center gap-4 text-xs font-semibold">
                <div className="flex items-center gap-2">
                  <span className="w-3.5 h-1 bg-emerald-400 rounded-full inline-block" />
                  <span className="text-slate-300">CPP no Simples Nacional (Constante)</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-3.5 h-1 bg-indigo-400 rounded-full inline-block" />
                  <span className="text-slate-300">CPP Fora do Simples (Sobe com Equipe)</span>
                </div>
              </div>
            </div>

            {/* RENDERIZAÇÃO SVG RESPONSIVA */}
            <div className="w-full h-72 relative">
              <svg viewBox="0 0 800 260" className="w-full h-full overflow-visible">
                {/* Linhas de Grade de Fundo */}
                <line x1="50" y1="20" x2="780" y2="20" stroke="#1e293b" strokeDasharray="3 3" />
                <line x1="50" y1="80" x2="780" y2="80" stroke="#1e293b" strokeDasharray="3 3" />
                <line x1="50" y1="140" x2="780" y2="140" stroke="#1e293b" strokeDasharray="3 3" />
                <line x1="50" y1="200" x2="780" y2="200" stroke="#1e293b" strokeDasharray="3 3" />

                {/* Eixos */}
                <line x1="50" y1="220" x2="780" y2="220" stroke="#475569" strokeWidth="1.5" />
                <line x1="50" y1="20" x2="50" y2="220" stroke="#475569" strokeWidth="1.5" />

                {/* Escalas de Cálculo para o SVG */}
                {(() => {
                  const maxN = maxColaboradoresSimulacao;
                  const maxVal = Math.max(breakEvenCpp.cppSimplesTotal * 1.6, maxN * breakEvenCpp.cppUnitarioForaSimples * 1.1);

                  const getX = (n: number) => 50 + (n / maxN) * 720;
                  const getY = (val: number) => 220 - (val / (maxVal || 1)) * 190;

                  const ySimples = getY(breakEvenCpp.cppSimplesTotal);
                  const xBreakEven = getX(breakEvenCpp.pontoEquilibrioExato);

                  return (
                    <g>
                      {/* Curva do Simples Nacional (Linha Reta Horizontal) */}
                      <line
                        x1="50"
                        y1={ySimples}
                        x2="780"
                        y2={ySimples}
                        stroke="#10b981"
                        strokeWidth="2.5"
                      />

                      {/* Curva Fora do Simples (Reta Inclinada Ascendente) */}
                      <line
                        x1={getX(0)}
                        y1={getY(0)}
                        x2={getX(maxN)}
                        y2={getY(maxN * breakEvenCpp.cppUnitarioForaSimples)}
                        stroke="#6366f1"
                        strokeWidth="2.5"
                      />

                      {/* Linha Tracejada no Ponto de Equilíbrio N* */}
                      {breakEvenCpp.pontoEquilibrioExato > 0 && breakEvenCpp.pontoEquilibrioExato <= maxN && (
                        <>
                          <line
                            x1={xBreakEven}
                            y1={ySimples}
                            x2={xBreakEven}
                            y2="220"
                            stroke="#f59e0b"
                            strokeDasharray="4 4"
                            strokeWidth="1.5"
                          />

                          {/* Círculo do Ponto de Equilíbrio */}
                          <circle
                            cx={xBreakEven}
                            cy={ySimples}
                            r="6"
                            fill="#f59e0b"
                            className="animate-pulse"
                          />

                          {/* Rótulo Flutuante no Break-Even */}
                          <rect
                            x={Math.min(700, Math.max(60, xBreakEven - 50))}
                            y={Math.max(10, ySimples - 35)}
                            width="100"
                            height="24"
                            rx="6"
                            fill="#0f172a"
                            stroke="#f59e0b"
                            strokeWidth="1"
                          />
                          <text
                            x={Math.min(700, Math.max(60, xBreakEven - 50)) + 50}
                            y={Math.max(10, ySimples - 35) + 16}
                            textAnchor="middle"
                            fill="#fcd34d"
                            fontSize="10"
                            fontWeight="bold"
                            fontFamily="monospace"
                          >
                            N* = {breakEvenCpp.pontoEquilibrioArredondado} func.
                          </text>
                        </>
                      )}

                      {/* Marcador da Equipe Atual */}
                      {qtdColaboradoresAtual <= maxN && (
                        <g>
                          <line
                            x1={getX(qtdColaboradoresAtual)}
                            y1="20"
                            x2={getX(qtdColaboradoresAtual)}
                            y2="220"
                            stroke="#38bdf8"
                            strokeDasharray="2 2"
                            strokeWidth="1"
                          />
                          <circle
                            cx={getX(qtdColaboradoresAtual)}
                            cy={getY(qtdColaboradoresAtual * breakEvenCpp.cppUnitarioForaSimples)}
                            r="4"
                            fill="#38bdf8"
                          />
                        </g>
                      )}

                      {/* Rótulos dos Eixos */}
                      <text x="780" y="240" textAnchor="end" fill="#94a3b8" fontSize="10">
                        Quantidade de Colaboradores (n)
                      </text>
                      <text x="50" y="15" textAnchor="start" fill="#94a3b8" fontSize="10">
                        Custo Mensal CPP (R$)
                      </text>
                    </g>
                  );
                })()}
              </svg>
            </div>
          </div>

          {/* TABELA EVOLUTIVA COLABORADOR A COLABORADOR */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-sm">
            <div className="flex items-center justify-between mb-4 border-b border-slate-800 pb-3">
              <div>
                <h4 className="text-sm font-bold text-white flex items-center gap-2">
                  <FileText className="w-4 h-4 text-indigo-400" />
                  Tabela de Evolução Previdenciária (Colaborador a Colaborador)
                </h4>
                <p className="text-[11px] text-slate-400">
                  Simulação detalhada de 1 até {maxColaboradoresSimulacao} colaboradores com receita constante de {formatMoney(faturamentoMes)}
                </p>
              </div>

              <div className="flex items-center gap-2 text-xs">
                <span className="text-slate-400">Ver até:</span>
                <select
                  value={maxColaboradoresSimulacao}
                  onChange={(e) => setMaxColaboradoresSimulacao(Number(e.target.value))}
                  className="bg-slate-950 border border-slate-700 rounded-lg px-2 py-1 text-white font-mono text-xs"
                >
                  <option value={15}>15 func.</option>
                  <option value={25}>25 func.</option>
                  <option value={35}>35 func.</option>
                  <option value={50}>50 func.</option>
                </select>
              </div>
            </div>

            <div className="overflow-x-auto max-h-96">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-slate-950 border-b border-slate-800 text-slate-400">
                  <tr>
                    <th className="py-2.5 px-3 text-left font-semibold">Qtd. Colaboradores (n)</th>
                    <th className="py-2.5 px-3 text-right font-semibold">Folha Salarial Bruta</th>
                    <th className="py-2.5 px-3 text-right font-semibold">CPP no Simples Nacional</th>
                    <th className="py-2.5 px-3 text-right font-semibold">CPP Fora do Simples (Presumido)</th>
                    <th className="py-2.5 px-3 text-right font-semibold">Diferença Mensal</th>
                    <th className="py-2.5 px-3 text-center font-semibold">Regime Mais Barato</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-mono text-[11px]">
                  {breakEvenCpp.evolucaoColaboradores.map((item) => {
                    const isBreakEvenRow = item.n === breakEvenCpp.pontoEquilibrioArredondado;
                    const isCurrentRow = item.n === qtdColaboradoresAtual;

                    return (
                      <tr
                        key={item.n}
                        className={`transition ${
                          isBreakEvenRow
                            ? 'bg-indigo-950/40 font-bold border-y border-indigo-500/80'
                            : isCurrentRow
                            ? 'bg-sky-950/30'
                            : 'hover:bg-slate-950/40'
                        }`}
                      >
                        <td className="py-2 px-3 text-slate-300 font-sans font-medium flex items-center gap-2">
                          <span>{item.n} colaborador{item.n > 1 ? 'es' : ''}</span>
                          {isBreakEvenRow && (
                            <span className="px-1.5 py-0.2 bg-amber-500/20 text-amber-300 border border-amber-500/40 rounded text-[9px]">
                              PONTO DE EQUILÍBRIO
                            </span>
                          )}
                          {isCurrentRow && (
                            <span className="px-1.5 py-0.2 bg-sky-500/20 text-sky-300 border border-sky-500/40 rounded text-[9px]">
                              EQUIPE ATUAL
                            </span>
                          )}
                        </td>
                        <td className="py-2 px-3 text-right text-slate-400">{formatMoney(item.folhaBruta)}</td>
                        <td className="py-2 px-3 text-right text-emerald-400 font-bold">{formatMoney(item.cppSimples)}</td>
                        <td className="py-2 px-3 text-right text-indigo-300">{formatMoney(item.cppForaSimples)}</td>
                        <td className={`py-2 px-3 text-right font-bold ${item.diferenca >= 0 ? 'text-emerald-400' : 'text-amber-400'}`}>
                          {item.diferenca >= 0 ? '+ ' : '- '}
                          {formatMoney(Math.abs(item.diferenca))}
                        </td>
                        <td className="py-2 px-3 text-center">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            item.diferenca >= 0
                              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                              : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                          }`}>
                            {item.maisVantajoso}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
