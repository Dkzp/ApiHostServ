// ==================================================
//      GERENCIAMENTO DA GARAGEM & PERSISTÊNCIA (LocalStorage)
// ==================================================

const backendUrl = 'http://localhost:3001'; // ATENÇÃO: Use a URL do seu Render aqui quando for publicar!
/** @type {Object.<string, CarroBase>} */
let garagem = {};
const GARAGEM_KEY = 'garagemData_v9_apis'; 

// Cache para a previsão do tempo
let previsaoProcessadaCompletaCache = null; 
let nomeCidadeCache = ""; 

// A CONSTANTE OPENWEATHERMAP_API_KEY FOI REMOVIDA DAQUI!
// A CHAVE AGORA ESTÁ SEGURA NO BACKEND (arquivo .env e server.js)

function salvarGaragem() {
    try {
        localStorage.setItem(GARAGEM_KEY, JSON.stringify(garagem));
        console.log(`Garagem salva no LocalStorage (Chave: ${GARAGEM_KEY}).`);
        return true;
    } catch (e) {
        if (e.name === 'QuotaExceededError' || e.name === 'NS_ERROR_DOM_QUOTA_REACHED') {
            console.error("ERRO DE QUOTA AO SALVAR: LocalStorage cheio! Provavelmente devido a imagens grandes.");
            alert("ERRO CRÍTICO AO SALVAR!\n\nO armazenamento local está cheio (provavelmente por causa de uma imagem grande).\nAs últimas alterações NÃO FORAM SALVAS.\n\nConsidere usar imagens menores ou remover itens.");
        } else {
            console.error("Erro inesperado ao salvar garagem:", e);
            alert("Ocorreu um erro inesperado ao salvar os dados da garagem.");
        }
        return false;
    }
}

function carregarGaragem() {
    const dataJSON = localStorage.getItem(GARAGEM_KEY);
    garagem = {};
    let carregouOk = false;

    if (dataJSON) {
        try {
            const garagemData = JSON.parse(dataJSON);
            for (const id in garagemData) {
                const d = garagemData[id];
                if (!d?.id || !d?.modelo || !d?.tipoVeiculo) {
                    console.warn(`Dados inválidos/incompletos para ID ${id} no LocalStorage. Pulando.`);
                    continue;
                }

                let veiculoInstance;
                const histRecriado = (d.historicoManutencao || [])
                    .map(m => (!m?.data || !m?.tipo) ? null : new Manutencao(m.data, m.tipo, m.custo, m.descricao))
                    .filter(m => m && m.validar());

                try {
                    const args = [d.id, d.modelo, d.cor, d.imagemSrc, d.placa, d.ano, d.dataVencimentoCNH];
                    switch (d.tipoVeiculo) {
                        case 'CarroEsportivo':
                            veiculoInstance = new CarroEsportivo(...args);
                            veiculoInstance.turboAtivado = d.turboAtivado || false;
                            break;
                        case 'Caminhao':
                            veiculoInstance = new Caminhao(...args, d.capacidadeCarga || 0);
                            veiculoInstance.cargaAtual = d.cargaAtual || 0;
                            break;
                        case 'CarroBase':
                        default:
                            veiculoInstance = new CarroBase(...args);
                            break;
                    }
                    veiculoInstance.velocidade = d.velocidade || 0;
                    veiculoInstance.ligado = d.ligado || false;
                    veiculoInstance.historicoManutencao = histRecriado;
                    garagem[id] = veiculoInstance;

                } catch (creationError) {
                    console.error(`Erro crítico ao recriar instância do veículo ${id}. Pulando.`, creationError, d);
                }
            }
            console.log("Garagem carregada do LocalStorage.");
            carregouOk = true;
        } catch (e) {
            console.error("Erro ao parsear ou processar dados da garagem do LocalStorage:", e);
            alert("Erro ao carregar dados salvos. Resetando para garagem padrão.");
            localStorage.removeItem(GARAGEM_KEY);
            garagem = {};
        }
    }

    if (!carregouOk || Object.keys(garagem).length === 0) { 
        console.log("Nenhum dado válido encontrado, garagem vazia ou erro. Inicializando com veículos padrão.");
        inicializarVeiculosPadrao();
    } else {
        atualizarInterfaceCompleta();
    }
}

function inicializarVeiculosPadrao() {
    garagem = {};
    console.log("Criando veículos padrão...");
    garagem['carro1'] = new CarroBase("carro1", "Fusca", "Azul", null, "ABC1234", 1975, "2024-12-31");
    garagem['carro2'] = new CarroEsportivo("carro2", "Maverick", "Laranja", null, "DEF5678", 1974, "2025-06-01");
    garagem['cam1'] = new Caminhao("cam1", "Scania 113", "Vermelho", null, "GHI9012", 1995, "2023-01-10", 20000);

    garagem['carro1']?.adicionarManutencao(new Manutencao('2023-11-15T10:00:00Z', 'Troca Pneu', 250));
    console.log("Veículos padrão criados em memória.");
    if (!salvarGaragem()) {
        console.warn("Falha ao salvar a garagem padrão inicial.");
    }
    atualizarInterfaceCompleta();
}

// ==================================================
//      ATUALIZAÇÃO DA INTERFACE GERAL (UI)
// ==================================================
function atualizarInterfaceCompleta() {
    console.log("Atualizando interface completa...");
    atualizarMenuVeiculos();
    atualizarExibicaoAgendamentosFuturos();
    verificarVencimentoCNH();
    verificarAgendamentosProximos();

    const veiculosIds = Object.keys(garagem);
    const displayArea = document.getElementById('veiculo-display-area');
    const idVeiculoAtual = displayArea?.dataset.veiculoId;

    if (veiculosIds.length === 0) {
        limparAreaDisplay(true);
    } else {
        if (idVeiculoAtual && garagem[idVeiculoAtual]) {
             marcarBotaoAtivo(idVeiculoAtual);
             if (displayArea.querySelector('.veiculo-renderizado')) {
                 garagem[idVeiculoAtual].atualizarInformacoesUI("Atualização Completa");
             } else {
                 renderizarVeiculo(idVeiculoAtual);
             }
        } else {
             const primeiroId = veiculosIds[0] || null;
             if(primeiroId){
                marcarBotaoAtivo(primeiroId);
                renderizarVeiculo(primeiroId);
             } else {
                limparAreaDisplay(true);
             }
        }
    }
    console.log("Interface completa atualizada.");
}

function limparAreaDisplay(mostrarMsgGaragemVazia = false) {
    const displayArea = document.getElementById('veiculo-display-area');
    if (displayArea) {
        const msg = mostrarMsgGaragemVazia ?
            '<div class="placeholder"><i class="fa-solid fa-warehouse"></i> Garagem vazia. Adicione um veículo!</div>' :
            '<div class="placeholder"><i class="fa-solid fa-hand-pointer"></i> Selecione um veículo no menu acima.</div>';
        displayArea.innerHTML = msg;
        delete displayArea.dataset.veiculoId;
    }
}

