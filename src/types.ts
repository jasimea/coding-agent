// types/index.ts
// Define interfaces for the advanced planning system

export interface TaskInfo {
  taskId: string;
  title: string;
  description: string;
  priority: string;
  labels?: string[];
  acceptanceCriteria?: string;
}

export interface RepoContext {
  name: string;
  branch: string;
  fileStructure: any;
  packageJson: any;
  readme: string;
}

export interface RepoAnalysis {
  analysis: string;
  timestamp: string;
}

export interface PlanComponents {
  taskInfo: TaskInfo;
  repoAnalysis: RepoAnalysis;
  initialPlan: string;
  technicalPlan: string;
  testingStrategy: string;
  riskAssessment: string;
}

export interface PlanResult {
  fullPlan: string;
  summary: string;
  complexity: string;
  estimatedHours: number;
  components: PlanComponents;
}
