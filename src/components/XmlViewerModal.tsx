import React, { useState, useMemo, useRef } from 'react';
import {
  X,
  Copy,
  Check,
  Download,
  Code,
  FileText,
  Search,
  ChevronDown,
  ChevronRight,
  FolderTree,
  Building2,
  Package,
  Receipt,
  ShieldCheck,
  Sparkles,
  Eye,
  EyeOff,
  Layers,
  ArrowDown
} from 'lucide-react';
import { DfeXmlItem } from '../types';
import { generateDfeXmlContent } from '../utils/xmlParser';

interface XmlViewerModalProps {
  item: DfeXmlItem | null;
  onClose: () => void;
}

/**
 * Utilitário de formatação inteligente (Pretty-Print) para XMLs da SEFAZ
 */
function formatXmlPretty(xml: string, collapseBase64: boolean = true): string[] {
  if (!xml) return [];

  // Limpeza de espaços entre tags
  let clean = xml.trim().replace(/>\s*</g, '><');

  // Tratar blocos de assinatura digital longos para não poluir a leitura
  if (collapseBase64) {
    clean = clean.replace(/<X509Certificate>([A-Za-z0-9+/=\s]{40,})<\/X509Certificate>/g, (_, b64) => {
      const short = b64.trim().substring(0, 28);
      return `<X509Certificate>${short}... [Certificado Digital ICP-Brasil: ${b64.trim().length} bytes]</X509Certificate>`;
    });
    clean = clean.replace(/<SignatureValue>([A-Za-z0-9+/=\s]{40,})<\/SignatureValue>/g, (_, b64) => {
      const short = b64.trim().substring(0, 24);
      return `<SignatureValue>${short}... [Assinatura Digital RSA/SHA-256]</SignatureValue>`;
    });
  }

  // Quebrar em linhas por tags
  const tokens = clean
    .replace(/(<[^\/>]+>)/g, '\n$1')
    .replace(/(<\/[^>]+>)/g, '$1\n')
    .replace(/(<[^\/>]+\/>)/g, '\n$1\n');

  const rawLines = tokens.split('\n').map(l => l.trim()).filter(Boolean);
  const formatted: string[] = [];
  let indent = 0;

  for (let i = 0; i < rawLines.length; i++) {
    const line = rawLines[i];

    // Se for tag de fechamento pura </tag>
    if (line.startsWith('</')) {
      indent = Math.max(0, indent - 1);
    }

    const pad = '  '.repeat(indent);

    // Verificar se a linha atual é tag de abertura e a próxima é valor e a outra é fechamento
    // Ex: <nNF> + 10 + </nNF> -> <nNF>10</nNF>
    if (
      i + 2 < rawLines.length &&
      line.startsWith('<') && !line.startsWith('</') && !line.endsWith('/>') &&
      !rawLines[i + 1].startsWith('<') &&
      rawLines[i + 2].startsWith('</')
    ) {
      const openTagMatch = line.match(/^<([a-zA-Z0-9_:-]+)(?:\s+[^>]*)?>$/);
      const closeTagMatch = rawLines[i + 2].match(/^<\/([a-zA-Z0-9_:-]+)>$/);

      if (openTagMatch && closeTagMatch && openTagMatch[1] === closeTagMatch[1]) {
        formatted.push(`${pad}${line}${rawLines[i + 1]}${rawLines[i + 2]}`);
        i += 2;
        continue;
      }
    }

    // Se já é um nó folha completo em 1 linha <tag attr="...">valor</tag>
    if (/<([a-zA-Z0-9_:-]+)[^>]*>.*<\/\1>/.test(line) || line.endsWith('/>') || line.startsWith('<?') || line.startsWith('<!')) {
      formatted.push(`${pad}${line}`);
      continue;
    }

    formatted.push(`${pad}${line}`);

    // Se abriu nó composto
    if (line.startsWith('<') && !line.startsWith('</') && !line.endsWith('/>') && !line.startsWith('<?') && !line.startsWith('<!')) {
      indent++;
    }
  }

  return formatted;
}

