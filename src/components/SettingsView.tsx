import { useState } from 'react';
import { CloudDownload, CloudUpload, Download, FileCode2, GitBranch, RotateCcw, Trash2, Upload } from 'lucide-react';
import type { AppDatabase, SchoolSettings } from '../types/gradebook';
import {
  convertOldV6ToUnified,
  createDemoData,
  normalizeDatabase,
  type LegacyV6Database,
} from '../utils/evaluation';
import { pullDatabaseFromGitHub, pushDatabaseToGitHub } from '../utils/storage';

interface SettingsViewProps {
  db: AppDatabase;
  onSaveSettings: (next: SchoolSettings) => void;
  onReplaceDatabase: (next: AppDatabase) => void;
  onClearStudents: () => void;
  onNotify: (msg: string) => void;
}

export function SettingsView({
  db,
  onSaveSettings,
  onReplaceDatabase,
  onClearStudents,
  onNotify,
}: SettingsViewProps) {
  const [form, setForm] = useState<SchoolSettings>(() => ({
    ...db.settings,
    rules: { ...db.settings.rules },
    github: {
      repo: db.settings.github?.repo || '',
      branch: db.settings.github?.branch || 'main',
      filePath: db.settings.github?.filePath || 'data/al-thakireen-backup.json',
      lastSyncAt: db.settings.github?.lastSyncAt,
    },
  }));
  const [githubToken, setGithubToken] = useState('');
  const [syncBusy, setSyncBusy] = useState(false);

  const handleDownloadJson = () => {
    const blob = new Blob([JSON.stringify(db, null, 2)], {
      type: 'application/json;charset=utf-8',
    });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `al_thakireen_backup_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    onNotify('تم تنزيل النسخة الاحتياطية (JSON)');
  };

  const handleDownloadStandaloneHtmlArchive = () => {
    const htmlSnapshot = `<!doctype html>
<html lang="ar" dir="rtl">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>أرشيف ${form.schoolName} (${form.academicYear})</title>
<style>
  body { font-family: Tahoma, Arial, sans-serif; margin: 24px; background: #f8fafc; color: #0f172a; }
  .card { background: #fff; border: 1px solid #cbd5e1; border-radius: 10px; padding: 18px; margin-bottom: 16px; }
  table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 13px; }
  th, td { border: 1px solid #cbd5e1; padding: 8px; text-align: right; }
  th { background: #f1f5f9; }
</style>
</head>
<body>
  <div class="card">
    <h1>${form.schoolName} — ${form.directorate}</h1>
    <p>العام الدراسي: ${form.academicYear} · المشرف: ${form.teacherName}</p>
    <p>عدد الطلبة: ${db.students.length} · عدد المواد: ${db.subjects.length} · تاريخ الأرشفة: ${new Date().toLocaleDateString('ar-IQ')}</p>
  </div>
  <div class="card">
    <h2>قائمة الطلبة</h2>
    <table>
      <thead><tr><th>الرقم</th><th>الاسم</th><th>PIN</th><th>واتساب</th></tr></thead>
      <tbody>${db.students.map((s) => `<tr><td>${s.number}</td><td>${s.name}</td><td>${s.pin}</td><td>${s.phone || '—'}</td></tr>`).join('')}</tbody>
    </table>
  </div>
</body>
</html>`;
    const blob = new Blob([htmlSnapshot], { type: 'text/html;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `al_thakireen_archive_${new Date().toISOString().slice(0, 10)}.html`;
    a.click();
    onNotify('تم تصدير أرشيف HTML المستقل');
  };

  const handleRestoreJson = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = JSON.parse(text) as Partial<AppDatabase> & LegacyV6Database;
      if (parsed && parsed.subjects && parsed.data && !parsed.students) {
        if (!window.confirm('تم التعرف على ملف من النسخة القديمة (V6). هل تريد تحويله واستيراده؟')) {
          return;
        }
        const migrated = convertOldV6ToUnified(parsed);
        onReplaceDatabase(migrated);
        setForm({ ...migrated.settings, rules: { ...migrated.settings.rules } });
        onNotify('تم تحويل واستيراد بيانات V6 بنجاح');
      } else if (parsed && Array.isArray(parsed.students) && parsed.settings) {
        if (!window.confirm('سيتم استبدال البيانات الحالية بالنسخة الاحتياطية. متابعة؟')) return;
        const normalized = normalizeDatabase(parsed);
        onReplaceDatabase(normalized);
        setForm({ ...normalized.settings, rules: { ...normalized.settings.rules } });
        onNotify('تمت استعادة النسخة الاحتياطية بنجاح');
      } else {
        onNotify('ملف النسخة الاحتياطية غير صالح');
      }
    } catch {
      onNotify('تعذر قراءة ملف JSON');
    }
    e.target.value = '';
  };

  const handlePushGitHub = async () => {
    setSyncBusy(true);
    onSaveSettings(form);
    const res = await pushDatabaseToGitHub({
      repo: form.github?.repo || '',
      branch: form.github?.branch || 'main',
      filePath: form.github?.filePath || 'data/al-thakireen-backup.json',
      token: githubToken,
      db,
    });
    setSyncBusy(false);
    if (res.ok) {
      const updatedSettings: SchoolSettings = {
        ...form,
        github: {
          repo: form.github?.repo || '',
          branch: form.github?.branch || 'main',
          filePath: form.github?.filePath || 'data/al-thakireen-backup.json',
          lastSyncAt: new Date().toLocaleString('ar-IQ'),
        },
      };
      setForm(updatedSettings);
      onSaveSettings(updatedSettings);
    }
    onNotify(res.message);
  };

  const handlePullGitHub = async () => {
    setSyncBusy(true);
    const res = await pullDatabaseFromGitHub({
      repo: form.github?.repo || '',
      branch: form.github?.branch || 'main',
      filePath: form.github?.filePath || 'data/al-thakireen-backup.json',
      token: githubToken,
    });
    setSyncBusy(false);
    if (res.ok && res.db) {
      if (window.confirm('تم جلب البيانات من GitHub. هل تريد استبدال السجل الحالي بها؟')) {
        onReplaceDatabase(res.db);
        setForm({ ...res.db.settings, rules: { ...res.db.settings.rules } });
        onNotify(res.message);
      }
    } else {
      onNotify(res.message);
    }
  };

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <section className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
          <h3 className="mb-4 text-base font-bold text-slate-900 dark:text-slate-100">
            إعدادات المدرسة والإدارة
          </h3>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-400">
                اسم المدرسة
              </label>
              <input
                value={form.schoolName}
                onChange={(e) => setForm({ ...form, schoolName: e.target.value })}
                className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-400">
                المديرية
              </label>
              <input
                value={form.directorate}
                onChange={(e) => setForm({ ...form, directorate: e.target.value })}
                className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-400">
                اسم المشرف / المدير
              </label>
              <input
                value={form.teacherName}
                onChange={(e) => setForm({ ...form, teacherName: e.target.value })}
                className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-400">
                البريد الإلكتروني
              </label>
              <input
                value={form.teacherEmail}
                onChange={(e) => setForm({ ...form, teacherEmail: e.target.value })}
                className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-400">
                العام الدراسي
              </label>
              <input
                value={form.academicYear}
                onChange={(e) => setForm({ ...form, academicYear: e.target.value })}
                className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-400">
                رمز دخول الإدارة (Admin PIN)
              </label>
              <input
                type="password"
                dir="ltr"
                value={form.adminPin || '0000'}
                onChange={(e) => setForm({ ...form, adminPin: e.target.value })}
                className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 font-mono text-sm dark:border-slate-700 dark:bg-slate-800"
              />
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              onSaveSettings(form);
              onNotify('تم حفظ الإعدادات العامة');
            }}
            className="mt-4 cursor-pointer rounded-lg bg-emerald-800 px-4 py-2 text-sm font-bold text-white hover:bg-emerald-700 dark:bg-emerald-600"
          >
            حفظ الإعدادات
          </button>
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
          <h3 className="mb-4 text-base font-bold text-slate-900 dark:text-slate-100">
            ضوابط الإعفاء والنجاح وطريقة الاحتساب
          </h3>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-400">
                درجة النجاح الصغرى
              </label>
              <input
                type="number"
                value={form.rules.passMark}
                onChange={(e) =>
                  setForm({
                    ...form,
                    rules: { ...form.rules, passMark: Number(e.target.value) || 50 },
                  })
                }
                className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm tabular-nums dark:border-slate-700 dark:bg-slate-800"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-400">
                حد الإعفاء الفردي (السعي)
              </label>
              <input
                type="number"
                value={form.rules.singleExempt}
                onChange={(e) =>
                  setForm({
                    ...form,
                    rules: { ...form.rules, singleExempt: Number(e.target.value) || 90 },
                  })
                }
                className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm tabular-nums dark:border-slate-700 dark:bg-slate-800"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-400">
                معدل الإعفاء الكلي (العام)
              </label>
              <input
                type="number"
                value={form.rules.generalExemptAvg}
                onChange={(e) =>
                  setForm({
                    ...form,
                    rules: { ...form.rules, generalExemptAvg: Number(e.target.value) || 85 },
                  })
                }
                className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm tabular-nums dark:border-slate-700 dark:bg-slate-800"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-400">
                أقل مادة بالإعفاء الكلي
              </label>
              <input
                type="number"
                value={form.rules.generalExemptMinSub}
                onChange={(e) =>
                  setForm({
                    ...form,
                    rules: { ...form.rules, generalExemptMinSub: Number(e.target.value) || 75 },
                  })
                }
                className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm tabular-nums dark:border-slate-700 dark:bg-slate-800"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-400">
                أقصى مواد الإكمال
              </label>
              <input
                type="number"
                value={form.rules.maxReexamSubjects}
                onChange={(e) =>
                  setForm({
                    ...form,
                    rules: { ...form.rules, maxReexamSubjects: Number(e.target.value) || 2 },
                  })
                }
                className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm tabular-nums dark:border-slate-700 dark:bg-slate-800"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-400">
                ربط درجات المشاركة بالمعدل
              </label>
              <select
                value={form.participationWeightMode}
                onChange={(e) =>
                  setForm({
                    ...form,
                    participationWeightMode: e.target.value as 'bonus_to_t1' | 'bonus_to_t2' | 'display_only',
                  })
                }
                className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
              >
                <option value="bonus_to_t1">تُضاف تلقائياً إلى معدل الفصل الأول</option>
                <option value="bonus_to_t2">تُضاف تلقائياً إلى معدل الفصل الثاني</option>
                <option value="display_only">تُسجل للمتابعة فقط</option>
              </select>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              onSaveSettings(form);
              onNotify('تم تحديث ضوابط التقييم والإعفاء');
            }}
            className="mt-4 cursor-pointer rounded-lg bg-emerald-800 px-4 py-2 text-sm font-bold text-white hover:bg-emerald-700 dark:bg-emerald-600"
          >
            اعتماد وتحديث الضوابط
          </button>
        </section>
      </div>

      {/* GitHub Repo & index.html + JSON Sync Hub */}
      <section className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="flex items-center gap-2 text-base font-bold text-slate-900 dark:text-slate-100">
              <GitBranch className="h-4 w-4 text-emerald-700 dark:text-emerald-400" />
              <span>الربط والمزامنة مع مستودع GitHub وملف index.html</span>
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              اربط مستودع GitHub لرفع أو استيراد نسخة JSON الاحتياطية مباشرة، أو صدّر حزمة البيانات محلياً للنشر عبر GitHub Pages.
            </p>
          </div>
          {form.github?.lastSyncAt && (
            <span className="text-xs text-slate-500 tabular-nums dark:text-slate-400">
              آخر مزامنة: {form.github.lastSyncAt}
            </span>
          )}
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-400">
              مستودع GitHub (owner/repo)
            </label>
            <input
              dir="ltr"
              value={form.github?.repo || ''}
              onChange={(e) =>
                setForm({
                  ...form,
                  github: { ...form.github!, repo: e.target.value },
                })
              }
              placeholder="username/al-thakireen-lms"
              className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 font-mono text-xs dark:border-slate-700 dark:bg-slate-800"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-400">
              الفرع (Branch)
            </label>
            <input
              dir="ltr"
              value={form.github?.branch || 'main'}
              onChange={(e) =>
                setForm({
                  ...form,
                  github: { ...form.github!, branch: e.target.value },
                })
              }
              placeholder="main"
              className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 font-mono text-xs dark:border-slate-700 dark:bg-slate-800"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-400">
              مسار ملف JSON في المستودع
            </label>
            <input
              dir="ltr"
              value={form.github?.filePath || 'data/al-thakireen-backup.json'}
              onChange={(e) =>
                setForm({
                  ...form,
                  github: { ...form.github!, filePath: e.target.value },
                })
              }
              className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 font-mono text-xs dark:border-slate-700 dark:bg-slate-800"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-400">
              رمز الوصول GitHub Token (للرفع فقط)
            </label>
            <input
              type="password"
              dir="ltr"
              value={githubToken}
              onChange={(e) => setGithubToken(e.target.value)}
              placeholder="ghp_..."
              className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 font-mono text-xs dark:border-slate-700 dark:bg-slate-800"
            />
          </div>
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            disabled={syncBusy}
            onClick={handlePushGitHub}
            className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-slate-900 px-3.5 py-2 text-xs font-bold text-white hover:bg-slate-800 disabled:opacity-50 dark:bg-slate-700"
          >
            <CloudUpload className="h-4 w-4" />
            <span>رفع وحفظ على GitHub</span>
          </button>
          <button
            type="button"
            disabled={syncBusy}
            onClick={handlePullGitHub}
            className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
          >
            <CloudDownload className="h-4 w-4" />
            <span>جلب من GitHub</span>
          </button>
          <button
            type="button"
            onClick={handleDownloadStandaloneHtmlArchive}
            className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
          >
            <FileCode2 className="h-4 w-4" />
            <span>تصدير أرشيف HTML مستقل</span>
          </button>
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
        <h3 className="mb-2 text-base font-bold text-slate-900 dark:text-slate-100">
          النسخ الاحتياطي بصيغة JSON واستعادة البيانات (يدعم النسخة القديمة V6)
        </h3>
        <p className="mb-4 text-xs text-slate-500 dark:text-slate-400">
          تُحفظ بياناتك محلياً تلقائياً. يمكنك تنزيل نسخة JSON للاحتفاظ بها أو استيراد ملف نسخة سابقة.
        </p>
        <div className="flex flex-wrap gap-2.5">
          <button
            type="button"
            onClick={handleDownloadJson}
            className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-emerald-800 px-3.5 py-2 text-xs font-bold text-white hover:bg-emerald-700 dark:bg-emerald-600"
          >
            <Download className="h-4 w-4" />
            <span>تنزيل نسخة احتياطية (JSON)</span>
          </button>
          <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200">
            <Upload className="h-4 w-4" />
            <span>استعادة / استيراد ملف JSON</span>
            <input type="file" accept=".json" onChange={handleRestoreJson} className="hidden" />
          </label>
          <button
            type="button"
            onClick={() => {
              if (!window.confirm('استعادة البيانات التجريبية؟')) return;
              const demo = createDemoData();
              onReplaceDatabase(demo);
              setForm({ ...demo.settings, rules: { ...demo.settings.rules } });
              onNotify('تمت استعادة البيانات التجريبية');
            }}
            className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-amber-500 px-3.5 py-2 text-xs font-bold text-slate-950 hover:bg-amber-400"
          >
            <RotateCcw className="h-4 w-4" />
            <span>استعادة البيانات التجريبية</span>
          </button>
          <button
            type="button"
            onClick={() => {
              if (!window.confirm('حذف جميع الطلبة والدرجات والغيابات مع بقاء الهيكل الدراسي؟')) return;
              onClearStudents();
              onNotify('تم تفريغ السجل للبدء من جديد');
            }}
            className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-red-600 px-3.5 py-2 text-xs font-bold text-white hover:bg-red-500"
          >
            <Trash2 className="h-4 w-4" />
            <span>بدء سجل فارغ بدون طلبة</span>
          </button>
        </div>
      </section>
    </div>
  );
}
