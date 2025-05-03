# tvwall-server

Servidor Flask + Socket.IO para controle e sincronização de um sistema de videowall distribuído via Raspberry Pi.

## Funcionalidade

Este servidor permite:

- Upload e gerenciamento de projetos de vídeo com múltiplas partes
- Atribuição de partes a players individuais (tv1, tv2, etc.)
- Sincronização precisa entre players usando NTP
- Interface web para visualização e controle do sistema
- Geração de prévias de vídeo
- Comunicação bidirecional com os players via Socket.IO

## Estrutura

- `app.py` – Backend Flask + Socket.IO
- `templates/index.html` – Painel de controle principal
- `templates/modais.html` – Modais da interface
- `static/js/` – Scripts de controle da interface (`script.js`, `socket.js`)
- `static/videos/` – Vídeos enviados, organizados por projeto
- `static/previews/` – Pré-visualizações em baixa resolução geradas automaticamente

## Requisitos

- Python 3.10+
- FFmpeg (para gerar prévias)
- `eventlet`, `flask`, `flask-socketio`, `python-dotenv`, `flask-cors`, `requests`

Instale as dependências com:

```bash
pip install -r requirements.txt
```

## Configuração

Crie um arquivo `.env` com as variáveis:

```env
SECRET_KEY=algumasecreta
VIDEO_FOLDER=videos
SERVER_PORT=5000
NTP_SERVER=pool.ntp.org
NTP_TIMEOUT=5
```

## Execução

```bash
python app.py
```

Acesse o painel em: [http://localhost:5000](http://localhost:5000)

## Upload de Projetos

- Envie múltiplos vídeos com nomes no formato `nome_1.mp4`, `nome_2.mp4`, etc.
- O sistema agrupa esses vídeos sob o mesmo “projeto” (nome base).
- As prévias são geradas automaticamente.

## Publicação

- Atribua partes de um projeto a TVs específicas
- Programe a exibição com sincronização absoluta usando timestamp (NTP)
- Os comandos são enviados via Socket.IO aos players

## Players

Cada cliente Raspberry Pi ou windows, executa um script (`player_tvwall.py`) que:

- Reproduz vídeos via MPV
- Se conecta ao servidor via Socket.IO
- Sincroniza o tempo com NTP
- Exibe logs e responde a comandos

## Licença

Desenvolvido por [Tiago Keise](https://github.com/tiagokeise) para uso em instalações com múltiplos Raspberry Pi ou windows exibindo vídeos sincronizados.

MIT
