import { Link, useRouterState } from "@tanstack/react-router";
import {
  Command as CommandIcon,
  Building2,
  FolderKanban,
  GitBranch,
  BookOpen,
  FileText,
  ShieldCheck,
  Sparkles,
  Plug,
  Settings as SettingsIcon,
  Target,
  Search,
  PanelLeft,
  Bell,
  CheckSquare,
  ClipboardList,
  Users,
  Loader2,
} from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/lib/auth-context";
import { useOrg } from "@/lib/org-context";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { useNavigate } from "@tanstack/react-router";
import { useGlobalSearch, type SearchHit } from "@/lib/data-hooks";
import { can } from "@/lib/permissions";
import { SEARCH_DEBOUNCE_MS } from "@/lib/constants";

type NavItem = {
  to: "/" | "/ventures" | "/projects" | "/decisions" | "/goals" | "/knowledge" | "/documents" | "/accountability" | "/sam" | "/sam/memory" | "/integrations" | "/settings";
  label: string;
  icon: typeof CommandIcon;
  exact?: boolean;
};

const NAV: NavItem[] = [
  { to: "/", label: "Command", icon: CommandIcon, exact: true },
  { to: "/ventures", label: "Ventures", icon: Building2 },
  { to: "/projects", label: "Projects", icon: FolderKanban },
  { to: "/decisions", label: "Decisions", icon: GitBranch },
  { to: "/goals", label: "Goals", icon: Target },
  { to: "/knowledge", label: "Knowledge", icon: BookOpen },
  { to: "/documents", label: "Documents", icon: FileText },
  { to: "/accountability", label: "Accountability", icon: ShieldCheck },
  { to: "/sam", label: "SAM", icon: Sparkles },
  { to: "/sam/memory", label: "SAM Memory", icon: Sparkles },
  { to: "/integrations", label: "Integrations", icon: Plug },
  { to: "/settings", label: "Settings", icon: SettingsIcon },
];

