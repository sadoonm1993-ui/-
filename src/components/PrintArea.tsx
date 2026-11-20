export interface PrintJob {
  kind: 'section_grades' | 'student_report' | 'official_exam';
  html: string;
}

interface PrintAreaProps {
  job: PrintJob | null;
}

export function PrintArea({ job }: PrintAreaProps) {
  return (
    <div
      id="printArea"
      dangerouslySetInnerHTML={job ? { __html: job.html } : undefined}
    />
  );
}
