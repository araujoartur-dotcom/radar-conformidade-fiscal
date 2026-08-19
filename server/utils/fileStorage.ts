import fs from 'fs';
import path from 'path';

/**
 * Utilitário para salvar arquivos XML localmente com criação 100% automática da árvore de diretórios.
 * Estrutura:
 * C:\SEFAZ\XMLs\[CNPJ_RAIZ]\[Entrada|Saida]\[Ano]\[Mês]\[chave].xml
 */
export function salvarXmlLocalmente(
  xmlContent: string,
  cnpjRaiz: string,
  tipoOperacao: 'Entrada' | 'Saída' | 'Terceiros' | string,
  dataEmissaoIso: string,
  chaveAcesso: string
): string {
  try {
    const cleanCnpjRaiz = (cnpjRaiz || '00000000').replace(/\D/g, '').substring(0, 8);
    
    // 1. Extrair Ano e Mês da Data de Emissão (ISO ou YYYY-MM-DD)
    const dateObj = new Date(dataEmissaoIso);
    let ano = dateObj.getFullYear().toString();
    let mes = (dateObj.getMonth() + 1).toString().padStart(2, '0');

    if (isNaN(dateObj.getTime()) || parseInt(ano) < 2000) {
      const now = new Date();
      ano = now.getFullYear().toString();
      mes = (now.getMonth() + 1).toString().padStart(2, '0');
    }

    // 2. Formatar Tipo de Operação
    let operacaoDir = 'Entrada';
    const tipoLower = (tipoOperacao || '').toLowerCase();
    if (tipoLower.includes('saida') || tipoLower.includes('saída')) {
      operacaoDir = 'Saida';
    } else {
      operacaoDir = 'Entrada';
    }

    // 3. Montar caminho padrão C:\SEFAZ\XMLs\[CNPJ_RAIZ]\[Entrada|Saida]\[Ano]\[Mês]\
    const basePath = process.env.SEFAZ_XML_DIR || 'C:\\SEFAZ\\XMLs';
    const folderPath = path.join(basePath, cleanCnpjRaiz, operacaoDir, ano, mes);

    // 4. Criar pastas recursivamente de forma automática
    if (!fs.existsSync(folderPath)) {
      fs.mkdirSync(folderPath, { recursive: true });
    }

    // 5. Escrever arquivo XML
    const cleanChave = chaveAcesso.replace(/[^a-zA-Z0-9_-]/g, '') || `xml-${Date.now()}`;
    const filePath = path.join(folderPath, `${cleanChave}.xml`);
    fs.writeFileSync(filePath, xmlContent, 'utf8');

    console.log(`✅ [FileStorage] XML salvo fisicamente em: ${filePath}`);
    return filePath;
  } catch (error: any) {
    console.error(`❌ [FileStorage] Falha ao salvar XML no disco:`, error.message);
    return '';
  }
}
