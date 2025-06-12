import { fork } from "child_process";

const WORKER_COUNT = 3;

for (let i = 0; i < WORKER_COUNT; i++) {
  const worker = fork("./server.mjs");
  console.log(`🚀 Worker ${i + 1} started (PID: ${worker.pid})`);
}
