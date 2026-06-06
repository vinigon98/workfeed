const functions = require('firebase-functions');
const admin = require('firebase-admin');
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');

// Inicializa o SDK Admin do Firebase (conecta ao Firestore nativamente na nuvem da Google)
admin.initializeApp();
const db = admin.firestore();

const app = express();

// Middleware
app.use(cors({ origin: true }));
app.use(bodyParser.json());

// ─── Rotas da API da Radar Corp ──────────────────────────────────────────────

// POST /api/leads — Rota pública para salvar novo lead vindo do formulário comercial
app.post('/api/leads', async (req, res) => {
  const { nome, empresa, cargo, colaboradores, tamanho, dor, interesse, email, whatsapp, source } = req.body;

  const newLead = {
    nome: nome || '',
    empresa: empresa || '',
    cargo: cargo || '',
    tamanho_empresa: colaboradores || tamanho || '',
    maior_desafio: interesse || dor || '',
    email: email || '',
    whatsapp: whatsapp || '',
    source: source || 'landing_b2b_radar_corp',
    created_at: admin.firestore.FieldValue.serverTimestamp() // Timestamp do servidor do Google
  };

  try {
    const docRef = await db.collection('landing_leads').add(newLead);
    console.log(`[LOG] Lead comercial #${docRef.id} registrado no Firestore.`);
    res.status(200).json({ 
      status: 'success', 
      id: docRef.id, 
      message: 'Solicitação comercial registrada com sucesso no Google Cloud Firestore!' 
    });
  } catch (err) {
    console.error('[ERROR] Falha ao gravar no Firestore:', err.message);
    res.status(500).json({ 
      status: 'error', 
      message: 'Erro interno ao persistir dados.' 
    });
  }
});

// GET /api/leads-secure-7v2a9x — ROTA SECRETA E OFUSCADA para leitura administrativa de leads
app.get('/api/leads-secure-7v2a9x', async (req, res) => {
  try {
    const snapshot = await db.collection('landing_leads').orderBy('created_at', 'desc').limit(500).get();
    const leads = [];
    
    snapshot.forEach(doc => {
      const data = doc.data();
      let dateStr = new Date().toISOString();
      
      // Converte timestamp do Firestore para string legível
      if (data.created_at && typeof data.created_at.toDate === 'function') {
        dateStr = data.created_at.toDate().toISOString();
      }
      
      leads.push({
        id: doc.id,
        nome: data.nome,
        empresa: data.empresa,
        cargo: data.cargo,
        tamanho_empresa: data.tamanho_empresa,
        maior_desafio: data.maior_desafio,
        email: data.email,
        whatsapp: data.whatsapp,
        source: data.source,
        created_at: dateStr
      });
    });

    res.json({ 
      source: 'firestore',
      total: leads.length, 
      leads: leads 
    });
  } catch (err) {
    console.error('[ERROR] Erro ao buscar leads no Firestore:', err.message);
    res.status(500).json({ 
      status: 'error', 
      message: 'Erro ao resgatar leads cadastrados.' 
    });
  }
});

// GET /api/leads — PROTEGIDA/DESATIVADA para impedir quebras de privacidade ou vazamento
app.get('/api/leads', (req, res) => {
  res.status(403).json({ 
    status: 'error', 
    message: 'Acesso Proibido. Esta rota foi desativada por motivos de segurança.' 
  });
});

// GET /api/stats — Estatísticas conceituais para demonstração do painel
app.get('/api/stats', (req, res) => {
  const sectorStats = [
    { setor: 'Administrativo', media_estresse: 3.2, media_imc: 24.1, total_colaboradores: 42 },
    { setor: 'Operações / Logística', media_estresse: 7.1, media_imc: 26.5, total_colaboradores: 98 },
    { setor: 'Atendimento ao Cliente', media_estresse: 6.8, media_imc: 23.8, total_colaboradores: 55 },
    { setor: 'Vendas / Comercial', media_estresse: 5.9, media_imc: 25.0, total_colaboradores: 37 },
    { setor: 'Tecnologia / TI', media_estresse: 4.8, media_imc: 24.5, total_colaboradores: 64 },
    { setor: 'Recursos Humanos', media_estresse: 3.5, media_imc: 22.9, total_colaboradores: 12 }
  ];
  
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
});

// Exporta o Express App como a Cloud Function 'api'
exports.api = functions.https.onRequest(app);
