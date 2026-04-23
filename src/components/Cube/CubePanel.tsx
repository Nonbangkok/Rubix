"use client";

import { useState } from "react";
import { useTimerStore } from "@/lib/timer/store";
import { Cube3D } from "./Cube3D";
import { CubeNet } from "./CubeNet";
import styles from "./CubePanel.module.css";

type Tab = "net" | "3d";

export function CubePanel() {
  const scramble = useTimerStore((s) => s.scramble);
  const [tab, setTab] = useState<Tab>("net");

  return (
    <div className={styles.panel}>
      <div className={styles.tabs}>
        <button
          className={`${styles.tab} ${tab === "net" ? styles.active : ""}`}
          onClick={() => setTab("net")}
        >
          NET
        </button>
        <button
          className={`${styles.tab} ${tab === "3d" ? styles.active : ""}`}
          onClick={() => setTab("3d")}
        >
          3D
        </button>
      </div>
      <div className={`${styles.body} ${tab === "3d" ? styles.body3d : ""}`}>
        {tab === "net" ? (
          <CubeNet scramble={scramble} />
        ) : (
          <Cube3D scramble={scramble} />
        )}
      </div>
    </div>
  );
}
