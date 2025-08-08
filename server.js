// Importações
import express from 'express';
import dotenv from 'dotenv';
import axios from 'axios';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import connectDB from './lib/db.js';
import mongoose from 'mongoose';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Carrega variáveis de ambiente do arquivo .env
dotenv.config();

// Inicializa o aplicativo Express
const app = express();
app.use(express.json());

const port = process.env.PORT || 3001;
const apiKey = process.env.OPENWEATHER_API_KEY;

// Conectar ao MongoDB
connectDB();

// Middleware para CORS
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS'); // Habilita PUT
    next();
});

// Servir arquivos estáticos da pasta 'public'
app.use(express.static(path.join(__dirname, "public")));

// ===================================================================
//      MODELOS DO MONGODB
// ===================================================================

// Modelo para Dicas de Manutenção
const dicaSchema = new mongoose.Schema({
    id: { type: Number, required: true, unique: true },
    dica: { type: String, required: true },
    tipoVeiculo: { type: String, enum: ['geral', 'carrobase', 'carroesportivo', 'caminhao', 'moto'], default: 'geral' }
});

const Dica = mongoose.model('Dica', dicaSchema);

// Modelo para Veículos em Destaque
const veiculoSchema = new mongoose.Schema({
    id: { type: Number, required: true, unique: true },
    modelo: { type: String, required: true },
    ano: { type: Number, required: true },
    destaque: { type: String, required: true },
    imagemUrl: { type: String, required: true }
});

const Veiculo = mongoose.model('Veiculo', veiculoSchema);

// Modelo para Serviços da Garagem
const servicoSchema = new mongoose.Schema({
    id: { type: String, required: true, unique: true },
    nome: { type: String, required: true },
    descricao: { type: String, required: true },
    precoEstimado: { type: String, required: true }
});

const Servico = mongoose.model('Servico', servicoSchema);

// Modelo para Detalhes Extras dos Veículos (NOVO!)
const detalhesExtrasSchema = new mongoose.Schema({
    veiculoId: { type: String, required: true, unique: true },
    valorFIPE: { type: Number, default: 0 },
    recallPendente: { type: Boolean, default: false },
    motivoRecall: { type: String, default: '' },
    dicaManutencao: { type: String, default: '' },
    proximaRevisaoRecomendada: { type: Date }
});
const DetalhesExtras = mongoose.model('DetalhesExtras', detalhesExtrasSchema);


