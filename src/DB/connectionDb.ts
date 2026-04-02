import mongoose from "mongoose";

export const connectionDB = async () => {
  try {
    await mongoose.connect(process.env.BD_URL_ONLINE as string, {
      serverSelectionTimeoutMS: 30000,
      socketTimeoutMS: 45000,
    });

    console.log("success to connect db...");
  } catch (error) {
    console.error("fail connect db...", error);
    throw error;
  }
};

mongoose.connection.on("connected", () => {
  console.log("[MONGO] connected");
});

mongoose.connection.on("disconnected", () => {
  console.warn("[MONGO] disconnected");
});

mongoose.connection.on("reconnected", () => {
  console.log("[MONGO] reconnected");
});

mongoose.connection.on("error", (error) => {
  console.error("[MONGO] error", error);
});

export default connectionDB;