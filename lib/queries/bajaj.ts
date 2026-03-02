"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type {
  BajajModule,
  BajajStatus,
  BajajBoardConfig,
  BajajWorkOrder,
  BajajComment,
  BajajUser,
  BajajAuditLog,
  BajajAnalytics,
  WorkOrderFilters,
  BajajReminder,
} from "@/lib/types/bajaj";

// Static demo data for the Bajaj module so everything works offline.
const now = new Date().toISOString();

const demoModules: BajajModule[] = [
  {
    id: "mod-vipar",
    name: "VIPAR",
    slug: "vipar",
    display_order: 1,
    created_at: now,
  } as BajajModule,
  {
    id: "mod-srilanka",
    name: "Sri Lanka",
    slug: "srilanka",
    display_order: 2,
    created_at: now,
  } as BajajModule,
  {
    id: "mod-nigeria",
    name: "Nigeria",
    slug: "nigeria",
    display_order: 3,
    created_at: now,
  } as BajajModule,
  {
    id: "mod-bangladesh",
    name: "Bangladesh",
    slug: "bangladesh",
    display_order: 4,
    created_at: now,
  } as BajajModule,
  {
    id: "mod-triumph",
    name: "Triumph",
    slug: "triumph",
    display_order: 5,
    created_at: now,
  } as BajajModule,
];

// Canonical 7 statuses with colors based on the legend.
const STATUS_DEFS = [
  { key: "take-booking", name: "Take Booking", color_hex: "6B7280", order: 0 },
  { key: "booking-available", name: "Booking available to be released", color_hex: "F97316", order: 1 },
  { key: "bookings-to-planned", name: "Bookings to Planned", color_hex: "EC4899", order: 2 },
  { key: "booking-release", name: "Booking Release", color_hex: "06B6D4", order: 3 },
  { key: "si-filling-complete", name: "SI Filling Complete", color_hex: "22C55E", order: 4 },
  { key: "haz-container-yes", name: "HAZ Container (Yes)", color_hex: "EF4444", order: 5 },
  { key: "shipment-complete", name: "Shipment Complete", color_hex: "FACC15", order: 6 },
] as const;

const demoStatuses: BajajStatus[] = demoModules.flatMap((mod) =>
  STATUS_DEFS.map(
    (s) =>
      ({
        id: `st-${mod.slug}-${s.key}`,
        module_id: mod.id,
        name: s.name,
        color_hex: s.color_hex,
        display_order: s.order,
      } as BajajStatus),
  ),
);

function getModuleBySlug(slug: string): BajajModule | undefined {
  return demoModules.find((m) => m.slug === slug);
}

function getStatusesForModule(moduleId: string): BajajStatus[] {
  return demoStatuses
    .filter((s) => s.module_id === moduleId)
    .sort((a, b) => a.display_order - b.display_order);
}

function getStatusIdForIndex(moduleId: string, index: number): string {
  const statuses = getStatusesForModule(moduleId);
  if (statuses.length === 0) return "";
  const s = statuses[index % statuses.length];
  return s.id;
}

function getBoardConfigForModule(moduleId: string): BajajBoardConfig {
  return {
    module_id: moduleId,
    card_face_fields: ["WO", "Vessel Name", "Veh", "Qty", "Port", "CONTAINER NO"],
    unique_key_field: "WO",
    updated_at: now,
  } as BajajBoardConfig;
}

// Helper to build a demo work order
function createWorkOrder(
  id: string,
  moduleId: string,
  statusIndex: number,
  columnOrder: number,
  data: Record<string, unknown>,
): BajajWorkOrder {
  return {
    id,
    module_id: moduleId,
    status_id: getStatusIdForIndex(moduleId, statusIndex),
    data,
    assigned_to: null,
    column_order: columnOrder,
    import_batch_id: null,
    created_at: now,
    updated_at: now,
  } as BajajWorkOrder;
}

// Seed Sri Lanka demo data using the provided snippet (subset of columns)
const srilankaModule = getModuleBySlug("srilanka");

