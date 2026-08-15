import React, { useState } from 'react';
import { X, Copy, Check, Download, Code, FileText, Search } from 'lucide-react';
import { DfeXmlItem } from '../types';
import { generateDfeXmlContent } from '../utils/xmlParser';

interface XmlViewerModalProps {
  item: DfeXmlItem | null;
  onClose: () => void;
}

export const XmlViewerModal: React.FC<XmlViewerModalProps> = ({ item, onClose }) => {
  const [copied, setCopied] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  if (!item) return null;

  const xmlContent = generateDfeXmlContent(item);

  const handleCopy = () => {
    navigator.clipboard.writeText(xmlContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const blob = new Blob([xmlContent], { type: 'text/xml;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `${item.tipo}_${item.numero}_${item.chaveAcesso}.xml`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Syntax highlighting helper for XML lines
  const renderHighlightedXml = (xml: string) => {
    const lines = xml.split('\n');

    return lines.map((line, idx) => {
      // Check search match
      const isMatch = searchTerm && line.toLowerCase().includes(searchTerm.toLowerCase());

      return (
        <div
          key={idx}
          className={`flex hover:bg-slate-800/50 transition-colors ${
            isMatch ? 'bg-amber-500/20 text-amber-200' : ''
          }`}
        >
          {/* Line number */}
          <span className="w-12 shrink-0 select-none text-right pr-4 text-slate-600 font-mono text-xs py-0.5 border-r border-slate-800">
            {idx + 1}
          </span>
          {/* Line text */}
          <pre className="pl-4 py-0.5 font-mono text-xs text-slate-300 overflow-x-auto whitespace-pre">
            {formatXmlSyntax(line)}
          </pre>
        </div>
      );
    });
  };

  // Quick regex parser to colorize tag names, attributes, strings
  const formatXmlSyntax = (line: string) => {
    // If line starts with comment or header
    if (line.trim().startsWith('<?xml')) {
      return <span className="text-slate-500 italic">{line}</span>;
    }

    if (line.trim().startsWith('<!--')) {
      return <span className="text-emerald-500/80 italic">{line}</span>;
    }

    // Simple tag colorizer
    const parts = line.split(/(<\/?[a-zA-Z0-9_-]+(?:\s+[^>]+)?\/?>)/g);

    return parts.map((part, i) => {
      if (part.startsWith('<')) {
        // Tag parsing
        const isClosing = part.startsWith('</');
        const tagNameMatch = part.match(/<\/?([a-zA-Z0-9_-]+)/);
        const tagName = tagNameMatch ? tagNameMatch[1] : '';

        // Extract attributes
        const attrPart = part.replace(/<\/?([a-zA-Z0-9_-]+)/, '').replace(/\/?>$/, '');

        return (
          <span key={i}>
            <span className="text-cyan-400">{isClosing ? '</' : '<'}</span>
            <span className="text-purple-400 font-semibold">{tagName}</span>
            {attrPart && <span className="text-amber-300">{attrPart}</span>}
            <span className="text-cyan-400">{part.endsWith('/>') ? '/>' : '>'}</span>
          </span>
        );
      }
      return <span key={i} className="text-slate-100 font-medium">{part}</span>;
    });
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-2 sm:p-4 overflow-y-auto">
      <div className="bg-slate-950 border border-slate-800 rounded-2xl w-full max-w-5xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden my-auto">
        
        {/* Top Control Bar */}
        <div className="px-6 py-4 bg-slate-900 border-b border-slate-800 flex flex-wrap items-center justify-between gap-4 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-600 to-purple-600 flex items-center justify-center text-white shadow-md shadow-indigo-500/20">
              <Code className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                Estrutura do XML na Íntegra — {item.tipo} Nº {item.numero}
                <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-indigo-950 text-indigo-300 border border-indigo-800">
                  Schema v4.00
                </span>
              </h3>
              <p className="text-xs text-slate-400 font-mono">
                Chave de Acesso: <span className="text-cyan-400">{item.chaveAcesso}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleCopy}
              className={`px-3 py-2 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer ${
                copied
                  ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/30'
                  : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700'
              }`}
            >
              {copied ? <Check className="w-4 h-4 text-emerald-200" /> : <Copy className="w-4 h-4 text-cyan-400" />}
              {copied ? 'Copiado!' : 'Copiar XML'}
            </button>

            <button
              onClick={handleDownload}
              className="px-3 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-md shadow-cyan-600/30 transition-all cursor-pointer"
            >
              <Download className="w-4 h-4" />
              Baixar .XML
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

        {/* Search / Status Subbar */}
        <div className="px-6 py-2.5 bg-slate-900/60 border-b border-slate-800/80 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-400">
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-purple-400" />
            <span>Emitente: <strong className="text-slate-200">{item.emitenteNome}</strong> ({item.emitenteCnpj})</span>
          </div>

          <div className="relative flex items-center">
            <Search className="w-3.5 h-3.5 absolute left-3 text-slate-500" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Localizar tag ou valor (ex: ICMSTot)..."
              className="pl-8 pr-3 py-1 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500 w-64"
            />
          </div>
        </div>

        {/* XML Raw Viewer Body */}
        <div className="p-4 bg-slate-950 overflow-auto max-h-[70vh] font-mono select-text">
          <div className="bg-slate-900/40 rounded-xl border border-slate-800/80 py-3 overflow-x-auto">
            {renderHighlightedXml(xmlContent)}
          </div>
        </div>

        {/* Footer info */}
        <div className="px-6 py-3 bg-slate-900 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
          <div className="flex items-center gap-2 font-mono">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            <span>Documento Fiscal Assinado e Validado com Certificado A1</span>
          </div>
          <div>
            Total: <strong className="text-emerald-400 font-mono">{item.valorTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</strong>
          </div>
        </div>

      </div>
    </div>
  );
};
