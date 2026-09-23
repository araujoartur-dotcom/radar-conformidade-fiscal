/**
 * danfeCode128.ts — Gerador de Código de Barras CODE-128C (SVG nativo)
 *
 * Implementação 100% conforme o MOC 7.00 Anexo III.01 (Tabela de Codificação CODE-128C).
 * Codifica apenas pares numéricos (00-99), conforme exigido para a Chave de Acesso de 44 dígitos.
 *
 * Referências:
 * - ENCAT MOC v7.00 — Anexo II, Seção 3.3 (Código de Barras)
 * - Simbologia CODE-128 Sub C: cada símbolo = 11 módulos (6 barras/espaços alternados)
 * - Caractere START C = 105, caractere STOP = 106
 * - Check digit = (start + Σ(pos × val)) mod 103
 */

// Tabela CODE-128C: cada valor (0-106) mapeado para 6 larguras de barras/espaços
// B=barra, S=espaço. Os 6 valores representam larguras em módulos: [B S B S B S]
// Para STOP (106), são 7 elementos (4 barras, 3 espaços): [B S B S B S B]
const CODE128_PATTERNS: number[][] = [
  /* 00 */ [2,1,2,2,2,2],
  /* 01 */ [2,2,2,1,2,2],
  /* 02 */ [2,2,2,2,2,1],
  /* 03 */ [1,2,1,2,2,3],
  /* 04 */ [1,2,1,3,2,2],
  /* 05 */ [1,3,1,2,2,2],
  /* 06 */ [1,2,2,2,1,3],
  /* 07 */ [1,2,2,3,1,2],
  /* 08 */ [1,3,2,2,1,2],
  /* 09 */ [2,2,1,2,1,3],
  /* 10 */ [2,2,1,3,1,2],
  /* 11 */ [2,3,1,2,1,2],
  /* 12 */ [1,1,2,2,3,2],
  /* 13 */ [1,2,2,1,3,2],
  /* 14 */ [1,2,2,2,3,1],
  /* 15 */ [1,1,3,2,2,2],
  /* 16 */ [1,2,3,1,2,2],
  /* 17 */ [1,2,3,2,2,1],
  /* 18 */ [2,2,3,2,1,1],
  /* 19 */ [2,2,1,1,3,2],
  /* 20 */ [2,2,1,2,3,1],
  /* 21 */ [2,1,3,2,1,2],
  /* 22 */ [2,2,3,1,1,2],
  /* 23 */ [3,1,2,1,3,1],
  /* 24 */ [3,1,1,2,2,2],
  /* 25 */ [3,2,1,1,2,2],
  /* 26 */ [3,2,1,2,2,1],
  /* 27 */ [3,1,2,2,1,2],
  /* 28 */ [3,2,2,1,1,2],
  /* 29 */ [3,2,2,2,1,1],
  /* 30 */ [2,1,2,1,2,3],
  /* 31 */ [2,1,2,3,2,1],
  /* 32 */ [2,3,2,1,2,1],
  /* 33 */ [1,1,1,3,2,3],
  /* 34 */ [1,3,1,1,2,3],
  /* 35 */ [1,3,1,3,2,1],
  /* 36 */ [1,1,2,3,1,3],
  /* 37 */ [1,3,2,1,1,3],
  /* 38 */ [1,3,2,3,1,1],
  /* 39 */ [2,1,1,3,1,3],
  /* 40 */ [2,3,1,1,1,3],
  /* 41 */ [2,3,1,3,1,1],
  /* 42 */ [1,1,2,1,3,3],
  /* 43 */ [1,1,2,3,3,1],
  /* 44 */ [1,3,2,1,3,1],
  /* 45 */ [1,1,3,1,2,3],
  /* 46 */ [1,1,3,3,2,1],
  /* 47 */ [1,3,3,1,2,1],
  /* 48 */ [3,1,3,1,2,1],
  /* 49 */ [2,1,1,3,3,1],
  /* 50 */ [2,3,1,1,3,1],
  /* 51 */ [2,1,3,1,1,3],
  /* 52 */ [2,1,3,3,1,1],
  /* 53 */ [2,1,3,1,3,1],
  /* 54 */ [3,1,1,1,2,3],
  /* 55 */ [3,1,1,3,2,1],
  /* 56 */ [3,3,1,1,2,1],
  /* 57 */ [3,1,2,1,1,3],
  /* 58 */ [3,1,2,3,1,1],
  /* 59 */ [3,3,2,1,1,1],
  /* 60 */ [3,1,4,1,1,1],
  /* 61 */ [2,2,1,4,1,1],
  /* 62 */ [4,3,1,1,1,1],
  /* 63 */ [1,1,1,2,2,4],
  /* 64 */ [1,1,1,4,2,2],
  /* 65 */ [1,2,1,1,2,4],
  /* 66 */ [1,2,1,4,2,1],
  /* 67 */ [1,4,1,1,2,2],
  /* 68 */ [1,4,1,2,2,1],
  /* 69 */ [1,1,2,2,1,4],
  /* 70 */ [1,1,2,4,1,2],
  /* 71 */ [1,2,2,1,1,4],
  /* 72 */ [1,2,2,4,1,1],
  /* 73 */ [1,4,2,1,1,2],
  /* 74 */ [1,4,2,2,1,1],
  /* 75 */ [2,4,1,2,1,1],
  /* 76 */ [2,2,1,1,1,4],
  /* 77 */ [4,1,3,1,1,1],
  /* 78 */ [2,4,1,1,1,2],
  /* 79 */ [1,3,4,1,1,1],
  /* 80 */ [1,1,1,2,4,2],
  /* 81 */ [1,2,1,1,4,2],
  /* 82 */ [1,2,1,2,4,1],
  /* 83 */ [1,1,4,2,1,2],
  /* 84 */ [1,2,4,1,1,2],
  /* 85 */ [1,2,4,2,1,1],
  /* 86 */ [4,1,1,2,1,2],
  /* 87 */ [4,2,1,1,1,2],
  /* 88 */ [4,2,1,2,1,1],
  /* 89 */ [2,1,2,1,4,1],
  /* 90 */ [2,1,4,1,2,1],
  /* 91 */ [4,1,2,1,2,1],
  /* 92 */ [1,1,1,1,4,3],
  /* 93 */ [1,1,1,3,4,1],
  /* 94 */ [1,3,1,1,4,1],
  /* 95 */ [1,1,4,1,1,3],
  /* 96 */ [1,1,4,3,1,1],
  /* 97 */ [4,1,1,1,1,3],
  /* 98 */ [4,1,1,3,1,1],
  /* 99 */ [1,1,3,1,4,1],
  /* 100 (Code B) */ [1,1,4,1,3,1],
  /* 101 (Code A) */ [3,1,1,1,4,1],
  /* 102 (FNC1)   */ [4,1,1,1,3,1],
  /* 103 (Start A) */ [2,1,1,4,1,2],
  /* 104 (Start B) */ [2,1,1,2,1,4],
  /* 105 (Start C) */ [2,1,1,2,3,2],
];