const srilankaWorkOrders: BajajWorkOrder[] = srilankaModule
  ? [
      createWorkOrder("sl-5467714", srilankaModule.id, 6, 0, {
        WO: "5467714",
        Port: "COLOMBO",
        Country: "Sri Lanka",
        Veh: "RE4S",
        Qty: "264",
        Cont: "12",
        Type: "40HC",
        "Stuffing on": "29-01-26",
        "S/LINE": "EVERGREEN",
        "Vessel Name": "ONE THESEUS V-0098E",
        Agent: "BHATIA",
        TRANSPORTER: "JAYSHREE",
        Plant: "WA10",
        "PO NO": "POR004202601008",
        "LC NO": "711010236746-L",
        "LC DATE": "26-Mar",
        HAZ: "NO",
        CONSIGNEE: "DPMC",
        "REMARK 1": "",
        "D/O GIVEN DT": "28-Jan",
        "BOOKING NO": "100650021506",
        "CONTAINER NO":
          "TXGU5623681 EMCU1796034 EMCU1661698 EGSU1166986 EMCU1518408 EGSU1371131 EITU9538069 GAOU6675065 EGSU6260980 EGSU1189322 EGSU1291993 EGSU1183480",
        "POL GATE": "NSICT",
        "GATE OPEN": "28-01-26",
        "GATE CUT OFF": "31-01-26",
        "SI CUT OFF": "31-01-26",
        "DO ETD": "02-02-26",
        "CURRENT ETD": "03-02-2026",
      }),
      createWorkOrder("sl-5467716", srilankaModule.id, 5, 1, {
        WO: "5467716",
        Port: "COLOMBO",
        Country: "Sri Lanka",
        Veh: "RE4S",
        Qty: "264",
        Cont: "12",
        Type: "40HC",
        "Stuffing on": "02-Feb",
        "S/LINE": "EVERGREEN",
        "Vessel Name": "CONDOR V-13E",
        Agent: "BHATIA",
        TRANSPORTER: "JAYSHREE",
        Plant: "WA10",
        "PO NO": "POR004202601010",
        "LC NO": "711010236746-L",
        "LC DATE": "26-Mar",
        HAZ: "NO",
        CONSIGNEE: "DPMC",
        "BOOKING NO": "100650022278",
        "CONTAINER NO":
          "EGSU1546100 EGHU8223385 EITU9451117 EITU9319862 DFSU7118318 TXGU5675221 EGSU6203418 EGSU1091233 TGBU6743781 TGBU6517552 TRHU8151580 EMCU1747071",
        "POL GATE": "GTI",
      }),
      createWorkOrder("sl-5584279", srilankaModule.id, 4, 2, {
        WO: "5584279",
        Port: "COLOMBO",
        Country: "Sri Lanka",
        Veh: "CT 100 AW ES - FRAMES",
        Qty: "0",
        Cont: "1",
        Type: "40HC",
        "Stuffing on": "02-Mar",
        "S/LINE": "EVERGREEN",
        "Vessel Name": "CONDOR V-13E",
        Agent: "LINKS",
        TRANSPORTER: "OMKAR",
        Plant: "WA01",
        "PO NO": "5232671",
        "LC NO": "497612548267",
        "LC DATE": "16-Mar",
        HAZ: "NO",
        CONSIGNEE: "DPMC",
        "BOOKING NO": "100650025978",
        "CONTAINER NO": "TXGU5539776",
        "POL GATE": "GTI",
      }),
      createWorkOrder("sl-5584281", srilankaModule.id, 3, 3, {
        WO: "5584281",
        Port: "COLOMBO",
        Country: "Sri Lanka",
        Veh: "CT 100 AW ES - FRAMES",
        Qty: "0",
        Cont: "1",
        Type: "40HC",
        "Stuffing on": "02-Mar",
        "S/LINE": "EVERGREEN",
        "Vessel Name": "CONDOR V-13E",
        Agent: "LINKS",
        TRANSPORTER: "OMKAR",
        Plant: "WA01",
        "PO NO": "5232672",
        "LC NO": "497612548267",
        "LC DATE": "16-Mar",
        HAZ: "NO",
        CONSIGNEE: "DPMC",
        "BOOKING NO": "100650025978",
        "CONTAINER NO": "TIIU4875598",
        "POL GATE": "GTI",
      }),
      createWorkOrder("sl-5467446", srilankaModule.id, 2, 4, {
        WO: "5467446",
        Port: "COLOMBO",
        Country: "Sri Lanka",
        Veh: "PULSAR NS 200 FI DC ABS",
        Qty: "315",
        Cont: "5",
        Type: "40HC",
        "Stuffing on": "02-Mar",
        "S/LINE": "SINO",
        "Vessel Name": "REN JIAN 19 V-2601E",
        Agent: "LINKS",
        TRANSPORTER: "JAYSHREE",
        Plant: "CH01",
        "PO NO": "POR002202601035",
        "LC NO": "711010236568-L",
        "LC DATE": "23-Mar",
        HAZ: "NO",
        CONSIGNEE: "DPMC",
        "BOOKING NO": "SNL/00207/0126-1",
        "CONTAINER NO": "SNBU8278300 TIIU6329301 WSDU4988394 SNBU8468471 CAAU8681384",
        "POL GATE": "BMCT",
      }),
      createWorkOrder("sl-5467715", srilankaModule.id, 1, 5, {
        WO: "5467715",
        Port: "COLOMBO",
        Country: "Sri Lanka",
        Veh: "RE4S",
        Qty: "264",
        Cont: "12",
        Type: "40HC",
        "Stuffing on": "30-01-26",
        "S/LINE": "ONE",
        "Vessel Name": "GREENHOUSE V-0004E",
        Agent: "BHATIA",
        TRANSPORTER: "JAYSHREE",
        Plant: "WA10",
        "BOOKING NO": "PNQG00682400",
        "CONTAINER NO":
          "FCIU9765074 BEAU5355823 CAIU8950275 KKFU8117162 TRHU4255020 TCLU8850884 TGBU4402446 TCLU1646668 CAIU9886648 NYKU5286961 TRHU7385290 NYKU5100465",
        HAZ: "NO",
        CONSIGNEE: "DPMC",
      }),
      createWorkOrder("sl-5584280", srilankaModule.id, 0, 6, {
        WO: "5584280",
        Port: "COLOMBO",
        Country: "Sri Lanka",
        Veh: "CT 100 AW ES - PARTS",
        Qty: "276",
        Cont: "2",
        Type: "40HC",
        "Stuffing on": "02-Mar",
        "S/LINE": "EVERGREEN",
        "Vessel Name": "GREENHOUSE V-0004E",
        Agent: "LINKS",
        TRANSPORTER: "OMKAR",
        Plant: "WA01",
        "BOOKING NO": "100650025994",
        "CONTAINER NO": "EMCU8815250 EGSU6205956",
        HAZ: "NO",
        CONSIGNEE: "DPMC",
      }),
    ]
  : [];

