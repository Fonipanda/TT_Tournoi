"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { api } from "@/lib/api";
import { 
  Bell, Search, Loader2, Mail, Phone, 
  CheckCircle, AlertCircle, Trash2, Settings, Plus, UserPlus
} from "lucide-react";

interface Player {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  club: string;
  ranking: string;
}

interface Subscription {
  id: string;
  player: string;
  player_name: string;
  player_email: string;
  player_phone: string;
  email_enabled: boolean;
  sms_enabled: boolean;
  subscriber_name: string;
  subscriber_phone: string;
  subscriber_email: string;
}

interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  is_read: boolean;
  is_sent_email: boolean;
  is_sent_sms: boolean;
  created_at: string;
}

export default function NotificationsPage() {
  const [searchName, setSearchName] = useState("");
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [foundPlayers, setFoundPlayers] = useState<Player[]>([]);
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null);
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(false);

  const [emailEnabled, setEmailEnabled] = useState(true);
  const [smsEnabled, setSmsEnabled] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const [showAddSubscriber, setShowAddSubscriber] = useState(false);
  const [newSubName, setNewSubName] = useState("");
  const [newSubPhone, setNewSubPhone] = useState("");
  const [newSubEmail, setNewSubEmail] = useState("");

  const searchPlayer = async () => {
    if (!searchName.trim()) {
      setSearchError("Veuillez entrer un nom");
      return;
    }

    setSearching(true);
    setSearchError(null);
    setFoundPlayers([]);
    setSelectedPlayer(null);
    setSubscriptions([]);
    setNotifications([]);

    try {
      const players = await api.players.getByName(searchName.trim());
      
      if (players && players.length > 0) {
        setFoundPlayers(players);
        if (players.length === 1) {
          selectPlayer(players[0]);
        }
      } else {
        setSearchError("Aucun joueur trouve avec ce nom");
      }
    } catch (err: any) {
      setSearchError(err.message || "Erreur lors de la recherche");
    } finally {
      setSearching(false);
    }
  };

  const selectPlayer = async (player: Player) => {
    setSelectedPlayer(player);
    setFoundPlayers([]);

    try {
      const subs = await api.notificationSubscriptions.list(player.id);
      setSubscriptions(subs || []);
      if (subs && subs.length > 0) {
        setEmailEnabled(subs[0].email_enabled);
        setSmsEnabled(subs[0].sms_enabled);
      }

      const notifs = await api.notifications.list(player.id);
      setNotifications(notifs);
    } catch (err: any) {
      setSearchError(err.message || "Erreur lors du chargement");
    }
  };

  const createOrUpdateSubscription = async () => {
    if (!selectedPlayer) return;

    setSaving(true);
    setSaveSuccess(false);

    try {
      if (subscriptions.length > 0) {
        // Update the first (main) subscription
        await api.notificationSubscriptions.update(subscriptions[0].id, {
          email_enabled: emailEnabled,
          sms_enabled: smsEnabled,
        });
      } else {
        const newSub = await api.notificationSubscriptions.create({
          player: selectedPlayer.id,
          email_enabled: emailEnabled,
          sms_enabled: smsEnabled,
        });
        setSubscriptions([newSub]);
      }
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err: any) {
      setSearchError(err.message || "Erreur lors de la sauvegarde");
    } finally {
      setSaving(false);
    }
  };

  const deleteSubscription = async (subId: string) => {
    try {
      await api.notificationSubscriptions.delete(subId);
      setSubscriptions(subscriptions.filter(s => s.id !== subId));
      if (subscriptions.length <= 1) {
        setEmailEnabled(true);
        setSmsEnabled(false);
      }
    } catch (err: any) {
      setSearchError(err.message || "Erreur lors de la suppression");
    }
  };

  const addSubscriber = async () => {
    if (!selectedPlayer) return;
    try {
      const newSub = await api.notificationSubscriptions.create({
        player: selectedPlayer.id,
        email_enabled: !!newSubEmail,
        sms_enabled: !!newSubPhone,
        subscriber_name: newSubName,
        subscriber_phone: newSubPhone,
        subscriber_email: newSubEmail,
      });
      setSubscriptions([...subscriptions, newSub]);
      setShowAddSubscriber(false);
      setNewSubName("");
      setNewSubPhone("");
      setNewSubEmail("");
    } catch (err: any) {
      setSearchError(err.message || "Erreur lors de l'ajout");
    }
  };

  const markAsRead = async (notificationId: string) => {
    try {
      await api.notifications.markRead(notificationId);
      setNotifications(notifications.map(n => 
        n.id === notificationId ? { ...n, is_read: true } : n
      ));
    } catch (err) {
      console.error("Erreur:", err);
    }
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case "match_created": return "Match cree";
      case "match_started": return "Match commence";
      case "table_assigned": return "Table assignee";
      case "match_blocked": return "Match bloque";
      case "match_unblocked": return "Match debloque";
      default: return type;
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleString("fr-FR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Mes Notifications
          </CardTitle>
          <CardDescription>
            Configurez vos preferences de notification par email et SMS
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2 max-w-md">
            <Input
              type="text"
              value={searchName}
              onChange={(e) => setSearchName(e.target.value)}
              placeholder="votre Nom"
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

          {searchError && (
            <p className="text-sm text-red-600 mt-2 flex items-center gap-1">
              <AlertCircle className="h-4 w-4" />
              {searchError}
            </p>
          )}

          {foundPlayers.length > 1 && (
            <div className="mt-4 space-y-2">
              <p className="text-sm font-medium">Plusieurs joueurs trouves, selectionnez :</p>
              {foundPlayers.map((player) => (
                <div
                  key={player.id}
                  className="p-3 border rounded-lg hover:bg-gray-50 cursor-pointer transition-colors"
                  onClick={() => selectPlayer(player)}
                >
                  <p className="font-medium">{player.last_name} {player.first_name}</p>
                  <p className="text-sm text-muted-foreground">{player.club} - {player.ranking} pts</p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {selectedPlayer && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="grid grid-cols-1 lg:grid-cols-2 gap-6"
        >
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5" />
                Preferences de notification
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="p-4 bg-gray-50 rounded-lg">
                <h3 className="font-semibold">
                  {selectedPlayer.last_name} {selectedPlayer.first_name}
                </h3>
                <p className="text-sm text-muted-foreground">
                  {selectedPlayer.club} - {selectedPlayer.ranking} pts
                </p>
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex items-center gap-3">
                    <Mail className="h-5 w-5 text-blue-600" />
                    <div>
                      <p className="font-medium">Notifications par Email</p>
                      <p className="text-sm text-muted-foreground">
                        {selectedPlayer.email}
                      </p>
                    </div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={emailEnabled}
                      onChange={(e) => setEmailEnabled(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                  </label>
                </div>

                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex items-center gap-3">
                    <Phone className="h-5 w-5 text-green-600" />
                    <div>
                      <p className="font-medium">Notifications par SMS</p>
                      <p className="text-sm text-muted-foreground">
                        {selectedPlayer.phone || "Aucun numero configure"}
                      </p>
                    </div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={smsEnabled}
                      onChange={(e) => setSmsEnabled(e.target.checked)}
                      disabled={!selectedPlayer.phone}
                      className="sr-only peer"
                    />
                    <div className={`w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-green-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-600 ${!selectedPlayer.phone ? 'opacity-50' : ''}`}></div>
                  </label>
                </div>

                {!selectedPlayer.phone && (
                  <p className="text-sm text-muted-foreground">
                    Pour activer les SMS, ajoutez un numero de telephone dans votre profil lors de l'inscription.
                  </p>
                )}
              </div>

              <div className="flex gap-2">
                <Button 
                  onClick={createOrUpdateSubscription}
                  disabled={saving}
                  className="flex-1"
                >
                  {saving ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : saveSuccess ? (
                    <CheckCircle className="h-4 w-4 mr-2" />
                  ) : null}
                  {subscriptions.length > 0 ? "Mettre a jour" : "Activer les notifications"}
                </Button>
                
                {subscriptions.length > 0 && (
                  <Button 
                    variant="destructive"
                    onClick={() => deleteSubscription(subscriptions[0].id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>

              {saveSuccess && (
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="text-sm text-green-600 flex items-center gap-1"
                >
                  <CheckCircle className="h-4 w-4" />
                  Preferences sauvegardees !
                </motion.p>
              )}

              {/* Abonnes supplementaires */}
              <div className="border-t pt-4 mt-4">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-medium flex items-center gap-2">
                    <UserPlus className="h-4 w-4" />
                    Abonnes aux notifications ({subscriptions.filter(s => s.subscriber_name).length})
                  </h4>
                  <Button variant="outline" size="sm" onClick={() => setShowAddSubscriber(!showAddSubscriber)}>
                    <Plus className="h-4 w-4 mr-1" />Ajouter
                  </Button>
                </div>

                {showAddSubscriber && (
                  <div className="p-3 bg-gray-50 rounded-lg mb-3 space-y-2">
                    <div>
                      <Label>Nom de l'abonne</Label>
                      <Input value={newSubName} onChange={e => setNewSubName(e.target.value)} placeholder="Papa, Maman, Coach..." />
                    </div>
                    <div>
                      <Label>Telephone</Label>
                      <Input value={newSubPhone} onChange={e => setNewSubPhone(e.target.value)} placeholder="+33612345678" />
                    </div>
                    <div>
                      <Label>Email (optionnel)</Label>
                      <Input value={newSubEmail} onChange={e => setNewSubEmail(e.target.value)} placeholder="email@exemple.com" />
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" onClick={addSubscriber} disabled={!newSubName || (!newSubPhone && !newSubEmail)}>
                        Ajouter
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => setShowAddSubscriber(false)}>
                        Annuler
                      </Button>
                    </div>
                  </div>
                )}

                {subscriptions.filter(s => s.subscriber_name).length > 0 && (
                  <div className="space-y-2">
                    {subscriptions.filter(s => s.subscriber_name).map(sub => (
                      <div key={sub.id} className="flex items-center justify-between p-2 border rounded">
                        <div>
                          <p className="font-medium text-sm">{sub.subscriber_name}</p>
                          <p className="text-xs text-muted-foreground">
                            {sub.subscriber_phone && <span className="mr-2">{sub.subscriber_phone}</span>}
                            {sub.subscriber_email && <span>{sub.subscriber_email}</span>}
                          </p>
                        </div>
                        <Button variant="ghost" size="sm" onClick={() => deleteSubscription(sub.id)}>
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}

                <p className="text-xs text-muted-foreground mt-2">
                  Les abonnes recevront aussi les notifications SMS/Email quand le joueur est assigne a une table.
                </p>
              </div>

              <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <h4 className="font-medium text-blue-800 mb-2">Comment ca marche ?</h4>
                <ul className="text-sm text-blue-700 space-y-1">
                  <li>- Vous serez notifie quand une table vous est assignee</li>
                  <li>- Vous recevrez un rappel quand c'est votre tour de jouer</li>
                  <li>- Les emails et SMS sont envoyes instantanement</li>
                </ul>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Historique des notifications</CardTitle>
            </CardHeader>
            <CardContent>
              {notifications.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">
                  Aucune notification pour le moment
                </p>
              ) : (
                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {notifications.map((notif) => (
                    <motion.div
                      key={notif.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className={`p-3 border rounded-lg cursor-pointer transition-all ${
                        notif.is_read ? "bg-gray-50" : "bg-blue-50 border-blue-200"
                      }`}
                      onClick={() => !notif.is_read && markAsRead(notif.id)}
                    >
                      <div className="flex justify-between items-start mb-2">
                        <Badge variant={notif.is_read ? "secondary" : "default"}>
                          {getTypeLabel(notif.type)}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {formatDate(notif.created_at)}
                        </span>
                      </div>
                      <h4 className="font-medium">{notif.title}</h4>
                      <p className="text-sm text-muted-foreground">{notif.message}</p>
                      <div className="flex gap-2 mt-2">
                        {notif.is_sent_email && (
                          <Badge variant="outline" className="text-xs">
                            <Mail className="h-3 w-3 mr-1" />
                            Email envoye
                          </Badge>
                        )}
                        {notif.is_sent_sms && (
                          <Badge variant="outline" className="text-xs">
                            <Phone className="h-3 w-3 mr-1" />
                            SMS envoye
                          </Badge>
                        )}
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      )}
    </div>
  );
}
