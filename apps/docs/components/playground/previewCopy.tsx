import { Code, Kbd } from '@omsoo.design/todae';
import type { ReactNode } from 'react';
import type { Locale } from '../../lib/i18n/config';

type Tone = 'success' | 'warning' | 'critical' | 'neutral';

/** A reply as the page shows it, and the markdown Copy puts on the clipboard. */
export type PreviewReply = { content: ReactNode; source: string };

/** The preview's words in one language. Product, plan, customer and file names stay as they are. */
export type PreviewCopy = {
  user: { name: string; initials: string };
  page: string;
  greeting: string;
  searchHint: ReactNode;
  invite: string;
  newProject: string;
  more: string;
  exportCsv: string;
  print: string;
  archive: string;
  settings: string;
  revenue: string;
  range: string;
  day: string;
  week: string;
  month: string;
  booked: string;
  bookedAmount: string;
  churned: string;
  churnedAmount: string;
  quota: string;
  quotaUsed: string;
  upgrade: string;
  workEmail: string;
  plan: string;
  startDate: string;
  seats: string;
  billing: string;
  monthly: string;
  yearly: string;
  emailInvoice: string;
  upgradeToPro: string;
  invoices: string;
  invoice: string;
  customer: string;
  status: string;
  amount: string;
  invoicePages: string;
  invoiceRows: readonly { id: string; customer: string; status: string; tone: Tone; amount: string }[];
  assistant: string;
  you: string;
  question: string;
  /** The assistant's reply, then the one Regenerate swaps in. */
  answers: readonly [PreviewReply, PreviewReply];
  replyActions: string;
  yourMessageActions: string;
  copy: string;
  regenerate: string;
  rateReply: string;
  goodReply: string;
  badReply: string;
  messageLabel: string;
  askPlaceholder: string;
  notifications: string;
  mentions: string;
  weeklyDigest: string;
  productNews: string;
  chips: { design: string; billing: string; urgent: string };
  activity: string;
  all: string;
  mine: string;
  loading: string;
  paidEvent: string;
  paid: string;
  reminderEvent: string;
  sent: string;
  nothingAssigned: string;
  loadingActivity: string;
  files: string;
  storage: string;
  questions: string;
  faq: readonly { question: string; answer: string }[];
  maintenance: { title: string; body: string };
  cardExpiry: { title: string; body: string };
};

const searchKeys = (
  <>
    <Kbd.Root>Ctrl</Kbd.Root> <Kbd.Root>K</Kbd.Root>
  </>
);

const EN: PreviewCopy = {
  user: { name: 'Ada Lovelace', initials: 'AL' },
  page: 'Billing',
  greeting: 'Good morning, Ada',
  searchHint: <>3 reviews wait on you today. Press {searchKeys} to search.</>,
  invite: 'Invite',
  newProject: 'New project',
  more: 'More',
  exportCsv: 'Export CSV',
  print: 'Print',
  archive: 'Archive workspace',
  settings: 'Settings',
  revenue: 'Revenue',
  range: 'Range',
  day: 'Day',
  week: 'Week',
  month: 'Month',
  booked: 'Booked',
  bookedAmount: '$48,210',
  churned: 'Churned',
  churnedAmount: '$2,380',
  quota: 'Quota',
  quotaUsed: 'Quota used',
  upgrade: 'Upgrade',
  workEmail: 'Work email',
  plan: 'Plan',
  startDate: 'Start date',
  seats: 'Seats',
  billing: 'Billing',
  monthly: 'Monthly',
  yearly: 'Yearly, save 20%',
  emailInvoice: 'Email me the invoice',
  upgradeToPro: 'Upgrade to Pro',
  invoices: 'Invoices',
  invoice: 'Invoice',
  customer: 'Customer',
  status: 'Status',
  amount: 'Amount',
  invoicePages: 'Invoice pages',
  invoiceRows: [
    { id: 'INV-1042', customer: 'Northwind', status: 'Paid', tone: 'success', amount: '$4,120.00' },
    { id: 'INV-1043', customer: 'Globex', status: 'Due soon', tone: 'warning', amount: '$860.00' },
    { id: 'INV-1039', customer: 'Initech', status: 'Overdue', tone: 'critical', amount: '$2,015.50' },
    { id: 'INV-1044', customer: 'Umbrella', status: 'Draft', tone: 'neutral', amount: '$1,240.00' },
  ],
  assistant: 'Assistant',
  you: 'You',
  question: 'Can I export last quarter’s invoices?',
  answers: [
    {
      content: (
        <>
          Yes. Open <strong>Billing</strong>, pick the range, then choose <Code.Root>Export CSV</Code.Root>. Here is last
          quarter’s file.
        </>
      ),
      source: 'Yes. Open **Billing**, pick the range, then choose `Export CSV`. Here is last quarter’s file.',
    },
    {
      content: (
        <>
          Yes. In <strong>Billing</strong>, set the range to last quarter and choose <Code.Root>Export CSV</Code.Root>.
          The file is below.
        </>
      ),
      source: 'Yes. In **Billing**, set the range to last quarter and choose `Export CSV`. The file is below.',
    },
  ],
  replyActions: 'Reply',
  yourMessageActions: 'Your message',
  copy: 'Copy',
  regenerate: 'Regenerate',
  rateReply: 'Rate this reply',
  goodReply: 'Good reply',
  badReply: 'Bad reply',
  messageLabel: 'Message',
  askPlaceholder: 'Ask about your billing',
  notifications: 'Notifications',
  mentions: 'Mentions',
  weeklyDigest: 'Weekly digest',
  productNews: 'Product news',
  chips: { design: 'design', billing: 'billing', urgent: 'urgent' },
  activity: 'Activity',
  all: 'All',
  mine: 'Mine',
  loading: 'Loading',
  paidEvent: 'Grace paid INV-1042',
  paid: 'Paid',
  reminderEvent: 'Reminder sent to Globex',
  sent: 'Sent',
  nothingAssigned: 'Nothing assigned to you.',
  loadingActivity: 'Loading activity',
  files: 'Files',
  storage: 'Storage, 92 of 100 GB',
  questions: 'Questions',
  faq: [
    { question: 'When am I billed?', answer: 'On the first of each month, for the seats you used.' },
    { question: 'Can I change plans later?', answer: 'Yes, any time. The new price starts on your next invoice.' },
  ],
  maintenance: { title: 'Scheduled maintenance', body: 'Billing is read-only on Sunday from 02:00 to 03:00 UTC.' },
  cardExpiry: { title: 'Card expires soon', body: 'Update it before 2026-11-01 to keep your plan.' },
};

