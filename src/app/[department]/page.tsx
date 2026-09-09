import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { DEPARTMENT_BY_SLUG, isDepartment } from '@/data/departments';
import { getRepository } from '@/data/repository';
import { DepartmentExperience } from '@/components/department/DepartmentExperience';

/**
 * A department opens only when there is enough behind it to be worth walking into. The
 * repository owns that predicate, so the route, the menu and the category line can never
 * disagree about whether a destination exists — and `dynamicParams = false` means a
 * department that has not earned a page returns 404 rather than an empty room.
 */
export const dynamicParams = false;

export async function generateStaticParams() {
  const departments = await getRepository().departments();
  return departments.map(({ department }) => ({ department }));
}

export async function generateMetadata({ params }: { params: Promise<{ department: string }> }): Promise<Metadata> {
  const { department } = await params;
  if (!isDepartment(department)) return {};
  const info = DEPARTMENT_BY_SLUG[department];
  const { total } = await getRepository().listDepartment(department, { limit: 0 });
  return {
    title: `${info.name} — Waseem Jewellers`,
    description: `${info.tagline} ${total} pieces from Waseem Jewellers, Lahore.`,
    alternates: { canonical: `/${department}` },
  };
}

export default async function DepartmentPage({ params }: { params: Promise<{ department: string }> }) {
  const { department } = await params;
  if (!isDepartment(department)) notFound();
  const repo = getRepository();
  const [rows, categories] = await Promise.all([repo.rows(department), repo.categories(department)]);
  return <DepartmentExperience info={DEPARTMENT_BY_SLUG[department]} rows={rows} categories={categories} />;
}
