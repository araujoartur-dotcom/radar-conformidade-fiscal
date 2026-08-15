import React, { useState } from 'react';
import { Plus, Trash2, Search } from 'lucide-react';
import { CnpjLookupItem, ESTADOS_BRASIL, EstadoUF } from '../types';
import { formatCNPJ, onlyNumbers, isValidCNPJ } from '../utils/cnpj';

interface ConsultaAvulsaPanelProps {
  onAddItems: (items: Array<{ cnpj: string; uf: string }>) => void;
  onExecuteInstant: (cnpj: string, uf: string) => void;
}

export const ConsultaAvulsaPanel: React.FC<ConsultaAvulsaPanelProps> = ({
  onAddItems,
  onExecuteInstant,
}) => {
  const [rows, setRows] = useState<Array<{ id: number; cnpj: string; uf: string }>>([
    { id: 1, cnpj: '05.652.956/0001-91', uf: 'DF' },
    { id: 2, cnpj: '17.213.071/0001-75', uf: 'DF' },
    { id: 3, cnpj: '33.000.167/0001-01', uf: 'RJ' },
    { id: 4, cnpj: '60.701.190/0001-04', uf: 'SP' },
  ]);

  const [bulkText, setBulkText] = useState('');
  const [showBulkModal, setShowBulkModal] = useState(false);

  const handleRowCnpjChange = (index: number, val: string) => {
    const formatted = formatCNPJ(val);
    const updated = [...rows];
    updated[index].cnpj = formatted;
    setRows(updated);
  };

  const handleRowUfChange = (index: number, val: string) => {
    const updated = [...rows];
    updated[index].uf = val;
    setRows(updated);
  };

  const addRow = () => {
    setRows(prev => [...prev, { id: Date.now(), cnpj: '', uf: 'SP' }]);
  };

  const removeRow = (index: number) => {
    setRows(prev => prev.filter((_, idx) => idx !== index));
  };

  const handleSendToBatch = () => {
    const validRows = rows
      .filter(r => onlyNumbers(r.cnpj).length >= 14)
      .map(r => ({ cnpj: r.cnpj, uf: r.uf || 'SP' }));

    if (validRows.length > 0) {
      onAddItems(validRows);
    }
  };

  const handleParseBulkText = () => {
    const lines = bulkText.split(/\r?\n/);
    const parsed: Array<{ cnpj: string; uf: string }> = [];

    lines.forEach(line => {
      const parts = line.split(/[;,\t\s]+/);
      const digits = onlyNumbers(parts[0] || '');
      if (digits.length >= 12) {
        const uf = parts[1] ? parts[1].trim().toUpperCase() : 'SP';
        parsed.push({
          cnpj: formatCNPJ(digits.padStart(14, '0')),
          uf: ESTADOS_BRASIL.includes(uf as any) ? uf : 'SP'
        });
      }
    });

    if (parsed.length > 0) {
      onAddItems(parsed);
      setBulkText('');
      setShowBulkModal(false);
    }
  };

  return (
    <div className="glass-panel-glow rounded-2xl p-5 flex flex-col gap-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
        <div>
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <Search className="w-5 h-5 text-cyan-400" />
            <span>Consulta Avulsa em Tela</span>
          </h2>
          <p className="text-xs text-slate-400">
            Digite múltiplos CNPJs para consulta individual ou envio ao lote
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowBulkModal(true)}
            className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold border border-slate-700 transition-all cursor-pointer"
          >
            Colar Lista (Texto)
          </button>

          <button
            onClick={addRow}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-cyan-950 hover:bg-cyan-900 border border-cyan-800/80 text-cyan-300 text-xs font-bold transition-all cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Adicionar Linha</span>
          </button>
        </div>
      </div>

      {/* Manual Input Grid Rows */}
      <div className="flex flex-col gap-2 max-h-[320px] overflow-y-auto pr-1">
        {rows.map((row, idx) => {
          const digits = onlyNumbers(row.cnpj);
          const isComplete = digits.length === 14;

          return (
            <div key={row.id} className="flex items-center gap-2 bg-slate-900/80 border border-slate-800 rounded-xl p-2">
              <span className="w-6 text-center font-mono text-xs text-slate-500 font-bold">
                {idx + 1}
              </span>

              <div className="flex-1 relative">
                <input
                  type="text"
                  placeholder="00.000.000/0000-00"
                  value={row.cnpj}
                  onChange={(e) => handleRowCnpjChange(idx, e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700/80 rounded-lg px-3 py-2 text-xs text-white font-mono placeholder-slate-600 focus:outline-none focus:border-cyan-500"
                />
              </div>

              <select
                value={row.uf}
                onChange={(e) => handleRowUfChange(idx, e.target.value)}
                className="bg-slate-950 border border-slate-700/80 rounded-lg px-2 py-2 text-xs text-white font-mono focus:outline-none focus:border-cyan-500 cursor-pointer"
              >
                {['SP', 'RJ', 'MG', 'RS', 'PR', 'DF', 'BA', 'SC', 'GO', 'PE', 'CE', 'ES', 'MT', 'MS', 'PA', 'AM', 'MA', 'PB', 'RN', 'AL', 'SE', 'PI', 'RO', 'TO', 'AC', 'AP', 'RR'].map(uf => (
                  <option key={uf} value={uf}>{uf}</option>
                ))}
              </select>

              <button
                onClick={() => onExecuteInstant(row.cnpj, row.uf)}
                disabled={!isComplete}
                className="px-2.5 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs transition-all cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                title="Consultar este CNPJ imediatamente"
              >
                <Search className="w-3.5 h-3.5" />
              </button>

              <button
                onClick={() => removeRow(idx)}
                className="p-2 text-slate-500 hover:text-rose-400 transition-colors cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          );
        })}
      </div>

      <div className="flex items-center justify-between pt-2 border-t border-slate-800">
        <span className="text-xs text-slate-400">
          {rows.filter(r => onlyNumbers(r.cnpj).length >= 14).length} de {rows.length} CNPJs válidos preenchidos
        </span>

        <button
          onClick={handleSendToBatch}
          className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold text-xs shadow-md shadow-blue-600/30 transition-all cursor-pointer"
        >
          Carregar Linhas na Tabela Principal
        </button>
      </div>

      {/* Bulk Paste Modal */}
      {showBulkModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="glass-panel-glow max-w-lg w-full rounded-2xl p-5 flex flex-col gap-4">
            <h3 className="text-sm font-bold text-white">Colar Lista de CNPJs (Linha por Linha)</h3>
            <p className="text-xs text-slate-400">
              Cole abaixo sua lista de CNPJs (pode incluir a UF separada por vírgula ou espaço):
            </p>

            <textarea
              rows={6}
              value={bulkText}
              onChange={(e) => setBulkText(e.target.value)}
              placeholder={`00000000000191 SP\n33000167000101 RJ\n60701190000104 SP`}
              className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-xs text-white font-mono focus:outline-none focus:border-cyan-500"
            />

            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowBulkModal(false)}
                className="px-3 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-semibold hover:bg-slate-700"
              >
                Cancelar
              </button>
              <button
                onClick={handleParseBulkText}
                className="px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs shadow-md shadow-cyan-600/30"
              >
                Processar e Adicionar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