const srilankaExtraWorkOrders: BajajWorkOrder[] = srilankaModule
  ? (() => {
      const vessels = [
        { vesselName: "CONDOR V-13E", line: "EVERGREEN" },
        { vesselName: "GREENHOUSE V-0004E", line: "ONE" },
        { vesselName: "XIN SHANGHAI 159E", line: "SINO" },
        { vesselName: "MSC MAUREEN IV607A", line: "MSC" },
        { vesselName: "REN JIAN 19 V-2601E", line: "SINO" },
        { vesselName: "ONE THESEUS V-0098E", line: "EVERGREEN" },
      ] as const;

      const mkContainer = (prefix: string, n: number) =>
        `${prefix}${String(7000000 + n).padStart(7, "0")}`;

      const mkEtd = (day: number) =>
        new Date(Date.now() + day * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

      const items: BajajWorkOrder[] = [];
      const baseWo = 5467800;

      for (let i = 1; i <= 20; i++) {
        const wo = String(baseWo + i);
        const statusIndex = i % 7; // spread across all 7 columns
        const vessel = vessels[i % vessels.length];

        const isParts = i % 5 === 0;
        const isFrames = i % 7 === 0;
        const veh = isParts
          ? "CT 100 AW ES - PARTS"
          : isFrames
            ? "CT 100 AW ES - FRAMES"
            : i % 3 === 0
              ? "PULSAR N 160"
              : i % 3 === 1
                ? "RE4S"
                : "DISCOVER 125";

        const containerPrefix = isParts ? "EMCU" : isFrames ? "TIIU" : "TGBU";
        const containerCount = isParts ? 2 : isFrames ? 1 : i % 4 === 0 ? 2 : 1;
        const containers = Array.from({ length: containerCount }, (_, idx) =>
          mkContainer(containerPrefix, i * 10 + idx),
        );

        const hasBl = statusIndex >= 5; // later columns tend to have BL in real flows
        const blNo = hasBl ? `BSPL/COL/DEMO-${wo.slice(-3)}` : "";

        items.push(
          createWorkOrder(
            `sl-extra-${wo}`,
            srilankaModule.id,
            statusIndex,
            100 + i,
            {
              WO: wo,
              Port: "COLOMBO",
              Country: "Sri Lanka",
              Veh: veh,
              Qty: isFrames ? "0" : isParts ? "192" : String(180 + (i % 6) * 10),
              Cont: String(containerCount),
              Type: "40HC",
              "Stuffing on": mkEtd(i),
              "S/LINE": vessel.line,
              "Vessel Name": vessel.vesselName,
              Agent: i % 2 === 0 ? "BHATIA" : "LINKS",
              TRANSPORTER: i % 2 === 0 ? "JAYSHREE" : "OMKAR",
              Plant: i % 2 === 0 ? "WA10" : "WA01",
              HAZ: i % 9 === 0 ? "YES" : "NO",
              CONSIGNEE: "DPMC",
              "BOOKING NO": `DEMOBOOK-${wo}`,
              "CONTAINER NO": containers.join(" "),
              "CURRENT ETD": mkEtd(i + 2),
              "BL NO": blNo,
            },
          ),
        );
      }

      return items;
    })()
  : [];

// Synthetic demo data for other modules, using the same schema but shorter values
function buildSyntheticOrdersForModule(mod: BajajModule): BajajWorkOrder[] {
  if (mod.id === srilankaModule?.id) return [];

  const baseData = [
    {
      WO: `${mod.slug.toUpperCase()}-1001`,
      Port: "COLOMBO",
      Country: mod.name,
      Veh: "PULSAR N 160",
      Qty: "210",
      Cont: "5",
      Type: "40HC",
      "Stuffing on": "19-02-26",
      "S/LINE": "EVERGREEN",
      "Vessel Name": "ESL DACHAN BAY 26001E",
      "CONTAINER NO": "EGSU1229636 EMCU1822088 EGHU9623940 TGBU6311849 EISU8258630",
      HAZ: "NO",
      CONSIGNEE: "DPMC",
    },
    {
      WO: `${mod.slug.toUpperCase()}-1002`,
      Port: "COLOMBO",
      Country: mod.name,
      Veh: "CT 100 AW ES - PARTS",
      Qty: "276",
      Cont: "2",
      Type: "40HC",
      "Stuffing on": "18-02-26",
      "S/LINE": "MSC",
      "Vessel Name": "HYUNDAI SINGAPORE IV608A",
      "CONTAINER NO": "DFSU7765628 MEDU4561893",
      HAZ: "NO",
      CONSIGNEE: "DPMC",
    },
    {
      WO: `${mod.slug.toUpperCase()}-1003`,
      Port: "COLOMBO",
      Country: mod.name,
      Veh: "CT 100 AW ES - FRAMES",
      Qty: "0",
      Cont: "1",
      Type: "40HC",
      "Stuffing on": "27-02-26",
      "S/LINE": "SINO",
      "Vessel Name": "XIN SHANGHAI 159E",
      "CONTAINER NO": "FFAU5958165",
      HAZ: "NO",
      CONSIGNEE: "DPMC",
    },
  ];

  return baseData.map((data, index) =>
    createWorkOrder(
      `${mod.slug}-${index + 1}`,
      mod.id,
      index,
      index,
      data as Record<string, unknown>,
    ),
  );
}

let demoWorkOrders: BajajWorkOrder[] = [
  ...srilankaWorkOrders,
  ...srilankaExtraWorkOrders,
  ...demoModules.flatMap((m) => buildSyntheticOrdersForModule(m)),
];

let demoComments: BajajComment[] = [];

let demoUsers: BajajUser[] = [
  {
    id: "bajaj-user-1",
    user_id: "demo-user-1",
    email: "demo.user@example.com",
    full_name: "Demo User",
    status: "approved",
    created_at: new Date().toISOString(),
  } as BajajUser,
];

let demoAuditLogs: BajajAuditLog[] = [];

// ─── Reminders (demo, stored locally) ─────────────────────────────────────────
const REMINDERS_STORAGE_KEY = "bajaj-demo-reminders-v1";
let demoReminders: BajajReminder[] = [];
let remindersLoaded = false;

function safeParseJson<T>(value: string | null): T | null {
  if (!value) return null;
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

function ensureRemindersLoaded() {
  if (remindersLoaded) return;
  remindersLoaded = true;
  if (typeof window === "undefined") return;
  const parsed = safeParseJson<BajajReminder[]>(
    window.localStorage.getItem(REMINDERS_STORAGE_KEY),
  );
  if (Array.isArray(parsed)) {
    demoReminders = parsed;
  }
}

function persistReminders() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      REMINDERS_STORAGE_KEY,
      JSON.stringify(demoReminders),
    );
  } catch {
    // ignore storage errors in demo mode
  }
}

