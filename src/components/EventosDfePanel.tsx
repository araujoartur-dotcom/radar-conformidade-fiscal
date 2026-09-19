import React, { useState, useEffect, useMemo } from 'react';
import {
  Send, CheckCircle2, AlertCircle, ShieldCheck, Clock, RefreshCw, FileSignature,
  FileCode, Sparkles, Filter, Info, ChevronRight, Layers, Globe, Key, Database,
  Settings, Server, Cpu, Radio, Terminal, FileText, Check, HelpCircle, ArrowRight,
  AlertTriangle, ShieldAlert, Calendar, DollarSign, Hash, Package, CheckSquare, XCircle,
  Search, Copy
} from 'lucide-react';
import { DfeXmlItem, EventoDfeRequest, TipoDFe, DadosEventoEstruturado, CertificadoA1 } from '../types';
import { CATALOGO_EVENTOS_DFE, getEventosPorTipoDfe } from '../utils/dfeEventsCatalog';
import { useAuth } from '../contexts/AuthContext';
import { useApi } from '../hooks/useApi';
import { getApiBaseUrl } from '../utils/apiConfig';
import { formatBrasiliaDateTime } from '../utils/timezone';
import { useKpis } from '../contexts/KpiContext';

interface EventosDfePanelProps {
  selectedDfe?: DfeXmlItem | null;
  dfeList: DfeXmlItem[];
  onEventProcessed?: (chaveAcesso: string, eventoTipo: string) => void;
  certificado?: CertificadoA1;
  onNavigateToCarteira?: () => void;
}

