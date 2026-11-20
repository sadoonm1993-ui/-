import type {
  AppDatabase,
  AttendanceStats,
  AuthSession,
  DailySectionDef,
  GradeLevel,
  GradeRecord,
  MonthConfig,
  MonthGradeData,
  MonthMetrics,
  OverallEvaluation,
  SchoolSettings,
  Section,
  Stage,
  StatusTone,
  Student,
  Subject,
  SubjectMetrics,
  SubjectTermConfig,
  TeacherAccount,
} from '../types/gradebook';

export function uid(prefix = 'id'): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 8)}${Date.now().toString(36).slice(-4)}`;
}

export function isNum(v: unknown): v is number | string {
  return v !== '' && v !== null && v !== undefined && !Number.isNaN(Number(v));
}

export function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

export function formatWhatsAppPhone(raw: string): string {
  const digits = String(raw || '').replace(/[^\d]/g, '');
  if (!digits) return '';
  if (digits.startsWith('00')) return digits.slice(2);
  if (digits.startsWith('07') && digits.length >= 10) return `964${digits.slice(1)}`;
  if (digits.startsWith('7') && digits.length === 10) return `964${digits}`;
  return digits;
}

export function buildWhatsAppUrl(phone: string, text: string): string {
  const normalized = formatWhatsAppPhone(phone);
  if (normalized) {
    return `https://wa.me/${normalized}?text=${encodeURIComponent(text)}`;
  }
  return `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`;
}

export function utf8ToBase64(str: string): string {
  const bytes = new TextEncoder().encode(str);
  let bin = '';
  bytes.forEach((b) => {
    bin += String.fromCharCode(b);
  });
  return btoa(bin);
}

export function base64ToUtf8(b64: string): string {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) {
    bytes[i] = bin.charCodeAt(i);
  }
  return new TextDecoder().decode(bytes);
}

export function createDefaultDailySections(customNames?: Partial<Record<'d1' | 'd2' | 'd3' | 'd4', string>>): DailySectionDef[] {
  return [
    { id: 'ds_1', name: customNames?.d1 || 'الواجبات', maxScore: 10 },
    { id: 'ds_2', name: customNames?.d2 || 'التحضير', maxScore: 10 },
    { id: 'ds_3', name: customNames?.d3 || 'الكويز', maxScore: 10 },
    { id: 'ds_4', name: customNames?.d4 || 'النشاط', maxScore: 10 },
  ];
}

export function createDefaultTermConfig(customNames?: Partial<Record<'d1' | 'd2' | 'd3' | 'd4', string>>): SubjectTermConfig {
  const cloneSections = (): DailySectionDef[] =>
    createDefaultDailySections(customNames).map((s) => ({ ...s }));
  return {
    term1Months: [
      { id: 'm1', label: 'الشهر الأول', enabled: true, dailySections: cloneSections() },
      { id: 'm2', label: 'الشهر الثاني', enabled: true, dailySections: cloneSections() },
      { id: 'm3', label: 'الشهر الثالث', enabled: true, dailySections: cloneSections() },
    ],
    term2Months: [
      { id: 'm1', label: 'الشهر الأول', enabled: true, dailySections: cloneSections() },
      { id: 'm2', label: 'الشهر الثاني', enabled: true, dailySections: cloneSections() },
      { id: 'm3', label: 'الشهر الثالث', enabled: true, dailySections: cloneSections() },
    ],
  };
}

export function createEmptyMonthGrade(): MonthGradeData {
  return { dailyScores: {}, written: '' };
}

export function createEmptyGradeRecord(studentId = '', subjectId = ''): GradeRecord {
  return {
    studentId,
    subjectId,
    term1Months: {
      m1: createEmptyMonthGrade(),
      m2: createEmptyMonthGrade(),
      m3: createEmptyMonthGrade(),
    },
    term2Months: {
      m1: createEmptyMonthGrade(),
      m2: createEmptyMonthGrade(),
      m3: createEmptyMonthGrade(),
    },
    mid: '',
    part: 0,
    final: '',
    midStatus: 'present',
    finalStatus: 'present',
  };
}

/**
 * Retrieves an isolated grade record for (studentId, subjectId).
 * Guaranteed subject-level isolation: records live under gradesBySubject[subjectId][studentId].
 */
export function getGradeRecord(db: AppDatabase, studentId: string, subjectId: string): GradeRecord {
  const subjectBucket = db.gradesBySubject?.[subjectId];
  const existing = subjectBucket?.[studentId];
  if (!existing) return createEmptyGradeRecord(studentId, subjectId);
  return {
    ...createEmptyGradeRecord(studentId, subjectId),
    ...existing,
    studentId,
    subjectId,
    term1Months: existing.term1Months || {},
    term2Months: existing.term2Months || {},
  };
}

export function setIsolatedGradeRecord(
  db: AppDatabase,
  studentId: string,
  subjectId: string,
  updater: (current: GradeRecord) => GradeRecord
): AppDatabase {
  const current = getGradeRecord(db, studentId, subjectId);
  const updated: GradeRecord = {
    ...updater(current),
    studentId,
    subjectId,
  };
  return {
    ...db,
    gradesBySubject: {
      ...db.gradesBySubject,
      [subjectId]: {
        ...(db.gradesBySubject[subjectId] || {}),
        [studentId]: updated,
      },
    },
  };
}

function makeMonthData(d1: number, d2: number, d3: number, d4: number, written: number): MonthGradeData {
  return {
    dailyScores: { ds_1: d1, ds_2: d2, ds_3: d3, ds_4: d4 },
    written,
  };
}

