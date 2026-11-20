import { useState } from 'react';
import { BookOpen, CalendarCheck, Plus, Printer, Trash2 } from 'lucide-react';
import type {
  AcademicContext,
  AppDatabase,
  AuthSession,
  NavView,
  ScheduleSlot,
  WeekDayKey,
} from '../types/gradebook';
import { getAllowedTeacherScope, uid } from '../utils/evaluation';

const DAYS: Array<{ key: WeekDayKey; label: string }> = [
  { key: 'sun', label: 'الأحد' },
  { key: 'mon', label: 'الاثنين' },
  { key: 'tue', label: 'الثلاثاء' },
  { key: 'wed', label: 'الأربعاء' },
  { key: 'thu', label: 'الخميس' },
];

const PERIODS = [
  { num: 1, defaultTime: '08:00 - 08:45' },
  { num: 2, defaultTime: '08:50 - 09:35' },
  { num: 3, defaultTime: '09:45 - 10:30' },
  { num: 4, defaultTime: '10:35 - 11:20' },
  { num: 5, defaultTime: '11:30 - 12:15' },
  { num: 6, defaultTime: '12:20 - 01:05' },
];

interface ScheduleViewProps {
  db: AppDatabase;
  ctx: AcademicContext;
  session: AuthSession;
  onSaveSlot: (slot: ScheduleSlot) => void;
  onDeleteSlot: (id: string) => void;
  onJumpToContext: (next: Partial<AcademicContext>, view: NavView) => void;
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

export function ScheduleView({
  db,
  ctx,
  session,
  onSaveSlot,
  onDeleteSlot,
  onJumpToContext,
  onPrintHtml,
  onNotify,
}: ScheduleViewProps) {
  const { allowedSectionIds, allowedSubjectIds, teacher } = getAllowedTeacherScope(db, session);
  const [filterMode, setFilterMode] = useState<'section' | 'teacher' | 'all'>(
    session.role === 'teacher' ? 'teacher' : 'section'
  );

  const [modalOpen, setModalOpen] = useState(false);
  const [day, setDay] = useState<WeekDayKey>('sun');
  const [period, setPeriod] = useState(1);
  const [timeRange, setTimeRange] = useState(PERIODS[0].defaultTime);
  const [sectionId, setSectionId] = useState(ctx.sectionId || db.sections[0]?.id || '');
  const [subjectId, setSubjectId] = useState(ctx.subjectId || db.subjects[0]?.id || '');
  const [teacherId, setTeacherId] = useState(teacher?.id || db.teachers[0]?.id || '');
  const [room, setRoom] = useState('');

  const availableSections = allowedSectionIds
    ? db.sections.filter((s) => allowedSectionIds.has(s.id))
    : db.sections;
  const availableSubjects = allowedSubjectIds
    ? db.subjects.filter((sb) => allowedSubjectIds.has(sb.id))
    : db.subjects;

  const filteredSlots = (db.schedule || []).filter((slot) => {
    if (filterMode === 'section') return slot.sectionId === ctx.sectionId;
    if (filterMode === 'teacher') {
      if (teacher) return slot.teacherId === teacher.id;
      return true;
    }
    return true;
  });

  const handleOpenAdd = (targetDay: WeekDayKey, targetPeriod: number) => {
    const pMeta = PERIODS.find((p) => p.num === targetPeriod);
    setDay(targetDay);
    setPeriod(targetPeriod);
    setTimeRange(pMeta?.defaultTime || '08:00 - 08:45');
    setSectionId(ctx.sectionId || availableSections[0]?.id || '');
    setSubjectId(ctx.subjectId || availableSubjects[0]?.id || '');
    setTeacherId(teacher?.id || db.teachers[0]?.id || '');
    setRoom('');
    setModalOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!sectionId || !subjectId) {
      onNotify('اختر الشعبة والمادة أولاً');
      return;
    }
    onSaveSlot({
      id: uid('sch'),
      day,
      period,
      timeRange: timeRange.trim() || '08:00 - 08:45',
      sectionId,
      subjectId,
      teacherId: teacherId || undefined,
      room: room.trim() || undefined,
    });
    setModalOpen(false);
    onNotify('تمت إضافة الحصة إلى الجدول اليومي');
  };

