export function tagDepth(tag: string) {
  return tag.split("/").length;
}

export function parentTag(tag: string): string | null {
  const parts = tag.split("/");
  if (parts.length <= 1) {
    return null;
  }
  return parts[0]!;
}

export function tagsByParent<T extends { tag: string }>(tags: T[]) {
  const map: Record<string, { parent: T | null; children: T[] }> = {};
  tags.forEach((tag) => {
    const parent = parentTag(tag.tag) ?? "root";
    if (parent === "root") {
      if (!map[tag.tag]) {
        map[tag.tag] = { parent: tag, children: [] };
      }
      return;
    }
    if (parent && parent !== "root") {
      if (!map[parent]) {
        map[parent] = { parent: null, children: [tag] };
      } else {
        map[parent].children.push(tag);
      }
    } else {
      throw new Error(`Unexpected tag structure for tag: ${tag.tag}`);
    }
  });
  return Object.values(map).filter((v) => v.parent !== null) as Array<{
    parent: T;
    children: T[];
  }>;
}

export function lowestTagForString(tagString: string): string {
  const parts = tagString.split("/");
  return parts.at(-1)!;
}
