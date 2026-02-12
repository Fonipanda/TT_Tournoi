"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { api } from "@/lib/api";
import { 
  Trophy, Users, Calendar, Clock, MapPin, 
  Star, TrendingUp, Loader2, Radio, Bell,
  UserPlus, Mail, Phone, QrCode, X
} from "lucide-react";

interface Tournament {
  id: string;
  name: string;
  description: string;
  is_active: boolean;
}

interface Bracket {
  id: string;
  name: string;
  category: string;
  day: string | null;
  checkin_end: string | null;
  start_time: string | null;
  max_players: number;
  registered_count: number;
  entry_fee: number;
}

interface Player {
  id: string;
  first_name: string;
  last_name: string;
  license_number: string;
  club: string;
  ranking: number;
}

interface AccueilPageProps {
  onNavigate?: (tab: string) => void;
}

export default function AccueilPage({ onNavigate }: AccueilPageProps) {
  const [loading, setLoading] = useState(true);
  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [brackets, setBrackets] = useState<Bracket[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [showProgramme, setShowProgramme] = useState(false);
  const [showInscrits, setShowInscrits] = useState(false);
  const [showPlaces, setShowPlaces] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const tournaments = await api.tournaments.list();
      if (tournaments.length > 0) {
        setTournament(tournaments[0]);
        const bracketsData = await api.brackets.list(tournaments[0].id);
        setBrackets(bracketsData);
      }
      const playersData = await api.players.list();
      setPlayers(playersData);
    } catch (error) {
      console.error("Erreur chargement donnees:", error);
    } finally {
      setLoading(false);
    }
  };

  const sortBracketsAlphabetically = (bracketsList: Bracket[]) => {
    return [...bracketsList].sort((a, b) => a.name.localeCompare(b.name));
  };

  const groupedBrackets = brackets.reduce((acc, bracket) => {
    const day = bracket.day || "Non defini";
    if (!acc[day]) acc[day] = [];
    acc[day].push(bracket);
    return acc;
  }, {} as Record<string, Bracket[]>);

  const sortedDays = Object.keys(groupedBrackets).sort((a, b) => {
    if (a === "Non defini") return 1;
    if (b === "Non defini") return -1;
    return a.localeCompare(b);
  });

  const availableBrackets = brackets.filter(b => (b.max_players - (b.registered_count || 0)) > 0);

  if (loading) {
    return (
      <div className="flex justify-center items-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center space-y-2"
      >
        <h1 className="text-4xl font-bold text-blue-800">
          Tournoi Chelles Tennis de Table 2025
        </h1>
        <p className="text-lg text-muted-foreground">
          Tournoi National B - Chelles (77500)
        </p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200">
          <CardContent className="pt-6">
            <div className="text-center space-y-4">
              <p className="text-muted-foreground max-w-2xl mx-auto">
                Bienvenue sur la plateforme officielle de gestion de tournoi du club Chelles Tennis de Table.
                <br />
                Suivez les matchs en direct, consultez les tableaux et restez informes !
              </p>
              <div className="flex flex-wrap justify-center gap-3 pt-2">
                <Button 
                  size="lg" 
                  className="bg-blue-600 hover:bg-blue-700"
                  onClick={() => onNavigate?.("inscription")}
                >
                  <UserPlus className="h-5 w-5 mr-2" />
                  S'inscrire au tournoi
                </Button>
                <Button 
                  size="lg" 
                  variant="destructive" 
                  className="gap-2"
                  onClick={() => onNavigate?.("live")}
                >
                  <Radio className="h-5 w-5 animate-pulse" />
                  Suivre en direct
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="grid grid-cols-1 md:grid-cols-3 gap-6"
      >
        <Card 
          className="border-red-200 bg-gradient-to-br from-red-50 to-white hover:shadow-lg transition-shadow cursor-pointer"
          onClick={() => onNavigate?.("live")}
        >
          <CardContent className="pt-6">
            <div className="flex items-start gap-4">
              <div className="p-3 bg-red-100 rounded-full">
                <Radio className="h-6 w-6 text-red-600" />
              </div>
              <div>
                <h3 className="font-bold text-lg text-red-700">Suivi en direct</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Consultez l'etat des tables et les matchs en cours en temps reel
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card 
          className="border-yellow-200 bg-gradient-to-br from-yellow-50 to-white hover:shadow-lg transition-shadow cursor-pointer"
          onClick={() => onNavigate?.("notifications")}
        >
          <CardContent className="pt-6">
            <div className="flex items-start gap-4">
              <div className="p-3 bg-yellow-100 rounded-full">
                <Bell className="h-6 w-6 text-yellow-600" />
              </div>
              <div>
                <h3 className="font-bold text-lg text-yellow-700">Notifications</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Recevez des alertes quand vos joueurs favoris sont appeles
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card 
          className="border-blue-200 bg-gradient-to-br from-blue-50 to-white hover:shadow-lg transition-shadow cursor-pointer"
          onClick={() => setShowProgramme(true)}
        >
          <CardContent className="pt-6">
            <div className="flex items-start gap-4">
              <div className="p-3 bg-blue-100 rounded-full">
                <Trophy className="h-6 w-6 text-blue-600" />
              </div>
              <div>
                <h3 className="font-bold text-lg text-blue-700">Tableaux</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Recherchez un joueur et suivez son parcours dans le tournoi
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.3 }}
        >
          <Card 
            className="h-full bg-gradient-to-br from-blue-50 to-white hover:shadow-lg transition-shadow cursor-pointer"
            onClick={() => setShowProgramme(true)}
          >
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-blue-700">
                <Trophy className="h-5 w-5" />
                Tableaux
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-4xl font-bold text-blue-600">{brackets.length}</p>
              <p className="text-muted-foreground">tableaux disponibles</p>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
        >
          <Card 
            className="h-full bg-gradient-to-br from-green-50 to-white hover:shadow-lg transition-shadow cursor-pointer"
            onClick={() => setShowInscrits(true)}
          >
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-green-700">
                <Users className="h-5 w-5" />
                Inscriptions
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-4xl font-bold text-green-600">
                {brackets.reduce((sum, b) => sum + (b.registered_count || 0), 0)}
              </p>
              <p className="text-muted-foreground">joueurs inscrits</p>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.5 }}
        >
          <Card 
            className="h-full bg-gradient-to-br from-purple-50 to-white hover:shadow-lg transition-shadow cursor-pointer"
            onClick={() => setShowPlaces(true)}
          >
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-purple-700">
                <TrendingUp className="h-5 w-5" />
                Places
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-4xl font-bold text-purple-600">
                {brackets.reduce((sum, b) => sum + Math.max(0, b.max_players - (b.registered_count || 0)), 0)}
              </p>
              <p className="text-muted-foreground">places disponibles</p>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6 }}
      >
        <Card className="bg-gradient-to-r from-gray-50 to-white">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <QrCode className="h-5 w-5" />
              Acces Mobile
            </CardTitle>
            <CardDescription>
              Scannez ce QR Code pour acceder a l'application sur votre smartphone
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col items-center gap-4">
            <div className="bg-white p-4 rounded-lg border-2 border-gray-200 shadow-lg">
              <img 
                src={`https://api.qrserver.com/v1/create-qr-code/?size=192x192&data=${encodeURIComponent(typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000')}`}
                alt="QR Code de l'application"
                className="w-48 h-48"
              />
            </div>
            <div className="text-center">
              <p className="text-sm text-muted-foreground mb-1">URL de l'application:</p>
              <code className="px-2 py-1 bg-gray-100 rounded text-xs">
                {typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000'}
              </code>
            </div>
            <div className="bg-blue-50 p-3 rounded-lg w-full max-w-sm text-sm">
              <ol className="text-blue-700 space-y-1 list-decimal list-inside">
                <li>Ouvrez l'appareil photo</li>
                <li>Pointez vers le QR Code</li>
                <li>Touchez le lien pour ouvrir</li>
              </ol>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.7 }}
      >
        <Card className="bg-blue-50 border-blue-200">
          <CardContent className="pt-6">
            <div className="space-y-4">
              <div className="text-center">
                <MapPin className="h-8 w-8 mx-auto text-blue-600" />
                <h3 className="text-lg font-semibold mt-2">Lieu du tournoi</h3>
                <p className="font-medium">Gymnase Julien Marquay</p>
                <p className="text-muted-foreground">Rue du Grand Cerf, Chelles (77500)</p>
              </div>
              <div className="flex justify-center">
                <iframe 
                  src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d2623.2992372501203!2d2.6079860923415947!3d48.89063409743009!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x47e6105f5709be49%3A0x704e1bf12e41383!2sGymnase%20Julien%20Marquay!5e0!3m2!1sfr!2sfr!4v1770930753192!5m2!1sfr!2sfr" 
                  width="100%" 
                  height="300" 
                  style={{ border: 0, borderRadius: '8px', maxWidth: '600px' }}
                  allowFullScreen 
                  loading="lazy" 
                  referrerPolicy="no-referrer-when-downgrade"
                />
              </div>
              <p className="text-sm text-muted-foreground text-center">
                Acces : Parking disponible sur place
              </p>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      <Dialog open={showProgramme} onOpenChange={setShowProgramme}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Programme du tournoi
            </DialogTitle>
          </DialogHeader>
          <div className="py-4">
            {sortedDays.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">
                Aucun tableau programme pour le moment
              </p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {sortedDays.map((day) => (
                  <div key={day} className="border rounded-lg p-4">
                    <h3 className="text-lg font-semibold mb-3 flex items-center gap-2 text-blue-700">
                      <Calendar className="h-4 w-4" />
                      {day}
                    </h3>
                    <div className="space-y-3">
                      {sortBracketsAlphabetically(groupedBrackets[day]).map((bracket) => {
                        const remaining = bracket.max_players - (bracket.registered_count || 0);
                        return (
                          <div 
                            key={bracket.id}
                            className="p-3 bg-gray-50 rounded-lg"
                          >
                            <div className="flex justify-between items-start">
                              <div>
                                <h4 className="font-medium">{bracket.name}</h4>
                                <p className="text-sm text-muted-foreground">{bracket.category}</p>
                              </div>
                              <Badge variant={remaining <= 0 ? "destructive" : remaining <= 3 ? "warning" : "success"}>
                                {remaining <= 0 ? "Complet" : `${remaining} place${remaining > 1 ? 's' : ''}`}
                              </Badge>
                            </div>
                            <div className="mt-2 flex gap-4 text-sm">
                              {bracket.checkin_end && (
                                <span className="flex items-center gap-1 text-blue-600">
                                  <Clock className="h-3 w-3" />
                                  Pointage: {bracket.checkin_end}
                                </span>
                              )}
                              {bracket.start_time && (
                                <span className="flex items-center gap-1 text-green-600">
                                  <Star className="h-3 w-3" />
                                  Debut: {bracket.start_time}
                                </span>
                              )}
                              <span className="font-medium ml-auto">
                                {Number(bracket.entry_fee).toFixed(2)} €
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showInscrits} onOpenChange={setShowInscrits}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Joueurs inscrits
            </DialogTitle>
          </DialogHeader>
          <div className="py-4">
            {players.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">
                Aucun joueur inscrit pour le moment
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-3 px-2">Nom</th>
                      <th className="text-left py-3 px-2">Prenom</th>
                      <th className="text-left py-3 px-2">Licence</th>
                      <th className="text-left py-3 px-2">Club</th>
                      <th className="text-center py-3 px-2">Points</th>
                    </tr>
                  </thead>
                  <tbody>
                    {players.map((player) => (
                      <tr key={player.id} className="border-b hover:bg-gray-50">
                        <td className="py-3 px-2 font-medium">{player.last_name}</td>
                        <td className="py-3 px-2">{player.first_name}</td>
                        <td className="py-3 px-2">{player.license_number}</td>
                        <td className="py-3 px-2 text-sm text-muted-foreground">{player.club}</td>
                        <td className="py-3 px-2 text-center">
                          <Badge variant="outline">{player.ranking} pts</Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showPlaces} onOpenChange={setShowPlaces}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Places disponibles
            </DialogTitle>
          </DialogHeader>
          <div className="py-4">
            {availableBrackets.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">
                Tous les tableaux sont complets
              </p>
            ) : (
              <div className="space-y-3">
                {sortBracketsAlphabetically(availableBrackets).map((bracket) => {
                  const remaining = bracket.max_players - (bracket.registered_count || 0);
                  return (
                    <div 
                      key={bracket.id}
                      className="p-4 border rounded-lg flex justify-between items-center"
                    >
                      <div>
                        <h4 className="font-medium">{bracket.name}</h4>
                        <p className="text-sm text-muted-foreground">{bracket.category}</p>
                        {bracket.day && (
                          <p className="text-xs text-blue-600 mt-1">{bracket.day}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-4">
                        <Badge variant={remaining <= 3 ? "warning" : "success"}>
                          {remaining} place{remaining > 1 ? 's' : ''}
                        </Badge>
                        <span className="font-medium">{Number(bracket.entry_fee).toFixed(2)} €</span>
                      </div>
                    </div>
                  );
                })}
                <div className="pt-4 flex justify-center">
                  <Button onClick={() => { setShowPlaces(false); onNavigate?.("inscription"); }}>
                    <UserPlus className="h-4 w-4 mr-2" />
                    S'inscrire
                  </Button>
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
