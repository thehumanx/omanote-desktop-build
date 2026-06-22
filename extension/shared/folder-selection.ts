export interface NamedTarget {
  _id: string;
  name: string;
}

export function normalizeTargetName(value: string): string {
  return value.trim().toLocaleLowerCase();
}

export function sortTargetsByName<T extends NamedTarget>(items: T[]): T[] {
  return [...items].sort((left, right) => left.name.localeCompare(right.name, undefined, { sensitivity: "base" }));
}

export function findTargetByName<T extends NamedTarget>(items: T[], name: string): T | null {
  const normalized = normalizeTargetName(name);
  if (!normalized) return null;
  return items.find((item) => normalizeTargetName(item.name) === normalized) ?? null;
}

export function selectPreferredTargetId<T extends NamedTarget>(items: T[], lastSelectedId?: string | null): string {
  if (lastSelectedId && items.some((item) => item._id === lastSelectedId)) {
    return lastSelectedId;
  }

  return sortTargetsByName(items)[0]?._id ?? "";
}
