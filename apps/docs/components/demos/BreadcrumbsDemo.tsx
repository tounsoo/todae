import { Breadcrumbs } from '@tounsoo/todae/breadcrumbs';
import { Link } from '@tounsoo/todae/link';

export function BreadcrumbsTrail() {
  return (
    <Breadcrumbs.Root>
      <Breadcrumbs.Item>
        <Link.Root href="#home">Home</Link.Root>
      </Breadcrumbs.Item>
      <Breadcrumbs.Item>
        <Link.Root href="#settings">Settings</Link.Root>
      </Breadcrumbs.Item>
      <Breadcrumbs.Item current>Billing</Breadcrumbs.Item>
    </Breadcrumbs.Root>
  );
}

export function BreadcrumbsChevron() {
  return (
    <Breadcrumbs.Root separator="›" aria-label="이동 경로" lang="ko">
      <Breadcrumbs.Item>
        <Link.Root href="#home">홈</Link.Root>
      </Breadcrumbs.Item>
      <Breadcrumbs.Item current>설정</Breadcrumbs.Item>
    </Breadcrumbs.Root>
  );
}
