import { useEffect, useRef, useState } from 'react';
import { MessageSquarePlus, RotateCcw, Sparkles } from 'lucide-react';
import type { AcademicContext, AppDatabase, NoteCategory } from '../types/gradebook';
import { getGradeRecord } from '../utils/evaluation';
import { A4ExamDesigner } from './A4ExamDesigner';
import { GoogleFormsPanel, type GoogleFormsImportTarget } from './GoogleFormsPanel';

interface ToolsViewProps {
  db: AppDatabase;
  ctx: AcademicContext;
  onAwardParticipation: (studentId: string, subjectId: string, points: number) => void;
  onAddNote: (studentId: string, type: NoteCategory, text: string) => void;
  onApplyImportedGrades: (
    subjectId: string,
    target: GoogleFormsImportTarget,
    entries: Array<{ studentId: string; score: number }>
  ) => void;
  onPrintHtml: (html: string) => void;
  onNotify: (msg: string) => void;
}

const WHEEL_COLORS = [
  '#065f46',
  '#0369a1',
  '#b45309',
  '#047857',
  '#1d4ed8',
  '#0f766e',
  '#c2410c',
  '#15803d',
];

function polarToCartesian(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return {
    x: cx + r * Math.cos(rad),
    y: cy + r * Math.sin(rad),
  };
}

function slicePath(cx: number, cy: number, r: number, startAngle: number, endAngle: number): string {
  const start = polarToCartesian(cx, cy, r, endAngle);
  const end = polarToCartesian(cx, cy, r, startAngle);
  const largeArc = endAngle - startAngle <= 180 ? '0' : '1';
  return `M ${cx} ${cy} L ${start.x} ${start.y} A ${r} ${r} 0 ${largeArc} 0 ${end.x} ${end.y} Z`;
}