function atualizarMenuVeiculos() {
    const menu = document.getElementById('menu-veiculos');
    if (!menu) return;
    menu.innerHTML = '';
    const ids = Object.keys(garagem);

    if (ids.length === 0) {
        menu.innerHTML = '<span class="empty-placeholder">Sua garagem está vazia <i class="fa-regular fa-face-sad-tear"></i></span>';
        return;
    }
    ids.sort((a, b) => (garagem[a]?.modelo || '').localeCompare(garagem[b]?.modelo || ''));
    ids.forEach(id => {
        const v = garagem[id];
        if (v) {
            const btn = document.createElement('button');
            btn.textContent = v.modelo || `Veículo ${id}`;
            btn.dataset.veiculoId = id;
            btn.title = `${v.modelo || '?'} (${v.placa || 'S/P'}) - ${v.ano || '?'}`;
            btn.addEventListener('click', () => {
                marcarBotaoAtivo(id);
                renderizarVeiculo(id);
            });
            menu.appendChild(btn);
        }
    });
}

function marcarBotaoAtivo(id) {
    document.querySelectorAll('#menu-veiculos button').forEach(b => {
        b.classList.toggle('veiculo-ativo', b.dataset.veiculoId === id);
    });
}

// ==================================================
//       RENDERIZAÇÃO DINÂMICA DO VEÍCULO (Template)
// ==================================================
function renderizarVeiculo(veiculoId) {
    const veiculo = garagem[veiculoId];
    const displayArea = document.getElementById('veiculo-display-area');
    const template = document.getElementById('veiculo-template');

    if (!veiculo || !displayArea || !template || !(template instanceof HTMLTemplateElement)) {
        console.error(`Erro ao tentar renderizar ${veiculoId}: Pré-requisitos inválidos.`);
        limparAreaDisplay();
        return;
    }
    console.log(`Renderizando veículo: ${veiculo.modelo} (ID: ${veiculoId})`);
    const clone = template.content.cloneNode(true);
    const container = clone.querySelector('.veiculo-renderizado');
    if (!container) {
         console.error("Estrutura do #veiculo-template inválida.");
         return;
    }
    container.dataset.templateId = veiculoId; 

    container.querySelectorAll('.acoes-veiculo button[data-acao]').forEach(btn => {
        const acao = btn.dataset.acao;
        if (acao && !['ativarTurbo', 'carregar'].includes(acao)) {
             btn.addEventListener('click', () => interagirVeiculoAtual(acao));
        }
    });

    container.querySelector('.btn-excluir-veiculo')?.addEventListener('click', () => handleExcluirVeiculo(veiculoId));
    container.querySelector('.salvar-veiculo-btn')?.addEventListener('click', () => handleSalvarEdicaoVeiculo(veiculoId));
    container.querySelector('.btn-limpar-historico')?.addEventListener('click', () => handleLimparHistorico(veiculoId));
    container.querySelector('.form-agendamento')?.addEventListener('submit', (e) => handleAgendarManutencao(e, veiculoId));

    const btnDetalhes = container.querySelector('.btn-detalhes-extras');
    const areaDetalhes = container.querySelector('.detalhes-extras-area');
    if (btnDetalhes && areaDetalhes) {
        btnDetalhes.addEventListener('click', async () => {
            areaDetalhes.innerHTML = '<p><i class="fa-solid fa-spinner fa-spin"></i> Carregando detalhes...</p>';
            btnDetalhes.disabled = true;
            try {
                const detalhes = await buscarDetalhesVeiculoAPI(veiculoId); 
                if (detalhes) {
                    let htmlDetalhes = '<ul>';
                    for (const chave in detalhes) {
                        if (chave !== 'id') {
                            let valor = detalhes[chave];
                            if (chave === 'valorFIPE' && typeof valor === 'number') {
                                valor = `R$ ${valor.toFixed(2).replace('.', ',')}`;
                            } else if (chave === 'recallPendente' && typeof valor === 'boolean') {
                                valor = valor ? '<strong style="color:red;">Sim</strong>' : 'Não';
                            } else if (chave === 'proximaRevisaoRecomendada') {
                                const dataRec = new Date(valor + 'T00:00:00Z');
                                if (!isNaN(dataRec.getTime())) {
                                    valor = dataRec.toLocaleDateString('pt-BR', { timeZone: 'UTC' });
                                }
                            }
                            const chaveFormatada = chave.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
                            htmlDetalhes += `<li><strong>${chaveFormatada}:</strong> ${valor || '-'}</li>`;
                        }
                    }
                    htmlDetalhes += '</ul>';
                    if (detalhes.motivoRecall) {
                        htmlDetalhes += `<p class="recall-info"><i class="fa-solid fa-triangle-exclamation"></i> Motivo Recall: ${detalhes.motivoRecall}</p>`;
                    }
                    areaDetalhes.innerHTML = htmlDetalhes;
                } else {
                    areaDetalhes.innerHTML = '<p><i class="fa-regular fa-circle-xmark"></i> Detalhes extras não encontrados ou erro na consulta.</p>';
                }
            } catch (error) {
                console.error("Erro no listener do botão de detalhes (API Sim):", error);
                areaDetalhes.innerHTML = '<p><i class="fa-solid fa-bomb"></i> Ocorreu um erro inesperado ao processar os detalhes.</p>';
            } finally {
                 btnDetalhes.disabled = false;
            }
        });
    }

    const editImgInput = container.querySelector('.edit-imagem-input');
    const editImgPreview = container.querySelector('.edit-imagem-preview');
    if (editImgInput && editImgPreview) {
        editImgInput.addEventListener('change', (event) => {
            const file = event.target.files[0];
            if (file && file.type.startsWith("image/")) {
                const reader = new FileReader();
                reader.onload = (e) => {
                    editImgPreview.src = e.target.result;
                    editImgPreview.style.display = 'block';
                };
                reader.onerror = () => { editImgPreview.src = '#'; editImgPreview.style.display = 'none'; };
                reader.readAsDataURL(file);
            } else { editImgPreview.src = '#'; editImgPreview.style.display = 'none'; }
        });
    }

    const acaoExtraEl = container.querySelector('.acao-extra');
    if (acaoExtraEl) {
        acaoExtraEl.innerHTML = '';
        if (veiculo instanceof CarroEsportivo) {
            const btn = document.createElement('button');
            btn.dataset.acao = 'ativarTurbo';
            btn.innerHTML = `<i class="fa-solid fa-bolt"></i> Turbo`; 
            btn.title = "Ativar/Desativar Turbo";
            btn.classList.add('btn-turbo');
            btn.addEventListener('click', () => interagirVeiculoAtual('ativarTurbo'));
            acaoExtraEl.appendChild(btn);
        } else if (veiculo instanceof Caminhao) {
            const div = document.createElement('div');
            div.className = 'carga-container';
            const inputId = `carga-input-${veiculoId}`;
            div.innerHTML = `
                <label for="${inputId}" style="margin-bottom:0; color: #ecf0f1;">Carga(kg):</label>
                <input type="number" min="1" id="${inputId}" class="carga-input" placeholder="Ex: 500">
                <button data-acao="carregar" title="Adicionar Carga"><i class="fa-solid fa-truck-ramp-box"></i> Carregar</button>`;
            const cargaBtn = div.querySelector('button[data-acao="carregar"]');
            const inputCarga = div.querySelector('input.carga-input');
            if (cargaBtn && inputCarga) {
                cargaBtn.addEventListener('click', () => interagirVeiculoAtual('carregar', inputCarga));
                inputCarga.addEventListener('keypress', (e) => { if(e.key === 'Enter') interagirVeiculoAtual('carregar', inputCarga); });
            }
            acaoExtraEl.appendChild(div);
        }
    }

    displayArea.innerHTML = '';
    displayArea.appendChild(clone);
    displayArea.dataset.veiculoId = veiculoId;
    veiculo.atualizarInformacoesUI("Renderização Completa");
}