// ===================================================================
//      INICIALIZAÇÃO DOS DADOS (APENAS NA PRIMEIRA EXECUÇÃO)
// ===================================================================
async function inicializarDados() {
    try {
        // Verificar se já existem dados
        const countDicas = await Dica.countDocuments();
        const countVeiculos = await Veiculo.countDocuments();
        const countServicos = await Servico.countDocuments();
        const countDetalhes = await DetalhesExtras.countDocuments();

        // Inserir dados apenas se o banco estiver vazio
        if (countDicas === 0) {
            await Dica.insertMany([
                { id: 1, dica: "Verifique o nível do óleo regularmente. É como dar leitinho pro gatinho!", tipoVeiculo: "geral" },
                { id: 2, dica: "Calibre os pneus semanalmente para um passeio mais macio.", tipoVeiculo: "geral" },
                { id: 3, dica: "Confira o fluido de arrefecimento (a 'aguinha' do carro).", tipoVeiculo: "geral" },
                { id: 4, dica: "Mantenha os faróis e lanternas limpinhos para enxergar bem à noite.", tipoVeiculo: "geral" },
                { id: 10, dica: "Faça o rodízio dos pneus a cada 10.000 km para um desgaste uniforme.", tipoVeiculo: "carrobase" },
                { id: 11, dica: "Verifique o alinhamento e balanceamento se sentir o volante trepidar.", tipoVeiculo: "carrobase" },
                { id: 15, dica: "Use sempre combustível de alta octanagem para o motor render o máximo!", tipoVeiculo: "carroesportivo" },
                { id: 16, dica: "Fique de olho no desgaste dos freios, pois esportivos exigem mais deles.", tipoVeiculo: "carroesportivo" },
                { id: 20, dica: "Verifique o sistema de freios a ar com frequência, é sua maior segurança!", tipoVeiculo: "caminhao" },
                { id: 21, dica: "Lubrifique os pinos e articulações do chassi periodicamente.", tipoVeiculo: "caminhao" },
                { id: 30, dica: "Lubrifique e ajuste a tensão da corrente a cada 500 km.", tipoVeiculo: "moto" },
                { id: 31, dica: "Verifique sempre os dois freios (dianteiro e traseiro) antes de sair.", tipoVeiculo: "moto" }
            ]);
            console.log('Dicas de manutenção inseridas no banco de dados');
        }

        if (countVeiculos === 0) {
            await Veiculo.insertMany([
                { id: 10, modelo: "Carrinho de Laço da Kitty 1", ano: 2024, destaque: "Perfeito para passeios no parque!", imagemUrl: "https://i.pinimg.com/originals/a9/3c/66/a93c669165d38c2323e1e2c1c0a1a0e8.jpg" },
                { id: 11, modelo: "Mini Van de Piquenique", ano: 2023, destaque: "Leva todos os amiguinhos!", imagemUrl: "https://i.pinimg.com/736x/89/a3/93/89a39396489390234a9925232d326f5f.jpg" },
                { id: 12, modelo: "Conversível Estrelado", ano: 2025, destaque: "Brilha mais que o céu à noite!", imagemUrl: "https://i.pinimg.com/originals/30/1f/24/301f243a416a567636e78119a0cd881c.jpg" }
            ]);
            console.log('Veículos em destaque inseridos no banco de dados');
        }

        if (countServicos === 0) {
            await Servico.insertMany([
                { id: "svc001", nome: "Banho de Espuma com Brilho de Morango", descricao: "Deixa a pintura do seu carro cheirosa e brilhante.", precoEstimado: "R$ 150,00" },
                { id: "svc002", nome: "Alinhamento de Lacinhos e Balanceamento de Corações", descricao: "Para uma direção mais fofa e segura.", precoEstimado: "R$ 120,00" },
                { id: "svc003", nome: "Troca de Óleo Essencial de Baunilha", descricao: "Mantém o motor funcionando suave como um abraço.", precoEstimado: "R$ 200,00" },
                { id: "svc004", nome: "Check-up Fofura Completo", descricao: "Verificamos todos os itens fofos do seu veículo.", precoEstimado: "R$ 250,00" }
            ]);
            console.log('Serviços da garagem inseridos no banco de dados');
        }

        if (countDetalhes === 0) {
            await DetalhesExtras.insertMany([
                {
                    veiculoId: "carro1",
                    valorFIPE: 35000.50,
                    recallPendente: false,
                    dicaManutencao: "Verificar nível do óleo a cada 1000km. Fuscas adoram atenção!",
                    proximaRevisaoRecomendada: new Date("2024-12-15T00:00:00Z")
                },
                {
                    veiculoId: "carro2",
                    valorFIPE: 85000.00,
                    recallPendente: true,
                    motivoRecall: "Verificar sistema de injeção de glitter.",
                    dicaManutencao: "Sempre usar combustível aditivado com essência de tutti-frutti.",
                    proximaRevisaoRecomendada: new Date("2025-05-20T00:00:00Z")
                }
            ]);
            console.log('Detalhes extras de veículos inseridos no banco de dados');
        }

    } catch (error) {
        console.error('Erro ao inicializar dados:', error);
    }
}

// Chamar a função de inicialização quando a conexão com o MongoDB estiver estabelecida
mongoose.connection.once('open', () => {
    inicializarDados();
});

// ===================================================================
//      ENDPOINTS
// ===================================================================

// Endpoint para retornar a lista de veículos em destaque
app.get('/api/garagem/veiculos-destaque', async (req, res) => {
    try {
        console.log(`[Servidor] Requisição para /api/garagem/veiculos-destaque`);
        const veiculos = await Veiculo.find();
        res.json(veiculos);
    } catch (error) {
        console.error('Erro ao buscar veículos:', error);
        res.status(500).json({ error: 'Erro ao buscar veículos em destaque' });
    }
});

// Endpoint para retornar todos os serviços oferecidos
app.get('/api/garagem/servicos-oferecidos', async (req, res) => {
    try {
        console.log(`[Servidor] Requisição para /api/garagem/servicos-oferecidos`);
        const servicos = await Servico.find();
        res.json(servicos);
    } catch (error) {
        console.error('Erro ao buscar serviços:', error);
        res.status(500).json({ error: 'Erro ao buscar serviços oferecidos' });
    }
});

