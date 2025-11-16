#!/usr/bin/env bash
set -e

echo "Current dir: $(pwd)"
ls

# Backend lives in ./backend
cd backend

if [ ! -f "package.json" ]; then
  echo "❌ package.json not found in ./backend"
  exit 1
fi

if [ ! -d node_modules ]; then
  echo "📦 Installing backend dependencies..."
  npm install
fi

export HOST=0.0.0.0
export PORT=${PORT:-8080}

echo "🚀 Starting backend on $HOST:$PORT"

if npm run | grep -q " dev"; then
  npm run dev
else
  npm start
fi
