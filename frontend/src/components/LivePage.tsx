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
  orientation: string;
  player1: { id: string; name: string; club: string; ranking: string } | null;
  player2: { id: string; name: string; club: string; ranking: string } | null;
  match_start_time: string | null;
}

interface Room {
  id: string;
  name: string;
  rows: number;
  tables_per_row: number;
}

export default function LivePage() {
  const [tables, setTables] = useState<TableData[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    try {
      const [tablesData, roomsData] = await Promise.all([
        api.live.tables(),
        api.rooms.list()
      ]);
      setTables(tablesData);
      setRooms(roomsData);
      setError(null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 10000);
    return () => clearInterval(interval);
  }, []);

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

  const formatShortName = (fullName: string) => {
    if (!fullName) return '?';
    const parts = fullName.trim().split(/\s+/);
    if (parts.length < 2) return fullName.toUpperCase();
    const lastName = parts[0].toUpperCase();
    const firstInitial = parts[parts.length - 1].charAt(0).toUpperCase();
    return `${lastName}.${firstInitial}`;
  };

  const PingPongTable = ({ table, index }: { table: TableData; index: number }) => {
    const isOccupied = table.status === "occupied";
    const isFree = table.status === "free";
    const isVertical = table.orientation === "vertical";
    
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: index * 0.05 }}
        className={`relative ${isVertical ? 'row-span-2' : ''}`}
      >
        <div 
          className={`relative rounded-lg border-4 ${
            isOccupied ? 'border-red-600 bg-red-700' : 'border-green-600 bg-green-700'
          } shadow-lg overflow-hidden ${isVertical ? 'aspect-[1/2]' : 'aspect-[2/1]'}`}
          style={{ minWidth: isVertical ? '100px' : '200px', minHeight: isVertical ? '200px' : '100px' }}
        >
          <div className="absolute inset-2 border-2 border-white/50 rounded">
            {isVertical ? (
              <>
                <div className="absolute left-1/2 top-0 bottom-0 w-0.5 bg-white/70 transform -translate-x-1/2"></div>
                <div className="absolute left-0 right-0 top-1/2 h-0.5 bg-white/70 transform -translate-y-1/2"></div>
              </>
            ) : (
              <>
                <div className="absolute top-1/2 left-0 right-0 h-0.5 bg-white/70 transform -translate-y-1/2"></div>
                <div className="absolute top-0 bottom-0 left-1/2 w-0.5 bg-white/70 transform -translate-x-1/2"></div>
              </>
            )}
          </div>
          
          <div className={`absolute ${isVertical ? 'left-1/2 top-1/2 transform -translate-x-1/2 -translate-y-1/2 h-full' : 'top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-full'}`}>
            <div className={`${isVertical ? 'w-4 h-full' : 'h-4 w-full'} bg-white/20 flex items-center justify-center`}>
              <div className={`${isVertical ? 'w-3 h-1' : 'h-3 w-1'} bg-white/60 mx-0.5`} />
              <div className={`${isVertical ? 'w-3 h-1' : 'h-3 w-1'} bg-white/60 mx-0.5`} />
              <div className={`${isVertical ? 'w-3 h-1' : 'h-3 w-1'} bg-white/60 mx-0.5`} />
            </div>
          </div>

          <div className="absolute top-1 left-1/2 transform -translate-x-1/2">
            <Badge 
              variant={isOccupied ? "destructive" : "success"} 
              className="text-xs font-bold"
            >
              Table {table.table_number}
            </Badge>
          </div>

          <div className="absolute bottom-1 left-1/2 transform -translate-x-1/2">
            <Badge variant="outline" className="bg-white/90 text-xs">
              {isOccupied ? "Occupee" : isFree ? "Libre" : "Maintenance"}
            </Badge>
          </div>
        </div>

        {isOccupied && table.player1 && table.player2 && (
          <div className="mt-2 p-2 bg-white rounded-lg border shadow-sm">
            <div className="flex items-center justify-between text-xs">
              <div className="flex-1 text-center min-w-0">
                <p className="font-semibold truncate" title={table.player1.name}>{formatShortName(table.player1.name)}</p>
                <p className="text-muted-foreground text-[10px]">
                  {table.player1.ranking} pts
                </p>
              </div>
              <div className="px-1 font-bold text-gray-400 shrink-0">VS</div>
              <div className="flex-1 text-center min-w-0">
                <p className="font-semibold truncate" title={table.player2.name}>{formatShortName(table.player2.name)}</p>
                <p className="text-muted-foreground text-[10px]">
                  {table.player2.ranking} pts
                </p>
              </div>
            </div>
            {table.match_start_time && (
              <div className="flex items-center justify-center gap-1 text-[10px] text-muted-foreground mt-1 pt-1 border-t">
                <Clock className="h-3 w-3" />
                {formatDuration(table.match_start_time)}
              </div>
            )}
          </div>
        )}
      </motion.div>
    );
  };

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
          <div className="flex gap-4 mb-4">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded bg-green-700 border-2 border-green-600"></div>
              <span className="text-sm">Libre</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded bg-red-700 border-2 border-red-600"></div>
              <span className="text-sm">Occupee</span>
            </div>
          </div>

          {Object.keys(groupedTables).length === 0 ? (
            <p className="text-muted-foreground text-center py-8">
              Aucune table configuree. Configurez les salles et tables dans l'onglet Admin.
            </p>
          ) : (
            Object.entries(groupedTables).map(([roomName, roomTables]) => {
              const room = rooms.find(r => r.name === roomName);
              const rows = room?.rows || Math.ceil(roomTables.length / 4);
              const tablesPerRow = room?.tables_per_row || Math.min(4, roomTables.length);
              
              return (
                <div key={roomName} className="mb-8 last:mb-0">
                  <h3 className="text-lg font-semibold mb-4 text-gray-700 flex items-center gap-2">
                    <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm">
                      {roomName}
                    </span>
                    <span className="text-sm font-normal text-muted-foreground">
                      ({roomTables.length} tables)
                    </span>
                  </h3>
                  <div 
                    className="grid gap-6 p-4 bg-gray-100 rounded-lg"
                    style={{ 
                      gridTemplateColumns: `repeat(${tablesPerRow}, minmax(200px, 1fr))` 
                    }}
                  >
                    {roomTables.map((table, index) => (
                      <PingPongTable key={table.id} table={table} index={index} />
                    ))}
                  </div>
                </div>
              );
            })
          )}
        </CardContent>
      </Card>
    </div>
  );
}
