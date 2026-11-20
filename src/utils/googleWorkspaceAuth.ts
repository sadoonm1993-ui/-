import { getApp, getApps, initializeApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  type User,
} from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';
import type { GoogleFormDocument, GoogleFormResponseItem } from './googleForms';

export const SCOPES = [
  'https://www.googleapis.com/auth/forms.body',
  'https://www.googleapis.com/auth/forms.responses.readonly',
] as const;

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
const auth = getAuth(app);

const provider = new GoogleAuthProvider();
SCOPES.forEach((scope) => provider.addScope(scope));

let isSigningIn = false;
// Access token is kept strictly in memory (never in localStorage or sessionStorage)
let cachedAccessToken: string | null = null;

export function initGoogleWorkspaceAuth(
  onAuthSuccess?: (user: User, token: string) => void,
  onAuthFailure?: () => void
) {
  return onAuthStateChanged(auth, (user) => {
    if (user) {
      if (cachedAccessToken) {
        onAuthSuccess?.(user, cachedAccessToken);
      } else if (!isSigningIn) {
        cachedAccessToken = null;
        onAuthFailure?.();
      }
    } else {
      cachedAccessToken = null;
      onAuthFailure?.();
    }
  });
}

export async function googleWorkspaceSignIn(): Promise<{ user: User; accessToken: string }> {
  try {
    isSigningIn = true;
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error('تعذر الحصول على رمز الوصول من Google Auth.');
    }
    cachedAccessToken = credential.accessToken;
    return { user: result.user, accessToken: cachedAccessToken };
  } finally {
    isSigningIn = false;
  }
}

export async function googleWorkspaceSignOut(): Promise<void> {
  await signOut(auth);
  cachedAccessToken = null;
}

export function getGoogleAccessToken(): string | null {
  return cachedAccessToken;
}

export function getCurrentGoogleUser(): User | null {
  return auth.currentUser;
}

async function parseGoogleApiError(res: Response, fallbackMsg: string): Promise<string> {
  try {
    const data = (await res.json()) as { error?: { message?: string } };
    if (data?.error?.message) return `${fallbackMsg}: ${data.error.message}`;
  } catch {
    // ignore
  }
  return `${fallbackMsg} (${res.status})`;
}

export async function fetchGoogleFormAndResponses(
  formId: string,
  accessToken: string
): Promise<{
  form: GoogleFormDocument;
  responses: GoogleFormResponseItem[];
}> {
  const safeFormId = encodeURIComponent(formId.trim());

  const formRes = await fetch(`https://forms.googleapis.com/v1/forms/${safeFormId}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!formRes.ok) {
    throw new Error(await parseGoogleApiError(formRes, 'تعذر قراءة نموذج Google Forms'));
  }
  const form = (await formRes.json()) as GoogleFormDocument;

  const allResponses: GoogleFormResponseItem[] = [];
  let pageToken = '';
  do {
    const query = pageToken ? `?pageToken=${encodeURIComponent(pageToken)}` : '';
    const respRes = await fetch(
      `https://forms.googleapis.com/v1/forms/${safeFormId}/responses${query}`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    );
    if (!respRes.ok) {
      throw new Error(await parseGoogleApiError(respRes, 'تعذر قراءة استجابات الاختبار'));
    }
    const respJson = (await respRes.json()) as {
      responses?: GoogleFormResponseItem[];
      nextPageToken?: string;
    };
    if (Array.isArray(respJson.responses)) {
      allResponses.push(...respJson.responses);
    }
    pageToken = respJson.nextPageToken || '';
  } while (pageToken);

  return { form, responses: allResponses };
}

export async function createGoogleFormQuiz(
  params: {
    title: string;
    description: string;
    questionCount: number;
    pointsPerQuestion: number;
  },
  accessToken: string
): Promise<{
  formId: string;
  responderUri: string;
  editUrl: string;
}> {
  const cleanTitle = params.title.trim() || 'اختبار إلكتروني — منصة الذاكرين';

  const createRes = await fetch('https://forms.googleapis.com/v1/forms', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      info: {
        title: cleanTitle,
        documentTitle: cleanTitle,
      },
    }),
  });

  if (!createRes.ok) {
    throw new Error(await parseGoogleApiError(createRes, 'تعذر إنشاء نموذج Google Forms'));
  }

  const created = (await createRes.json()) as GoogleFormDocument;
  const safeFormId = encodeURIComponent(created.formId.trim());

  const requests: Array<Record<string, unknown>> = [
    {
      updateSettings: {
        settings: {
          quizSettings: {
            isQuiz: true,
          },
        },
        updateMask: 'quizSettings.isQuiz',
      },
    },
    {
      updateFormInfo: {
        info: {
          description:
            params.description.trim() ||
            'يرجى كتابة الاسم الثلاثي ورقم الطالب بدقة لربط الدرجة بسجل المنصة.',
        },
        updateMask: 'description',
      },
    },
    {
      createItem: {
        item: {
          title: 'اسم الطالب الثلاثي',
          questionItem: {
            question: {
              required: true,
              textQuestion: { paragraph: false },
            },
          },
        },
        location: { index: 0 },
      },
    },
    {
      createItem: {
        item: {
          title: 'رقم الطالب (أو رمز PIN)',
          questionItem: {
            question: {
              required: true,
              textQuestion: { paragraph: false },
            },
          },
        },
        location: { index: 1 },
      },
    },
  ];

  const qCount = Math.min(20, Math.max(1, Math.floor(params.questionCount || 5)));
  const pts = Math.max(1, Math.floor(params.pointsPerQuestion || 2));

  for (let i = 0; i < qCount; i += 1) {
    requests.push({
      createItem: {
        item: {
          title: `السؤال ${i + 1}`,
          questionItem: {
            question: {
              required: true,
              grading: {
                pointValue: pts,
              },
              choiceQuestion: {
                type: 'RADIO',
                options: [
                  { value: 'الخيار أ' },
                  { value: 'الخيار ب' },
                  { value: 'الخيار ج' },
                  { value: 'الخيار د' },
                ],
              },
            },
          },
        },
        location: { index: i + 2 },
      },
    });
  }

  const batchRes = await fetch(`https://forms.googleapis.com/v1/forms/${safeFormId}:batchUpdate`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ requests }),
  });

  if (!batchRes.ok) {
    throw new Error(await parseGoogleApiError(batchRes, 'تم إنشاء النموذج لكن تعذر تهيئة أسئلة الاختبار'));
  }

  const updatedRes = await fetch(`https://forms.googleapis.com/v1/forms/${safeFormId}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const finalDoc = updatedRes.ok ? ((await updatedRes.json()) as GoogleFormDocument) : created;

  return {
    formId: created.formId,
    responderUri:
      finalDoc.responderUri || `https://docs.google.com/forms/d/${created.formId}/viewform`,
    editUrl: `https://docs.google.com/forms/d/${created.formId}/edit`,
  };
}
