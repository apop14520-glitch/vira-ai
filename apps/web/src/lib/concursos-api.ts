export type QuestionDifficulty = "facil" | "media" | "dificil";
export type QuestionOption = "a" | "b" | "c" | "d" | "e";

export type Topic = {
  id: string;
  organization_id: string;
  name: string;
  description: string;
  question_count: number;
  has_theory: boolean;
  created_at: string;
};

export type TheoryBlock =
  | { type: "paragraph"; text: string }
  | { type: "definition"; term: string; text: string }
  | { type: "callout"; text: string }
  | { type: "table"; caption: string; header: string[]; rows: string[][] };

export type TheorySection = { heading: string; blocks: TheoryBlock[] };

export type TheoryChapter = {
  number: string;
  title: string;
  objective: string;
  sections: TheorySection[];
  review: string[];
};

export type Theory = { summary: string; sources: string; chapters: TheoryChapter[] };

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

export type ExamAnswerResult = {
  question_id: string;
  selected_option: QuestionOption | null;
  correct_option: QuestionOption;
  is_correct: boolean;
  explanation: string;
};

export type ExamResult = { total: number; correct: number; blank: number; results: ExamAnswerResult[] };

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
  getTheory: (topicId: string) => request<Theory>(`/topics/${topicId}/theory`),
  drawQuestions: (topicIds: string[], quantity: number) =>
    request<QuestionPublic[]>("/questions/draw", {
      method: "POST",
      body: JSON.stringify({ topic_ids: topicIds, quantity }),
    }),
  checkAnswer: (questionId: string, selectedOption: QuestionOption) =>
    request<QuizAnswerResult>("/questions/check", {
      method: "POST",
      body: JSON.stringify({ question_id: questionId, selected_option: selectedOption }),
    }),
  submitExam: (answers: { question_id: string; selected_option: QuestionOption }[], blankQuestionIds: string[]) =>
    request<ExamResult>("/exams/submit", {
      method: "POST",
      body: JSON.stringify({ answers, blank_question_ids: blankQuestionIds }),
    }),
  summary: () => request<ConcursosSummary>("/summary"),
  auditEvents: (limit = 50) => request<AuditEvent[]>(`/audit?limit=${limit}`),
};
