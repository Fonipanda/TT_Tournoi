"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { api } from "@/lib/api";
import { Users, Clock, Loader2 } from "lucide-react";

interface TableData {
  id: string;
  table_number: number;
  room: { id: string; name: string };
  status: string;
  player1: { id: string; name: string; club: string; ranking: string } | null;
  player2: { id: string; name: string; club: string; ranking: string } | null;
  match_start_time: string | null;
}

export default function LivePage() {
  const [tables, setTables] = useState<TableData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTables = async () => {
    try {
      const data = await api.live.tables();
      setTables(data);
      setError(null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTables();
    const interval = setInterval(fetchTables, 10000);
    return () => clearInterval(interval);
  }, []);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "free":
        return <Badge variant="success">Libre</Badge>;
      case "occupied":
        return <Badge variant="destructive">Occupee</Badge>;
      case "maintenance":
        return <Badge variant="warning">Maintenance</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const formatDuration = (startTime: string | null) => {
    if (!startTime) return null;
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

  const groupedTables = tables.reduce((acc, table) => {
    const roomName = table.room?.name || "Sans salle";
    if (!acc[roomName]) acc[roomName] = [];
    acc[roomName].push(table);
    return acc;
  }, {} as Record<string, TableData[]>);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Tables en temps reel
          </CardTitle>
        </CardHeader>
        <CardContent>
          {Object.keys(groupedTables).length === 0 ? (
            <p className="text-muted-foreground text-center py-8">
              Aucune table configuree. Configurez les salles et tables dans l'onglet Admin.
            </p>
          ) : (
            Object.entries(groupedTables).map(([roomName, roomTables]) => (
              <div key={roomName} className="mb-8 last:mb-0">
                <h3 className="text-lg font-semibold mb-4 text-gray-700">{roomName}</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {roomTables.map((table, index) => (
                    <motion.div
                      key={table.id}
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: index * 0.05 }}
                    >
                      <Card 
                        className={`transition-all ${
                          table.status === "occupied" 
                            ? "border-red-300 bg-red-50" 
                            : table.status === "free"
                            ? "border-green-300 bg-green-50"
                            : "border-yellow-300 bg-yellow-50"
                        }`}
                      >
                        <CardContent className="pt-4">
                          <div className="flex justify-between items-start mb-3">
                            <span className="text-xl font-bold">
                              Table {table.table_number}
                            </span>
                            {getStatusBadge(table.status)}
                          </div>
                          
                          {table.status === "occupied" && table.player1 && table.player2 && (
                            <div className="space-y-2 text-sm">
                              <div className="p-2 bg-white rounded border">
                                <p className="font-medium">{table.player1.name}</p>
                                <p className="text-muted-foreground text-xs">
                                  {table.player1.club} - {table.player1.ranking} pts
                                </p>
                              </div>
                              <div className="text-center text-xs text-muted-foreground">VS</div>
                              <div className="p-2 bg-white rounded border">
                                <p className="font-medium">{table.player2.name}</p>
                                <p className="text-muted-foreground text-xs">
                                  {table.player2.club} - {table.player2.ranking} pts
                                </p>
                              </div>
                              {table.match_start_time && (
                                <div className="flex items-center justify-center gap-1 text-xs text-muted-foreground mt-2">
                                  <Clock className="h-3 w-3" />
                                  {formatDuration(table.match_start_time)}
                                </div>
                              )}
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    </motion.div>
                  ))}
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
