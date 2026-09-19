import { Router, Response } from 'express';
import multer from 'multer';
import crypto from 'crypto';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { v4 as uuid } from 'uuid';
import { getDatabase } from '../db/database';
import { getSupabaseAdmin, isSupabaseConfigured } from '../db/supabase';
import { AuthenticatedRequest, requireAuth, logAuditAction } from '../middleware/auth';
import { CERTIFICADO } from '../config';
import { validarEExtrairCertificadoPfx, descriptografarCertificadoComDiagnostico } from '../services/sefazService';

const router = Router();

// Garantir que o diretório seguro exista
const certStorageDir = CERTIFICADO.STORAGE_DIR || path.join(os.tmpdir(), 'radar_certificates');
if (!fs.existsSync(certStorageDir)) {
  fs.mkdirSync(certStorageDir, { recursive: true });
}

// Configurar multer para salvar arquivo em disco
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, certStorageDir);
  },
  filename: (req, file, cb) => {
    // Gerar nome único para o arquivo PFX para não sobrescrever acidentalmente
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  },
});
const upload = multer({ storage });

/**
 * POST /api/config/certificate/upload
 * Recebe o arquivo .PFX e a senha (via formData).
 * A senha é criptografada com AES-256-GCM antes de ser salva no banco (Supabase / SQLite).
 */
