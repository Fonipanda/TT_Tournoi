"use client";

import { useState, useEffect, useMemo } from "react";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import { Users, Loader2, Clock, Search, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";

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
  const [searchFilter, setSearchFilter] = useState("");
  const [sortCol, setSortCol] = useState<string>("");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  const toggleSort = (col: string) => {
    if (sortCol === col) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortCol(col);
      setSortDir("asc");
    }
  };

  const SortIcon = ({ col }: { col: string }) => {
    if (sortCol !== col) return <ArrowUpDown className="h-3 w-3 ml-1 opacity-40" />;
    return sortDir === "asc" ? <ArrowUp className="h-3 w-3 ml-1" /> : <ArrowDown className="h-3 w-3 ml-1" />;
  };

  const filterAndSort = (list: LiveMatch[]) => {
    let filtered = list;
    if (searchFilter.trim()) {
      const q = searchFilter.toLowerCase();
      filtered = list.filter(m =>
        m.player1.name.toLowerCase().includes(q) ||
        m.player2.name.toLowerCase().includes(q) ||
        m.player1.club.toLowerCase().includes(q) ||
        m.player2.club.toLowerCase().includes(q) ||
        m.bracket.name.toLowerCase().includes(q) ||
        (m.table?.number?.toString() || "").includes(q)
      );
    }
    if (sortCol) {
      filtered = [...filtered].sort((a, b) => {
        let va: any, vb: any;
        switch (sortCol) {
          case "table": va = a.table?.number || 999; vb = b.table?.number || 999; break;
          case "j1": va = a.player1.name; vb = b.player1.name; break;
          case "c1": va = a.player1.club; vb = b.player1.club; break;
          case "j2": va = a.player2.name; vb = b.player2.name; break;
          case "c2": va = a.player2.club; vb = b.player2.club; break;
          case "tableau": va = a.bracket.name; vb = b.bracket.name; break;
          case "r1": va = Number(a.player1.ranking) || 0; vb = Number(b.player1.ranking) || 0; break;
          case "r2": va = Number(a.player2.ranking) || 0; vb = Number(b.player2.ranking) || 0; break;
          default: return 0;
        }
        if (typeof va === "string") return sortDir === "asc" ? va.localeCompare(vb, 'fr') : vb.localeCompare(va, 'fr');
        return sortDir === "asc" ? va - vb : vb - va;
      });
    }
    return filtered;
  };

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
  const filteredInProgress = filterAndSort(inProgressMatches);
  const filteredWaiting = filterAndSort(waitingMatches);

  return (
    <div className="space-y-6">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
        <Input
          className="pl-9"
          placeholder="Rechercher un joueur, club, tableau..."
          value={searchFilter}
          onChange={(e) => setSearchFilter(e.target.value)}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Match en cours ({filteredInProgress.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {filteredInProgress.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">
              Aucun match en cours
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-3 px-2 cursor-pointer select-none" onClick={() => toggleSort("table")}>
                      <span className="flex items-center">Table<SortIcon col="table" /></span>
                    </th>
                    <th className="text-left py-3 px-2 cursor-pointer select-none" onClick={() => toggleSort("j1")}>
                      <span className="flex items-center">Joueur 1<SortIcon col="j1" /></span>
                    </th>
                    <th className="text-left py-3 px-2 cursor-pointer select-none" onClick={() => toggleSort("c1")}>
                      <span className="flex items-center">Club<SortIcon col="c1" /></span>
                    </th>
                    <th className="text-left py-3 px-2 cursor-pointer select-none" onClick={() => toggleSort("j2")}>
                      <span className="flex items-center">Joueur 2<SortIcon col="j2" /></span>
                    </th>
                    <th className="text-left py-3 px-2 cursor-pointer select-none" onClick={() => toggleSort("c2")}>
                      <span className="flex items-center">Club<SortIcon col="c2" /></span>
                    </th>
                    <th className="text-left py-3 px-2 cursor-pointer select-none" onClick={() => toggleSort("tableau")}>
                      <span className="flex items-center">Tableau<SortIcon col="tableau" /></span>
                    </th>
                    <th className="text-left py-3 px-2">Duree</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredInProgress.map((match, index) => (
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
            Match en Attente ({filteredWaiting.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {filteredWaiting.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">
              Aucun match en attente
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-3 px-2 cursor-pointer select-none" onClick={() => toggleSort("j1")}>
                      <span className="flex items-center">Joueur 1<SortIcon col="j1" /></span>
                    </th>
                    <th className="text-left py-3 px-2 cursor-pointer select-none" onClick={() => toggleSort("c1")}>
                      <span className="flex items-center">Club<SortIcon col="c1" /></span>
                    </th>
                    <th className="text-center py-3 px-2">VS</th>
                    <th className="text-left py-3 px-2 cursor-pointer select-none" onClick={() => toggleSort("j2")}>
                      <span className="flex items-center">Joueur 2<SortIcon col="j2" /></span>
                    </th>
                    <th className="text-left py-3 px-2 cursor-pointer select-none" onClick={() => toggleSort("c2")}>
                      <span className="flex items-center">Club<SortIcon col="c2" /></span>
                    </th>
                    <th className="text-left py-3 px-2 cursor-pointer select-none" onClick={() => toggleSort("tableau")}>
                      <span className="flex items-center">Tableau<SortIcon col="tableau" /></span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredWaiting.map((match, index) => (
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