// ─── Modules ──────────────────────────────────────────────────────────────────
export function useBajajModules() {
  return useQuery({
    queryKey: ["bajaj_modules"],
    queryFn: async () => demoModules,
    staleTime: 5 * 60 * 1000,
  });
}

// ─── Statuses ─────────────────────────────────────────────────────────────────
export function useBajajStatuses(moduleSlug: string) {
  return useQuery({
    queryKey: ["bajaj_statuses", moduleSlug],
    enabled: !!moduleSlug,
    queryFn: async () => {
      const mod = getModuleBySlug(moduleSlug);
      if (!mod) return [] as BajajStatus[];
      return getStatusesForModule(mod.id);
    },
  });
}

// ─── Board config ─────────────────────────────────────────────────────────────
export function useBajajBoardConfig(moduleSlug: string) {
  return useQuery({
    queryKey: ["bajaj_board_config", moduleSlug],
    enabled: !!moduleSlug,
    queryFn: async () => {
      const mod = getModuleBySlug(moduleSlug);
      if (!mod) return null;
      return getBoardConfigForModule(mod.id);
    },
  });
}

// ─── Work orders ──────────────────────────────────────────────────────────────
export function useWorkOrders(moduleSlug: string, filters?: WorkOrderFilters) {
  return useQuery({
    queryKey: ["bajaj_work_orders", moduleSlug, filters],
    enabled: !!moduleSlug,
    queryFn: async () => {
      const mod = getModuleBySlug(moduleSlug);
      if (!mod) return [] as BajajWorkOrder[];
      let items = demoWorkOrders.filter((wo) => wo.module_id === mod.id);
      if (filters?.statusId) {
        items = items.filter((wo) => wo.status_id === filters.statusId);
      }
      // assignedTo/date filters omitted in demo
      return items;
    },
  });
}

