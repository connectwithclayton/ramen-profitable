export type AppIdea = readonly [name: string, idea: string];

export function pickAppIdea(
  ideas: readonly AppIdea[],
  usedNames: ReadonlySet<string>,
  random = Math.random,
): AppIdea {
  const unusedIdeas = ideas.filter(([name]) => !usedNames.has(name));
  const pool = unusedIdeas.length > 0 ? unusedIdeas : ideas;
  return pool[Math.floor(random() * pool.length)]!;
}
