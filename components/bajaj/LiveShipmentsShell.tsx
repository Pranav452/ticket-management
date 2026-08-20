"use client";

import { useMemo, useState } from "react";
import dynamic from "next/dynamic";
import type { BoardOption, LiveShipment } from "@/lib/bajaj/live-shipments";

const LiveShipmentsMap = dynamic(() => import("./LiveShipmentsMap"), {
  ssr: false,
  loading: () => (
    <div style={{ flex: 1, background: "#0d2438", minWidth: 300 }} />
  ),
});

const SHELL_ID = "bajaj-live-shell";

/* ------------------------------------------------------------------ */
/* Hover helpers (translation of the prototype's style-hover attribute) */
/* ------------------------------------------------------------------ */

function HoverBox({
  base,
  hover,
  onClick,
  title,
  children,
}: {
  base: React.CSSProperties;
  hover: React.CSSProperties;
  onClick?: () => void;
  title?: string;
  children?: React.ReactNode;
}) {
  const [h, setH] = useState(false);
  return (
    <div
      title={title}
      onClick={onClick}
      onMouseEnter={() => setH(true)}
      onMouseLeave={() => setH(false)}
      style={h ? { ...base, ...hover } : base}
    >
      {children}
    </div>
  );
}

function HoverButton({
  base,
  hover,
  onClick,
  children,
  title,
}: {
  base: React.CSSProperties;
  hover: React.CSSProperties;
  onClick?: () => void;
  children?: React.ReactNode;
  title?: string;
}) {
  const [h, setH] = useState(false);
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      onMouseEnter={() => setH(true)}
      onMouseLeave={() => setH(false)}
      style={h ? { ...base, ...hover } : base}
    >
      {children}
    </button>
  );
}

const shipIcon = (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="#8b96a3">
    <path d="M3 14h18l-2.5 5H5.5L3 14z" />
    <rect x="6" y="10" width="4" height="3" />
    <rect x="11" y="10" width="4" height="3" />
    <rect x="16" y="10" width="3" height="3" />
    <rect x="11" y="6" width="3" height="3" />
  </svg>
);

/* ------------------------------------------------------------------ */

