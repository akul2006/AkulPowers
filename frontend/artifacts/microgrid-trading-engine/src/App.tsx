import { useEffect, useState } from "react";
import {
  QueryClient,
  QueryClientProvider,
  useQueryClient,
} from "@tanstack/react-query";
import { ErrorBoundary } from "@/components/error-boundary";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import {
  Activity,
  AlertCircle,
  ArrowDownRight,
  ArrowUpRight,
  BatteryCharging,
  Check,
  ChevronDown,
  CircleDollarSign,
  Clock3,
  CloudSun,
  Cpu,
  DatabaseZap,
  Gauge,
  Leaf,
  LineChart,
  Loader2,
  Menu,
  Moon,
  Plus,
  Radio,
  RefreshCw,
  Send,
  Server,
  ShieldCheck,
  Sun,
  ArrowLeftRight,
  TrendingUp,
  UserRound,
  X,
  Zap,
} from "lucide-react";
import {
  getGetAuditLogsQueryKey,
  getGetGridSummaryQueryKey,
  getGetNodesQueryKey,
  getHealthCheckQueryKey,
  useCreateNode,
  useCreateTrade,
  useGetAuditLogs,
  useGetGridSummary,
  useGetNodes,
  useHealthCheck,
  setBaseUrl,
} from "@workspace/api-client-react";
import type {
  AuditLog,
  GridNode,
  GridSummary,
  NodeInput,
  TradeResult,
} from "@workspace/api-client-react";
import { Route, Switch, Router as WouterRouter } from "wouter";

const queryClient = new QueryClient();

const configuredApiBase = import.meta.env.VITE_API_BASE_URL?.replace(
  /\/+$/,
  "",
);
const normalizedApiOrigin = configuredApiBase?.endsWith("/api")
  ? configuredApiBase.slice(0, -4)
  : configuredApiBase;
if (normalizedApiOrigin) {
  setBaseUrl(normalizedApiOrigin);
}

const nodeTypes = [
  "SOLAR_PRODUCER",
  "CONSUMER",
  "EV_STATION",
  "BATTERY_STORAGE",
] as const;
const priorities = [
  "Critical / Essential",
  "High Priority",
  "Normal Residential",
  "Low Priority / Non-essential",
];
const emptyNode: NodeInput = {
  name: "",
  type: nodeTypes[0],
  location: "",
  capacity: 0,
  priority: 3,
};
const navItems = [
  { label: "Control Room", icon: Activity, id: "control-room" },
  { label: "Node Registry", icon: Cpu, id: "node-registry" },
  { label: "P2P Energy Trading", icon: ArrowLeftRight, id: "market-execution" },
  { label: "Audit Logs", icon: DatabaseZap, id: "audit-stream" },
];

function formatNumber(value: number | undefined, fractionDigits = 1) {
  if (value === undefined || value === null || !Number.isFinite(value))
    return "—";
  return new Intl.NumberFormat("en-IN", {
    maximumFractionDigits: fractionDigits,
  }).format(value);
}

function formatTime(value: string | undefined) {
  if (!value) return "Waiting for telemetry";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function formatDateTime(value: string | undefined) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-IN", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(date);
}

function isApiError(value: unknown) {
  if (value instanceof Error) return value.message;
  if (typeof value === "object" && value && "response" in value)
    return "The grid service returned an error.";
  return "Unable to reach the grid service.";
}

