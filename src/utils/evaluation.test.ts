import test from 'node:test';
import assert from 'node:assert/strict';
import {
  authenticateRole,
  base64ToUtf8,
  buildWhatsAppUrl,
  calcMonthMetrics,
  calcSubjectMetrics,
  clampQuickGradeValue,
  convertOldV6ToUnified,
  createDefaultTermConfig,
  createDemoData,
  createEmptyGradeRecord,
  evaluateStudentOverall,
  filterStudentsForQuickGrading,
  formatWhatsAppPhone,
  getAllowedTeacherScope,
  getGradeRecord,
  getQuickGradeMaxScore,
  getStudentAttendanceStats,
  normalizeArabicSearch,
  normalizeDatabase,
  resolveQuickGradeLimit,
  setIsolatedGradeRecord,
  stepQuickGradeValue,
  utf8ToBase64,
} from './evaluation';
import type { MonthConfig } from '../types/gradebook';

test('calcMonthMetrics scales custom daily sections of arbitrary max scores to 100 and averages with written', () => {
  const monthCfg: MonthConfig = {
    id: 'm1',
    label: 'الشهر الأول',
    enabled: true,
    dailySections: [
      { id: 's1', name: 'الواجبات', maxScore: 20 },
      { id: 's2', name: 'الشفهي', maxScore: 30 },
      { id: 's3', name: 'الاختبار القصير', maxScore: 50 },
    ],
  };

  // Total daily = 16 + 24 + 40 = 80 out of 100 => daily100 = 80
  // Written = 90 => monthAvg = (80 + 90) / 2 = 85
  const m = calcMonthMetrics(monthCfg, {
    dailyScores: { s1: 16, s2: 24, s3: 40 },
    written: 90,
  });
  assert.equal(m.dailySum, 80);
  assert.equal(m.dailyMaxSum, 100);
  assert.equal(m.daily100, 80);
  assert.equal(m.written, 90);
  assert.equal(m.monthAvg, 85);
});

test('calcSubjectMetrics averages selected enabled months per term, computes annual effort (t1+mid+t2)/3, and detects single exemption', () => {
  const demo = createDemoData();
  const termConfig = createDefaultTermConfig();
  // Enable 2 months in Term 1 (m1, m2) and disable m3; keep 3 months in Term 2
  termConfig.term1Months[2].enabled = false;

  const rec = createEmptyGradeRecord('stu_x', 'sub_x');
  // m1: daily 9,9,9,9 => 90; written 90 => monthAvg 90
  rec.term1Months.m1 = { dailyScores: { ds_1: 9, ds_2: 9, ds_3: 9, ds_4: 9 }, written: 90 };
  // m2: daily 8,8,8,8 => 80; written 80 => monthAvg 80 -> avg(m1, m2) = 85 + part 5 = 90
  rec.term1Months.m2 = { dailyScores: { ds_1: 8, ds_2: 8, ds_3: 8, ds_4: 8 }, written: 80 };
  // m3 disabled: should be ignored even if filled
  rec.term1Months.m3 = { dailyScores: { ds_1: 2, ds_2: 2, ds_3: 2, ds_4: 2 }, written: 20 };

  rec.part = 5;
  rec.mid = 90;

  // Term 2 all 3 months enabled => 90, 90, 90 => 90
  rec.term2Months.m1 = { dailyScores: { ds_1: 9, ds_2: 9, ds_3: 9, ds_4: 9 }, written: 90 };
  rec.term2Months.m2 = { dailyScores: { ds_1: 9, ds_2: 9, ds_3: 9, ds_4: 9 }, written: 90 };
  rec.term2Months.m3 = { dailyScores: { ds_1: 9, ds_2: 9, ds_3: 9, ds_4: 9 }, written: 90 };

  const metrics = calcSubjectMetrics(rec, demo.settings, { termConfig });
  assert.equal(metrics.term1, 90);
  assert.equal(metrics.term1Complete, true);
  assert.equal(metrics.term2, 90);
  assert.equal(metrics.term2Complete, true);
  assert.equal(metrics.currentEffort, 90);
  assert.equal(metrics.effortComplete, true);
  assert.equal(metrics.isSingleExempt, true);
  assert.equal(metrics.statusLabel, 'معفى فردياً');
  assert.equal(metrics.tone, 'success');
});

