import React from 'react';
import { X, Building, MapPin, Phone, Mail, Calendar, DollarSign, Users, ShieldCheck, FileText, CheckCircle2, Copy, Printer } from 'lucide-react';
import { CnpjLookupItem } from '../types';
import { formatCurrency } from '../utils/cnpj';

interface DetalhesModalProps {
  item: CnpjLookupItem | null;
  onClose: () => void;
}

export const DetalhesModal: React.FC<DetalhesModalProps> = ({ item, onClose }) => {
  if (!item) return null;

  return (
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-50 flex items-center justify-center p-3 md:p-6 overflow-y-auto">
      <div className="glass-panel-glow max-w-4xl w-full rounded-3xl p-6 flex flex-col gap-6 shadow-2xl relative animate-in fade-in zoom-in-95 duration-200 my-auto border border-cyan-500/30">
        
        {/* Header Bar */}
        <div className="flex items-start justify-between border-b border-slate-800 pb-4">
          <div className="flex items-start gap-3">
            <div className="w-12 h-12 rounded-2xl bg-cyan-950/80 border border-cyan-800 flex items-center justify-center text-cyan-400 shadow-lg">
              <Building className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-bold text-white font-['Plus_Jakarta_Sans']">
                  {item.razaoSocial}
                </h3>
                <span className="px-2 py-0.5 rounded-md text-xs font-mono font-bold bg-cyan-950 text-cyan-300 border border-cyan-800">
                  {item.uf}
                </span>
              </div>
              <div className="flex items-center gap-3 text-xs text-slate-400 font-mono mt-0.5">
                <span>CNPJ: <strong className="text-cyan-400">{item.cnpj}</strong></span>
                <span>•</span>
                <span>IE: <strong className="text-slate-200">{item.ie || 'ISENTO'}</strong></span>
                {item.tipoIE && (
                  <>
                    <span>•</span>
                    <span className="text-cyan-300 font-sans font-semibold text-[11px] bg-cyan-950/60 px-2 py-0.5 rounded border border-cyan-800">{item.tipoIE}</span>
                  </>
                )}
              </div>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-all cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Status Badges Row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-900/90 border border-slate-800 rounded-2xl p-3">
          <div>
            <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Situação CNPJ</span>
            <div className="text-xs font-extrabold text-emerald-400 flex items-center gap-1 mt-0.5">
              <CheckCircle2 className="w-3.5 h-3.5" />
              {item.situaçaoCNPJ || 'ATIVA'}
            </div>
          </div>

          <div>
            <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Inscrição Estadual (CCC)</span>
            <div className="text-xs font-extrabold text-cyan-400 mt-0.5">
              {item.situaçaoIE || 'Habilitado'}
            </div>
          </div>

          <div>
            <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Regime Tributário</span>
            <div className="text-xs font-bold text-slate-200 mt-0.5">
              {item.regimeTributario || 'Simples Nacional'}
            </div>
          </div>

          <div>
            <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Capital Social</span>
            <div className="text-xs font-mono font-extrabold text-amber-400 mt-0.5">
              {formatCurrency(item.capitalSocial)}
            </div>
          </div>
        </div>

        {/* Detailed Grid Info */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          {/* Box 1: Dados Institucionais */}
          <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-4 flex flex-col gap-2.5">
            <h4 className="font-bold text-cyan-400 uppercase tracking-wider text-[11px] flex items-center gap-1.5 pb-1 border-b border-slate-800">
              <FileText className="w-3.5 h-3.5" />
              Identificação & Atividade
            </h4>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <span className="text-slate-500">Nome Fantasia:</span>
                <p className="font-semibold text-slate-200">{item.nomeFantasia || '-'}</p>
              </div>

              <div>
                <span className="text-slate-500">Data de Abertura:</span>
                <p className="font-mono font-semibold text-slate-200">{item.dataAbertura || '-'}</p>
              </div>
            </div>

            <div>
              <span className="text-slate-500">Natureza Jurídica:</span>
              <p className="font-semibold text-slate-200">{item.naturezaJuridica || '-'}</p>
            </div>

            <div>
              <span className="text-slate-500">CNAE Principal:</span>
              <p className="font-mono font-bold text-cyan-300">{item.cnaePrincipal}</p>
              <p className="text-slate-400 text-[11px] mt-0.5">{item.cnaeDescricao}</p>
            </div>
          </div>

          {/* Box 2: Endereço e Contato */}
          <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-4 flex flex-col gap-2.5">
            <h4 className="font-bold text-cyan-400 uppercase tracking-wider text-[11px] flex items-center gap-1.5 pb-1 border-b border-slate-800">
              <MapPin className="w-3.5 h-3.5" />
              Localização & Contato
            </h4>

            <div>
              <span className="text-slate-500">Logradouro / Endereço:</span>
              <p className="font-semibold text-slate-200">{item.enderecoCompleto}</p>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <span className="text-slate-500">Município / UF:</span>
                <p className="font-semibold text-slate-200">{item.municipio} - {item.uf}</p>
              </div>

              <div>
                <span className="text-slate-500">CEP:</span>
                <p className="font-mono font-semibold text-slate-200">{item.cep}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <span className="text-slate-500">Telefone:</span>
                <p className="font-mono text-slate-300">{item.telefone}</p>
              </div>

              <div>
                <span className="text-slate-500">E-mail:</span>
                <p className="text-slate-300 truncate">{item.email}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Quadro de Sócios e Administradores (QSA) */}
        {item.socios && item.socios.length > 0 && (
          <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-4 flex flex-col gap-2 text-xs">
            <h4 className="font-bold text-cyan-400 uppercase tracking-wider text-[11px] flex items-center gap-1.5 pb-1 border-b border-slate-800">
              <Users className="w-3.5 h-3.5" />
              Quadro de Sócios e Administradores (QSA)
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
              {item.socios.map((socio, idx) => (
                <div key={idx} className="bg-slate-950 p-2.5 rounded-xl border border-slate-800 flex justify-between items-center">
                  <div>
                    <span className="font-bold text-white block">{socio.nome}</span>
                    <span className="text-[11px] text-slate-400">{socio.qualificacao}</span>
                  </div>
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Modal Footer Actions */}
        <div className="flex items-center justify-between pt-2 border-t border-slate-800 text-xs">
          <span className="text-slate-500 font-mono text-[11px]">
            Consultado em: {item.dataConsulta ? new Date(item.dataConsulta).toLocaleString('pt-BR') : 'Instantâneo'}
          </span>

          <div className="flex items-center gap-2">
            <button
              onClick={() => window.print()}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Imprimir Ficha</span>
            </button>

            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold cursor-pointer"
            >
              Fechar
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
