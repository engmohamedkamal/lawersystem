import OfficeModel from "../DB/model/SaaSModels/Office.model";
import UserModel from "../DB/model/user.model";
import LegalCaseModel from "../DB/model/LegalCase.model";
import SessionModel from "../DB/model/session.model";
import TaskModel from "../DB/model/tasks.model";
import TaskCommentModel from "../DB/model/taskComment.model";
import ClientModel from "../DB/model/client.model";
import SettingsModel from "../DB/model/settings.model";
import LawModel from "../DB/model/law.model";
import { buildCloudinaryBytesMap } from "../helpers/cloudinaryStorage.helper";

interface FileRef {
    publicId: string;
    mongoBytes: number;
    source: string; 
}


const collectOfficePublicIds = async (officeId: any): Promise<FileRef[]> => {
    const items: FileRef[] = [];

    const users = await UserModel.find({ officeId }).select("ProfilePhoto").lean();
    for (const u of users) {
        const photo = (u as any).ProfilePhoto;
        const pid = photo?.publicId || photo?.PublicId;
        if (pid) items.push({ publicId: pid, mongoBytes: photo?.sizeBytes || 0, source: "user-photo" });
    }

    const cases = await LegalCaseModel.find({ officeId }).select("attachments").lean();
    for (const c of cases) {
        for (const att of ((c as any).attachments || [])) {
            if (att.publicId) items.push({ publicId: att.publicId, mongoBytes: att.sizeBytes || 0, source: "case-attachment" });
        }
    }

    const sessions = await SessionModel.find({ officeId }).select("attachments").lean();
    for (const s of sessions) {
        for (const att of ((s as any).attachments || [])) {
            if (att.publicId) items.push({ publicId: att.publicId, mongoBytes: att.sizeBytes || 0, source: "session-attachment" });
        }
    }

    const tasks = await TaskModel.find({ officeId }).select("_id attachments").lean();
    const taskIds = [];
    for (const t of tasks) {
        taskIds.push(t._id);
        for (const att of ((t as any).attachments || [])) {
            if (att.publicId) items.push({ publicId: att.publicId, mongoBytes: att.sizeBytes || 0, source: "task-attachment" });
        }
    }

    if (taskIds.length > 0) {
        const taskComments = await TaskCommentModel.find({ taskId: { $in: taskIds } }).select("attachments").lean();
        for (const tc of taskComments) {
            for (const att of ((tc as any).attachments || [])) {
                if (att.publicId) items.push({ publicId: att.publicId, mongoBytes: att.sizeBytes || 0, source: "task-comment-attachment" });
            }
        }
    }

    const clients = await ClientModel.find({ officeId }).select("documents").lean();
    for (const cl of clients) {
        for (const doc of ((cl as any).documents || [])) {
            if (doc.publicId) items.push({ publicId: doc.publicId, mongoBytes: doc.sizeBytes || 0, source: "client-document" });
        }
    }

    const settings = await SettingsModel.findOne({ officeId }).select("logoPublicId logoSizeBytes").lean();
    if (settings?.logoPublicId) {
        items.push({ publicId: settings.logoPublicId, mongoBytes: (settings as any).logoSizeBytes || 0, source: "settings-logo" });
    }

    const laws = await LawModel.find({ officeId }).select("filePublicId fileSizeBytes").lean();
    for (const law of laws) {
        if ((law as any).filePublicId) {
            items.push({ publicId: (law as any).filePublicId, mongoBytes: (law as any).fileSizeBytes || 0, source: "law-pdf" });
        }
    }

    return items;
};


export const syncOfficeStorage = async () => {
    try {
        console.log("[CRON] syncOfficeStorage started — building Cloudinary map…");

        const cloudinaryMap = await buildCloudinaryBytesMap();
        console.log(`[CRON] Cloudinary map built: ${cloudinaryMap.size} resources found`);

        const offices = await OfficeModel.find({ isActive: true });

        for (const office of offices) {
            const officeId = office._id;

            const officeFiles = await collectOfficePublicIds(officeId);

            let cloudinaryTotal = 0;
            let mongoTotal = 0;
            let mismatches = 0;
            let ghostRefs = 0;

            for (const file of officeFiles) {
                mongoTotal += file.mongoBytes;

                const actualBytes = cloudinaryMap.get(file.publicId);

                if (actualBytes !== undefined) {
                    cloudinaryTotal += actualBytes;

                    if (actualBytes !== file.mongoBytes) {
                        mismatches++;
                        console.warn(
                            `[CRON] Size mismatch: "${file.publicId}" (${file.source}) — ` +
                            `mongo=${file.mongoBytes}B, cloudinary=${actualBytes}B`
                        );
                    }
                } else {
                    ghostRefs++;
                }
            }

            const previousBytes = office.storageUsedBytes || 0;
            await OfficeModel.findByIdAndUpdate(officeId, {
                $set: { storageUsedBytes: cloudinaryTotal },
            });

            const drift = previousBytes - cloudinaryTotal;
            if (drift !== 0 || mismatches > 0 || ghostRefs > 0) {
                console.warn(
                    `[CRON] Storage corrected for "${office.name}" (${officeId}): ` +
                    `counter was ${previousBytes}B → corrected to ${cloudinaryTotal}B ` +
                    `(mongoSum=${mongoTotal}B, drift=${drift}B, ` +
                    `sizeMismatches=${mismatches}, ghostRefs=${ghostRefs})`
                );
            }
        }

        console.log("[CRON] syncOfficeStorage completed for all active offices");
    } catch (error) {
        console.error("[CRON ERROR] syncOfficeStorage:", error);
    }
};
