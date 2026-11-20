import { Menu } from 'lucide-react';
import type { AcademicContext, AppDatabase, AuthSession, NavView } from '../types/gradebook';
import { getAllowedTeacherScope } from '../utils/evaluation';

const VIEW_TITLES: Record<NavView, string> = {
  dashboard: 'لوحة التحكم الرئيسية',
  grades: 'سجل الدرجات والفصول والتقييم',
  schedule: 'جدول الحصص اليومي والأسبوعي',
  students: 'إدارة الطلبة والشعب و Excel',
  attendance: 'الحضور والغياب وإشعار واتساب',
  reports: 'الأوائل ومقارنة الشعب والتقارير',
  tools: 'عجلة المشاركة وصياغة أسئلة A4',
  structure: 'المراحل والشعب والكادر التدريسي',
  parent: 'بوابة ولي الأمر الذكية',
  settings: 'الضوابط والمزامنة والنسخ الاحتياطي',
};

interface TopBarProps {
  activeView: NavView;
  db: AppDatabase;
  ctx: AcademicContext;
  session: AuthSession;
  onChangeContext: (next: Partial<AcademicContext>) => void;
  onOpenMobileMenu: () => void;
}

export function TopBar({
  activeView,
  db,
  ctx,
  session,
  onChangeContext,
  onOpenMobileMenu,
}: TopBarProps) {
  const { allowedSubjectIds, allowedSectionIds } = getAllowedTeacherScope(db, session);

  const visibleSectionsAll = allowedSectionIds
    ? db.sections.filter((s) => allowedSectionIds.has(s.id))
    : db.sections;
  const visibleSubjectsAll = allowedSubjectIds
    ? db.subjects.filter((sb) => allowedSubjectIds.has(sb.id))
    : db.subjects;

  const allowedGradeIds = new Set([
    ...visibleSectionsAll.map((s) => s.gradeId),
    ...visibleSubjectsAll.map((sb) => sb.gradeId),
  ]);

  const visibleGrades =
    session.role === 'teacher'
      ? db.grades.filter((g) => allowedGradeIds.has(g.id))
      : db.grades;
  const allowedStageIds = new Set(visibleGrades.map((g) => g.stageId));
  const visibleStages =
    session.role === 'teacher'
      ? db.stages.filter((st) => allowedStageIds.has(st.id))
      : db.stages;

  const grades = visibleGrades.filter((g) => g.stageId === ctx.stageId);
  const sections = visibleSectionsAll.filter((s) => s.gradeId === ctx.gradeId);
  const subjects = visibleSubjectsAll.filter((sb) => sb.gradeId === ctx.gradeId);

  const curStage = visibleStages.find((s) => s.id === ctx.stageId);
  const curGrade = grades.find((g) => g.id === ctx.gradeId);
  const curSec = sections.find((s) => s.id === ctx.sectionId);
  const curSub = subjects.find((sb) => sb.id === ctx.subjectId);

  const selectClass =
    'min-h-[36px] rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs font-semibold text-slate-800 transition-colors hover:border-slate-300 focus:border-emerald-700 focus:bg-white focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:hover:border-slate-600';

  return (
    <header className="no-print sticky top-0 z-30 flex flex-col gap-3 border-b border-slate-200 bg-white/95 px-4 py-3 backdrop-blur-sm dark:border-slate-800 dark:bg-slate-900/95 sm:px-6 lg:flex-row lg:items-center lg:justify-between">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onOpenMobileMenu}
          aria-label="فتح القائمة"
          className="inline-flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 lg:hidden"
        >
          <Menu className="h-5 w-5" />
        </button>
        <div className="min-w-0">
          <h2 className="truncate text-base font-extrabold text-slate-900 dark:text-slate-100 sm:text-lg">
            {VIEW_TITLES[activeView]}
          </h2>
          {session.role !== 'parent' && (
            <div className="hidden items-center gap-1.5 text-[11px] font-medium text-slate-500 dark:text-slate-400 sm:flex">
              <span>{curStage?.name || '—'}</span>
              <span aria-hidden="true">/</span>
              <span>{curGrade?.name || '—'}</span>
              <span aria-hidden="true">/</span>
              <span>{curSec ? `شعبة ${curSec.name}` : '—'}</span>
              <span aria-hidden="true">·</span>
              <span className="font-bold text-emerald-700 dark:text-emerald-400">
                {curSub?.name || '—'}
              </span>
            </div>
          )}
        </div>
      </div>

      {session.role !== 'parent' && (
        <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center">
          <select
            aria-label="المرحلة الدراسية"
            value={ctx.stageId}
            onChange={(e) => onChangeContext({ stageId: e.target.value, gradeId: '', sectionId: '', subjectId: '' })}
            className={selectClass}
          >
            {visibleStages.map((st) => (
              <option key={st.id} value={st.id}>
                {st.name}
              </option>
            ))}
          </select>

          <select
            aria-label="الصف الدراسي"
            value={ctx.gradeId}
            onChange={(e) => onChangeContext({ gradeId: e.target.value, sectionId: '', subjectId: '' })}
            className={selectClass}
          >
            {grades.length ? (
              grades.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))
            ) : (
              <option value="">لا توجد صفوف</option>
            )}
          </select>

          <select
            aria-label="الشعبة"
            value={ctx.sectionId}
            onChange={(e) => onChangeContext({ sectionId: e.target.value })}
            className={selectClass}
          >
            {sections.length ? (
              sections.map((sec) => (
                <option key={sec.id} value={sec.id}>
                  شعبة {sec.name}
                </option>
              ))
            ) : (
              <option value="">لا توجد شعب</option>
            )}
          </select>

          <select
            aria-label="المادة الدراسية"
            value={ctx.subjectId}
            onChange={(e) => onChangeContext({ subjectId: e.target.value })}
            className={selectClass}
          >
            {subjects.length ? (
              subjects.map((sub) => (
                <option key={sub.id} value={sub.id}>
                  {sub.name}
                </option>
              ))
            ) : (
              <option value="">لا توجد مواد</option>
            )}
          </select>
        </div>
      )}
    </header>
  );
}