// Endpoint para buscar UM serviço específico pelo ID
app.get('/api/garagem/servicos-oferecidos/:idServico', async (req, res) => {
    const { idServico } = req.params;
    console.log(`[Servidor] Requisição para /api/garagem/servicos-oferecidos/${idServico}`);
    
    try {
        const servico = await Servico.findOne({ id: idServico });
        
        if (servico) {
            res.json(servico);
        } else {
            res.status(404).json({ error: 'Serviço de fofura não encontrado.' });
        }
    } catch (error) {
        console.error('Erro ao buscar serviço:', error);
        res.status(500).json({ error: 'Erro ao buscar serviço' });
    }
});

// Endpoint para dicas gerais de manutenção
app.get('/api/dicas-manutencao', async (req, res) => {
    try {
        console.log('[Servidor] Requisição recebida para /api/dicas-manutencao');
        const dicas = await Dica.find({ tipoVeiculo: 'geral' });
        res.json(dicas);
    } catch (error) {
        console.error('Erro ao buscar dicas gerais:', error);
        res.status(500).json({ error: 'Erro ao buscar dicas de manutenção' });
    }
});

// Endpoint para dicas específicas por tipo de veículo
app.get('/api/dicas-manutencao/:tipoVeiculo', async (req, res) => {
    const { tipoVeiculo } = req.params;
    const tipoNormalizado = tipoVeiculo.toLowerCase();
    
    console.log(`[Servidor] Requisição recebida para /api/dicas-manutencao/${tipoVeiculo}`);
    
    try {
        const dicas = await Dica.find({ tipoVeiculo: tipoNormalizado });
        
        if (dicas.length > 0) {
            res.json(dicas);
        } else {
            res.status(404).json({ error: `Nenhuma dica fofinha encontrada para o tipo: ${tipoVeiculo}` });
        }
    } catch (error) {
        console.error('Erro ao buscar dicas por tipo:', error);
        res.status(500).json({ error: 'Erro ao buscar dicas de manutenção' });
    }
});

// Endpoint para previsão do tempo
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

// --- NOVOS ENDPOINTS PARA DETALHES EXTRAS ---

// Endpoint para buscar detalhes extras de um veículo
app.get('/api/detalhes-extras/:veiculoId', async (req, res) => {
    const { veiculoId } = req.params;
    console.log(`[Servidor] Requisição para /api/detalhes-extras/${veiculoId}`);
    try {
        const detalhes = await DetalhesExtras.findOne({ veiculoId: veiculoId });
        if (detalhes) {
            res.json(detalhes);
        } else {
            // Se não achar, manda 404 pra avisar o front-end
            res.status(404).json({ message: 'Nenhum detalhe extra encontrado para este veículo.' });
        }
    } catch (error) {
        console.error('Erro ao buscar detalhes extras:', error);
        res.status(500).json({ error: 'Erro interno do servidor ao buscar detalhes extras' });
    }
});

// Endpoint para ATUALIZAR (ou CRIAR) detalhes extras de um veículo
app.put('/api/detalhes-extras/:veiculoId', async (req, res) => {
    const { veiculoId } = req.params;
    const dadosAtualizados = req.body;
    console.log(`[Servidor] Requisição PUT para /api/detalhes-extras/${veiculoId}`, dadosAtualizados);

    // Limpeza pra não salvar lixo
    delete dadosAtualizados._id;
    delete dadosAtualizados.veiculoId;

    try {
        // Opção 'upsert: true' cria o documento se ele não existir. Mágico!
        const options = { new: true, upsert: true, setDefaultsOnInsert: true };
        const detalhes = await DetalhesExtras.findOneAndUpdate(
            { veiculoId: veiculoId },
            { $set: dadosAtualizados },
            options
        );
        console.log("[Servidor] Detalhes salvos com sucesso:", detalhes);
        res.json(detalhes);
    } catch (error) {
        console.error('Erro ao atualizar detalhes extras:', error);
        res.status(500).json({ error: 'Erro interno do servidor ao atualizar detalhes extras' });
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