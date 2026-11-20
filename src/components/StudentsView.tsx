import { useState } from 'react';
import { Download, Edit3, FileText, MessageCircle, Plus, Search, Trash2, Upload, UserPlus } from 'lucide-react';
import type { AcademicContext, AppDatabase, AuthSession, Student } from '../types/gradebook';
import { buildWhatsAppUrl, evaluateStudentOverall, getAllowedTeacherScope, uid } from '../utils/evaluation';
import { exportExcelWorkbook, parseExcelStudentFile } from '../utils/storage';
import { StatusBadge } from './StatusBadge';

interface StudentsViewProps {
  db: AppDatabase;
  ctx: AcademicContext;
  session: AuthSession;
  onSaveStudent: (student: Student) => void;
  onBulkAddStudents: (students: Student[]) => void;
  onDeleteStudent: (studentId: string) => void;
  onAddSection: (gradeId: string, name: string) => void;
  onDeleteSection: (sectionId: string) => void;
  onViewStudentReport: (studentId: string) => void;
  onNotify: (msg: string) => void;
  showAddOnMount?: boolean;
  onClearAddOnMount?: () => void;
}

function generatePin(): string {
  return String(Math.floor(1000 + Math.random() * 9000));
}

export function StudentsView({
  db,
  ctx,
  session,
  onSaveStudent,
  onBulkAddStudents,
  onDeleteStudent,
  onAddSection,
  onDeleteSection,
  onViewStudentReport,
  onNotify,
  showAddOnMount,
  onClearAddOnMount,
}: StudentsViewProps) {
  const [search, setSearch] = useState('');
  const [newSectionName, setNewSectionName] = useState('');
  const [modalStudent, setModalStudent] = useState<Student | null>(
    showAddOnMount
      ? {
          id: '',
          name: '',
          number: String(db.students.length + 101),
          sectionId: ctx.sectionId,
          pin: generatePin(),
          phone: '',
        }
      : null
  );
  const [formError, setFormError] = useState('');
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkText, setBulkText] = useState('');

  const { allowedSectionIds } = getAllowedTeacherScope(db, session);
  const gradeSections = db.sections.filter(
    (sc) => sc.gradeId === ctx.gradeId && (!allowedSectionIds || allowedSectionIds.has(sc.id))
  );

  const scopedStudents = allowedSectionIds
    ? db.students.filter((s) => allowedSectionIds.has(s.sectionId))
    : db.students;

  let list = scopedStudents.filter((s) => !ctx.sectionId || s.sectionId === ctx.sectionId);
  if (search.trim()) {
    const q = search.trim().toLowerCase();
    list = scopedStudents.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        String(s.number).toLowerCase().includes(q) ||
        String(s.pin).toLowerCase().includes(q)
    );
  }
  const sorted = [...list].sort((a, b) => a.name.localeCompare(b.name, 'ar'));

  const openAdd = () => {
    if (!db.sections.length) {
      onNotify('أنشئ شعبة أولاً من قسم إدارة الشعب');
      return;
    }
    setFormError('');
    setModalStudent({
      id: '',
      name: '',
      number: String(db.students.length + 101),
      sectionId: ctx.sectionId || gradeSections[0]?.id || db.sections[0].id,
      pin: generatePin(),
      phone: '',
    });
  };

  const closeStudentModal = () => {
    setModalStudent(null);
    setFormError('');
    if (showAddOnMount && onClearAddOnMount) onClearAddOnMount();
  };

  const handleStudentSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!modalStudent) return;
    if (!modalStudent.name.trim()) {
      setFormError('يرجى إدخال اسم الطالب الكامل');
      return;
    }
    const payload: Student = {
      ...modalStudent,
      id: modalStudent.id || uid('stu'),
      name: modalStudent.name.trim(),
      number: modalStudent.number.trim() || String(db.students.length + 101),
      pin: modalStudent.pin.trim() || generatePin(),
      phone: modalStudent.phone.trim(),
    };
    onSaveStudent(payload);
    closeStudentModal();
    onNotify(modalStudent.id ? 'تم تحديث بيانات الطالب' : 'تمت إضافة الطالب بنجاح');
  };

  const handleBulkFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const lines = await parseExcelStudentFile(file);
      setBulkText(lines.join('\n'));
      onNotify('تمت قراءة الملف؛ اضغط استيراد لإضافة الطلبة');
    } catch {
      onNotify('تعذر قراءة الملف');
    }
    e.target.value = '';
  };

  const handleBulkImport = () => {
    if (!ctx.sectionId) {
      onNotify('اختر شعبة أولاً');
      return;
    }
    const lines = bulkText.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    const created: Student[] = [];
    lines.forEach((line) => {
      const parts = line.split(/[,;\t]/).map((p) => p.trim());
      const name = parts[0];
      if (!name || ['الاسم', 'اسم الطالب'].includes(name)) return;
      created.push({
        id: uid('stu'),
        name,
        number: parts[1] || String(db.students.length + created.length + 101),
        sectionId: ctx.sectionId,
        pin: generatePin(),
        phone: parts[2] || '',
      });
    });
    if (!created.length) {
      onNotify('لم يتم العثور على أسماء صالحة للاستيراد');
      return;
    }
    onBulkAddStudents(created);
    setBulkText('');
    setBulkOpen(false);
    onNotify(`تم استيراد ${created.length} طالب بنجاح`);
  };

  const handleExportExcel = () => {
    const rows: (string | number)[][] = [
      ['الرقم', 'الاسم', 'الصف', 'الشعبة', 'رمز PIN', 'واتساب', 'المعدل', 'التقييم'],
    ];
    scopedStudents.forEach((s) => {
      const ev = evaluateStudentOverall(db, s);
      rows.push([
        s.number,
        s.name,
        ev.grd ? ev.grd.name : '',
        ev.sec ? ev.sec.name : '',
        s.pin,
        s.phone || '',
        ev.avg ?? '',
        ev.overallStatus,
      ]);
    });
    exportExcelWorkbook('قائمة_الطلبة', rows);
    onNotify('تم تصدير قائمة الطلبة بصيغة Excel');
  };

  return (
    <div className="space-y-5">
      {/* Quick Section Management Strip */}
      {session.role === 'admin' && (
        <section className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                إدارة شعب الصف الحالي (إضافة وحذف سريع)
              </h3>
              <div className="mt-1.5 flex flex-wrap items-center gap-2">
                {gradeSections.map((sec) => {
                  const cnt = db.students.filter((st) => st.sectionId === sec.id).length;
                  return (
                    <div
                      key={sec.id}
                      className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs dark:border-slate-700 dark:bg-slate-800"
                    >
                      <span className="font-bold text-slate-800 dark:text-slate-200">
                        شعبة {sec.name} ({cnt})
                      </span>
                      <button
                        type="button"
                        aria-label={`حذف شعبة ${sec.name}`}
                        onClick={() => {
                          if (window.confirm(`حذف شعبة "${sec.name}" وطلبتها؟`)) {
                            onDeleteSection(sec.id);
                            onNotify(`تم حذف شعبة ${sec.name}`);
                          }
                        }}
                        className="cursor-pointer text-red-600 hover:text-red-500"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <input
                aria-label="اسم الشعبة الجديدة"
                value={newSectionName}
                onChange={(e) => setNewSectionName(e.target.value)}
                placeholder="اسم شعبة جديدة (ج، د...)"
                className="w-44 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-800"
              />
              <button
                type="button"
                onClick={() => {
                  if (!ctx.gradeId || !newSectionName.trim()) return;
                  onAddSection(ctx.gradeId, newSectionName.trim());
                  setNewSectionName('');
                }}
                className="inline-flex cursor-pointer items-center gap-1 rounded-lg bg-emerald-800 px-3 py-1.5 text-xs font-bold text-white whitespace-nowrap hover:bg-emerald-700"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>إضافة شعبة</span>
              </button>
            </div>
          </div>
        </section>
      )}

      <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
              قائمة الطلبة (مرتبة أبجدياً)
            </h3>
            <p className="text-xs text-slate-500 tabular-nums dark:text-slate-400">
              العدد المعروض: {sorted.length} طالب
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={openAdd}
              className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-emerald-800 px-3.5 py-2 text-xs font-bold text-white whitespace-nowrap hover:bg-emerald-700 dark:bg-emerald-600"
            >
              <UserPlus className="h-4 w-4" />
              <span>إضافة طالب</span>
            </button>
            <button
              type="button"
              onClick={() => setBulkOpen(true)}
              className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700 whitespace-nowrap hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
            >
              <Upload className="h-4 w-4" />
              <span>استيراد Excel / قائمة</span>
            </button>
            <button
              type="button"
              onClick={handleExportExcel}
              className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700 whitespace-nowrap hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
            >
              <Download className="h-4 w-4" />
              <span>تصدير Excel</span>
            </button>
          </div>
        </div>

        <div className="relative mb-4">
          <Search className="pointer-events-none absolute top-2.5 right-3 h-4 w-4 text-slate-400" />
          <input
            type="search"
            aria-label="بحث عن طالب"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="ابحث بالاسم أو الرقم المدرسي أو رمز PIN..."
            className="w-full rounded-lg border border-slate-200 bg-slate-50 py-2 pr-9 pl-3 text-sm text-slate-900 focus:border-emerald-700 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
          />
        </div>

        <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-800">
          <table className="w-full min-w-[820px] border-collapse text-right text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-xs text-slate-600 dark:border-slate-800 dark:bg-slate-800/70 dark:text-slate-300">
                <th className="px-3 py-2.5 font-bold">ت</th>
                <th className="px-3 py-2.5 font-bold">الرقم</th>
                <th className="px-3 py-2.5 font-bold">اسم الطالب</th>
                <th className="px-3 py-2.5 font-bold">الصف والشعبة</th>
                <th className="px-3 py-2.5 font-bold">رمز PIN</th>
                <th className="px-3 py-2.5 font-bold">واتساب</th>
                <th className="px-3 py-2.5 font-bold">المعدل</th>
                <th className="px-3 py-2.5 font-bold">التقييم</th>
                <th className="px-3 py-2.5 font-bold">إجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
              {sorted.map((s, idx) => {
                const ev = evaluateStudentOverall(db, s);
                const waText = `مرحباً ولي أمر الطالب ${s.name} (${db.settings.schoolName})، المعدل الحالي: ${ev.avg ?? '—'}% — الحالة: ${ev.overallStatus}. رمز متابعة بوابة ولي الأمر: ${s.pin}`;
                return (
                  <tr key={s.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
                    <td className="px-3 py-2.5 tabular-nums text-slate-500">{idx + 1}</td>
                    <td className="px-3 py-2.5 tabular-nums text-slate-600 dark:text-slate-300">{s.number}</td>
                    <td className="px-3 py-2.5 font-bold text-slate-900 dark:text-slate-100">{s.name}</td>
                    <td className="px-3 py-2.5 text-slate-600 dark:text-slate-300">
                      {ev.grd ? ev.grd.name : ''} · شعبة {ev.sec ? ev.sec.name : ''}
                    </td>
                    <td className="px-3 py-2.5 font-mono text-xs text-slate-700 dark:text-slate-300">
                      {s.pin}
                    </td>
                    <td className="px-3 py-2.5 font-mono text-xs text-slate-600 dark:text-slate-400">
                      {s.phone || '—'}
                    </td>
                    <td className="px-3 py-2.5 font-bold tabular-nums text-slate-900 dark:text-slate-100">
                      {ev.avg !== null ? `${ev.avg}%` : '—'}
                    </td>
                    <td className="px-3 py-2.5">
                      <StatusBadge label={ev.overallStatus} tone={ev.tone} />
                    </td>
                    <td className="px-3 py-2.5 whitespace-nowrap">
                      <div className="flex items-center gap-1.5">
                        <a
                          href={buildWhatsAppUrl(s.phone, waText)}
                          target="_blank"
                          rel="noopener noreferrer"
                          aria-label={`واتساب ${s.name}`}
                          className="inline-flex items-center gap-1 rounded-md bg-emerald-600 px-2 py-1 text-xs font-semibold text-white hover:bg-emerald-500"
                        >
                          <MessageCircle className="h-3.5 w-3.5" />
                          <span>واتساب</span>
                        </a>
                        <button
                          type="button"
                          onClick={() => onViewStudentReport(s.id)}
                          aria-label={`تقرير ${s.name}`}
                          className="inline-flex cursor-pointer items-center gap-1 rounded-md border border-slate-200 px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                        >
                          <FileText className="h-3.5 w-3.5" />
                          <span>تقرير</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setFormError('');
                            setModalStudent({ ...s });
                          }}
                          aria-label={`تعديل ${s.name}`}
                          className="inline-flex cursor-pointer items-center gap-1 rounded-md border border-slate-200 px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                        >
                          <Edit3 className="h-3.5 w-3.5" />
                          <span>تعديل</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            if (window.confirm(`هل تريد حذف الطالب "${s.name}"؟`)) {
                              onDeleteStudent(s.id);
                              onNotify('تم حذف الطالب');
                            }
                          }}
                          aria-label={`حذف ${s.name}`}
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
              {!sorted.length && (
                <tr>
                  <td colSpan={9} className="px-4 py-8 text-center text-sm text-slate-500 dark:text-slate-400">
                    لا يوجد طلبة مطابقون للبحث أو الشعبة الحالية.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {modalStudent && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
            <form
              onSubmit={handleStudentSubmit}
              className="w-full max-w-lg rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900"
            >
              <h3 className="mb-4 text-base font-bold text-slate-900 dark:text-slate-100">
                {modalStudent.id ? 'تعديل بيانات الطالب / نقله لشعبة' : 'إضافة طالب جديد'}
              </h3>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <label htmlFor="stu-name" className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-400">
                    اسم الطالب الكامل
                  </label>
                  <input
                    id="stu-name"
                    value={modalStudent.name}
                    onChange={(e) => {
                      setModalStudent({ ...modalStudent, name: e.target.value });
                      if (formError) setFormError('');
                    }}
                    placeholder="مثال: مصطفى كاظم علي"
                    className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
                    autoFocus
                  />
                </div>
                <div>
                  <label htmlFor="stu-number" className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-400">
                    الرقم المدرسي
                  </label>
                  <input
                    id="stu-number"
                    value={modalStudent.number}
                    onChange={(e) => setModalStudent({ ...modalStudent, number: e.target.value })}
                    className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
                  />
                </div>
                <div>
                  <label htmlFor="stu-section" className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-400">
                    الصف والشعبة
                  </label>
                  <select
                    id="stu-section"
                    value={modalStudent.sectionId}
                    onChange={(e) => setModalStudent({ ...modalStudent, sectionId: e.target.value })}
                    className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
                  >
                    {db.sections.map((sec) => {
                      const g = db.grades.find((x) => x.id === sec.gradeId);
                      return (
                        <option key={sec.id} value={sec.id}>
                          {g ? g.name : ''} - شعبة {sec.name}
                        </option>
                      );
                    })}
                  </select>
                </div>
                <div>
                  <label htmlFor="stu-pin" className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-400">
                    رمز PIN لولي الأمر
                  </label>
                  <input
                    id="stu-pin"
                    value={modalStudent.pin}
                    onChange={(e) => setModalStudent({ ...modalStudent, pin: e.target.value })}
                    className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 font-mono text-sm dark:border-slate-700 dark:bg-slate-800"
                  />
                </div>
                <div>
                  <label htmlFor="stu-phone" className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-400">
                    واتساب ولي الأمر (0770... أو 964...)
                  </label>
                  <input
                    id="stu-phone"
                    value={modalStudent.phone}
                    onChange={(e) => setModalStudent({ ...modalStudent, phone: e.target.value })}
                    placeholder="0770..."
                    className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 font-mono text-sm dark:border-slate-700 dark:bg-slate-800"
                  />
                </div>
              </div>
              {formError && <p className="mt-2 text-xs font-semibold text-red-600">{formError}</p>}
              <div className="mt-5 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={closeStudentModal}
                  className="cursor-pointer rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="cursor-pointer rounded-lg bg-emerald-800 px-4 py-1.5 text-sm font-bold text-white hover:bg-emerald-700"
                >
                  حفظ الطالب
                </button>
              </div>
            </form>
          </div>
        )}

        {bulkOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
            <div className="w-full max-w-lg rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
              <h3 className="mb-2 text-base font-bold text-slate-900 dark:text-slate-100">
                استيراد طلبة من Excel (.xlsx / .csv) أو قائمة نصية
              </h3>
              <p className="mb-3 text-xs text-slate-500 dark:text-slate-400">
                العمود الأول: الاسم · العمود الثاني: الرقم (اختياري) · العمود الثالث: الهاتف (اختياري)
              </p>
              <div className="mb-3">
                <label className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-400">
                  رفع ملف Excel أو CSV
                </label>
                <input
                  type="file"
                  accept=".xlsx,.xls,.csv,.txt"
                  onChange={handleBulkFile}
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-800"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-400">
                  أو الصق الأسماء (سطر لكل طالب)
                </label>
                <textarea
                  rows={6}
                  value={bulkText}
                  onChange={(e) => setBulkText(e.target.value)}
                  placeholder={'أحمد علي حسن\nزهراء محمد كريم'}
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm dark:border-slate-700 dark:bg-slate-800"
                />
              </div>
              <div className="mt-4 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setBulkOpen(false)}
                  className="cursor-pointer rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300"
                >
                  إلغاء
                </button>
                <button
                  type="button"
                  onClick={handleBulkImport}
                  className="cursor-pointer rounded-lg bg-emerald-800 px-4 py-1.5 text-sm font-bold text-white hover:bg-emerald-700"
                >
                  استيراد إلى الشعبة الحالية
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
