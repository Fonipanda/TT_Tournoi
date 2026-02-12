"use client";

import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { 
  FileText, AlertTriangle, Clock, Users, 
  Trophy, CreditCard, Phone, Shield, CheckCircle,
  Shirt, Target, Calendar, Heart, Mail, Globe
} from "lucide-react";

export default function ReglementPage() {
  const sections = [
    {
      icon: Target,
      title: "Regles generales",
      color: "text-blue-600",
      bgColor: "bg-blue-50",
      items: [
        "Les matchs se deroulent selon les regles officielles de la FFTT (Federation Francaise de Tennis de Table)",
        "Tous les participants doivent etre licencies FFTT pour l'annee en cours",
        "Le port d'une tenue de sport appropriee est obligatoire (short ou pantalon de sport, chaussures de sport)",
        "Les raquettes doivent etre conformes aux reglements FFTT (revetements homologues)"
      ]
    },
    {
      icon: Trophy,
      title: "Format des matchs",
      color: "text-yellow-600",
      bgColor: "bg-yellow-50",
      items: [
        "Tours preliminaires : Matchs au meilleur des 5 sets (premier a 3 sets gagnes)",
        "Demi-finales et finales : Matchs au meilleur des 7 sets (premier a 4 sets gagnes)",
        "Chaque set se joue en 11 points, avec 2 points d'ecart minimum",
        "En cas d'egalite 10-10, le premier joueur a mener de 2 points remporte le set"
      ]
    },
    {
      icon: FileText,
      title: "Inscriptions",
      color: "text-green-600",
      bgColor: "bg-green-50",
      items: [
        "Les inscriptions se font exclusivement en ligne sur cette plateforme",
        "Chaque joueur peut s'inscrire dans maximum 2 tableaux differents",
        "Les frais d'inscription varient selon le tableau choisi",
        "Paiement possible par carte bancaire ou sur place le jour du tournoi",
        "Les inscriptions sont closes 48h avant le debut du tournoi"
      ]
    },
    {
      icon: Users,
      title: "Tableaux et categories",
      color: "text-purple-600",
      bgColor: "bg-purple-50",
      items: [
        "Les tableaux sont organises par niveau de classement (points FFTT)",
        "Chaque tableau a un nombre maximum de participants",
        "En cas de surnombre, priorite aux premiers inscrits",
        "L'organisateur se reserve le droit de modifier les tableaux selon les inscriptions"
      ]
    },
    {
      icon: Clock,
      title: "Horaires et presence",
      color: "text-orange-600",
      bgColor: "bg-orange-50",
      items: [
        "Les joueurs doivent etre presents 30 minutes avant leur premier match",
        "Tout retard de plus de 15 minutes entraine la forfaiture automatique",
        "Les horaires des matchs sont indicatifs et peuvent evoluer selon le deroulement",
        "Consultez regulierement l'affichage des matchs et les annonces"
      ]
    },
    {
      icon: Heart,
      title: "Fair-play et comportement",
      color: "text-teal-600",
      bgColor: "bg-teal-50",
      items: [
        "Le respect des adversaires, des arbitres et des organisateurs est exige",
        "Tout comportement antisportif peut entrainer une disqualification",
        "Les decisions de l'arbitre ou du juge-arbitre sont sans appel",
        "L'usage de substances interdites est strictement interdit"
      ]
    },
    {
      icon: Shield,
      title: "Responsabilite",
      color: "text-red-600",
      bgColor: "bg-red-50",
      items: [
        "Chaque participant evolue sous sa propre responsabilite",
        "L'organisation decline toute responsabilite en cas d'accident ou de blessure",
        "Il est vivement conseille d'avoir une assurance personnelle",
        "Les objets de valeur sont sous la responsabilite de leurs proprietaires"
      ]
    }
  ];

  return (
    <div className="space-y-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center space-y-2"
      >
        <h2 className="text-3xl font-bold flex items-center justify-center gap-2">
          <FileText className="h-8 w-8" />
          Reglement du Tournoi
        </h2>
        <p className="text-muted-foreground max-w-2xl mx-auto">
          Veuillez prendre connaissance des regles ci-dessous avant de vous inscrire
        </p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2 }}
      >
        <Card className="bg-yellow-50 border-yellow-200">
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-6 w-6 text-yellow-600 flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="font-semibold text-yellow-800">Important</h3>
                <p className="text-yellow-700 text-sm">
                  L'inscription au tournoi implique l'acceptation integrale du present reglement. 
                  Le non-respect de ces regles peut entrainer la disqualification sans remboursement.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {sections.map((section, index) => (
          <motion.div
            key={section.title}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 * (index + 1) }}
          >
            <Card className={`h-full ${section.bgColor} border-0`}>
              <CardHeader>
                <CardTitle className={`flex items-center gap-2 ${section.color}`}>
                  <section.icon className="h-5 w-5" />
                  {section.title}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {section.items.map((item, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm">
                      <CheckCircle className={`h-4 w-4 ${section.color} flex-shrink-0 mt-0.5`} />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.9 }}
      >
        <Card className="bg-blue-50 border-blue-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-blue-700">
              <Phone className="h-5 w-5" />
              Contact organisateur
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 rounded-full">
                  <Users className="h-4 w-4 text-blue-600" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Club</p>
                  <p className="font-medium">Chelles Tennis de Table</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 rounded-full">
                  <Mail className="h-4 w-4 text-blue-600" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Email</p>
                  <p className="font-medium">ttchelles@gmail.com</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 rounded-full">
                  <Globe className="h-4 w-4 text-blue-600" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Site web</p>
                  <p className="font-medium">chellestt.fr</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 rounded-full">
                  <Phone className="h-4 w-4 text-blue-600" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Telephone</p>
                  <p className="font-medium">07 79 94 63 56</p>
                  <p className="text-xs text-muted-foreground">(le jour du tournoi)</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.0 }}
        className="text-center text-sm text-muted-foreground"
      >
        <p>
          Ce reglement est conforme aux dispositions de la Federation Francaise de Tennis de Table (FFTT).
        </p>
        <p className="mt-1">
          Derniere mise a jour : Fevrier 2026
        </p>
      </motion.div>
    </div>
  );
}
