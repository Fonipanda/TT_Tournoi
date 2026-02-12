"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import { 
  Trophy, Users, Calendar, Clock, MapPin, 
  Star, TrendingUp, Loader2, Radio, Bell,
  UserPlus, Play
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

export default function AccueilPage() {
  const [loading, setLoading] = useState(true);
  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [brackets, setBrackets] = useState<Bracket[]>([]);

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
    } catch (error) {
      console.error("Erreur chargement donnees:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  const groupedBrackets = brackets.reduce((acc, bracket) => {
    const day = bracket.day || "Non defini";
    if (!acc[day]) acc[day] = [];
    acc[day].push(bracket);
    return acc;
  }, {} as Record<string, Bracket[]>);

  return (
    <div className="space-y-8">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center space-y-4"
      >
        <h1 className="text-4xl font-bold text-blue-800">
          {tournament?.name || "Tournoi Chelles TT 2025"}
        </h1>
        <p className="text-lg text-muted-foreground">
          Tournoi National B - Tennis de Table - Chelles (77500)
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
              <h2 className="text-2xl font-bold text-blue-800">Tournoi Chelles TT 2025</h2>
              <p className="text-muted-foreground max-w-2xl mx-auto">
                Bienvenue sur la plateforme officielle du tournoi de tennis de table de Chelles TT. 
                Suivez les matchs en direct, consultez les tableaux et restez informes !
              </p>
              <div className="flex flex-wrap justify-center gap-3 pt-2">
                <Button size="lg" className="bg-blue-600 hover:bg-blue-700">
                  <UserPlus className="h-5 w-5 mr-2" />
                  S'inscrire au tournoi
                </Button>
                <Button size="lg" variant="destructive" className="gap-2">
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
        <Card className="border-red-200 bg-gradient-to-br from-red-50 to-white hover:shadow-lg transition-shadow cursor-pointer">
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

        <Card className="border-yellow-200 bg-gradient-to-br from-yellow-50 to-white hover:shadow-lg transition-shadow cursor-pointer">
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

        <Card className="border-blue-200 bg-gradient-to-br from-blue-50 to-white hover:shadow-lg transition-shadow cursor-pointer">
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
          <Card className="h-full bg-gradient-to-br from-blue-50 to-white">
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
          <Card className="h-full bg-gradient-to-br from-green-50 to-white">
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
          <Card className="h-full bg-gradient-to-br from-purple-50 to-white">
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
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Programme du tournoi
            </CardTitle>
            <CardDescription>
              Consultez les horaires et tableaux prevus
            </CardDescription>
          </CardHeader>
          <CardContent>
            {Object.keys(groupedBrackets).length === 0 ? (
              <p className="text-muted-foreground text-center py-8">
                Aucun tableau programme pour le moment
              </p>
            ) : (
              <div className="space-y-6">
                {Object.entries(groupedBrackets).map(([day, dayBrackets]) => (
                  <div key={day}>
                    <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-blue-600" />
                      {day}
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {dayBrackets.map((bracket) => {
                        const remaining = bracket.max_players - (bracket.registered_count || 0);
                        return (
                          <div 
                            key={bracket.id}
                            className="p-4 border rounded-lg hover:shadow-md transition-shadow"
                          >
                            <h4 className="font-medium">{bracket.name}</h4>
                            <p className="text-sm text-muted-foreground">{bracket.category}</p>
                            <div className="mt-2 space-y-1 text-sm">
                              {bracket.checkin_end && (
                                <p className="flex items-center gap-1 text-blue-600">
                                  <Clock className="h-3 w-3" />
                                  Fin pointage: {bracket.checkin_end}
                                </p>
                              )}
                              {bracket.start_time && (
                                <p className="flex items-center gap-1 text-green-600">
                                  <Star className="h-3 w-3" />
                                  Debut: {bracket.start_time}
                                </p>
                              )}
                            </div>
                            <div className="mt-3 flex justify-between items-center">
                              <Badge variant={remaining <= 0 ? "destructive" : remaining <= 3 ? "warning" : "success"}>
                                {remaining <= 0 ? "Complet" : `${remaining} place${remaining > 1 ? 's' : ''}`}
                              </Badge>
                              <span className="font-medium">{Number(bracket.entry_fee).toFixed(2)} €</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
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
            <div className="text-center space-y-2">
              <MapPin className="h-8 w-8 mx-auto text-blue-600" />
              <h3 className="text-lg font-semibold">Lieu du tournoi</h3>
              <p className="text-muted-foreground">
                Gymnase Municipal - Chelles (77500)
              </p>
              <p className="text-sm text-muted-foreground">
                Acces: Parking disponible sur place
              </p>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