// ==================================================
//       INTERAÇÃO COM O VEÍCULO ATUALMENTE EXIBIDO
// ==================================================
function interagirVeiculoAtual(acao, extraElement = null) {
    const displayArea = document.getElementById('veiculo-display-area');
    const veiculoId = displayArea?.dataset.veiculoId;
    if (veiculoId && garagem[veiculoId]) {
        if (acao === 'carregar' && extraElement instanceof HTMLInputElement) {
            interagir(veiculoId, acao, extraElement.value);
            extraElement.value = '';
        } else {
            interagir(veiculoId, acao);
        }
    } else {
        alert("Por favor, selecione um veículo válido primeiro.");
    }
}

function interagir(veiculoId, acao, arg = null) {
    const v = garagem[veiculoId];
    if (!v) return;
    console.log(`Interagir: Ação=${acao}, Veículo=${veiculoId} (${v.modelo}), Arg=${arg}`);
    try {
        switch (acao) {
            case 'ligar': v.ligar(); break;
            case 'desligar': v.desligar(); break;
            case 'acelerar': v.acelerar(); break;
            case 'frear': v.frear(); break;
            case 'buzinar': v.buzinar(); break;
            case 'ativarTurbo':
                if (v instanceof CarroEsportivo) v.ativarTurbo();
                else v.notificarUsuario("Ação 'Turbo' apenas para Carros Esportivos.");
                break;
            case 'carregar':
                if (v instanceof Caminhao) v.carregar(arg);
                else v.notificarUsuario("Ação 'Carregar' apenas para Caminhões.");
                break;
            default:
                if (!['buscar-detalhes', 'salvar-edicao', 'excluir'].includes(acao)) {
                    console.warn(`Ação desconhecida ou não manipulada centralmente: ${acao}`);
                }
        }
    } catch (e) {
        console.error(`Erro ao executar ação '${acao}' no veículo ${veiculoId}:`, e);
        alert(`Ocorreu um erro ao tentar ${acao}. Verifique o console.`);
    }
}

// ==================================================
//          HANDLERS DE EVENTOS GLOBAIS / FORMULÁRIOS
// ==================================================
function handleTrocarAba(abaId) {
    document.querySelectorAll('.secao-principal').forEach(s => s.classList.remove('ativa'));
    document.querySelectorAll('#abas-navegacao button').forEach(b => b.classList.remove('aba-ativa'));
    const secaoId = abaId === 'tab-garagem' ? 'secao-garagem' : 'secao-adicionar';
    document.getElementById(secaoId)?.classList.add('ativa');
    document.getElementById(abaId)?.classList.add('aba-ativa');
}

function handleAdicionarVeiculo(event) {
    event.preventDefault();
    const form = event.target;
    const mod = form.querySelector('#add-modelo').value.trim();
    const cor = form.querySelector('#add-cor').value.trim();
    const plc = form.querySelector('#add-placa').value.trim().toUpperCase();
    const ano = form.querySelector('#add-ano').value;
    const tipo = form.querySelector('#add-tipo').value;
    const capIn = form.querySelector('#add-capacidade-carga');
    const capCg = (tipo === 'Caminhao' && capIn) ? capIn.value : 0;
    const dtCnh = form.querySelector('#add-cnh').value;
    const imgInput = form.querySelector('#add-imagem-input');
    const imgPreview = document.getElementById('add-imagem-preview');

    if (!mod || !tipo) { alert("Modelo e Tipo são obrigatórios!"); return; }

    const nId = `v${Date.now()}`;
    let nV;

    const criarEAdicionarVeiculo = (imagemSrc = null) => {
        try {
            let imgFinal = imagemSrc;
            if (!imgFinal) {
                switch (tipo) {
                    case 'CarroEsportivo': imgFinal = 'default_sport.png'; break;
                    case 'Caminhao': imgFinal = 'default_truck.png'; break;
                    default: imgFinal = 'default_car.png'; break;
                }
            }
            const args = [nId, mod, cor, imgFinal, plc, ano, dtCnh || null];
            switch (tipo) {
                case 'CarroEsportivo': nV = new CarroEsportivo(...args); break;
                case 'Caminhao': nV = new Caminhao(...args, capCg); break;
                default: nV = new CarroBase(...args); break;
            }
            garagem[nId] = nV;
            if (salvarGaragem()) {
                atualizarMenuVeiculos();
                form.reset();
                document.getElementById('add-capacidade-carga-container').style.display = 'none';
                if(imgPreview) { imgPreview.src='#'; imgPreview.style.display='none'; }
                if(imgInput) imgInput.value = '';
                handleTrocarAba('tab-garagem');
                marcarBotaoAtivo(nId);
                renderizarVeiculo(nId);
                alert(`Veículo "${mod}" adicionado com sucesso!`);
            } else {
                delete garagem[nId]; 
            }
        } catch (e) {
            console.error("Erro ao criar ou adicionar veículo:", e);
            alert("Erro ao adicionar veículo. Verifique os dados e o console.");
            if (garagem[nId]) delete garagem[nId];
        }
    };

    const file = imgInput?.files[0];
    if (file && file.type.startsWith("image/")) {
        const reader = new FileReader();
        reader.onload = (e) => criarEAdicionarVeiculo(e.target.result);
        reader.onerror = () => {
            alert("Houve um erro ao processar a imagem. O veículo será adicionado com a imagem padrão.");
            criarEAdicionarVeiculo(null);
        };
        reader.readAsDataURL(file);
    } else {
        criarEAdicionarVeiculo(null);
    }
}

