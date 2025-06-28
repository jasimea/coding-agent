# CLI Usage Examples

This document provides practical examples of using the Autonomous Coding Agent CLI tool for local testing and development.

## Prerequisites

1. **Setup Environment Variables**:
   ```bash
   cp env.example .env
   # Edit .env with your API keys:
   # ANTHROPIC_API_KEY=sk-ant-xxxxx
   # GITHUB_TOKEN=ghp_xxxxx
   ```

2. **Build the Project**:
   ```bash
   pnpm install
   pnpm build
   ```

## Basic CLI Usage

### 1. Process a Simple Task

Test the agent with a basic task:

```bash
pnpm cli process \
  --repository "https://github.com/your-username/test-repo" \
  --task-id "TEST-001" \
  --title "Add README badge" \
  --description "Add a build status badge to the README.md file" \
  --priority "Low"
```

### 2. Process a GitHub Issue

If you have a GitHub repository with an open issue:

```bash
pnpm cli issue \
  --repository "https://github.com/your-username/your-repo" \
  --number 1
```

### 3. Monitor Task Progress

Check the status of a running task:

```bash
pnpm cli status --task-id "TEST-001"
```

### 4. List All Active Tasks

See all currently running tasks:

```bash
pnpm cli list
```

## Real-World Examples

### Example 1: Fix a Bug in a React Application

```bash
pnpm cli process \
  --repository "https://github.com/your-org/react-dashboard" \
  --task-id "BUG-001" \
  --title "Fix navbar responsive design" \
  --description "The navigation bar breaks on mobile devices. It should collapse into a hamburger menu on screens smaller than 768px." \
  --priority "High" \
  --criteria "Navbar collapses on mobile, hamburger menu works, no layout breaks" \
  --labels "bug,frontend,responsive"
```

### Example 2: Add a New Feature to an API

```bash
pnpm cli process \
  --repository "https://github.com/your-org/api-server" \
  --task-id "FEAT-002" \
  --title "Add user avatar upload" \
  --description "Implement endpoint for users to upload and update their profile pictures. Support JPG and PNG formats, max 5MB." \
  --criteria "POST /api/user/avatar endpoint, file validation, image resizing, error handling" \
  --priority "Medium"
```

### Example 3: Implement Tests

```bash
pnpm cli process \
  --repository "https://github.com/your-org/utils-library" \
  --task-id "TEST-003" \
  --title "Add unit tests for utility functions" \
  --description "Create comprehensive unit tests for the string manipulation utilities in src/utils/string.js" \
  --criteria "100% test coverage, edge cases covered, Jest framework" \
  --priority "Medium" \
  --labels "testing,utils"
```

## CLI Workflow

When you run a CLI command, here's what happens:

1. **Repository Clone**: The agent clones the specified repository to a temporary workspace
2. **Analysis**: Analyzes the codebase structure, dependencies, and coding patterns
3. **Planning**: Uses Claude AI to generate a detailed implementation plan
4. **Branch Creation**: Creates a new feature branch with a descriptive name
5. **Pull Request**: Creates a PR with a planning summary
6. **Planning Comment**: Posts a detailed plan as a PR comment
7. **Implementation**: Executes the implementation plan
8. **Progress Updates**: Updates the PR with implementation progress
9. **Completion**: Marks the task as complete

## Tips for Effective CLI Usage

### 1. Repository Preparation

Ensure your repository has:
- Clear README with project description
- Proper dependency management (package.json, requirements.txt, etc.)
- Existing code structure that follows patterns
- Recent commits showing active development

### 2. Task Description Best Practices

- **Be Specific**: "Add login form validation" vs "Fix login"
- **Include Context**: Mention relevant files, technologies, or constraints
- **Define Success**: Use acceptance criteria to define when the task is complete
- **Provide Examples**: Include expected behavior or output

### 3. Monitoring and Debugging

- Use `pnpm cli list` to see all active tasks
- Monitor progress with `pnpm cli status --task-id "YOUR-TASK-ID"`
- Check logs in the `logs/` directory for detailed information
- Review the generated PR for planning details and implementation notes

### 4. Testing Different Scenarios

Try the CLI with different types of tasks:
- Bug fixes
- New features
- Refactoring
- Documentation updates
- Test implementation
- Performance improvements

## Advanced Usage

### Custom Task with Complex Requirements

```bash
pnpm cli process \
  --repository "https://github.com/your-org/ecommerce-app" \
  --task-id "FEAT-CART-001" \
  --title "Implement shopping cart persistence" \
  --description "Add functionality to persist shopping cart items across browser sessions using localStorage. When users add items to cart, they should remain there even after closing and reopening the browser." \
  --criteria "Items persist in localStorage, cart state restored on page load, handles edge cases like corrupted data, includes unit tests" \
  --priority "High" \
  --labels "feature,frontend,persistence,cart"
```

### Processing Multiple Related Issues

You can process multiple related GitHub issues sequentially:

```bash
# Process issue #1
pnpm cli issue --repository "https://github.com/your-org/project" --number 1

# Wait for completion, then process issue #2
pnpm cli issue --repository "https://github.com/your-org/project" --number 2
```

## Troubleshooting

### Common Issues

1. **API Key Issues**:
   - Ensure ANTHROPIC_API_KEY is set correctly
   - Check that your Claude API key is valid and has credits

2. **GitHub Permission Issues**:
   - Verify GITHUB_TOKEN has repository access
   - Make sure the token has push permissions for creating branches
   - Check that the repository exists and is accessible

3. **Repository Access**:
   - Ensure the repository URL is correct
   - For private repositories, verify token permissions
   - Check that the repository has recent activity

4. **Task Processing Failures**:
   - Review logs in `logs/task-processor.log`
   - Check the generated planning comment for insights
   - Verify the repository has clear code structure

### Debug Mode

Enable debug logging for more detailed output:

```bash
# Add to your .env file
LOG_LEVEL=debug

# Then run CLI commands to see detailed logs
pnpm cli process --repository "..." --task-id "..." --title "..." --description "..."
```

## Next Steps

After successfully running CLI commands:

1. **Review the Generated PR**: Check the implementation quality and planning details
2. **Test the Changes**: Clone the branch and test the implemented functionality
3. **Provide Feedback**: Use the insights to improve future task descriptions
4. **Scale to Production**: Set up webhook integration for automatic processing

For production deployment with webhook integration, see [VPS_DEPLOYMENT.md](VPS_DEPLOYMENT.md).
