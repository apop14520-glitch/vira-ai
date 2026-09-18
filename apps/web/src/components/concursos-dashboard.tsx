"use client";

import { FormEvent, useEffect, useState } from "react";

import {
  AuditEvent,
  concursosApi,
  ConcursosSummary,
  Question,
  QuestionDifficulty,
  QuestionOption,
  QuestionPublic,
  QuizResult,
  Topic,
} from "@/lib/concursos-api";

const difficultyLabels: Record<QuestionDifficulty, string> = {
  facil: "Fácil",
  media: "Média",
  dificil: "Difícil",
};

function createInitialQuestionForm(topicId: string) {
  return {
    topic_id: topicId,
    statement: "",
    option_a: "",
    option_b: "",
    option_c: "",
    option_d: "",
    option_e: "",
    correct_option: "a" as QuestionOption,
    explanation: "",
    difficulty: "media" as QuestionDifficulty,
  };
}

export function ConcursosDashboard() {
  const [topics, setTopics] = useState<Topic[]>([]);
  const [summary, setSummary] = useState<ConcursosSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [selectedTopicId, setSelectedTopicId] = useState<string>("");
  const [questions, setQuestions] = useState<Question[]>([]);
  const [topicName, setTopicName] = useState("");
  const [topicDescription, setTopicDescription] = useState("");
  const [questionForm, setQuestionForm] = useState(createInitialQuestionForm(""));
  const [quizQuestions, setQuizQuestions] = useState<QuestionPublic[]>([]);
  const [quizAnswers, setQuizAnswers] = useState<Record<string, QuestionOption>>({});
  const [quizResult, setQuizResult] = useState<QuizResult | null>(null);
  const [quizLoading, setQuizLoading] = useState(false);
  const [auditEvents, setAuditEvents] = useState<AuditEvent[]>([]);
  const [auditVisible, setAuditVisible] = useState(false);
  const [auditLoading, setAuditLoading] = useState(false);

  const reload = async () => {
    const [nextTopics, nextSummary] = await Promise.all([concursosApi.listTopics(), concursosApi.summary()]);
    setTopics(nextTopics);
    setSummary(nextSummary);
  };

  useEffect(() => {
    reload()
      .catch((error: Error) => setMessage(error.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!selectedTopicId) {
      setQuestions([]);
      return;
    }
    concursosApi
      .listQuestions(selectedTopicId)
      .then(setQuestions)
      .catch((error: Error) => setMessage(error.message));
    setQuestionForm(createInitialQuestionForm(selectedTopicId));
    setQuizQuestions([]);
    setQuizResult(null);
    setQuizAnswers({});
  }, [selectedTopicId]);

  const handleCreateTopic = async (event: FormEvent) => {
    event.preventDefault();
    try {
      const created = await concursosApi.createTopic({ name: topicName, description: topicDescription });
      setTopicName("");
      setTopicDescription("");
      await reload();
      setSelectedTopicId(created.id);
    } catch (error) {
      setMessage((error as Error).message);
    }
  };

  const handleDeleteTopic = async (topicId: string) => {
    try {
      await concursosApi.deleteTopic(topicId);
      if (selectedTopicId === topicId) setSelectedTopicId("");
      await reload();
    } catch (error) {
      setMessage((error as Error).message);
    }
  };

  const handleCreateQuestion = async (event: FormEvent) => {
    event.preventDefault();
    try {
      await concursosApi.createQuestion({ ...questionForm, option_e: questionForm.option_e.trim() || null });
      setQuestionForm(createInitialQuestionForm(selectedTopicId));
      const [refreshedQuestions] = await Promise.all([concursosApi.listQuestions(selectedTopicId), reload()]);
      setQuestions(refreshedQuestions);
    } catch (error) {
      setMessage((error as Error).message);
    }
  };

  const handleDeleteQuestion = async (questionId: string) => {
    try {
      await concursosApi.deleteQuestion(questionId);
      const [refreshedQuestions] = await Promise.all([concursosApi.listQuestions(selectedTopicId), reload()]);
      setQuestions(refreshedQuestions);
    } catch (error) {
      setMessage((error as Error).message);
    }
  };

  const startQuiz = async () => {
    if (!selectedTopicId) return;
    setQuizLoading(true);
    setQuizResult(null);
    setQuizAnswers({});
    try {
      const started = await concursosApi.startQuiz(selectedTopicId, 10);
      setQuizQuestions(started);
    } catch (error) {
      setMessage((error as Error).message);
    } finally {
      setQuizLoading(false);
    }
  };

  const submitQuiz = async () => {
    if (!selectedTopicId) return;
    const answers = quizQuestions
      .filter((question) => quizAnswers[question.id])
      .map((question) => ({ question_id: question.id, selected_option: quizAnswers[question.id] }));
    if (answers.length === 0) return;
    try {
      const result = await concursosApi.submitQuiz(selectedTopicId, answers);
      setQuizResult(result);
    } catch (error) {
      setMessage((error as Error).message);
    }
  };

  const toggleAuditLog = async () => {
    const next = !auditVisible;
    setAuditVisible(next);
    if (next && auditEvents.length === 0) {
      setAuditLoading(true);
      try {
        setAuditEvents(await concursosApi.auditEvents());
      } catch (error) {
        setMessage((error as Error).message);
      } finally {
        setAuditLoading(false);
      }
    }
  };

  if (loading) {
    return <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 text-sm text-slate-400">Carregando Concursos…</div>;
  }

  return (
    <div className="space-y-6 sm:space-y-8">
      <section className="rounded-3xl border border-slate-800 bg-slate-900/80 p-5 shadow-2xl shadow-amber-950/10 sm:p-8">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">VIRA Concursos</p>
        <h1 className="mt-2 text-2xl font-black text-white sm:text-3xl">Banco de questões e simulados</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
          Cadastre tópicos e questões a partir do seu material de estudo e treine em modo simulado.
        </p>
        {summary && (
          <div className="mt-4 flex flex-wrap gap-3 text-sm text-slate-300">
            <span className="rounded-lg border border-slate-700 bg-slate-950/60 px-3 py-1.5">{summary.total_topics} tópicos</span>
            <span className="rounded-lg border border-slate-700 bg-slate-950/60 px-3 py-1.5">{summary.total_questions} questões</span>
          </div>
        )}
        {message && (
          <div className="mt-4 rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-300">
            {message}
            <button className="ml-3 underline" onClick={() => setMessage(null)}>fechar</button>
          </div>
        )}
      </section>

      <section className="grid gap-4 lg:grid-cols-[280px_1fr]">
        <div className="space-y-4">
          <form onSubmit={handleCreateTopic} className="space-y-2 rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
            <h2 className="text-sm font-bold text-white">Novo tópico</h2>
            <input
              required
              value={topicName}
              onChange={(event) => setTopicName(event.target.value)}
              placeholder="Ex.: Redes de Computadores"
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"
            />
            <textarea
              value={topicDescription}
              onChange={(event) => setTopicDescription(event.target.value)}
              placeholder="Descrição (opcional)"
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"
            />
            <button type="submit" className="w-full rounded-lg bg-amber-400 px-3 py-2 text-sm font-bold text-slate-950 hover:bg-amber-300">
              Adicionar tópico
            </button>
          </form>

          <div className="space-y-2 rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
            <h2 className="text-sm font-bold text-white">Tópicos</h2>
            {topics.length === 0 && <p className="text-sm text-slate-500">Nenhum tópico cadastrado ainda.</p>}
            <ul className="space-y-1">
              {topics.map((topic) => (
                <li key={topic.id}>
                  <button
                    onClick={() => setSelectedTopicId(topic.id)}
                    className={`flex w-full items-center justify-between rounded-lg border px-3 py-2 text-left text-sm ${
                      selectedTopicId === topic.id
                        ? "border-amber-400/60 bg-amber-400/10 text-amber-200"
                        : "border-slate-800 bg-slate-950/40 text-slate-300 hover:border-slate-700"
                    }`}
                  >
                    <span>{topic.name}</span>
                    <span className="text-xs text-slate-500">{topic.question_count}</span>
                  </button>
                  {selectedTopicId === topic.id && (
                    <button
                      onClick={() => handleDeleteTopic(topic.id)}
                      className="mt-1 text-xs text-red-400 underline"
                    >
                      Excluir tópico
                    </button>
                  )}
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="space-y-4">
          {!selectedTopicId && (
            <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6 text-sm text-slate-400">
              Selecione ou crie um tópico para cadastrar questões e iniciar um simulado.
            </div>
          )}

          {selectedTopicId && (
            <>
              <form onSubmit={handleCreateQuestion} className="space-y-2 rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
                <h2 className="text-sm font-bold text-white">Nova questão</h2>
                <textarea
                  required
                  value={questionForm.statement}
                  onChange={(event) => setQuestionForm({ ...questionForm, statement: event.target.value })}
                  placeholder="Enunciado da questão"
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"
                />
                <div className="grid gap-2 sm:grid-cols-2">
                  {(["a", "b", "c", "d"] as const).map((letter) => (
                    <input
                      key={letter}
                      required
                      value={questionForm[`option_${letter}`]}
                      onChange={(event) => setQuestionForm({ ...questionForm, [`option_${letter}`]: event.target.value })}
                      placeholder={`Alternativa ${letter.toUpperCase()}`}
                      className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"
                    />
                  ))}
                  <input
                    value={questionForm.option_e}
                    onChange={(event) => setQuestionForm({ ...questionForm, option_e: event.target.value })}
                    placeholder="Alternativa E (opcional)"
                    className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"
                  />
                </div>
                <div className="flex flex-wrap gap-3">
                  <label className="text-sm text-slate-300">
                    Correta:
                    <select
                      value={questionForm.correct_option}
                      onChange={(event) => setQuestionForm({ ...questionForm, correct_option: event.target.value as QuestionOption })}
                      className="ml-2 rounded-lg border border-slate-700 bg-slate-950 px-2 py-1 text-sm text-white"
                    >
                      {(["a", "b", "c", "d"] as const).map((letter) => (
                        <option key={letter} value={letter}>{letter.toUpperCase()}</option>
                      ))}
                      {questionForm.option_e.trim() && <option value="e">E</option>}
                    </select>
                  </label>
                  <label className="text-sm text-slate-300">
                    Dificuldade:
                    <select
                      value={questionForm.difficulty}
                      onChange={(event) => setQuestionForm({ ...questionForm, difficulty: event.target.value as QuestionDifficulty })}
                      className="ml-2 rounded-lg border border-slate-700 bg-slate-950 px-2 py-1 text-sm text-white"
                    >
                      {Object.entries(difficultyLabels).map(([value, label]) => (
                        <option key={value} value={value}>{label}</option>
                      ))}
                    </select>
                  </label>
                </div>
                <textarea
                  value={questionForm.explanation}
                  onChange={(event) => setQuestionForm({ ...questionForm, explanation: event.target.value })}
                  placeholder="Explicação (opcional)"
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"
                />
                <button type="submit" className="rounded-lg bg-amber-400 px-3 py-2 text-sm font-bold text-slate-950 hover:bg-amber-300">
                  Adicionar questão
                </button>
              </form>

              <div className="space-y-2 rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-bold text-white">Questões cadastradas ({questions.length})</h2>
                  <button
                    onClick={startQuiz}
                    disabled={questions.length === 0 || quizLoading}
                    className="rounded-lg border border-amber-400/60 px-3 py-1.5 text-xs font-bold text-amber-300 hover:bg-amber-400/10 disabled:opacity-40"
                  >
                    Iniciar simulado
                  </button>
                </div>
                <ul className="space-y-2">
                  {questions.map((question) => (
                    <li key={question.id} className="rounded-lg border border-slate-800 bg-slate-950/40 p-3 text-sm text-slate-300">
                      <div className="flex items-start justify-between gap-2">
                        <span>{question.statement}</span>
                        <button onClick={() => handleDeleteQuestion(question.id)} className="shrink-0 text-xs text-red-400 underline">
                          excluir
                        </button>
                      </div>
                      <span className="mt-1 inline-block text-xs text-slate-500">
                        Gabarito: {question.correct_option.toUpperCase()} · {difficultyLabels[question.difficulty]}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>

              {quizQuestions.length > 0 && (
                <div className="space-y-3 rounded-2xl border border-amber-400/30 bg-amber-400/5 p-4">
                  <h2 className="text-sm font-bold text-white">Simulado ({quizQuestions.length} questões)</h2>
                  {quizQuestions.map((question, index) => (
                    <div key={question.id} className="rounded-lg border border-slate-800 bg-slate-950/60 p-3">
                      <p className="text-sm text-slate-200">{index + 1}. {question.statement}</p>
                      <div className="mt-2 grid gap-1.5 sm:grid-cols-2">
                        {(["a", "b", "c", "d", "e"] as const)
                          .filter((letter) => letter !== "e" || question.option_e)
                          .map((letter) => (
                          <label key={letter} className="flex items-center gap-2 text-sm text-slate-300">
                            <input
                              type="radio"
                              name={`quiz-${question.id}`}
                              checked={quizAnswers[question.id] === letter}
                              onChange={() => setQuizAnswers({ ...quizAnswers, [question.id]: letter })}
                            />
                            {question[`option_${letter}`]}
                          </label>
                        ))}
                      </div>
                      {quizResult && (
                        <p className={`mt-2 text-xs ${
                          quizResult.results.find((result) => result.question_id === question.id)?.is_correct
                            ? "text-emerald-400"
                            : "text-red-400"
                        }`}>
                          Gabarito: {quizResult.results.find((result) => result.question_id === question.id)?.correct_option.toUpperCase()}
                          {" "}
                          {quizResult.results.find((result) => result.question_id === question.id)?.explanation}
                        </p>
                      )}
                    </div>
                  ))}
                  {!quizResult && (
                    <button onClick={submitQuiz} className="rounded-lg bg-amber-400 px-3 py-2 text-sm font-bold text-slate-950 hover:bg-amber-300">
                      Corrigir simulado
                    </button>
                  )}
                  {quizResult && (
                    <p className="text-sm font-bold text-white">
                      Resultado: {quizResult.correct} de {quizResult.total} corretas
                    </p>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </section>

      <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
        <button onClick={toggleAuditLog} className="text-sm font-bold text-amber-300 underline">
          {auditVisible ? "Ocultar" : "Ver"} log de auditoria
        </button>
        {auditVisible && (
          <div className="mt-3 space-y-1">
            {auditLoading && <p className="text-sm text-slate-500">Carregando…</p>}
            {!auditLoading && auditEvents.length === 0 && <p className="text-sm text-slate-500">Nenhum evento registrado.</p>}
            {auditEvents.map((event) => (
              <div key={event.id} className="flex flex-wrap items-center gap-2 rounded-lg border border-slate-800 bg-slate-950/40 px-3 py-2 text-xs text-slate-400">
                <span className="font-mono text-slate-300">{event.action}</span>
                <span>{event.resource_type}</span>
                <span>{new Date(event.occurred_at).toLocaleString("pt-BR")}</span>
                <span className={event.outcome === "success" ? "text-emerald-400" : "text-amber-400"}>{event.outcome}</span>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
