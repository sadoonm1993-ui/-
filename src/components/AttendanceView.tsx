import { useState } from 'react';
import { CheckCheck, MessageCircle } from 'lucide-react';
import type { AcademicContext, AppDatabase, DailyAttendanceStatus } from '../types/gradebook';
import { buildWhatsAppUrl, getStudentAttendanceStats } from '../utils/evaluation';
import { StatusBadge } from './StatusBadge';

interface AttendanceViewProps {
  db: AppDatabase;
  ctx: AcademicContext;
  onSetAttendance: (sectionId: string, date: string, studentId: string, status: DailyAttendanceStatus) => void;
  onMarkAllPresent: (sectionId: string, date: string, studentIds: string[]) => void;
  onNotify: (msg: string) => void;
}

export function AttendanceView({
  db,
  ctx,
  onSetAttendance,
  onMarkAllPresent,
  onNotify,
}: AttendanceViewProps) {
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));

  const students = db.students
    .filter((s) => s.sectionId === ctx.sectionId)
    .sort((a, b) => a.name.localeCompare(b.name, 'ar'));
  const dayObj = db.attendance.find((a) => a.date === date && a.sectionId === ctx.sectionId);
  const recs = dayObj ? dayObj.records : {};
  const historyDays = db.attendance
    .filter((a) => a.sectionId === ctx.sectionId)
    .sort((a, b) => b.date.localeCompare(a.date));

  const sub = db.subjects.find((sb) => sb.id === ctx.subjectId);
  const sec = db.sections.find((sc) => sc.id === ctx.sectionId);

  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
      <section className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
            الحضور اليومي وإشعار الغياب بالواتساب
          </h3>
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="date"
              aria-label="تاريخ الحضور"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs font-semibold tabular-nums dark:border-slate-700 dark:bg-slate-800"
            />
            <button
              type="button"
              onClick={() => {
                onMarkAllPresent(
                  ctx.sectionId,
                  date,
                  students.map((s) => s.id)
                );
                onNotify('تم تسجيل حضور جميع الطلبة');
              }}
              className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-emerald-800 px-3 py-1.5 text-xs font-bold text-white whitespace-nowrap hover:bg-emerald-700 dark:bg-emerald-600"
            >
              <CheckCheck className="h-3.5 w-3.5" />
              <span>تحديد الكل حاضر</span>
            </button>
          </div>
        </div>

        <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-800">
          <table className="w-full min-w-[460px] border-collapse text-right text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-xs text-slate-600 dark:border-slate-800 dark:bg-slate-800/70 dark:text-slate-300">
                <th className="px-3 py-2 font-bold">الطالب</th>
                <th className="px-3 py-2 font-bold">الحالة</th>
                <th className="px-3 py-2 font-bold">النسبة والإشعار</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
              {students.map((s) => {
                const st = recs[s.id];
                const stats = getStudentAttendanceStats(db, s.id);
                const waMsg = `عزيزي ولي أمر الطالب ${s.name}، نود إعلامكم بأن الطالب غائب بتاريخ ${date} عن مادة ${sub ? sub.name : ''} (شعبة ${sec ? sec.name : ''}) في ${db.settings.schoolName}.`;
                return (
                  <tr key={s.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
                    <td className="px-3 py-2.5 font-bold text-slate-900 dark:text-slate-100">
                      {s.name}
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex flex-wrap gap-1.5">
                        <button
                          type="button"
                          aria-label={`حاضر - ${s.name}`}
                          onClick={() => onSetAttendance(ctx.sectionId, date, s.id, 'present')}
                          className={`cursor-pointer rounded-md px-2.5 py-1 text-xs font-bold whitespace-nowrap transition-colors ${
                            st === 'present'
                              ? 'bg-emerald-700 text-white'
                              : 'border border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200'
                          }`}
                        >
                          حاضر
                        </button>
                        <button
                          type="button"
                          aria-label={`غائب - ${s.name}`}
                          onClick={() => onSetAttendance(ctx.sectionId, date, s.id, 'absent')}
                          className={`cursor-pointer rounded-md px-2.5 py-1 text-xs font-bold whitespace-nowrap transition-colors ${
                            st === 'absent'
                              ? 'bg-red-600 text-white'
                              : 'border border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200'
                          }`}
                        >
                          غائب
                        </button>
                        <button
                          type="button"
                          aria-label={`مجاز - ${s.name}`}
                          onClick={() => onSetAttendance(ctx.sectionId, date, s.id, 'late')}
                          className={`cursor-pointer rounded-md px-2.5 py-1 text-xs font-bold whitespace-nowrap transition-colors ${
                            st === 'late'
                              ? 'bg-amber-500 text-slate-950'
                              : 'border border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200'
                          }`}
                        >
                          مجاز
                        </button>
                      </div>
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <StatusBadge
                          label={`${stats.rate}%`}
                          tone={stats.rate >= 85 ? 'success' : 'warning'}
                        />
                        {st === 'absent' && (
                          <a
                            href={buildWhatsAppUrl(s.phone, waMsg)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 rounded-md bg-emerald-600 px-2 py-1 text-xs font-bold text-white whitespace-nowrap hover:bg-emerald-500"
                          >
                            <MessageCircle className="h-3.5 w-3.5" />
                            <span>إشعار واتساب</span>
                          </a>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {!students.length && (
                <tr>
                  <td colSpan={3} className="px-4 py-6 text-center text-sm text-slate-500">
                    لا يوجد طلبة في هذه الشعبة.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
        <h3 className="mb-4 text-base font-bold text-slate-900 dark:text-slate-100">
          سجل الحضور المؤرخ للشعبة
        </h3>
        {historyDays.length ? (
          <div className="divide-y divide-slate-200 dark:divide-slate-800">
            {historyDays.map((day) => {
              const vals = Object.values(day.records || {});
              const presentCount = vals.filter((v) => v === 'present').length;
              const absentCount = vals.filter((v) => v === 'absent').length;
              return (
                <div key={day.id} className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
                  <div>
                    <div className="font-bold tabular-nums text-slate-900 dark:text-slate-100">
                      {day.date}
                    </div>
                    <div className="text-xs text-slate-500 tabular-nums dark:text-slate-400">
                      حاضر: {presentCount} · غائب: {absentCount}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setDate(day.date)}
                    className="cursor-pointer rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                  >
                    عرض / تعديل
                  </button>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-sm text-slate-500 dark:text-slate-400">
            لم يتم تسجيل حضور لهذه الشعبة بعد.
          </p>
        )}
      </section>
    </div>
  );
}
