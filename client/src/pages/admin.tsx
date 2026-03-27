import { useQuery, useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { motion } from "framer-motion";
import { useAuth } from "@/hooks/use-auth";
import { useLocation } from "wouter";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Settings, Plus, BookOpen, Layers, FileQuestion, CheckCircle2, Loader2, Shield } from "lucide-react";

export default function AdminPage() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  // Redirect non-admins
  if (user && !user.isAdmin) {
    setLocation("/dashboard");
    return null;
  }

  const { data: topics } = useQuery<any[]>({ queryKey: ["/api/topics"] });

  // Topic form
  const [topicName, setTopicName] = useState("");
  const [topicDesc, setTopicDesc] = useState("");
  const [topicColor, setTopicColor] = useState("from-violet-600 to-purple-800");

  // Level form
  const [levelName, setLevelName] = useState("");
  const [levelTopicId, setLevelTopicId] = useState("");
  const [levelGameType, setLevelGameType] = useState("wordle");
  const [levelXpReward, setLevelXpReward] = useState("50");
  const [levelCoinReward, setLevelCoinReward] = useState("10");
  const [levelDifficulty, setLevelDifficulty] = useState("easy");

  // Question form
  const [qLevelId, setQLevelId] = useState("");
  const [qContent, setQContent] = useState("");
  const [qAnswer, setQAnswer] = useState("");
  const [qHint, setQHint] = useState("");

  const [topicLevels, setTopicLevels] = useState<any[]>([]);

  const createTopicMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/topics", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/topics"] });
      toast({ title: "Topic created!", description: "New topic added to the database" });
      setTopicName(""); setTopicDesc("");
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const createLevelMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/levels", data),
    onSuccess: () => {
      toast({ title: "Level created!", description: "New level added" });
      setLevelName("");
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const createQuestionMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/questions", data),
    onSuccess: () => {
      toast({ title: "Question created!", description: "New question added" });
      setQContent(""); setQAnswer(""); setQHint("");
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

  const colors = [
    { value: "from-violet-600 to-purple-800", label: "Purple" },
    { value: "from-blue-600 to-cyan-700", label: "Blue Cyan" },
    { value: "from-emerald-600 to-teal-700", label: "Emerald" },
    { value: "from-amber-600 to-orange-700", label: "Amber" },
    { value: "from-pink-600 to-rose-700", label: "Pink Rose" },
    { value: "from-indigo-600 to-blue-800", label: "Indigo" },
  ];

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto">
      <motion.div
        className="mb-6"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-lg bg-amber-500/20 border border-amber-500/30 flex items-center justify-center">
            <Shield className="w-5 h-5 text-amber-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-wider" style={{ fontFamily: "Oxanium, sans-serif" }}>
              ADMIN <span className="text-amber-400">PANEL</span>
            </h1>
            <p className="text-sm text-muted-foreground">Manage topics, levels, and questions</p>
          </div>
        </div>
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-500/10 border border-amber-500/20 w-fit">
          <Shield className="w-3 h-3 text-amber-400" />
          <span className="text-xs text-amber-400 font-mono">Admin access granted for: {user?.username}</span>
        </div>
      </motion.div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-6">
        {[
          { icon: BookOpen, label: "Topics", value: topics?.length || 0, color: "text-violet-400" },
          { icon: Layers, label: "Total Levels", value: topics?.reduce((sum: number, t: any) => sum + (t.levels?.length || 0), 0) || "—", color: "text-cyan-400" },
          { icon: Settings, label: "Admin Mode", value: "Active", color: "text-amber-400" },
        ].map(({ icon: Icon, label, value, color }) => (
          <Card key={label} className="border-border/40">
            <CardContent className="p-4 flex items-center gap-3">
              <Icon className={`w-5 h-5 ${color}`} />
              <div>
                <div className={`text-lg font-bold font-mono ${color}`}>{value}</div>
                <div className="text-xs text-muted-foreground">{label}</div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Tabs defaultValue="topic">
        <TabsList className="bg-card/60 border border-border/40 mb-6">
          <TabsTrigger value="topic">
            <BookOpen className="w-3 h-3 mr-1" /> New Topic
          </TabsTrigger>
          <TabsTrigger value="level">
            <Layers className="w-3 h-3 mr-1" /> New Level
          </TabsTrigger>
          <TabsTrigger value="question">
            <FileQuestion className="w-3 h-3 mr-1" /> New Question
          </TabsTrigger>
          <TabsTrigger value="topics-list">
            <CheckCircle2 className="w-3 h-3 mr-1" /> View Topics
          </TabsTrigger>
        </TabsList>

        {/* Create Topic */}
        <TabsContent value="topic">
          <Card className="border-border/40">
            <CardHeader>
              <CardTitle className="text-sm font-bold tracking-widest text-muted-foreground font-mono">CREATE NEW TOPIC</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label className="text-xs tracking-widest text-muted-foreground font-mono">TOPIC NAME</Label>
                <Input
                  value={topicName}
                  onChange={e => setTopicName(e.target.value)}
                  placeholder="e.g., Machine Learning"
                  data-testid="input-topic-name"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs tracking-widest text-muted-foreground font-mono">DESCRIPTION</Label>
                <Input
                  value={topicDesc}
                  onChange={e => setTopicDesc(e.target.value)}
                  placeholder="Brief description of the topic"
                  data-testid="input-topic-desc"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs tracking-widest text-muted-foreground font-mono">COLOR THEME</Label>
                <Select value={topicColor} onValueChange={setTopicColor}>
                  <SelectTrigger data-testid="select-topic-color">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {colors.map(c => (
                      <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button
                onClick={() => createTopicMutation.mutate({ name: topicName, description: topicDesc, color: topicColor, icon: "BookOpen", orderIndex: (topics?.length || 0) })}
                disabled={!topicName || !topicDesc || createTopicMutation.isPending}
                data-testid="button-create-topic"
              >
                {createTopicMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4 mr-1" />}
                Create Topic
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Create Level */}
        <TabsContent value="level">
          <Card className="border-border/40">
            <CardHeader>
              <CardTitle className="text-sm font-bold tracking-widest text-muted-foreground font-mono">CREATE NEW LEVEL</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label className="text-xs tracking-widest text-muted-foreground font-mono">TOPIC</Label>
                <Select value={levelTopicId} onValueChange={setLevelTopicId}>
                  <SelectTrigger data-testid="select-level-topic">
                    <SelectValue placeholder="Select a topic" />
                  </SelectTrigger>
                  <SelectContent>
                    {topics?.map((t: any) => (
                      <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-xs tracking-widest text-muted-foreground font-mono">LEVEL NAME</Label>
                <Input value={levelName} onChange={e => setLevelName(e.target.value)} placeholder="e.g., Advanced Concepts" data-testid="input-level-name" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label className="text-xs tracking-widest text-muted-foreground font-mono">GAME TYPE</Label>
                  <Select value={levelGameType} onValueChange={setLevelGameType}>
                    <SelectTrigger data-testid="select-game-type">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="wordle">Word Guesser</SelectItem>
                      <SelectItem value="matcher">Definition Matcher</SelectItem>
                      <SelectItem value="emoji_cipher">Emoji Cipher</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs tracking-widest text-muted-foreground font-mono">DIFFICULTY</Label>
                  <Select value={levelDifficulty} onValueChange={setLevelDifficulty}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="easy">Easy</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="hard">Hard</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label className="text-xs tracking-widest text-muted-foreground font-mono">XP REWARD</Label>
                  <Input type="number" value={levelXpReward} onChange={e => setLevelXpReward(e.target.value)} data-testid="input-xp-reward" />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs tracking-widest text-muted-foreground font-mono">COIN REWARD</Label>
                  <Input type="number" value={levelCoinReward} onChange={e => setLevelCoinReward(e.target.value)} />
                </div>
              </div>
              <Button
                onClick={() => createLevelMutation.mutate({
                  topicId: levelTopicId,
                  name: levelName,
                  gameType: levelGameType,
                  levelNumber: 99,
                  xpReward: parseInt(levelXpReward),
                  coinReward: parseInt(levelCoinReward),
                  difficulty: levelDifficulty,
                })}
                disabled={!levelTopicId || !levelName || createLevelMutation.isPending}
                data-testid="button-create-level"
              >
                {createLevelMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4 mr-1" />}
                Create Level
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Create Question */}
        <TabsContent value="question">
          <Card className="border-border/40">
            <CardHeader>
              <CardTitle className="text-sm font-bold tracking-widest text-muted-foreground font-mono">CREATE NEW QUESTION</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label className="text-xs tracking-widest text-muted-foreground font-mono">SELECT TOPIC</Label>
                <Select onValueChange={async (topicId) => {
                  await loadLevels(topicId);
                  setQLevelId("");
                }}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select topic first" />
                  </SelectTrigger>
                  <SelectContent>
                    {topics?.map((t: any) => (
                      <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-xs tracking-widest text-muted-foreground font-mono">LEVEL</Label>
                <Select value={qLevelId} onValueChange={setQLevelId}>
                  <SelectTrigger data-testid="select-question-level">
                    <SelectValue placeholder="Select a level" />
                  </SelectTrigger>
                  <SelectContent>
                    {topicLevels.map((l: any) => (
                      <SelectItem key={l.id} value={l.id}>{l.name} ({l.gameType})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-xs tracking-widest text-muted-foreground font-mono">QUESTION CONTENT</Label>
                <Input value={qContent} onChange={e => setQContent(e.target.value)} placeholder="Question text or clue" data-testid="input-question-content" />
              </div>
              <div className="space-y-2">
                <Label className="text-xs tracking-widest text-muted-foreground font-mono">ANSWER (For wordle: 5-letter word)</Label>
                <Input value={qAnswer} onChange={e => setQAnswer(e.target.value)} placeholder="Correct answer" data-testid="input-question-answer" />
              </div>
              <div className="space-y-2">
                <Label className="text-xs tracking-widest text-muted-foreground font-mono">HINT (Optional)</Label>
                <Input value={qHint} onChange={e => setQHint(e.target.value)} placeholder="Helpful hint" />
              </div>
              <Button
                onClick={() => createQuestionMutation.mutate({
                  levelId: qLevelId,
                  content: qContent,
                  answer: qAnswer,
                  hint: qHint || null,
                  orderIndex: 0,
                })}
                disabled={!qLevelId || !qContent || !qAnswer || createQuestionMutation.isPending}
                data-testid="button-create-question"
              >
                {createQuestionMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4 mr-1" />}
                Create Question
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Topics List */}
        <TabsContent value="topics-list">
          <div className="space-y-3">
            {topics?.map((topic: any) => (
              <Card key={topic.id} className="border-border/40">
                <CardContent className="p-4 flex items-center gap-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-semibold text-sm">{topic.name}</h3>
                      <Badge variant="outline" className="text-xs">ID: {topic.id.slice(0, 8)}...</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{topic.description}</p>
                  </div>
                  <Badge variant="secondary" className="text-xs font-mono">
                    {topic.orderIndex}
                  </Badge>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
