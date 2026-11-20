import type { Student } from '../types/gradebook';
import { normalizeArabicSearch, round1 } from './evaluation';

export interface GoogleFormItemInput {
  itemId?: string;
  title?: string;
  questionItem?: {
    question?: {
      questionId?: string;
      grading?: {
        pointValue?: number;
      };
    };
  };
}

export interface GoogleFormDocument {
  formId: string;
  info?: {
    title?: string;
    documentTitle?: string;
  };
  responderUri?: string;
  items?: GoogleFormItemInput[];
}

export interface GoogleFormAnswerValue {
  questionId?: string;
  textAnswers?: {
    answers?: Array<{ value?: string }>;
  };
  grade?: {
    score?: number;
  };
}

export interface GoogleFormResponseItem {
  responseId: string;
  lastSubmittedTime?: string;
  respondentEmail?: string;
  totalScore?: number;
  answers?: Record<string, GoogleFormAnswerValue>;
}

export interface ParsedFormQuestion {
  questionId: string;
  title: string;
  pointValue: number;
}

export interface FormMatchPreviewRow {
  responseId: string;
  submittedAt: string;
  identifierText: string;
  respondentEmail: string;
  matchedStudent: Student | null;
  rawScore: number;
  mappedScore: number;
}

/**
 * Extracts a Google Forms API formId from an edit URL or raw form ID.
 * Rejects responder-only `/forms/d/e/...` links with a clear error indicator since
 * Google Forms API v1 requires the editable Form ID from `/forms/d/<ID>/edit`.
 */
export function extractGoogleFormId(rawInput: string): {
  ok: boolean;
  formId?: string;
  error?: string;
} {
  const trimmed = String(rawInput || '').trim();
  if (!trimmed) {
    return { ok: false, error: 'أدخل رابط الاختبار أو معرّف النموذج (Form ID).' };
  }

  if (/\/forms\/d\/e\//i.test(trimmed)) {
    return {
      ok: false,
      error:
        'هذا رابط المشاركة للطلبة (/d/e/...). يرجى لصق رابط التعديل (الذي يحتوي على /forms/d/<ID>/edit) أو معرّف النموذج مباشرة.',
    };
  }

  const urlMatch = trimmed.match(/\/forms\/d\/([a-zA-Z0-9_-]{10,})/);
  if (urlMatch?.[1]) {
    return { ok: true, formId: urlMatch[1] };
  }

  if (/^[a-zA-Z0-9_-]{15,}$/.test(trimmed)) {
    return { ok: true, formId: trimmed };
  }

  return {
    ok: false,
    error: 'صيغة الرابط أو معرّف نموذج Google Forms غير صالحة.',
  };
}

export function extractFormMetadata(form: GoogleFormDocument): {
  title: string;
  questions: ParsedFormQuestion[];
  totalQuizPoints: number;
  suggestedIdentifierQuestionId: string;
} {
  const title = form.info?.title || form.info?.documentTitle || 'نموذج Google Forms';
  const questions: ParsedFormQuestion[] = [];
  let totalQuizPoints = 0;

  (form.items || []).forEach((item) => {
    const q = item.questionItem?.question;
    if (!q?.questionId) return;
    const pts = Number(q.grading?.pointValue || 0);
    if (pts > 0) totalQuizPoints += pts;
    questions.push({
      questionId: q.questionId,
      title: item.title || `سؤال (${q.questionId})`,
      pointValue: pts,
    });
  });

  const preferred = questions.find((q) => {
    const norm = normalizeArabicSearch(q.title);
    return (
      norm.includes('اسم') ||
      norm.includes('الاسم') ||
      norm.includes('الطالب') ||
      norm.includes('رقم') ||
      norm.includes('name') ||
      norm.includes('student')
    );
  });

  return {
    title,
    questions,
    totalQuizPoints,
    suggestedIdentifierQuestionId: preferred?.questionId || questions[0]?.questionId || '',
  };
}

export function mapFormScoreToTarget(params: {
  rawScore: number;
  formTotalPoints: number;
  scaleToTarget: boolean;
  targetMaxScore: number | null;
}): number {
  const safeRaw = Math.max(0, Number(params.rawScore) || 0);
  if (params.scaleToTarget && params.targetMaxScore !== null && params.formTotalPoints > 0) {
    const scaled = round1((safeRaw / params.formTotalPoints) * params.targetMaxScore);
    return Math.min(params.targetMaxScore, Math.max(0, scaled));
  }
  if (params.targetMaxScore !== null) {
    return Math.min(params.targetMaxScore, Math.max(0, round1(safeRaw)));
  }
  return round1(safeRaw);
}

export function matchFormResponsesToStudents(params: {
  responses: GoogleFormResponseItem[];
  students: Student[];
  identifierQuestionId: string;
  formTotalPoints: number;
  scaleToTarget: boolean;
  targetMaxScore: number | null;
}): FormMatchPreviewRow[] {
  const sortedResponses = [...params.responses].sort((a, b) =>
    String(a.lastSubmittedTime || '').localeCompare(String(b.lastSubmittedTime || ''))
  );

  // Deduplicate if multiple submissions match the same student (keep latest submission)
  const preview: FormMatchPreviewRow[] = sortedResponses.map((resp) => {
    const ansObj = params.identifierQuestionId ? resp.answers?.[params.identifierQuestionId] : undefined;
    const identifierText =
      ansObj?.textAnswers?.answers
        ?.map((a) => a.value || '')
        .join(' ')
        .trim() || '';
    const email = String(resp.respondentEmail || '').trim();
    const normIdText = normalizeArabicSearch(identifierText);

    let matchedStudent: Student | null = null;
    if (normIdText) {
      matchedStudent =
        params.students.find((s) => normalizeArabicSearch(s.number) === normIdText) ||
        params.students.find((s) => normalizeArabicSearch(s.pin) === normIdText) ||
        params.students.find((s) => normalizeArabicSearch(s.name) === normIdText) ||
        params.students.find((s) => normalizeArabicSearch(s.name).includes(normIdText) && normIdText.length >= 3) ||
        null;
    }

    if (!matchedStudent && email) {
      const emailPrefix = normalizeArabicSearch(email.split('@')[0] || '');
      if (emailPrefix) {
        matchedStudent =
          params.students.find((s) => normalizeArabicSearch(s.number) === emailPrefix) || null;
      }
    }

    const rawScore = Number(resp.totalScore || 0);
    const mappedScore = mapFormScoreToTarget({
      rawScore,
      formTotalPoints: params.formTotalPoints,
      scaleToTarget: params.scaleToTarget,
      targetMaxScore: params.targetMaxScore,
    });

    return {
      responseId: resp.responseId,
      submittedAt: resp.lastSubmittedTime || '',
      identifierText: identifierText || email || 'بدون معرّف',
      respondentEmail: email,
      matchedStudent,
      rawScore: round1(rawScore),
      mappedScore,
    };
  });

  // Keep latest entry per matched student when merging, while preserving unmatched entries for review
  const latestIndexByStudent = new Map<string, number>();
  preview.forEach((row, idx) => {
    if (row.matchedStudent) {
      latestIndexByStudent.set(row.matchedStudent.id, idx);
    }
  });

  return preview.filter((row, idx) => {
    if (!row.matchedStudent) return true;
    return latestIndexByStudent.get(row.matchedStudent.id) === idx;
  });
}
