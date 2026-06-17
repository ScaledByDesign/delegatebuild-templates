import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  LayoutGrid,
  Plus,
  Trash2,
  Check,
  ListTodo,
  CircleDot,
  CheckCircle2,
  Gauge,
} from "lucide-react";
import { AppScrollContainer } from "@/components/webos/AppScrollContainer";
import {
  AppLoadingState,
  EmptyState,
  ErrorBlock,
  FilterTabs,
  KV,
  ListRow,
  MetricCard,
  Section,
  SidebarItem,
  StatusPill,
  WindowDrawer,
  useConfirm,
} from "@/components/webos/shared";
import { cn } from "@/lib/utils";

/**
 * Sample Delegate WebOS-native app — built to look like a first-party Delegate
 * WebOS app (sidebar + content shell, brand header, KPI cards, filter tabs,
 * Section/ListRow), the same idioms as the Stripe / ecom apps.
 *
 * Anatomy to copy for a generated app:
 *   - data-testid="app-{appId}" root, flex sidebar + content frame
 *   - <AppScrollContainer> for every scroll surface (sidebar nav + content)
 *   - MetricCard KPI grid, FilterTabs, Section/ListRow/KV, _shared states
 *   - semantic theme tokens + fs-* fonts only; self-contained /api/* data
 */

type Item = { id: string; title: string; done: boolean; createdAt: string };

const APP_ID = "delegate-webos-app";
type View = "overview" | "items";
type Filter = "all" | "open" | "done";

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  if (!res.ok) throw new Error(`Request failed (${res.status})`);
  return res.json() as Promise<T>;
}