export function createDemoData(): AppDatabase {
  const stMid = 'stg_mid';
  const stPrep = 'stg_prep';
  const g1 = 'grd_1m';
  const g2 = 'grd_2m';
  const g3 = 'grd_3m';
  const g4 = 'grd_4s';
  const g5 = 'grd_5s';
  const g6 = 'grd_6s';
  const sec5a = 'sec_5a';
  const sec5b = 'sec_5b';
  const sec1a = 'sec_1a';
  const subBio = 'sub_bio';
  const subChem = 'sub_chem';
  const subPhys = 'sub_phys';
  const subMath1 = 'sub_math1';
  const s1 = 'stu_1';
  const s2 = 'stu_2';
  const s3 = 'stu_3';
  const s4 = 'stu_4';
  const s5 = 'stu_5';

  const t1 = 'tch_sadoon';
  const t2 = 'tch_ahmed';

  return {
    schemaVersion: 2,
    settings: {
      schoolName: 'ثانوية الذاكرين النموذجية',
      directorate: 'مديرية تربية كركوك',
      teacherName: 'م.م. سعدون محمد عبدالله',
      teacherEmail: 'sadoonm1993@gmail.com',
      academicYear: '2026 - 2027',
      darkMode: false,
      lockPin: '',
      adminPin: '0000',
      rulesConfirmed: false,
      participationWeightMode: 'bonus_to_t1',
      includeDailyInTerm1: true,
      rules: {
        passMark: 50,
        singleExempt: 90,
        generalExemptAvg: 85,
        generalExemptMinSub: 75,
        maxReexamSubjects: 2,
      },
      github: {
        repo: '',
        branch: 'main',
        filePath: 'data/al-thakireen-backup.json',
      },
    },
    teachers: [
      {
        id: t1,
        name: 'م.م. سعدون محمد عبدالله',
        pin: '1010',
        specialty: 'الأحياء',
        assignedSubjectIds: [subBio],
        assignedSectionIds: [sec5a, sec5b],
      },
      {
        id: t2,
        name: 'أ. حيدر كريم صالح',
        pin: '2020',
        specialty: 'الكيمياء والفيزياء',
        assignedSubjectIds: [subChem, subPhys],
        assignedSectionIds: [sec5a, sec5b],
      },
    ],
    stages: [
      { id: stMid, name: 'المرحلة المتوسطة' },
      { id: stPrep, name: 'المرحلة الإعدادية' },
    ],
    grades: [
      { id: g1, stageId: stMid, name: 'الأول المتوسط' },
      { id: g2, stageId: stMid, name: 'الثاني المتوسط' },
      { id: g3, stageId: stMid, name: 'الثالث المتوسط' },
      { id: g4, stageId: stPrep, name: 'الرابع العلمي' },
      { id: g5, stageId: stPrep, name: 'الخامس العلمي' },
      { id: g6, stageId: stPrep, name: 'السادس الإعدادي' },
    ],
    sections: [
      { id: sec5a, gradeId: g5, name: 'أ' },
      { id: sec5b, gradeId: g5, name: 'ب' },
      { id: sec1a, gradeId: g1, name: 'أ' },
    ],
    subjects: [
      {
        id: subBio,
        gradeId: g5,
        name: 'الأحياء',
        termConfig: createDefaultTermConfig({ d1: 'الواجبات', d2: 'التحضير', d3: 'الكويز', d4: 'النشاط' }),
      },
      {
        id: subChem,
        gradeId: g5,
        name: 'الكيمياء',
        termConfig: createDefaultTermConfig({ d1: 'الواجبات', d2: 'التحضير', d3: 'المختبر', d4: 'النشاط' }),
      },
      {
        id: subPhys,
        gradeId: g5,
        name: 'الفيزياء',
        termConfig: createDefaultTermConfig({ d1: 'الواجبات', d2: 'التحضير', d3: 'التطبيق', d4: 'النشاط' }),
      },
      {
        id: subMath1,
        gradeId: g1,
        name: 'الرياضيات',
        termConfig: createDefaultTermConfig({ d1: 'الواجبات', d2: 'السبورة', d3: 'الكويز', d4: 'النشاط' }),
      },
    ],
    students: [
      { id: s1, number: '101', name: 'أحمد علي حسن', sectionId: sec5a, pin: '1111', phone: '9647700000001' },
      { id: s2, number: '102', name: 'فاطمة محمد كريم', sectionId: sec5a, pin: '2222', phone: '9647800000002' },
      { id: s3, number: '103', name: 'يوسف محمد علي', sectionId: sec5b, pin: '3333', phone: '9647900000003' },
      { id: s4, number: '104', name: 'علي جاسم رضا', sectionId: sec5a, pin: '4444', phone: '9647700000004' },
      { id: s5, number: '105', name: 'زهراء حسين فاضل', sectionId: sec1a, pin: '5555', phone: '9647700000005' },
    ],
    gradesBySubject: {
      [subBio]: {
        [s1]: {
          studentId: s1,
          subjectId: subBio,
          term1Months: {
            m1: makeMonthData(9, 8, 9, 9, 84),
            m2: makeMonthData(9, 9, 8, 9, 88),
            m3: makeMonthData(8, 9, 9, 9, 86),
          },
          mid: 86,
          term2Months: {
            m1: makeMonthData(9, 8, 9, 8, 86),
            m2: makeMonthData(8, 9, 9, 9, 85),
            m3: makeMonthData(9, 9, 8, 9, 87),
          },
          part: 3,
          final: '',
          midStatus: 'present',
          finalStatus: 'present',
        },
        [s2]: {
          studentId: s2,
          subjectId: subBio,
          term1Months: {
            m1: makeMonthData(10, 9, 10, 9, 92),
            m2: makeMonthData(9, 10, 9, 10, 90),
            m3: makeMonthData(10, 9, 9, 10, 94),
          },
          mid: 91,
          term2Months: {
            m1: makeMonthData(10, 9, 9, 10, 92),
            m2: makeMonthData(9, 10, 10, 9, 95),
            m3: makeMonthData(10, 10, 9, 9, 93),
          },
          part: 4,
          final: '',
          midStatus: 'present',
          finalStatus: 'present',
        },
        [s3]: {
          studentId: s3,
          subjectId: subBio,
          term1Months: {
            m1: makeMonthData(8, 8, 7, 8, 76),
            m2: makeMonthData(8, 8, 8, 7, 80),
            m3: makeMonthData(8, 7, 8, 8, 79),
          },
          mid: 79,
          term2Months: {
            m1: makeMonthData(8, 8, 8, 7, 78),
            m2: makeMonthData(8, 8, 8, 8, 82),
            m3: makeMonthData(8, 7, 8, 8, 80),
          },
          part: 2,
          final: '',
          midStatus: 'present',
          finalStatus: 'present',
        },
        [s4]: {
          studentId: s4,
          subjectId: subBio,
          term1Months: {
            m1: makeMonthData(5, 4, 5, 4, 44),
            m2: makeMonthData(4, 5, 4, 5, 46),
            m3: makeMonthData(5, 4, 4, 5, 45),
          },
          mid: 42,
          term2Months: {
            m1: makeMonthData(4, 5, 4, 5, 44),
            m2: makeMonthData(5, 4, 5, 4, 46),
            m3: makeMonthData(4, 5, 4, 4, 45),
          },
          part: 1,
          final: '',
          midStatus: 'present',
          finalStatus: 'present',
        },
      },
      [subChem]: {
        [s1]: {
          studentId: s1,
          subjectId: subChem,
          term1Months: {
            m1: makeMonthData(8, 8, 9, 8, 80),
            m2: makeMonthData(8, 9, 8, 8, 84),
            m3: makeMonthData(9, 8, 8, 8, 82),
          },
          mid: 83,
          term2Months: {
            m1: makeMonthData(8, 8, 8, 9, 82),
            m2: makeMonthData(9, 8, 8, 8, 85),
            m3: makeMonthData(8, 9, 8, 8, 83),
          },
          part: 2,
          final: '',
          midStatus: 'present',
          finalStatus: 'present',
        },
        [s2]: {
          studentId: s2,
          subjectId: subChem,
          term1Months: {
            m1: makeMonthData(9, 9, 9, 9, 89),
            m2: makeMonthData(9, 9, 10, 9, 91),
            m3: makeMonthData(9, 9, 9, 10, 90),
          },
          mid: 90,
          term2Months: {
            m1: makeMonthData(9, 9, 9, 10, 92),
            m2: makeMonthData(9, 10, 9, 9, 90),
            m3: makeMonthData(9, 9, 10, 9, 91),
          },
          part: 3,
          final: '',
          midStatus: 'present',
          finalStatus: 'present',
        },
        [s4]: {
          studentId: s4,
          subjectId: subChem,
          term1Months: {
            m1: makeMonthData(4, 5, 4, 5, 40),
            m2: makeMonthData(4, 4, 5, 4, 42),
            m3: makeMonthData(5, 4, 4, 4, 41),
          },
          mid: 39,
          term2Months: {
            m1: makeMonthData(4, 4, 5, 4, 42),
            m2: makeMonthData(5, 4, 4, 5, 44),
            m3: makeMonthData(4, 5, 4, 4, 43),
          },
          part: 0,
          final: '',
          midStatus: 'present',
          finalStatus: 'present',
        },
      },
      [subPhys]: {
        [s1]: {
          studentId: s1,
          subjectId: subPhys,
          term1Months: {
            m1: makeMonthData(8, 7, 8, 8, 78),
            m2: makeMonthData(8, 8, 8, 7, 81),
            m3: makeMonthData(8, 8, 7, 8, 80),
          },
          mid: 79,
          term2Months: {
            m1: makeMonthData(8, 8, 8, 8, 80),
            m2: makeMonthData(8, 8, 8, 8, 81),
            m3: makeMonthData(8, 7, 8, 8, 80),
          },
          part: 2,
          final: '',
          midStatus: 'present',
          finalStatus: 'present',
        },
        [s2]: {
          studentId: s2,
          subjectId: subPhys,
          term1Months: {
            m1: makeMonthData(9, 8, 9, 9, 86),
            m2: makeMonthData(9, 9, 8, 9, 88),
            m3: makeMonthData(9, 8, 9, 9, 87),
          },
          mid: 85,
          term2Months: {
            m1: makeMonthData(9, 8, 9, 9, 87),
            m2: makeMonthData(9, 9, 9, 8, 89),
            m3: makeMonthData(9, 9, 8, 9, 88),
          },
          part: 3,
          final: '',
          midStatus: 'present',
          finalStatus: 'present',
        },
      },
    },
    attendance: [
      { id: 'att_1', date: '2026-11-18', sectionId: sec5a, records: { [s1]: 'present', [s2]: 'present', [s4]: 'absent' } },
      { id: 'att_2', date: '2026-11-19', sectionId: sec5a, records: { [s1]: 'present', [s2]: 'present', [s4]: 'present' } },
    ],
    notes: [
      { id: 'not_1', studentId: s2, date: '2026-11-18', type: 'positive', text: 'أداء ممتاز في المشاركة اليومية لمادة الأحياء.' },
      { id: 'not_2', studentId: s4, date: '2026-11-19', type: 'warning', text: 'يحتاج إلى متابعة مكثفة في الأحياء والكيمياء.' },
    ],
    schedule: [
      { id: 'sch_1', day: 'sun', period: 1, timeRange: '08:00 - 08:45', sectionId: sec5a, subjectId: subBio, teacherId: t1, room: 'مختبر 1' },
      { id: 'sch_2', day: 'sun', period: 2, timeRange: '08:50 - 09:35', sectionId: sec5a, subjectId: subChem, teacherId: t2, room: 'قاعة 4' },
      { id: 'sch_3', day: 'mon', period: 1, timeRange: '08:00 - 08:45', sectionId: sec5b, subjectId: subBio, teacherId: t1, room: 'مختبر 1' },
      { id: 'sch_4', day: 'tue', period: 3, timeRange: '09:45 - 10:30', sectionId: sec5a, subjectId: subPhys, teacherId: t2, room: 'قاعة 2' },
      { id: 'sch_5', day: 'wed', period: 2, timeRange: '08:50 - 09:35', sectionId: sec5a, subjectId: subBio, teacherId: t1, room: 'قاعة 4' },
      { id: 'sch_6', day: 'thu', period: 1, timeRange: '08:00 - 08:45', sectionId: sec5b, subjectId: subChem, teacherId: t2, room: 'مختبر 2' },
    ],
  };
}

