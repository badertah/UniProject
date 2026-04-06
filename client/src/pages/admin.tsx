import { useQuery, useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/hooks/use-auth";
import { useLocation } from "wouter";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
  Settings, Plus, BookOpen, Layers, FileQuestion, Shield, Edit3, Trash2,
  ChevronRight, ChevronDown, Loader2, Users, Award, Eye, X, Check, AlertTriangle
} from "lucide-react";

const GAME_TYPE_LABELS: Record<string, string> = {
  wordle: "Word Guesser",
  matcher: "Definition Matcher",
  term_matcher: "Term Matcher",
  emoji_cipher: "Emoji Cipher",
  speed_blitz: "Speed Blitz",
  bubble_pop: "Bubble Pop",
  memory_flip: "Memory Flip",
};

const GAME_TYPE_COLORS: Record<string, string> = {
  wordle: "bg-violet-500/20 text-violet-400 border-violet-500/30",
  matcher: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  term_matcher: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  emoji_cipher: "bg-amber-500/20 text-amber-400 border-amber-500/30",
  speed_blitz: "bg-red-500/20 text-red-400 border-red-500/30",
  bubble_pop: "bg-cyan-500/20 text-cyan-400 border-cyan-500/30",
  memory_flip: "bg-purple-500/20 text-purple-400 border-purple-500/30",
};

function GameTypeHint({ gameType }: { gameType: string }) {
  const hints: Record<string, string> = {
    wordle: "Content = clue/hint text | Answer = 5-letter word | Hint = optional hint",
    matcher: "Content = definition | Answer = term/word to match",
    term_matcher: "Content = definition | Answer = term/word to match",
    emoji_cipher: "Content = emoji sequence (e.g. 🐍🐍🐍) | Answer = the word it represents",
    speed_blitz: "Content = question text | Answer = correct answer | Options = {choices:['wrong1','wrong2','wrong3']}",
    bubble_pop: "Content = definition | Answer = correct term | Options = {choices:['wrong1','wrong2','wrong3']}",
    memory_flip: "Content = front card (term) | Answer = back card (definition)",
  };
  return hints[gameType] ? (
    <p className="text-xs text-muted-foreground/70 italic mt-1">{hints[gameType]}</p>
  ) : null;
}

function QuestionEditor({ question, gameType, onSave, onCancel }: {
  question: any; gameType: string;
  onSave: (data: any) => void; onCancel: () => void;
}) {
  const [content, setContent] = useState(question.content);
  const [answer, setAnswer] = useState(question.answer);
  const [hint, setHint] = useState(question.hint || "");
  const [optionsStr, setOptionsStr] = useState(
    question.options ? JSON.stringify(question.options, null, 2) : ""
  );
  const [optErr, setOptErr] = useState("");

  const needsOptions = ["speed_blitz", "bubble_pop", "emoji_cipher"].includes(gameType);

  function handleSave() {
    let options = null;
    if (optionsStr.trim()) {
      try { options = JSON.parse(optionsStr); setOptErr(""); }
      catch { setOptErr("Invalid JSON in options"); return; }
    }
    onSave({ content, answer, hint: hint || null, options });
  }

  return (
    <div className="space-y-3 p-3 bg-muted/20 rounded-lg border border-border/40">
      <div className="space-y-1">
        <Label className="text-xs font-mono text-muted-foreground">CONTENT / CLUE</Label>
        <Textarea
          value={content}
          onChange={e => setContent(e.target.value)}
          rows={2}
          className="text-sm resize-none"
        />
      </div>
      <div className="space-y-1">
        <Label className="text-xs font-mono text-muted-foreground">ANSWER</Label>
        <Input value={answer} onChange={e => setAnswer(e.target.value)} className="text-sm" />
      </div>
      <div className="space-y-1">
        <Label className="text-xs font-mono text-muted-foreground">HINT (optional)</Label>
        <Input value={hint} onChange={e => setHint(e.target.value)} className="text-sm" placeholder="Optional hint for players" />
      </div>
      {needsOptions && (
        <div className="space-y-1">
          <Label className="text-xs font-mono text-muted-foreground">OPTIONS (JSON)</Label>
          <Textarea
            value={optionsStr}
            onChange={e => { setOptionsStr(e.target.value); setOptErr(""); }}
            rows={3}
            className="text-xs font-mono resize-none"
            placeholder={'{"choices": ["wrong1","wrong2","wrong3"]}'}
          />
          {optErr && <p className="text-xs text-destructive">{optErr}</p>}
        </div>
      )}
      <GameTypeHint gameType={gameType} />
      <div className="flex gap-2">
        <Button size="sm" onClick={handleSave} className="h-7 text-xs">
          <Check className="w-3 h-3 mr-1" /> Save
        </Button>
        <Button size="sm" variant="ghost" onClick={onCancel} className="h-7 text-xs">Cancel</Button>
      </div>
    </div>
  );
}

