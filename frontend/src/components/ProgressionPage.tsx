"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { api } from "@/lib/api";
import { 
  Trophy, Loader2, Users, GitBranch, 
  Medal, RefreshCcw
} from "lucide-react";

interface Bracket {
  id: string;
  name: string;
  category: string;
}

interface Match {
  id: string;
  player1_name: string;
  player2_name: string;
  bracket_name: string;
  bracket: string;
  status: string;
  round_number: number;
  sets_player1: number;
  sets_player2: number;
}

interface BracketMatch {
  id: string;
  round: number;
  position: number;
  player1: string | null;
  player2: string | null;
  winner: string | null;
  score1: number;
  score2: number;
  isLosers?: boolean;
}

export default function ProgressionPage() {
  const [loading, setLoading] = useState(true);
  const [brackets, setBrackets] = useState<Bracket[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [selectedBracket, setSelectedBracket] = useState<string>("all");
  
  const [eliminationType, setEliminationType] = useState<"single" | "double">("single");
  const [hasThirdPlace, setHasThirdPlace] = useState(true);
  const [roundLabels, setRoundLabels] = useState<string[]>([]);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const tournaments = await api.tournaments.list();
      if (tournaments.length > 0) {
        const bracketsData = await api.brackets.list(tournaments[0].id);
        setBrackets(bracketsData);
      }
      const matchesData = await api.matches.list({});
      setMatches(matchesData);
    } catch (error) {
      console.error("Erreur chargement donnees:", error);
    } finally {
      setLoading(false);
    }
  };

  const getRoundLabel = (round: number, totalRounds: number): string => {
    const labels: Record<number, string> = {
      1: "Pool",
      2: "1/64",
      3: "1/32",
      4: "1/16",
      5: "1/8",
      6: "1/4",
      7: "1/2",
      8: "Finale"
    };

    const diff = 8 - totalRounds;
    const adjustedRound = round + diff;
    
    if (adjustedRound === 8) return "Finale";
    if (adjustedRound === 7) return "1/2";
    if (adjustedRound === 6) return "1/4";
    if (adjustedRound === 5) return "1/8";
    if (adjustedRound === 4) return "1/16";
    if (adjustedRound === 3) return "1/32";
    if (adjustedRound === 2) return "1/64";
    return "Pool";
  };

  const filteredMatches = selectedBracket === "all" 
    ? matches 
    : matches.filter(m => m.bracket === selectedBracket);

  const groupByRound = (matchList: Match[]) => {
    return matchList.reduce((acc, match) => {
      const round = match.round_number || 1;
      if (!acc[round]) acc[round] = [];
      acc[round].push(match);
      return acc;
    }, {} as Record<number, Match[]>);
  };

  const maxRound = Math.max(...matches.map(m => m.round_number || 1), 1);

  if (loading) {
    return (
      <div className="flex justify-center items-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  const roundedMatches = groupByRound(filteredMatches);
  const rounds = Object.keys(roundedMatches).map(Number).sort((a, b) => a - b);

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Trophy className="h-6 w-6" />
            Progression du Tournoi
          </h2>
          <p className="text-muted-foreground">
            Visualisez l'arbre des matchs et la progression
          </p>
        </div>
        
        <div className="flex flex-wrap gap-4">
          <Select value={selectedBracket} onValueChange={setSelectedBracket}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Tous les tableaux" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous les tableaux</SelectItem>
              {brackets.map((b) => (
                <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          
          <Button variant="outline" onClick={fetchData}>
            <RefreshCcw className="h-4 w-4 mr-2" />
            Actualiser
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Arbre du tournoi</CardTitle>
          <CardDescription>
            {eliminationType === "single" ? "Elimination simple" : "Double elimination"} 
            {hasThirdPlace && " - Match pour la 3e place"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {filteredMatches.length === 0 ? (
            <div className="text-center py-12">
              <Trophy className="h-12 w-12 mx-auto text-gray-300 mb-4" />
              <p className="text-muted-foreground">
                Aucun match configure pour ce tableau
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                Les matchs apparaitront ici une fois crees dans l'onglet Admin
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto pb-4">
              <div className="flex gap-8 min-w-max">
                {rounds.map((round) => {
                  const roundMatches = roundedMatches[round] || [];
                  const label = getRoundLabel(round, maxRound);
                  
                  return (
                    <div key={round} className="flex flex-col min-w-[220px]">
                      <div className="text-center mb-4">
                        <Badge variant="secondary" className="text-sm font-semibold">
                          {label}
                        </Badge>
                      </div>
                      
                      <div className="space-y-4 flex-1 flex flex-col justify-around">
                        {roundMatches.map((match, idx) => {
                          const isCompleted = match.status === "completed";
                          const isInProgress = match.status === "in_progress";
                          const winner = isCompleted 
                            ? (match.sets_player1 > match.sets_player2 ? 1 : 2)
                            : null;
                          
                          return (
                            <motion.div
                              key={match.id}
                              initial={{ opacity: 0, x: -20 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={{ delay: idx * 0.1 }}
                              className={`border-2 rounded-lg overflow-hidden ${
                                isInProgress 
                                  ? "border-blue-500 shadow-md" 
                                  : isCompleted 
                                  ? "border-green-300" 
                                  : "border-gray-200"
                              }`}
                            >
                              <div className={`p-2 ${
                                isInProgress ? "bg-blue-50" : isCompleted ? "bg-green-50" : "bg-gray-50"
                              }`}>
                                <div className={`flex justify-between items-center p-2 rounded ${
                                  winner === 1 && isCompleted ? "bg-green-100 font-bold" : ""
                                }`}>
                                  <span className="text-sm truncate flex-1">
                                    {match.player1_name || "TBD"}
                                  </span>
                                  <span className={`text-sm font-bold ml-2 ${
                                    winner === 1 ? "text-green-600" : ""
                                  }`}>
                                    {isInProgress || isCompleted ? match.sets_player1 : "-"}
                                  </span>
                                </div>
                                
                                <div className="border-t border-gray-200 my-1"></div>
                                
                                <div className={`flex justify-between items-center p-2 rounded ${
                                  winner === 2 && isCompleted ? "bg-green-100 font-bold" : ""
                                }`}>
                                  <span className="text-sm truncate flex-1">
                                    {match.player2_name || "TBD"}
                                  </span>
                                  <span className={`text-sm font-bold ml-2 ${
                                    winner === 2 ? "text-green-600" : ""
                                  }`}>
                                    {isInProgress || isCompleted ? match.sets_player2 : "-"}
                                  </span>
                                </div>
                              </div>
                              
                              <div className={`px-2 py-1 text-xs text-center ${
                                isInProgress 
                                  ? "bg-blue-500 text-white" 
                                  : isCompleted 
                                  ? "bg-green-500 text-white" 
                                  : "bg-gray-200"
                              }`}>
                                {isInProgress ? "En cours" : isCompleted ? "Termine" : "A venir"}
                              </div>
                            </motion.div>
                          );
                        })}
                      </div>

                      {round === maxRound - 1 && hasThirdPlace && (
                        <div className="mt-8 pt-4 border-t-2 border-dashed">
                          <div className="text-center mb-2">
                            <Badge variant="outline" className="text-xs">
                              <Medal className="h-3 w-3 mr-1" />
                              Petite Finale
                            </Badge>
                          </div>
                          <div className="border-2 border-orange-300 rounded-lg overflow-hidden">
                            <div className="bg-orange-50 p-2">
                              <div className="flex justify-between items-center p-2">
                                <span className="text-sm">Perdant 1/2 A</span>
                                <span className="text-sm font-bold">-</span>
                              </div>
                              <div className="border-t border-gray-200 my-1"></div>
                              <div className="flex justify-between items-center p-2">
                                <span className="text-sm">Perdant 1/2 B</span>
                                <span className="text-sm font-bold">-</span>
                              </div>
                            </div>
                            <div className="bg-orange-200 px-2 py-1 text-xs text-center">
                              3e place
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {eliminationType === "double" && (
        <Card className="border-orange-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-orange-700">
              <GitBranch className="h-5 w-5 rotate-180" />
              Tableau des perdants (Losers Bracket)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground text-center py-8">
              Le tableau des perdants sera genere automatiquement lors de la creation des matchs
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
