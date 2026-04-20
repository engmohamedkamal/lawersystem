import { Queue, Worker } from "bullmq";
import { redisConnection } from "./redisConnection";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import fs from "node:fs";
import path from "node:path";

const execFileAsync = promisify(execFile);

export interface BackupJobData {
  source: "daily-scheduler" | "manual";
}

export const backupQueue = new Queue<BackupJobData>("mongo-backup", {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 2,
    backoff: {
      type: "exponential",
      delay: 10000,
    },
    removeOnComplete: { count: 30 },
    removeOnFail: { count: 100 },
  },
});

let backupWorker: Worker<BackupJobData> | null = null;

const ensureDir = (dirPath: string) => {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
};

const pathExists = (targetPath: string) => {
  try {
    return fs.existsSync(targetPath);
  } catch {
    return false;
  }
};

const getTimestamp = () => {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  const hh = String(now.getHours()).padStart(2, "0");
  const min = String(now.getMinutes()).padStart(2, "0");

  return `${yyyy}-${mm}-${dd}_${hh}-${min}`;
};

const RETENTION_DAYS = 7;

const cleanOldBackups = (dirs: string[]) => {
  const cutoff = Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000;
  let deleted = 0;

  for (const dir of dirs) {
    if (!fs.existsSync(dir)) continue;

    const files = fs.readdirSync(dir).filter((f) => f.startsWith("backup_") && f.endsWith(".gz"));

    for (const file of files) {
      const filePath = path.join(dir, file);
      try {
        const stat = fs.statSync(filePath);
        if (stat.mtimeMs < cutoff) {
          fs.unlinkSync(filePath);
          deleted++;
          console.log(`[BACKUP CLEANUP] deleted old backup: ${filePath}`);
        }
      } catch (err: any) {
        console.error(`[BACKUP CLEANUP] failed to delete ${filePath}:`, err.message);
      }
    }
  }

  if (deleted > 0) {
    console.log(`[BACKUP CLEANUP] removed ${deleted} backup(s) older than ${RETENTION_DAYS} days`);
  }
};

export const startBackupWorker = () => {
  if (backupWorker) return;

  backupWorker = new Worker<BackupJobData>(
    "mongo-backup",
    async (job) => {
      const mongoUri = process.env.BD_URL_ONLINE;
      const mongoDumpPath = process.env.MONGODUMP_PATH;

      if (!mongoUri) {
        throw new Error("BD_URL_ONLINE is missing in environment variables");
      }

      if (!mongoDumpPath) {
        throw new Error("MONGODUMP_PATH is missing in environment variables");
      }

      if (!pathExists(mongoDumpPath)) {
        throw new Error(`mongodump.exe not found at: ${mongoDumpPath}`);
      }

      const ts = getTimestamp();

      const targets: string[] = [];

      const localDir = process.env.BACKUP_LOCAL_DIR || "D:\\mongo-backups";
      ensureDir(localDir);
      targets.push(path.join(localDir, `backup_${ts}.gz`));

      const oneDriveDir = process.env.BACKUP_ONEDRIVE_DIR;
      if (oneDriveDir) {
        ensureDir(oneDriveDir);
        targets.push(path.join(oneDriveDir, `backup_${ts}.gz`));
      }

      const googleDriveDir = process.env.BACKUP_GDRIVE_DIR;
      if (googleDriveDir) {
        ensureDir(googleDriveDir);
        targets.push(path.join(googleDriveDir, `backup_${ts}.gz`));
      }

      if (targets.length === 0) {
        throw new Error("No backup targets configured");
      }

      for (const archivePath of targets) {
        try {
          await execFileAsync(mongoDumpPath, [
            `--uri=${mongoUri}`,
            `--archive=${archivePath}`,
            "--gzip",
          ]);

          console.log(`[BACKUP WORKER] backup saved -> ${archivePath}`);
        } catch (error: any) {
          console.error(
            `[BACKUP WORKER] failed target -> ${archivePath}`,
            error?.message || error
          );
          throw error;
        }
      }

      const allDirs = [process.env.BACKUP_LOCAL_DIR || "D:\\mongo-backups"];
      if (process.env.BACKUP_ONEDRIVE_DIR) allDirs.push(process.env.BACKUP_ONEDRIVE_DIR);
      if (process.env.BACKUP_GDRIVE_DIR) allDirs.push(process.env.BACKUP_GDRIVE_DIR);
      cleanOldBackups(allDirs);

      console.log(
        `[BACKUP WORKER] completed job ${job.id} from source=${job.data.source}`
      );
    },
    {
      connection: redisConnection,
      concurrency: 1,
    }
  );

  backupWorker.on("failed", (job, err) => {
    console.error(
      `[BACKUP WORKER] failed job ${job?.id} (attempt ${job?.attemptsMade}/${job?.opts.attempts}):`,
      err.message
    );
  });

  backupWorker.on("error", (err) => {
    console.error("[BACKUP WORKER] error:", err.message);
  });

  console.log("[BACKUP WORKER] started");
};

export const stopBackupWorker = async () => {
  if (backupWorker) {
    await backupWorker.close();
    backupWorker = null;
  }
};

export const registerBackupScheduler = async () => {
  await backupQueue.upsertJobScheduler(
    "daily-midnight-backup",
    {
      pattern: "0 0 * * *", 
    },
    {
      name: "run-mongo-backup",
      data: {
        source: "daily-scheduler",
      },
      opts: {},
    }
  );

  console.log("[BACKUP SCHEDULER] daily 12:00 AM scheduler registered");
};

export const runBackupNow = async () => {
  await backupQueue.add(
    "manual-mongo-backup",
    { source: "manual" },
    {
      removeOnComplete: true,
    }
  );

  console.log("[BACKUP QUEUE] manual backup job added");
};