"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { api } from "@/lib/api";
import { Trophy, Search, Loader2, User, AlertCircle } from "lucide-react";

interface Bracket {
  id: string;
  name: string;
  category: string;
}

interface Match {
  id: string;
  player1_name: string;
  player2_name: string;
  player1_club: string;
  player2_club: string;
  player1_ranking: string;
  player2_ranking: string;
  status: string;
  sets_player1: number;
  sets_player2: number;
  winner_name: string | null;
  round_name: string;
  round_number: number;
}

interface PlayerProgression {
  player: any;
  matches: Match[];
}

export default function TableauPage() {
  const [brackets, setBrackets] = useState<Bracket[]>([]);
  const [selectedBracket, setSelectedBracket] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [progression, setProgression] = useState<PlayerProgression | null>(null);
  const [allMatches, setAllMatches] = useState<Match[]>([]);

  useEffect(() => {
    fetchBrackets();
  }, []);

  useEffect(() => {
    if (selectedBracket) {
      fetchBracketMatches();
    }
  }, [selectedBracket]);

  const fetchBrackets = async () => {
    try {
      const data = await api.brackets.list();
      setBrackets(data);
    } catch (err) {
      console.error("Erreur:", err);
    }
  };

  const fetchBracketMatches = async () => {
    try {
      const data = await api.matches.list({ bracket_id: selectedBracket });
      setAllMatches(data);
    } catch (err) {
      console.error("Erreur:", err);
    }
  };

  const searchPlayer = async () => {
    if (!searchQuery.trim()) {
      setSearchError("Entrez un nom ou email");
      return;
    }

    setSearching(true);
    setSearchError(null);
    setProgression(null);

    try {
      const players = await api.players.list(searchQuery);
      
      if (players && players.length > 0) {
        const player = players[0];
        
        let matches: Match[] = [];
        if (selectedBracket) {
          matches = allMatches.filter(
            m => m.player1_name?.toLowerCase().includes(player.last_name.toLowerCase()) ||
                 m.player2_name?.toLowerCase().includes(player.last_name.toLowerCase())
          );
        } else {
          const allMatchesData = await api.matches.list({});
          matches = allMatchesData.filter(
            (m: Match) => m.player1_name?.toLowerCase().includes(player.last_name.toLowerCase()) ||
                         m.player2_name?.toLowerCase().includes(player.last_name.toLowerCase())
          );
        }

        setProgression({ player, matches });
      } else {
        setSearchError("Aucun joueur trouve");
      }
    } catch (err: any) {
      setSearchError(err.message || "Erreur lors de la recherche");
    } finally {
      setSearching(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "finished":
        return <Badge variant="success">Termine</Badge>;
      case "in_progress":
        return <Badge variant="destructive">En cours</Badge>;
      case "waiting":
        return <Badge variant="secondary">En attente</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getRoundLabel = (roundNumber: number) => {
    switch (roundNumber) {
      case 1: return "1er tour";
      case 2: return "2eme tour";
      case 3: return "Quarts de finale";
      case 4: return "Demi-finale";
      case 5: return "Finale";
      default: return `Tour ${roundNumber}`;
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Trophy className="h-5 w-5" />
            Progression dans le Tableau
          </CardTitle>
          <CardDescription>
            Recherchez un joueur pour voir sa progression dans le tournoi
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col md:flex-row gap-4 mb-6">
            <Select value={selectedBracket} onValueChange={setSelectedBracket}>
              <SelectTrigger className="w-full md:w-64">
                <SelectValue placeholder="Tous les tableaux" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous les tableaux</SelectItem>
                {brackets.map((bracket) => (
                  <SelectItem key={bracket.id} value={bracket.id}>
                    {bracket.name} - {bracket.category}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <div className="flex gap-2 flex-1">
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Nom du joueur ou email..."
                onKeyDown={(e) => e.key === "Enter" && searchPlayer()}
              />
              <Button onClick={searchPlayer} disabled={searching}>
                {searching ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Search className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>

          {searchError && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-md mb-4">
              <p className="text-sm text-red-600 flex items-center gap-1">
                <AlertCircle className="h-4 w-4" />
                {searchError}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {progression && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <Card>
            <CardHeader>
              <div className="flex items-center gap-4">
                <div className="h-12 w-12 rounded-full bg-blue-100 flex items-center justify-center">
                  <User className="h-6 w-6 text-blue-600" />
                </div>
                <div>
                  <CardTitle>
                    {progression.player.last_name} {progression.player.first_name}
                  </CardTitle>
                  <CardDescription>
                    {progression.player.club} - {progression.player.ranking} pts
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {progression.matches.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">
                  Aucun match trouve pour ce joueur
                </p>
              ) : (
                <div className="space-y-4">
                  {progression.matches
                    .sort((a, b) => a.round_number - b.round_number)
                    .map((match, index) => {
                      const isPlayer1 = match.player1_name?.toLowerCase().includes(
                        progression.player.last_name.toLowerCase()
                      );
                      const won = match.winner_name?.toLowerCase().includes(
                        progression.player.last_name.toLowerCase()
                      );

                      return (
                        <motion.div
                          key={match.id}
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: index * 0.1 }}
                          className={`p-4 border rounded-lg ${
                            match.status === "finished"
                              ? won
                                ? "border-green-300 bg-green-50"
                                : "border-red-300 bg-red-50"
                              : "border-gray-200"
                          }`}
                        >
                          <div className="flex justify-between items-center mb-2">
                            <Badge variant="outline">
                              {match.round_name || getRoundLabel(match.round_number)}
                            </Badge>
                            {getStatusBadge(match.status)}
                          </div>
                          
                          <div className="flex items-center justify-between">
                            <div className={`flex-1 ${isPlayer1 ? "font-bold" : ""}`}>
                              <p>{match.player1_name}</p>
                              <p className="text-xs text-muted-foreground">
                                {match.player1_club}
                              </p>
                            </div>
                            
                            <div className="px-4 text-center">
                              {match.status === "finished" ? (
                                <span className="text-xl font-bold">
                                  {match.sets_player1} - {match.sets_player2}
                                </span>
                              ) : (
                                <span className="text-muted-foreground">VS</span>
                              )}
                            </div>
                            
                            <div className={`flex-1 text-right ${!isPlayer1 ? "font-bold" : ""}`}>
                              <p>{match.player2_name}</p>
                              <p className="text-xs text-muted-foreground">
                                {match.player2_club}
                              </p>
                            </div>
                          </div>

                          {match.status === "finished" && (
                            <div className="mt-2 pt-2 border-t text-center">
                              <Badge variant={won ? "success" : "destructive"}>
                                {won ? "Victoire" : "Defaite"}
                              </Badge>
                            </div>
                          )}
                        </motion.div>
                      );
                    })}
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      )}
    </div>
  );
}
