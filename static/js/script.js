// Mostrar toast simples

let tvOnline = [];

function mostrarToast(msg, cor = 'info', t = 3000) {
  const container = document.getElementById('toastContainer') 
  || (() => {
    const c = document.createElement('div');
    c.id = 'toastContainer';
    c.className = 'position-fixed top-0 end-0 mt-3 me-3';
    c.style.zIndex = 9999;
    document.body.appendChild(c);
    return c;
  })();

  const el = document.createElement('div');
  el.className = `toast text-bg-${cor} border-0 show mb-2`;
  el.innerHTML = `
    <div class="d-flex">
      <div class="toast-body">${msg}</div>
      <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast"></button>
    </div>`;

  container.appendChild(el);

  const bsToast = bootstrap.Toast.getOrCreateInstance(el);
  setTimeout(() => {
    bsToast.hide();
    setTimeout(() => el.remove(), 300); // tempo extra para fade-out
  }, t);
}

// Mostrar ou atualizar status inteligente
function atualizarStatusModal(texto) {
  const statusEl = document.getElementById("statusMensagem");
  statusEl.innerHTML = `
    <div class="spinner-border text-light mb-3"></div>
    <p class="mb-0">${texto}</p>`;
  const modal = bootstrap.Modal.getOrCreateInstance(document.getElementById("modalStatus"));
  modal.show();
}

// Upload de projeto
document.getElementById("btnEnviarProjeto").onclick = async () => {
  const nome = document.getElementById("inputNomeProjeto").value.trim();
  const arquivos = document.getElementById("inputArquivosProjeto").files;
  if (!nome.match(/^[a-zA-Z0-9_]+$/)) return mostrarToast("Nome inválido", "warning");
  if (arquivos.length < 2) return mostrarToast("Selecione pelo menos 2 vídeos", "warning");

  const fd = new FormData();
  for (let i = 0; i < arquivos.length; i++) {
    fd.append("videos", arquivos[i], `${nome}_${i + 1}.mp4`);
  }

  // FECHA o modal de upload imediatamente
  bootstrap.Modal.getInstance(document.getElementById("uploadModal"))?.hide();

  // ABRE o modal de status
  atualizarStatusModal("Enviando vídeos...");

  try {
    const res = await axios.post("/upload", fd);
    bootstrap.Modal.getInstance(document.getElementById("modalStatus"))?.hide();
    document.getElementById("mensagemSucesso").textContent = `Projeto "${res.data.grupo}" enviado com sucesso.`;
    bootstrap.Modal.getOrCreateInstance(document.getElementById("modalSucesso")).show();
  } catch (err) {
    mostrarToast(`Erro no upload: ${err.response?.data?.erro || err}`, "danger");
    bootstrap.Modal.getInstance(document.getElementById("modalStatus"))?.hide();
  }
};

