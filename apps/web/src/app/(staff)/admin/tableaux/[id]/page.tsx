import { notFound } from 'next/navigation';
import { prisma } from '@tt/db';
import { BracketRegistrationsPage } from '@/components/admin/BracketRegistrationsPage';

export const dynamic = 'force-dynamic';

interface Props {
  params: Promise<{ id: string }>;
}

export default async function AdminBracketDetail({ params }: Props) {
  const { id } = await params;

  const bracket = await prisma.bracket.findUnique({
    where: { id },
    include: {
      registrations: {
        where: { isActive: true },
        include: { player: true },
      },
    },
  });

  if (!bracket) notFound();

  return (
    <BracketRegistrationsPage
      bracketId={bracket.id}
      bracketName={bracket.name}
      registrations={bracket.registrations}
    />
  );
}
