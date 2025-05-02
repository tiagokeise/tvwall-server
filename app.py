import eventlet
eventlet.monkey_patch()

import os
import json
import shutil
import subprocess
import threading
import time
from flask import Flask, request, jsonify, send_from_directory, render_template
from flask_cors import CORS #type: ignore
from flask_socketio import SocketIO, emit
from dotenv import load_dotenv

sid_registry = {}

load_dotenv()

# Diretório base do app
BASE_DIR = os.path.dirname(os.path.abspath(__file__))

# Inicialização do Flask e Socket.IO
app = Flask(__name__, static_folder="static", template_folder="templates")
app.config["SECRET_KEY"] = os.getenv("SECRET_KEY", "defaultsecret")
CORS(app)
socketio = SocketIO(app, cors_allowed_origins="*")

# Pastas e configurações
VIDEO_FOLDER = os.path.join(BASE_DIR, "static", os.getenv("VIDEO_FOLDER", "videos"))
PREVIEW_FOLDER = os.path.join(BASE_DIR, "static", "previews")
TV_CONFIG_PATH = os.path.join(BASE_DIR, "tv_config.json")
NTP_SERVER = os.getenv("NTP_SERVER", "pool.ntp.org")
NTP_TIMEOUT = int(os.getenv("NTP_TIMEOUT", "5"))
os.makedirs(VIDEO_FOLDER, exist_ok=True)
os.makedirs(PREVIEW_FOLDER, exist_ok=True)

# Estado
tv_online = set()
tv_config = {}  # tv_id → parte
tv_status = {}  # tv_id → texto ("idle", "rodando", etc.)
player_ping = {}

# Carrega config existente
if os.path.exists(TV_CONFIG_PATH):
    with open(TV_CONFIG_PATH, "r") as f:
        tv_config = json.load(f)

def salvar_tv_config():
    with open(TV_CONFIG_PATH, "w") as f:
        json.dump(tv_config, f, indent=2)

def emitir_status():
    dados = []
    for tv_id in sorted(set(tv_config.keys()) | tv_online):
        dados.append({
            "client_id": tv_id,
            "online": tv_id in tv_online,
            "part": tv_config.get(tv_id),
            "status": tv_status.get(tv_id, "desconhecido")
        })
    socketio.emit("update_status", dados)



@app.route("/")
def index():
    return render_template("index.html")

@app.route("/config", methods=["POST"])
def config_parte():
    data = request.get_json(force=True)
    tv_id = data.get("client_id")
    parte = data.get("part")
    if not tv_id:
        return jsonify({"erro": "client_id ausente"}), 400
    if not isinstance(parte, int) or parte < 1:
        return jsonify({"erro": "parte inválida"}), 400
    tv_config[tv_id] = parte
    salvar_tv_config()
    emitir_status()
    return jsonify({"status": "ok"})

@app.route("/grupos")
def listar_grupos():
    grupos = []
    if os.path.exists(VIDEO_FOLDER):
        for nome in os.listdir(VIDEO_FOLDER):
            caminho = os.path.join(VIDEO_FOLDER, nome)
            if os.path.isdir(caminho):
                arquivos = os.listdir(caminho)
                if any(f.endswith(".mp4") for f in arquivos):
                    grupos.append(nome)
    return jsonify(grupos)

@app.route("/grupos/<grupo>", methods=["DELETE"])
def excluir_grupo(grupo):
    try:
        shutil.rmtree(os.path.join(VIDEO_FOLDER, grupo), ignore_errors=True)
        shutil.rmtree(os.path.join(PREVIEW_FOLDER, grupo), ignore_errors=True)
        socketio.emit("toast", {
            "mensagem": f"🗑️ Projeto {grupo} excluído",
            "tipo": "success"
        })
        return jsonify({"status": "ok"})
    except Exception as e:
        return jsonify({"erro": str(e)}), 500

