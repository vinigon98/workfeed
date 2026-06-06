const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
const bodyParser = require('body-parser');
const axios = require('axios');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 4000;
const LEADS_FILE_PATH = path.join(__dirname, 'leads_db.json');

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(express.static('public', { extensions: ['html', 'htm'] }));

// Postgres Connection
const pool = new Pool({
  user: 'postgres',
  host: 'localhost',
  database: 'psicosafe',
  password: 'postgres_password',
  port: 5433,
});

// In-Memory fallback storage with local disk persistence backup (leads_db.json)
let inMemoryLeads = [];
try {
  if (fs.existsSync(LEADS_FILE_PATH)) {
    const fileData = fs.readFileSync(LEADS_FILE_PATH, 'utf8');
    inMemoryLeads = JSON.parse(fileData || '[]');
    console.log(`[LOG] ${inMemoryLeads.length} leads históricos carregados com sucesso do backup local (leads_db.json).`);
  }
} catch (err) {
  console.warn('[WARNING] Falha ao carregar backup local de leads:', err.message);
}

// Initialize Database Tables
const initDb = async () => {
  const tableTriagem = `
    CREATE TABLE IF NOT EXISTS triagem_nr1 (
      id SERIAL PRIMARY KEY,
      setor VARCHAR(100),
      nota_estresse INTEGER,
      imc DECIMAL,
      horas_sono INTEGER,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `;
  const tableLeads = `
    CREATE TABLE IF NOT EXISTS landing_leads (
      id SERIAL PRIMARY KEY,
      nome VARCHAR(200),
      empresa VARCHAR(200),
      cargo VARCHAR(200),
      tamanho_empresa VARCHAR(50),
      maior_desafio VARCHAR(100),
      objetivo VARCHAR(150),
      email VARCHAR(250),
      whatsapp VARCHAR(30),
      source VARCHAR(100),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `;
  try {
    await pool.query(tableTriagem);
    await pool.query(tableLeads);
    console.log('[LOG] Tabelas garantidas no PostgreSQL (com colunas de e-mail e interesse).');
  } catch (err) {
    console.error('[ERROR] Erro ao inicializar DB (Certifique-se que o Docker subiu):', err.message);
  }
};

// Start DB init after a short delay to allow Docker DB to wake up
setTimeout(initDb, 5000);

// Webhook para logs de triagem (mantido para compatibilidade de fluxo)
app.post('/api/webhook', async (req, res) => {
  const { setor, nota_estresse, imc, horas_sono } = req.body;

  try {
    const query = 'INSERT INTO triagem_nr1 (setor, nota_estresse, imc, horas_sono) VALUES ($1, $2, $3, $4)';
    await pool.query(query, [setor, nota_estresse, imc, horas_sono]);
    console.log(`[LOG] Nova triagem recebida: Setor ${setor}, Estresse ${nota_estresse}`);

    if (nota_estresse > 7) {
      console.log('[LOG] Alerta de estresse elevado detectado no setor.');
    }

    res.status(200).json({ status: 'success', message: 'Dados processados com sucesso.' });
  } catch (err) {
    console.error('[ERROR] Erro no Webhook:', err);
    res.status(500).json({ status: 'error', message: err.message });
  }
});

// ─── Landing Page Lead Capture (Radar Corp) ──────────────────────────────────
// POST /api/leads — Recebe dados qualificados comercialmente do formulário da Landing
app.post('/api/leads', async (req, res) => {
  const { nome, empresa, cargo, tamanho, colaboradores, dor, interesse, email, whatsapp, source } = req.body;

  const newLead = {
    id: inMemoryLeads.length + 1,
    nome: nome || '',
    empresa: empresa || '',
    cargo: cargo || '',
    tamanho_empresa: colaboradores || tamanho || '',
    maior_desafio: interesse || dor || '',
    email: email || '',
    whatsapp: whatsapp || '',
    source: source || 'landing_b2b_workfeed',
    created_at: new Date().toISOString()
  };

  // 1. Armazenamento em memória do servidor
  inMemoryLeads.push(newLead);
  console.log('[LOG] Nova solicitação comercial recebida (Workfeed):', newLead);

  // 2. Gravação de contingência em arquivo físico local para impedir perda de dados
  try {
    fs.writeFileSync(LEADS_FILE_PATH, JSON.stringify(inMemoryLeads, null, 2), 'utf8');
    console.log('[LOG] Backup físico local atualizado com sucesso no arquivo leads_db.json.');
  } catch (writeErr) {
    console.warn('[WARNING] Falha ao escrever arquivo físico de backup local:', writeErr.message);
  }

  // 3. Persistência no PostgreSQL se disponível
  try {
    const query = `
      INSERT INTO landing_leads (nome, empresa, cargo, tamanho_empresa, maior_desafio, email, whatsapp, source)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING id;
    `;
    const result = await pool.query(query, [
      newLead.nome,
      newLead.empresa,
      newLead.cargo,
      newLead.tamanho_empresa,
      newLead.maior_desafio,
      newLead.email,
      newLead.whatsapp,
      newLead.source,
    ]);

    console.log(`[LOG] Solicitação comercial #${result.rows[0].id} salva no PostgreSQL — ${nome} (${empresa})`);
    res.status(200).json({ status: 'success', id: result.rows[0].id, message: 'Solicitação comercial registrada com sucesso no banco de dados!' });
  } catch (err) {
    console.warn('[WARNING] Banco de dados offline. Solicitação comercial salva de forma resiliente em backup físico leads_db.json.');
    res.status(200).json({ 
      status: 'success', 
      id: newLead.id, 
      message: 'Solicitação recebida e persistida em backup físico leads_db.json (DB desconectado).' 
    });
  }
});

