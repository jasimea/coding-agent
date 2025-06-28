export interface WebhookPayload {
  webhookSource: string;
  repositoryUrl: string;
  taskData: {
    taskId: string;
    title: string;
    description: string;
    priority: string;
    labels?: string[];
    acceptanceCriteria?: string;
  };
  issueKey?: string;
  cardId?: string;
}

export interface JiraWebhookPayload {
  webhookEvent: string;
  issue?: {
    key: string;
    fields: {
      summary: string;
      description?: string;
      status: {
        name: string;
        id: string;
      };
      priority?: {
        name: string;
        id: string;
      };
      labels?: Array<{
        name: string;
        id: string;
      }>;
      assignee?: {
        displayName: string;
        emailAddress: string;
      };
    };
  };
  changelog?: {
    items: Array<{
      field: string;
      fieldtype: string;
      from: string;
      fromString: string;
      to: string;
      toString: string;
    }>;
  };
}

export interface TrelloWebhookPayload {
  action: {
    type: string;
    data: {
      card?: {
        id: string;
        name: string;
        desc: string;
        labels?: Array<{
          name: string;
          color: string;
        }>;
      };
      list?: {
        id: string;
        name: string;
      };
      listBefore?: {
        id: string;
        name: string;
      };
      listAfter?: {
        id: string;
        name: string;
      };
    };
    memberCreator: {
      id: string;
      username: string;
      fullName: string;
    };
  };
}

export interface TaskProcessRequest {
  repositoryUrl: string;
  taskData: {
    taskId: string;
    title: string;
    description: string;
    priority: string;
    labels?: string[];
    acceptanceCriteria?: string;
  };
  webhookSource: string;
  issueKey?: string;
  cardId?: string;
}

export interface TaskStatus {
  taskId: string;
  status:
    | "pending"
    | "planning"
    | "pr-created"
    | "implementing"
    | "completed"
    | "failed";
  progress?: string;
  error?: string;
  repositoryUrl?: string;
  branchName?: string;
  pullRequestUrl?: string;
  planningCommentId?: string;
  implementationProgress?: string;
  startTime?: string;
  endTime?: string;
}

export interface RepositoryConfig {
  url: string;
  branch: string;
  token?: string;
  clonePath?: string;
}