export default function LiveShipmentsShell({
  shipments,
  boards,
  totalCount,
  monthLabel,
  fontClassName,
}: {
  shipments: LiveShipment[];
  boards: BoardOption[];
  totalCount: number;
  monthLabel: string;
  fontClassName: string;
}) {
  const [selKey, setSelKey] = useState<string>(shipments[0]?.key ?? "");
  const [detailOpen, setDetailOpen] = useState(true);
  const [board, setBoard] = useState<string>("all");
  const [query, setQuery] = useState("");

  const items = useMemo(() => {
    const q = query.trim().toLowerCase();
    return shipments.filter(
      (s) => (board === "all" || s.moduleSlug === board) && (!q || s.search.includes(q)),
    );
  }, [shipments, board, query]);

  const sel = useMemo(
    () => shipments.find((s) => s.key === selKey) ?? items[0] ?? shipments[0] ?? null,
    [shipments, items, selKey],
  );

  const pillBase: React.CSSProperties = {
    border: "none",
    borderRadius: 999,
    padding: "6px 11px",
    fontFamily: "inherit",
    fontSize: 11,
    fontWeight: 800,
    cursor: "pointer",
    lineHeight: 1.2,
  };

  return (
    <div
      className={fontClassName}
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        minHeight: 660,
        WebkitFontSmoothing: "antialiased",
      }}
    >
      <style>{`
        @keyframes lg-pulse{0%{transform:scale(.55);opacity:.8}100%{transform:scale(1.7);opacity:0}}
        #${SHELL_ID} ::-webkit-scrollbar{width:0;height:0}
        #${SHELL_ID} .maplibregl-ctrl-attrib{font-size:9px !important;background:rgba(10,14,18,.55) !important;border-radius:6px}
        #${SHELL_ID} .maplibregl-ctrl-attrib,#${SHELL_ID} .maplibregl-ctrl-attrib a{color:#8a94a3 !important}
        #${SHELL_ID} *{box-sizing:border-box}
        #${SHELL_ID} a{color:#4aa8f0;text-decoration:none}
        #${SHELL_ID} a:hover{color:#7cc4f7}
      `}</style>

      <div
        id={SHELL_ID}
        data-screen-label="Tracking dashboard"
        style={{
          flex: 1,
          minHeight: 660,
          display: "flex",
          borderRadius: 16,
          overflow: "hidden",
          background: "#0b0e12",
          boxShadow: "0 24px 60px rgba(20,30,40,.35)",
          position: "relative",
        }}
      >
        {/* ══ tracking list ══ */}
        <div
          style={{
            width: 330,
            flex: "none",
            background: "#0b0e12",
            display: "flex",
            flexDirection: "column",
            borderRight: "1px solid rgba(255,255,255,.06)",
            position: "relative",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "16px 14px 12px",
            }}
          >
            <div style={{ fontSize: 16, fontWeight: 700, color: "#eef2f5" }}>Tracking list</div>
            <div style={{ display: "flex", gap: 6 }}>
              <HoverBox
                title="Filters"
                base={{
                  width: 30,
                  height: 30,
                  borderRadius: 9,
                  background: "#151a20",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: "pointer",
                }}
                hover={{ background: "#1c232b" }}
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#9aa5b1"
                  strokeWidth="2"
                  strokeLinecap="round"
                >
                  <path d="M3 5h18l-7 8v6l-4-2v-4L3 5z" />
                </svg>
              </HoverBox>
              <HoverBox
                title="More"
                base={{
                  width: 30,
                  height: 30,
                  borderRadius: 9,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: "pointer",
                }}
                hover={{ background: "#151a20" }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="#9aa5b1">
                  <circle cx="12" cy="5" r="1.8" />
                  <circle cx="12" cy="12" r="1.8" />
                  <circle cx="12" cy="19" r="1.8" />
                </svg>
              </HoverBox>
            </div>
          </div>

          <div style={{ display: "flex", gap: 8, padding: "0 14px 8px" }}>
            <div
              style={{
                flex: 1,
                display: "flex",
                alignItems: "center",
                gap: 8,
                background: "#12161c",
                border: "1px solid rgba(255,255,255,.07)",
                borderRadius: 10,
                padding: "0 11px",
                height: 36,
              }}
            >
              <svg
                width="13"
                height="13"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#5f6a76"
                strokeWidth="2.2"
                strokeLinecap="round"
              >
                <circle cx="11" cy="11" r="7" />
                <path d="M20 20l-3.5-3.5" />
              </svg>
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Order ID..."
                style={{
                  background: "none",
                  border: "none",
                  outline: "none",
                  color: "#dfe6ec",
                  fontFamily: "inherit",
                  fontSize: 12.5,
                  width: "100%",
                }}
              />
            </div>
            <HoverButton
              base={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                background: "#2f9bf0",
                border: "none",
                borderRadius: 10,
                color: "#fff",
                fontFamily: "inherit",
                fontWeight: 700,
                fontSize: 12.5,
                padding: "0 13px",
                height: 36,
                cursor: "pointer",
                whiteSpace: "nowrap",
              }}
              hover={{ background: "#4babf4" }}
            >
              <span style={{ fontSize: 15, fontWeight: 600 }}>+</span> New order
            </HoverButton>
          </div>

          <div
            style={{
              padding: "0 14px 8px",
              fontSize: 9,
              fontWeight: 700,
              letterSpacing: ".6px",
              color: "#525d68",
              textTransform: "uppercase",
            }}
          >
            {items.length} of {totalCount} live orders · {monthLabel}
          </div>

          <div
            style={{
              flex: 1,
              overflowY: "auto",
              padding: "2px 14px 74px",
              display: "flex",
              flexDirection: "column",
              gap: 8,
            }}
          >
            {items.length === 0 ? (
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  color: "#5f6a76",
                  padding: "24px 4px",
                  textAlign: "center",
                }}
              >
                No shipments match this filter.
              </div>
            ) : (
              items.map((item) => {
                const seld = item.key === selKey;
                const bg = seld ? "#1c242d" : "#12161c";
                return (
                  <div
                    key={item.key}
                    onClick={() => {
                      setSelKey(item.key);
                      setDetailOpen(true);
                    }}
                    style={{
                      flex: "none",
                      borderRadius: 13,
                      padding: "12px 12px 11px",
                      cursor: "pointer",
                      background: bg,
                      border: `1px solid ${seld ? "rgba(255,255,255,.16)" : "rgba(255,255,255,.05)"}`,
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        marginBottom: 10,
                      }}
                    >
                      <div
                        style={{
                          fontSize: 14,
                          fontWeight: 800,
                          color: "#eef2f5",
                          letterSpacing: ".3px",
                        }}
                      >
                        {item.id}
                      </div>
                      <div
                        style={{
                          fontSize: 8.5,
                          fontWeight: 800,
                          letterSpacing: ".9px",
                          color: item.sc,
                        }}
                      >
                        {item.status}
                      </div>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                      <div
                        style={{
                          fontSize: 9,
                          fontWeight: 800,
                          letterSpacing: ".5px",
                          color: "#c6cfd8",
                          background: "#1b222a",
                          border: "1px solid rgba(255,255,255,.08)",
                          borderRadius: 5,
                          padding: "3px 6px",
                        }}
                      >
                        {item.oCode}
                      </div>
                      <div
                        style={{
                          flex: 1,
                          position: "relative",
                          height: 16,
                          display: "flex",
                          alignItems: "center",
                        }}
                      >
                        <div
                          style={{
                            position: "absolute",
                            left: 0,
                            right: 0,
                            top: "50%",
                            borderTop: "1px dashed #3a434e",
                          }}
                        />
                        <div
                          style={{
                            position: "relative",
                            background: bg,
                            padding: "0 4px",
                            marginLeft: "14%",
                            display: "flex",
                            alignItems: "center",
                          }}
                        >
                          {shipIcon}
                        </div>
                        <div
                          style={{
                            position: "relative",
                            background: bg,
                            padding: "1px 6px",
                            marginLeft: "auto",
                            marginRight: "12%",
                            fontSize: 8.5,
                            fontWeight: 800,
                            color: "#aeb8c2",
                            border: "1px solid rgba(255,255,255,.1)",
                            borderRadius: 99,
                          }}
                        >
                          {item.dur}
                        </div>
                      </div>
                      <div
                        style={{
                          fontSize: 9,
                          fontWeight: 800,
                          letterSpacing: ".5px",
                          color: "#c6cfd8",
                          background: "#1b222a",
                          border: "1px solid rgba(255,255,255,.08)",
                          borderRadius: 5,
                          padding: "3px 6px",
                        }}
                      >
                        {item.dCode}
                      </div>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8 }}>
                      <div style={{ minWidth: 0 }}>
                        <div
                          style={{
                            fontSize: 10.5,
                            fontWeight: 600,
                            color: "#9aa5b1",
                            whiteSpace: "nowrap",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            maxWidth: 130,
                          }}
                        >
                          {item.oCity}
                        </div>
                        <div
                          style={{
                            fontSize: 8,
                            fontWeight: 700,
                            letterSpacing: ".8px",
                            color: "#525d68",
                            marginTop: 2,
                          }}
                        >
                          {item.oDate}
                        </div>
                      </div>
                      <div style={{ textAlign: "right", minWidth: 0 }}>
                        <div
                          style={{
                            fontSize: 10.5,
                            fontWeight: 600,
                            color: "#9aa5b1",
                            whiteSpace: "nowrap",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            maxWidth: 130,
                          }}
                        >
                          {item.dCity}
                        </div>
                        <div
                          style={{
                            fontSize: 8,
                            fontWeight: 700,
                            letterSpacing: ".8px",
                            color: "#525d68",
                            marginTop: 2,
                          }}
                        >
                          {item.dDate}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* floating board filter pill bar */}
          <div
            style={{
              position: "absolute",
              bottom: 12,
              left: "50%",
              transform: "translateX(-50%)",
              display: "flex",
              gap: 3,
              background: "rgba(16,20,26,.92)",
              border: "1px solid rgba(255,255,255,.1)",
              borderRadius: 999,
              padding: 4,
              backdropFilter: "blur(8px)",
              boxShadow: "0 8px 24px rgba(0,0,0,.5)",
            }}
          >
            {boards.map((b) => {
              const active = board === b.slug;
              return (
                <button
                  key={b.slug}
                  type="button"
                  title={b.label}
                  onClick={() => setBoard(b.slug)}
                  style={{
                    ...pillBase,
                    background: active ? "#f2f5f7" : "transparent",
                    color: active ? "#12161b" : "#7d8894",
                  }}
                >
                  {b.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* ══ detail panel ══ */}
        {detailOpen && sel && (
          <div
            style={{
              width: 372,
              flex: "none",
              background: "#0e1319",
              display: "flex",
              flexDirection: "column",
              borderRight: "1px solid rgba(255,255,255,.06)",
              position: "relative",
            }}
          >
            <div
              style={{
                flex: 1,
                overflowY: "auto",
                padding: "14px 16px 12px",
                display: "flex",
                flexDirection: "column",
              }}
            >
              <div style={{ position: "relative", textAlign: "center", padding: "4px 0 2px" }}>
                <div
                  style={{
                    fontSize: 8.5,
                    fontWeight: 800,
                    letterSpacing: "1px",
                    color: "#4aa8f0",
                  }}
                >
                  {sel.headline}
                </div>
                <div
                  style={{
                    fontSize: 21,
                    fontWeight: 800,
                    color: "#f2f6f9",
                    letterSpacing: ".5px",
                    marginTop: 5,
                  }}
                >
                  {sel.id}
                </div>
                <HoverBox
                  onClick={() => setDetailOpen(false)}
                  base={{
                    position: "absolute",
                    right: -2,
                    top: 0,
                    width: 26,
                    height: 26,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "#7d8894",
                    cursor: "pointer",
                    fontSize: 15,
                    borderRadius: 8,
                  }}
                  hover={{ background: "#171d24", color: "#dfe6ec" }}
                >
                  ✕
                </HoverBox>
              </div>

              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/live/ship-illustration.png"
                alt="Container ship"
                style={{
                  width: "82%",
                  alignSelf: "center",
                  margin: "16px 0 4px",
                  filter: "drop-shadow(0 14px 22px rgba(0,0,0,.5))",
                }}
              />

              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 8,
                  margin: "10px 0 16px",
                }}
              >
                <div
                  style={{
                    width: 34,
                    height: 34,
                    borderRadius: "50%",
                    background: "radial-gradient(circle at 35% 30%,#5fc4ff,#1e7fd6)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    boxShadow: "0 0 0 5px rgba(47,155,240,.12)",
                  }}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="#eaf6ff">
                    <path d="M12 2l1.8 6.2L20 6.5l-4.4 4.6 5.4 3.3-6.3.9L16 21.5l-4-5-4 5 1.3-6.2-6.3-.9 5.4-3.3L4 6.5l6.2 1.7L12 2z" />
                  </svg>
                </div>
                <div style={{ fontSize: 12.5, fontWeight: 700, color: "#dfe6ec" }}>
                  Transportation by {sel.carrier}
                </div>
                <div
                  style={{ fontSize: 9, fontWeight: 600, letterSpacing: ".6px", color: "#5f6a76" }}
                >
                  {sel.coords}
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                <div
                  style={{
                    background: "#141a21",
                    border: "1px solid rgba(255,255,255,.06)",
                    borderRadius: 11,
                    padding: "10px 11px",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: 6,
                      marginBottom: 9,
                    }}
                  >
                    <div
                      style={{
                        fontSize: 11,
                        fontWeight: 700,
                        color: "#dfe6ec",
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      {sel.oCity}
                    </div>
                    <div
                      style={{
                        fontSize: 8,
                        fontWeight: 800,
                        color: "#9aa5b1",
                        background: "#1e252d",
                        borderRadius: 4,
                        padding: "2px 5px",
                      }}
                    >
                      {sel.oCode}
                    </div>
                  </div>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      fontSize: 10,
                      marginBottom: 4,
                    }}
                  >
                    <span style={{ color: "#5f6a76", fontWeight: 600 }}>Scheduled</span>
                    <span style={{ color: "#c6cfd8", fontWeight: 700 }}>{sel.oSched}</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10 }}>
                    <span style={{ color: "#5f6a76", fontWeight: 600 }}>Actual</span>
                    <span style={{ color: "#c6cfd8", fontWeight: 700 }}>{sel.oActual}</span>
                  </div>
                </div>
                <div
                  style={{
                    background: "#141a21",
                    border: "1px solid rgba(255,255,255,.06)",
                    borderRadius: 11,
                    padding: "10px 11px",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: 6,
                      marginBottom: 9,
                    }}
                  >
                    <div
                      style={{
                        fontSize: 11,
                        fontWeight: 700,
                        color: "#dfe6ec",
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      {sel.dCity}
                    </div>
                    <div
                      style={{
                        fontSize: 8,
                        fontWeight: 800,
                        color: "#9aa5b1",
                        background: "#1e252d",
                        borderRadius: 4,
                        padding: "2px 5px",
                      }}
                    >
                      {sel.dCode}
                    </div>
                  </div>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      fontSize: 10,
                      marginBottom: 4,
                    }}
                  >
                    <span style={{ color: "#5f6a76", fontWeight: 600 }}>Scheduled</span>
                    <span style={{ color: "#c6cfd8", fontWeight: 700 }}>{sel.dSched}</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10 }}>
                    <span style={{ color: "#5f6a76", fontWeight: 600 }}>Estimated</span>
                    <span style={{ color: "#c6cfd8", fontWeight: 700 }}>{sel.dEst}</span>
                  </div>
                </div>
              </div>

              <div
                style={{
                  borderTop: "1px solid rgba(255,255,255,.07)",
                  margin: "14px -16px 0",
                  padding: "12px 16px 0",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "baseline",
                    justifyContent: "space-between",
                    marginBottom: 12,
                  }}
                >
                  <div style={{ fontSize: 13.5, fontWeight: 800, color: "#eef2f5" }}>Route</div>
                  <div
                    style={{
                      fontSize: 8,
                      fontWeight: 700,
                      letterSpacing: ".7px",
                      color: "#5f6a76",
                    }}
                  >
                    ON THE WAY: <span style={{ color: "#c6cfd8" }}>{sel.onway}</span>
                  </div>
                </div>
                <div
                  style={{ position: "relative", height: 10, display: "flex", alignItems: "center", gap: 3 }}
                >
                  <div
                    style={{
                      height: 4,
                      borderRadius: 99,
                      background: "linear-gradient(90deg,#2f9bf0,#57b6f7)",
                      width: `${Math.round(sel.progress * 100)}%`,
                      position: "relative",
                    }}
                  >
                    <div
                      style={{
                        position: "absolute",
                        right: -1,
                        top: "50%",
                        transform: "translate(0,-50%)",
                        width: 7,
                        height: 7,
                        borderRadius: "50%",
                        background: "#6ee08f",
                        boxShadow: "0 0 6px rgba(110,224,143,.8)",
                      }}
                    />
                  </div>
                  <div
                    style={{
                      flex: 1,
                      height: 4,
                      borderRadius: 99,
                      background:
                        "repeating-linear-gradient(90deg,#2c343e 0 6px,transparent 6px 10px)",
                    }}
                  />
                </div>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginTop: 12,
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={`https://flagcdn.com/w80/${sel.oCc}.png`}
                      alt=""
                      style={{ width: 17, height: 17, borderRadius: "50%", objectFit: "cover" }}
                    />
                    <span
                      style={{
                        fontSize: 8,
                        fontWeight: 800,
                        color: "#9aa5b1",
                        background: "#1e252d",
                        borderRadius: 4,
                        padding: "2px 6px",
                      }}
                    >
                      {sel.oCode}
                    </span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span
                      style={{
                        fontSize: 8,
                        fontWeight: 800,
                        color: "#9aa5b1",
                        background: "#1e252d",
                        borderRadius: 4,
                        padding: "2px 6px",
                      }}
                    >
                      {sel.dCode}
                    </span>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={`https://flagcdn.com/w80/${sel.dCc}.png`}
                      alt=""
                      style={{ width: 17, height: 17, borderRadius: "50%", objectFit: "cover" }}
                    />
                  </div>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", marginTop: 7 }}>
                  <div>
                    <div style={{ fontSize: 11.5, fontWeight: 700, color: "#dfe6ec" }}>
                      {sel.oCity}
                    </div>
                    <div
                      style={{
                        fontSize: 8,
                        fontWeight: 700,
                        letterSpacing: ".8px",
                        color: "#525d68",
                        marginTop: 2,
                      }}
                    >
                      {sel.oDate}
                    </div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: 11.5, fontWeight: 700, color: "#dfe6ec" }}>
                      {sel.dCity}
                    </div>
                    <div
                      style={{
                        fontSize: 8,
                        fontWeight: 700,
                        letterSpacing: ".8px",
                        color: "#525d68",
                        marginTop: 2,
                      }}
                    >
                      {sel.dDate}
                    </div>
                  </div>
                </div>
              </div>

              <div
                style={{
                  background: "#141a21",
                  border: "1px solid rgba(255,255,255,.06)",
                  borderRadius: 12,
                  padding: "11px 12px",
                  marginTop: 14,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src="/live/avatar-agent.png"
                    alt=""
                    style={{ width: 32, height: 32, borderRadius: "50%", objectFit: "cover" }}
                  />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 12, fontWeight: 800, color: "#eef2f5" }}>{sel.agent}</div>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 4,
                        fontSize: 9.5,
                        fontWeight: 600,
                        color: "#5f6a76",
                        marginTop: 1,
                      }}
                    >
                      <span
                        style={{
                          width: 5,
                          height: 5,
                          borderRadius: "50%",
                          background: "#3a434e",
                          display: "inline-block",
                        }}
                      />
                      Port Agent
                    </div>
                  </div>
                  <a
                    href="#"
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 5,
                      fontSize: 11,
                      fontWeight: 700,
                      color: "#4aa8f0",
                      textDecoration: "underline",
                    }}
                  >
                    <svg
                      width="12"
                      height="12"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="#4aa8f0"
                      strokeWidth="2"
                    >
                      <rect x="2" y="4" width="20" height="16" rx="2" />
                      <path d="M2 7l10 6 10-6" />
                    </svg>
                    Contact
                  </a>
                </div>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    borderTop: "1px solid rgba(255,255,255,.06)",
                    marginTop: 10,
                    paddingTop: 9,
                  }}
                >
                  <div>
                    <div
                      style={{
                        fontSize: 7,
                        fontWeight: 800,
                        letterSpacing: ".8px",
                        color: "#525d68",
                      }}
                    >
                      CASE ID
                    </div>
                    <div
                      style={{ fontSize: 9.5, fontWeight: 700, color: "#c6cfd8", marginTop: 3 }}
                    >
                      {sel.caseId}
                    </div>
                  </div>
                  <div>
                    <div
                      style={{
                        fontSize: 7,
                        fontWeight: 800,
                        letterSpacing: ".8px",
                        color: "#525d68",
                      }}
                    >
                      SHIPMENT
                    </div>
                    <div
                      style={{ fontSize: 9.5, fontWeight: 700, color: "#c6cfd8", marginTop: 3 }}
                    >
                      {sel.id}
                    </div>
                  </div>
                  <div>
                    <div
                      style={{
                        fontSize: 7,
                        fontWeight: 800,
                        letterSpacing: ".8px",
                        color: "#525d68",
                      }}
                    >
                      ROUTE
                    </div>
                    <div style={{ display: "flex", gap: 3, marginTop: 2 }}>
                      <span
                        style={{
                          fontSize: 7.5,
                          fontWeight: 800,
                          color: "#9aa5b1",
                          background: "#1e252d",
                          borderRadius: 3,
                          padding: "1px 4px",
                        }}
                      >
                        {sel.oCode}
                      </span>
                      <span
                        style={{
                          fontSize: 7.5,
                          fontWeight: 800,
                          color: "#9aa5b1",
                          background: "#1e252d",
                          borderRadius: 3,
                          padding: "1px 4px",
                        }}
                      >
                        {sel.dCode}
                      </span>
                    </div>
                  </div>
                  <div>
                    <div
                      style={{
                        fontSize: 7,
                        fontWeight: 800,
                        letterSpacing: ".8px",
                        color: "#525d68",
                      }}
                    >
                      ETA CONFIDENCE
                    </div>
                    <div
                      style={{ fontSize: 9.5, fontWeight: 700, color: "#c6cfd8", marginTop: 3 }}
                    >
                      {sel.etaConf}
                    </div>
                  </div>
                </div>
              </div>

              <div
                style={{
                  borderTop: "1px solid rgba(255,255,255,.07)",
                  margin: "14px -16px 0",
                  padding: "12px 16px 0",
                  position: "relative",
                  minHeight: 120,
                }}
              >
                <div
                  style={{ fontSize: 13.5, fontWeight: 800, color: "#eef2f5", marginBottom: 11 }}
                >
                  Cargo Details
                </div>
                <div style={{ position: "relative", zIndex: 1 }}>
                  <div
                    style={{
                      fontSize: 7,
                      fontWeight: 800,
                      letterSpacing: ".8px",
                      color: "#525d68",
                    }}
                  >
                    TOTAL WEIGHT
                  </div>
                  <div style={{ fontSize: 11, fontWeight: 800, color: "#dfe6ec", marginTop: 3 }}>
                    {sel.weight}
                  </div>
                  <div
                    style={{
                      fontSize: 7,
                      fontWeight: 800,
                      letterSpacing: ".8px",
                      color: "#525d68",
                      marginTop: 9,
                    }}
                  >
                    CONTAINER
                  </div>
                  <div style={{ fontSize: 11, fontWeight: 800, color: "#dfe6ec", marginTop: 3 }}>
                    {sel.container}
                  </div>
                </div>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/live/container-3d.png"
                  alt="Container"
                  style={{
                    position: "absolute",
                    right: -4,
                    top: 34,
                    width: 200,
                    opacity: 0.95,
                  }}
                />
              </div>

              <div
                style={{
                  position: "sticky",
                  bottom: 4,
                  marginTop: 18,
                  alignSelf: "center",
                  display: "flex",
                  gap: 4,
                  background: "rgba(18,23,29,.95)",
                  border: "1px solid rgba(255,255,255,.1)",
                  borderRadius: 999,
                  padding: 5,
                  backdropFilter: "blur(8px)",
                  boxShadow: "0 10px 26px rgba(0,0,0,.55)",
                }}
              >
                <button
                  type="button"
                  style={{
                    border: "1px solid rgba(102,186,247,.35)",
                    background: "#173040",
                    color: "#7cc4f7",
                    borderRadius: 999,
                    padding: "8px 22px",
                    fontFamily: "inherit",
                    fontSize: 12,
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  Explore
                </button>
                <HoverButton
                  base={{
                    border: "none",
                    background: "transparent",
                    color: "#dfe6ec",
                    borderRadius: 999,
                    padding: "8px 18px",
                    fontFamily: "inherit",
                    fontSize: 12,
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                  hover={{ background: "#1c232b" }}
                >
                  AI Report
                </HoverButton>
                <HoverButton
                  base={{
                    border: "none",
                    background: "transparent",
                    color: "#dfe6ec",
                    borderRadius: 999,
                    width: 36,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    cursor: "pointer",
                  }}
                  hover={{ background: "#1c232b" }}
                >
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="#dfe6ec"
                    strokeWidth="2"
                  >
                    <circle cx="18" cy="5" r="2.5" />
                    <circle cx="6" cy="12" r="2.5" />
                    <circle cx="18" cy="19" r="2.5" />
                    <path d="M8.2 10.8l7.6-4.6M8.2 13.2l7.6 4.6" />
                  </svg>
                </HoverButton>
              </div>
            </div>
          </div>
        )}

        {/* ══ map ══ */}
        <LiveShipmentsMap shipment={sel} detailOpen={detailOpen} shellId={SHELL_ID} />
      </div>
    </div>
  );
}
