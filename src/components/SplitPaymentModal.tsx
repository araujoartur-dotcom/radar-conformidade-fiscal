import React, { useState } from 'react';
import {
  X,
  CreditCard,
  QrCode,
  Building2,
  Landmark,
  ShieldCheck,
  ArrowRight,
  TrendingDown,
  Percent,
  FileText,
  Sparkles,
  CheckCircle2,
  Calendar,
} from 'lucide-react';
import { DfeXmlItem, MetodoSplitPayment } from '../types';
import {
  calcularSplitPayment,
  ANOS_TRANSICAO,
  getRegraTransicaoAno,
} from '../utils/reformaTransicao';

interface SplitPaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  documento: DfeXmlItem | null;
  initialAno?: number;
}

export const SplitPaymentModal: React.FC<SplitPaymentModalProps> = ({
  isOpen,
  onClose,
  documento,
  initialAno = 2026,
}) => {
  const [anoVigencia, setAnoVigencia] = useState<number>(initialAno);
  const [metodo, setMetodo] = useState<MetodoSplitPayment>('PIX_DINAMICO');
  const [isSimulated, setIsSimulated] = useState(false);

  if (!isOpen || !documento) return null;

  const regraAno = getRegraTransicaoAno(anoVigencia);

  const splitResult = calcularSplitPayment({
    chaveAcesso: documento.chaveAcesso,
    valorTotalOperacao: documento.valorTotal,
    anoVigencia,
    metodoLiquidacao: metodo,
    fornecedorNome: documento.emitenteNome,
    fornecedorCnpj: documento.emitenteCnpj,
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
      <div className="bg-slate-900 border border-slate-700/80 w-full max-w-3xl rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* HEADER */}
        <div className="px-6 py-5 border-b border-slate-800 flex items-center justify-between bg-gradient-to-r from-cyan-950/40 via-blue-950/30 to-slate-900">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-cyan-600/20 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
              <CreditCard className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-white">Simulador de Split Payment Inteligente</h3>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-cyan-950 text-cyan-300 border border-cyan-800">
                  LC 214/2025
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Segregação financeira automática dos tributos no ato da liquidação da NF-e
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* BODY */}
        <div className="p-6 space-y-6 overflow-y-auto custom-scrollbar">
          {/* SELETOR DE ANO DA TRANSIÇÃO */}
          <div className="bg-slate-950/60 p-4 rounded-2xl border border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-cyan-400" />
                Simular Ano de Vigência da Reforma:
              </span>
              <span className="text-xs text-cyan-300 font-bold bg-cyan-950/80 px-2.5 py-1 rounded-lg border border-cyan-800">
                {regraAno.badge}
              </span>
            </div>

            <div className="grid grid-cols-4 sm:grid-cols-8 gap-1.5">
              {ANOS_TRANSICAO.map((ano) => (
                <button
                  key={ano}
                  type="button"
                  onClick={() => {
                    setAnoVigencia(ano);
                    setIsSimulated(false);
                  }}
                  className={`py-2 px-1 text-xs font-bold rounded-xl border transition-all ${
                    anoVigencia === ano
                      ? 'bg-gradient-to-r from-cyan-600 to-blue-600 border-cyan-400 text-white shadow-md shadow-cyan-900/40'
                      : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-850'
                  }`}
                >
                  {ano}
                </button>
              ))}
            </div>

            <p className="text-[11px] text-slate-400 italic">
              ℹ️ {regraAno.observacoes}
            </p>
          </div>

          {/* DOCUMENTO FISCAL BASE */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-slate-950/40 p-3.5 rounded-2xl border border-slate-800/80 text-xs">
            <div>
              <span className="text-slate-500 block text-[10px]">Chave de Acesso / NF-e</span>
              <span className="font-mono text-slate-300 font-bold text-[11px]">
                {documento.chaveAcesso ? `${documento.chaveAcesso.substring(0, 22)}...` : 'Sem chave'}
              </span>
            </div>
            <div>
              <span className="text-slate-500 block text-[10px]">Fornecedor / Emitente</span>
              <span className="text-white font-bold truncate block">{documento.emitenteNome}</span>
              <span className="text-slate-400 text-[10px] font-mono">{documento.emitenteCnpj}</span>
            </div>
            <div>
              <span className="text-slate-500 block text-[10px]">Valor Bruto da NF-e</span>
              <span className="text-emerald-400 font-bold font-mono text-sm">
                R$ {documento.valorTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </span>
            </div>
          </div>

          {/* ESCOLHA DO MÉTODO DE LIQUIDAÇÃO */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-300 block">
              Modalidade de Liquidação Financeira:
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {[
                { id: 'PIX_DINAMICO', label: 'Pix Dinâmico', icon: QrCode },
                { id: 'BOLETO_BANCARIO', label: 'Boleto Bancário', icon: FileText },
                { id: 'ARRANJO_CARTAO', label: 'Cartão / Arranjo', icon: CreditCard },
                { id: 'TED_DOC', label: 'TED / DOC', icon: Landmark },
              ].map((m) => {
                const IconComponent = m.icon;
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => {
                      setMetodo(m.id as MetodoSplitPayment);
                      setIsSimulated(false);
                    }}
                    className={`p-3 rounded-xl border flex flex-col items-center gap-1.5 transition-all text-xs font-bold ${
                      metodo === m.id
                        ? 'bg-cyan-950/60 border-cyan-500 text-cyan-300 shadow-md'
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <IconComponent className="w-4 h-4" />
                    <span>{m.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* DIAGRAMA DE SEGREGAÇÃO (SPLIT PAYMENT FLOW) */}
          <div className="space-y-3">
            <div className="text-xs font-bold text-slate-300 flex items-center justify-between">
              <span>Fluxo de Segregação Automática (Split Payment):</span>
              <span className="text-[11px] text-slate-400 font-normal">
                Alíquota Efetiva: <strong>{regraAno.aliquotaIvaTotal.toFixed(2)}%</strong>
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* RETENÇÃO CBS FEDERAL */}
              <div className="bg-gradient-to-b from-blue-950/40 to-slate-950 p-4 rounded-2xl border border-blue-800/60 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-blue-300 flex items-center gap-1">
                    <Landmark className="w-3.5 h-3.5" /> CBS Federal
                  </span>
                  <span className="px-1.5 py-0.5 rounded text-[10px] bg-blue-900/60 text-blue-200 font-mono">
                    {splitResult.aliquotaCbsAplicada.toFixed(2)}%
                  </span>
                </div>
                <div className="text-lg font-mono font-bold text-blue-400">
                  R$ {splitResult.valorCbsRetido.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </div>
                <div className="text-[10px] text-slate-400 leading-tight">
                  ↳ Conta Única do Tesouro Nacional / Receita Federal
                </div>
              </div>

              {/* RETENÇÃO IBS SUBNACIONAL */}
              <div className="bg-gradient-to-b from-purple-950/40 to-slate-950 p-4 rounded-2xl border border-purple-800/60 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-purple-300 flex items-center gap-1">
                    <Building2 className="w-3.5 h-3.5" /> IBS Subnacional
                  </span>
                  <span className="px-1.5 py-0.5 rounded text-[10px] bg-purple-900/60 text-purple-200 font-mono">
                    {splitResult.aliquotaIbsAplicada.toFixed(2)}%
                  </span>
                </div>
                <div className="text-lg font-mono font-bold text-purple-400">
                  R$ {splitResult.valorIbsRetido.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </div>
                <div className="text-[10px] text-slate-400 leading-tight">
                  ↳ Conta Única do Comitê Gestor do IBS (Banco Central)
                </div>
              </div>

              {/* LÍQUIDO CREDITADO AO FORNECEDOR */}
              <div className="bg-gradient-to-b from-emerald-950/40 to-slate-950 p-4 rounded-2xl border border-emerald-800/60 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-emerald-300 flex items-center gap-1">
                    <ShieldCheck className="w-3.5 h-3.5" /> Líquido Fornecedor
                  </span>
                  <span className="px-1.5 py-0.5 rounded text-[10px] bg-emerald-900/60 text-emerald-200 font-mono">
                    {(100 - (splitResult.aliquotaCbsAplicada + splitResult.aliquotaIbsAplicada)).toFixed(2)}%
                  </span>
                </div>
                <div className="text-lg font-mono font-bold text-emerald-400">
                  R$ {splitResult.valorLiquidoFornecedor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </div>
                <div className="text-[10px] text-slate-400 leading-tight">
                  ↳ Conta Bancária do Emitente ({documento.emitenteNome})
                </div>
              </div>
            </div>
          </div>

          {/* SIMULAÇÃO DE LIQUIDAÇÃO CONCLUÍDA */}
          {isSimulated && (
            <div className="p-4 bg-emerald-950/40 border border-emerald-800 rounded-2xl flex items-center gap-3 text-emerald-300 text-xs animate-fade-in">
              <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
              <div>
                <strong>Simulação de Liquidação com Split Executada com Sucesso!</strong>
                <p className="text-[11px] text-emerald-400/80">
                  A instituição financeira receptora reteve automaticamente R${' '}
                  {splitResult.valorTotalTributosRetidos.toFixed(2)} e creditou R${' '}
                  {splitResult.valorLiquidoFornecedor.toFixed(2)} ao fornecedor sem risco de inadimplência fiscal.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* FOOTER */}
        <div className="px-6 py-4 border-t border-slate-800 bg-slate-950 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="text-xs text-slate-400 flex items-center gap-1.5">
            <Sparkles className="w-4 h-4 text-cyan-400" />
            <span>Elimina o risco de glosa e garante crédito tributário imediato.</span>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              onClick={onClose}
              className="w-full sm:w-auto px-4 py-2 text-xs font-bold text-slate-400 hover:text-white rounded-xl border border-slate-800 hover:bg-slate-900 transition-colors"
            >
              Fechar
            </button>
            <button
              onClick={() => setIsSimulated(true)}
              className="w-full sm:w-auto px-5 py-2 text-xs font-bold text-white bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 rounded-xl shadow-lg shadow-cyan-950 flex items-center justify-center gap-2 transition-all"
            >
              <CreditCard className="w-4 h-4" />
              <span>Simular Liquidação com Split</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
