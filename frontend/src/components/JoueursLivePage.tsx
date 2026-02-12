"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { api } from "@/lib/api";
import { Users, Loader2, Clock } from "lucide-react";

interface LiveMatch {
  id: string;
  bracket: { id: string; name: string };
  player1: { id: string; name: string; club: string; ranking: string };
  player2: { id: string; name: string; club: string; ranking: string };
  table: { id: string; number: number } | null;
  status: string;
  sets_player1: number;
  sets_player2: number;
  start_time: string | null;
}

export default function JoueursLivePage() {
  const [matches, setMatches] = useState<LiveMatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchMatches = async () => {
    try {
      const data = await api.live.matches();
      setMatches(data);
      setError(null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMatches();
    const interval = setInterval(fetchMatches, 10000);
    return () => clearInterval(interval);
  }, []);

  const formatDuration = (startTime: string | null) => {
    if (!startTime) return "-";
    const start = new Date(startTime);
    const now = new Date();
    const diff = Math.floor((now.getTime() - start.getTime()) / 1000 / 60);
    return `${diff} min`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (error) {
    return (
      <Card className="bg-red-50 border-red-200">
        <CardContent className="pt-6">
          <p className="text-red-600">Erreur: {error}</p>
        </CardContent>
      </Card>
    );
  }

  const inProgressMatches = matches.filter(m => m.status === "in_progress");
  const waitingMatches = matches.filter(m => m.status === "waiting");

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Joueurs en Match ({inProgressMatches.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {inProgressMatches.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">
              Aucun match en cours
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-3 px-2">Table</th>
                    <th className="text-left py-3 px-2">Joueur 1</th>
                    <th className="text-left py-3 px-2">Club</th>
                    <th className="text-left py-3 px-2">Joueur 2</th>
                    <th className="text-left py-3 px-2">Club</th>
                    <th className="text-left py-3 px-2">Tableau</th>
                    <th className="text-left py-3 px-2">Duree</th>
                  </tr>
                </thead>
                <tbody>
                  {inProgressMatches.map((match, index) => (
                    <motion.tr
                      key={match.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.05 }}
                      className="border-b hover:bg-gray-50"
                    >
                      <td className="py-3 px-2">
                        <Badge variant="destructive">
                          {match.table?.number || "-"}
                        </Badge>
                      </td>
                      <td className="py-3 px-2 font-medium">
                        {match.player1.name}
                        <span className="text-xs text-muted-foreground ml-1">
                          ({match.player1.ranking} pts)
                        </span>
                      </td>
                      <td className="py-3 px-2 text-sm text-muted-foreground">
                        {match.player1.club}
                      </td>
                      <td className="py-3 px-2 font-medium">
                        {match.player2.name}
                        <span className="text-xs text-muted-foreground ml-1">
                          ({match.player2.ranking} pts)
                        </span>
                      </td>
                      <td className="py-3 px-2 text-sm text-muted-foreground">
                        {match.player2.club}
                      </td>
                      <td className="py-3 px-2">
                        <Badge variant="outline">{match.bracket.name}</Badge>
                      </td>
                      <td className="py-3 px-2 text-sm text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {formatDuration(match.start_time)}
                        </span>
                      </td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5 text-yellow-600" />
            Joueurs en Attente ({waitingMatches.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {waitingMatches.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">
              Aucun match en attente
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-3 px-2">Joueur 1</th>
                    <th className="text-left py-3 px-2">Club</th>
                    <th className="text-center py-3 px-2">VS</th>
                    <th className="text-left py-3 px-2">Joueur 2</th>
                    <th className="text-left py-3 px-2">Club</th>
                    <th className="text-left py-3 px-2">Tableau</th>
                  </tr>
                </thead>
                <tbody>
                  {waitingMatches.map((match, index) => (
                    <motion.tr
                      key={match.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.05 }}
                      className="border-b hover:bg-gray-50"
                    >
                      <td className="py-3 px-2 font-medium">
                        {match.player1.name}
                        <span className="text-xs text-muted-foreground ml-1">
                          ({match.player1.ranking} pts)
                        </span>
                      </td>
                      <td className="py-3 px-2 text-sm text-muted-foreground">
                        {match.player1.club}
                      </td>
                      <td className="py-3 px-2 text-center text-muted-foreground">
                        VS
                      </td>
                      <td className="py-3 px-2 font-medium">
                        {match.player2.name}
                        <span className="text-xs text-muted-foreground ml-1">
                          ({match.player2.ranking} pts)
                        </span>
                      </td>
                      <td className="py-3 px-2 text-sm text-muted-foreground">
                        {match.player2.club}
                      </td>
                      <td className="py-3 px-2">
                        <Badge variant="outline">{match.bracket.name}</Badge>
                      </td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
