import { useEffect, useMemo, useRef, useState } from 'react';
import { Award, CheckCircle2, Eraser, Search, X } from 'lucide-react';
import type { AcademicContext, AppDatabase, AuthSession, SubjectTermConfig } from '../types/gradebook';
import {
  calcMonthMetrics,
  clampQuickGradeValue,
  filterStudentsForQuickGrading,
  getAllowedTeacherScope,
  getGradeRecord,
  getQuickGradeMaxScore,
  getSubjectTermConfig,
  isNum,
  resolveQuickGradeLimit,
  round1,
  stepQuickGradeValue,
  type QuickGradeMode,
} from '../utils/evaluation';

interface QuickGradeModalProps {
  open: boolean;
  onClose: () => void;
  db: AppDatabase;
  ctx: AcademicContext;
  session: AuthSession;
  initialTermKey?: 'term1Months' | 'term2Months';
  initialMonthId?: string;
  onUpdateMonthDailyScore: (
    studentId: string,
    subjectId: string,
    term: 'term1Months' | 'term2Months',
    monthId: string,
    sectionId: string,
    value: number | ''
  ) => void;
  onUpdateMonthWritten: (
    studentId: string,
    subjectId: string,
    term: 'term1Months' | 'term2Months',
    monthId: string,
    value: number | ''
  ) => void;
  onUpdateSubjectTermConfig?: (subjectId: string, nextConfig: SubjectTermConfig) => void;
  onNotify: (msg: string) => void;
}