async function ativarModoEstudio(grupo, wrapper) {
  fecharTodosOsAbertos();

  const existente = wrapper.querySelector(".modo-estudio");
  if (existente) {
    existente.remove();
    return;
  }

  const painel = document.createElement("div");
  painel.className = "modo-estudio bg-dark text-white mt-3 p-3 rounded";
  painel.innerHTML = `<p>Selecione qual parte do projeto <strong>${grupo}</strong> será exibida em cada player:</p>`;

  const controles = document.createElement("div");
  controles.className = "d-flex flex-wrap gap-3 mb-3";

  const btnPublicar = document.createElement("button");
  btnPublicar.className = "btn btn-success btn-sm mt-2";
  btnPublicar.textContent = "Publicar";

  const atribuicoes = {};

  let arquivos = [];
  try {
    const res = await axios.get(`/videos/${grupo}`);
    arquivos = res.data.filter(f => f.endsWith(".mp4")).sort();
  } catch (err) {
    mostrarToast("Erro ao buscar vídeos do projeto", "danger");
    return;
  }

  const numPartes = arquivos.length;

  if (tvOnline.length === 0) {
    const alerta = document.createElement("div");
    alerta.className = "alert alert-warning text-center w-100";
    alerta.innerHTML = "Nenhum player online disponível no momento.";
    controles.appendChild(alerta);
    btnPublicar.disabled = true;
  } else {
    tvOnline.forEach(tv => {
      const bloco = document.createElement("div");
      bloco.className = "bg-secondary p-2 rounded d-flex flex-column align-items-start";

      const label = document.createElement("label");
      label.textContent = tv;

      const select = document.createElement("select");
      select.className = "form-select form-select-sm mt-1";

      for (let i = 1; i <= numPartes; i++) {
        const opt = new Option(`Parte ${i}`, i);
        select.appendChild(opt);
      }

      select.onchange = () => {
        atribuicoes[tv] = parseInt(select.value);
      };

      atribuicoes[tv] = 1;
      bloco.append(label, select);
      controles.appendChild(bloco);
    });
  }

  btnPublicar.onclick = async () => {
    const startAt = Math.floor(Date.now() / 1000) + 5;

    for (const [tv, parte] of Object.entries(atribuicoes)) {
      const nome_vid = arquivos[parte - 1];

      await axios.post("/config", { client_id: tv, part: parte }); // opcional, para rastreio
      await axios.post("/publicar", {
        video: nome_vid,
        start_at: startAt,
      });
    }

    mostrarToast(`Projeto "${grupo}" será executado`, "success");

    //painel.remove();
  };

  painel.append(controles, btnPublicar);
  wrapper.appendChild(painel);
}

// Atualizar lista de projetos e status dos TVs
async function listarProjetos() {

  try {
    const resGrupos = await axios.get("/grupos");
    const lista = document.getElementById("listaProjetos");
    lista.innerHTML = "";

    resGrupos.data.forEach(grupo => {
      // Wrapper do projeto
      const wrapper = document.createElement("div");
      wrapper.className = "bg-secondary p-3 rounded mb-3";

      // Linha com nome + botões
      const linhaTopo = document.createElement("div");
      linhaTopo.className = "d-flex justify-content-between align-items-center";

      const title = document.createElement("strong");
      title.className = "text-white";
      title.textContent = grupo;

      const botoes = document.createElement("div");
      botoes.className = "d-flex gap-2";

      const btnEstudio = document.createElement("button");
      btnEstudio.className = "btn btn-success btn-sm";
      btnEstudio.innerHTML = '<i class="bi bi-play-btn"></i> Estúdio';
      btnEstudio.onclick = () => ativarModoEstudio(grupo, wrapper);

      const btnPreview = document.createElement("button");
      btnPreview.className = "btn btn-info btn-sm";
      btnPreview.innerHTML = '<i class="bi bi-collection-play"></i> Preview';
      btnPreview.onclick = () => togglePreview(grupo, wrapper);

      const btnExcluir = document.createElement("button");
      btnExcluir.className = "btn btn-danger btn-sm";
      btnExcluir.innerHTML = '<i class="bi bi-trash"></i> Excluir';
      btnExcluir.onclick = () => confirmarExclusao(grupo, wrapper);

      botoes.append(btnEstudio, btnPreview, btnExcluir);
      linhaTopo.append(title, botoes);
      wrapper.appendChild(linhaTopo);

      lista.appendChild(wrapper);
    });

    bootstrap.Modal.getOrCreateInstance(document.getElementById("modalListarProjetos")).show();
    bootstrap.Modal.getInstance(document.getElementById("modalStatus"))?.hide();
  } catch (err) {
    mostrarToast(`Erro ao listar projetos: ${err.message}`, "danger");
  }
}