function AddQuestionForm({ levelId, gameType, onAdded }: { levelId: string; gameType: string; onAdded: () => void }) {
  const { toast } = useToast();
  const [content, setContent] = useState("");
  const [answer, setAnswer] = useState("");
  const [hint, setHint] = useState("");
  const [optionsStr, setOptionsStr] = useState("");
  const [optErr, setOptErr] = useState("");

  const needsOptions = ["speed_blitz", "bubble_pop", "emoji_cipher"].includes(gameType);

  const addMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/questions", data),
    onSuccess: () => {
      toast({ title: "Question added!" });
      setContent(""); setAnswer(""); setHint(""); setOptionsStr("");
      onAdded();
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  function handleAdd() {
    let options = null;
    if (optionsStr.trim()) {
      try { options = JSON.parse(optionsStr); setOptErr(""); }
      catch { setOptErr("Invalid JSON"); return; }
    }
    addMutation.mutate({ levelId, content, answer, hint: hint || null, options, orderIndex: 0 });
  }

  return (
    <div className="p-3 bg-primary/5 border border-primary/20 rounded-lg mt-3">
      <p className="text-xs font-bold text-primary mb-2 font-mono">+ ADD NEW QUESTION</p>
      <div className="space-y-2">
        <Textarea value={content} onChange={e => setContent(e.target.value)} placeholder="Content / clue" rows={2} className="text-sm resize-none" />
        <Input value={answer} onChange={e => setAnswer(e.target.value)} placeholder="Answer" className="text-sm" />
        <Input value={hint} onChange={e => setHint(e.target.value)} placeholder="Hint (optional)" className="text-sm" />
        {needsOptions && (
          <>
            <Textarea
              value={optionsStr}
              onChange={e => { setOptionsStr(e.target.value); setOptErr(""); }}
              placeholder={'{"choices": ["wrong1","wrong2","wrong3"]}'}
              rows={2}
              className="text-xs font-mono resize-none"
            />
            {optErr && <p className="text-xs text-destructive">{optErr}</p>}
          </>
        )}
        <GameTypeHint gameType={gameType} />
        <Button
          size="sm"
          className="h-7 text-xs"
          onClick={handleAdd}
          disabled={!content || !answer || addMutation.isPending}
        >
          {addMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3 mr-1" />}
          Add Question
        </Button>
      </div>
    </div>
  );
}

export default function AdminPage() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  if (user && !user.isAdmin) {
    setLocation("/dashboard");
    return null;
  }

  const { data: topics } = useQuery<any[]>({ queryKey: ["/api/topics"] });
  const { data: allUsers } = useQuery<any[]>({ queryKey: ["/api/admin/users"] });
  const { data: badges } = useQuery<any[]>({ queryKey: ["/api/badges"] });

  // Content browser state
  const [selectedTopic, setSelectedTopic] = useState<any>(null);
  const [selectedLevel, setSelectedLevel] = useState<any>(null);
  const [editingQuestion, setEditingQuestion] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [editingLevel, setEditingLevel] = useState<any>(null);

  const { data: levelQuestions, refetch: refetchQuestions } = useQuery<any[]>({
    queryKey: ["/api/levels", selectedLevel?.id, "questions"],
    queryFn: () => fetch(`/api/levels/${selectedLevel.id}/questions`, {
      headers: { Authorization: `Bearer ${localStorage.getItem("eduquest_token")}` }
    }).then(r => r.json()),
    enabled: !!selectedLevel,
  });

  // Create topic form
  const [topicName, setTopicName] = useState("");
  const [topicDesc, setTopicDesc] = useState("");
  const [topicColor, setTopicColor] = useState("from-violet-600 to-purple-800");

  // Create level form
  const [levelName, setLevelName] = useState("");
  const [levelTopicId, setLevelTopicId] = useState("");
  const [levelGameType, setLevelGameType] = useState("wordle");
  const [levelXpReward, setLevelXpReward] = useState("50");
  const [levelCoinReward, setLevelCoinReward] = useState("10");
  const [levelDifficulty, setLevelDifficulty] = useState("easy");
  const [topicLevels, setTopicLevels] = useState<any[]>([]);

  // Mutations
  const createTopicMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/topics", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/topics"] });
      toast({ title: "Topic created!" });
      setTopicName(""); setTopicDesc("");
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const createLevelMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/levels", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/topics"] });
      toast({ title: "Level created!" });
      setLevelName("");
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const updateQuestionMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => apiRequest("PUT", `/api/questions/${id}`, data),
    onSuccess: () => {
      refetchQuestions();
      setEditingQuestion(null);
      toast({ title: "Question updated!" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const deleteQuestionMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/questions/${id}`),
    onSuccess: () => {
      refetchQuestions();
      setDeletingId(null);
      toast({ title: "Question deleted" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const updateLevelMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => apiRequest("PUT", `/api/levels/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/topics"] });
      setEditingLevel(null);
      if (selectedLevel) setSelectedLevel({ ...selectedLevel, ...editingLevel });
      toast({ title: "Level updated!" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const updateUserMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => apiRequest("PUT", `/api/admin/users/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      toast({ title: "User updated!" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  async function loadLevels(topicId: string) {
    try {
      const res = await fetch(`/api/topics/${topicId}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem("eduquest_token")}` }
      });
      const data = await res.json();
      setTopicLevels(data.levels || []);
    } catch {}
  }

  const totalLevels = topics?.reduce((s: number, t: any) => s + (t.levels?.length || t.levelCount || 0), 0) || 0;
  const totalQuestions = "—";

  const colors = [
    { value: "from-violet-600 to-purple-800", label: "Purple" },
    { value: "from-blue-600 to-cyan-700", label: "Blue Cyan" },
    { value: "from-emerald-600 to-teal-700", label: "Emerald" },
    { value: "from-amber-600 to-orange-700", label: "Amber" },
    { value: "from-pink-600 to-rose-700", label: "Pink Rose" },
    { value: "from-indigo-600 to-blue-800", label: "Indigo" },
  ];

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto">
      <motion.div className="mb-6" initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }}>
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-lg bg-amber-500/20 border border-amber-500/30 flex items-center justify-center">
            <Shield className="w-5 h-5 text-amber-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-wider" style={{ fontFamily: "Oxanium, sans-serif" }}>
              ADMIN <span className="text-amber-400">PANEL</span>
            </h1>
            <p className="text-sm text-muted-foreground">Full control over content, users, and questions</p>
          </div>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/20 w-fit">
          <Shield className="w-3 h-3 text-amber-400" />
          <span className="text-xs text-amber-400 font-mono">Logged in as: {user?.username}</span>
        </div>
      </motion.div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        {[
          { icon: BookOpen, label: "Topics", value: topics?.length || 0, color: "text-violet-400", bg: "bg-violet-500/10" },
          { icon: Layers, label: "Total Levels", value: totalLevels, color: "text-cyan-400", bg: "bg-cyan-500/10" },
          { icon: Users, label: "Users", value: allUsers?.length || "—", color: "text-emerald-400", bg: "bg-emerald-500/10" },
          { icon: Award, label: "Badges", value: badges?.length || "—", color: "text-yellow-400", bg: "bg-yellow-500/10" },
        ].map(({ icon: Icon, label, value, color, bg }) => (
          <Card key={label} className="border-border/40">
            <CardContent className={`p-4 flex items-center gap-3 ${bg} rounded-xl`}>
              <Icon className={`w-5 h-5 ${color}`} />
              <div>
                <div className={`text-xl font-bold font-mono ${color}`}>{value}</div>
                <div className="text-xs text-muted-foreground">{label}</div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Tabs defaultValue="content">
        <TabsList className="bg-card/60 border border-border/40 mb-6 flex-wrap h-auto gap-1 p-1">
          <TabsTrigger value="content" className="text-xs">
            <Eye className="w-3 h-3 mr-1" /> Question Editor
          </TabsTrigger>
          <TabsTrigger value="create" className="text-xs">
            <Plus className="w-3 h-3 mr-1" /> Create Content
          </TabsTrigger>
          <TabsTrigger value="users" className="text-xs">
            <Users className="w-3 h-3 mr-1" /> Users
          </TabsTrigger>
          <TabsTrigger value="badges-tab" className="text-xs">
            <Award className="w-3 h-3 mr-1" /> Badges
          </TabsTrigger>
        </TabsList>

        {/* ═══════════════════════ QUESTION EDITOR ═══════════════════════ */}
        <TabsContent value="content">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Left: Topics + Levels */}
            <div className="space-y-3">
              <div>
                <p className="text-xs font-bold tracking-widest text-muted-foreground font-mono mb-2">SELECT TOPIC</p>
                {topics?.map((topic: any) => (
                  <div
                    key={topic.id}
                    onClick={() => { setSelectedTopic(topic); setSelectedLevel(null); }}
                    className={`flex items-center justify-between px-3 py-2.5 rounded-lg cursor-pointer mb-1 transition-all ${
                      selectedTopic?.id === topic.id
                        ? "bg-primary/10 border border-primary/30 text-primary"
                        : "bg-card/60 border border-border/30 hover:border-primary/20 text-muted-foreground"
                    }`}
                  >
                    <span className="text-sm font-medium truncate">{topic.name}</span>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <span className="text-xs font-mono">{topic.levelCount || topic.levels?.length || 0}L</span>
                      <ChevronRight className="w-3 h-3" />
                    </div>
                  </div>
                ))}
              </div>

              {selectedTopic && (
                <div>
                  <p className="text-xs font-bold tracking-widest text-muted-foreground font-mono mb-2">SELECT LEVEL</p>
                  {(selectedTopic.levels || []).map((level: any) => (
                    <div
                      key={level.id}
                      onClick={() => setSelectedLevel(level)}
                      className={`flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer mb-1 transition-all ${
                        selectedLevel?.id === level.id
                          ? "bg-primary/10 border border-primary/30"
                          : "bg-card/40 border border-border/20 hover:border-primary/20 text-muted-foreground"
                      }`}
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium truncate">{level.name}</p>
                        <Badge variant="outline" className={`text-xs px-1 py-0 h-4 mt-0.5 border ${GAME_TYPE_COLORS[level.gameType] || ""}`}>
                          {GAME_TYPE_LABELS[level.gameType] || level.gameType}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Right: Questions */}
            <div className="lg:col-span-2">
              {!selectedLevel ? (
                <div className="flex flex-col items-center justify-center h-64 text-center">
                  <FileQuestion className="w-12 h-12 text-muted-foreground/30 mb-3" />
                  <p className="text-sm font-medium text-muted-foreground">Select a topic and level</p>
                  <p className="text-xs text-muted-foreground/60 mt-1">to view and edit questions</p>
                </div>
              ) : (
                <div>
                  {/* Level header */}
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <h3 className="font-bold text-sm" style={{ fontFamily: "Oxanium, sans-serif" }}>
                        {selectedLevel.name}
                      </h3>
                      <div className="flex items-center gap-2 mt-0.5">
                        <Badge variant="outline" className={`text-xs h-4 border ${GAME_TYPE_COLORS[selectedLevel.gameType] || ""}`}>
                          {GAME_TYPE_LABELS[selectedLevel.gameType] || selectedLevel.gameType}
                        </Badge>
                        <span className="text-xs text-muted-foreground">{selectedLevel.difficulty} · {selectedLevel.xpReward}XP</span>
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs"
                      onClick={() => setEditingLevel({ name: selectedLevel.name, xpReward: selectedLevel.xpReward, coinReward: selectedLevel.coinReward, difficulty: selectedLevel.difficulty })}
                    >
                      <Edit3 className="w-3 h-3 mr-1" /> Edit Level
                    </Button>
                  </div>

                  {/* Level edit form */}
                  <AnimatePresence>
                    {editingLevel && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        className="mb-3 p-3 bg-amber-500/5 border border-amber-500/20 rounded-lg space-y-2"
                      >
                        <p className="text-xs font-bold text-amber-400 font-mono">EDIT LEVEL</p>
                        <Input
                          value={editingLevel.name}
                          onChange={e => setEditingLevel({ ...editingLevel, name: e.target.value })}
                          placeholder="Level name"
                          className="text-sm"
                        />
                        <div className="grid grid-cols-3 gap-2">
                          <div>
                            <Label className="text-xs text-muted-foreground">XP Reward</Label>
                            <Input
                              type="number"
                              value={editingLevel.xpReward}
                              onChange={e => setEditingLevel({ ...editingLevel, xpReward: parseInt(e.target.value) })}
                              className="text-sm"
                            />
                          </div>
                          <div>
                            <Label className="text-xs text-muted-foreground">Coin Reward</Label>
                            <Input
                              type="number"
                              value={editingLevel.coinReward}
                              onChange={e => setEditingLevel({ ...editingLevel, coinReward: parseInt(e.target.value) })}
                              className="text-sm"
                            />
                          </div>
                          <div>
                            <Label className="text-xs text-muted-foreground">Difficulty</Label>
                            <Select value={editingLevel.difficulty} onValueChange={v => setEditingLevel({ ...editingLevel, difficulty: v })}>
                              <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="easy">Easy</SelectItem>
                                <SelectItem value="medium">Medium</SelectItem>
                                <SelectItem value="hard">Hard</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            className="h-7 text-xs"
                            onClick={() => updateLevelMutation.mutate({ id: selectedLevel.id, data: editingLevel })}
                            disabled={updateLevelMutation.isPending}
                          >
                            {updateLevelMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3 mr-1" />}
                            Save Level
                          </Button>
                          <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setEditingLevel(null)}>Cancel</Button>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Questions list */}
                  <div className="space-y-2">
                    {levelQuestions?.map((q: any, i: number) => (
                      <div key={q.id} className="border border-border/30 rounded-lg overflow-hidden" data-testid={`question-card-${q.id}`}>
                        {editingQuestion === q.id ? (
                          <div className="p-2">
                            <QuestionEditor
                              question={q}
                              gameType={selectedLevel.gameType}
                              onSave={(data) => updateQuestionMutation.mutate({ id: q.id, data })}
                              onCancel={() => setEditingQuestion(null)}
                            />
                          </div>
                        ) : (
                          <div className="flex items-start gap-2 p-3">
                            <div className="w-5 h-5 rounded bg-muted/40 flex items-center justify-center flex-shrink-0 mt-0.5">
                              <span className="text-xs font-mono text-muted-foreground">{i + 1}</span>
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-medium text-foreground line-clamp-2">{q.content}</p>
                              <p className="text-xs text-primary font-mono mt-0.5">→ {q.answer}</p>
                              {q.hint && <p className="text-xs text-muted-foreground/60 mt-0.5 italic">💡 {q.hint}</p>}
                              {q.options && (
                                <p className="text-xs text-muted-foreground/50 mt-0.5 font-mono truncate">
                                  opts: {JSON.stringify(q.options).slice(0, 50)}...
                                </p>
                              )}
                            </div>
                            <div className="flex items-center gap-1 flex-shrink-0">
                              <button
                                onClick={() => setEditingQuestion(q.id)}
                                className="w-6 h-6 rounded flex items-center justify-center text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
                                data-testid={`button-edit-question-${q.id}`}
                              >
                                <Edit3 className="w-3 h-3" />
                              </button>
                              {deletingId === q.id ? (
                                <div className="flex items-center gap-1">
                                  <button
                                    onClick={() => deleteQuestionMutation.mutate(q.id)}
                                    className="w-6 h-6 rounded flex items-center justify-center text-destructive hover:bg-destructive/10 transition-colors"
                                  >
                                    {deleteQuestionMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                                  </button>
                                  <button
                                    onClick={() => setDeletingId(null)}
                                    className="w-6 h-6 rounded flex items-center justify-center text-muted-foreground hover:bg-muted transition-colors"
                                  >
                                    <X className="w-3 h-3" />
                                  </button>
                                </div>
                              ) : (
                                <button
                                  onClick={() => setDeletingId(q.id)}
                                  className="w-6 h-6 rounded flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                                  data-testid={`button-delete-question-${q.id}`}
                                >
                                  <Trash2 className="w-3 h-3" />
                                </button>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    ))}

                    {levelQuestions?.length === 0 && (
                      <div className="text-center py-8 text-muted-foreground/60">
                        <FileQuestion className="w-8 h-8 mx-auto mb-2 opacity-40" />
                        <p className="text-xs">No questions yet — add the first one below</p>
                      </div>
                    )}
                  </div>

                  <AddQuestionForm
                    levelId={selectedLevel.id}
                    gameType={selectedLevel.gameType}
                    onAdded={() => refetchQuestions()}
                  />
                </div>
              )}
            </div>
          </div>
        </TabsContent>

        {/* ═══════════════════════ CREATE CONTENT ═══════════════════════ */}
        <TabsContent value="create">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* New Topic */}
            <Card className="border-border/40">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-bold tracking-widest text-muted-foreground font-mono flex items-center gap-2">
                  <BookOpen className="w-4 h-4" /> CREATE TOPIC
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Input value={topicName} onChange={e => setTopicName(e.target.value)} placeholder="Topic name" data-testid="input-topic-name" />
                <Input value={topicDesc} onChange={e => setTopicDesc(e.target.value)} placeholder="Brief description" data-testid="input-topic-desc" />
                <Select value={topicColor} onValueChange={setTopicColor}>
                  <SelectTrigger data-testid="select-topic-color"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {colors.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Button
                  onClick={() => createTopicMutation.mutate({ name: topicName, description: topicDesc, color: topicColor, icon: "BookOpen", orderIndex: topics?.length || 0 })}
                  disabled={!topicName || !topicDesc || createTopicMutation.isPending}
                  className="w-full"
                  data-testid="button-create-topic"
                >
                  {createTopicMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Plus className="w-4 h-4 mr-2" />}
                  Create Topic
                </Button>
              </CardContent>
            </Card>

            {/* New Level */}
            <Card className="border-border/40">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-bold tracking-widest text-muted-foreground font-mono flex items-center gap-2">
                  <Layers className="w-4 h-4" /> CREATE LEVEL
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Select value={levelTopicId} onValueChange={setLevelTopicId}>
                  <SelectTrigger data-testid="select-level-topic"><SelectValue placeholder="Select topic" /></SelectTrigger>
                  <SelectContent>
                    {topics?.map((t: any) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Input value={levelName} onChange={e => setLevelName(e.target.value)} placeholder="Level name" data-testid="input-level-name" />
                <Select value={levelGameType} onValueChange={setLevelGameType}>
                  <SelectTrigger data-testid="select-game-type"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="wordle">Word Guesser</SelectItem>
                    <SelectItem value="matcher">Definition Matcher</SelectItem>
                    <SelectItem value="emoji_cipher">Emoji Cipher</SelectItem>
                    <SelectItem value="speed_blitz">Speed Blitz</SelectItem>
                    <SelectItem value="bubble_pop">Bubble Pop</SelectItem>
                    <SelectItem value="memory_flip">Memory Flip</SelectItem>
                  </SelectContent>
                </Select>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <Label className="text-xs text-muted-foreground">XP</Label>
                    <Input type="number" value={levelXpReward} onChange={e => setLevelXpReward(e.target.value)} data-testid="input-xp-reward" />
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Coins</Label>
                    <Input type="number" value={levelCoinReward} onChange={e => setLevelCoinReward(e.target.value)} />
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Difficulty</Label>
                    <Select value={levelDifficulty} onValueChange={setLevelDifficulty}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="easy">Easy</SelectItem>
                        <SelectItem value="medium">Medium</SelectItem>
                        <SelectItem value="hard">Hard</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <Button
                  onClick={() => createLevelMutation.mutate({ topicId: levelTopicId, name: levelName, gameType: levelGameType, levelNumber: 99, xpReward: parseInt(levelXpReward), coinReward: parseInt(levelCoinReward), difficulty: levelDifficulty })}
                  disabled={!levelTopicId || !levelName || createLevelMutation.isPending}
                  className="w-full"
                  data-testid="button-create-level"
                >
                  {createLevelMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Plus className="w-4 h-4 mr-2" />}
                  Create Level
                </Button>
              </CardContent>
            </Card>
          </div>

          {/* Topics overview */}
          <div className="mt-4">
            <p className="text-xs font-bold tracking-widest text-muted-foreground font-mono mb-3">ALL TOPICS</p>
            <div className="space-y-2">
              {topics?.map((topic: any) => (
                <Card key={topic.id} className="border-border/40">
                  <CardContent className="p-3 flex items-center gap-3">
                    <div className={`w-3 h-12 rounded-full bg-gradient-to-b ${topic.color} flex-shrink-0`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold">{topic.name}</p>
                      <p className="text-xs text-muted-foreground line-clamp-1">{topic.description}</p>
                    </div>
                    <Badge variant="outline" className="text-xs font-mono">{topic.levelCount || topic.levels?.length || 0} levels</Badge>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </TabsContent>

        {/* ═══════════════════════ USERS ═══════════════════════ */}
        <TabsContent value="users">
          <div className="space-y-2">
            {allUsers?.map((u: any) => (
              <Card key={u.id} className="border-border/40">
                <CardContent className="p-3 flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-primary/20 flex items-center justify-center text-sm font-bold flex-shrink-0">
                    {u.username.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-semibold">{u.username}</p>
                      {u.isAdmin && <Badge className="text-xs h-4 bg-amber-500/20 text-amber-400 border-amber-500/30">Admin</Badge>}
                      <span className="text-xs text-muted-foreground font-mono">{u.tier}</span>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                      <span>{u.xp} XP</span>
                      <span>{u.eduCoins} coins</span>
                      <span>{u.streak}d streak</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-6 text-xs px-2"
                      onClick={() => {
                        const coins = prompt(`Set EduCoins for ${u.username}:`, u.eduCoins);
                        if (coins !== null && !isNaN(Number(coins))) {
                          updateUserMutation.mutate({ id: u.id, data: { eduCoins: Number(coins) } });
                        }
                      }}
                    >
                      Edit
                    </Button>
                    {!u.isAdmin && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-6 text-xs px-2 border-amber-500/30 text-amber-400 hover:bg-amber-500/10"
                        onClick={() => {
                          if (confirm(`Make ${u.username} an admin?`)) {
                            updateUserMutation.mutate({ id: u.id, data: { isAdmin: true } });
                          }
                        }}
                      >
                        Promote
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* ═══════════════════════ BADGES ═══════════════════════ */}
        <TabsContent value="badges-tab">
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {badges?.map((badge: any) => (
              <Card key={badge.id} className="border-border/40">
                <CardContent className="p-3 flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-xl bg-gradient-to-br ${badge.color} flex-shrink-0`}>
                    {badge.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold truncate">{badge.name}</p>
                    <p className="text-xs text-muted-foreground capitalize">{badge.rarity}</p>
                    <p className="text-xs text-muted-foreground/60 truncate">{badge.requirementType.replace(/_/g, " ")}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
