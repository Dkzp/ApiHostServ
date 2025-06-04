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