const KO: PreviewCopy = {
  user: { name: '김하나', initials: '하나' },
  page: '결제',
  greeting: '안녕하세요, 하나 님',
  searchHint: <>오늘 검토할 항목이 3건 있습니다. {searchKeys}를 눌러 검색하세요.</>,
  invite: '초대',
  newProject: '새 프로젝트',
  more: '더 보기',
  exportCsv: 'CSV 내보내기',
  print: '인쇄',
  archive: '워크스페이스 보관',
  settings: '설정',
  revenue: '매출',
  range: '기간',
  day: '일',
  week: '주',
  month: '월',
  booked: '계약',
  bookedAmount: '₩64,280,000',
  churned: '해지',
  churnedAmount: '₩3,170,000',
  quota: '목표',
  quotaUsed: '목표 달성률',
  upgrade: '업그레이드',
  workEmail: '회사 이메일',
  plan: '요금제',
  startDate: '시작일',
  seats: '좌석',
  billing: '결제 주기',
  monthly: '매월',
  yearly: '매년, 20% 할인',
  emailInvoice: '청구서를 이메일로 받기',
  upgradeToPro: 'Pro로 업그레이드',
  invoices: '청구서',
  invoice: '청구서',
  customer: '고객',
  status: '상태',
  amount: '금액',
  invoicePages: '청구서 페이지',
  invoiceRows: [
    { id: 'INV-1042', customer: 'Northwind', status: '결제 완료', tone: 'success', amount: '₩5,490,000' },
    { id: 'INV-1043', customer: 'Globex', status: '곧 만기', tone: 'warning', amount: '₩1,150,000' },
    { id: 'INV-1039', customer: 'Initech', status: '연체', tone: 'critical', amount: '₩2,690,000' },
    { id: 'INV-1044', customer: 'Umbrella', status: '임시 저장', tone: 'neutral', amount: '₩1,650,000' },
  ],
  assistant: '어시스턴트',
  you: '나',
  question: '지난 분기 청구서를 내보낼 수 있나요?',
  answers: [
    {
      content: (
        <>
          네. <strong>결제</strong>를 열고 기간을 고른 다음 <Code.Root>CSV 내보내기</Code.Root>를 선택하세요. 지난 분기
          파일을 첨부했습니다.
        </>
      ),
      source: '네. **결제**를 열고 기간을 고른 다음 `CSV 내보내기`를 선택하세요. 지난 분기 파일을 첨부했습니다.',
    },
    {
      content: (
        <>
          네. <strong>결제</strong>에서 기간을 지난 분기로 정하고 <Code.Root>CSV 내보내기</Code.Root>를 선택하세요.
          파일은 아래에 있습니다.
        </>
      ),
      source: '네. **결제**에서 기간을 지난 분기로 정하고 `CSV 내보내기`를 선택하세요. 파일은 아래에 있습니다.',
    },
  ],
  replyActions: '답변',
  yourMessageActions: '내 메시지',
  copy: '복사',
  regenerate: '다시 생성',
  rateReply: '답변 평가',
  goodReply: '좋은 답변',
  badReply: '아쉬운 답변',
  messageLabel: '메시지',
  askPlaceholder: '결제에 대해 물어보세요',
  notifications: '알림',
  mentions: '멘션',
  weeklyDigest: '주간 요약',
  productNews: '제품 소식',
  chips: { design: '디자인', billing: '결제', urgent: '긴급' },
  activity: '활동',
  all: '전체',
  mine: '내 항목',
  loading: '로딩',
  paidEvent: '서윤 님이 INV-1042를 결제했습니다',
  paid: '결제 완료',
  reminderEvent: 'Globex에 알림을 보냈습니다',
  sent: '보냄',
  nothingAssigned: '나에게 배정된 항목이 없습니다.',
  loadingActivity: '활동 불러오는 중',
  files: '파일',
  storage: '저장 공간, 100GB 중 92GB',
  questions: '자주 묻는 질문',
  faq: [
    { question: '언제 청구되나요?', answer: '매월 1일에, 사용한 좌석만큼 청구됩니다.' },
    { question: '나중에 요금제를 바꿀 수 있나요?', answer: '네, 언제든지요. 새 요금은 다음 청구서부터 적용됩니다.' },
  ],
  maintenance: { title: '정기 점검', body: '일요일 02:00부터 03:00(UTC)까지 결제는 읽기 전용입니다.' },
  cardExpiry: { title: '카드 만료 예정', body: '요금제를 유지하려면 2026년 11월 1일 전에 카드를 바꾸세요.' },
};

export const PREVIEW_COPY: Record<Locale, PreviewCopy> = { en: EN, ko: KO };
