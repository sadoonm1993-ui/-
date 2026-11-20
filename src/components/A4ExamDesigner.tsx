import { useEffect, useMemo, useState } from 'react';
import {
  BookOpenCheck,
  ChevronDown,
  ChevronUp,
  ClipboardCopy,
  FileCheck2,
  Plus,
  Printer,
  RotateCcw,
  Trash2,
} from 'lucide-react';
import type { AppDatabase } from '../types/gradebook';
import {
  buildA4ExamPromptText,
  computeTotalExamMarks,
  createReadyA4ExamPaper,
  getPrintFontCss,
  getQuestionTypeLabel,
  renderA4ExamHtml,
  type A4ExamPaper,
  type A4ExamQuestion,
  type A4ExamSection,
  type PrintFontChoice,
  type QuestionTypeKind,
} from '../utils/a4Exam';
import { uid } from '../utils/evaluation';

interface A4ExamDesignerProps {
  db: AppDatabase;
  subjectName: string;
  gradeName: string;
  sectionName: string;
  onPrintHtml: (html: string) => void;
  onNotify: (msg: string) => void;
}

const CHOICE_LETTERS = ['أ', 'ب', 'ج', 'د', 'هـ', 'و'];

function createBlankQuestion(type: QuestionTypeKind): A4ExamQuestion {
  const id = uid('q');
  if (type === 'mcq') {
    return {
      id,
      subtypeNote: 'إجابة مباشرة',
      prompt: 'اكتب نص سؤال الاختيار من متعدد هنا...',
      choices: ['الخيار الأول', 'الخيار الثاني', 'الخيار الثالث', 'الخيار الرابع'],
      modelAnswer: 'أ) الخيار الأول',
    };
  }
  if (type === 'true_false') {
    return {
      id,
      prompt: 'اكتب عبارة الصح أو الخطأ هنا...',
      requireCorrection: true,
      modelAnswer: '✓ عبارة صحيحة.',
    };
  }
  if (type === 'fill_blank') {
    return {
      id,
      prompt: 'أكمل العبارة الآتية: ............................ .',
      modelAnswer: 'الكلمة المطلوبة',
    };
  }
  if (type === 'compare') {
    return {
      id,
      prompt: 'قارن بين المفهومين الآتيين:',
      conceptA: 'المفهوم الأول',
      conceptB: 'المفهوم الثاني',
      comparisonPoints: ['التعريف / الوظيفة', 'التركيب / المثال'],
      linesCount: 3,
      modelAnswer: 'ملخص أوجه الاختلاف والتشابه بين المفهومين.',
    };
  }
  return {
    id,
    prompt: 'علّل أو فسّر علمياً ما يأتي:',
    linesCount: 2,
    modelAnswer: 'الإجابة العلمية المختصرة.',
  };
}

