#!/bin/bash

# Autonomous Coding Agent CLI Test Script
# This script demonstrates how to use the CLI tool for local testing

echo "🤖 Autonomous Coding Agent CLI Test"
echo "=================================="
echo ""

# Check if .env file exists
if [ ! -f .env ]; then
    echo "❌ Error: .env file not found"
    echo "Please copy env.example to .env and fill in your API keys:"
    echo "  cp env.example .env"
    echo "  # Edit .env with ANTHROPIC_API_KEY and GITHUB_TOKEN"
    exit 1
fi

# Check if project is built
if [ ! -d dist ]; then
    echo "🔨 Building project..."
    pnpm build
    if [ $? -ne 0 ]; then
        echo "❌ Build failed. Please fix any compilation errors."
        exit 1
    fi
fi

echo "ℹ️  Available CLI commands:"
echo ""
echo "1. Show CLI help:"
echo "   pnpm cli --help"
echo ""
echo "2. Process a custom task:"
echo '   pnpm cli process \'
echo '     --repository "https://github.com/your-username/your-repo" \'
echo '     --task-id "TEST-001" \'
echo '     --title "Add README badge" \'
echo '     --description "Add a build status badge to the README.md file" \'
echo '     --priority "Low"'
echo ""
echo "3. Process a GitHub issue:"
echo '   pnpm cli issue \'
echo '     --repository "https://github.com/your-username/your-repo" \'
echo '     --number 1'
echo ""
echo "4. List active tasks:"
echo "   pnpm cli list"
echo ""
echo "5. Check task status:"
echo '   pnpm cli status --task-id "TEST-001"'
echo ""

# Interactive demo
read -p "Would you like to see the CLI help? (y/n): " show_help
if [[ $show_help =~ ^[Yy]$ ]]; then
    echo ""
    echo "📖 CLI Help:"
    echo "============"
    pnpm cli --help
    echo ""
fi

read -p "Would you like to see the 'process' command help? (y/n): " show_process_help
if [[ $show_process_help =~ ^[Yy]$ ]]; then
    echo ""
    echo "📖 Process Command Help:"
    echo "========================"
    pnpm cli process --help
    echo ""
fi

read -p "Would you like to see the 'issue' command help? (y/n): " show_issue_help
if [[ $show_issue_help =~ ^[Yy]$ ]]; then
    echo ""
    echo "📖 Issue Command Help:"
    echo "======================"
    pnpm cli issue --help
    echo ""
fi

echo "🔗 For detailed examples and usage, see:"
echo "   - docs/CLI_USAGE.md - Comprehensive CLI examples"
echo "   - README.md - Full documentation"
echo "   - docs/VPS_DEPLOYMENT.md - Production deployment guide"
echo ""

echo "✅ CLI test script completed!"
echo ""
echo "🚀 Next steps:"
echo "   1. Set up your .env file with API keys"
echo "   2. Try running a test command against a GitHub repository"
echo "   3. Monitor the progress and review the generated pull request"
echo ""