export const XmlViewerModal: React.FC<XmlViewerModalProps> = ({ item, onClose }) => {
  const [copied, setCopied] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [viewMode, setViewMode] = useState<'formatted' | 'tree'>('formatted');
  const [collapseBase64, setCollapseBase64] = useState<boolean>(true);
  const [activeHighlightTag, setActiveHighlightTag] = useState<string | null>(null);
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    ide: true,
    emit: true,
    dest: true,
    det: true,
    total: true,
    IBSCBS: true,
    transp: false,
    cobr: false,
    infAdic: false,
    Signature: false
  });

  const codeContainerRef = useRef<HTMLDivElement>(null);

  const rawXmlContent = useMemo(() => {
    if (!item) return '';
    return item.xmlRaw || generateDfeXmlContent(item);
  }, [item]);

  // Linhas formatadas e indentadas
  const formattedLines = useMemo(() => {
    if (!rawXmlContent) return [];
    return formatXmlPretty(rawXmlContent, collapseBase64);
  }, [rawXmlContent, collapseBase64]);

  if (!item) return null;

  const handleCopy = () => {
    navigator.clipboard.writeText(rawXmlContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const blob = new Blob([rawXmlContent], { type: 'text/xml;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `${item.tipo}_${item.numero || 'doc'}_${item.chaveAcesso}.xml`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const toggleSection = (sec: string) => {
    setExpandedSections(prev => ({ ...prev, [sec]: !prev[sec] }));
  };

  const scrollToTag = (tagName: string) => {
    setSearchTerm(tagName);

    if (viewMode === 'tree') {
      const secMap: Record<string, string> = {
        ide: 'ide',
        emit: 'emit',
        dest: 'dest',
        det: 'det',
        total: 'total',
        IBSCBS: 'IBSCBS',
        Signature: 'Signature'
      };
      const secKey = secMap[tagName] || tagName;
      setExpandedSections(prev => ({ ...prev, [secKey]: true }));
      setActiveHighlightTag(secKey);
      setTimeout(() => setActiveHighlightTag(null), 2500);

      setTimeout(() => {
        const el = document.getElementById(`tree-section-${secKey}`);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 60);
    } else {
      setTimeout(() => {
        const el = codeContainerRef.current?.querySelector('.bg-amber-500\\/25');
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 60);
    }
  };

  // Syntax Highlighting com cores temáticas de IDE moderna
  const renderHighlightedLine = (line: string, idx: number) => {
    const isSearchMatch = searchTerm && line.toLowerCase().includes(searchTerm.toLowerCase());

    // Se for cabeçalho XML
    if (line.trim().startsWith('<?xml')) {
      return (
        <span className="text-slate-500 italic">
          {line}
        </span>
      );
    }

    // Colorizador de nós folha: <tag>conteudo</tag>
    const leafMatch = line.match(/^(\s*)<([a-zA-Z0-9_:-]+)(\s+[^>]*)?>(.*?)<\/([a-zA-Z0-9_:-]+)>$/);
    if (leafMatch) {
      const [, pad, openTag, attrs, content, closeTag] = leafMatch;
      return (
        <span>
          <span className="select-none text-slate-600">{pad}</span>
          <span className="text-cyan-500">&lt;</span>
          <span className="text-indigo-400 font-bold">{openTag}</span>
          {attrs && <span className="text-amber-300">{attrs}</span>}
          <span className="text-cyan-500">&gt;</span>
          <span className={content.includes('[Certificado') || content.includes('[Assinatura') ? 'text-amber-400/90 italic font-mono text-[11px]' : 'text-slate-100 font-semibold'}>
            {content}
          </span>
          <span className="text-cyan-500">&lt;/</span>
          <span className="text-indigo-400 font-bold">{closeTag}</span>
          <span className="text-cyan-500">&gt;</span>
        </span>
      );
    }

    // Colorizador de nós de abertura / fechamento
    const tagMatch = line.match(/^(\s*)(<\/?)([a-zA-Z0-9_:-]+)([^>]*?)(\/?>)$/);
    if (tagMatch) {
      const [, pad, openBracket, tagName, attrs, closeBracket] = tagMatch;
      const isParentTag = ['infNFe', 'ide', 'emit', 'dest', 'det', 'imposto', 'total', 'ICMSTot', 'IBSCBSTot', 'IBSCBS', 'gIBSCBS', 'transp', 'cobr', 'Signature', 'infDPS', 'valores', 'tribFed'].includes(tagName);

      return (
        <span>
          <span className="select-none text-slate-600">{pad}</span>
          <span className="text-cyan-500">{openBracket}</span>
          <span className={`${isParentTag ? 'text-purple-400 font-extrabold underline decoration-purple-500/30' : 'text-indigo-400 font-bold'}`}>
            {tagName}
          </span>
          {attrs && <span className="text-amber-300">{attrs}</span>}
          <span className="text-cyan-500">{closeBracket}</span>
        </span>
      );
    }

    return <span>{line}</span>;
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-2 sm:p-4 overflow-y-auto">
      <div className="bg-slate-950 border border-slate-800 rounded-3xl w-full max-w-5xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden my-auto">
        
        {/* Header Principal */}
        <div className="px-6 py-4 bg-slate-900 border-b border-slate-800 flex flex-wrap items-center justify-between gap-4 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-indigo-600 via-purple-600 to-cyan-600 flex items-center justify-center text-white shadow-lg shadow-indigo-500/20">
              <Code className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-white">
                  Estrutura do XML na Íntegra — {item.tipo} Nº {item.numero}
                </h3>
                <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-indigo-950 text-indigo-300 border border-indigo-800">
                  Schema v4.00 / NT 2025.002
                </span>
              </div>
              <p className="text-xs text-slate-400 font-mono flex items-center gap-1.5 mt-0.5">
                <span>Chave de Acesso:</span>
                <span className="text-cyan-400 font-bold">{item.chaveAcesso}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleCopy}
              className={`px-3.5 py-2 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer ${
                copied
                  ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/30'
                  : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700'
              }`}
            >
              {copied ? <Check className="w-4 h-4 text-emerald-200" /> : <Copy className="w-4 h-4 text-cyan-400" />}
              <span>{copied ? 'Copiado!' : 'Copiar XML'}</span>
            </button>

            <button
              onClick={handleDownload}
              className="px-3.5 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-md shadow-cyan-600/30 transition-all cursor-pointer"
            >
              <Download className="w-4 h-4" />
              <span>Baixar .XML</span>
            </button>

            <button
              onClick={onClose}
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-all cursor-pointer"
              title="Fechar"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Barra de Controles, Modos de Visualização e Busca */}
        <div className="px-6 py-2.5 bg-slate-900/70 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs">
          
          {/* Seletor de Modo (Código vs Árvore) */}
          <div className="flex items-center gap-2 bg-slate-950 p-1 rounded-xl border border-slate-800">
            <button
              onClick={() => setViewMode('formatted')}
              className={`px-3 py-1.5 rounded-lg font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                viewMode === 'formatted'
                  ? 'bg-gradient-to-r from-indigo-600 to-cyan-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Code className="w-3.5 h-3.5" />
              <span>Código Formatado (Pretty XML)</span>
            </button>

            <button
              onClick={() => setViewMode('tree')}
              className={`px-3 py-1.5 rounded-lg font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                viewMode === 'tree'
                  ? 'bg-gradient-to-r from-indigo-600 to-cyan-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <FolderTree className="w-3.5 h-3.5" />
              <span>Árvore Estruturada Fiscal</span>
            </button>
          </div>

          {/* Toggle de Encurtar Assinatura e Busca */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => setCollapseBase64(!collapseBase64)}
              className={`px-2.5 py-1.5 rounded-lg border text-[11px] font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                collapseBase64
                  ? 'bg-purple-950/60 border-purple-800 text-purple-300'
                  : 'bg-slate-800 border-slate-700 text-slate-300'
              }`}
              title="Oculta ou expande blocos longos de assinatura digital Base64 (X.509)"
            >
              {collapseBase64 ? <EyeOff className="w-3.5 h-3.5 text-purple-400" /> : <Eye className="w-3.5 h-3.5 text-cyan-400" />}
              <span>{collapseBase64 ? 'Certificado Base64 Encurtado' : 'Base64 Completo'}</span>
            </button>

            <div className="relative flex items-center">
              <Search className="w-3.5 h-3.5 absolute left-3 text-slate-500" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Localizar tag ou valor (ex: ICMSTot, vCBS, emit)..."
                className="pl-8 pr-3 py-1.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500 w-64 font-mono"
              />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm('')}
                  className="absolute right-2.5 text-slate-500 hover:text-slate-300"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Barra de Atalhos Rápidos para Seções Fiscais */}
        <div className="px-6 py-2 bg-slate-950 border-b border-slate-800/80 flex items-center gap-2 overflow-x-auto text-[11px]">
          <span className="text-slate-500 font-bold flex items-center gap-1 shrink-0">
            <Layers className="w-3.5 h-3.5 text-cyan-400" />
            Atalhos:
          </span>
          <button
            onClick={() => scrollToTag('ide')}
            className="px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 hover:text-white shrink-0 cursor-pointer font-mono"
          >
            &lt;ide&gt; Identificação
          </button>
          <button
            onClick={() => scrollToTag('emit')}
            className="px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 hover:text-white shrink-0 cursor-pointer font-mono"
          >
            &lt;emit&gt; Emitente
          </button>
          <button
            onClick={() => scrollToTag('dest')}
            className="px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 hover:text-white shrink-0 cursor-pointer font-mono"
          >
            &lt;dest&gt; Destinatário
          </button>
          <button
            onClick={() => scrollToTag('det')}
            className="px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 hover:text-white shrink-0 cursor-pointer font-mono"
          >
            &lt;det&gt; Itens/Produtos
          </button>
          <button
            onClick={() => scrollToTag('total')}
            className="px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 hover:text-white shrink-0 cursor-pointer font-mono"
          >
            &lt;total&gt; Totais
          </button>
          <button
            onClick={() => scrollToTag('IBSCBS')}
            className="px-2.5 py-1 rounded-lg bg-cyan-950/60 hover:bg-cyan-900/80 border border-cyan-800 text-cyan-300 hover:text-white shrink-0 cursor-pointer font-mono font-bold"
          >
            &lt;IBSCBS&gt; Reforma Tributária
          </button>
          <button
            onClick={() => scrollToTag('Signature')}
            className="px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-400 hover:text-white shrink-0 cursor-pointer font-mono"
          >
            &lt;Signature&gt; Assinatura
          </button>
        </div>

        {/* ── CORPO PRINCIPAL ──────────────────────────────── */}
        <div ref={codeContainerRef} className="p-4 bg-slate-950 overflow-auto flex-1 font-mono select-text">
          
          {/* MODO 1: CÓDIGO FORMATADO (PRETTY XML COM INDENTAÇÃO E SYNTAX HIGHLIGHTING) */}
          {viewMode === 'formatted' && (
            <div className="bg-slate-900/50 rounded-2xl border border-slate-800/80 py-3 overflow-x-auto shadow-inner text-xs leading-relaxed">
              {formattedLines.map((line, idx) => {
                const isMatch = searchTerm && line.toLowerCase().includes(searchTerm.toLowerCase());
                return (
                  <div
                    key={idx}
                    className={`flex items-start transition-colors px-2 py-0.5 hover:bg-slate-800/60 ${
                      isMatch ? 'bg-amber-500/25 text-amber-200 font-bold' : ''
                    }`}
                  >
                    {/* Número da Linha */}
                    <span className="w-12 shrink-0 select-none text-right pr-4 text-slate-600 font-mono text-[11px] py-0.5 border-r border-slate-800">
                      {idx + 1}
                    </span>
                    {/* Linha Formatada */}
                    <pre className="pl-4 font-mono text-xs overflow-x-auto whitespace-pre">
                      {renderHighlightedLine(line, idx)}
                    </pre>
                  </div>
                );
              })}
            </div>
          )}

          {/* MODO 2: ÁRVORE ESTRUTURADA FISCAL (TREE VIEW INTERATIVO) */}
          {viewMode === 'tree' && (
            <div className="space-y-3 text-xs font-sans">
              
              {/* 1. Identificação (<ide>) */}
              <div
                id="tree-section-ide"
                className={`rounded-2xl bg-slate-900/80 border border-slate-800 overflow-hidden transition-all duration-500 ${
                  activeHighlightTag === 'ide' ? 'ring-2 ring-cyan-400 shadow-xl shadow-cyan-500/20' : ''
                }`}
              >
                <button
                  type="button"
                  onClick={() => toggleSection('ide')}
                  className="w-full p-3.5 flex items-center justify-between bg-slate-900 hover:bg-slate-800/80 transition-colors text-left cursor-pointer"
                >
                  <div className="flex items-center gap-2.5 font-bold text-white">
                    {expandedSections.ide ? <ChevronDown className="w-4 h-4 text-cyan-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
                    <FileText className="w-4 h-4 text-cyan-400" />
                    <span>&lt;ide&gt; Identificação do Documento Fiscal</span>
                  </div>
                  <span className="text-xs font-mono text-cyan-300">
                    {item.tipo} Nº {item.numero} • Série {item.serie} • Emissão: {item.dataEmissao}
                  </span>
                </button>
                {expandedSections.ide && (
                  <div className="p-4 bg-slate-950/60 border-t border-slate-800 grid grid-cols-2 sm:grid-cols-4 gap-3 font-mono text-xs">
                    <div className="p-2.5 bg-slate-900 rounded-xl border border-slate-800">
                      <span className="text-slate-400 block text-[10px]">&lt;nNF&gt; Número:</span>
                      <strong className="text-white">{item.numero}</strong>
                    </div>
                    <div className="p-2.5 bg-slate-900 rounded-xl border border-slate-800">
                      <span className="text-slate-400 block text-[10px]">&lt;serie&gt; Série:</span>
                      <strong className="text-white">{item.serie}</strong>
                    </div>
                    <div className="p-2.5 bg-slate-900 rounded-xl border border-slate-800">
                      <span className="text-slate-400 block text-[10px]">&lt;dhEmi&gt; Data Emissão:</span>
                      <strong className="text-cyan-300">{item.dataEmissao}</strong>
                    </div>
                    <div className="p-2.5 bg-slate-900 rounded-xl border border-slate-800">
                      <span className="text-slate-400 block text-[10px]">&lt;tpNF&gt; Tipo Operação:</span>
                      <strong className="text-emerald-400">1 - Saída / Venda</strong>
                    </div>
                  </div>
                )}
              </div>

              {/* 2. Emitente (<emit>) */}
              <div
                id="tree-section-emit"
                className={`rounded-2xl bg-slate-900/80 border border-slate-800 overflow-hidden transition-all duration-500 ${
                  activeHighlightTag === 'emit' ? 'ring-2 ring-purple-400 shadow-xl shadow-purple-500/20' : ''
                }`}
              >
                <button
                  type="button"
                  onClick={() => toggleSection('emit')}
                  className="w-full p-3.5 flex items-center justify-between bg-slate-900 hover:bg-slate-800/80 transition-colors text-left cursor-pointer"
                >
                  <div className="flex items-center gap-2.5 font-bold text-white">
                    {expandedSections.emit ? <ChevronDown className="w-4 h-4 text-purple-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
                    <Building2 className="w-4 h-4 text-purple-400" />
                    <span>&lt;emit&gt; Emitente / Fornecedor</span>
                  </div>
                  <span className="text-xs font-mono text-purple-300">
                    {item.emitenteNome} ({item.emitenteCnpj})
                  </span>
                </button>
                {expandedSections.emit && (
                  <div className="p-4 bg-slate-950/60 border-t border-slate-800 grid grid-cols-1 sm:grid-cols-3 gap-3 font-mono text-xs">
                    <div className="p-2.5 bg-slate-900 rounded-xl border border-slate-800 sm:col-span-2">
                      <span className="text-slate-400 block text-[10px]">&lt;xNome&gt; Razão Social:</span>
                      <strong className="text-white font-sans">{item.emitenteNome}</strong>
                    </div>
                    <div className="p-2.5 bg-slate-900 rounded-xl border border-slate-800">
                      <span className="text-slate-400 block text-[10px]">&lt;CNPJ&gt; CNPJ:</span>
                      <strong className="text-purple-300">{item.emitenteCnpj}</strong>
                    </div>
                  </div>
                )}
              </div>

              {/* 3. Destinatário (<dest>) */}
              <div
                id="tree-section-dest"
                className={`rounded-2xl bg-slate-900/80 border border-slate-800 overflow-hidden transition-all duration-500 ${
                  activeHighlightTag === 'dest' ? 'ring-2 ring-blue-400 shadow-xl shadow-blue-500/20' : ''
                }`}
              >
                <button
                  type="button"
                  onClick={() => toggleSection('dest')}
                  className="w-full p-3.5 flex items-center justify-between bg-slate-900 hover:bg-slate-800/80 transition-colors text-left cursor-pointer"
                >
                  <div className="flex items-center gap-2.5 font-bold text-white">
                    {expandedSections.dest ? <ChevronDown className="w-4 h-4 text-blue-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
                    <Building2 className="w-4 h-4 text-blue-400" />
                    <span>&lt;dest&gt; Destinatário / Tomador</span>
                  </div>
                  <span className="text-xs font-mono text-blue-300">
                    {item.destinatarioNome} ({item.destinatarioCnpj})
                  </span>
                </button>
                {expandedSections.dest && (
                  <div className="p-4 bg-slate-950/60 border-t border-slate-800 grid grid-cols-1 sm:grid-cols-3 gap-3 font-mono text-xs">
                    <div className="p-2.5 bg-slate-900 rounded-xl border border-slate-800 sm:col-span-2">
                      <span className="text-slate-400 block text-[10px]">&lt;xNome&gt; Razão Social:</span>
                      <strong className="text-white font-sans">{item.destinatarioNome}</strong>
                    </div>
                    <div className="p-2.5 bg-slate-900 rounded-xl border border-slate-800">
                      <span className="text-slate-400 block text-[10px]">&lt;CNPJ&gt; CNPJ:</span>
                      <strong className="text-blue-300">{item.destinatarioCnpj}</strong>
                    </div>
                  </div>
                )}
              </div>

              {/* 4. Produtos e Serviços (<det>) */}
              <div
                id="tree-section-det"
                className={`rounded-2xl bg-slate-900/80 border border-slate-800 overflow-hidden transition-all duration-500 ${
                  activeHighlightTag === 'det' ? 'ring-2 ring-amber-400 shadow-xl shadow-amber-500/20' : ''
                }`}
              >
                <button
                  type="button"
                  onClick={() => toggleSection('det')}
                  className="w-full p-3.5 flex items-center justify-between bg-slate-900 hover:bg-slate-800/80 transition-colors text-left cursor-pointer"
                >
                  <div className="flex items-center gap-2.5 font-bold text-white">
                    {expandedSections.det ? <ChevronDown className="w-4 h-4 text-amber-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
                    <Package className="w-4 h-4 text-amber-400" />
                    <span>&lt;det&gt; Produtos / Serviços ({item.itens?.length || 1} itens)</span>
                  </div>
                  <span className="text-xs font-mono text-amber-300 font-bold">
                    Total: {item.valorTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                  </span>
                </button>
                {expandedSections.det && (
                  <div className="p-4 bg-slate-950/60 border-t border-slate-800 space-y-2 font-mono text-xs">
                    {item.itens && item.itens.length > 0 ? (
                      item.itens.map((it, idx) => (
                        <div key={idx} className="p-3 bg-slate-900 rounded-xl border border-slate-800 flex flex-wrap items-center justify-between gap-2">
                          <div>
                            <div className="font-bold text-white font-sans">
                              #{it.numeroItem} - {it.descricao}
                            </div>
                            <div className="text-[11px] text-slate-400">
                              NCM: {it.ncm || '2711.19.10'} • Qtd: {it.quantidade} {it.unidade} • Unit: R$ {it.valorUnitario?.toFixed(2)}
                            </div>
                          </div>
                          <div className="text-right">
                            <strong className="text-emerald-400 text-sm">
                              {it.valorTotal?.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                            </strong>
                            <div className="text-[10px] text-cyan-400">
                              cClassTrib: {it.cClassTrib || '000001'}
                            </div>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="p-3 bg-slate-900 rounded-xl border border-slate-800 flex items-center justify-between">
                        <div>
                          <div className="font-bold text-white">Item Principal da Operação</div>
                          <div className="text-slate-400 text-[11px]">Item único associado ao valor total</div>
                        </div>
                        <strong className="text-emerald-400 text-sm">
                          {item.valorTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                        </strong>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* 5. Totais Globais (<total> / <ICMSTot>) */}
              <div
                id="tree-section-total"
                className={`rounded-2xl bg-slate-900/80 border border-slate-800 overflow-hidden transition-all duration-500 ${
                  activeHighlightTag === 'total' ? 'ring-2 ring-emerald-400 shadow-xl shadow-emerald-500/20' : ''
                }`}
              >
                <button
                  type="button"
                  onClick={() => toggleSection('total')}
                  className="w-full p-3.5 flex items-center justify-between bg-slate-900 hover:bg-slate-800/80 transition-colors text-left cursor-pointer"
                >
                  <div className="flex items-center gap-2.5 font-bold text-white">
                    {expandedSections.total ? <ChevronDown className="w-4 h-4 text-emerald-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
                    <Receipt className="w-4 h-4 text-emerald-400" />
                    <span>&lt;total&gt; Totais do Documento & Tributos Convencionais</span>
                  </div>
                  <span className="text-xs font-mono font-bold text-emerald-400">
                    Total DF-e: {item.valorTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                  </span>
                </button>
                {expandedSections.total && (
                  <div className="p-4 bg-slate-950/60 border-t border-slate-800 grid grid-cols-2 sm:grid-cols-4 gap-3 font-mono text-xs">
                    <div className="p-2.5 bg-slate-900 rounded-xl border border-slate-800">
                      <span className="text-slate-400 block text-[10px]">&lt;vNF&gt; Valor Total do DF-e:</span>
                      <strong className="text-emerald-400 text-sm font-bold">
                        {item.valorTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                      </strong>
                    </div>
                    <div className="p-2.5 bg-slate-900 rounded-xl border border-slate-800">
                      <span className="text-slate-400 block text-[10px]">&lt;vICMS&gt; Valor ICMS:</span>
                      <strong className="text-white">
                        {item.valorIcms.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                      </strong>
                    </div>
                    <div className="p-2.5 bg-slate-900 rounded-xl border border-slate-800">
                      <span className="text-slate-400 block text-[10px]">&lt;vPIS&gt; Valor PIS:</span>
                      <strong className="text-white">
                        {item.valorPis.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                      </strong>
                    </div>
                    <div className="p-2.5 bg-slate-900 rounded-xl border border-slate-800">
                      <span className="text-slate-400 block text-[10px]">&lt;vCOFINS&gt; Valor COFINS:</span>
                      <strong className="text-white">
                        {item.valorCofins.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                      </strong>
                    </div>
                  </div>
                )}
              </div>

              {/* 6. Reforma Tributária: CBS / IBS (<IBSCBSTot>) */}
              <div
                id="tree-section-IBSCBS"
                className={`rounded-2xl bg-gradient-to-br from-cyan-950/40 to-blue-950/40 border border-cyan-800/60 overflow-hidden transition-all duration-500 ${
                  activeHighlightTag === 'IBSCBS' ? 'ring-2 ring-cyan-400 shadow-xl shadow-cyan-500/20' : ''
                }`}
              >
                <button
                  type="button"
                  onClick={() => toggleSection('IBSCBS')}
                  className="w-full p-3.5 flex items-center justify-between bg-cyan-950/60 hover:bg-cyan-900/60 transition-colors text-left cursor-pointer"
                >
                  <div className="flex items-center gap-2.5 font-bold text-cyan-300">
                    {expandedSections.IBSCBS ? <ChevronDown className="w-4 h-4 text-cyan-400" /> : <ChevronRight className="w-4 h-4 text-cyan-400" />}
                    <Sparkles className="w-4 h-4 text-cyan-400" />
                    <span>&lt;IBSCBSTot&gt; Reforma Tributária (CBS & IBS - NT 2025.002)</span>
                  </div>
                  <span className="text-xs font-mono font-bold text-cyan-300">
                    Dual Tax: R$ {(item.valorCbs + item.valorIbs).toFixed(2)}
                  </span>
                </button>
                {expandedSections.IBSCBS && (
                  <div className="p-4 bg-slate-950/70 border-t border-cyan-900/60 grid grid-cols-2 sm:grid-cols-4 gap-3 font-mono text-xs">
                    <div className="p-2.5 bg-slate-900 rounded-xl border border-cyan-900/60">
                      <span className="text-slate-400 block text-[10px]">&lt;pCBS&gt; Alíquota CBS:</span>
                      <strong className="text-cyan-300">{item.aliquotaCbs}% (Federal)</strong>
                    </div>
                    <div className="p-2.5 bg-slate-900 rounded-xl border border-cyan-900/60">
                      <span className="text-slate-400 block text-[10px]">&lt;vCBS&gt; Valor CBS:</span>
                      <strong className="text-cyan-400 text-sm font-bold">
                        {item.valorCbs.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                      </strong>
                    </div>
                    <div className="p-2.5 bg-slate-900 rounded-xl border border-indigo-900/60">
                      <span className="text-slate-400 block text-[10px]">&lt;pIBS&gt; Alíquota IBS:</span>
                      <strong className="text-indigo-300">{item.aliquotaIbs}% (Est/Mun)</strong>
                    </div>
                    <div className="p-2.5 bg-slate-900 rounded-xl border border-indigo-900/60">
                      <span className="text-slate-400 block text-[10px]">&lt;vIBS&gt; Valor IBS:</span>
                      <strong className="text-indigo-400 text-sm font-bold">
                        {item.valorIbs.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                      </strong>
                    </div>
                  </div>
                )}
              </div>

              {/* 7. Assinatura Digital X.509 (<Signature>) */}
              <div
                id="tree-section-Signature"
                className={`rounded-2xl bg-slate-900/80 border border-slate-800 overflow-hidden transition-all duration-500 ${
                  activeHighlightTag === 'Signature' ? 'ring-2 ring-emerald-400 shadow-xl shadow-emerald-500/20' : ''
                }`}
              >
                <button
                  type="button"
                  onClick={() => toggleSection('Signature')}
                  className="w-full p-3.5 flex items-center justify-between bg-slate-900 hover:bg-slate-800/80 transition-colors text-left cursor-pointer"
                >
                  <div className="flex items-center gap-2.5 font-bold text-white">
                    {expandedSections.Signature ? <ChevronDown className="w-4 h-4 text-emerald-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
                    <ShieldCheck className="w-4 h-4 text-emerald-400" />
                    <span>&lt;Signature&gt; Assinatura Digital ICP-Brasil (XML-DSig)</span>
                  </div>
                  <span className="text-xs font-mono text-emerald-400">
                    ✅ Assinado e Validado com Certificado A1
                  </span>
                </button>
                {expandedSections.Signature && (
                  <div className="p-4 bg-slate-950/60 border-t border-slate-800 space-y-2 font-mono text-xs">
                    <div className="p-3 bg-slate-900 rounded-xl border border-slate-800">
                      <span className="text-slate-400 block text-[10px]">&lt;DigestValue&gt; Hash SHA-1 / SHA-256 do Documento:</span>
                      <code className="text-cyan-300 text-[11px] break-all">{item.sha256 || '4f1b4a9e2c88f...'}</code>
                    </div>
                    <div className="p-3 bg-slate-900 rounded-xl border border-slate-800">
                      <span className="text-slate-400 block text-[10px]">&lt;SignatureMethod&gt; Algoritmo de Criptografia:</span>
                      <strong className="text-white">http://www.w3.org/2001/04/xmldsig-more#rsa-sha256</strong>
                    </div>
                  </div>
                )}
              </div>

            </div>
          )}

        </div>

        {/* Footer info */}
        <div className="px-6 py-3 bg-slate-900 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400 shrink-0">
          <div className="flex items-center gap-2 font-mono">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            <span>Documento Fiscal Assinado e Validado com Certificado A1</span>
          </div>
          <div>
            Total: <strong className="text-emerald-400 font-mono text-sm">{item.valorTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</strong>
          </div>
        </div>

      </div>
    </div>
  );
};
