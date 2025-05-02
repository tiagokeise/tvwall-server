// Conexão com servidor
const socket = io();

// Cliente envia que o painel HTML foi conectado
socket.emit("painel_conectado");

// Recebe status completo de todos os TVs
socket.on("update_status", (lista) => {
    tvOnline = lista.filter(tv => tv.online).map(tv => tv.client_id);
  
    const statusContainer = document.getElementById("statusTvs");
    if (!statusContainer) return;
  
    lista.forEach(tv => {
      const id = `player-${tv.client_id}`;
      let div = document.getElementById(id);
  
      // Só cria se ainda não existir
      if (!div) {
        div = document.createElement("div");
        div.id = id;
        div.className = "d-flex align-items-center gap-2 bg-secondary p-2 rounded";
  
        div.innerHTML = `<strong>${tv.client_id}</strong> 
          <span id="status-${tv.client_id}" class="badge ms-2 bg-danger">Offline</span>`;
  
        statusContainer.appendChild(div);
      }
    });
  });

// Logs vindos do servidor (ex: upload, conversão, etc.)
socket.on("log", (data) => {
  if (data?.mensagem) atualizarStatusModal(data.mensagem);
});

socket.on("status_update", data => {
    const { client_id, status } = data;
  
    // Marca como online visualmente
    const badge = document.querySelector(`#status-${client_id}`);
    if (badge) {
      badge.textContent = status === "executando" ? "Executando"
                      : status === "baixando" ? "Baixando"
                      : "Online";
      badge.className = "badge ms-2"; // mantém margens e classes base
  
      if (status === "executando") badge.classList.add("bg-success");
      else if (status === "baixando") badge.classList.add("bg-warning");
      else badge.classList.add("bg-info");
    }
  
    // Atualiza tvOnline para uso interno
    if (!tvOnline.includes(client_id)) tvOnline.push(client_id);
  });

  socket.on("toast_log", data => {
    const { client_id, msg } = data;
    mostrarToast(`[${client_id}] ${msg}`, "info");
  });

// Mensagens rápidas (toast)
socket.on("toast", (data) => {
  if (data?.mensagem) mostrarToast(data.mensagem, data.tipo || "info");
});

function atualizarStatusVisual(id, status) {
    const badge = document.querySelector(`#status-${id}`);
    if (!badge) return;
  
    badge.textContent = status === "executando" ? "Executando"
                      : status === "baixando" ? "Baixando"
                      : "Online";
  
    badge.className = "badge";
  
    if (status === "executando") badge.classList.add("bg-success");
    else if (status === "baixando") badge.classList.add("bg-warning");
    else badge.classList.add("bg-info");
  }

 /* function mostrarToast(msg, cor='info', t=3000) {
    const el = document.createElement('div');
    el.className = `toast text-bg-${cor} border-0 mb-2 show position-fixed bottom-0 end-0 me-3 mb-3`;
    el.innerHTML = `<div class="d-flex"><div class="toast-body">${msg}</div>
      <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast"></button></div>`;
    document.body.appendChild(el);
    setTimeout(()=>{ bootstrap.Toast.getOrCreateInstance(el).hide(); el.remove(); }, t);
  }*/