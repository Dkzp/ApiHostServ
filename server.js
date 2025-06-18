// Importações
import express from 'express';
import dotenv from 'dotenv';
import axios from 'axios';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Carrega variáveis de ambiente do arquivo .env
dotenv.config();

// Inicializa o aplicativo Express
const app = express();
app.use(express.json());

const port = process.env.PORT || 3001;
const apiKey = process.env.OPENWEATHER_API_KEY;

// Middleware para CORS
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
    next();
});

// Servir arquivos estáticos da pasta 'public'
app.use(express.static(path.join(__dirname, "public")));

// ===================================================================
//      DADOS DE DICAS (ATIVIDADE ANTERIOR)
// ===================================================================
const dicasManutencaoGerais = [
    { id: 1, dica: "Verifique o nível do óleo regularmente. É como dar leitinho pro gatinho!" },
    { id: 2, dica: "Calibre os pneus semanalmente para um passeio mais macio." },
    { id: 3, dica: "Confira o fluido de arrefecimento (a 'aguinha' do carro)." },
    { id: 4, dica: "Mantenha os faróis e lanternas limpinhos para enxergar bem à noite." }
];

const dicasPorTipo = {
    carrobase: [ 
        { id: 10, dica: "Faça o rodízio dos pneus a cada 10.000 km para um desgaste uniforme." },
        { id: 11, dica: "Verifique o alinhamento e balanceamento se sentir o volante trepidar." }
    ],
    carroesportivo: [
        { id: 15, dica: "Use sempre combustível de alta octanagem para o motor render o máximo!" },
        { id: 16, dica: "Fique de olho no desgaste dos freios, pois esportivos exigem mais deles." }
    ],
    caminhao: [ 
        { id: 20, dica: "Verifique o sistema de freios a ar com frequência, é sua maior segurança!" },
        { id: 21, dica: "Lubrifique os pinos e articulações do chassi periodicamente." }
    ],
    moto: [ 
        { id: 30, dica: "Lubrifique e ajuste a tensão da corrente a cada 500 km." },
        { id: 31, dica: "Verifique sempre os dois freios (dianteiro e traseiro) antes de sair." }
    ]
};

// ===================================================================
//      NOVOS DADOS E ENDPOINTS - ATIVIDADE B2.P1.A9
// ===================================================================

// 1. "Estoque de Dados" para os novos endpoints

const veiculosDestaque = [
    { id: 10, modelo: "Carrinho de Laço da Kitty 1", ano: 2024, destaque: "Perfeito para passeios no parque!", imagemUrl: "https://i.pinimg.com/originals/a9/3c/66/a93c669165d38c2323e1e2c1c0a1a0e8.jpg" },
    { id: 11, modelo: "Mini Van de Piquenique", ano: 2023, destaque: "Leva todos os amiguinhos!", imagemUrl: "https://i.pinimg.com/736x/89/a3/93/89a39396489390234a9925232d326f5f.jpg" },
    { id: 12, modelo: "Conversível Estrelado", ano: 2025, destaque: "Brilha mais que o céu à noite!", imagemUrl: "https://i.pinimg.com/originals/30/1f/24/301f243a416a567636e78119a0cd881c.jpg" }
];

const servicosGaragem = [
    { id: "svc001", nome: "Banho de Espuma com Brilho de Morango", descricao: "Deixa a pintura do seu carro cheirosa e brilhante.", precoEstimado: "R$ 150,00" },
    { id: "svc002", nome: "Alinhamento de Lacinhos e Balanceamento de Corações", descricao: "Para uma direção mais fofa e segura.", precoEstimado: "R$ 120,00" },
    { id: "svc003", nome: "Troca de Óleo Essencial de Baunilha", descricao: "Mantém o motor funcionando suave como um abraço.", precoEstimado: "R$ 200,00" },
    { id: "svc004", nome: "Check-up Fofura Completo", descricao: "Verificamos todos os itens fofos do seu veículo.", precoEstimado: "R$ 250,00" }
];

