import { prPlanningLogger as logger } from "./logger";
import { PlanResult } from "./types";

export interface PRPlanningComment {
  body: string;
  planSummary: string;
  estimatedHours: number;
  complexity: string;
}

export class PRPlanningService {
  /**
   * Creates a detailed planning comment for a GitHub PR
   */
  async createPlanningComment(
    planResult: PlanResult,
    taskInfo: any,
  ): Promise<PRPlanningComment> {
    const planSummary = this.generatePlanSummary(planResult);
    const body = this.formatPlanningComment(planResult, taskInfo);

    return {
      body,
      planSummary: planResult.summary,
      estimatedHours: planResult.estimatedHours,
      complexity: planResult.complexity,
    };
  }

  /**
   * Posts a planning comment to a GitHub PR
   */
  async postPlanningComment(
    repoOwner: string,
    repoName: string,
    prNumber: number,
    planningComment: PRPlanningComment,
  ): Promise<string | null> {
    const token = process.env.GITHUB_TOKEN;
    if (!token) {
      logger.error("GitHub token not available for PR commenting");
      return null;
    }

    try {
      const response = await fetch(
        `https://api.github.com/repos/${repoOwner}/${repoName}/issues/${prNumber}/comments`,
        {
          method: "POST",
          headers: {
            Authorization: `token ${token}`,
            "Content-Type": "application/json",
            Accept: "application/vnd.github.v3+json",
          },
          body: JSON.stringify({
            body: planningComment.body,
          }),
        },
      );

      if (response.ok) {
        const result = await response.json();
        logger.info("Planning comment posted successfully", {
          prNumber,
          commentId: result.id,
          repoOwner,
          repoName,
        });
        return result.id.toString();
      } else {
        const error = await response.json();
        logger.error("Failed to post planning comment", {
          prNumber,
          error,
          status: response.status,
        });
        return null;
      }
    } catch (error) {
      logger.error("Error posting planning comment", {
        prNumber,
        error: error instanceof Error ? error.message : "Unknown error",
      });
      return null;
    }
  }

  /**
   * Updates an existing planning comment with implementation progress
   */
  async updatePlanningComment(
    repoOwner: string,
    repoName: string,
    commentId: string,
    progress: string,
    status: string,
  ): Promise<boolean> {
    const token = process.env.GITHUB_TOKEN;
    if (!token) {
      logger.error("GitHub token not available for comment updates");
      return false;
    }

    try {
      // First, get the existing comment
      const getResponse = await fetch(
        `https://api.github.com/repos/${repoOwner}/${repoName}/issues/comments/${commentId}`,
        {
          headers: {
            Authorization: `token ${token}`,
            Accept: "application/vnd.github.v3+json",
          },
        },
      );

      if (!getResponse.ok) {
        logger.error("Failed to fetch existing comment", { commentId });
        return false;
      }

      const existingComment = await getResponse.json();
      const updatedBody = this.addProgressToComment(
        existingComment.body,
        progress,
        status,
      );

      // Update the comment
      const updateResponse = await fetch(
        `https://api.github.com/repos/${repoOwner}/${repoName}/issues/comments/${commentId}`,
        {
          method: "PATCH",
          headers: {
            Authorization: `token ${token}`,
            "Content-Type": "application/json",
            Accept: "application/vnd.github.v3+json",
          },
          body: JSON.stringify({
            body: updatedBody,
          }),
        },
      );

      if (updateResponse.ok) {
        logger.info("Planning comment updated successfully", { commentId });
        return true;
      } else {
        logger.error("Failed to update planning comment", {
          commentId,
          status: updateResponse.status,
        });
        return false;
      }
    } catch (error) {
      logger.error("Error updating planning comment", {
        commentId,
        error: error instanceof Error ? error.message : "Unknown error",
      });
      return false;
    }
  }

  private generatePlanSummary(planResult: PlanResult): string {
    const components = [
      `Complexity: ${planResult.complexity}`,
      `Estimated Time: ${planResult.estimatedHours} hours`,
      `Key Components: ${this.extractKeyComponents(planResult.fullPlan)}`,
    ];

    return components.join(" • ");
  }