export function useWorkOrder(id: string) {
  return useQuery({
    queryKey: ["bajaj_work_order", id],
    enabled: !!id,
    queryFn: async () => {
      const found = demoWorkOrders.find((wo) => wo.id === id);
      if (!found) {
        throw new Error("Work order not found in demo data");
      }
      return found;
    },
  });
}

export function useUpdateWorkOrder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      updates,
    }: {
      id: string;
      updates: Partial<BajajWorkOrder>;
    }) => {
      const existing = demoWorkOrders.find((wo) => wo.id === id);
      if (!existing) {
        throw new Error("Work order not found in demo data");
      }

      const mergedData: Record<string, unknown> = {
        ...(existing.data || {}),
        ...(updates.data as Record<string, unknown> | undefined),
      };

      const candidate: BajajWorkOrder = {
        ...existing,
        ...updates,
        data: mergedData,
      } as BajajWorkOrder;

      // ── Business rule helpers ─────────────────────────────────────
      const classifyCategory = (data: Record<string, unknown>): "parts" | "frames" | "other" => {
        const veh = String(data["Veh"] ?? data["Type"] ?? "").toLowerCase();
        if (veh.includes("parts")) return "parts";
        if (veh.includes("frames")) return "frames";
        return "other";
      };

      const extractContainers = (data: Record<string, unknown>): string[] => {
        const raw = String(data["CONTAINER NO"] ?? "").trim();
        if (!raw) return [];
        return raw.split(/\s+/).filter(Boolean);
      };

      const candidateCategory = classifyCategory(candidate.data as Record<string, unknown>);
      const candidateContainers = extractContainers(candidate.data as Record<string, unknown>);

      // Rule 1: No parts and frames in a single container
      if (candidateCategory !== "other" && candidateContainers.length > 0) {
        for (const container of candidateContainers) {
          for (const other of demoWorkOrders) {
            if (other.id === candidate.id) continue;
            const otherContainers = extractContainers(other.data as Record<string, unknown>);
            if (!otherContainers.includes(container)) continue;
            const otherCategory = classifyCategory(other.data as Record<string, unknown>);
            if (
              (candidateCategory === "parts" && otherCategory === "frames") ||
              (candidateCategory === "frames" && otherCategory === "parts")
            ) {
              throw new Error(
                `Container ${container} cannot mix parts and frames in demo mode.`,
              );
            }
          }
        }
      }

      // Rule 2: Max 25 containers per vessel
      const vesselName = String(
        candidate.data["Vessel Name"] ?? candidate.data["Vessel"] ?? "",
      ).trim();
      if (vesselName) {
        const containerSet = new Set<string>();
        // Include candidate
        candidateContainers.forEach((c) => containerSet.add(c));

        for (const wo of demoWorkOrders) {
          if (wo.id === candidate.id) continue;
          const woVessel = String(
            (wo.data as Record<string, unknown>)["Vessel Name"] ??
              (wo.data as Record<string, unknown>)["Vessel"] ??
              "",
          ).trim();
          if (!woVessel || woVessel !== vesselName) continue;
          extractContainers(wo.data as Record<string, unknown>).forEach((c) =>
            containerSet.add(c),
          );
        }

        if (containerSet.size > 25) {
          throw new Error(
            `Vessel "${vesselName}" already has ${containerSet.size} containers in demo data (limit is 25).`,
          );
        }
      }

      // Persist the candidate after validation passes
      demoWorkOrders = demoWorkOrders.map((wo) =>
        wo.id === id ? candidate : wo,
      );

      return candidate;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["bajaj_work_orders"] });
      queryClient.invalidateQueries({ queryKey: ["bajaj_work_order", data.id] });
    },
  });
}

