"use client";

import React from "react";
import { AlertTriangle, User } from "lucide-react";
import type { BajajWorkOrder } from "@/lib/types/bajaj";

interface WorkOrderCardProps {
  workOrder: BajajWorkOrder;
  cardFaceFields: string[];
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

export function WorkOrderCard({
  workOrder,
  cardFaceFields,
  isSelected,
  onSelect,
  onDragStart,
  statusColor,
}: WorkOrderCardProps) {
  const hazard = isHazardous(workOrder.data);
  const fieldsToShow = cardFaceFields.length > 0
    ? cardFaceFields
    : Object.keys(workOrder.data).slice(0, 4);

  return (
    <div
      draggable
      onDragStart={onDragStart}
      onClick={onSelect}
      className={`relative mb-2 rounded-xl border cursor-pointer select-none transition-all group ${
        isSelected
          ? "border-amber-500 bg-neutral-800 shadow-lg shadow-amber-900/20"
          : "border-neutral-700 bg-neutral-900 hover:border-neutral-600 hover:bg-neutral-800"
      }`}
      style={{ borderLeftWidth: 3, borderLeftColor: `#${statusColor}` }}
    >
      <div className="p-3.5">
        {/* Hazard badge */}
        {hazard && (
          <div className="flex items-center gap-1 text-orange-400 text-xs font-medium mb-2">
            <AlertTriangle className="size-3.5" />
            <span>Hazardous</span>
          </div>
        )}

        {/* Data fields */}
        <div className="space-y-1.5">
          {fieldsToShow.map((field) => {
            const value = workOrder.data[field];
            if (value === undefined || value === null || value === "") return null;
            return (
              <div key={field} className="flex flex-col gap-0.5">
                <span className="text-[10px] text-neutral-600 uppercase tracking-wide leading-none">
                  {field}
                </span>
                <span className="text-xs text-neutral-200 leading-tight truncate">
                  {String(value)}
                </span>
              </div>
            );
          })}
        </div>

        {/* Footer: assigned user + date */}
        <div className="flex items-center justify-between mt-3 pt-2.5 border-t border-neutral-800">
          {workOrder.assignee ? (
            <div className="flex items-center gap-1.5">
              {workOrder.assignee.avatar_url ? (
                <img
                  src={workOrder.assignee.avatar_url}
                  alt=""
                  className="size-5 rounded-full object-cover"
                />
              ) : (
                <div className="size-5 rounded-full bg-neutral-700 flex items-center justify-center">
                  <User className="size-3 text-neutral-400" />
                </div>
              )}
              <span className="text-[10px] text-neutral-500 truncate max-w-[80px]">
                {workOrder.assignee.full_name ?? workOrder.assignee.email}
              </span>
            </div>
          ) : (
            <span className="text-[10px] text-neutral-700">Unassigned</span>
          )}
          <span className="text-[10px] text-neutral-700">
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