  const handlePrintSchedule = () => {
    const rowsHtml = PERIODS.map((p) => {
      const cells = DAYS.map((d) => {
        const slots = filteredSlots.filter((s) => s.day === d.key && s.period === p.num);
        if (!slots.length) return '<td>—</td>';
        return `<td>${slots
          .map((sl) => {
            const sub = db.subjects.find((x) => x.id === sl.subjectId)?.name || '';
            const sec = db.sections.find((x) => x.id === sl.sectionId);
            const grd = sec ? db.grades.find((g) => g.id === sec.gradeId)?.name : '';
            const tch = db.teachers.find((t) => t.id === sl.teacherId)?.name || '';
            return `<div><strong>${escapeHtml(sub)}</strong><br><small>${escapeHtml(grd)} (${escapeHtml(sec?.name || '')})${sl.room ? ' · ' + escapeHtml(sl.room) : ''}</small>${tch ? '<br><small>' + escapeHtml(tch) + '</small>' : ''}</div>`;
          })
          .join('<hr style="margin:4px 0;">')}</td>`;
      }).join('');
      return `<tr><td><strong>الحصة ${p.num}</strong><br><small>${escapeHtml(p.defaultTime)}</small></td>${cells}</tr>`;
    }).join('');

    onPrintHtml(`
      <div style="text-align:center;border-bottom:2px solid #000;padding-bottom:8px;">
        <h2 style="margin:0;">${escapeHtml(db.settings.schoolName)} — جدول الحصص الأسبوعي</h2>
        <p style="margin:4px 0;">العام الدراسي: ${escapeHtml(db.settings.academicYear)} · إشراف: ${escapeHtml(db.settings.teacherName)}</p>
      </div>
      <table>
        <thead><tr><th>الحصة</th>${DAYS.map((d) => `<th>${d.label}</th>`).join('')}</tr></thead>
        <tbody>${rowsHtml}</tbody>
      </table>
    `);
  };

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
              جدول الحصص اليومي والأسبوعي
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              تنظيم الحصص حسب الأيام والشعب والانتقال المباشر لتسجيل الحضور أو الدرجات
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1 rounded-lg bg-slate-100 p-1 dark:bg-slate-800">
              <button
                type="button"
                onClick={() => setFilterMode('section')}
                className={`cursor-pointer rounded-md px-3 py-1.5 text-xs font-bold whitespace-nowrap transition-colors ${
                  filterMode === 'section'
                    ? 'bg-white text-emerald-800 shadow-sm dark:bg-slate-900 dark:text-emerald-400'
                    : 'text-slate-600 dark:text-slate-300'
                }`}
              >
                الشعبة الحالية
              </button>
              <button
                type="button"
                onClick={() => setFilterMode('teacher')}
                className={`cursor-pointer rounded-md px-3 py-1.5 text-xs font-bold whitespace-nowrap transition-colors ${
                  filterMode === 'teacher'
                    ? 'bg-white text-emerald-800 shadow-sm dark:bg-slate-900 dark:text-emerald-400'
                    : 'text-slate-600 dark:text-slate-300'
                }`}
              >
                {teacher ? 'جدولي التدريسي' : 'كل الحصص'}
              </button>
              {session.role === 'admin' && (
                <button
                  type="button"
                  onClick={() => setFilterMode('all')}
                  className={`cursor-pointer rounded-md px-3 py-1.5 text-xs font-bold whitespace-nowrap transition-colors ${
                    filterMode === 'all'
                      ? 'bg-white text-emerald-800 shadow-sm dark:bg-slate-900 dark:text-emerald-400'
                      : 'text-slate-600 dark:text-slate-300'
                  }`}
                >
                  المدرسة كاملة
                </button>
              )}
            </div>

