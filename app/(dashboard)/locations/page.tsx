"use client";

import { useState } from "react";
import { useQuery } from "@apollo/client/react";
import { MapPin } from "lucide-react";
import { ADMIN_LOCATION_ANALYTICS } from "@/graphql/operations";
import type { AdminCountyPerformance } from "@/graphql/types";
import { formatNumber, formatRelative } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  CountTabs,
  EmptyState,
  ListToolbar,
  PageHeader,
  SearchInput,
  StatCard,
  TableSkeleton,
} from "@/components/shared/page";

/**
 * Supply by county: where sellers have live listings, and where people are on
 * Shopi with nothing local to buy — the places to recruit sellers next.
 */

type TabKey = "all" | "supply" | "outreach";

const hasSupply = (county: AdminCountyPerformance) => county.activePosts > 0;

export default function LocationsPage() {
  const [tab, setTab] = useState<TabKey>("outreach");
  const [search, setSearch] = useState("");
  const { data, loading } = useQuery(ADMIN_LOCATION_ANALYTICS, {
    variables: { days: 30 },
    fetchPolicy: "cache-and-network",
  });
  const analytics = data?.adminLocationAnalytics;
  const counties = analytics?.countyPerformance ?? [];

  const supplied = counties.filter(hasSupply);
  const unsupplied = counties.filter((county) => !hasSupply(county));
  // Outreach targets: people are already on Shopi there, and nobody sells.
  const outreach = unsupplied.filter((county) => county.peopleCount > 0);
  const peopleWithoutSupply = outreach.reduce((sum, county) => sum + county.peopleCount, 0);

  const base = tab === "supply" ? supplied : tab === "outreach" ? outreach : counties;
  const needle = search.trim().toLowerCase();
  // Outreach is ranked by how many people are waiting; supply by what's live.
  const rows = (needle ? base.filter((c) => c.countyName.toLowerCase().includes(needle)) : [...base]).sort(
    (a, b) =>
      tab === "outreach"
        ? b.peopleCount - a.peopleCount || a.countyName.localeCompare(b.countyName)
        : b.activePosts - a.activePosts || b.peopleCount - a.peopleCount,
  );

  return (
    <>
      <PageHeader title="Locations" description="Where sellers are, and where people are waiting for them." />

      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard
          label="Counties with live listings"
          value={analytics ? `${supplied.length} of ${counties.length}` : undefined}
          hint={analytics ? `${formatNumber(analytics.activePosts)} live listings` : undefined}
        />
        <StatCard
          label="Counties with nothing live"
          value={analytics ? formatNumber(unsupplied.length) : undefined}
          hint={analytics ? `${outreach.length} already have people waiting` : undefined}
        />
        <StatCard
          label="People in those counties"
          value={analytics ? formatNumber(peopleWithoutSupply) : undefined}
          hint="Signed up, but nothing local to buy"
        />
      </div>

      <Card className="overflow-hidden">
        <ListToolbar
          tabs={
            <CountTabs
              tabs={[
                { key: "outreach" as const, label: "Needs outreach", count: analytics ? outreach.length : undefined, attention: true },
                { key: "supply" as const, label: "Has supply", count: analytics ? supplied.length : undefined },
                { key: "all" as const, label: "All counties", count: analytics ? counties.length : undefined },
              ]}
              value={tab}
              onChange={setTab}
            />
          }
        >
          <SearchInput value={search} onChange={setSearch} placeholder="Find a county" className="sm:w-56" />
        </ListToolbar>

        {loading && !analytics ? (
          <TableSkeleton />
        ) : rows.length === 0 ? (
          <EmptyState icon={MapPin} title={search ? "No county by that name" : "None here"} />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>County</TableHead>
                <TableHead className="text-right">Live listings</TableHead>
                <TableHead className="text-right">Sellers</TableHead>
                <TableHead className="text-right">People</TableHead>
                <TableHead className="text-right">Views</TableHead>
                <TableHead>Last listed</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((county) => (
                <TableRow key={county.countyId}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-foreground">{county.countyName}</span>
                      {!hasSupply(county) && county.peopleCount > 0 && <Badge variant="warning">Needs sellers</Badge>}
                    </div>
                    {county.topCategory && <p className="text-xs text-muted">Mostly {county.topCategory}</p>}
                  </TableCell>
                  <TableCell className="text-right font-medium tabular-nums">
                    {formatNumber(county.activePosts)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{formatNumber(county.activeCreatorCount)}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatNumber(county.peopleCount)}</TableCell>
                  <TableCell className="text-right tabular-nums text-muted">{formatNumber(county.totalViews)}</TableCell>
                  <TableCell className="whitespace-nowrap text-muted">
                    {county.latestPostAt ? formatRelative(county.latestPostAt) : "Never"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>

      <p className="text-xs text-placeholder">
        People are placed by the location they saved on a post, or else roughly by the network they signed up on.
      </p>
    </>
  );
}
