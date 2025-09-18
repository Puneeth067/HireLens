#!/bin/bash

# HireLens Production Build Script

set -e

echo "🏗️  Building HireLens for Production..."

# Clean previous builds
echo "🧹 Cleaning previous builds..."
npm run clean

# Install dependencies
echo "📦 Installing dependencies..."
npm install

# Build shared packages first
echo "🔨 Building shared packages..."
npm run build --workspace=packages/shared-types
npm run build --workspace=packages/config

# Build client
echo "⚛️  Building Next.js client..."
npm run build --workspace=client

# Install Python dependencies for server
echo "🐍 Installing Python dependencies..."
cd server
pip install -r requirements.txt
cd ..

echo "✅ Production build completed!"
echo "📁 Client build: client/.next"
echo "🐍 Server ready: server"
echo "\n🚀 Ready for deployment!"
