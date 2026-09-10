import 'server-only';

import { getRepository } from '@/data/repository';
import { TOOL_DEFS } from '@/concierge/tools/toolDefs';
import { CATEGORY_LABEL, DEPARTMENT_LABEL, METAL_COLOUR_LABEL } from '@/data/labels';
import { notesFor } from '@/data/editorial/materials';
import { specRows } from '@/lib/specs';
import type { Category, Department, Product } from '@/data/types';
import type { ToolName } from '@/concierge/types';

/**
 * The tools that read the catalogue, executed where the catalogue is.
 *
 * A tool that only consults data has no business making a round trip through a browser. The
 * answer is already on this side of the wire; sending the question out and the answer back
 * turns a fact the server knows into a claim a client makes, which then has to be
 * re-validated on arrival. Browser tools stay in the browser because they *are* browser
 * actions — navigating, scrolling, opening the selection — and no server can perform them.
 *
 * Everything returned here is assembled from published fields. There is no path through this
 * file that produces a specification Waseem has not stated: an absent field is absent in the
 * output, and the model is told what that means.
 */

const runtimeByName = new Map(TOOL_DEFS.map((t) => [t.name, t.runtime]));

export const runtimeOf = (name: ToolName): 'browser' | 'server' => runtimeByName.get(name) ?? 'browser';

/** Only what the shop publishes, keyed so a model cannot mistake absence for zero. */
function factsOf(p: Product) {
  const s = p.spec;
  return {
    slug: p.slug,
    name: p.editorialTitle ?? p.title,
    kind: p.category ? CATEGORY_LABEL[p.category as Category] : undefined,
    department: p.departments.map((d) => DEPARTMENT_LABEL[d as Department]).join('/') || undefined,
    purity: s.purity,
    metal: s.metalColour ? METAL_COLOUR_LABEL[s.metalColour] : undefined,
    grossWeightGrams: s.grossWeightGrams,
    diamondCarat: s.diamondCarat,
    diamondClarity: s.diamondClarity,
    diamondColour: s.diamondColour,
    reference: p.reference,
    price: p.price.kind === 'fixed' ? `PKR ${p.price.pkr} as at ${p.price.asOf}` : 'on request',
  };
}

/** Drops undefined so the model never sees a key whose value is nothing. */
const published = <T extends object>(o: T): Partial<T> => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as Partial<T>;

export async function runServerTool(name: ToolName, args: Record<string, unknown>): Promise<unknown> {
  const repo = getRepository();

  switch (name) {
    /**
     * A comparison of two or three pieces, on the axes the shop actually publishes.
     *
     * Every cell is either a published figure or explicitly `null`, and the model is told
     * which. An unknown cell is a real answer here — "Waseem has not published a weight for
     * this one" is the truth, and a comparison that quietly omitted the row would read as
     * though the piece had nothing to compare.
     */
    case 'compareProducts': {
      const slugs = (args.slugs as string[]) ?? [];
      const products = await repo.getProducts(slugs);
      if (products.length < 2) return { error: 'NEED_TWO', message: 'a comparison needs at least two pieces that exist' };
      const AXES = ['purity', 'grossWeightGrams', 'diamondCarat', 'diamondClarity', 'diamondColour', 'price'] as const;
      const rows = AXES.map((axis) => ({
        axis,
        values: products.map((p) => {
          const f = factsOf(p);
          const v = f[axis as keyof typeof f];
          return { slug: p.slug, value: v ?? null };
        }),
        // said explicitly so the model does not fill the gap itself
        unpublishedFor: products.filter((p) => factsOf(p)[axis as keyof ReturnType<typeof factsOf>] === undefined).map((p) => p.slug),
      }));
      return {
        pieces: products.map((p) => published(factsOf(p))),
        rows,
        note: 'A null value means Waseem has not published that figure for that piece. Say so; a consultant confirms it at a viewing.',
      };
    }

    /**
     * What a published specification means — from the authored material notes, which are
     * general facts about the material and say nothing about the individual piece.
     */
    case 'explainSpecification': {
      const slug = typeof args.slug === 'string' ? args.slug : undefined;
      const product = slug ? await repo.getProduct(slug) : undefined;
      if (!product) return { error: 'UNKNOWN_PIECE' };
      return {
        piece: published(factsOf(product)),
        specification: specRows(product).map((r) => ({ label: r.label, value: r.value, source: r.source })),
        notes: notesFor(product, 3).map((n) => ({ term: n.term, meaning: n.body })),
        note: 'These notes are general facts about the material, not claims about this piece.',
      };
    }

    /**
     * The whole listable catalogue, searched properly rather than through the browser's
     * abbreviated index — for the sentences the tray's four results cannot answer.
     */
    case 'deepSearch': {
      const results = await repo.search({
        query: typeof args.query === 'string' ? args.query : undefined,
        limit: Math.min(Number(args.limit ?? 8) || 8, 12),
      });
      return {
        count: results.length,
        items: results.map((p) => published(factsOf(p))),
        note: results.length ? undefined : 'Nothing in the collection matches. Say so; do not substitute.',
      };
    }

    default:
      return { error: 'NOT_A_SERVER_TOOL', tool: name };
  }
}