// GET /api/leads — PROTEGIDA/DESATIVADA para impedir quebras de privacidade ou vazamento
app.get('/api/leads', (req, res) => {
  console.warn('[WARNING] Tentativa de acesso não autorizado à rota pública de leitura de leads.');
  res.status(403).json({ status: 'error', message: 'Acesso Proibido. Esta rota foi desativada por motivos de segurança.' });
});

// GET /api/leads-secure-7v2a9x — ROTA SECRETA E OFUSCADA para leitura administrativa de leads
app.get('/api/leads-secure-7v2a9x', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM landing_leads ORDER BY created_at DESC LIMIT 500;');
    res.json({ 
      source: 'database',
      total: result.rowCount, 
      leads: result.rows 
    });
  } catch (err) {
    console.log('[LOG] Servindo solicitações armazenadas em memória/backup local (PostgreSQL desconectado).');
    res.json({ 
      source: 'server_memory', 
      total: inMemoryLeads.length, 
      leads: [...inMemoryLeads].reverse() 
    });
  }
});

// Stats API para a demonstração do Dashboard
app.get('/api/stats', async (req, res) => {
  try {
    const statsQuery = `
      SELECT 
        setor, 
        ROUND(AVG(nota_estresse), 2) as media_estresse,
        ROUND(AVG(imc), 2) as media_imc,
        COUNT(*) as total_colaboradores
      FROM triagem_nr1
      GROUP BY setor;
    `;
    const result = await pool.query(statsQuery);
    
    // Dados conceituais padrão se a tabela de triagem estiver vazia
    let sectorStats = result.rows;
    if (sectorStats.length === 0) {
      sectorStats = [
        { setor: 'Administrativo', media_estresse: 3.2, media_imc: 24.1, total_colaboradores: 42 },
        { setor: 'Operações / Logística', media_estresse: 7.1, media_imc: 26.5, total_colaboradores: 98 },
        { setor: 'Atendimento ao Cliente', media_estresse: 6.8, media_imc: 23.8, total_colaboradores: 55 },
        { setor: 'Vendas / Comercial', media_estresse: 5.9, media_imc: 25.0, total_colaboradores: 37 },
        { setor: 'Tecnologia / TI', media_estresse: 4.8, media_imc: 24.5, total_colaboradores: 64 },
        { setor: 'Recursos Humanos', media_estresse: 3.5, media_imc: 22.9, total_colaboradores: 12 }
      ];
    }
    
    // Dados de gráfico temporal
    const lineChartData = [
      { month: 'Janeiro', engajamento: 72 },
      { month: 'Fevereiro', engajamento: 78 },
      { month: 'Março', engajamento: 81 },
      { month: 'Abril', engajamento: 85 }
    ];

    res.json({
      sectorStats: sectorStats,
      lineChartData: lineChartData
    });
  } catch (err) {
    // Retorna dados estatísticos padrão em caso de falha de conexão com PostgreSQL
    const fallbackSectorStats = [
      { setor: 'Administrativo', media_estresse: 3.2, media_imc: 24.1, total_colaboradores: 42 },
      { setor: 'Operações / Logística', media_estresse: 7.1, media_imc: 26.5, total_colaboradores: 98 },
      { setor: 'Atendimento ao Cliente', media_estresse: 6.8, media_imc: 23.8, total_colaboradores: 55 },
      { setor: 'Vendas / Comercial', media_estresse: 5.9, media_imc: 25.0, total_colaboradores: 37 },
      { setor: 'Tecnologia / TI', media_estresse: 4.8, media_imc: 24.5, total_colaboradores: 64 },
      { setor: 'Recursos Humanos', media_estresse: 3.5, media_imc: 22.9, total_colaboradores: 12 }
    ];
    const fallbackLineChartData = [
      { month: 'Janeiro', engajamento: 72 },
      { month: 'Fevereiro', engajamento: 78 },
      { month: 'Março', engajamento: 81 },
      { month: 'Abril', engajamento: 85 }
    ];

    res.json({
      sectorStats: fallbackSectorStats,
      lineChartData: fallbackLineChartData
    });
  }
});

app.listen(PORT, () => {
  console.log(`[LOG] Workfeed — Servidor rodando em http://localhost:${PORT}`);
  console.log(`[LOG] Landing Page: http://localhost:${PORT}/landing`);
  console.log(`[LOG] Lead Capture API: POST http://localhost:${PORT}/api/leads`);
  console.log(`[LOG] Dashboard API:    GET  http://localhost:${PORT}/api/stats`);
});
