"use client";

import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/fetcher";
import type { Activity } from "@/types";
import { useShell } from "@/components/layout/app-shell";
import { useSocketEvent } from "@/hooks/use-socket";
import { EVENTS } from "@/server/events";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ActivityList } from "./activity-list";

export function ActivityView() {
  const { workspace } = useShell();
  const queryClient = useQueryClient();

  const { data, isLoading, fetchNextPage, hasNextPage, isFetchingNextPage } = useInfiniteQuery({
    queryKey: ["activity-feed", workspace.id],
    queryFn: ({ pageParam }) =>
      api<{ activities: Activity[]; nextCursor: string | null }>(
        `/api/workspaces/${workspace.id}/activity${pageParam ? `?cursor=${pageParam}` : ""}`
      ),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.nextCursor,
  });

  // Live updates: refresh the first page when anything happens.
  useSocketEvent(EVENTS.ACTIVITY_NEW, () => {
    queryClient.invalidateQueries({ queryKey: ["activity-feed", workspace.id] });
  });

  const activities = data?.pages.flatMap((p) => p.activities) ?? [];

  return (
    <div className="mx-auto w-full max-w-2xl p-4 sm:p-6">
      <div className="mb-6">
        <h2 className="text-2xl font-bold tracking-tight">
          <span className="gradient-text">Activity</span>
        </h2>
        <p className="text-sm text-muted-foreground">
          Everything that happened in {workspace.name}, live.
        </p>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} className="flex gap-3">
              <Skeleton className="h-7 w-7 rounded-full" />
              <div className="flex-1 space-y-1.5">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-24" />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <>
          <ActivityList activities={activities} />
          {hasNextPage && (
            <div className="mt-6 text-center">
              <Button
                variant="outline"
                onClick={() => fetchNextPage()}
                loading={isFetchingNextPage}
              >
                Load more
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
