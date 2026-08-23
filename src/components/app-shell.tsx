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
  Rocket,
  Inbox,
  DollarSign,
  Gauge,
} from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import northstarLogo from "@/assets/northstar-labs-logo.png.asset.json";
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
import { can, type Role } from "@/lib/permissions";
import { SEARCH_DEBOUNCE_MS } from "@/lib/constants";
import { SamChatHead } from "@/components/sam/sam-chat-head";


type NavItem = {
  to:
    | "/command"
    | "/clients"
    | "/labs"
    | "/labs/mission-control"
    | "/labs/assessments"
    | "/labs/revenue"
    | "/labs/proposals"
    | "/labs/billing"
    | "/labs/ventures"
    | "/labs/projects"
    | "/labs/decisions"
    | "/labs/goals"
    | "/labs/knowledge"
    | "/labs/documents"
    | "/labs/accountability"
    | "/sam"
    | "/sam/control"
    | "/sam/memory"
    | "/sam/content"
    | "/sam/integrations"
    | "/settings";
  label: string;
  icon: typeof CommandIcon;
  exact?: boolean;
  /** Executive-only surfaces are hidden from viewers and members. */
  financial?: boolean;
};

type NavGroup = { heading: string; items: NavItem[] };

const NAV_GROUPS: NavGroup[] = [
  {
    heading: "Command",
    items: [
      { to: "/command", label: "Command", icon: CommandIcon, exact: true },
      { to: "/clients", label: "Clients", icon: Users },
    ],
  },
  {
    heading: "Modules",
    items: [
      { to: "/sam/content", label: "Content Ops", icon: ClipboardList },
      { to: "/labs/assessments", label: "Assessments", icon: Inbox },
      { to: "/labs/proposals", label: "Proposals", icon: FileText, financial: true },
      { to: "/labs/billing", label: "Billing", icon: DollarSign, financial: true },
      { to: "/labs/revenue", label: "Revenue", icon: DollarSign, financial: true },
      { to: "/labs/projects", label: "Delivery", icon: FolderKanban },
    ],
  },
  {
    heading: "Operations",
    items: [
      { to: "/labs/mission-control", label: "Mission Control", icon: Rocket },
      { to: "/labs/ventures", label: "Ventures", icon: Building2 },
      { to: "/labs/accountability", label: "Accountability", icon: ShieldCheck },
      { to: "/labs/decisions", label: "Decisions", icon: GitBranch },
      { to: "/labs/goals", label: "Goals", icon: Target },
    ],
  },
  {
    heading: "Knowledge",
    items: [
      { to: "/labs", label: "Executive Brief", icon: Gauge, exact: true },
      { to: "/labs/knowledge", label: "Knowledge", icon: BookOpen },
      { to: "/labs/documents", label: "Documents", icon: FileText },
    ],
  },
  {
    heading: "System",
    items: [
      { to: "/sam", label: "SAM", icon: Sparkles },
      { to: "/sam/control", label: "SAM Control", icon: Gauge },
      { to: "/sam/memory", label: "SAM Memory", icon: Sparkles },
      { to: "/sam/integrations", label: "Integrations", icon: Plug },
      { to: "/settings", label: "Settings", icon: SettingsIcon },
    ],
  },

];