export function calcMonthMetrics(monthCfg: MonthConfig, monthData?: MonthGradeData): MonthMetrics {
  const sections = monthCfg.dailySections || [];
  const scores = monthData?.dailyScores || {};
  const entered = sections.filter((s) => isNum(scores[s.id]));
  const totalDefinedMax = sections.reduce((sum, s) => sum + Math.max(1, Number(s.maxScore || 10)), 0);

  let dailySum: number | null = null;
  let daily100: number | null = null;

  if (sections.length > 0 && entered.length > 0) {
    dailySum = round1(entered.reduce((sum, s) => sum + Number(scores[s.id]), 0));
    const enteredMax = entered.reduce((sum, s) => sum + Math.max(1, Number(s.maxScore || 10)), 0);
    daily100 = Math.min(100, Math.max(0, round1((dailySum / enteredMax) * 100)));
  }

  const written = isNum(monthData?.written) ? Math.min(100, Math.max(0, Number(monthData!.written))) : null;

  let monthAvg: number | null = null;
  if (sections.length === 0) {
    monthAvg = written !== null ? round1(written) : null;
  } else if (daily100 !== null && written !== null) {
    monthAvg = round1((daily100 + written) / 2);
  }

  return {
    monthId: monthCfg.id,
    label: monthCfg.label,
    enabled: monthCfg.enabled,
    dailySum,
    dailyMaxSum: totalDefinedMax,
    daily100,
    written,
    monthAvg,
  };
}

