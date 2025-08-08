// db.js
require('dotenv').config();
const mongoose = require('mongoose');

const MONGODB_URL = process.env.MONGODB_URL;

if (!MONGODB_URL) {
  throw new Error('Por favor, defina a variável MONGODB_URL no arquivo .env');
}

async function connectDB() {
  try {
    await mongoose.connect(MONGODB_URL, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('Conectado ao MongoDB Atlas com sucesso!');
  } catch (error) {
    console.error('Erro na conexão com MongoDB:', error.message);
    process.exit(1); // Encerra o aplicativo com erro
  }
}

// Eventos de conexão
mongoose.connection.on('connected', () => {
  console.log('Mongoose conectado ao DB');
});

mongoose.connection.on('error', (err) => {
  console.log(`Erro na conexão do Mongoose: ${err}`);
});

mongoose.connection.on('disconnected', () => {
  console.log('Mongoose desconectado do DB');
});

// Para encerrar a conexão adequadamente
process.on('SIGINT', async () => {
  await mongoose.connection.close();
  console.log('Conexão com MongoDB encerrada devido ao término da aplicação');
  process.exit(0);
});

module.exports = connectDB;