function handleSalvarEdicaoVeiculo(veiculoId) {
    const v = garagem[veiculoId];
    const display = document.getElementById('veiculo-display-area');
    if (!v || !display || display.dataset.veiculoId !== v.id) {
        alert("Erro: Não foi possível identificar o veículo para salvar."); return;
    }
    const form = display.querySelector('.edicao-veiculo');
    if (!form) { alert("Erro: Formulário de edição não encontrado."); return; }

    console.log(`Iniciando salvamento de edições para ${veiculoId}`);
    let algumaMudancaDetectada = false;

    const novoModelo = form.querySelector('.edit-modelo-veiculo').value.trim();
    const novaCor = form.querySelector('.edit-cor-veiculo').value.trim();
    const novaPlaca = form.querySelector('.edit-placa-veiculo').value.trim().toUpperCase();
    const novoAno = parseInt(form.querySelector('.edit-ano-veiculo').value) || null;
    const novaCnhString = form.querySelector('.edit-cnh-veiculo').value;
    let novaCnhDate = null;
    if (novaCnhString) {
        novaCnhDate = new Date(novaCnhString + 'T00:00:00Z');
        if (isNaN(novaCnhDate.getTime())) novaCnhDate = null;
    }

    if (novoModelo && v.modelo !== novoModelo) { v.modelo = novoModelo; algumaMudancaDetectada = true; }
    if (v.cor !== novaCor) { v.cor = novaCor; algumaMudancaDetectada = true; }
    if (v.placa !== novaPlaca) { v.placa = novaPlaca; algumaMudancaDetectada = true; }
    if (v.ano !== novoAno) { v.ano = novoAno; algumaMudancaDetectada = true; }
    const cnhAtualTimestamp = v.dataVencimentoCNH instanceof Date ? v.dataVencimentoCNH.getTime() : null;
    const cnhNovaTimestamp = novaCnhDate instanceof Date ? novaCnhDate.getTime() : null;
    if (cnhAtualTimestamp !== cnhNovaTimestamp) {
         v.dataVencimentoCNH = novaCnhDate; algumaMudancaDetectada = true;
    }

    const imagemInput = form.querySelector('.edit-imagem-input');
    const file = imagemInput?.files[0];

    const limparCamposImagemEdicao = () => {
         if(imagemInput) imagemInput.value = '';
         const p = form.querySelector('.edit-imagem-preview');
         if(p){ p.src='#'; p.style.display='none'; }
    };

    const tentarSalvarEAtualizarUI = (origemSalvar = "Edição") => {
        if (salvarGaragem()) {
            v.atualizarInformacoesUI(origemSalvar);
            atualizarMenuVeiculos();
            verificarVencimentoCNH(); 
            alert("Alterações salvas com sucesso!");
            limparCamposImagemEdicao();
            return true;
        }
        return false;
    };

    if (file && file.type.startsWith("image/")) {
        const reader = new FileReader();
        reader.onload = function(e) {
            const novaImagemBase64 = e.target.result;
            if (v.imagemSrc !== novaImagemBase64) {
                const imagemAntiga = v.imagemSrc;
                v.imagemSrc = novaImagemBase64;
                algumaMudancaDetectada = true;
                if (!tentarSalvarEAtualizarUI("Edição c/ Img")) { 
                    v.imagemSrc = imagemAntiga; 
                    algumaMudancaDetectada = (v.modelo !== novoModelo || v.cor !== novaCor || v.placa !== novaPlaca || v.ano !== novoAno || cnhAtualTimestamp !== cnhNovaTimestamp);
                    if (algumaMudancaDetectada) { 
                        tentarSalvarEAtualizarUI("Edição s/ Img (Falha Img)");
                    } else {
                        v.atualizarInformacoesUI("Falha Salvar Img");
                    }
                }
            } else { 
                if (algumaMudancaDetectada) tentarSalvarEAtualizarUI("Edição s/ Img");
                else { alert("Nenhuma alteração detectada."); limparCamposImagemEdicao(); }
            }
        };
        reader.onerror = function() { alert("Erro ao ler imagem. Nenhuma alteração salva."); limparCamposImagemEdicao(); };
        reader.readAsDataURL(file);
    } else if (algumaMudancaDetectada) {
        tentarSalvarEAtualizarUI("Edição s/ Img");
    } else {
        alert("Nenhuma alteração detectada.");
        limparCamposImagemEdicao();
    }
}

function handleAgendarManutencao(event, veiculoId) {
    event.preventDefault();
    const v = garagem[veiculoId];
    if (!v) return;
    const form = event.target;
    const dataInput = form.querySelector('.agendamento-data');
    const horaInput = form.querySelector('.agendamento-hora');
    const tipoInput = form.querySelector('.agendamento-tipo');

    if (!dataInput || !tipoInput || !dataInput.value || !tipoInput.value.trim()) {
        alert('Data e Tipo de Serviço são obrigatórios!'); return;
    }
    const dataStr = dataInput.value;
    const horaStr = horaInput?.value || '00:00';
    const tipoStr = tipoInput.value.trim();
    const custoStr = form.querySelector('.agendamento-custo')?.value;
    const obsStr = form.querySelector('.agendamento-obs')?.value.trim();
    const dataHoraCompleta = new Date(`${dataStr}T${horaStr}`);

    if (isNaN(dataHoraCompleta.getTime())) { alert('Data ou Hora inválida!'); return; }

    const novaManutencao = new Manutencao(dataHoraCompleta, tipoStr, custoStr, obsStr);
    if (v.adicionarManutencao(novaManutencao)) {
        alert('Manutenção adicionada/agendada com sucesso!');
        form.reset();
    }
}

function handleLimparHistorico(veiculoId) {
    const v = garagem[veiculoId];
    if (!v) return;
    if (confirm(`Tem certeza que deseja APAGAR TODO o histórico de ${v.modelo}?\nEsta ação NÃO pode ser desfeita.`)) {
        v.limparHistoricoManutencao();
        alert(`Histórico de ${v.modelo} limpo.`);
    }
}

function handleExcluirVeiculo(veiculoId) {
    const v = garagem[veiculoId];
    if (!v) return;
    if (confirm(`EXCLUIR PERMANENTEMENTE "${v.modelo}"?\nTODOS OS DADOS SERÃO PERDIDOS.`)) {
        const modeloExcluido = v.modelo;
        delete garagem[veiculoId];
        if (salvarGaragem()) {
            atualizarInterfaceCompleta();
            alert(`"${modeloExcluido}" foi excluído.`);
        } else {
            alert("ERRO GRAVE: Não foi possível salvar a exclusão. O veículo pode reaparecer.");
        }
    }
}

// ==================================================
//      ALERTAS E VISUALIZAÇÕES GERAIS
// ==================================================
function atualizarExibicaoAgendamentosFuturos() {
    const divLista = document.getElementById('agendamentos-futuros-lista');
    if (!divLista) return;
    const agora = new Date();
    let todosAgendamentos = [];
    Object.values(garagem).forEach(v => {
        (v.historicoManutencao || [])
            .filter(m => m instanceof Manutencao && m.data instanceof Date && !isNaN(m.data) && m.data > agora)
            .forEach(m => todosAgendamentos.push({ manutencao: m, veiculoModelo: v.modelo, veiculoId: v.id }));
    });
    todosAgendamentos.sort((a, b) => a.manutencao.data.getTime() - b.manutencao.data.getTime());
    if (todosAgendamentos.length > 0) {
        const listaHtml = todosAgendamentos.map(item =>
            `<li title="Clique para ver ${item.veiculoModelo}" data-link-veiculo="${item.veiculoId}">
               <strong>${item.veiculoModelo}:</strong> ${item.manutencao.formatarComHora()}
             </li>`
        ).join('');
        divLista.innerHTML = `<ul>${listaHtml}</ul>`;
        divLista.querySelector('ul')?.addEventListener('click', handleCliqueLinkVeiculo);
    } else {
        divLista.innerHTML = '<p>Nenhum agendamento futuro encontrado.</p>';
    }
}

