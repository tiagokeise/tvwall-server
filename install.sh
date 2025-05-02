#!/bin/bash
set -e

echo "🔧 Criando ambiente virtual..."
python3 -m venv venv

echo "🐍 Ativando ambiente virtual e instalando dependências..."
source venv/bin/activate
pip install --upgrade pip

if [ -f "requirements.txt" ]; then
  pip install -r requirements.txt
else
  echo "⚠️  Arquivo requirements.txt não encontrado. Abortando."
  exit 1
fi

echo "📝 Criando arquivo .env padrão..."
cat <<EOF > .env
SECRET_KEY=$(openssl rand -hex 16)
VIDEO_FOLDER=videos
SERVER_PORT=5000
NTP_SERVER=pool.ntp.org
NTP_TIMEOUT=5
EOF

echo "📁 Garantindo estrutura de pastas..."
mkdir -p static/videos static/previews

echo "✅ Instalação concluída. Iniciando o servidor..."

python app.py