test('calcSubjectMetrics computes finalYearGrade = (effort + finalExam)/2 for non-exempt students and handles absent/postponed', () => {
  const demo = createDemoData();
  const bio = demo.subjects.find((s) => s.id === 'sub_bio')!;
  const rec = getGradeRecord(demo, 'stu_1', 'sub_bio');
  // stu_1 has effort < 90 in demo
  const beforeFinal = calcSubjectMetrics(rec, demo.settings, bio);
  assert.equal(beforeFinal.isSingleExempt, false);

  const withFinal = { ...rec, final: 80 };
  const afterFinal = calcSubjectMetrics(withFinal, demo.settings, bio);
  assert.equal(afterFinal.finalGrade, Math.round(((beforeFinal.currentEffort! + 80) / 2) * 10) / 10);
  assert.equal(afterFinal.statusLabel, 'ناجح');

  const absentMid = { ...rec, midStatus: 'absent' as const };
  assert.equal(calcSubjectMetrics(absentMid, demo.settings, bio).statusLabel, 'غائب في امتحان');

  const postponedFinal = { ...rec, finalStatus: 'postponed' as const };
  assert.equal(calcSubjectMetrics(postponedFinal, demo.settings, bio).statusLabel, 'مؤجل');
});

test('subject grades are strictly isolated in gradesBySubject so editing one subject never alters another', () => {
  const db = createDemoData();
  const bioBefore = getGradeRecord(db, 'stu_1', 'sub_bio').mid;
  const updatedDb = setIsolatedGradeRecord(db, 'stu_1', 'sub_chem', (cur) => ({
    ...cur,
    mid: 55,
  }));

  assert.equal(getGradeRecord(updatedDb, 'stu_1', 'sub_chem').mid, 55);
  assert.equal(getGradeRecord(updatedDb, 'stu_1', 'sub_bio').mid, bioBefore);
});

test('authenticateRole and getAllowedTeacherScope isolate teacher PIN to assigned subjects and sections', () => {
  const db = createDemoData();
  const authFail = authenticateRole(db, 'teacher', '9999');
  assert.equal(authFail.ok, false);

  const authBio = authenticateRole(db, 'teacher', '1010');
  assert.equal(authBio.ok, true);
  assert.equal(authBio.session?.role, 'teacher');

  const scope = getAllowedTeacherScope(db, authBio.session!);
  assert.equal(scope.allowedSubjectIds?.has('sub_bio'), true);
  assert.equal(scope.allowedSubjectIds?.has('sub_chem'), false);
  assert.equal(scope.allowedSectionIds?.has('sec_5a'), true);
  assert.equal(scope.allowedSectionIds?.has('sec_1a'), false);

  const authAdmin = authenticateRole(db, 'admin', '0000');
  assert.equal(authAdmin.ok, true);
  assert.equal(authAdmin.session?.role, 'admin');

  const authParent = authenticateRole(db, 'parent', '1111, 2222');
  assert.equal(authParent.ok, true);
  assert.deepEqual(authParent.session?.parentPins, ['1111', '2222']);
});

