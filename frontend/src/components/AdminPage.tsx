"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { api } from "@/lib/api";
import { 
  Settings, Lock, Trophy, Users, LayoutGrid, 
  Coffee, Plus, Trash2, Loader2, AlertCircle,
  CheckCircle, Play, LogOut, Pencil, QrCode, RotateCw, GitBranch, Medal, Printer
} from "lucide-react";

interface Tournament {
  id: string;
  name: string;
  description: string;
  is_active: boolean;
}

interface Bracket {
  id: string;
  tournament: string;
  name: string;
  category: string;
  min_points: number | null;
  max_points: number | null;
  max_players: number;
  entry_fee: number;
  day: string | null;
  checkin_end: string | null;
  start_time: string | null;
  registered_count?: number;
}

interface Room {
  id: string;
  name: string;
  description: string;
  rows: number;
  tables_per_row: number;
}

interface Table {
  id: string;
  table_number: number;
  room: string;
  room_name: string;
  status: string;
  position_row: number;
  position_col: number;
  orientation: string;
}

interface Match {
  id: string;
  player1: string;
  player2: string;
  player1_name: string;
  player2_name: string;
  winner: string | null;
  bracket_name: string;
  round_name: string;
  round_number: number;
  status: string;
  table_number: number | null;
  sets_player1: number;
  sets_player2: number;
}

interface MenuSection {
  id: string;
  name: string;
  order: number;
}

interface MenuItem {
  id: string;
  section: string;
  name: string;
  price: number;
  is_available: boolean;
}

