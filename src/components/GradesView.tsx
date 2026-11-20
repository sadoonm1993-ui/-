import { useEffect, useState } from 'react';
import { Copy, Download, Link2, Plus, Printer, Search, Settings2, Sparkles, Trash2, X } from 'lucide-react';
import type {
  AcademicContext,
  AppDatabase,
  DailySectionDef,
  ExamAttendanceStatus,
  NavView,
  SubjectTermConfig,
} from '../types/gradebook';
import {
  calcSubjectMetrics,
  evaluateStudentOverall,
  getGradeRecord,
  getSubjectTermConfig,
  uid,
} from '../utils/evaluation';
import { exportExcelWorkbook } from '../utils/storage';
import { GoogleFormsPanel, type GoogleFormsImportTarget } from './GoogleFormsPanel';
import { StatusBadge } from './StatusBadge';

type GradesTab = 'overview' | 'term1' | 'term2';

interface GradesViewProps {
  db: AppDatabase;
  ctx: AcademicContext;
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
  onUpdateCoreGrade: (
    studentId: string,
    subjectId: string,
    field: 'mid' | 'part' | 'final' | 'midStatus' | 'finalStatus',
    value: string | number
  ) => void;
  onUpdateSubjectTermConfig: (subjectId: string, nextConfig: SubjectTermConfig) => void;
  onApplyImportedGrades: (
    subjectId: string,
    target: GoogleFormsImportTarget,
    entries: Array<{ studentId: string; score: number }>
  ) => void;
  onNavigate: (view: NavView) => void;
  onOpenQuickGrade: (termKey?: 'term1Months' | 'term2Months', monthId?: string) => void;
  onPrintHtml: (html: string) => void;
  onNotify: (msg: string) => void;
}

