// src/advanced-planning.ts
// Using direct API calls to avoid TypeScript compatibility issues
import * as fs from 'fs/promises';
import * as path from 'path';
import { 
  TaskInfo, 
  RepoContext, 
  RepoAnalysis, 
  PlanComponents, 
  PlanResult
} from './types';

export class AdvancedPlanningSystem {
  private apiKey: string;
  private templatesDir: string;
  private model: string = 'claude-3-5-sonnet-20241022';
  
  /**
   * Helper method to generate text using the Anthropic AI SDK
   */
  private async generateWithAI(prompt: string, maxTokens: number = 2000): Promise<string> {
    try {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.apiKey,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
          model: this.model,
          messages: [{ role: 'user', content: prompt }],
          max_tokens: maxTokens
        })
      });
      
      if (!response.ok) {
        throw new Error(`API request failed with status ${response.status}`);
      }
      
      const data = await response.json();
      return data.content?.[0]?.text || '';
    } catch (error) {
      console.error('Error generating text with AI:', error);
      return 'Error generating response. Please check your API key and try again.';
    }
  }

  constructor(apiKey: string) {
    this.apiKey = apiKey;
    this.templatesDir = path.join(__dirname, 'planning-templates');
  }

  async generateComprehensivePlan(taskInfo: TaskInfo, repoContext: RepoContext): Promise<PlanResult> {
    // Step 1: Analyze the repository structure
    const repoAnalysis = await this.analyzeRepository(repoContext);

    // Step 2: Generate initial plan
    const initialPlan = await this.generateInitialPlan(taskInfo, repoAnalysis);

    // Step 3: Refine plan with technical details
    const technicalPlan = await this.refinePlanWithTechnicalDetails(initialPlan, repoAnalysis);

    // Step 4: Add testing strategy
    const testingStrategy = await this.generateTestingStrategy(technicalPlan, repoAnalysis);

    // Step 5: Risk assessment
    const riskAssessment = await this.generateRiskAssessment(technicalPlan, repoAnalysis);

    // Step 6: Create final comprehensive plan
    return this.compileFinalPlan({
      taskInfo,
      repoAnalysis,
      initialPlan,
      technicalPlan,
      testingStrategy,
      riskAssessment
    });
  }

  async analyzeRepository(repoContext: RepoContext): Promise<RepoAnalysis> {
    const analysisPrompt = `
Analyze this repository structure and provide insights:

Repository: ${repoContext.name}
Branch: ${repoContext.branch}
Files: ${JSON.stringify(repoContext.fileStructure, null, 2)}
Package.json: ${JSON.stringify(repoContext.packageJson, null, 2)}
README: ${repoContext.readme}

Please provide:
1. **Technology Stack**: Languages, frameworks, tools used
2. **Architecture Pattern**: MVC, microservices, monolith, etc.
3. **Code Organization**: How the code is structured
4. **Dependencies**: Key libraries and their purposes
5. **Testing Setup**: Current testing framework and patterns
6. **Build System**: How the project is built and deployed
7. **Coding Standards**: Any patterns or conventions observed
8. **Integration Points**: APIs, databases, external services
    `;

    const analysis = await this.generateWithAI(analysisPrompt, 2000);

    return {
      analysis: analysis,
      timestamp: new Date().toISOString()
    };
  }

  async generateInitialPlan(taskInfo: TaskInfo, repoAnalysis: RepoAnalysis): Promise<string> {
    const planningPrompt = `
Create a detailed implementation plan for this task:

**Task Information:**
- ID: ${taskInfo.taskId}
- Title: ${taskInfo.title}
- Description: ${taskInfo.description}
- Priority: ${taskInfo.priority}
- Labels: ${taskInfo.labels?.join(', ') || 'None'}
- Acceptance Criteria: ${taskInfo.acceptanceCriteria || 'To be defined'}

**Repository Context:**
${repoAnalysis.analysis}

**Planning Framework:**

## 1. REQUIREMENTS ANALYSIS
- Functional requirements breakdown
- Non-functional requirements (performance, security, etc.)
- Business logic requirements
- UI/UX requirements (if applicable)
- Integration requirements

## 2. TECHNICAL APPROACH
- Architecture decisions and rationale
- Design patterns to implement
- Technology choices and justification
- Data model changes (if any)
- API design (if applicable)

## 3. IMPLEMENTATION STRATEGY
- Development phases breakdown
- File structure and organization
- Module/component design
- Database schema changes
- Configuration updates needed

## 4. DEPENDENCIES & PREREQUISITES
- External dependencies to add/update
- Internal dependencies and order
- Environment setup requirements
- Third-party service integrations

## 5. DETAILED IMPLEMENTATION STEPS
Provide step-by-step implementation with:
- Specific files to create/modify
- Code snippets or pseudocode
- Configuration changes
- Database migrations
- Order of implementation

Make this plan actionable and specific to the codebase.
    `;

    return await this.generateWithAI(planningPrompt, 3000);
  }

  async refinePlanWithTechnicalDetails(initialPlan: string, repoAnalysis: RepoAnalysis): Promise<string> {
    const refinementPrompt = `
Refine this implementation plan with detailed technical specifications:

**Initial Plan:**
${initialPlan}

**Repository Analysis:**
${repoAnalysis.analysis}

Please enhance the plan with:

## TECHNICAL SPECIFICATIONS
- Detailed API endpoints (methods, paths, parameters)
- Database schema definitions
- Component interfaces and props
- Service layer architecture
- Error handling strategies
- Performance considerations
- Security implementation details

## CODE STRUCTURE
- Exact file paths and naming conventions
- Import/export patterns
- Class/function signatures
- Configuration file changes
- Environment variable requirements

## INTEGRATION DETAILS
- External API integration patterns
- Database query patterns
- Event handling and state management
- Caching strategies (if applicable)
- Logging and monitoring points

Focus on implementation details that Claude Code can directly execute.
    `;

    return await this.generateWithAI(refinementPrompt, 3000);
  }

  async generateTestingStrategy(technicalPlan: string, repoAnalysis: RepoAnalysis): Promise<string> {
    const testingPrompt = `
Create a comprehensive testing strategy for this implementation:

**Technical Plan:**
${technicalPlan}

**Repository Testing Setup:**
${repoAnalysis.analysis}

Provide detailed testing strategy including:

## UNIT TESTING
- Test files to create and their locations
- Test scenarios and edge cases
- Mock requirements and setup
- Test data requirements
- Coverage targets

## INTEGRATION TESTING
- API endpoint testing
- Database integration tests
- Service integration tests
- External service mocking

## END-TO-END TESTING
- User journey tests
- Browser/UI tests (if applicable)
- Performance tests
- Load testing scenarios

## TEST IMPLEMENTATION PLAN
- Testing framework setup
- Test utilities and helpers
- CI/CD pipeline integration
- Test data management
- Automated test execution

Include specific test files to create and their content structure.
    `;

    return await this.generateWithAI(testingPrompt, 2000);
  }

  async generateRiskAssessment(technicalPlan: string, repoAnalysis: RepoAnalysis): Promise<string> {
    const riskPrompt = `
Conduct a risk assessment for this implementation:

**Technical Plan:**
${technicalPlan}

**Repository Context:**
${repoAnalysis.analysis}

Analyze and document:

## TECHNICAL RISKS
- Breaking changes potential
- Performance impact
- Security vulnerabilities
- Compatibility issues
- Scalability concerns

## IMPLEMENTATION RISKS
- Complexity assessment
- Timeline risks
- Resource requirements
- External dependencies
- Integration challenges

## MITIGATION STRATEGIES
- Risk prevention measures
- Fallback plans
- Rollback procedures
- Monitoring and alerting
- Validation checkpoints

## DEPLOYMENT CONSIDERATIONS
- Environment-specific concerns
- Migration requirements
- Downtime considerations
- Feature flags usage
- Gradual rollout strategy

Rate each risk as High/Medium/Low and provide specific mitigation steps.
    `;

    return await this.generateWithAI(riskPrompt, 2000);
  }

  compileFinalPlan(planComponents: PlanComponents): PlanResult {
    const { taskInfo, repoAnalysis, initialPlan, technicalPlan, testingStrategy, riskAssessment } = planComponents;

    const finalPlan = `
# Implementation Plan: ${taskInfo.title}

**Task ID:** ${taskInfo.taskId}  
**Priority:** ${taskInfo.priority}  
**Generated:** ${new Date().toISOString()}

---

## 📋 TASK OVERVIEW

### Requirements
${taskInfo.description}

### Acceptance Criteria
${taskInfo.acceptanceCriteria || 'To be defined during implementation'}

---

## 🏗️ REPOSITORY ANALYSIS

${repoAnalysis.analysis}

---

## 📐 INITIAL PLANNING

${initialPlan}

---

## 🔧 TECHNICAL SPECIFICATIONS

${technicalPlan}

---

## 🧪 TESTING STRATEGY

${testingStrategy}

---

## ⚠️ RISK ASSESSMENT

${riskAssessment}

---

## 📊 IMPLEMENTATION CHECKLIST

### Pre-Implementation
- [ ] Repository cloned and branch created
- [ ] Dependencies reviewed and updated
- [ ] Development environment prepared
- [ ] Plan reviewed and approved

### Implementation Phase
- [ ] Core functionality implemented
- [ ] Integration points established
- [ ] Error handling added
- [ ] Performance optimizations applied

### Testing Phase
- [ ] Unit tests written and passing
- [ ] Integration tests implemented
- [ ] End-to-end tests created
- [ ] Performance tests executed

### Documentation & Cleanup
- [ ] Code documentation updated
- [ ] README updated (if needed)
- [ ] Configuration documented
- [ ] Deployment notes prepared

### Review & Deployment
- [ ] Code review completed
- [ ] Security review passed
- [ ] Performance benchmarks met
- [ ] Ready for production deployment

---

*This plan was automatically generated and will guide the Claude Code implementation process.*
    `;

    return {
      fullPlan: finalPlan,
      summary: this.generatePlanSummary(finalPlan),
      complexity: this.assessComplexity(finalPlan),
      estimatedHours: this.estimateImplementationTime(finalPlan),
      components: planComponents
    };
  }

  generatePlanSummary(fullPlan: string): string {
    // Extract key implementation points
    const lines = fullPlan.split('\n');
    const keyPoints: string[] = [];

    lines.forEach(line => {
      if (line.includes('## ') || line.includes('### ')) {
        keyPoints.push(line.replace(/#+\s*/, '').trim());
      }
    });

    return keyPoints.slice(0, 5).join(' • ');
  }

  assessComplexity(fullPlan: string): string {
    const complexityIndicators = {
      high: [
        'database migration', 
        'breaking change', 
        'architecture refactor', 
        'security implementation', 
        'performance optimization'
      ],
      medium: [
        'api integration', 
        'new feature', 
        'testing setup', 
        'configuration change', 
        'ui component'
      ],
      low: [
        'bug fix', 
        'documentation', 
        'styling', 
        'minor update', 
        'text change'
      ]
    };

    const content = fullPlan.toLowerCase();

    const highScore = complexityIndicators.high.reduce((acc, indicator) => 
      acc + (content.includes(indicator) ? 1 : 0), 0);
      
    const mediumScore = complexityIndicators.medium.reduce((acc, indicator) => 
      acc + (content.includes(indicator) ? 1 : 0), 0);
      
    const lowScore = complexityIndicators.low.reduce((acc, indicator) => 
      acc + (content.includes(indicator) ? 1 : 0), 0);

    if (highScore >= 2) return 'High';
    if (mediumScore >= 2 || highScore >= 1) return 'Medium';
    return 'Low';
  }

  estimateImplementationTime(fullPlan: string): number {
    // Simple time estimation based on plan complexity
    const complexity = this.assessComplexity(fullPlan);
    const planLength = fullPlan.length;

    const baseHours: {[key: string]: number} = {
      'High': 8,
      'Medium': 4,
      'Low': 2
    };

    // Adjust based on plan detail level
    const detailMultiplier = Math.min(planLength / 5000, 2);
    
    // Use a default value if complexity is not a valid key
    return Math.ceil((baseHours[complexity] || 4) * detailMultiplier);
  }
}