// ─── Create work order (demo, manual entry) ────────────────────────────────
export function useCreateWorkOrder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      moduleSlug,
      data,
    }: {
      moduleSlug: string;
      data: Record<string, unknown>;
    }) => {
      const mod = getModuleBySlug(moduleSlug);
      if (!mod) {
        throw new Error("Unknown module");
      }
      const id = `manual-${demoWorkOrders.length + 1}`;
      // Use "Bookings to Planned" column (index 2) for planning
      const statusId = getStatusIdForIndex(mod.id, 2);
      const columnOrder =
        demoWorkOrders.filter((wo) => wo.module_id === mod.id).length + 1;
      const wo: BajajWorkOrder = {
        id,
        module_id: mod.id,
        status_id: statusId,
        data,
        assigned_to: null,
        column_order: columnOrder,
        import_batch_id: null,
        created_at: now,
        updated_at: now,
      } as BajajWorkOrder;
      demoWorkOrders = [...demoWorkOrders, wo];
      return wo;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bajaj_work_orders"] });
    },
  });
}

// ─── Comments ─────────────────────────────────────────────────────────────────
export function useBajajComments(workOrderId: string) {
  return useQuery({
    queryKey: ["bajaj_comments", workOrderId],
    enabled: !!workOrderId,
    queryFn: async () =>
      demoComments.filter((c) => c.work_order_id === workOrderId),
  });
}

export function useAddBajajComment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      workOrderId,
      authorId,
      content,
    }: {
      workOrderId: string;
      authorId: string;
      content: string;
    }) => {
      const now = new Date().toISOString();
      const newComment: BajajComment = {
        id: `c-${demoComments.length + 1}`,
        work_order_id: workOrderId,
        author_id: authorId,
        content,
        created_at: now,
      } as BajajComment;
      demoComments = [...demoComments, newComment];
      return newComment;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({
        queryKey: ["bajaj_comments", data.work_order_id],
      });
    },
  });
}

