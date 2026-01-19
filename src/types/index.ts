export type IssueType = 'bug' | 'requirement' | 'task';
export type IssueStatus = 'open' | 'in_progress' | 'resolved' | 'closed';
export type IssuePriority = 'low' | 'medium' | 'high' | 'critical';
export type VersionStatus = 'planned' | 'in_progress' | 'released';

export interface Issue {
  id: number;
  type: IssueType;
  title: string;
  status: IssueStatus;
  priority: IssuePriority;
  version?: string;
  assignee?: string;
  description: string;
  created_at: string;
  updated_at: string;
}

export interface Comment {
  id: number;
  issue_id: number;
  author: string;
  content: string;
  created_at: string;
}

export interface Attachment {
  id: number;
  issue_id: number;
  filename: string;
  url: string;
  size: number;
  content_type: string;
  r2_key: string;
  created_at: string;
}

export interface Version {
  name: string;
  status: VersionStatus;
  description: string;
  created_at: string;
  released_at?: string;
}

export interface CreateIssueDTO {
  type: IssueType;
  title: string;
  priority?: IssuePriority;
  version?: string;
  assignee?: string;
  description?: string;
}

export interface UpdateIssueDTO {
  type?: IssueType;
  title?: string;
  status?: IssueStatus;
  priority?: IssuePriority;
  version?: string;
  assignee?: string;
  description?: string;
}

export interface Env {
  DB: D1Database;
  R2: R2Bucket;
}
