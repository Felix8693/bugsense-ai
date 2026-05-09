export type UserMode = "developer" | "ai_user";

export interface FixStep {
  step: number;
  action: string;
  command?: string | null;
}

export interface CodeChange {
  file?: string | null;
  before?: string | null;
  after?: string | null;
  explanation: string;
}

export interface DevAnalysisResult {
  error_type: string;
  severity: string;
  detected_tool?: string | null;
  root_cause: string;
  fix_steps: FixStep[];
  code_changes: CodeChange[];
  prevention_tips: string[];
  confidence: number;
  warnings: string[];
}

export interface GuidedStep {
  step_number: number;
  instruction: string;
  command?: string | null;
  screenshot_hint?: string | null;
}

export interface UserAnalysisResult {
  plain_explanation: string;
  severity_message: string;
  detected_tool?: string | null;
  steps: GuidedStep[];
  warnings: string[];
  success_check: string;
  if_still_failing: string;
}

export interface AnalyzeResponse {
  request_id: string;
  mode: UserMode;
  result: DevAnalysisResult | UserAnalysisResult;
  cached: boolean;
  remaining_requests: number;
}

export interface ErrorResponse {
  request_id: string;
  error_code: string;
  message: string;
  detail?: string | null;
}
