import { useEffect, useMemo, useRef, useState } from 'react';
import { AttendanceView } from './components/AttendanceView';
import { DashboardView } from './components/DashboardView';
import { type GoogleFormsImportTarget } from './components/GoogleFormsPanel';
import { GradesView } from './components/GradesView';
import { LockScreen } from './components/LockScreen';
import { ParentPortalView } from './components/ParentPortalView';
import { PrintArea, type PrintJob } from './components/PrintArea';
import { QuickGradeModal } from './components/QuickGradeModal';
import { ReportsView } from './components/ReportsView';
import { ScheduleView } from './components/ScheduleView';
import { SettingsView } from './components/SettingsView';
import { Sidebar } from './components/Sidebar';
import { StructureView } from './components/StructureView';
import { StudentsView } from './components/StudentsView';
import { ToolsView } from './components/ToolsView';
import { TopBar } from './components/TopBar';
import type {
  AcademicContext,
  AppDatabase,
  AuthSession,
  DailyAttendanceStatus,
  NavView,
  NoteCategory,
  ParentSharePayload,
  ScheduleSlot,
  SchoolSettings,
  Student,
  SubjectTermConfig,
  TeacherAccount,
} from './types/gradebook';
import {
  createDefaultTermConfig,
  createEmptyMonthGrade,
  getAllowedTeacherScope,
  round1,
  setIsolatedGradeRecord,
  uid,
} from './utils/evaluation';
import { loadDatabase, parseParentShareHash, saveDatabase } from './utils/storage';

const SESSION_STORAGE_KEY = 'al_thakireen_auth_session_v2';

function resolveContext(
  db: AppDatabase,
  prev: AcademicContext,
  session: AuthSession | null
): AcademicContext {
  const { allowedSectionIds, allowedSubjectIds } = getAllowedTeacherScope(db, session);

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
  const visibleGradesAll =
    session?.role === 'teacher'
      ? db.grades.filter((g) => allowedGradeIds.has(g.id))
      : db.grades;
  const allowedStageIds = new Set(visibleGradesAll.map((g) => g.stageId));
  const visibleStagesAll =
    session?.role === 'teacher'
      ? db.stages.filter((st) => allowedStageIds.has(st.id))
      : db.stages;

  const stageId = visibleStagesAll.some((s) => s.id === prev.stageId)
    ? prev.stageId
    : visibleStagesAll.find((s) => s.id === 'stg_prep')?.id || visibleStagesAll[0]?.id || '';

  const grades = visibleGradesAll.filter((g) => g.stageId === stageId);
  const gradeId = grades.some((g) => g.id === prev.gradeId)
    ? prev.gradeId
    : grades.find((g) => g.id === 'grd_5s')?.id || grades[0]?.id || '';

  const sections = visibleSectionsAll.filter((s) => s.gradeId === gradeId);
  const sectionId = sections.some((s) => s.id === prev.sectionId)
    ? prev.sectionId
    : sections[0]?.id || '';

  const subjects = visibleSubjectsAll.filter((sb) => sb.gradeId === gradeId);
  const subjectId = subjects.some((sb) => sb.id === prev.subjectId)
    ? prev.subjectId
    : subjects[0]?.id || '';

  return { stageId, gradeId, sectionId, subjectId };
}

function getInitialSession(db: AppDatabase): AuthSession | null {
  try {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.get('autostart') === '1') {
        return { role: 'admin', displayName: `الإدارة (${db.settings.teacherName})` };
      }
      const saved = sessionStorage.getItem(SESSION_STORAGE_KEY);
      if (saved) {
        return JSON.parse(saved) as AuthSession;
      }
    }
  } catch {
    // ignore
  }
  return null;
}