function calcTermBlock(
  monthConfigs: MonthConfig[],
  monthsData: Record<string, MonthGradeData>,
  bonus: number
): { monthMetrics: MonthMetrics[]; avg: number | null; complete: boolean } {
  const monthMetrics = monthConfigs.map((cfg) => calcMonthMetrics(cfg, monthsData?.[cfg.id]));
  const enabledMetrics = monthMetrics.filter((m) => m.enabled);
  const completedEnabled = enabledMetrics.filter((m) => m.monthAvg !== null);

  const complete = enabledMetrics.length >= 1 && completedEnabled.length === enabledMetrics.length;
  let avg = completedEnabled.length
    ? round1(completedEnabled.reduce((sum, m) => sum + m.monthAvg!, 0) / completedEnabled.length)
    : null;

  if (avg !== null && bonus > 0) {
    avg = Math.min(100, round1(avg + bonus));
  }

  return { monthMetrics, avg, complete };
}

export function getSubjectTermConfig(subject?: Pick<Subject, 'termConfig' | 'dailyTitles'>): SubjectTermConfig {
  if (subject?.termConfig && Array.isArray(subject.termConfig.term1Months) && Array.isArray(subject.termConfig.term2Months)) {
    return subject.termConfig;
  }
  return createDefaultTermConfig(subject?.dailyTitles);
}

export function calcSubjectMetrics(
  rec: GradeRecord,
  settings: Pick<SchoolSettings, 'includeDailyInTerm1' | 'participationWeightMode' | 'rules'>,
  subject?: Pick<Subject, 'termConfig' | 'dailyTitles'>
): SubjectMetrics {
  const { rules } = settings;
  const termConfig = getSubjectTermConfig(subject);
  const partVal = isNum(rec.part) ? Number(rec.part) : 0;

  const bonusT1 = settings.participationWeightMode === 'bonus_to_t1' ? partVal : 0;
  const bonusT2 = settings.participationWeightMode === 'bonus_to_t2' ? partVal : 0;

  const t1Block = calcTermBlock(termConfig.term1Months, rec.term1Months || {}, bonusT1);
  const t2Block = calcTermBlock(termConfig.term2Months, rec.term2Months || {}, bonusT2);

  const allDaily100 = [...t1Block.monthMetrics, ...t2Block.monthMetrics]
    .filter((m) => m.enabled && m.daily100 !== null)
    .map((m) => m.daily100!);
  const dailyAvg10 = allDaily100.length
    ? round1((allDaily100.reduce((a, b) => a + b, 0) / allDaily100.length) / 10)
    : null;

  const term1 = t1Block.avg;
  const term2 = t2Block.avg;
  const mid = rec.midStatus === 'present' && isNum(rec.mid) ? Number(rec.mid) : null;

  const effortParts = [term1, mid, term2].filter((v): v is number => v !== null);
  const currentEffort = effortParts.length
    ? round1(effortParts.reduce((a, b) => a + b, 0) / effortParts.length)
    : null;
  const effortComplete =
    t1Block.complete && t2Block.complete && term1 !== null && mid !== null && term2 !== null;

  const isSingleExempt = effortComplete && currentEffort !== null && currentEffort >= rules.singleExempt;

  const finalExam = rec.finalStatus === 'present' && isNum(rec.final) ? Number(rec.final) : null;
  const finalGrade =
    !isSingleExempt && effortComplete && finalExam !== null
      ? round1((currentEffort! + finalExam) / 2)
      : null;

  let statusLabel = 'غير محسوم بعد';
  let tone: StatusTone = 'muted';

  if (rec.midStatus === 'absent' || (!isSingleExempt && rec.finalStatus === 'absent')) {
    statusLabel = 'غائب في امتحان';
    tone = 'danger';
  } else if (rec.midStatus === 'postponed' || (!isSingleExempt && rec.finalStatus === 'postponed')) {
    statusLabel = 'مؤجل';
    tone = 'warning';
  } else if (isSingleExempt) {
    statusLabel = 'معفى فردياً';
    tone = 'success';
  } else if (finalGrade !== null) {
    if (finalGrade >= rules.passMark) {
      statusLabel = 'ناجح';
      tone = 'success';
    } else {
      statusLabel = 'مكمل / راسب';
      tone = 'danger';
    }
  } else if (effortComplete && currentEffort !== null) {
    if (currentEffort >= rules.passMark) {
      statusLabel = 'ناجح بالسعي';
      tone = 'info';
    } else {
      statusLabel = 'معرض للرسوب';
      tone = 'danger';
    }
  } else if (currentEffort !== null) {
    if (currentEffort >= rules.singleExempt) {
      statusLabel = 'مرشح للإعفاء';
      tone = 'info';
    } else if (currentEffort < rules.passMark) {
      statusLabel = 'معرض للرسوب';
      tone = 'warning';
    } else {
      statusLabel = 'قيد المتابعة';
      tone = 'muted';
    }
  }

  return {
    term1MonthMetrics: t1Block.monthMetrics,
    term2MonthMetrics: t2Block.monthMetrics,
    dailyAvg10,
    term1,
    term1Complete: t1Block.complete,
    mid,
    term2,
    term2Complete: t2Block.complete,
    currentEffort,
    effortComplete,
    isSingleExempt,
    finalExam,
    finalGrade,
    statusLabel,
    tone,
  };
}

