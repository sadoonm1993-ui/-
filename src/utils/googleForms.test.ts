import test from 'node:test';
import assert from 'node:assert/strict';
import {
  extractFormMetadata,
  extractGoogleFormId,
  mapFormScoreToTarget,
  matchFormResponsesToStudents,
  type GoogleFormDocument,
  type GoogleFormResponseItem,
} from './googleForms';
import type { Student } from '../types/gradebook';

test('extractGoogleFormId parses edit URLs and raw IDs while guiding away from /d/e/ responder links', () => {
  const fromEdit = extractGoogleFormId(
    'https://docs.google.com/forms/d/1AbCdEfGhIjKlMnOpQrStUvWxYz123456/edit#responses'
  );
  assert.equal(fromEdit.ok, true);
  assert.equal(fromEdit.formId, '1AbCdEfGhIjKlMnOpQrStUvWxYz123456');

  const fromRaw = extractGoogleFormId('1AbCdEfGhIjKlMnOpQrStUvWxYz123456');
  assert.equal(fromRaw.ok, true);
  assert.equal(fromRaw.formId, '1AbCdEfGhIjKlMnOpQrStUvWxYz123456');

  const fromResponder = extractGoogleFormId(
    'https://docs.google.com/forms/d/e/1FAIpQLSfDummyResponderKey123/viewform'
  );
  assert.equal(fromResponder.ok, false);
  assert.ok(fromResponder.error?.includes('/d/e/'));

  const empty = extractGoogleFormId('   ');
  assert.equal(empty.ok, false);
});

test('extractFormMetadata computes totalQuizPoints and suggests student name question', () => {
  const form: GoogleFormDocument = {
    formId: 'form_1',
    info: { title: 'اختبار الأحياء الشهري' },
    items: [
      {
        itemId: 'i1',
        title: 'اسم الطالب الثلاثي',
        questionItem: { question: { questionId: 'q_name', grading: { pointValue: 0 } } },
      },
      {
        itemId: 'i2',
        title: 'السؤال الأول',
        questionItem: { question: { questionId: 'q_1', grading: { pointValue: 10 } } },
      },
      {
        itemId: 'i3',
        title: 'السؤال الثاني',
        questionItem: { question: { questionId: 'q_2', grading: { pointValue: 10 } } },
      },
    ],
  };

  const meta = extractFormMetadata(form);
  assert.equal(meta.title, 'اختبار الأحياء الشهري');
  assert.equal(meta.totalQuizPoints, 20);
  assert.equal(meta.suggestedIdentifierQuestionId, 'q_name');
  assert.equal(meta.questions.length, 3);
});

test('matchFormResponsesToStudents matches Arabic names/numbers, scales scores, and keeps latest submission', () => {
  const students: Student[] = [
    { id: 'stu_1', number: '101', name: 'أحمد علي حسن', sectionId: 'sec_5a', pin: '1111', phone: '' },
    { id: 'stu_2', number: '102', name: 'فاطمة محمد كريم', sectionId: 'sec_5a', pin: '2222', phone: '' },
  ];

  const responses: GoogleFormResponseItem[] = [
    {
      responseId: 'r1',
      lastSubmittedTime: '2026-11-20T08:00:00Z',
      totalScore: 12,
      answers: { q_name: { textAnswers: { answers: [{ value: 'احمد علي حسن' }] } } },
    },
    {
      responseId: 'r2',
      lastSubmittedTime: '2026-11-20T09:00:00Z',
      totalScore: 16,
      answers: { q_name: { textAnswers: { answers: [{ value: 'أحمد علي حسن' }] } } },
    },
    {
      responseId: 'r3',
      lastSubmittedTime: '2026-11-20T09:10:00Z',
      totalScore: 18,
      answers: { q_name: { textAnswers: { answers: [{ value: '102' }] } } },
    },
    {
      responseId: 'r4',
      lastSubmittedTime: '2026-11-20T09:20:00Z',
      totalScore: 14,
      answers: { q_name: { textAnswers: { answers: [{ value: 'طالب غير مسجل' }] } } },
    },
  ];

  // Scale out of 20 into a 10-point daily section
  const rows = matchFormResponsesToStudents({
    responses,
    students,
    identifierQuestionId: 'q_name',
    formTotalPoints: 20,
    scaleToTarget: true,
    targetMaxScore: 10,
  });

  // Deduplicated stu_1 (kept latest 16/20 => 8/10), stu_2 (18/20 => 9/10), plus unmatched r4
  assert.equal(rows.length, 3);
  const ahmadRow = rows.find((r) => r.matchedStudent?.id === 'stu_1')!;
  const fatimaRow = rows.find((r) => r.matchedStudent?.id === 'stu_2')!;
  const unmatchedRow = rows.find((r) => r.responseId === 'r4')!;

  assert.equal(ahmadRow.rawScore, 16);
  assert.equal(ahmadRow.mappedScore, 8);
  assert.equal(fatimaRow.mappedScore, 9);
  assert.equal(unmatchedRow.matchedStudent, null);

  // Uncapped raw score when targetMaxScore is null and scaleToTarget is false
  assert.equal(
    mapFormScoreToTarget({
      rawScore: 18,
      formTotalPoints: 20,
      scaleToTarget: false,
      targetMaxScore: null,
    }),
    18
  );
});
