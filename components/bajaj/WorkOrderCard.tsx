"use client";

import React from "react";
import { AlertTriangle, User } from "lucide-react";
import type { BajajWorkOrder } from "@/lib/types/bajaj";
import { cn } from "@/lib/utils";

interface WorkOrderCardProps {
  workOrder: BajajWorkOrder;
  cardFaceFields: string[];
  isLight?: boolean;
  isSelected: boolean;
  onSelect: () => void;
  onDragStart: (e: React.DragEvent) => void;
  statusColor: string;
}

const HAZARD_KEYS = ["hazard", "hazardous", "haz", "dangerous", "dg", "imo", "un_no"];

function isHazardous(data: Record<string, unknown>): boolean {
  return Object.entries(data).some(([k, v]) => {
    const keyMatch = HAZARD_KEYS.some((hk) => k.toLowerCase().includes(hk));
    return keyMatch && v && v !== "NO" && v !== "No" && v !== "no" && v !== "0" && v !== "";
  });
}

function classifyCategory(data: Record<string, unknown>): "parts" | "frames" | "other" {
  const veh = String(data["Veh"] ?? data["Type"] ?? "").toLowerCase();
  if (veh.includes("parts")) return "parts";
  if (veh.includes("frames")) return "frames";
  return "other";
}

export function WorkOrderCard({
  workOrder,
  cardFaceFields,
  isLight = false,
  isSelected,
  onSelect,
  onDragStart,
  statusColor,
}: WorkOrderCardProps) {
  const hazard = isHazardous(workOrder.data);
  const category = classifyCategory(workOrder.data as Record<string, unknown>);
  const fieldsToShow = cardFaceFields.length > 0
    ? cardFaceFields
    : Object.keys(workOrder.data).slice(0, 4);

  return (
    <div
      draggable
      onDragStart={onDragStart}
      onClick={onSelect}
      className={cn(
        "relative mb-2 rounded-xl border cursor-pointer select-none transition-all group",
        isLight
          ? isSelected
            ? "border-amber-500 bg-white shadow-sm"
            : "border-neutral-300 bg-white hover:border-neutral-400 hover:bg-neutral-50"
          : isSelected
            ? "border-amber-500 bg-neutral-800 shadow-lg shadow-amber-900/20"
            : "border-neutral-700 bg-neutral-900 hover:border-neutral-600 hover:bg-neutral-800",
      )}
      style={{ borderLeftWidth: 3, borderLeftColor: `#${statusColor}` }}
    >
      <div className="p-3.5">
        {/* Hazard / category badges */}
        {(hazard || category !== "other") && (
          <div className="flex items-center gap-2 mb-2">
            {hazard && (
              <div className={cn("flex items-center gap-1 text-[11px] font-medium", isLight ? "text-orange-600" : "text-orange-400")}>
                <AlertTriangle className="size-3.5" />
                <span>Hazardous</span>
              </div>
            )}
            {category !== "other" && (
              <div
                className={`px-1.5 py-0.5 rounded-full text-[10px] font-medium border ${
                  category === "parts"
                    ? isLight ? "border-sky-600 text-sky-700" : "border-sky-500 text-sky-400"
                    : isLight ? "border-emerald-600 text-emerald-700" : "border-emerald-500 text-emerald-400"
                }`}
              >
                {category === "parts" ? "Parts" : "Frames"}
              </div>
            )}
          </div>
        )}

        {/* Data fields */}
        <div className="space-y-1.5">
          {fieldsToShow.map((field) => {
            const value = workOrder.data[field];
            if (value === undefined || value === null || value === "") return null;
            return (
              <div key={field} className="flex flex-col gap-0.5">
                <span className={cn("text-[10px] uppercase tracking-wide leading-none", isLight ? "text-neutral-500" : "text-neutral-600")}>
                  {field}
                </span>
                <span className={cn("text-xs leading-tight truncate", isLight ? "text-neutral-900" : "text-neutral-200")}>
                  {String(value)}
                </span>
              </div>
            );
          })}
        </div>

        {/* Footer: assigned user + date */}
        <div className={cn("flex items-center justify-between mt-3 pt-2.5 border-t", isLight ? "border-neutral-200" : "border-neutral-800")}>
          {workOrder.assignee ? (
            <div className="flex items-center gap-1.5">
              {workOrder.assignee.avatar_url ? (
                <img
                  src={workOrder.assignee.avatar_url}
                  alt=""
                  className="size-5 rounded-full object-cover"
                />
              ) : (
                <div className={cn("size-5 rounded-full flex items-center justify-center", isLight ? "bg-neutral-200" : "bg-neutral-700")}>
                  <User className={cn("size-3", isLight ? "text-neutral-500" : "text-neutral-400")} />
                </div>
              )}
              <span className={cn("text-[10px] truncate max-w-[80px]", isLight ? "text-neutral-600" : "text-neutral-500")}>
                {workOrder.assignee.full_name ?? workOrder.assignee.email}
              </span>
            </div>
          ) : (
            <span className={cn("text-[10px]", isLight ? "text-neutral-500" : "text-neutral-700")}>Unassigned</span>
          )}
          <span className={cn("text-[10px]", isLight ? "text-neutral-500" : "text-neutral-700")}>
            {new Date(workOrder.created_at).toLocaleDateString("en-GB", {
              day: "2-digit",
              month: "short",
            })}
          </span>
        </div>
      </div>
    </div>
  );
}