export const EventosDfePanel: React.FC<EventosDfePanelProps> = ({
  selectedDfe,
  dfeList,
  onEventProcessed,
  certificado,
  onNavigateToCarteira
}) => {
  const { token, empresaAtiva } = useAuth();
  const { kpis, totalGeral } = useKpis();
  const currentKpis = totalGeral || kpis;
  // Main Panel Tab
  const [activeTab, setActiveTab] = useState<'emissor' | 'notas_tecnicas' | 'schema_generator'>('emissor');

  // Document Type Filter for Events
  const [selectedTipoDfe, setSelectedTipoDfe] = useState<TipoDFe>('NFe');
  
  // Normalização do tipo para garantir compatibilidade entre 'NFSe' e 'NFS-e'
  const isMatchingTipo = (docTipo?: string, targetTipo?: string) => {
    if (!docTipo || !targetTipo) return false;
    const c1 = docTipo.toUpperCase().replace(/[^A-Z]/g, '');
    const c2 = targetTipo.toUpperCase().replace(/[^A-Z]/g, '');
    return c1 === c2;
  };

  // Available documents of selected DFe type
  const docsDoTipo = useMemo(() => {
    return dfeList.filter(d => isMatchingTipo(d.tipo, selectedTipoDfe));
  }, [dfeList, selectedTipoDfe]);

  // Filtro de busca textual na lista de documentos (por chave de 44 ou 50 posições, número ou fornecedor)
  const [docFilterText, setDocFilterText] = useState<string>('');
  const [copiedChave, setCopiedChave] = useState<boolean>(false);

  const filteredDocsDoTipo = useMemo(() => {
    if (!docFilterText.trim()) return docsDoTipo;
    const q = docFilterText.toLowerCase().trim();
    return docsDoTipo.filter(d => 
      d.chaveAcesso?.toLowerCase().includes(q) ||
      d.numero?.toLowerCase().includes(q) ||
      d.emitenteNome?.toLowerCase().includes(q) ||
      d.emitenteCnpj?.toLowerCase().includes(q)
    );
  }, [docsDoTipo, docFilterText]);

  // Active selected document
  const [activeChave, setActiveChave] = useState<string>(
    selectedDfe && isMatchingTipo(selectedDfe.tipo, selectedTipoDfe)
      ? selectedDfe.chaveAcesso
      : docsDoTipo[0]?.chaveAcesso || dfeList[0]?.chaveAcesso || ''
  );

  // Sync active chave if user changes selected DFe type tab
  const handleSelectTipoDfe = (tipo: TipoDFe) => {
    setSelectedTipoDfe(tipo);
    setDocFilterText('');
    const firstDoc = dfeList.find(d => isMatchingTipo(d.tipo, tipo));
    if (firstDoc) {
      setActiveChave(firstDoc.chaveAcesso);
    }
  };

  const currentDocument = useMemo(() => {
    const cleanActive = (activeChave || '').replace(/\D/g, '');
    return dfeList.find(d => (d.chaveAcesso || '').replace(/\D/g, '') === cleanActive) || selectedDfe || dfeList[0];
  }, [dfeList, activeChave, selectedDfe]);

  // Define colors for specific event categories/badges
  const getBadgeColors = (nomeEvento: string, categoria: string, codigo: string) => {
    if (codigo === '100' || nomeEvento.includes('Autorização')) return 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20';
    if (codigo === '110111' || nomeEvento.includes('Cancelamento')) return 'bg-rose-500/10 text-rose-500 border-rose-500/20';
    if (codigo === '110110' || nomeEvento.includes('Carta de Correção') || nomeEvento.includes('CC-e')) return 'bg-amber-500/10 text-amber-500 border-amber-500/20';
    if (categoria === 'fisco' || nomeEvento.includes('Passagem') || nomeEvento.includes('Barreira') || codigo.startsWith('610')) return 'bg-purple-500/10 text-purple-400 border-purple-500/20';
    if (nomeEvento.includes('SUFRAMA') || codigo.startsWith('990')) return 'bg-orange-500/10 text-orange-400 border-orange-500/20';
    if (nomeEvento.includes('Comprovante') || nomeEvento.includes('Logística') || codigo === '110130') return 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20';
    if (nomeEvento.includes('Exportação') || codigo === '110150') return 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20';
    if (categoria === 'destinatario') return 'bg-blue-500/10 text-blue-400 border-blue-500/20';
    if (categoria === 'reforma_tributaria') return 'bg-fuchsia-500/10 text-fuchsia-400 border-fuchsia-500/20';
    return 'bg-slate-700 text-slate-300 border-slate-600';
  };

  // Category Filter for Events
  const [categoriaFilter, setCategoriaFilter] = useState<'todos' | 'destinatario' | 'emitente' | 'tomador' | 'reforma_tributaria' | 'contingencia' | 'terceiros'>('todos');

  // Selected Event Definition
  const eventosDisponiveis = getEventosPorTipoDfe(selectedTipoDfe);
  const eventosFiltrados = eventosDisponiveis.filter(e => {
    if (categoriaFilter === 'todos') return true;
    if (categoriaFilter === 'terceiros') return e.categoria === 'destinatario';
    return e.categoria === categoriaFilter;
  });

  const [selectedEventoId, setSelectedEventoId] = useState<string>(eventosDisponiveis[0]?.id || 'nfe-210210');
  const activeEventoDef = CATALOGO_EVENTOS_DFE.find(e => e.id === selectedEventoId) || eventosDisponiveis[0] || CATALOGO_EVENTOS_DFE[0];

  // Justificativas Textuais & Padrão
  const [justificativa, setJustificativa] = useState<string>('');
  const [justificativaPadraoSelecionada, setJustificativaPadraoSelecionada] = useState<string>('');
  const [isTransmitting, setIsTransmitting] = useState(false);

  // Campos Estruturados Específicos (NT 2025.002-RTC / NT 2025.001 / NT 009)
  const [dataPrevisaoEntrega, setDataPrevisaoEntrega] = useState<string>(
    new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  );
  const [numItem, setNumItem] = useState<number>(1);
  const [quantidadeItem, setQuantidadeItem] = useState<number>(1);
  const [unidadeItem, setUnidadeItem] = useState<string>('UN');
  const [valorIbsItem, setValorIbsItem] = useState<number>(25.50);
  const [valorCbsItem, setValorCbsItem] = useState<number>(18.20);
  const [codigoCreditoPresumido, setCodigoCreditoPresumido] = useState<string>('01');
  const [baseCalculoCredPres, setBaseCalculoCredPres] = useState<number>(currentDocument?.valorTotal || 1000);
  const [aliqCredPres, setAliqCredPres] = useState<number>(55);
  const [indicadorAceitacao, setIndicadorAceitacao] = useState<0 | 1>(1);

  const handleSelectEvento = (id: string) => {
    setSelectedEventoId(id);
    setJustificativa('');
    setJustificativaPadraoSelecionada('');
  };

  const handleSelectJustificativaPadrao = (texto: string) => {
    setJustificativaPadraoSelecionada(texto);
    setJustificativa(texto);
  };

  const { get } = useApi();

  // Transmitted Event History
  const [transmittedLog, setTransmittedLog] = useState<EventoDfeRequest[]>([]);
  const [historicoFiltro, setHistoricoFiltro] = useState<'todos' | 'nota_ativa' | 'terceiros'>('todos');
  const [isConsultandoSefaz, setIsConsultandoSefaz] = useState<boolean>(false);
  const [consultaSefazResult, setConsultaSefazResult] = useState<{ tipo: 'success' | 'warning' | 'error'; msg: string } | null>(null);

  const loadEventos = async () => {
    try {
      const cnpjParam = (empresaAtiva?.cnpjCompleto || (empresaAtiva as any)?.cnpj)
        ? `&cnpj=${encodeURIComponent(empresaAtiva?.cnpjCompleto || (empresaAtiva as any)?.cnpj)}`
        : '';
      const res = await get<{ success: boolean; eventos: any[] }>(`/sefaz/eventos?limit=150${cnpjParam}`);
      const payload = (res as any)?.data || res;
      const evts = payload?.eventos || payload?.data || [];
      if (Array.isArray(evts)) {
        const mapped: EventoDfeRequest[] = evts.map((evt: any) => ({
          id: evt.id,
          chaveAcesso: evt.chave_acesso,
          tipoDfe: (evt.tipo_dfe as TipoDFe) || 'NFe',
          tipoEventoId: '',
          codigoEvento: evt.codigo_evento,
          nomeEvento: evt.nome_evento,
          categoria: evt.categoria || 'destinatario',
          dataHora: evt.data_hora,
          protocoloSeFaz: evt.protocolo_sefaz || '',
          status: evt.status === 'processado' ? 'processado' : (evt.status === 'rejeitado' ? 'rejeitado' : 'pendente'),
          justificativa: evt.justificativa || undefined,
          dadosEstruturados: evt.dados_estruturados ? (typeof evt.dados_estruturados === 'string' ? JSON.parse(evt.dados_estruturados) : evt.dados_estruturados) : undefined,
          origemEvento: evt.origem_evento || 'proprio',
          autorCnpj: evt.autor_cnpj || '',
          detalhesReforma: evt.detalhes_reforma ? (typeof evt.detalhes_reforma === 'string' ? JSON.parse(evt.detalhes_reforma) : evt.detalhes_reforma) : undefined
        }));
        setTransmittedLog(prev => {
          const existingIds = new Set(mapped.map(m => m.id));
          const keepInMem = prev.filter(p => 
            !existingIds.has(p.id) && 
            mapped.every(m => !(m.chaveAcesso === p.chaveAcesso && m.codigoEvento === p.codigoEvento && m.protocoloSeFaz === p.protocoloSeFaz))
          );
          return [...keepInMem, ...mapped];
        });
      }
    } catch {
      // Fallback
    }
  };

  useEffect(() => {
    loadEventos();
  }, [empresaAtiva?.id, (empresaAtiva as any)?.cnpjCompleto, currentDocument?.id]);

  // Consulta Completa ao WebService SEFAZ de Situação (Tudão: NFeConsultaProtocolo4 / CTeConsultaV4)
  const handleConsultarEventosSefaz = async () => {
    if (!activeChave) {
      alert('Selecione ou informe a chave do documento fiscal para consultar os eventos na SEFAZ.');
      return;
    }
    setIsConsultandoSefaz(true);
    setConsultaSefazResult(null);
    try {
      const response = await fetch(`${getApiBaseUrl()}/sefaz/consulta-situacao`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
          'x-empresa-ativa-id': empresaAtiva?.id || ''
        },
        body: JSON.stringify({
          empresaId: empresaAtiva?.id,
          cnpj: empresaAtiva?.cnpjCompleto || (empresaAtiva as any)?.cnpj,
          chNFe: activeChave,
          tipoDoc: selectedTipoDfe === 'CTe' ? 'CTe' : 'NFe',
          tpAmb: '1'
        })
      });

      const data = await response.json();
      if (response.ok && data.success) {
        const totalEvt = (data.eventos?.length || 0);
        setConsultaSefazResult({
          tipo: 'success',
          msg: `Consulta SEFAZ concluída (cStat ${data.cStat}: ${data.xMotivo}). ${totalEvt} evento(s) vinculado(s) baixado(s) com sucesso.`
        });

        // Injetar imediatamente os eventos da SEFAZ no histórico em tela
        if (Array.isArray(data.eventos) && data.eventos.length > 0) {
          const cleanTargetChave = (activeChave || '').replace(/\D/g, '');
          const mappedSefaz: EventoDfeRequest[] = data.eventos.map((evt: any) => ({
            id: `evt-${cleanTargetChave}-${evt.codigoEvento}-${evt.protocolo || Date.now()}`,
            chaveAcesso: (evt.chaveAcesso || cleanTargetChave).replace(/\D/g, ''),
            tipoDfe: selectedTipoDfe,
            tipoEventoId: '',
            codigoEvento: evt.codigoEvento,
            nomeEvento: evt.nomeEvento,
            categoria: evt.codigoEvento.startsWith('210') || evt.codigoEvento.startsWith('6101') ? 'destinatario' : 
              (evt.codigoEvento.startsWith('610') || evt.codigoEvento.startsWith('990') ? 'fisco' : 'emitente'),
            dataHora: evt.dataHora,
            protocoloSeFaz: evt.protocolo || '',
            status: 'processado',
            justificativa: evt.justificativa,
            dadosEstruturados: evt.detalhes,
            origemEvento: evt.origemEvento || 'proprio',
            autorCnpj: evt.autorCnpj || '',
          }));
          setTransmittedLog(prev => {
            const existingKeys = new Set(prev.map(p => `${(p.chaveAcesso || '').replace(/\D/g, '')}_${p.codigoEvento}_${p.protocoloSeFaz}`));
            const newOnes = mappedSefaz.filter(m => !existingKeys.has(`${m.chaveAcesso}_${m.codigoEvento}_${m.protocoloSeFaz}`));
            return [...newOnes, ...prev];
          });
        }

        await loadEventos();
      } else {
        setConsultaSefazResult({
          tipo: data.cStat === '999' ? 'error' : 'warning',
          msg: data.xMotivo || data.message || `Rejeição SEFAZ [cStat ${data.cStat || 'Desconhecido'}]`
        });
        await loadEventos();
      }
    } catch (err: any) {
      setConsultaSefazResult({
        tipo: 'error',
        msg: `Falha na comunicação com a SEFAZ: ${err.message}`
      });
    } finally {
      setIsConsultandoSefaz(false);
    }
  };

  const displayedEventos = useMemo(() => {
    const cleanActive = (activeChave || '').replace(/\D/g, '');
    return transmittedLog.filter(log => {
      if (historicoFiltro === 'nota_ativa') {
        return (log.chaveAcesso || '').replace(/\D/g, '') === cleanActive;
      }
      if (historicoFiltro === 'terceiros') {
        return log.origemEvento === 'terceiro_destinatario' || 
               ['210220', '210240', '210200', '210210'].includes(log.codigoEvento);
      }
      return true;
    });
  }, [transmittedLog, historicoFiltro, activeChave]);

  const handleTransmitEvent = async () => {
    if (!activeChave) {
      alert('Selecione ou informe a chave de acesso do documento fiscal.');
      return;
    }

    // 1. Validação de justificativa textual
    if (activeEventoDef.tipoPreenchimento === 'justificativa' || activeEventoDef.tipoPreenchimento === 'texto_livre' || activeEventoDef.requerJustificativa) {
      const minLen = activeEventoDef.minCaracteresJustificativa || 15;
      if (!justificativa.trim() || justificativa.trim().length < minLen) {
        alert(`A justificativa para o evento "${activeEventoDef.nome}" deve conter no mínimo ${minLen} caracteres.`);
        return;
      }
    }

    // 2. Validação de campos estruturados específicos
    if (activeEventoDef.tipoCamposEstruturados === 'data_entrega') {
      if (!dataPrevisaoEntrega) {
        alert('Por favor, informe a data de previsão de entrega (dPrevEntrega) no formato AAAA-MM-DD.');
        return;
      }
    }

    if (activeEventoDef.tipoPreenchimento === 'campos_estruturados' && activeEventoDef.tipoCamposEstruturados !== 'data_entrega') {
      if (!numItem || numItem < 1 || numItem > 990) {
        alert('Informe um número de item válido entre 1 e 990.');
        return;
      }
      if (quantidadeItem <= 0) {
        alert('Informe uma quantidade válida superior a zero.');
        return;
      }
    }

    setIsTransmitting(true);

    // Montagem do payload estruturado conforme NTs oficiais
    const dadosEstruturados: DadosEventoEstruturado = {};
    if (activeEventoDef.tipoCamposEstruturados === 'data_entrega') {
      dadosEstruturados.dPrevEntrega = dataPrevisaoEntrega;
    } else if (activeEventoDef.tipoCamposEstruturados === 'imobilizacao') {
      dadosEstruturados.nItem = Number(numItem);
      dadosEstruturados.qImobilizado = Number(quantidadeItem);
      dadosEstruturados.uImobilizado = (unidadeItem || 'UN').toUpperCase();
      dadosEstruturados.vIBS = Number(valorIbsItem);
      dadosEstruturados.vCBS = Number(valorCbsItem);
    } else if (activeEventoDef.tipoCamposEstruturados === 'combustivel') {
      dadosEstruturados.nItem = Number(numItem);
      dadosEstruturados.qComb = Number(quantidadeItem);
      dadosEstruturados.uComb = (unidadeItem || 'L').toUpperCase();
      dadosEstruturados.vIBS = Number(valorIbsItem);
      dadosEstruturados.vCBS = Number(valorCbsItem);
    } else if (activeEventoDef.tipoCamposEstruturados === 'credito_presumido') {
      dadosEstruturados.nItem = Number(numItem);
      dadosEstruturados.cCredPres = codigoCreditoPresumido;
      dadosEstruturados.vBCCredPres = Number(baseCalculoCredPres);
      dadosEstruturados.pCredPres = Number(aliqCredPres);
      dadosEstruturados.vCredPres = Number(((baseCalculoCredPres * aliqCredPres) / 100).toFixed(2));
    } else if (activeEventoDef.tipoCamposEstruturados === 'perecimento') {
      dadosEstruturados.nItem = Number(numItem);
      dadosEstruturados.qPerecimento = Number(quantidadeItem);
      dadosEstruturados.uPerecimento = (unidadeItem || 'UN').toUpperCase();
      dadosEstruturados.vIBS = Number(valorIbsItem);
      dadosEstruturados.vCBS = Number(valorCbsItem);
    } else if (activeEventoDef.tipoCamposEstruturados === 'nao_fornecido') {
      dadosEstruturados.nItem = Number(numItem);
      dadosEstruturados.qNaoFornecida = Number(quantidadeItem);
      dadosEstruturados.uNaoFornecida = (unidadeItem || 'UN').toUpperCase();
      dadosEstruturados.vIBS = Number(valorIbsItem);
      dadosEstruturados.vCBS = Number(valorCbsItem);
    } else if (activeEventoDef.tipoCamposEstruturados === 'importacao_alc_zfm') {
      dadosEstruturados.nItem = Number(numItem);
      dadosEstruturados.qtdeNaoIsenta = Number(quantidadeItem);
      dadosEstruturados.unidadeNaoIsenta = (unidadeItem || 'UN').toUpperCase();
      dadosEstruturados.vIBS = Number(valorIbsItem);
      dadosEstruturados.vCBS = Number(valorCbsItem);
    } else if (activeEventoDef.tipoPreenchimento === 'aceite_booleano') {
      dadosEstruturados.indAceitacao = indicadorAceitacao;
    }

    try {
      const response = await fetch(`${getApiBaseUrl()}/sefaz/evento`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
          'x-empresa-ativa-id': empresaAtiva?.id || ''
        },
        body: JSON.stringify({
          empresaId: empresaAtiva?.id,
          cnpj: empresaAtiva?.cnpjCompleto || empresaAtiva?.cnpj,
          chaveAcesso: activeChave,
          codigoEvento: activeEventoDef.codigoEvento,
          nomeEvento: activeEventoDef.nome,
          categoria: activeEventoDef.categoria,
          justificativa: justificativa.trim() || undefined,
          dadosEstruturados: Object.keys(dadosEstruturados).length > 0 ? dadosEstruturados : undefined,
          tpAmb: '1', // Produção por padrão
          tipoDfe: selectedTipoDfe
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Erro ao transmitir evento');
      }

      const newEvt: EventoDfeRequest = {
        id: data.id || `evt-${Date.now()}`,
        chaveAcesso: activeChave,
        tipoDfe: selectedTipoDfe,
        tipoEventoId: activeEventoDef.id,
        codigoEvento: activeEventoDef.codigoEvento,
        nomeEvento: activeEventoDef.nome,
        categoria: activeEventoDef.categoria,
        justificativa: justificativa.trim() || undefined,
        dadosEstruturados: Object.keys(dadosEstruturados).length > 0 ? dadosEstruturados : undefined,
        dataHora: data.dhRegEvento || new Date().toISOString(),
        protocoloSeFaz: data.protocoloSefaz || (data.success !== false ? '135260000000001' : (data.cStat ? `Rejeição ${data.cStat}` : '—')),
        status: data.success !== false ? 'processado' : 'rejeitado',
        detalhesReforma: activeEventoDef.isReformaTributaria ? {
          cbsAjuste: `CBS: R$ ${(valorCbsItem || currentDocument?.valorCbs || 100).toFixed(2)}`,
          ibsAjuste: `IBS: R$ ${(valorIbsItem || currentDocument?.valorIbs || 200).toFixed(2)}`
        } : undefined
      };

      setTransmittedLog(prev => [newEvt, ...prev]);

      if (onEventProcessed) {
        onEventProcessed(activeChave, activeEventoDef.nome);
      }

      setJustificativa('');
      setJustificativaPadraoSelecionada('');
      if (data.success !== false) {
        alert(`Evento transmitido com sucesso! Protocolo: ${data.protocoloSefaz || '135260000000001'}`);
      } else {
        const cStatBadge = data.cStat ? `[cStat ${data.cStat}] ` : '';
        const msg = data.xMotivo || 'Operação rejeitada pelo autorizador SEFAZ.';
        if (msg.startsWith('⚠️')) {
          alert(msg);
        } else {
          alert(`Rejeição SEFAZ ${cStatBadge}\n${msg}`);
        }
      }

    } catch (err: any) {
      alert(err.message);
    } finally {
      setIsTransmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Main Top Navigation Tabs & Certificate Badge */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3">
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setActiveTab('emissor')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'emissor'
                ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-600/30'
                : 'bg-slate-900/80 text-slate-400 hover:text-white hover:bg-slate-800 border border-slate-800'
            }`}
          >
            <Send className="w-4 h-4 text-cyan-400" />
            <span>Envio de Eventos</span>
          </button>

          <button
            onClick={() => setActiveTab('notas_tecnicas')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'notas_tecnicas'
                ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-600/30'
                : 'bg-slate-900/80 text-slate-400 hover:text-white hover:bg-slate-800 border border-slate-800'
            }`}
          >
            <FileText className="w-4 h-4 text-indigo-400" />
            <span>Notas Técnicas RTC (NT 2025.002, NT 2025.001, NT 009)</span>
          </button>


          <button
            onClick={() => setActiveTab('schema_generator')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'schema_generator'
                ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-600/30'
                : 'bg-slate-900/80 text-slate-400 hover:text-white hover:bg-slate-800 border border-slate-800'
            }`}
          >
            <Terminal className="w-4 h-4 text-purple-400" />
            <span>Gerador de Schemas XML / JSON</span>
          </button>
        </div>

        {/* Botão de Status do Certificado A1 da Empresa Ativa (Centralizado no Cadastro de Empresas) */}
        <button
          type="button"
          onClick={() => onNavigateToCarteira && onNavigateToCarteira()}
          className={`hidden sm:flex items-center gap-2 px-3.5 py-1.5 rounded-xl border text-xs shadow-inner cursor-pointer transition-all ${
            certificado?.valido
              ? 'bg-emerald-950/50 border-emerald-700/60 hover:bg-emerald-900/60'
              : 'bg-amber-950/50 border-amber-700/60 hover:bg-amber-900/60'
          }`}
          title={
            certificado?.valido
              ? `Certificado Digital A1 Ativo (Validade: ${certificado.validade ? new Date(certificado.validade).toLocaleDateString('pt-BR') : 'Ativo'}) — Gerenciar no Cadastro de Empresas`
              : 'Certificado Digital A1 Pendente — Clique para vincular no Cadastro de Empresas'
          }
        >
          <Key className={`w-4 h-4 shrink-0 ${certificado?.valido ? 'text-emerald-400' : 'text-amber-400'}`} />
          <div className="text-[11px] flex items-center gap-1.5">
            <span className={`font-bold ${certificado?.valido ? 'text-emerald-300' : 'text-amber-300'}`}>
              {certificado?.valido ? 'Certificado Ativo' : 'Certificado Pendente'}
            </span>
            <span className={`w-2 h-2 rounded-full ${certificado?.valido ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`} />
          </div>
        </button>
      </div>

      {/* TAB 1: EMISSOR DE EVENTOS RTC */}
      {activeTab === 'emissor' && (
        <div className="space-y-6">
          {/* Top Emergency Alert Banner for Third-Party Events (Desconhecimento da Operação) */}
          {transmittedLog.some(l => l.codigoEvento === '210220' || l.codigoEvento === '210240') && (
            <div className="p-4 rounded-2xl bg-gradient-to-r from-red-950/90 via-slate-900 to-rose-950/90 border-2 border-red-500/80 shadow-xl shadow-red-900/20 text-xs space-y-2">
              <div className="flex items-center gap-3">
                <ShieldAlert className="w-6 h-6 text-red-400 shrink-0" />
                <div>
                  <h4 className="text-sm font-extrabold text-white flex items-center gap-2">
                    <span>🚨 ALERTA CRÍTICO DE RISCO FISCAL (Monitor 360°)</span>
                    <span className="px-2 py-0.5 rounded bg-red-600 text-white font-mono text-[10px] font-bold">
                      AÇÃO IMEDIATA REQUERIDA
                    </span>
                  </h4>
                  <p className="text-xs text-red-200 mt-0.5">
                    Foram identificadas manifestações de <strong>Desconhecimento da Operação (210220)</strong> ou <strong>Operação Não Realizada (210240)</strong> registradas por clientes destinatários contra notas emitidas por sua empresa.
                  </p>
                </div>
              </div>
              <div className="p-2.5 rounded-xl bg-black/40 border border-red-900/60 text-[11px] text-slate-300 flex flex-wrap items-center justify-between gap-2">
                <span>⚡ <strong>Impacto Tributário:</strong> Anulação da presunção de entrega, risco de glosa de créditos na apuração assistida (CGIBS/RFB) e bloqueio de cobrança financeira.</span>
                <span className="text-red-300 font-semibold font-mono">Horário Oficial de Brasília (UTC-03:00)</span>
              </div>
            </div>
          )}

          {/* Primary DF-e Document Type Selector Tabs */}
          <div className="flex flex-wrap items-center justify-between gap-3 p-2 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-md">
            <div className="flex items-center gap-1.5 overflow-x-auto max-w-full">
              <span className="text-xs font-bold text-slate-400 px-3 uppercase tracking-wider flex items-center gap-1.5 shrink-0">
                <FileCode className="w-4 h-4 text-cyan-400" />
                Tipo de DF-e:
              </span>

              <button
                onClick={() => handleSelectTipoDfe('NFe')}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  selectedTipoDfe === 'NFe'
                    ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-600/30'
                    : 'text-slate-300 hover:text-white hover:bg-slate-800'
                }`}
              >
                <span>NF-e (Mod. 55)</span>
                <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-black/20 text-cyan-300 font-mono">
                  {(currentKpis?.nfeCount ?? dfeList.filter(d => d.tipo === 'NFe').length).toLocaleString('pt-BR')}
                </span>
              </button>

              <button
                onClick={() => handleSelectTipoDfe('NFCe')}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  selectedTipoDfe === 'NFCe'
                    ? 'bg-gradient-to-r from-blue-600 to-cyan-600 text-white shadow-lg shadow-cyan-600/30'
                    : 'text-slate-300 hover:text-white hover:bg-slate-800'
                }`}
              >
                <span>NFC-e (Mod. 65)</span>
                <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-black/20 text-cyan-300 font-mono">
                  {(currentKpis?.nfceCount ?? dfeList.filter(d => d.tipo === 'NFCe').length).toLocaleString('pt-BR')}
                </span>
              </button>

              <button
                onClick={() => handleSelectTipoDfe('CTe')}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  selectedTipoDfe === 'CTe'
                    ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-lg shadow-indigo-600/30'
                    : 'text-slate-300 hover:text-white hover:bg-slate-800'
                }`}
              >
                <span>CT-e (Mod. 57)</span>
                <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-black/20 text-indigo-300 font-mono">
                  {(currentKpis?.cteCount ?? dfeList.filter(d => d.tipo === 'CTe').length).toLocaleString('pt-BR')}
                </span>
              </button>

              <button
                onClick={() => handleSelectTipoDfe('NFSe')}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  selectedTipoDfe === 'NFSe'
                    ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-lg shadow-emerald-600/30'
                    : 'text-slate-300 hover:text-white hover:bg-slate-800'
                }`}
              >
                <span>NFS-e (Serviços)</span>
                <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-black/20 text-emerald-300 font-mono">
                  {(currentKpis?.nfseCount ?? dfeList.filter(d => d.tipo === 'NFSe' || (d.tipo as string) === 'NFS-e').length).toLocaleString('pt-BR')}
                </span>
              </button>
            </div>

            {/* Category Sub-Filters */}
            <div className="flex items-center gap-1.5 px-3 py-1 bg-slate-950/80 rounded-xl border border-slate-800 text-xs">
              <Filter className="w-3.5 h-3.5 text-slate-400" />
              <span className="text-[11px] text-slate-400 font-semibold">Filtrar Categoria:</span>
              <select
                value={categoriaFilter}
                onChange={(e) => setCategoriaFilter(e.target.value as any)}
                className="bg-transparent text-slate-200 font-semibold focus:outline-none cursor-pointer"
              >
                <option value="todos" className="bg-slate-900">Todas as Categorias</option>
                <option value="reforma_tributaria" className="bg-slate-900">⚡ Reforma Tributária (CBS/IBS)</option>
                <option value="destinatario" className="bg-slate-900">Destinatário / Comprador</option>
                <option value="emitente" className="bg-slate-900">Emitente / Prestador</option>
                <option value="tomador" className="bg-slate-900">Tomador de Serviço</option>
                <option value="contingencia" className="bg-slate-900">Contingência / EPEC</option>
              </select>
            </div>
          </div>

          {/* Main Grid: Form Left, Event Selection + History Right */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            
            {/* Left Column (6 cols): Active Document Selection + Event Configuration */}
            <div className="lg:col-span-6 p-6 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-5 shadow-lg">
              <h3 className="text-base font-bold text-white flex items-center justify-between border-b border-slate-800 pb-3">
                <span className="flex items-center gap-2">
                  <FileSignature className="w-5 h-5 text-cyan-400" />
                  Configuração e Disparo do Evento
                </span>
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-cyan-950 text-cyan-300 border border-cyan-800 font-bold font-mono">
                  {selectedTipoDfe}
                </span>
              </h3>

              {/* Document Selector for Selected TipoDFe */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                    <span>Documento Fiscal Alvo ({selectedTipoDfe === 'NFSe' ? 'NFS-e Nacional' : selectedTipoDfe})</span>
                    {selectedTipoDfe === 'NFSe' && (
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-purple-950 text-purple-300 border border-purple-800 font-mono">
                        Chave 50 ou 44 Dígitos (Nacional/Municipal)
                      </span>
                    )}
                  </label>
                  <span className="text-[10px] text-slate-400 font-mono">{docsDoTipo.length} carregado(s)</span>
                </div>

                {/* Campo de pesquisa rápida por Chave (44 ou 50 dígitos), Número ou Fornecedor */}
                {docsDoTipo.length > 2 && (
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-2.5" />
                    <input
                      type="text"
                      placeholder={selectedTipoDfe === 'NFSe' 
                        ? "Filtrar por Chave de 50/44 dígitos, Nº NFS-e ou Prestador..." 
                        : "Filtrar por Chave de 44 dígitos, Nº NF-e ou Fornecedor..."}
                      value={docFilterText}
                      onChange={(e) => setDocFilterText(e.target.value)}
                      className="w-full bg-slate-950/90 border border-slate-800 rounded-xl pl-8 pr-7 py-1.5 text-[11px] text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                    />
                    {docFilterText && (
                      <button
                        type="button"
                        onClick={() => setDocFilterText('')}
                        className="absolute right-2.5 top-2 text-slate-400 hover:text-white text-xs cursor-pointer"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                )}

                {filteredDocsDoTipo.length > 0 ? (
                  <select
                    value={activeChave}
                    onChange={(e) => setActiveChave(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2.5 text-xs font-mono text-slate-200 focus:outline-none focus:border-cyan-500"
                  >
                    {filteredDocsDoTipo.map((d) => (
                      <option key={d.id} value={d.chaveAcesso}>
                        {d.tipo === 'NFSe' || (d.tipo as string) === 'NFS-e' ? 'NFS-e' : d.tipo} N. {d.numero} - {d.emitenteNome} ({d.chaveAcesso.length === 50 ? `${d.chaveAcesso.slice(0, 12)}...${d.chaveAcesso.slice(-6)} [50D]` : `${d.chaveAcesso.slice(0, 18)}... [44D]`})
                      </option>
                    ))}
                  </select>
                ) : (
                  <div className="p-3 rounded-xl bg-slate-950 border border-amber-900/40 text-xs text-amber-300 flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
                    <span>
                      {docFilterText 
                        ? `Nenhum documento encontrado para "${docFilterText}".` 
                        : `Nenhum XML de ${selectedTipoDfe} selecionado. Pode digitar ou usar a chave abaixo.`}
                    </span>
                  </div>
                )}

                {/* Entrada / Colagem direta de chave (44 posições NF-e/CT-e ou 50 posições NFS-e Nacional) */}
                <div className="pt-1">
                  <div className="flex items-center justify-between text-[11px] text-slate-400 mb-1">
                    <span>Chave Ativa do Documento:</span>
                    <span className="font-mono text-[10px]">
                      {activeChave?.length === 50 ? (
                        <span className="text-purple-400 font-bold">✓ 50 dígitos (NFS-e Nacional)</span>
                      ) : activeChave?.length === 44 ? (
                        <span className="text-cyan-400 font-bold">
                          ✓ 44 dígitos {selectedTipoDfe === 'NFSe' ? '(NFS-e Municipal)' : '(NF-e / CT-e)'}
                        </span>
                      ) : activeChave?.length > 0 ? (
                        <span className="text-amber-400 font-bold">{activeChave.length} dígitos</span>
                      ) : null}
                    </span>
                  </div>
                  <div className="relative flex items-center gap-1.5">
                    <input
                      type="text"
                      value={activeChave}
                      onChange={(e) => setActiveChave(e.target.value.trim())}
                      placeholder={selectedTipoDfe === 'NFSe' 
                        ? "Cole aqui a chave da NFS-e (Nacional 50d ou Municipal 44d)..." 
                        : "Cole aqui a chave de 44 dígitos da NF-e / CT-e..."}
                      className="w-full bg-slate-950 border border-slate-700/80 rounded-xl px-3 py-2 text-xs font-mono text-cyan-300 focus:outline-none focus:border-cyan-400"
                    />
                    {activeChave && (
                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard.writeText(activeChave);
                          setCopiedChave(true);
                          setTimeout(() => setCopiedChave(false), 2000);
                        }}
                        title="Copiar Chave Completa"
                        className="px-2.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 hover:text-white text-xs shrink-0 flex items-center gap-1 transition cursor-pointer"
                      >
                        {copiedChave ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-cyan-400" />}
                        <span className="text-[10px] hidden sm:inline">{copiedChave ? 'Copiada' : 'Copiar'}</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Active Document Details Summary */}
              {currentDocument && (
                <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 text-xs space-y-2">
                  <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-black font-mono uppercase tracking-wider ${
                          (currentDocument.tipo === 'NFSe' || (currentDocument.tipo as string) === 'NFS-e' || currentDocument.chaveAcesso?.length === 50)
                            ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                            : 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                        }`}>
                          {(currentDocument.tipo === 'NFSe' || (currentDocument.tipo as string) === 'NFS-e' || currentDocument.chaveAcesso?.length === 50) ? 'NFS-e Nacional' : currentDocument.tipo}
                        </span>
                        <span className="text-white font-bold text-xs">
                          Nº {currentDocument.numero || '—'}
                          {currentDocument.serie ? ` (Série ${currentDocument.serie})` : ''}
                        </span>
                        {currentDocument.dataEmissao && (
                          <span className="text-[10px] text-slate-400">
                            📅 {new Date(currentDocument.dataEmissao).toLocaleDateString('pt-BR')}
                          </span>
                        )}
                      </div>
                      <div className="font-bold text-white text-sm mt-1">{currentDocument.emitenteNome}</div>
                      <div className="text-[11px] text-slate-400 font-mono">CNPJ: {currentDocument.emitenteCnpj} | UF: {currentDocument.emitenteUf}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Valor Total</div>
                      <div className="text-base font-extrabold text-emerald-400 font-mono">
                        {currentDocument.valorTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                      </div>
                    </div>
                  </div>

                  {/* Dual Tax Ref. Tributaria Breakdown */}
                  <div className="grid grid-cols-2 gap-2 pt-1 text-[11px]">
                    <div className="bg-slate-900/80 p-2 rounded-lg border border-slate-800">
                      <span className="text-slate-400 block text-[10px]">Valor CBS:</span>
                      <span className="font-bold text-cyan-300 font-mono">
                        {currentDocument.valorCbs.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                      </span>
                    </div>
                    <div className="bg-slate-900/80 p-2 rounded-lg border border-slate-800">
                      <span className="text-slate-400 block text-[10px]">Valor IBS:</span>
                      <span className="font-bold text-indigo-300 font-mono">
                        {currentDocument.valorIbs.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Event Detail Box */}
              <div className="p-4 rounded-xl bg-slate-950 border border-cyan-500/30 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded bg-cyan-950 text-cyan-300 text-xs font-mono font-bold border border-cyan-800">
                      Evento {activeEventoDef.codigoEvento}
                    </span>
                    {activeEventoDef.badge && (
                      <span className="px-2 py-0.5 rounded bg-blue-950 text-blue-300 text-[10px] font-bold border border-blue-800">
                        {activeEventoDef.badge}
                      </span>
                    )}
                    {activeEventoDef.isReformaTributaria && (
                      <span className="px-2 py-0.5 rounded bg-indigo-950 text-cyan-300 text-[10px] font-bold border border-cyan-700 flex items-center gap-1">
                        <Sparkles className="w-3 h-3 text-cyan-400" />
                        Reforma PLP 68
                      </span>
                    )}
                  </div>

                  <span className="text-[10px] text-slate-400 capitalize font-medium">
                    Cat: {activeEventoDef.categoria.replace('_', ' ')}
                  </span>
                </div>

                <h4 className="text-sm font-bold text-white">
                  {activeEventoDef.nome}
                </h4>
                <p className="text-xs text-slate-300 leading-relaxed">
                  {activeEventoDef.descricao}
                </p>
              </div>

              {/* Form Input Section: Justificativa Padrão vs Texto Livre vs Campos Estruturados vs Aceite Booleano vs Nenhum */}
              
              {/* 1. SELEÇÃO DE JUSTIFICATIVAS PADRÃO OU DIGITAÇÃO DE JUSTIFICATIVA */}
              {(activeEventoDef.tipoPreenchimento === 'justificativa' || (!activeEventoDef.tipoPreenchimento && activeEventoDef.requerJustificativa)) && (
                <div className="space-y-3 p-4 rounded-xl bg-slate-950 border border-slate-800">
                  {/* Seletor de Justificativas Padrão da Legislação */}
                  {activeEventoDef.justificativasPadrao && activeEventoDef.justificativasPadrao.length > 0 && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-bold text-cyan-300 flex items-center gap-1.5">
                          <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
                          <span>Justificativa Padrão (Legislação / SEFAZ)</span>
                        </label>
                        <span className="text-[10px] text-slate-400 font-mono">
                          {activeEventoDef.justificativasPadrao.length} opções disponíveis
                        </span>
                      </div>

                      <select
                        value={justificativaPadraoSelecionada}
                        onChange={(e) => handleSelectJustificativaPadrao(e.target.value)}
                        className="w-full bg-slate-900 border border-cyan-800/60 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-cyan-400 cursor-pointer"
                      >
                        <option value="">-- Selecione uma justificativa pré-definida para preenchimento rápido --</option>
                        {activeEventoDef.justificativasPadrao.map((just, idx) => (
                          <option key={idx} value={just} className="bg-slate-900 py-1">
                            {idx + 1}. {just}
                          </option>
                        ))}
                      </select>

                      {/* Chips rápidos clicáveis */}
                      <div className="flex flex-wrap gap-1.5 pt-1">
                        {activeEventoDef.justificativasPadrao.map((just, idx) => {
                          const isPicked = justificativa === just;
                          return (
                            <button
                              key={idx}
                              type="button"
                              onClick={() => handleSelectJustificativaPadrao(just)}
                              className={`px-2.5 py-1 rounded-lg text-[11px] text-left transition-all cursor-pointer flex items-center gap-1.5 border ${
                                isPicked
                                  ? 'bg-cyan-950 text-cyan-200 border-cyan-500 font-semibold shadow-sm'
                                  : 'bg-slate-900 text-slate-300 border-slate-800 hover:border-slate-700 hover:bg-slate-800'
                              }`}
                            >
                              {isPicked ? <Check className="w-3 h-3 text-cyan-400 shrink-0" /> : <span className="text-[10px] text-slate-500 font-mono">#{idx + 1}</span>}
                              <span className="truncate max-w-[280px]">{just}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Campo Textarea Editável */}
                  <div className="space-y-1.5 pt-1">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold text-slate-300">
                        Texto da Manifestação / Justificativa
                      </label>
                      <span className={`text-[10px] font-medium font-mono ${
                        justificativa.length >= (activeEventoDef.minCaracteresJustificativa || 15)
                          ? 'text-emerald-400'
                          : 'text-amber-400'
                      }`}>
                        * {justificativa.length} / mín. {activeEventoDef.minCaracteresJustificativa || 15} caracteres
                      </span>
                    </div>

                    <textarea
                      rows={3}
                      value={justificativa}
                      onChange={(e) => {
                        setJustificativa(e.target.value);
                        if (justificativaPadraoSelecionada && e.target.value !== justificativaPadraoSelecionada) {
                          setJustificativaPadraoSelecionada('');
                        }
                      }}
                      placeholder={`Digite ou ajuste o texto da justificativa oficial de ${selectedTipoDfe} para a SEFAZ...`}
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-xs text-slate-200 focus:outline-none focus:border-cyan-500 font-sans"
                    />
                  </div>
                </div>
              )}

              {/* 2. TEXTO LIVRE: CARTA DE CORREÇÃO ELETRÔNICA (CC-e) */}
              {activeEventoDef.tipoPreenchimento === 'texto_livre' && (
                <div className="space-y-3 p-4 rounded-xl bg-slate-950 border border-amber-800/60">
                  <div className="flex items-start gap-2.5 p-3 rounded-lg bg-amber-950/40 border border-amber-700/60 text-amber-200 text-xs leading-relaxed">
                    <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                    <div>
                      <strong className="block font-bold text-amber-300">Atenção às Restrições Legais da CC-e (Art. 58-B Convênio SINIEF):</strong>
                      <span>A Carta de Correção não admite texto pré-definido e é <strong>estritamente vedada</strong> para alterar: 1) valores e alíquotas fiscais; 2) dados cadastrais que mudem emitente ou destinatário; 3) data de emissão ou de saída.</span>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold text-slate-200">
                        Descrição da Retificação (Digitação Livre Obrigatória)
                      </label>
                      <span className={`text-[10px] font-medium font-mono ${
                        justificativa.length >= (activeEventoDef.minCaracteresJustificativa || 15)
                          ? 'text-emerald-400'
                          : 'text-amber-400'
                      }`}>
                        * {justificativa.length} / mín. {activeEventoDef.minCaracteresJustificativa || 15} caracteres
                      </span>
                    </div>

                    <textarea
                      rows={4}
                      value={justificativa}
                      onChange={(e) => setJustificativa(e.target.value)}
                      placeholder="Descreva pontualmente a retificação de informação secundária a ser averbada ao documento fiscal..."
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-xs text-slate-200 focus:outline-none focus:border-cyan-500 font-sans"
                    />
                  </div>
                </div>
              )}

              {/* 3. CAMPOS ESTRUTURADOS ESPECÍFICOS (DATA, ITENS, QUANTIDADES, VALORES DE TRIBUTOS) */}
              {activeEventoDef.tipoPreenchimento === 'campos_estruturados' && (
                <div className="space-y-4 p-4 rounded-xl bg-slate-950 border border-cyan-900/60">
                  
                  {/* Caso A: Atualização da Data de Previsão de Entrega (112150) */}
                  {activeEventoDef.tipoCamposEstruturados === 'data_entrega' && (
                    <div className="space-y-3">
                      <div className="p-3 rounded-lg bg-indigo-950/40 border border-indigo-800/60 text-xs text-indigo-200">
                        <strong className="block text-indigo-300 font-bold mb-1">Regra NT 2025.002-RTC (B10a-20 e B10a-50):</strong>
                        <span>A data de previsão atualizada define a nova competência do fato gerador do IBS e da CBS. Não pode ser superior a 3 meses da data de saída e é vedada para frete FOB.</span>
                      </div>

                      <div className="space-y-1">
                        <label className="text-xs font-bold text-slate-300 flex items-center gap-2">
                          <Calendar className="w-3.5 h-3.5 text-cyan-400" />
                          Nova Data de Previsão de Entrega (tag: dPrevEntrega)
                        </label>
                        <input
                          type="date"
                          value={dataPrevisaoEntrega}
                          onChange={(e) => setDataPrevisaoEntrega(e.target.value)}
                          className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-cyan-500"
                        />
                      </div>
                    </div>
                  )}

                  {/* Caso B: Imobilização de Item (211130) */}
                  {activeEventoDef.tipoCamposEstruturados === 'imobilizacao' && (
                    <div className="space-y-3">
                      <div className="p-3 rounded-lg bg-blue-950/40 border border-blue-800/60 text-xs text-blue-200">
                        <strong className="block text-blue-300 font-bold mb-1">Art. 40 da LC 214/2025 & NT 2025.002-RTC:</strong>
                        <span>Comunica a integração do bem ao Ativo Imobilizado para fixação de prazo-limite na apreciação de pedidos de ressarcimento de crédito.</span>
                      </div>

                      <div className="grid grid-cols-3 gap-2">
                        <div className="space-y-1">
                          <label className="text-[11px] font-bold text-slate-400">Nº Item (nItem)</label>
                          <input
                            type="number"
                            min={1}
                            max={990}
                            value={numItem}
                            onChange={(e) => setNumItem(parseInt(e.target.value) || 1)}
                            className="w-full bg-slate-900 border border-slate-700 rounded-xl px-2.5 py-1.5 text-xs font-mono text-white"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[11px] font-bold text-slate-400">Qtd Imobilizada</label>
                          <input
                            type="number"
                            step="0.0001"
                            min={0.0001}
                            value={quantidadeItem}
                            onChange={(e) => setQuantidadeItem(parseFloat(e.target.value) || 0)}
                            className="w-full bg-slate-900 border border-slate-700 rounded-xl px-2.5 py-1.5 text-xs font-mono text-white"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[11px] font-bold text-slate-400">Unidade (uImob)</label>
                          <input
                            type="text"
                            maxLength={6}
                            value={unidadeItem}
                            onChange={(e) => setUnidadeItem(e.target.value)}
                            className="w-full bg-slate-900 border border-slate-700 rounded-xl px-2.5 py-1.5 text-xs font-mono text-white uppercase"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-1">
                          <label className="text-[11px] font-bold text-slate-400">Valor IBS Imobilização (R$)</label>
                          <input
                            type="number"
                            step="0.01"
                            value={valorIbsItem}
                            onChange={(e) => setValorIbsItem(parseFloat(e.target.value) || 0)}
                            className="w-full bg-slate-900 border border-slate-700 rounded-xl px-2.5 py-1.5 text-xs font-mono text-cyan-300"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[11px] font-bold text-slate-400">Valor CBS Imobilização (R$)</label>
                          <input
                            type="number"
                            step="0.01"
                            value={valorCbsItem}
                            onChange={(e) => setValorCbsItem(parseFloat(e.target.value) || 0)}
                            className="w-full bg-slate-900 border border-slate-700 rounded-xl px-2.5 py-1.5 text-xs font-mono text-indigo-300"
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Caso C: Apropriação de Crédito de Combustível (211140) */}
                  {activeEventoDef.tipoCamposEstruturados === 'combustivel' && (
                    <div className="space-y-3">
                      <div className="p-3 rounded-lg bg-amber-950/40 border border-amber-800/60 text-xs text-amber-200">
                        <strong className="block text-amber-300 font-bold mb-1">Art. 172 da LC 214/2025:</strong>
                        <span>Evento específico para adquirente integrante da cadeia produtiva solicitar a apropriação de crédito sobre a parcela consumida em suas atividades operacionais.</span>
                      </div>

                      <div className="grid grid-cols-3 gap-2">
                        <div className="space-y-1">
                          <label className="text-[11px] font-bold text-slate-400">Nº Item (nItem)</label>
                          <input
                            type="number"
                            min={1}
                            max={990}
                            value={numItem}
                            onChange={(e) => setNumItem(parseInt(e.target.value) || 1)}
                            className="w-full bg-slate-900 border border-slate-700 rounded-xl px-2.5 py-1.5 text-xs font-mono text-white"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[11px] font-bold text-slate-400">Qtd Consumida</label>
                          <input
                            type="number"
                            step="0.0001"
                            min={0.0001}
                            value={quantidadeItem}
                            onChange={(e) => setQuantidadeItem(parseFloat(e.target.value) || 0)}
                            className="w-full bg-slate-900 border border-slate-700 rounded-xl px-2.5 py-1.5 text-xs font-mono text-white"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[11px] font-bold text-slate-400">Unidade (ex: L)</label>
                          <input
                            type="text"
                            maxLength={6}
                            value={unidadeItem}
                            onChange={(e) => setUnidadeItem(e.target.value)}
                            className="w-full bg-slate-900 border border-slate-700 rounded-xl px-2.5 py-1.5 text-xs font-mono text-white uppercase"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-1">
                          <label className="text-[11px] font-bold text-slate-400">IBS Consumo Combustível (R$)</label>
                          <input
                            type="number"
                            step="0.01"
                            value={valorIbsItem}
                            onChange={(e) => setValorIbsItem(parseFloat(e.target.value) || 0)}
                            className="w-full bg-slate-900 border border-slate-700 rounded-xl px-2.5 py-1.5 text-xs font-mono text-cyan-300"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[11px] font-bold text-slate-400">CBS Consumo Combustível (R$)</label>
                          <input
                            type="number"
                            step="0.01"
                            value={valorCbsItem}
                            onChange={(e) => setValorCbsItem(parseFloat(e.target.value) || 0)}
                            className="w-full bg-slate-900 border border-slate-700 rounded-xl px-2.5 py-1.5 text-xs font-mono text-indigo-300"
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Caso D: Crédito Presumido (211110 e 211150) */}
                  {activeEventoDef.tipoCamposEstruturados === 'credito_presumido' && (
                    <div className="space-y-3">
                      <div className="p-3 rounded-lg bg-purple-950/40 border border-purple-800/60 text-xs text-purple-200">
                        <strong className="block text-purple-300 font-bold mb-1">Apropriação de Crédito Presumido (Anexo IV cCredPres):</strong>
                        <span>Apropriação formal de crédito presumido de IBS e CBS conforme enquadramento na aquisição.</span>
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-1">
                          <label className="text-[11px] font-bold text-slate-400">Item da NF-e (nItem)</label>
                          <input
                            type="number"
                            min={1}
                            max={990}
                            value={numItem}
                            onChange={(e) => setNumItem(parseInt(e.target.value) || 1)}
                            className="w-full bg-slate-900 border border-slate-700 rounded-xl px-2.5 py-1.5 text-xs font-mono text-white"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[11px] font-bold text-slate-400">Cód. cCredPres (Anexo IV)</label>
                          <select
                            value={codigoCreditoPresumido}
                            onChange={(e) => setCodigoCreditoPresumido(e.target.value)}
                            className="w-full bg-slate-900 border border-slate-700 rounded-xl px-2.5 py-1.5 text-xs text-white"
                          >
                            <option value="01">01 - Produtor Rural Não Contribuinte</option>
                            <option value="02">02 - Transportador Autônomo (TAC PF)</option>
                            <option value="03">03 - Pessoa Física - Reciclagem</option>
                            <option value="04">04 - Bens Móveis Usados (Veículos)</option>
                            <option value="05">05 - Regime Opcional Cooperativas</option>
                          </select>
                        </div>
                      </div>

                      <div className="grid grid-cols-3 gap-2">
                        <div className="space-y-1">
                          <label className="text-[11px] font-bold text-slate-400">Base Cálculo (R$)</label>
                          <input
                            type="number"
                            step="0.01"
                            value={baseCalculoCredPres}
                            onChange={(e) => setBaseCalculoCredPres(parseFloat(e.target.value) || 0)}
                            className="w-full bg-slate-900 border border-slate-700 rounded-xl px-2.5 py-1.5 text-xs font-mono text-white"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[11px] font-bold text-slate-400">Alíquota (%)</label>
                          <input
                            type="number"
                            step="0.01"
                            value={aliqCredPres}
                            onChange={(e) => setAliqCredPres(parseFloat(e.target.value) || 0)}
                            className="w-full bg-slate-900 border border-slate-700 rounded-xl px-2.5 py-1.5 text-xs font-mono text-cyan-300"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[11px] font-bold text-slate-400">Crédito Estimado (R$)</label>
                          <input
                            type="text"
                            readOnly
                            value={((baseCalculoCredPres * aliqCredPres) / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                            className="w-full bg-slate-900/60 border border-slate-800 rounded-xl px-2.5 py-1.5 text-xs font-mono text-emerald-400 font-bold"
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Caso E: Perecimento, Perda ou Roubo (112130 / 211124) */}
                  {activeEventoDef.tipoCamposEstruturados === 'perecimento' && (
                    <div className="space-y-3">
                      <div className="p-3 rounded-lg bg-red-950/40 border border-red-800/60 text-xs text-red-200">
                        <strong className="block text-red-300 font-bold mb-1">Sinistro / Perecimento de Carga em Trânsito:</strong>
                        <span>Comunica o perecimento, furto ou extravio no transporte contratado para fins de estorno do débito ou ajuste da apuração assistida.</span>
                      </div>

                      <div className="grid grid-cols-3 gap-2">
                        <div className="space-y-1">
                          <label className="text-[11px] font-bold text-slate-400">Nº Item (nItem)</label>
                          <input
                            type="number"
                            min={1}
                            value={numItem}
                            onChange={(e) => setNumItem(parseInt(e.target.value) || 1)}
                            className="w-full bg-slate-900 border border-slate-700 rounded-xl px-2.5 py-1.5 text-xs font-mono text-white"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[11px] font-bold text-slate-400">Qtd Perecida</label>
                          <input
                            type="number"
                            step="0.0001"
                            value={quantidadeItem}
                            onChange={(e) => setQuantidadeItem(parseFloat(e.target.value) || 0)}
                            className="w-full bg-slate-900 border border-slate-700 rounded-xl px-2.5 py-1.5 text-xs font-mono text-white"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[11px] font-bold text-slate-400">Unidade</label>
                          <input
                            type="text"
                            value={unidadeItem}
                            onChange={(e) => setUnidadeItem(e.target.value)}
                            className="w-full bg-slate-900 border border-slate-700 rounded-xl px-2.5 py-1.5 text-xs font-mono text-white uppercase"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-1">
                          <label className="text-[11px] font-bold text-slate-400">IBS Ajustado (R$)</label>
                          <input
                            type="number"
                            step="0.01"
                            value={valorIbsItem}
                            onChange={(e) => setValorIbsItem(parseFloat(e.target.value) || 0)}
                            className="w-full bg-slate-900 border border-slate-700 rounded-xl px-2.5 py-1.5 text-xs font-mono text-cyan-300"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[11px] font-bold text-slate-400">CBS Ajustada (R$)</label>
                          <input
                            type="number"
                            step="0.01"
                            value={valorCbsItem}
                            onChange={(e) => setValorCbsItem(parseFloat(e.target.value) || 0)}
                            className="w-full bg-slate-900 border border-slate-700 rounded-xl px-2.5 py-1.5 text-xs font-mono text-indigo-300"
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Caso F: Fornecimento Não Realizado com Pagamento Antecipado (112140) */}
                  {activeEventoDef.tipoCamposEstruturados === 'nao_fornecido' && (
                    <div className="space-y-3">
                      <div className="p-3 rounded-lg bg-orange-950/40 border border-orange-800/60 text-xs text-orange-200">
                        <strong className="block text-orange-300 font-bold mb-1">Fornecimento Não Concretizado:</strong>
                        <span>Emissor da nota de débito de pagamento antecipado registra a devolução de numerário e a não entrega da mercadoria.</span>
                      </div>

                      <div className="grid grid-cols-3 gap-2">
                        <div className="space-y-1">
                          <label className="text-[11px] font-bold text-slate-400">Nº Item</label>
                          <input
                            type="number"
                            min={1}
                            value={numItem}
                            onChange={(e) => setNumItem(parseInt(e.target.value) || 1)}
                            className="w-full bg-slate-900 border border-slate-700 rounded-xl px-2.5 py-1.5 text-xs font-mono text-white"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[11px] font-bold text-slate-400">Qtd Não Fornecida</label>
                          <input
                            type="number"
                            step="0.0001"
                            value={quantidadeItem}
                            onChange={(e) => setQuantidadeItem(parseFloat(e.target.value) || 0)}
                            className="w-full bg-slate-900 border border-slate-700 rounded-xl px-2.5 py-1.5 text-xs font-mono text-white"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[11px] font-bold text-slate-400">Unidade</label>
                          <input
                            type="text"
                            value={unidadeItem}
                            onChange={(e) => setUnidadeItem(e.target.value)}
                            className="w-full bg-slate-900 border border-slate-700 rounded-xl px-2.5 py-1.5 text-xs font-mono text-white uppercase"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-1">
                          <label className="text-[11px] font-bold text-slate-400">IBS a Restituir (R$)</label>
                          <input
                            type="number"
                            step="0.01"
                            value={valorIbsItem}
                            onChange={(e) => setValorIbsItem(parseFloat(e.target.value) || 0)}
                            className="w-full bg-slate-900 border border-slate-700 rounded-xl px-2.5 py-1.5 text-xs font-mono text-cyan-300"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[11px] font-bold text-slate-400">CBS a Restituir (R$)</label>
                          <input
                            type="number"
                            step="0.01"
                            value={valorCbsItem}
                            onChange={(e) => setValorCbsItem(parseFloat(e.target.value) || 0)}
                            className="w-full bg-slate-900 border border-slate-700 rounded-xl px-2.5 py-1.5 text-xs font-mono text-indigo-300"
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Caso G: Importação ALC / ZFM Não Convertida em Isenção (112120) */}
                  {activeEventoDef.tipoCamposEstruturados === 'importacao_alc_zfm' && (
                    <div className="space-y-3">
                      <div className="p-3 rounded-lg bg-teal-950/40 border border-teal-800/60 text-xs text-teal-200">
                        <strong className="block text-teal-300 font-bold mb-1">Área Incentivada (ALC / ZFM):</strong>
                        <span>Informa que a tributação na importação não atendeu aos critérios para conversão em isenção conforme LC 214/2025.</span>
                      </div>

                      <div className="grid grid-cols-3 gap-2">
                        <div className="space-y-1">
                          <label className="text-[11px] font-bold text-slate-400">Nº Item</label>
                          <input
                            type="number"
                            min={1}
                            value={numItem}
                            onChange={(e) => setNumItem(parseInt(e.target.value) || 1)}
                            className="w-full bg-slate-900 border border-slate-700 rounded-xl px-2.5 py-1.5 text-xs font-mono text-white"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[11px] font-bold text-slate-400">Qtd Não Isenta</label>
                          <input
                            type="number"
                            step="0.0001"
                            value={quantidadeItem}
                            onChange={(e) => setQuantidadeItem(parseFloat(e.target.value) || 0)}
                            className="w-full bg-slate-900 border border-slate-700 rounded-xl px-2.5 py-1.5 text-xs font-mono text-white"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[11px] font-bold text-slate-400">Unidade</label>
                          <input
                            type="text"
                            value={unidadeItem}
                            onChange={(e) => setUnidadeItem(e.target.value)}
                            className="w-full bg-slate-900 border border-slate-700 rounded-xl px-2.5 py-1.5 text-xs font-mono text-white uppercase"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-1">
                          <label className="text-[11px] font-bold text-slate-400">IBS Devido (R$)</label>
                          <input
                            type="number"
                            step="0.01"
                            value={valorIbsItem}
                            onChange={(e) => setValorIbsItem(parseFloat(e.target.value) || 0)}
                            className="w-full bg-slate-900 border border-slate-700 rounded-xl px-2.5 py-1.5 text-xs font-mono text-cyan-300"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[11px] font-bold text-slate-400">CBS Devida (R$)</label>
                          <input
                            type="number"
                            step="0.01"
                            value={valorCbsItem}
                            onChange={(e) => setValorCbsItem(parseFloat(e.target.value) || 0)}
                            className="w-full bg-slate-900 border border-slate-700 rounded-xl px-2.5 py-1.5 text-xs font-mono text-indigo-300"
                          />
                        </div>
                      </div>
                    </div>
                  )}

                </div>
              )}

              {/* 4. SELETOR DE ACEITE BOOLEANO (1 = ACEITE, 0 = NÃO ACEITE) */}
              {activeEventoDef.tipoPreenchimento === 'aceite_booleano' && (
                <div className="p-4 rounded-xl bg-slate-950 border border-indigo-900/60 space-y-3">
                  <label className="text-xs font-bold text-indigo-300 block">
                    Manifestação Formal de Aceite / Recusa (tag: indAceitacao / indQuitacao)
                  </label>

                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setIndicadorAceitacao(1)}
                      className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex items-center gap-2.5 ${
                        indicadorAceitacao === 1
                          ? 'bg-emerald-950/80 border-emerald-500 text-emerald-200 shadow-md shadow-emerald-950/40 font-bold'
                          : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700'
                      }`}
                    >
                      <CheckCircle2 className={`w-5 h-5 ${indicadorAceitacao === 1 ? 'text-emerald-400' : 'text-slate-500'}`} />
                      <div>
                        <div className="text-xs font-bold">1 = Aceite Pleno</div>
                        <div className="text-[10px] text-slate-400">Concordância com valores de débito/crédito</div>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setIndicadorAceitacao(0)}
                      className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex items-center gap-2.5 ${
                        indicadorAceitacao === 0
                          ? 'bg-red-950/80 border-red-500 text-red-200 shadow-md shadow-red-950/40 font-bold'
                          : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700'
                      }`}
                    >
                      <XCircle className={`w-5 h-5 ${indicadorAceitacao === 0 ? 'text-red-400' : 'text-slate-500'}`} />
                      <div>
                        <div className="text-xs font-bold">0 = Não Aceite</div>
                        <div className="text-[10px] text-slate-400">Discordância / Recusa do lançamento</div>
                      </div>
                    </button>
                  </div>
                </div>
              )}

              {/* 5. EVENTOS SEM PREENCHIMENTO ADICIONAL */}
              {activeEventoDef.tipoPreenchimento === 'nenhum' && (
                <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800 text-xs text-slate-400 flex items-center gap-2">
                  <Info className="w-4 h-4 text-cyan-400 shrink-0" />
                  <span>Este evento transmite a manifestação direta da empresa à SEFAZ com assinatura digital A1, dispensando preenchimento textual prévio.</span>
                </div>
              )}

              {/* Transmit Button */}
              <button
                onClick={handleTransmitEvent}
                disabled={isTransmitting}
                className="w-full py-3.5 rounded-xl bg-gradient-to-r from-blue-600 via-indigo-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white font-extrabold text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-xl shadow-blue-600/30 transition-all disabled:opacity-50 cursor-pointer"
              >
                {isTransmitting ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin text-white" />
                    Assinando com Certificado A1 & Transmitindo para SVRS/CGIBS...
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4 text-cyan-300" />
                    Assinar e Transmitir Evento ({activeEventoDef.codigoEvento})
                  </>
                )}
              </button>
            </div>

            {/* Right Column (6 cols): Event Selector Catalog Cards + Transmitted Log */}
            <div className="lg:col-span-6 space-y-6">
              
              {/* Events Catalog Grid */}
              <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-3 shadow-lg">
                <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <Layers className="w-4 h-4 text-cyan-400" />
                    Catálogo de Eventos para {selectedTipoDfe}
                  </h3>
                  <span className="text-[11px] text-slate-400 font-mono">
                    {eventosFiltrados.length} evento(s) disponível(is)
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-[320px] overflow-y-auto pr-1">
                  {eventosFiltrados.map((evt) => {
                    const isSelected = evt.id === selectedEventoId;
                    return (
                      <button
                        key={evt.id}
                        type="button"
                        onClick={() => handleSelectEvento(evt.id)}
                        className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between gap-2 ${
                          isSelected
                            ? 'bg-gradient-to-br from-blue-950 via-indigo-950 to-slate-900 border-cyan-400 text-white shadow-md shadow-cyan-500/10'
                            : 'bg-slate-950/70 border-slate-800 text-slate-300 hover:border-slate-700 hover:bg-slate-900'
                        }`}
                      >
                        <div>
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-[10px] font-bold font-mono px-1.5 py-0.2 rounded bg-cyan-950 text-cyan-300 border border-cyan-800">
                              {evt.codigoEvento}
                            </span>
                            {evt.isReformaTributaria && (
                              <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-indigo-950 text-cyan-300 border border-indigo-700">
                                RTC
                              </span>
                            )}
                          </div>
                          <div className="font-bold text-xs line-clamp-1">{evt.nome}</div>
                          <div className="text-[10px] text-slate-400 line-clamp-2 mt-0.5">
                            {evt.descricao}
                          </div>
                        </div>

                        <div className="flex items-center justify-between pt-1 border-t border-slate-800/60 text-[10px] text-slate-400">
                          <span className="capitalize">{evt.categoria.replace('_', ' ')}</span>
                          <ChevronRight className={`w-3.5 h-3.5 ${isSelected ? 'text-cyan-400' : 'text-slate-600'}`} />
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Transmitted Log History */}
              <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-3 shadow-lg">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-2.5">
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-indigo-400" />
                    <h3 className="text-sm font-bold text-white">
                      Histórico de Eventos & Manifestações
                    </h3>
                    <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-800 font-bold">
                      {displayedEventos.length}
                    </span>
                  </div>

                  {/* Botão de Consulta de Eventos na SEFAZ */}
                  <button
                    type="button"
                    disabled={isConsultandoSefaz || !activeChave}
                    onClick={handleConsultarEventosSefaz}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 disabled:opacity-50 text-white font-bold text-xs shadow-md transition cursor-pointer self-start sm:self-auto"
                    title="Consulta o WebService da SEFAZ para buscar eventos registrados por terceiros (manifestações, CC-e, cancelamentos)"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isConsultandoSefaz ? 'animate-spin' : ''}`} />
                    <span>{isConsultandoSefaz ? 'Consultando SEFAZ...' : 'Consultar Eventos na SEFAZ'}</span>
                  </button>
                </div>

                {/* Filtros do Histórico: Todos vs Desta Nota vs Terceiros */}
                <div className="flex items-center gap-1.5 flex-wrap pt-1">
                  <button
                    type="button"
                    onClick={() => setHistoricoFiltro('todos')}
                    className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition cursor-pointer ${
                      historicoFiltro === 'todos'
                        ? 'bg-indigo-600 text-white shadow-sm'
                        : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
                    }`}
                  >
                    Todos da Empresa ({transmittedLog.length})
                  </button>

                  <button
                    type="button"
                    onClick={() => setHistoricoFiltro('nota_ativa')}
                    className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition cursor-pointer ${
                      historicoFiltro === 'nota_ativa'
                        ? 'bg-cyan-600 text-white shadow-sm'
                        : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
                    }`}
                  >
                    Desta Nota ({transmittedLog.filter(l => (l.chaveAcesso || '').replace(/\D/g, '') === (activeChave || '').replace(/\D/g, '')).length})
                  </button>

                  <button
                    type="button"
                    onClick={() => setHistoricoFiltro('terceiros')}
                    className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition cursor-pointer flex items-center gap-1 ${
                      historicoFiltro === 'terceiros'
                        ? 'bg-amber-600 text-white shadow-sm'
                        : 'bg-slate-950 text-amber-400/80 hover:text-amber-300 border border-slate-800'
                    }`}
                  >
                    <span>🚨 Recebidos de Terceiros</span>
                    <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-amber-950 text-amber-200 border border-amber-800">
                      {transmittedLog.filter(l => l.origemEvento === 'terceiro_destinatario' || ['210220', '210240', '210200', '210210'].includes(l.codigoEvento)).length}
                    </span>
                  </button>
                </div>

                {/* Feedback da Consulta SEFAZ */}
                {consultaSefazResult && (
                  <div className={`p-2.5 rounded-xl border text-xs flex items-center justify-between gap-2 animate-in fade-in duration-150 ${
                    consultaSefazResult.tipo === 'success'
                      ? 'bg-emerald-950/60 border-emerald-800 text-emerald-200'
                      : consultaSefazResult.tipo === 'warning'
                      ? 'bg-amber-950/60 border-amber-800 text-amber-200'
                      : 'bg-rose-950/60 border-rose-800 text-rose-200'
                  }`}>
                    <span>{consultaSefazResult.msg}</span>
                    <button
                      type="button"
                      onClick={() => setConsultaSefazResult(null)}
                      className="text-slate-400 hover:text-white text-xs px-1 cursor-pointer"
                    >
                      ✕
                    </button>
                  </div>
                )}

                <div className="space-y-2.5 max-h-[420px] overflow-y-auto pr-1">
                  {displayedEventos.length === 0 ? (
                    <div className="p-6 text-center text-xs text-slate-400 bg-slate-950/40 rounded-xl border border-slate-800/80 space-y-2">
                      <p>Nenhum evento registrado com este filtro.</p>
                      {activeChave && (
                        <p className="text-slate-500 text-[11px]">
                          Clique no botão <strong>"Consultar Eventos na SEFAZ"</strong> acima para verificar se clientes ou a SEFAZ registraram manifestações (Ciência, Confirmação, Desconhecimento) para esta chave.
                        </p>
                      )}
                    </div>
                  ) : (
                    displayedEventos.map((log) => (
                    <div
                      key={log.id}
                      className={`p-3.5 rounded-xl border space-y-2 text-xs transition-all ${
                        log.codigoEvento === '210220'
                          ? 'bg-red-950/40 border-red-600/80 shadow-md shadow-red-950/30'
                          : log.codigoEvento === '210240'
                          ? 'bg-amber-950/40 border-amber-600/80'
                          : log.origemEvento === 'terceiro_destinatario'
                          ? 'bg-slate-950/90 border-amber-800/60'
                          : 'bg-slate-950/80 border-slate-800/80'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-bold text-[10px] px-2 py-0.5 rounded bg-blue-950 text-cyan-300 border border-blue-800">
                            {log.tipoDfe}
                          </span>
                          <span className="font-bold text-[10px] px-2 py-0.5 rounded bg-slate-900 text-slate-200 border border-slate-700 font-mono">
                            {log.codigoEvento}
                          </span>
                          <span className="font-bold text-white text-xs truncate max-w-[180px]">
                            {log.nomeEvento}
                          </span>
                          {log.origemEvento === 'terceiro_destinatario' && (
                            <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-amber-950 text-amber-300 border border-amber-700">
                              Recebido de Cliente
                            </span>
                          )}
                        </div>

                        <span className="text-slate-400 font-mono text-[10px] whitespace-nowrap">
                          {formatBrasiliaDateTime(log.dataHora)}
                        </span>
                      </div>

                      {/* Alerta de Desconhecimento da Operação */}
                      {log.codigoEvento === '210220' && (
                        <div className="p-2 rounded-lg bg-red-950/90 border border-red-600 text-[11px] text-red-200 font-bold flex items-center gap-1.5">
                          <ShieldAlert className="w-4 h-4 text-red-400 shrink-0" />
                          <span>🚨 CLIENTE MANIFESTOU DESCONHECIMENTO DA OPERAÇÃO! (Risco de Glosa no IBS/CBS)</span>
                        </div>
                      )}

                      {/* Alerta de Operação Não Realizada */}
                      {log.codigoEvento === '210240' && (
                        <div className="p-2 rounded-lg bg-amber-950/90 border border-amber-600 text-[11px] text-amber-200 font-bold flex items-center gap-1.5">
                          <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                          <span>⚠️ OPERAÇÃO NÃO REALIZADA PELO DESTINATÁRIO</span>
                        </div>
                      )}

                      <div className="text-slate-400 font-mono text-[10px] truncate bg-slate-900/60 p-1.5 rounded border border-slate-800 flex justify-between items-center">
                        <span>Chave: {log.chaveAcesso}</span>
                        {log.autorCnpj && (
                          <span className="text-slate-400 font-mono">Autor: {log.autorCnpj}</span>
                        )}
                      </div>

                      <div className="flex items-center justify-between pt-1 border-t border-slate-800/80 text-[10px]">
                        <div className="text-slate-400">
                          {log.status === 'processado' ? (
                            <>Protocolo SEFAZ: <strong className="text-emerald-400 font-mono">{log.protocoloSeFaz || 'Autorizado'}</strong></>
                          ) : (
                            <>Situação: <strong className="text-amber-400 font-mono">{log.protocoloSeFaz || 'Rejeição SEFAZ'}</strong></>
                          )}
                        </div>

                        <span className={`inline-flex items-center gap-1 font-bold px-2 py-0.5 rounded border ${
                          log.status === 'processado'
                            ? 'text-emerald-400 bg-emerald-950/60 border-emerald-800'
                            : 'text-red-400 bg-red-950/60 border-red-800'
                        }`}>
                          {log.status === 'processado' ? <CheckCircle2 className="w-3 h-3" /> : <AlertCircle className="w-3 h-3" />}
                          {log.status === 'processado' ? 'Homologado SEFAZ' : 'Rejeitado / Pendente'}
                        </span>
                      </div>

                      {/* Badge usando getBadgeColors */}
                      <div className="flex items-center gap-2 pt-1">
                        <span className={`px-2 py-0.5 text-xs font-medium rounded-full border ${getBadgeColors(log.nomeEvento, log.categoria, log.codigoEvento)}`}>
                          {log.categoria === 'destinatario' ? 'Terceiro' : log.categoria === 'fisco' ? 'Fisco' : 'Próprio'}
                        </span>
                      </div>

                      {log.justificativa && (
                        <div className="text-[11px] text-slate-300 bg-slate-900 p-2 rounded border border-slate-800 italic">
                          Justificativa: "{log.justificativa}"
                        </div>
                      )}

                      {log.dadosEstruturados && (
                        <div className="p-2.5 rounded-lg bg-slate-900/90 border border-cyan-900/40 text-[11px] space-y-1 font-mono">
                          {log.dadosEstruturados.dPrevEntrega && (
                            <div className="flex justify-between text-cyan-300">
                              <span className="text-slate-400">📅 Nova Previsão Entrega:</span>
                              <strong>{log.dadosEstruturados.dPrevEntrega}</strong>
                            </div>
                          )}
                          {log.dadosEstruturados.nItem !== undefined && (
                            <div className="flex justify-between text-white">
                              <span className="text-slate-400">Item Vinculado:</span>
                              <span>Item #{log.dadosEstruturados.nItem} ({log.dadosEstruturados.qImobilizado ?? log.dadosEstruturados.qComb ?? log.dadosEstruturados.qPerecimento ?? log.dadosEstruturados.qNaoFornecida ?? log.dadosEstruturados.qtdeNaoIsenta ?? 1} {log.dadosEstruturados.uImobilizado ?? log.dadosEstruturados.uComb ?? log.dadosEstruturados.uPerecimento ?? log.dadosEstruturados.uNaoFornecida ?? log.dadosEstruturados.unidadeNaoIsenta ?? 'UN'})</span>
                            </div>
                          )}
                          {(log.dadosEstruturados.vIBS !== undefined || log.dadosEstruturados.vCBS !== undefined) && (
                            <div className="flex justify-between text-slate-300 text-[10px]">
                              <span className="text-slate-400">Tributos Apurados:</span>
                              <span>IBS: R$ {(log.dadosEstruturados.vIBS || 0).toFixed(2)} | CBS: R$ {(log.dadosEstruturados.vCBS || 0).toFixed(2)}</span>
                            </div>
                          )}
                          {log.dadosEstruturados.cCredPres && (
                            <div className="flex justify-between text-purple-300 text-[10px]">
                              <span className="text-slate-400">cCredPres:</span>
                              <span>Cód. {log.dadosEstruturados.cCredPres} (BC: R$ {(log.dadosEstruturados.vBCCredPres || 0).toFixed(2)})</span>
                            </div>
                          )}
                          {log.dadosEstruturados.indAceitacao !== undefined && (
                            <div className="flex justify-between text-[10px]">
                              <span className="text-slate-400">Status Aceite:</span>
                              <strong className={log.dadosEstruturados.indAceitacao === 1 ? 'text-emerald-400' : 'text-red-400'}>
                                {log.dadosEstruturados.indAceitacao === 1 ? '✅ Aceite Pleno Homologado' : '❌ Recusa Formal Registrada'}
                              </strong>
                            </div>
                          )}
                        </div>
                      )}

                      {log.detalhesReforma && (
                        <div className="p-2 rounded bg-indigo-950/40 border border-indigo-900/60 text-[10px] text-cyan-300 flex items-center justify-between font-mono">
                          <span>{log.detalhesReforma.cbsAjuste}</span>
                          <span>{log.detalhesReforma.ibsAjuste}</span>
                        </div>
                      )}
                    </div>
                  )))}
                </div>
              </div>

            </div>

          </div>
        </div>
      )}

      {/* TAB 2: BIBLIOTECA DE NOTAS TÉCNICAS RTC */}
      {activeTab === 'notas_tecnicas' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            
            {/* Card 1: NT 2025.002-RTC v1.51 */}
            <div className="p-5 rounded-2xl bg-slate-900/90 border border-blue-800/60 space-y-3 relative overflow-hidden shadow-lg">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
                <span className="px-2.5 py-1 rounded bg-blue-950 text-blue-300 font-mono font-bold text-xs border border-blue-700">
                  NT 2025.002-RTC v1.51
                </span>
                <span className="text-[10px] font-bold text-emerald-400 bg-emerald-950/80 px-2 py-0.5 rounded border border-emerald-800">
                  NF-e / NFC-e
                </span>
              </div>

              <h4 className="text-base font-extrabold text-white">
                Adequações NF-e & NFC-e (Julho 2026)
              </h4>
              <p className="text-xs text-slate-300 leading-relaxed">
                Define novos campos de tributação do IBS, CBS e Imposto Seletivo (IS), alíquotas efetivas, devoluções, compra governamental, tributação monofásica de combustíveis e os 16 novos eventos de apuração assistida.
              </p>

              <div className="space-y-1.5 pt-2 border-t border-slate-800 text-xs">
                <div className="flex justify-between text-[11px]"><span className="text-slate-400">Campos IBS/CBS/IS:</span><strong className="text-cyan-300 font-mono">Grupo UB / W03</strong></div>
                <div className="flex justify-between text-[11px]"><span className="text-slate-400">Classificação Tributária:</span><strong className="text-cyan-300 font-mono">cClassTrib / CST</strong></div>
                <div className="flex justify-between text-[11px]"><span className="text-slate-400">Prazo Obrigatório CRT=3:</span><strong className="text-emerald-400 font-mono">03/08/2026</strong></div>
                <div className="flex justify-between text-[11px]"><span className="text-slate-400">Prazo Simples / MEI:</span><strong className="text-amber-400 font-mono">04/01/2027</strong></div>
              </div>
            </div>

            {/* Card 2: NT 2025.001-RTC v1.14a */}
            <div className="p-5 rounded-2xl bg-slate-900/90 border border-purple-800/60 space-y-3 relative overflow-hidden shadow-lg">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
                <span className="px-2.5 py-1 rounded bg-purple-950 text-purple-300 font-mono font-bold text-xs border border-purple-700">
                  NT 2025.001-RTC v1.14a
                </span>
                <span className="text-[10px] font-bold text-indigo-400 bg-indigo-950/80 px-2 py-0.5 rounded border border-indigo-800">
                  CT-e / CT-e OS
                </span>
              </div>

              <h4 className="text-base font-extrabold text-white">
                Transporte & Logística Multimodal
              </h4>
              <p className="text-xs text-slate-300 leading-relaxed">
                Garante o rateio de IBS por município de término da prestação, compras governamentais (`gCompraGov`), prestação em desacordo, total do DFe `vTotDFe` e suporte aos códigos de retorno cStat de 4 dígitos.
              </p>

              <div className="space-y-1.5 pt-2 border-t border-slate-800 text-xs">
                <div className="flex justify-between text-[11px]"><span className="text-slate-400">Grupo de Imposto:</span><strong className="text-purple-300 font-mono">IBSCBS / gIBSCBS</strong></div>
                <div className="flex justify-between text-[11px]"><span className="text-slate-400">Total do DFe:</span><strong className="text-purple-300 font-mono">vTotDFe = vPrest + IBS + CBS</strong></div>
                <div className="flex justify-between text-[11px]"><span className="text-slate-400">Eventos de Desacordo:</span><strong className="text-emerald-400 font-mono">610110 / 610111</strong></div>
                <div className="flex justify-between text-[11px]"><span className="text-slate-400">Implantação Produção:</span><strong className="text-cyan-400 font-mono">04/05/2026</strong></div>
              </div>
            </div>

            {/* Card 3: NT 009 NFS-e */}
            <div className="p-5 rounded-2xl bg-slate-900/90 border border-emerald-800/60 space-y-3 relative overflow-hidden shadow-lg">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
                <span className="px-2.5 py-1 rounded bg-emerald-950 text-emerald-300 font-mono font-bold text-xs border border-emerald-700">
                  Nota Técnica nº 009
                </span>
                <span className="text-[10px] font-bold text-teal-400 bg-teal-950/80 px-2 py-0.5 rounded border border-teal-800">
                  NFS-e Nacional
                </span>
              </div>

              <h4 className="text-base font-extrabold text-white">
                Serviços & Retenções CBS/IBS
              </h4>
              <p className="text-xs text-slate-300 leading-relaxed">
                Sincroniza os municípios brasileiros com o Ambiente Nacional da NFS-e ABRASF, suportando retenção na fonte do CBS e IBS, aceite/contestação pelo tomador e nota de substituição.
              </p>

              <div className="space-y-1.5 pt-2 border-t border-slate-800 text-xs">
                <div className="flex justify-between text-[11px]"><span className="text-slate-400">Retenção na Fonte:</span><strong className="text-emerald-300 font-mono">Conforme Legislação</strong></div>
                <div className="flex justify-between text-[11px]"><span className="text-slate-400">Eventos Tomador:</span><strong className="text-emerald-300 font-mono">Aceite (200100) / Contestação</strong></div>
                <div className="flex justify-between text-[11px]"><span className="text-slate-400">Alíquotas Reduzidas:</span><strong className="text-emerald-400 font-mono">Saúde, Educação e Profissões</strong></div>
                <div className="flex justify-between text-[11px]"><span className="text-slate-400">Integração ABRASF:</span><strong className="text-cyan-400 font-mono">Padrão Nacional REST</strong></div>
              </div>
            </div>

          </div>

          {/* Detailed Timeline Table */}
          <div className="p-6 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-4 shadow-lg">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Clock className="w-5 h-5 text-cyan-400" />
              Cronograma Oficial da Transição e Homologação (Lei Complementar 214/2025)
            </h3>

            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left text-slate-300">
                <thead className="bg-slate-950 text-slate-400 font-bold uppercase tracking-wider text-[10px] border-b border-slate-800">
                  <tr>
                    <th className="p-3">Data / Período</th>
                    <th className="p-3">Ambiente Homologação</th>
                    <th className="p-3">Ambiente Produção</th>
                    <th className="p-3">Impacto Jurídico & Regras</th>
                  </tr>
                </thead>
                <tbody className="divide-y border-t border-slate-800 border-slate-800/60 font-mono">
                  <tr className="hover:bg-slate-800/40">
                    <td className="p-3 font-bold text-cyan-300">Julho / 2025</td>
                    <td className="p-3 text-slate-300 font-sans">Preenchimento IBS/CBS facultativo. Regras aplicadas se preenchidos.</td>
                    <td className="p-3 text-slate-400 font-sans">Campos não implantados. Erro de schema se informados.</td>
                    <td className="p-3"><span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-sans">Fase Teste</span></td>
                  </tr>
                  <tr className="hover:bg-slate-800/40">
                    <td className="p-3 font-bold text-cyan-300">Outubro / 2025</td>
                    <td className="p-3 text-slate-300 font-sans">Campos opcionais com regras de validação ativas.</td>
                    <td className="p-3 text-slate-300 font-sans">Campos opcionais liberados em produção para adaptação de ERPs.</td>
                    <td className="p-3"><span className="px-2 py-0.5 rounded bg-blue-950 text-blue-300 font-sans border border-blue-800">Sem Valor Jurídico</span></td>
                  </tr>
                  <tr className="hover:bg-slate-800/40">
                    <td className="p-3 font-bold text-cyan-300">Janeiro / 2026</td>
                    <td className="p-3 text-slate-300 font-sans">Validação ativa para IBS e CBS.</td>
                    <td className="p-3 text-slate-300 font-sans">Preenchimento obrigatório conforme legislação. Início do valor jurídico.</td>
                    <td className="p-3"><span className="px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 font-sans border border-emerald-800">Vigência Legal</span></td>
                  </tr>
                  <tr className="hover:bg-slate-800/40">
                    <td className="p-3 font-bold text-cyan-300">03 / Agosto / 2026</td>
                    <td className="p-3 text-slate-300 font-sans">Obrigatoriedade total dos novos campos do layout v1.51.</td>
                    <td className="p-3 text-slate-300 font-sans">Obrigatoriedade de preenchimento dos grupos UB/W03 para CRT=3.</td>
                    <td className="p-3"><span className="px-2 py-0.5 rounded bg-purple-950 text-purple-300 font-sans border border-purple-800">Obrigatório CRT=3</span></td>
                  </tr>
                  <tr className="hover:bg-slate-800/40">
                    <td className="p-3 font-bold text-amber-400">04 / Janeiro / 2027</td>
                    <td className="p-3 text-slate-300 font-sans">Obrigatoriedade para Simples Nacional (CRT 1, 2) e MEI (CRT 4).</td>
                    <td className="p-3 text-slate-300 font-sans">Validação obrigatória de IBS/CBS para contribuintes optantes do Simples/MEI.</td>
                    <td className="p-3"><span className="px-2 py-0.5 rounded bg-amber-950 text-amber-300 font-sans border border-amber-800">Simples Nacional & MEI</span></td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}



      {/* TAB 4: GERADOR & VALIDADOR DE SCHEMAS */}
      {activeTab === 'schema_generator' && (
        <div className="p-6 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-4 shadow-lg">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Terminal className="w-5 h-5 text-purple-400" />
              Estrutura XML / JSON do Evento ({activeEventoDef.codigoEvento} - {activeEventoDef.nome})
            </h3>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-purple-950 text-purple-300 border border-purple-800 font-mono font-bold">
              Schema v1.00 / XML Digital Signature
            </span>
          </div>

          <p className="text-xs text-slate-300">
            Abaixo está a representação da mensagem de entrada gerada conforme o leiaute oficial do WebService de Registro de Eventos da SEFAZ/CGIBS:
          </p>

          <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 text-xs font-mono text-slate-300 overflow-x-auto space-y-2">
            <div className="text-cyan-400 font-bold">
              &lt;envEvento xmlns="http://www.portalfiscal.inf.br/nfe" versao="1.00"&gt;
            </div>
            <div className="pl-4 text-slate-400">
              &lt;idLote&gt;10020260805&lt;/idLote&gt;<br />
              &lt;evento versao="1.00"&gt;<br />
              &nbsp;&nbsp;&lt;infEvento Id="ID{activeEventoDef.codigoEvento}{activeChave.slice(0, 30)}01"&gt;<br />
              &nbsp;&nbsp;&nbsp;&nbsp;&lt;cOrgao&gt;91&lt;/cOrgao&gt; &lt;!-- SVRS / Ambiente Nacional --&gt;<br />
              &nbsp;&nbsp;&nbsp;&nbsp;&lt;tpAmb&gt;1&lt;/tpAmb&gt; &lt;!-- 1=Producao, 2=Homologacao --&gt;<br />
              &nbsp;&nbsp;&nbsp;&nbsp;&lt;CNPJ&gt;{(empresaAtiva?.cnpjCompleto || '').replace(/\D/g, '') || 'CNPJ_AUTOR'}&lt;/CNPJ&gt;<br />
              &nbsp;&nbsp;&nbsp;&nbsp;&lt;chNFe&gt;{activeChave || 'CHAVE_DE_ACESSO_44_DIGITOS'}&lt;/chNFe&gt;<br />
              &nbsp;&nbsp;&nbsp;&nbsp;&lt;dhEvento&gt;{new Date().toISOString()}&lt;/dhEvento&gt;<br />
              &nbsp;&nbsp;&nbsp;&nbsp;&lt;tpEvento&gt;{activeEventoDef.codigoEvento}&lt;/tpEvento&gt;<br />
              &nbsp;&nbsp;&nbsp;&nbsp;&lt;nSeqEvento&gt;1&lt;/nSeqEvento&gt;<br />
              &nbsp;&nbsp;&nbsp;&nbsp;&lt;verEvento&gt;1.00&lt;/verEvento&gt;<br />
              &nbsp;&nbsp;&nbsp;&nbsp;&lt;detEvento versao="1.00"&gt;<br />
              &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&lt;descEvento&gt;{activeEventoDef.nome}&lt;/descEvento&gt;<br />
              {activeEventoDef.tipoCamposEstruturados === 'data_entrega' && (
                <span className="text-emerald-300">
                  &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&lt;dPrevEntrega&gt;{dataPrevisaoEntrega}&lt;/dPrevEntrega&gt;<br />
                </span>
              )}
              {activeEventoDef.tipoCamposEstruturados === 'imobilizacao' && (
                <span className="text-emerald-300">
                  &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&lt;gImobilizacao&gt;<br />
                  &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&lt;nItem&gt;{numItem}&lt;/nItem&gt;<br />
                  &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&lt;vIBS&gt;{valorIbsItem.toFixed(2)}&lt;/vIBS&gt;<br />
                  &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&lt;vCBS&gt;{valorCbsItem.toFixed(2)}&lt;/vCBS&gt;<br />
                  &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&lt;gControleEstoque&gt;<br />
                  &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&lt;qImobilizado&gt;{quantidadeItem.toFixed(4)}&lt;/qImobilizado&gt;<br />
                  &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&lt;uImobilizado&gt;{(unidadeItem || 'UN').toUpperCase()}&lt;/uImobilizado&gt;<br />
                  &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&lt;/gControleEstoque&gt;<br />
                  &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&lt;/gImobilizacao&gt;<br />
                </span>
              )}
              {activeEventoDef.tipoCamposEstruturados === 'combustivel' && (
                <span className="text-amber-300">
                  &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&lt;gConsumoComb&gt;<br />
                  &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&lt;nItem&gt;{numItem}&lt;/nItem&gt;<br />
                  &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&lt;vIBS&gt;{valorIbsItem.toFixed(2)}&lt;/vIBS&gt;<br />
                  &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&lt;vCBS&gt;{valorCbsItem.toFixed(2)}&lt;/vCBS&gt;<br />
                  &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&lt;gControleEstoque&gt;<br />
                  &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&lt;qComb&gt;{quantidadeItem.toFixed(4)}&lt;/qComb&gt;<br />
                  &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&lt;uComb&gt;{(unidadeItem || 'L').toUpperCase()}&lt;/uComb&gt;<br />
                  &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&lt;/gControleEstoque&gt;<br />
                  &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&lt;/gConsumoComb&gt;<br />
                </span>
              )}
              {activeEventoDef.tipoCamposEstruturados === 'credito_presumido' && (
                <span className="text-purple-300">
                  &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&lt;gCredPresOper&gt;<br />
                  &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&lt;nItem&gt;{numItem}&lt;/nItem&gt;<br />
                  &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&lt;vBCCredPres&gt;{baseCalculoCredPres.toFixed(2)}&lt;/vBCCredPres&gt;<br />
                  &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&lt;cCredPres&gt;{codigoCreditoPresumido}&lt;/cCredPres&gt;<br />
                  &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&lt;gIBSCredPres&gt;&lt;pCredPres&gt;{aliqCredPres.toFixed(2)}&lt;/pCredPres&gt;&lt;vCredPres&gt;{((baseCalculoCredPres * aliqCredPres) / 100).toFixed(2)}&lt;/vCredPres&gt;&lt;/gIBSCredPres&gt;<br />
                  &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&lt;gCBSCredPres&gt;&lt;pCredPres&gt;{aliqCredPres.toFixed(2)}&lt;/pCredPres&gt;&lt;vCredPres&gt;{((baseCalculoCredPres * aliqCredPres) / 100).toFixed(2)}&lt;/vCredPres&gt;&lt;/gCBSCredPres&gt;<br />
                  &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&lt;/gCredPresOper&gt;<br />
                </span>
              )}
              {activeEventoDef.tipoCamposEstruturados === 'perecimento' && (
                <span className="text-red-300">
                  &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&lt;gPerecimento&gt;<br />
                  &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&lt;nItem&gt;{numItem}&lt;/nItem&gt;<br />
                  &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&lt;vIBS&gt;{valorIbsItem.toFixed(2)}&lt;/vIBS&gt;<br />
                  &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&lt;vCBS&gt;{valorCbsItem.toFixed(2)}&lt;/vCBS&gt;<br />
                  &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&lt;gControleEstoque&gt;<br />
                  &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&lt;qPerecimento&gt;{quantidadeItem.toFixed(4)}&lt;/qPerecimento&gt;<br />
                  &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&lt;uPerecimento&gt;{(unidadeItem || 'UN').toUpperCase()}&lt;/uPerecimento&gt;<br />
                  &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&lt;/gControleEstoque&gt;<br />
                  &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&lt;/gPerecimento&gt;<br />
                </span>
              )}
              {activeEventoDef.tipoCamposEstruturados === 'nao_fornecido' && (
                <span className="text-orange-300">
                  &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&lt;gItemNaoFornecido&gt;<br />
                  &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&lt;nItem&gt;{numItem}&lt;/nItem&gt;<br />
                  &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&lt;vIBS&gt;{valorIbsItem.toFixed(2)}&lt;/vIBS&gt;<br />
                  &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&lt;vCBS&gt;{valorCbsItem.toFixed(2)}&lt;/vCBS&gt;<br />
                  &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&lt;gControleEstoque&gt;<br />
                  &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&lt;qNaoFornecida&gt;{quantidadeItem.toFixed(4)}&lt;/qNaoFornecida&gt;<br />
                  &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&lt;uNaoFornecida&gt;{(unidadeItem || 'UN').toUpperCase()}&lt;/uNaoFornecida&gt;<br />
                  &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&lt;/gControleEstoque&gt;<br />
                  &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&lt;/gItemNaoFornecido&gt;<br />
                </span>
              )}
              {activeEventoDef.tipoPreenchimento === 'aceite_booleano' && (
                <span className="text-cyan-300">
                  &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&lt;indAceitacao&gt;{indicadorAceitacao}&lt;/indAceitacao&gt;<br />
                </span>
              )}
              {activeEventoDef.tipoPreenchimento === 'texto_livre' && (
                <span className="text-amber-300">
                  &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&lt;xCorrecao&gt;{justificativa || 'Texto descritivo livre da retificação secundária...'}&lt;/xCorrecao&gt;<br />
                </span>
              )}
              {(activeEventoDef.tipoPreenchimento === 'justificativa' || (!activeEventoDef.tipoPreenchimento && activeEventoDef.requerJustificativa)) && (
                <span className="text-cyan-300">
                  &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&lt;xJust&gt;{justificativa || 'Texto oficial da justificativa de manifestação...'}&lt;/xJust&gt;<br />
                </span>
              )}
              &nbsp;&nbsp;&nbsp;&nbsp;&lt;/detEvento&gt;<br />
              &nbsp;&nbsp;&lt;/infEvento&gt;<br />
              &nbsp;&nbsp;&lt;Signature xmlns="http://www.w3.org/2000/09/xmldsig#"&gt; &lt;!-- Assinado com Certificado A1 --&gt; &lt;/Signature&gt;<br />
              &lt;/evento&gt;
            </div>
            <div className="text-cyan-400 font-bold">&lt;/envEvento&gt;</div>
          </div>
        </div>
      )}

    </div>
  );
};
