#!/bin/bash
# scripts/setup-env.sh - Environment setup script for different deployment stages

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Default values
ENVIRONMENT="development"
FORCE_OVERWRITE=false

# Function to print colored output
print_status() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

print_header() {
    echo -e "${BLUE}=== $1 ===${NC}"
}

# Help function
show_help() {
    cat << EOF
HireLens Environment Setup Script

Usage: $0 [OPTIONS]

OPTIONS:
    -e, --environment ENV    Set environment (development|staging|production)
    -f, --force             Force overwrite existing .env file
    -h, --help              Show this help message

EXAMPLES:
    $0                                   # Setup development environment
    $0 -e staging                        # Setup staging environment
    $0 -e production -f                  # Setup production environment, overwrite existing .env

EOF
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -e|--environment)
            ENVIRONMENT="$2"
            shift 2
            ;;
        -f|--force)
            FORCE_OVERWRITE=true
            shift
            ;;
        -h|--help)
            show_help
            exit 0
            ;;
        *)
            print_error "Unknown option: $1"
            show_help
            exit 1
            ;;
    esac
done

# Validate environment
if [[ ! "$ENVIRONMENT" =~ ^(development|staging|production)$ ]]; then
    print_error "Invalid environment: $ENVIRONMENT"
    print_error "Valid environments: development, staging, production"
    exit 1
fi

print_header "HireLens Environment Setup - $ENVIRONMENT"

# Check if .env exists
if [[ -f .env ]] && [[ "$FORCE_OVERWRITE" = false ]]; then
    print_warning ".env file already exists"
    read -p "Do you want to overwrite it? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        print_status "Setup cancelled"
        exit 0
    fi
fi

# Copy .env.example to .env
if [[ -f .env.example ]]; then
    cp .env.example .env
    print_status "Created .env from .env.example"
else
    print_error ".env.example not found!"
    exit 1
fi

# Generate secure keys for production/staging
generate_secure_key() {
    openssl rand -hex 32 2>/dev/null || python3 -c "import secrets; print(secrets.token_hex(32))" 2>/dev/null || node -e "console.log(require('crypto').randomBytes(32).toString('hex'))" 2>/dev/null || echo "CHANGE-THIS-SECURE-KEY-$(date +%s)"
}

