#!/bin/bash

# Autonomous Coding Agent Deployment Script
# This script helps deploy the coding agent on a VPS

set -e

echo "🚀 Autonomous Coding Agent Deployment Script"
echo "============================================="

# Check if running as root
if [ "$EUID" -eq 0 ]; then
  echo "❌ Please don't run this script as root"
  exit 1
fi

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Check prerequisites
echo "📋 Checking prerequisites..."

if ! command_exists docker; then
    echo "❌ Docker is not installed. Please install Docker first."
    echo "Run: curl -fsSL https://get.docker.com -o get-docker.sh && sudo sh get-docker.sh"
    exit 1
fi

if ! command_exists docker-compose; then
    echo "❌ Docker Compose is not installed. Please install Docker Compose first."
    exit 1
fi

# Check if user is in docker group
if ! groups $USER | grep -q '\bdocker\b'; then
    echo "❌ User is not in docker group. Please run: sudo usermod -aG docker $USER"
    echo "Then logout and login again."
    exit 1
fi

echo "✅ Prerequisites check passed"

# Get configuration
echo ""
echo "🔧 Configuration Setup"
echo "======================"

if [ ! -f .env ]; then
    echo "📝 Creating environment configuration..."
    
    # Copy template
    cp env.example .env
    
    echo "Please provide the following information:"
    
    read -p "Enter your Anthropic API Key: " ANTHROPIC_API_KEY
    read -p "Enter your GitHub Token: " GITHUB_TOKEN
    read -p "Enter your domain name (e.g., coding-agent.example.com): " DOMAIN_NAME
    read -p "Enter webhook secret (or press Enter for random): " WEBHOOK_SECRET
    
    if [ -z "$WEBHOOK_SECRET" ]; then
        WEBHOOK_SECRET=$(openssl rand -hex 32)
        echo "Generated webhook secret: $WEBHOOK_SECRET"
    fi
    
    # Update .env file
    sed -i "s/your_anthropic_api_key_here/$ANTHROPIC_API_KEY/g" .env
    sed -i "s/your_github_token_here/$GITHUB_TOKEN/g" .env
    sed -i "s/your_webhook_secret_here/$WEBHOOK_SECRET/g" .env
    sed -i "s/your-domain.com/$DOMAIN_NAME/g" .env nginx.conf
    
    echo "✅ Environment configured"
else
    echo "✅ Environment file already exists"
fi

# SSL Setup
echo ""
echo "🔐 SSL Certificate Setup"
echo "========================"

if [ ! -d "ssl" ]; then
    mkdir ssl
fi

if [ ! -f "ssl/cert.pem" ] || [ ! -f "ssl/key.pem" ]; then
    echo "Choose SSL certificate option:"
    echo "1) Use Let's Encrypt (recommended for production)"
    echo "2) Generate self-signed certificate (for testing)"
    echo "3) I'll provide my own certificates"
    
    read -p "Enter choice (1-3): " ssl_choice
    
    case $ssl_choice in
        1)
            if command_exists certbot; then
                echo "🔄 Getting Let's Encrypt certificate..."
                source .env
                sudo certbot certonly --standalone -d $DOMAIN_NAME
                sudo cp /etc/letsencrypt/live/$DOMAIN_NAME/fullchain.pem ssl/cert.pem
                sudo cp /etc/letsencrypt/live/$DOMAIN_NAME/privkey.pem ssl/key.pem
                sudo chown $USER:$USER ssl/*
                echo "✅ Let's Encrypt certificate installed"
            else
                echo "❌ Certbot not installed. Installing..."
                sudo apt update
                sudo apt install -y certbot
                echo "Please run the script again to continue with Let's Encrypt"
                exit 1
            fi
            ;;
        2)
            echo "🔄 Generating self-signed certificate..."
            openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
                -keyout ssl/key.pem -out ssl/cert.pem \
                -subj "/C=US/ST=State/L=City/O=Organization/CN=$(grep DOMAIN_NAME .env | cut -d'=' -f2)"
            echo "✅ Self-signed certificate generated"
            ;;
        3)
            echo "📁 Please place your certificate files:"
            echo "  - ssl/cert.pem (certificate)"
            echo "  - ssl/key.pem (private key)"
            read -p "Press Enter when certificates are ready..."
            ;;
    esac
else
    echo "✅ SSL certificates already exist"
fi

# Build and start
echo ""
echo "🏗️  Building and Starting Services"
echo "=================================="

echo "🔄 Building Docker images..."
docker-compose build

echo "🔄 Starting services..."
docker-compose up -d

# Wait for services to start
echo "⏳ Waiting for services to start..."
sleep 10

# Health check
echo "🔍 Checking service health..."
if curl -f http://localhost:3000/health >/dev/null 2>&1; then
    echo "✅ Service is healthy!"
else
    echo "❌ Service health check failed. Checking logs..."
    docker-compose logs --tail=20 coding-agent
    exit 1
fi

# Display information
echo ""
echo "🎉 Deployment Complete!"
echo "======================"
echo ""
echo "📡 Webhook Endpoints:"
echo "  JIRA:   https://$(grep DOMAIN_NAME .env | cut -d'=' -f2)/webhook/jira"
echo "  Trello: https://$(grep DOMAIN_NAME .env | cut -d'=' -f2)/webhook/trello"
echo ""
echo "🔍 Management Endpoints:"
echo "  Health: https://$(grep DOMAIN_NAME .env | cut -d'=' -f2)/health"
echo "  Status: https://$(grep DOMAIN_NAME .env | cut -d'=' -f2)/api/tasks/{taskId}/status"
echo ""
echo "📋 Useful Commands:"
echo "  View logs:    docker-compose logs -f coding-agent"
echo "  Restart:      docker-compose restart"
echo "  Stop:         docker-compose down"
echo "  Update:       git pull && docker-compose build && docker-compose up -d"
echo ""
echo "🔐 Security Notes:"
echo "  - Webhook secret: $(grep WEBHOOK_SECRET .env | cut -d'=' -f2)"
echo "  - Configure this secret in your JIRA/Trello webhooks"
echo "  - SSL certificates are in the ssl/ directory"
echo ""
echo "📖 Next Steps:"
echo "  1. Configure JIRA/Trello webhooks with the URLs above"
echo "  2. Test with: curl -X POST https://your-domain/api/tasks/trigger"
echo "  3. Monitor logs for any issues"
echo ""
echo "For detailed setup instructions, see docs/VPS_DEPLOYMENT.md"
