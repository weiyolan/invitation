#!/bin/bash
# Simple dev server using Python's http.server
# Usage: ./dev-server.sh or bash dev-server.sh
# Opens http://localhost:3000

PORT=3000
URL="http://localhost:$PORT"

# Check if port is already in use
if lsof -Pi :$PORT -sTCP:LISTEN -t >/dev/null 2>&1; then
  echo "❌ Port $PORT is already in use"
  echo "   Kill it with: lsof -i :$PORT | grep LISTEN | awk '{print \$2}' | xargs kill -9"
  exit 1
fi

echo ""
echo "✨ Starting dev server..."
echo "🌐 Open: $URL"
echo "📂 Serving from: $(pwd)"
echo "🔧 Edit files and refresh the browser"
echo "⏹️  Press Ctrl+C to stop"
echo ""

# Use Python 3 http.server
python3 -m http.server $PORT --directory . 2>&1 | sed 's/^/   /'