# Update environment-specific settings
case $ENVIRONMENT in
    development)
        print_status "Setting up development environment..."
        
        # Development-specific settings
        sed -i.bak "s/NODE_ENV=.*/NODE_ENV=development/" .env
        sed -i.bak "s/NEXT_PUBLIC_APP_ENV=.*/NEXT_PUBLIC_APP_ENV=development/" .env
        sed -i.bak "s/LOG_LEVEL=.*/LOG_LEVEL=DEBUG/" .env
        sed -i.bak "s/NEXT_PUBLIC_LOG_LEVEL=.*/NEXT_PUBLIC_LOG_LEVEL=debug/" .env
        sed -i.bak "s/ENABLE_HOT_RELOAD=.*/ENABLE_HOT_RELOAD=true/" .env
        sed -i.bak "s/DEBUG_MODE=.*/DEBUG_MODE=true/" .env
        sed -i.bak "s/NEXT_PUBLIC_ENABLE_REMOTE_LOGGING=.*/NEXT_PUBLIC_ENABLE_REMOTE_LOGGING=false/" .env
        sed -i.bak "s/ENABLE_ANALYTICS=.*/ENABLE_ANALYTICS=false/" .env
        ;;
        
    staging)
        print_status "Setting up staging environment..."
        
        # Generate secure keys
        API_SECRET=$(generate_secure_key)
        JWT_SECRET=$(generate_secure_key)
        
        # Staging-specific settings
        sed -i.bak "s/NODE_ENV=.*/NODE_ENV=staging/" .env
        sed -i.bak "s/NEXT_PUBLIC_APP_ENV=.*/NEXT_PUBLIC_APP_ENV=staging/" .env
        sed -i.bak "s/LOG_LEVEL=.*/LOG_LEVEL=INFO/" .env
        sed -i.bak "s/NEXT_PUBLIC_LOG_LEVEL=.*/NEXT_PUBLIC_LOG_LEVEL=info/" .env
        sed -i.bak "s/API_SECRET_KEY=.*/API_SECRET_KEY=$API_SECRET/" .env
        sed -i.bak "s/JWT_SECRET=.*/JWT_SECRET=$JWT_SECRET/" .env
        sed -i.bak "s/ENABLE_HOT_RELOAD=.*/ENABLE_HOT_RELOAD=false/" .env
        sed -i.bak "s/DEBUG_MODE=.*/DEBUG_MODE=false/" .env
        sed -i.bak "s/NEXT_PUBLIC_ENABLE_REMOTE_LOGGING=.*/NEXT_PUBLIC_ENABLE_REMOTE_LOGGING=true/" .env
        sed -i.bak "s/ENABLE_ANALYTICS=.*/ENABLE_ANALYTICS=false/" .env
        ;;
        
    production)
        print_status "Setting up production environment..."
        
        # Generate secure keys
        API_SECRET=$(generate_secure_key)
        JWT_SECRET=$(generate_secure_key)
        
        # Production-specific settings
        sed -i.bak "s/NODE_ENV=.*/NODE_ENV=production/" .env
        sed -i.bak "s/NEXT_PUBLIC_APP_ENV=.*/NEXT_PUBLIC_APP_ENV=production/" .env
        sed -i.bak "s/LOG_LEVEL=.*/LOG_LEVEL=WARN/" .env
        sed -i.bak "s/NEXT_PUBLIC_LOG_LEVEL=.*/NEXT_PUBLIC_LOG_LEVEL=warn/" .env
        sed -i.bak "s/API_SECRET_KEY=.*/API_SECRET_KEY=$API_SECRET/" .env
        sed -i.bak "s/JWT_SECRET=.*/JWT_SECRET=$JWT_SECRET/" .env
        sed -i.bak "s/ENABLE_HOT_RELOAD=.*/ENABLE_HOT_RELOAD=false/" .env
        sed -i.bak "s/DEBUG_MODE=.*/DEBUG_MODE=false/" .env
        sed -i.bak "s/NEXT_PUBLIC_ENABLE_REMOTE_LOGGING=.*/NEXT_PUBLIC_ENABLE_REMOTE_LOGGING=true/" .env
        sed -i.bak "s/ENABLE_ANALYTICS=.*/ENABLE_ANALYTICS=true/" .env
        sed -i.bak "s/ENABLE_HTTPS=.*/ENABLE_HTTPS=true/" .env
        
        print_warning "IMPORTANT: Update production URLs and database settings manually!"
        print_warning "- Set NEXT_PUBLIC_API_URL to your production API URL"
        print_warning "- Configure DATABASE_URL for production database"
        print_warning "- Set up SSL certificates"
        print_warning "- Configure SENTRY_DSN for error tracking"
        ;;
esac

# Clean up backup files
rm -f .env.bak 2>/dev/null || true

# Create necessary directories
print_status "Creating necessary directories..."
mkdir -p uploads/{resumes,temp,parsed,jobs,comparisons}
mkdir -p logs
mkdir -p data/{rankings,exports}

# Set appropriate permissions
chmod 755 uploads
chmod 755 logs
chmod 755 data

print_status "Environment setup complete!"

# Display summary
print_header "Configuration Summary"
echo "Environment: $ENVIRONMENT"
echo "Configuration file: .env"
echo "Upload directory: uploads/"
echo "Log directory: logs/"

if [[ "$ENVIRONMENT" = "production" ]]; then
    print_header "Production Checklist"
    echo "[ ] Update API URLs in .env"
    echo "[ ] Configure production database"
    echo "[ ] Set up SSL certificates"
    echo "[ ] Configure monitoring (Sentry)"
    echo "[ ] Set up backup strategy"
    echo "[ ] Review security settings"
    echo "[ ] Configure email service"
    echo "[ ] Test all features"
fi

print_status "Next steps:"
echo "1. Review and update .env file with your specific settings"
echo "2. Install dependencies: npm install && cd server && pip install -r requirements.txt"
echo "3. Start the application: npm run dev (or use scripts/dev.sh)"

if [[ "$ENVIRONMENT" != "development" ]]; then
    echo "4. Test the configuration thoroughly before deploying"
fi