export function getStudentSectionAndGrade(db: AppDatabase, student: Student): {
  sec: Section | null;
  grd: GradeLevel | null;
  stg: Stage | null;
} {
  const sec = db.sections.find((s) => s.id === student.sectionId) || null;
  const grd = sec ? db.grades.find((g) => g.id === sec.gradeId) || null : null;
  const stg = grd ? db.stages.find((st) => st.id === grd.stageId) || null : null;
  return { sec, grd, stg };
}

export function getStudentAttendanceStats(db: AppDatabase, studentId: string): AttendanceStats {
  let total = 0;
  let present = 0;
  let absent = 0;
  let late = 0;
  db.attendance.forEach((day) => {
    const rec = day.records && day.records[studentId];
    if (rec) {
      total += 1;
      if (rec === 'present') present += 1;
      else if (rec === 'absent') absent += 1;
      else if (rec === 'late') late += 1;
    }
  });
  const rate = total ? Math.round(((present + late) / total) * 100) : 100;
  return { total, present, absent, late, rate };
}

export function evaluateStudentOverall(db: AppDatabase, student: Student): OverallEvaluation {
  const { rules } = db.settings;
  const { sec, grd, stg } = getStudentSectionAndGrade(db, student);
  const subjects = grd ? db.subjects.filter((sb) => sb.gradeId === grd.id) : [];

  const rows = subjects.map((subject) => {
    const rec = getGradeRecord(db, student.id, subject.id);
    const metrics = calcSubjectMetrics(rec, db.settings, subject);
    return { subject, rec, metrics };
  });

  const efforts = rows.map((r) => r.metrics.currentEffort).filter((v): v is number => v !== null);
  const avgEffort = efforts.length ? round1(efforts.reduce((a, b) => a + b, 0) / efforts.length) : null;

  const allEffortComplete = rows.length > 0 && rows.every((r) => r.metrics.effortComplete);
  const minSub = efforts.length ? Math.min(...efforts) : 0;
  const isGeneralExempt =
    allEffortComplete &&
    avgEffort !== null &&
    avgEffort >= rules.generalExemptAvg &&
    minSub >= rules.generalExemptMinSub;

  const singleExemptSubjects = rows.filter((r) => r.metrics.isSingleExempt).map((r) => r.subject.name);

  // For students who have either finalGrade or singleExempt or generalExempt across all subjects:
  const allFinalsOrExemptComplete =
    rows.length > 0 &&
    rows.every((r) => r.metrics.finalGrade !== null || r.metrics.isSingleExempt || isGeneralExempt);

  let overallStatus = 'غير محسوم بعد';
  let tone: StatusTone = 'muted';

  if (!rows.length || !efforts.length || avgEffort === null) {
    return {
      sec,
      grd,
      stg,
      rows,
      avg: null,
      isFinalAvg: false,
      isGeneralExempt: false,
      singleExemptSubjects,
      overallStatus,
      tone,
    };
  }

  if (isGeneralExempt) {
    overallStatus = 'معفى إعفاءً كلياً (عاماً)';
    tone = 'success';
    return {
      sec,
      grd,
      stg,
      rows,
      avg: avgEffort,
      isFinalAvg: true,
      isGeneralExempt: true,
      singleExemptSubjects,
      overallStatus,
      tone,
    };
  }

  const anyFinalEntered = rows.some((r) => r.metrics.finalGrade !== null);
  if (allFinalsOrExemptComplete && anyFinalEntered) {
    const effectiveScores = rows
      .map((r) => r.metrics.finalGrade ?? (r.metrics.isSingleExempt ? r.metrics.currentEffort : null))
      .filter((v): v is number => v !== null);
    const finalAvg = effectiveScores.length
      ? round1(effectiveScores.reduce((a, b) => a + b, 0) / effectiveScores.length)
      : avgEffort;

    const failedFinalCount = rows.filter(
      (r) => !r.metrics.isSingleExempt && r.metrics.finalGrade !== null && r.metrics.finalGrade < rules.passMark
    ).length;

    if (failedFinalCount === 0) {
      overallStatus = 'ناجح';
      tone = 'success';
    } else if (failedFinalCount <= rules.maxReexamSubjects) {
      overallStatus = `مكمل (${failedFinalCount} مادة)`;
      tone = 'warning';
    } else {
      overallStatus = 'راسب';
      tone = 'danger';
    }
    return {
      sec,
      grd,
      stg,
      rows,
      avg: finalAvg,
      isFinalAvg: true,
      isGeneralExempt: false,
      singleExemptSubjects,
      overallStatus,
      tone,
    };
  }

  const weakEffortCount = rows.filter(
    (r) => r.metrics.currentEffort !== null && r.metrics.currentEffort < rules.passMark
  ).length;

  if (allEffortComplete) {
    if (singleExemptSubjects.length > 0) {
      overallStatus = `إعفاء فردي (${singleExemptSubjects.length} مادة)`;
      tone = 'info';
    } else if (weakEffortCount > rules.maxReexamSubjects) {
      overallStatus = 'معرض للرسوب';
      tone = 'danger';
    } else if (weakEffortCount > 0) {
      overallStatus = 'يحتاج متابعة';
      tone = 'warning';
    } else {
      overallStatus = 'ناجح بالسعي';
      tone = 'success';
    }
  } else if (avgEffort >= rules.generalExemptAvg && minSub >= rules.generalExemptMinSub) {
    overallStatus = 'مرشح للإعفاء الكلي';
    tone = 'info';
  } else if (weakEffortCount > 0) {
    overallStatus = 'معرض للرسوب';
    tone = 'warning';
  }

  return {
    sec,
    grd,
    stg,
    rows,
    avg: avgEffort,
    isFinalAvg: false,
    isGeneralExempt: false,
    singleExemptSubjects,
    overallStatus,
    tone,
  };
}