function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-md bg-muted ${className}`} />;
}

function StatusDot({ status }: { status: string }) {
  const online =
    status.toLowerCase() === "online" || status.toLowerCase() === "stable";
  const warning = ["WARNING", "THROTTLED", "LOAD SHEDDING ACTIVE"].includes(
    status,
  );
  return (
    <span
      className="inline-flex items-center gap-1.5"
      data-testid={`status-${status.toLowerCase().replaceAll(" ", "-")}`}
    >
      <span
        className={`signal-dot h-1.5 w-1.5 rounded-full ${online ? "bg-primary" : warning ? "bg-accent" : "bg-destructive"}`}
      />
      <span>{status}</span>
    </span>
  );
}

function StatCard({
  label,
  value,
  unit,
  delta,
  icon: Icon,
  tone = "teal",
  loading,
}: {
  label: string;
  value: string;
  unit?: string;
  delta?: string;
  icon: typeof Activity;
  tone?: "teal" | "gold" | "blue" | "violet";
  loading?: boolean;
}) {
  const tones = {
    teal: "bg-primary/10 text-primary",
    gold: "bg-accent/20 text-accent-foreground",
    blue: "bg-sky-500/10 text-sky-700 dark:text-sky-300",
    violet: "bg-violet-500/10 text-violet-700 dark:text-violet-300",
  };
  return (
    <article
      className="relative overflow-hidden rounded-xl border bg-card p-4 shadow-sm transition-transform duration-200 hover:-translate-y-0.5 hover:shadow-md"
      data-testid={`card-stat-${label.toLowerCase().replaceAll(" ", "-")}`}
    >
      <div className="flex items-start justify-between">
        <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-muted-foreground">
          {label}
        </p>
        <span
          className={`grid h-8 w-8 place-items-center rounded-lg ${tones[tone]}`}
        >
          <Icon size={15} />
        </span>
      </div>
      {loading ? (
        <Skeleton className="mt-3 h-8 w-24" />
      ) : (
        <div className="mt-3 flex items-baseline gap-1.5">
          <span
            className="mono text-2xl font-medium tracking-tight"
            data-testid={`text-stat-${label.toLowerCase().replaceAll(" ", "-")}`}
          >
            {value}
          </span>
          {unit && (
            <span className="text-xs text-muted-foreground">{unit}</span>
          )}
        </div>
      )}
      {delta && (
        <p className="mt-2 flex items-center gap-1 text-xs text-primary">
          <ArrowUpRight size={13} />
          {delta}
        </p>
      )}
    </article>
  );
}

function Sparkline({
  history,
  loading,
}: {
  history: GridSummary["history"] | undefined;
  loading?: boolean;
}) {
  if (loading) return <Skeleton className="h-52 w-full" />;
  if (!history?.length)
    return (
      <div className="grid h-52 place-items-center text-xs text-muted-foreground">
        No generation history available
      </div>
    );
  const points = history;
  const max = Math.max(
    ...points.map((point) => Math.max(point.generation, point.consumption)),
    1,
  );
  const toPoints = (key: "generation" | "consumption") =>
    points
      .map(
        (point, index) =>
          `${(index / Math.max(points.length - 1, 1)) * 100},${100 - (point[key] / max) * 82 - 8}`,
      )
      .join(" ");
  return (
    <div className="relative h-52 min-w-0" data-testid="chart-grid-history">
      <div className="absolute inset-0 flex flex-col justify-between text-[10px] text-muted-foreground/70">
        {[0, 1, 2, 3].map((line) => (
          <div className="flex items-center gap-2" key={line}>
            <span className="w-7 text-right mono">
              {formatNumber(max * (1 - line / 3), 0)}
            </span>
            <span className="h-px flex-1 bg-border/70" />
          </div>
        ))}
      </div>
      <svg
        className="absolute inset-x-9 inset-y-2 h-[calc(100%-8px)] w-[calc(100%-36px)] overflow-visible"
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        aria-label="Generation and consumption history"
      >
        <defs>
          <linearGradient id="generationFill" x1="0" x2="0" y1="0" y2="1">
            <stop
              offset="0%"
              stopColor="hsl(var(--primary))"
              stopOpacity=".24"
            />
            <stop
              offset="100%"
              stopColor="hsl(var(--primary))"
              stopOpacity="0"
            />
          </linearGradient>
        </defs>
        <polygon
          points={`0,100 ${toPoints("generation")} 100,100`}
          fill="url(#generationFill)"
        />
        <polyline
          points={toPoints("generation")}
          fill="none"
          stroke="hsl(var(--primary))"
          strokeWidth="1.4"
          vectorEffect="non-scaling-stroke"
        />
        <polyline
          points={toPoints("consumption")}
          fill="none"
          stroke="hsl(var(--accent))"
          strokeWidth="1.4"
          strokeDasharray="3 2"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
      <div className="absolute bottom-0 left-9 right-0 flex justify-between text-[10px] text-muted-foreground">
        {points
          .filter(
            (_, index) =>
              index % Math.max(Math.ceil(points.length / 4), 1) === 0,
          )
          .map((point) => (
            <span key={point.time}>{point.time}</span>
          ))}
      </div>
    </div>
  );
}

function AppShell() {
  const [theme, setTheme] = useState<"light" | "dark">(() =>
    localStorage.getItem("microgrid-theme") === "light" ? "light" : "dark",
  );
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [activeSection, setActiveSection] = useState("control-room");
  const [nodeModalOpen, setNodeModalOpen] = useState(false);
  const [nodeDraft, setNodeDraft] = useState<NodeInput>(emptyNode);
  const [feedback, setFeedback] = useState<{
    kind: "success" | "error";
    message: string;
  } | null>(null);
  const [tradeResult, setTradeResult] = useState<TradeResult | null>(null);
  const queryClientInstance = useQueryClient();

  const summaryQuery = useGetGridSummary({
    query: { queryKey: getGetGridSummaryQueryKey(), refetchInterval: 15000 },
  });
  const nodesQuery = useGetNodes({
    query: { queryKey: getGetNodesQueryKey(), refetchInterval: 20000 },
  });
  const auditQuery = useGetAuditLogs({
    query: { queryKey: getGetAuditLogsQueryKey(), refetchInterval: 15000 },
  });
  const healthQuery = useHealthCheck({
    query: { queryKey: getHealthCheckQueryKey(), refetchInterval: 30000 },
  });
  const createNode = useCreateNode({ mutation: { retry: false } });
  const createTrade = useCreateTrade({ mutation: { retry: false } });

  const summary = summaryQuery.data;
  const nodes = nodesQuery.data ?? [];
  const auditLogs = auditQuery.data ?? [];
  const price = summaryQuery.isError ? undefined : summary?.currentPrice;
  const [tradeError, setTradeError] = useState<string | null>(null);
  const demoMode = healthQuery.data?.status === "demo";

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
    localStorage.setItem("microgrid-theme", theme);
  }, [theme]);

  useEffect(() => {
    if (!feedback) return;
    const timer = window.setTimeout(() => setFeedback(null), 6000);
    return () => window.clearTimeout(timer);
  }, [feedback]);

  const refreshAll = () => {
    void queryClientInstance.invalidateQueries({
      queryKey: getGetGridSummaryQueryKey(),
    });
    void queryClientInstance.invalidateQueries({
      queryKey: getGetNodesQueryKey(),
    });
    void queryClientInstance.invalidateQueries({
      queryKey: getGetAuditLogsQueryKey(),
    });
  };

  const jumpTo = (id: string) => {
    setActiveSection(id);
    setMobileNavOpen(false);
    document
      .getElementById(id)
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const submitNode = (event: React.FormEvent) => {
    event.preventDefault();
    if (
      !nodeDraft.name.trim() ||
      !nodeDraft.location.trim() ||
      !Number.isFinite(nodeDraft.capacity) ||
      nodeDraft.capacity < 0
    ) {
      setFeedback({
        kind: "error",
        message: "Add a name, location, and valid energy capacity to continue.",
      });
      return;
    }
    createNode.mutate(
      {
        data: {
          ...nodeDraft,
          name: nodeDraft.name.trim(),
          location: nodeDraft.location.trim(),
          capacity: Number(nodeDraft.capacity),
        },
      },
      {
        onSuccess: () => {
          setNodeModalOpen(false);
          setNodeDraft(emptyNode);
          setFeedback({
            kind: "success",
            message:
              "Node registered. Telemetry will appear as it comes online.",
          });
          void queryClientInstance.invalidateQueries({
            queryKey: getGetNodesQueryKey(),
          });
          void queryClientInstance.invalidateQueries({
            queryKey: getGetGridSummaryQueryKey(),
          });
        },
        onError: (error) =>
          setFeedback({ kind: "error", message: isApiError(error) }),
      },
    );
  };

  const onTradeResult = (result: TradeResult) => {
    setTradeResult(result);
    setFeedback({
      kind: result.status === "COMMITTED" ? "success" : "error",
      message: result.message,
    });
    void queryClientInstance.invalidateQueries({
      queryKey: getGetAuditLogsQueryKey(),
    });
    void queryClientInstance.invalidateQueries({
      queryKey: getGetNodesQueryKey(),
    });
    void queryClientInstance.invalidateQueries({
      queryKey: getGetGridSummaryQueryKey(),
    });
  };

  return (
    <div className="noise min-h-[100dvh] bg-background text-foreground">
      <div className="flex min-h-[100dvh]">
        <aside
          className={`fixed inset-y-0 left-0 z-40 flex w-[248px] flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground transition-transform duration-300 lg:static lg:translate-x-0 ${mobileNavOpen ? "translate-x-0" : "-translate-x-full"}`}
        >
          <div className="flex h-[72px] items-center justify-between border-b border-sidebar-border px-5">
            <button
              className="focus-ring flex items-center gap-3 text-left"
              onClick={() => jumpTo("control-room")}
              data-testid="button-brand-home"
            >
              <span className="relative grid h-9 w-9 place-items-center rounded-xl bg-sidebar-primary text-sidebar-primary-foreground shadow-[0_0_24px_hsl(var(--sidebar-primary)/.18)]">
                <Zap size={18} fill="currentColor" />
                <span className="absolute -right-1 -top-1 h-2 w-2 rounded-full bg-accent" />
              </span>
              <span>
                <span className="block text-sm font-extrabold tracking-tight">
                  FLUXGRID OS
                </span>
                <span className="mono block text-[9px] tracking-[.22em] text-sidebar-foreground/55">
                  by Akul Powers
                </span>
              </span>
            </button>
            <button
              className="grid h-8 w-8 place-items-center rounded-lg text-sidebar-foreground/60 hover:bg-sidebar-accent lg:hidden"
              onClick={() => setMobileNavOpen(false)}
              aria-label="Close navigation"
              data-testid="button-close-navigation"
            >
              <X size={17} />
            </button>
          </div>
          <div className="px-4 py-5">
            <p className="mb-2 px-2 text-[10px] font-bold uppercase tracking-[.18em] text-sidebar-foreground/40">
              Workspace
            </p>
            <nav className="space-y-1">
              {navItems.map(({ label, icon: Icon, id }) => (
                <button
                  key={id}
                  className={`focus-ring flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-xs font-semibold transition-colors ${activeSection === id ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-sidebar-foreground/60 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground"}`}
                  onClick={() => jumpTo(id)}
                  data-testid={`button-nav-${id}`}
                >
                  <Icon
                    size={16}
                    className={
                      activeSection === id ? "text-sidebar-primary" : ""
                    }
                  />
                  <span>{label}</span>
                  {activeSection === id && (
                    <span className="ml-auto h-1.5 w-1.5 rounded-full bg-sidebar-primary" />
                  )}
                </button>
              ))}
            </nav>
          </div>
          <div className="mt-auto px-4 pb-5">
            <div className="rounded-xl border border-sidebar-border bg-sidebar-accent/50 p-3">
              <div className="mb-2 flex items-center gap-2 text-xs font-semibold">
                <span className="signal-dot h-1.5 w-1.5 rounded-full bg-sidebar-primary" />{" "}
                Service connection
              </div>
              <div className="flex items-center justify-between">
                <span className="mono text-[10px] text-sidebar-foreground/50">
                  API STATUS
                </span>
                <span className="mono text-[10px] text-sidebar-primary">
                  {demoMode
                    ? "READ-ONLY DEMO"
                    : healthQuery.isError
                      ? "UNAVAILABLE"
                      : healthQuery.isSuccess
                        ? "CONNECTED"
                        : "CONNECTING"}
                </span>
              </div>
            </div>
            <div className="mt-5 flex items-center gap-3 border-t border-sidebar-border pt-4">
              <div className="grid h-8 w-8 place-items-center rounded-full bg-sidebar-primary/15 text-sidebar-primary">
                <UserRound size={15} />
              </div>
              <div className="min-w-0">
                <p className="truncate text-xs font-bold">Grid operations</p>
                <p className="truncate text-[10px] text-sidebar-foreground/45">
                  Grid Administrator
                </p>
              </div>
            </div>
          </div>
        </aside>
        {mobileNavOpen && (
          <button
            className="fixed inset-0 z-30 bg-slate-950/45 lg:hidden"
            onClick={() => setMobileNavOpen(false)}
            aria-label="Close menu overlay"
            data-testid="button-close-menu-overlay"
          />
        )}
        <main className="min-w-0 flex-1">
          <header className="sticky top-0 z-20 flex h-[72px] items-center justify-between border-b bg-background/90 px-4 backdrop-blur-md sm:px-6 lg:px-8">
            <div className="flex items-center gap-3">
              <button
                className="grid h-9 w-9 place-items-center rounded-lg border bg-card lg:hidden"
                onClick={() => setMobileNavOpen(true)}
                aria-label="Open navigation"
                data-testid="button-open-navigation"
              >
                <Menu size={18} />
              </button>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[.18em] text-muted-foreground">
                  Grid operations
                </p>
                <h1 className="text-base font-extrabold tracking-tight sm:text-lg">
                  Smart Micro-Grid Operations
                </h1>
              </div>
            </div>
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="hidden items-center gap-2 rounded-full border bg-card px-3 py-1.5 sm:flex">
                <span className="signal-dot h-1.5 w-1.5 rounded-full bg-primary" />
                <span className="mono text-[10px] text-muted-foreground">
                  {demoMode
                    ? "DEMO DATA"
                    : summaryQuery.isError
                      ? "SYNC ERROR"
                      : "AUTO REFRESH"}
                </span>
                <span className="text-[10px] font-bold text-primary">15s</span>
              </div>
              <button
                className="focus-ring grid h-9 w-9 place-items-center rounded-lg border bg-card text-muted-foreground transition-colors hover:text-foreground"
                onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
                aria-label="Toggle theme"
                data-testid="button-toggle-theme"
              >
                {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
              </button>
              <button
                className="focus-ring grid h-9 w-9 place-items-center rounded-lg border bg-card text-muted-foreground transition-colors hover:text-foreground"
                onClick={refreshAll}
                aria-label="Refresh grid telemetry"
                data-testid="button-refresh-grid"
              >
                <RefreshCw
                  size={16}
                  className={summaryQuery.isFetching ? "animate-spin" : ""}
                />
              </button>
            </div>
          </header>
          <div className="grid-surface min-h-[calc(100dvh-72px)] px-4 py-6 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-[1520px] space-y-6">
              <section
                className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end"
                id="control-room"
              >
                <div className="animate-rise-in">
                  <div className="mb-2 flex items-center gap-2 text-xs font-semibold text-primary">
                    <span className="h-px w-6 bg-primary" />
                    SYSTEM OVERVIEW
                  </div>
                  <h2 className="max-w-xl text-2xl font-extrabold tracking-[-.04em] sm:text-3xl">
                    The grid, at a glance.
                  </h2>
                  <p className="mt-2 max-w-xl text-sm text-muted-foreground">
                    Energy monitoring and trading activity across the Local Micro-Grid.
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <div className="rounded-lg border bg-card px-3 py-2 text-right">
                    <p className="text-[9px] font-bold uppercase tracking-[.13em] text-muted-foreground">
                      Last fetched
                    </p>
                    <p className="mono mt-0.5 text-xs">
                      {summaryQuery.dataUpdatedAt
                        ? formatTime(
                            new Date(summaryQuery.dataUpdatedAt).toISOString(),
                          )
                        : "—"}
                    </p>
                  </div>
                  <div
                    className={`rounded-lg border px-3 py-2 ${summary?.systemStatus === "LOAD SHEDDING ACTIVE" ? "border-accent/60 bg-accent/10" : "border-primary/25 bg-primary/5"}`}
                  >
                    <p className="text-[9px] font-bold uppercase tracking-[.13em] text-muted-foreground">
                      System state
                    </p>
                    <p className="mono mt-0.5 text-xs font-medium">
                      <StatusDot
                        status={summary?.systemStatus ?? "Awaiting data"}
                      />
                    </p>
                  </div>
                </div>
              </section>

              {demoMode && (
                <p
                  role="status"
                  className="rounded-lg border border-accent/40 bg-accent/10 p-3 text-xs"
                >
                  Read-only demo data. Connect the Java service to register
                  nodes and execute trades.
                </p>
              )}
              {summaryQuery.isError && (
                <InlineError
                  message={isApiError(summaryQuery.error)}
                  onRetry={() => void summaryQuery.refetch()}
                />
              )}
              <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                <StatCard
                  label="Total generation"
                  value={formatNumber(summary?.totalGenerationKw)}
                  unit="kW"
                  icon={Sun}
                  loading={summaryQuery.isLoading}
                />
                <StatCard
                  label="Total consumption"
                  value={formatNumber(summary?.totalConsumptionKw)}
                  unit="kW"
                  icon={Gauge}
                  tone="gold"
                  loading={summaryQuery.isLoading}
                />
                <StatCard
                  label="Net reserve / deficit"
                  value={formatNumber(summary?.netReserveKw)}
                  unit="kW"
                  icon={Activity}
                  loading={summaryQuery.isLoading}
                />
                <StatCard
                  label="Active nodes"
                  value={formatNumber(summary?.activeNodes, 0)}
                  icon={Radio}
                  tone="blue"
                  loading={summaryQuery.isLoading}
                />
                <StatCard
                  label="Dynamic energy price"
                  value={
                    summary ? "₹" + formatNumber(summary.currentPrice, 2) : "—"
                  }
                  unit="/ kWh"
                  icon={CircleDollarSign}
                  tone="gold"
                  loading={summaryQuery.isLoading}
                />
                <StatCard
                  label="Grid status"
                  value={summary?.systemStatus ?? "Awaiting data"}
                  icon={ShieldCheck}
                  loading={summaryQuery.isLoading}
                />
              </section>

              <section className="grid gap-6 xl:grid-cols-[minmax(0,1.55fr)_minmax(330px,.75fr)]">
                <article className="rounded-xl border bg-card p-5 shadow-sm sm:p-6">
                  <div className="mb-5 flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
                    <div>
                      <div className="flex items-center gap-2">
                        <LineChart size={16} className="text-primary" />
                        <h3 className="font-bold">
                          Generation vs. consumption
                        </h3>
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Generation and consumption history / kW
                      </p>
                    </div>
                    <div className="flex gap-4 text-[11px]">
                      <span className="flex items-center gap-1.5">
                        <span className="h-1.5 w-4 rounded-full bg-primary" />
                        Generation
                      </span>
                      <span className="flex items-center gap-1.5">
                        <span className="h-1.5 w-4 border-t-2 border-dashed border-accent" />
                        Consumption
                      </span>
                    </div>
                  </div>
                  <Sparkline
                    history={summary?.history}
                    loading={summaryQuery.isLoading}
                  />
                  <div className="mt-5 grid grid-cols-2 gap-3 border-t pt-4 sm:grid-cols-4">
                    <MiniMetric
                      label="Generated today"
                      value={
                        summary
                          ? `${formatNumber(summary.generatedToday)} kWh`
                          : "—"
                      }
                      icon={Sun}
                    />
                    <MiniMetric
                      label="Consumed today"
                      value={
                        summary
                          ? `${formatNumber(summary.consumedToday)} kWh`
                          : "—"
                      }
                      icon={BatteryCharging}
                    />
                    <MiniMetric
                      label="Net balance"
                      value={
                        summary
                          ? `${formatNumber(summary.generatedToday - summary.consumedToday)} kWh`
                          : "—"
                      }
                      icon={TrendingUp}
                    />
                    <MiniMetric
                      label="Renewable share"
                      value={
                        summary
                          ? `${formatNumber(summary.renewableShare)}%`
                          : "—"
                      }
                      icon={Leaf}
                    />
                  </div>
                </article>
                <PricingPanel summary={summary} />
              </section>

              <GridStability summary={summary} nodes={nodes} />

              <section className="grid gap-6 xl:grid-cols-[minmax(0,1.35fr)_minmax(360px,.65fr)]">
                <NodeRegistry
                  nodes={nodes}
                  loading={nodesQuery.isLoading}
                  error={
                    nodesQuery.isError
                      ? isApiError(nodesQuery.error)
                      : undefined
                  }
                  onRetry={() => void nodesQuery.refetch()}
                  onAdd={() => setNodeModalOpen(true)}
                  readOnly={demoMode}
                />
                <TradePanel
                  nodes={nodes}
                  price={price}
                  pending={createTrade.isPending}
                  result={tradeResult}
                  error={tradeError}
                  readOnly={demoMode || nodesQuery.isError}
                  onTrade={(data) => {
                    setTradeResult(null);
                    setTradeError(null);
                    createTrade.mutate(
                      { data },
                      {
                        onSuccess: onTradeResult,
                        onError: (error) => {
                          const recorded = error.data?.trade;
                          if (recorded) onTradeResult(recorded);
                          else
                            setTradeError(
                              isApiError(error) +
                                " No transaction outcome was confirmed. Refresh audit logs before retrying.",
                            );
                          refreshAll();
                        },
                      },
                    );
                  }}
                />
              </section>

              <section id="audit-stream">
                <AuditFeed
                  logs={auditLogs}
                  loading={auditQuery.isLoading}
                  error={
                    auditQuery.isError
                      ? isApiError(auditQuery.error)
                      : undefined
                  }
                  onRetry={() => void auditQuery.refetch()}
                />
              </section>
              <footer className="flex flex-col justify-between gap-2 border-t py-5 text-[10px] text-muted-foreground sm:flex-row">
                <span className="mono">FLUXGRID OS — by Akul Powers</span>
                <span className="flex items-center gap-1.5">
                  <ShieldCheck size={12} className="text-primary" /> Energy
                  monitoring & P2P trading
                </span>
              </footer>
            </div>
          </div>
        </main>
      </div>
      {feedback && (
        <div
          className={`fixed bottom-5 right-5 z-50 flex max-w-sm items-start gap-3 rounded-xl border p-4 shadow-lg ${feedback.kind === "success" ? "border-primary/30 bg-card" : "border-destructive/30 bg-card"}`}
          role="status"
          data-testid={`status-feedback-${feedback.kind}`}
        >
          <span
            className={`mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full ${feedback.kind === "success" ? "bg-primary/15 text-primary" : "bg-destructive/15 text-destructive"}`}
          >
            {feedback.kind === "success" ? (
              <Check size={14} />
            ) : (
              <AlertCircle size={14} />
            )}
          </span>
          <p className="text-xs font-semibold leading-5">{feedback.message}</p>
          <button
            className="ml-2 text-muted-foreground hover:text-foreground"
            onClick={() => setFeedback(null)}
            aria-label="Dismiss notification"
            data-testid="button-dismiss-feedback"
          >
            <X size={14} />
          </button>
        </div>
      )}
      {nodeModalOpen && (
        <NodeModal
          draft={nodeDraft}
          pending={createNode.isPending}
          onChange={setNodeDraft}
          onClose={() => setNodeModalOpen(false)}
          onSubmit={submitNode}
        />
      )}
    </div>
  );
}

