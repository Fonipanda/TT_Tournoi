/**
 * Seed initial — Tournoi démo "Chelles 2026"
 *
 * Crée :
 *  - 1 admin (admin / Admin123!) — à changer immédiatement en prod
 *  - 1 juge-arbitre (ja / Ja123!)
 *  - 1 tournoi actif "Démo Chelles 2026" + 4 brackets
 *  - 16 joueurs FFTT (importés du seed du dépôt Emergent)
 *  - 2 salles, 10 tables canvas
 *  - 3 sections de menu buvette
 *  - 3 templates SMS (table_assigned, match_created, result)
 *  - 1 SmsAdapterConfig OVH inactif (à activer + remplir secrets via UI)
 *
 * Usage : pnpm db:seed
 */

import argon2 from 'argon2';
import { Prisma, prisma } from '../src/index.ts';

async function hashPassword(pw: string): Promise<string> {
  return argon2.hash(pw, {
    type: argon2.argon2id,
    memoryCost: 65536,
    timeCost: 3,
    parallelism: 1,
  });
}

async function main() {
  console.info('[seed] Début du seed…');

  // ---------------------------------------------------------------------------
  // Tournoi
  // ---------------------------------------------------------------------------
  const tournament = await prisma.tournament.upsert({
    where: { id: '00000000-0000-0000-0000-000000000001' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000001',
      name: 'Tournoi Démo Chelles 2026',
      description:
        'Tournoi de démonstration pour la plateforme TT Tournoi v2 (données de test).',
      date: '23-24 mars 2026',
      startDate: new Date('2026-03-23T08:00:00Z'),
      endDate: new Date('2026-03-24T19:00:00Z'),
      location: 'Gymnase de Chelles, 77500',
      contact: 'contact@chellestt.fr',
      hours: 'Samedi 8h-19h, Dimanche 9h-18h',
      schedule: [
        { title: 'Ouverture des inscriptions', start: '08:00', end: '08:45' },
        { title: 'Tableau A (≤ 1000 pts)', start: '09:00', end: '13:00' },
        { title: 'Tableau B (1000-1500 pts)', start: '13:30', end: '17:00' },
        { title: 'Remise des prix', start: '18:00', end: '19:00' },
      ],
      assoConnectUrl: 'https://www.helloasso.com/associations/chelles-tt',
      publicUrl: 'https://tournoi-chellestt.fr',
      isActive: true,
      smsAutoOnTableAssigned: true,
      smsAutoOnMatchCreated: false,
      smsAutoOnResult: false,
    },
  });
  console.info(`[seed] Tournoi : ${tournament.name}`);

  // ---------------------------------------------------------------------------
  // Brackets
  // ---------------------------------------------------------------------------
  const brackets = [
    {
      id: '00000000-0000-0000-0000-0000000000a1',
      name: 'Tableau A',
      category: '< 1000 pts',
      minPoints: 500,
      maxPoints: 999,
      maxPlayers: 32,
      entryFee: new Prisma.Decimal(8),
      startTime: '09:00',
      day: 'Samedi',
      dotationWinner: new Prisma.Decimal(80),
      dotationFinalist: new Prisma.Decimal(40),
      dotationSemi: new Prisma.Decimal(20),
      prize: '80€ / 40€ / 2x20€',
    },
    {
      id: '00000000-0000-0000-0000-0000000000a2',
      name: 'Tableau B',
      category: '1000-1499 pts',
      minPoints: 1000,
      maxPoints: 1499,
      maxPlayers: 32,
      entryFee: new Prisma.Decimal(10),
      startTime: '13:30',
      day: 'Samedi',
      dotationWinner: new Prisma.Decimal(120),
      dotationFinalist: new Prisma.Decimal(60),
      dotationSemi: new Prisma.Decimal(30),
      prize: '120€ / 60€ / 2x30€',
    },
    {
      id: '00000000-0000-0000-0000-0000000000a3',
      name: 'Tableau C',
      category: '1500-1999 pts',
      minPoints: 1500,
      maxPoints: 1999,
      maxPlayers: 16,
      entryFee: new Prisma.Decimal(12),
      startTime: '09:00',
      day: 'Dimanche',
      dotationWinner: new Prisma.Decimal(180),
      dotationFinalist: new Prisma.Decimal(90),
      dotationSemi: new Prisma.Decimal(45),
      prize: '180€ / 90€ / 2x45€',
    },
    {
      id: '00000000-0000-0000-0000-0000000000a4',
      name: 'Tableau D',
      category: '≥ 2000 pts',
      minPoints: 2000,
      maxPoints: null,
      maxPlayers: 16,
      entryFee: new Prisma.Decimal(15),
      startTime: '14:00',
      day: 'Dimanche',
      dotationWinner: new Prisma.Decimal(250),
      dotationFinalist: new Prisma.Decimal(120),
      dotationSemi: new Prisma.Decimal(60),
      prize: '250€ / 120€ / 2x60€',
    },
  ];

  for (const b of brackets) {
    await prisma.bracket.upsert({
      where: { id: b.id },
      update: {},
      create: { ...b, tournamentId: tournament.id, poolQualifiers: 2 },
    });
  }
  console.info(`[seed] ${brackets.length} brackets`);

  // ---------------------------------------------------------------------------
  // Joueurs (16) — données issues du seed du dépôt Emergent
  // ---------------------------------------------------------------------------
  const players = [
    { firstName: 'Martin', lastName: 'DUPONT', licenseNumber: '7711100001', club: 'Chelles TT', points: 850, phone: '+33611100001', email: 'martin.dupont@example.fr' },
    { firstName: 'Paul', lastName: 'MARTIN', licenseNumber: '7711100002', club: 'Chelles TT', points: 920, phone: '+33611100002', email: 'paul.martin@example.fr' },
    { firstName: 'Lucas', lastName: 'BERNARD', licenseNumber: '7711100003', club: 'Vaires PPC', points: 1080, phone: '+33611100003', email: 'lucas.bernard@example.fr' },
    { firstName: 'Tom', lastName: 'PETIT', licenseNumber: '7711100004', club: 'Champs/Marne', points: 1150, phone: '+33611100004', email: 'tom.petit@example.fr' },
    { firstName: 'Hugo', lastName: 'ROBERT', licenseNumber: '7711100005', club: 'Noisy-le-Grand', points: 1240, phone: '+33611100005', email: 'hugo.robert@example.fr' },
    { firstName: 'Léo', lastName: 'RICHARD', licenseNumber: '7711100006', club: 'Lognes TT', points: 1320, phone: '+33611100006', email: 'leo.richard@example.fr' },
    { firstName: 'Nathan', lastName: 'DURAND', licenseNumber: '7711100007', club: 'Chelles TT', points: 1410, phone: '+33611100007', email: 'nathan.durand@example.fr' },
    { firstName: 'Arthur', lastName: 'MOREAU', licenseNumber: '7711100008', club: 'Vaires PPC', points: 1480, phone: '+33611100008', email: 'arthur.moreau@example.fr' },
    { firstName: 'Mathis', lastName: 'LAURENT', licenseNumber: '7711100009', club: 'Noisy-le-Grand', points: 1560, phone: '+33611100009', email: 'mathis.laurent@example.fr' },
    { firstName: 'Raphaël', lastName: 'SIMON', licenseNumber: '7711100010', club: 'Chelles TT', points: 1640, phone: '+33611100010', email: 'raphael.simon@example.fr' },
    { firstName: 'Julien', lastName: 'MICHEL', licenseNumber: '7711100011', club: 'Champs/Marne', points: 1720, phone: '+33611100011', email: 'julien.michel@example.fr' },
    { firstName: 'Antoine', lastName: 'LEFEBVRE', licenseNumber: '7711100012', club: 'Lognes TT', points: 1810, phone: '+33611100012', email: 'antoine.lefebvre@example.fr' },
    { firstName: 'Romain', lastName: 'LEROY', licenseNumber: '7711100013', club: 'Vaires PPC', points: 1880, phone: '+33611100013', email: 'romain.leroy@example.fr' },
    { firstName: 'Maxime', lastName: 'ROUX', licenseNumber: '7711100014', club: 'Chelles TT', points: 1950, phone: '+33611100014', email: 'maxime.roux@example.fr' },
    { firstName: 'Louis', lastName: 'DAVID', licenseNumber: '7711100015', club: 'Noisy-le-Grand', points: 2080, phone: '+33611100015', email: 'louis.david@example.fr' },
    { firstName: 'Gabriel', lastName: 'BERTRAND', licenseNumber: '7711100016', club: 'Chelles TT', points: 2240, phone: '+33611100016', email: 'gabriel.bertrand@example.fr' },
  ];

  for (const p of players) {
    await prisma.player.upsert({
      where: { licenseNumber: p.licenseNumber },
      update: {},
      create: p,
    });
  }
  console.info(`[seed] ${players.length} joueurs FFTT`);

  // ---------------------------------------------------------------------------
  // Comptes : admin + juge-arbitre
  //
  // ATTENTION — identifiants de DÉVELOPPEMENT uniquement.
  // En production, créer/réinitialiser le compte avec un mot de passe conforme
  // à la politique (12 car. + maj/min/chiffre/spécial) :
  //   node infra/scripts/create-admin.mjs admin '<MotDePasseFort>'
  // ---------------------------------------------------------------------------
  await prisma.userAccount.upsert({
    where: { username: 'admin' },
    update: {},
    create: {
      username: 'admin',
      email: 'admin@chellestt.fr',
      passwordHash: await hashPassword('Admin123!'),
      passwordNeedsReset: false,
      role: 'admin',
    },
  });

  await prisma.userAccount.upsert({
    where: { username: 'ja' },
    update: {},
    create: {
      username: 'ja',
      email: 'ja@chellestt.fr',
      passwordHash: await hashPassword('Ja123!'),
      passwordNeedsReset: false,
      role: 'juge_arbitre',
    },
  });
  console.info('[seed] Comptes admin + juge-arbitre');

  // ---------------------------------------------------------------------------
  // Salles & tables (canvas libre)
  // ---------------------------------------------------------------------------
  const room1 = await prisma.room.upsert({
    where: { id: '00000000-0000-0000-0000-0000000000b1' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-0000000000b1',
      tournamentId: tournament.id,
      name: 'Salle Principale',
      description: 'Salle des compétitions, 6 tables',
      width: 900,
      height: 550,
      entranceMarkers: [{ x: 50, y: 270, label: 'Entrée' }],
      buvetteMarkers: [{ x: 850, y: 100, label: 'Buvette' }],
      wcMarkers: [{ x: 850, y: 450, label: 'WC' }],
      arrowMarkers: [],
    },
  });

  const room2 = await prisma.room.upsert({
    where: { id: '00000000-0000-0000-0000-0000000000b2' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-0000000000b2',
      tournamentId: tournament.id,
      name: 'Salle Annexe',
      description: 'Salle annexe, 4 tables',
      width: 700,
      height: 400,
      entranceMarkers: [{ x: 30, y: 200, label: 'Entrée' }],
      buvetteMarkers: [],
      wcMarkers: [{ x: 670, y: 350, label: 'WC' }],
      arrowMarkers: [{ x: 350, y: 50, rotation: 90, label: 'Salle principale' }],
    },
  });

  // 6 tables salle 1
  for (let i = 1; i <= 6; i++) {
    await prisma.tableModel.upsert({
      where: { number: i },
      update: {},
      create: {
        roomId: room1.id,
        number: i,
        x: 150 + ((i - 1) % 3) * 250,
        y: 120 + Math.floor((i - 1) / 3) * 220,
        rotation: 0,
        status: 'free',
      },
    });
  }
  // 4 tables salle 2 (numéros 7 à 10)
  for (let i = 7; i <= 10; i++) {
    await prisma.tableModel.upsert({
      where: { number: i },
      update: {},
      create: {
        roomId: room2.id,
        number: i,
        x: 100 + ((i - 7) % 2) * 280,
        y: 100 + Math.floor((i - 7) / 2) * 180,
        rotation: 0,
        status: 'free',
      },
    });
  }
  console.info('[seed] 2 salles, 10 tables');

  // ---------------------------------------------------------------------------
  // Buvette
  // ---------------------------------------------------------------------------
  const sections = [
    {
      id: '00000000-0000-0000-0000-0000000000c1',
      name: 'Boissons',
      order: 1,
      items: [
        { name: 'Eau plate 50cl', price: 1, description: 'Bouteille' },
        { name: 'Coca / Sprite', price: 2, description: 'Canette 33cl' },
        { name: 'Café', price: 1, description: 'Expresso' },
      ],
    },
    {
      id: '00000000-0000-0000-0000-0000000000c2',
      name: 'Restauration',
      order: 2,
      items: [
        { name: 'Sandwich jambon-beurre', price: 4, description: 'Baguette tradition' },
        { name: 'Sandwich poulet-crudités', price: 5, description: '' },
        { name: 'Hot-dog', price: 4, description: 'Saucisse + moutarde' },
        { name: 'Croque-monsieur', price: 4, description: 'Pain de mie + jambon + fromage' },
      ],
    },
    {
      id: '00000000-0000-0000-0000-0000000000c3',
      name: 'Sucré',
      order: 3,
      items: [
        { name: 'Crêpe sucre', price: 2, description: '' },
        { name: 'Crêpe Nutella', price: 3, description: '' },
        { name: 'Gâteau maison', price: 2, description: 'Au choix' },
      ],
    },
  ];

  for (const s of sections) {
    const section = await prisma.menuSection.upsert({
      where: { id: s.id },
      update: {},
      create: {
        id: s.id,
        tournamentId: tournament.id,
        name: s.name,
        order: s.order,
      },
    });
    for (const [idx, item] of s.items.entries()) {
      // upsert by composite (sectionId + name)
      const existing = await prisma.menuItem.findFirst({
        where: { sectionId: section.id, name: item.name },
      });
      if (!existing) {
        await prisma.menuItem.create({
          data: {
            sectionId: section.id,
            name: item.name,
            description: item.description,
            price: new Prisma.Decimal(item.price),
            order: idx,
          },
        });
      }
    }
  }
  console.info('[seed] Menu buvette : 3 sections, 10 items');

  // ---------------------------------------------------------------------------
  // Templates SMS
  // ---------------------------------------------------------------------------
  const templates = [
    {
      name: 'table_assigned',
      content:
        'Bonjour {joueur}, votre prochain match est sur la table {table} ({salle}). Adversaire : {adversaire}. Bonne chance !',
    },
    {
      name: 'match_created',
      content:
        'Bonjour {joueur}, un match vient de vous être attribué : {tableau} contre {adversaire}. Restez disponible.',
    },
    {
      name: 'result',
      content:
        'Bonjour {joueur}, le résultat de votre match {tableau} a été enregistré. Consultez votre espace pour le détail.',
    },
  ];
  for (const t of templates) {
    await prisma.smsTemplate.upsert({
      where: { name: t.name },
      update: {},
      create: t,
    });
  }
  console.info(`[seed] ${templates.length} templates SMS`);

  // ---------------------------------------------------------------------------
  // SMS Adapter Config (OVH inactif par défaut, à activer en UI admin)
  // ---------------------------------------------------------------------------
  await prisma.smsAdapterConfig.upsert({
    where: { id: '00000000-0000-0000-0000-0000000000d1' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-0000000000d1',
      name: 'OVH SMS Pro (Chelles TT)',
      adapterType: 'ovh',
      defaultSender: 'ChellesTT',
      isActive: false,
      config: {
        appKey: '',
        appSecret: '',
        consumerKey: '',
        serviceName: '',
      },
    },
  });
  console.info('[seed] Config OVH SMS (inactive — à activer + remplir secrets via UI admin)');

  console.info('[seed] ✅ Terminé.');
}

main()
  .catch((e) => {
    console.error('[seed] Erreur :', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
