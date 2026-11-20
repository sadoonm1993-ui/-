import { MessageCircle, Printer, Share2 } from 'lucide-react';
import type { AcademicContext, AppDatabase, AuthSession } from '../types/gradebook';
import {
  buildWhatsAppUrl,
  calcSubjectMetrics,
  evaluateStudentOverall,
  getAllowedTeacherScope,
  getGradeRecord,
  getStudentAttendanceStats,
  round1,
} from '../utils/evaluation';
import { buildParentShareUrl } from '../utils/storage';
import { StatusBadge } from './StatusBadge';

interface ReportsViewProps {
  db: AppDatabase;
  ctx: AcademicContext;
  session: AuthSession;
  selectedStudentId: string;
  onSelectStudent: (id: string) => void;
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

export function ReportsView({
  db,
  ctx,
  session,
  selectedStudentId,
  onSelectStudent,
  onPrintHtml,
  onNotify,
}: ReportsViewProps) {
  const { allowedSectionIds, allowedSubjectIds } = getAllowedTeacherScope(db, session);

  const gradeSecIds = db.sections
    .filter((sc) => sc.gradeId === ctx.gradeId && (!allowedSectionIds || allowedSectionIds.has(sc.id)))
    .map((sc) => sc.id);
  const gradeStudents = db.students.filter((st) => gradeSecIds.includes(st.sectionId));
  const selectableStudents = allowedSectionIds
    ? db.students.filter((st) => allowedSectionIds.has(st.sectionId))
    : db.students;

  const activeId =
    selectedStudentId && selectableStudents.some((s) => s.id === selectedStudentId)
      ? selectedStudentId
      : gradeStudents[0]?.id || selectableStudents[0]?.id || '';

  const stu = db.students.find((s) => s.id === activeId) || null;
  const rawStuEv = stu ? evaluateStudentOverall(db, stu) : null;
  const stuEv = rawStuEv
    ? {
        ...rawStuEv,
        rows: allowedSubjectIds
          ? rawStuEv.rows.filter((r) => allowedSubjectIds.has(r.subject.id))
          : rawStuEv.rows,
      }
    : null;
  const stuAtt = stu ? getStudentAttendanceStats(db, stu.id) : null;
  const stuNotes = stu ? db.notes.filter((n) => n.studentId === stu.id) : [];

  const subject = db.subjects.find((sb) => sb.id === ctx.subjectId);
  const topInSubject = subject
    ? gradeStudents
        .map((st) => {
          const m = calcSubjectMetrics(getGradeRecord(db, st.id, subject.id), db.settings, subject);
          const sec = db.sections.find((x) => x.id === st.sectionId);
          return {
            id: st.id,
            name: st.name,
            sec: sec ? sec.name : '',
            score: m.finalGrade ?? m.currentEffort,
            exempt: m.isSingleExempt,
          };
        })
        .filter((x): x is { id: string; name: string; sec: string; score: number; exempt: boolean } => x.score !== null)
        .sort((a, b) => b.score - a.score)
    : [];

  const gradeSections = db.sections.filter(
    (sc) => sc.gradeId === ctx.gradeId && (!allowedSectionIds || allowedSectionIds.has(sc.id))
  );

  // Statistical summary for selected subject across grade
  const subjectStats = (() => {
    if (!topInSubject.length) return { count: 0, exemptCount: 0, passCount: 0, riskCount: 0, avg: null as number | null };
    const passMark = db.settings.rules.passMark;
    const exemptCount = topInSubject.filter((x) => x.exempt).length;
    const passCount = topInSubject.filter((x) => x.score >= passMark).length;
    const riskCount = topInSubject.filter((x) => x.score < passMark).length;
    const avg = round1(topInSubject.reduce((a, b) => a + b.score, 0) / topInSubject.length);
    return { count: topInSubject.length, exemptCount, passCount, riskCount, avg };
  })();

  const handlePrintStudent = () => {
    if (!stu || !stuEv || !stuAtt) return;
    const rowsHtml = stuEv.rows
      .map(
        (r) => `<tr>
        <td>${escapeHtml(r.subject.name)}</td>
        <td>${r.metrics.term1 ?? '—'}</td>
        <td>${r.metrics.mid ?? '—'}</td>
        <td>${r.metrics.term2 ?? '—'}</td>
        <td>${r.metrics.currentEffort ?? '—'}</td>
        <td>${stuEv.isGeneralExempt ? 'إعفاء كلي' : r.metrics.isSingleExempt ? 'إعفاء فردي' : r.metrics.finalGrade ?? '—'}</td>
        <td>${escapeHtml(stuEv.isGeneralExempt ? 'معفى كلياً' : r.metrics.statusLabel)}</td>
      </tr>`
      )
      .join('');

    onPrintHtml(`
      <div style="text-align:center;border-bottom:2px solid #000;padding-bottom:8px;">
        <h3 style="margin:0;">جمهورية العراق - وزارة التربية · ${escapeHtml(db.settings.directorate)}</h3>
        <h2 style="margin:4px 0;">${escapeHtml(db.settings.schoolName)} — التقرير الفردي للطالب (${escapeHtml(db.settings.academicYear)})</h2>
      </div>
      <div style="margin:12px 0;display:flex;justify-content:space-between;">
        <div><strong>اسم الطالب:</strong> ${escapeHtml(stu.name)}<br><strong>الصف والشعبة:</strong> ${escapeHtml(stuEv.grd?.name || '')} - شعبة ${escapeHtml(stuEv.sec?.name || '')}</div>
        <div><strong>المعدل:</strong> ${stuEv.avg !== null ? stuEv.avg + '%' : '—'}<br><strong>نسبة الحضور:</strong> ${stuAtt.rate}%<br><strong>الموقف والإعفاء:</strong> ${escapeHtml(stuEv.overallStatus)}</div>
      </div>
      <table>
        <thead><tr><th>المادة</th><th>م.ف1</th><th>نصف السنة</th><th>م.ف2</th><th>السعي السنوي</th><th>نهاية السنة</th><th>التقييم</th></tr></thead>
        <tbody>${rowsHtml}</tbody>
      </table>
      <div style="margin-top:12px;"><strong>ملاحظات المدرس:</strong><p>${
        stuNotes.map((n) => `• ${escapeHtml(n.text)} (${escapeHtml(n.date)})`).join('<br>') ||
        'لا توجد ملاحظات.'
      }</p></div>
      <div style="margin-top:26px;display:flex;justify-content:space-between;">
        <span>توقيع المدرس: ${escapeHtml(db.settings.teacherName)}</span>
        <span>توقيع الإدارة: ........................</span>
      </div>
    `);
  };

  const handleCopyParentLink = async () => {
    if (!stu) return;
    const url = buildParentShareUrl(db, [stu.id]);
    try {
      await navigator.clipboard.writeText(url);
      onNotify('تم نسخ رابط متابعة ولي الأمر');
    } catch {
      window.prompt('انسخ الرابط التالي وأرسله لولي الأمر:', url);
    }
  };

  const studentWaSummary = stu && stuEv && stuAtt
    ? `تقرير الطالب ${stu.name} (${db.settings.schoolName} - ${db.settings.academicYear}):\nالصف: ${stuEv.grd?.name || ''} شعبة ${stuEv.sec?.name || ''}\nالمعدل العام: ${stuEv.avg !== null ? stuEv.avg + '%' : '—'}\nنسبة الحضور: ${stuAtt.rate}%\nالموقف: ${stuEv.overallStatus}\nرمز بوابة ولي الأمر: ${stu.pin}`
    : '';

  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
      <section className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
            التقرير الدراسي الفردي للطالب
          </h3>
          <select
            aria-label="اختر الطالب للتقرير"
            value={activeId}
            onChange={(e) => onSelectStudent(e.target.value)}
            className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs font-semibold dark:border-slate-700 dark:bg-slate-800"
          >
            {selectableStudents.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>

        {stu && stuEv && stuAtt ? (
          <div className="space-y-4">
            <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-200 pb-4 dark:border-slate-800">
              <div>
                <h4 className="text-lg font-extrabold text-slate-900 dark:text-slate-100">
                  {stu.name}
                </h4>
                <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                  {stuEv.grd?.name || ''} · شعبة {stuEv.sec?.name || ''} · PIN:{' '}
                  <span className="font-mono font-semibold text-slate-700 dark:text-slate-300">
                    {stu.pin}
                  </span>
                </p>
              </div>
              <StatusBadge label={stuEv.overallStatus} tone={stuEv.tone} />
            </div>

            {(stuEv.isGeneralExempt || stuEv.singleExemptSubjects.length > 0) && (
              <div className="rounded-lg border border-emerald-200 bg-emerald-50/80 px-3.5 py-2.5 text-xs text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200">
                {stuEv.isGeneralExempt ? (
                  <div>
                    <strong>حالة الإعفاء الكلي:</strong> الطالب مشمول بالإعفاء العام الشامل لاستيفائه شرط المعدل (≥{' '}
                    {db.settings.rules.generalExemptAvg}) وأقل مادة (≥ {db.settings.rules.generalExemptMinSub}).
                  </div>
                ) : (
                  <div>
                    <strong>حالة الإعفاء الفردي:</strong> الطالب معفى فردياً في ({stuEv.singleExemptSubjects.join('، ')}) لبلوغ السعي ≥ {db.settings.rules.singleExempt}.
                  </div>
                )}
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-lg bg-slate-50 p-3 dark:bg-slate-800/60">
                <div className="text-xs text-slate-500 dark:text-slate-400">المعدل العام</div>
                <div className="mt-1 text-2xl font-extrabold text-emerald-700 tabular-nums dark:text-emerald-400">
                  {stuEv.avg !== null ? `${stuEv.avg}%` : '—'}
                </div>
              </div>
              <div className="rounded-lg bg-slate-50 p-3 dark:bg-slate-800/60">
                <div className="text-xs text-slate-500 dark:text-slate-400">نسبة الحضور</div>
                <div className="mt-1 text-2xl font-extrabold text-sky-700 tabular-nums dark:text-sky-400">
                  {stuAtt.rate}%
                </div>
              </div>
            </div>

            <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-800">
              <table className="w-full min-w-[460px] border-collapse text-right text-xs">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-800 dark:bg-slate-800/70 dark:text-slate-300">
                    <th className="px-2.5 py-2 font-bold">المادة</th>
                    <th className="px-2 py-2 text-center font-bold">ف1</th>
                    <th className="px-2 py-2 text-center font-bold">ن.س</th>
                    <th className="px-2 py-2 text-center font-bold">ف2</th>
                    <th className="px-2 py-2 text-center font-bold">السعي</th>
                    <th className="px-2 py-2 text-center font-bold">نهاية السنة</th>
                    <th className="px-2.5 py-2 font-bold">التقييم</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                  {stuEv.rows.map((r) => (
                    <tr key={r.subject.id}>
                      <td className="px-2.5 py-2 font-bold text-slate-900 dark:text-slate-100">
                        {r.subject.name}
                      </td>
                      <td className="px-2 py-2 text-center tabular-nums">{r.metrics.term1 ?? '—'}</td>
                      <td className="px-2 py-2 text-center tabular-nums">{r.metrics.mid ?? '—'}</td>
                      <td className="px-2 py-2 text-center tabular-nums">{r.metrics.term2 ?? '—'}</td>
                      <td className="px-2 py-2 text-center font-bold tabular-nums text-emerald-700 dark:text-emerald-400">
                        {r.metrics.currentEffort ?? '—'}
                      </td>
                      <td className="px-2 py-2 text-center tabular-nums">
                        {stuEv.isGeneralExempt || r.metrics.isSingleExempt
                          ? 'معفى'
                          : r.metrics.finalGrade ?? '—'}
                      </td>
                      <td className="px-2.5 py-2">
                        <StatusBadge
                          label={stuEv.isGeneralExempt ? 'معفى كلياً' : r.metrics.statusLabel}
                          tone={stuEv.isGeneralExempt ? 'success' : r.metrics.tone}
                        />
                      </td>
                    </tr>
                  ))}
                  {!stuEv.rows.length && (
                    <tr>
                      <td colSpan={7} className="px-3 py-4 text-center text-slate-500">
                        لا توجد مواد متاحة للعرض.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {stuNotes.length > 0 && (
              <div className="text-xs text-slate-600 dark:text-slate-300">
                <strong className="mb-1 block text-slate-900 dark:text-slate-100">ملاحظات المدرس:</strong>
                <ul className="list-disc space-y-1 pr-4">
                  {stuNotes.map((n) => (
                    <li key={n.id}>
                      {n.text} <span className="text-slate-400 tabular-nums">({n.date})</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="flex flex-wrap gap-2 pt-1">
              <button
                type="button"
                onClick={handlePrintStudent}
                className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-emerald-800 px-3.5 py-2 text-xs font-bold text-white hover:bg-emerald-700 dark:bg-emerald-600"
              >
                <Printer className="h-3.5 w-3.5" />
                <span>طباعة التقرير A4</span>
              </button>
              <button
                type="button"
                onClick={handleCopyParentLink}
                className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-sky-700 px-3.5 py-2 text-xs font-bold text-white hover:bg-sky-600"
              >
                <Share2 className="h-3.5 w-3.5" />
                <span>نسخ رابط بوابة ولي الأمر</span>
              </button>
              <a
                href={buildWhatsAppUrl(stu.phone, studentWaSummary)}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3.5 py-2 text-xs font-bold text-white hover:bg-emerald-500"
              >
                <MessageCircle className="h-3.5 w-3.5" />
                <span>إرسال النتيجة عبر واتساب</span>
              </a>
            </div>
          </div>
        ) : (
          <p className="text-sm text-slate-500">لا يوجد طلبة لعرض التقرير.</p>
        )}
      </section>

      <div className="space-y-5">
        <section className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
          <h3 className="mb-3 text-base font-bold text-slate-900 dark:text-slate-100">
            إحصائيات مادة ({subject ? subject.name : '—'})
          </h3>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-lg bg-slate-50 p-3 dark:bg-slate-800/60">
              <div className="text-[11px] text-slate-500 dark:text-slate-400">المعدل العام</div>
              <div className="mt-0.5 text-xl font-extrabold text-slate-900 tabular-nums dark:text-slate-100">
                {subjectStats.avg ?? '—'}
              </div>
            </div>
            <div className="rounded-lg bg-slate-50 p-3 dark:bg-slate-800/60">
              <div className="text-[11px] text-slate-500 dark:text-slate-400">معفون فردياً</div>
              <div className="mt-0.5 text-xl font-extrabold text-emerald-700 tabular-nums dark:text-emerald-400">
                {subjectStats.exemptCount}
              </div>
            </div>
            <div className="rounded-lg bg-slate-50 p-3 dark:bg-slate-800/60">
              <div className="text-[11px] text-slate-500 dark:text-slate-400">ناجحون</div>
              <div className="mt-0.5 text-xl font-extrabold text-sky-700 tabular-nums dark:text-sky-400">
                {subjectStats.passCount}
              </div>
            </div>
            <div className="rounded-lg bg-slate-50 p-3 dark:bg-slate-800/60">
              <div className="text-[11px] text-slate-500 dark:text-slate-400">دون الصغرى</div>
              <div className="mt-0.5 text-xl font-extrabold text-red-600 tabular-nums dark:text-red-400">
                {subjectStats.riskCount}
              </div>
            </div>
          </div>
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
          <h3 className="mb-3 text-base font-bold text-slate-900 dark:text-slate-100">
            لوحة الأوائل في مادة ({subject ? subject.name : '—'})
          </h3>
          {topInSubject.length ? (
            <div className="divide-y divide-slate-200 dark:divide-slate-800">
              {topInSubject.slice(0, 6).map((x, idx) => (
                <div key={x.id} className="flex items-center justify-between py-2.5 first:pt-0 last:pb-0 text-sm">
                  <div>
                    <span className="font-bold text-slate-900 tabular-nums dark:text-slate-100">
                      #{idx + 1} · {x.name}
                    </span>
                    <span className="mr-2 text-xs text-slate-500 dark:text-slate-400">
                      (شعبة {x.sec})
                    </span>
                  </div>
                  <StatusBadge label={`${x.score}${x.exempt ? ' · معفى' : ''}`} tone="success" />
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-slate-500 dark:text-slate-400">
              أدخل درجات الطلبة لعرض الترتيب.
            </p>
          )}
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
          <h3 className="mb-3 text-base font-bold text-slate-900 dark:text-slate-100">
            مقارنة معدلات الشعب في ({subject ? subject.name : '—'})
          </h3>
          {gradeSections.length ? (
            <div className="divide-y divide-slate-200 dark:divide-slate-800">
              {gradeSections.map((sc) => {
                const stus = db.students.filter((s) => s.sectionId === sc.id);
                const scores = subject
                  ? stus
                      .map(
                        (s) =>
                          calcSubjectMetrics(getGradeRecord(db, s.id, subject.id), db.settings, subject)
                            .currentEffort
                      )
                      .filter((v): v is number => v !== null)
                  : [];
                const avg = scores.length
                  ? round1(scores.reduce((a, b) => a + b, 0) / scores.length)
                  : null;
                const passRate = scores.length
                  ? Math.round(
                      (scores.filter((v) => v >= db.settings.rules.passMark).length / scores.length) *
                        100
                    )
                  : null;
                return (
                  <div
                    key={sc.id}
                    className="flex flex-wrap items-center justify-between gap-2 py-2.5 first:pt-0 last:pb-0 text-sm"
                  >
                    <strong className="text-slate-900 dark:text-slate-100">
                      شعبة {sc.name}{' '}
                      <span className="font-normal text-xs text-slate-500 tabular-nums">
                        ({stus.length} طالب)
                      </span>
                    </strong>
                    <span className="text-xs text-slate-600 tabular-nums dark:text-slate-300">
                      المتوسط: <strong>{avg ?? '—'}</strong> · النجاح:{' '}
                      <strong>{passRate !== null ? `${passRate}%` : '—'}</strong>
                    </span>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-sm text-slate-500 dark:text-slate-400">لا توجد شعب في هذا الصف.</p>
          )}
        </section>
      </div>
    </div>
  );
}
