import { prisma } from '@tt/db';
import { BuvetteMenu } from './BuvetteMenu';

export const dynamic = 'force-dynamic';

export default async function BuvettePage() {
  // Affiche TOUTES les sections (peu importe le tournoi) → buvette globale
  const sections = await prisma.menuSection.findMany({
    orderBy: [{ order: 'asc' }, { name: 'asc' }],
    include: {
      items: { where: { isAvailable: true }, orderBy: { order: 'asc' } },
    },
  });

  // Déduplication par nom (si plusieurs tournois ont la même section "Boissons")
  const seen = new Set<string>();
  const unique = sections.filter((s) => {
    if (seen.has(s.name)) return false;
    seen.add(s.name);
    return true;
  });

  return (
    <BuvetteMenu
      sections={unique.map((s) => ({
        id: s.id,
        name: s.name,
        items: s.items.map((it) => ({
          id: it.id,
          name: it.name,
          description: it.description,
          price: it.price.toString(),
          imageUrl: it.imageUrl,
        })),
      }))}
    />
  );
}