test('evaluateStudentOverall detects general exemption and final pass/reexam/fail outcomes', () => {
  const db = createDemoData();
  const stu2 = db.students.find((s) => s.id === 'stu_2')!;
  const ev2 = evaluateStudentOverall(db, stu2);
  assert.equal(ev2.isGeneralExempt, true);
  assert.equal(ev2.overallStatus, 'معفى إعفاءً كلياً (عاماً)');

  // Set stu_1 bio to failing (<50), chem and phys passing with final
  let nextDb = setIsolatedGradeRecord(db, 'stu_1', 'sub_bio', (r) => ({
    ...r,
    term1Months: {
      m1: { dailyScores: { ds_1: 3, ds_2: 3, ds_3: 3, ds_4: 3 }, written: 30 },
      m2: { dailyScores: { ds_1: 3, ds_2: 3, ds_3: 3, ds_4: 3 }, written: 30 },
      m3: { dailyScores: { ds_1: 3, ds_2: 3, ds_3: 3, ds_4: 3 }, written: 30 },
    },
    part: 0,
    mid: 30,
    term2Months: {
      m1: { dailyScores: { ds_1: 3, ds_2: 3, ds_3: 3, ds_4: 3 }, written: 30 },
      m2: { dailyScores: { ds_1: 3, ds_2: 3, ds_3: 3, ds_4: 3 }, written: 30 },
      m3: { dailyScores: { ds_1: 3, ds_2: 3, ds_3: 3, ds_4: 3 }, written: 30 },
    },
    final: 30,
  }));
  nextDb = setIsolatedGradeRecord(nextDb, 'stu_1', 'sub_chem', (r) => ({ ...r, final: 80 }));
  nextDb = setIsolatedGradeRecord(nextDb, 'stu_1', 'sub_phys', (r) => ({ ...r, final: 80 }));

  const ev1 = evaluateStudentOverall(nextDb, nextDb.students.find((s) => s.id === 'stu_1')!);
  assert.equal(ev1.overallStatus, 'مكمل (1 مادة)');
  assert.equal(ev1.tone, 'warning');
});

test('normalizeDatabase migrates legacy flat gradesMap and convertOldV6ToUnified migrates V6 safely', () => {
  const normalized = normalizeDatabase({
    subjects: [
      {
        id: 'sub_1',
        gradeId: 'grd_1',
        name: 'العلوم',
        dailyTitles: { d1: 'واجب', d2: 'تحضير', d3: 'كويز', d4: 'نشاط' },
      } as never,
    ],
    students: [{ id: 'stu_1', number: '1', name: 'طالب', sectionId: 'sec_1', pin: '1234', phone: '' }],
    gradesMap: {
      stu_1__sub_1: {
        d1: 8,
        d2: 9,
        d3: 10,
        d4: 9,
        f1_m1: 80,
        f1_m2: 90,
        mid: 85,
        f2_m1: 84,
        f2_m2: 88,
        part: 2,
        final: '',
        midStatus: 'present',
        finalStatus: 'present',
      } as never,
    },
  });

  const rec = getGradeRecord(normalized, 'stu_1', 'sub_1');
  assert.equal(rec.term1Months.m1.written, 80);
  assert.equal(rec.term1Months.m1.dailyScores.ds_1, 8);
  assert.equal(rec.mid, 85);

  const unified = convertOldV6ToUnified({
    sections: ['شعبة أ'],
    subjects: ['الأحياء'],
    dailyTitles: { الأحياء: { d1: 'حضور', d2: 'واجب', d3: 'امتحان' } },
    data: {
      الأحياء: {
        'شعبة أ': [
          { name: 'كرار حيدر', pin: '7788', phone: '07701234567', d1: 9, f1_m1: 88, status: 'غائب' },
        ],
      },
    },
  });
  assert.equal(unified.students.length, 1);
  assert.equal(unified.subjects[0].termConfig.term1Months[0].dailySections[0].name, 'حضور');
  assert.equal(unified.attendance[0].records[unified.students[0].id], 'absent');
});

test('WhatsApp phone normalizer, attendance stats, and UTF-8 base64 helpers work cleanly', () => {
  assert.equal(formatWhatsAppPhone('0770 123 4567'), '9647701234567');
  assert.ok(buildWhatsAppUrl('07801112233', 'مرحبا').startsWith('https://wa.me/9647801112233?text='));

  const db = createDemoData();
  const stats = getStudentAttendanceStats(db, 'stu_4');
  assert.equal(stats.total, 2);
  assert.equal(stats.absent, 1);
  assert.equal(stats.rate, 50);

  const sample = JSON.stringify({ school: 'ثانوية الذاكرين النموذجية', year: '2026 - 2027' });
  assert.equal(base64ToUtf8(utf8ToBase64(sample)), sample);
});

