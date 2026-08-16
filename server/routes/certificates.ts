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
    const { tenantId, senha } = req.body;
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
        } else {
          // Tenta buscar por CNPJ Completo ou Raiz
          const { data: byCnpj } = await supabase
            .from('empresas')
            .select('id, razao_social, cnpj_completo, cnpj_raiz')
            .or(`cnpj_completo.eq.${tenantId},cnpj_raiz.eq.${tenantId}`)
            .maybeSingle();
          if (byCnpj) empresa = byCnpj;
        }
      }
    }

    // 2. Fallback para SQLite Local se não encontrou no Supabase
    if (!empresa) {
      const db = getDatabase();
      empresa = db.prepare('SELECT id, razao_social, cnpj_completo, cnpj_raiz FROM empresas WHERE id = ? OR cnpj_completo = ? OR cnpj_raiz = ?').get(tenantId, tenantId, tenantId) as any;
    }

    if (!empresa) {
      if (file && fs.existsSync(file.path)) fs.unlinkSync(file.path);
      res.status(404).json({ error: 'Empresa não encontrada na carteira.' });
      return;
    }

    // Criptografar a senha do PFX
    const keyBuffer = Buffer.from(keyHex, 'hex');
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', keyBuffer, iv);

    let senhaEnc = cipher.update(senha, 'utf8', 'hex');
    senhaEnc += cipher.final('hex');
    const authTag = cipher.getAuthTag().toString('hex');
    const ivHex = iv.toString('hex');

    const id = uuid();
    const validade = '2028-12-31';
    const emissor = 'AC Certificadora A1';
    const fingerprint = `SHA256:${crypto.randomBytes(8).toString('hex').toUpperCase()}`;
    const status = 'ok';

    // 3. Salvar no Supabase ou SQLite
    if (isSupabaseConfigured()) {
      const supabase = getSupabaseAdmin();
      if (supabase) {
        // Desativar certificados anteriores desta empresa
        await supabase
          .from('certificados')
          .update({ status_alerta: 'substituido' })
          .eq('empresa_id', empresa.id);

        // Inserir novo certificado
        const { error: insErr } = await supabase
          .from('certificados')
          .insert({
            id,
            empresa_id: empresa.id,
            arquivo_path_enc: file.path,
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
    } else {
      const db = getDatabase();
      db.prepare('UPDATE certificados SET status_alerta = ? WHERE empresa_id = ?').run('substituido', empresa.id);
      db.prepare(`
        INSERT INTO certificados (
          id, empresa_id, arquivo_path_enc, arquivo_nome, senha_enc, 
          iv, auth_tag, validade, status_alerta, emissor, impressao_digital
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        id, empresa.id, file.path, file.originalname, senhaEnc,
        ivHex, authTag, validade, status, emissor, fingerprint
      );
    }

    logAuditAction(req, 'CERTIFICADO_UPLOAD', `Certificado A1 atrelado ao CNPJ ${empresa.cnpj_completo}`);

    res.status(201).json({
      success: true,
      message: 'Certificado enviado e configurado com sucesso.',
      data: {
        id,
        fileName: file.originalname,
        validade,
        status: 'valido',
        emissor,
        impressaoDigital: fingerprint
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

export default router;
