import { useEffect, useMemo, useState } from 'react';
import type { User } from 'firebase/auth';
import {
  CheckCircle2,
  ClipboardCopy,
  ExternalLink,
  FilePlus2,
  Link2,
  LogOut,
  RefreshCw,
  UploadCloud,
} from 'lucide-react';
import type { AcademicContext, AppDatabase } from '../types/gradebook';
import { getSubjectTermConfig } from '../utils/evaluation';
import {
  extractFormMetadata,
  extractGoogleFormId,
  matchFormResponsesToStudents,
  type GoogleFormDocument,
  type GoogleFormResponseItem,
} from '../utils/googleForms';
import {
  createGoogleFormQuiz,
  fetchGoogleFormAndResponses,
  getCurrentGoogleUser,
  getGoogleAccessToken,
  googleWorkspaceSignIn,
  googleWorkspaceSignOut,
  initGoogleWorkspaceAuth,
} from '../utils/googleWorkspaceAuth';

export type GoogleFormsImportTarget =
  | { kind: 'daily'; termKey: 'term1Months' | 'term2Months'; monthId: string; sectionId: string }
  | { kind: 'written'; termKey: 'term1Months' | 'term2Months'; monthId: string }
  | { kind: 'mid' }
  | { kind: 'final' };

interface GoogleFormsPanelProps {
  db: AppDatabase;
  ctx: AcademicContext;
  onApplyImportedGrades: (
    subjectId: string,
    target: GoogleFormsImportTarget,
    entries: Array<{ studentId: string; score: number }>
  ) => void;
  onNotify: (msg: string) => void;
}

