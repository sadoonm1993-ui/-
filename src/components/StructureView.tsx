import { useState } from 'react';
import { Edit3, Plus, Shield, Trash2 } from 'lucide-react';
import type { AcademicContext, AppDatabase, TeacherAccount } from '../types/gradebook';
import { uid } from '../utils/evaluation';

interface StructureViewProps {
  db: AppDatabase;
  ctx: AcademicContext;
  onAddStage: (name: string) => void;
  onDeleteStage: (id: string) => void;
  onAddGrade: (stageId: string, name: string) => void;
  onDeleteGrade: (id: string) => void;
  onAddSection: (gradeId: string, name: string) => void;
  onDeleteSection: (id: string) => void;
  onAddSubject: (gradeId: string, name: string) => void;
  onDeleteSubject: (id: string) => void;
  onSaveTeacher: (teacher: TeacherAccount) => void;
  onDeleteTeacher: (id: string) => void;
  onNotify: (msg: string) => void;
}

export function StructureView({
  db,
  ctx,
  onAddStage,
  onDeleteStage,
  onAddGrade,
  onDeleteGrade,
  onAddSection,
  onDeleteSection,
  onAddSubject,
  onDeleteSubject,
  onSaveTeacher,
  onDeleteTeacher,
  onNotify,
}: StructureViewProps) {
  const [stageName, setStageName] = useState('');
  const [gradeName, setGradeName] = useState('');
  const [sectionName, setSectionName] = useState('');
  const [subjectName, setSubjectName] = useState('');
  const [teacherModal, setTeacherModal] = useState<TeacherAccount | null>(null);

  const gradesInStage = db.grades.filter((g) => g.stageId === ctx.stageId);
  const sectionsInGrade = db.sections.filter((s) => s.gradeId === ctx.gradeId);
  const subjectsInGrade = db.subjects.filter((sb) => sb.gradeId === ctx.gradeId);

  const openNewTeacher = () => {
    setTeacherModal({
      id: '',
      name: '',
      pin: String(Math.floor(1000 + Math.random() * 9000)),
      specialty: '',
      assignedSubjectIds: ctx.subjectId ? [ctx.subjectId] : [],
      assignedSectionIds: ctx.sectionId ? [ctx.sectionId] : [],
    });
  };

  const handleTeacherSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!teacherModal) return;
    if (!teacherModal.name.trim() || !teacherModal.pin.trim()) {
      onNotify('يرجى إدخال اسم المدرس ورمز الدخول (PIN)');
      return;
    }
    const duplicatePin = db.teachers.some(
      (t) => t.pin === teacherModal.pin.trim() && t.id !== teacherModal.id
    );
    if (duplicatePin) {
      onNotify('رمز PIN مستخدم لمدرس آخر؛ اختر رمزاً مختلفاً');
      return;
    }
    onSaveTeacher({
      ...teacherModal,
      id: teacherModal.id || uid('tch'),
      name: teacherModal.name.trim(),
      pin: teacherModal.pin.trim(),
      specialty: teacherModal.specialty.trim() || 'مدرس مادة',
    });
    setTeacherModal(null);
    onNotify('تم حفظ حساب المدرس وصلاحياته');
  };

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <section className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
          <h3 className="mb-3 text-base font-bold text-slate-900 dark:text-slate-100">
            1. المراحل الدراسية
          </h3>
          <div className="mb-3 flex gap-2">
            <input
              value={stageName}
              onChange={(e) => setStageName(e.target.value)}
              placeholder="مثال: المرحلة الابتدائية"
              className="flex-1 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
            />
            <button
              type="button"
              onClick={() => {
                if (!stageName.trim()) return;
                onAddStage(stageName.trim());
                setStageName('');
              }}
              className="inline-flex cursor-pointer items-center gap-1 rounded-lg bg-emerald-800 px-3.5 py-2 text-xs font-bold text-white whitespace-nowrap hover:bg-emerald-700"
            >
              <Plus className="h-4 w-4" />
              <span>إضافة</span>
            </button>
          </div>
          <div className="divide-y divide-slate-200 dark:divide-slate-800">
            {db.stages.map((st) => (
              <div key={st.id} className="flex items-center justify-between py-2.5 text-sm">
                <strong className="text-slate-900 dark:text-slate-100">{st.name}</strong>
                <button
                  type="button"
                  onClick={() => {
                    if (window.confirm(`حذف "${st.name}" وكل ما يرتبط بها؟`)) onDeleteStage(st.id);
                  }}
                  aria-label={`حذف ${st.name}`}
                  className="inline-flex cursor-pointer items-center gap-1 rounded-md bg-red-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-red-500"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  <span>حذف</span>
                </button>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
          <h3 className="mb-3 text-base font-bold text-slate-900 dark:text-slate-100">
            2. الصفوف (ضمن المرحلة المختارة)
          </h3>
          <div className="mb-3 flex gap-2">
            <input
              value={gradeName}
              onChange={(e) => setGradeName(e.target.value)}
              placeholder="مثال: السادس الإعدادي"
              className="flex-1 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
            />
            <button
              type="button"
              onClick={() => {
                if (!ctx.stageId || !gradeName.trim()) return;
                onAddGrade(ctx.stageId, gradeName.trim());
                setGradeName('');
              }}
              className="inline-flex cursor-pointer items-center gap-1 rounded-lg bg-emerald-800 px-3.5 py-2 text-xs font-bold text-white whitespace-nowrap hover:bg-emerald-700"
            >
              <Plus className="h-4 w-4" />
              <span>إضافة</span>
            </button>
          </div>
          <div className="divide-y divide-slate-200 dark:divide-slate-800">
            {gradesInStage.map((g) => (
              <div key={g.id} className="flex items-center justify-between py-2.5 text-sm">
                <span className="font-semibold text-slate-800 dark:text-slate-200">{g.name}</span>
                <button
                  type="button"
                  onClick={() => {
                    if (window.confirm(`حذف "${g.name}"؟`)) onDeleteGrade(g.id);
                  }}
                  aria-label={`حذف ${g.name}`}
                  className="inline-flex cursor-pointer items-center gap-1 rounded-md bg-red-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-red-500"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  <span>حذف</span>
                </button>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
          <h3 className="mb-3 text-base font-bold text-slate-900 dark:text-slate-100">
            3. الشعب (ضمن الصف المختار)
          </h3>
          <div className="mb-3 flex gap-2">
            <input
              value={sectionName}
              onChange={(e) => setSectionName(e.target.value)}
              placeholder="مثال: ج"
              className="flex-1 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
            />
            <button
              type="button"
              onClick={() => {
                if (!ctx.gradeId || !sectionName.trim()) return;
                onAddSection(ctx.gradeId, sectionName.trim());
                setSectionName('');
              }}
              className="inline-flex cursor-pointer items-center gap-1 rounded-lg bg-emerald-800 px-3.5 py-2 text-xs font-bold text-white whitespace-nowrap hover:bg-emerald-700"
            >
              <Plus className="h-4 w-4" />
              <span>إضافة</span>
            </button>
          </div>
          <div className="divide-y divide-slate-200 dark:divide-slate-800">
            {sectionsInGrade.map((s) => {
              const count = db.students.filter((st) => st.sectionId === s.id).length;
              return (
                <div key={s.id} className="flex items-center justify-between py-2.5 text-sm">
                  <span className="font-semibold text-slate-800 dark:text-slate-200">
                    شعبة {s.name}{' '}
                    <span className="font-normal text-xs text-slate-500 tabular-nums">({count} طالب)</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      if (window.confirm(`حذف شعبة "${s.name}" وطلبتها؟`)) onDeleteSection(s.id);
                    }}
                    aria-label={`حذف شعبة ${s.name}`}
                    className="inline-flex cursor-pointer items-center gap-1 rounded-md bg-red-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-red-500"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    <span>حذف</span>
                  </button>
                </div>
              );
            })}
          </div>
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
          <h3 className="mb-3 text-base font-bold text-slate-900 dark:text-slate-100">
            4. المواد الدراسية (ضمن الصف المختار)
          </h3>
          <div className="mb-3 flex gap-2">
            <input
              value={subjectName}
              onChange={(e) => setSubjectName(e.target.value)}
              placeholder="مثال: الرياضيات"
              className="flex-1 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
            />
            <button
              type="button"
              onClick={() => {
                if (!ctx.gradeId || !subjectName.trim()) return;
                onAddSubject(ctx.gradeId, subjectName.trim());
                setSubjectName('');
              }}
              className="inline-flex cursor-pointer items-center gap-1 rounded-lg bg-emerald-800 px-3.5 py-2 text-xs font-bold text-white whitespace-nowrap hover:bg-emerald-700"
            >
              <Plus className="h-4 w-4" />
              <span>إضافة</span>
            </button>
          </div>
          <div className="divide-y divide-slate-200 dark:divide-slate-800">
            {subjectsInGrade.map((sb) => (
              <div key={sb.id} className="flex items-center justify-between py-2.5 text-sm">
                <span className="font-semibold text-slate-800 dark:text-slate-200">{sb.name}</span>
                <button
                  type="button"
                  onClick={() => {
                    if (window.confirm(`حذف مادة "${sb.name}"؟`)) onDeleteSubject(sb.id);
                  }}
                  aria-label={`حذف مادة ${sb.name}`}
                  className="inline-flex cursor-pointer items-center gap-1 rounded-md bg-red-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-red-500"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  <span>حذف</span>
                </button>
              </div>
            ))}
          </div>
        </section>
      </div>

      {/* Teacher Accounts & PIN Isolation Management */}
      <section className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="flex items-center gap-2 text-base font-bold text-slate-900 dark:text-slate-100">
              <Shield className="h-4 w-4 text-emerald-700 dark:text-emerald-400" />
              <span>5. الكادر التدريسي وصلاحيات رمز PIN (عزل المواد والشعب)</span>
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              لكل مدرس رمز PIN خاص يتيح له إدارة مواده وشعبه فقط دون التداخل مع باقي المواد.
            </p>
          </div>
          <button
            type="button"
            onClick={openNewTeacher}
            className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-emerald-800 px-3.5 py-2 text-xs font-bold text-white whitespace-nowrap hover:bg-emerald-700 dark:bg-emerald-600"
          >
            <Plus className="h-4 w-4" />
            <span>إضافة مدرس وصلاحية PIN</span>
          </button>
        </div>

        <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-800">
          <table className="w-full min-w-[680px] border-collapse text-right text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-xs text-slate-600 dark:border-slate-800 dark:bg-slate-800/70 dark:text-slate-300">
                <th className="px-3 py-2.5 font-bold">اسم المدرس</th>
                <th className="px-3 py-2.5 font-bold">التخصص</th>
                <th className="px-3 py-2.5 font-bold">رمز PIN</th>
                <th className="px-3 py-2.5 font-bold">المواد المخصصة</th>
                <th className="px-3 py-2.5 font-bold">الشعب المخصصة</th>
                <th className="px-3 py-2.5 font-bold">إجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
              {db.teachers.map((t) => {
                const subNames = t.assignedSubjectIds
                  .map((id) => db.subjects.find((sb) => sb.id === id)?.name)
                  .filter(Boolean)
                  .join(' · ');
                const secNames = t.assignedSectionIds
                  .map((id) => {
                    const sc = db.sections.find((s) => s.id === id);
                    const gr = sc ? db.grades.find((g) => g.id === sc.gradeId) : null;
                    return sc ? `${gr?.name || ''} (${sc.name})` : null;
                  })
                  .filter(Boolean)
                  .join(' · ');
                return (
                  <tr key={t.id}>
                    <td className="px-3 py-2.5 font-bold text-slate-900 dark:text-slate-100">{t.name}</td>
                    <td className="px-3 py-2.5 text-xs text-slate-600 dark:text-slate-300">{t.specialty}</td>
                    <td className="px-3 py-2.5 font-mono text-xs font-bold text-emerald-700 dark:text-emerald-400">
                      {t.pin}
                    </td>
                    <td className="px-3 py-2.5 text-xs text-slate-700 dark:text-slate-300">
                      {subNames || 'لم تُحدد مواد'}
                    </td>
                    <td className="px-3 py-2.5 text-xs text-slate-700 dark:text-slate-300">
                      {secNames || 'لم تُحدد شعب'}
                    </td>
                    <td className="px-3 py-2.5 whitespace-nowrap">
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => setTeacherModal({ ...t })}
                          className="inline-flex cursor-pointer items-center gap-1 rounded-md border border-slate-200 px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200"
                        >
                          <Edit3 className="h-3.5 w-3.5" />
                          <span>تعديل</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            if (window.confirm(`حذف حساب المدرس "${t.name}"؟`)) {
                              onDeleteTeacher(t.id);
                              onNotify('تم حذف حساب المدرس');
                            }
                          }}
                          className="inline-flex cursor-pointer items-center gap-1 rounded-md bg-red-600 px-2 py-1 text-xs font-semibold text-white hover:bg-red-500"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          <span>حذف</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {teacherModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-900/50 p-4">
          <form
            onSubmit={handleTeacherSubmit}
            className="w-full max-w-xl rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900"
          >
            <h3 className="mb-4 text-base font-bold text-slate-900 dark:text-slate-100">
              {teacherModal.id ? 'تعديل صلاحيات المدرس' : 'إضافة مدرس جديد برمز PIN'}
            </h3>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="sm:col-span-2">
                <label className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-400">
                  الاسم الكامل
                </label>
                <input
                  value={teacherModal.name}
                  onChange={(e) => setTeacherModal({ ...teacherModal, name: e.target.value })}
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-400">
                  رمز PIN الخاص
                </label>
                <input
                  dir="ltr"
                  value={teacherModal.pin}
                  onChange={(e) => setTeacherModal({ ...teacherModal, pin: e.target.value })}
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 font-mono text-sm dark:border-slate-700 dark:bg-slate-800"
                />
              </div>
              <div className="sm:col-span-3">
                <label className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-400">
                  التخصص / الوصف
                </label>
                <input
                  value={teacherModal.specialty}
                  onChange={(e) => setTeacherModal({ ...teacherModal, specialty: e.target.value })}
                  placeholder="مثال: مدرس الرياضيات"
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
                />
              </div>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <div className="mb-1.5 text-xs font-bold text-slate-700 dark:text-slate-300">
                  المواد المسموح للمدرس بإدارتها
                </div>
                <div className="max-h-40 space-y-1.5 overflow-y-auto rounded-lg border border-slate-200 p-2.5 dark:border-slate-700">
                  {db.subjects.map((sb) => {
                    const g = db.grades.find((x) => x.id === sb.gradeId);
                    const checked = teacherModal.assignedSubjectIds.includes(sb.id);
                    return (
                      <label key={sb.id} className="flex cursor-pointer items-center gap-2 text-xs">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(e) => {
                            const next = e.target.checked
                              ? [...teacherModal.assignedSubjectIds, sb.id]
                              : teacherModal.assignedSubjectIds.filter((id) => id !== sb.id);
                            setTeacherModal({ ...teacherModal, assignedSubjectIds: next });
                          }}
                          className="accent-emerald-700"
                        />
                        <span>
                          {sb.name} ({g?.name || ''})
                        </span>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div>
                <div className="mb-1.5 text-xs font-bold text-slate-700 dark:text-slate-300">
                  الشعب المسموح للمدرس بإدارتها
                </div>
                <div className="max-h-40 space-y-1.5 overflow-y-auto rounded-lg border border-slate-200 p-2.5 dark:border-slate-700">
                  {db.sections.map((sc) => {
                    const g = db.grades.find((x) => x.id === sc.gradeId);
                    const checked = teacherModal.assignedSectionIds.includes(sc.id);
                    return (
                      <label key={sc.id} className="flex cursor-pointer items-center gap-2 text-xs">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(e) => {
                            const next = e.target.checked
                              ? [...teacherModal.assignedSectionIds, sc.id]
                              : teacherModal.assignedSectionIds.filter((id) => id !== sc.id);
                            setTeacherModal({ ...teacherModal, assignedSectionIds: next });
                          }}
                          className="accent-emerald-700"
                        />
                        <span>
                          {g?.name || ''} · شعبة {sc.name}
                        </span>
                      </label>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setTeacherModal(null)}
                className="cursor-pointer rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300"
              >
                إلغاء
              </button>
              <button
                type="submit"
                className="cursor-pointer rounded-lg bg-emerald-800 px-4 py-1.5 text-sm font-bold text-white hover:bg-emerald-700"
              >
                حفظ الصلاحيات
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
