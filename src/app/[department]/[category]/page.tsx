import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { DEPARTMENT_BY_SLUG, isDepartment } from '@/data/departments';
import { getRepository } from '@/data/repository';
import { CATEGORY_PLURAL } from '@/data/labels';
import { DepartmentExperience } from '@/components/department/DepartmentExperience';
import type { Category } from '@/data/types';

/**
 * `/gold/pendant`, `/men/cufflink` — a category inside a department.
 *
 * The params come from the same repository predicate the category line links with, so
 * `/gold/nose-pin` simply does not exist: nose pins are a diamond kind with no gold
 * equivalent large enough to open. Nothing here is guarded twice or guessed once.
 */
export const dynamicParams = false;

export async function generateStaticParams() {
  const repo = getRepository();
  const departments = await repo.departments();
  const params: { department: string; category: string }[] = [];
  for (const { department } of departments) {
    for (const { category } of await repo.categories(department)) params.push({ department, category });
  }
  return params;
}

async function resolve(params: Promise<{ department: string; category: string }>) {
  const { department, category } = await params;
  if (!isDepartment(department)) return null;
  const categories = await getRepository().categories(department);
  const match = categories.find((c) => c.category === category);
  return match ? { department, category: match.category, count: match.count, categories } : null;
}

export async function generateMetadata({ params }: { params: Promise<{ department: string; category: string }> }): Promise<Metadata> {
  const found = await resolve(params);
  if (!found) return {};
  const info = DEPARTMENT_BY_SLUG[found.department];
  const plural = CATEGORY_PLURAL[found.category];
  return {
    title: `${plural} in ${info.name} — Waseem Jewellers`,
    description: `${found.count} ${plural.toLowerCase()} from Waseem Jewellers, Lahore. ${info.tagline}`,
    alternates: { canonical: `/${found.department}/${found.category}` },
  };
}

export default async function CategoryPage({ params }: { params: Promise<{ department: string; category: string }> }) {
  const found = await resolve(params);
  if (!found) notFound();
  const rows = await getRepository().rows(found.department);
  return (
    <DepartmentExperience
      info={DEPARTMENT_BY_SLUG[found.department]}
      rows={rows}
      categories={found.categories}
      fixedCategory={found.category as Category}
    />
  );
}