export function GoogleFormsPanel({
  db,
  ctx,
  onApplyImportedGrades,
  onNotify,
}: GoogleFormsPanelProps) {
  const [panelMode, setPanelMode] = useState<'import' | 'create'>('import');
  const [googleUser, setGoogleUser] = useState<User | null>(() => getCurrentGoogleUser());
  const [accessToken, setAccessToken] = useState<string | null>(() => getGoogleAccessToken());
  const [authBusy, setAuthBusy] = useState(false);
  const [authError, setAuthError] = useState('');

  // Import state
  const [formUrlInput, setFormUrlInput] = useState('');
  const [fetchBusy, setFetchBusy] = useState(false);
  const [fetchError, setFetchError] = useState('');
  const [loadedForm, setLoadedForm] = useState<GoogleFormDocument | null>(null);
  const [loadedResponses, setLoadedResponses] = useState<GoogleFormResponseItem[]>([]);
  const [identifierQuestionId, setIdentifierQuestionId] = useState('');
  const [manualOverrides, setManualOverrides] = useState<Record<string, string>>({});

  // Target gradebook destination state
  const [targetKind, setTargetKind] = useState<'daily' | 'written' | 'mid' | 'final'>('daily');
  const [termKey, setTermKey] = useState<'term1Months' | 'term2Months'>('term1Months');
  const [monthId, setMonthId] = useState('m1');
  const [dailySectionId, setDailySectionId] = useState('');
  const [scaleToMax, setScaleToMax] = useState(true);
  const [enforceTargetMax, setEnforceTargetMax] = useState(true);
  const [customTargetMax, setCustomTargetMax] = useState<number | ''>(10);
  const [confirmImportOpen, setConfirmImportOpen] = useState(false);

  // Create quiz state
  const subject = db.subjects.find((sb) => sb.id === ctx.subjectId);
  const grade = db.grades.find((g) => g.id === ctx.gradeId);
  const section = db.sections.find((s) => s.id === ctx.sectionId);

  const [quizTitle, setQuizTitle] = useState(
    subject ? `اختبار ${subject.name} — ${grade?.name || ''}` : 'اختبار إلكتروني — ثانوية الذاكرين'
  );
  const [quizDesc, setQuizDesc] = useState(
    'يرجى كتابة الاسم الثلاثي ورقم الطالب بدقة لربط الدرجة تلقائياً بسجل المنصة.'
  );
  const [quizCount, setQuizCount] = useState(5);
  const [quizPts, setQuizPts] = useState(2);
  const [confirmCreateOpen, setConfirmCreateOpen] = useState(false);
  const [createBusy, setCreateBusy] = useState(false);
  const [createdLinks, setCreatedLinks] = useState<{
    formId: string;
    responderUri: string;
    editUrl: string;
  } | null>(null);

  useEffect(() => {
    const unsub = initGoogleWorkspaceAuth(
      (user, tok) => {
        setGoogleUser(user);
        setAccessToken(tok);
        setAuthError('');
      },
      () => {
        setGoogleUser(null);
        setAccessToken(null);
      }
    );
    return () => unsub();
  }, []);

  useEffect(() => {
    if (subject) {
      setQuizTitle(`اختبار ${subject.name}${grade ? ` — ${grade.name}` : ''}`);
    }
  }, [subject, grade]);

  const termConfig = useMemo(() => (subject ? getSubjectTermConfig(subject) : null), [subject]);
  const monthsList = useMemo(
    () => (termConfig ? termConfig[termKey] : []),
    [termConfig, termKey]
  );
  const activeMonth = useMemo(
    () => monthsList.find((m) => m.id === monthId) || monthsList[0],
    [monthsList, monthId]
  );

  useEffect(() => {
    if (!activeMonth) return;
    if (!activeMonth.dailySections.some((d) => d.id === dailySectionId)) {
      setDailySectionId(activeMonth.dailySections[0]?.id || '');
    }
  }, [activeMonth, dailySectionId]);

  const activeDailyDef = activeMonth?.dailySections.find((d) => d.id === dailySectionId);

  useEffect(() => {
    if (targetKind === 'daily') {
      setCustomTargetMax(activeDailyDef?.maxScore ?? 10);
    } else {
      setCustomTargetMax(100);
    }
  }, [targetKind, activeDailyDef]);

  const effectiveTargetMax = useMemo(() => {
    if (!enforceTargetMax) return null;
    const parsed = Number(customTargetMax);
    if (customTargetMax !== '' && !Number.isNaN(parsed) && parsed >= 1) return parsed;
    return targetKind === 'daily' ? activeDailyDef?.maxScore ?? 10 : 100;
  }, [enforceTargetMax, customTargetMax, targetKind, activeDailyDef]);

  const gradeStudents = useMemo(() => {
    const secIds = new Set(db.sections.filter((s) => s.gradeId === ctx.gradeId).map((s) => s.id));
    return db.students
      .filter((s) => secIds.has(s.sectionId))
      .sort((a, b) => a.name.localeCompare(b.name, 'ar'));
  }, [db.sections, db.students, ctx.gradeId]);

  const formMeta = useMemo(() => (loadedForm ? extractFormMetadata(loadedForm) : null), [loadedForm]);

  const previewRows = useMemo(() => {
    if (!loadedForm || !formMeta) return [];
    const base = matchFormResponsesToStudents({
      responses: loadedResponses,
      students: gradeStudents,
      identifierQuestionId: identifierQuestionId || formMeta.suggestedIdentifierQuestionId,
      formTotalPoints: formMeta.totalQuizPoints,
      scaleToTarget: scaleToMax,
      targetMaxScore: effectiveTargetMax,
    });
    return base.map((row) => {
      const overrideStuId = manualOverrides[row.responseId];
      if (!overrideStuId) return row;
      const stu = gradeStudents.find((s) => s.id === overrideStuId) || null;
      return { ...row, matchedStudent: stu };
    });
  }, [
    loadedForm,
    formMeta,
    loadedResponses,
    gradeStudents,
    identifierQuestionId,
    scaleToMax,
    effectiveTargetMax,
    manualOverrides,
  ]);

  const matchedReady = previewRows.filter((r) => r.matchedStudent !== null);

  const handleGoogleSignIn = async () => {
    setAuthBusy(true);
    setAuthError('');
    try {
      const res = await googleWorkspaceSignIn();
      setGoogleUser(res.user);
      setAccessToken(res.accessToken);
      onNotify('تم ربط حساب Google Forms بنجاح');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'تعذر تسجيل الدخول عبر Google';
      setAuthError(msg);
      onNotify('تعذر إتمام تسجيل الدخول بحساب Google');
    } finally {
      setAuthBusy(false);
    }
  };

  const handleGoogleSignOut = async () => {
    await googleWorkspaceSignOut();
    setGoogleUser(null);
    setAccessToken(null);
    onNotify('تم تسجيل الخروج من حساب Google');
  };

  const handleFetchForm = async (e: React.FormEvent) => {
    e.preventDefault();
    setFetchError('');
    const parsed = extractGoogleFormId(formUrlInput);
    if (!parsed.ok || !parsed.formId) {
      setFetchError(parsed.error || 'رابط النموذج غير صالح.');
      return;
    }
    if (!accessToken) {
      setFetchError('يرجى تسجيل الدخول بحساب Google أولاً لقراءة الاختبار واستجاباته.');
      return;
    }

    setFetchBusy(true);
    try {
      const data = await fetchGoogleFormAndResponses(parsed.formId, accessToken);
      setLoadedForm(data.form);
      setLoadedResponses(data.responses);
      const meta = extractFormMetadata(data.form);
      setIdentifierQuestionId(meta.suggestedIdentifierQuestionId);
      setManualOverrides({});
      onNotify(`تم جلب النموذج (${meta.title}) — ${data.responses.length} استجابة`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'تعذر جلب بيانات النموذج';
      setFetchError(msg);
    } finally {
      setFetchBusy(false);
    }
  };

  const handleConfirmImport = () => {
    if (!subject || !matchedReady.length) return;
    let target: GoogleFormsImportTarget;
    if (targetKind === 'daily') {
      if (!activeMonth || !activeDailyDef) {
        onNotify('اختر قسماً يومياً صالحاً أولاً');
        return;
      }
      target = {
        kind: 'daily',
        termKey,
        monthId: activeMonth.id,
        sectionId: activeDailyDef.id,
      };
    } else if (targetKind === 'written') {
      if (!activeMonth) return;
      target = { kind: 'written', termKey, monthId: activeMonth.id };
    } else if (targetKind === 'mid') {
      target = { kind: 'mid' };
    } else {
      target = { kind: 'final' };
    }

    onApplyImportedGrades(
      subject.id,
      target,
      matchedReady.map((r) => ({
        studentId: r.matchedStudent!.id,
        score: r.mappedScore,
      }))
    );
    setConfirmImportOpen(false);
    onNotify(`تم استيراد درجات ${matchedReady.length} طالب إلى سجل ${subject.name}`);
  };

  const handleConfirmCreateQuiz = async () => {
    if (!accessToken) return;
    setCreateBusy(true);
    try {
      const created = await createGoogleFormQuiz(
        {
          title: quizTitle,
          description: quizDesc,
          questionCount: quizCount,
          pointsPerQuestion: quizPts,
        },
        accessToken
      );
      setCreatedLinks(created);
      setFormUrlInput(created.editUrl);
      setConfirmCreateOpen(false);
      onNotify('تم إنشاء الاختبار الإلكتروني على Google Forms بنجاح');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'تعذر إنشاء النموذج';
      onNotify(msg);
    } finally {
      setCreateBusy(false);
    }
  };

  const copyText = async (val: string, label: string) => {
    try {
      await navigator.clipboard.writeText(val);
      onNotify(`تم نسخ ${label}`);
    } catch {
      onNotify('تعذر النسخ التلقائي — يمكنك النسخ يدوياً');
    }
  };

  return (
    <div className="space-y-4">
      {/* Google Account Connection Banner */}
      <div className="flex flex-col justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50/80 p-4 dark:border-slate-800 dark:bg-slate-800/40 sm:flex-row sm:items-center">
        <div className="min-w-0">
          <div className="text-sm font-extrabold text-slate-900 dark:text-slate-100">
            ربط الاختبارات الإلكترونية عبر Google Forms
          </div>
          <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
            {accessToken && googleUser
              ? `متصل بحساب: ${googleUser.displayName || googleUser.email || 'Google Account'}`
              : 'سجّل الدخول بحساب Google لمنح الإذن بقراءة درجات الاختبارات أو إنشاء اختبار جديد.'}
          </p>
          {authError && (
            <p className="mt-1 text-xs font-semibold text-red-600 dark:text-red-400">{authError}</p>
          )}
        </div>

        {accessToken ? (
          <button
            type="button"
            onClick={handleGoogleSignOut}
            className="inline-flex shrink-0 cursor-pointer items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-bold text-slate-700 whitespace-nowrap hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
          >
            <LogOut className="h-3.5 w-3.5" />
            <span>فصل حساب Google</span>
          </button>
        ) : (
          <button
            type="button"
            disabled={authBusy}
            onClick={handleGoogleSignIn}
            className="gsi-material-button inline-flex shrink-0 cursor-pointer items-center justify-center gap-2.5 rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-bold text-slate-800 shadow-xs transition-colors hover:bg-slate-50 disabled:opacity-60"
          >
            <svg
              version="1.1"
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 48 48"
              className="h-4 w-4 shrink-0"
              aria-hidden="true"
            >
              <path
                fill="#EA4335"
                d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
              />
              <path
                fill="#4285F4"
                d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
              />
              <path
                fill="#FBBC05"
                d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
              />
              <path
                fill="#34A853"
                d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
              />
            </svg>
            <span className="whitespace-nowrap">
              {authBusy ? 'جاري تسجيل الدخول...' : 'Sign in with Google'}
            </span>
          </button>
        )}
      </div>

      {/* Mode Switcher */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex w-full flex-wrap gap-1 rounded-lg bg-slate-100 p-1 dark:bg-slate-800 sm:w-auto sm:inline-flex">
          <button
            type="button"
            onClick={() => setPanelMode('import')}
            className={`flex-1 cursor-pointer rounded-md px-3 py-1.5 text-center text-xs font-bold transition-colors sm:flex-none sm:whitespace-nowrap ${
              panelMode === 'import'
                ? 'bg-white text-emerald-800 shadow-sm dark:bg-slate-900 dark:text-emerald-400'
                : 'text-slate-600 dark:text-slate-300'
            }`}
          >
            استيراد درجات من Google Forms
          </button>
          <button
            type="button"
            onClick={() => setPanelMode('create')}
            className={`flex-1 cursor-pointer rounded-md px-3 py-1.5 text-center text-xs font-bold transition-colors sm:flex-none sm:whitespace-nowrap ${
              panelMode === 'create'
                ? 'bg-white text-emerald-800 shadow-sm dark:bg-slate-900 dark:text-emerald-400'
                : 'text-slate-600 dark:text-slate-300'
            }`}
          >
            إنشاء اختبار إلكتروني جديد
          </button>
        </div>

        <div className="text-xs text-slate-500 dark:text-slate-400">
          المادة: <strong>{subject?.name || '—'}</strong> · {grade?.name || ''} ({section?.name || ''})
        </div>
      </div>

      {/* IMPORT WORKFLOW */}
      {panelMode === 'import' && (
        <div className="space-y-4">
          <form onSubmit={handleFetchForm} className="space-y-2">
            <label
              htmlFor="gf-form-url"
              className="block text-xs font-bold text-slate-700 dark:text-slate-300"
            >
              رابط تعديل نموذج Google Forms أو معرّف النموذج (Form ID)
            </label>
            <div className="flex flex-col gap-2 sm:flex-row">
              <input
                id="gf-form-url"
                dir="ltr"
                value={formUrlInput}
                onChange={(e) => {
                  setFormUrlInput(e.target.value);
                  setFetchError('');
                }}
                placeholder="https://docs.google.com/forms/d/FORM_ID/edit"
                className="flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 font-mono text-xs text-slate-900 focus:border-emerald-700 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              />
              <button
                type="submit"
                disabled={fetchBusy}
                className="inline-flex cursor-pointer items-center justify-center gap-1.5 rounded-lg bg-emerald-800 px-4 py-2 text-xs font-bold text-white whitespace-nowrap hover:bg-emerald-700 disabled:opacity-50 dark:bg-emerald-600"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${fetchBusy ? 'animate-spin' : ''}`} />
                <span>{fetchBusy ? 'جاري الجلب...' : 'جلب الأسئلة والدرجات'}</span>
              </button>
            </div>
            {fetchError && (
              <p className="text-xs font-semibold text-red-600 dark:text-red-400">{fetchError}</p>
            )}
          </form>

          {loadedForm && formMeta && (
            <div className="space-y-4 rounded-xl border border-slate-200 p-4 dark:border-slate-800">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-3 dark:border-slate-800">
                <div>
                  <h4 className="text-sm font-extrabold text-slate-900 dark:text-slate-100">
                    {formMeta.title}
                  </h4>
                  <p className="text-xs text-slate-500 tabular-nums dark:text-slate-400">
                    الاستجابات: {loadedResponses.length} · الدرجة الكلية للاختبار: {formMeta.totalQuizPoints || 'غير محددة'}
                  </p>
                </div>
                <div className="text-xs font-bold text-emerald-700 tabular-nums dark:text-emerald-400">
                  تمت مطابقة {matchedReady.length} من أصل {previewRows.length}
                </div>
              </div>

              {/* Matching & Destination Config */}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <div>
                  <label className="mb-1 block text-[11px] font-bold text-slate-600 dark:text-slate-400">
                    سؤال اسم/رقم الطالب
                  </label>
                  <select
                    value={identifierQuestionId}
                    onChange={(e) => setIdentifierQuestionId(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-2 text-xs font-semibold dark:border-slate-700 dark:bg-slate-800"
                  >
                    {formMeta.questions.map((q) => (
                      <option key={q.questionId} value={q.questionId}>
                        {q.title}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-1 block text-[11px] font-bold text-slate-600 dark:text-slate-400">
                    استيراد الدرجة إلى
                  </label>
                  <select
                    value={targetKind}
                    onChange={(e) =>
                      setTargetKind(e.target.value as 'daily' | 'written' | 'mid' | 'final')
                    }
                    className="w-full rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-2 text-xs font-semibold dark:border-slate-700 dark:bg-slate-800"
                  >
                    <option value="daily">قسم تقييم يومي</option>
                    <option value="written">امتحان شهري (تحريري)</option>
                    <option value="mid">نصف السنة</option>
                    <option value="final">امتحان نهاية السنة</option>
                  </select>
                </div>

                {(targetKind === 'daily' || targetKind === 'written') && (
                  <>
                    <div>
                      <label className="mb-1 block text-[11px] font-bold text-slate-600 dark:text-slate-400">
                        الفصل والشهر
                      </label>
                      <div className="flex gap-1.5">
                        <select
                          aria-label="الفصل للاستيراد"
                          value={termKey}
                          onChange={(e) => {
                            const nt = e.target.value as 'term1Months' | 'term2Months';
                            setTermKey(nt);
                            setMonthId(termConfig?.[nt]?.[0]?.id || 'm1');
                          }}
                          className="w-1/2 rounded-lg border border-slate-200 bg-slate-50 px-2 py-2 text-xs font-semibold dark:border-slate-700 dark:bg-slate-800"
                        >
                          <option value="term1Months">ف1</option>
                          <option value="term2Months">ف2</option>
                        </select>
                        <select
                          aria-label="الشهر للاستيراد"
                          value={activeMonth?.id || ''}
                          onChange={(e) => setMonthId(e.target.value)}
                          className="w-1/2 rounded-lg border border-slate-200 bg-slate-50 px-2 py-2 text-xs font-semibold dark:border-slate-700 dark:bg-slate-800"
                        >
                          {monthsList.map((m) => (
                            <option key={m.id} value={m.id}>
                              {m.label}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {targetKind === 'daily' && (
                      <div>
                        <label className="mb-1 block text-[11px] font-bold text-slate-600 dark:text-slate-400">
                          قسم اليومي المستهدف
                        </label>
                        <select
                          value={activeDailyDef?.id || ''}
                          onChange={(e) => setDailySectionId(e.target.value)}
                          className="w-full rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-2 text-xs font-semibold dark:border-slate-700 dark:bg-slate-800"
                        >
                          {(activeMonth?.dailySections || []).map((ds) => (
                            <option key={ds.id} value={ds.id}>
                              {ds.name} (من {ds.maxScore})
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                  </>
                )}
              </div>

              {/* Optional Scaling & Custom Max */}
              <div className="flex flex-wrap items-center gap-4 rounded-lg bg-slate-50 px-3 py-2 text-xs dark:bg-slate-800/60">
                <label className="inline-flex cursor-pointer items-center gap-2 font-semibold text-slate-700 dark:text-slate-200">
                  <input
                    type="checkbox"
                    checked={scaleToMax}
                    onChange={(e) => setScaleToMax(e.target.checked)}
                    className="h-4 w-4 accent-emerald-700"
                  />
                  <span>تحويل درجة الاختبار نسبياً إلى الحد الأعلى</span>
                </label>

                <label className="inline-flex cursor-pointer items-center gap-2 font-semibold text-slate-700 dark:text-slate-200">
                  <input
                    type="checkbox"
                    checked={enforceTargetMax}
                    onChange={(e) => setEnforceTargetMax(e.target.checked)}
                    className="h-4 w-4 accent-emerald-700"
                  />
                  <span>تقييد بالحد الأعلى:</span>
                </label>

                {enforceTargetMax && (
                  <input
                    type="number"
                    aria-label="الحد الأعلى عند الاستيراد"
                    min={1}
                    value={customTargetMax}
                    onChange={(e) =>
                      setCustomTargetMax(e.target.value === '' ? '' : Math.max(1, Number(e.target.value)))
                    }
                    className="no-spinner w-16 rounded-md border border-slate-300 bg-white px-2 py-1 text-center font-bold tabular-nums dark:border-slate-700 dark:bg-slate-900"
                  />
                )}
              </div>

              {/* Preview Table */}
              <div className="max-h-64 overflow-y-auto rounded-lg border border-slate-200 dark:border-slate-800">
                <table className="w-full border-collapse text-right text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-800 dark:bg-slate-800/70 dark:text-slate-300">
                      <th className="px-3 py-2 font-bold">المعرّف في النموذج</th>
                      <th className="px-3 py-2 font-bold">الطالب في المنصة</th>
                      <th className="px-2 py-2 text-center font-bold">درجة الفورم</th>
                      <th className="px-2 py-2 text-center font-bold">الدرجة المعتمدة</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                    {previewRows.map((row) => (
                      <tr key={row.responseId}>
                        <td className="px-3 py-2 font-medium text-slate-700 dark:text-slate-200">
                          {row.identifierText}
                        </td>
                        <td className="px-3 py-2">
                          <select
                            aria-label={`مطابقة ${row.identifierText}`}
                            value={row.matchedStudent?.id || ''}
                            onChange={(e) =>
                              setManualOverrides((prev) => ({
                                ...prev,
                                [row.responseId]: e.target.value,
                              }))
                            }
                            className="w-full rounded-md border border-slate-200 bg-white px-2 py-1 text-xs font-semibold dark:border-slate-700 dark:bg-slate-900"
                          >
                            <option value="">— غير مطابق (اختر يدوياً) —</option>
                            {gradeStudents.map((st) => (
                              <option key={st.id} value={st.id}>
                                {st.name} (#{st.number})
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="px-2 py-2 text-center tabular-nums text-slate-600 dark:text-slate-300">
                          {row.rawScore}
                          {formMeta.totalQuizPoints ? ` / ${formMeta.totalQuizPoints}` : ''}
                        </td>
                        <td className="px-2 py-2 text-center font-extrabold tabular-nums text-emerald-700 dark:text-emerald-400">
                          {row.mappedScore}
                        </td>
                      </tr>
                    ))}
                    {!previewRows.length && (
                      <tr>
                        <td colSpan={4} className="px-3 py-6 text-center text-slate-500">
                          لا توجد استجابات مسجلة في هذا النموذج حتى الآن.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Explicit Import Confirmation */}
              {!confirmImportOpen ? (
                <div className="flex justify-end">
                  <button
                    type="button"
                    disabled={!matchedReady.length || !subject}
                    onClick={() => setConfirmImportOpen(true)}
                    className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-emerald-800 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-700 disabled:opacity-45 dark:bg-emerald-600"
                  >
                    <UploadCloud className="h-4 w-4" />
                    <span>استيراد درجات ({matchedReady.length}) طالب إلى السجل</span>
                  </button>
                </div>
              ) : (
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs text-amber-950 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
                  <span>
                    هل تؤكد استيراد وتحديث درجات <strong>{matchedReady.length}</strong> طالب في مادة{' '}
                    <strong>{subject?.name}</strong>؟
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setConfirmImportOpen(false)}
                      className="cursor-pointer rounded-md border border-slate-300 bg-white px-3 py-1.5 font-bold text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                    >
                      إلغاء
                    </button>
                    <button
                      type="button"
                      onClick={handleConfirmImport}
                      className="cursor-pointer rounded-md bg-emerald-800 px-3 py-1.5 font-bold text-white hover:bg-emerald-700"
                    >
                      تأكيد الاستيراد
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* CREATE QUIZ WORKFLOW */}
      {panelMode === 'create' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label
                htmlFor="gf-create-title"
                className="mb-1 block text-xs font-bold text-slate-700 dark:text-slate-300"
              >
                عنوان الاختبار الإلكتروني
              </label>
              <input
                id="gf-create-title"
                value={quizTitle}
                onChange={(e) => setQuizTitle(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label
                  htmlFor="gf-create-count"
                  className="mb-1 block text-xs font-bold text-slate-700 dark:text-slate-300"
                >
                  عدد أسئلة الاختيارات
                </label>
                <input
                  id="gf-create-count"
                  type="number"
                  min={1}
                  max={20}
                  value={quizCount}
                  onChange={(e) => setQuizCount(Math.min(20, Math.max(1, Number(e.target.value) || 5)))}
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-bold tabular-nums dark:border-slate-700 dark:bg-slate-800"
                />
              </div>
              <div>
                <label
                  htmlFor="gf-create-pts"
                  className="mb-1 block text-xs font-bold text-slate-700 dark:text-slate-300"
                >
                  درجة كل سؤال
                </label>
                <input
                  id="gf-create-pts"
                  type="number"
                  min={1}
                  max={50}
                  value={quizPts}
                  onChange={(e) => setQuizPts(Math.max(1, Number(e.target.value) || 1))}
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-bold tabular-nums dark:border-slate-700 dark:bg-slate-800"
                />
              </div>
            </div>
          </div>

          <div>
            <label
              htmlFor="gf-create-desc"
              className="mb-1 block text-xs font-bold text-slate-700 dark:text-slate-300"
            >
              توجيهات الاختبار للطلبة
            </label>
            <input
              id="gf-create-desc"
              value={quizDesc}
              onChange={(e) => setQuizDesc(e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
            />
          </div>

          <p className="text-xs text-slate-500 tabular-nums dark:text-slate-400">
            سيتم تفعيل وضع الاختبار (Quiz) وإضافة حقلي «اسم الطالب الثلاثي» و«رقم الطالب» تلقائياً بمجموع{' '}
            <strong>{quizCount * quizPts}</strong> درجة.
          </p>

          {!confirmCreateOpen ? (
            <button
              type="button"
              disabled={!accessToken}
              onClick={() => setConfirmCreateOpen(true)}
              className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-emerald-800 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-45 dark:bg-emerald-600"
            >
              <FilePlus2 className="h-4 w-4" />
              <span>إنشاء الاختبار في Google Forms</span>
            </button>
          ) : (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs text-amber-950 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
              <span>
                هل تؤكد إنشاء نموذج اختبار جديد بعنوان <strong>«{quizTitle}»</strong> ({quizCount} أسئلة، المجموع{' '}
                {quizCount * quizPts} درجة) داخل حسابك في Google Forms؟
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={createBusy}
                  onClick={() => setConfirmCreateOpen(false)}
                  className="cursor-pointer rounded-md border border-slate-300 bg-white px-3 py-1.5 font-bold text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                >
                  إلغاء
                </button>
                <button
                  type="button"
                  disabled={createBusy}
                  onClick={handleConfirmCreateQuiz}
                  className="cursor-pointer rounded-md bg-emerald-800 px-3 py-1.5 font-bold text-white hover:bg-emerald-700 disabled:opacity-50"
                >
                  {createBusy ? 'جاري الإنشاء...' : 'تأكيد الإنشاء'}
                </button>
              </div>
            </div>
          )}

          {!accessToken && (
            <p className="text-xs font-medium text-amber-700 dark:text-amber-400">
              سجّل الدخول عبر زر «Sign in with Google» أعلاه لتفعيل إنشاء النماذج مباشرة.
            </p>
          )}

          {createdLinks && (
            <div className="space-y-2 rounded-xl border border-emerald-200 bg-emerald-50/70 p-4 dark:border-emerald-800 dark:bg-emerald-950/30">
              <div className="flex items-center gap-1.5 text-sm font-bold text-emerald-800 dark:text-emerald-300">
                <CheckCircle2 className="h-4 w-4" />
                <span>تم إنشاء الاختبار الإلكتروني بنجاح</span>
              </div>
              <div className="flex flex-wrap gap-2 pt-1">
                <a
                  href={createdLinks.editUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-800 px-3 py-1.5 text-xs font-bold text-white hover:bg-emerald-700"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  <span>فتح محرر الأسئلة في Google Forms</span>
                </a>
                <button
                  type="button"
                  onClick={() => copyText(createdLinks.responderUri, 'رابط الاختبار للطلبة')}
                  className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-emerald-300 bg-white px-3 py-1.5 text-xs font-bold text-emerald-800 hover:bg-emerald-50 dark:border-emerald-700 dark:bg-slate-900 dark:text-emerald-300"
                >
                  <ClipboardCopy className="h-3.5 w-3.5" />
                  <span>نسخ رابط الطلبة</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setFormUrlInput(createdLinks.editUrl);
                    setPanelMode('import');
                  }}
                  className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                >
                  <Link2 className="h-3.5 w-3.5" />
                  <span>الانتقال لاستيراد الدرجات</span>
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
