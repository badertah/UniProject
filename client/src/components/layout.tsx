import { ReactNode, useState } from "react";
import { Link, useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/hooks/use-auth";
import { useSettings } from "@/hooks/use-settings";
import {
  LayoutDashboard, BookOpen, Trophy, ShoppingBag, User, Settings,
  LogOut, Zap, Flame, Coins, ChevronLeft, ChevronRight, Menu, Sprout, Award
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { getTierInfo, getXpToNextLevel } from "@/lib/utils";

interface LayoutProps {
  children: ReactNode;
}

export function Layout({ children }: LayoutProps) {
  const { user, logout } = useAuth();
  const { settings } = useSettings();
  const [location] = useLocation();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  if (!user) return null;

  const tierInfo = getTierInfo(user.xp);
  const xpProgress = getXpToNextLevel(user.xp);

  const navItems = [
    { path: "/dashboard", icon: LayoutDashboard, label: "Dashboard", always: true },
    { path: "/courses", icon: BookOpen, label: "Courses", always: true },
    { path: "/farm", icon: Sprout, label: "Farm", always: false, settingKey: "showFarmTab" as const },
    { path: "/leaderboard", icon: Trophy, label: "Leaderboard", always: true },
    { path: "/shop", icon: ShoppingBag, label: "Shop", always: true },
    { path: "/badges", icon: Award, label: "Badges", always: true },
    { path: "/profile", icon: User, label: "Profile", always: true },
    { path: "/settings", icon: Settings, label: "Settings", always: true },
  ];

  const visibleNavItems = navItems.filter(item =>
    item.always || (item.settingKey && settings[item.settingKey])
  );

  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="p-4 border-b border-border/40">
        <div className={`flex items-center gap-3 ${collapsed ? "justify-center" : ""}`}>
          <div className="w-9 h-9 rounded-lg bg-primary/20 border border-primary/40 flex items-center justify-center flex-shrink-0 neon-purple">
            <Zap className="w-5 h-5 text-primary" />
          </div>
          {!collapsed && (
            <div>
              <div className="font-bold tracking-wider text-sm" style={{ fontFamily: "Oxanium, sans-serif" }}>
                EDU<span className="text-primary">QUEST</span>
              </div>
              <div className="text-xs text-muted-foreground/60 tracking-widest font-mono">v2.0</div>
            </div>
          )}
        </div>
      </div>

      {/* User Stats Card */}
      {!collapsed && settings.showUserStatsCard && (
        <div className="p-3 m-3 rounded-lg bg-card/60 border border-border/40">
          <div className="flex items-center gap-2 mb-2">
            <div className={`w-8 h-8 rounded-md flex items-center justify-center text-sm font-bold ${tierInfo.bgClass}`}>
              {user.username.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{user.username}</p>
              <p className={`text-xs font-bold ${tierInfo.colorClass}`}>{user.tier}</p>
            </div>
          </div>
          {settings.showXpBar && (
            <div className="space-y-1">
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Level {user.level}</span>
                <span className="text-muted-foreground">{xpProgress.current}/{xpProgress.required} XP</span>
              </div>
              <Progress value={xpProgress.percent} className="h-1.5" />
            </div>
          )}
          <div className="flex items-center gap-3 mt-2">
            {settings.showStreak && (
              <div className="flex items-center gap-1 text-xs">
                <Flame className="w-3 h-3 text-orange-400" />
                <span className="text-muted-foreground">{user.streak}d</span>
              </div>
            )}
            {settings.showEduCoins && (
              <div className="flex items-center gap-1 text-xs">
                <Coins className="w-3 h-3 text-yellow-400" />
                <span className="text-muted-foreground">{user.eduCoins}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Nav Items */}
      <nav className="flex-1 px-2 py-2 space-y-1">
        {visibleNavItems.map(({ path, icon: Icon, label }) => {
          const active = location === path || (path !== "/dashboard" && location.startsWith(path));
          const isFarm = path === "/farm";
          const activeClass = isFarm
            ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
            : "bg-primary/15 text-primary border border-primary/30";
          return (
            <Link key={path} href={path}>
              <div
                data-testid={`nav-${label.toLowerCase()}`}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer transition-all duration-200 group ${
                  active
                    ? activeClass
                    : "text-muted-foreground border border-transparent"
                } ${collapsed ? "justify-center" : ""}`}
                onClick={() => setMobileOpen(false)}
              >
                <Icon className={`w-4 h-4 flex-shrink-0 transition-colors ${
                  active
                    ? isFarm ? "text-emerald-400" : "text-primary"
                    : "group-hover:text-foreground"
                }`} />
                {!collapsed && (
                  <span className={`text-sm font-medium transition-colors ${
                    active
                      ? isFarm ? "text-emerald-400" : "text-primary"
                      : "group-hover:text-foreground"
                  }`}>
                    {label}
                  </span>
                )}
                {active && !collapsed && (
                  <div className={`ml-auto w-1.5 h-1.5 rounded-full ${isFarm ? "bg-emerald-400" : "bg-primary"}`} />
                )}
              </div>
            </Link>
          );
        })}

        {user.isAdmin && (
          <Link href="/admin">
            <div
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer transition-all duration-200 group ${
                location === "/admin"
                  ? "bg-amber-500/15 text-amber-400 border border-amber-500/30"
                  : "text-muted-foreground border border-transparent"
              } ${collapsed ? "justify-center" : ""}`}
              onClick={() => setMobileOpen(false)}
            >
              <Settings className={`w-4 h-4 flex-shrink-0 ${location === "/admin" ? "text-amber-400" : "group-hover:text-foreground"}`} />
              {!collapsed && <span className="text-sm font-medium group-hover:text-foreground">Admin</span>}
            </div>
          </Link>
        )}
      </nav>

      {/* Logout */}
      <div className="p-3 border-t border-border/40">
        <button
          onClick={logout}
          data-testid="button-logout"
          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-muted-foreground transition-all duration-200 group ${collapsed ? "justify-center" : ""}`}
        >
          <LogOut className="w-4 h-4 flex-shrink-0 group-hover:text-destructive transition-colors" />
          {!collapsed && <span className="text-sm font-medium group-hover:text-destructive transition-colors">Logout</span>}
        </button>
      </div>
    </div>
  );

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Desktop Sidebar */}
      <motion.aside
        className="hidden md:flex flex-col bg-sidebar border-r border-sidebar-border flex-shrink-0"
        animate={{ width: collapsed ? 64 : 240 }}
        transition={{ duration: 0.2, ease: "easeInOut" }}
      >
        <SidebarContent />
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="absolute left-full top-1/2 -translate-y-1/2 w-5 h-10 bg-sidebar border border-sidebar-border rounded-r-md flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors z-10"
          style={{ marginLeft: -1 }}
        >
          {collapsed ? <ChevronRight className="w-3 h-3" /> : <ChevronLeft className="w-3 h-3" />}
        </button>
      </motion.aside>

      {/* Mobile Overlay */}
      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div
              className="md:hidden fixed inset-0 bg-black/60 z-40"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setMobileOpen(false)}
            />
            <motion.aside
              className="md:hidden fixed left-0 top-0 bottom-0 w-64 bg-sidebar border-r border-sidebar-border z-50 flex flex-col"
              initial={{ x: -240 }}
              animate={{ x: 0 }}
              exit={{ x: -240 }}
              transition={{ duration: 0.2 }}
            >
              <SidebarContent />
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Mobile Header */}
        <div className="md:hidden flex items-center gap-3 px-4 py-3 bg-sidebar border-b border-border/40">
          <Button size="icon" variant="ghost" onClick={() => setMobileOpen(true)}>
            <Menu className="w-5 h-5" />
          </Button>
          <div className="flex items-center gap-2 flex-1">
            <Zap className="w-4 h-4 text-primary" />
            <span className="font-bold tracking-wider text-sm" style={{ fontFamily: "Oxanium, sans-serif" }}>
              EDU<span className="text-primary">QUEST</span>
            </span>
          </div>
          <div className="flex items-center gap-2 text-xs">
            {settings.showStreak && (
              <>
                <Flame className="w-3 h-3 text-orange-400" />
                <span className="text-muted-foreground">{user.streak}</span>
              </>
            )}
            {settings.showEduCoins && (
              <>
                <Coins className="w-3 h-3 text-yellow-400" />
                <span className="text-muted-foreground">{user.eduCoins}</span>
              </>
            )}
          </div>
        </div>

        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