export function AppShell({ children }: { children: ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [cmdOpen, setCmdOpen] = useState(false);
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const { activeOrgId, activeMembership } = useOrg();
  const [cmdInput, setCmdInput] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(cmdInput.trim()), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [cmdInput]);

  useEffect(() => {
    if (!cmdOpen) setCmdInput("");
  }, [cmdOpen]);

  const searchQ = useGlobalSearch(activeOrgId, debouncedQuery);
  const canWrite = can.writeContent(activeMembership?.role);
  const results = searchQ.data;
  const hasQuery = debouncedQuery.length >= 2;

  const goto = (route: SearchHit["route"] | { to: string; params?: Record<string, string> }) => {
    setCmdOpen(false);
    navigate({ to: route.to as any, params: route.params as any });
  };

  const initials = (user?.email ?? "?")
    .split(/[.@_-]/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase() ?? "")
    .join("");

  async function handleSignOut() {
    await signOut();
    navigate({ to: "/auth", replace: true });
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setCmdOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  const isActive = (to: string, exact?: boolean) =>
    exact ? pathname === to : pathname === to || pathname.startsWith(to + "/");

  return (
    <div className="flex min-h-screen w-full bg-background text-foreground">
      {/* Desktop sidebar */}
      <aside
        className={cn(
          "hidden md:flex flex-col bg-sidebar text-sidebar-foreground transition-[width] duration-[280ms] ease-[cubic-bezier(0.32,0.72,0,1)]",
          collapsed ? "w-[68px]" : "w-[248px]",
        )}
      >
        <div className="flex h-16 items-center gap-2.5 px-4">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-foreground text-background text-[13px] font-semibold">
            N
          </div>
          <div
            className={cn(
              "min-w-0 leading-tight transition-opacity duration-200",
              collapsed ? "pointer-events-none opacity-0" : "opacity-100",
            )}
          >
            <div className="font-display text-[18px]">Northstar</div>
            <div className="text-[9.5px] uppercase tracking-[0.2em] text-muted-foreground/80">
              Executive OS
            </div>
          </div>
        </div>

        <nav className="flex-1 space-y-0.5 px-2 pt-4" aria-label="Primary">
          {NAV.map((item) => {
            const active = isActive(item.to, item.exact);
            const Icon = item.icon;
            return (
              <Link
                key={item.to}
                to={item.to}
                title={collapsed ? item.label : undefined}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "group relative flex h-9 items-center gap-3 rounded-md px-2.5 text-[13px] font-medium",
                  active
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-muted-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-foreground",
                  collapsed && "justify-center px-0",
                )}
              >
                {active && !collapsed && (
                  <span className="absolute left-0 top-1/2 h-4 w-[2px] -translate-y-1/2 rounded-full bg-foreground/80" />
                )}
                <Icon className="h-[15px] w-[15px] shrink-0" strokeWidth={1.75} />
                <span
                  className={cn(
                    "truncate transition-opacity duration-150",
                    collapsed ? "hidden" : "opacity-100",
                  )}
                >
                  {item.label}
                </span>
              </Link>
            );
          })}
        </nav>

        <div className="p-2">
          <button
            onClick={() => setCollapsed((v) => !v)}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            className={cn(
              "flex h-9 w-full items-center gap-3 rounded-md px-2.5 text-[12px] text-muted-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-foreground",
              collapsed && "justify-center px-0",
            )}
          >
            <PanelLeft
              className={cn(
                "h-[15px] w-[15px] transition-transform duration-300",
                collapsed && "rotate-180",
              )}
              strokeWidth={1.75}
            />
            {!collapsed && <span>Collapse</span>}
          </button>
        </div>
      </aside>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="absolute left-0 top-0 h-full w-[260px] border-r border-border bg-sidebar p-3">
            <div className="flex h-14 items-center gap-2 px-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-md bg-foreground text-background text-[13px] font-semibold">
                N
              </div>
              <div className="font-display text-[17px]">Northstar</div>
            </div>
            <nav className="mt-2 space-y-0.5">
              {NAV.map((item) => {
                const active = isActive(item.to, item.exact);
                const Icon = item.icon;
                return (
                  <Link
                    key={item.to}
                    to={item.to}
                    className={cn(
                      "flex items-center gap-3 rounded-md px-2.5 py-2.5 text-[14px]",
                      active
                        ? "bg-sidebar-accent text-sidebar-accent-foreground"
                        : "text-muted-foreground",
                    )}
                  >
                    <Icon className="h-4 w-4" strokeWidth={1.75} />
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          </aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-16 items-center gap-3 bg-background/70 px-4 backdrop-blur-xl md:px-8">
          <button
            className="md:hidden -ml-1 rounded-md p-2 text-muted-foreground hover:bg-accent"
            onClick={() => setMobileOpen(true)}
            aria-label="Open navigation"
          >
            <PanelLeft className="h-4 w-4" />
          </button>

          <button
            onClick={() => setCmdOpen(true)}
            className="group flex h-9 w-full max-w-md items-center gap-2.5 rounded-lg bg-secondary/40 px-3 text-left text-[13px] text-muted-foreground hover:bg-secondary/70"
          >
            <Search className="h-3.5 w-3.5" strokeWidth={2} />
            <span className="flex-1 truncate">
              Search ventures, decisions, docs…
            </span>
            <kbd className="hidden sm:inline-flex h-5 items-center gap-0.5 rounded bg-background/70 px-1.5 font-mono text-[10px] text-muted-foreground/80">
              ⌘K
            </kbd>
          </button>

          <div className="ml-auto flex items-center gap-1">
            <Button variant="ghost" size="icon" className="h-9 w-9 text-muted-foreground">
              <Bell className="h-4 w-4" strokeWidth={1.75} />
            </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="ml-1 flex h-8 w-8 items-center justify-center rounded-full bg-secondary text-[12px] font-medium text-foreground hover:opacity-90">
                {initials || "N"}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-56">
              <DropdownMenuLabel className="flex flex-col gap-0.5">
                <span className="truncate text-[13px] text-foreground">
                  {user?.email}
                </span>
                {activeMembership?.organizations?.name && (
                  <span className="text-[11px] font-normal text-muted-foreground">
                    {activeMembership.organizations.name} · {activeMembership.role}
                  </span>
                )}
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={() => navigate({ to: "/settings" })}>
                Settings
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={handleSignOut}>Sign out</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          </div>
        </header>

        <main className="min-w-0 flex-1">{children}</main>
      </div>

      <CommandDialog open={cmdOpen} onOpenChange={setCmdOpen}>
        <CommandInput
          placeholder="Search ventures, projects, decisions, docs, people…"
          value={cmdInput}
          onValueChange={setCmdInput}
        />
        <CommandList>
          {hasQuery && searchQ.isFetching && (
            <div className="flex items-center gap-2 px-3 py-2 text-[12px] text-muted-foreground">
              <Loader2 className="h-3 w-3 animate-spin" /> Searching…
            </div>
          )}
          {hasQuery && searchQ.isError && (
            <div className="px-3 py-2 text-[12px] text-destructive">Search failed. Try again.</div>
          )}
          {hasQuery && !searchQ.isFetching && results && results.total === 0 && (
            <CommandEmpty>No matches in this organization.</CommandEmpty>
          )}
          {!hasQuery && <CommandEmpty>Type to search  -  or pick an action below.</CommandEmpty>}

          {hasQuery && results && (
            <>
              <SearchGroup heading="Ventures" hits={results.ventures} icon={Building2} onSelect={goto} />
              <SearchGroup heading="Projects" hits={results.projects} icon={FolderKanban} onSelect={goto} />
              <SearchGroup heading="Tasks" hits={results.tasks} icon={CheckSquare} onSelect={goto} />
              <SearchGroup heading="Goals" hits={results.goals} icon={Target} onSelect={goto} />
              <SearchGroup heading="Decisions" hits={results.decisions} icon={GitBranch} onSelect={goto} />
              <SearchGroup heading="Commitments" hits={results.commitments} icon={ClipboardList} onSelect={goto} />
              <SearchGroup heading="Knowledge" hits={results.knowledge} icon={BookOpen} onSelect={goto} />
              <SearchGroup heading="Documents" hits={results.documents} icon={FileText} onSelect={goto} />
              <SearchGroup heading="People" hits={results.members} icon={Users} onSelect={goto} />
              <CommandSeparator />
            </>
          )}

          <CommandGroup heading="Navigate">
            {NAV.map((item) => (
              <CommandItem
                key={item.to}
                value={`nav-${item.label}`}
                onSelect={() => goto({ to: item.to })}
              >
                <item.icon className="mr-2 h-4 w-4" />
                {item.label}
              </CommandItem>
            ))}
          </CommandGroup>

          {canWrite && (
            <CommandGroup heading="Create">
              <CommandItem value="create-venture" onSelect={() => goto({ to: "/ventures" })}>
                <Building2 className="mr-2 h-4 w-4" /> New venture
              </CommandItem>
              <CommandItem value="create-project" onSelect={() => goto({ to: "/projects" })}>
                <FolderKanban className="mr-2 h-4 w-4" /> New project
              </CommandItem>
              <CommandItem value="create-goal" onSelect={() => goto({ to: "/goals" })}>
                <Target className="mr-2 h-4 w-4" /> New goal
              </CommandItem>
              <CommandItem value="create-decision" onSelect={() => goto({ to: "/decisions" })}>
                <GitBranch className="mr-2 h-4 w-4" /> New decision
              </CommandItem>
              <CommandItem value="create-commitment" onSelect={() => goto({ to: "/accountability" })}>
                <ClipboardList className="mr-2 h-4 w-4" /> New commitment
              </CommandItem>
              <CommandItem value="create-knowledge" onSelect={() => goto({ to: "/knowledge" })}>
                <BookOpen className="mr-2 h-4 w-4" /> New knowledge record
              </CommandItem>
              <CommandItem value="upload-document" onSelect={() => goto({ to: "/documents" })}>
                <FileText className="mr-2 h-4 w-4" /> Upload document
              </CommandItem>
            </CommandGroup>
          )}
        </CommandList>
      </CommandDialog>
    </div>
  );
}

function SearchGroup({
  heading,
  hits,
  icon: Icon,
  onSelect,
}: {
  heading: string;
  hits: SearchHit[];
  icon: typeof CommandIcon;
  onSelect: (route: SearchHit["route"]) => void;
}) {
  if (hits.length === 0) return null;
  return (
    <CommandGroup heading={heading}>
      {hits.map((h) => (
        <CommandItem key={`${h.type}-${h.id}`} value={`${h.type}-${h.id}-${h.title}`} onSelect={() => onSelect(h.route)}>
          <Icon className="mr-2 h-4 w-4 shrink-0" />
          <span className="truncate">{h.title}</span>
          {h.subtitle && (
            <span className="ml-2 truncate text-[11px] text-muted-foreground">{h.subtitle}</span>
          )}
          {h.status && (
            <span className="ml-auto text-[10.5px] uppercase tracking-[0.16em] text-muted-foreground/70">
              {h.status.replace(/_/g, " ")}
            </span>
          )}
        </CommandItem>
      ))}
    </CommandGroup>
  );
}