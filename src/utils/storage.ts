import * as XLSX from 'xlsx';
import type { AppDatabase, ParentSharePayload } from '../types/gradebook';
import {
  base64ToUtf8,
  convertOldV6ToUnified,
  createDemoData,
  evaluateStudentOverall,
  getStudentAttendanceStats,
  normalizeDatabase,
  utf8ToBase64,
} from './evaluation';

export const STORAGE_KEY = 'al_thakireen_unified_lms_v1';
export const OLD_V6_KEY = 'smart_gradebook_db_v6';

export function loadDatabase(): AppDatabase {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<AppDatabase>;
      if (parsed && parsed.settings && Array.isArray(parsed.students)) {
        const normalized = normalizeDatabase(parsed);
        return normalized;
      }
    }
    const oldRaw = localStorage.getItem(OLD_V6_KEY);
    if (oldRaw) {
      const oldParsed = JSON.parse(oldRaw);
      if (oldParsed && oldParsed.subjects && oldParsed.data) {
        const migrated = convertOldV6ToUnified(oldParsed);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(migrated));
        return migrated;
      }
    }
  } catch {
    // ignore corrupted storage and fall back to demo seed
  }
  const demo = createDemoData();
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(demo));
  } catch {
    // ignore storage quota errors
  }
  return demo;
}

export function saveDatabase(db: AppDatabase): boolean {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
    return true;
  } catch {
    return false;
  }
}

export function exportExcelWorkbook(baseName: string, rows: (string | number)[][]): void {
  const ws = XLSX.utils.aoa_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'البيانات');
  XLSX.writeFile(wb, `${baseName}.xlsx`);
}

export async function parseExcelStudentFile(file: File): Promise<string[]> {
  if (file.name.endsWith('.csv') || file.name.endsWith('.txt')) {
    const text = await file.text();
    return text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  }
  const buffer = await file.arrayBuffer();
  const wb = XLSX.read(new Uint8Array(buffer), { type: 'array' });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<(string | number | undefined)[]>(ws, { header: 1 });
  return rows
    .filter((r) => r && r[0] !== undefined && String(r[0]).trim() !== '')
    .map((r) => r.slice(0, 3).map((cell) => String(cell ?? '').trim()).join(','));
}

