import {
  BarChart3,
  BookOpen,
  CalendarCheck,
  CalendarDays,
  Layers,
  LayoutDashboard,
  LogOut,
  Moon,
  Settings,
  Sparkles,
  Sun,
  UserCheck,
  Users,
  X,
} from 'lucide-react';
import type { AuthRole, NavView } from '../types/gradebook';

type NavGroup = 'teaching' | 'management' | 'system';

export const NAV_ITEMS: Array<{
  id: NavView;
  label: string;
  icon: typeof LayoutDashboard;
  roles: AuthRole[];
  group: NavGroup;
}> = [
  { id: 'dashboard', label: 'لوحة التحكم', icon: LayoutDashboard, roles: ['admin', 'teacher'], group: 'teaching' },
  { id: 'grades', label: 'سجل الدرجات', icon: BookOpen, roles: ['admin', 'teacher'], group: 'teaching' },
  { id: 'schedule', label: 'جدول الحصص اليومي', icon: CalendarDays, roles: ['admin', 'teacher'], group: 'teaching' },
  { id: 'tools', label: 'عجلة المشاركة وأسئلة A4', icon: Sparkles, roles: ['admin', 'teacher'], group: 'teaching' },
  { id: 'students', label: 'الطلبة والشعب', icon: Users, roles: ['admin', 'teacher'], group: 'management' },
  { id: 'attendance', label: 'الحضور وواتساب', icon: CalendarCheck, roles: ['admin', 'teacher'], group: 'management' },
  { id: 'reports', label: 'التقارير والإحصائيات', icon: BarChart3, roles: ['admin', 'teacher'], group: 'management' },
  { id: 'structure', label: 'الهيكل والمعلمون', icon: Layers, roles: ['admin'], group: 'system' },
  { id: 'parent', label: 'بوابة ولي الأمر', icon: UserCheck, roles: ['admin', 'parent'], group: 'system' },
  { id: 'settings', label: 'الضوابط والمزامنة', icon: Settings, roles: ['admin'], group: 'system' },
];

const GROUP_TITLES: Record<NavGroup, string> = {
  teaching: 'التدريس والتقييم',
  management: 'الطلبة والتقارير',
  system: 'الهيكل والنظام',
};

interface SidebarProps {
  activeView: NavView;
  onSelectView: (view: NavView) => void;
  schoolName: string;
  displayName: string;
  role: AuthRole;
  darkMode: boolean;
  onToggleDark: () => void;
  onSwitchAccount: () => void;
  mobileOpen: boolean;
  onCloseMobile: () => void;
}

export function Sidebar({
  activeView,
  onSelectView,
  schoolName,
  displayName,
  role,
  darkMode,
  onToggleDark,
  onSwitchAccount,
  mobileOpen,
  onCloseMobile,
}: SidebarProps) {
  const visibleItems = NAV_ITEMS.filter((item) => item.roles.includes(role));
  const roleLabel = role === 'admin' ? 'مدير النظام' : role === 'teacher' ? 'مدرس' : 'ولي أمر';
  const groups: NavGroup[] = ['teaching', 'management', 'system'];

  return (
    <>
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-900/45 backdrop-blur-[1px] lg:hidden"
          onClick={onCloseMobile}
          aria-hidden="true"
        />
      )}
      <aside
        aria-label="القائمة الرئيسية"
        className={`no-print fixed inset-y-0 right-0 z-50 flex w-64 shrink-0 flex-col border-l border-slate-200 bg-white transition-transform duration-200 dark:border-slate-800 dark:bg-slate-900 lg:sticky lg:top-0 lg:h-screen lg:translate-x-0 ${
          mobileOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <div className="flex items-center justify-between gap-3 border-b border-emerald-900/15 bg-emerald-900 px-4 py-4 text-white dark:bg-emerald-950">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/15 text-lg font-extrabold">
              ذ
            </div>
            <div className="min-w-0">
              <h1 className="truncate text-sm font-bold leading-snug">{schoolName}</h1>
              <p className="truncate text-[11px] text-emerald-100/90">
                {displayName} · {roleLabel}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onCloseMobile}
            aria-label="إغلاق القائمة"
            className="rounded-lg p-1.5 text-emerald-100 hover:bg-white/10 lg:hidden"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="flex flex-1 flex-col gap-4 overflow-y-auto px-3 py-4">
          {groups.map((grp) => {
            const groupItems = visibleItems.filter((item) => item.group === grp);
            if (!groupItems.length) return null;
            return (
              <div key={grp} className="space-y-1">
                {visibleItems.length > 1 && (
                  <div className="px-2.5 pb-1 text-[11px] font-bold text-slate-400 dark:text-slate-500">
                    {GROUP_TITLES[grp]}
                  </div>
                )}
                {groupItems.map((item) => {
                  const Icon = item.icon;
                  const active = activeView === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => {
                        onSelectView(item.id);
                        onCloseMobile();
                      }}
                      className={`flex w-full cursor-pointer items-center gap-2.5 rounded-lg px-3 py-2 text-right text-[13px] font-semibold whitespace-nowrap transition-colors ${
                        active
                          ? 'bg-emerald-50 text-emerald-900 ring-1 ring-emerald-200 dark:bg-emerald-950/70 dark:text-emerald-300 dark:ring-emerald-800/80'
                          : 'text-slate-700 hover:bg-slate-100/80 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800/70 dark:hover:text-white'
                      }`}
                    >
                      <Icon
                        className={`h-4 w-4 shrink-0 ${
                          active ? 'text-emerald-700 dark:text-emerald-400' : 'text-slate-400 dark:text-slate-500'
                        }`}
                      />
                      <span className="truncate">{item.label}</span>
                    </button>
                  );
                })}
              </div>
            );
          })}
        </nav>

        <div className="flex flex-col gap-2 border-t border-slate-200 bg-slate-50/70 p-3 dark:border-slate-800 dark:bg-slate-900/60">
          {role === 'admin' && (
            <button
              type="button"
              onClick={() => {
                onSelectView('parent');
                onCloseMobile();
              }}
              className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs font-bold text-amber-900 whitespace-nowrap transition-colors hover:bg-amber-100 dark:border-amber-700/70 dark:bg-amber-950/40 dark:text-amber-300 dark:hover:bg-amber-950/70"
            >
              <UserCheck className="h-4 w-4 shrink-0" />
              <span>معاينة بوابة ولي الأمر</span>
            </button>
          )}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onToggleDark}
              className="flex flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs font-semibold text-slate-700 whitespace-nowrap transition-colors hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
            >
              {darkMode ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
              <span>{darkMode ? 'نهاري' : 'ليلي'}</span>
            </button>
            <button
              type="button"
              onClick={onSwitchAccount}
              className="flex flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs font-semibold text-slate-700 whitespace-nowrap transition-colors hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
            >
              <LogOut className="h-3.5 w-3.5" />
              <span>تبديل الحساب</span>
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}