router.post('/upload', requireAuth, upload.single('certificado'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { tenantId, senha, cnpj } = req.body;
    const file = req.file;

    if (!tenantId || !senha || !file) {
      if (file && fs.existsSync(file.path)) fs.unlinkSync(file.path);
      res.status(400).json({ error: 'tenantId, senha e o arquivo .PFX são obrigatórios.' });
      return;
    }

    let keyHex = CERTIFICADO.ENCRYPTION_KEY;
    if (!keyHex || keyHex.length !== 64) {
      keyHex = crypto.createHash('sha256').update(process.env.JWT_SECRET || 'radar_fiscal_default_secure_key_2026').digest('hex');
    }

    let empresa: any = null;
    const cleanTenant = (tenantId || '').replace(/\D/g, '');
    const cleanCnpj = (cnpj || '').replace(/\D/g, '');
    const targetClean = cleanCnpj || cleanTenant;

    // 1. Buscar Empresa no Supabase se configurado
    if (isSupabaseConfigured()) {
      const supabase = getSupabaseAdmin();
      if (supabase) {
        // Tenta buscar por ID
        const { data: byId } = await supabase
          .from('empresas')
          .select('id, razao_social, cnpj_completo, cnpj_raiz')
          .eq('id', tenantId)
          .maybeSingle();

        if (byId) {
          empresa = byId;
        } else if (targetClean) {
          // Tenta buscar por CNPJ Completo ou Raiz
          const { data: byCnpj } = await supabase
            .from('empresas')
            .select('id, razao_social, cnpj_completo, cnpj_raiz')
            .or(`cnpj_completo.eq.${cnpj || tenantId},cnpj_raiz.eq.${targetClean.slice(0, 8)}`)
            .maybeSingle();
          if (byCnpj) empresa = byCnpj;
        }
      }
    }

    // 2. Fallback para SQLite Local se não encontrou no Supabase
    if (!empresa) {
      const db = getDatabase();
      empresa = db.prepare(`
        SELECT id, razao_social, cnpj_completo, cnpj_raiz 
        FROM empresas 
        WHERE id = ? OR cnpj_completo = ? OR cnpj_raiz = ?
      `).get(tenantId, cnpj || tenantId, targetClean.slice(0, 8)) as any;
    }

    if (!empresa) {
      if (file && fs.existsSync(file.path)) fs.unlinkSync(file.path);
      res.status(404).json({ error: 'Empresa não encontrada na carteira.' });
      return;
    }

    const fileBuffer = fs.readFileSync(file.path);

    // 1. Validação estrita do arquivo .PFX e da senha ANTES de salvar qualquer registro
    let certInfo: any;
    try {
      certInfo = validarEExtrairCertificadoPfx(fileBuffer, senha);
    } catch (valErr: any) {
      if (file && fs.existsSync(file.path)) fs.unlinkSync(file.path);
      res.status(400).json({
        success: false,
        error: valErr.message || 'A senha informada não confere com o arquivo .PFX (Falha de verificação MAC).'
      });
      return;
    }

    if (certInfo.isExpirado) {
      if (file && fs.existsSync(file.path)) fs.unlinkSync(file.path);
      res.status(400).json({
        success: false,
        error: `Este Certificado Digital expirou em ${new Date(certInfo.validade).toLocaleDateString('pt-BR')}. Não é permitido vincular certificados vencidos para transmissão SEFAZ.`
      });
      return;
    }

    // 2. Criptografar a senha do PFX de forma persistente com AES-256-GCM
    const keyBuffer = Buffer.from(keyHex, 'hex');
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', keyBuffer, iv);

    let senhaEnc = cipher.update(senha, 'utf8', 'hex');
    senhaEnc += cipher.final('hex');
    const authTag = cipher.getAuthTag().toString('hex');
    const ivHex = iv.toString('hex');

    const id = uuid();
    const validade = certInfo.validade;
    const emissor = certInfo.emissor;
    const fingerprint = certInfo.fingerprint;
    const status = 'ok';
    const base64Enc = `base64:${fileBuffer.toString('base64')}`;

    // 3. Salvar no Supabase (se configurado)
    if (isSupabaseConfigured()) {
      const supabase = getSupabaseAdmin();
      if (supabase) {
        // Desativar certificados anteriores desta empresa
        await supabase
          .from('certificados')
          .update({ status_alerta: 'substituido' })
          .eq('empresa_id', empresa.id);

        // Inserir novo certificado com metadados reais
        const { error: insErr } = await supabase
          .from('certificados')
          .insert({
            id,
            empresa_id: empresa.id,
            arquivo_path_enc: base64Enc,
            arquivo_nome: file.originalname,
            senha_enc: senhaEnc,
            iv: ivHex,
            auth_tag: authTag,
            validade,
            status_alerta: status,
            emissor,
            impressao_digital: fingerprint
          });

        if (insErr) {
          console.error('❌ Erro ao salvar certificado no Supabase:', insErr);
          throw insErr;
        }
      }
    }

    // Sempre salvar/espelhar no SQLite local para garantir redundância
    try {
      const db = getDatabase();
      db.prepare('UPDATE certificados SET status_alerta = ? WHERE empresa_id = ?').run('substituido', empresa.id);
      db.prepare(`
        INSERT OR REPLACE INTO certificados (
          id, empresa_id, arquivo_path_enc, arquivo_nome, senha_enc, 
          iv, auth_tag, validade, status_alerta, emissor, impressao_digital
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        id, empresa.id, base64Enc, file.originalname, senhaEnc,
        ivHex, authTag, validade, status, emissor, fingerprint
      );
    } catch (sqliteErr: any) {
      console.warn('Aviso ao espelhar certificado no SQLite:', sqliteErr.message);
    }

    logAuditAction(req, 'CERTIFICADO_UPLOAD', `Certificado A1 (${certInfo.titular}) atrelado ao CNPJ ${empresa.cnpj_completo}`);

    res.status(201).json({
      success: true,
      message: 'Certificado A1 validado e configurado com sucesso no cofre.',
      data: {
        id,
        fileName: file.originalname,
        validade: certInfo.validade,
        status: 'valido',
        emissor: certInfo.emissor,
        titular: certInfo.titular,
        cnpj: certInfo.cnpj,
        impressaoDigital: certInfo.fingerprint,
        diasParaExpirar: certInfo.diasParaExpirar
      }
    });

  } catch (err: any) {
    console.error('❌ Erro no upload de certificado:', err);
    if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
    res.status(500).json({ success: false, error: err.message || 'Erro interno ao processar certificado.' });
  }
});

/**
 * DELETE /api/config/certificate/:id
 * Remove um certificado do banco e o arquivo do disco.
 */
router.delete('/:id', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;

    if (isSupabaseConfigured()) {
      const supabase = getSupabaseAdmin();
      if (supabase) {
        const { data: cert } = await supabase
          .from('certificados')
          .select('id, arquivo_path_enc, empresa_id')
          .eq('id', id)
          .maybeSingle();

        if (!cert) {
          res.status(404).json({ error: 'Certificado não encontrado.' });
          return;
        }

        await supabase.from('certificados').delete().eq('id', id);

        if (cert.arquivo_path_enc && fs.existsSync(cert.arquivo_path_enc)) {
          fs.unlinkSync(cert.arquivo_path_enc);
        }

        logAuditAction(req, 'CERTIFICADO_EXCLUIR', `Certificado ${id} removido`);
        res.json({ success: true, message: 'Certificado removido com sucesso.' });
        return;
      }
    }

    const db = getDatabase();
    const cert = db.prepare('SELECT arquivo_path_enc, empresa_id FROM certificados WHERE id = ?').get(id) as any;
    if (!cert) {
      res.status(404).json({ error: 'Certificado não encontrado.' });
      return;
    }

    db.prepare('DELETE FROM certificados WHERE id = ?').run(id);

    if (cert.arquivo_path_enc && fs.existsSync(cert.arquivo_path_enc)) {
      fs.unlinkSync(cert.arquivo_path_enc);
    }

    logAuditAction(req, 'CERTIFICADO_EXCLUIR', `Certificado ${id} removido`);

    res.json({ success: true, message: 'Certificado removido com sucesso.' });
  } catch (err: any) {
    console.error('❌ Erro ao excluir certificado:', err);
    res.status(500).json({ success: false, error: 'Erro ao remover certificado.' });
  }
});

/**
 * GET /api/config/certificate/status/:tenantId?
 * Retorna os metadados do certificado A1 ativo para a empresa informada (ou ativa).
 * NUNCA retorna senhas nem chaves privadas, garantindo conformidade Zero-Trust e persistência após login.
 */
router.get('/status/:tenantId?', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const target = req.params.tenantId || req.user?.empresaAtivaId || req.user?.empresaCnpj;
    if (!target) {
      res.json({ success: true, hasCertificate: false, certificado: null });
      return;
    }

    const cleanTarget = target.replace(/\D/g, '');
    let cert: any = null;
    let empresa: any = null;

    // 1. Supabase Cloud se configurado
    if (isSupabaseConfigured()) {
      const supabase = getSupabaseAdmin();
      if (supabase) {
        const { data: empById } = await supabase
          .from('empresas')
          .select('id, razao_social, cnpj_completo, cnpj_raiz')
          .eq('id', target)
          .maybeSingle();

        if (empById) {
          empresa = empById;
        } else if (cleanTarget) {
          const { data: empByCnpj } = await supabase
            .from('empresas')
            .select('id, razao_social, cnpj_completo, cnpj_raiz')
            .or(`cnpj_completo.eq.${target},cnpj_raiz.eq.${cleanTarget.slice(0, 8)}`)
            .maybeSingle();
          if (empByCnpj) empresa = empByCnpj;
        }

        if (empresa) {
          const { data: supaCert } = await supabase
            .from('certificados')
            .select('id, arquivo_nome, validade, status_alerta, emissor, impressao_digital, created_at, arquivo_path_enc')
            .eq('empresa_id', empresa.id)
            .neq('status_alerta', 'expirado')
            .neq('status_alerta', 'substituido')
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

          if (supaCert) cert = supaCert;
        }
      }
    }

    // 2. Fallback SQLite Local
    if (!cert) {
      const db = getDatabase();
      if (!empresa) {
        empresa = db.prepare(`
          SELECT id, razao_social, cnpj_completo, cnpj_raiz 
          FROM empresas 
          WHERE id = ? OR cnpj_completo = ? OR cnpj_raiz = ?
        `).get(target, target, cleanTarget.slice(0, 8)) as any;
      }

      if (empresa) {
        cert = db.prepare(`
          SELECT id, arquivo_nome, validade, status_alerta, emissor, impressao_digital, created_at, arquivo_path_enc
          FROM certificados
          WHERE empresa_id = ? AND status_alerta NOT IN ('expirado', 'substituido')
          ORDER BY validade DESC, created_at DESC
          LIMIT 1
        `).get(empresa.id) as any;
      }
    }

    if (!cert) {
      res.json({
        success: true,
        hasCertificate: false,
        certificado: {
          fileName: '',
          cnpj: empresa?.cnpj_completo || '',
          razãoSocial: empresa?.razao_social || '',
          tipo: 'e-CNPJ A1',
          validade: '',
          status: 'pendente',
          valido: false
        }
      });
      return;
    }

    // Validação estrita: Checar se o binário .PFX está de fato acessível no cofre (evita falso positivo na UI)
    const rawPath = (cert.arquivo_path_enc || '').trim();
    const hasPfxBinario = rawPath.startsWith('base64:') || 
                          rawPath.startsWith('data:') || 
                          (rawPath.length > 200 && /^[A-Za-z0-9+/=\s]+$/.test(rawPath)) || 
                          (rawPath.length > 0 && fs.existsSync(rawPath));

    if (!hasPfxBinario) {
      console.warn(`⚠️ Certificado ${cert.id} cadastrado, mas sem binário PFX acessível (armazenamento efêmero antigo).`);
      res.json({
        success: true,
        hasCertificate: false,
        certificado: {
          id: cert.id,
          fileName: cert.arquivo_nome || 'certificado.pfx',
          validade: cert.validade || '',
          status: 'pendente',
          valido: false,
          emissor: cert.emissor || '',
          impressaoDigital: cert.impressao_digital || '',
          cnpj: empresa?.cnpj_completo || '',
          razãoSocial: empresa?.razao_social || '',
          tipo: 'e-CNPJ A1',
          mensagemAlerta: 'Arquivo .PFX físico não encontrado (armazenamento temporário legado). Por favor, recadastre o Certificado A1.'
        }
      });
      return;
    }

    // 3. Validação real em tempo de execução: checar se a senha do cofre de fato abre o PFX
    const diag = await descriptografarCertificadoComDiagnostico(empresa.id, empresa.cnpj_completo);
    if (!diag.certificado) {
      res.json({
        success: true,
        hasCertificate: false,
        certificado: {
          id: cert.id,
          fileName: cert.arquivo_nome || 'certificado.pfx',
          validade: cert.validade || '',
          status: 'pendente',
          valido: false,
          emissor: cert.emissor || '',
          impressaoDigital: cert.impressao_digital || '',
          cnpj: empresa?.cnpj_completo || '',
          razãoSocial: empresa?.razao_social || '',
          tipo: 'e-CNPJ A1',
          mensagemAlerta: diag.motivoErro || 'Certificado pendente ou inacessível no cofre.'
        }
      });
      return;
    }

    // 4. Testar se o PFX abre com a senha descriptografada
    let infoPfx: any;
    try {
      infoPfx = validarEExtrairCertificadoPfx(diag.certificado.pfxBuffer, diag.certificado.senha);
    } catch (testErr: any) {
      console.warn(`⚠️ Certificado ${cert.id} possui senha gravada que não abre o PFX:`, testErr.message);
      res.json({
        success: true,
        hasCertificate: false,
        certificado: {
          id: cert.id,
          fileName: cert.arquivo_nome || 'certificado.pfx',
          validade: cert.validade || '',
          status: 'pendente',
          valido: false,
          emissor: cert.emissor || '',
          impressaoDigital: cert.impressao_digital || '',
          cnpj: empresa?.cnpj_completo || '',
          razãoSocial: empresa?.razao_social || '',
          tipo: 'e-CNPJ A1',
          mensagemAlerta: `A senha do Certificado gravada no cofre não abre o arquivo .PFX (${testErr.message}). Por favor, recadastre o arquivo .PFX e a senha.`
        }
      });
      return;
    }

    if (infoPfx.isExpirado) {
      res.json({
        success: true,
        hasCertificate: false,
        certificado: {
          id: cert.id,
          fileName: cert.arquivo_nome || 'certificado.pfx',
          validade: infoPfx.validade,
          status: 'expirado',
          valido: false,
          emissor: infoPfx.emissor,
          impressaoDigital: infoPfx.fingerprint,
          cnpj: empresa?.cnpj_completo || '',
          razãoSocial: empresa?.razao_social || '',
          tipo: 'e-CNPJ A1',
          mensagemAlerta: `Certificado expirou em ${new Date(infoPfx.validade).toLocaleDateString('pt-BR')}.`
        }
      });
      return;
    }

    res.json({
      success: true,
      hasCertificate: true,
      certificado: {
        id: cert.id,
        fileName: cert.arquivo_nome || 'certificado.pfx',
        validade: infoPfx.validade,
        status: 'valido',
        valido: true,
        emissor: infoPfx.emissor,
        impressaoDigital: infoPfx.fingerprint,
        titular: infoPfx.titular,
        cnpj: infoPfx.cnpj || empresa?.cnpj_completo || '',
        razãoSocial: empresa?.razao_social || '',
        tipo: 'e-CNPJ A1'
      }
    });
  } catch (err: any) {
    console.error('❌ Erro ao buscar status do certificado:', err);
    res.status(500).json({ success: false, error: 'Erro ao verificar certificado ativo.' });
  }
});

export default router;
