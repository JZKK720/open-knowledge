import { SiteNav } from './site-nav';

export default function Layout({ children }: LayoutProps<'/'>) {
  return (
    <>
      <SiteNav />
      <main>{children}</main>
    </>
  );
}