function verificarAgendamentosProximos() {
    const areaNotif = document.getElementById('notificacoes-area');
    if (!areaNotif) return;
    const agora = new Date();
    const inicioHoje = new Date(agora); inicioHoje.setHours(0, 0, 0, 0);
    const fimDeAmanha = new Date(agora); fimDeAmanha.setDate(agora.getDate() + 1); fimDeAmanha.setHours(23, 59, 59, 999);
    let notificacoes = [];
    Object.values(garagem).forEach(v => {
        (v.historicoManutencao || [])
            .filter(m => m instanceof Manutencao && m.data instanceof Date && !isNaN(m.data) &&
                          m.data >= inicioHoje && m.data <= fimDeAmanha)
            .forEach(m => {
                const ehHoje = m.data.toDateString() === agora.toDateString();
                const prefixo = ehHoje ? "🚨 HOJE" : "🗓️ Amanhã";
                const horaFormatada = m.data.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
                notificacoes.push({
                    html: `<li title="Clique para ver ${v.modelo}" data-link-veiculo="${v.id}">${prefixo}: <strong>${v.modelo}</strong> - ${m.tipo} às ${horaFormatada}</li>`,
                    ehHoje: ehHoje, data: m.data
                });
            });
    });
    notificacoes.sort((a, b) => {
        if (a.ehHoje !== b.ehHoje) return a.ehHoje ? -1 : 1;
        return a.data.getTime() - b.data.getTime();
    });
    if (notificacoes.length > 0) {
        areaNotif.innerHTML = `<h4><i class="fa-solid fa-bell fa-shake" style="color: #ffc107;"></i> Alertas Manutenção Próxima</h4><ul>${notificacoes.map(n => n.html).join('')}</ul>`;
        areaNotif.style.display = 'block';
        areaNotif.querySelector('ul')?.addEventListener('click', handleCliqueLinkVeiculo);
    } else {
        areaNotif.innerHTML = ''; areaNotif.style.display = 'none';
    }
}

function verificarVencimentoCNH() {
    const areaCnh = document.getElementById('cnh-alertas-area');
    if (!areaCnh) return;
    const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
    let alertasCnh = [];
    Object.values(garagem).forEach(v => {
        if (v.dataVencimentoCNH instanceof Date && !isNaN(v.dataVencimentoCNH.getTime())) {
            const dataVenc = v.dataVencimentoCNH;
            const diffTime = dataVenc.getTime() - hoje.getTime();
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            const dataFormatada = dataVenc.toLocaleDateString('pt-BR', { timeZone: 'UTC' });
            let statusHtml = ''; let prioridade = 3;
            if (diffDays < 0) {
                statusHtml = `<span class="cnh-status cnh-vencida">VENCIDA (${dataFormatada})!</span>`; prioridade = 1;
            } else if (diffDays <= 30) {
                statusHtml = `<span class="cnh-status cnh-vence-breve">Vence em ${diffDays}d (${dataFormatada})!</span>`; prioridade = 2;
            }
            if (statusHtml) {
                alertasCnh.push({
                    html: `<li title="Clique para ver ${v.modelo}" data-link-veiculo="${v.id}"><strong>${v.modelo} (${v.placa || 'S/P'}):</strong> CNH ${statusHtml}</li>`,
                    prioridade: prioridade, diffDays: diffDays
                });
            }
        }
    });
    alertasCnh.sort((a, b) => {
        if (a.prioridade !== b.prioridade) return a.prioridade - b.prioridade;
        return a.diffDays - b.diffDays;
    });
    if (alertasCnh.length > 0) {
        areaCnh.innerHTML = `<h4><i class="fa-solid fa-id-card-clip"></i> Alertas de CNH</h4><ul>${alertasCnh.map(a => a.html).join('')}</ul>`;
        areaCnh.style.display = 'block';
        areaCnh.querySelector('ul')?.addEventListener('click', handleCliqueLinkVeiculo);
    } else {
        areaCnh.innerHTML = ''; areaCnh.style.display = 'none';
    }
}

function handleCliqueLinkVeiculo(event) {
    const targetLi = event.target.closest('li[data-link-veiculo]');
    if (targetLi) {
        const veiculoId = targetLi.dataset.linkVeiculo;
        if (garagem[veiculoId]) {
            handleTrocarAba('tab-garagem');
            marcarBotaoAtivo(veiculoId);
            renderizarVeiculo(veiculoId);
            document.getElementById('veiculo-display-area')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
    }
}

// ==================================================
//      BUSCA DADOS EXTERNOS (API SIMULADA - JSON local)
// ==================================================
async function buscarDetalhesVeiculoAPI(identificadorVeiculo) {
    console.log(`Buscando detalhes para ID: ${identificadorVeiculo} na API simulada...`);
    const caminhoAPI = './dados_veiculos_api.json';
    try {
        const response = await fetch(caminhoAPI);
        if (!response.ok) {
            console.error(`Erro HTTP (${caminhoAPI}): ${response.status} ${response.statusText}`);
            return null;
        }
        const dadosTodosVeiculos = await response.json();
        if (!Array.isArray(dadosTodosVeiculos)) {
             console.error(`Erro: ${caminhoAPI} não contém um array JSON.`); return null;
        }
        const detalhes = dadosTodosVeiculos.find(v => v && v.id === identificadorVeiculo);
        if (detalhes) {
            console.log(`Detalhes (simulado) encontrados para ${identificadorVeiculo}:`, detalhes);
            return detalhes;
        } else {
            console.log(`Nenhum detalhe (simulado) encontrado para ${identificadorVeiculo}.`);
            return null;
        }
    } catch (error) {
        console.error(`Erro ao buscar/processar dados da API simulada (${caminhoAPI}):`, error);
        return null;
    }
}

// ==================================================
//      BUSCA DADOS EXTERNOS (AGORA VIA NOSSO BACKEND)
// ==================================================

/**
 * @async
 * @function buscarPrevisaoDetalhada
 * @description Busca a previsão do tempo detalhada para uma cidade através do nosso backend.
 * @param {string} cidade - O nome da cidade para a previsão.
 * @returns {Promise<object>} Um objeto com os dados da previsão da API.
 * @throws {Error} Lança um erro se a busca falhar ou a cidade não for fornecida.
 */
async function buscarPrevisaoDetalhada(cidade) {
    if (!cidade) {
        console.error("[Frontend] Cidade é obrigatória para buscar previsão detalhada.");
        throw new Error("Por favor, informe a cidade."); 
    }

    const cidadeCodificada = encodeURIComponent(cidade);
    // A URL agora aponta para o seu servidor backend e usa a variável global
    const urlAPI = `${backendUrl}/api/previsao/${cidadeCodificada}`;
    
    console.log(`[Frontend] Buscando previsão detalhada para: ${cidade} em ${urlAPI}`);

    try {
        const response = await fetch(urlAPI);

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({})); 
            // A mensagem de erro agora vem do nosso backend, ex: errorData.error
            const mensagemErro = errorData.error || `Erro ${response.statusText} (${response.status}) ao buscar previsão no servidor.`;
            console.error(`[Frontend] Erro do backend (${response.status}): ${mensagemErro}`);
            throw new Error(mensagemErro); // Esta mensagem será exibida na UI
        }
        
        const data = await response.json(); 
        console.log("[Frontend] Dados da previsão detalhada recebidos do backend:", data);
        return data; 

    } catch (error) { 
        console.error("[Frontend] Erro na requisição fetch ou processamento da previsão detalhada:", error.message);
        // Repassa o erro com a mensagem já formatada (seja do fetch ou do nosso throw acima)
        throw error; 
    }
}