// 2. Implementação dos novos endpoints GET

// Endpoint para retornar a lista de veículos em destaque
app.get('/api/garagem/veiculos-destaque', (req, res) => {
    console.log(`[Servidor] Requisição para /api/garagem/veiculos-destaque`);
    res.json(veiculosDestaque);
});

// Endpoint para retornar todos os serviços oferecidos
app.get('/api/garagem/servicos-oferecidos', (req, res) => {
    console.log(`[Servidor] Requisição para /api/garagem/servicos-oferecidos`);
    res.json(servicosGaragem);
});

// (Opcional) Endpoint para buscar UM serviço específico pelo ID
app.get('/api/garagem/servicos-oferecidos/:idServico', (req, res) => {
    const { idServico } = req.params;
    console.log(`[Servidor] Requisição para /api/garagem/servicos-oferecidos/${idServico}`);
    
    const servico = servicosGaragem.find(s => s.id === idServico);
    
    if (servico) {
        res.json(servico);
    } else {
        res.status(404).json({ error: 'Serviço de fofura não encontrado.' });
    }
});


// ===================================================================
//      ENDPOINTS EXISTENTES
// ===================================================================

app.get('/api/dicas-manutencao', (req, res) => {
    console.log('[Servidor] Requisição recebida para /api/dicas-manutencao');
    res.json(dicasManutencaoGerais);
});

app.get('/api/dicas-manutencao/:tipoVeiculo', (req, res) => {
    const { tipoVeiculo } = req.params;
    const tipoNormalizado = tipoVeiculo.toLowerCase();
    
    console.log(`[Servidor] Requisição recebida para /api/dicas-manutencao/${tipoVeiculo}`);
    const dicas = dicasPorTipo[tipoNormalizado];

    if (dicas) {
        res.json(dicas);
    } else {
        res.status(404).json({ error: `Nenhuma dica fofinha encontrada para o tipo: ${tipoVeiculo}` });
    }
});

app.get('/api/previsao/:cidade', async (req, res) => {
    const { cidade } = req.params;

    if (!apiKey || apiKey === "SUA_CHAVE_OPENWEATHERMAP_AQUI") {
        console.error('[Servidor] Chave da API OpenWeatherMap não configurada.');
        return res.status(500).json({ error: 'Chave da API não configurada no servidor.' });
    }
    if (!cidade) {
        return res.status(400).json({ error: 'Nome da cidade é obrigatório.' });
    }

    const weatherAPIUrl = `https://api.openweathermap.org/data/2.5/forecast?q=${cidade}&appid=${apiKey}&units=metric&lang=pt_br`;

    try {
        console.log(`[Servidor] Buscando previsão para: ${cidade}`);
        const apiResponse = await axios.get(weatherAPIUrl);
        console.log('[Servidor] Dados recebidos da OpenWeatherMap.');
        res.json(apiResponse.data);
    } catch (error) {
        if (error.response) {
            console.error("[Servidor] Erro da API OpenWeatherMap:", error.response.data);
            res.status(error.response.status).json({ error: error.response.data.message || 'Erro ao buscar dados da OpenWeatherMap.' });
        } else {
            console.error("[Servidor] Erro na requisição para OpenWeatherMap:", error.message);
            res.status(500).json({ error: 'Erro interno no servidor ao tentar buscar previsão.' });
        }
    }
});

// Inicia o servidor
app.listen(port, () => {
    console.log(`Servidor backend fofinho rodando em http://localhost:${port}`);
    if (!apiKey || apiKey === "SUA_CHAVE_OPENWEATHERMAP_AQUI") {
        console.warn("***************** ATENÇÃO: Chave da API OpenWeatherMap não configurada! *****************");
    } else {
        console.log("[Servidor] Chave da API OpenWeatherMap carregada.");
    }
});