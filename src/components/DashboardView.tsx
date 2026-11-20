import {
  AlertTriangle,
  Award,
  BarChart3,
  BookOpen,
  CalendarCheck,
  CalendarDays,
  ChevronLeft,
  Search,
  Sparkles,
  UserCheck,
  UserPlus,
  Users,
} from 'lucide-react';
import type { AcademicContext, AppDatabase, AuthSession, NavView, WeekDayKey } from '../types/gradebook';
import { evaluateStudentOverall, getAllowedTeacherScope } from '../utils/evaluation';
import { StatusBadge } from './StatusBadge';

const DAY_LABELS: Record<WeekDayKey, string> = {
  sun: 'الأحد',
  mon: 'الاثنين',
  tue: 'الثلاثاء',
  wed: 'الأربعاء',
  thu: 'الخميس',
};

interface DashboardViewProps {
  db: AppDatabase;
  ctx: AcademicContext;
  session: AuthSession;
  onNavigate: (view: NavView) => void;
  onOpenAddStudent: () => void;
  onOpenQuickGrade: () => void;
}

export function DashboardView({
  db,
  ctx,
  session,
  onNavigate,
  onOpenAddStudent,
  onOpenQuickGrade,
}: DashboardViewProps) {
  const { allowedSectionIds, teacher } = getAllowedTeacherScope(db, session);
  const visibleStudents = allowedSectionIds
    ? db.students.filter((s) => allowedSectionIds.has(s.sectionId))
    : db.students;
  const secStudents = visibleStudents.filter((s) => s.sectionId === ctx.sectionId);
  const evals = visibleStudents.map((s) => ({ student: s, ev: evaluateStudentOverall(db, s) }));
  const exemptCount = evals.filter((x) => x.ev.overallStatus.includes('إعفاء')).length;
  const riskCount = evals.filter(
    (x) => x.ev.overallStatus.includes('رسوب') || x.ev.overallStatus.includes('مكمل')
  ).length;

  const curGrade = db.grades.find((g) => g.id === ctx.gradeId);
  const curSection = db.sections.find((s) => s.id === ctx.sectionId);
  const curSubject = db.subjects.find((sb) => sb.id === ctx.subjectId);

  const upcomingClasses = (db.schedule || [])
    .filter((slot) => (teacher ? slot.teacherId === teacher.id : slot.sectionId === ctx.sectionId))
    .slice(0, 4);

  const recentNotes = [...db.notes]
    .filter((n) => visibleStudents.some((s) => s.id === n.studentId))
    .slice(-5)
    .reverse();

  return (
    <div className="space-y-5">
      {/* Focused Academic Context Banner */}
      <section className="flex flex-col justify-between gap-4 rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900 sm:flex-row sm:items-center">
        <div>
          <div className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">
            {db.settings.directorate} · {db.settings.academicYear}
          </div>
          <h3 className="mt-1 text-lg font-extrabold text-slate-900 dark:text-slate-100">
            {teacher ? `مرحباً ${teacher.name}` : `إدارة ${db.settings.schoolName}`}
          </h3>
          <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
            {curGrade?.name || '—'} · شعبة {curSection?.name || '—'} · المادة المختارة:{' '}
            <strong className="text-slate-700 dark:text-slate-200">{curSubject?.name || '—'}</strong>
            {teacher && ' · صلاحية معزولة لموادك وشعبك المسندة'}
          </p>
        </div>

        <button
          type="button"
          onClick={() => onNavigate('grades')}
          className="inline-flex shrink-0 cursor-pointer items-center justify-center gap-2 rounded-lg bg-emerald-800 px-4 py-2.5 text-sm font-bold text-white whitespace-nowrap transition-colors hover:bg-emerald-700 dark:bg-emerald-600 dark:hover:bg-emerald-500"
        >
          <BookOpen className="h-4 w-4" />
          <span>فتح سجل الدرجات</span>
        </button>
      </section>

      {session.role === 'admin' && !db.settings.rulesConfirmed && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50/90 px-4 py-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
          <div>
            <span className="font-bold">تنبيه الضوابط:</span>{' '}
            ضوابط الإعفاء والرسوب مضبوطة على القيم الافتراضية. يمكنك مراجعتها واعتمادها بما يوافق تعليمات المدرسة.
          </div>
          <button
            type="button"
            onClick={() => onNavigate('settings')}
            className="cursor-pointer rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-bold text-white whitespace-nowrap hover:bg-amber-500"
          >
            مراجعة الضوابط
          </button>
        </div>
      )}

      {/* 4 KPI Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
              {teacher ? 'طلبة شعبك المسندة' : 'إجمالي الطلبة المسجلين'}
            </span>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400">
              <Users className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2 text-3xl font-extrabold text-slate-900 tabular-nums dark:text-slate-100">
            {visibleStudents.length}
          </div>
          <div className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
            موزعون على {db.sections.length} شعب دراسية
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
              طلبة الشعبة المختارة
            </span>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-sky-50 text-sky-700 dark:bg-sky-950/60 dark:text-sky-400">
              <BookOpen className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2 text-3xl font-extrabold text-sky-700 tabular-nums dark:text-sky-400">
            {secStudents.length}
          </div>
          <div className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
            {curGrade?.name || ''} · شعبة {curSection?.name || '—'}
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
              مؤهلون للإعفاء (فردي / كلي)
            </span>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400">
              <Award className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2 text-3xl font-extrabold text-emerald-700 tabular-nums dark:text-emerald-400">
            {exemptCount}
          </div>
          <div className="mt-1 text-[11px] text-slate-500 tabular-nums dark:text-slate-400">
            نسبة {visibleStudents.length ? Math.round((exemptCount / visibleStudents.length) * 100) : 0}% من الطلبة
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
              معرضون للرسوب / مكملون
            </span>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-red-50 text-red-600 dark:bg-red-950/60 dark:text-red-400">
              <AlertTriangle className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2 text-3xl font-extrabold text-red-600 tabular-nums dark:text-red-400">
            {riskCount}
          </div>
          <div className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
            يحتاجون متابعة وإشعار ولي الأمر
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
        {/* Structured Quick Action Directory */}
        <section className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900 lg:col-span-7">
          <div className="mb-4 flex items-center justify-between gap-2">
            <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
              اختصارات المنصة السريعة
            </h3>
            <span className="text-xs text-slate-500 dark:text-slate-400">
              وصول مباشر لكافة الأدوات
            </span>
          </div>
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => onNavigate('grades')}
              className="group flex cursor-pointer items-center justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50/70 p-3.5 text-right transition-colors hover:bg-emerald-100/80 dark:border-emerald-800/70 dark:bg-emerald-950/30 dark:hover:bg-emerald-950/50"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-800 text-white dark:bg-emerald-600">
                  <BookOpen className="h-4 w-4" />
                </div>
                <div>
                  <div className="text-sm font-bold text-emerald-950 dark:text-emerald-200">سجل الدرجات</div>
                  <div className="text-[11px] text-emerald-800/80 dark:text-emerald-400/80">
                    اليومي والتحريري والسعي والإعفاء
                  </div>
                </div>
              </div>
              <ChevronLeft className="h-4 w-4 shrink-0 text-emerald-700 transition-transform group-hover:-translate-x-0.5 dark:text-emerald-400" />
            </button>

            <button
              type="button"
              onClick={() => onNavigate('schedule')}
              className="group flex cursor-pointer items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50/70 p-3.5 text-right transition-colors hover:border-slate-300 hover:bg-slate-100 dark:border-slate-800 dark:bg-slate-800/50 dark:hover:bg-slate-800"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white text-slate-700 ring-1 ring-slate-200 dark:bg-slate-900 dark:text-slate-200 dark:ring-slate-700">
                  <CalendarDays className="h-4 w-4" />
                </div>
                <div>
                  <div className="text-sm font-bold text-slate-900 dark:text-slate-100">جدول الحصص اليومي</div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400">
                    الحصص الأسبوعية وطباعة A4
                  </div>
                </div>
              </div>
              <ChevronLeft className="h-4 w-4 shrink-0 text-slate-400 transition-transform group-hover:-translate-x-0.5" />
            </button>

            <button
              type="button"
              onClick={() => onNavigate('tools')}
              className="group flex cursor-pointer items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50/70 p-3.5 text-right transition-colors hover:border-amber-300 hover:bg-amber-50/60 dark:border-slate-800 dark:bg-slate-800/50 dark:hover:bg-slate-800"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300">
                  <Sparkles className="h-4 w-4" />
                </div>
                <div>
                  <div className="text-sm font-bold text-slate-900 dark:text-slate-100">عجلة المشاركة وأسئلة A4</div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400">
                    اختيار تفاعلي وصياغة الأسئلة
                  </div>
                </div>
              </div>
              <ChevronLeft className="h-4 w-4 shrink-0 text-slate-400 transition-transform group-hover:-translate-x-0.5" />
            </button>

            <button
              type="button"
              onClick={() => onNavigate('attendance')}
              className="group flex cursor-pointer items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50/70 p-3.5 text-right transition-colors hover:border-sky-300 hover:bg-sky-50/60 dark:border-slate-800 dark:bg-slate-800/50 dark:hover:bg-slate-800"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-sky-100 text-sky-800 dark:bg-sky-950/60 dark:text-sky-300">
                  <CalendarCheck className="h-4 w-4" />
                </div>
                <div>
                  <div className="text-sm font-bold text-slate-900 dark:text-slate-100">الحضور وإشعار واتساب</div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400">
                    تسجيل الغياب وإرسال التنبيهات
                  </div>
                </div>
              </div>
              <ChevronLeft className="h-4 w-4 shrink-0 text-slate-400 transition-transform group-hover:-translate-x-0.5" />
            </button>

            <button
              type="button"
              onClick={onOpenAddStudent}
              className="group flex cursor-pointer items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50/70 p-3.5 text-right transition-colors hover:border-slate-300 hover:bg-slate-100 dark:border-slate-800 dark:bg-slate-800/50 dark:hover:bg-slate-800"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white text-slate-700 ring-1 ring-slate-200 dark:bg-slate-900 dark:text-slate-200 dark:ring-slate-700">
                  <UserPlus className="h-4 w-4" />
                </div>
                <div>
                  <div className="text-sm font-bold text-slate-900 dark:text-slate-100">إضافة طالب</div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400">
                    إضافة فردية أو استيراد Excel
                  </div>
                </div>
              </div>
              <ChevronLeft className="h-4 w-4 shrink-0 text-slate-400 transition-transform group-hover:-translate-x-0.5" />
            </button>

            <button
              type="button"
              onClick={() => onNavigate('reports')}
              className="group flex cursor-pointer items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50/70 p-3.5 text-right transition-colors hover:border-slate-300 hover:bg-slate-100 dark:border-slate-800 dark:bg-slate-800/50 dark:hover:bg-slate-800"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white text-slate-700 ring-1 ring-slate-200 dark:bg-slate-900 dark:text-slate-200 dark:ring-slate-700">
                  <BarChart3 className="h-4 w-4" />
                </div>
                <div>
                  <div className="text-sm font-bold text-slate-900 dark:text-slate-100">التقارير والإحصائيات</div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400">
                    لوحة الأوائل ومقارنة الشعب
                  </div>
                </div>
              </div>
              <ChevronLeft className="h-4 w-4 shrink-0 text-slate-400 transition-transform group-hover:-translate-x-0.5" />
            </button>

            {session.role === 'admin' && (
              <button
                type="button"
                onClick={() => onNavigate('parent')}
                className="group flex cursor-pointer items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50/70 p-3.5 text-right transition-colors hover:border-slate-300 hover:bg-slate-100 dark:border-slate-800 dark:bg-slate-800/50 dark:hover:bg-slate-800"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white text-emerald-700 ring-1 ring-slate-200 dark:bg-slate-900 dark:text-emerald-400 dark:ring-slate-700">
                    <UserCheck className="h-4 w-4" />
                  </div>
                  <div>
                    <div className="text-sm font-bold text-slate-900 dark:text-slate-100">بوابة ولي الأمر</div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400">
                      معاينة تقارير الطلبة ونسخ الروابط
                    </div>
                  </div>
                </div>
                <ChevronLeft className="h-4 w-4 shrink-0 text-slate-400 transition-transform group-hover:-translate-x-0.5" />
              </button>
            )}

            <button
              type="button"
              onClick={onOpenQuickGrade}
              className={`group flex cursor-pointer items-center justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50/50 p-3.5 text-right transition-colors hover:border-emerald-300 hover:bg-emerald-50 dark:border-emerald-800/70 dark:bg-emerald-950/25 dark:hover:bg-emerald-950/45 ${
                session.role !== 'admin' ? 'sm:col-span-2' : ''
              }`}
            >
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white text-emerald-700 ring-1 ring-emerald-200 dark:bg-slate-900 dark:text-emerald-400 dark:ring-emerald-800">
                  <Search className="h-4 w-4" />
                </div>
                <div>
                  <div className="text-sm font-bold text-slate-900 dark:text-slate-100">
                    رصد الدرجات بالبحث
                  </div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400">
                    بحث عن طالب وإعطاء درجة حتى الحد الأعلى
                  </div>
                </div>
              </div>
              <ChevronLeft className="h-4 w-4 shrink-0 text-emerald-700 transition-transform group-hover:-translate-x-0.5 dark:text-emerald-400" />
            </button>
          </div>
        </section>

        {/* Right Column: Schedule Snapshot & Recent Notes */}
        <div className="space-y-5 lg:col-span-5">
          <section className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
            <div className="mb-3 flex items-center justify-between gap-2">
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                أقرب الحصص المجدولة
              </h3>
              <button
                type="button"
                onClick={() => onNavigate('schedule')}
                className="cursor-pointer rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
              >
                عرض الجدول
              </button>
            </div>
            {upcomingClasses.length ? (
              <div className="divide-y divide-slate-200 dark:divide-slate-800">
                {upcomingClasses.map((sl) => {
                  const sb = db.subjects.find((x) => x.id === sl.subjectId);
                  const sc = db.sections.find((x) => x.id === sl.sectionId);
                  return (
                    <div key={sl.id} className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0">
                      <div>
                        <div className="text-sm font-bold text-slate-900 dark:text-slate-100">
                          {sb?.name || 'مادة'} · شعبة {sc?.name || ''}
                        </div>
                        <div className="text-xs text-slate-500 tabular-nums dark:text-slate-400">
                          {DAY_LABELS[sl.day]} · الحصة {sl.period} ({sl.timeRange})
                        </div>
                      </div>
                      {sl.room && (
                        <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                          {sl.room}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-sm text-slate-500 dark:text-slate-400">لا توجد حصص مجدولة بعد.</p>
            )}
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
            <div className="mb-3 flex items-center justify-between gap-2">
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                أحدث الملاحظات التربوية
              </h3>
              <button
                type="button"
                onClick={() => onNavigate('tools')}
                className="cursor-pointer rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
              >
                إضافة ملاحظة
              </button>
            </div>
            {recentNotes.length ? (
              <div className="divide-y divide-slate-200 dark:divide-slate-800">
                {recentNotes.map((note) => {
                  const stu = db.students.find((s) => s.id === note.studentId);
                  const tone =
                    note.type === 'positive'
                      ? 'success'
                      : note.type === 'warning'
                      ? 'danger'
                      : 'info';
                  const typeLabel =
                    note.type === 'positive'
                      ? 'إيجابية'
                      : note.type === 'warning'
                      ? 'متابعة'
                      : 'تعليمية';
                  return (
                    <div key={note.id} className="py-2.5 first:pt-0 last:pb-0">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2 text-sm">
                          <strong className="text-slate-900 dark:text-slate-100">
                            {stu ? stu.name : 'طالب'}
                          </strong>
                          <span className="text-xs text-slate-500 tabular-nums dark:text-slate-400">
                            · {note.date}
                          </span>
                        </div>
                        <StatusBadge label={typeLabel} tone={tone} />
                      </div>
                      <p className="mt-1 text-xs leading-relaxed text-slate-600 dark:text-slate-300">
                        {note.text}
                      </p>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-sm text-slate-500 dark:text-slate-400">لا توجد ملاحظات مسجلة بعد.</p>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