            <button
              type="button"
              onClick={() => handleOpenAdd('sun', 1)}
              className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-emerald-800 px-3 py-1.5 text-xs font-bold text-white whitespace-nowrap hover:bg-emerald-700 dark:bg-emerald-600"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>إضافة حصة</span>
            </button>
            <button
              type="button"
              onClick={handlePrintSchedule}
              className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700 whitespace-nowrap hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
            >
              <Printer className="h-3.5 w-3.5" />
              <span>طباعة الجدول A4</span>
            </button>
          </div>
        </div>

        <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-800">
          <table className="w-full min-w-[820px] border-collapse text-right text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-800 dark:bg-slate-800/70 dark:text-slate-300">
                <th className="w-32 px-3 py-2.5 font-bold">الحصة والوقت</th>
                {DAYS.map((d) => (
                  <th key={d.key} className="px-3 py-2.5 text-center font-bold">
                    {d.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
              {PERIODS.map((p) => (
                <tr key={p.num} className="align-top">
                  <td className="bg-slate-50/70 px-3 py-3 dark:bg-slate-800/40">
                    <div className="font-bold text-slate-900 dark:text-slate-100">الحصة {p.num}</div>
                    <div className="mt-0.5 font-mono text-[11px] text-slate-500 tabular-nums dark:text-slate-400">
                      {p.defaultTime}
                    </div>
                  </td>
                  {DAYS.map((d) => {
                    const cellSlots = filteredSlots.filter((sl) => sl.day === d.key && sl.period === p.num);
                    return (
                      <td key={d.key} className="border-r border-slate-100 p-2 dark:border-slate-800/80">
                        <div className="space-y-2">
                          {cellSlots.map((sl) => {
                            const sub = db.subjects.find((x) => x.id === sl.subjectId);
                            const subIdx = Math.max(0, db.subjects.findIndex((x) => x.id === sl.subjectId));
                            const cardThemes = [
                              'border-emerald-200 bg-emerald-50/70 dark:border-emerald-800/70 dark:bg-emerald-950/30',
                              'border-sky-200 bg-sky-50/70 dark:border-sky-800/70 dark:bg-sky-950/30',
                              'border-amber-200 bg-amber-50/70 dark:border-amber-800/70 dark:bg-amber-950/30',
                              'border-indigo-200 bg-indigo-50/70 dark:border-indigo-800/70 dark:bg-indigo-950/30',
                            ];
                            const sec = db.sections.find((x) => x.id === sl.sectionId);
                            const grd = sec ? db.grades.find((g) => g.id === sec.gradeId) : null;
                            const tch = db.teachers.find((t) => t.id === sl.teacherId);
                            return (
                              <div
                                key={sl.id}
                                className={`rounded-lg border p-2 ${cardThemes[subIdx % cardThemes.length]}`}
                              >
                                <div className="flex items-start justify-between gap-1">
                                  <strong className="text-emerald-800 dark:text-emerald-400">
                                    {sub?.name || 'مادة'}
                                  </strong>
                                  <button
                                    type="button"
                                    aria-label={`حذف حصة ${sub?.name || ''} ${d.label}`}
                                    onClick={() => {
                                      onDeleteSlot(sl.id);
                                      onNotify('تم حذف الحصة');
                                    }}
                                    className="cursor-pointer rounded p-0.5 text-slate-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/50"
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </button>
                                </div>
                                <div className="mt-0.5 text-[11px] text-slate-600 dark:text-slate-300">
                                  {grd?.name || ''} · شعبة {sec?.name || ''}
                                  {sl.room ? ` · ${sl.room}` : ''}
                                </div>
                                {tch && (
                                  <div className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
                                    {tch.name}
                                  </div>
                                )}
                                <div className="mt-1.5 flex gap-1">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      if (grd && sec && sub) {
                                        onJumpToContext(
                                          {
                                            stageId: grd.stageId,
                                            gradeId: grd.id,
                                            sectionId: sec.id,
                                            subjectId: sub.id,
                                          },
                                          'grades'
                                        );
                                      }
                                    }}
                                    className="inline-flex cursor-pointer items-center gap-1 rounded bg-white px-1.5 py-0.5 text-[10px] font-bold text-slate-700 border border-slate-200 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                                  >
                                    <BookOpen className="h-3 w-3" />
                                    <span>الدرجات</span>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      if (grd && sec && sub) {
                                        onJumpToContext(
                                          {
                                            stageId: grd.stageId,
                                            gradeId: grd.id,
                                            sectionId: sec.id,
                                            subjectId: sub.id,
                                          },
                                          'attendance'
                                        );
                                      }
                                    }}
                                    className="inline-flex cursor-pointer items-center gap-1 rounded bg-white px-1.5 py-0.5 text-[10px] font-bold text-sky-700 border border-slate-200 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-sky-400"
                                  >
                                    <CalendarCheck className="h-3 w-3" />
                                    <span>الحضور</span>
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                          <button
                            type="button"
                            onClick={() => handleOpenAdd(d.key, p.num)}
                            className="w-full cursor-pointer rounded-md border border-dashed border-slate-200 py-1 text-center text-[11px] font-semibold text-slate-400 hover:border-emerald-600 hover:text-emerald-700 dark:border-slate-700 dark:hover:text-emerald-400"
                          >
                            + إضافة
                          </button>
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <form
            onSubmit={handleSubmit}
            className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900"
          >
            <h3 className="mb-4 text-base font-bold text-slate-900 dark:text-slate-100">
              إضافة حصة إلى الجدول اليومي
            </h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-400">
                  اليوم
                </label>
                <select
                  value={day}
                  onChange={(e) => setDay(e.target.value as WeekDayKey)}
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
                >
                  {DAYS.map((d) => (
                    <option key={d.key} value={d.key}>
                      {d.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-400">
                  رقم الحصة
                </label>
                <select
                  value={period}
                  onChange={(e) => setPeriod(Number(e.target.value))}
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
                >
                  {PERIODS.map((p) => (
                    <option key={p.num} value={p.num}>
                      الحصة {p.num}
                    </option>
                  ))}
                </select>
              </div>
              <div className="col-span-2">
                <label className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-400">
                  الشعبة
                </label>
                <select
                  value={sectionId}
                  onChange={(e) => setSectionId(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
                >
                  {availableSections.map((sec) => {
                    const g = db.grades.find((x) => x.id === sec.gradeId);
                    return (
                      <option key={sec.id} value={sec.id}>
                        {g?.name || ''} · شعبة {sec.name}
                      </option>
                    );
                  })}
                </select>
              </div>
              <div className="col-span-2">
                <label className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-400">
                  المادة
                </label>
                <select
                  value={subjectId}
                  onChange={(e) => setSubjectId(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
                >
                  {availableSubjects.map((sb) => (
                    <option key={sb.id} value={sb.id}>
                      {sb.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-400">
                  المدرس
                </label>
                <select
                  value={teacherId}
                  onChange={(e) => setTeacherId(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
                >
                  <option value="">غير محدد</option>
                  {db.teachers.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-400">
                  القاعة / المختبر
                </label>
                <input
                  value={room}
                  onChange={(e) => setRoom(e.target.value)}
                  placeholder="مثال: قاعة 3"
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
                />
              </div>
              <div className="col-span-2">
                <label className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-400">
                  توقيت الحصة
                </label>
                <input
                  value={timeRange}
                  onChange={(e) => setTimeRange(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 font-mono text-sm dark:border-slate-700 dark:bg-slate-800"
                />
              </div>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="cursor-pointer rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300"
              >
                إلغاء
              </button>
              <button
                type="submit"
                className="cursor-pointer rounded-lg bg-emerald-800 px-4 py-1.5 text-sm font-bold text-white hover:bg-emerald-700"
              >
                حفظ الحصة
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