export function ToolsView({
  db,
  ctx,
  onAwardParticipation,
  onAddNote,
  onApplyImportedGrades,
  onPrintHtml,
  onNotify,
}: ToolsViewProps) {
  const [toolTab, setToolTab] = useState<'wheel' | 'exam' | 'forms'>('wheel');

  const [points, setPoints] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const [excludePicked, setExcludePicked] = useState(true);
  const [pickedIds, setPickedIds] = useState<string[]>([]);
  const [pickedName, setPickedName] = useState('اضغط لتدوير العجلة');
  const [awardSummary, setAwardSummary] = useState('');
  const spinTimeoutRef = useRef<number | null>(null);

  const sectionStudents = db.students
    .filter((s) => s.sectionId === ctx.sectionId)
    .sort((a, b) => a.name.localeCompare(b.name, 'ar'));
  const eligibleStudents = excludePicked
    ? sectionStudents.filter((s) => !pickedIds.includes(s.id))
    : sectionStudents;

  const [noteStuId, setNoteStuId] = useState(db.students[0]?.id || '');
  const [noteType, setNoteType] = useState<NoteCategory>('positive');
  const [noteText, setNoteText] = useState('');

  const subject = db.subjects.find((sb) => sb.id === ctx.subjectId);
  const gradeObj = db.grades.find((g) => g.id === ctx.gradeId);
  const sectionObj = db.sections.find((s) => s.id === ctx.sectionId);

  useEffect(() => {
    return () => {
      if (spinTimeoutRef.current) window.clearTimeout(spinTimeoutRef.current);
    };
  }, []);

  const handleSpin = () => {
    if (spinning) return;
    if (!sectionStudents.length) {
      onNotify('لا يوجد طلبة في الشعبة الحالية');
      return;
    }
    if (!eligibleStudents.length) {
      onNotify('تم اختيار جميع الطلبة في هذه الجولة؛ اضغط تصفير الجولة');
      return;
    }
    if (!subject) {
      onNotify('اختر مادة أولاً');
      return;
    }

    const winnerIdx = Math.floor(Math.random() * eligibleStudents.length);
    const winner = eligibleStudents[winnerIdx];
    const sliceAngle = 360 / eligibleStudents.length;
    const winnerCenterAngle = winnerIdx * sliceAngle + sliceAngle / 2;
    const targetMod = (360 - (winnerCenterAngle % 360)) % 360;
    const currentMod = ((rotation % 360) + 360) % 360;
    const delta = (targetMod - currentMod + 360) % 360;
    const nextRotation = rotation + 360 * 4 + delta;

    setSpinning(true);
    setAwardSummary('');
    setRotation(nextRotation);

    spinTimeoutRef.current = window.setTimeout(() => {
      setSpinning(false);
      setPickedName(winner.name);
      if (excludePicked) {
        setPickedIds((prev) => [...prev, winner.id]);
      }
      onAwardParticipation(winner.id, subject.id, points);
      setAwardSummary(`تمت إضافة +${points} لدرجة المشاركة تلقائياً في ${subject.name} (تضاف للمعدل)`);
      onNotify(`تم اختيار ${winner.name} (+${points} مشاركة)`);
    }, 2250);
  };

  const handleSaveNote = (e: React.FormEvent) => {
    e.preventDefault();
    if (!noteStuId || !noteText.trim()) {
      onNotify('اختر الطالب واكتب الملاحظة');
      return;
    }
    onAddNote(noteStuId, noteType, noteText.trim());
    setNoteText('');
    onNotify('تم حفظ الملاحظة');
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-wrap items-center gap-1 rounded-lg bg-slate-100 p-1 dark:bg-slate-800">
          <button
            type="button"
            onClick={() => setToolTab('wheel')}
            className={`cursor-pointer rounded-md px-3.5 py-1.5 text-xs font-bold whitespace-nowrap transition-colors ${
              toolTab === 'wheel'
                ? 'bg-white text-emerald-800 shadow-sm dark:bg-slate-900 dark:text-emerald-400'
                : 'text-slate-600 dark:text-slate-300'
            }`}
          >
            عجلة المشاركة والملاحظات
          </button>
          <button
            type="button"
            onClick={() => setToolTab('exam')}
            className={`cursor-pointer rounded-md px-3.5 py-1.5 text-xs font-bold whitespace-nowrap transition-colors ${
              toolTab === 'exam'
                ? 'bg-white text-emerald-800 shadow-sm dark:bg-slate-900 dark:text-emerald-400'
                : 'text-slate-600 dark:text-slate-300'
            }`}
          >
            صياغة أسئلة A4 الرسمية
          </button>
          <button
            type="button"
            onClick={() => setToolTab('forms')}
            className={`cursor-pointer rounded-md px-3.5 py-1.5 text-xs font-bold whitespace-nowrap transition-colors ${
              toolTab === 'forms'
                ? 'bg-white text-emerald-800 shadow-sm dark:bg-slate-900 dark:text-emerald-400'
                : 'text-slate-600 dark:text-slate-300'
            }`}
          >
            اختبارات Google Forms الإلكترونية
          </button>
        </div>

        <div className="text-xs text-slate-500 dark:text-slate-400">
          المادة المختارة: <strong>{subject?.name || '—'}</strong> · المشاركة تُربط تلقائياً بمعدل الفصل
        </div>
      </div>

      {toolTab === 'wheel' && (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          <section className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                عجلة المشاركة التفاعلية
              </h3>
              <button
                type="button"
                onClick={() => {
                  setPickedIds([]);
                  setPickedName('تم تصفير الجولة');
                  setAwardSummary('');
                }}
                className="inline-flex cursor-pointer items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                <span>تصفير الجولة</span>
              </button>
            </div>

            <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label htmlFor="wheel-points" className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-400">
                  الدرجة المضافة للمشاركة تلقائياً
                </label>
                <input
                  id="wheel-points"
                  type="number"
                  min={0.5}
                  max={10}
                  step={0.5}
                  value={points}
                  onChange={(e) => setPoints(Number(e.target.value) || 1)}
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-bold tabular-nums dark:border-slate-700 dark:bg-slate-800"
                />
              </div>
              <div className="flex items-end pb-1.5">
                <label className="inline-flex cursor-pointer items-center gap-2 text-xs font-semibold text-slate-700 dark:text-slate-300">
                  <input
                    type="checkbox"
                    checked={excludePicked}
                    onChange={(e) => setExcludePicked(e.target.checked)}
                    className="h-4 w-4 accent-emerald-700"
                  />
                  <span>عدم تكرار الطالب في نفس الجولة</span>
                </label>
              </div>
            </div>

            {/* Interactive SVG Wheel */}
            <div className="relative mx-auto my-3 flex flex-col items-center justify-center">
              <div
                aria-hidden="true"
                className="z-10 -mb-2 h-0 w-0 border-x-8 border-t-[14px] border-x-transparent border-t-amber-500"
              />
              <div className="relative h-60 w-60 overflow-hidden rounded-full border-4 border-slate-200 shadow-sm dark:border-slate-700">
                {eligibleStudents.length > 0 ? (
                  <svg
                    viewBox="0 0 200 200"
                    className="h-full w-full"
                    style={{
                      transform: `rotate(${rotation}deg)`,
                      transition: spinning ? 'transform 2.2s cubic-bezier(0.16, 1, 0.3, 1)' : 'none',
                    }}
                  >
                    {eligibleStudents.length === 1 ? (
                      <g>
                        <circle cx="100" cy="100" r="100" fill={WHEEL_COLORS[0]} />
                        <text
                          x="100"
                          y="100"
                          fill="#ffffff"
                          fontSize="12"
                          fontWeight="bold"
                          textAnchor="middle"
                          dominantBaseline="middle"
                        >
                          {eligibleStudents[0].name.split(' ')[0]}
                        </text>
                      </g>
                    ) : (
                      eligibleStudents.map((st, idx) => {
                        const sliceAngle = 360 / eligibleStudents.length;
                        const start = idx * sliceAngle;
                        const end = start + sliceAngle;
                        const mid = start + sliceAngle / 2;
                        const labelPos = polarToCartesian(100, 100, 62, mid);
                        const firstWord = st.name.split(' ')[0];
                        const textRot = mid > 90 && mid < 270 ? mid + 180 : mid;
                        return (
                          <g key={st.id}>
                            <path
                              d={slicePath(100, 100, 100, start, end)}
                              fill={WHEEL_COLORS[idx % WHEEL_COLORS.length]}
                              stroke="#ffffff"
                              strokeWidth="1.5"
                            />
                            <text
                              x={labelPos.x}
                              y={labelPos.y}
                              fill="#ffffff"
                              fontSize="10"
                              fontWeight="bold"
                              textAnchor="middle"
                              dominantBaseline="middle"
                              transform={`rotate(${textRot}, ${labelPos.x}, ${labelPos.y})`}
                            >
                              {firstWord}
                            </text>
                          </g>
                        );
                      })
                    )}
                    <circle cx="100" cy="100" r="14" fill="#ffffff" stroke="#065f46" strokeWidth="3" />
                  </svg>
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-slate-100 p-4 text-center text-xs font-semibold text-slate-500 dark:bg-slate-800">
                    لا يوجد طلبة متبقون في هذه الجولة
                  </div>
                )}
              </div>
            </div>

            <div className="my-3 rounded-xl border border-dashed border-emerald-600 bg-emerald-50/70 px-4 py-3 text-center dark:border-emerald-500/60 dark:bg-emerald-950/30">
              <div className="text-lg font-extrabold text-emerald-800 dark:text-emerald-300">
                {pickedName}
              </div>
              {awardSummary && (
                <p className="mt-1 text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                  {awardSummary}
                </p>
              )}
            </div>

            <button
              type="button"
              disabled={spinning}
              onClick={handleSpin}
              className="inline-flex w-full cursor-pointer items-center justify-center gap-2 rounded-lg bg-amber-500 px-4 py-2.5 text-sm font-bold text-slate-950 hover:bg-amber-400 disabled:opacity-60"
            >
              <Sparkles className="h-4 w-4" />
              <span>{spinning ? 'جاري تدوير العجلة...' : 'تدوير العجلة واختيار طالب'}</span>
            </button>

            {subject && sectionStudents.length > 0 && (
              <div className="mt-4 border-t border-slate-200 pt-3 dark:border-slate-800">
                <div className="mb-2 text-xs font-bold text-slate-600 dark:text-slate-400">
                  أرصدة المشاركة الحالية في ({subject.name})
                </div>
                <div className="flex flex-wrap gap-2">
                  {sectionStudents.map((st) => {
                    const rec = getGradeRecord(db, st.id, subject.id);
                    return (
                      <span
                        key={st.id}
                        className="text-xs text-slate-700 tabular-nums dark:text-slate-300"
                      >
                        {st.name.split(' ')[0]}: <strong>{rec.part || 0}</strong>
                      </span>
                    );
                  })}
                </div>
              </div>
            )}
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
            <h3 className="mb-3 text-base font-bold text-slate-900 dark:text-slate-100">
              تسجيل الملاحظات السلوكية والتعليمية
            </h3>
            <form onSubmit={handleSaveNote} className="space-y-3">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label htmlFor="note-stu" className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-400">
                    الطالب
                  </label>
                  <select
                    id="note-stu"
                    value={noteStuId}
                    onChange={(e) => setNoteStuId(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
                  >
                    {db.students.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="note-type" className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-400">
                    التصنيف
                  </label>
                  <select
                    id="note-type"
                    value={noteType}
                    onChange={(e) => setNoteType(e.target.value as NoteCategory)}
                    className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
                  >
                    <option value="positive">إيجابية / تشجيع</option>
                    <option value="academic">تعليمية</option>
                    <option value="warning">تنبيه / متابعة</option>
                  </select>
                </div>
              </div>
              <div>
                <label htmlFor="note-text" className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-400">
                  نص الملاحظة
                </label>
                <textarea
                  id="note-text"
                  rows={4}
                  value={noteText}
                  onChange={(e) => setNoteText(e.target.value)}
                  placeholder="اكتب ملاحظة للطالب وولي الأمر..."
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm dark:border-slate-700 dark:bg-slate-800"
                />
              </div>
              <button
                type="submit"
                className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-emerald-800 px-4 py-2 text-sm font-bold text-white hover:bg-emerald-700 dark:bg-emerald-600"
              >
                <MessageSquarePlus className="h-4 w-4" />
                <span>حفظ الملاحظة</span>
              </button>
            </form>
          </section>
        </div>
      )}

      {toolTab === 'exam' && (
        <A4ExamDesigner
          db={db}
          subjectName={subject?.name || 'الأحياء'}
          gradeName={gradeObj?.name || ''}
          sectionName={sectionObj?.name || ''}
          onPrintHtml={onPrintHtml}
          onNotify={onNotify}
        />
      )}

      {toolTab === 'forms' && (
        <section className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
          <GoogleFormsPanel
            db={db}
            ctx={ctx}
            onApplyImportedGrades={onApplyImportedGrades}
            onNotify={onNotify}
          />
        </section>
      )}
    </div>
  );
}