export default function AdminPage() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [showLoginDialog, setShowLoginDialog] = useState(true);
  const [loginUsername, setLoginUsername] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginError, setLoginError] = useState<string | null>(null);
  const [loggingIn, setLoggingIn] = useState(false);

  const [adminTab, setAdminTab] = useState("tournaments");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const router = useRouter();

  const [eliminationType, setEliminationType] = useState<"single" | "double">("single");
  const [hasThirdPlace, setHasThirdPlace] = useState(true);

  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [brackets, setBrackets] = useState<Bracket[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [tables, setTables] = useState<Table[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [menuSections, setMenuSections] = useState<MenuSection[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [players, setPlayers] = useState<any[]>([]);

  const [newTournament, setNewTournament] = useState({ name: "", description: "" });
  const [newBracket, setNewBracket] = useState({ 
    tournament: "", name: "", category: "", 
    min_points: "", max_points: "", max_players: "16", entry_fee: "5",
    day: "", checkin_end: "", start_time: ""
  });
  const [newRoom, setNewRoom] = useState({ name: "", rows: "2", tables_per_row: "4" });
  const [newTable, setNewTable] = useState({ room: "" });
  const [newMatch, setNewMatch] = useState({ bracket: "", player1: "", player2: "" });
  const [registrations, setRegistrations] = useState<any[]>([]);
  const [newSection, setNewSection] = useState({ name: "" });
  const [newItem, setNewItem] = useState({ section: "", name: "", price: "" });

  const [selectedMatch, setSelectedMatch] = useState<Match | null>(null);
  const [selectedTable, setSelectedTable] = useState<string>("");
  const [finishScore, setFinishScore] = useState({ sets_player1: "", sets_player2: "" });

  const [editTournament, setEditTournament] = useState<Tournament | null>(null);
  const [editBracket, setEditBracket] = useState<Bracket | null>(null);
  const [editRoom, setEditRoom] = useState<Room | null>(null);
  const [editSection, setEditSection] = useState<MenuSection | null>(null);
  const [editItem, setEditItem] = useState<MenuItem | null>(null);
  const [editPlayer, setEditPlayer] = useState<any | null>(null);
  const [draggedTable, setDraggedTable] = useState<Table | null>(null);
  const [qrUrl, setQrUrl] = useState(typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000');
  const [qrText, setQrText] = useState("Tournoi Chelles Tennis de Table 2025");
  const [qrGenerated, setQrGenerated] = useState(true);

  const [treeBracketId, setTreeBracketId] = useState("");
  const [treePlayers, setTreePlayers] = useState<any[]>([]);
  const [treeSeeds, setTreeSeeds] = useState<any[]>([]);
  const [treeMatches, setTreeMatches] = useState<any[]>([]);
  const [treeGenerating, setTreeGenerating] = useState(false);
  const [treeGenerated, setTreeGenerated] = useState(false);
  const [draggedSeedIdx, setDraggedSeedIdx] = useState<number | null>(null);
  const [roundLabels, setRoundLabels] = useState<string[]>(["Pool", "1/64", "1/32", "1/16", "1/8", "1/4", "1/2", "Petite Finale", "Finale"]);
  const [editingLabels, setEditingLabels] = useState(false);
  const [tempLabels, setTempLabels] = useState<string[]>([]);
  const [poolSize, setPoolSize] = useState<number>(0);
  const [poolOptions, setPoolOptions] = useState<{size: number; pools: number; remainder: number}[]>([]);

  useEffect(() => {
    const token = localStorage.getItem("admin_token");
    if (token === "admin-token-local") {
      setIsAuthenticated(true);
      setShowLoginDialog(false);
    }
  }, []);

  useEffect(() => {
    if (isAuthenticated) {
      fetchAllData();
    }
  }, [isAuthenticated, adminTab]);

  const handleLogin = async () => {
    setLoggingIn(true);
    setLoginError(null);

    try {
      const result = await api.auth.adminLogin(loginUsername, loginPassword);
      if (result.success) {
        localStorage.setItem("admin_token", result.token);
        setIsAuthenticated(true);
        setShowLoginDialog(false);
      }
    } catch (err: any) {
      setLoginError(err.message || "Identifiants incorrects");
    } finally {
      setLoggingIn(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("admin_token");
    setIsAuthenticated(false);
    setShowLoginDialog(true);
    setLoginUsername("");
    setLoginPassword("");
    router.push("/");
  };

  const fetchAllData = async () => {
    setLoading(true);
    try {
      const [tournamentsData, roomsData, tablesData, playersData, sectionsData, registrationsData] = await Promise.all([
        api.tournaments.list(),
        api.rooms.list(),
        api.tables.list(),
        api.players.list(),
        api.menuSections.list(),
        api.registrations.list({}),
      ]);
      setTournaments(tournamentsData);
      setRooms(roomsData);
      setTables(tablesData);
      setPlayers(playersData);
      setMenuSections(sectionsData);
      setRegistrations(registrationsData);

      if (tournamentsData.length > 0) {
        const bracketsData = await api.brackets.list(tournamentsData[0].id);
        setBrackets(bracketsData);
      }

      const matchesData = await api.matches.list({});
      setMatches(matchesData);

      const itemsData = await api.menuItems.list();
      setMenuItems(itemsData);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const showSuccess = (msg: string) => {
    setSuccess(msg);
    setTimeout(() => setSuccess(null), 3000);
  };

  const sortedBrackets = [...brackets].sort((a, b) => a.name.localeCompare(b.name, 'fr'));

  const getPlayersForBracket = (bracketId: string) => {
    if (!bracketId) return players;
    const bracketPlayerIds = registrations
      .filter(r => r.bracket === bracketId)
      .map(r => r.player);
    return players.filter(p => bracketPlayerIds.includes(p.id));
  };

  const createTournament = async () => {
    try {
      await api.tournaments.create(newTournament);
      setNewTournament({ name: "", description: "" });
      fetchAllData();
      showSuccess("Tournoi cree");
    } catch (err: any) {
      setError(err.message);
    }
  };

  const createBracket = async () => {
    try {
      await api.brackets.create({
        tournament: newBracket.tournament,
        name: newBracket.name,
        category: newBracket.category,
        min_points: newBracket.min_points ? parseInt(newBracket.min_points) : null,
        max_points: newBracket.max_points ? parseInt(newBracket.max_points) : null,
        max_players: parseInt(newBracket.max_players),
        entry_fee: parseFloat(newBracket.entry_fee),
        day: newBracket.day || null,
        checkin_end: newBracket.checkin_end || null,
        start_time: newBracket.start_time || null,
      });
      setNewBracket({ tournament: "", name: "", category: "", min_points: "", max_points: "", max_players: "16", entry_fee: "5", day: "", checkin_end: "", start_time: "" });
      fetchAllData();
      showSuccess("Tableau cree");
    } catch (err: any) {
      setError(err.message);
    }
  };

  const createRoom = async () => {
    try {
      await api.rooms.create({
        name: newRoom.name,
        rows: parseInt(newRoom.rows),
        tables_per_row: parseInt(newRoom.tables_per_row),
      });
      setNewRoom({ name: "", rows: "2", tables_per_row: "4" });
      fetchAllData();
      showSuccess("Salle creee");
    } catch (err: any) {
      setError(err.message);
    }
  };

  const createTable = async () => {
    try {
      const maxTableNumber = tables.length > 0 
        ? Math.max(...tables.map(t => t.table_number)) 
        : 0;
      await api.tables.create({
        room: newTable.room,
        table_number: maxTableNumber + 1,
      });
      setNewTable({ room: "" });
      fetchAllData();
      showSuccess("Table creee");
    } catch (err: any) {
      setError(err.message);
    }
  };

  const updateTablePosition = async (tableId: string, data: { position_row?: number; position_col?: number; orientation?: string }) => {
    try {
      await api.tables.update(tableId, data);
      fetchAllData();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const toggleTableOrientation = async (table: Table) => {
    const newOrientation = table.orientation === 'horizontal' ? 'vertical' : 'horizontal';
    await updateTablePosition(table.id, { orientation: newOrientation });
  };

  const handleDragStart = (e: React.DragEvent, table: Table) => {
    setDraggedTable(table);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = async (e: React.DragEvent, targetRow: number, targetCol: number, roomId: string) => {
    e.preventDefault();
    if (!draggedTable || draggedTable.room !== roomId) return;
    
    await updateTablePosition(draggedTable.id, { 
      position_row: targetRow, 
      position_col: targetCol 
    });
    setDraggedTable(null);
  };

  const createMatch = async () => {
    if (newMatch.player1 === newMatch.player2) {
      setError("Impossible de creer un match avec le meme joueur des deux cotes");
      return;
    }
    try {
      await api.matches.create({
        bracket: newMatch.bracket,
        player1: newMatch.player1,
        player2: newMatch.player2,
      });
      setNewMatch({ bracket: "", player1: "", player2: "" });
      fetchAllData();
      showSuccess("Match cree");
    } catch (err: any) {
      setError(err.message);
    }
  };

  const refreshTreeMatches = async () => {
    if (treeBracketId) {
      try {
        const matchesData = await api.matches.list({ bracket_id: treeBracketId });
        setTreeMatches(matchesData);
      } catch {}
    }
  };

  const assignMatchToTable = async () => {
    if (!selectedMatch || !selectedTable) return;
    try {
      await api.matches.assignTable(selectedMatch.id, selectedTable);
      setSelectedMatch(null);
      setSelectedTable("");
      fetchAllData();
      await refreshTreeMatches();
      showSuccess("Match assigne a la table");
    } catch (err: any) {
      setError(err.message);
    }
  };

  const finishMatch = async (winnerId?: string) => {
    if (!selectedMatch) return;
    try {
      const payload: any = {};
      if (winnerId) {
        payload.winner_id = winnerId;
      } else {
        payload.sets_player1 = parseInt(finishScore.sets_player1);
        payload.sets_player2 = parseInt(finishScore.sets_player2);
      }
      await api.matches.finish(selectedMatch.id, payload);
      setSelectedMatch(null);
      setFinishScore({ sets_player1: "", sets_player2: "" });
      fetchAllData();
      await refreshTreeMatches();
      showSuccess("Match termine");
    } catch (err: any) {
      setError(err.message);
    }
  };

  const deleteTreeMatch = async (matchId: string) => {
    try {
      await api.matches.delete(matchId);
      await refreshTreeMatches();
      fetchAllData();
      showSuccess("Match supprime");
    } catch (err: any) {
      setError(err.message);
    }
  };

  const deleteEntireTree = async () => {
    if (!treeBracketId) return;
    try {
      for (const m of treeMatches) {
        await api.matches.delete(m.id);
      }
      setTreeMatches([]);
      setTreeGenerated(false);
      fetchAllData();
      showSuccess("Arbre supprime");
    } catch (err: any) {
      setError(err.message);
    }
  };

  const modifyTree = () => {
    setTreeGenerated(false);
  };

  const createMenuSection = async () => {
    try {
      await api.menuSections.create({ name: newSection.name, order: menuSections.length });
      setNewSection({ name: "" });
      fetchAllData();
      showSuccess("Section creee");
    } catch (err: any) {
      setError(err.message);
    }
  };

  const createMenuItem = async () => {
    try {
      await api.menuItems.create({
        section: newItem.section,
        name: newItem.name,
        price: parseFloat(newItem.price),
        is_available: true,
      });
      setNewItem({ section: "", name: "", price: "" });
      fetchAllData();
      showSuccess("Article cree");
    } catch (err: any) {
      setError(err.message);
    }
  };

  const deleteItem = async (type: string, id: string) => {
    try {
      switch (type) {
        case "tournament": await api.tournaments.delete(id); break;
        case "bracket": await api.brackets.delete(id); break;
        case "room": await api.rooms.delete(id); break;
        case "table": await api.tables.delete(id); break;
        case "match": await api.matches.delete(id); break;
        case "section": await api.menuSections.delete(id); break;
        case "item": await api.menuItems.delete(id); break;
        case "player": await api.players.delete(id); break;
      }
      fetchAllData();
      showSuccess("Element supprime");
    } catch (err: any) {
      setError(err.message);
    }
  };

  const updateTournament = async () => {
    if (!editTournament) return;
    try {
      await api.tournaments.update(editTournament.id, {
        name: editTournament.name,
        description: editTournament.description,
      });
      setEditTournament(null);
      fetchAllData();
      showSuccess("Tournoi modifie");
    } catch (err: any) {
      setError(err.message);
    }
  };

  const updateBracket = async () => {
    if (!editBracket) return;
    try {
      await api.brackets.update(editBracket.id, {
        tournament: editBracket.tournament,
        name: editBracket.name,
        category: editBracket.category,
        min_points: editBracket.min_points,
        max_points: editBracket.max_points,
        max_players: editBracket.max_players,
        entry_fee: editBracket.entry_fee,
        day: editBracket.day,
        checkin_end: editBracket.checkin_end,
        start_time: editBracket.start_time,
      });
      setEditBracket(null);
      fetchAllData();
      showSuccess("Tableau modifie");
    } catch (err: any) {
      setError(err.message);
    }
  };

  const updateRoom = async () => {
    if (!editRoom) return;
    try {
      await api.rooms.update(editRoom.id, {
        name: editRoom.name,
        rows: editRoom.rows,
        tables_per_row: editRoom.tables_per_row,
      });
      setEditRoom(null);
      fetchAllData();
      showSuccess("Salle modifiee");
    } catch (err: any) {
      setError(err.message);
    }
  };

  const updateSection = async () => {
    if (!editSection) return;
    try {
      await api.menuSections.update(editSection.id, {
        name: editSection.name,
        order: editSection.order,
      });
      setEditSection(null);
      fetchAllData();
      showSuccess("Section modifiee");
    } catch (err: any) {
      setError(err.message);
    }
  };

  const updateMenuItem = async () => {
    if (!editItem) return;
    try {
      await api.menuItems.update(editItem.id, {
        section: editItem.section,
        name: editItem.name,
        price: editItem.price,
        is_available: editItem.is_available,
      });
      setEditItem(null);
      fetchAllData();
      showSuccess("Article modifie");
    } catch (err: any) {
      setError(err.message);
    }
  };

  const updatePlayer = async () => {
    if (!editPlayer) return;
    try {
      await api.players.update(editPlayer.id, {
        first_name: editPlayer.first_name,
        last_name: editPlayer.last_name,
        email: editPlayer.email,
        phone: editPlayer.phone,
        club: editPlayer.club,
        ranking: editPlayer.ranking,
      });
      setEditPlayer(null);
      fetchAllData();
      showSuccess("Joueur modifie");
    } catch (err: any) {
      setError(err.message);
    }
  };

  const loadTreePlayers = async (bracketId: string) => {
    setTreeBracketId(bracketId);
    setTreeGenerated(false);
    setTreeMatches([]);
    setPoolSize(0);
    if (!bracketId) {
      setTreePlayers([]);
      setTreeSeeds([]);
      setPoolOptions([]);
      return;
    }
    try {
      const players = await api.brackets.registeredPlayers(bracketId);
      setTreePlayers(players);
      setTreeSeeds([...players]);
      const n = players.length;
      const opts: {size: number; pools: number; remainder: number}[] = [];
      for (const s of [2, 3, 4, 5]) {
        if (n >= s) {
          const pools = Math.floor(n / s);
          const remainder = n % s;
          opts.push({ size: s, pools, remainder });
        }
      }
      setPoolOptions(opts);
      if (opts.length > 0) {
        const pool3 = opts.find(o => o.size === 3);
        setPoolSize(pool3 ? 3 : (opts.find(o => o.remainder === 0) || opts[opts.length - 1]).size);
      }
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleSeedDragStart = (idx: number) => {
    setDraggedSeedIdx(idx);
  };

  const handleSeedDrop = (targetIdx: number) => {
    if (draggedSeedIdx === null || draggedSeedIdx === targetIdx) return;
    const newSeeds = [...treeSeeds];
    const [moved] = newSeeds.splice(draggedSeedIdx, 1);
    newSeeds.splice(targetIdx, 0, moved);
    setTreeSeeds(newSeeds);
    setDraggedSeedIdx(null);
  };

  const generateBracketTree = async () => {
    if (!treeBracketId || treeSeeds.length < 2) return;
    setTreeGenerating(true);
    try {
      const result = await api.brackets.generateMatches(treeBracketId, {
        elimination_type: eliminationType,
        has_third_place: hasThirdPlace,
        seeded_players: treeSeeds.map(p => p.id),
        pool_size: poolSize,
        qualifiers_per_pool: 2,
        round_labels: roundLabels,
      });
      if (result.success) {
        const matchesData = await api.matches.list({ bracket_id: treeBracketId });
        setTreeMatches(matchesData);
        setTreeGenerated(true);
        const msg = result.byes_count > 0
          ? `${result.matches_created} matchs generes pour ${result.total_players} joueurs (${result.byes_count} exempte(s))`
          : `${result.matches_created} matchs generes pour ${result.total_players} joueurs`;
        showSuccess(msg);
        fetchAllData();
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setTreeGenerating(false);
    }
  };

  const loadExistingTreeMatches = async (bracketId: string) => {
    try {
      const matchesData = await api.matches.list({ bracket_id: bracketId });
      if (matchesData.length > 0) {
        setTreeMatches(matchesData);
        setTreeGenerated(true);
      }
    } catch {}
  };

  const printQrCode = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    printWindow.document.write(`<!DOCTYPE html><html><head><title>QR Code</title><style>body{display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:100vh;font-family:Arial,sans-serif;margin:0;padding:20px}img{margin:20px 0}h1{font-size:28px;text-align:center;margin-bottom:10px}p{font-size:14px;color:#666;margin-top:10px}</style></head><body><h1>${qrText}</h1><img src="https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=${encodeURIComponent(qrUrl)}" width="400" height="400" /><p>${qrUrl}</p><script>window.onload=function(){window.print()}</script></body></html>`);
    printWindow.document.close();
  };

  if (!isAuthenticated) {
    return (
      <Dialog open={showLoginDialog} onOpenChange={(open) => { if (!open) { setShowLoginDialog(false); router.push("/"); } }}>
        <DialogContent className="sm:max-w-md" onPointerDownOutside={(e) => e.preventDefault()}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Lock className="h-5 w-5" />
              Connexion Admin
            </DialogTitle>
            <DialogDescription>
              Entrez vos identifiants administrateur
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="username">Nom d'utilisateur</Label>
              <Input
                id="username"
                value={loginUsername}
                onChange={(e) => setLoginUsername(e.target.value)}
                placeholder="admin"
                onKeyDown={(e) => e.key === "Enter" && handleLogin()}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Mot de passe</Label>
              <Input
                id="password"
                type="password"
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
                placeholder="********"
                onKeyDown={(e) => e.key === "Enter" && handleLogin()}
              />
            </div>
            {loginError && (
              <p className="text-sm text-red-600 flex items-center gap-1">
                <AlertCircle className="h-4 w-4" />
                {loginError}
              </p>
            )}
          </div>
          <DialogFooter>
            <Button onClick={handleLogin} disabled={loggingIn} className="w-full">
              {loggingIn ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Lock className="h-4 w-4 mr-2" />
              )}
              Se connecter
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold flex items-center gap-2">
          <Settings className="h-6 w-6" />
          Administration
        </h2>
        <Button variant="outline" onClick={handleLogout}>
          <LogOut className="h-4 w-4 mr-2" />
          Deconnexion
        </Button>
      </div>

      {error && (
        <Card className="bg-red-50 border-red-200">
          <CardContent className="pt-4">
            <p className="text-red-600 flex items-center gap-1">
              <AlertCircle className="h-4 w-4" />
              {error}
            </p>
          </CardContent>
        </Card>
      )}

      {success && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <Card className="bg-green-50 border-green-200">
            <CardContent className="pt-4">
              <p className="text-green-600 flex items-center gap-1">
                <CheckCircle className="h-4 w-4" />
                {success}
              </p>
            </CardContent>
          </Card>
        </motion.div>
      )}

      <Tabs value={adminTab} onValueChange={setAdminTab}>
        <TabsList className="grid w-full grid-cols-6">
          <TabsTrigger value="tournaments" className="flex items-center gap-1">
            <Trophy className="h-4 w-4" />
            <span className="hidden md:inline">Tournois</span>
          </TabsTrigger>
          <TabsTrigger value="rooms" className="flex items-center gap-1">
            <LayoutGrid className="h-4 w-4" />
            <span className="hidden md:inline">Salles</span>
          </TabsTrigger>
          <TabsTrigger value="bracket-tree" className="flex items-center gap-1">
            <GitBranch className="h-4 w-4" />
            <span className="hidden md:inline">Arbre Tournoi</span>
          </TabsTrigger>
          <TabsTrigger value="players" className="flex items-center gap-1">
            <Users className="h-4 w-4" />
            <span className="hidden md:inline">Joueurs</span>
          </TabsTrigger>
          <TabsTrigger value="menu" className="flex items-center gap-1">
            <Coffee className="h-4 w-4" />
            <span className="hidden md:inline">Menu</span>
          </TabsTrigger>
          <TabsTrigger value="qrcode" className="flex items-center gap-1">
            <QrCode className="h-4 w-4" />
            <span className="hidden md:inline">QRCode</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="tournaments" className="mt-6 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Creer un tournoi</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label>Nom du tournoi</Label>
                  <Input
                    value={newTournament.name}
                    onChange={(e) => setNewTournament({ ...newTournament, name: e.target.value })}
                    placeholder="Tournoi National 2026"
                  />
                </div>
                <div>
                  <Label>Description</Label>
                  <Input
                    value={newTournament.description}
                    onChange={(e) => setNewTournament({ ...newTournament, description: e.target.value })}
                    placeholder="Description"
                  />
                </div>
              </div>
              <Button onClick={createTournament} disabled={!newTournament.name}>
                <Plus className="h-4 w-4 mr-2" />
                Creer le tournoi
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Tournois existants</CardTitle>
            </CardHeader>
            <CardContent>
              {tournaments.length === 0 ? (
                <p className="text-muted-foreground">Aucun tournoi</p>
              ) : (
                <div className="space-y-2">
                  {tournaments.map((t) => (
                    <div key={t.id} className="flex justify-between items-center p-3 border rounded">
                      <div>
                        <p className="font-medium">{t.name}</p>
                        <p className="text-sm text-muted-foreground">{t.description}</p>
                      </div>
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" onClick={() => setEditTournament(t)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="destructive" size="sm" onClick={() => deleteItem("tournament", t.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Creer un tableau</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <Label>Tournoi</Label>
                  <Select value={newBracket.tournament} onValueChange={(v) => setNewBracket({ ...newBracket, tournament: v })}>
                    <SelectTrigger><SelectValue placeholder="Selectionnez" /></SelectTrigger>
                    <SelectContent>
                      {tournaments.map((t) => (
                        <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Nom</Label>
                  <Input
                    value={newBracket.name}
                    onChange={(e) => setNewBracket({ ...newBracket, name: e.target.value })}
                    placeholder="Tableau A"
                  />
                </div>
                <div>
                  <Label>Categorie</Label>
                  <Input
                    value={newBracket.category}
                    onChange={(e) => setNewBracket({ ...newBracket, category: e.target.value })}
                    placeholder="Nc a 799 pts"
                  />
                </div>
                <div>
                  <Label>Points min</Label>
                  <Input
                    type="number"
                    value={newBracket.min_points}
                    onChange={(e) => setNewBracket({ ...newBracket, min_points: e.target.value })}
                    placeholder="0"
                  />
                </div>
                <div>
                  <Label>Points max</Label>
                  <Input
                    type="number"
                    value={newBracket.max_points}
                    onChange={(e) => setNewBracket({ ...newBracket, max_points: e.target.value })}
                    placeholder="799"
                  />
                </div>
                <div>
                  <Label>Max joueurs</Label>
                  <Input
                    type="number"
                    value={newBracket.max_players}
                    onChange={(e) => setNewBracket({ ...newBracket, max_players: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Montant €</Label>
                  <Input
                    type="number"
                    value={newBracket.entry_fee}
                    onChange={(e) => setNewBracket({ ...newBracket, entry_fee: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Jour</Label>
                  <Input
                    value={newBracket.day}
                    onChange={(e) => setNewBracket({ ...newBracket, day: e.target.value })}
                    placeholder="Samedi 21/02"
                  />
                </div>
                <div>
                  <Label>Fin de pointage</Label>
                  <Input
                    value={newBracket.checkin_end}
                    onChange={(e) => setNewBracket({ ...newBracket, checkin_end: e.target.value })}
                    placeholder="8h30"
                  />
                </div>
                <div>
                  <Label>Debut du tableau</Label>
                  <Input
                    value={newBracket.start_time}
                    onChange={(e) => setNewBracket({ ...newBracket, start_time: e.target.value })}
                    placeholder="9h00"
                  />
                </div>
              </div>
              <Button onClick={createBracket} disabled={!newBracket.tournament || !newBracket.name}>
                <Plus className="h-4 w-4 mr-2" />
                Creer le tableau
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Tableaux existants</CardTitle>
            </CardHeader>
            <CardContent>
              {brackets.length === 0 ? (
                <p className="text-muted-foreground">Aucun tableau</p>
              ) : (
                <div className="space-y-2">
                  {sortedBrackets.map((b) => {
                    const remaining = b.max_players - (b.registered_count || 0);
                    return (
                      <div key={b.id} className="flex justify-between items-center p-3 border rounded">
                        <div>
                          <p className="font-medium">{b.name}</p>
                          <p className="text-sm text-muted-foreground">
                            {b.category} - {Number(b.entry_fee).toFixed(2)} €
                            {b.day && ` - ${b.day}`}
                            {b.checkin_end && ` | Pointage: ${b.checkin_end}`}
                            {b.start_time && ` | Debut: ${b.start_time}`}
                          </p>
                          <p className={`text-xs mt-1 ${remaining <= 0 ? 'text-red-600 font-medium' : remaining <= 3 ? 'text-orange-600' : 'text-green-600'}`}>
                            {remaining <= 0 ? "Il ne reste plus de places disponibles" : `${remaining} place${remaining > 1 ? 's' : ''} restante${remaining > 1 ? 's' : ''}`}
                          </p>
                        </div>
                        <div className="flex gap-2">
                          <Button variant="outline" size="sm" onClick={() => setEditBracket(b)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button variant="destructive" size="sm" onClick={() => deleteItem("bracket", b.id)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="rooms" className="mt-6 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Creer une salle</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <Label>Nom</Label>
                  <Input
                    value={newRoom.name}
                    onChange={(e) => setNewRoom({ ...newRoom, name: e.target.value })}
                    placeholder="Salle principale"
                  />
                </div>
                <div>
                  <Label>Nombre de rangees</Label>
                  <Input
                    type="number"
                    min="1"
                    value={newRoom.rows}
                    onChange={(e) => setNewRoom({ ...newRoom, rows: e.target.value })}
                    placeholder="2"
                  />
                </div>
                <div>
                  <Label>Tables par rangee</Label>
                  <Input
                    type="number"
                    min="1"
                    value={newRoom.tables_per_row}
                    onChange={(e) => setNewRoom({ ...newRoom, tables_per_row: e.target.value })}
                    placeholder="4"
                  />
                </div>
              </div>
              <Button onClick={createRoom} disabled={!newRoom.name}>
                <Plus className="h-4 w-4 mr-2" />
                Creer la salle
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Ajouter une table</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-4 items-end">
                <div className="flex-1">
                  <Label>Salle</Label>
                  <Select value={newTable.room} onValueChange={(v) => setNewTable({ room: v })}>
                    <SelectTrigger><SelectValue placeholder="Selectionnez une salle" /></SelectTrigger>
                    <SelectContent>
                      {rooms.map((r) => (
                        <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button onClick={createTable} disabled={!newTable.room}>
                  <Plus className="h-4 w-4 mr-2" />
                  Ajouter (Table #{tables.length > 0 ? Math.max(...tables.map(t => t.table_number)) + 1 : 1})
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Salles et Tables</CardTitle>
            </CardHeader>
            <CardContent>
              {rooms.length === 0 ? (
                <p className="text-muted-foreground">Aucune salle</p>
              ) : (
                <div className="space-y-6">
                  {rooms.map((room) => {
                    const roomTables = tables.filter(t => t.room === room.id);
                    const gridRows = room.rows || 2;
                    const gridCols = room.tables_per_row || 4;
                    
                    return (
                      <div key={room.id} className="border rounded-lg p-4">
                        <div className="flex justify-between items-center mb-4">
                          <div>
                            <h4 className="font-medium text-lg">{room.name}</h4>
                            <p className="text-sm text-muted-foreground">
                              Grille: {gridRows} rangees x {gridCols} tables/rangee
                            </p>
                          </div>
                          <div className="flex gap-2">
                            <Button variant="outline" size="sm" onClick={() => setEditRoom(room)}>
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button variant="destructive" size="sm" onClick={() => deleteItem("room", room.id)}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                        
                        <div 
                          className="grid gap-3 p-4 bg-gray-50 rounded-lg"
                          style={{ 
                            gridTemplateColumns: `repeat(${gridCols}, minmax(80px, 1fr))`,
                            gridTemplateRows: `repeat(${gridRows}, 60px)`
                          }}
                        >
                          {Array.from({ length: gridRows * gridCols }).map((_, idx) => {
                            const row = Math.floor(idx / gridCols);
                            const col = idx % gridCols;
                            const tableAtPosition = roomTables.find(
                              t => t.position_row === row && t.position_col === col
                            ) || roomTables[idx];
                            
                            return (
                              <div
                                key={`${room.id}-${row}-${col}`}
                                className={`relative flex items-center justify-center rounded border-2 transition-colors
                                  ${tableAtPosition
                                    ? tableAtPosition.status === "free"
                                      ? "bg-green-100 border-green-500 cursor-move"
                                      : "bg-red-100 border-red-500 cursor-move"
                                    : "bg-gray-200 border-dashed border-gray-300"
                                  } ${draggedTable && !tableAtPosition ? "hover:bg-blue-100 hover:border-blue-400" : ""}`}
                                draggable={!!tableAtPosition}
                                onDragStart={(e) => tableAtPosition && handleDragStart(e, tableAtPosition)}
                                onDragOver={handleDragOver}
                                onDrop={(e) => handleDrop(e, row, col, room.id)}
                              >
                                {tableAtPosition ? (
                                  <>
                                    <span className={`text-sm font-bold ${tableAtPosition.orientation === 'vertical' ? 'writing-mode-vertical' : ''}`}>
                                      T{tableAtPosition.table_number}
                                    </span>
                                    <div className="absolute -top-2 -right-2 flex gap-1">
                                      <Button 
                                        variant="outline" 
                                        size="icon" 
                                        className="h-5 w-5 bg-white"
                                        onClick={(e) => { e.stopPropagation(); toggleTableOrientation(tableAtPosition); }}
                                      >
                                        <RotateCw className="h-3 w-3" />
                                      </Button>
                                      <Button 
                                        variant="destructive" 
                                        size="icon" 
                                        className="h-5 w-5"
                                        onClick={(e) => { e.stopPropagation(); deleteItem("table", tableAtPosition.id); }}
                                      >
                                        <Trash2 className="h-3 w-3" />
                                      </Button>
                                    </div>
                                  </>
                                ) : (
                                  <span className="text-xs text-gray-400">Vide</span>
                                )}
                              </div>
                            );
                          })}
                        </div>
                        
                        <p className="text-xs text-muted-foreground mt-2">
                          {roomTables.length} table(s) dans cette salle - Glissez-deposez pour reorganiser, cliquez sur rotation pour changer l'orientation
                        </p>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="menu" className="mt-6 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Creer une section</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-4">
                <Input
                  value={newSection.name}
                  onChange={(e) => setNewSection({ name: e.target.value })}
                  placeholder="Boissons, Sandwichs..."
                  className="flex-1"
                />
                <Button onClick={createMenuSection} disabled={!newSection.name}>
                  <Plus className="h-4 w-4 mr-2" />
                  Creer
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Ajouter un article</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <Label>Section</Label>
                  <Select value={newItem.section} onValueChange={(v) => setNewItem({ ...newItem, section: v })}>
                    <SelectTrigger><SelectValue placeholder="Selectionnez" /></SelectTrigger>
                    <SelectContent>
                      {menuSections.map((s) => (
                        <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Nom</Label>
                  <Input
                    value={newItem.name}
                    onChange={(e) => setNewItem({ ...newItem, name: e.target.value })}
                    placeholder="Coca-Cola"
                  />
                </div>
                <div>
                  <Label>Prix €</Label>
                  <Input
                    type="number"
                    step="0.5"
                    value={newItem.price}
                    onChange={(e) => setNewItem({ ...newItem, price: e.target.value })}
                    placeholder="2.50"
                  />
                </div>
              </div>
              <Button onClick={createMenuItem} disabled={!newItem.section || !newItem.name || !newItem.price}>
                <Plus className="h-4 w-4 mr-2" />
                Ajouter
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Menu actuel</CardTitle>
            </CardHeader>
            <CardContent>
              {menuSections.length === 0 ? (
                <p className="text-muted-foreground">Aucune section</p>
              ) : (
                <div className="space-y-4">
                  {menuSections.map((section) => (
                    <div key={section.id} className="border rounded p-4">
                      <div className="flex justify-between items-center mb-3">
                        <h4 className="font-medium">{section.name}</h4>
                        <div className="flex gap-2">
                          <Button variant="outline" size="sm" onClick={() => setEditSection(section)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button variant="destructive" size="sm" onClick={() => deleteItem("section", section.id)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                      <div className="space-y-2">
                        {menuItems.filter(i => i.section === section.id).map((item) => (
                          <div key={item.id} className="flex justify-between items-center p-2 bg-gray-50 rounded">
                            <span>{item.name}</span>
                            <div className="flex items-center gap-2">
                              <Badge>{Number(item.price).toFixed(2)} €</Badge>
                              <Button variant="outline" size="sm" onClick={() => setEditItem(item)}>
                                <Pencil className="h-3 w-3" />
                              </Button>
                              <Button variant="ghost" size="sm" onClick={() => deleteItem("item", item.id)}>
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="players" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Liste des joueurs inscrits</CardTitle>
            </CardHeader>
            <CardContent>
              {players.length === 0 ? (
                <p className="text-muted-foreground">Aucun joueur inscrit</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-2">Nom</th>
                        <th className="text-left py-2">Licence</th>
                        <th className="text-left py-2">Club</th>
                        <th className="text-left py-2">Points</th>
                        <th className="text-left py-2">Tableau(x)</th>
                        <th className="text-left py-2">Email</th>
                        <th className="text-left py-2">Tel</th>
                        <th className="text-right py-2">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {players.map((player) => {
                        const playerBrackets = registrations
                          .filter(r => r.player === player.id)
                          .map(r => {
                            const bracket = brackets.find(b => b.id === r.bracket);
                            return bracket?.name || "";
                          })
                          .filter(Boolean)
                          .join(", ");
                        return (
                          <tr key={player.id} className="border-b hover:bg-gray-50">
                            <td className="py-2">{player.last_name} {player.first_name}</td>
                            <td className="py-2">{player.license_number}</td>
                            <td className="py-2">{player.club}</td>
                            <td className="py-2">{player.ranking || player.points}</td>
                            <td className="py-2">{playerBrackets || "-"}</td>
                            <td className="py-2">{player.email}</td>
                            <td className="py-2">{player.phone || "-"}</td>
                            <td className="py-2 text-right">
                              <div className="flex justify-end gap-1">
                                <Button variant="outline" size="sm" onClick={() => setEditPlayer({...player})}>
                                  <Pencil className="h-3 w-3" />
                                </Button>
                                <Button variant="destructive" size="sm" onClick={() => deleteItem("player", player.id)}>
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="qrcode" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <QrCode className="h-5 w-5" />
                Generateur de QR Code
              </CardTitle>
              <CardDescription>
                Generez un QR Code personnalise pour l'acces mobile au tournoi
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div>
                    <Label>URL / Texte a encoder</Label>
                    <Input
                      value={qrUrl}
                      onChange={(e) => { setQrUrl(e.target.value); setQrGenerated(true); }}
                      placeholder="https://..."
                    />
                  </div>
                  <div>
                    <Label>Texte d'accompagnement (pour l'impression)</Label>
                    <Input
                      value={qrText}
                      onChange={(e) => setQrText(e.target.value)}
                      placeholder="Tournoi Chelles TT 2025"
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button onClick={() => setQrGenerated(true)} disabled={!qrUrl}>
                      <QrCode className="h-4 w-4 mr-2" />
                      Generer
                    </Button>
                    <Button variant="outline" onClick={() => {
                      const lanUrl = `http://${window.location.hostname}:3000`;
                      setQrUrl(lanUrl);
                      setQrGenerated(true);
                    }}>
                      Detecter IP LAN
                    </Button>
                    <Button variant="outline" onClick={printQrCode} disabled={!qrGenerated || !qrUrl}>
                      <Printer className="h-4 w-4 mr-2" />
                      Imprimer
                    </Button>
                  </div>
                  <div className="bg-blue-50 p-3 rounded-lg text-sm">
                    <p className="font-medium text-blue-800 mb-1">Astuce :</p>
                    <p className="text-blue-700">Le bouton Imprimer ouvre une page avec le texte + le QR Code, prete a etre imprimee ou enregistree en PDF.</p>
                  </div>
                </div>
                <div className="flex flex-col items-center gap-4">
                  {qrGenerated && qrUrl && (
                    <>
                      <div className="bg-white p-6 rounded-lg border-2 border-gray-200 shadow-lg">
                        <img 
                          src={`https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(qrUrl)}`}
                          alt="QR Code"
                          className="w-[300px] h-[300px]"
                        />
                      </div>
                      <p className="text-sm text-muted-foreground text-center font-medium">{qrText}</p>
                      <code className="px-3 py-1 bg-gray-100 rounded text-xs break-all max-w-sm text-center">
                        {qrUrl}
                      </code>
                    </>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="bracket-tree" className="mt-6 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <GitBranch className="h-5 w-5" />
                Generateur d'arbre de tournoi
              </CardTitle>
              <CardDescription>
                Selectionnez un tableau, configurez les poules, ordonnez les tetes de serie, puis generez l'arbre
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <Label className="font-medium mb-2 block">Tableau</Label>
                  <Select value={treeBracketId} onValueChange={(v) => { loadTreePlayers(v); loadExistingTreeMatches(v); }}>
                    <SelectTrigger><SelectValue placeholder="Selectionnez un tableau" /></SelectTrigger>
                    <SelectContent>
                      {sortedBrackets.map((b) => (
                        <SelectItem key={b.id} value={b.id}>{b.name} ({b.category})</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex flex-col gap-3">
                  <div className="flex items-center gap-4">
                    <Label className="font-medium">Elimination:</Label>
                    <div className="flex gap-2">
                      <Button variant={eliminationType === "single" ? "default" : "outline"} size="sm" onClick={() => setEliminationType("single")}>
                        Simple (OK)
                      </Button>
                      <Button variant={eliminationType === "double" ? "default" : "outline"} size="sm" onClick={() => setEliminationType("double")}>
                        Double (KO)
                      </Button>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <Label className="font-medium">3e place:</Label>
                    <Button variant={hasThirdPlace ? "default" : "outline"} size="sm" onClick={() => setHasThirdPlace(!hasThirdPlace)}>
                      <Medal className="h-4 w-4 mr-1" />
                      {hasThirdPlace ? "Active" : "Desactive"}
                    </Button>
                  </div>
                </div>
              </div>

              <div className="p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-medium">Etiquettes de tours:</p>
                  {!editingLabels ? (
                    <Button variant="outline" size="sm" onClick={() => { setTempLabels([...roundLabels]); setEditingLabels(true); }}>
                      <Pencil className="h-3 w-3 mr-1" />
                      Modifier
                    </Button>
                  ) : (
                    <div className="flex gap-2">
                      <Button size="sm" onClick={() => { setRoundLabels([...tempLabels]); setEditingLabels(false); }}>
                        <CheckCircle className="h-3 w-3 mr-1" />
                        Valider
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => setEditingLabels(false)}>
                        Annuler
                      </Button>
                    </div>
                  )}
                </div>
                {!editingLabels ? (
                  <div className="flex flex-wrap gap-2">
                    {roundLabels.map((label, index) => (
                      <Badge key={index} variant="outline">{label}</Badge>
                    ))}
                  </div>
                ) : (
                  <div className="space-y-2">
                    {tempLabels.map((label, index) => (
                      <div key={index} className="flex items-center gap-2">
                        <span className="text-xs text-gray-500 w-6">{index + 1}.</span>
                        <Input
                          value={label}
                          onChange={(e) => { const nl = [...tempLabels]; nl[index] = e.target.value; setTempLabels(nl); }}
                          className="h-8 text-sm"
                        />
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => { const nl = [...tempLabels]; nl.splice(index, 1); setTempLabels(nl); }}>
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    ))}
                    <Button variant="outline" size="sm" onClick={() => setTempLabels([...tempLabels, `Tour ${tempLabels.length + 1}`])}>
                      <Plus className="h-3 w-3 mr-1" />
                      Ajouter
                    </Button>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {treeBracketId && treeSeeds.length > 0 && !treeGenerated && (
            <>
              <Card>
                <CardHeader>
                  <CardTitle>Configuration des poules</CardTitle>
                  <CardDescription>
                    {treeSeeds.length} joueurs inscrits - Choisissez le nombre de joueurs par poule
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {poolOptions.map((opt) => {
                      const isSelected = poolSize === opt.size;
                      return (
                        <button
                          key={opt.size}
                          onClick={() => setPoolSize(opt.size)}
                          className={`p-4 rounded-lg border-2 text-left transition-all ${
                            isSelected ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-400'
                          }`}
                        >
                          <p className="text-lg font-bold">{opt.size} joueurs / poule</p>
                          <p className="text-sm text-muted-foreground">
                            {opt.pools} poule{opt.pools > 1 ? 's' : ''}
                            {opt.remainder > 0 && ` + ${opt.remainder} exempte(s)`}
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">
                            {opt.size === 2 ? `${opt.pools} matchs de pool` :
                             opt.size === 3 ? `${opt.pools * 3} matchs de pool` :
                             opt.size === 4 ? `${opt.pools * 6} matchs de pool` :
                             `${opt.pools * 10} matchs de pool`}
                          </p>
                          {opt.remainder === 0 && (
                            <Badge className="mt-2 bg-green-100 text-green-800 text-xs">Repartition parfaite</Badge>
                          )}
                        </button>
                      );
                    })}
                  </div>
                  {poolSize > 0 && (
                    <div className="mt-4 p-3 bg-blue-50 rounded-lg text-sm">
                      <p className="font-medium text-blue-800">Deroulement prevu :</p>
                      <ol className="mt-1 list-decimal list-inside text-blue-700 space-y-1">
                        <li>Phase de poules : {poolSize} joueurs par poule, chacun joue contre tous les autres</li>
                        <li>Les 2 premiers de chaque poule sont qualifies, le 3eme est elimine</li>
                        {treeSeeds.length % poolSize > 0 && (
                          <li className="text-orange-700 font-medium">
                            {treeSeeds.length % poolSize} joueur(s) avec le plus de points sont exempte(s) de poule (bye)
                          </li>
                        )}
                        <li>L'arbre d'elimination se constitue automatiquement selon les resultats saisis dans l'arbre ci-dessous</li>
                      </ol>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Tetes de serie ({treeSeeds.length} joueurs)</CardTitle>
                  <CardDescription>
                    Glissez-deposez pour reordonner les joueurs. Le joueur #1 est la tete de serie n°1.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-1 max-h-96 overflow-y-auto">
                    {treeSeeds.map((player, idx) => (
                      <div
                        key={player.id}
                        draggable
                        onDragStart={() => handleSeedDragStart(idx)}
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={() => handleSeedDrop(idx)}
                        className={`flex items-center gap-3 p-2 rounded border cursor-move transition-all hover:bg-blue-50 ${
                          draggedSeedIdx === idx ? 'opacity-50 border-blue-400 bg-blue-100' : 'border-gray-200'
                        }`}
                      >
                        <span className="w-8 h-8 flex items-center justify-center bg-gray-100 rounded-full text-sm font-bold text-gray-600">
                          {idx + 1}
                        </span>
                        <div className="flex-1">
                          <span className="font-medium">{player.name}</span>
                          <span className="text-sm text-muted-foreground ml-2">({player.club})</span>
                        </div>
                        <Badge variant="outline">{player.points} pts</Badge>
                        {poolSize > 0 && (
                          <Badge variant="secondary" className="text-xs">
                            P{Math.floor(idx / poolSize) + 1}
                          </Badge>
                        )}
                      </div>
                    ))}
                  </div>
                  <div className="mt-4 flex flex-wrap gap-3">
                    <Button
                      onClick={generateBracketTree}
                      disabled={treeGenerating || treeSeeds.length < 2}
                      className="bg-green-600 hover:bg-green-700"
                    >
                      {treeGenerating ? (
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      ) : (
                        <GitBranch className="h-4 w-4 mr-2" />
                      )}
                      Generer {poolSize > 0 ? `les poules de ${poolSize}` : `l'arbre`} ({treeSeeds.length} joueurs)
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => {
                        const sorted = [...treePlayers].sort((a, b) => b.points - a.points);
                        setTreeSeeds(sorted);
                      }}
                    >
                      Trier par points
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => {
                        const shuffled = [...treeSeeds];
                        for (let i = shuffled.length - 1; i > 0; i--) {
                          const j = Math.floor(Math.random() * (i + 1));
                          [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
                        }
                        setTreeSeeds(shuffled);
                      }}
                    >
                      Tirage aleatoire
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </>
          )}

          {treeBracketId && treeSeeds.length === 0 && (
            <Card>
              <CardContent className="py-8 text-center">
                <p className="text-muted-foreground">Aucun joueur inscrit dans ce tableau. Inscrivez des joueurs d'abord.</p>
              </CardContent>
            </Card>
          )}

          {treeGenerated && treeMatches.length > 0 && (
            <>
            <Card>
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle>Arbre du tournoi</CardTitle>
                    <CardDescription>
                      {treeMatches.length} matchs - {eliminationType === 'single' ? 'Elimination simple' : 'Double elimination'}
                      {poolSize > 0 && ` - Poules de ${poolSize} (2 qualifies)`}
                    </CardDescription>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={async () => { const d = await api.matches.list({ bracket_id: treeBracketId }); setTreeMatches(d); fetchAllData(); }}>
                      <RotateCw className="h-3 w-3 mr-1" /> Rafraichir
                    </Button>
                    <Button variant="outline" size="sm" onClick={modifyTree}>
                      <Pencil className="h-3 w-3 mr-1" /> Modifier
                    </Button>
                    <Button variant="destructive" size="sm" onClick={() => { if (confirm("Supprimer tout l'arbre et ses matchs ?")) deleteEntireTree(); }}>
                      <Trash2 className="h-3 w-3 mr-1" /> Supprimer
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {(() => {
                  const poolMatches = treeMatches.filter(m => (m.round_name || '').startsWith('Pool'));
                  const elimMatches = treeMatches.filter(m => !(m.round_name || '').startsWith('Pool'));

                  const poolGroups: Record<string, any[]> = {};
                  poolMatches.forEach(m => {
                    const pn = m.round_name || 'Pool';
                    if (!poolGroups[pn]) poolGroups[pn] = [];
                    poolGroups[pn].push(m);
                  });
                  const sortedPoolNames = Object.keys(poolGroups).sort();

                  const elimRounds: Record<string, any[]> = {};
                  elimMatches.forEach(m => {
                    const rn = m.round_name || `Tour ${m.round_number}`;
                    if (!elimRounds[rn]) elimRounds[rn] = [];
                    elimRounds[rn].push(m);
                  });
                  const sortedElimRounds = Object.keys(elimRounds).sort((a, b) => {
                    const ai = roundLabels.indexOf(a);
                    const bi = roundLabels.indexOf(b);
                    return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
                  });

                  return (
                    <div className="space-y-8">
                      {sortedPoolNames.length > 0 && (
                        <div>
                          <h3 className="text-lg font-bold mb-4">Phase de Poules</h3>
                          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            {sortedPoolNames.map((poolName) => {
                              const pMatches = poolGroups[poolName];
                              const playerIds = new Set<string>();
                              pMatches.forEach(m => {
                                if (m.player1) playerIds.add(m.player1);
                                if (m.player2) playerIds.add(m.player2);
                              });
                              const playerList = Array.from(playerIds);
                              const playerNames: Record<string, string> = {};
                              pMatches.forEach(m => {
                                if (m.player1) playerNames[m.player1] = m.player1_name || '?';
                                if (m.player2) playerNames[m.player2] = m.player2_name || '?';
                              });

                              const wins: Record<string, number> = {};
                              const matchResults: Record<string, string> = {};
                              playerList.forEach(pid => { wins[pid] = 0; });
                              pMatches.forEach(m => {
                                const key1 = `${m.player1}_${m.player2}`;
                                const key2 = `${m.player2}_${m.player1}`;
                                if (m.status === 'finished' && m.winner) {
                                  wins[m.winner] = (wins[m.winner] || 0) + 1;
                                  matchResults[key1] = m.winner === m.player1 ? 'V' : 'D';
                                  matchResults[key2] = m.winner === m.player2 ? 'V' : 'D';
                                } else if (m.status === 'in_progress') {
                                  matchResults[key1] = '...';
                                  matchResults[key2] = '...';
                                } else {
                                  matchResults[key1] = '-';
                                  matchResults[key2] = '-';
                                }
                              });

                              const ranking = [...playerList].sort((a, b) => (wins[b] || 0) - (wins[a] || 0));
                              const allDone = pMatches.every((m: any) => m.status === 'finished');

                              return (
                                <div key={poolName} className="border rounded-lg overflow-hidden">
                                  <div className={`px-4 py-2 font-bold text-white ${allDone ? 'bg-green-700' : 'bg-blue-800'}`}>
                                    {poolName}
                                    {allDone && <span className="ml-2 text-xs font-normal opacity-80">- Terminee</span>}
                                  </div>
                                  <table className="w-full text-sm">
                                    <thead>
                                      <tr className="bg-gray-100">
                                        <th className="text-left px-3 py-2 w-8">#</th>
                                        <th className="text-left px-3 py-2">Joueur</th>
                                        {playerList.map((_, ci) => (
                                          <th key={ci} className="text-center px-2 py-2 w-10">{ci + 1}</th>
                                        ))}
                                        <th className="text-center px-3 py-2 w-10">V</th>
                                        <th className="text-center px-3 py-2 w-20">Classement</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {ranking.map((pid, ri) => (
                                        <tr key={pid} className={`border-t ${ri < 2 && allDone ? 'bg-green-50' : ''}`}>
                                          <td className="px-3 py-2 font-bold text-gray-500">{ri + 1}</td>
                                          <td className="px-3 py-2 font-medium truncate max-w-[140px]">{playerNames[pid]}</td>
                                          {playerList.map((opId, ci) => {
                                            const isRowPlayer = playerList.indexOf(pid);
                                            if (isRowPlayer === ci) {
                                              return <td key={ci} className="text-center px-2 py-2 bg-gray-200">X</td>;
                                            }
                                            const res = matchResults[`${pid}_${opId}`] || '-';
                                            const match = pMatches.find((m: any) =>
                                              (m.player1 === pid && m.player2 === opId) ||
                                              (m.player2 === pid && m.player1 === opId)
                                            );
                                            return (
                                              <td
                                                key={ci}
                                                className={`text-center px-2 py-2 cursor-pointer hover:bg-blue-100 transition-colors font-bold ${
                                                  res === 'V' ? 'text-green-600' : res === 'D' ? 'text-red-500' : res === '...' ? 'text-orange-500' : 'text-gray-400'
                                                }`}
                                                onClick={() => {
                                                  if (match) {
                                                    if (match.status === 'waiting') {
                                                      setSelectedMatch(match);
                                                      setSelectedTable("");
                                                    } else if (match.status === 'in_progress') {
                                                      setSelectedMatch(match);
                                                    }
                                                  }
                                                }}
                                              >
                                                {res}
                                              </td>
                                            );
                                          })}
                                          <td className="text-center px-3 py-2 font-bold">{wins[pid] || 0}</td>
                                          <td className={`text-center px-3 py-2 font-bold ${
                                            allDone ? (ri === 0 ? 'text-green-600' : ri === 1 ? 'text-green-600' : 'text-red-500') : 'text-gray-400'
                                          }`}>
                                            {allDone ? (ri === 0 ? '1er' : ri === 1 ? '2eme' : `${ri + 1}eme`) : '-'}
                                          </td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                  <div className="px-3 py-2 bg-gray-50 text-xs text-muted-foreground flex gap-3">
                                    {pMatches.map((m: any, mi: number) => (
                                      <button
                                        key={m.id}
                                        onClick={() => {
                                          if (m.status === 'waiting' && m.player1_name && m.player2_name) {
                                            setSelectedMatch(m); setSelectedTable("");
                                          } else if (m.status === 'in_progress') {
                                            setSelectedMatch(m);
                                          }
                                        }}
                                        className={`px-2 py-1 rounded text-xs cursor-pointer transition-colors ${
                                          m.status === 'finished' ? 'bg-green-100 text-green-700' :
                                          m.status === 'in_progress' ? 'bg-red-100 text-red-700 animate-pulse' :
                                          'bg-gray-200 text-gray-600 hover:bg-blue-100'
                                        }`}
                                      >
                                        M{mi + 1}: {(m.player1_name || '?').split(' ')[0]} vs {(m.player2_name || '?').split(' ')[0]}
                                        {m.status === 'finished' && m.winner && ` → ${playerNames[m.winner]?.split(' ')[0] || '?'}`}
                                        {m.table_number ? ` (T${m.table_number})` : ''}
                                      </button>
                                    ))}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {sortedElimRounds.length > 0 && (
                        <div>
                          <h3 className="text-lg font-bold mb-4">Phase d'elimination</h3>
                          <div className="overflow-x-auto pb-4">
                            <div className="flex min-w-max items-start">
                              {sortedElimRounds.map((roundName, roundIdx) => {
                                const matchCount = elimRounds[roundName].length;
                                const spacingMultiplier = Math.pow(2, roundIdx);
                                return (
                                  <div key={roundName} className="flex flex-col" style={{ minWidth: 220 }}>
                                    <h4 className="text-center font-bold text-xs bg-gray-800 text-white py-1.5 rounded mx-1 mb-2">
                                      {roundName}
                                    </h4>
                                    <div className="flex flex-col" style={{ gap: 0 }}>
                                      {elimRounds[roundName].map((match: any, matchIdx: number) => {
                                        const matchHeight = 56;
                                        const baseGap = 8;
                                        const topPad = roundIdx === 0 ? 0 : (spacingMultiplier - 1) * (matchHeight + baseGap) / 2;

                                        return (
                                          <div key={match.id} className="flex items-center" style={{ paddingTop: matchIdx === 0 ? topPad : (spacingMultiplier - 1) * (matchHeight + baseGap), paddingBottom: 0 }}>
                                            {roundIdx > 0 && (
                                              <div className="flex flex-col items-center justify-center" style={{ width: 20 }}>
                                                <div className="border-t-2 border-gray-400 w-full" />
                                              </div>
                                            )}
                                            <div
                                              className={`flex-1 border rounded overflow-hidden cursor-pointer transition-all hover:shadow-lg ${
                                                match.status === 'finished' ? 'border-green-500 bg-white' :
                                                match.status === 'in_progress' ? 'border-red-500 ring-1 ring-red-200 bg-white' :
                                                'border-gray-300 bg-white hover:border-blue-400'
                                              }`}
                                              style={{ minHeight: matchHeight }}
                                              onClick={() => {
                                                if (match.status === 'waiting' && match.player1_name && match.player2_name) {
                                                  setSelectedMatch(match); setSelectedTable("");
                                                } else if (match.status === 'in_progress') {
                                                  setSelectedMatch(match);
                                                }
                                              }}
                                            >
                                              <div className={`px-2 py-1 flex justify-between items-center border-b text-xs ${
                                                match.winner && match.winner === match.player1 ? 'bg-green-50 font-bold' : ''
                                              }`}>
                                                <span className="truncate flex-1">{match.player1_name || 'TBD'}</span>
                                                {match.winner === match.player1 && <Trophy className="h-3 w-3 text-green-600 shrink-0" />}
                                              </div>
                                              <div className={`px-2 py-1 flex justify-between items-center text-xs ${
                                                match.winner && match.winner === match.player2 ? 'bg-green-50 font-bold' : ''
                                              }`}>
                                                <span className="truncate flex-1">{match.player2_name || 'TBD'}</span>
                                                {match.winner === match.player2 && <Trophy className="h-3 w-3 text-green-600 shrink-0" />}
                                              </div>
                                              {(match.status !== 'waiting' || match.table_number) && (
                                                <div className={`px-1 py-0.5 text-[9px] text-center ${
                                                  match.status === 'in_progress' ? 'bg-red-50 text-red-700' :
                                                  match.status === 'finished' ? 'bg-green-50 text-green-700' : 'bg-blue-50 text-blue-600'
                                                }`}>
                                                  {match.status === 'in_progress' && `En cours${match.table_number ? ` T${match.table_number}` : ''}`}
                                                  {match.status === 'finished' && 'Termine'}
                                                  {match.status === 'waiting' && match.table_number && `T${match.table_number}`}
                                                </div>
                                              )}
                                            </div>
                                            {roundIdx < sortedElimRounds.length - 1 && (
                                              <div className="flex flex-col items-center" style={{ width: 20 }}>
                                                <div className="border-t-2 border-gray-400 w-full" />
                                                {matchIdx % 2 === 0 ? (
                                                  <div className="border-r-2 border-gray-400 h-full" style={{ minHeight: (matchHeight + baseGap) * spacingMultiplier / 2 }} />
                                                ) : (
                                                  <div className="border-r-2 border-gray-400" style={{ minHeight: 0 }} />
                                                )}
                                              </div>
                                            )}
                                          </div>
                                        );
                                      })}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })()}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <LayoutGrid className="h-5 w-5" />
                  Tables disponibles
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
                  {tables.map((t) => (
                    <div
                      key={t.id}
                      className={`p-3 rounded-lg border-2 text-center ${
                        t.status === 'free'
                          ? 'border-green-300 bg-green-50'
                          : 'border-red-300 bg-red-50'
                      }`}
                    >
                      <p className="font-bold text-lg">Table {t.table_number}</p>
                      <p className="text-xs text-muted-foreground">{t.room_name}</p>
                      <Badge
                        variant={t.status === 'free' ? 'success' : 'destructive'}
                        className="mt-1 text-xs"
                      >
                        {t.status === 'free' ? 'Libre' : 'Occupee'}
                      </Badge>
                    </div>
                  ))}
                </div>
                <p className="mt-3 text-sm text-muted-foreground">
                  {tables.filter(t => t.status === 'free').length} table(s) libre(s) sur {tables.length}
                </p>
              </CardContent>
            </Card>
            </>
          )}
        </TabsContent>
      </Tabs>

      <Dialog open={selectedMatch !== null && selectedMatch.status === "waiting"} onOpenChange={() => setSelectedMatch(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assigner une table</DialogTitle>
            <DialogDescription>
              {selectedMatch?.player1_name} vs {selectedMatch?.player2_name}
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Label>Table</Label>
            <Select value={selectedTable} onValueChange={setSelectedTable}>
              <SelectTrigger><SelectValue placeholder="Selectionnez une table" /></SelectTrigger>
              <SelectContent>
                {tables.filter(t => t.status === "free").map((t) => (
                  <SelectItem key={t.id} value={t.id}>Table {t.table_number} - {t.room_name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedMatch(null)}>Annuler</Button>
            <Button onClick={assignMatchToTable} disabled={!selectedTable}>
              Assigner
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={selectedMatch !== null && selectedMatch.status === "in_progress"} onOpenChange={() => setSelectedMatch(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Qui a gagne ?</DialogTitle>
            <DialogDescription>
              {selectedMatch?.player1_name} vs {selectedMatch?.player2_name}
              {selectedMatch?.table_number && ` - Table ${selectedMatch.table_number}`}
            </DialogDescription>
          </DialogHeader>
          <div className="py-6 flex flex-col gap-3">
            <Button
              size="lg"
              className="w-full justify-start text-left h-auto py-4 bg-blue-600 hover:bg-blue-700"
              onClick={() => finishMatch(selectedMatch?.player1)}
            >
              <Trophy className="h-5 w-5 mr-3 shrink-0" />
              <span className="font-bold text-lg">{selectedMatch?.player1_name}</span>
            </Button>
            <Button
              size="lg"
              className="w-full justify-start text-left h-auto py-4 bg-blue-600 hover:bg-blue-700"
              onClick={() => finishMatch(selectedMatch?.player2)}
            >
              <Trophy className="h-5 w-5 mr-3 shrink-0" />
              <span className="font-bold text-lg">{selectedMatch?.player2_name}</span>
            </Button>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedMatch(null)}>Annuler</Button>
            <Button variant="destructive" size="sm" onClick={() => { if (selectedMatch) { deleteTreeMatch(selectedMatch.id); setSelectedMatch(null); } }}>
              <Trash2 className="h-3 w-3 mr-1" /> Supprimer le match
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={editTournament !== null} onOpenChange={() => setEditTournament(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Modifier le tournoi</DialogTitle>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <div>
              <Label>Nom</Label>
              <Input
                value={editTournament?.name || ""}
                onChange={(e) => setEditTournament(editTournament ? { ...editTournament, name: e.target.value } : null)}
              />
            </div>
            <div>
              <Label>Description</Label>
              <Input
                value={editTournament?.description || ""}
                onChange={(e) => setEditTournament(editTournament ? { ...editTournament, description: e.target.value } : null)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditTournament(null)}>Annuler</Button>
            <Button onClick={updateTournament}>Enregistrer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={editBracket !== null} onOpenChange={() => setEditBracket(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Modifier le tableau</DialogTitle>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Nom</Label>
                <Input
                  value={editBracket?.name || ""}
                  onChange={(e) => setEditBracket(editBracket ? { ...editBracket, name: e.target.value } : null)}
                />
              </div>
              <div>
                <Label>Categorie</Label>
                <Input
                  value={editBracket?.category || ""}
                  onChange={(e) => setEditBracket(editBracket ? { ...editBracket, category: e.target.value } : null)}
                />
              </div>
              <div>
                <Label>Points min</Label>
                <Input
                  type="number"
                  value={editBracket?.min_points ?? ""}
                  onChange={(e) => setEditBracket(editBracket ? { ...editBracket, min_points: e.target.value ? parseInt(e.target.value) : null } : null)}
                />
              </div>
              <div>
                <Label>Points max</Label>
                <Input
                  type="number"
                  value={editBracket?.max_points ?? ""}
                  onChange={(e) => setEditBracket(editBracket ? { ...editBracket, max_points: e.target.value ? parseInt(e.target.value) : null } : null)}
                />
              </div>
              <div>
                <Label>Max joueurs</Label>
                <Input
                  type="number"
                  value={editBracket?.max_players || ""}
                  onChange={(e) => setEditBracket(editBracket ? { ...editBracket, max_players: parseInt(e.target.value) } : null)}
                />
              </div>
              <div>
                <Label>Montant €</Label>
                <Input
                  type="number"
                  value={editBracket?.entry_fee || ""}
                  onChange={(e) => setEditBracket(editBracket ? { ...editBracket, entry_fee: parseFloat(e.target.value) } : null)}
                />
              </div>
              <div>
                <Label>Jour</Label>
                <Input
                  value={editBracket?.day || ""}
                  onChange={(e) => setEditBracket(editBracket ? { ...editBracket, day: e.target.value } : null)}
                  placeholder="Samedi 21/02"
                />
              </div>
              <div>
                <Label>Fin de pointage</Label>
                <Input
                  value={editBracket?.checkin_end || ""}
                  onChange={(e) => setEditBracket(editBracket ? { ...editBracket, checkin_end: e.target.value } : null)}
                  placeholder="8h30"
                />
              </div>
              <div className="col-span-2">
                <Label>Debut du tableau</Label>
                <Input
                  value={editBracket?.start_time || ""}
                  onChange={(e) => setEditBracket(editBracket ? { ...editBracket, start_time: e.target.value } : null)}
                  placeholder="9h00"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditBracket(null)}>Annuler</Button>
            <Button onClick={updateBracket}>Enregistrer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={editRoom !== null} onOpenChange={() => setEditRoom(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Modifier la salle</DialogTitle>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <div>
              <Label>Nom</Label>
              <Input
                value={editRoom?.name || ""}
                onChange={(e) => setEditRoom(editRoom ? { ...editRoom, name: e.target.value } : null)}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Nombre de rangees</Label>
                <Input
                  type="number"
                  min="1"
                  value={editRoom?.rows || ""}
                  onChange={(e) => setEditRoom(editRoom ? { ...editRoom, rows: parseInt(e.target.value) || 1 } : null)}
                />
              </div>
              <div>
                <Label>Tables par rangee</Label>
                <Input
                  type="number"
                  min="1"
                  value={editRoom?.tables_per_row || ""}
                  onChange={(e) => setEditRoom(editRoom ? { ...editRoom, tables_per_row: parseInt(e.target.value) || 1 } : null)}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditRoom(null)}>Annuler</Button>
            <Button onClick={updateRoom}>Enregistrer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={editSection !== null} onOpenChange={() => setEditSection(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Modifier la section</DialogTitle>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <div>
              <Label>Nom</Label>
              <Input
                value={editSection?.name || ""}
                onChange={(e) => setEditSection(editSection ? { ...editSection, name: e.target.value } : null)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditSection(null)}>Annuler</Button>
            <Button onClick={updateSection}>Enregistrer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={editItem !== null} onOpenChange={() => setEditItem(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Modifier l'article</DialogTitle>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <div>
              <Label>Nom</Label>
              <Input
                value={editItem?.name || ""}
                onChange={(e) => setEditItem(editItem ? { ...editItem, name: e.target.value } : null)}
              />
            </div>
            <div>
              <Label>Prix €</Label>
              <Input
                type="number"
                step="0.5"
                value={editItem?.price || ""}
                onChange={(e) => setEditItem(editItem ? { ...editItem, price: parseFloat(e.target.value) } : null)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditItem(null)}>Annuler</Button>
            <Button onClick={updateMenuItem}>Enregistrer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={editPlayer !== null} onOpenChange={() => setEditPlayer(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Modifier le joueur</DialogTitle>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Nom</Label>
                <Input
                  value={editPlayer?.last_name || ""}
                  onChange={(e) => setEditPlayer(editPlayer ? { ...editPlayer, last_name: e.target.value } : null)}
                />
              </div>
              <div>
                <Label>Prenom</Label>
                <Input
                  value={editPlayer?.first_name || ""}
                  onChange={(e) => setEditPlayer(editPlayer ? { ...editPlayer, first_name: e.target.value } : null)}
                />
              </div>
            </div>
            <div>
              <Label>Club</Label>
              <Input
                value={editPlayer?.club || ""}
                onChange={(e) => setEditPlayer(editPlayer ? { ...editPlayer, club: e.target.value } : null)}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Points</Label>
                <Input
                  type="number"
                  value={editPlayer?.ranking || ""}
                  onChange={(e) => setEditPlayer(editPlayer ? { ...editPlayer, ranking: parseInt(e.target.value) || 0 } : null)}
                />
              </div>
              <div>
                <Label>Telephone</Label>
                <Input
                  value={editPlayer?.phone || ""}
                  onChange={(e) => setEditPlayer(editPlayer ? { ...editPlayer, phone: e.target.value } : null)}
                />
              </div>
            </div>
            <div>
              <Label>Email</Label>
              <Input
                value={editPlayer?.email || ""}
                onChange={(e) => setEditPlayer(editPlayer ? { ...editPlayer, email: e.target.value } : null)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditPlayer(null)}>Annuler</Button>
            <Button onClick={updatePlayer}>Enregistrer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