test('quick grading max score, clamping, and bounded stepping stop strictly at section maxScore', () => {
  const monthCfg: MonthConfig = {
    id: 'm1',
    label: 'الشهر الأول',
    enabled: true,
    dailySections: [
      { id: 'ds_1', name: 'الواجبات', maxScore: 15 },
      { id: 'ds_2', name: 'الكويز', maxScore: 25 },
    ],
  };

  assert.equal(getQuickGradeMaxScore('daily', monthCfg, 'ds_1'), 15);
  assert.equal(getQuickGradeMaxScore('daily', monthCfg, 'ds_2'), 25);
  assert.equal(getQuickGradeMaxScore('written', monthCfg), 100);

  assert.equal(clampQuickGradeValue('', 15), '');
  assert.equal(clampQuickGradeValue(-3, 15), 0);
  assert.equal(clampQuickGradeValue(22, 15), 15);
  assert.equal(clampQuickGradeValue(12.5, 15), 12.5);
  assert.equal(clampQuickGradeValue(120, 100), 100);

  // Stepping from empty starts at 0 and stops at maxScore
  const s1 = stepQuickGradeValue('', 2, 15);
  assert.deepEqual(s1, { nextValue: 2, reachedMax: false, reachedMin: false });

  const sMax = stepQuickGradeValue(14, 5, 15);
  assert.deepEqual(sMax, { nextValue: 15, reachedMax: true, reachedMin: false });

  const sMin = stepQuickGradeValue(0.5, -2, 15);
  assert.deepEqual(sMin, { nextValue: 0, reachedMax: false, reachedMin: true });
});

test('filterStudentsForQuickGrading normalizes Arabic letters, matches number, and respects grade/section scope', () => {
  const db = createDemoData();

  assert.equal(normalizeArabicSearch('أحمد علي'), 'احمد علي');
  assert.equal(normalizeArabicSearch('فاطمة'), 'فاطمه');

  // Search "احمد" (without hamza) finds "أحمد علي حسن" in sec_5a
  const byName = filterStudentsForQuickGrading(db, {
    query: 'احمد',
    gradeId: 'grd_5s',
    sectionId: 'sec_5a',
    scopeMode: 'current_section',
  });
  assert.equal(byName.length, 1);
  assert.equal(byName[0].id, 'stu_1');

  // Search "فاطمه" (with haa) matches "فاطمة"
  const byTaMarbuta = filterStudentsForQuickGrading(db, {
    query: 'فاطمه',
    gradeId: 'grd_5s',
    sectionId: 'sec_5a',
    scopeMode: 'current_section',
  });
  assert.equal(byTaMarbuta.length, 1);
  assert.equal(byTaMarbuta[0].id, 'stu_2');

  // Searching across all grade sections finds stu_3 (sec_5b), excludes stu_5 (grd_1m)
  const allFifth = filterStudentsForQuickGrading(db, {
    query: 'محمد',
    gradeId: 'grd_5s',
    scopeMode: 'all_grade_sections',
  });
  assert.deepEqual(
    allFifth.map((s) => s.id).sort(),
    ['stu_2', 'stu_3']
  );

  // Respects teacher allowedSectionIds
  const restricted = filterStudentsForQuickGrading(db, {
    query: '',
    gradeId: 'grd_5s',
    scopeMode: 'all_grade_sections',
    allowedSectionIds: new Set(['sec_5b']),
  });
  assert.deepEqual(
    restricted.map((s) => s.id),
    ['stu_3']
  );
});

test('quick grading supports optional unlimited cap (null) and teacher-defined custom max limit', () => {
  assert.equal(resolveQuickGradeLimit(false, 20, 10), null);
  assert.equal(resolveQuickGradeLimit(true, 25, 10), 25);
  assert.equal(resolveQuickGradeLimit(true, '', 10), 10);

  // Unbounded mode: allows values above 10 or 100 while blocking negatives
  assert.equal(clampQuickGradeValue(140, null), 140);
  assert.equal(clampQuickGradeValue(-5, null), 0);

  const unboundedStep = stepQuickGradeValue(98, 10, null);
  assert.deepEqual(unboundedStep, { nextValue: 108, reachedMax: false, reachedMin: false });

  // Teacher-defined custom cap (e.g. 25)
  assert.equal(clampQuickGradeValue(30, 25), 25);
  const customStep = stepQuickGradeValue(23, 5, 25);
  assert.deepEqual(customStep, { nextValue: 25, reachedMax: true, reachedMin: false });
});

