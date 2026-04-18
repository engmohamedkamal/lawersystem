import { Types } from "mongoose";
import ClientModel from "../DB/model/client.model";
import LegalCaseModel from "../DB/model/LegalCase.model";
import SessionModel from "../DB/model/session.model";
import TaskModel from "../DB/model/tasks.model";
import InvoiceModel from "../DB/model/invoice.model";
import cloudinary from "../utils/cloudInary";
import { releaseStorage } from "./storage.helper";
import { removeExtraPayment, syncCaseFees } from "../moudles/invoice/invoice.service";


export const cascadeHardDeleteCase = async (caseId: string, officeId: string, deletedBy: string) => {
    const legalCase = await LegalCaseModel.findOne({ _id: caseId, officeId });
    if (!legalCase) return;

    if (legalCase.attachments && legalCase.attachments.length > 0) {
        for (const att of legalCase.attachments) {
            if (att.publicId) {
                await cloudinary.uploader.destroy(att.publicId).catch(() => {});
                await releaseStorage(officeId, att.sizeBytes || 0);
            }
        }
    }

    const sessions = await SessionModel.find({ caseId: caseId });
    for (const session of sessions) {
        if (session.attachments && session.attachments.length > 0) {
            for (const att of session.attachments) {
                if (att.publicId) {
                    await cloudinary.uploader.destroy(att.publicId).catch(() => {});
                    await releaseStorage(officeId, att.sizeBytes || 0);
                }
            }
        }
    }
    await SessionModel.deleteMany({ caseId: caseId });

    const tasks = await TaskModel.find({ caseId: caseId });
    for (const task of tasks) {
        if (task.attachments && task.attachments.length > 0) {
            const atts: any[] = task.attachments; 
            for (const att of atts) {
                if (att.publicId) {
                    await cloudinary.uploader.destroy(att.publicId).catch(() => {});
                    await releaseStorage(officeId, att.sizeBytes || 0);
                }
            }
        }
    }
    await TaskModel.deleteMany({ caseId: caseId });

    const invoices = await InvoiceModel.find({ legalCase: caseId });
    for (const invoice of invoices) {
        await removeExtraPayment(caseId, invoice.client.toString(), invoice._id);
        await InvoiceModel.deleteOne({ _id: invoice._id });
    }

    await LegalCaseModel.deleteOne({ _id: caseId });
};


export const cascadeHardDeleteClient = async (clientId: string, officeId: string, deletedBy: string) => {
    const client = await ClientModel.findOne({ _id: clientId, officeId });
    if (!client) return;

    if (client.documents && client.documents.length > 0) {
        for (const doc of client.documents) {
            if (doc.publicId) {
                await cloudinary.uploader.destroy(doc.publicId).catch(() => {});
                await releaseStorage(officeId, doc.sizeBytes || 0);
            }
        }
    }

    const cases = await LegalCaseModel.find({ client: clientId });
    for (const legalCase of cases) {
        await cascadeHardDeleteCase(legalCase._id.toString(), officeId, deletedBy);
    }

    const standaloneInvoices = await InvoiceModel.find({ client: clientId });
    for (const invoice of standaloneInvoices) {
        await removeExtraPayment(null, clientId, invoice._id);
        await InvoiceModel.deleteOne({ _id: invoice._id });
    }

    await ClientModel.deleteOne({ _id: clientId });
};


export const cascadeSoftDeleteCase = async (caseId: string, officeId: string, deletedBy: string) => {
    const ts = new Date();
    
    await SessionModel.updateMany({ caseId }, { isDeleted: true });

    await TaskModel.updateMany({ caseId }, { isDeleted: true, status: "ملغية" });

    const invoices = await InvoiceModel.find({ legalCase: caseId, isDeleted: false });
    for (const invoice of invoices) {
        await InvoiceModel.findByIdAndUpdate(invoice._id, { isDeleted: true }, { new: true });
        if (invoice.isFromFees) {
        } else {
            await removeExtraPayment(caseId, invoice.client.toString(), invoice._id);
        }
    }
    await syncCaseFees(caseId);
};


export const cascadeSoftDeleteClient = async (clientId: string, officeId: string, deletedBy: string) => {
    const ts = new Date();
    
    const cases = await LegalCaseModel.find({ client: clientId, isDeleted: false });
    for (const legalCase of cases) {
        await LegalCaseModel.findByIdAndUpdate(legalCase._id, {
            isDeleted: true,
            DeletedAt: ts,
            DeletedBy: deletedBy
        });
        await cascadeSoftDeleteCase(legalCase._id.toString(), officeId, deletedBy);
    }

    const standaloneInvoices = await InvoiceModel.find({ client: clientId, legalCase: null, isDeleted: false });
    for (const invoice of standaloneInvoices) {
        await InvoiceModel.findByIdAndUpdate(invoice._id, { isDeleted: true }, { new: true });
        await removeExtraPayment(null, clientId, invoice._id);
    }
};