// ─── Bajaj users (admin) ──────────────────────────────────────────────────────
export function useBajajUsers(status?: string) {
  return useQuery({
    queryKey: ["bajaj_users", status],
    queryFn: async () => {
      if (!status) return demoUsers;
      return demoUsers.filter((u) => u.status === status);
    },
  });
}

export function useApproveBajajUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      bajajUserId,
      adminId,
    }: {
      bajajUserId: string;
      adminId: string;
    }) => {
      demoUsers = demoUsers.map((u) =>
        u.id === bajajUserId
          ? ({
              ...u,
              status: "approved",
              approved_by: adminId,
              approved_at: new Date().toISOString(),
            } as BajajUser)
          : u
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bajaj_users"] });
    },
  });
}

export function useRejectBajajUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ bajajUserId }: { bajajUserId: string }) => {
      demoUsers = demoUsers.map((u) =>
        u.id === bajajUserId ? ({ ...u, status: "rejected" } as BajajUser) : u
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bajaj_users"] });
    },
  });
}

// ─── Audit logs ───────────────────────────────────────────────────────────────
export function useBajajAuditLogs(filters?: {
  actorEmail?: string;
  action?: string;
  targetId?: string;
  limit?: number;
}) {
  return useQuery({
    queryKey: ["bajaj_audit_logs", filters],
    queryFn: async () => {
      let logs = [...demoAuditLogs];
      if (filters?.actorEmail) {
        logs = logs.filter((l) =>
          (l.actor_email ?? "")
            .toLowerCase()
            .includes(filters.actorEmail!.toLowerCase())
        );
      }
      if (filters?.action) {
        logs = logs.filter((l) => l.action === filters.action);
      }
      if (filters?.targetId) {
        logs = logs.filter((l) => l.target_id === filters.targetId);
      }
      if (filters?.limit) {
        logs = logs.slice(0, filters.limit);
      }
      return logs;
    },
  });
}

// ─── Analytics ────────────────────────────────────────────────────────────────
export function useBajajAnalytics(moduleSlug?: string) {
  return useQuery({
    queryKey: ["bajaj_analytics", moduleSlug],
    staleTime: 60 * 1000,
    queryFn: async () => {
      const scopedModules = moduleSlug
        ? demoModules.filter((m) => m.slug === moduleSlug)
        : demoModules;

      const scopedWorkOrders = moduleSlug
        ? demoWorkOrders.filter(
            (wo) => scopedModules.find((m) => m.id === wo.module_id) !== undefined,
          )
        : demoWorkOrders;

      const byModule: BajajAnalytics["byModule"] = scopedModules.map((m) => {
        const count = scopedWorkOrders.filter((wo) => wo.module_id === m.id).length;
        return { moduleName: m.name, slug: m.slug, count };
      });

      const totalWorkOrders = scopedWorkOrders.length;

      const statusCounts = new Map<
        string,
        { name: string; colorHex: string; count: number; order: number }
      >();
      const vesselContainers = new Map<string, Set<string>>();
      const lineContainers = new Map<string, Set<string>>();
      let totalContainers = 0;
      let totalBLs = 0;
      let blPendingAfterETD = 0;

      const extractContainers = (data: Record<string, unknown>): string[] => {
        const raw = String(data["CONTAINER NO"] ?? "").trim();
        if (!raw) return [];
        return raw.split(/\s+/).filter(Boolean);
      };

      for (const wo of scopedWorkOrders) {
        const status = demoStatuses.find((s) => s.id === wo.status_id);
        if (status) {
          const key = status.name;
          const def = STATUS_DEFS.find((d) => d.name === status.name);
          if (!statusCounts.has(key)) {
            statusCounts.set(key, {
              name: status.name,
              colorHex: status.color_hex,
              count: 0,
              order: def?.order ?? 999,
            });
          }
          statusCounts.get(key)!.count++;
        }

        const data = wo.data as Record<string, unknown>;
        const containers = extractContainers(data);
        const vesselName = String(
          data["Vessel Name"] ?? data["Vessel"] ?? "",
        ).trim();
        const lineName = String(data["S/LINE"] ?? data["LINE"] ?? "").trim();
        const blNo = String(data["BL NO"] ?? data["BOL NO"] ?? "").trim();
        const currentEtd = String(data["CURRENT ETD"] ?? "").trim();

        if (containers.length > 0) {
          totalContainers += containers.length;
          if (vesselName) {
            if (!vesselContainers.has(vesselName)) {
              vesselContainers.set(vesselName, new Set<string>());
            }
            const set = vesselContainers.get(vesselName)!;
            containers.forEach((c) => set.add(c));
          }
          if (lineName) {
            if (!lineContainers.has(lineName)) {
              lineContainers.set(lineName, new Set<string>());
            }
            const set = lineContainers.get(lineName)!;
            containers.forEach((c) => set.add(c));
          }
        }

        if (blNo) {
          totalBLs += 1;
        } else if (currentEtd) {
          // In demo mode, treat any row with CURRENT ETD but no BL NO as pending >48h
          blPendingAfterETD += 1;
        }
      }

      const byStatus = Array.from(statusCounts.values())
        .sort((a, b) => a.order - b.order)
        .map((s) => ({
          statusName: s.name,
          colorHex: s.colorHex,
          count: s.count,
        }));

      const containersByVessel = Array.from(vesselContainers.entries()).map(
        ([vesselName, set]) => ({
          vesselName,
          containerCount: set.size,
        }),
      );

      const vesselsOverLimit = containersByVessel.filter(
        (v) => v.containerCount > 25,
      );

      const containersByLine = Array.from(lineContainers.entries()).map(
        ([lineName, set]) => ({
          lineName,
          containerCount: set.size,
        }),
      );

      const importTimeline: BajajAnalytics["importTimeline"] = [
        {
          date: new Date().toISOString().slice(0, 10),
          addedCount: scopedWorkOrders.length,
          batchId: "demo-batch-1",
        },
      ];

      return {
        totalWorkOrders,
        byStatus,
        byModule,
        importTimeline,
        totalContainers,
        totalBLs,
        containersByVessel,
        containersByLine,
        blPendingAfterETD,
        vesselsOverLimit,
      } as BajajAnalytics;
    },
  });
}

