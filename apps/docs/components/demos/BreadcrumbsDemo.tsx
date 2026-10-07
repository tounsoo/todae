import { Breadcrumbs } from '@tounsoo/todae/breadcrumbs';

export function BreadcrumbsTrail() {
  return (
    <Breadcrumbs.Root>
      <Breadcrumbs.Item>
        <a href="#home">Home</a>
      </Breadcrumbs.Item>
      <Breadcrumbs.Item>
        <a href="#settings">Settings</a>
      </Breadcrumbs.Item>
      <Breadcrumbs.Item current>Billing</Breadcrumbs.Item>
    </Breadcrumbs.Root>
  );
}

export function BreadcrumbsChevron() {
  return (
    <Breadcrumbs.Root separator="›" aria-label="이동 경로" lang="ko">
      <Breadcrumbs.Item>
        <a href="#home">홈</a>
      </Breadcrumbs.Item>
      <Breadcrumbs.Item current>설정</Breadcrumbs.Item>
    </Breadcrumbs.Root>
  );
}