function MiniMetric({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string;
  icon: typeof Activity;
}) {
  return (
    <div className="min-w-0">
      <div className="mb-1 flex items-center gap-1.5 text-[10px] text-muted-foreground">
        <Icon size={12} />
        {label}
      </div>
      <p className="mono truncate text-xs font-medium">{value}</p>
    </div>
  );
}

function InlineError({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  return (
    <div
      className="flex items-center justify-between gap-3 rounded-lg border border-destructive/25 bg-destructive/5 px-4 py-3 text-xs"
      data-testid="status-grid-error"
    >
      <span className="flex items-center gap-2 text-destructive">
        <AlertCircle size={15} />
        {message}
      </span>
      <button
        className="font-bold text-destructive underline underline-offset-2"
        onClick={onRetry}
        data-testid="button-retry-grid"
      >
        Retry
      </button>
    </div>
  );
}

function PricingPanel({ summary }: { summary?: GridSummary }) {
  return (
    <article className="rounded-xl border bg-card p-5 shadow-sm sm:p-6">
      <div className="mb-5 flex items-center gap-2">
        <CloudSun size={16} className="text-accent-foreground" />
        <h3 className="font-bold">Dynamic pricing breakdown</h3>
      </div>
      <div className="rounded-lg border bg-muted/45 p-4">
        <p className="text-xs text-muted-foreground">Current price</p>
        <p className="mono mt-1 text-3xl">
          {summary ? "₹" + formatNumber(summary.currentPrice, 2) : "—"}
          <span className="ml-1 text-xs text-muted-foreground">/ kWh</span>
        </p>
      </div>
      <dl className="mt-4 space-y-3 text-xs">
        {[
          [
            "Base rate",
            summary?.pricing
              ? "₹" + formatNumber(summary.pricing.baseRate, 2) + "/kWh"
              : "—",
          ],
          [
            "Supply-demand factor",
            summary?.pricing
              ? formatNumber(summary.pricing.supplyDemandFactor, 2) + "×"
              : "—",
          ],
          [
            "Peak hour factor",
            summary?.pricing
              ? formatNumber(summary.pricing.peakHourFactor, 2) + "×"
              : "—",
          ],
          [
            "Weather factor",
            summary?.pricing
              ? formatNumber(summary.pricing.weatherFactor, 2) + "×"
              : "—",
          ],
        ].map(([label, value]) => (
          <div className="flex justify-between gap-3" key={label}>
            <dt className="text-muted-foreground">{label}</dt>
            <dd className="mono">{value}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-4 border-t pt-3 text-xs text-muted-foreground">
        {summary?.pricing?.explanation ?? "Awaiting pricing data."}
      </p>
      <p className="mt-2 text-[11px] text-muted-foreground">
        Factors above 1 raise the rate; factors below 1 reduce it.
      </p>
    </article>
  );
}

function GridStability({
  summary,
  nodes,
}: {
  summary?: GridSummary;
  nodes: GridNode[];
}) {
  const deficit = summary !== undefined && summary.netReserveKw < 0;
  return (
    <article
      className={
        "rounded-xl border bg-card p-5 shadow-sm sm:p-6 " +
        (deficit ? "border-destructive/50" : "")
      }
    >
      <h3 className="flex items-center gap-2 font-bold">
        <ShieldCheck size={16} className="text-primary" />
        Grid stability & load shedding
      </h3>
      <div className="mt-4 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <MiniMetric
          label="Total generation"
          value={formatNumber(summary?.totalGenerationKw) + " kW"}
          icon={Sun}
        />
        <MiniMetric
          label="Total consumption"
          value={formatNumber(summary?.totalConsumptionKw) + " kW"}
          icon={Gauge}
        />
        <MiniMetric
          label="Net reserve / deficit"
          value={formatNumber(summary?.netReserveKw) + " kW"}
          icon={Activity}
        />
        <div className="text-xs">
          <p className="mb-1 text-muted-foreground">Grid status</p>
          <StatusDot status={summary?.systemStatus ?? "Awaiting data"} />
        </div>
      </div>
      {deficit && (
        <p
          role="status"
          className="mt-4 rounded-lg bg-destructive/10 p-3 text-xs text-destructive"
        >
          <strong>
            GRID DEFICIT DETECTED —{" "}
            {formatNumber(Math.abs(summary.netReserveKw))} kW
          </strong>
          . Load shedding may be required.
        </p>
      )}
      <p className="mt-4 text-xs text-muted-foreground">
        Load-shedding priorities and reported node statuses. Priority 1 services
        are protected.
      </p>
      <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
        {[...nodes]
          .sort((a, b) => a.priority - b.priority)
          .map((node) => (
            <div
              key={node.id}
              className="flex items-center justify-between gap-3 rounded-lg border bg-muted/20 p-3 text-xs"
            >
              <div>
                <p className="font-semibold">{node.name}</p>
                <p className="mt-1 text-[10px] text-muted-foreground">
                  Priority {node.priority} · {priorities[node.priority - 1]}
                </p>
                {node.priority === 1 && (
                  <p className="mt-1 font-bold text-primary">
                    Protected essential service
                  </p>
                )}
              </div>
              <StatusDot status={node.status} />
            </div>
          ))}
      </div>
      {!nodes.length && (
        <p className="mt-3 text-xs text-muted-foreground">
          No node priority data available.
        </p>
      )}
    </article>
  );
}

function NodeRegistry({
  nodes,
  loading,
  error,
  onRetry,
  onAdd,
  readOnly,
}: {
  nodes: GridNode[];
  loading: boolean;
  error?: string;
  onRetry: () => void;
  onAdd: () => void;
  readOnly: boolean;
}) {
  const [search, setSearch] = useState("");
  const [type, setType] = useState("");
  const [status, setStatus] = useState("");
  const [priority, setPriority] = useState("");
  const filtered = nodes.filter(
    (node) =>
      (!type || node.type === type) &&
      (!status || node.status === status) &&
      (!priority || node.priority === Number(priority)) &&
      `${node.id} ${node.name} ${node.location}`
        .toLowerCase()
        .includes(search.toLowerCase()),
  );
  const fieldClass =
    "focus-ring min-w-0 rounded-lg border bg-background p-2 text-xs";
  return (
    <article
      className="min-w-0 rounded-xl border bg-card p-5 shadow-sm sm:p-6"
      id="node-registry"
    >
      <div className="mb-5 flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Server size={16} className="text-primary" />
            <h3 className="font-bold">Node registry</h3>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Assets participating in the local grid
          </p>
        </div>
        <button
          disabled={readOnly}
          className="focus-ring flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-xs font-bold text-primary-foreground disabled:opacity-50"
          onClick={onAdd}
          data-testid="button-add-node"
        >
          <Plus size={14} />
          Register node
        </button>
      </div>
      <div className="mb-4 grid grid-cols-2 gap-2">
        <input
          className={fieldClass}
          aria-label="Search nodes"
          placeholder="Search ID, name or location"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        <select
          aria-label="Filter node type"
          className={fieldClass}
          value={type}
          onChange={(event) => setType(event.target.value)}
        >
          <option value="">All types</option>
          {nodeTypes.map((value) => (
            <option key={value}>{value}</option>
          ))}
        </select>
        <select
          aria-label="Filter node status"
          className={fieldClass}
          value={status}
          onChange={(event) => setStatus(event.target.value)}
        >
          <option value="">All statuses</option>
          {["ONLINE", "OFFLINE", "THROTTLED"].map((value) => (
            <option key={value}>{value}</option>
          ))}
        </select>
        <select
          aria-label="Filter node priority"
          className={fieldClass}
          value={priority}
          onChange={(event) => setPriority(event.target.value)}
        >
          <option value="">All priorities</option>
          {priorities.map((label, i) => (
            <option key={label} value={i + 1}>
              {i + 1} — {label}
            </option>
          ))}
        </select>
      </div>
      {error ? (
        <InlineError message={error} onRetry={onRetry} />
      ) : loading ? (
        <Skeleton className="h-48 w-full" />
      ) : !filtered.length ? (
        <p
          className="rounded-lg border border-dashed p-8 text-center text-xs"
          data-testid="empty-node-registry"
        >
          {nodes.length
            ? "No nodes match these filters."
            : "No nodes registered."}
        </p>
      ) : (
        <div className="scroll-thin overflow-x-auto">
          <table className="w-full min-w-[1050px] text-left text-xs">
            <thead>
              <tr className="border-b text-[10px] uppercase tracking-wider text-muted-foreground">
                {[
                  "Node / type",
                  "Location",
                  "Available energy (kWh)",
                  "Max capacity (kWh)",
                  "Output / load (kW)",
                  "Balance (₹)",
                  "Priority",
                  "Status",
                  "Last updated",
                ].map((label) => (
                  <th key={label} className="px-2 pb-3">
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((node) => (
                <tr
                  className="border-b last:border-0"
                  key={node.id}
                  data-testid={`row-node-${node.id}`}
                >
                  <td className="p-2">
                    <p className="font-bold">{node.name}</p>
                    <p className="mono mt-1">{node.id}</p>
                    <p className="mt-1 text-[10px] text-muted-foreground">
                      {node.type}
                    </p>
                  </td>
                  <td className="p-2">{node.location}</td>
                  <td className="p-2 mono">
                    {formatNumber(node.availableEnergyKwh)}
                  </td>
                  <td className="p-2 mono">{formatNumber(node.capacity)}</td>
                  <td
                    className={
                      "p-2 mono " +
                      (node.currentOutputKw > 0
                        ? "text-primary"
                        : "text-accent-foreground")
                    }
                  >
                    {node.currentOutputKw > 0 ? "+" : ""}
                    {formatNumber(node.currentOutputKw)}
                  </td>
                  <td className="p-2 mono">₹{formatNumber(node.balance, 2)}</td>
                  <td className="p-2" title={priorities[node.priority - 1]}>
                    {node.priority}
                    {node.priority === 1 && (
                      <span className="block text-[10px] text-primary">
                        Protected
                      </span>
                    )}
                  </td>
                  <td className="p-2">
                    <StatusDot status={node.status} />
                  </td>
                  <td className="p-2 mono">{formatDateTime(node.lastSeen)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </article>
  );
}

function TradePanel({
  nodes,
  price,
  pending,
  result,
  error,
  readOnly,
  onTrade,
}: {
  nodes: GridNode[];
  price: number | undefined;
  error: string | null;
  readOnly: boolean;
  pending: boolean;
  result: TradeResult | null;
  onTrade: (data: {
    sellerNodeId: string;
    buyerNodeId: string;
    energyAmount: number;
  }) => void;
}) {
  const [seller, setSeller] = useState("");
  const [buyer, setBuyer] = useState("");
  const [amount, setAmount] = useState("100");
  const total =
    price !== undefined && Number.isFinite(Number(amount))
      ? Number(amount) * price
      : undefined;
  const canTrade =
    !readOnly &&
    price !== undefined &&
    seller &&
    buyer &&
    seller !== buyer &&
    Number.isFinite(Number(amount)) &&
    Number(amount) > 0;
  return (
    <article
      className="rounded-xl border bg-card p-5 shadow-sm sm:p-6"
      id="market-execution"
    >
      <div className="mb-5 flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2">
            <ArrowLeftRight size={17} className="text-primary" />
            <h3 className="font-bold">Execute trade</h3>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Buy and sell energy between registered nodes
          </p>
        </div>
        <span className="rounded-md border border-primary/25 bg-primary/5 px-2 py-1 text-[9px] font-bold tracking-[.12em] text-primary">
          SECURE
        </span>
      </div>
      {readOnly && (
        <p className="mb-4 text-xs text-muted-foreground">
          Trading requires a connected service with current node data.
        </p>
      )}
      {error && (
        <p
          role="alert"
          className="mb-4 rounded-lg border border-destructive/30 p-3 text-xs text-destructive"
        >
          {error}
        </p>
      )}
      {result && (
        <div
          role="status"
          className={
            "mb-4 rounded-lg border p-3 " +
            (result.status === "COMMITTED"
              ? "border-primary/30 bg-primary/5"
              : "border-destructive/30 bg-destructive/5")
          }
          data-testid="card-trade-result"
        >
          <p className="text-sm font-bold">
            {result.status.replaceAll("_", " ")}
          </p>
          <p className="mt-1 text-xs">{result.message}</p>
          <dl className="mt-3 grid grid-cols-2 gap-2 text-xs">
            {Object.entries({
              "Transaction ID": result.id,
              Seller: result.sellerNodeId,
              Buyer: result.buyerNodeId,
              Energy: formatNumber(result.energyAmount) + " kWh",
              Price:
                result.pricePerKwh === undefined
                  ? "—"
                  : "₹" + formatNumber(result.pricePerKwh, 2) + "/kWh",
              "Total cost":
                result.totalCost === undefined
                  ? "—"
                  : "₹" + formatNumber(result.totalCost, 2),
              Timestamp: formatDateTime(result.settledAt),
            }).map(([label, value]) => (
              <div className="min-w-0 break-words" key={label}>
                <dt className="text-muted-foreground">{label}</dt>
                <dd className="mono mt-1">{value}</dd>
              </div>
            ))}
          </dl>
        </div>
      )}
      <form
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          if (canTrade)
            onTrade({
              sellerNodeId: seller,
              buyerNodeId: buyer,
              energyAmount: Number(amount),
            });
        }}
      >
        <TradeSelect
          label="Seller node"
          value={seller}
          onChange={setSeller}
          nodes={nodes}
          exclude={buyer}
          icon={ArrowUpRight}
        />
        <TradeSelect
          label="Buyer node"
          value={buyer}
          onChange={setBuyer}
          nodes={nodes}
          exclude={seller}
          icon={ArrowDownRight}
        />
        <label className="block">
          <span className="mb-1.5 block text-[11px] font-bold uppercase tracking-[.1em] text-muted-foreground">
            Energy amount
          </span>
          <div className="relative">
            <input
              className="focus-ring h-10 w-full rounded-lg border bg-background px-3 pr-14 text-sm mono outline-none transition-colors focus:border-primary"
              type="number"
              required
              min="0.001"
              step="any"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              data-testid="input-trade-energy"
            />
            <span className="absolute right-3 top-2.5 text-xs text-muted-foreground">
              kWh
            </span>
          </div>
        </label>
        <div className="rounded-lg border bg-muted/45 p-3">
          <div className="flex justify-between text-xs">
            <span className="text-muted-foreground">Current dynamic price</span>
            <span className="mono">₹{formatNumber(price, 3)} / kWh</span>
          </div>
          <div className="mt-2 flex justify-between border-t pt-2 text-xs">
            <span className="font-bold">Estimated total cost</span>
            <span className="mono text-base font-medium text-primary">
              ₹{formatNumber(total, 2)}
            </span>
          </div>
        </div>
        <p className="text-[11px] text-muted-foreground">
          Estimate only. The final price and total are confirmed when the trade
          is processed.
        </p>
        <button
          className="focus-ring flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-primary text-xs font-bold text-primary-foreground transition-transform hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50"
          disabled={!canTrade || pending}
          type="submit"
          data-testid="button-execute-trade"
        >
          {pending ? (
            <>
              <Loader2 size={15} className="animate-spin" /> Submitting trade
            </>
          ) : (
            <>
              <Send size={14} /> Execute trade
            </>
          )}
        </button>
      </form>
    </article>
  );
}

function TradeSelect({
  label,
  value,
  onChange,
  nodes,
  exclude,
  icon: Icon,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  nodes: GridNode[];
  exclude: string;
  icon: typeof ArrowUpRight;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[11px] font-bold uppercase tracking-[.1em] text-muted-foreground">
        {label}
      </span>
      <div className="relative">
        <Icon
          size={14}
          className="pointer-events-none absolute left-3 top-3 text-primary"
        />
        <select
          className="focus-ring h-10 w-full appearance-none rounded-lg border bg-background pl-9 pr-8 text-xs outline-none transition-colors focus:border-primary"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          data-testid={`select-${label.toLowerCase().replace(" ", "-")}`}
        >
          <option value="">Select a node</option>
          {nodes
            .filter((node) => node.id !== exclude)
            .map((node) => (
              <option value={node.id} key={node.id}>
                {node.name} · {node.type}
              </option>
            ))}
        </select>
        <ChevronDown
          size={14}
          className="pointer-events-none absolute right-3 top-3 text-muted-foreground"
        />
      </div>
    </label>
  );
}

function AuditFeed({
  logs,
  loading,
  error,
  onRetry,
}: {
  logs: AuditLog[];
  loading: boolean;
  error?: string;
  onRetry: () => void;
}) {
  return (
    <article className="rounded-xl border bg-card p-5 shadow-sm sm:p-6">
      <div className="mb-5 flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Clock3 size={16} className="text-primary" />
            <h3 className="font-bold">Audit logs</h3>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Recorded transactions and grid events / newest first
          </p>
        </div>
        <button
          className="flex items-center gap-1.5 text-xs font-bold text-muted-foreground"
          onClick={onRetry}
          data-testid="button-refresh-audit"
        >
          <RefreshCw size={13} />
          Refresh
        </button>
      </div>
      {error ? (
        <InlineError message={error} onRetry={onRetry} />
      ) : loading ? (
        <Skeleton className="h-40 w-full" />
      ) : !logs.length ? (
        <p
          className="rounded-lg border border-dashed p-7 text-center text-xs"
          data-testid="empty-audit-feed"
        >
          No events recorded.
        </p>
      ) : (
        <div className="scroll-thin overflow-x-auto">
          <table className="w-full min-w-[1100px] text-left text-xs">
            <thead>
              <tr className="border-b text-[10px] uppercase tracking-wider text-muted-foreground">
                {[
                  "Transaction / event ID",
                  "Timestamp",
                  "Event type",
                  "Seller",
                  "Buyer",
                  "Energy (kWh)",
                  "Price (₹/kWh)",
                  "Total (₹)",
                  "Status",
                  "Details / failure reason",
                ].map((label) => (
                  <th className="p-2" key={label}>
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[...logs]
                .sort(
                  (a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp),
                )
                .map((log) => (
                  <tr
                    key={log.id}
                    className="border-b last:border-0"
                    data-testid={`row-audit-${log.id}`}
                  >
                    <td className="p-2 mono">{log.id}</td>
                    <td className="p-2">{formatDateTime(log.timestamp)}</td>
                    <td className="p-2">{log.type.replaceAll("_", " ")}</td>
                    <td className="p-2 mono">{log.sellerNodeId ?? "—"}</td>
                    <td className="p-2 mono">{log.buyerNodeId ?? "—"}</td>
                    <td className="p-2 mono">
                      {formatNumber(log.energyAmount)}
                    </td>
                    <td className="p-2 mono">
                      {formatNumber(log.pricePerKwh, 2)}
                    </td>
                    <td className="p-2 mono">
                      {formatNumber(log.totalCost, 2)}
                    </td>
                    <td
                      className={
                        "p-2 font-bold " +
                        (["COMMITTED", "SUCCESS"].includes(log.status)
                          ? "text-primary"
                          : "text-destructive")
                      }
                    >
                      {log.status}
                    </td>
                    <td className="min-w-48 p-2">{log.message}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      )}
    </article>
  );
}

function NodeModal({
  draft,
  pending,
  onChange,
  onClose,
  onSubmit,
}: {
  draft: NodeInput;
  pending: boolean;
  onChange: (draft: NodeInput) => void;
  onClose: () => void;
  onSubmit: (event: React.FormEvent) => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="node-modal-title"
    >
      <div className="max-h-[90dvh] overflow-y-auto w-full max-w-md rounded-2xl border bg-card p-6 shadow-2xl animate-rise-in">
        <div className="mb-5 flex items-start justify-between">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[.16em] text-primary">
              Asset onboarding
            </p>
            <h2
              id="node-modal-title"
              className="mt-1 text-xl font-extrabold tracking-tight"
            >
              Register a grid node
            </h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Add an energy asset and its load-shedding priority.
            </p>
          </div>
          <button
            className="grid h-8 w-8 place-items-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"
            onClick={onClose}
            aria-label="Close register node dialog"
            data-testid="button-close-node-modal"
          >
            <X size={16} />
          </button>
        </div>
        <form className="space-y-4" onSubmit={onSubmit}>
          <label className="block">
            <span className="mb-1.5 block text-[11px] font-bold uppercase tracking-[.1em] text-muted-foreground">
              Node name
            </span>
            <input
              autoFocus
              className="focus-ring h-10 w-full rounded-lg border bg-background px-3 text-sm outline-none focus:border-primary"
              placeholder="e.g. Ridgeway rooftop array"
              required
              maxLength={120}
              value={draft.name}
              onChange={(event) =>
                onChange({ ...draft, name: event.target.value })
              }
              data-testid="input-node-name"
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-[11px] font-bold uppercase tracking-[.1em] text-muted-foreground">
              Node type
            </span>
            <select
              className="focus-ring h-10 w-full rounded-lg border bg-background px-3 text-sm outline-none focus:border-primary"
              value={draft.type}
              onChange={(event) =>
                onChange({
                  ...draft,
                  type: event.target.value as NodeInput["type"],
                })
              }
              data-testid="select-node-type"
            >
              {nodeTypes.map((type) => (
                <option value={type} key={type}>
                  {type}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="mb-1.5 block text-[11px] font-bold uppercase tracking-[.1em] text-muted-foreground">
              Maximum capacity (kWh)
            </span>
            <div className="relative">
              <input
                className="focus-ring h-10 w-full rounded-lg border bg-background px-3 pr-14 text-sm mono outline-none focus:border-primary"
                type="number"
                min="0"
                step="0.1"
                placeholder="0"
                value={draft.capacity || ""}
                onChange={(event) =>
                  onChange({ ...draft, capacity: Number(event.target.value) })
                }
                data-testid="input-node-capacity"
              />
              <span className="absolute right-3 top-2.5 text-xs text-muted-foreground">
                kWh
              </span>
            </div>
          </label>
          <label className="block">
            <span className="mb-1.5 block text-xs font-bold text-muted-foreground">
              Location
            </span>
            <input
              required
              maxLength={200}
              className="focus-ring h-10 w-full rounded-lg border bg-background px-3 text-sm"
              value={draft.location}
              onChange={(event) =>
                onChange({ ...draft, location: event.target.value })
              }
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-xs font-bold text-muted-foreground">
              Priority
            </span>
            <select
              className="focus-ring h-10 w-full rounded-lg border bg-background px-3 text-sm"
              value={draft.priority}
              onChange={(event) =>
                onChange({ ...draft, priority: Number(event.target.value) })
              }
            >
              {priorities.map((label, i) => (
                <option key={label} value={i + 1}>
                  {i + 1} — {label}
                </option>
              ))}
            </select>
          </label>
          <div className="flex gap-2 pt-2">
            <button
              className="h-10 flex-1 rounded-lg border text-xs font-bold hover:bg-muted"
              type="button"
              onClick={onClose}
              data-testid="button-cancel-node"
            >
              Cancel
            </button>
            <button
              className="flex h-10 flex-1 items-center justify-center gap-2 rounded-lg bg-primary text-xs font-bold text-primary-foreground disabled:opacity-50"
              type="submit"
              disabled={pending}
              data-testid="button-submit-node"
            >
              {pending ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <Plus size={14} />
              )}{" "}
              {pending ? "Registering" : "Register node"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function NotFound() {
  return (
    <div className="grid min-h-[100dvh] place-items-center bg-background p-6">
      <div className="text-center">
        <p className="mono text-sm text-primary">404 / SIGNAL LOST</p>
        <h1 className="mt-3 text-3xl font-extrabold">Route not found</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Return to the control room to restore your view.
        </p>
        <a
          className="mt-5 inline-flex rounded-lg bg-primary px-4 py-2 text-xs font-bold text-primary-foreground"
          href="/"
        >
          Open control room
        </a>
      </div>
    </div>
  );
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={AppShell} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <ErrorBoundary resetKey={window.location.pathname}>
            <Router />
          </ErrorBoundary>
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