export default function App() {
  const [db, setDb] = useState<AppDatabase>(() => loadDatabase());
  const [session, setSession] = useState<AuthSession | null>(() => getInitialSession(loadDatabase()));
  const [activeView, setActiveView] = useState<NavView>(() =>
    session?.role === 'parent' ? 'parent' : 'dashboard'
  );
  const [rawCtx, setRawCtx] = useState<AcademicContext>({
    stageId: '',
    gradeId: '',
    sectionId: '',
    subjectId: '',
  });
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [selectedReportStudentId, setSelectedReportStudentId] = useState('');
  const [openAddStudentFlag, setOpenAddStudentFlag] = useState(false);
  const [quickGradeState, setQuickGradeState] = useState<{
    open: boolean;
    termKey: 'term1Months' | 'term2Months';
    monthId: string;
  }>({ open: false, termKey: 'term1Months', monthId: 'm1' });
  const [toastMsg, setToastMsg] = useState('');
  const [printJob, setPrintJob] = useState<PrintJob | null>(null);
  const [standalonePayload, setStandalonePayload] = useState<ParentSharePayload | null>(() =>
    typeof window !== 'undefined' ? parseParentShareHash(window.location.hash) : null
  );

  const toastTimerRef = useRef<number | null>(null);

  const ctx = useMemo(() => resolveContext(db, rawCtx, session), [db, rawCtx, session]);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', db.settings.darkMode);
  }, [db.settings.darkMode]);

  useEffect(() => {
    const onHash = () => {
      setStandalonePayload(parseParentShareHash(window.location.hash));
    };
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  useEffect(() => {
    if (!printJob) return;
    const frame = window.requestAnimationFrame(() => {
      window.print();
    });
    return () => window.cancelAnimationFrame(frame);
  }, [printJob]);

  const updateDb = (updater: (prev: AppDatabase) => AppDatabase) => {
    setDb((prev) => {
      const next = updater(prev);
      saveDatabase(next);
      return next;
    });
  };

  const notify = (msg: string) => {
    setToastMsg(msg);
    if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
    toastTimerRef.current = window.setTimeout(() => setToastMsg(''), 2800);
  };

  const handleLoginSuccess = (nextSession: AuthSession) => {
    setSession(nextSession);
    try {
      sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(nextSession));
    } catch {
      // ignore
    }
    setActiveView(nextSession.role === 'parent' ? 'parent' : 'dashboard');
    setRawCtx({ stageId: '', gradeId: '', sectionId: '', subjectId: '' });
  };

  const handleSwitchAccount = () => {
    setSession(null);
    try {
      sessionStorage.removeItem(SESSION_STORAGE_KEY);
    } catch {
      // ignore
    }
  };

  if (standalonePayload) {
    return (
      <div className="min-h-screen bg-slate-50 px-4 py-6 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
        <div className="mx-auto max-w-3xl">
          <ParentPortalView standalonePayload={standalonePayload} />
        </div>
      </div>
    );
  }

  if (!session) {
    return <LockScreen db={db} onLoginSuccess={handleLoginSuccess} />;
  }

  const handleUpdateMonthDailyScore = (
    studentId: string,
    subjectId: string,
    term: 'term1Months' | 'term2Months',
    monthId: string,
    sectionId: string,
    value: number | ''
  ) => {
    updateDb((prev) =>
      setIsolatedGradeRecord(prev, studentId, subjectId, (cur) => {
        const curMonth = cur[term]?.[monthId] || createEmptyMonthGrade();
        return {
          ...cur,
          [term]: {
            ...cur[term],
            [monthId]: {
              ...curMonth,
              dailyScores: {
                ...curMonth.dailyScores,
                [sectionId]: value,
              },
            },
          },
        };
      })
    );
  };

  const handleUpdateMonthWritten = (
    studentId: string,
    subjectId: string,
    term: 'term1Months' | 'term2Months',
    monthId: string,
    value: number | ''
  ) => {
    updateDb((prev) =>
      setIsolatedGradeRecord(prev, studentId, subjectId, (cur) => {
        const curMonth = cur[term]?.[monthId] || createEmptyMonthGrade();
        return {
          ...cur,
          [term]: {
            ...cur[term],
            [monthId]: {
              ...curMonth,
              written: value,
            },
          },
        };
      })
    );
  };

  const handleUpdateCoreGrade = (
    studentId: string,
    subjectId: string,
    field: 'mid' | 'part' | 'final' | 'midStatus' | 'finalStatus',
    value: string | number
  ) => {
    updateDb((prev) =>
      setIsolatedGradeRecord(prev, studentId, subjectId, (cur) => ({
        ...cur,
        [field]: value,
      }))
    );
  };

  const handleApplyGoogleFormsGrades = (
    subjectId: string,
    target: GoogleFormsImportTarget,
    entries: Array<{ studentId: string; score: number }>
  ) => {
    if (!entries.length) return;
    updateDb((prev) => {
      let next = prev;
      entries.forEach(({ studentId, score }) => {
        next = setIsolatedGradeRecord(next, studentId, subjectId, (cur) => {
          if (target.kind === 'daily') {
            const curMonth = cur[target.termKey]?.[target.monthId] || createEmptyMonthGrade();
            return {
              ...cur,
              [target.termKey]: {
                ...cur[target.termKey],
                [target.monthId]: {
                  ...curMonth,
                  dailyScores: {
                    ...curMonth.dailyScores,
                    [target.sectionId]: score,
                  },
                },
              },
            };
          }
          if (target.kind === 'written') {
            const curMonth = cur[target.termKey]?.[target.monthId] || createEmptyMonthGrade();
            return {
              ...cur,
              [target.termKey]: {
                ...cur[target.termKey],
                [target.monthId]: {
                  ...curMonth,
                  written: score,
                },
              },
            };
          }
          if (target.kind === 'mid') {
            return {
              ...cur,
              mid: score,
              midStatus: 'present',
            };
          }
          return {
            ...cur,
            final: score,
            finalStatus: 'present',
          };
        });
      });
      return next;
    });
  };

  const handleUpdateSubjectTermConfig = (subjectId: string, nextConfig: SubjectTermConfig) => {
    updateDb((prev) => ({
      ...prev,
      subjects: prev.subjects.map((sb) =>
        sb.id === subjectId ? { ...sb, termConfig: nextConfig } : sb
      ),
    }));
  };

  const handleSaveStudent = (student: Student) => {
    updateDb((prev) => {
      const exists = prev.students.some((s) => s.id === student.id);
      return {
        ...prev,
        students: exists
          ? prev.students.map((s) => (s.id === student.id ? student : s))
          : [...prev.students, student],
      };
    });
  };

  const handleBulkAddStudents = (added: Student[]) => {
    updateDb((prev) => ({
      ...prev,
      students: [...prev.students, ...added],
    }));
  };

  const handleDeleteStudent = (studentId: string) => {
    updateDb((prev) => ({
      ...prev,
      students: prev.students.filter((s) => s.id !== studentId),
      notes: prev.notes.filter((n) => n.studentId !== studentId),
    }));
  };

  const handleSetAttendance = (
    sectionId: string,
    date: string,
    studentId: string,
    status: DailyAttendanceStatus
  ) => {
    updateDb((prev) => {
      const idx = prev.attendance.findIndex((a) => a.date === date && a.sectionId === sectionId);
      if (idx === -1) {
        return {
          ...prev,
          attendance: [
            ...prev.attendance,
            { id: uid('att'), date, sectionId, records: { [studentId]: status } },
          ],
        };
      }
      const nextAtt = [...prev.attendance];
      nextAtt[idx] = {
        ...nextAtt[idx],
        records: { ...nextAtt[idx].records, [studentId]: status },
      };
      return { ...prev, attendance: nextAtt };
    });
  };

  const handleMarkAllPresent = (sectionId: string, date: string, studentIds: string[]) => {
    updateDb((prev) => {
      const idx = prev.attendance.findIndex((a) => a.date === date && a.sectionId === sectionId);
      const existingRecords = idx >= 0 ? prev.attendance[idx].records : {};
      const nextRecords: Record<string, DailyAttendanceStatus> = { ...existingRecords };
      studentIds.forEach((id) => {
        nextRecords[id] = 'present';
      });
      if (idx === -1) {
        return {
          ...prev,
          attendance: [...prev.attendance, { id: uid('att'), date, sectionId, records: nextRecords }],
        };
      }
      const nextAtt = [...prev.attendance];
      nextAtt[idx] = { ...nextAtt[idx], records: nextRecords };
      return { ...prev, attendance: nextAtt };
    });
  };

  const handleAwardParticipation = (studentId: string, subjectId: string, points: number) => {
    updateDb((prev) =>
      setIsolatedGradeRecord(prev, studentId, subjectId, (cur) => ({
        ...cur,
        part: Math.min(100, round1(Number(cur.part || 0) + points)),
      }))
    );
  };

  const handleAddNote = (studentId: string, type: NoteCategory, text: string) => {
    updateDb((prev) => ({
      ...prev,
      notes: [
        ...prev.notes,
        { id: uid('not'), studentId, type, text, date: new Date().toISOString().slice(0, 10) },
      ],
    }));
  };

  const handleSaveSettings = (nextSettings: SchoolSettings) => {
    updateDb((prev) => ({
      ...prev,
      settings: nextSettings,
    }));
  };

  const handleSaveScheduleSlot = (slot: ScheduleSlot) => {
    updateDb((prev) => ({
      ...prev,
      schedule: [...(prev.schedule || []), slot],
    }));
  };

  const handleDeleteScheduleSlot = (id: string) => {
    updateDb((prev) => ({
      ...prev,
      schedule: (prev.schedule || []).filter((s) => s.id !== id),
    }));
  };

  const handleSaveTeacher = (teacher: TeacherAccount) => {
    updateDb((prev) => {
      const exists = prev.teachers.some((t) => t.id === teacher.id);
      return {
        ...prev,
        teachers: exists
          ? prev.teachers.map((t) => (t.id === teacher.id ? teacher : t))
          : [...prev.teachers, teacher],
      };
    });
  };

  const handleDeleteTeacher = (id: string) => {
    updateDb((prev) => ({
      ...prev,
      teachers: prev.teachers.filter((t) => t.id !== id),
    }));
  };

  const handleAddSection = (gradeId: string, name: string) => {
    updateDb((prev) => ({
      ...prev,
      sections: [...prev.sections, { id: uid('sec'), gradeId, name }],
    }));
    notify('تمت إضافة الشعبة');
  };

  const handleDeleteSection = (id: string) => {
    updateDb((prev) => ({
      ...prev,
      sections: prev.sections.filter((s) => s.id !== id),
      students: prev.students.filter((st) => st.sectionId !== id),
      schedule: (prev.schedule || []).filter((sl) => sl.sectionId !== id),
    }));
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <div className="no-print flex min-h-screen">
        <Sidebar
          activeView={activeView}
          onSelectView={setActiveView}
          schoolName={db.settings.schoolName}
          displayName={session.displayName}
          role={session.role}
          darkMode={db.settings.darkMode}
          onToggleDark={() =>
            updateDb((prev) => ({
              ...prev,
              settings: { ...prev.settings, darkMode: !prev.settings.darkMode },
            }))
          }
          onSwitchAccount={handleSwitchAccount}
          mobileOpen={mobileMenuOpen}
          onCloseMobile={() => setMobileMenuOpen(false)}
        />

        <div className="flex min-w-0 flex-1 flex-col">
          <TopBar
            activeView={activeView}
            db={db}
            ctx={ctx}
            session={session}
            onChangeContext={(next) => setRawCtx((prev) => ({ ...prev, ...next }))}
            onOpenMobileMenu={() => setMobileMenuOpen(true)}
          />

          <main className="mx-auto w-full max-w-[1400px] flex-1 p-4 sm:p-6">
            {activeView === 'dashboard' && session.role !== 'parent' && (
              <DashboardView
                db={db}
                ctx={ctx}
                session={session}
                onNavigate={setActiveView}
                onOpenAddStudent={() => {
                  setOpenAddStudentFlag(true);
                  setActiveView('students');
                }}
                onOpenQuickGrade={() =>
                  setQuickGradeState({ open: true, termKey: 'term1Months', monthId: 'm1' })
                }
              />
            )}

            {activeView === 'grades' && session.role !== 'parent' && (
              <GradesView
                db={db}
                ctx={ctx}
                onUpdateMonthDailyScore={handleUpdateMonthDailyScore}
                onUpdateMonthWritten={handleUpdateMonthWritten}
                onUpdateCoreGrade={handleUpdateCoreGrade}
                onUpdateSubjectTermConfig={handleUpdateSubjectTermConfig}
                onApplyImportedGrades={handleApplyGoogleFormsGrades}
                onNavigate={setActiveView}
                onOpenQuickGrade={(termKey = 'term1Months', monthId = 'm1') =>
                  setQuickGradeState({ open: true, termKey, monthId })
                }
                onPrintHtml={(html) => setPrintJob({ kind: 'section_grades', html })}
                onNotify={notify}
              />
            )}

            {activeView === 'schedule' && session.role !== 'parent' && (
              <ScheduleView
                db={db}
                ctx={ctx}
                session={session}
                onSaveSlot={handleSaveScheduleSlot}
                onDeleteSlot={handleDeleteScheduleSlot}
                onJumpToContext={(next, view) => {
                  setRawCtx((prev) => ({ ...prev, ...next }));
                  setActiveView(view);
                }}
                onPrintHtml={(html) => setPrintJob({ kind: 'section_grades', html })}
                onNotify={notify}
              />
            )}

            {activeView === 'students' && session.role !== 'parent' && (
              <StudentsView
                db={db}
                ctx={ctx}
                session={session}
                onSaveStudent={handleSaveStudent}
                onBulkAddStudents={handleBulkAddStudents}
                onDeleteStudent={handleDeleteStudent}
                onAddSection={handleAddSection}
                onDeleteSection={handleDeleteSection}
                onViewStudentReport={(id) => {
                  setSelectedReportStudentId(id);
                  setActiveView('reports');
                }}
                onNotify={notify}
                showAddOnMount={openAddStudentFlag}
                onClearAddOnMount={() => setOpenAddStudentFlag(false)}
              />
            )}

            {activeView === 'attendance' && session.role !== 'parent' && (
              <AttendanceView
                db={db}
                ctx={ctx}
                onSetAttendance={handleSetAttendance}
                onMarkAllPresent={handleMarkAllPresent}
                onNotify={notify}
              />
            )}

            {activeView === 'reports' && session.role !== 'parent' && (
              <ReportsView
                db={db}
                ctx={ctx}
                session={session}
                selectedStudentId={selectedReportStudentId}
                onSelectStudent={setSelectedReportStudentId}
                onPrintHtml={(html) => setPrintJob({ kind: 'student_report', html })}
                onNotify={notify}
              />
            )}

            {activeView === 'tools' && session.role !== 'parent' && (
              <ToolsView
                db={db}
                ctx={ctx}
                onAwardParticipation={handleAwardParticipation}
                onAddNote={handleAddNote}
                onApplyImportedGrades={handleApplyGoogleFormsGrades}
                onPrintHtml={(html) => setPrintJob({ kind: 'official_exam', html })}
                onNotify={notify}
              />
            )}

            {activeView === 'structure' && session.role === 'admin' && (
              <StructureView
                db={db}
                ctx={ctx}
                onAddStage={(name) => {
                  updateDb((prev) => ({
                    ...prev,
                    stages: [...prev.stages, { id: uid('stg'), name }],
                  }));
                  notify('تمت إضافة المرحلة');
                }}
                onDeleteStage={(id) => {
                  updateDb((prev) => {
                    const gIds = prev.grades.filter((g) => g.stageId === id).map((g) => g.id);
                    const sIds = prev.sections.filter((s) => gIds.includes(s.gradeId)).map((s) => s.id);
                    return {
                      ...prev,
                      stages: prev.stages.filter((s) => s.id !== id),
                      grades: prev.grades.filter((g) => g.stageId !== id),
                      sections: prev.sections.filter((s) => !gIds.includes(s.gradeId)),
                      subjects: prev.subjects.filter((sb) => !gIds.includes(sb.gradeId)),
                      students: prev.students.filter((st) => !sIds.includes(st.sectionId)),
                    };
                  });
                }}
                onAddGrade={(stageId, name) => {
                  updateDb((prev) => ({
                    ...prev,
                    grades: [...prev.grades, { id: uid('grd'), stageId, name }],
                  }));
                  notify('تمت إضافة الصف');
                }}
                onDeleteGrade={(id) => {
                  updateDb((prev) => {
                    const sIds = prev.sections.filter((s) => s.gradeId === id).map((s) => s.id);
                    return {
                      ...prev,
                      grades: prev.grades.filter((g) => g.id !== id),
                      sections: prev.sections.filter((s) => s.gradeId !== id),
                      subjects: prev.subjects.filter((sb) => sb.gradeId !== id),
                      students: prev.students.filter((st) => !sIds.includes(st.sectionId)),
                    };
                  });
                }}
                onAddSection={handleAddSection}
                onDeleteSection={handleDeleteSection}
                onAddSubject={(gradeId, name) => {
                  updateDb((prev) => ({
                    ...prev,
                    subjects: [
                      ...prev.subjects,
                      {
                        id: uid('sub'),
                        gradeId,
                        name,
                        termConfig: createDefaultTermConfig(),
                      },
                    ],
                  }));
                  notify('تمت إضافة المادة');
                }}
                onDeleteSubject={(id) => {
                  updateDb((prev) => {
                    const nextBuckets = { ...prev.gradesBySubject };
                    delete nextBuckets[id];
                    return {
                      ...prev,
                      subjects: prev.subjects.filter((sb) => sb.id !== id),
                      gradesBySubject: nextBuckets,
                      schedule: (prev.schedule || []).filter((sl) => sl.subjectId !== id),
                    };
                  });
                }}
                onSaveTeacher={handleSaveTeacher}
                onDeleteTeacher={handleDeleteTeacher}
                onNotify={notify}
              />
            )}

            {(activeView === 'parent' || session.role === 'parent') && (
              <ParentPortalView
                db={db}
                initialPins={session.parentPins}
                onNotify={notify}
              />
            )}

            {activeView === 'settings' && session.role === 'admin' && (
              <SettingsView
                db={db}
                onSaveSettings={handleSaveSettings}
                onReplaceDatabase={(nextDb) => updateDb(() => nextDb)}
                onClearStudents={() =>
                  updateDb((prev) => ({
                    ...prev,
                    students: [],
                    gradesBySubject: {},
                    attendance: [],
                    notes: [],
                  }))
                }
                onNotify={notify}
              />
            )}
          </main>

          <footer className="border-t border-slate-200 bg-white px-5 py-3 text-center text-xs text-slate-500 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400">
            <span>{db.settings.schoolName}</span>
            <span aria-hidden="true"> · </span>
            <span className="tabular-nums">{db.settings.academicYear}</span>
            <span aria-hidden="true"> · </span>
            <span>إشراف وتطوير: {db.settings.teacherName}</span>
            {db.settings.teacherEmail && (
              <>
                <span aria-hidden="true"> · </span>
                <a
                  href={`mailto:${db.settings.teacherEmail}`}
                  className="font-semibold text-emerald-700 hover:underline dark:text-emerald-400"
                >
                  {db.settings.teacherEmail}
                </a>
              </>
            )}
          </footer>
        </div>
      </div>

      <PrintArea job={printJob} />

      {session.role !== 'parent' && (
        <QuickGradeModal
          open={quickGradeState.open}
          onClose={() => setQuickGradeState((prev) => ({ ...prev, open: false }))}
          db={db}
          ctx={ctx}
          session={session}
          initialTermKey={quickGradeState.termKey}
          initialMonthId={quickGradeState.monthId}
          onUpdateMonthDailyScore={handleUpdateMonthDailyScore}
          onUpdateMonthWritten={handleUpdateMonthWritten}
          onUpdateSubjectTermConfig={handleUpdateSubjectTermConfig}
          onNotify={notify}
        />
      )}

      {toastMsg && (
        <div
          role="status"
          aria-live="polite"
          className="no-print fixed bottom-5 left-5 z-50 rounded-lg bg-slate-900 px-4 py-2.5 text-xs font-bold text-white shadow-lg dark:bg-emerald-700"
        >
          {toastMsg}
        </div>
      )}
    </div>
  );
}