export function buildParentShareUrl(db: AppDatabase, studentIds: string[]): string {
  const payload: ParentSharePayload = {
    school: db.settings.schoolName,
    academicYear: db.settings.academicYear,
    students: studentIds
      .map((id) => {
        const s = db.students.find((x) => x.id === id);
        if (!s) return null;
        const ev = evaluateStudentOverall(db, s);
        return {
          id: s.id,
          name: s.name,
          pin: s.pin,
          gradeName: ev.grd ? ev.grd.name : '',
          secName: ev.sec ? ev.sec.name : '',
          avg: ev.avg,
          isGeneralExempt: ev.isGeneralExempt,
          overallStatus: ev.overallStatus,
          tone: ev.tone,
          att: getStudentAttendanceStats(db, s.id),
          notes: db.notes.filter((n) => n.studentId === s.id),
          rows: ev.rows.map((r) => ({
            subjectName: r.subject.name,
            term1: r.metrics.term1,
            mid: r.metrics.mid,
            term2: r.metrics.term2,
            currentEffort: r.metrics.currentEffort,
            finalGrade: r.metrics.finalGrade,
            isSingleExempt: r.metrics.isSingleExempt,
            statusLabel: r.metrics.statusLabel,
            tone: r.metrics.tone,
          })),
        };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null),
  };

  const baseUrl = window.location.href.split('#')[0];
  return `${baseUrl}#p=${utf8ToBase64(JSON.stringify(payload))}`;
}

export function parseParentShareHash(hash: string): ParentSharePayload | null {
  if (!hash || !hash.startsWith('#p=')) return null;
  try {
    const parsed = JSON.parse(base64ToUtf8(hash.slice(3))) as ParentSharePayload;
    if (parsed && Array.isArray(parsed.students)) {
      return parsed;
    }
  } catch {
    return null;
  }
  return null;
}

export async function pushDatabaseToGitHub(params: {
  repo: string;
  branch: string;
  filePath: string;
  token: string;
  db: AppDatabase;
}): Promise<{ ok: boolean; message: string }> {
  const { repo, branch, filePath, token, db } = params;
  const cleanRepo = repo.trim().replace(/^https?:\/\/github\.com\//, '').replace(/\/$/, '');
  const cleanPath = filePath.trim().replace(/^\/+/, '');
  if (!cleanRepo || !cleanPath || !token.trim()) {
    return { ok: false, message: 'يرجى إدخال اسم المستودع ومسار الملف ورمز الوصول (Token)' };
  }

  const apiUrl = `https://api.github.com/repos/${cleanRepo}/contents/${cleanPath}`;
  const headers = {
    Authorization: `Bearer ${token.trim()}`,
    Accept: 'application/vnd.github+json',
    'Content-Type': 'application/json',
  };

  try {
    let sha: string | undefined;
    const getRes = await fetch(`${apiUrl}?ref=${encodeURIComponent(branch || 'main')}`, { headers });
    if (getRes.ok) {
      const existing = (await getRes.json()) as { sha?: string };
      sha = existing.sha;
    }

    const content = utf8ToBase64(JSON.stringify(db, null, 2));
    const putRes = await fetch(apiUrl, {
      method: 'PUT',
      headers,
      body: JSON.stringify({
        message: `تحديث سجل الذاكرين الذكي (${new Date().toISOString().slice(0, 10)})`,
        content,
        branch: branch || 'main',
        ...(sha ? { sha } : {}),
      }),
    });

    if (!putRes.ok) {
      const errBody = await putRes.text();
      return { ok: false, message: `فشل المزامنة مع GitHub (${putRes.status}): ${errBody.slice(0, 120)}` };
    }
    return { ok: true, message: 'تمت مزامنة النسخة الاحتياطية مع مستودع GitHub بنجاح' };
  } catch {
    return { ok: false, message: 'تعذر الاتصال بخدمة GitHub؛ تحقق من الإنترنت وصلاحية الرمز' };
  }
}

export async function pullDatabaseFromGitHub(params: {
  repo: string;
  branch: string;
  filePath: string;
  token?: string;
}): Promise<{ ok: boolean; db?: AppDatabase; message: string }> {
  const { repo, branch, filePath, token } = params;
  const cleanRepo = repo.trim().replace(/^https?:\/\/github\.com\//, '').replace(/\/$/, '');
  const cleanPath = filePath.trim().replace(/^\/+/, '');
  if (!cleanRepo || !cleanPath) {
    return { ok: false, message: 'يرجى إدخال اسم المستودع ومسار الملف' };
  }

  const apiUrl = `https://api.github.com/repos/${cleanRepo}/contents/${cleanPath}?ref=${encodeURIComponent(branch || 'main')}`;
  const headers: Record<string, string> = { Accept: 'application/vnd.github+json' };
  if (token?.trim()) {
    headers.Authorization = `Bearer ${token.trim()}`;
  }

  try {
    const res = await fetch(apiUrl, { headers });
    if (!res.ok) {
      return { ok: false, message: `تعذر جلب الملف من GitHub (${res.status})` };
    }
    const payload = (await res.json()) as { content?: string };
    if (!payload.content) {
      return { ok: false, message: 'محتوى الملف في GitHub فارغ' };
    }
    const decoded = base64ToUtf8(payload.content.replace(/\s+/g, ''));
    const parsed = JSON.parse(decoded) as Partial<AppDatabase>;
    if (!parsed || !Array.isArray(parsed.students)) {
      return { ok: false, message: 'صيغة ملف البيانات المستوردة غير صالحة' };
    }
    return { ok: true, db: normalizeDatabase(parsed), message: 'تم استيراد أحدث نسخة من مستودع GitHub' };
  } catch {
    return { ok: false, message: 'تعذر قراءة أو تحليل الملف من GitHub' };
  }
}