/**
 * @function processarDadosForecast
 * @description Processa os dados brutos da API de forecast, agrupando por dia e resumindo as informações.
 * @param {object} data - O objeto JSON completo retornado pela API de forecast (via nosso backend).
 * @returns {Array<object>|null} Um array de objetos, onde cada objeto representa um dia com dados resumidos
 */
function processarDadosForecast(data) {
    if (!data || !data.list || !Array.isArray(data.list) || data.list.length === 0) {
        console.warn("[Frontend] Dados de forecast inválidos ou vazios para processamento recebidos do backend.");
        return null;
    }

    const previsaoPorDia = {};

    data.list.forEach(item => {
        const dia = item.dt_txt.split(' ')[0]; 

        if (!previsaoPorDia[dia]) {
            previsaoPorDia[dia] = {
                temps: [],
                weatherEntries: [], 
                dt_unix_list: []  
            };
        }
        previsaoPorDia[dia].temps.push(item.main.temp);
        previsaoPorDia[dia].weatherEntries.push({
            icon: item.weather[0].icon,
            description: item.weather[0].description,
            dt_txt: item.dt_txt 
        });
        previsaoPorDia[dia].dt_unix_list.push(item.dt);
    });

    const previsaoDiariaResumida = [];
    for (const diaStr in previsaoPorDia) {
        const dadosDoDia = previsaoPorDia[diaStr];
        const temp_min = Math.min(...dadosDoDia.temps);
        const temp_max = Math.max(...dadosDoDia.temps);

        let iconeRep = dadosDoDia.weatherEntries[0].icon;
        let descricaoRep = dadosDoDia.weatherEntries[0].description;

        const entradaMeioDia = dadosDoDia.weatherEntries.find(entry => entry.dt_txt.includes("12:00:00"));
        if (entradaMeioDia) {
            iconeRep = entradaMeioDia.icon;
            descricaoRep = entradaMeioDia.description;
        } else {
            // Se não houver entrada às 12:00, pega a entrada mais próxima do meio-dia ou a central
            const entradaMaisProximaMeioDia = dadosDoDia.weatherEntries.reduce((prev, curr) => {
                const horaPrev = parseInt(prev.dt_txt.split(' ')[1].split(':')[0]);
                const horaCurr = parseInt(curr.dt_txt.split(' ')[1].split(':')[0]);
                return (Math.abs(horaCurr - 12) < Math.abs(horaPrev - 12) ? curr : prev);
            });
            iconeRep = entradaMaisProximaMeioDia.icon;
            descricaoRep = entradaMaisProximaMeioDia.description;
        }
        
        previsaoDiariaResumida.push({
            data: diaStr,
            temp_min: parseFloat(temp_min.toFixed(1)),
            temp_max: parseFloat(temp_max.toFixed(1)),
            descricao: descricaoRep.charAt(0).toUpperCase() + descricaoRep.slice(1),
            icone: iconeRep
        });
    }
    previsaoDiariaResumida.sort((a,b) => new Date(a.data) - new Date(b.data)); // Garante ordem cronológica
    
    return previsaoDiariaResumida;
}

/**
 * Filtra a previsão do tempo armazenada em cache para um número específico de dias e a exibe.
 * Atualiza o estado ativo dos botões de filtro.
 * @param {number|string} numeroDeDias - O número de dias para exibir (1, 3, 5).
 * @param {HTMLElement} areaResultado - O elemento HTML onde a previsão será exibida.
 */
function aplicarFiltroEExibirPrevisao(numeroDeDias, areaResultado) {
    if (!previsaoProcessadaCompletaCache || !areaResultado) {
        console.warn("[Frontend] Cache de previsão ou área de resultado não disponíveis para aplicar filtro.");
        if (areaResultado) areaResultado.innerHTML = "<p>Dados de previsão não carregados para filtrar.</p>";
        const divControlesPrevisao = document.getElementById('controles-previsao');
        if (divControlesPrevisao) divControlesPrevisao.style.display = 'none';
        return;
    }

    const diasParaExibirReq = parseInt(numeroDeDias);
    let previsaoFiltrada;
    let numDiasStringParaComparacao = numeroDeDias.toString();


    if (isNaN(diasParaExibirReq) || diasParaExibirReq <= 0) {
        previsaoFiltrada = previsaoProcessadaCompletaCache; // Mostra tudo se inválido
        numDiasStringParaComparacao = previsaoProcessadaCompletaCache.length.toString(); 
    } else if (diasParaExibirReq > previsaoProcessadaCompletaCache.length) {
        previsaoFiltrada = previsaoProcessadaCompletaCache; // Mostra tudo se pedir mais do que tem
        numDiasStringParaComparacao = previsaoProcessadaCompletaCache.length.toString();
    } else {
        previsaoFiltrada = previsaoProcessadaCompletaCache.slice(0, diasParaExibirReq);
    }
    
    exibirPrevisaoDetalhada(previsaoFiltrada, nomeCidadeCache, areaResultado);

    document.querySelectorAll('#filtros-previsao-dias .filtro-dia-btn').forEach(btn => {
        btn.classList.toggle('filtro-dia-btn-ativo', btn.dataset.dias === numDiasStringParaComparacao);
    });
}


/**
 * @function exibirPrevisaoDetalhada
 * @description Exibe a previsão do tempo detalhada para múltiplos dias na UI.
 * @param {Array<object>|null} previsaoDiariaProcessada - Array com a previsão processada por dia.
 * @param {string} nomeCidade - Nome da cidade para o título.
 * @param {HTMLElement} areaResultado - O elemento HTML onde a previsão será exibida.
 */
