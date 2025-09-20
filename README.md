# HireLens

> AI-powered resume parsing and ATS scoring platform

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/Node.js-18+-green.svg)](https://nodejs.org/)
[![Python](https://img.shields.io/badge/Python-3.8+-blue.svg)](https://python.org/)

## 🚀 Quick Start

### Prerequisites

* Node.js 18+ and npm
* Python 3.8+ and pip
* Git

### Development Setup

1. **Clone the repository**

```bash
git clone <repository-url>
cd hirelens
```

2. **Install dependencies and start development**

```bash
# Copy environment template
copy .env.example .env  # Use 'cp' if on Unix/Linux

# Start development environment
scripts\dev.bat           # Windows
# OR
bash scripts/dev.sh        # Unix/Linux
```

3. **Access the application**

* Frontend: [http://localhost:3000](http://localhost:3000/)
* Backend API: [http://localhost:8000](http://localhost:8000/)
* API Documentation: [http://localhost:8000/docs](http://localhost:8000/docs)

### Production Build

```bash
scripts\build.bat          # Windows
# OR
bash scripts/build.sh       # Unix/Linux
```

## 📁 Project Structure

```
hirelens/
├── client/             # Next.js frontend application
│   ├── app/            # Next.js 13+ app directory
│   ├── components/     # React components
│   └── lib/            # Client utilities and API
├── server/             # FastAPI backend application
│   ├── app/            # FastAPI application
│   │   ├── api/        # API route handlers
│   │   ├── models/     # Pydantic data models
│   │   └── services/   # Business logic services
│   └── requirements.txt
├── packages/
│   ├── shared-types/   # Shared TypeScript type definitions
│   └── config/         # Shared configuration management
├── scripts/            # Development and build scripts
├── docs/               # Project documentation
├── docker-compose.yml  # Docker development environment
├── .env.example        # Environment variables template
└── package.json        # Root package.json with workspaces
```

## 🏗️ Architecture

### Frontend (Next.js)

* **Framework** : Next.js 15 with App Router
* **Language** : TypeScript
* **Styling** : Tailwind CSS + Radix UI
* **State Management** : React hooks and context
* **API Client** : Custom service layer with type safety

### Backend (FastAPI)

* **Framework** : FastAPI with async/await
* **Language** : Python 3.8+
* **Data Validation** : Pydantic v2
* **File Processing** : PyPDF2, python-docx, mammoth
* **NLP** : spaCy, NLTK for resume parsing
* **Storage** : File-based (JSON) with plans for PostgreSQL

### Shared Packages

* **@hirelens/shared-types** : Common TypeScript types and interfaces
* **@hirelens/config** : Centralized configuration management

## 🎯 Core Features

### 📄 Resume Processing

* Multi-format support (PDF, DOCX, DOC)
* AI-powered text extraction and parsing
* Contact info, skills, experience extraction
* Bulk processing capabilities

### 💼 Job Management

* Comprehensive job description modeling
* Configurable ATS scoring weights
* Job performance analytics
* Bulk operations support

### 🎯 ATS Scoring

* Multi-criteria scoring (skills, experience, education, keywords)
* Configurable weight distribution
* Detailed scoring breakdowns and recommendations
* Batch comparison processing

### 📊 Analytics & Insights

* Real-time dashboard with system metrics
* Skills gap analysis and market trends
* Hiring performance insights
* Recruiter recommendations

### 🏆 Candidate Ranking

* Multi-criteria candidate evaluation
* AI-powered shortlist generation
* Side-by-side candidate comparisons
* Pipeline management tools

## 🛠️ Development

### Available Scripts

```bash
# Development
npm run dev              # Start both client and server
npm run dev:client       # Start only client
npm run dev:server       # Start only server

# Building
npm run build            # Build both applications
npm run build:client     # Build only client
npm run build:server     # Build only server

# Utilities
npm run lint             # Lint client code
npm run type-check       # Check shared types
npm run clean            # Clean all build artifacts
```

### Working with Shared Types

1. **Add new types** to `packages/shared-types/src/index.ts`
2. **Build the package** : `npm run build --workspace=packages/shared-types`
3. **Use in client** : Import from `@hirelens/shared-types`
4. **Use in server** : Reference TypeScript types for Pydantic model alignment

### API Integration

The client and server maintain type safety through:

* Shared TypeScript interfaces in `@hirelens/shared-types`
* Pydantic models in `server/app/models/` that align with TypeScript types
* Centralized API client in `client/lib/api.ts`

## 🚀 Deployment

### Docker Deployment

```bash
# Development with Docker
docker-compose up -d

# Production build
docker-compose -f docker-compose.prod.yml up -d
```

### Environment Variables

Copy `.env.example` to `.env` and configure:

* **PORT** : Server port (default: 8000)
* **NEXT_PUBLIC_API_URL** : API URL for client
* **UPLOAD_DIR** : File upload directory
* **LOG_LEVEL** : Logging level (DEBUG, INFO, WARNING, ERROR)
* **SECRET_KEY** : Security key for production

## 📚 API Documentation

FastAPI automatically generates interactive API documentation:

* **Swagger UI** : [http://localhost:8000/docs](http://localhost:8000/docs)
* **ReDoc** : [http://localhost:8000/redoc](http://localhost:8000/redoc)

## 🧪 Testing

```bash
# Run client tests
npm run test --workspace=client

# Run server tests
cd server
python -m pytest
```

## 🧹 Data Management

During normal operation, the application generates various data files:

### Server Data Directories

* `server/uploads/` - Uploaded resume files (excluded from version control)
* `server/uploads/file_metadata.json` - Metadata about uploaded files (excluded from version control, created at runtime)
* `server/data/` - Parsed resume data and job information (excluded from version control)
* `server/data/rankings/` - Candidate ranking data (excluded from version control)
* `server/data/comparisons/` - Resume-job comparison results (excluded from version control)

### Template Files

For files that need to exist but should be customized per installation:
* `server/uploads/file_metadata.json.example` - Empty template for file metadata (included in version control)
* `.env.example` - Template for environment variables

To initialize these files:
```bash
# Copy the templates to actual files
cp server/uploads/file_metadata.json.example server/uploads/file_metadata.json
cp .env.example .env
```

The `file_metadata.json` file will be automatically created and populated when you upload files through the application. It tracks metadata about uploaded resumes and is specific to each installation.

### Client Build Artifacts

* `client/.next/` - Next.js build output
* `client/out/` - Static export directory

These directories are also excluded from version control.

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/new-feature`
3. Make your changes following the established patterns
4. Ensure all tests pass and types check
5. Submit a pull request

### Code Style

* **TypeScript** : Follow ESLint configuration
* **Python** : Follow PEP 8 and use type hints
* **Shared Types** : Update both TypeScript and corresponding Pydantic models
* **API Changes** : Update both client service and server endpoints

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

For support, please:

1. Check the [documentation](docs/)
2. Search existing [issues](https://github.com/your-org/hirelens/issues)
3. Create a new issue with detailed information

---

**Built with ❤️ using Next.js, FastAPI, and modern development practices**