@app.route("/upload", methods=["POST"])
def upload_videos():
    files = request.files.getlist("videos")
    if len(files) < 2:
        return jsonify({"erro": "Envie pelo menos 2 vídeos"}), 400

    grupo = files[0].filename.rsplit("_", 1)[0]
    grupo_path = os.path.join(VIDEO_FOLDER, grupo)
    preview_path = os.path.join(PREVIEW_FOLDER, grupo)
    os.makedirs(grupo_path, exist_ok=True)
    os.makedirs(preview_path, exist_ok=True)

    for f in files:
        destino = os.path.join(grupo_path, f.filename)
        f.save(destino)
        socketio.emit("log", {"mensagem": f"📦 Vídeo {f.filename} salvo"})

        subprocess.run([
            "ffmpeg", "-y", "-i", destino,
            "-vf", "scale=-2:180", "-c:a", "copy",
            os.path.join(preview_path, f"preview_{f.filename}")
        ], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)

        socketio.emit("log", {"mensagem": f"🎞️ Preview gerado: {f.filename}"})

    return jsonify({"status": "ok", "grupo": grupo})

@app.route("/publicar", methods=["POST"])
def publicar():
    data = request.get_json(force=True)
    if not data or "video" not in data or "start_at" not in data:
        return jsonify({"erro": "video e start_at obrigatórios"}), 400

    grupo = data["video"].split("_")[0]
    start_at = float(data["start_at"])
    grupo_path = os.path.join(VIDEO_FOLDER, grupo)

    if not os.path.isdir(grupo_path):
        return jsonify({"erro": f"Projeto {grupo} não encontrado"}), 404

    arquivos = sorted([f for f in os.listdir(grupo_path) if f.endswith(".mp4")])
    base_url = os.getenv("SERVER_URL", request.host_url.rstrip("/"))

    for tv_id, parte in tv_config.items():
        if parte < 1 or parte > len(arquivos):
            continue

        nome_vid = arquivos[parte - 1]
        sid = sid_registry.get(tv_id)

        if sid:
            print(f"[Servidor] → {tv_id} receberá {nome_vid} @ {start_at}")
            socketio.emit("play", {
                "video": nome_vid,
                "start_at": start_at,
                "url": f"{base_url}/static/videos/{grupo}/{nome_vid}"
            }, to=sid)
        else:
            print(f"[Servidor] Player {tv_id} não está conectado.")

    return jsonify({"status": "ok"})

@app.route("/videos/<grupo>/<filename>")
def serve_video(grupo, filename):
    return send_from_directory(os.path.join(VIDEO_FOLDER, grupo), filename)

# ========== EVENTOS SOCKET.IO ==========

@app.route("/videos/<grupo>")
def listar_videos_do_grupo(grupo):
    grupo_path = os.path.join(VIDEO_FOLDER, grupo)
    if not os.path.isdir(grupo_path):
        return jsonify([]), 404
    return jsonify(sorted(os.listdir(grupo_path)))


@socketio.on("status")
def registrar_status(data):
    client_id = data.get("client_id")
    sid_registry[client_id] = request.sid
    print(f"[Servidor] Registrado {client_id} com sid {request.sid}")

    # Se for a primeira vez, adiciona no tv_config com part: None
    if client_id not in tv_config:
        tv_config[client_id] = None
        salvar_tv_config()
        print(f"[Servidor] Novo cliente {client_id} adicionado ao tv_config.json")

    emitir_status()


@socketio.on("painel_conectado")
def painel_handler():
    emitir_status()

@socketio.on("log")
def encaminhar_log(data):
    socketio.emit("toast_log", data)

@socketio.on("status_atual")
def status_player(data):
    client_id = data.get("client_id")
    status = data.get("status")
    print(f"[{client_id}] Status: {status}")
    player_ping[client_id] = time.time()  # marca última atividade
    socketio.emit("status_update", data)

def verificar_conexoes():
    while True:
        agora = time.time()
        lista = []
        for client_id, part in tv_config.items():
            ultimo = player_ping.get(client_id, 0)
            online = (agora - ultimo) < 6  # tolerância de 6s
            lista.append({
                "client_id": client_id,
                "online": online,
                "part": part,
            })
        socketio.emit("update_status", lista)
        time.sleep(1)

threading.Thread(target=verificar_conexoes, daemon=True).start()

if __name__ == "__main__":
    socketio.run(app, host="0.0.0.0", port=int(os.getenv("SERVER_PORT", 5000)), debug=True)
