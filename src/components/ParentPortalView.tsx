import { useState } from 'react';
import { Share2 } from 'lucide-react';
import type { AppDatabase, ParentSharePayload, ParentSnapshotStudent } from '../types/gradebook';
import { evaluateStudentOverall, getStudentAttendanceStats } from '../utils/evaluation';
import { buildParentShareUrl } from '../utils/storage';
import { StatusBadge } from './StatusBadge';

interface ParentPortalViewProps {
  db?: AppDatabase;
  standalonePayload?: ParentSharePayload | null;
  initialPins?: string[];
  onNotify?: (msg: string) => void;
}

export function ParentPortalView({
  db,
  standalonePayload,
  initialPins,
  onNotify,
}: ParentPortalViewProps) {
  const [codesInput, setCodesInput] = useState(
    initialPins && initialPins.length ? initialPins.join(', ') : '1111, 2222'
  );
  const [activeChildId, setActiveChildId] = useState('');

  let studentSnapshots: ParentSnapshotStudent[] = [];
  const schoolName = standalonePayload?.school || db?.settings.schoolName || '';
  const academicYear = standalonePayload?.academicYear || db?.settings.academicYear || '';

  if (standalonePayload) {
    studentSnapshots = standalonePayload.students;
  } else if (db) {
    const pins = codesInput
      .split(/[,،\s]+/)
      .map((x) => x.trim().toLowerCase())
      .filter(Boolean);
    const matched = db.students.filter((s) => pins.includes(String(s.pin).toLowerCase()));
    studentSnapshots = matched.map((s) => {
      const ev = evaluateStudentOverall(db, s);
      return {
        id: s.id,
        name: s.name,
        pin: s.pin,
        gradeName: ev.grd?.name || '',
        secName: ev.sec?.name || '',
        avg: ev.avg,
        isGeneralExempt: ev.isGeneralExempt,
        overallStatus: ev.overallStatus,
        tone: ev.tone,
        att: getStudentAttendanceStats(db, s.id),
        notes: db.notes.filter((n) => n.studentId === s.id),
        rows: ev.rows.map((r) => ({
          subjectName: r.subject.name,
          term1: r.metrics.term1,
          mid: r.metrics.mid,
          term2: r.metrics.term2,
          currentEffort: r.metrics.currentEffort,
          finalGrade: r.metrics.finalGrade,
          isSingleExempt: r.metrics.isSingleExempt,
          statusLabel: r.metrics.statusLabel,
          tone: r.metrics.tone,
        })),
      };
    });
  }

  const activeChild =
    studentSnapshots.find((s) => s.id === activeChildId) || studentSnapshots[0] || null;

  const handleCopyLink = async () => {
    if (!db || !studentSnapshots.length) return;
    const url = buildParentShareUrl(
      db,
      studentSnapshots.map((s) => s.id)
    );
    try {
      await navigator.clipboard.writeText(url);
      onNotify?.('تم نسخ رابط ولي الأمر لمشاركته عبر واتساب');
    } catch {
      window.prompt('انسخ الرابط التالي وأرسله لولي الأمر:', url);
    }
  };

  return (
    <div className="space-y-5">
      {!standalonePayload && (
        <section className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                بوابة ولي الأمر (رمز PIN وربط عدة أبناء)
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                أدخل رمز PIN لطالب واحد أو عدة رموز للأبناء مفصولة بفاصلة مثل: <code className="font-mono">1111, 2222</code>
              </p>
            </div>
            {studentSnapshots.length > 0 && (
              <button
                type="button"
                onClick={handleCopyLink}
                className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-sky-700 px-3 py-1.5 text-xs font-bold text-white whitespace-nowrap hover:bg-sky-600"
              >
                <Share2 className="h-3.5 w-3.5" />
                <span>نسخ رابط لإرساله إلى ولي الأمر</span>
              </button>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            <input
              aria-label="رموز PIN للطلبة"
              dir="ltr"
              value={codesInput}
              onChange={(e) => setCodesInput(e.target.value)}
              placeholder="1111, 2222"
              className="flex-1 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-right font-mono text-sm dark:border-slate-700 dark:bg-slate-800"
            />
          </div>
        </section>
      )}

      {studentSnapshots.length > 1 && (
        <div className="flex flex-wrap gap-2">
          {studentSnapshots.map((st) => {
            const isActive = activeChild?.id === st.id;
            return (
              <button
                key={st.id}
                type="button"
                onClick={() => setActiveChildId(st.id)}
                className={`cursor-pointer rounded-lg px-3.5 py-2 text-xs font-bold whitespace-nowrap transition-colors ${
                  isActive
                    ? 'bg-emerald-800 text-white dark:bg-emerald-600'
                    : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200'
                }`}
              >
                {st.name}
              </button>
            );
          })}
        </div>
      )}

      {activeChild ? (
        <section className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
          <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-200 pb-4 dark:border-slate-800">
            <div>
              <div className="text-xs font-bold text-emerald-700 dark:text-emerald-400">
                {schoolName} · متابعة ولي الأمر (للقراءة فقط)
              </div>
              <h2 className="mt-1 text-xl font-extrabold text-slate-900 dark:text-slate-100">
                {activeChild.name}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {activeChild.gradeName} · شعبة {activeChild.secName} · {academicYear}
              </p>
            </div>
            <StatusBadge label={activeChild.overallStatus} tone={activeChild.tone} />
          </div>

          <div className="my-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="rounded-lg bg-slate-50 p-4 dark:bg-slate-800/60">
              <div className="text-xs text-slate-500 dark:text-slate-400">المعدل العام</div>
              <div className="mt-1 text-2xl font-extrabold text-emerald-700 tabular-nums dark:text-emerald-400">
                {activeChild.avg !== null ? `${activeChild.avg}%` : '—'}
              </div>
            </div>
            <div className="rounded-lg bg-slate-50 p-4 dark:bg-slate-800/60">
              <div className="text-xs text-slate-500 dark:text-slate-400">نسبة الحضور</div>
              <div className="mt-1 text-2xl font-extrabold text-sky-700 tabular-nums dark:text-sky-400">
                {activeChild.att.rate}%
              </div>
              <div className="text-xs text-slate-500 tabular-nums dark:text-slate-400">
                أيام الغياب المسجلة: {activeChild.att.absent}
              </div>
            </div>
          </div>

          <h4 className="mb-2 text-sm font-bold text-slate-900 dark:text-slate-100">
            تفاصيل الدرجات حسب المادة
          </h4>
          <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-800">
            <table className="w-full min-w-[460px] border-collapse text-right text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-xs text-slate-600 dark:border-slate-800 dark:bg-slate-800/70 dark:text-slate-300">
                  <th className="px-3 py-2 font-bold">المادة</th>
                  <th className="px-2 py-2 text-center font-bold">ف1</th>
                  <th className="px-2 py-2 text-center font-bold">نصف السنة</th>
                  <th className="px-2 py-2 text-center font-bold">ف2</th>
                  <th className="px-2 py-2 text-center font-bold">السعي</th>
                  <th className="px-2 py-2 text-center font-bold">نهاية السنة</th>
                  <th className="px-3 py-2 font-bold">الحالة</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                {activeChild.rows.map((r) => (
                  <tr key={r.subjectName}>
                    <td className="px-3 py-2 font-bold text-slate-900 dark:text-slate-100">
                      {r.subjectName}
                    </td>
                    <td className="px-2 py-2 text-center tabular-nums">{r.term1 ?? '—'}</td>
                    <td className="px-2 py-2 text-center tabular-nums">{r.mid ?? '—'}</td>
                    <td className="px-2 py-2 text-center tabular-nums">{r.term2 ?? '—'}</td>
                    <td className="px-2 py-2 text-center font-bold tabular-nums text-emerald-700 dark:text-emerald-400">
                      {r.currentEffort ?? '—'}
                    </td>
                    <td className="px-2 py-2 text-center tabular-nums">
                      {activeChild.isGeneralExempt || r.isSingleExempt ? 'معفى' : r.finalGrade ?? '—'}
                    </td>
                    <td className="px-3 py-2">
                      <StatusBadge
                        label={activeChild.isGeneralExempt ? 'معفى كلياً' : r.statusLabel}
                        tone={activeChild.isGeneralExempt ? 'success' : r.tone}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <h4 className="mt-5 mb-2 text-sm font-bold text-slate-900 dark:text-slate-100">
            ملاحظات وتنبيهات المدرس
          </h4>
          {activeChild.notes.length ? (
            <div className="divide-y divide-slate-200 dark:divide-slate-800">
              {activeChild.notes.map((n) => (
                <div key={n.id} className="py-2 text-sm text-slate-700 dark:text-slate-300">
                  <span className="text-xs text-slate-400 tabular-nums">{n.date} · </span>
                  {n.text}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-slate-500 dark:text-slate-400">لا توجد ملاحظات حالياً.</p>
          )}
        </section>
      ) : (
        <div className="rounded-xl border border-slate-200 bg-white p-6 text-center text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400">
          لم يتم العثور على طالب مطابق للرمز المدخل.
        </div>
      )}
    </div>
  );
}
