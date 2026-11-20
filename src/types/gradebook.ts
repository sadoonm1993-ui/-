export type ExamAttendanceStatus = 'present' | 'absent' | 'postponed';
export type DailyAttendanceStatus = 'present' | 'absent' | 'late';
export type NoteCategory = 'positive' | 'academic' | 'warning';
export type StatusTone = 'success' | 'warning' | 'danger' | 'info' | 'muted';

export type AuthRole = 'admin' | 'teacher' | 'parent';

export interface AuthSession {
  role: AuthRole;
  teacherId?: string;
  parentPins?: string[];
  displayName: string;
}

export type NavView =
  | 'dashboard'
  | 'grades'
  | 'schedule'
  | 'students'
  | 'attendance'
  | 'reports'
  | 'tools'
  | 'structure'
  | 'parent'
  | 'settings';

export interface EvaluationRules {
  passMark: number;
  singleExempt: number;
  generalExemptAvg: number;
  generalExemptMinSub: number;
  maxReexamSubjects: number;
}

export interface GitHubSyncConfig {
  repo: string; // e.g. username/al-thakireen-gradebook
  branch: string; // e.g. main
  filePath: string; // e.g. data/gradebook-backup.json
  lastSyncAt?: string;
}

export interface SchoolSettings {
  schoolName: string;
  directorate: string;
  teacherName: string;
  teacherEmail: string;
  academicYear: string;
  darkMode: boolean;
  lockPin: string; // Legacy quick lock or Admin PIN
  adminPin: string;
  rulesConfirmed: boolean;
  participationWeightMode: 'bonus_to_t1' | 'bonus_to_t2' | 'display_only';
  includeDailyInTerm1: boolean;
  rules: EvaluationRules;
  github?: GitHubSyncConfig;
}

export interface TeacherAccount {
  id: string;
  name: string;
  pin: string;
  specialty: string;
  assignedSubjectIds: string[];
  assignedSectionIds: string[];
}

export interface Stage {
  id: string;
  name: string;
}

export interface GradeLevel {
  id: string;
  stageId: string;
  name: string;
}

export interface Section {
  id: string;
  gradeId: string;
  name: string;
}

export interface DailySectionDef {
  id: string;
  name: string;
  maxScore: number;
}

export interface MonthConfig {
  id: string; // 'm1', 'm2', 'm3', etc.
  label: string;
  enabled: boolean;
  dailySections: DailySectionDef[];
}

export interface SubjectTermConfig {
  term1Months: MonthConfig[];
  term2Months: MonthConfig[];
}

export interface DailyTitles {
  d1: string;
  d2: string;
  d3: string;
  d4: string;
}

export interface Subject {
  id: string;
  gradeId: string;
  name: string;
  dailyTitles?: DailyTitles; // kept for legacy compatibility
  termConfig: SubjectTermConfig;
}

export interface Student {
  id: string;
  number: string;
  name: string;
  sectionId: string;
  pin: string;
  phone: string;
}

export type NumericFieldValue = number | '';

export interface MonthGradeData {
  dailyScores: Record<string, NumericFieldValue>;
  written: NumericFieldValue;
}

export interface GradeRecord {
  studentId?: string;
  subjectId?: string;
  term1Months: Record<string, MonthGradeData>;
  term2Months: Record<string, MonthGradeData>;
  mid: NumericFieldValue;
  part: NumericFieldValue;
  final: NumericFieldValue;
  midStatus: ExamAttendanceStatus;
  finalStatus: ExamAttendanceStatus;
  // Legacy optional fields for safe migration
  d1?: NumericFieldValue;
  d2?: NumericFieldValue;
  d3?: NumericFieldValue;
  d4?: NumericFieldValue;
  f1_m1?: NumericFieldValue;
  f1_m2?: NumericFieldValue;
  f2_m1?: NumericFieldValue;
  f2_m2?: NumericFieldValue;
}

export interface MonthMetrics {
  monthId: string;
  label: string;
  enabled: boolean;
  dailySum: number | null;
  dailyMaxSum: number;
  daily100: number | null;
  written: number | null;
  monthAvg: number | null;
}

export interface SubjectMetrics {
  term1MonthMetrics: MonthMetrics[];
  term2MonthMetrics: MonthMetrics[];
  dailyAvg10: number | null;
  term1: number | null;
  term1Complete: boolean;
  mid: number | null;
  term2: number | null;
  term2Complete: boolean;
  currentEffort: number | null;
  effortComplete: boolean;
  isSingleExempt: boolean;
  finalExam: number | null;
  finalGrade: number | null;
  statusLabel: string;
  tone: StatusTone;
}

export interface SubjectEvaluationRow {
  subject: Subject;
  rec: GradeRecord;
  metrics: SubjectMetrics;
}

export interface OverallEvaluation {
  sec: Section | null;
  grd: GradeLevel | null;
  stg: Stage | null;
  rows: SubjectEvaluationRow[];
  avg: number | null;
  isFinalAvg: boolean;
  isGeneralExempt: boolean;
  singleExemptSubjects: string[];
  overallStatus: string;
  tone: StatusTone;
}

export interface AttendanceDay {
  id: string;
  date: string;
  sectionId: string;
  records: Record<string, DailyAttendanceStatus>;
}

export interface AttendanceStats {
  total: number;
  present: number;
  absent: number;
  late: number;
  rate: number;
}

export interface StudentNote {
  id: string;
  studentId: string;
  date: string;
  type: NoteCategory;
  text: string;
}

export type WeekDayKey = 'sun' | 'mon' | 'tue' | 'wed' | 'thu';

export interface ScheduleSlot {
  id: string;
  day: WeekDayKey;
  period: number; // 1..7
  timeRange: string;
  sectionId: string;
  subjectId: string;
  teacherId?: string;
  room?: string;
}

export interface AppDatabase {
  schemaVersion: number;
  settings: SchoolSettings;
  teachers: TeacherAccount[];
  stages: Stage[];
  grades: GradeLevel[];
  sections: Section[];
  subjects: Subject[];
  students: Student[];
  /**
   * Isolated subject-scoped grade storage: gradesBySubject[subjectId][studentId].
   * Prevents any cross-subject grade overlap or leakage for students sharing a school.
   */
  gradesBySubject: Record<string, Record<string, GradeRecord>>;
  /** Legacy flat map preserved only during import normalization */
  gradesMap?: Record<string, GradeRecord>;
  attendance: AttendanceDay[];
  notes: StudentNote[];
  schedule: ScheduleSlot[];
}

export interface AcademicContext {
  stageId: string;
  gradeId: string;
  sectionId: string;
  subjectId: string;
}

export interface ParentSnapshotStudent {
  id: string;
  name: string;
  pin: string;
  gradeName: string;
  secName: string;
  avg: number | null;
  isGeneralExempt: boolean;
  overallStatus: string;
  tone: StatusTone;
  att: AttendanceStats;
  notes: StudentNote[];
  rows: Array<{
    subjectName: string;
    term1: number | null;
    mid: number | null;
    term2: number | null;
    currentEffort: number | null;
    finalGrade: number | null;
    isSingleExempt: boolean;
    statusLabel: string;
    tone: StatusTone;
  }>;
}

export interface ParentSharePayload {
  school: string;
  academicYear: string;
  students: ParentSnapshotStudent[];
}