  private extractKeyComponents(fullPlan: string): string {
    // Extract main implementation areas from the plan
    const lines = fullPlan.split("\n");
    const components: string[] = [];

    lines.forEach((line) => {
      if (
        line.includes("## ") &&
        (line.toLowerCase().includes("implementation") ||
          line.toLowerCase().includes("technical") ||
          line.toLowerCase().includes("database") ||
          line.toLowerCase().includes("api") ||
          line.toLowerCase().includes("frontend") ||
          line.toLowerCase().includes("backend"))
      ) {
        const component = line.replace(/#+\s*/, "").trim();
        if (component.length < 50) {
          components.push(component);
        }
      }
    });

    return components.slice(0, 3).join(", ") || "Core Implementation";
  }

  private formatPlanningComment(planResult: PlanResult, taskInfo: any): string {
    const timestamp = new Date().toISOString();

    return `## 🤖 Autonomous Implementation Plan

> **This pull request is being automatically implemented by Claude Code based on the comprehensive plan below.**

### 📋 Task Overview
- **Task ID**: ${taskInfo.taskId}
- **Priority**: ${taskInfo.priority}
- **Complexity**: ${planResult.complexity}
- **Estimated Time**: ${planResult.estimatedHours} hours
- **Generated**: ${timestamp}

### 🎯 Requirements
${taskInfo.description}

${
  taskInfo.acceptanceCriteria
    ? `### ✅ Acceptance Criteria
${taskInfo.acceptanceCriteria}`
    : ""
}

### 📐 Implementation Strategy

${this.extractImplementationStrategy(planResult.fullPlan)}

### 🧪 Testing Approach

${this.extractTestingStrategy(planResult.fullPlan)}

### ⚠️ Risk Assessment

${this.extractRiskAssessment(planResult.fullPlan)}

### 🔧 Technical Specifications

${this.extractTechnicalSpecs(planResult.fullPlan)}

---

## 📊 Implementation Progress

**Status**: 🟡 Planning Complete - Starting Implementation

**Progress Updates**:
- ✅ Planning phase completed
- ✅ Repository analyzed  
- ✅ Claude configuration setup
- ⏳ Implementation in progress...

---

## 🚀 Implementation Checklist

### Pre-Implementation
- [x] Repository cloned and analyzed
- [x] Implementation plan generated
- [x] Feature branch created
- [x] Claude CLI environment configured

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

### Documentation & Review
- [ ] Code documentation updated
- [ ] Implementation notes added
- [ ] Ready for human review
- [ ] Deployment preparation complete

---

## 📚 Resources

**Full Implementation Plan**: Available in the repository under \`.claude/implementation-plan.md\`

**Claude Configuration**: Configured with MCP servers for optimal development environment

**Monitoring**: This comment will be updated with real-time implementation progress

---

*🤖 This is an automated comment generated by the Autonomous Coding Agent. The implementation will begin shortly and this comment will be updated with progress.*`;
  }

  private extractImplementationStrategy(fullPlan: string): string {
    return (
      this.extractSection(fullPlan, [
        "implementation strategy",
        "technical approach",
        "development phases",
      ]) || "Implementation strategy details available in the full plan."
    );
  }

  private extractTestingStrategy(fullPlan: string): string {
    return (
      this.extractSection(fullPlan, [
        "testing strategy",
        "test",
        "unit testing",
      ]) || "Comprehensive testing strategy included in the full plan."
    );
  }

  private extractRiskAssessment(fullPlan: string): string {
    return (
      this.extractSection(fullPlan, [
        "risk assessment",
        "risks",
        "mitigation",
      ]) || "Risk analysis and mitigation strategies detailed in the full plan."
    );
  }

  private extractTechnicalSpecs(fullPlan: string): string {
    return (
      this.extractSection(fullPlan, [
        "technical specifications",
        "api endpoints",
        "database schema",
      ]) ||
      "Technical specifications and architecture details in the full plan."
    );
  }

  private extractSection(fullPlan: string, keywords: string[]): string | null {
    const lines = fullPlan.split("\n");
    let inSection = false;
    let sectionContent: string[] = [];
    let lineCount = 0;

    for (const line of lines) {
      if (line.startsWith("##") || line.startsWith("###")) {
        if (inSection) {
          // End of section
          break;
        }

        // Check if this is the start of our section
        const lowerLine = line.toLowerCase();
        if (keywords.some((keyword) => lowerLine.includes(keyword))) {
          inSection = true;
          continue;
        }
      }

      if (inSection && line.trim()) {
        sectionContent.push(line);
        lineCount++;

        // Limit to reasonable length for comment
        if (lineCount > 10) {
          sectionContent.push("...\n\n*See full plan for complete details*");
          break;
        }
      }
    }

    return sectionContent.length > 0 ? sectionContent.join("\n") : null;
  }

  private addProgressToComment(
    existingBody: string,
    progress: string,
    status: string,
  ): string {
    const statusEmojis = {
      planning: "🟡",
      implementing: "🔵",
      testing: "🟠",
      completed: "🟢",
      failed: "🔴",
    };

    const emoji = statusEmojis[status as keyof typeof statusEmojis] || "⚪";

    // Find the progress section
    const progressSectionStart = existingBody.indexOf("**Progress Updates**:");
    if (progressSectionStart === -1) {
      return existingBody;
    }

    const progressSectionEnd = existingBody.indexOf(
      "---",
      progressSectionStart,
    );
    if (progressSectionEnd === -1) {
      return existingBody;
    }

    const beforeProgress = existingBody.substring(0, progressSectionStart);
    const afterProgress = existingBody.substring(progressSectionEnd);

    const timestamp = new Date().toISOString();
    const newProgressSection = `**Progress Updates**:
- ✅ Planning phase completed
- ✅ Repository analyzed  
- ✅ Claude configuration setup
- ${emoji} ${progress}

**Last Updated**: ${timestamp}

`;

    return beforeProgress + newProgressSection + afterProgress;
  }
}
