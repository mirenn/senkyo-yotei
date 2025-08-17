#!/bin/bash
# Development setup script

echo "=== Election Voting Platform Setup ==="

# Check if we're in the right directory
if [ ! -f "architecture.md" ]; then
  echo "❌ Please run this script from the project root directory"
  exit 1
fi

# Install frontend dependencies
echo "📦 Installing frontend dependencies..."
cd frontend
npm install
if [ $? -ne 0 ]; then
  echo "❌ Failed to install frontend dependencies"
  exit 1
fi

echo ""
echo "✅ Setup complete!"
echo ""
echo "🚀 To start development:"
echo "   cd frontend && npm run dev"
echo ""
echo "📖 The app will run in demo mode with mock data."
echo "   To enable Firebase integration, update frontend/src/firebase/config.ts"
echo ""
echo "🔍 Check README.md for detailed setup instructions"
