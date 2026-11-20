import { useState } from 'react';
import { BookOpenCheck, Eye, EyeOff, GraduationCap, Lock, ShieldCheck, UserCheck } from 'lucide-react';
import type { AppDatabase, AuthRole, AuthSession } from '../types/gradebook';
import { authenticateRole } from '../utils/evaluation';

interface LockScreenProps {
  db: AppDatabase;
  onLoginSuccess: (session: AuthSession) => void;
}

export function LockScreen({ db, onLoginSuccess }: LockScreenProps) {
  const [role, setRole] = useState<AuthRole>('admin');
  const [pin, setPin] = useState('');
  const [showPin, setShowPin] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const res = authenticateRole(db, role, pin);
    if (res.ok && res.session) {
      setError('');
      setPin('');
      onLoginSuccess(res.session);
    } else {
      setError(res.error || 'بيانات الدخول غير صحيحة');
    }
  };

  const handleQuickDemo = (targetRole: AuthRole, demoPin: string) => {
    setRole(targetRole);
    setPin(demoPin);
    const res = authenticateRole(db, targetRole, demoPin);
    if (res.ok && res.session) {
      setError('');
      onLoginSuccess(res.session);
    }
  };

  const roles: Array<{ id: AuthRole; label: string; icon: typeof ShieldCheck; hint: string }> = [
    { id: 'admin', label: 'الإدارة (مدير)', icon: ShieldCheck, hint: 'صلاحية كاملة على جميع المواد والشعب والضوابط' },
    { id: 'teacher', label: 'المدرس', icon: GraduationCap, hint: 'دخول معزول لمواد وشعب المدرس فقط برمز PIN' },
    { id: 'parent', label: 'ولي الأمر', icon: UserCheck, hint: 'متابعة درجات وحضور الطالب أو عدة أبناء بالـ PIN' },
  ];

  const activeMeta = roles.find((r) => r.id === role)!;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-100 p-4 dark:bg-slate-950">
      <div className="grid w-full max-w-4xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900 lg:grid-cols-12">
        {/* Right Institutional Brand Panel */}
        <div className="flex flex-col justify-between bg-emerald-900 p-7 text-white dark:bg-emerald-950 lg:col-span-5">
          <div>
            <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-xl bg-white/15 text-xl font-extrabold">
              ذ
            </div>
            <p className="text-xs font-semibold text-emerald-200">
              {db.settings.directorate} · {db.settings.academicYear}
            </p>
            <h1 className="mt-1.5 text-2xl font-extrabold leading-snug text-white">
              {db.settings.schoolName}
            </h1>
            <p className="mt-2 text-xs leading-relaxed text-emerald-100/90">
              منصة السجل الذكي · {db.settings.academicYear} · بإشراف {db.settings.teacherName}
            </p>
          </div>

          <div className="mt-8 space-y-3 border-t border-white/15 pt-5 text-xs text-emerald-100">
            <div className="flex items-start gap-2.5">
              <BookOpenCheck className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" />
              <span>احتساب آلي لليومي من 100 ومعدل الفصول والسعي السنوي والإعفاء الفردي والكلي.</span>
            </div>
            <div className="flex items-start gap-2.5">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" />
              <span>عزل برمجي لدرجات كل مادة وصلاحيات دخول مخصصة للإدارة والمدرسين وأولياء الأمور.</span>
            </div>
          </div>
        </div>

        {/* Left Sign-In Form */}
        <div className="flex flex-col justify-center p-6 sm:p-8 lg:col-span-7">
          <div className="mb-5 flex items-center justify-between gap-2">
            <div>
              <h2 className="text-lg font-extrabold text-slate-900 dark:text-slate-100">
                بوابة تسجيل الدخول الموحدة
              </h2>
              <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                اختر نوع الحساب وأدخل رمز الدخول المخصص للمتابعة
              </p>
            </div>
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-emerald-800 dark:border-slate-700 dark:bg-slate-800 dark:text-emerald-400">
              <Lock className="h-5 w-5" />
            </div>
          </div>

          <div className="mb-4 grid grid-cols-3 gap-1.5 rounded-xl bg-slate-100 p-1 dark:bg-slate-800">
            {roles.map((r) => {
              const Icon = r.icon;
              const selected = role === r.id;
              return (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => {
                    setRole(r.id);
                    setError('');
                    setPin('');
                  }}
                  className={`flex cursor-pointer items-center justify-center gap-1.5 rounded-lg px-2 py-2.5 text-xs font-bold whitespace-nowrap transition-colors ${
                    selected
                      ? 'bg-white text-emerald-800 shadow-sm dark:bg-slate-900 dark:text-emerald-400'
                      : 'text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white'
                  }`}
                >
                  <Icon className="h-3.5 w-3.5 shrink-0" />
                  <span>{r.label}</span>
                </button>
              );
            })}
          </div>

          <p className="mb-4 rounded-lg bg-slate-50 px-3 py-2 text-center text-xs font-medium text-slate-600 dark:bg-slate-800/60 dark:text-slate-300">
            {activeMeta.hint}
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="role-pin-input" className="mb-1.5 block text-xs font-bold text-slate-700 dark:text-slate-300">
                {role === 'admin'
                  ? 'رمز دخول الإدارة (PIN)'
                  : role === 'teacher'
                  ? 'الرمز الخاص بالمدرس (PIN)'
                  : 'رمز الطالب أو عدة أبناء (مثل: 1111, 2222)'}
              </label>
              <div className="relative">
                <input
                  id="role-pin-input"
                  type={role === 'parent' || showPin ? 'text' : 'password'}
                  dir="ltr"
                  value={pin}
                  onChange={(e) => {
                    setPin(e.target.value);
                    if (error) setError('');
                  }}
                  placeholder={role === 'admin' ? '0000' : role === 'teacher' ? '1010' : '1111, 2222'}
                  className="w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-3 text-center font-mono text-base font-bold text-slate-900 transition-colors focus:border-emerald-700 focus:bg-white focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:focus:bg-slate-900"
                  autoFocus
                />
                {role !== 'parent' && (
                  <button
                    type="button"
                    aria-label={showPin ? 'إخفاء الرمز' : 'إظهار الرمز'}
                    onClick={() => setShowPin((v) => !v)}
                    className="absolute inset-y-0 left-2 flex cursor-pointer items-center px-2 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                  >
                    {showPin ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                )}
              </div>
            </div>

            <button
              type="submit"
              className="w-full cursor-pointer rounded-xl bg-emerald-800 px-4 py-3 text-sm font-bold text-white transition-colors hover:bg-emerald-700 dark:bg-emerald-600 dark:hover:bg-emerald-500"
            >
              تسجيل الدخول
            </button>

            {error && (
              <p role="alert" className="text-center text-xs font-semibold text-red-600 dark:text-red-400">
                {error}
              </p>
            )}
          </form>

          <div className="mt-6 border-t border-slate-200 pt-4 dark:border-slate-800">
            <div className="mb-2.5 text-center text-xs font-semibold text-slate-500 dark:text-slate-400">
              دخول سريع للحسابات التجريبية
            </div>
            <div className="flex flex-wrap justify-center gap-2">
              <button
                type="button"
                onClick={() => handleQuickDemo('admin', db.settings.adminPin || '0000')}
                className="cursor-pointer rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700 transition-colors hover:border-emerald-600 hover:bg-emerald-50 hover:text-emerald-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
              >
                مدير ({db.settings.adminPin || '0000'})
              </button>
              {db.teachers[0] && (
                <button
                  type="button"
                  onClick={() => handleQuickDemo('teacher', db.teachers[0].pin)}
                  className="cursor-pointer rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700 transition-colors hover:border-emerald-600 hover:bg-emerald-50 hover:text-emerald-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                >
                  {db.teachers[0].specialty} ({db.teachers[0].pin})
                </button>
              )}
              <button
                type="button"
                onClick={() => handleQuickDemo('parent', '1111, 2222')}
                className="cursor-pointer rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700 transition-colors hover:border-emerald-600 hover:bg-emerald-50 hover:text-emerald-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
              >
                ولي أمر (1111)
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
