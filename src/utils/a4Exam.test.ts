import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildA4ExamPromptText,
  computeTotalExamMarks,
  createReadyA4ExamPaper,
  getPrintFontCss,
  renderA4ExamHtml,
} from './a4Exam';

test('createReadyA4ExamPaper includes all 5 diverse question patterns and sums to 100 marks', () => {
  const paper = createReadyA4ExamPaper({
    directorate: 'مديرية تربية كركوك',
    schoolName: 'ثانوية الذاكرين النموذجية',
    academicYear: '2026 - 2027',
    subjectName: 'الأحياء',
    gradeName: 'الخامس العلمي',
    sectionName: 'شعبة أ',
    teacherName: 'م.م. سعدون محمد عبدالله',
  });

  const types = new Set(paper.sections.map((s) => s.type));
  assert.deepEqual(
    [...types].sort(),
    ['compare', 'explain', 'fill_blank', 'mcq', 'true_false']
  );
  assert.equal(computeTotalExamMarks(paper.sections), 100);
});

test('answer-space rule renders dotted lines & comparison grid in on_paper mode and omits them in exam_booklet mode', () => {
  const paper = createReadyA4ExamPaper({
    directorate: 'مديرية تربية كركوك',
    schoolName: 'ثانوية الذاكرين النموذجية',
    academicYear: '2026 - 2027',
    subjectName: 'الأحياء',
    gradeName: 'الخامس العلمي',
    sectionName: 'شعبة أ',
    teacherName: 'م.م. سعدون محمد عبدالله',
  });

  const onPaperHtml = renderA4ExamHtml({ ...paper, answerPlacement: 'on_paper' }, { scope: 'student_only' });
  assert.ok(onPaperHtml.includes('border-bottom:1.4px dotted #475569'));
  assert.ok(onPaperHtml.includes('التصحيح / السبب:'));
  assert.ok(onPaperHtml.includes('وجه المقارنة'));
  assert.ok(onPaperHtml.includes('break-inside:avoid'));

  const bookletHtml = renderA4ExamHtml({ ...paper, answerPlacement: 'exam_booklet' }, { scope: 'student_only' });
  assert.equal(bookletHtml.includes('border-bottom:1.4px dotted #475569'), false);
  assert.equal(bookletHtml.includes('التصحيح / السبب:'), false);
  assert.equal(bookletHtml.includes('<th>وجه المقارنة</th>'), false);
});

test('student_only print scope excludes model answer key while student_and_key isolates key on a separate page', () => {
  const paper = createReadyA4ExamPaper({
    directorate: 'مديرية تربية كركوك',
    schoolName: 'ثانوية الذاكرين النموذجية',
    academicYear: '2026 - 2027',
    subjectName: 'الكيمياء',
    gradeName: 'الخامس العلمي',
    sectionName: 'شعبة ب',
    teacherName: 'م.م. سعدون محمد عبدالله',
  });

  const studentHtml = renderA4ExamHtml(paper, { scope: 'student_only' });
  assert.equal(studentHtml.includes('مفتاح الإجابات النموذجية'), false);

  const combinedHtml = renderA4ExamHtml(paper, { scope: 'student_and_key' });
  assert.ok(combinedHtml.includes('مفتاح الإجابات النموذجية'));
  assert.ok(combinedHtml.includes('page-break-before:always'));
});

test('print font selector and ready prompt text interpolate school, answer rule, and escape dangerous HTML', () => {
  assert.ok(getPrintFontCss('traditional').includes('Traditional Arabic'));
  assert.ok(getPrintFontCss('sakkal').includes('Sakkal Majalla'));
  assert.ok(getPrintFontCss('amiri').includes('Amiri'));

  const paper = createReadyA4ExamPaper({
    directorate: 'مديرية تربية كركوك',
    schoolName: 'ثانوية الذاكرين النموذجية',
    academicYear: '2026 - 2027',
    subjectName: 'الفيزياء',
    gradeName: 'السادس الإعدادي',
    sectionName: 'شعبة أ',
    teacherName: 'م.م. سعدون محمد عبدالله',
  });
  paper.topic = 'الحث الكهرومغناطيسي <script>alert(1)</script>';
  paper.answerPlacement = 'exam_booklet';

  const html = renderA4ExamHtml(paper, { scope: 'student_only' });
  assert.equal(html.includes('<script>'), false);
  assert.ok(html.includes('&lt;script&gt;'));

  const prompt = buildA4ExamPromptText(paper);
  assert.ok(prompt.includes('ثانوية الذاكرين النموذجية'));
  assert.ok(prompt.includes('الفيزياء'));
  assert.ok(prompt.includes('لا تترك أي مجال أو أسطر فارغة'));
});
