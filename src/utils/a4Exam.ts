export type AnswerPlacementMode = 'on_paper' | 'exam_booklet';

export type PrintFontChoice = 'amiri' | 'cairo' | 'traditional' | 'sakkal';

export type ExamPrintScope = 'student_only' | 'student_and_key' | 'key_only';

export type QuestionTypeKind = 'mcq' | 'true_false' | 'fill_blank' | 'explain' | 'compare';

export interface A4ExamQuestion {
  id: string;
  prompt: string;
  subtypeNote?: string;
  choices?: string[];
  requireCorrection?: boolean;
  linesCount?: number;
  conceptA?: string;
  conceptB?: string;
  comparisonPoints?: string[];
  modelAnswer: string;
}

export interface A4ExamSection {
  id: string;
  title: string;
  type: QuestionTypeKind;
  marks: number;
  questions: A4ExamQuestion[];
}

export interface A4ExamPaper {
  ministry: string;
  directorate: string;
  schoolName: string;
  academicYear: string;
  subjectName: string;
  gradeAndSection: string;
  topic: string;
  examTitle: string;
  examDate: string;
  duration: string;
  teacherName: string;
  maxMarkLabel: string;
  generalNotes: string;
  showStudentBar: boolean;
  answerPlacement: AnswerPlacementMode;
  fontChoice: PrintFontChoice;
  fontSizePx: number;
  sections: A4ExamSection[];
}

