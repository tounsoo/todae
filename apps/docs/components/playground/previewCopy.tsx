import { Code, Kbd } from '@tounsoo/todae';
import type { ReactNode } from 'react';
import type { Locale } from '../../lib/i18n/config';
import type { ActivityEntry, Folder, Invoice, InvoiceStatus } from './billing';

/** A reply as the page shows it, and the markdown Copy puts on the clipboard. */
export type PreviewReply = { content: ReactNode; source: string };

export type Person = { name: string; role: string };

/** The preview's words in one language. Product, plan, customer and file names stay as they are. */
export type PreviewCopy = {
  /** The currency the made-up amounts are in. */
  currency: string;
  /** The made-up invoices the page starts with, in this locale's money. */
  invoices: readonly Invoice[];
  user: { name: string; initials: string };
  page: string;
  greeting: string;
  /** Under the greeting, with the count of invoices past due. */
  searchHint: (overdue: number) => ReactNode;
  search: string;
  invite: string;
  newInvoice: string;
  more: string;
  exportAs: string;
  print: string;
  showDrafts: string;
  archiveWorkspace: string;
  settings: string;
  palette: {
    input: string;
    placeholder: string;
    empty: string;
    open: (invoice: Invoice) => string;
  };
  revenue: string;
  collected: string;
  outstanding: string;
  overdueCount: (count: number) => string;
  collectedShare: string;
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
  upgraded: string;
  invoiceList: string;
  invoice: string;
  customer: string;
  due: string;
  status: string;
  amount: string;
  rowActions: (id: string) => string;
  invoicePages: string;
  invoiceFilter: string;
  unpaid: string;
  noInvoices: string;
  statuses: Record<InvoiceStatus, string>;
  folders: Record<Folder, string>;
  flagged: string;
  row: {
    open: string;
    markPaid: string;
    send: string;
    remind: string;
    moveTo: string;
    flag: string;
    archive: string;
  };
  detail: {
    steps: string;
    created: string;
    sent: string;
    paid: string;
    overdue: string;
    overdueBody: (days: number) => string;
    folder: string;
    inbox: string;
  };
  toasts: {
    undo: string;
    paid: (id: string) => string;
    sent: (invoice: Invoice) => string;
    reminded: (invoice: Invoice) => string;
    created: (id: string) => string;
    archived: (id: string) => string;
    exported: (file: string) => string;
    printed: string;
  };
  form: {
    title: string;
    description: string;
    customer: string;
    choose: string;
    amount: string;
    due: string;
    create: string;
    cancel: string;
  };
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
  send: string;
  messageLabel: string;
  askPlaceholder: string;
  people: string;
  noOneMatches: string;
  directory: Record<'mina' | 'grace' | 'alan', Person>;
  /** What follows the mention of Mina in a message already sent. */
  mentionTail: string;
  notifications: string;
  mentions: string;
  weeklyDigest: string;
  productNews: string;
  chips: { design: string; billing: string; urgent: string };
  activity: string;
  all: string;
  mine: string;
  loading: string;
  activityLine: (entry: ActivityEntry) => string;
  activityBadge: Record<ActivityEntry['kind'], string>;
  nothingAssigned: string;
  loadingActivity: string;
  files: string;
  fileDetails: string;
  /** What the Files card says about each file, by its tree value. */
  fileMeta: Record<'exports/q3.csv' | 'exports/q2.csv' | 'contracts', string>;
  storage: string;
  invoiceSettings: string;
  accent: string;
  terms: string;
  tags: string;
  tagLong: string;
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

/** The made-up invoices, newest first, with the amount each locale bills in. The page's today is 2026-10-14. */
const SEED = [
  { id: 'INV-1045', customer: 'Umbrella', due: '2026-10-28', status: 'draft', usd: 1240, krw: 1_650_000 },
  { id: 'INV-1044', customer: 'Initech', due: '2026-10-02', status: 'overdue', usd: 2015.5, krw: 2_690_000 },
  { id: 'INV-1043', customer: 'Globex', due: '2026-10-20', status: 'due', usd: 860, krw: 1_150_000 },
  { id: 'INV-1042', customer: 'Northwind', due: '2026-10-01', status: 'paid', usd: 4120, krw: 5_490_000 },
  { id: 'INV-1041', customer: 'Hooli', due: '2026-10-17', status: 'due', usd: 1780, krw: 2_380_000 },
  { id: 'INV-1040', customer: 'Soylent', due: '2026-09-24', status: 'paid', usd: 3300, krw: 4_400_000 },
  { id: 'INV-1039', customer: 'Vandelay', due: '2026-09-30', status: 'overdue', usd: 640.25, krw: 850_000 },
  { id: 'INV-1038', customer: 'Wonka', due: '2026-09-15', status: 'paid', usd: 2450, krw: 3_270_000 },
] as const;

const seed = (currency: 'usd' | 'krw'): Invoice[] =>
  SEED.map(({ usd, krw, ...invoice }) => ({
    ...invoice,
    amount: currency === 'usd' ? usd : krw,
    flagged: false,
    folder: null,
  }));

const EN_FOLDERS = { review: 'Review', disputed: 'Disputed' } as const;
const KO_FOLDERS = { review: '검토', disputed: '분쟁' } as const;

const EN: PreviewCopy = {
  currency: 'USD',
  invoices: seed('usd'),
  user: { name: 'Ada Lovelace', initials: 'AL' },
  page: 'Billing',
  greeting: 'Good morning, Ada',
  searchHint: (overdue) => (
    <>
      {overdue === 0 ? 'Nothing is overdue.' : overdue === 1 ? '1 invoice is overdue.' : `${overdue} invoices are overdue.`} Press{' '}
      {searchKeys} to search.
    </>
  ),
  search: 'Search',
  invite: 'Invite',
  newInvoice: 'New invoice',
  more: 'More',
  exportAs: 'Export as',
  print: 'Print',
  showDrafts: 'Show drafts',
  archiveWorkspace: 'Archive workspace',
  settings: 'Settings',
  palette: {
    input: 'Search invoices and commands',
    placeholder: 'Type an invoice, a customer or a command',
    empty: 'Nothing matches.',
    open: (invoice) => `Open ${invoice.id}, ${invoice.customer}`,
  },
  revenue: 'Revenue',
  collected: 'Collected',
  outstanding: 'Outstanding',
  overdueCount: (count) => `${count} overdue`,
  collectedShare: 'Share of billing collected',
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
  upgraded: 'You’re on the new plan',
  invoiceList: 'Invoices',
  invoice: 'Invoice',
  customer: 'Customer',
  due: 'Due',
  status: 'Status',
  amount: 'Amount',
  rowActions: (id) => `Actions for ${id}`,
  invoicePages: 'Invoice pages',
  invoiceFilter: 'Show',
  unpaid: 'Unpaid',
  noInvoices: 'No invoices to show.',
  statuses: { draft: 'Draft', due: 'Due', overdue: 'Overdue', paid: 'Paid' },
  folders: EN_FOLDERS,
  flagged: 'Flagged',
  row: {
    open: 'Open',
    markPaid: 'Mark paid',
    send: 'Send',
    remind: 'Send reminder',
    moveTo: 'Move to',
    flag: 'Flag',
    archive: 'Archive',
  },
  detail: {
    steps: 'Progress',
    created: 'Created',
    sent: 'Sent',
    paid: 'Paid',
    overdue: 'Overdue',
    overdueBody: (days) => (days === 1 ? 'Payment is 1 day late.' : `Payment is ${days} days late.`),
    folder: 'Folder',
    inbox: 'Inbox',
  },
  toasts: {
    undo: 'Undo',
    paid: (id) => `${id} marked paid`,
    sent: (invoice) => `${invoice.id} sent to ${invoice.customer}`,
    reminded: (invoice) => `Reminder sent to ${invoice.customer}`,
    created: (id) => `${id} created`,
    archived: (id) => `${id} archived`,
    exported: (file) => `${file} is ready`,
    printed: 'Sent to the printer',
  },
  form: {
    title: 'New invoice',
    description: 'It starts as a draft. Nothing leaves this page.',
    customer: 'Customer',
    choose: 'Choose a customer',
    amount: 'Amount',
    due: 'Due date',
    create: 'Create invoice',
    cancel: 'Cancel',
  },
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
  send: 'Send',
  messageLabel: 'Message',
  askPlaceholder: 'Ask about your billing, or type @ to mention',
  people: 'People',
  noOneMatches: 'No one matches',
  directory: {
    mina: { name: 'Mina Park', role: 'Billing' },
    grace: { name: 'Grace Hopper', role: 'Finance' },
    alan: { name: 'Alan Turing', role: 'Support' },
  },
  mentionTail: ' can you check the INV-1044 total?',
  notifications: 'Notifications',
  mentions: 'Mentions',
  weeklyDigest: 'Weekly digest',
  productNews: 'Product news',
  chips: { design: 'design', billing: 'billing', urgent: 'urgent' },
  activity: 'Activity',
  all: 'All',
  mine: 'Mine',
  loading: 'Loading',
  activityLine: (entry) => {
    switch (entry.kind) {
      case 'paid':
        return `${entry.customer} paid ${entry.id}`;
      case 'reminded':
        return `Reminder sent to ${entry.customer}`;
      case 'sent':
        return `${entry.id} sent to ${entry.customer}`;
      case 'created':
        return `${entry.id} created for ${entry.customer}`;
      case 'moved':
        return `${entry.id} moved to ${EN_FOLDERS[entry.folder]}`;
      case 'archived':
        return `${entry.id} archived`;
    }
  },
  activityBadge: { paid: 'Paid', reminded: 'Sent', sent: 'Sent', created: 'New', moved: 'Moved', archived: 'Archived' },
  nothingAssigned: 'Nothing assigned to you.',
  loadingActivity: 'Loading activity',
  files: 'Files',
  fileDetails: 'File details',
  fileMeta: {
    'exports/q3.csv': 'CSV, 48 KB, made today',
    'exports/q2.csv': 'CSV, 51 KB, made in July',
    contracts: 'PDF, 2.4 MB, signed in March',
  },
  storage: 'Storage, 92 of 100 GB',
  invoiceSettings: 'Invoice settings',
  accent: 'Invoice accent',
  terms: 'Payment terms in days',
  tags: 'Default tags',
  tagLong: 'Accessibility review',
  questions: 'Questions',
  faq: [
    { question: 'When am I billed?', answer: 'On the first of each month, for the seats you used.' },
    { question: 'Can I change plans later?', answer: 'Yes, any time. The new price starts on your next invoice.' },
  ],
  maintenance: { title: 'Scheduled maintenance', body: 'Billing is read-only on Sunday from 02:00 to 03:00 UTC.' },
  cardExpiry: { title: 'Card expires soon', body: 'Update it before 2026-11-01 to keep your plan.' },
};

const KO: PreviewCopy = {
  currency: 'KRW',
  invoices: seed('krw'),
  user: { name: '김하나', initials: '하나' },
  page: '결제',
  greeting: '안녕하세요, 하나 님',
  searchHint: (overdue) => (
    <>
      {overdue === 0 ? '연체된 청구서가 없습니다.' : `연체된 청구서가 ${overdue}건 있습니다.`} {searchKeys}를 눌러
      검색하세요.
    </>
  ),
  search: '검색',
  invite: '초대',
  newInvoice: '새 청구서',
  more: '더 보기',
  exportAs: '내보내기 형식',
  print: '인쇄',
  showDrafts: '임시 저장 보기',
  archiveWorkspace: '워크스페이스 보관',
  settings: '설정',
  palette: {
    input: '청구서와 명령 검색',
    placeholder: '청구서, 고객, 명령을 입력하세요',
    empty: '일치하는 항목이 없습니다.',
    open: (invoice) => `${invoice.id}, ${invoice.customer} 열기`,
  },
  revenue: '매출',
  collected: '수금',
  outstanding: '미수금',
  overdueCount: (count) => `${count}건 연체`,
  collectedShare: '청구액 대비 수금 비율',
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
  upgraded: '새 요금제가 적용되었습니다',
  invoiceList: '청구서',
  invoice: '청구서',
  customer: '고객',
  due: '만기일',
  status: '상태',
  amount: '금액',
  rowActions: (id) => `${id} 작업`,
  invoicePages: '청구서 페이지',
  invoiceFilter: '보기',
  unpaid: '미결제',
  noInvoices: '표시할 청구서가 없습니다.',
  statuses: { draft: '임시 저장', due: '결제 대기', overdue: '연체', paid: '결제 완료' },
  folders: KO_FOLDERS,
  flagged: '표시됨',
  row: {
    open: '열기',
    markPaid: '결제 완료로 표시',
    send: '보내기',
    remind: '알림 보내기',
    moveTo: '이동',
    flag: '표시',
    archive: '보관',
  },
  detail: {
    steps: '진행',
    created: '작성',
    sent: '보냄',
    paid: '결제 완료',
    overdue: '연체',
    overdueBody: (days) => `결제가 ${days}일 늦었습니다.`,
    folder: '폴더',
    inbox: '분류 없음',
  },
  toasts: {
    undo: '실행 취소',
    paid: (id) => `${id} 청구서를 결제 완료로 표시했습니다`,
    sent: (invoice) => `${invoice.id} 청구서를 ${invoice.customer}에 보냈습니다`,
    reminded: (invoice) => `${invoice.customer}에 알림을 보냈습니다`,
    created: (id) => `${id} 청구서를 만들었습니다`,
    archived: (id) => `${id} 청구서를 보관했습니다`,
    exported: (file) => `${file} 파일이 준비되었습니다`,
    printed: '프린터로 보냈습니다',
  },
  form: {
    title: '새 청구서',
    description: '임시 저장으로 시작합니다. 이 페이지 밖으로는 아무것도 보내지 않습니다.',
    customer: '고객',
    choose: '고객을 고르세요',
    amount: '금액',
    due: '만기일',
    create: '청구서 만들기',
    cancel: '취소',
  },
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
  send: '보내기',
  messageLabel: '메시지',
  askPlaceholder: '결제에 대해 물어보거나 @를 입력해 멘션하세요',
  people: '사람',
  noOneMatches: '일치하는 사람이 없습니다',
  directory: {
    mina: { name: '박미나', role: '결제' },
    grace: { name: '이서윤', role: '재무' },
    alan: { name: '최민준', role: '지원' },
  },
  mentionTail: ' 님, INV-1044 합계를 확인해 주시겠어요?',
  notifications: '알림',
  mentions: '멘션',
  weeklyDigest: '주간 요약',
  productNews: '제품 소식',
  chips: { design: '디자인', billing: '결제', urgent: '긴급' },
  activity: '활동',
  all: '전체',
  mine: '내 항목',
  loading: '로딩',
  activityLine: (entry) => {
    switch (entry.kind) {
      case 'paid':
        return `${entry.customer}에서 ${entry.id} 청구서를 결제했습니다`;
      case 'reminded':
        return `${entry.customer}에 알림을 보냈습니다`;
      case 'sent':
        return `${entry.id} 청구서를 ${entry.customer}에 보냈습니다`;
      case 'created':
        return `${entry.customer}의 ${entry.id} 청구서를 만들었습니다`;
      case 'moved':
        return `${entry.id} 청구서를 ${KO_FOLDERS[entry.folder]} 폴더로 옮겼습니다`;
      case 'archived':
        return `${entry.id} 청구서를 보관했습니다`;
    }
  },
  activityBadge: { paid: '결제 완료', reminded: '보냄', sent: '보냄', created: '새 항목', moved: '이동', archived: '보관' },
  nothingAssigned: '나에게 배정된 항목이 없습니다.',
  loadingActivity: '활동 불러오는 중',
  files: '파일',
  fileDetails: '파일 정보',
  fileMeta: {
    'exports/q3.csv': 'CSV, 48KB, 오늘 만듦',
    'exports/q2.csv': 'CSV, 51KB, 7월에 만듦',
    contracts: 'PDF, 2.4MB, 3월에 서명함',
  },
  storage: '저장 공간, 100GB 중 92GB',
  invoiceSettings: '청구서 설정',
  accent: '청구서 강조 색',
  terms: '결제 기한(일)',
  tags: '기본 태그',
  tagLong: '접근성 검토',
  questions: '자주 묻는 질문',
  faq: [
    { question: '언제 청구되나요?', answer: '매월 1일에, 사용한 좌석만큼 청구됩니다.' },
    { question: '나중에 요금제를 바꿀 수 있나요?', answer: '네, 언제든지 바꿀 수 있습니다. 새 요금은 다음 청구서부터 적용됩니다.' },
  ],
  maintenance: { title: '정기 점검', body: '일요일 02:00부터 03:00(UTC)까지 결제는 읽기 전용입니다.' },
  cardExpiry: { title: '카드 만료 예정', body: '요금제를 유지하려면 2026년 11월 1일 전에 카드를 바꾸세요.' },
};

export const PREVIEW_COPY: Record<Locale, PreviewCopy> = { en: EN, ko: KO };
