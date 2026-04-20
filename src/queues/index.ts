import { registerBackupScheduler, startBackupWorker } from "./backup.queue";
import { startEmailWorker } from "./email.queue";
import { startSubscriptionWorkers } from "./subscription.queue";


export const startAllWorkers = async () => {
  startEmailWorker();
  startSubscriptionWorkers();
  startBackupWorker();
  await registerBackupScheduler();
  console.log("[QUEUES] All workers initialized");
};