function escapeHtml(str: unknown): string {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function GradesView({
  db,
  ctx,
  onUpdateMonthDailyScore,
  onUpdateMonthWritten,
  onUpdateCoreGrade,
  onUpdateSubjectTermConfig,
  onApplyImportedGrades,
  onNavigate,
  onOpenQuickGrade,
  onPrintHtml,
  onNotify,
}: GradesViewProps) {
  const [activeTab, setActiveTab] = useState<GradesTab>('overview');
  const [selectedMonthId, setSelectedMonthId] = useState<string>('m1');
  const [showFormsModal, setShowFormsModal] = useState(false);
  const [editingSections, setEditingSections] = useState<{
    termKey: 'term1Months' | 'term2Months';
    monthId: string;
    monthLabel: string;
    sections: DailySectionDef[];
  } | null>(null);

  useEffect(() => {
    if (!showFormsModal) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setShowFormsModal(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [showFormsModal]);

  const students = db.students
    .filter((s) => s.sectionId === ctx.sectionId)
    .sort((a, b) => a.name.localeCompare(b.name, 'ar'));
  const subject = db.subjects.find((sb) => sb.id === ctx.subjectId);

  if (!subject) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-6 text-center dark:border-slate-800 dark:bg-slate-900">
        <p className="text-sm text-slate-600 dark:text-slate-400">
          لا توجد مادة دراسية محددة لهذا الصف أو لحسابك الحالي.
        </p>
        <button
          type="button"
          onClick={() => onNavigate('dashboard')}
          className="mt-3 cursor-pointer rounded-lg bg-emerald-800 px-4 py-2 text-sm font-bold text-white hover:bg-emerald-700"
        >
          العودة للوحة التحكم
        </button>
      </div>
    );
  }

  const termConfig = getSubjectTermConfig(subject);
  const currentTermKey: 'term1Months' | 'term2Months' =
    activeTab === 'term2' ? 'term2Months' : 'term1Months';
  const monthsList = termConfig[currentTermKey];
  const activeMonth = monthsList.find((m) => m.id === selectedMonthId) || monthsList[0];

  const handleToggleMonthEnabled = (monthId: string) => {
    const enabledCount = monthsList.filter((m) => m.enabled).length;
    const target = monthsList.find((m) => m.id === monthId);
    if (target?.enabled && enabledCount <= 1) {
      onNotify('يجب إبقاء شهر واحد على الأقل مفعلاً لحساب المعدل');
      return;
    }
    const nextConfig: SubjectTermConfig = {
      ...termConfig,
      [currentTermKey]: monthsList.map((m) =>
        m.id === monthId ? { ...m, enabled: !m.enabled } : m
      ),
    };
    onUpdateSubjectTermConfig(subject.id, nextConfig);
    onNotify('تم تحديث الأشهر المحتسبة في المعدل');
  };

  const handleAddExtraMonth = () => {
    const nextNum = monthsList.length + 1;
    const newId = `m${nextNum}_${Date.now().toString(36).slice(-3)}`;
    const baseSections = activeMonth
      ? activeMonth.dailySections.map((s) => ({ ...s }))
      : [{ id: 'ds_1', name: 'الواجبات', maxScore: 10 }];
    const nextConfig: SubjectTermConfig = {
      ...termConfig,
      [currentTermKey]: [
        ...monthsList,
        {
          id: newId,
          label: `الشهر ${nextNum}`,
          enabled: true,
          dailySections: baseSections,
        },
      ],
    };
    onUpdateSubjectTermConfig(subject.id, nextConfig);
    setSelectedMonthId(newId);
    onNotify(`تمت إضافة الشهر ${nextNum}`);
  };

  const handleApplySectionsToAllTermMonths = () => {
    if (!activeMonth) return;
    const cloned = activeMonth.dailySections.map((s) => ({ ...s }));
    const nextConfig: SubjectTermConfig = {
      ...termConfig,
      [currentTermKey]: monthsList.map((m) => ({
        ...m,
        dailySections: cloned.map((s) => ({ ...s })),
      })),
    };
    onUpdateSubjectTermConfig(subject.id, nextConfig);
    onNotify('تم تعميم أقسام اليومي على جميع أشهر هذا الفصل');
  };

  const clampNum = (raw: string, maxVal: number): number | '' => {
    if (raw === '') return '';
    let num = Number(raw);
    if (Number.isNaN(num) || num < 0) num = 0;
    if (num > maxVal) num = maxVal;
    return num;
  };

  const handleExportExcel = () => {
    const headers: string[] = ['اسم الطالب'];
    termConfig.term1Months.forEach((m) => {
      if (m.enabled) headers.push(`ف1 - ${m.label}`);
    });
    headers.push('معدل ف1', 'نصف السنة');
    termConfig.term2Months.forEach((m) => {
      if (m.enabled) headers.push(`ف2 - ${m.label}`);
    });
    headers.push(
      'معدل ف2',
      'المشاركة',
      'السعي السنوي',
      'حالة الإعفاء',
      'امتحان نهاية السنة',
      'درجة نهاية السنة',
      'التقييم'
    );

    const rows: (string | number)[][] = [headers];
    students.forEach((s) => {
      const rec = getGradeRecord(db, s.id, subject.id);
      const m = calcSubjectMetrics(rec, db.settings, subject);
      const overall = evaluateStudentOverall(db, s);
      const exemptText = overall.isGeneralExempt
        ? 'إعفاء كلي'
        : m.isSingleExempt
        ? 'إعفاء فردي'
        : 'غير معفى';

      const row: (string | number)[] = [s.name];
      m.term1MonthMetrics.forEach((mm) => {
        if (mm.enabled) row.push(mm.monthAvg ?? '');
      });
      row.push(m.term1 ?? '', m.mid ?? '');
      m.term2MonthMetrics.forEach((mm) => {
        if (mm.enabled) row.push(mm.monthAvg ?? '');
      });
      row.push(
        m.term2 ?? '',
        rec.part,
        m.currentEffort ?? '',
        exemptText,
        m.finalExam ?? '',
        m.finalGrade ?? '',
        overall.isGeneralExempt ? 'معفى إعفاءً كلياً' : m.statusLabel
      );
      rows.push(row);
    });
    exportExcelWorkbook(`سجل_درجات_${subject.name}`, rows);
    onNotify('تم تصدير سجل الدرجات الكامل بصيغة Excel');
  };

  const handlePrint = () => {
    const sec = db.sections.find((x) => x.id === ctx.sectionId);
    const grd = db.grades.find((x) => x.id === ctx.gradeId);
    const rowsHtml = students
      .map((s, i) => {
        const m = calcSubjectMetrics(getGradeRecord(db, s.id, subject.id), db.settings, subject);
        const overall = evaluateStudentOverall(db, s);
        const exemptLabel = overall.isGeneralExempt
          ? 'إعفاء كلي'
          : m.isSingleExempt
          ? 'إعفاء فردي'
          : '—';
        return `<tr>
          <td>${i + 1}</td>
          <td>${escapeHtml(s.name)}</td>
          <td>${m.term1 ?? '—'}</td>
          <td>${m.mid ?? '—'}</td>
          <td>${m.term2 ?? '—'}</td>
          <td>${m.currentEffort ?? '—'}</td>
          <td>${exemptLabel}</td>
          <td>${m.finalExam ?? '—'}</td>
          <td>${m.finalGrade ?? '—'}</td>
          <td>${escapeHtml(overall.isGeneralExempt ? 'معفى كلياً' : m.statusLabel)}</td>
        </tr>`;
      })
      .join('');

    onPrintHtml(`
      <div style="text-align:center;border-bottom:2px solid #000;padding-bottom:8px;">
        <h2 style="margin:0;">${escapeHtml(db.settings.schoolName)} — كشف درجات مادة (${escapeHtml(subject.name)})</h2>
        <p style="margin:4px 0;">الصف: ${escapeHtml(grd?.name || '')} · الشعبة: ${escapeHtml(sec?.name || '')} · السنة الدراسية: ${escapeHtml(db.settings.academicYear)}</p>
      </div>
      <table>
        <thead><tr><th>ت</th><th>اسم الطالب</th><th>م.ف1</th><th>نصف السنة</th><th>م.ف2</th><th>السعي السنوي</th><th>الإعفاء</th><th>نهائي</th><th>نهاية السنة</th><th>التقييم</th></tr></thead>
        <tbody>${rowsHtml}</tbody>
      </table>
      <div style="margin-top:24px;display:flex;justify-content:space-between;">
        <span>مدرس المادة: ${escapeHtml(db.settings.teacherName)}</span>
        <span>تاريخ الطباعة: ${new Date().toLocaleDateString('ar-IQ')}</span>
      </div>
    `);
  };

  const inputClass =
    'no-spinner w-12 rounded-md border border-slate-200 bg-slate-50 px-1 py-1 text-center text-xs font-bold tabular-nums text-slate-900 focus:border-emerald-700 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100';

  const enabledT1Count = termConfig.term1Months.filter((m) => m.enabled).length;
  const enabledT2Count = termConfig.term2Months.filter((m) => m.enabled).length;

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
              سجل درجات مادة: {subject.name} (معزول برمجياً)
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              معدل الشهر = (اليومي من 100 + التحريري من 100) ÷ 2 · السعي = (ف1 + نصف السنة + ف2) ÷ 3
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() =>
                onOpenQuickGrade(
                  activeTab === 'term2' ? 'term2Months' : 'term1Months',
                  activeMonth?.id || 'm1'
                )
              }
              className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-800 whitespace-nowrap hover:bg-emerald-100 dark:border-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 dark:hover:bg-emerald-950"
            >
              <Search className="h-3.5 w-3.5" />
              <span>بحث ورصد درجة</span>
            </button>
            <button
              type="button"
              onClick={() => setShowFormsModal(true)}
              className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-sky-200 bg-sky-50 px-3 py-1.5 text-xs font-bold text-sky-800 whitespace-nowrap hover:bg-sky-100 dark:border-sky-800 dark:bg-sky-950/60 dark:text-sky-300 dark:hover:bg-sky-950"
            >
              <Link2 className="h-3.5 w-3.5" />
              <span>ربط Google Forms</span>
            </button>
            <button
              type="button"
              onClick={() => onNavigate('tools')}
              className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-bold text-slate-950 whitespace-nowrap hover:bg-amber-400"
            >
              <Sparkles className="h-3.5 w-3.5" />
              <span>عجلة المشاركة</span>
            </button>
            <button
              type="button"
              onClick={handleExportExcel}
              className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700 whitespace-nowrap hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
            >
              <Download className="h-3.5 w-3.5" />
              <span>تصدير Excel</span>
            </button>
            <button
              type="button"
              onClick={handlePrint}
              className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-emerald-800 px-3 py-1.5 text-xs font-bold text-white whitespace-nowrap hover:bg-emerald-700 dark:bg-emerald-600"
            >
              <Printer className="h-3.5 w-3.5" />
              <span>طباعة كشف A4</span>
            </button>
          </div>
        </div>

        {/* Sub-tabs inside GradesView */}
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-3 dark:border-slate-800">
          <div className="flex flex-wrap items-center gap-1 rounded-lg bg-slate-100 p-1 dark:bg-slate-800">
            <button
              type="button"
              onClick={() => setActiveTab('overview')}
              className={`cursor-pointer rounded-md px-3 py-1.5 text-xs font-bold whitespace-nowrap transition-colors ${
                activeTab === 'overview'
                  ? 'bg-white text-emerald-800 shadow-sm dark:bg-slate-900 dark:text-emerald-400'
                  : 'text-slate-600 hover:text-slate-900 dark:text-slate-300'
              }`}
            >
              السعي ونهاية السنة والإعفاء
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveTab('term1');
                setSelectedMonthId(termConfig.term1Months[0]?.id || 'm1');
              }}
              className={`cursor-pointer rounded-md px-3 py-1.5 text-xs font-bold whitespace-nowrap transition-colors ${
                activeTab === 'term1'
                  ? 'bg-white text-emerald-800 shadow-sm dark:bg-slate-900 dark:text-emerald-400'
                  : 'text-slate-600 hover:text-slate-900 dark:text-slate-300'
              }`}
            >
              الفصل الأول ({enabledT1Count} أشهر)
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveTab('term2');
                setSelectedMonthId(termConfig.term2Months[0]?.id || 'm1');
              }}
              className={`cursor-pointer rounded-md px-3 py-1.5 text-xs font-bold whitespace-nowrap transition-colors ${
                activeTab === 'term2'
                  ? 'bg-white text-emerald-800 shadow-sm dark:bg-slate-900 dark:text-emerald-400'
                  : 'text-slate-600 hover:text-slate-900 dark:text-slate-300'
              }`}
            >
              الفصل الثاني ({enabledT2Count} أشهر)
            </button>
          </div>

          {activeTab !== 'overview' && (
            <div className="text-xs text-slate-500 tabular-nums dark:text-slate-400">
              الأشهر المختارة في المعدل: <strong>{monthsList.filter((m) => m.enabled).length}</strong> من {monthsList.length}
            </div>
          )}
        </div>

        {/* OVERVIEW / ANNUAL EFFORT & FINAL YEAR TAB */}
        {activeTab === 'overview' && (
          <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-800">
            <table className="w-full min-w-[960px] border-collapse text-right text-xs">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-800 dark:bg-slate-800/70 dark:text-slate-300">
                  <th className="sticky right-0 z-10 bg-slate-50 px-3 py-2.5 font-bold dark:bg-slate-800">اسم الطالب</th>
                  <th className="px-2 py-2.5 text-center font-bold">م. ف1</th>
                  <th className="px-2 py-2.5 text-center font-bold">نصف السنة (تحريري)</th>
                  <th className="px-2 py-2.5 text-center font-bold">حالة ن.س</th>
                  <th className="px-2 py-2.5 text-center font-bold">م. ف2</th>
                  <th className="px-2 py-2.5 text-center font-bold">المشاركة</th>
                  <th className="px-2 py-2.5 text-center font-bold text-emerald-800 dark:text-emerald-400">السعي السنوي</th>
                  <th className="px-2 py-2.5 text-center font-bold">حالة الإعفاء</th>
                  <th className="px-2 py-2.5 text-center font-bold">نهاية السنة</th>
                  <th className="px-2 py-2.5 text-center font-bold">حالته</th>
                  <th className="px-2 py-2.5 text-center font-bold">الدرجة النهائية</th>
                  <th className="px-3 py-2.5 font-bold">التقييم</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                {students.map((s) => {
                  const rec = getGradeRecord(db, s.id, subject.id);
                  const m = calcSubjectMetrics(rec, db.settings, subject);
                  const overall = evaluateStudentOverall(db, s);
                  const exemptDisplay = overall.isGeneralExempt
                    ? 'إعفاء كلي'
                    : m.isSingleExempt
                    ? 'إعفاء فردي'
                    : 'غير معفى';
                  const exemptTone = overall.isGeneralExempt || m.isSingleExempt ? 'success' : 'muted';
                  const finalBlocked = overall.isGeneralExempt || m.isSingleExempt;

                  return (
                    <tr
                      key={s.id}
                      data-testid={`grade-row-${s.id}`}
                      className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40"
                    >
                      <td className="sticky right-0 z-10 bg-white px-3 py-2 font-bold whitespace-nowrap text-slate-900 dark:bg-slate-900 dark:text-slate-100">
                        {s.name}
                      </td>
                      <td className="px-2 py-2 text-center font-bold tabular-nums text-slate-900 dark:text-slate-100">
                        {m.term1 ?? '—'}
                      </td>
                      <td className="px-2 py-2 text-center">
                        <input
                          aria-label={`نصف السنة - ${s.name}`}
                          type="number"
                          min={0}
                          max={100}
                          step={0.5}
                          value={rec.mid}
                          onChange={(e) => onUpdateCoreGrade(s.id, subject.id, 'mid', clampNum(e.target.value, 100))}
                          className={inputClass}
                        />
                      </td>
                      <td className="px-2 py-2 text-center">
                        <select
                          aria-label={`حالة نصف السنة - ${s.name}`}
                          value={rec.midStatus}
                          onChange={(e) =>
                            onUpdateCoreGrade(s.id, subject.id, 'midStatus', e.target.value as ExamAttendanceStatus)
                          }
                          className="rounded-md border border-slate-200 bg-slate-50 px-1.5 py-1 text-xs font-semibold text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                        >
                          <option value="present">حاضر</option>
                          <option value="absent">غائب</option>
                          <option value="postponed">مؤجل</option>
                        </select>
                      </td>
                      <td className="px-2 py-2 text-center font-bold tabular-nums text-slate-900 dark:text-slate-100">
                        {m.term2 ?? '—'}
                      </td>
                      <td className="px-2 py-2 text-center">
                        <input
                          aria-label={`المشاركة - ${s.name}`}
                          type="number"
                          min={0}
                          max={100}
                          step={0.5}
                          value={rec.part}
                          onChange={(e) => onUpdateCoreGrade(s.id, subject.id, 'part', clampNum(e.target.value, 100))}
                          className={`${inputClass} text-emerald-700 dark:text-emerald-400`}
                        />
                      </td>
                      <td className="px-2 py-2 text-center font-extrabold tabular-nums text-emerald-700 dark:text-emerald-400">
                        {m.currentEffort ?? '—'}
                      </td>
                      <td className="px-2 py-2 text-center">
                        <StatusBadge label={exemptDisplay} tone={exemptTone} />
                      </td>
                      <td className="px-2 py-2 text-center">
                        {finalBlocked ? (
                          <span className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-400">
                            معفى من الامتحان
                          </span>
                        ) : (
                          <input
                            aria-label={`امتحان نهاية السنة - ${s.name}`}
                            type="number"
                            min={0}
                            max={100}
                            step={0.5}
                            value={rec.final}
                            onChange={(e) =>
                              onUpdateCoreGrade(s.id, subject.id, 'final', clampNum(e.target.value, 100))
                            }
                            className={inputClass}
                          />
                        )}
                      </td>
                      <td className="px-2 py-2 text-center">
                        <select
                          aria-label={`حالة النهائي - ${s.name}`}
                          disabled={finalBlocked}
                          value={rec.finalStatus}
                          onChange={(e) =>
                            onUpdateCoreGrade(s.id, subject.id, 'finalStatus', e.target.value as ExamAttendanceStatus)
                          }
                          className="rounded-md border border-slate-200 bg-slate-50 px-1.5 py-1 text-xs font-semibold text-slate-800 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                        >
                          <option value="present">حاضر</option>
                          <option value="absent">غائب</option>
                          <option value="postponed">مؤجل</option>
                        </select>
                      </td>
                      <td className="px-2 py-2 text-center font-bold tabular-nums text-slate-900 dark:text-slate-100">
                        {overall.isGeneralExempt || m.isSingleExempt
                          ? `${m.currentEffort ?? '—'} (معفى)`
                          : m.finalGrade ?? '—'}
                      </td>
                      <td className="px-3 py-2">
                        <StatusBadge
                          label={overall.isGeneralExempt ? 'معفى كلياً' : m.statusLabel}
                          tone={overall.isGeneralExempt ? 'success' : m.tone}
                        />
                      </td>
                    </tr>
                  );
                })}
                {!students.length && (
                  <tr>
                    <td colSpan={12} className="px-4 py-8 text-center text-sm text-slate-500 dark:text-slate-400">
                      لا يوجد طلبة في هذه الشعبة. يمكنك إضافة طلبة من صفحة الطلبة والشعب.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* TERM 1 & TERM 2 MONTHLY DAILY SECTIONS TAB */}
        {activeTab !== 'overview' && activeMonth && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2">
                {monthsList.map((m) => {
                  const selected = m.id === activeMonth.id;
                  return (
                    <div
                      key={m.id}
                      className={`flex items-center gap-2 rounded-lg border px-2.5 py-1.5 transition-colors ${
                        selected
                          ? 'border-emerald-700 bg-emerald-50 dark:border-emerald-500 dark:bg-emerald-950/40'
                          : 'border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800/70'
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => setSelectedMonthId(m.id)}
                        className={`cursor-pointer text-xs font-bold whitespace-nowrap ${
                          selected
                            ? 'text-emerald-800 dark:text-emerald-300'
                            : 'text-slate-700 dark:text-slate-200'
                        }`}
                      >
                        {m.label}
                      </button>
                      <label className="inline-flex cursor-pointer items-center gap-1 border-r border-slate-200 pr-2 text-[11px] text-slate-600 dark:border-slate-700 dark:text-slate-300">
                        <input
                          type="checkbox"
                          aria-label={`احتساب ${m.label} في المعدل`}
                          checked={m.enabled}
                          onChange={() => handleToggleMonthEnabled(m.id)}
                          className="h-3.5 w-3.5 accent-emerald-700"
                        />
                        <span>محتسب</span>
                      </label>
                    </div>
                  );
                })}
                <button
                  type="button"
                  onClick={handleAddExtraMonth}
                  className="inline-flex cursor-pointer items-center gap-1 rounded-lg border border-dashed border-slate-300 px-2.5 py-1.5 text-xs font-semibold text-slate-600 hover:border-emerald-700 hover:text-emerald-700 dark:border-slate-600 dark:text-slate-300"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>إضافة شهر</span>
                </button>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() =>
                    setEditingSections({
                      termKey: currentTermKey,
                      monthId: activeMonth.id,
                      monthLabel: activeMonth.label,
                      sections: activeMonth.dailySections.map((s) => ({ ...s })),
                    })
                  }
                  className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-bold text-white whitespace-nowrap hover:bg-slate-800 dark:bg-slate-700"
                >
                  <Settings2 className="h-3.5 w-3.5" />
                  <span>إدارة أقسام اليومي ({activeMonth.dailySections.length})</span>
                </button>
                <button
                  type="button"
                  onClick={handleApplySectionsToAllTermMonths}
                  className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700 whitespace-nowrap hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                >
                  <Copy className="h-3.5 w-3.5" />
                  <span>تعميم الأقسام على باقي الأشهر</span>
                </button>
              </div>
            </div>

            <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-800">
              <table className="w-full min-w-[780px] border-collapse text-right text-xs">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-800 dark:bg-slate-800/70 dark:text-slate-300">
                    <th className="sticky right-0 z-10 bg-slate-50 px-3 py-2.5 font-bold dark:bg-slate-800">اسم الطالب</th>
                    {activeMonth.dailySections.map((secDef) => (
                      <th key={secDef.id} className="px-2 py-2 text-center font-bold">
                        {secDef.name}
                        <span className="block text-[10px] font-normal text-slate-500 tabular-nums">
                          من {secDef.maxScore}
                        </span>
                      </th>
                    ))}
                    <th className="bg-sky-50/70 px-2 py-2.5 text-center font-bold text-sky-800 dark:bg-sky-950/30 dark:text-sky-400">
                      اليومي (من 100)
                    </th>
                    <th className="px-2 py-2.5 text-center font-bold">
                      التحريري
                      <span className="block text-[10px] font-normal text-slate-500">من 100</span>
                    </th>
                    <th className="bg-emerald-50/70 px-2 py-2.5 text-center font-bold text-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-400">
                      معدل {activeMonth.label}
                    </th>
                    <th className="px-2 py-2.5 text-center font-bold">
                      معدل {activeTab === 'term1' ? 'الفصل الأول' : 'الفصل الثاني'}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                  {students.map((s) => {
                    const rec = getGradeRecord(db, s.id, subject.id);
                    const mMetrics = calcSubjectMetrics(rec, db.settings, subject);
                    const monthData = rec[currentTermKey]?.[activeMonth.id];
                    const monthMetricList =
                      activeTab === 'term1' ? mMetrics.term1MonthMetrics : mMetrics.term2MonthMetrics;
                    const mm = monthMetricList.find((x) => x.monthId === activeMonth.id);
                    const termAvg = activeTab === 'term1' ? mMetrics.term1 : mMetrics.term2;

                    return (
                      <tr key={s.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
                        <td className="sticky right-0 z-10 border-l border-slate-100 bg-white px-3 py-2 font-bold whitespace-nowrap text-slate-900 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100">
                          {s.name}
                        </td>
                        {activeMonth.dailySections.map((secDef) => {
                          const val = monthData?.dailyScores?.[secDef.id] ?? '';
                          return (
                            <td key={secDef.id} className="px-2 py-2 text-center">
                              <input
                                aria-label={`${activeMonth.label} - ${secDef.name} - ${s.name}`}
                                type="number"
                                min={0}
                                max={secDef.maxScore}
                                step={0.5}
                                value={val}
                                onChange={(e) =>
                                  onUpdateMonthDailyScore(
                                    s.id,
                                    subject.id,
                                    currentTermKey,
                                    activeMonth.id,
                                    secDef.id,
                                    clampNum(e.target.value, secDef.maxScore)
                                  )
                                }
                                className={inputClass}
                              />
                            </td>
                          );
                        })}
                        <td className="bg-sky-50/40 px-2 py-2 text-center font-bold tabular-nums text-sky-700 dark:bg-sky-950/20 dark:text-sky-400">
                          {mm?.daily100 ?? '—'}
                        </td>
                        <td className="px-2 py-2 text-center">
                          <input
                            aria-label={`${activeMonth.label} - التحريري - ${s.name}`}
                            type="number"
                            min={0}
                            max={100}
                            step={0.5}
                            value={monthData?.written ?? ''}
                            onChange={(e) =>
                              onUpdateMonthWritten(
                                s.id,
                                subject.id,
                                currentTermKey,
                                activeMonth.id,
                                clampNum(e.target.value, 100)
                              )
                            }
                            className={inputClass}
                          />
                        </td>
                        <td className="bg-emerald-50/40 px-2 py-2 text-center font-extrabold tabular-nums text-emerald-700 dark:bg-emerald-950/20 dark:text-emerald-400">
                          {mm?.monthAvg ?? '—'}
                        </td>
                        <td className="px-2 py-2 text-center font-bold tabular-nums text-slate-900 dark:text-slate-100">
                          {termAvg ?? '—'}
                        </td>
                      </tr>
                    );
                  })}
                  {!students.length && (
                    <tr>
                      <td
                        colSpan={activeMonth.dailySections.length + 5}
                        className="px-4 py-8 text-center text-sm text-slate-500 dark:text-slate-400"
                      >
                        لا يوجد طلبة في هذه الشعبة.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Modal: Dynamic Daily Sections Editor (Name, MaxScore, Add/Remove) */}
      {editingSections && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="w-full max-w-lg rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
            <div className="mb-3 flex items-center justify-between gap-2">
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                أقسام التقييم اليومي — {editingSections.monthLabel} ({subject.name})
              </h3>
              <button
                type="button"
                onClick={() =>
                  setEditingSections({
                    ...editingSections,
                    sections: [
                      ...editingSections.sections,
                      {
                        id: uid('ds'),
                        name: `قسم ${editingSections.sections.length + 1}`,
                        maxScore: 10,
                      },
                    ],
                  })
                }
                className="inline-flex cursor-pointer items-center gap-1 rounded-lg bg-emerald-800 px-2.5 py-1.5 text-xs font-bold text-white hover:bg-emerald-700"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>إضافة قسم</span>
              </button>
            </div>
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600 dark:bg-slate-800/70 dark:text-slate-300">
              <span>حدد اسم كل قسم ودرجته القصوى (الكم) للتحويل تلقائياً من 100.</span>
              <strong className="text-emerald-700 tabular-nums dark:text-emerald-400">
                المجموع: {editingSections.sections.reduce((acc, s) => acc + Math.max(1, Number(s.maxScore) || 10), 0)} درجة
              </strong>
            </div>

            <div className="max-h-72 space-y-2.5 overflow-y-auto pr-1">
              {editingSections.sections.map((secDef, idx) => (
                <div
                  key={secDef.id}
                  className="grid grid-cols-12 items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 p-2 dark:border-slate-700 dark:bg-slate-800/70"
                >
                  <div className="col-span-7">
                    <label className="mb-0.5 block text-[11px] font-semibold text-slate-500">
                      اسم القسم #{idx + 1}
                    </label>
                    <input
                      aria-label={`اسم القسم ${idx + 1}`}
                      value={secDef.name}
                      onChange={(e) => {
                        const next = [...editingSections.sections];
                        next[idx] = { ...secDef, name: e.target.value };
                        setEditingSections({ ...editingSections, sections: next });
                      }}
                      className="w-full rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold dark:border-slate-700 dark:bg-slate-900"
                    />
                  </div>
                  <div className="col-span-3">
                    <label className="mb-0.5 block text-[11px] font-semibold text-slate-500">
                      الدرجة القصوى
                    </label>
                    <input
                      aria-label={`الدرجة القصوى ${idx + 1}`}
                      type="number"
                      min={1}
                      value={secDef.maxScore}
                      onChange={(e) => {
                        const next = [...editingSections.sections];
                        next[idx] = {
                          ...secDef,
                          maxScore: Math.max(1, Number(e.target.value) || 10),
                        };
                        setEditingSections({ ...editingSections, sections: next });
                      }}
                      className="w-full rounded-md border border-slate-200 bg-white px-2 py-1.5 text-center text-xs font-bold tabular-nums dark:border-slate-700 dark:bg-slate-900"
                    />
                  </div>
                  <div className="col-span-2 flex justify-end pt-4">
                    <button
                      type="button"
                      aria-label={`حذف القسم ${idx + 1}`}
                      onClick={() => {
                        const next = editingSections.sections.filter((x) => x.id !== secDef.id);
                        setEditingSections({ ...editingSections, sections: next });
                      }}
                      className="cursor-pointer rounded-md bg-red-600 p-1.5 text-white hover:bg-red-500"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              ))}
              {!editingSections.sections.length && (
                <p className="py-4 text-center text-xs text-slate-500">
                  لا توجد أقسام يومي لهذا الشهر (سيُعتمد التحريري فقط لمعدل الشهر).
                </p>
              )}
            </div>

            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setEditingSections(null)}
                className="cursor-pointer rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300"
              >
                إلغاء
              </button>
              <button
                type="button"
                onClick={() => {
                  const cleaned = editingSections.sections.map((s, idx) => ({
                    ...s,
                    name: s.name.trim() || `قسم ${idx + 1}`,
                    maxScore: Math.max(1, Number(s.maxScore) || 10),
                  }));
                  const nextConfig: SubjectTermConfig = {
                    ...termConfig,
                    [editingSections.termKey]: termConfig[editingSections.termKey].map((m) =>
                      m.id === editingSections.monthId ? { ...m, dailySections: cleaned } : m
                    ),
                  };
                  onUpdateSubjectTermConfig(subject.id, nextConfig);
                  setEditingSections(null);
                  onNotify('تم حفظ أقسام اليومي والدرجات القصوى');
                }}
                className="cursor-pointer rounded-lg bg-emerald-800 px-4 py-1.5 text-sm font-bold text-white hover:bg-emerald-700"
              >
                حفظ التعديلات
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Google Forms Integration */}
      {showFormsModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="gf-modal-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/55 p-3 sm:p-4"
        >
          <div className="flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-4 py-3 sm:px-5 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <Link2 className="h-4 w-4 text-sky-700 dark:text-sky-400" />
                <h3
                  id="gf-modal-title"
                  className="text-sm font-extrabold text-slate-900 sm:text-base dark:text-slate-100"
                >
                  استيراد وإنشاء اختبارات Google Forms ({subject.name})
                </h3>
              </div>
              <button
                type="button"
                aria-label="إغلاق نافذة Google Forms"
                onClick={() => setShowFormsModal(false)}
                className="cursor-pointer rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="overflow-y-auto p-4 sm:p-5">
              <GoogleFormsPanel
                db={db}
                ctx={ctx}
                onApplyImportedGrades={onApplyImportedGrades}
                onNotify={onNotify}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