/**
 * Authenticates Admin, Teacher (by PIN), or Parent (by Student PINs).
 */
export function authenticateRole(
  db: AppDatabase,
  role: 'admin' | 'teacher' | 'parent',
  pinInput: string
): { ok: boolean; session?: AuthSession; error?: string } {
  const clean = pinInput.trim();
  if (role === 'admin') {
    const expected = db.settings.adminPin || db.settings.lockPin || '0000';
    if (clean === expected) {
      return {
        ok: true,
        session: { role: 'admin', displayName: `الإدارة (${db.settings.teacherName})` },
      };
    }
    return { ok: false, error: 'رمز دخول الإدارة غير صحيح (الافتراضي: 0000)' };
  }

  if (role === 'teacher') {
    const teacher = (db.teachers || []).find((t) => t.pin === clean);
    if (!teacher) {
      return { ok: false, error: 'لا يوجد مدرس مسجل بهذا الرمز (PIN)' };
    }
    return {
      ok: true,
      session: { role: 'teacher', teacherId: teacher.id, displayName: teacher.name },
    };
  }

  const pins = clean
    .split(/[,،\s]+/)
    .map((x) => x.trim().toLowerCase())
    .filter(Boolean);
  const matched = db.students.filter((s) => pins.includes(String(s.pin).toLowerCase()));
  if (!matched.length) {
    return { ok: false, error: 'لم يتم العثور على طالب مطابق لرمز PIN المدخل' };
  }
  return {
    ok: true,
    session: {
      role: 'parent',
      parentPins: pins,
      displayName: matched.length === 1 ? `ولي أمر: ${matched[0].name}` : `ولي أمر (${matched.length} طلاب)`,
    },
  };
}

export function getAllowedTeacherScope(
  db: AppDatabase,
  session: AuthSession | null
): {
  teacher: TeacherAccount | null;
  allowedSubjectIds: Set<string> | null;
  allowedSectionIds: Set<string> | null;
} {
  if (!session || session.role !== 'teacher' || !session.teacherId) {
    return { teacher: null, allowedSubjectIds: null, allowedSectionIds: null };
  }
  const teacher = (db.teachers || []).find((t) => t.id === session.teacherId) || null;
  if (!teacher) {
    return { teacher: null, allowedSubjectIds: new Set(), allowedSectionIds: new Set() };
  }
  return {
    teacher,
    allowedSubjectIds: new Set(teacher.assignedSubjectIds),
    allowedSectionIds: new Set(teacher.assignedSectionIds),
  };
}

export function migrateLegacyRecordToMonthly(rec: Partial<GradeRecord>, studentId = '', subjectId = ''): GradeRecord {
  const base = createEmptyGradeRecord(studentId, subjectId);
  const hasNewFormat = rec.term1Months && Object.keys(rec.term1Months).length > 0;
  if (hasNewFormat) {
    return {
      ...base,
      ...rec,
      studentId,
      subjectId,
      term1Months: { ...base.term1Months, ...rec.term1Months },
      term2Months: { ...base.term2Months, ...rec.term2Months },
    };
  }

  // Convert legacy flat d1..d4, f1_m1, f1_m2, f2_m1, f2_m2 into term1Months & term2Months
  const dailyScores: Record<string, number | ''> = {};
  if (isNum(rec.d1)) dailyScores.ds_1 = Number(rec.d1);
  if (isNum(rec.d2)) dailyScores.ds_2 = Number(rec.d2);
  if (isNum(rec.d3)) dailyScores.ds_3 = Number(rec.d3);
  if (isNum(rec.d4)) dailyScores.ds_4 = Number(rec.d4);

  return {
    ...base,
    studentId,
    subjectId,
    term1Months: {
      m1: { dailyScores: { ...dailyScores }, written: isNum(rec.f1_m1) ? Number(rec.f1_m1) : '' },
      m2: { dailyScores: { ...dailyScores }, written: isNum(rec.f1_m2) ? Number(rec.f1_m2) : '' },
      m3: createEmptyMonthGrade(),
    },
    term2Months: {
      m1: { dailyScores: {}, written: isNum(rec.f2_m1) ? Number(rec.f2_m1) : '' },
      m2: { dailyScores: {}, written: isNum(rec.f2_m2) ? Number(rec.f2_m2) : '' },
      m3: createEmptyMonthGrade(),
    },
    mid: isNum(rec.mid) ? Number(rec.mid) : '',
    part: isNum(rec.part) ? Number(rec.part) : 0,
    final: isNum(rec.final) ? Number(rec.final) : '',
    midStatus: rec.midStatus || 'present',
    finalStatus: rec.finalStatus || 'present',
  };
}

