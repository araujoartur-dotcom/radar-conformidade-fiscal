import * as XLSX from 'xlsx';
import { CnpjLookupItem } from '../types';
import { formatCNPJ, onlyNumbers } from './cnpj';

export interface ParsedExcelRow {
  cnpj: string;
  uf: string;
}

/** Parse uploaded file (.xlsx, .xls, .csv) into CNPJ + UF list */
export async function parseExcelFile(file: File): Promise<ParsedExcelRow[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];

        const jsonData = XLSX.utils.sheet_to_json<any>(worksheet, { header: 1 });

        const results: ParsedExcelRow[] = [];

        if (!jsonData || jsonData.length === 0) {
          resolve([]);
          return;
        }

        // Find header row or assume col 0 is CNPJ and col 1 is UF
        let cnpjColIndex = 0;
        let ufColIndex = 1;

        const firstRow = jsonData[0];
        if (Array.isArray(firstRow)) {
          firstRow.forEach((cell, idx) => {
            const str = String(cell || '').toLowerCase();
            if (str.includes('cnpj') || str.includes('cpf') || str.includes('documento')) {
              cnpjColIndex = idx;
            }
            if (str.includes('uf') || str.includes('estado') || str.includes('sefaz')) {
              ufColIndex = idx;
            }
          });
        }

        // Process rows (skip header if detected)
        const startRow = (typeof firstRow[cnpjColIndex] === 'string' && String(firstRow[cnpjColIndex]).toLowerCase().includes('cnpj')) ? 1 : 0;

        for (let i = startRow; i < jsonData.length; i++) {
          const row = jsonData[i];
          if (!row) continue;

          const rawCnpj = String(row[cnpjColIndex] || '').trim();
          const rawUf = String(row[ufColIndex] || 'SP').trim().toUpperCase();

          const digits = onlyNumbers(rawCnpj);
          if (digits.length >= 12) { // Accept even 14-digit or padded CNPJs
            results.push({
              cnpj: formatCNPJ(digits.padStart(14, '0')),
              uf: rawUf.length === 2 ? rawUf : 'SP'
            });
          }
        }

        resolve(results);
      } catch (err) {
        reject(err);
      }
    };

    reader.onerror = (error) => reject(error);
    reader.readAsArrayBuffer(file);
  });
}

/** Export results to Excel (.xlsx) */
export function exportToExcel(items: any[], filename: string = 'Consulta_CNPJ_IE_CCC.xlsx') {
  if (!items || items.length === 0) return;

  const isCustomObjects = items.length > 0 && !('cnpj' in items[0]);
  const exportData = isCustomObjects
    ? items
    : items.map((item: any) => ({
        'CNPJ': item.cnpj,
        'UF': item.uf,
        'Inscrição Estadual (IE)': item.ie || 'ISENTO',
        'Tipo IE': item.tipoIE || '-',
        'Situação IE (CCC)': item.situaçaoIE || '-',
        'Situação CNPJ': item.situaçaoCNPJ || '-',
        'Natureza Jurídica': item.naturezaJuridica || '-',
        'Razão Social': item.razaoSocial || '-',
        'Nome Fantasia': item.nomeFantasia || '-',
        'CNAE Principal': item.cnaePrincipal || '-',
        'Descrição CNAE': item.cnaeDescricao || '-',
        'Data de Abertura': item.dataAbertura || '-',
        'Regime Tributário': item.regimeTributario || '-',
        'Capital Social (R$)': item.capitalSocial || 0,
        'Endereço Completo': item.enderecoCompleto || '-',
        'Município': item.municipio || '-',
        'CEP': item.cep || '-',
        'Telefone': item.telefone || '-',
        'E-mail': item.email || '-',
        'Status Consulta': (item.statusConsulta || '').toUpperCase(),
        'Data da Consulta': item.dataConsulta ? new Date(item.dataConsulta).toLocaleString('pt-BR') : '-'
      }));

  const worksheet = XLSX.utils.json_to_sheet(exportData);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Dados');

  // Auto column widths
  const colWidths = Object.keys(exportData[0] || {}).map(key => ({
    wch: Math.max(key.length, 15)
  }));
  worksheet['!cols'] = colWidths;

  const actualFilename = filename.endsWith('.xlsx') ? filename : `${filename}.xlsx`;
  XLSX.writeFile(workbook, actualFilename);
}

/** Export results to CSV */
export function exportToCSV(items: CnpjLookupItem[], filename: string = 'Consulta_CNPJ_IE.csv') {
  const exportData = items.map(item => ({
    CNPJ: item.cnpj,
    UF: item.uf,
    IE: item.ie || 'ISENTO',
    Tipo_IE: item.tipoIE || '',
    Situacao_IE: item.situaçaoIE || '',
    Situacao_CNPJ: item.situaçaoCNPJ || '',
    Razao_Social: item.razaoSocial || '',
    CNAE: item.cnaePrincipal || '',
    Municipio: item.municipio || '',
    Status: item.statusConsulta
  }));

  const worksheet = XLSX.utils.json_to_sheet(exportData);
  const csvOutput = XLSX.utils.sheet_to_csv(worksheet, { FS: ';' });

  const blob = new Blob(['\ufeff' + csvOutput], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/** Export results to JSON */
export function exportToJSON(items: CnpjLookupItem[], filename: string = 'Consulta_CNPJ_IE.json') {
  const dataStr = JSON.stringify(items, null, 2);
  const blob = new Blob([dataStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/** Download a ready-to-use Excel sample template file */
export function downloadSampleExcel() {
  const sampleRows = [
    { CNPJ: '00.000.000/0001-91', UF: 'DF', Obs: 'Banco do Brasil S/A' },
    { CNPJ: '33.000.167/0001-01', UF: 'RJ', Obs: 'Petrobras S/A' },
    { CNPJ: '60.701.190/0001-04', UF: 'SP', Obs: 'Itaú Unibanco S/A' },
    { CNPJ: '06.057.223/0001-71', UF: 'SP', Obs: 'Nubank Nu Pagamentos' },
    { CNPJ: '02.558.157/0001-62', UF: 'PR', Obs: 'Magazine Luiza' },
    { CNPJ: '11.815.121/0001-40', UF: 'SP', Obs: 'Mercado Livre' },
    { CNPJ: '00.360.305/0001-04', UF: 'DF', Obs: 'Caixa Econômica Federal' },
    { CNPJ: '01.590.728/0001-08', UF: 'MG', Obs: 'Localiza Rent a Car' }
  ];

  const worksheet = XLSX.utils.json_to_sheet(sampleRows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Modelo_Consulta_Lote');
  XLSX.writeFile(workbook, 'Modelo_Exemplo_Consulta_Lote_CNPJ.xlsx');
}
