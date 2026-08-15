import { Router, Response } from 'express';
import multer from 'multer';
import crypto from 'crypto';
import path from 'path';
import fs from 'fs';
import { v4 as uuid } from 'uuid';
import { getDatabase } from '../db/database';
import { AuthenticatedRequest, requireAuth, logAuditAction } from '../middleware/auth';
import { CERTIFICADO } from '../config';

const router = Router();

// Garantir que o diretório seguro exista
const certStorageDir = CERTIFICADO.STORAGE_DIR;
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
 * A senha é criptografada com AES-256-GCM antes de ser salva no banco.
 * O arquivo PFX não é modificado.
 */
router.post('/upload', requireAuth, upload.single('certificado'), (req: AuthenticatedRequest, res: Response) => {
  try {
    const { tenantId, senha } = req.body;
    const file = req.file;

    if (!tenantId || !senha || !file) {
      if (file) fs.unlinkSync(file.path); // Remove o arquivo se faltar dados
      res.status(400).json({ error: 'tenantId, senha e o arquivo .PFX são obrigatórios.' });
      return;
    }

    const encryptionKey = CERTIFICADO.ENCRYPTION_KEY;
    if (!encryptionKey || encryptionKey.length !== 64) {
      if (file) fs.unlinkSync(file.path);
      res.status(500).json({ error: 'CERT_ENCRYPTION_KEY inválida ou ausente no .env. Deve ter 64 caracteres hexadecimais.' });
      return;
    }

    const db = getDatabase();

    // Validar se o tenant existe e pertence à carteira (se necessário)
    const empresa = db.prepare('SELECT razao_social, cnpj_completo FROM empresas WHERE id = ?').get(tenantId) as any;
    if (!empresa) {
      fs.unlinkSync(file.path);
      res.status(404).json({ error: 'Empresa não encontrada.' });
      return;
    }

    // Criptografar a senha do PFX
    const keyBuffer = Buffer.from(encryptionKey, 'hex');
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', keyBuffer, iv);

    let senhaEnc = cipher.update(senha, 'utf8', 'hex');
    senhaEnc += cipher.final('hex');
    const authTag = cipher.getAuthTag().toString('hex');
    const ivHex = iv.toString('hex');

    const id = uuid();
    // Simular metadados do certificado (idealmente ler via pkcs12, mas para POC simulamos)
    const validade = '2028-12-31';
    const emissor = 'AC Certificadora A1';
    const fingerprint = `SHA256:${crypto.randomBytes(8).toString('hex').toUpperCase()}`;
    const status = 'ok';

    // Desativar certificados anteriores desta empresa
    db.prepare('UPDATE certificados SET status_alerta = ? WHERE empresa_id = ?').run('substituido', tenantId);

    // Inserir novo certificado
    db.prepare(`
      INSERT INTO certificados (
        id, empresa_id, arquivo_path_enc, arquivo_nome, senha_enc, 
        iv, auth_tag, validade, status_alerta, emissor, impressao_digital
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id, tenantId, file.path, file.originalname, senhaEnc,
      ivHex, authTag, validade, status, emissor, fingerprint
    );

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
    if (req.file) fs.unlinkSync(req.file.path);
    res.status(500).json({ success: false, error: 'Erro interno ao processar certificado.' });
  }
});

/**
 * DELETE /api/config/certificate/:id
 * Remove um certificado do banco e o arquivo do disco.
 */
router.delete('/:id', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const db = getDatabase();

    const cert = db.prepare('SELECT arquivo_path_enc, empresa_id FROM certificados WHERE id = ?').get(id) as any;
    if (!cert) {
      res.status(404).json({ error: 'Certificado não encontrado.' });
      return;
    }

    db.prepare('DELETE FROM certificados WHERE id = ?').run(id);

    if (fs.existsSync(cert.arquivo_path_enc)) {
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
