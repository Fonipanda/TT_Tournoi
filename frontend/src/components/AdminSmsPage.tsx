"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { api } from "@/lib/api";
import {
  Settings, Plus, Trash2, Loader2, AlertCircle, CheckCircle,
  Send, History, FileText, Pencil, Zap, Phone, MessageSquare
} from "lucide-react";

interface AdapterConfig {
  id: string;
  name: string;
  adapter_type: string;
  config: Record<string, string>;
  default_sender: string;
  is_active: boolean;
}

interface SmsTemplate {
  id: string;
  name: string;
  content: string;
  is_active: boolean;
}

interface SmsLogEntry {
  id: string;
  player_name: string;
  recipient_phone: string;
  recipient_name: string;
  message: string;
  sender: string;
  adapter_name: string;
  status: string;
  error_message: string;
  created_at: string;
}

interface TemplateVariable {
  name: string;
  label: string;
  example: string;
}

interface AdapterField {
  name: string;
  label: string;
  type: string;
  required: boolean;
  help_text: string;
}

export default function AdminSmsPage({ brackets, players }: { brackets: any[]; players: any[] }) {
  const [smsTab, setSmsTab] = useState("config");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Config state
  const [adapters, setAdapters] = useState<AdapterConfig[]>([]);
  const [adapterFields, setAdapterFields] = useState<AdapterField[]>([]);
  const [newAdapter, setNewAdapter] = useState({ name: "", adapter_type: "", default_sender: "", config: {} as Record<string, string> });
  const [editAdapter, setEditAdapter] = useState<AdapterConfig | null>(null);
  const [editAdapterFields, setEditAdapterFields] = useState<AdapterField[]>([]);
  const [testPhone, setTestPhone] = useState("");
  const [testing, setTesting] = useState(false);

  // Templates state
  const [templates, setTemplates] = useState<SmsTemplate[]>([]);
  const [templateVars, setTemplateVars] = useState<TemplateVariable[]>([]);
  const [newTemplate, setNewTemplate] = useState({ name: "", content: "" });
  const [editTemplate, setEditTemplate] = useState<SmsTemplate | null>(null);

  // Send state
  const [sendTargetType, setSendTargetType] = useState("player");
  const [sendTargetId, setSendTargetId] = useState("");
  const [sendPlayerSearch, setSendPlayerSearch] = useState("");
  const [sendMessageType, setSendMessageType] = useState("free");
  const [sendTemplateId, setSendTemplateId] = useState("");
  const [sendMessage, setSendMessage] = useState("");
  const [sendSender, setSendSender] = useState("");
  const [sending, setSending] = useState(false);
  const [sendResult, setSendResult] = useState<any>(null);
  const [confirmDialog, setConfirmDialog] = useState(false);

  // History state
  const [logs, setLogs] = useState<SmsLogEntry[]>([]);
  const [logFilter, setLogFilter] = useState("");
  const [stats, setStats] = useState({ total: 0, sent: 0, failed: 0, pending: 0 });

  const showSuccess = (msg: string) => { setSuccess(msg); setTimeout(() => setSuccess(null), 3000); };
  const showError = (msg: string) => { setError(msg); setTimeout(() => setError(null), 5000); };

  useEffect(() => {
    fetchData();
  }, [smsTab]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [adaptersData, templatesData, varsData] = await Promise.all([
        api.sms.adapters.list(),
        api.sms.templates.list(),
        api.sms.templateVariables(),
      ]);
      setAdapters(adaptersData);
      setTemplates(templatesData);
      setTemplateVars(varsData);

      if (smsTab === "history") {
        const [logsData, statsData] = await Promise.all([
          api.sms.logs.list(logFilter ? { status: logFilter } : {}),
          api.sms.stats(),
        ]);
        setLogs(logsData);
        setStats(statsData);
      }
    } catch (err: any) {
      showError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // ---- Config ----
  const loadAdapterFields = async (type: string) => {
    if (!type) { setAdapterFields([]); return; }
    try {
      const fields = await api.sms.adapterFields(type);
      setAdapterFields(fields);
    } catch { setAdapterFields([]); }
  };

  const loadEditAdapterFields = async (type: string) => {
    if (!type) { setEditAdapterFields([]); return; }
    try {
      const fields = await api.sms.adapterFields(type);
      setEditAdapterFields(fields);
    } catch { setEditAdapterFields([]); }
  };

  const createAdapter = async () => {
    try {
      await api.sms.adapters.create(newAdapter);
      setNewAdapter({ name: "", adapter_type: "", default_sender: "", config: {} });
      setAdapterFields([]);
      fetchData();
      showSuccess("Adaptateur cree");
    } catch (err: any) { showError(err.message); }
  };

  const updateAdapter = async () => {
    if (!editAdapter) return;
    try {
      await api.sms.adapters.update(editAdapter.id, editAdapter);
      setEditAdapter(null);
      setEditAdapterFields([]);
      fetchData();
      showSuccess("Adaptateur modifie");
    } catch (err: any) { showError(err.message); }
  };

  const toggleAdapterActive = async (adapter: AdapterConfig) => {
    try {
      await api.sms.adapters.update(adapter.id, { is_active: !adapter.is_active });
      fetchData();
    } catch (err: any) { showError(err.message); }
  };

  const deleteAdapter = async (id: string) => {
    try {
      await api.sms.adapters.delete(id);
      fetchData();
      showSuccess("Adaptateur supprime");
    } catch (err: any) { showError(err.message); }
  };

  const testSms = async () => {
    if (!testPhone) return;
    setTesting(true);
    try {
      const result = await api.sms.test({ phone: testPhone, message: "SMS de test depuis TT Tournoi" });
      if (result.success) {
        showSuccess("SMS de test envoye !");
      } else {
        showError(`Echec: ${result.error}`);
      }
    } catch (err: any) { showError(err.message); }
    finally { setTesting(false); }
  };

  // ---- Templates ----
  const createTemplate = async () => {
    try {
      await api.sms.templates.create(newTemplate);
      setNewTemplate({ name: "", content: "" });
      fetchData();
      showSuccess("Modele cree");
    } catch (err: any) { showError(err.message); }
  };

  const updateTemplate = async () => {
    if (!editTemplate) return;
    try {
      await api.sms.templates.update(editTemplate.id, { name: editTemplate.name, content: editTemplate.content });
      setEditTemplate(null);
      fetchData();
      showSuccess("Modele modifie");
    } catch (err: any) { showError(err.message); }
  };

  const deleteTemplate = async (id: string) => {
    try {
      await api.sms.templates.delete(id);
      fetchData();
      showSuccess("Modele supprime");
    } catch (err: any) { showError(err.message); }
  };

  const insertVariable = (varName: string, target: "new" | "edit" | "send") => {
    const tag = `{${varName}}`;
    if (target === "new") setNewTemplate({ ...newTemplate, content: newTemplate.content + tag });
    else if (target === "edit" && editTemplate) setEditTemplate({ ...editTemplate, content: editTemplate.content + tag });
    else if (target === "send") setSendMessage(sendMessage + tag);
  };

  // ---- Send ----
  const handleSend = async () => {
    setSending(true);
    setSendResult(null);
    try {
      const payload: any = {
        target_type: sendTargetType,
        target_id: sendTargetId,
        sender: sendSender,
      };
      if (sendMessageType === "template" && sendTemplateId) {
        payload.template_id = sendTemplateId;
        payload.variables = {};
      } else {
        payload.message = sendMessage;
      }
      const result = await api.sms.send(payload);
      setSendResult(result);
      if (result.success) {
        showSuccess(`${result.sent || 0} SMS envoye(s) sur ${result.total || 0}`);
      }
    } catch (err: any) { showError(err.message); }
    finally { setSending(false); setConfirmDialog(false); }
  };

  const filteredPlayers = sendPlayerSearch.length >= 2
    ? players.filter(p =>
        `${p.last_name} ${p.first_name}`.toLowerCase().includes(sendPlayerSearch.toLowerCase()) ||
        (p.license_number || '').includes(sendPlayerSearch)
      ).slice(0, 10)
    : [];

  const getMessagePreview = () => {
    if (sendMessageType === "template" && sendTemplateId) {
      const tpl = templates.find(t => t.id === sendTemplateId);
      return tpl?.content || "";
    }
    return sendMessage;
  };

  const charCount = getMessagePreview().length;
  const smsSegments = charCount <= 160 ? 1 : Math.ceil(charCount / 153);

  const formatDate = (d: string) => new Date(d).toLocaleString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });

  const statusBadge = (s: string) => {
    if (s === "sent") return <Badge className="bg-green-100 text-green-800">Envoye</Badge>;
    if (s === "failed") return <Badge className="bg-red-100 text-red-800">Echoue</Badge>;
    return <Badge className="bg-yellow-100 text-yellow-800">En attente</Badge>;
  };

  const adapterTypeLabels: Record<string, string> = {
    test: "Test (Console)", ovh: "OVH SMS", twilio: "Twilio", free_mobile: "Free Mobile", smpp: "SMPP (SMPPSim)",
  };

  return (
    <div className="space-y-4">
      {error && (
        <Card className="bg-red-50 border-red-200">
          <CardContent className="pt-4"><p className="text-red-600 flex items-center gap-1"><AlertCircle className="h-4 w-4" />{error}</p></CardContent>
        </Card>
      )}
      {success && (
        <Card className="bg-green-50 border-green-200">
          <CardContent className="pt-4"><p className="text-green-600 flex items-center gap-1"><CheckCircle className="h-4 w-4" />{success}</p></CardContent>
        </Card>
      )}

      <Tabs value={smsTab} onValueChange={setSmsTab}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="config" className="flex items-center gap-1"><Settings className="h-4 w-4" /><span className="hidden md:inline">Configuration</span></TabsTrigger>
          <TabsTrigger value="templates" className="flex items-center gap-1"><FileText className="h-4 w-4" /><span className="hidden md:inline">Modeles</span></TabsTrigger>
          <TabsTrigger value="send" className="flex items-center gap-1"><Send className="h-4 w-4" /><span className="hidden md:inline">Envoi SMS</span></TabsTrigger>
          <TabsTrigger value="history" className="flex items-center gap-1"><History className="h-4 w-4" /><span className="hidden md:inline">Historique</span></TabsTrigger>
        </TabsList>

        {/* ========== CONFIGURATION ========== */}
        <TabsContent value="config" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Ajouter un adaptateur SMS</CardTitle>
              <CardDescription>Configurez un fournisseur SMS (OVH, Twilio, Free Mobile, ou Test)</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <Label>Nom</Label>
                  <Input value={newAdapter.name} onChange={e => setNewAdapter({ ...newAdapter, name: e.target.value })} placeholder="Mon adaptateur" />
                </div>
                <div>
                  <Label>Type</Label>
                  <Select value={newAdapter.adapter_type} onValueChange={v => { setNewAdapter({ ...newAdapter, adapter_type: v, config: {} }); loadAdapterFields(v); }}>
                    <SelectTrigger><SelectValue placeholder="Selectionnez" /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(adapterTypeLabels).map(([k, v]) => (
                        <SelectItem key={k} value={k}>{v}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Expediteur par defaut</Label>
                  <Input value={newAdapter.default_sender} onChange={e => setNewAdapter({ ...newAdapter, default_sender: e.target.value })} placeholder="MonClub" />
                </div>
              </div>
              {adapterFields.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-gray-50 rounded-lg">
                  {adapterFields.map(field => (
                    <div key={field.name}>
                      <Label>{field.label} {field.required && <span className="text-red-500">*</span>}</Label>
                      <Input
                        type={field.type === "password" ? "password" : "text"}
                        value={newAdapter.config[field.name] || ""}
                        onChange={e => setNewAdapter({ ...newAdapter, config: { ...newAdapter.config, [field.name]: e.target.value } })}
                        placeholder={field.help_text}
                      />
                    </div>
                  ))}
                </div>
              )}
              <Button onClick={createAdapter} disabled={!newAdapter.name || !newAdapter.adapter_type}>
                <Plus className="h-4 w-4 mr-2" />Ajouter
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Adaptateurs configures</CardTitle></CardHeader>
            <CardContent>
              {adapters.length === 0 ? (
                <p className="text-muted-foreground">Aucun adaptateur configure</p>
              ) : (
                <div className="space-y-2">
                  {adapters.map(a => (
                    <div key={a.id} className="flex justify-between items-center p-3 border rounded">
                      <div className="flex items-center gap-3">
                        <div>
                          <p className="font-medium">{a.name}</p>
                          <p className="text-sm text-muted-foreground">{adapterTypeLabels[a.adapter_type] || a.adapter_type} {a.default_sender && `| Exp: ${a.default_sender}`}</p>
                        </div>
                        {a.is_active ? <Badge className="bg-green-100 text-green-800">Actif</Badge> : <Badge variant="outline">Inactif</Badge>}
                      </div>
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" onClick={() => toggleAdapterActive(a)}>
                          {a.is_active ? "Desactiver" : "Activer"}
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => { setEditAdapter({ ...a }); loadEditAdapterFields(a.adapter_type); }}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="destructive" size="sm" onClick={() => deleteAdapter(a.id)}>
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
            <CardHeader><CardTitle>Tester l'envoi SMS</CardTitle></CardHeader>
            <CardContent className="flex gap-2">
              <Input value={testPhone} onChange={e => setTestPhone(e.target.value)} placeholder="Numero de telephone (ex: +33612345678)" className="flex-1" />
              <Button onClick={testSms} disabled={!testPhone || testing}>
                {testing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Zap className="h-4 w-4 mr-2" />}
                Tester
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ========== TEMPLATES ========== */}
        <TabsContent value="templates" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Creer un modele SMS</CardTitle>
              <CardDescription>Utilisez les variables pour personnaliser vos messages</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Nom du modele</Label>
                <Input value={newTemplate.name} onChange={e => setNewTemplate({ ...newTemplate, name: e.target.value })} placeholder="Convocation joueur" />
              </div>
              <div>
                <Label>Contenu</Label>
                <Textarea value={newTemplate.content} onChange={e => setNewTemplate({ ...newTemplate, content: e.target.value })} placeholder="Bonjour {joueur}, rendez-vous table {table}..." rows={3} />
                <div className="flex items-center justify-between mt-1">
                  <div className="flex flex-wrap gap-1">
                    {templateVars.map(v => (
                      <button key={v.name} onClick={() => insertVariable(v.name, "new")}
                        className="px-2 py-0.5 text-xs bg-blue-100 text-blue-800 rounded hover:bg-blue-200 transition-colors"
                        title={v.label}>
                        {`{${v.name}}`}
                      </button>
                    ))}
                  </div>
                  <span className="text-xs text-muted-foreground">{newTemplate.content.length}/160 car.</span>
                </div>
              </div>
              <Button onClick={createTemplate} disabled={!newTemplate.name || !newTemplate.content}>
                <Plus className="h-4 w-4 mr-2" />Creer
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Modeles existants</CardTitle></CardHeader>
            <CardContent>
              {templates.length === 0 ? (
                <p className="text-muted-foreground">Aucun modele</p>
              ) : (
                <div className="space-y-2">
                  {templates.map(t => (
                    <div key={t.id} className="p-3 border rounded">
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="font-medium">{t.name}</p>
                          <p className="text-sm text-muted-foreground mt-1 font-mono bg-gray-50 p-2 rounded">{t.content}</p>
                        </div>
                        <div className="flex gap-2 ml-4">
                          <Button variant="outline" size="sm" onClick={() => setEditTemplate({ ...t })}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button variant="destructive" size="sm" onClick={() => deleteTemplate(t.id)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ========== ENVOI SMS ========== */}
        <TabsContent value="send" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Send className="h-5 w-5" />Envoyer un SMS</CardTitle>
              <CardDescription>Envoyez un SMS cible a un joueur, un tableau ou a tous les joueurs</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Target */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label>Cible</Label>
                  <Select value={sendTargetType} onValueChange={v => { setSendTargetType(v); setSendTargetId(""); setSendPlayerSearch(""); }}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="player">Joueur</SelectItem>
                      <SelectItem value="bracket">Tableau</SelectItem>
                      <SelectItem value="all">Tous les joueurs</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {sendTargetType === "player" && (
                  <div>
                    <Label>Joueur</Label>
                    <Input value={sendPlayerSearch} onChange={e => { setSendPlayerSearch(e.target.value); setSendTargetId(""); }} placeholder="Rechercher un joueur..." />
                    {filteredPlayers.length > 0 && !sendTargetId && (
                      <div className="border rounded mt-1 max-h-40 overflow-y-auto">
                        {filteredPlayers.map(p => (
                          <div key={p.id} className="p-2 hover:bg-gray-50 cursor-pointer text-sm" onClick={() => { setSendTargetId(p.id); setSendPlayerSearch(`${p.last_name} ${p.first_name}`); }}>
                            {p.last_name} {p.first_name} {p.phone ? <span className="text-green-600 ml-1">({p.phone})</span> : <span className="text-red-400 ml-1">(pas de tel)</span>}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {sendTargetType === "bracket" && (
                  <div>
                    <Label>Tableau</Label>
                    <Select value={sendTargetId} onValueChange={setSendTargetId}>
                      <SelectTrigger><SelectValue placeholder="Selectionnez un tableau" /></SelectTrigger>
                      <SelectContent>
                        {brackets.map(b => (
                          <SelectItem key={b.id} value={b.id}>{b.name} ({b.category})</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>

              {/* Message */}
              <div>
                <div className="flex gap-2 mb-2">
                  <Button variant={sendMessageType === "free" ? "default" : "outline"} size="sm" onClick={() => setSendMessageType("free")}>Texte libre</Button>
                  <Button variant={sendMessageType === "template" ? "default" : "outline"} size="sm" onClick={() => setSendMessageType("template")}>Modele</Button>
                </div>

                {sendMessageType === "template" ? (
                  <Select value={sendTemplateId} onValueChange={setSendTemplateId}>
                    <SelectTrigger><SelectValue placeholder="Selectionnez un modele" /></SelectTrigger>
                    <SelectContent>
                      {templates.filter(t => t.is_active).map(t => (
                        <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <div>
                    <Textarea value={sendMessage} onChange={e => setSendMessage(e.target.value)} placeholder="Votre message..." rows={3} />
                    <div className="flex items-center justify-between mt-1">
                      <div className="flex flex-wrap gap-1">
                        {templateVars.map(v => (
                          <button key={v.name} onClick={() => insertVariable(v.name, "send")}
                            className="px-2 py-0.5 text-xs bg-blue-100 text-blue-800 rounded hover:bg-blue-200 transition-colors">
                            {`{${v.name}}`}
                          </button>
                        ))}
                      </div>
                      <span className={`text-xs ${charCount > 160 ? 'text-orange-600' : 'text-muted-foreground'}`}>
                        {charCount} car. ({smsSegments} SMS)
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* Preview */}
              {getMessagePreview() && (
                <div className="p-3 bg-gray-50 rounded-lg">
                  <p className="text-xs font-medium text-gray-500 mb-1">Apercu :</p>
                  <p className="text-sm font-mono">{getMessagePreview()}</p>
                </div>
              )}

              {/* Sender */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label>Expediteur (optionnel)</Label>
                  <Input value={sendSender} onChange={e => setSendSender(e.target.value)} placeholder="Nom ou numero expediteur" />
                </div>
              </div>

              <Button onClick={() => setConfirmDialog(true)}
                disabled={sending || !getMessagePreview() || (sendTargetType !== "all" && !sendTargetId)}
                className="w-full md:w-auto"
              >
                {sending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Send className="h-4 w-4 mr-2" />}
                Envoyer
              </Button>

              {sendResult && (
                <div className={`p-3 rounded-lg ${sendResult.success ? 'bg-green-50' : 'bg-red-50'}`}>
                  <p className={`text-sm font-medium ${sendResult.success ? 'text-green-800' : 'text-red-800'}`}>
                    {sendResult.sent || 0} envoye(s), {sendResult.failed || 0} echoue(s) sur {sendResult.total || 0} destinataire(s)
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ========== HISTORIQUE ========== */}
        <TabsContent value="history" className="space-y-4 mt-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="pt-4 text-center">
                <p className="text-2xl font-bold">{stats.total}</p>
                <p className="text-sm text-muted-foreground">Total</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 text-center">
                <p className="text-2xl font-bold text-green-600">{stats.sent}</p>
                <p className="text-sm text-muted-foreground">Envoyes</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 text-center">
                <p className="text-2xl font-bold text-red-600">{stats.failed}</p>
                <p className="text-sm text-muted-foreground">Echoues</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 text-center">
                <p className="text-2xl font-bold text-yellow-600">{stats.pending}</p>
                <p className="text-sm text-muted-foreground">En attente</p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <CardTitle>Journal SMS</CardTitle>
                <div className="flex gap-2">
                  <Select value={logFilter || "all"} onValueChange={v => { setLogFilter(v === "all" ? "" : v); }}>
                    <SelectTrigger className="w-[150px]"><SelectValue placeholder="Tous" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Tous</SelectItem>
                      <SelectItem value="sent">Envoyes</SelectItem>
                      <SelectItem value="failed">Echoues</SelectItem>
                      <SelectItem value="pending">En attente</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button variant="outline" size="sm" onClick={fetchData}><History className="h-4 w-4" /></Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {logs.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">Aucun SMS envoye</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-2">Date</th>
                        <th className="text-left py-2">Destinataire</th>
                        <th className="text-left py-2">Message</th>
                        <th className="text-left py-2">Exp.</th>
                        <th className="text-left py-2">Statut</th>
                      </tr>
                    </thead>
                    <tbody>
                      {logs.slice(0, 50).map(log => (
                        <tr key={log.id} className="border-b hover:bg-gray-50">
                          <td className="py-2 whitespace-nowrap">{formatDate(log.created_at)}</td>
                          <td className="py-2 whitespace-nowrap">
                            <div>{log.recipient_name || log.player_name || "-"}</div>
                            <div className="text-xs text-muted-foreground">{log.recipient_phone}</div>
                          </td>
                          <td className="py-2 max-w-[200px] truncate" title={log.message}>{log.message}</td>
                          <td className="py-2 whitespace-nowrap text-xs">{log.sender || log.adapter_name || "-"}</td>
                          <td className="py-2">{statusBadge(log.status)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Edit Adapter Dialog */}
      <Dialog open={!!editAdapter} onOpenChange={open => { if (!open) { setEditAdapter(null); setEditAdapterFields([]); } }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader><DialogTitle>Modifier l'adaptateur</DialogTitle></DialogHeader>
          {editAdapter && (
            <div className="space-y-4">
              <div>
                <Label>Nom</Label>
                <Input value={editAdapter.name} onChange={e => setEditAdapter({ ...editAdapter, name: e.target.value })} />
              </div>
              <div>
                <Label>Expediteur par defaut</Label>
                <Input value={editAdapter.default_sender} onChange={e => setEditAdapter({ ...editAdapter, default_sender: e.target.value })} />
              </div>
              {editAdapterFields.length > 0 && (
                <div className="space-y-3 p-3 bg-gray-50 rounded">
                  {editAdapterFields.map(field => (
                    <div key={field.name}>
                      <Label>{field.label}</Label>
                      <Input
                        type={field.type === "password" ? "password" : "text"}
                        value={editAdapter.config[field.name] || ""}
                        onChange={e => setEditAdapter({ ...editAdapter, config: { ...editAdapter.config, [field.name]: e.target.value } })}
                        placeholder={editAdapter.config[field.name] === "***" ? "Laisser vide pour garder la valeur actuelle" : field.help_text}
                      />
                    </div>
                  ))}
                </div>
              )}
              <DialogFooter>
                <Button variant="outline" onClick={() => { setEditAdapter(null); setEditAdapterFields([]); }}>Annuler</Button>
                <Button onClick={updateAdapter}>Sauvegarder</Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Edit Template Dialog */}
      <Dialog open={!!editTemplate} onOpenChange={open => { if (!open) setEditTemplate(null); }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader><DialogTitle>Modifier le modele</DialogTitle></DialogHeader>
          {editTemplate && (
            <div className="space-y-4">
              <div>
                <Label>Nom</Label>
                <Input value={editTemplate.name} onChange={e => setEditTemplate({ ...editTemplate, name: e.target.value })} />
              </div>
              <div>
                <Label>Contenu</Label>
                <Textarea value={editTemplate.content} onChange={e => setEditTemplate({ ...editTemplate, content: e.target.value })} rows={4} />
                <div className="flex flex-wrap gap-1 mt-1">
                  {templateVars.map(v => (
                    <button key={v.name} onClick={() => insertVariable(v.name, "edit")}
                      className="px-2 py-0.5 text-xs bg-blue-100 text-blue-800 rounded hover:bg-blue-200">
                      {`{${v.name}}`}
                    </button>
                  ))}
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setEditTemplate(null)}>Annuler</Button>
                <Button onClick={updateTemplate}>Sauvegarder</Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Confirm Send Dialog */}
      <Dialog open={confirmDialog} onOpenChange={setConfirmDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>Confirmer l'envoi</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <p>Etes-vous sur de vouloir envoyer ce SMS ?</p>
            <div className="p-3 bg-gray-50 rounded text-sm">
              <p><strong>Cible :</strong> {sendTargetType === "player" ? sendPlayerSearch : sendTargetType === "bracket" ? brackets.find(b => b.id === sendTargetId)?.name || "" : "Tous les joueurs"}</p>
              <p className="mt-1"><strong>Message :</strong> {getMessagePreview().substring(0, 100)}{getMessagePreview().length > 100 ? "..." : ""}</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDialog(false)}>Annuler</Button>
            <Button onClick={handleSend} disabled={sending}>
              {sending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Send className="h-4 w-4 mr-2" />}
              Confirmer l'envoi
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
