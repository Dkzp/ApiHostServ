// Importações
import express from 'express';
import dotenv from 'dotenv';
import axios from 'axios';
import path from 'path'
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Carrega variáveis de ambiente do arquivo .env
dotenv.config();

// Inicializa o aplicativo Express
const app = express();
app.use(express.json())

const port = process.env.PORT || 3001; // Porta para o servidor backend
                                    // Use uma porta diferente do frontend se rodar ambos localmente
const apiKey = process.env.OPENWEATHER_API_KEY;

// Middleware para permitir que o frontend (rodando em outra porta) acesse este backend
// (CORS - Cross-Origin Resource Sharing)
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*'); // Em produção, restrinja para o seu domínio frontend
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
    next();
});

app.use(express.static(path.join(__dirname, "public")));

// ===================================================================
//      NOVOS DADOS E ENDPOINTS - ATIVIDADE B2.P1.A8
// ===================================================================

// 1. Simulação de "Banco de Dados" em memória (Arrays e Objetos)
// Estes são os dados que nosso próprio backend vai fornecer.

const dicasManutencaoGerais = [
    { id: 1, dica: "Verifique o nível do óleo regularmente. É como dar leitinho pro gatinho!" },
    { id: 2, dica: "Calibre os pneus semanalmente para um passeio mais macio." },
    { id: 3, dica: "Confira o fluido de arrefecimento (a 'aguinha' do carro)." },
    { id: 4, dica: "Mantenha os faróis e lanternas limpinhos para enxergar bem à noite." }
];

const dicasPorTipo = {
    // Usamos chaves em minúsculo para facilitar a busca
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
    // Adicionei moto para ter mais uma opção
    moto: [ 
        { id: 30, dica: "Lubrifique e ajuste a tensão da corrente a cada 500 km." },
        { id: 31, dica: "Verifique sempre os dois freios (dianteiro e traseiro) antes de sair." }
    ]
};

// 2. Implementação dos Novos Endpoints

// Endpoint para retornar TODAS as dicas de manutenção gerais
app.get('/api/dicas-manutencao', (req, res) => {
    console.log('[Servidor] Requisição recebida para /api/dicas-manutencao');
    res.json(dicasManutencaoGerais);
});

// Endpoint para retornar dicas POR TIPO de veículo
// :tipoVeiculo é um parâmetro de rota dinâmico
app.get('/api/dicas-manutencao/:tipoVeiculo', (req, res) => {
    // Pegamos o parâmetro da URL e convertemos para minúsculas
    const { tipoVeiculo } = req.params;
    const tipoNormalizado = tipoVeiculo.toLowerCase();
    
    console.log(`[Servidor] Requisição recebida para /api/dicas-manutencao/${tipoVeiculo}`);

    // Buscamos as dicas no nosso objeto 'dicasPorTipo'
    const dicas = dicasPorTipo[tipoNormalizado];

    if (dicas) {
        // Se encontrarmos, retornamos as dicas em JSON
        res.json(dicas);
    } else {
        // Se não existir, retornamos um status 404 (Not Found) com uma mensagem de erro
        res.status(404).json({ error: `Nenhuma dica fofinha encontrada para o tipo: ${tipoVeiculo}` });
    }
});


// ----- NOSSO PRIMEIRO ENDPOINT: Previsão do Tempo -----
app.get('/api/previsao/:cidade', async (req, res) => {
    const { cidade } = req.params; // Pega o parâmetro :cidade da URL

    if (!apiKey || apiKey === "SUA_CHAVE_OPENWEATHERMAP_AQUI") { // Verificação se a chave foi alterada do placeholder
        console.error('[Servidor] Chave da API OpenWeatherMap não configurada ou ainda é placeholder no arquivo .env.');
        return res.status(500).json({ error: 'Chave da API OpenWeatherMap não configurada corretamente no servidor.' });
    }
    if (!cidade) {
        return res.status(400).json({ error: 'Nome da cidade é obrigatório.' });
    }

    const weatherAPIUrl = `https://api.openweathermap.org/data/2.5/forecast?q=${cidade}&appid=${apiKey}&units=metric&lang=pt_br`;

    try {
        console.log(`[Servidor] Buscando previsão para: ${cidade}`);
        const apiResponse = await axios.get(weatherAPIUrl);
        console.log('[Servidor] Dados recebidos da OpenWeatherMap.');
        
        // Apenas para ver a estrutura completa da API no console do servidor pela primeira vez
        // console.log(JSON.stringify(apiResponse.data, null, 2));

        // Enviamos a resposta da API OpenWeatherMap diretamente para o nosso frontend
        res.json(apiResponse.data);

    } catch (error) {
        // Verifica se o erro tem uma resposta da API externa (axios)
        if (error.response) {
            console.error("[Servidor] Erro da API OpenWeatherMap:", error.response.data);
            res.status(error.response.status).json({ error: error.response.data.message || 'Erro ao buscar dados da OpenWeatherMap.' });
        } else if (error.request) {
            // A requisição foi feita mas não houve resposta
            console.error("[Servidor] Sem resposta da API OpenWeatherMap:", error.request);
            res.status(503).json({ error: 'Serviço da OpenWeatherMap indisponível ou sem resposta.' });
        } else {
            // Algo aconteceu ao configurar a requisição que acionou um erro
            console.error("[Servidor] Erro ao configurar requisição para OpenWeatherMap:", error.message);
            res.status(500).json({ error: 'Erro interno no servidor ao tentar buscar previsão.' });
        }
    }
});

// Inicia o servidor
app.listen(port, () => {
    console.log(`Servidor backend rodando em http://localhost:${port}`);
    if (!apiKey || apiKey === "SUA_CHAVE_OPENWEATHERMAP_AQUI") { // Verifica se a chave é placeholder
        console.warn("*************************************************************************************");
        console.warn("* ATENÇÃO: A chave da API OpenWeatherMap (OPENWEATHER_API_KEY) não foi configurada  *");
        console.warn("* corretamente no arquivo .env ou ainda está com o valor placeholder.             *");
        console.warn("* O endpoint de previsão do tempo NÃO FUNCIONARÁ até que isso seja corrigido.     *");
        console.warn("*************************************************************************************");
    } else {
        console.log("[Servidor] Chave da API OpenWeatherMap carregada com sucesso.");
    }
}); 