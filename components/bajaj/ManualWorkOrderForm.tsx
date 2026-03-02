"use client";

import React, { useState } from "react";
import { Loader2, CheckCircle } from "lucide-react";
import { useCreateWorkOrder } from "@/lib/queries/bajaj";

const FIELD_NAMES: string[] = [
  "WO",
  "Port",
  "Country",
  "Veh",
  "Qty",
  "Cont",
  "Type",
  "Stuffing on",
  "S/LINE",
  "Vessel Name",
  "Agent",
  "TRANSPORTER",
  "Plant",
  "PO NO",
  "LC NO",
  "LC DATE",
  "HAZ",
  "CONSIGNEE",
  "REMARK 1",
  "D/O GIVEN DT",
  "BOOKING NO",
  "CONTAINER NO",
  "POL GATE",
  "GATE OPEN",
  "GATE CUT OFF",
  "SI CUT OFF",
  "DO ETD",
  "CURRENT ETD",
  "ETA AT DESTINATION",
  "PICK UP DT",
  "CNTR DISPATCH",
  "CNTR REPORT NHAVA SHEVA",
  "CNTR GATED IN PORT",
  "FINAL VSL SOB",
  "VGM SUBMITTED",
  "SI SUBMITTED",
  "BL NO",
  "BL DT",
  "BL HAND OVER TIME",
  "FF JOB",
  "CLEARANCE POINT",
  "OPEN ORDER",
  "BUFFER YARD",
  "S/LINE PAYMENT STATUS",
  "E DOC STATUS",
  "COURIER DT",
  "SB NO",
  "SB DATE",
  "FOR HBL",
];

interface ManualWorkOrderFormProps {
  moduleSlug: string;
}

export function ManualWorkOrderForm({ moduleSlug }: ManualWorkOrderFormProps) {
  const createWorkOrder = useCreateWorkOrder();
  const [values, setValues] = useState<Record<string, string>>({});
  const [createdId, setCreatedId] = useState<string | null>(null);

  function handleChange(field: string, value: string) {
    setValues((v) => ({ ...v, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setCreatedId(null);
    await createWorkOrder.mutateAsync({
      moduleSlug,
      data: values,
    });
    setCreatedId(values["WO"] || null);
    setValues({});
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="h-full flex flex-col rounded-2xl border border-neutral-800 bg-neutral-950/60"
    >
      <div className="px-5 py-4 border-b border-neutral-800 flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-neutral-100">Manual Work Order Entry</h2>
          <p className="text-xs text-neutral-500">
            New rows are added to the planning column for the selected board.
          </p>
        </div>
        {createdId && (
          <div className="flex items-center gap-1 text-xs text-emerald-400">
            <CheckCircle className="size-3.5" />
            <span>Saved: {createdId}</span>
          </div>
        )}
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto px-5 py-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {FIELD_NAMES.map((field) => {
            const isLongText = field === "REMARK 1";
            const value = values[field] ?? "";
            return (
              <div key={field} className="space-y-1">
                <label className="block text-[11px] text-neutral-500 uppercase tracking-wide">
                  {field}
                </label>
                {isLongText ? (
                  <textarea
                    rows={2}
                    value={value}
                    onChange={(e) => handleChange(field, e.target.value)}
                    className="w-full rounded-md bg-neutral-900 border border-neutral-700 px-3 py-2 text-xs text-neutral-100 placeholder:text-neutral-600 focus:outline-none focus:border-neutral-500 resize-none"
                  />
                ) : (
                  <input
                    type="text"
                    value={value}
                    onChange={(e) => handleChange(field, e.target.value)}
                    className="w-full rounded-md bg-neutral-900 border border-neutral-700 px-3 py-2 text-xs text-neutral-100 placeholder:text-neutral-600 focus:outline-none focus:border-neutral-500"
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="px-5 py-3 border-t border-neutral-800 flex items-center justify-between">
        <p className="text-[11px] text-neutral-600">
          Minimum recommended fields: <span className="text-neutral-300">WO, Port, Country, Veh, Qty, CONTAINER NO, Vessel Name, S/LINE, HAZ</span>.
        </p>
        <button
          type="submit"
          disabled={createWorkOrder.isPending}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-neutral-900 text-xs font-medium text-neutral-100 border border-neutral-700 hover:bg-neutral-800 disabled:opacity-50"
        >
          {createWorkOrder.isPending && <Loader2 className="size-3.5 animate-spin" />}
          Add to Board
        </button>
      </div>
    </form>
  );
}

