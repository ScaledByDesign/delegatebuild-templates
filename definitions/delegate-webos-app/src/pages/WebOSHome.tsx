import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { LayoutGrid, Plus, Trash2, Check, ListTodo } from "lucide-react";
import { AppScrollContainer } from "@/components/webos/AppScrollContainer";
import {
  AppLoadingState,
  EmptyState,
  ErrorBlock,
  SectionHeader,
  StatusPill,
  WindowDrawer,
  useConfirm,
} from "@/components/webos/shared";
import { cn } from "@/lib/utils";

/**
 * Sample Delegate WebOS-native app.
 *
 * Demonstrates the WebOS app anatomy a generated app should follow:
 *   - data-testid="app-{appId}" root
 *   - <AppScrollContainer> for the scroll surface
 *   - _shared primitives (loading / empty / error / section header / status pill /
 *     window drawer / confirm dialog)
 *   - semantic theme tokens + fs-* fonts only (no raw colors, no px font sizes)
 *   - self-contained data via this app's own Worker (/api/items)
 *
 * Replace this with the real app. Keep the patterns.
 */

type Item = { id: string; title: string; done: boolean; createdAt: string };

const APP_ID = "delegate-webos-app";

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

  return (
    <div
      data-testid={`app-${APP_ID}`}
      className="relative flex h-full flex-col bg-background text-foreground"
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
        <div className="flex items-center gap-2">
          <LayoutGrid className="h-4 w-4 text-primary" />
          <span className="text-fs-md font-semibold">My WebOS App</span>
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

      {/* Body */}
      {isLoading ? (
        <AppLoadingState testId={`${APP_ID}-loading`} />
      ) : error ? (
        <ErrorBlock error={(error as Error).message} onRetry={refetch} testId={`${APP_ID}-error`} />
      ) : items.length === 0 ? (
        <EmptyState
          icon={<ListTodo className="h-8 w-8" />}
          title="No items yet"
          description="Create your first item to see the WebOS list pattern in action."
          action={{ label: "Add item", onClick: () => setDrawerOpen(true) }}
          testId={`${APP_ID}-empty`}
        />
      ) : (
        <>
          <SectionHeader icon={<ListTodo className="h-3.5 w-3.5" />} title="Items" />
          <AppScrollContainer innerClassName="px-4 pb-4" testId={`${APP_ID}-scroll`}>
            <ul className="space-y-1.5">
              {items.map((item) => (
                <li
                  key={item.id}
                  className="flex items-center gap-3 rounded-md border border-border bg-card px-3 py-2"
                >
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
                      "flex-1 truncate text-fs-base",
                      item.done ? "text-muted-foreground line-through" : "text-foreground"
                    )}
                  >
                    {item.title}
                  </span>
                  <button
                    onClick={async () => {
                      const ok = await confirm({
                        title: "Delete item",
                        message: `Delete "${item.title}"?`,
                        confirmLabel: "Delete",
                        destructive: true,
                      });
                      if (ok) deleteItem.mutate(item.id);
                    }}
                    aria-label="Delete"
                    className="rounded p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </li>
              ))}
            </ul>
          </AppScrollContainer>
        </>
      )}

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
