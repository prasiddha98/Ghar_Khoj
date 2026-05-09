import { Link, useLocation } from "wouter";
import { Home, Search, MessageSquare, User, PlusCircle, ShieldCheck, Building, ChevronDown, LogOut, LogIn, UserPlus, Heart, FileText } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth, logout, isRealUserLoggedIn } from "@/hooks/use-auth";
import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useState } from "react";

interface LayoutProps {
  children: React.ReactNode;
}

export function Layout({ children }: LayoutProps) {
  const [location] = useLocation();
  const { user, isAdmin, isOwner, userId } = useAuth();
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showWelcomeNote, setShowWelcomeNote] = useState(false);
  const loggedIn = isRealUserLoggedIn();

  useEffect(() => {
    if (!loggedIn || !userId || !user?.firstName) {
      setShowWelcomeNote(false);
      return;
    }

    const welcomeKey = `ghar_khoj_welcome_shown_${userId}`;
    const alreadyShown = localStorage.getItem(welcomeKey);
    if (alreadyShown) {
      setShowWelcomeNote(false);
      return;
    }

    setShowWelcomeNote(true);
    localStorage.setItem(welcomeKey, "1");

    const timeout = window.setTimeout(() => setShowWelcomeNote(false), 5000);
    return () => window.clearTimeout(timeout);
  }, [loggedIn, userId, user?.firstName]);

  const isActive = (href: string) => location === href || (href !== "/" && location.startsWith(href));

  return (
    <div className="min-h-screen bg-muted/30 pb-20 md:pb-0 flex flex-col">
      {/* Desktop Header */}
      <header className="hidden md:flex h-16 items-center px-6 lg:px-10 bg-white border-b sticky top-0 z-50 shadow-sm">
        <Link href="/" className="flex items-center gap-2.5 mr-10 group flex-shrink-0">
          <img
            src="/images/chatgpt.png"
            alt="logo"
            className="w-9 h-9 rounded-xl object-cover shadow-md group-hover:scale-105 transition-transform"
          />
        </Link>

        <nav className="flex items-center gap-1 flex-1">
          <Link href="/" className={cn(
            "text-sm font-medium px-4 py-2 rounded-xl transition-all",
            location === "/" ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted hover:text-foreground"
          )}>Home</Link>
          <Link href="/search" className={cn(
            "text-sm font-medium px-4 py-2 rounded-xl transition-all",
            isActive("/search") ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted hover:text-foreground"
          )}>Search Rooms</Link>
          {isOwner && (
            <Link href="/my-listings" className={cn(
              "text-sm font-medium px-4 py-2 rounded-xl transition-all",
              isActive("/my-listings") ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted hover:text-foreground"
            )}>My Listings</Link>
          )}
          {isAdmin && (
            <Link href="/admin" className={cn(
              "text-sm font-medium px-4 py-2 rounded-xl transition-all",
              isActive("/admin") ? "bg-secondary/10 text-secondary" : "text-secondary hover:bg-secondary/10"
            )}>⚙️ Admin</Link>
          )}
        </nav>

        <div className="flex items-center gap-3">
          {/* Post Room — owners only */}
          {loggedIn && isOwner && (
            <Link href="/post" className="flex items-center gap-2 bg-primary text-white hover:bg-primary/90 px-4 py-2 rounded-xl font-semibold transition-all shadow-md shadow-primary/20 text-sm">
              <PlusCircle size={16} /> Post Room
            </Link>
          )}

          {/* Auth buttons — unauthenticated */}
          {!loggedIn && (
            <div className="flex items-center gap-1">
              <Link href="/login" className="flex items-center gap-1.5 text-sm font-semibold text-muted-foreground hover:text-foreground px-3 py-2 rounded-xl hover:bg-muted transition-colors">
                <LogIn size={15} /> Sign In
              </Link>
              <Link href="/register" className="flex items-center gap-1.5 text-sm font-semibold bg-primary text-white hover:bg-primary/90 px-4 py-2 rounded-xl transition-all shadow-sm shadow-primary/20">
                <UserPlus size={15} /> Register
              </Link>
            </div>
          )}

          {/* User menu — authenticated */}
          {loggedIn && (
            <div className="relative">
              <button
                onClick={() => setShowUserMenu(!showUserMenu)}
                className="flex items-center gap-2.5 pl-3 border-l border-border hover:bg-muted rounded-xl px-3 py-2 transition-colors"
              >
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-white text-sm font-bold shadow-sm">
                  {user?.firstName?.[0] || "?"}
                </div>
                <div className="text-left hidden lg:block">
                  <p className="text-sm font-semibold text-foreground leading-none">{user?.firstName || "Loading..."}</p>
                  <p className="text-xs mt-0.5 capitalize flex items-center gap-1">
                    {user?.isVerified ? (
                      <span className="text-green-600 flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block"></span>{user.role}</span>
                    ) : (
                      <span className="text-amber-500 capitalize">{user?.role}</span>
                    )}
                  </p>
                </div>
                <ChevronDown size={14} className={cn("text-muted-foreground transition-transform", showUserMenu && "rotate-180")} />
              </button>

              <AnimatePresence>
                {showUserMenu && (
                  <motion.div
                    initial={{ opacity: 0, y: 8, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 8, scale: 0.95 }}
                    transition={{ duration: 0.15 }}
                    className="absolute right-0 top-full mt-2 w-52 bg-white border rounded-2xl shadow-xl z-50 overflow-hidden"
                  >
                    <div className="p-3 border-b bg-muted/30">
                      <p className="text-xs font-semibold text-foreground">{user?.firstName} {user?.lastName}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{user?.email}</p>
                    </div>
                    <div className="p-2 space-y-0.5">
                      <Link href="/profile" onClick={() => setShowUserMenu(false)}>
                        <button className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm hover:bg-muted transition-colors text-left">
                          <User size={15} className="text-muted-foreground" /> My Profile
                        </button>
                      </Link>
                      {isOwner && (
                        <Link href="/my-listings" onClick={() => setShowUserMenu(false)}>
                          <button className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm hover:bg-muted transition-colors text-left">
                            <Building size={15} className="text-muted-foreground" /> My Listings
                          </button>
                        </Link>
                      )}
                      <Link href="/messages" onClick={() => setShowUserMenu(false)}>
                        <button className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm hover:bg-muted transition-colors text-left">
                          <MessageSquare size={15} className="text-muted-foreground" /> Messages
                        </button>
                      </Link>
                      {!isAdmin && (
                        <Link href="/matches" onClick={() => setShowUserMenu(false)}>
                          <button className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm hover:bg-muted transition-colors text-left">
                            <Heart size={15} className="text-muted-foreground" /> {isOwner ? "Interested Tenants" : "My Matches"}
                          </button>
                        </Link>
                      )}
                      <Link href="/contracts" onClick={() => setShowUserMenu(false)}>
                        <button className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm hover:bg-muted transition-colors text-left">
                          <FileText size={15} className="text-muted-foreground" /> Contracts
                        </button>
                      </Link>
                    </div>
                    <div className="p-2 border-t">
                      <button
                        onClick={() => { setShowUserMenu(false); logout(); }}
                        className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm hover:bg-destructive/10 text-destructive transition-colors text-left"
                      >
                        <LogOut size={15} /> Sign Out
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}
        </div>
      </header>

      {/* Click-away overlay */}
      {showUserMenu && (
        <div className="fixed inset-0 z-40" onClick={() => setShowUserMenu(false)} />
      )}

      {/* Admin banner */}
      {isAdmin && loggedIn && (
        <div className="hidden md:flex bg-secondary text-white text-xs items-center justify-center gap-2 py-1.5 font-medium">
          <ShieldCheck size={13} /> You are viewing as Administrator
          <Link href="/admin" className="underline hover:no-underline ml-1">Go to Admin Panel →</Link>
        </div>
      )}

      {/* Welcome note */}
      {showWelcomeNote && loggedIn && user?.firstName && (
        <div className="hidden md:flex justify-end mt-3 mb-2">
          <div className="rounded-2xl border border-emerald-400 bg-emerald-600 px-4 py-2 shadow-lg shadow-emerald-500/25 text-white animate-[pulse_1.8s_ease-in-out]">
            <p className="text-sm font-semibold">Welcome back, {user.firstName}.</p>
          </div>
        </div>
      )}

      {/* Main Content */}
      <main className="flex-1 w-full max-w-7xl mx-auto px-4 md:px-6 lg:px-8 py-4 md:py-6">
        <motion.div
          key={location}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25, ease: "easeOut" }}
          className="h-full"
        >
          {children}
        </motion.div>
      </main>

      {/* Mobile Bottom Navigation */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 h-[72px] bg-white border-t shadow-[0_-8px_30px_-12px_rgba(0,0,0,0.15)] z-50 px-2 flex items-center justify-around">
        {[
          { href: "/", label: "Home", icon: Home },
          { href: "/search", label: "Search", icon: Search },
          ...(loggedIn ? [{ href: isOwner ? "/my-listings" : "/matches", label: isOwner ? "Listings" : "Matches", icon: isOwner ? Building : Search, primary: false }] : []),
          { href: "/messages", label: "Messages", icon: MessageSquare },
          { href: loggedIn ? (isAdmin ? "/admin" : "/profile") : "/login", label: loggedIn ? (isAdmin ? "Admin" : "Profile") : "Sign In", icon: loggedIn ? (isAdmin ? ShieldCheck : User) : LogIn },
        ].map((item) => {
          const active = location === item.href || (item.href !== "/" && location.startsWith(item.href));
          return (
            <Link key={item.href} href={item.href} className="relative flex flex-col items-center justify-center flex-1 h-full py-2">
              {(item as any).primary ? (
                <div className="bg-gradient-to-tr from-primary to-rose-500 text-white p-3.5 rounded-2xl shadow-lg shadow-primary/30 -mt-6">
                  <item.icon size={22} />
                </div>
              ) : (
                <>
                  <item.icon
                    size={20}
                    className={cn("mb-1 transition-all", active ? "text-primary scale-110" : "text-muted-foreground")}
                  />
                  <span className={cn("text-[10px] font-medium", active ? "text-primary" : "text-muted-foreground")}>
                    {item.label}
                  </span>
                  {active && (
                    <motion.div layoutId="tab-dot" className="absolute bottom-1 w-1 h-1 bg-primary rounded-full" />
                  )}
                </>
              )}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
