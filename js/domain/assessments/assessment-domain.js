/**
 * NIREV AI — Assessment Domain
 * ─────────────────────────────────────────────────────────────
 * Status:  IMPLEMENTED — Phase 2
 * Version: 2.0.0
 *
 * PURE functions only — no API, no DB, no UI.
 * All side-effects are handled by assessment-engine.js
 * ─────────────────────────────────────────────────────────────
 */

// ── Pure: Validate session start input ───────────────────────

export function validateStartInput(input) {
  if (!input?.userId)  return 'userId is required';
  if (!input?.type)    return 'Assessment type is required';
  if (!input?.skill)   return 'Skill is required';

  const validTypes  = ['placement', 'practice', 'mock'];
  const validSkills = ['grammar', 'vocabulary', 'writing', 'reading'];

  if (!validTypes.includes(input.type))
    return `Invalid type "${input.type}". Must be: ${validTypes.join(', ')}`;
  if (!validSkills.includes(input.skill))
    return `Invalid skill "${input.skill}". Must be: ${validSkills.join(', ')}`;

  return null;
}

// ── Pure: Build session context from Groq questions ──────────

export function buildSessionContext(input, questions, sessionId) {
  return {
    sessionId,
    type:       input.type,
    skill:      input.skill,
    level:      input.level ?? null,
    questions,
    startedAt:  new Date().toISOString(),
  };
}

// ── Pure: Validate a single answer ───────────────────────────

export function validateAnswer(answer, question) {
  if (!answer || typeof answer !== 'string') return 'Answer cannot be empty';
  if (answer.trim().length === 0)            return 'Answer cannot be empty';

  if (question.type === 'multiple-choice') {
    if (!question.options?.includes(answer))
      return 'Invalid option selected';
  }

  return null;
}

// ── Pure: Build AnswerRecord for scoring domain ───────────────

export function buildAnswerRecord(question, answer, timeSpentMs) {
  return {
    questionId:  question.id,
    question:    question.text,
    answer:      answer.trim(),
    rubric:      question.rubric,
    timeSpentMs: timeSpentMs ?? 0,
    skill:       question.skill,
    type:        question.type,
    difficulty:  question.difficulty,
    options:     question.options ?? null,
  };
}

// ── Pure: Check if session is complete ───────────────────────

export function checkCompletion(currentIndex, totalQuestions) {
  return currentIndex >= totalQuestions - 1;
}

// ── Pure: Build completed session output ─────────────────────

export function buildCompletedSession(sessionId, answers, questions, skill) {
  const answerRecords = questions.map(q => {
    const ans = answers[q.id];
    return buildAnswerRecord(q, ans?.answer ?? '', ans?.timeSpentMs ?? 0);
  });

  return {
    sessionId,
    completedAt:   new Date().toISOString(),
    answers:       answerRecords,
    totalAnswered: answerRecords.filter(a => a.answer.length > 0).length,
    skill,
    handoff:       'scoring',
  };
}

// ── Pure: Parse Groq question response ───────────────────────

export function parseGroqQuestions(groqText, skill, count) {
  try {
    // Try JSON parse first
    const clean = groqText.replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(clean);

    const questions = Array.isArray(parsed) ? parsed : parsed.questions ?? [];

    return questions.slice(0, count).map((q, i) => ({
      id:         `q-${Date.now()}-${i}`,
      text:       q.question ?? q.text ?? '',
      type:       q.type ?? 'short-answer',
      options:    q.options ?? null,
      difficulty: q.difficulty ?? 3,
      skill,
      rubric:     q.rubric ?? q.scoring_criteria ?? _defaultRubric(skill),
    }));
  } catch {
    // Fallback: return default questions if parsing fails
    return _defaultQuestions(skill, count);
  }
}

// ── Pure: Default rubric by skill ────────────────────────────

function _defaultRubric(skill) {
  const rubrics = {
    grammar:    'Evaluate grammatical accuracy, correct use of tenses, sentence structure, and agreement.',
    vocabulary: 'Evaluate word choice, range, appropriateness, and precision.',
    writing:    'Evaluate task achievement, coherence, vocabulary range, and grammatical accuracy.',
    reading:    'Evaluate comprehension accuracy, inference ability, and detail identification.',
  };
  return rubrics[skill] ?? 'Evaluate language accuracy and appropriateness.';
}

