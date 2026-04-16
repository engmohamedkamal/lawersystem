import OfficeModel from "../DB/model/SaaSModels/Office.model";
import UserModel from "../DB/model/user.model";
import LegalCaseModel from "../DB/model/LegalCase.model";
import SessionModel from "../DB/model/session.model";
import TaskModel from "../DB/model/tasks.model";
import ClientModel from "../DB/model/client.model";
import SettingsModel from "../DB/model/settings.model";
import LawModel from "../DB/model/law.model";

export const syncOfficeStorage = async () => {
    try {
        console.log("[CRON] syncOfficeStorage started");
        const offices = await OfficeModel.find({ isActive: true });

        for (const office of offices) {
            const officeId = office._id;

            const [
                usersAggr,
                casesAggr,
                sessionsAggr,
                tasksAggr,
                clientsAggr,
                settingsAggr,
                lawsAggr
            ] = await Promise.all([
                UserModel.aggregate([
                    { $match: { officeId, isDeleted: false } },
                    { $group: { _id: null, total: { $sum: "$ProfilePhoto.sizeBytes" } } }
                ]),
                LegalCaseModel.aggregate([
                    { $match: { officeId, isDeleted: false } },
                    { $unwind: { path: "$attachments", preserveNullAndEmptyArrays: false } },
                    { $group: { _id: null, total: { $sum: "$attachments.sizeBytes" } } }
                ]),
                SessionModel.aggregate([
                    { $match: { officeId, isDeleted: false } },
                    { $unwind: { path: "$attachments", preserveNullAndEmptyArrays: false } },
                    { $group: { _id: null, total: { $sum: "$attachments.sizeBytes" } } }
                ]),
                TaskModel.aggregate([
                    { $match: { officeId, isDeleted: false } },
                    { $unwind: { path: "$attachments", preserveNullAndEmptyArrays: false } },
                    { $group: { _id: null, total: { $sum: "$attachments.sizeBytes" } } }
                ]),
                ClientModel.aggregate([
                    { $match: { officeId, isDeleted: false } },
                    { $unwind: { path: "$documents", preserveNullAndEmptyArrays: false } },
                    { $group: { _id: null, total: { $sum: "$documents.sizeBytes" } } }
                ]),
                SettingsModel.aggregate([
                    { $match: { officeId } },
                    { $group: { _id: null, total: { $sum: "$logoSizeBytes" } } }
                ]),
                LawModel.aggregate([
                    { $match: { officeId } },
                    { $group: { _id: null, total: { $sum: "$fileSizeBytes" } } }
                ])
            ]);

            const usersTotal = usersAggr[0]?.total || 0;
            const casesTotal = casesAggr[0]?.total || 0;
            const sessionsTotal = sessionsAggr[0]?.total || 0;
            const tasksTotal = tasksAggr[0]?.total || 0;
            const clientsTotal = clientsAggr[0]?.total || 0;
            const settingsTotal = settingsAggr[0]?.total || 0;
            const lawsTotal = lawsAggr[0]?.total || 0;

            const totalUsed = usersTotal + casesTotal + sessionsTotal + tasksTotal + clientsTotal + settingsTotal + lawsTotal;

            await OfficeModel.findByIdAndUpdate(officeId, { $set: { storageUsedBytes: totalUsed } });
        }

        console.log("[CRON] syncOfficeStorage completed for all active offices");
    } catch (error) {
        console.error("[CRON ERROR] syncOfficeStorage:", error);
    }
};