export function normalizeDatabase(raw: Partial<AppDatabase>): AppDatabase {
  const demo = createDemoData();
  const settings: SchoolSettings = {
    ...demo.settings,
    ...(raw.settings || {}),
    rules: {
      ...demo.settings.rules,
      ...(raw.settings?.rules || {}),
    },
    github: {
      ...demo.settings.github!,
      ...(raw.settings?.github || {}),
    },
  };

  const subjects: Subject[] = (raw.subjects || demo.subjects).map((sb) => ({
    ...sb,
    termConfig: sb.termConfig && sb.termConfig.term1Months && sb.termConfig.term2Months
      ? sb.termConfig
      : createDefaultTermConfig(sb.dailyTitles),
  }));

  const gradesBySubject: Record<string, Record<string, GradeRecord>> = {};

  if (raw.gradesBySubject && typeof raw.gradesBySubject === 'object') {
    Object.entries(raw.gradesBySubject).forEach(([subjectId, stuMap]) => {
      if (!stuMap || typeof stuMap !== 'object') return;
      gradesBySubject[subjectId] = {};
      Object.entries(stuMap).forEach(([studentId, rec]) => {
        gradesBySubject[subjectId][studentId] = migrateLegacyRecordToMonthly(rec, studentId, subjectId);
      });
    });
  } else if (raw.gradesMap && typeof raw.gradesMap === 'object') {
    Object.entries(raw.gradesMap).forEach(([flatKey, rec]) => {
      const [studentId, subjectId] = flatKey.split('__');
      if (!studentId || !subjectId) return;
      if (!gradesBySubject[subjectId]) gradesBySubject[subjectId] = {};
      gradesBySubject[subjectId][studentId] = migrateLegacyRecordToMonthly(rec, studentId, subjectId);
    });
  } else if (!raw.subjects && !raw.students) {
    Object.entries(demo.gradesBySubject).forEach(([subId, map]) => {
      gradesBySubject[subId] = map;
    });
  }

  return {
    schemaVersion: 2,
    settings,
    teachers: Array.isArray(raw.teachers) ? raw.teachers : demo.teachers,
    stages: Array.isArray(raw.stages) ? raw.stages : demo.stages,
    grades: Array.isArray(raw.grades) ? raw.grades : demo.grades,
    sections: Array.isArray(raw.sections) ? raw.sections : demo.sections,
    subjects,
    students: Array.isArray(raw.students) ? raw.students : demo.students,
    gradesBySubject,
    attendance: Array.isArray(raw.attendance) ? raw.attendance : demo.attendance,
    notes: Array.isArray(raw.notes) ? raw.notes : demo.notes,
    schedule: Array.isArray(raw.schedule) ? raw.schedule : demo.schedule,
  };
}

export interface LegacyV6Student {
  name?: string;
  pin?: string;
  phone?: string;
  d1?: number | string;
  d2?: number | string;
  d3?: number | string;
  d4?: number | string;
  f1_m1?: number | string;
  f1_m2?: number | string;
  mid?: number | string;
  f2_m1?: number | string;
  f2_m2?: number | string;
  part?: number | string;
  status?: string;
}

export interface LegacyV6Database {
  sections?: string[];
  subjects?: string[];
  dailyTitles?: Record<string, { d1: string; d2: string; d3: string; d4?: string }>;
  data?: Record<string, Record<string, LegacyV6Student[]>>;
}

