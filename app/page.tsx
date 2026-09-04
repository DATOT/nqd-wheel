"use client";

import { useState, useRef, useCallback, useEffect } from "react";

/* ---------- types ---------- */

export interface WheelEntry {
  id: string;
  name: string;
  weight: number;
  color: string;
}

/* ---------- config ---------- */

const PALETTE = [
  "#E4572E",
  "#29A0B1",
  "#F2B705",
  "#8C3061",
  "#3D9970",
  "#D64550",
  "#4C6EF5",
  "#E0A458",
  "#2F9C95",
  "#B15E93",
];

// Reveal sound effects
const REVEAL_SOUNDS = [
  "/yay.mp3",
  "/67.mp3",
  "/ahhh.mp3",
  "/among-us.mp3",
  "/bruh.mp3",
  "/happy-happy-happy.mp3",
  "rizz-sound-effect.mp3",
  "the-undertaker-bell.mp3",
  "uwu.mp3",
  "vine-boom-sound.mp3",
  "yay-roblox.mp3",
];

let idCounter = 1;

const makeId = () => `entry-${idCounter++}`;

const DEFAULT_ENTRIES: WheelEntry[] = [
  { id: makeId(), name: "Sấp", weight: 35, color: PALETTE[0] },
  { id: makeId(), name: "Ngửa", weight: 25, color: PALETTE[1] },
];

/* ---------- geometry ---------- */

function polarToCartesian(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = ((angleDeg - 90) * Math.PI) / 180;

  return {
    x: cx + r * Math.cos(rad),
    y: cy + r * Math.sin(rad),
  };
}

function arcPath(
  cx: number,
  cy: number,
  r: number,
  startAngle: number,
  endAngle: number,
): string {
  const start = polarToCartesian(cx, cy, r, endAngle);
  const end = polarToCartesian(cx, cy, r, startAngle);

  const largeArc = endAngle - startAngle <= 180 ? 0 : 1;

  return [
    `M ${cx} ${cy}`,
    `L ${start.x} ${start.y}`,
    `A ${r} ${r} 0 ${largeArc} 0 ${end.x} ${end.y}`,
    "Z",
  ].join(" ");
}

/* ---------- weighted selection ---------- */

/*
 * IMPORTANT:
 *
 * The wheel is intentionally drawn with equal-sized slices.
 * The probability is controlled ONLY by weight.
 *
 * Example:
 *
 * A = 90
 * B = 10
 *
 * Both slices look identical, but A has a 90% chance
 * of being selected.
 */
function weightedPick(entries: WheelEntry[]): WheelEntry {
  const totalWeight = entries.reduce((sum, entry) => sum + entry.weight, 0);

  let random = Math.random() * totalWeight;

  for (const entry of entries) {
    if (random < entry.weight) {
      return entry;
    }

    random -= entry.weight;
  }

  return entries[entries.length - 1];
}

/* ---------- component ---------- */