// STOP pattern: 7 elementos (13 módulos)
const STOP_PATTERN = [2,3,3,1,1,1,2];

/**
 * Codifica uma string numérica (44 dígitos da Chave de Acesso) em CODE-128C
 * e retorna uma string SVG completa pronta para renderização inline.
 *
 * @param numericString — String de 44 dígitos numéricos (Chave de Acesso)
 * @param height — Altura do código de barras em pixels (padrão: 50)
 * @param moduleWidth — Largura de cada módulo unitário em pixels (padrão: 1.2)
 * @returns SVG completa como string
 */
export function generateCode128C_SVG(
  numericString: string,
  height: number = 50,
  moduleWidth: number = 1.2
): string {
  // Validação rigorosa: apenas dígitos, comprimento par
  const cleaned = numericString.replace(/\D/g, '');
  if (cleaned.length === 0 || cleaned.length % 2 !== 0) {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="100" height="${height}"><text x="5" y="20" fill="red" font-size="10">Chave inválida</text></svg>`;
  }

  // 1. Dividir em pares de 2 dígitos
  const pairs: number[] = [];
  for (let i = 0; i < cleaned.length; i += 2) {
    pairs.push(parseInt(cleaned.substring(i, i + 2), 10));
  }

  // 2. Calcular check digit: (START_C + Σ(posição × valor)) mod 103
  const START_C = 105;
  let checksum = START_C;
  for (let i = 0; i < pairs.length; i++) {
    checksum += (i + 1) * pairs[i];
  }
  const checkDigit = checksum % 103;

  // 3. Montar sequência de valores: [START_C, ...pares, checkDigit]
  const values = [START_C, ...pairs, checkDigit];

  // 4. Converter valores em módulos (barras e espaços)
  // Cada símbolo tem 6 elementos alternados: barra, espaço, barra, espaço, barra, espaço
  const modules: { width: number; isBar: boolean }[] = [];

  // Zona de silêncio inicial (10 módulos brancos)
  modules.push({ width: 10, isBar: false });

  for (const val of values) {
    const pattern = CODE128_PATTERNS[val];
    if (!pattern) continue;
    for (let j = 0; j < pattern.length; j++) {
      modules.push({ width: pattern[j], isBar: j % 2 === 0 });
    }
  }

  // STOP character (7 elementos)
  for (let j = 0; j < STOP_PATTERN.length; j++) {
    modules.push({ width: STOP_PATTERN[j], isBar: j % 2 === 0 });
  }

  // Zona de silêncio final (10 módulos brancos)
  modules.push({ width: 10, isBar: false });

  // 5. Calcular largura total
  const totalModules = modules.reduce((sum, m) => sum + m.width, 0);
  const totalWidth = totalModules * moduleWidth;

  // 6. Gerar SVG
  let svgBars = '';
  let x = 0;
  for (const m of modules) {
    const w = m.width * moduleWidth;
    if (m.isBar) {
      svgBars += `<rect x="${x.toFixed(2)}" y="0" width="${w.toFixed(2)}" height="${height}" fill="#000"/>`;
    }
    x += w;
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${totalWidth.toFixed(2)}" height="${height}" viewBox="0 0 ${totalWidth.toFixed(2)} ${height}">${svgBars}</svg>`;
}

/**
 * Formata a Chave de Acesso de 44 dígitos em 11 blocos de 4 dígitos
 * conforme MOC 7.00 § 3.3.1
 */
export function formatChaveAcesso44(chave: string): string {
  const cleaned = chave.replace(/\D/g, '');
  return cleaned.replace(/(.{4})/g, '$1 ').trim();
}
