import fs from 'fs';
import path from 'path';

/**
 * Utilitário para salvar arquivos XML localmente seguindo a inteligência de diretórios solicitada.
 * Estrutura:
 * C:\Radar Conformidade Fiscal\[CNPJ]\[ENTRADA|SAIDAS]\[Ano]\[Mês]\[chave].xml
 */

export function salvarXmlLocalmente(
  xmlContent: string,
  cnpjRaiz: string,
  tipoOperacao: 'Entrada' | 'Saída' | 'Terceiros',
  dataEmissaoIso: string,
  chaveAcesso: string
): void {
  try {
    // 1. Extrair Ano e Mês da Data de Emissão
    // Esperado formato ISO: "2026-08-09T..."
    const dateObj = new Date(dataEmissaoIso);
    let ano = dateObj.getFullYear().toString();
    let mes = (dateObj.getMonth() + 1).toString().padStart(2, '0');

    if (isNaN(dateObj.getTime())) {
      // Falha de parse, cria pasta padrão
      ano = 'Desconhecido';
      mes = '00';
    }

    // 2. Formatar Tipo de Operação
    let operacaoDir = 'OUTROS';
    if (tipoOperacao === 'Entrada' || tipoOperacao === 'Terceiros') {
      operacaoDir = 'ENTRADA';
    } else if (tipoOperacao === 'Saída') {
      operacaoDir = 'SAIDAS';
    }

    // 3. Montar o caminho
    const basePath = 'C:\\Radar Conformidade Fiscal';
    const folderPath = path.join(basePath, cnpjRaiz, operacaoDir, ano, mes);

    // 4. Criar pastas recursivamente
    if (!fs.existsSync(folderPath)) {
      fs.mkdirSync(folderPath, { recursive: true });
    }

    // 5. Escrever arquivo XML
    const filePath = path.join(folderPath, `${chaveAcesso}.xml`);
    fs.writeFileSync(filePath, xmlContent, 'utf8');

    console.log(`[FileStorage] XML salvo fisicamente em: ${filePath}`);
  } catch (error) {
    console.error(`[FileStorage] Falha ao salvar XML no disco: `, error);
  }
}