export function A4ExamDesigner({
  db,
  subjectName,
  gradeName,
  sectionName,
  onPrintHtml,
  onNotify,
}: A4ExamDesignerProps) {
  const [paper, setPaper] = useState<A4ExamPaper>(() =>
    createReadyA4ExamPaper({
      directorate: db.settings.directorate,
      schoolName: db.settings.schoolName,
      academicYear: db.settings.academicYear,
      subjectName,
      gradeName,
      sectionName,
      teacherName: db.settings.teacherName,
    })
  );

  const [expandedSectionId, setExpandedSectionId] = useState<string>('sec_mcq');
  const [previewTab, setPreviewTab] = useState<'student' | 'key' | 'prompt'>('student');
  const [headerExpanded, setHeaderExpanded] = useState<boolean>(true);

  // Keep academic metadata synced when user changes context selectors cleanly
  useEffect(() => {
    const gradeLabel = [gradeName, sectionName].filter(Boolean).join(' — ');
    setPaper((prev) => ({
      ...prev,
      subjectName: subjectName || prev.subjectName,
      examTitle: `اختبار مادة ${subjectName || prev.subjectName}`,
      gradeAndSection: gradeLabel || prev.gradeAndSection,
      directorate: db.settings.directorate,
      schoolName: db.settings.schoolName,
      teacherName: db.settings.teacherName,
      academicYear: db.settings.academicYear,
    }));
  }, [
    subjectName,
    gradeName,
    sectionName,
    db.settings.directorate,
    db.settings.schoolName,
    db.settings.teacherName,
    db.settings.academicYear,
  ]);

  const totalSectionMarks = useMemo(() => computeTotalExamMarks(paper.sections), [paper.sections]);
  const promptText = useMemo(() => buildA4ExamPromptText(paper), [paper]);
  const previewFontCss = getPrintFontCss(paper.fontChoice);

  const handleResetTemplate = () => {
    const fresh = createReadyA4ExamPaper({
      directorate: db.settings.directorate,
      schoolName: db.settings.schoolName,
      academicYear: db.settings.academicYear,
      subjectName,
      gradeName,
      sectionName,
      teacherName: db.settings.teacherName,
    });
    setPaper(fresh);
    setExpandedSectionId(fresh.sections[0]?.id || '');
    onNotify('تم تحميل النموذج الجاهز المتنوع للطباعة على A4');
  };

  const handleCopyPrompt = async () => {
    try {
      await navigator.clipboard.writeText(promptText);
      onNotify('تم نسخ الأمر المنسّق الجاهز إلى الحافظة');
    } catch {
      setPreviewTab('prompt');
      onNotify('يمكنك نسخ الأمر مباشرة من تبويب «الأمر الجاهز»');
    }
  };

  const handleAddSection = (type: QuestionTypeKind) => {
    const defaultTitles: Record<QuestionTypeKind, string> = {
      mcq: 'اختر الإجابة الصحيحة مما يأتي:',
      true_false: 'ضع علامة (✓) أو (✗) مع تصحيح الخطأ إن وُجد:',
      fill_blank: 'أكمل الفراغات الآتية بما يناسبها:',
      explain: 'علّل أو فسّر علمياً كلّاً مما يأتي:',
      compare: 'قارن بين المفهومين الآتيين:',
    };
    const nextSec: A4ExamSection = {
      id: uid('sec'),
      title: defaultTitles[type],
      type,
      marks: 10,
      questions: [createBlankQuestion(type)],
    };
    setPaper((prev) => ({ ...prev, sections: [...prev.sections, nextSec] }));
    setExpandedSectionId(nextSec.id);
  };

  const updateSection = (secId: string, updater: (sec: A4ExamSection) => A4ExamSection) => {
    setPaper((prev) => ({
      ...prev,
      sections: prev.sections.map((s) => (s.id === secId ? updater(s) : s)),
    }));
  };

  const deleteSection = (secId: string) => {
    setPaper((prev) => ({
      ...prev,
      sections: prev.sections.filter((s) => s.id !== secId),
    }));
  };

  return (
    <div className="space-y-4">
      {/* Top Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
        <div>
          <h3 className="text-base font-extrabold text-slate-900 dark:text-slate-100">
            منظومة صياغة وطباعة الأسئلة الرسمية (A4)
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            نموذج جاهز للطباعة مع تنويع الأسئلة، قاعدة مساحات الإجابة، اختيار الخط العربي، وفصل مفتاح الإجابات النموذجية.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleResetTemplate}
            className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-bold text-slate-700 whitespace-nowrap hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            <span>نموذج جاهز متكامل</span>
          </button>
          <button
            type="button"
            onClick={handleCopyPrompt}
            className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-sky-200 bg-sky-50 px-3 py-1.5 text-xs font-bold text-sky-800 whitespace-nowrap hover:bg-sky-100 dark:border-sky-800 dark:bg-sky-950/60 dark:text-sky-300"
          >
            <ClipboardCopy className="h-3.5 w-3.5" />
            <span>نسخ الأمر الجاهز (Prompt)</span>
          </button>
          <button
            type="button"
            onClick={() => onPrintHtml(renderA4ExamHtml(paper, { scope: 'student_only' }))}
            className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-emerald-800 px-3.5 py-1.5 text-xs font-bold text-white whitespace-nowrap hover:bg-emerald-700 dark:bg-emerald-600"
          >
            <Printer className="h-3.5 w-3.5" />
            <span>طباعة نسخة الطالب A4</span>
          </button>
          <button
            type="button"
            onClick={() => onPrintHtml(renderA4ExamHtml(paper, { scope: 'student_and_key' }))}
            className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-slate-900 px-3.5 py-1.5 text-xs font-bold text-white whitespace-nowrap hover:bg-slate-800 dark:bg-slate-700"
          >
            <BookOpenCheck className="h-3.5 w-3.5" />
            <span>طباعة + مفتاح الإجابات</span>
          </button>
        </div>
      </div>

      {/* Rules Bar: Answer Placement Rule + Print Typography */}
      <div className="grid grid-cols-1 gap-4 rounded-xl border border-slate-200 bg-white p-4 lg:grid-cols-12 dark:border-slate-800 dark:bg-slate-900">
        <div className="lg:col-span-7">
          <div className="mb-1.5 text-xs font-extrabold text-slate-800 dark:text-slate-200">
            قاعدة مساحات الإجابة على ورقة A4
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => setPaper((p) => ({ ...p, answerPlacement: 'on_paper' }))}
              className={`cursor-pointer rounded-lg border px-3 py-2 text-right transition-colors ${
                paper.answerPlacement === 'on_paper'
                  ? 'border-emerald-700 bg-emerald-50 text-emerald-900 dark:border-emerald-500 dark:bg-emerald-950/40 dark:text-emerald-200'
                  : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300'
              }`}
            >
              <div className="text-xs font-extrabold">الإجابة ضمن ورقة الأسئلة</div>
              <div className="mt-0.5 text-[11px] opacity-85">
                ترك أسطر منقطة، مربعات تصحيح، وجدول مقارنة مفرغ
              </div>
            </button>
            <button
              type="button"
              onClick={() => setPaper((p) => ({ ...p, answerPlacement: 'exam_booklet' }))}
              className={`cursor-pointer rounded-lg border px-3 py-2 text-right transition-colors ${
                paper.answerPlacement === 'exam_booklet'
                  ? 'border-emerald-700 bg-emerald-50 text-emerald-900 dark:border-emerald-500 dark:bg-emerald-950/40 dark:text-emerald-200'
                  : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300'
              }`}
            >
              <div className="text-xs font-extrabold">الإجابة في دفتر الامتحان (مضغوط)</div>
              <div className="mt-0.5 text-[11px] opacity-85">
                بدون فراغات كتابة — مسافة فاصلة مرتبة لتوفير الورق
              </div>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 lg:col-span-5">
          <div>
            <label
              htmlFor="a4-font-choice"
              className="mb-1.5 block text-xs font-extrabold text-slate-800 dark:text-slate-200"
            >
              خط الطباعة العربي
            </label>
            <select
              id="a4-font-choice"
              value={paper.fontChoice}
              onChange={(e) =>
                setPaper((p) => ({ ...p, fontChoice: e.target.value as PrintFontChoice }))
              }
              className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold dark:border-slate-700 dark:bg-slate-800"
            >
              <option value="amiri">Amiri (خط أميري الرسمي)</option>
              <option value="cairo">Cairo (القاهرة الحديث)</option>
              <option value="traditional">Traditional Arabic</option>
              <option value="sakkal">Sakkal Majalla</option>
            </select>
          </div>

          <div>
            <label
              htmlFor="a4-font-size"
              className="mb-1.5 block text-xs font-extrabold text-slate-800 dark:text-slate-200"
            >
              حجم الخط والسطر
            </label>
            <select
              id="a4-font-size"
              value={paper.fontSizePx}
              onChange={(e) =>
                setPaper((p) => ({ ...p, fontSizePx: Number(e.target.value) || 15 }))
              }
              className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold tabular-nums dark:border-slate-700 dark:bg-slate-800"
            >
              <option value={13}>13px (مكثف)</option>
              <option value={15}>15px (قياسي A4)</option>
              <option value={17}>17px (كبير ومريح)</option>
            </select>
          </div>
        </div>
      </div>

      {/* Main Split Workspace: Editor (Right) + Live A4 Preview (Left) */}
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-12">
        {/* RIGHT: Header & Structured Sections Editor */}
        <div className="space-y-4 xl:col-span-5">
          {/* Header Metadata Card */}
          <section className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
            <button
              type="button"
              onClick={() => setHeaderExpanded((v) => !v)}
              className="flex w-full cursor-pointer items-center justify-between text-right"
            >
              <span className="text-sm font-extrabold text-slate-900 dark:text-slate-100">
                ترويسة الورقة وبياناتها الرسمية
              </span>
              {headerExpanded ? (
                <ChevronUp className="h-4 w-4 text-slate-500" />
              ) : (
                <ChevronDown className="h-4 w-4 text-slate-500" />
              )}
            </button>

            {headerExpanded && (
              <div className="mt-3 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-[11px] font-bold text-slate-500">المدرسة</label>
                  <input
                    value={paper.schoolName}
                    onChange={(e) => setPaper((p) => ({ ...p, schoolName: e.target.value }))}
                    className="w-full rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs font-semibold dark:border-slate-700 dark:bg-slate-800"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[11px] font-bold text-slate-500">المديرية</label>
                  <input
                    value={paper.directorate}
                    onChange={(e) => setPaper((p) => ({ ...p, directorate: e.target.value }))}
                    className="w-full rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs font-semibold dark:border-slate-700 dark:bg-slate-800"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[11px] font-bold text-slate-500">عنوان الاختبار</label>
                  <input
                    value={paper.examTitle}
                    onChange={(e) => setPaper((p) => ({ ...p, examTitle: e.target.value }))}
                    className="w-full rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs font-semibold dark:border-slate-700 dark:bg-slate-800"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[11px] font-bold text-slate-500">
                    الموضوع / الفصل
                  </label>
                  <input
                    value={paper.topic}
                    onChange={(e) => setPaper((p) => ({ ...p, topic: e.target.value }))}
                    className="w-full rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs font-semibold dark:border-slate-700 dark:bg-slate-800"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[11px] font-bold text-slate-500">المادة</label>
                  <input
                    value={paper.subjectName}
                    onChange={(e) => setPaper((p) => ({ ...p, subjectName: e.target.value }))}
                    className="w-full rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs font-semibold dark:border-slate-700 dark:bg-slate-800"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[11px] font-bold text-slate-500">
                    الصف والشعبة
                  </label>
                  <input
                    value={paper.gradeAndSection}
                    onChange={(e) => setPaper((p) => ({ ...p, gradeAndSection: e.target.value }))}
                    className="w-full rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs font-semibold dark:border-slate-700 dark:bg-slate-800"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[11px] font-bold text-slate-500">التاريخ</label>
                  <input
                    value={paper.examDate}
                    onChange={(e) => setPaper((p) => ({ ...p, examDate: e.target.value }))}
                    className="w-full rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs font-semibold tabular-nums dark:border-slate-700 dark:bg-slate-800"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[11px] font-bold text-slate-500">المدة الزمنية</label>
                  <input
                    value={paper.duration}
                    onChange={(e) => setPaper((p) => ({ ...p, duration: e.target.value }))}
                    className="w-full rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs font-semibold dark:border-slate-700 dark:bg-slate-800"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[11px] font-bold text-slate-500">مدرس المادة</label>
                  <input
                    value={paper.teacherName}
                    onChange={(e) => setPaper((p) => ({ ...p, teacherName: e.target.value }))}
                    className="w-full rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs font-semibold dark:border-slate-700 dark:bg-slate-800"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[11px] font-bold text-slate-500">
                    الدرجة الكلية (مجموع الأقسام: {totalSectionMarks})
                  </label>
                  <input
                    value={paper.maxMarkLabel}
                    onChange={(e) => setPaper((p) => ({ ...p, maxMarkLabel: e.target.value }))}
                    className="w-full rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs font-semibold dark:border-slate-700 dark:bg-slate-800"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="mb-1 block text-[11px] font-bold text-slate-500">
                    توجيهات عامة
                  </label>
                  <input
                    value={paper.generalNotes}
                    onChange={(e) => setPaper((p) => ({ ...p, generalNotes: e.target.value }))}
                    className="w-full rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-800"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="inline-flex cursor-pointer items-center gap-2 text-xs font-semibold text-slate-700 dark:text-slate-300">
                    <input
                      type="checkbox"
                      checked={paper.showStudentBar}
                      onChange={(e) =>
                        setPaper((p) => ({ ...p, showStudentBar: e.target.checked }))
                      }
                      className="h-4 w-4 accent-emerald-700"
                    />
                    <span>إظهار حقل اسم الطالب والرقم الامتحاني / الشعبة أعلى الورقة</span>
                  </label>
                </div>
              </div>
            )}
          </section>

          {/* Sections & Questions Editor */}
          <section className="space-y-3 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h4 className="text-sm font-extrabold text-slate-900 dark:text-slate-100">
                أقسام الأسئلة ({paper.sections.length}) · المجموع: {totalSectionMarks} درجة
              </h4>
            </div>

            <div className="flex flex-wrap gap-1.5">
              {(
                ['mcq', 'true_false', 'fill_blank', 'explain', 'compare'] as QuestionTypeKind[]
              ).map((kind) => (
                <button
                  key={kind}
                  type="button"
                  onClick={() => handleAddSection(kind)}
                  className="inline-flex cursor-pointer items-center gap-1 rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-[11px] font-bold text-slate-700 hover:border-emerald-600 hover:text-emerald-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                >
                  <Plus className="h-3 w-3" />
                  <span>{getQuestionTypeLabel(kind)}</span>
                </button>
              ))}
            </div>

            <div className="space-y-2.5">
              {paper.sections.map((sec, sIdx) => {
                const isOpen = expandedSectionId === sec.id;
                return (
                  <div
                    key={sec.id}
                    className="rounded-xl border border-slate-200 bg-slate-50/70 dark:border-slate-800 dark:bg-slate-800/40"
                  >
                    <div className="flex items-center justify-between gap-2 px-3 py-2.5">
                      <button
                        type="button"
                        onClick={() => setExpandedSectionId(isOpen ? '' : sec.id)}
                        className="flex min-w-0 flex-1 cursor-pointer items-center gap-2 text-right"
                      >
                        <span className="shrink-0 rounded bg-emerald-800 px-1.5 py-0.5 text-[11px] font-extrabold text-white">
                          س{sIdx + 1}
                        </span>
                        <span className="truncate text-xs font-bold text-slate-900 dark:text-slate-100">
                          {sec.title}
                        </span>
                      </button>
                      <div className="flex shrink-0 items-center gap-1.5">
                        <span className="text-[11px] font-bold text-slate-500 tabular-nums">
                          ({sec.marks} د)
                        </span>
                        <button
                          type="button"
                          aria-label={`حذف س${sIdx + 1}`}
                          onClick={() => deleteSection(sec.id)}
                          className="cursor-pointer rounded p-1 text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>

                    {isOpen && (
                      <div className="space-y-3 border-t border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
                        <div className="grid grid-cols-1 gap-2 sm:grid-cols-12">
                          <div className="sm:col-span-9">
                            <label className="mb-0.5 block text-[11px] font-bold text-slate-500">
                              عنوان القسم ({getQuestionTypeLabel(sec.type)})
                            </label>
                            <input
                              value={sec.title}
                              onChange={(e) =>
                                updateSection(sec.id, (cur) => ({ ...cur, title: e.target.value }))
                              }
                              className="w-full rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs font-semibold dark:border-slate-700 dark:bg-slate-800"
                            />
                          </div>
                          <div className="sm:col-span-3">
                            <label className="mb-0.5 block text-[11px] font-bold text-slate-500">
                              الدرجة
                            </label>
                            <input
                              type="number"
                              min={1}
                              value={sec.marks}
                              onChange={(e) =>
                                updateSection(sec.id, (cur) => ({
                                  ...cur,
                                  marks: Math.max(1, Number(e.target.value) || 1),
                                }))
                              }
                              className="w-full rounded-md border border-slate-200 bg-slate-50 px-2 py-1.5 text-center text-xs font-bold tabular-nums dark:border-slate-700 dark:bg-slate-800"
                            />
                          </div>
                        </div>

                        <div className="space-y-2.5">
                          {sec.questions.map((q, qIdx) => (
                            <div
                              key={q.id}
                              className="space-y-2 rounded-lg border border-slate-200 bg-slate-50/70 p-2.5 dark:border-slate-700 dark:bg-slate-800/50"
                            >
                              <div className="flex items-center justify-between gap-2">
                                <span className="text-[11px] font-extrabold text-emerald-800 dark:text-emerald-400">
                                  فرع ({qIdx + 1}) {q.subtypeNote ? `· ${q.subtypeNote}` : ''}
                                </span>
                                <button
                                  type="button"
                                  aria-label={`حذف الفرع ${qIdx + 1}`}
                                  onClick={() =>
                                    updateSection(sec.id, (cur) => ({
                                      ...cur,
                                      questions: cur.questions.filter((x) => x.id !== q.id),
                                    }))
                                  }
                                  className="cursor-pointer text-[11px] font-bold text-red-600 hover:underline"
                                >
                                  حذف
                                </button>
                              </div>

                              <textarea
                                rows={2}
                                value={q.prompt}
                                onChange={(e) =>
                                  updateSection(sec.id, (cur) => ({
                                    ...cur,
                                    questions: cur.questions.map((x) =>
                                      x.id === q.id ? { ...x, prompt: e.target.value } : x
                                    ),
                                  }))
                                }
                                className="w-full rounded-md border border-slate-200 bg-white p-2 text-xs dark:border-slate-700 dark:bg-slate-900"
                              />

                              {sec.type === 'mcq' && q.choices && (
                                <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                                  {q.choices.map((ch, cIdx) => (
                                    <input
                                      key={cIdx}
                                      value={ch}
                                      onChange={(e) => {
                                        const nextChoices = [...q.choices!];
                                        nextChoices[cIdx] = e.target.value;
                                        updateSection(sec.id, (cur) => ({
                                          ...cur,
                                          questions: cur.questions.map((x) =>
                                            x.id === q.id ? { ...x, choices: nextChoices } : x
                                          ),
                                        }));
                                      }}
                                      className="rounded-md border border-slate-200 bg-white px-2 py-1 text-xs dark:border-slate-700 dark:bg-slate-900"
                                    />
                                  ))}
                                </div>
                              )}

                              {sec.type === 'true_false' && (
                                <label className="inline-flex cursor-pointer items-center gap-1.5 text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                                  <input
                                    type="checkbox"
                                    checked={Boolean(q.requireCorrection)}
                                    onChange={(e) =>
                                      updateSection(sec.id, (cur) => ({
                                        ...cur,
                                        questions: cur.questions.map((x) =>
                                          x.id === q.id
                                            ? { ...x, requireCorrection: e.target.checked }
                                            : x
                                        ),
                                      }))
                                    }
                                    className="h-3.5 w-3.5 accent-emerald-700"
                                  />
                                  <span>تضمين سطر تصحيح الخطأ في وضع الإجابة على الورقة</span>
                                </label>
                              )}

                              {sec.type === 'explain' && (
                                <div className="flex items-center gap-2 text-[11px]">
                                  <span className="font-bold text-slate-500">عدد أسطر الإجابة:</span>
                                  <input
                                    type="number"
                                    min={1}
                                    max={6}
                                    value={q.linesCount || 2}
                                    onChange={(e) =>
                                      updateSection(sec.id, (cur) => ({
                                        ...cur,
                                        questions: cur.questions.map((x) =>
                                          x.id === q.id
                                            ? {
                                                ...x,
                                                linesCount: Math.min(
                                                  6,
                                                  Math.max(1, Number(e.target.value) || 2)
                                                ),
                                              }
                                            : x
                                        ),
                                      }))
                                    }
                                    className="w-14 rounded border border-slate-200 bg-white px-2 py-0.5 text-center font-bold tabular-nums dark:border-slate-700 dark:bg-slate-900"
                                  />
                                </div>
                              )}

                              {sec.type === 'compare' && (
                                <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                                  <input
                                    value={q.conceptA || ''}
                                    placeholder="المفهوم الأول (للجدول)"
                                    onChange={(e) =>
                                      updateSection(sec.id, (cur) => ({
                                        ...cur,
                                        questions: cur.questions.map((x) =>
                                          x.id === q.id ? { ...x, conceptA: e.target.value } : x
                                        ),
                                      }))
                                    }
                                    className="rounded-md border border-slate-200 bg-white px-2 py-1 text-xs dark:border-slate-700 dark:bg-slate-900"
                                  />
                                  <input
                                    value={q.conceptB || ''}
                                    placeholder="المفهوم الثاني (للجدول)"
                                    onChange={(e) =>
                                      updateSection(sec.id, (cur) => ({
                                        ...cur,
                                        questions: cur.questions.map((x) =>
                                          x.id === q.id ? { ...x, conceptB: e.target.value } : x
                                        ),
                                      }))
                                    }
                                    className="rounded-md border border-slate-200 bg-white px-2 py-1 text-xs dark:border-slate-700 dark:bg-slate-900"
                                  />
                                  <input
                                    value={(q.comparisonPoints || []).join('، ')}
                                    placeholder="أوجه المقارنة مفصولة بفاصلة"
                                    onChange={(e) =>
                                      updateSection(sec.id, (cur) => ({
                                        ...cur,
                                        questions: cur.questions.map((x) =>
                                          x.id === q.id
                                            ? {
                                                ...x,
                                                comparisonPoints: e.target.value
                                                  .split(/[،,]/)
                                                  .map((t) => t.trim())
                                                  .filter(Boolean),
                                              }
                                            : x
                                        ),
                                      }))
                                    }
                                    className="sm:col-span-2 rounded-md border border-slate-200 bg-white px-2 py-1 text-xs dark:border-slate-700 dark:bg-slate-900"
                                  />
                                </div>
                              )}

                              <div>
                                <label className="mb-0.5 block text-[11px] font-bold text-emerald-700 dark:text-emerald-400">
                                  الإجابة النموذجية (تظهر في مفتاح الإجابات المنفصل فقط)
                                </label>
                                <input
                                  value={q.modelAnswer}
                                  onChange={(e) =>
                                    updateSection(sec.id, (cur) => ({
                                      ...cur,
                                      questions: cur.questions.map((x) =>
                                        x.id === q.id ? { ...x, modelAnswer: e.target.value } : x
                                      ),
                                    }))
                                  }
                                  className="w-full rounded-md border border-emerald-200 bg-white px-2.5 py-1 text-xs font-semibold dark:border-emerald-800 dark:bg-slate-900"
                                />
                              </div>
                            </div>
                          ))}
                        </div>

                        <button
                          type="button"
                          onClick={() =>
                            updateSection(sec.id, (cur) => ({
                              ...cur,
                              questions: [...cur.questions, createBlankQuestion(cur.type)],
                            }))
                          }
                          className="inline-flex cursor-pointer items-center gap-1 rounded-md border border-dashed border-emerald-600 px-2.5 py-1 text-xs font-bold text-emerald-800 hover:bg-emerald-50 dark:text-emerald-400 dark:hover:bg-emerald-950/30"
                        >
                          <Plus className="h-3.5 w-3.5" />
                          <span>إضافة فرع لهذا السؤال</span>
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        </div>

        {/* LEFT: Live A4 Paper Sheet Preview + Separate Key + Copyable Prompt */}
        <div className="space-y-3 xl:col-span-7">
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white p-2.5 dark:border-slate-800 dark:bg-slate-900">
            <div className="flex flex-wrap gap-1 rounded-lg bg-slate-100 p-1 dark:bg-slate-800">
              <button
                type="button"
                onClick={() => setPreviewTab('student')}
                className={`cursor-pointer rounded-md px-3 py-1.5 text-xs font-bold transition-colors ${
                  previewTab === 'student'
                    ? 'bg-white text-emerald-800 shadow-sm dark:bg-slate-900 dark:text-emerald-400'
                    : 'text-slate-600 dark:text-slate-300'
                }`}
              >
                معاينة ورقة الطالب (A4)
              </button>
              <button
                type="button"
                onClick={() => setPreviewTab('key')}
                className={`cursor-pointer rounded-md px-3 py-1.5 text-xs font-bold transition-colors ${
                  previewTab === 'key'
                    ? 'bg-white text-emerald-800 shadow-sm dark:bg-slate-900 dark:text-emerald-400'
                    : 'text-slate-600 dark:text-slate-300'
                }`}
              >
                مفتاح الإجابات النموذجية (منفصل)
              </button>
              <button
                type="button"
                onClick={() => setPreviewTab('prompt')}
                className={`cursor-pointer rounded-md px-3 py-1.5 text-xs font-bold transition-colors ${
                  previewTab === 'prompt'
                    ? 'bg-white text-emerald-800 shadow-sm dark:bg-slate-900 dark:text-emerald-400'
                    : 'text-slate-600 dark:text-slate-300'
                }`}
              >
                الأمر الجاهز (Prompt)
              </button>
            </div>

            {previewTab === 'key' && (
              <button
                type="button"
                onClick={() => onPrintHtml(renderA4ExamHtml(paper, { scope: 'key_only' }))}
                className="inline-flex cursor-pointer items-center gap-1 rounded-lg border border-emerald-700 px-2.5 py-1 text-xs font-bold text-emerald-800 hover:bg-emerald-50 dark:text-emerald-400"
              >
                <Printer className="h-3.5 w-3.5" />
                <span>طباعة المفتاح فقط</span>
              </button>
            )}
          </div>

          {previewTab === 'student' && (
            <div
              data-testid="a4-student-preview"
              data-answer-placement={paper.answerPlacement}
              style={{ fontFamily: previewFontCss, fontSize: `${paper.fontSizePx}px` }}
              className="rounded-xl border border-slate-300 bg-white p-5 text-slate-900 shadow-sm sm:p-7"
            >
              {/* Official A4 Header */}
              <div className="mb-4 rounded-md border-2 border-slate-900 px-3.5 py-2.5">
                <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2 border-b border-slate-700 pb-1.5 text-sm font-extrabold">
                  <span>{paper.ministry}</span>
                  <span className="font-bold">{paper.directorate}</span>
                  <span>{paper.schoolName}</span>
                </div>
                <div className="my-1.5 text-center">
                  <div className="text-lg font-extrabold text-slate-950">{paper.examTitle}</div>
                  {paper.topic && (
                    <div className="text-sm font-bold text-slate-700">الموضوع: {paper.topic}</div>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-1.5 border-t border-dashed border-slate-400 pt-1.5 text-xs font-bold sm:grid-cols-4">
                  <div>المادة: {paper.subjectName}</div>
                  <div>الصف: {paper.gradeAndSection}</div>
                  <div className="tabular-nums">التاريخ: {paper.examDate}</div>
                  <div>
                    المدة: {paper.duration} · {paper.maxMarkLabel}
                  </div>
                </div>
                {paper.showStudentBar && (
                  <div className="mt-2 flex flex-wrap justify-between gap-2 border-t border-slate-300 pt-1.5 text-xs font-bold">
                    <span>اسم الطالب: .................................................</span>
                    <span>الرقم الامتحاني / الشعبة: .........................</span>
                  </div>
                )}
                {paper.generalNotes && (
                  <div className="mt-1.5 text-[11px] font-semibold text-slate-600">
                    {paper.generalNotes}
                  </div>
                )}
              </div>

              {/* Exam Sections */}
              <div className={paper.answerPlacement === 'exam_booklet' ? 'space-y-3' : 'space-y-4'}>
                {paper.sections.map((sec, sIdx) => (
                  <div key={sec.id}>
                    <div className="mb-2 flex items-baseline justify-between gap-2 border-b border-slate-900 pb-1">
                      <h4 className="font-extrabold text-slate-950">
                        س{sIdx + 1}: {sec.title}
                      </h4>
                      <span className="shrink-0 rounded border border-slate-700 px-2 py-0.5 text-xs font-extrabold tabular-nums">
                        ({sec.marks} درجة)
                      </span>
                    </div>

                    <div
                      className={
                        paper.answerPlacement === 'exam_booklet'
                          ? 'space-y-1.5 pr-2'
                          : 'space-y-3 pr-2'
                      }
                    >
                      {sec.questions.map((q, qIdx) => (
                        <div key={q.id} className="a4-no-break">
                          {sec.type === 'mcq' && (
                            <div>
                              <div className="font-semibold">
                                <strong>{qIdx + 1}-</strong> {q.prompt}
                              </div>
                              <div className="mt-1 grid grid-cols-1 gap-x-4 gap-y-1 pr-4 sm:grid-cols-2">
                                {(q.choices || []).map((ch, cIdx) => (
                                  <div key={cIdx} className="flex items-center gap-1.5">
                                    {paper.answerPlacement === 'on_paper' && (
                                      <span
                                        aria-hidden="true"
                                        className="inline-block h-3 w-3 shrink-0 rounded-full border border-slate-700"
                                      />
                                    )}
                                    <span>
                                      <strong>{CHOICE_LETTERS[cIdx] || cIdx + 1})</strong> {ch}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {sec.type === 'true_false' && (
                            <div>
                              <div className="flex items-baseline justify-between gap-3">
                                <div>
                                  <strong>{qIdx + 1}-</strong> {q.prompt}
                                </div>
                                {paper.answerPlacement === 'on_paper' && (
                                  <span className="shrink-0 font-bold whitespace-nowrap text-slate-700">
                                    [ &nbsp;&nbsp;&nbsp; ]
                                  </span>
                                )}
                              </div>
                              {paper.answerPlacement === 'on_paper' && q.requireCorrection && (
                                <div className="mt-1 flex items-end gap-2 pr-4">
                                  <span className="text-xs font-bold whitespace-nowrap text-slate-600">
                                    التصحيح / السبب:
                                  </span>
                                  <span className="h-4 flex-1 border-b border-dotted border-slate-500" />
                                </div>
                              )}
                            </div>
                          )}

                          {sec.type === 'fill_blank' && (
                            <div>
                              <strong>{qIdx + 1}-</strong> {q.prompt}
                              {paper.answerPlacement === 'on_paper' && !q.prompt.includes('...') && (
                                <div className="mt-1 h-5 border-b border-dotted border-slate-500" />
                              )}
                            </div>
                          )}

                          {sec.type === 'explain' && (
                            <div>
                              <div>
                                <strong>{qIdx + 1}-</strong> {q.prompt}
                              </div>
                              {paper.answerPlacement === 'on_paper' &&
                                Array.from({ length: q.linesCount || 2 }).map((_, li) => (
                                  <div
                                    key={li}
                                    data-testid="dotted-answer-line"
                                    className="mt-1.5 h-5 border-b border-dotted border-slate-500"
                                  />
                                ))}
                            </div>
                          )}

                          {sec.type === 'compare' && (
                            <div>
                              <div className="font-semibold">
                                <strong>{qIdx + 1}-</strong> {q.prompt}
                              </div>
                              {paper.answerPlacement === 'on_paper' &&
                              q.conceptA?.trim() &&
                              q.conceptB?.trim() ? (
                                <table
                                  data-testid="compare-answer-grid"
                                  className="mt-2 w-full border-collapse text-xs"
                                >
                                  <thead>
                                    <tr className="bg-slate-100">
                                      <th className="border border-slate-700 px-2 py-1.5 text-right font-bold">
                                        وجه المقارنة
                                      </th>
                                      <th className="border border-slate-700 px-2 py-1.5 text-center font-bold">
                                        {q.conceptA}
                                      </th>
                                      <th className="border border-slate-700 px-2 py-1.5 text-center font-bold">
                                        {q.conceptB}
                                      </th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {(q.comparisonPoints?.length
                                      ? q.comparisonPoints
                                      : ['وجه المقارنة (1)', 'وجه المقارنة (2)']
                                    ).map((pt, pIdx) => (
                                      <tr key={pIdx}>
                                        <td className="border border-slate-700 bg-slate-50 px-2 py-2 font-bold">
                                          {pt}
                                        </td>
                                        <td className="h-8 border border-slate-700 px-2 py-2" />
                                        <td className="h-8 border border-slate-700 px-2 py-2" />
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              ) : (
                                <>
                                  {q.conceptA && q.conceptB && q.comparisonPoints?.length ? (
                                    <div className="pr-4 text-xs text-slate-600">
                                      ({q.conceptA} / {q.conceptB}) — من حيث:{' '}
                                      {q.comparisonPoints.join('، ')}
                                    </div>
                                  ) : null}
                                  {paper.answerPlacement === 'on_paper' &&
                                    Array.from({ length: q.linesCount || 3 }).map((_, li) => (
                                      <div
                                        key={li}
                                        data-testid="dotted-answer-line"
                                        className="mt-1.5 h-5 border-b border-dotted border-slate-500"
                                      />
                                    ))}
                                </>
                              )}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              {/* Signature Footer */}
              <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t-2 border-slate-900 pt-3 text-sm font-extrabold">
                <span>مدرس المادة: {paper.teacherName}</span>
                <span>العام الدراسي: {paper.academicYear}</span>
                <span>توقيع إدارة المدرسة: ........................</span>
              </div>
            </div>
          )}

          {previewTab === 'key' && (
            <div
              data-testid="a4-key-preview"
              style={{ fontFamily: previewFontCss, fontSize: `${paper.fontSizePx}px` }}
              className="rounded-xl border border-emerald-300 bg-white p-5 text-slate-900 shadow-sm sm:p-7"
            >
              <div className="mb-4 rounded-md border-2 border-emerald-800 bg-emerald-50/60 px-4 py-2.5">
                <div className="flex flex-wrap items-center justify-between gap-2 font-extrabold text-emerald-900">
                  <span className="inline-flex items-center gap-1.5">
                    <FileCheck2 className="h-4 w-4" />
                    <span>مفتاح الإجابات النموذجية (قسم منفصل — لا يظهر في نسخة الطالب)</span>
                  </span>
                  <span>{paper.schoolName}</span>
                </div>
                <div className="mt-1 text-xs font-bold text-slate-600">
                  {paper.examTitle} · {paper.subjectName} · {paper.gradeAndSection}
                </div>
              </div>

              <div className="space-y-3">
                {paper.sections.map((sec, sIdx) => (
                  <div key={sec.id} className="rounded-lg border border-slate-300 p-3">
                    <div className="mb-2 flex items-center justify-between border-b border-slate-200 pb-1 font-extrabold">
                      <span>
                        إجابة س{sIdx + 1}: {sec.title}
                      </span>
                      <span className="text-xs tabular-nums">({sec.marks} درجة)</span>
                    </div>
                    <ol className="list-decimal space-y-1 pr-5 text-sm font-semibold text-slate-800">
                      {sec.questions.map((q) => (
                        <li key={q.id}>{q.modelAnswer || '—'}</li>
                      ))}
                    </ol>
                  </div>
                ))}
              </div>
            </div>
          )}

          {previewTab === 'prompt' && (
            <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-extrabold text-slate-800 dark:text-slate-200">
                  الأمر الجاهز للتوليد والطباعة على A4 (محفز جاهز بكل معطيات الورقة المختارة)
                </span>
                <button
                  type="button"
                  onClick={handleCopyPrompt}
                  className="inline-flex cursor-pointer items-center gap-1 rounded-lg bg-emerald-800 px-3 py-1.5 text-xs font-bold text-white hover:bg-emerald-700"
                >
                  <ClipboardCopy className="h-3.5 w-3.5" />
                  <span>نسخ الأمر</span>
                </button>
              </div>
              <textarea
                readOnly
                rows={18}
                value={promptText}
                className="w-full rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs leading-6 text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
