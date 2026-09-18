export type QuestionDifficulty = "facil" | "media" | "dificil";
export type QuestionOption = "a" | "b" | "c" | "d" | "e";

export type Topic = {
  id: string;
  organization_id: string;
  name: string;
  description: string;
  question_count: number;
  created_at: string;
};

export type TopicInput = { name: string; description?: string };

export type Question = {
  id: string;
  organization_id: string;
  topic_id: string;
  statement: string;
  option_a: string;
  option_b: string;
  option_c: string;
  option_d: string;
  option_e: string | null;
  correct_option: QuestionOption;
  explanation: string;
  difficulty: QuestionDifficulty;
  source: string;
  created_at: string;
};

export type QuestionInput = {
  topic_id: string;
  statement: string;
  option_a: string;
  option_b: string;
  option_c: string;
  option_d: string;
  option_e?: string | null;
  correct_option: QuestionOption;
  explanation?: string;
  difficulty?: QuestionDifficulty;
  source?: string;
};

export type QuestionPublic = {
  id: string;
  topic_id: string;
  statement: string;
  option_a: string;
  option_b: string;
  option_c: string;
  option_d: string;
  option_e: string | null;
  difficulty: QuestionDifficulty;
};

export type QuizAnswerResult = {
  question_id: string;
  selected_option: QuestionOption;
  correct_option: QuestionOption;
  is_correct: boolean;
  explanation: string;
};

export type QuizResult = { topic_id: string; total: number; correct: number; results: QuizAnswerResult[] };

export type ConcursosSummary = { total_topics: number; total_questions: number; by_topic: Record<string, number> };

export type AuditEvent = {
  id: string;
  actor_id: string;
  action: string;
  resource_type: string;
  resource_id: string;
  occurred_at: string;
  outcome: string;
  metadata: Record<string, unknown>;
};

import { apiJson } from "@/lib/api-client";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  return apiJson<T>(`/api/v1/concursos${path}`, init);
}

export const concursosApi = {
  listTopics: () => request<Topic[]>("/topics"),
  createTopic: (input: TopicInput) => request<Topic>("/topics", { method: "POST", body: JSON.stringify(input) }),
  deleteTopic: (topicId: string) => request<void>(`/topics/${topicId}`, { method: "DELETE" }),
  listQuestions: (topicId?: string) =>
    request<Question[]>(`/questions${topicId ? `?topic_id=${topicId}` : ""}`),
  createQuestion: (input: QuestionInput) =>
    request<Question>("/questions", { method: "POST", body: JSON.stringify(input) }),
  deleteQuestion: (questionId: string) => request<void>(`/questions/${questionId}`, { method: "DELETE" }),
  startQuiz: (topicId: string, quantity = 10) =>
    request<QuestionPublic[]>("/quiz/start", { method: "POST", body: JSON.stringify({ topic_id: topicId, quantity }) }),
  submitQuiz: (topicId: string, answers: { question_id: string; selected_option: QuestionOption }[]) =>
    request<QuizResult>("/quiz/submit", { method: "POST", body: JSON.stringify({ topic_id: topicId, answers }) }),
  summary: () => request<ConcursosSummary>("/summary"),
  auditEvents: (limit = 50) => request<AuditEvent[]>(`/audit?limit=${limit}`),
};
