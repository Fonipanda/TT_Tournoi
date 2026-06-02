/**
 * Helper de sérialisation pour passer des objets Prisma à des Client Components.
 * Convertit les Decimal en number et les Date en ISO string.
 *
 * Next.js 15 refuse de sérialiser les objets Decimal/Date complexes au transit
 * RSC → Client. Il faut donc les convertir explicitement.
 *
 * Usage :
 *   const serialized = serialize(prismaObject);
 *   <ClientComp data={serialized} />
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function serialize<T>(value: T): T {
  if (value === null || value === undefined) return value;
  if (typeof value !== 'object') return value;

  // Date → ISO string
  if (value instanceof Date) {
    return value.toISOString() as unknown as T;
  }

  // Decimal de Prisma : a une méthode toString
  if (
    typeof (value as { toFixed?: unknown }).toFixed === 'function' &&
    typeof (value as { toString?: unknown }).toString === 'function' &&
    (value as object).constructor?.name === 'Decimal'
  ) {
    return Number((value as { toString(): string }).toString()) as unknown as T;
  }

  // Tableaux : récurser
  if (Array.isArray(value)) {
    return value.map((v) => serialize(v)) as unknown as T;
  }

  // Objets : récurser sur chaque champ
  const result: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    result[k] = serialize(v);
  }
  return result as T;
}