function visibleGroups(role: Role | undefined | null): NavGroup[] {
  const allowFinancial = can.viewFinancials(role);
  return NAV_GROUPS.map((g) => ({
    ...g,
    items: g.items.filter((i) => allowFinancial || !i.financial),
  })).filter((g) => g.items.length > 0);
}

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
  const navGroups = visibleGroups(activeMembership?.role);
  const navItems = navGroups.flatMap((g) => g.items);
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
    <div className="flex min-h-screen w-full bg-background text-foreground paper-grain">
      {/* Desktop sidebar */}
      <aside
        className={cn(
          "hidden md:flex print:hidden flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground transition-[width] duration-[280ms] ease-[cubic-bezier(0.32,0.72,0,1)]",
          collapsed ? "w-[72px]" : "w-[236px]",
        )}
      >
        <Link
          to="/command"
          className="flex h-14 items-center gap-2.5 border-b border-sidebar-border/70 px-4"
          aria-label="NorthStar Command Center"
        >
          <img
            src={northstarLogo.url}
            alt="NorthStar Labs"
            className="h-8 w-8 shrink-0 object-contain"
          />
          <div
            className={cn(
              "min-w-0 leading-tight transition-opacity duration-200",
              collapsed ? "pointer-events-none opacity-0" : "opacity-100",
            )}
          >
            <div className="font-display text-[15px] font-semibold text-sidebar-accent-foreground">
              NorthStar Labs
            </div>
            <div className="mt-0.5 text-[9px] uppercase tracking-[0.22em] text-muted-foreground">
              Command Center
            </div>

          </div>
        </Link>

        <nav className="flex-1 overflow-y-auto px-3 pb-4 pt-2" aria-label="Primary">
          {navGroups.map((group, gi) => (
            <div key={group.heading} className={cn(gi > 0 && "mt-6")}>
              {!collapsed && (
                <div className="mb-2 px-2.5 text-[9.5px] font-medium uppercase tracking-[0.24em] text-muted-foreground/70">
                  {group.heading}
                </div>
              )}
              {collapsed && gi > 0 && (
                <div className="mx-auto mb-3 h-px w-6 bg-sidebar-border" />
              )}
              <div className="space-y-[2px]">
                {group.items.map((item) => {
                  const active = isActive(item.to, item.exact);
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.to}
                      to={item.to}
                      title={collapsed ? item.label : undefined}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "group relative flex h-9 items-center gap-3 rounded-md px-2.5 text-[13px]",
                        active
                          ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                          : "text-sidebar-foreground/70 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground",
                        collapsed && "justify-center px-0",
                      )}
                    >
                      {active && !collapsed && (
                        <span className="absolute left-0 top-1/2 h-5 w-[2px] -translate-y-1/2 bg-primary shadow-[0_0_8px_var(--color-primary)]" />
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
              </div>
            </div>
          ))}
        </nav>

        <div className="border-t border-sidebar-border p-2">
          <button
            onClick={() => setCollapsed((v) => !v)}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            className={cn(
              "flex h-9 w-full items-center gap-3 rounded-md px-2.5 text-[11.5px] uppercase tracking-[0.18em] text-muted-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-foreground",
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
            className="absolute inset-0 bg-foreground/40 backdrop-blur-sm"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="absolute left-0 top-0 h-full w-[280px] overflow-y-auto border-r border-sidebar-border bg-sidebar p-4">
            <div className="flex h-14 items-center gap-3 px-1">
              <img src={northstarLogo.url} alt="NorthStar Labs" className="h-9 w-9 shrink-0 object-contain" />
              <div className="font-display text-[20px] font-semibold text-sidebar-accent-foreground">NorthStar Labs</div>
            </div>
            <nav className="mt-4">
              {navGroups.map((group, gi) => (
                <div key={group.heading} className={cn(gi > 0 && "mt-5")}>
                  <div className="mb-1.5 px-2.5 text-[9.5px] font-medium uppercase tracking-[0.24em] text-muted-foreground/70">
                    {group.heading}
                  </div>
                  <div className="space-y-[2px]">
                    {group.items.map((item) => {
                      const active = isActive(item.to, item.exact);
                      const Icon = item.icon;
                      return (
                        <Link
                          key={item.to}
                          to={item.to}
                          className={cn(
                            "flex items-center gap-3 rounded-md px-2.5 py-2 text-[14px]",
                            active
                              ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                              : "text-sidebar-foreground/80",
                          )}
                        >
                          <Icon className="h-4 w-4" strokeWidth={1.75} />
                          {item.label}
                        </Link>
                      );
                    })}
                  </div>
                </div>
              ))}
            </nav>
          </aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 grid h-[60px] grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 border-b border-border bg-background/90 px-3 backdrop-blur-xl print:hidden md:flex md:gap-3 md:px-6">
          <button
            className="-ml-1 grid h-9 w-9 shrink-0 place-items-center rounded-md text-muted-foreground hover:bg-accent md:hidden"
            onClick={() => setMobileOpen(true)}
            aria-label="Open navigation"
          >
            <PanelLeft className="h-4 w-4" />
          </button>

          <Link
            to="/command"
            aria-label="NorthStar Command Center"

            className="flex min-w-0 items-center gap-2 md:hidden"
          >
            <img src={northstarLogo.url} alt="" className="h-8 w-8 shrink-0 object-contain" />
            <span className="truncate font-display text-[13px] font-semibold text-foreground">NorthStar Labs</span>
          </Link>

          <button
            onClick={() => setCmdOpen(true)}
            aria-label="Open command search"
            className="group hidden h-9 w-full max-w-xl items-center gap-2.5 rounded-md border border-border bg-card px-3 text-left text-[12.5px] text-muted-foreground shadow-xs hover:border-primary/40 hover:text-foreground md:flex"
          >
            <Search className="h-3.5 w-3.5" strokeWidth={2} />
            <span className="flex-1 truncate">
              Ask SAM or jump to anything
            </span>
            <kbd className="hidden sm:inline-flex h-5 items-center gap-0.5 rounded border border-border/60 bg-background/60 px-1.5 font-mono text-[10px] text-muted-foreground/80">
              ⌘K
            </kbd>
          </button>

          <div className="ml-auto flex shrink-0 items-center gap-0.5">
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 text-muted-foreground md:hidden"
              aria-label="Open command search"
              onClick={() => setCmdOpen(true)}
            >
              <Search className="h-4 w-4" strokeWidth={1.8} />
            </Button>
            <Button variant="ghost" size="icon" className="h-9 w-9 text-muted-foreground" aria-label="Notifications">
              <Bell className="h-4 w-4" strokeWidth={1.75} />
            </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="ml-1 flex h-8 w-8 items-center justify-center rounded-full border border-border bg-card text-[12px] font-semibold text-foreground shadow-xs hover:bg-accent">
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

      <SamChatHead />


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
            {navItems.map((item) => (
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
              <CommandItem value="create-venture" onSelect={() => goto({ to: "/labs/ventures" })}>
                <Building2 className="mr-2 h-4 w-4" /> New venture
              </CommandItem>
              <CommandItem value="create-project" onSelect={() => goto({ to: "/labs/projects" })}>
                <FolderKanban className="mr-2 h-4 w-4" /> New project
              </CommandItem>
              <CommandItem value="create-goal" onSelect={() => goto({ to: "/labs/goals" })}>
                <Target className="mr-2 h-4 w-4" /> New goal
              </CommandItem>
              <CommandItem value="create-decision" onSelect={() => goto({ to: "/labs/decisions" })}>
                <GitBranch className="mr-2 h-4 w-4" /> New decision
              </CommandItem>
              <CommandItem value="create-commitment" onSelect={() => goto({ to: "/labs/accountability" })}>
                <ClipboardList className="mr-2 h-4 w-4" /> New commitment
              </CommandItem>
              <CommandItem value="create-knowledge" onSelect={() => goto({ to: "/labs/knowledge" })}>
                <BookOpen className="mr-2 h-4 w-4" /> New knowledge record
              </CommandItem>
              <CommandItem value="upload-document" onSelect={() => goto({ to: "/labs/documents" })}>
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