export default function WeightedWheel() {
  const [entries, setEntries] = useState<WheelEntry[]>(DEFAULT_ENTRIES);

  const [rotation, setRotation] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const [winner, setWinner] = useState<WheelEntry | null>(null);

  const [showConfig, setShowConfig] = useState(false);
  const [showOdds, setShowOdds] = useState(false);

  const [newName, setNewName] = useState("");

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const spinTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const tickAudioRef = useRef<HTMLAudioElement | null>(null);
  const revealAudioRef = useRef<HTMLAudioElement | null>(null);
  const wheelRef = useRef<HTMLDivElement | null>(null);

  const n = entries.length;

  const segAngle = n > 0 ? 360 / n : 0;

  const totalWeight =
    entries.reduce((sum, entry) => sum + entry.weight, 0) || 1;

  /* ---------- keyboard shortcut ---------- */

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.ctrlKey && event.key.toLowerCase() === "h") {
        event.preventDefault();

        if (!spinning) {
          setShowConfig((visible) => !visible);
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [spinning]);

  /* SFX */
  useEffect(() => {
    tickAudioRef.current = new Audio("/tick.mp3");
    tickAudioRef.current.volume = 0.35;

    revealAudioRef.current = new Audio();
    revealAudioRef.current.volume = 0.25;

    return () => {
      tickAudioRef.current = null;
      revealAudioRef.current = null;
    };
  }, []);

  /* ---------- cleanup ---------- */

  useEffect(() => {
    return () => {
      if (spinTimeout.current) {
        clearTimeout(spinTimeout.current);
      }
    };
  }, []);

  /* ---------- entry manipulation ---------- */

  const updateEntry = (id: string, patch: Partial<WheelEntry>) => {
    setEntries((current) =>
      current.map((entry) =>
        entry.id === id ? { ...entry, ...patch } : entry,
      ),
    );
  };

  const removeEntry = (id: string) => {
    setEntries((current) => current.filter((entry) => entry.id !== id));

    setWinner((current) => (current?.id === id ? null : current));
  };

  const addEntry = () => {
    const name = newName.trim();

    if (!name) return;

    const color = PALETTE[entries.length % PALETTE.length];

    const newEntry: WheelEntry = {
      id: makeId(),
      name,
      weight: 10,
      color,
    };

    setEntries((current) => [...current, newEntry]);

    setNewName("");
  };

  /* ---------- play random reveal sound ---------- */

  const playRevealSound = () => {
    if (!revealAudioRef.current) return;

    const randomSound =
      REVEAL_SOUNDS[Math.floor(Math.random() * REVEAL_SOUNDS.length)];

    revealAudioRef.current.src = randomSound;
    revealAudioRef.current.currentTime = 0;
    revealAudioRef.current.play().catch(() => { });
  };

  /* ---------- spin ---------- */

  const spin = useCallback(() => {
    if (spinning || entries.length < 2) {
      return;
    }

    setWinner(null);
    setSpinning(true);

    const picked = weightedPick(entries);

    const winnerIndex = entries.findIndex((entry) => entry.id === picked.id);

    const centerAngle = winnerIndex * segAngle + segAngle / 2;

    /*
     * Don't always land exactly in the middle.
     * This makes the wheel feel less predictable.
     */
    const edgeBias = Math.random() < 0.5 ? -1 : 1;
    const distanceFromCenter = Math.pow(Math.random(), 0.45);

    const jitter = edgeBias * distanceFromCenter * segAngle * 0.42;

    const targetAngle = centerAngle + jitter;

    /*
     * The pointer is at the top (0 degrees).
     * Calculate how far the wheel needs to rotate
     * so the selected slice lands underneath it.
     */
    const currentMod = ((rotation % 360) + 360) % 360;

    const desiredMod = (((360 - targetAngle) % 360) + 360) % 360;

    let delta = desiredMod - currentMod;

    if (delta < 0) {
      delta += 360;
    }

    const extraSpins = 5 + Math.floor(Math.random() * 3);

    const newRotation = rotation + extraSpins * 360 + delta;

    setRotation(newRotation);

    if (spinTimeout.current) {
      clearTimeout(spinTimeout.current);
    }

    spinTimeout.current = setTimeout(() => {
      setSpinning(false);
      setWinner(picked);
      playRevealSound();
    }, 4200);
  }, [spinning, entries, rotation, segAngle]);

  /* ---------- import ---------- */

  const importWheel = () => {
    fileInputRef.current?.click();
  };

  const handleImport = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];

    if (!file) return;

    const reader = new FileReader();

    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result));

        if (!Array.isArray(parsed)) {
          throw new Error("Invalid format");
        }

        const imported: WheelEntry[] = parsed.map((entry, index) => {
          if (
            typeof entry !== "object" ||
            entry === null ||
            typeof entry.name !== "string" ||
            typeof entry.weight !== "number" ||
            typeof entry.color !== "string"
          ) {
            throw new Error("Invalid entry");
          }

          return {
            id: typeof entry.id === "string" ? entry.id : makeId(),

            name: entry.name,
            weight: Math.max(0.1, Number(entry.weight) || 0.1),

            color: entry.color || PALETTE[index % PALETTE.length],
          };
        });

        if (imported.length < 2) {
          throw new Error("The wheel needs at least 2 entries.");
        }

        setEntries(imported);
        setWinner(null);
        setRotation(0);
      } catch {
        alert(
          "Could not import this file.\n\nMake sure it is a valid wheel JSON file.",
        );
      }
    };

    reader.readAsText(file);

    /*
     * Reset the input so importing the same file again
     * still triggers onChange.
     */
    event.target.value = "";
  };

  /* ---------- export ---------- */

  const exportWheel = () => {
    const data = JSON.stringify(
      entries.map((entry) => ({
        name: entry.name,
        weight: entry.weight,
        color: entry.color,
      })),
      null,
      2,
    );

    const blob = new Blob([data], { type: "application/json" });

    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");

    link.href = url;
    link.download = "weighted-wheel.json";

    document.body.appendChild(link);
    link.click();

    link.remove();

    URL.revokeObjectURL(url);
  };

  useEffect(() => {
    if (!spinning || !wheelRef.current) return;

    let previousAngle = rotation;
    let animationFrame: number;

    const tick = () => {
      if (!wheelRef.current) return;

      const transform = getComputedStyle(wheelRef.current).transform;

      if (transform !== "none") {
        const values = transform
          .match(/matrix\(([^)]+)\)/)?.[1]
          ?.split(",")
          .map(Number);

        if (values && values.length >= 2) {
          const [a, b] = values;

          let angle = Math.atan2(b, a) * (180 / Math.PI);

          if (angle < 0) angle += 360;

          // Detect crossing a slice edge
          const previousSegment = Math.floor(previousAngle / segAngle);
          const currentSegment = Math.floor(angle / segAngle);

          if (previousSegment !== currentSegment) {
            const audio = tickAudioRef.current;

            if (audio) {
              audio.currentTime = 0;
              audio.play().catch(() => { });
            }
          }

          previousAngle = angle;
        }
      }

      animationFrame = requestAnimationFrame(tick);
    };

    animationFrame = requestAnimationFrame(tick);

    return () => cancelAnimationFrame(animationFrame);
  }, [spinning, segAngle]);

  /* ---------- display helpers ---------- */

  const fontSize = n > 8 ? 10 : n > 5 ? 12 : 14;

  const truncate = (value: string) =>
    value.length > 10 ? value.slice(0, 9) + "…" : value;

  /* ---------- render ---------- */

  return (
    <div className="min-h-screen w-full bg-[#0B1F2B] text-[#F5EFE0] flex items-center justify-center p-6">
      <div
        className={[
          "w-full max-w-6xl",
          "grid gap-10 items-start",
          showConfig ? "md:grid-cols-[auto_1fr]" : "grid-cols-1",
        ].join(" ")}
      >
        {/* ==================== WHEEL ==================== */}

        <div className="flex flex-col items-center gap-5">
          <div
            className="relative"
            style={{
              width: 340,
              height: 340,
            }}
          >
            {/* Outer glow */}
            <div
              className="absolute inset-0 rounded-full"
              style={{
                boxShadow:
                  "0 0 0 2px #F2B70533, 0 0 40px 6px rgba(242,183,5,0.08)",
              }}
            />

            {/* Decorative dots */}
            {Array.from({ length: 24 }).map((_, index) => {
              const angle = (index / 24) * 360;

              const point = polarToCartesian(170, 170, 166, angle);

              return (
                <div
                  key={index}
                  className="absolute rounded-full"
                  style={{
                    width: 5,
                    height: 5,
                    left: point.x - 2.5,
                    top: point.y - 2.5,
                    background: index % 2 === 0 ? "#F2B705" : "#F5EFE0",
                    opacity: 0.7,
                  }}
                />
              );
            })}

            {/* Pointer */}
            <svg
              width="340"
              height="340"
              viewBox="0 0 340 340"
              className="absolute inset-0"
              style={{ zIndex: 20 }}
            >
              <polygon
                points="158,15 182,15 170,40"
                fill="#F2B705"
                stroke="#0B1F2B"
                strokeWidth={1.5}
              />
            </svg>

            {/* Rotating wheel */}
            <div
              ref={wheelRef}
              className="absolute"
              style={{
                left: 20,
                top: 20,
                width: 300,
                height: 300,

                transform: `rotate(${rotation}deg)`,

                transition: "transform 4.2s cubic-bezier(0.12,0.67,0.15,1)",
              }}
            >
              <svg width="300" height="300" viewBox="0 0 300 300">
                {/* Wheel border */}
                <circle
                  cx="150"
                  cy="150"
                  r="148"
                  fill="#0B1F2B"
                  stroke="#F2B705"
                  strokeWidth={2}
                />

                {/* Equal visual slices */}
                {entries.map((entry, index) => {
                  const start = index * segAngle;

                  const end = start + segAngle;

                  const mid = start + segAngle / 2;

                  return (
                    <g key={entry.id}>
                      <path
                        d={arcPath(150, 150, 145, start, end)}
                        fill={entry.color}
                        stroke="#0B1F2B"
                        strokeWidth={1.5}
                      />

                      <text
                        x={150}
                        y={55}
                        transform={`rotate(${mid} 150 150)`}
                        textAnchor="middle"
                        fontSize={fontSize}
                        fontWeight={700}
                        fill="#0B1F2B"
                      >
                        {truncate(entry.name)}
                      </text>
                    </g>
                  );
                })}

                {/* Center */}
                <circle
                  cx="150"
                  cy="150"
                  r="20"
                  fill="#F2B705"
                  stroke="#0B1F2B"
                  strokeWidth={2}
                />
              </svg>
            </div>
          </div>

          {/* Spin */}
          <button
            onClick={spin}
            disabled={spinning || entries.length < 2}
            className="
              px-8 py-3
              rounded-full
              font-bold
              text-[#0B1F2B]
              bg-[#F2B705]
              hover:bg-[#FFCA28]
              disabled:opacity-40
              disabled:cursor-not-allowed
              transition-colors
            "
          >
            {spinning ? "Đang quay..." : "Quay"}
          </button>

          {/* Winner */}
          {winner && !spinning && (
            <div className="text-center">
              <div className="text-sm text-[#8FA8B3]">Quay ra:</div>

              <div
                className="text-2xl font-bold"
                style={{
                  color: winner.color,
                }}
              >
                {winner.name}
              </div>
            </div>
          )}
        </div>

        {/* ==================== CONFIG ==================== */}

        {showConfig && (
          <div className="bg-[#123244] rounded-2xl p-6 flex flex-col gap-4">
            {/* Header */}
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold">Names &amp; odds</h2>

              <button
                onClick={() => setShowOdds((visible) => !visible)}
                className="
                  text-[5px]
                  text-[#8FA8B3]
                  hover:text-[#F5EFE0]
                  underline
                "
              >
                {showOdds ? "Hide odds" : "Show odds"}
              </button>
            </div>

            {/* Entries */}
            <div
              className="
                flex flex-col gap-2
                max-h-96
                overflow-y-auto
                pr-1
              "
            >
              {entries.map((entry) => {
                const percentage = ((entry.weight / totalWeight) * 100).toFixed(
                  1,
                );

                return (
                  <div
                    key={entry.id}
                    className="
                      flex items-center gap-2
                      bg-[#0B1F2B]
                      rounded-lg
                      p-2
                    "
                  >
                    {/* Color */}
                    <input
                      type="color"
                      value={entry.color}
                      onChange={(event) =>
                        updateEntry(entry.id, {
                          color: event.target.value,
                        })
                      }
                      className="
                        w-7 h-7
                        rounded
                        cursor-pointer
                        bg-transparent
                      "
                    />

                    {/* Name */}
                    <input
                      type="text"
                      value={entry.name}
                      onChange={(event) =>
                        updateEntry(entry.id, {
                          name: event.target.value,
                        })
                      }
                      className="
                        flex-1
                        min-w-0
                        bg-transparent
                        border-b
                        border-[#8FA8B3]/30
                        focus:border-[#F2B705]
                        outline-none
                        text-sm
                        py-1
                      "
                    />

                    {/* Weight */}
                    {showOdds && (
                      <>
                        <input
                          type="number"
                          min={0.1}
                          step={0.5}
                          value={entry.weight}
                          onChange={(event) =>
                            updateEntry(entry.id, {
                              weight: Math.max(
                                0.1,
                                Number(event.target.value) || 0.1,
                              ),
                            })
                          }
                          className="
                        w-16
                        bg-[#123244]
                        rounded
                        px-2 py-1
                        text-sm
                        text-right
                        outline-none
                      "
                        />

                        <span
                          className="
                          text-xs
                          text-[#8FA8B3]
                          w-12
                          text-right
                        "
                        >
                          {percentage}%
                        </span>
                      </>
                    )}

                    {/* Remove */}
                    <button
                      onClick={() => removeEntry(entry.id)}
                      disabled={entries.length <= 2}
                      className="
                        text-[#8FA8B3]
                        hover:text-[#D64550]
                        disabled:opacity-30
                        px-1
                      "
                      aria-label={`Remove ${entry.name}`}
                    >
                      ✕
                    </button>
                  </div>
                );
              })}
            </div>

            {/* Add */}
            <div
              className="
                flex gap-2
                pt-2
                border-t
                border-[#8FA8B3]/20
              "
            >
              <input
                type="text"
                value={newName}
                onChange={(event) => setNewName(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    addEntry();
                  }
                }}
                placeholder="Add a name…"
                className="
                  flex-1
                  bg-[#0B1F2B]
                  rounded-lg
                  px-3 py-2
                  text-sm
                  outline-none
                "
              />

              <button
                onClick={addEntry}
                className="
                  px-4 py-2
                  rounded-lg
                  bg-[#F2B705]
                  text-[#0B1F2B]
                  font-semibold
                  text-sm
                  hover:bg-[#FFCA28]
                "
              >
                + Thêm
              </button>
            </div>

            {/* Import / Export */}
            <div
              className="
                flex gap-2
                pt-2
                border-t
                border-[#8FA8B3]/20
              "
            >
              <button
                onClick={importWheel}
                className="
                  flex-1
                  px-3 py-2
                  rounded-lg
                  bg-[#0B1F2B]
                  hover:bg-[#18394A]
                  text-sm
                  font-semibold
                  transition-colors
                "
              >
                Import
              </button>

              <button
                onClick={exportWheel}
                className="
                  flex-1
                  px-3 py-2
                  rounded-lg
                  bg-[#0B1F2B]
                  hover:bg-[#18394A]
                  text-sm
                  font-semibold
                  transition-colors
                "
              >
                Export
              </button>

              <input
                ref={fileInputRef}
                type="file"
                accept=".json,application/json"
                onChange={handleImport}
                className="hidden"
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
