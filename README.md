# HireLens - Intelligent Recruitment Platform

> A comprehensive ATS (Applicant Tracking System) solution that streamlines recruitment processes through intelligent resume parsing, automated candidate scoring, and data-driven insights.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Next.js](https://img.shields.io/badge/Next.js-15-black)](https://nextjs.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.104.1-009688.svg)](https://fastapi.tiangolo.com/)
[![Python](https://img.shields.io/badge/Python-3.11+-blue.svg)](https://python.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-blue)](https://www.typescriptlang.org/)
[![TailwindCSS](https://img.shields.io/badge/TailwindCSS-3-38B2AC)](https://tailwindcss.com/)

## 🎯 Project Overview

HireLens is an end-to-end recruitment platform designed to modernize talent acquisition processes. Built with cutting-edge technologies, it combines NLP-powered document processing with intuitive UI/UX to help recruiters make data-driven hiring decisions efficiently.

### Key Value Propositions

- **NLP-Powered Parsing**: Automatically extract structured data from resumes in multiple formats (PDF, DOCX, DOC)
- **Intelligent ATS Scoring**: Sophisticated algorithms score candidates against job requirements with customizable weights
- **Data-Driven Insights**: Comprehensive analytics dashboard providing actionable recruitment metrics
- **Mobile-First Design**: Fully responsive interface optimized for all devices and screen sizes
- **Real-time Processing**: Asynchronous processing with live status updates

## 🏗️ Architecture & Tech Stack

### Frontend (Next.js 15)
- **Framework**: Next.js 15 with App Router for modern React development
- **Language**: TypeScript for type safety and maintainability
- **UI Library**: Tailwind CSS + Radix UI for responsive, accessible components
- **State Management**: React hooks and context API
- **Component Library**: Custom-built UI components with responsive variants
- **Performance**: Optimized with Next.js features like code splitting and image optimization

### Backend (FastAPI)
- **Framework**: FastAPI for high-performance, async Python API
- **Language**: Python 3.11+ with type hints
- **Data Validation**: Pydantic v2 for robust data validation
- **NLP Processing**: NLTK and spaCy for text analysis and entity extraction
- **File Processing**: PyPDF2, pdfplumber, PyMuPDF, python-docx for multi-format document parsing
- **Data Analysis**: pandas, numpy, scikit-learn for analytics and scoring algorithms
- **Asynchronous Processing**: Built-in async support with uvicorn ASGI server

### Shared Infrastructure
- **Monorepo Structure**: Shared TypeScript types between frontend and backend
- **Environment Management**: python-dotenv for configuration
- **Logging**: structlog for structured logging
- **Testing**: Jest for frontend, pytest for backend
- **Deployment**: Docker support with docker-compose

## 🧠 Algorithms & Techniques

### Resume Parsing Pipeline
- **Text Extraction**: Multi-library approach using PyPDF2, pdfplumber, and PyMuPDF for robust PDF parsing
- **Document Structure Analysis**: Identification of sections (contact info, experience, education, skills) using regex patterns and NLTK tokenization
- **Entity Recognition**: Rule-based extraction for names, emails, phone numbers, and LinkedIn profiles
- **Skills Extraction**: Dictionary-based matching with fuzzy string matching for variant recognition

### ATS Scoring Algorithm
- **Multi-Criteria Weighted Scoring**: 
  - Skills Match (40% weight): Jaccard similarity between candidate skills and job requirements
  - Experience Match (30% weight): Years of experience calculation with role relevance scoring
  - Education Match (20% weight): Degree level matching and field relevance
  - Keyword Match (10% weight): TF-IDF based keyword frequency analysis
- **Similarity Metrics**: 
  - Jaccard Similarity for skills matching
  - Cosine Similarity for keyword analysis
  - Fuzzy String Matching for variant recognition
- **Normalization**: Min-max scaling to ensure consistent scoring across different job types

### Candidate Ranking System
- **Composite Scoring**: Weighted combination of individual ATS scores
- **Ranking Algorithm**: Simple sorting by composite score with tie-breaking rules
- **Shortlisting Logic**: Threshold-based filtering with configurable cutoffs

### Analytics Engine
- **Trend Analysis**: Time-series analysis using pandas for hiring metrics
- **Skills Gap Identification**: Frequency analysis of required vs. available skills
- **Performance Metrics**: Statistical analysis of hiring pipeline efficiency
- **Clustering**: K-means clustering for candidate segmentation (in development)

## 🚀 Core Features

### 📄 Resume Intelligence
- Multi-format document parsing (PDF, DOCX, DOC)
- NLP-powered entity extraction (contact info, skills, experience, education)
- Bulk resume processing with progress tracking
- Structured data storage for easy retrieval and analysis

### 💼 Job Management System
- Comprehensive job description modeling with custom requirements
- Configurable ATS scoring criteria with weighted parameters
- Job performance analytics and metrics
- CRUD operations for job postings

### 🎯 ATS Scoring Engine
- Multi-criteria candidate evaluation (skills, experience, education, keywords)
- Customizable weight distribution for different scoring factors
- Detailed scoring breakdowns with improvement recommendations
- Batch processing for comparing multiple candidates against job requirements

### 📊 Analytics Dashboard
- Real-time system health monitoring
- Skills gap analysis and market trend identification
- Hiring pipeline performance insights
- Data visualization with interactive charts and metrics

### 🏆 Candidate Ranking
- Algorithm-based shortlist generation based on job matches
- Side-by-side candidate comparison tools
- Pipeline management with status tracking
- Exportable reports and candidate summaries

### 📱 Mobile-Optimized Interface
- Fully responsive design for all device sizes
- Touch-friendly navigation and controls
- Adaptive layouts with mobile-first approach
- Performance-optimized for mobile networks

## 📁 Project Structure

```
hirelens/
├── client/                 # Next.js frontend application
│   ├── app/               # App router with page components
│   ├── components/        # Reusable UI components
│   ├── lib/               # Client utilities, API services, and helpers
│   └── public/            # Static assets
├── server/                 # FastAPI backend application
│   ├── app/               # API routes, models, and services
│   │   ├── api/           # REST API endpoints
│   │   ├── models/        # Pydantic data models
│   │   ├── services/      # Business logic implementations
│   │   └── utils/         # Utility functions
│   └── requirements.txt   # Python dependencies
├── packages/              # Shared packages
│   ├── shared-types/      # TypeScript interfaces shared between client/server
│   └── config/            # Configuration management
├── scripts/               # Development and deployment scripts
└── docker-compose.yml     # Container orchestration
```

## 🛠️ Development Setup

### Prerequisites
- Node.js 19+
- Python 3.11+
- Git

### Quick Start
```bash
# Clone the repository
git clone <repository-url>
cd hirelens

# Install frontend dependencies
npm install

# Copy environment template
cp .env.example .env  # Unix/Linux
copy .env.example .env  # Windows

# Start development environment
npm run dev
```

### Backend Setup (Manual)
```bash
# Navigate to server directory
cd server

# Create virtual environment (recommended)
python -m venv venv

# Activate virtual environment
# On Windows:
venv\Scripts\activate
# On macOS/Linux:
source venv/bin/activate

# Install Python dependencies
pip install -r requirements.txt

# Run the FastAPI server with uvicorn
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

### Access Points
- **Frontend**: [http://localhost:3000](http://localhost:3000)
- **Backend API**: [http://localhost:8000](http://localhost:8000)
- **API Docs**: [http://localhost:8000/docs](http://localhost:8000/docs)

## 🎨 UI/UX Highlights

### Responsive Design System
- Mobile-first approach with adaptive layouts
- Custom responsive component variants (buttons, cards, grids)
- Touch-friendly interactive elements
- Optimized performance for mobile networks

### Component Library
- Accessible UI components built with Radix UI
- Consistent design language with Tailwind CSS
- Reusable components with variant support
- Dark mode support with next-themes

### Performance Optimizations
- Code splitting with Next.js dynamic imports
- Image optimization with Next.js Image component
- Client-side caching for API responses
- Lazy loading for non-critical resources

## 🔧 Technical Highlights

### Type Safety
- End-to-end type safety with shared TypeScript interfaces
- Pydantic models aligned with TypeScript types
- Strict TypeScript configuration with comprehensive checks
- Runtime validation with Pydantic for API payloads

### Asynchronous Processing
- Non-blocking file uploads and processing
- Real-time status updates with progress indicators
- Background task management with async/await
- Efficient resource utilization with FastAPI's async support

### Data Management
- Structured data storage with JSON-based persistence
- Efficient data retrieval with caching strategies
- Bulk operations for processing multiple items
- Data validation at every layer (client, API, storage)

## 🚀 Deployment

### Docker Deployment
```bash
# Development environment
docker-compose up -d

# Production build (when configured)
docker-compose -f docker-compose.prod.yml up -d
```

### Environment Configuration
Key environment variables:
- `PORT`: Server port (default: 8000)
- `NEXT_PUBLIC_API_URL`: API endpoint for frontend
- `UPLOAD_DIR`: Directory for file uploads
- `LOG_LEVEL`: Application logging level
- `SECRET_KEY`: Security key for production

## 🧪 Quality Assurance

### Testing Strategy
- Unit tests for critical business logic
- Component tests for UI elements
- Integration tests for API endpoints
- End-to-end tests for core workflows

### Code Quality
- ESLint and Prettier for code formatting
- TypeScript for compile-time error checking
- Automated type checking in CI pipeline
- Code review processes for all changes

## 📈 Performance Metrics

### System Benchmarks
- Sub-second resume parsing for standard documents
- Real-time scoring calculations with <500ms response
- Concurrent processing support for bulk operations
- Optimized memory usage for large file processing

### Scalability Features
- Horizontal scaling support through containerization
- Database-ready architecture (currently file-based)
- Caching strategies for frequently accessed data
- Load balancing compatibility

## 🤝 Contributing

We welcome contributions from the community! To contribute:

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Commit your changes: `git commit -m 'Add amazing feature'`
4. Push to the branch: `git push origin feature/amazing-feature`
5. Open a pull request

### Development Guidelines
- Follow established code patterns and conventions
- Write tests for new functionality
- Ensure type safety across client and server
- Maintain backward compatibility when possible

## 📚 Documentation

- **API Documentation**: Auto-generated Swagger UI at `/docs`
- **Architecture Diagrams**: Available in the `docs/` directory
- **Component Library**: Storybook documentation (coming soon)
- **Deployment Guide**: Detailed deployment instructions in `docs/`

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

For support and inquiries:
1. Check the documentation in the `docs/` directory
2. Review existing issues in the GitHub repository
3. Create a new issue with detailed information about your question or problem

---

*Built with ❤️ for modern recruitment teams*