// ─── Reminders ────────────────────────────────────────────────────────────────
export function useBajajReminders() {
  return useQuery({
    queryKey: ["bajaj_reminders"],
    queryFn: async () => {
      ensureRemindersLoaded();
      return [...demoReminders].sort(
        (a, b) => new Date(a.due_at).getTime() - new Date(b.due_at).getTime(),
      );
    },
  });
}

export function useCreateBajajReminder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      workOrderId,
      moduleId,
      workOrderSummary,
      daysOffset,
      recipients,
      message,
      createdBy,
    }: {
      workOrderId: string;
      moduleId: string;
      workOrderSummary: string;
      daysOffset: number;
      recipients: string[];
      message: string;
      createdBy: string | null;
    }) => {
      ensureRemindersLoaded();
      const dueAt = new Date(Date.now() + daysOffset * 24 * 60 * 60 * 1000);
      const nowIso = new Date().toISOString();
      const reminder: BajajReminder = {
        id: `rem-${Math.random().toString(36).slice(2, 10)}-${Date.now()}`,
        work_order_id: workOrderId,
        module_id: moduleId,
        work_order_summary: workOrderSummary,
        created_by: createdBy,
        created_at: nowIso,
        due_at: dueAt.toISOString(),
        days_offset: daysOffset,
        recipients,
        message,
        status: "scheduled",
        sent_at: null,
        done_at: null,
      };
      demoReminders = [reminder, ...demoReminders];
      persistReminders();
      return reminder;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bajaj_reminders"] });
    },
  });
}

export function useUpdateBajajReminder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      updates,
    }: {
      id: string;
      updates: Partial<BajajReminder>;
    }) => {
      ensureRemindersLoaded();
      const existing = demoReminders.find((r) => r.id === id);
      if (!existing) throw new Error("Reminder not found");
      const next: BajajReminder = { ...existing, ...updates } as BajajReminder;
      demoReminders = demoReminders.map((r) => (r.id === id ? next : r));
      persistReminders();
      return next;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bajaj_reminders"] });
    },
  });
}
