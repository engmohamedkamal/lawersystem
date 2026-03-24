import AppointmentModel from "../DB/model/Appointment.model";

export const completeExpiredAppointments = async () => {
  const now = new Date();

  const result = await AppointmentModel.updateMany(
    {
      status: "CONFIRMED",
      expireAt: { $lte: now },
    },
    {
      $set: { status: "COMPLETED" },
    }
  );

  if (result.modifiedCount > 0) {
    console.log(`[CRON] Completed ${result.modifiedCount} appointments at ${now.toISOString()}`);
  }
}