// ── Pure: Default questions fallback ─────────────────────────

function _defaultQuestions(skill, count = 5) {
  const banks = {
    grammar: [
      { text: 'Complete the sentence: "If I ___ (know) the answer, I would tell you."', type: 'short-answer', difficulty: 3, options: null },
      { text: 'Which is correct? A) She don\'t like coffee  B) She doesn\'t like coffee  C) She not like coffee', type: 'multiple-choice', difficulty: 2, options: ['A) She don\'t like coffee', 'B) She doesn\'t like coffee', 'C) She not like coffee'] },
      { text: 'Correct the error: "Yesterday I have seen a great movie."', type: 'short-answer', difficulty: 3, options: null },
      { text: 'Write a sentence using the present perfect tense about a recent experience.', type: 'short-answer', difficulty: 3, options: null },
      { text: 'Which sentence uses the passive voice correctly? A) The book was read by her. B) She was read the book. C) The book read by her.', type: 'multiple-choice', difficulty: 4, options: ['A) The book was read by her.', 'B) She was read the book.', 'C) The book read by her.'] },
    ],
    vocabulary: [
      { text: 'What is the meaning of "eloquent"? Use it in a sentence.', type: 'short-answer', difficulty: 3, options: null },
      { text: 'Choose the best synonym for "ambitious": A) Lazy  B) Driven  C) Careless  D) Timid', type: 'multiple-choice', difficulty: 2, options: ['A) Lazy', 'B) Driven', 'C) Careless', 'D) Timid'] },
      { text: 'Fill in the blank: "The scientist made a _____ discovery that changed the field." (Use a strong adjective)', type: 'short-answer', difficulty: 3, options: null },
      { text: 'Explain the difference between "affect" and "effect" with examples.', type: 'short-answer', difficulty: 4, options: null },
      { text: 'Use "however", "therefore", and "moreover" in three separate sentences.', type: 'short-answer', difficulty: 4, options: null },
    ],
    writing: [
      { text: 'Write a short paragraph (4-5 sentences) about the advantages of learning a second language.', type: 'essay', difficulty: 3, options: null },
      { text: 'Describe your ideal study environment in 3-4 sentences.', type: 'essay', difficulty: 2, options: null },
      { text: 'Write an opinion paragraph: "Technology has made our lives better." Do you agree? Give 2 reasons.', type: 'essay', difficulty: 4, options: null },
      { text: 'Write a short email to your teacher explaining why you were absent from class yesterday.', type: 'essay', difficulty: 3, options: null },
      { text: 'Summarize the following idea in your own words: "Education is the most powerful weapon which you can use to change the world."', type: 'essay', difficulty: 3, options: null },
    ],
    reading: [
      { text: 'Read this sentence and answer: "Despite the heavy rain, the match continued." What does "despite" indicate? A) Cause  B) Contrast  C) Addition  D) Result', type: 'multiple-choice', difficulty: 2, options: ['A) Cause', 'B) Contrast', 'C) Addition', 'D) Result'] },
      { text: 'What is the main idea of this sentence: "Renewable energy sources, such as solar and wind power, are becoming increasingly important as fossil fuels deplete."', type: 'short-answer', difficulty: 3, options: null },
      { text: 'True or False: "The passive voice is used when the subject performs the action." Explain your answer.', type: 'short-answer', difficulty: 3, options: null },
      { text: 'What inference can you make from: "She arrived at the interview in a tailored suit, carrying a leather briefcase"?', type: 'short-answer', difficulty: 4, options: null },
      { text: 'Identify the tone of this sentence: "The so-called expert clearly had no idea what he was talking about."', type: 'short-answer', difficulty: 4, options: null },
    ],
  };

  const bank = banks[skill] ?? banks.grammar;
  return bank.slice(0, count).map((q, i) => ({
    id:        `q-default-${i}`,
    ...q,
    skill,
    rubric:    _defaultRubric(skill),
  }));
}

export const ASSESSMENT_DOMAIN_VERSION = '2.0.0';
