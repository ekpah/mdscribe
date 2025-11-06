import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@repo/design-system/components/ui/breadcrumb';
import { SidebarTrigger } from '@repo/design-system/components/ui/sidebar';
import Link from 'next/link';
import { NavActions } from './_components/NavActions';
import SkeletonContentSection from './_components/SkeletonContentSection';

export default function Loading() {
  return (
    <div className="flex h-full w-full flex-col">
      <div className="flex h-10 items-center justify-between gap-2">
        <SidebarTrigger className="ml-4 block md:hidden" />
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem className="hidden md:block">
              <Link href={'/guidelines'}>Guidelines</Link>
            </BreadcrumbItem>
            <BreadcrumbSeparator className="hidden md:block" />
            <BreadcrumbItem>
              <BreadcrumbPage>Loading...</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
        <NavActions
          favouriteOfCount={0}
          isFavourite={false}
          isLoggedIn={false}
          lastEdited={new Date()}
          guidelineId={''}
        />
      </div>
      <SkeletonContentSection />
    </div>
  );
}