function exibirPrevisaoDetalhada(previsaoDiariaProcessada, nomeCidade, areaResultado) {
    if (!areaResultado) {
        console.error("[Frontend] Área de resultado para previsão detalhada não fornecida.");
        return;
    }
    areaResultado.innerHTML = ''; 

    if (!previsaoDiariaProcessada || previsaoDiariaProcessada.length === 0) {
        // A mensagem de erro específica já deve ter sido exibida pelo catch do event listener.
        // Aqui, podemos apenas confirmar que não há dados para exibir.
        areaResultado.innerHTML = `<p><i class="fa-regular fa-circle-xmark"></i> Não há dados de previsão para exibir para "${nomeCidade}".</p>`;
        return;
    }

    const titulo = document.createElement('h4');
    titulo.innerHTML = `<i class="fa-solid fa-calendar-days"></i> Previsão para ${nomeCidade}`;
    areaResultado.appendChild(titulo);

    const containerDias = document.createElement('div');
    containerDias.className = 'forecast-container'; 

    previsaoDiariaProcessada.forEach(diaInfo => {
        const diaCard = document.createElement('div');
        diaCard.className = 'day-weather-card'; 

        const dataObj = new Date(diaInfo.data + 'T00:00:00'); // Adiciona hora para evitar problemas de fuso ao formatar só a data
        const dataFormatada = dataObj.toLocaleDateString('pt-BR', {
            weekday: 'short', 
            day: 'numeric',   
            month: 'short',
            timeZone: 'UTC' // Para consistência na exibição da data
        });

        const iconeUrl = `https://openweathermap.org/img/wn/${diaInfo.icone}@2x.png`;

        diaCard.innerHTML = `
            <p class="forecast-date"><strong>${dataFormatada}</strong></p>
            <img src="${iconeUrl}" alt="${diaInfo.descricao}" class="weather-icon-daily" title="${diaInfo.descricao}">
            <p class="forecast-desc">${diaInfo.descricao}</p>
            <p class="forecast-temp">
                <i class="fa-solid fa-temperature-arrow-down"></i> ${diaInfo.temp_min}°C / 
                <i class="fa-solid fa-temperature-arrow-up"></i> ${diaInfo.temp_max}°C
            </p>
        `;
        containerDias.appendChild(diaCard);
    });

    areaResultado.appendChild(containerDias);

    if (!document.getElementById('forecast-styles')) {
        const style = document.createElement('style');
        style.id = 'forecast-styles';
        style.innerHTML = `
            .forecast-container {
                display: flex;
                flex-wrap: wrap; 
                gap: 10px; 
                justify-content: space-around; 
                margin-top: 10px;
            }
            .day-weather-card {
                background-color: rgba(255, 255, 255, 0.15);
                border-radius: 8px;
                padding: 15px;
                text-align: center;
                min-width: 120px; 
                flex-grow: 1; 
                box-shadow: 0 2px 5px rgba(0,0,0,0.1);
            }
            .weather-icon-daily {
                width: 50px;
                height: 50px;
                margin: 5px 0;
            }
            .forecast-date {
                font-size: 0.9em;
                color: #f0f0f0;
                margin-bottom: 5px;
            }
            .forecast-desc {
                font-size: 0.85em;
                margin-bottom: 8px;
            }
            .forecast-temp {
                font-size: 0.9em;
            }
            .filtro-dia-btn {
                padding: 6px 12px;
                font-size: 0.9em;
                margin: 0 3px;
            }
            .filtro-dia-btn-ativo {
                background-color: #3498db !important; 
                color: white !important;
                font-weight: bold;
                box-shadow: inset 0 2px 3px rgba(0,0,0,0.15), 0 1px 1px rgba(255,255,255,0.3) !important;
                border-color: #2980b9 !important;
            }
            .filtro-dia-btn:not(.filtro-dia-btn-ativo):hover {
                 background-color: #5dade2 !important;
                 border-color: #3498db !important;
            }
        `;
        document.head.appendChild(style);
    }
}

// ==================================================
//      FUNÇÕES DA API DE DICAS - ATIVIDADE B2.P1.A8
// ==================================================

/**
 * Busca a lista de dicas gerais no backend.
 * @returns {Promise<Array|null>} Um array com as dicas ou null em caso de erro.
 */
async function buscarDicasGerais() {
    try {
        const response = await fetch(`${backendUrl}/api/dicas-manutencao`);
        if (!response.ok) {
            throw new Error(`Erro ${response.status} ao buscar dicas gerais.`);
        }
        const dicas = await response.json();
        return dicas;
    } catch (error) {
        console.error("Erro em buscarDicasGerais:", error);
        return null; // Retorna null para que quem chamou saiba que deu erro
    }
}

/**
 * Busca dicas para um tipo específico de veículo no backend.
 * @param {string} tipoVeiculo - O tipo do veículo (ex: 'carro', 'moto').
 * @returns {Promise<Array|null>} Um array com as dicas ou null em caso de erro.
 */
async function buscarDicasPorTipo(tipoVeiculo) {
    if (!tipoVeiculo) return null;
    try {
        const response = await fetch(`${backendUrl}/api/dicas-manutencao/${tipoVeiculo}`);
        if (!response.ok) {
            // Se o status for 404, o backend já nos deu a resposta que não encontrou.
            if (response.status === 404) {
                const erroData = await response.json();
                // Retornamos um array vazio com uma mensagem especial para a UI tratar.
                return [{ id: 'not-found', dica: erroData.error || `Nenhuma dica encontrada para ${tipoVeiculo}.` }];
            }
            throw new Error(`Erro ${response.status} ao buscar dicas para ${tipoVeiculo}.`);
        }
        const dicas = await response.json();
        return dicas;
    } catch (error) {
        console.error(`Erro em buscarDicasPorTipo para "${tipoVeiculo}":`, error);
        return null;
    }
}

/**
 * Exibe as dicas na área de resultados da UI.
 * @param {Array<object>|null} dicas - O array de objetos de dica.
 * @param {HTMLElement} areaResultado - O elemento do DOM onde as dicas serão exibidas.
 */
function exibirDicas(dicas, areaResultado) {
    if (!areaResultado) return;

    if (!dicas) {
        areaResultado.innerHTML = `<p style="color: red;"><i class="fa-solid fa-bomb"></i> Ops! Ocorreu um erro ao buscar as dicas no servidor.</p>`;
        return;
    }

    if (dicas.length === 0) {
        areaResultado.innerHTML = `<p><i class="fa-regular fa-face-surprise"></i> Nenhuma dica encontrada.</p>`;
        return;
    }
    
    // Tratamento especial para o nosso erro 404 personalizado
    if (dicas.length === 1 && dicas[0].id === 'not-found') {
        areaResultado.innerHTML = `<p style="color: orange;"><i class="fa-solid fa-magnifying-glass"></i> ${dicas[0].dica}</p>`;
        return;
    }

    // Cria a lista de dicas
    const listaHtml = dicas.map(d => `<li><i class="fa-solid fa-wand-magic-sparkles" style="color: #FF69B4;"></i> ${d.dica}</li>`).join('');
    areaResultado.innerHTML = `<ul>${listaHtml}</ul>`;
}


// ==================================================
//                   INICIALIZAÇÃO DA APLICAÇÃO
// ==================================================
function inicializarAplicacao() {
    console.log(`DOM Carregado. Iniciando Garagem Inteligente (Key: ${GARAGEM_KEY})...`);
    try {
        setupEventListeners();
        carregarGaragem(); 
        console.log("Aplicação inicializada.");
    } catch (e) {
        console.error("ERRO CRÍTICO NA INICIALIZAÇÃO:", e);
        document.body.innerHTML = `<div style='color:red; border: 2px solid red; background: #ffebee; padding: 20px; text-align: center;'>
            <h1><i class="fa-solid fa-skull-crossbones"></i> Erro Grave na Inicialização</h1>
            <p>A aplicação não pôde ser iniciada: ${e.message}</p>
            <button onclick='localStorage.removeItem("${GARAGEM_KEY}"); location.reload();'>Limpar Dados e Recarregar</button>
        </div>`;
    }
}