export function QuickGradeModal({
  open,
  onClose,
  db,
  ctx,
  session,
  initialTermKey = 'term1Months',
  initialMonthId = 'm1',
  onUpdateMonthDailyScore,
  onUpdateMonthWritten,
  onUpdateSubjectTermConfig,
  onNotify,
}: QuickGradeModalProps) {
  const [mode, setMode] = useState<QuickGradeMode>('daily');
  const [termKey, setTermKey] = useState<'term1Months' | 'term2Months'>(initialTermKey);
  const [monthId, setMonthId] = useState<string>(initialMonthId);
  const [dailySectionId, setDailySectionId] = useState<string>('');
  const [enforceLimit, setEnforceLimit] = useState<boolean>(true);
  const [customMaxScore, setCustomMaxScore] = useState<number | ''>(10);
  const [query, setQuery] = useState<string>('');
  const [scopeMode, setScopeMode] = useState<'current_section' | 'all_grade_sections'>('current_section');

  const searchInputRef = useRef<HTMLInputElement | null>(null);

  const subject = db.subjects.find((sb) => sb.id === ctx.subjectId);
  const grade = db.grades.find((g) => g.id === ctx.gradeId);
  const section = db.sections.find((s) => s.id === ctx.sectionId);

  const termConfig = useMemo(() => (subject ? getSubjectTermConfig(subject) : null), [subject]);
  const monthsList = useMemo(
    () => (termConfig ? termConfig[termKey] : []),
    [termConfig, termKey]
  );
  const activeMonth = useMemo(
    () => monthsList.find((m) => m.id === monthId) || monthsList[0],
    [monthsList, monthId]
  );

  useEffect(() => {
    if (!open) return;
    setTermKey(initialTermKey);
    setMonthId(initialMonthId);
    const frame = window.requestAnimationFrame(() => {
      searchInputRef.current?.focus();
    });
    return () => window.cancelAnimationFrame(frame);
  }, [open, initialTermKey, initialMonthId]);

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, onClose]);

  useEffect(() => {
    if (!activeMonth) return;
    const valid = activeMonth.dailySections.some((ds) => ds.id === dailySectionId);
    if (!valid) {
      setDailySectionId(activeMonth.dailySections[0]?.id || '');
    }
  }, [activeMonth, dailySectionId]);

  const defaultSectionMax = getQuickGradeMaxScore(mode, activeMonth, dailySectionId);

  useEffect(() => {
    setCustomMaxScore(defaultSectionMax);
  }, [mode, termKey, activeMonth?.id, dailySectionId, defaultSectionMax]);

  const { allowedSectionIds } = useMemo(
    () => getAllowedTeacherScope(db, session),
    [db, session]
  );

  const filteredStudents = useMemo(
    () =>
      filterStudentsForQuickGrading(db, {
        query,
        gradeId: ctx.gradeId,
        sectionId: ctx.sectionId,
        scopeMode,
        allowedSectionIds,
      }),
    [db, query, ctx.gradeId, ctx.sectionId, scopeMode, allowedSectionIds]
  );

  if (!open) return null;

  const activeDailyDef = activeMonth?.dailySections.find((s) => s.id === dailySectionId);
  const effectiveMaxScore = resolveQuickGradeLimit(enforceLimit, customMaxScore, defaultSectionMax);
  const noDailySectionsAvailable =
    mode === 'daily' && (!activeMonth || activeMonth.dailySections.length === 0);

  const plusSteps =
    effectiveMaxScore === null
      ? mode === 'written'
        ? [1, 5, 10]
        : [0.5, 1, 2]
      : effectiveMaxScore <= 20
      ? [0.5, 1, 2]
      : [1, 5, 10];
  const minusStep =
    effectiveMaxScore === null
      ? mode === 'written'
        ? -5
        : -1
      : effectiveMaxScore <= 20
      ? -1
      : -5;

  const applyScore = (studentId: string, nextVal: number | '') => {
    if (!subject || !activeMonth) return;
    if (mode === 'daily') {
      if (!activeDailyDef) return;
      onUpdateMonthDailyScore(
        studentId,
        subject.id,
        termKey,
        activeMonth.id,
        activeDailyDef.id,
        nextVal
      );
    } else {
      onUpdateMonthWritten(studentId, subject.id, termKey, activeMonth.id, nextVal);
    }
  };

  const handleStep = (
    studentId: string,
    studentName: string,
    currentVal: number | '' | undefined,
    delta: number
  ) => {
    const { nextValue, reachedMax } = stepQuickGradeValue(currentVal, delta, effectiveMaxScore);
    applyScore(studentId, nextValue);
    if (delta > 0 && reachedMax && effectiveMaxScore !== null) {
      onNotify(`وصل الطالب ${studentName} للحد الأعلى (${effectiveMaxScore})`);
    }
  };

  const handleDirectInput = (studentId: string, studentName: string, raw: string) => {
    if (raw === '') {
      applyScore(studentId, '');
      return;
    }
    const num = Number(raw);
    const clamped = clampQuickGradeValue(raw, effectiveMaxScore);
    applyScore(studentId, clamped);
    if (effectiveMaxScore !== null && !Number.isNaN(num) && num > effectiveMaxScore) {
      onNotify(
        `الحد الأعلى المحدد هو ${effectiveMaxScore} — تم ضبط درجة ${studentName} عند الحد الأعلى`
      );
    }
  };

  const handleSetMax = (studentId: string, studentName: string) => {
    if (effectiveMaxScore === null) return;
    applyScore(studentId, effectiveMaxScore);
    onNotify(`تم منح ${studentName} الحد الأعلى (${effectiveMaxScore} / ${effectiveMaxScore})`);
  };

  const handleSaveCustomMaxToSection = () => {
    if (
      !subject ||
      !termConfig ||
      !activeMonth ||
      !activeDailyDef ||
      effectiveMaxScore === null ||
      !onUpdateSubjectTermConfig
    ) {
      return;
    }
    const nextConfig: SubjectTermConfig = {
      ...termConfig,
      [termKey]: termConfig[termKey].map((m) =>
        m.id === activeMonth.id
          ? {
              ...m,
              dailySections: m.dailySections.map((ds) =>
                ds.id === activeDailyDef.id ? { ...ds, maxScore: effectiveMaxScore } : ds
              ),
            }
          : m
      ),
    };
    onUpdateSubjectTermConfig(subject.id, nextConfig);
    onNotify(`تم اعتماد (${effectiveMaxScore}) كحد أعلى لقسم ${activeDailyDef.name}`);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/55 p-3 backdrop-blur-[1px] sm:p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="quick-grade-modal-title"
        className="flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl dark:border-slate-800 dark:bg-slate-900"
      >
        {/* Modal Header */}
        <div className="flex items-start justify-between gap-3 border-b border-slate-200 px-4 py-3.5 dark:border-slate-800 sm:px-5">
          <div className="min-w-0">
            <h3
              id="quick-grade-modal-title"
              className="text-base font-extrabold text-slate-900 dark:text-slate-100 sm:text-lg"
            >
              نافذة البحث والرصد السريع للدرجات
            </h3>
            <p className="mt-0.5 truncate text-xs text-slate-500 dark:text-slate-400">
              <span>{subject?.name || 'لا توجد مادة'}</span>
              <span aria-hidden="true"> · </span>
              <span>{grade?.name || '—'}</span>
              <span aria-hidden="true"> · </span>
              <span>
                {scopeMode === 'current_section'
                  ? `شعبة ${section?.name || '—'}`
                  : 'جميع شعب الصف المسموحة'}
              </span>
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="إغلاق نافذة الرصد السريع"
            className="inline-flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Grading Target & Custom Max Limit Controls */}
        <div className="space-y-3 border-b border-slate-200 bg-slate-50/70 px-4 py-3.5 dark:border-slate-800 dark:bg-slate-900/60 sm:px-5">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="grid grid-cols-2 gap-1 rounded-lg bg-slate-200/75 p-1 dark:bg-slate-800 sm:inline-flex">
              <button
                type="button"
                onClick={() => setMode('daily')}
                className={`cursor-pointer rounded-md px-3 py-1.5 text-xs font-bold whitespace-nowrap transition-colors ${
                  mode === 'daily'
                    ? 'bg-white text-emerald-800 shadow-sm dark:bg-slate-900 dark:text-emerald-400'
                    : 'text-slate-600 hover:text-slate-900 dark:text-slate-300'
                }`}
              >
                يومي (أقسام الشهر)
              </button>
              <button
                type="button"
                onClick={() => setMode('written')}
                className={`cursor-pointer rounded-md px-3 py-1.5 text-xs font-bold whitespace-nowrap transition-colors ${
                  mode === 'written'
                    ? 'bg-white text-emerald-800 shadow-sm dark:bg-slate-900 dark:text-emerald-400'
                    : 'text-slate-600 hover:text-slate-900 dark:text-slate-300'
                }`}
              >
                شهري (تحريري 100)
              </button>
            </div>

            {/* Optional / User-Decided Max Limit Control */}
            <div className="flex flex-wrap items-center gap-2">
              <div className="inline-flex items-center gap-1 rounded-lg bg-slate-200/75 p-1 dark:bg-slate-800">
                <button
                  type="button"
                  onClick={() => setEnforceLimit(true)}
                  className={`cursor-pointer rounded-md px-2.5 py-1 text-xs font-bold whitespace-nowrap transition-colors ${
                    enforceLimit
                      ? 'bg-white text-emerald-800 shadow-sm dark:bg-slate-900 dark:text-emerald-400'
                      : 'text-slate-600 hover:text-slate-900 dark:text-slate-300'
                  }`}
                >
                  تحديد حد أعلى
                </button>
                <button
                  type="button"
                  onClick={() => setEnforceLimit(false)}
                  className={`cursor-pointer rounded-md px-2.5 py-1 text-xs font-bold whitespace-nowrap transition-colors ${
                    !enforceLimit
                      ? 'bg-white text-emerald-800 shadow-sm dark:bg-slate-900 dark:text-emerald-400'
                      : 'text-slate-600 hover:text-slate-900 dark:text-slate-300'
                  }`}
                >
                  بدون حد (مفتوح)
                </button>
              </div>

              {enforceLimit && (
                <div className="flex items-center gap-1.5">
                  <label
                    htmlFor="qg-custom-max"
                    className="text-xs font-bold text-slate-600 whitespace-nowrap dark:text-slate-300"
                  >
                    الحد الأعلى:
                  </label>
                  <input
                    id="qg-custom-max"
                    aria-label="الحد الأعلى المخصص"
                    type="number"
                    min={1}
                    step={1}
                    value={customMaxScore}
                    onChange={(e) => {
                      const v = e.target.value;
                      if (v === '') {
                        setCustomMaxScore('');
                        return;
                      }
                      const parsed = Number(v);
                      if (!Number.isNaN(parsed)) {
                        setCustomMaxScore(Math.max(1, parsed));
                      }
                    }}
                    className="no-spinner h-8 w-16 rounded-lg border border-emerald-300 bg-white px-2 text-center text-xs font-extrabold tabular-nums text-emerald-800 focus:border-emerald-700 focus:outline-none dark:border-emerald-800 dark:bg-slate-800 dark:text-emerald-300"
                  />
                  {mode === 'daily' &&
                    activeDailyDef &&
                    effectiveMaxScore !== null &&
                    effectiveMaxScore !== activeDailyDef.maxScore &&
                    onUpdateSubjectTermConfig && (
                      <button
                        type="button"
                        onClick={handleSaveCustomMaxToSection}
                        className="cursor-pointer rounded-lg border border-emerald-300 bg-emerald-50 px-2 py-1 text-[11px] font-bold text-emerald-800 whitespace-nowrap hover:bg-emerald-100 dark:border-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300"
                      >
                        اعتماد للقسم
                      </button>
                    )}
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
            <div>
              <label
                htmlFor="qg-term-select"
                className="mb-1 block text-[11px] font-bold text-slate-600 dark:text-slate-400"
              >
                الفصل الدراسي
              </label>
              <select
                id="qg-term-select"
                value={termKey}
                onChange={(e) => {
                  const nextTerm = e.target.value as 'term1Months' | 'term2Months';
                  setTermKey(nextTerm);
                  const firstMonth = termConfig?.[nextTerm]?.[0]?.id || 'm1';
                  setMonthId(firstMonth);
                }}
                className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs font-semibold text-slate-800 focus:border-emerald-700 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              >
                <option value="term1Months">الفصل الأول</option>
                <option value="term2Months">الفصل الثاني</option>
              </select>
            </div>

            <div>
              <label
                htmlFor="qg-month-select"
                className="mb-1 block text-[11px] font-bold text-slate-600 dark:text-slate-400"
              >
                الشهر
              </label>
              <select
                id="qg-month-select"
                value={activeMonth?.id || ''}
                onChange={(e) => setMonthId(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs font-semibold text-slate-800 focus:border-emerald-700 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              >
                {monthsList.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.label}
                    {m.enabled ? '' : ' (غير محتسب)'}
                  </option>
                ))}
              </select>
            </div>

            <div>
              {mode === 'daily' ? (
                <>
                  <label
                    htmlFor="qg-section-select"
                    className="mb-1 block text-[11px] font-bold text-slate-600 dark:text-slate-400"
                  >
                    قسم التقييم اليومي
                  </label>
                  <select
                    id="qg-section-select"
                    value={activeDailyDef?.id || ''}
                    onChange={(e) => setDailySectionId(e.target.value)}
                    disabled={!activeMonth?.dailySections.length}
                    className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs font-semibold text-slate-800 focus:border-emerald-700 focus:outline-none disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                  >
                    {activeMonth?.dailySections.length ? (
                      activeMonth.dailySections.map((ds) => (
                        <option key={ds.id} value={ds.id}>
                          {ds.name} (كم القسم: {ds.maxScore})
                        </option>
                      ))
                    ) : (
                      <option value="">لا توجد أقسام يومي</option>
                    )}
                  </select>
                </>
              ) : (
                <>
                  <div className="mb-1 block text-[11px] font-bold text-slate-600 dark:text-slate-400">
                    نوع الدرجة الشهرية
                  </div>
                  <div className="flex h-[34px] items-center rounded-lg border border-slate-200 bg-white px-3 text-xs font-bold text-emerald-800 dark:border-slate-700 dark:bg-slate-800 dark:text-emerald-400">
                    التحريري الشهري
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Search & Scope Row */}
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute top-1/2 right-3 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                ref={searchInputRef}
                type="search"
                aria-label="ابحث باسم الطالب أو رقمه"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="ابحث باسم الطالب أو رقمه..."
                className="w-full rounded-lg border border-slate-300 bg-white py-2 pr-9 pl-9 text-sm font-medium text-slate-900 placeholder:text-slate-400 focus:border-emerald-700 focus:outline-none [&::-webkit-search-cancel-button]:appearance-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-500"
              />
              {query && (
                <button
                  type="button"
                  onClick={() => {
                    setQuery('');
                    searchInputRef.current?.focus();
                  }}
                  aria-label="مسح البحث"
                  className="absolute top-1/2 left-2.5 -translate-y-1/2 cursor-pointer rounded p-0.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            <div className="flex shrink-0 items-center gap-1 rounded-lg bg-slate-200/75 p-1 dark:bg-slate-800">
              <button
                type="button"
                onClick={() => setScopeMode('current_section')}
                className={`cursor-pointer rounded-md px-2.5 py-1.5 text-xs font-bold whitespace-nowrap transition-colors ${
                  scopeMode === 'current_section'
                    ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-900 dark:text-slate-100'
                    : 'text-slate-600 hover:text-slate-900 dark:text-slate-300'
                }`}
              >
                الشعبة الحالية
              </button>
              <button
                type="button"
                onClick={() => setScopeMode('all_grade_sections')}
                className={`cursor-pointer rounded-md px-2.5 py-1.5 text-xs font-bold whitespace-nowrap transition-colors ${
                  scopeMode === 'all_grade_sections'
                    ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-900 dark:text-slate-100'
                    : 'text-slate-600 hover:text-slate-900 dark:text-slate-300'
                }`}
              >
                جميع شعب الصف
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between text-[11px] text-slate-500 tabular-nums dark:text-slate-400">
            <span>الطلبة المطابقون: {filteredStudents.length}</span>
            <span>
              {mode === 'daily' && activeDailyDef
                ? `ترصد الآن: ${activeMonth?.label} · ${activeDailyDef.name}`
                : `ترصد الآن: ${activeMonth?.label || ''} · التحريري الشهري`}
              {' · '}
              {effectiveMaxScore !== null
                ? `الحد الأعلى: ${effectiveMaxScore}`
                : 'بدون حد أعلى (مفتوح)'}
            </span>
          </div>
        </div>

        {/* Body / Students List */}
        <div className="flex-1 overflow-y-auto px-4 py-2 sm:px-5">
          {!subject ? (
            <div className="py-10 text-center text-sm text-slate-500 dark:text-slate-400">
              يرجى اختيار مادة دراسية من الشريط العلوي أولاً لبدء رصد الدرجات.
            </div>
          ) : noDailySectionsAvailable ? (
            <div className="py-10 text-center">
              <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                لا توجد أقسام يومي مضافة في {activeMonth?.label}.
              </p>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                يمكنك التبديل إلى تبويب «شهري (تحريري 100)» أو إضافة أقسام يومي من سجل الدرجات.
              </p>
              <button
                type="button"
                onClick={() => setMode('written')}
                className="mt-3 cursor-pointer rounded-lg bg-emerald-800 px-3.5 py-2 text-xs font-bold text-white hover:bg-emerald-700"
              >
                التبديل إلى التحريري الشهري
              </button>
            </div>
          ) : filteredStudents.length === 0 ? (
            <div className="py-10 text-center">
              <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                {query
                  ? `لم يتم العثور على طالب يطابق "${query}".`
                  : 'لا يوجد طلبة في هذا النطاق.'}
              </p>
              {query && (
                <button
                  type="button"
                  onClick={() => {
                    setQuery('');
                    searchInputRef.current?.focus();
                  }}
                  className="mt-3 cursor-pointer rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                >
                  عرض جميع الطلبة
                </button>
              )}
            </div>
          ) : (
            <div className="divide-y divide-slate-200 dark:divide-slate-800">
              {filteredStudents.map((stu) => {
                const stuSec = db.sections.find((s) => s.id === stu.sectionId);
                const rec = getGradeRecord(db, stu.id, subject.id);
                const monthData = activeMonth ? rec[termKey]?.[activeMonth.id] : undefined;
                const monthMetrics = activeMonth
                  ? calcMonthMetrics(activeMonth, monthData)
                  : null;

                const currentRaw: number | '' =
                  mode === 'daily'
                    ? activeDailyDef
                      ? monthData?.dailyScores?.[activeDailyDef.id] ?? ''
                      : ''
                    : monthData?.written ?? '';

                const hasScore = isNum(currentRaw);
                const currentNum = hasScore ? Number(currentRaw) : 0;
                const reachedMax = effectiveMaxScore !== null && hasScore && currentNum >= effectiveMaxScore;
                const reachedMin = !hasScore || currentNum <= 0;
                const pct =
                  effectiveMaxScore !== null
                    ? Math.min(100, Math.max(0, Math.round((currentNum / effectiveMaxScore) * 100)))
                    : 0;
                const remaining =
                  effectiveMaxScore !== null ? round1(Math.max(0, effectiveMaxScore - currentNum)) : null;

                return (
                  <div
                    key={stu.id}
                    data-testid={`quick-grade-row-${stu.id}`}
                    className="flex flex-col justify-between gap-3 py-3.5 sm:flex-row sm:items-center"
                  >
                    {/* Student Info + Progress */}
                    <div className="min-w-0 flex-1 space-y-1.5">
                      <div className="flex flex-wrap items-baseline gap-2">
                        <span className="text-sm font-extrabold text-slate-900 dark:text-slate-100">
                          {stu.name}
                        </span>
                        <span className="text-xs text-slate-500 tabular-nums dark:text-slate-400">
                          #{stu.number} · شعبة {stuSec?.name || '—'}
                        </span>
                      </div>

                      <div className="flex flex-wrap items-center gap-3">
                        {effectiveMaxScore !== null ? (
                          <>
                            <div className="h-1.5 w-32 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                              <div
                                className={`h-full ${reachedMax ? 'bg-emerald-600' : 'bg-sky-600'}`}
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                            <span className="text-xs font-bold tabular-nums text-slate-700 dark:text-slate-200">
                              {hasScore ? currentNum : '—'} / {effectiveMaxScore}
                            </span>
                            {reachedMax ? (
                              <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700 dark:text-emerald-400">
                                <CheckCircle2 className="h-3.5 w-3.5" />
                                <span>وصل للحد الأعلى</span>
                              </span>
                            ) : hasScore ? (
                              <span className="text-[11px] text-slate-500 tabular-nums dark:text-slate-400">
                                متبقي {remaining} للحد الأعلى
                              </span>
                            ) : (
                              <span className="text-[11px] text-slate-400 dark:text-slate-500">
                                غير مرصود بعد
                              </span>
                            )}
                          </>
                        ) : (
                          <span className="text-xs font-bold tabular-nums text-slate-700 dark:text-slate-200">
                            {hasScore ? `الدرجة الحالية: ${currentNum} (مفتوح بدون حد أعلى)` : 'غير مرصود (بدون حد أعلى)'}
                          </span>
                        )}
                      </div>

                      {monthMetrics && (
                        <div className="text-[11px] text-slate-500 tabular-nums dark:text-slate-400">
                          اليومي (من 100):{' '}
                          <strong className="text-sky-700 dark:text-sky-400">
                            {monthMetrics.daily100 ?? '—'}
                          </strong>
                          <span aria-hidden="true"> · </span>
                          معدل {activeMonth?.label}:{' '}
                          <strong className="text-emerald-700 dark:text-emerald-400">
                            {monthMetrics.monthAvg ?? '—'}
                          </strong>
                        </div>
                      )}
                    </div>

                    {/* Controls: Step, Direct Input, Optional Max Cap, Clear */}
                    <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        disabled={reachedMin}
                        onClick={() => handleStep(stu.id, stu.name, currentRaw, minusStep)}
                        aria-label={`إنقاص درجة ${stu.name} بمقدار ${Math.abs(minusStep)}`}
                        className="h-9 min-w-[38px] cursor-pointer rounded-lg border border-slate-200 bg-slate-50 px-2 text-xs font-bold tabular-nums text-slate-700 transition-colors hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                      >
                        {minusStep}
                      </button>

                      <input
                        type="number"
                        aria-label={`درجة ${stu.name}`}
                        min={0}
                        max={effectiveMaxScore ?? undefined}
                        step={0.5}
                        value={currentRaw}
                        placeholder="0"
                        onChange={(e) => handleDirectInput(stu.id, stu.name, e.target.value)}
                        className={`no-spinner h-9 w-16 rounded-lg border px-2 text-center text-sm font-extrabold tabular-nums focus:outline-none ${
                          reachedMax
                            ? 'border-emerald-500 bg-emerald-50/70 text-emerald-800 dark:border-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-300'
                            : 'border-slate-300 bg-white text-slate-900 focus:border-emerald-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100'
                        }`}
                      />

                      {plusSteps.map((step) => (
                        <button
                          key={step}
                          type="button"
                          disabled={reachedMax}
                          onClick={() => handleStep(stu.id, stu.name, currentRaw, step)}
                          aria-label={`زيادة درجة ${stu.name} بمقدار ${step}`}
                          className="h-9 min-w-[40px] cursor-pointer rounded-lg border border-emerald-200 bg-emerald-50 px-2 text-xs font-bold tabular-nums text-emerald-800 transition-colors hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-40 dark:border-emerald-800/80 dark:bg-emerald-950/50 dark:text-emerald-300 dark:hover:bg-emerald-950/80"
                        >
                          +{step}
                        </button>
                      ))}

                      {effectiveMaxScore !== null && (
                        <button
                          type="button"
                          disabled={reachedMax}
                          onClick={() => handleSetMax(stu.id, stu.name)}
                          aria-label={`منح الحد الأعلى للطالب ${stu.name}`}
                          className="inline-flex h-9 cursor-pointer items-center gap-1 rounded-lg bg-emerald-800 px-2.5 text-xs font-bold whitespace-nowrap text-white transition-colors hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-40 dark:bg-emerald-600 dark:hover:bg-emerald-500"
                        >
                          <Award className="h-3.5 w-3.5 shrink-0" />
                          <span>الحد الأعلى ({effectiveMaxScore})</span>
                        </button>
                      )}

                      <button
                        type="button"
                        disabled={!hasScore}
                        onClick={() => applyScore(stu.id, '')}
                        aria-label={`مسح درجة ${stu.name}`}
                        title="مسح الدرجة"
                        className="inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 transition-colors hover:border-red-200 hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-35 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400 dark:hover:border-red-900/60 dark:hover:bg-red-950/40 dark:hover:text-red-400"
                      >
                        <Eraser className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-800 dark:bg-slate-900/80 sm:px-5">
          <p className="text-xs text-slate-500 dark:text-slate-400">
            تُحفظ الدرجات تلقائياً في سجل مادة <strong>{subject?.name || '—'}</strong> المعزول فور التعديل.
          </p>
          <button
            type="button"
            onClick={onClose}
            className="cursor-pointer rounded-lg bg-slate-900 px-4 py-2 text-xs font-bold text-white whitespace-nowrap hover:bg-slate-800 dark:bg-slate-700 dark:hover:bg-slate-600"
          >
            إتمام وإغلاق
          </button>
        </div>
      </div>
    </div>
  );
}
