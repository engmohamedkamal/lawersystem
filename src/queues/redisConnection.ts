import IORedis from "ioredis";

const redisUrl = process.env.REDIS_URL || "redis://127.0.0.1:6379";

export const redisConnection = new IORedis(redisUrl, {
  maxRetriesPerRequest: null, 
  enableReadyCheck: false,
});

redisConnection.on("error", (err) => {
  console.error("[REDIS] connection error:", err.message);
});

redisConnection.on("connect", () => {
  console.log("[REDIS] connected");
});