export function escapeExamHtml(str: unknown): string {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function getPrintFontCss(fontChoice: PrintFontChoice): string {
  switch (fontChoice) {
    case 'amiri':
      return "'Amiri', 'Traditional Arabic', Georgia, serif";
    case 'traditional':
      return "'Traditional Arabic', 'Amiri', Georgia, serif";
    case 'sakkal':
      return "'Sakkal Majalla', 'Amiri', 'Cairo', serif";
    case 'cairo':
    default:
      return "'Cairo', 'Segoe UI', Tahoma, sans-serif";
  }
}

export function getFontDisplayLabel(fontChoice: PrintFontChoice): string {
  switch (fontChoice) {
    case 'amiri':
      return 'Amiri (أميري رسمي)';
    case 'traditional':
      return 'Traditional Arabic';
    case 'sakkal':
      return 'Sakkal Majalla';
    case 'cairo':
    default:
      return 'Cairo (القاهرة الحديث)';
  }
}

export function getQuestionTypeLabel(type: QuestionTypeKind): string {
  switch (type) {
    case 'mcq':
      return 'اختيار من متعدد';
    case 'true_false':
      return 'صح أو خطأ';
    case 'fill_blank':
      return 'إكمال الفراغات / التسمية';
    case 'explain':
      return 'علّل / فسّر / إجابة قصيرة';
    case 'compare':
      return 'مقارنة / حالة تطبيقية';
  }
}

export function computeTotalExamMarks(sections: A4ExamSection[]): number {
  return sections.reduce((sum, sec) => sum + Math.max(0, Number(sec.marks) || 0), 0);
}

export function createReadyA4ExamPaper(params: {
  directorate: string;
  schoolName: string;
  academicYear: string;
  subjectName: string;
  gradeName: string;
  sectionName: string;
  teacherName: string;
}): A4ExamPaper {
  const gradeLabel = [params.gradeName, params.sectionName].filter(Boolean).join(' — ') || 'الخامس العلمي';
  const subject = params.subjectName || 'الأحياء';

  return {
    ministry: 'جمهورية العراق - وزارة التربية',
    directorate: params.directorate || 'المديرية العامة لتربية كركوك',
    schoolName: params.schoolName || 'ثانوية الذاكرين النموذجية',
    academicYear: params.academicYear || '2026 - 2027',
    subjectName: subject,
    gradeAndSection: gradeLabel,
    topic: 'اختبار الشهر الأول — الوحدة الأولى',
    examTitle: `اختبار مادة ${subject}`,
    examDate: new Date().toISOString().slice(0, 10),
    duration: '45 دقيقة',
    teacherName: params.teacherName || 'م.م. سعدون محمد عبدالله',
    maxMarkLabel: '100 درجة',
    generalNotes: 'ملاحظة: أجب عن جميع الأسئلة بوضوح، وتأكد من كتابة اسمك الثلاثي والرقم الامتحاني.',
    showStudentBar: true,
    answerPlacement: 'on_paper',
    fontChoice: 'amiri',
    fontSizePx: 15,
    sections: [
      {
        id: 'sec_mcq',
        title: 'اختر الإجابة الصحيحة مما يأتي:',
        type: 'mcq',
        marks: 25,
        questions: [
          {
            id: 'q_mcq_1',
            subtypeNote: 'إجابة مباشرة',
            prompt: 'أيٌّ من العضيات الآتية يُعدّ المركز الرئيس لإنتاج الطاقة (ATP) داخل الخلية حقيقية النواة؟',
            choices: ['الشبكة البلازمية', 'الميتوكوندريا', 'جهاز كولجي', 'الجسيم المركزي'],
            modelAnswer: 'ب) الميتوكوندريا',
          },
          {
            id: 'q_mcq_2',
            subtypeNote: 'اختيار الاستثناء (ما عدا)',
            prompt: 'جميع التراكيب الآتية توجد في الخلية النباتية ما عدا:',
            choices: ['الجدار الخلوي', 'البلاستيدة الخضراء', 'المريكز (الجسيم المركزي)', 'الفجوة العصارية'],
            modelAnswer: 'ج) المريكز (الجسيم المركزي)',
          },
          {
            id: 'q_mcq_3',
            subtypeNote: 'تمييز بين حالتين',
            prompt: 'عند وضع خلية نباتية في محلول عالي التركيز مقارنة بداخلها، فإن ما يحدث هو:',
            choices: ['انتفاخ الخلية وانفجارها', 'حدوث البلزمة وانكماش السايتوبلازم', 'بقاء الحجم ثابتاً دون تغيير', 'تضاعف عدد الكروموسومات'],
            modelAnswer: 'ب) حدوث البلزمة وانكماش السايتوبلازم',
          },
        ],
      },
      {
        id: 'sec_tf',
        title: 'ضع علامة (✓) أمام العبارة الصحيحة وعلامة (✗) أمام العبارة الخاطئة، مع تصحيح الخطأ إن وُجد:',
        type: 'true_false',
        marks: 15,
        questions: [
          {
            id: 'q_tf_1',
            prompt: 'يتميز الغشاء البلازمي بخاصية النفاذية الاختيارية التي تنظم مرور المواد من الخلية وإليها.',
            requireCorrection: true,
            modelAnswer: '✓ عبارة صحيحة.',
          },
          {
            id: 'q_tf_2',
            prompt: 'تتم عملية البناء الضوئي في خلايا الجذر لاحتوائها على البلاستيدات عديمة اللون.',
            requireCorrection: true,
            modelAnswer: '✗ خطأ — التصحيح: تتم في الخلايا الخضراء (الأوراق) لاحتوائها على البلاستيدات الخضراء (الكلوروبلاست).',
          },
        ],
      },
      {
        id: 'sec_fill',
        title: 'أكمل الفراغات الآتية بما يناسبها علمياً:',
        type: 'fill_blank',
        marks: 15,
        questions: [
          {
            id: 'q_fill_1',
            prompt: 'يتكون الجدار الخلوي في النباتات الفتية من مادة ........................ بشكل أساس، وقد يتثخن لاحقاً بمادة ........................ .',
            modelAnswer: 'السليلوز / الخشبين (اللكنين)',
          },
          {
            id: 'q_fill_2',
            prompt: 'تُعرف حركة جزيئات الماء عبر غشاء اختياري النفاذية من التركيز العالي للماء إلى التركيز الواطئ بـ ........................ .',
            modelAnswer: 'التناضح (الأوزموزية)',
          },
        ],
      },
      {
        id: 'sec_explain',
        title: 'علّل أو فسّر علمياً كلّاً مما يأتي بإيجاز:',
        type: 'explain',
        marks: 25,
        questions: [
          {
            id: 'q_exp_1',
            prompt: 'تحتوي خلايا العضلات على أعداد كبيرة من الميتوكوندريا مقارنة بغيرها من الخلايا.',
            linesCount: 2,
            modelAnswer: 'لأن الخلايا العضلية تحتاج إلى كميات عالية من الطاقة (ATP) للقيام بعمليات التقلص والانبساط المستمرة.',
          },
          {
            id: 'q_exp_2',
            prompt: 'فسّر وجود الأعراف (الإنثناءات) في الغشاء الداخلي للميتوكوندريا.',
            linesCount: 2,
            modelAnswer: 'لزيادة المساحة السطحية للغشاء الداخلي وبالتالي زيادة كفاءة التفاعلات التنفسية وإنتاج الطاقة.',
          },
        ],
      },
      {
        id: 'sec_cmp',
        title: 'قارن بين المفهومين الآتيين وفق أوجه المقارنة المحددة:',
        type: 'compare',
        marks: 20,
        questions: [
          {
            id: 'q_cmp_1',
            prompt: 'قارن بين الخلية بدائية النواة والخلية حقيقية النواة:',
            conceptA: 'الخلية بدائية النواة',
            conceptB: 'الخلية حقيقية النواة',
            comparisonPoints: ['الغلاف النووي والنوية', 'العضيات الغشائية', 'مثال حيوي'],
            linesCount: 3,
            modelAnswer: 'بدائية النواة: تفتقر للغلاف النووي والعضيات الغشائية (مثل البكتيريا) | حقيقية النواة: تمتلك نواة محاطة بغلاف نووي وعضيات غشائية (مثل الطليعيات والنبات والحيوان).',
          },
        ],
      },
    ],
  };
}

export function buildA4ExamPromptText(paper: A4ExamPaper): string {
  const answerRuleText =
    paper.answerPlacement === 'on_paper'
      ? 'الإجابة تُكتب ضمن ورقة الأسئلة نفسها: اترك مجالاً واضحاً ومناسباً للإجابة (أسطر منقطة أو فراغ مريح يتناسب مع طول الإجابة المتوقع، مثل سطرين للتعليل أو جدول مقارنة منسق ومفرغ للكتابة).'
      : 'الإجابة لا تُكتب ضمن ورقة الأسئلة (الإجابة في دفتر الامتحان): لا تترك أي مجال أو أسطر فارغة للإجابة، واكتفِ بمسافة فاصلة بسيطة ومرتبة بين الأسئلة لتوفير المساحة ومنع التشتت.';

  const fontLabel = getFontDisplayLabel(paper.fontChoice);

  return `صمّم لي ورقة أسئلة اختبارية منسقة ومرتبة لتناسب الطباعة على ورقة قياس A4 بشكل نظيف، مقروء، واحترافي، حول موضوع [${paper.topic || 'اكتب عنوان الدرس أو الفصل'}] للصف [${paper.gradeAndSection || 'اكتب الصف'}], مع تنويع حقيقي في أنماط الأسئلة لتشمل:

- اختيار من متعدد (بصياغات متنوعة: إجابة مباشرة، اختيار الاستثناء "ما عدا"، أو التمييز بين حالتين).
- صح أو خطأ (مع تصحيح الخطأ إن وجد أو توضيح السبب).
- إكمال الفراغات أو تسمية أجزاء/مكونات.
- علّل / فسّر السبب أو أجب باختصار.
- قارن بين مفهومين أو حالة تطبيقية/ملاحظة قصيرة.

ترويسة الورقة وبياناتها:
ضع في أعلى الورقة ترويسة رسمية واضحة تتضمن:
- الجهة التعليمية: ${paper.ministry} / ${paper.directorate} / ${paper.schoolName}
- المادة: ${paper.subjectName}
- الصف والشعبة: ${paper.gradeAndSection} | التاريخ: ${paper.examDate} | المدة: ${paper.duration}
- اسم الطالب: ............................ | الرقم الامتحاني / الشعبة: ....................
- اسم مدرّس المادة: ${paper.teacherName}

قاعدة مساحات الإجابة (مهم جداً):
- ${answerRuleText}

قواعد الخط والتنسيق للطباعة على A4:
- اعتمد خطاً عربياً احترافياً، جميلاً، وواضحاً مناسب للطباعة الرسمية (${fontLabel} بحجم ${paper.fontSizePx}px مريح للعين، مع تمييز العناوين بخط أثقل).
- استخدم عناوين واضحة لكل قسم من أقسام الأسئلة مع ترقيم متسلسل ومرتب، وتجنب كسر السؤال الواحد بين صفحتين.
- ضع مفتاح الإجابات النموذجية في ورقة أو قسم منفصل في النهاية حتى لا يظهر في نسخة الطالب عند الطباعة.`;
}

const CHOICE_LETTERS = ['أ', 'ب', 'ج', 'د', 'هـ', 'و'];

function renderDottedLines(count: number): string {
  const safeCount = Math.min(8, Math.max(1, count));
  let lines = '';
  for (let i = 0; i < safeCount; i += 1) {
    lines += `<div style="height:24px;border-bottom:1.4px dotted #475569;margin-top:4px;width:100%;"></div>`;
  }
  return `<div style="margin:4px 0 8px 0;">${lines}</div>`;
}

function renderQuestionHtml(
  q: A4ExamQuestion,
  qIndex: number,
  type: QuestionTypeKind,
  answerPlacement: AnswerPlacementMode
): string {
  const compactGap = answerPlacement === 'exam_booklet' ? 'margin-bottom:7px;' : 'margin-bottom:13px;';
  const numPrefix = `<strong style="color:#0f172a;">${qIndex + 1}-</strong> `;

  if (type === 'mcq') {
    const choicesHtml = (q.choices || [])
      .map((ch, idx) => {
        const letter = CHOICE_LETTERS[idx] || String(idx + 1);
        const bubble =
          answerPlacement === 'on_paper'
            ? `<span style="display:inline-block;width:13px;height:13px;border:1.3px solid #334155;border-radius:999px;vertical-align:middle;margin-left:6px;"></span>`
            : '';
        return `<div style="padding:2px 4px;">${bubble}<strong>${letter})</strong> ${escapeExamHtml(ch)}</div>`;
      })
      .join('');

    return `
      <div class="a4-no-break" style="break-inside:avoid;page-break-inside:avoid;${compactGap}">
        <div style="font-weight:600;margin-bottom:4px;">${numPrefix}${escapeExamHtml(q.prompt)}</div>
        <div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:4px 16px;padding-right:18px;">
          ${choicesHtml}
        </div>
      </div>
    `;
  }

  if (type === 'true_false') {
    const checkBoxes =
      answerPlacement === 'on_paper'
        ? `<span style="display:inline-block;margin-right:8px;font-weight:700;color:#334155;white-space:nowrap;">[ &nbsp;&nbsp;&nbsp; ]</span>`
        : '';
    const correctionSpace =
      answerPlacement === 'on_paper' && q.requireCorrection
        ? `<div style="padding-right:18px;margin-top:4px;display:flex;align-items:flex-end;gap:6px;">
             <span style="font-size:0.88em;font-weight:700;color:#334155;white-space:nowrap;">التصحيح / السبب:</span>
             <span style="flex:1;height:20px;border-bottom:1.4px dotted #475569;"></span>
           </div>`
        : '';

    return `
      <div class="a4-no-break" style="break-inside:avoid;page-break-inside:avoid;${compactGap}">
        <div style="display:flex;align-items:baseline;justify-content:space-between;gap:10px;">
          <div>${numPrefix}${escapeExamHtml(q.prompt)}</div>
          ${checkBoxes}
        </div>
        ${correctionSpace}
      </div>
    `;
  }

  if (type === 'fill_blank') {
    const extraLine =
      answerPlacement === 'on_paper' && !q.prompt.includes('...')
        ? renderDottedLines(1)
        : '';
    return `
      <div class="a4-no-break" style="break-inside:avoid;page-break-inside:avoid;${compactGap}">
        <div>${numPrefix}${escapeExamHtml(q.prompt)}</div>
        ${extraLine}
      </div>
    `;
  }

  if (type === 'compare') {
    const hasTableConcepts = Boolean(q.conceptA?.trim() && q.conceptB?.trim());
    if (answerPlacement === 'on_paper' && hasTableConcepts) {
      const points =
        q.comparisonPoints && q.comparisonPoints.length > 0
          ? q.comparisonPoints
          : ['وجه المقارنة (1)', 'وجه المقارنة (2)'];
      const rowsHtml = points
        .map(
          (pt) => `
          <tr>
            <td style="border:1.2px solid #334155;padding:6px 8px;font-weight:700;background:#f8fafc;width:24%;">${escapeExamHtml(pt)}</td>
            <td style="border:1.2px solid #334155;padding:6px 8px;height:34px;width:38%;"></td>
            <td style="border:1.2px solid #334155;padding:6px 8px;height:34px;width:38%;"></td>
          </tr>
        `
        )
        .join('');

      return `
        <div class="a4-no-break" style="break-inside:avoid;page-break-inside:avoid;${compactGap}">
          <div style="font-weight:600;margin-bottom:6px;">${numPrefix}${escapeExamHtml(q.prompt)}</div>
          <table style="width:100%;border-collapse:collapse;margin-top:4px;font-size:0.92em;">
            <thead>
              <tr>
                <th style="border:1.2px solid #334155;padding:6px 8px;background:#f1f5f9;text-align:right;">وجه المقارنة</th>
                <th style="border:1.2px solid #334155;padding:6px 8px;background:#f1f5f9;text-align:center;">${escapeExamHtml(q.conceptA)}</th>
                <th style="border:1.2px solid #334155;padding:6px 8px;background:#f1f5f9;text-align:center;">${escapeExamHtml(q.conceptB)}</th>
              </tr>
            </thead>
            <tbody>${rowsHtml}</tbody>
          </table>
        </div>
      `;
    }

    // Booklet mode OR applied case study without 2-concept columns
    const ptsText =
      hasTableConcepts && q.comparisonPoints?.length
        ? `<div style="padding-right:18px;font-size:0.93em;color:#334155;">(${escapeExamHtml(q.conceptA)} / ${escapeExamHtml(q.conceptB)}) — من حيث: ${escapeExamHtml(q.comparisonPoints.join('، '))}</div>`
        : '';
    const spaceHtml = answerPlacement === 'on_paper' ? renderDottedLines(q.linesCount || 3) : '';
    return `
      <div class="a4-no-break" style="break-inside:avoid;page-break-inside:avoid;${compactGap}">
        <div style="font-weight:600;">${numPrefix}${escapeExamHtml(q.prompt)}</div>
        ${ptsText}
        ${spaceHtml}
      </div>
    `;
  }

  // explain / short answer
  const linesHtml = answerPlacement === 'on_paper' ? renderDottedLines(q.linesCount || 2) : '';
  return `
    <div class="a4-no-break" style="break-inside:avoid;page-break-inside:avoid;${compactGap}">
      <div>${numPrefix}${escapeExamHtml(q.prompt)}</div>
      ${linesHtml}
    </div>
  `;
}

export function renderA4ExamHtml(
  paper: A4ExamPaper,
  options: { scope: ExamPrintScope }
): string {
  const fontCss = getPrintFontCss(paper.fontChoice);
  const fontSize = Math.min(20, Math.max(11, Number(paper.fontSizePx) || 15));
  const computedMarks = computeTotalExamMarks(paper.sections);
  const effectiveMaxMark = paper.maxMarkLabel.trim() || `${computedMarks} درجة`;

  const headerHtml = `
    <div style="border:2px solid #0f172a;border-radius:6px;padding:10px 14px;margin-bottom:12px;">
      <div style="display:flex;justify-content:space-between;align-items:center;border-bottom:1.5px solid #334155;padding-bottom:6px;margin-bottom:6px;">
        <div style="font-weight:800;font-size:${fontSize + 1}px;">${escapeExamHtml(paper.ministry)}</div>
        <div style="font-weight:700;font-size:${fontSize}px;">${escapeExamHtml(paper.directorate)}</div>
        <div style="font-weight:800;font-size:${fontSize + 1}px;">${escapeExamHtml(paper.schoolName)}</div>
      </div>

      <div style="text-align:center;margin:4px 0 8px 0;">
        <div style="font-weight:800;font-size:${fontSize + 3}px;color:#0f172a;">${escapeExamHtml(paper.examTitle)}</div>
        ${paper.topic ? `<div style="font-weight:700;font-size:${fontSize}px;color:#1e293b;margin-top:2px;">الموضوع: ${escapeExamHtml(paper.topic)}</div>` : ''}
      </div>

      <div style="display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:6px 10px;font-size:${Math.max(12, fontSize - 1)}px;font-weight:700;border-top:1px dashed #64748b;padding-top:6px;">
        <div>المادة: ${escapeExamHtml(paper.subjectName)}</div>
        <div>الصف والشعبة: ${escapeExamHtml(paper.gradeAndSection)}</div>
        <div>التاريخ: ${escapeExamHtml(paper.examDate)}</div>
        <div>المدة: ${escapeExamHtml(paper.duration)} | الدرجة: ${escapeExamHtml(effectiveMaxMark)}</div>
      </div>

      ${
        paper.showStudentBar
          ? `<div style="display:flex;justify-content:space-between;gap:12px;margin-top:8px;padding-top:6px;border-top:1px solid #cbd5e1;font-size:${Math.max(12, fontSize - 1)}px;font-weight:700;">
               <div style="flex:1.4;">اسم الطالب: ......................................................</div>
               <div style="flex:1;text-align:left;">الرقم الامتحاني / الشعبة: ..........................</div>
             </div>`
          : ''
      }
      ${
        paper.generalNotes
          ? `<div style="margin-top:6px;font-size:${Math.max(11, fontSize - 2)}px;font-weight:600;color:#334155;">${escapeExamHtml(paper.generalNotes)}</div>`
          : ''
      }
    </div>
  `;

  const sectionsHtml = paper.sections
    .map((sec, sIdx) => {
      const questionsHtml = sec.questions
        .map((q, qIdx) => renderQuestionHtml(q, qIdx, sec.type, paper.answerPlacement))
        .join('');
      const sectionMargin = paper.answerPlacement === 'exam_booklet' ? 'margin-bottom:10px;' : 'margin-bottom:14px;';
      return `
        <section style="${sectionMargin}">
          <div class="a4-no-break" style="break-inside:avoid;page-break-inside:avoid;display:flex;justify-content:space-between;align-items:baseline;border-bottom:1.5px solid #0f172a;padding-bottom:3px;margin-bottom:8px;">
            <h3 style="margin:0;font-size:${fontSize + 1}px;font-weight:800;color:#0f172a;">
              س${sIdx + 1}: ${escapeExamHtml(sec.title)}
            </h3>
            <span style="font-size:${Math.max(12, fontSize - 1)}px;font-weight:800;white-space:nowrap;border:1px solid #334155;border-radius:4px;padding:1px 8px;">
              (${sec.marks} درجة)
            </span>
          </div>
          <div style="padding-right:6px;">
            ${questionsHtml}
          </div>
        </section>
      `;
    })
    .join('');

  const footerHtml = `
    <div class="a4-no-break" style="break-inside:avoid;page-break-inside:avoid;display:flex;justify-content:space-between;align-items:center;border-top:1.5px solid #0f172a;margin-top:18px;padding-top:10px;font-weight:800;font-size:${fontSize}px;">
      <span>مدرس المادة: ${escapeExamHtml(paper.teacherName)}</span>
      <span>العام الدراسي: ${escapeExamHtml(paper.academicYear)}</span>
      <span>توقيع إدارة المدرسة: ........................</span>
    </div>
  `;

  const studentPaperHtml = `
    <div dir="rtl" style="font-family:${fontCss};font-size:${fontSize}px;line-height:${paper.answerPlacement === 'exam_booklet' ? '1.65' : '1.8'};color:#0f172a;background:#ffffff;">
      ${headerHtml}
      <div>${sectionsHtml}</div>
      ${footerHtml}
    </div>
  `;

  const answerKeyHtml = `
    <div dir="rtl" style="font-family:${fontCss};font-size:${fontSize}px;line-height:1.75;color:#0f172a;background:#ffffff;">
      <div style="border:2px solid #065f46;border-radius:6px;padding:10px 14px;margin-bottom:14px;background:#f8fafc;">
        <div style="display:flex;justify-content:space-between;align-items:center;font-weight:800;font-size:${fontSize + 1}px;color:#065f46;">
          <span>مفتاح الإجابات النموذجية (نسخة المدرس — غير مرفقة بنسخة الطالب)</span>
          <span>${escapeExamHtml(paper.schoolName)}</span>
        </div>
        <div style="margin-top:4px;font-size:${Math.max(12, fontSize - 1)}px;font-weight:700;color:#334155;">
          ${escapeExamHtml(paper.examTitle)} · ${escapeExamHtml(paper.subjectName)} · ${escapeExamHtml(paper.gradeAndSection)} · مدرس المادة: ${escapeExamHtml(paper.teacherName)}
        </div>
      </div>

      ${paper.sections
        .map(
          (sec, sIdx) => `
          <div class="a4-no-break" style="break-inside:avoid;page-break-inside:avoid;margin-bottom:12px;border:1px solid #cbd5e1;border-radius:6px;padding:8px 12px;">
            <div style="display:flex;justify-content:space-between;font-weight:800;border-bottom:1px solid #cbd5e1;padding-bottom:4px;margin-bottom:6px;color:#0f172a;">
              <span>إجابة س${sIdx + 1}: ${escapeExamHtml(sec.title)}</span>
              <span>(${sec.marks} درجة)</span>
            </div>
            <ol style="margin:0;padding-right:20px;">
              ${sec.questions
                .map(
                  (q) =>
                    `<li style="margin-bottom:4px;"><strong>${escapeExamHtml(q.modelAnswer || '—')}</strong></li>`
                )
                .join('')}
            </ol>
          </div>
        `
        )
        .join('')}
    </div>
  `;

  if (options.scope === 'student_only') {
    return studentPaperHtml;
  }
  if (options.scope === 'key_only') {
    return answerKeyHtml;
  }
  return `
    ${studentPaperHtml}
    <div class="a4-page-break" style="page-break-before:always;break-before:page;margin-top:24px;"></div>
    ${answerKeyHtml}
  `;
}