function setupEventListeners() {
    console.log("Configurando Listeners Iniciais...");
    document.getElementById('tab-garagem')?.addEventListener('click', () => handleTrocarAba('tab-garagem'));
    document.getElementById('tab-adicionar')?.addEventListener('click', () => handleTrocarAba('tab-adicionar'));
    document.getElementById('form-add-veiculo')?.addEventListener('submit', handleAdicionarVeiculo);

    const tipoSelect = document.getElementById('add-tipo');
    const cargaContainer = document.getElementById('add-capacidade-carga-container');
    if (tipoSelect && cargaContainer) {
        const toggleCargaVisibility = () => {
             cargaContainer.style.display = tipoSelect.value === 'Caminhao' ? 'block' : 'none';
             if (tipoSelect.value !== 'Caminhao') {
                const capInput = cargaContainer.querySelector('#add-capacidade-carga');
                if(capInput) capInput.value = '';
             }
         };
        tipoSelect.addEventListener('change', toggleCargaVisibility);
        toggleCargaVisibility();
    }

    const addImagemInput = document.getElementById('add-imagem-input');
    const addImagemPreview = document.getElementById('add-imagem-preview');
    if (addImagemInput && addImagemPreview) {
        addImagemInput.addEventListener('change', (event) => {
            const file = event.target.files[0];
            if (file && file.type.startsWith("image/")) {
                const reader = new FileReader();
                reader.onload = (e) => { addImagemPreview.src = e.target.result; addImagemPreview.style.display = 'block'; }
                reader.onerror = () => { addImagemPreview.src = '#'; addImagemPreview.style.display = 'none';}
                reader.readAsDataURL(file);
            } else { addImagemPreview.src = '#'; addImagemPreview.style.display = 'none'; }
        });
    }

    // --- Event Listener para BUSCAR PREVISÃO DO TEMPO (MODIFICADO) ---
    const btnBuscarPrevisao = document.getElementById('btn-buscar-previsao');
    const inputDestino = document.getElementById('viagem-destino');
    const areaResultadoPrevisao = document.getElementById('previsao-resultado-area');
    const divControlesPrevisao = document.getElementById('controles-previsao'); 

    if (btnBuscarPrevisao && inputDestino && areaResultadoPrevisao && divControlesPrevisao) {
        btnBuscarPrevisao.addEventListener('click', async () => {
            const cidade = inputDestino.value.trim();

            // Limpa estado anterior e mostra feedback de carregamento
            areaResultadoPrevisao.innerHTML = `<p><i class="fa-solid fa-spinner fa-spin"></i> Buscando previsão para ${cidade || "destino"}...</p>`;
            btnBuscarPrevisao.disabled = true;
            divControlesPrevisao.style.display = 'none'; 
            previsaoProcessadaCompletaCache = null; 
            nomeCidadeCache = "";

            if (!cidade) {
                areaResultadoPrevisao.innerHTML = `<p style="color: orange;"><i class="fa-solid fa-circle-exclamation"></i> Por favor, informe a Cidade de Destino.</p>`;
                btnBuscarPrevisao.disabled = false;
                return;
            }
            
            try {
                // Chama a função que agora busca do nosso backend
                const dadosApi = await buscarPrevisaoDetalhada(cidade); 
                
                // O nome da cidade pode vir da resposta da API, que é mais confiável
                const cidadeRetornada = dadosApi.city?.name || cidade;
                nomeCidadeCache = cidadeRetornada; // Guarda para usar nos filtros

                const previsaoProcessada = processarDadosForecast(dadosApi);
                
                if (previsaoProcessada && previsaoProcessada.length > 0) {
                    previsaoProcessadaCompletaCache = previsaoProcessada; 
                    
                    // Determina o número de dias padrão para exibição (ex: 5 ou o total disponível)
                    const diasDefault = Math.min(5, previsaoProcessadaCompletaCache.length).toString();
                    aplicarFiltroEExibirPrevisao(diasDefault, areaResultadoPrevisao);
                    
                    divControlesPrevisao.style.display = 'block'; 
                } else {
                    // Se processarDadosForecast retornar null ou array vazio, mesmo com dadosApi válidos.
                    areaResultadoPrevisao.innerHTML = `<p><i class="fa-regular fa-circle-xmark"></i> Não foi possível processar os dados da previsão para "${cidadeRetornada}".</p>`;
                }

            } catch (error) { 
                // Erros de buscarPrevisaoDetalhada (rede, ou do backend) são pegos aqui
                console.error("[Frontend] Erro no fluxo de busca de previsão:", error);
                areaResultadoPrevisao.innerHTML = `<p style="color: red;"><i class="fa-solid fa-bomb"></i> Falha: ${error.message}</p>`;
                // Garante que controles de filtro fiquem escondidos se deu erro
                divControlesPrevisao.style.display = 'none';
                previsaoProcessadaCompletaCache = null;
                nomeCidadeCache = "";
            } finally {
                btnBuscarPrevisao.disabled = false;
            }
        });

        // Event listener para os botões de filtro de dias (permanece o mesmo)
        const divFiltrosDias = document.getElementById('filtros-previsao-dias');
        if (divFiltrosDias) {
            divFiltrosDias.addEventListener('click', (event) => {
                const targetButton = event.target.closest('.filtro-dia-btn'); 
                if (targetButton && targetButton.dataset.dias) {
                    const numDias = targetButton.dataset.dias;
                    aplicarFiltroEExibirPrevisao(numDias, areaResultadoPrevisao);
                }
            });
        }

    } else {
        console.warn("Elementos do Planejador de Viagem (botão, input destino, área resultado ou controles) não encontrados no DOM.");
    }
    
    // --- Event Listeners para a seção de DICAS DE MANUTENÇÃO ---
    const btnDicasGerais = document.getElementById('btn-buscar-dicas-gerais');
    const btnDicasTipo = document.getElementById('btn-buscar-dicas-tipo');
    const selectTipoDica = document.getElementById('select-tipo-dica');
    const dicasResultadoArea = document.getElementById('dicas-resultado-area');

    if (btnDicasGerais && dicasResultadoArea) {
        btnDicasGerais.addEventListener('click', async () => {
            dicasResultadoArea.innerHTML = `<p><i class="fa-solid fa-spinner fa-spin"></i> Buscando dicas gerais...</p>`;
            const dicas = await buscarDicasGerais();
            exibirDicas(dicas, dicasResultadoArea);
        });
    }

    if (btnDicasTipo && selectTipoDica && dicasResultadoArea) {
        btnDicasTipo.addEventListener('click', async () => {
            const tipoSelecionado = selectTipoDica.value;
            if (!tipoSelecionado) {
                alert('Por favor, escolha um tipo de veículo fofinho primeiro!');
                return;
            }
            dicasResultadoArea.innerHTML = `<p><i class="fa-solid fa-spinner fa-spin"></i> Buscando dicas para ${tipoSelecionado}...</p>`;
            const dicas = await buscarDicasPorTipo(tipoSelecionado);
            exibirDicas(dicas, dicasResultadoArea);
        });
    }
    
    console.log("Listeners Iniciais configurados.");
}

document.addEventListener('DOMContentLoaded', inicializarAplicacao);