export function WebOSHome() {
  const qc = useQueryClient();
  const { confirm, ConfirmDialog } = useConfirm();
  const [view, setView] = useState<View>("overview");
  const [filter, setFilter] = useState<Filter>("all");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [newTitle, setNewTitle] = useState("");

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["items"],
    queryFn: () => api<{ items: Item[] }>("/api/items"),
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["items"] });

  const createItem = useMutation({
    mutationFn: (title: string) =>
      api<{ item: Item }>("/api/items", { method: "POST", body: JSON.stringify({ title }) }),
    onSuccess: () => {
      setNewTitle("");
      setDrawerOpen(false);
      invalidate();
    },
  });

  const toggleItem = useMutation({
    mutationFn: (item: Item) =>
      api<{ item: Item }>(`/api/items/${item.id}`, {
        method: "PATCH",
        body: JSON.stringify({ done: !item.done }),
      }),
    onSuccess: invalidate,
  });

  const deleteItem = useMutation({
    mutationFn: (id: string) => api<{ ok: true }>(`/api/items/${id}`, { method: "DELETE" }),
    onSuccess: invalidate,
  });

  const items = data?.items ?? [];
  const openCount = items.filter((i) => !i.done).length;
  const doneCount = items.length - openCount;
  const completion = items.length ? Math.round((doneCount / items.length) * 100) : 0;

  const visibleItems = items.filter((i) =>
    filter === "open" ? !i.done : filter === "done" ? i.done : true
  );

  const askDelete = async (item: Item) => {
    const ok = await confirm({
      title: "Delete item",
      message: `Delete "${item.title}"?`,
      confirmLabel: "Delete",
      destructive: true,
    });
    if (ok) deleteItem.mutate(item.id);
  };

  const itemList = (
    <Section
      icon={<ListTodo className="h-3.5 w-3.5" />}
      title="Items"
      action={
        <FilterTabs
          tabs={[
            { id: "all", label: "All", count: items.length },
            { id: "open", label: "Open", count: openCount },
            { id: "done", label: "Done", count: doneCount },
          ]}
          active={filter}
          onChange={(id) => setFilter(id as Filter)}
          testId={`${APP_ID}-filter`}
        />
      }
    >
      {visibleItems.length === 0 ? (
        <EmptyState
          icon={<ListTodo className="h-8 w-8" />}
          title="No items"
          description="Create your first item to see the WebOS list pattern."
          action={{ label: "Add item", onClick: () => setDrawerOpen(true) }}
          testId={`${APP_ID}-empty`}
        />
      ) : (
        visibleItems.map((item) => (
          <ListRow key={item.id}>
            <button
              onClick={() => toggleItem.mutate(item)}
              aria-label={item.done ? "Mark incomplete" : "Mark complete"}
              className={cn(
                "flex h-5 w-5 shrink-0 items-center justify-center rounded border transition-colors",
                item.done
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border hover:border-primary"
              )}
            >
              {item.done ? <Check className="h-3.5 w-3.5" /> : null}
            </button>
            <span
              className={cn(
                "flex-1 truncate text-fs-sm",
                item.done ? "text-muted-foreground line-through" : "text-foreground"
              )}
            >
              {item.title}
            </span>
            <StatusPill label={item.done ? "Done" : "Open"} tone={item.done ? "success" : "info"} />
            <button
              onClick={() => askDelete(item)}
              aria-label="Delete"
              className="rounded p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-destructive"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </ListRow>
        ))
      )}
    </Section>
  );

  return (
    <div
      data-testid={`app-${APP_ID}`}
      className="flex h-full w-full overflow-hidden bg-background text-foreground"
    >
      {/* Sidebar */}
      <aside className="hidden w-56 shrink-0 flex-col border-r border-border bg-card sm:flex">
        <div className="border-b border-border px-4 py-3">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary/10">
              <LayoutGrid className="h-4 w-4 text-primary" />
            </div>
            <div className="min-w-0">
              <p className="truncate text-fs-sm font-semibold text-foreground">My WebOS App</p>
              <div className="flex items-center gap-1">
                <span className="inline-block h-1.5 w-1.5 rounded-full bg-green-500" />
                <span className="text-fs-3xs text-muted-foreground">Connected</span>
              </div>
            </div>
          </div>
        </div>
        <nav className="flex min-h-0 flex-1 flex-col">
          <AppScrollContainer innerClassName="p-2 space-y-0.5">
            <SidebarItem
              icon={<Gauge className="h-4 w-4" />}
              label="Overview"
              active={view === "overview"}
              onClick={() => setView("overview")}
              testId={`${APP_ID}-nav-overview`}
            />
            <SidebarItem
              icon={<ListTodo className="h-4 w-4" />}
              label="Items"
              active={view === "items"}
              onClick={() => setView("items")}
              testId={`${APP_ID}-nav-items`}
            />
          </AppScrollContainer>
        </nav>
      </aside>

      {/* Content */}
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        {/* Toolbar */}
        <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
          <div className="flex items-center gap-2">
            <h1 className="text-fs-md font-semibold capitalize">{view}</h1>
            <StatusPill
              label={`${openCount} open`}
              tone={openCount > 0 ? "info" : "success"}
              testId={`${APP_ID}-status`}
            />
          </div>
          <button
            data-testid={`${APP_ID}-new`}
            onClick={() => setDrawerOpen(true)}
            className="flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-fs-base font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            <Plus className="h-4 w-4" />
            New
          </button>
        </div>

        {isLoading ? (
          <AppLoadingState testId={`${APP_ID}-loading`} />
        ) : error ? (
          <ErrorBlock
            error={(error as Error).message}
            onRetry={refetch}
            testId={`${APP_ID}-error`}
          />
        ) : (
          <AppScrollContainer innerClassName="p-4 space-y-4" testId={`${APP_ID}-scroll`}>
            {view === "overview" ? (
              <>
                <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
                  <MetricCard
                    icon={ListTodo}
                    label="Total items"
                    value={items.length}
                    tone="primary"
                    testId={`${APP_ID}-kpi-total`}
                  />
                  <MetricCard
                    icon={CircleDot}
                    label="Open"
                    value={openCount}
                    tone="info"
                    testId={`${APP_ID}-kpi-open`}
                  />
                  <MetricCard
                    icon={CheckCircle2}
                    label="Completion"
                    value={`${completion}%`}
                    hint={`${doneCount} done`}
                    tone="success"
                    testId={`${APP_ID}-kpi-completion`}
                  />
                </div>

                <Section icon={<Gauge className="h-3.5 w-3.5" />} title="Summary">
                  <KV label="Total" value={items.length} />
                  <KV label="Open" value={openCount} />
                  <KV label="Done" value={doneCount} />
                  <KV label="Completion" value={`${completion}%`} />
                </Section>

                {itemList}
              </>
            ) : (
              itemList
            )}
          </AppScrollContainer>
        )}
      </div>

      {/* New-item drawer */}
      <WindowDrawer open={drawerOpen} onOpenChange={setDrawerOpen} title="New item">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (newTitle.trim()) createItem.mutate(newTitle.trim());
          }}
          className="space-y-3"
        >
          <label className="block text-fs-sm font-medium text-foreground-subtle">Title</label>
          <input
            autoFocus
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            placeholder="What needs doing?"
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-fs-base text-foreground outline-none focus:ring-2 focus:ring-ring"
          />
          <button
            type="submit"
            disabled={!newTitle.trim() || createItem.isPending}
            className="w-full rounded-md bg-primary px-3 py-2 text-fs-base font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
          >
            {createItem.isPending ? "Adding…" : "Add item"}
          </button>
        </form>
      </WindowDrawer>

      <ConfirmDialog />
    </div>
  );
}