export function convertOldV6ToUnified(old: LegacyV6Database): AppDatabase {
  const base = createDemoData();
  base.stages = [{ id: 'stg_default', name: 'المرحلة الدراسية' }];
  base.grades = [{ id: 'grd_default', stageId: 'stg_default', name: 'الصف العام' }];
  base.sections = [];
  base.subjects = [];
  base.students = [];
  base.gradesBySubject = {};
  base.attendance = [];
  base.notes = [];
  base.schedule = [];

  const secMap: Record<string, string> = {};
  (old.sections || []).forEach((secName) => {
    const cleanSec = String(secName).replace(/^شعبة\s+/, '').trim() || secName;
    const secId = uid('sec');
    secMap[secName] = secId;
    base.sections.push({ id: secId, gradeId: 'grd_default', name: cleanSec });
  });

  const subMap: Record<string, string> = {};
  (old.subjects || []).forEach((subName) => {
    const subId = uid('sub');
    subMap[subName] = subId;
    const oldDt = old.dailyTitles && old.dailyTitles[subName];
    const dt = {
      d1: oldDt?.d1 || 'اليومي 1',
      d2: oldDt?.d2 || 'اليومي 2',
      d3: oldDt?.d3 || 'اليومي 3',
      d4: oldDt?.d4 || 'اليومي 4',
    };
    const termConfig = createDefaultTermConfig(dt);
    termConfig.term1Months[2].enabled = false;
    termConfig.term2Months[2].enabled = false;
    base.subjects.push({ id: subId, gradeId: 'grd_default', name: subName, dailyTitles: dt, termConfig });
    base.gradesBySubject[subId] = {};
  });

  const stuKeyMap: Record<string, string> = {};
  const todayStr = new Date().toISOString().slice(0, 10);
  const attBySec: Record<string, Record<string, 'present' | 'absent' | 'late'>> = {};

  (old.subjects || []).forEach((subName) => {
    const subId = subMap[subName];
    (old.sections || []).forEach((secName) => {
      const secId = secMap[secName];
      const list = (old.data && old.data[subName] && old.data[subName][secName]) || [];
      list.forEach((st, idx) => {
        const stuKey = `${secId}__${st.pin || st.name || idx}`;
        let stuId = stuKeyMap[stuKey];
        if (!stuId) {
          stuId = uid('stu');
          stuKeyMap[stuKey] = stuId;
          base.students.push({
            id: stuId,
            number: String(base.students.length + 101),
            name: st.name || `طالب ${idx + 1}`,
            sectionId: secId,
            pin: st.pin || String(1000 + base.students.length),
            phone: st.phone || '',
          });
        }
        base.gradesBySubject[subId][stuId] = migrateLegacyRecordToMonthly(
          {
            d1: isNum(st.d1) ? Number(st.d1) : '',
            d2: isNum(st.d2) ? Number(st.d2) : '',
            d3: isNum(st.d3) ? Number(st.d3) : '',
            d4: isNum(st.d4) ? Number(st.d4) : '',
            f1_m1: isNum(st.f1_m1) ? Number(st.f1_m1) : '',
            f1_m2: isNum(st.f1_m2) ? Number(st.f1_m2) : '',
            mid: isNum(st.mid) ? Number(st.mid) : '',
            f2_m1: isNum(st.f2_m1) ? Number(st.f2_m1) : '',
            f2_m2: isNum(st.f2_m2) ? Number(st.f2_m2) : '',
            part: isNum(st.part) ? Number(st.part) : 0,
          },
          stuId,
          subId
        );
        if (st.status) {
          if (!attBySec[secId]) attBySec[secId] = {};
          attBySec[secId][stuId] =
            st.status === 'غائب' ? 'absent' : st.status === 'مجاز' ? 'late' : 'present';
        }
      });
    });
  });

  Object.entries(attBySec).forEach(([secId, records]) => {
    base.attendance.push({ id: uid('att'), date: todayStr, sectionId: secId, records });
  });

  return base;
}

export type QuickGradeMode = 'daily' | 'written';

export function normalizeArabicSearch(text: string): string {
  return String(text || '')
    .trim()
    .toLowerCase()
    .replace(/[\u064B-\u065F\u0670]/g, '')
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/\s+/g, ' ');
}

export function getQuickGradeMaxScore(
  mode: QuickGradeMode,
  monthCfg?: MonthConfig,
  dailySectionId?: string
): number {
  if (mode === 'written') return 100;
  const sec = (monthCfg?.dailySections || []).find((s) => s.id === dailySectionId);
  if (!sec) return 10;
  return Math.max(1, Number(sec.maxScore) || 10);
}

export function resolveQuickGradeLimit(
  enforceLimit: boolean,
  customMax: number | '',
  fallbackMax: number
): number | null {
  if (!enforceLimit) return null;
  const parsed = Number(customMax);
  if (customMax !== '' && !Number.isNaN(parsed) && parsed >= 1) {
    return round1(parsed);
  }
  return Math.max(1, Number(fallbackMax) || 10);
}

export function clampQuickGradeValue(raw: string | number, maxScore: number | null): number | '' {
  if (raw === '' || raw === null || raw === undefined) return '';
  if (typeof raw === 'string' && raw.trim() === '') return '';
  let num = Number(raw);
  if (Number.isNaN(num)) return '';
  if (num < 0) num = 0;
  if (maxScore !== null) {
    const safeMax = Math.max(1, Number(maxScore) || 10);
    if (num > safeMax) num = safeMax;
  }
  return round1(num);
}

export function stepQuickGradeValue(
  current: number | '' | undefined,
  delta: number,
  maxScore: number | null
): { nextValue: number; reachedMax: boolean; reachedMin: boolean } {
  const base = isNum(current) ? Number(current) : 0;
  const rawNext = round1(base + delta);
  if (maxScore === null) {
    const nextValue = Math.max(0, rawNext);
    return {
      nextValue,
      reachedMax: false,
      reachedMin: nextValue <= 0,
    };
  }
  const safeMax = Math.max(1, Number(maxScore) || 10);
  const nextValue = Math.min(safeMax, Math.max(0, rawNext));
  return {
    nextValue,
    reachedMax: nextValue >= safeMax,
    reachedMin: nextValue <= 0,
  };
}

export function filterStudentsForQuickGrading(
  db: AppDatabase,
  params: {
    query: string;
    gradeId: string;
    sectionId?: string;
    scopeMode: 'current_section' | 'all_grade_sections';
    allowedSectionIds?: Set<string> | null;
  }
): Student[] {
  const gradeSectionIds = new Set(
    db.sections
      .filter((sec) => {
        if (sec.gradeId !== params.gradeId) return false;
        if (params.allowedSectionIds && !params.allowedSectionIds.has(sec.id)) return false;
        if (params.scopeMode === 'current_section' && params.sectionId) {
          return sec.id === params.sectionId;
        }
        return true;
      })
      .map((sec) => sec.id)
  );

  const normalizedQuery = normalizeArabicSearch(params.query);

  return db.students
    .filter((stu) => {
      if (!gradeSectionIds.has(stu.sectionId)) return false;
      if (!normalizedQuery) return true;
      const nameMatch = normalizeArabicSearch(stu.name).includes(normalizedQuery);
      const numberMatch = normalizeArabicSearch(stu.number).includes(normalizedQuery);
      return nameMatch || numberMatch;
    })
    .sort((a, b) => a.name.localeCompare(b.name, 'ar'));
}