async function togglePreview(grupo, wrapper) {
  fecharTodosOsAbertos();

  // Toggle: fecha se já estiver aberto
  const existente = wrapper.querySelector(".preview-container");
  if (existente) {
    existente.classList.add("fade-out");
    setTimeout(() => existente.remove(), 200);
    return;
  }

  // Descobre quantos vídeos tem no grupo (vídeos reais, não previews)
  let totalVideos = 0;
  try {
    const res = await axios.get(`/videos/${grupo}`);
    totalVideos = res.data.filter(f => f.endsWith(".mp4")).length;
  } catch (err) {
    mostrarToast("Erro ao buscar vídeos do projeto", "danger");
    return;
  }

  const container = document.createElement("div");
  container.className = "preview-container d-flex w-100 gap-3 mt-3";

  const faixa = document.createElement("div");
  faixa.className = "d-flex gap-0 flex-fill";

  for (let i = 1; i <= totalVideos; i++) {
    const r = document.createElement("div");
    r.className = "ratio ratio-16x9 video-thumb flex-fill";

    const v = document.createElement("video");
    v.src = `/static/previews/${grupo}/preview_${grupo}_${i}.mp4`;
    v.autoplay = true;
    v.muted = true;
    v.loop = true;
    v.playsInline = true;
    v.controls = false;
    v.onerror = () => r.remove();

    r.appendChild(v);
    faixa.appendChild(r);
  }

  container.appendChild(faixa);
  container.classList.add("invisible");
  wrapper.appendChild(container);

  // Ativa animação
  requestAnimationFrame(() => {
    container.classList.remove("invisible");
    container.classList.add("animar-preview");
  });
}

function confirmarExclusao(grupo, wrapper) {
  fecharTodosOsAbertos();
  // Já tem uma confirmação aberta?
  const existente = wrapper.querySelector(".confirmar-exclusao");
  if (existente) {
    existente.remove();
    return;
  }

  const confirmDiv = document.createElement("div");
  confirmDiv.className = "confirmar-exclusao p-3 mt-3 bg-dark rounded text-white animate-fadein";
  confirmDiv.innerHTML = `
    <p class="mb-2">Tem certeza que deseja excluir o projeto <strong>${grupo}</strong>?</p>
    <div class="d-flex gap-2">
      <button class="btn btn-secondary btn-sm">Cancelar</button>
      <button class="btn btn-danger btn-sm">Confirmar</button>
    </div>
  `;

  const [btnCancelar, btnConfirmar] = confirmDiv.querySelectorAll("button");

  btnCancelar.onclick = () => confirmDiv.remove();

  btnConfirmar.onclick = async () => {
    try {
      confirmDiv.innerHTML = "⏳ Excluindo...";
      await axios.delete(`/grupos/${grupo}`);
      wrapper.remove(); // remove o projeto da interface
      mostrarToast(`Projeto "${grupo}" excluído com sucesso`, "success");
    } catch (err) {
      mostrarToast(`Erro ao excluir: ${err.message}`, "danger");
      confirmDiv.remove();
    }
  };

  wrapper.appendChild(confirmDiv);
}

async function enviarComando(grupo) {
  const startAt = Math.floor(Date.now() / 1000) + 5;
  try {
    // Buscar nome real do arquivo com base na parte
    const res = await axios.get(`/videos/${grupo}`);
    const arquivos = res.data.filter(f => f.endsWith(".mp4")).sort();

    for (const [tv, parte] of Object.entries(atribuicoes)) {
      const nome_vid = arquivos[parte - 1];
      await axios.post("/config", { client_id: tv, part: parte }); // mantém compatibilidade futura

      await axios.post("/publicar", {
        video: nome_vid,
        start_at: startAt,
      });
    }
    mostrarToast(`📡 Projeto "${grupo}" enviado para exibição`, "primary");
  } catch (err) {
    mostrarToast(`Erro ao enviar comando: ${err.message}`, "danger");
  }
}

function fecharTodosOsAbertos() {
  document.querySelectorAll(".preview-container, .confirmar-exclusao, .modo-estudio")
    .forEach(e => e.remove());
}

// Inicialização
document.getElementById("btnListarProjetos").onclick = listarProjetos;
