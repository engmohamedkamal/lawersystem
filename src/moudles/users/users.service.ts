import { NextFunction, Request, Response } from "express";
import UserModel from "../../DB/model/user.model";
import { HASH } from "../../utils/hash";
import { AppError } from "../../utils/classError";
import { addUsersByAdminSchemaType, deleteUserParamsType, freezeUserParamsType, getUserByIdParamsType, getUsersSchemaType, unfreezeUserParamsType, updateUserBodyType, updateUserParamsType } from "./users.validation";
import { uploadBuffer } from "../../utils/cloudinaryHelpers";
import cloudinary from "../../utils/cloudInary";
import LegalCaseModel from "../../DB/model/LegalCase.model";
import SessionModel from "../../DB/model/session.model";
import OfficeModel from "../../DB/model/SaaSModels/Office.model";
import { assertFeatureLimitNotReached } from "../../helpers/planFeature.helper";
import { PLAN_FEATURES } from "../SASS/constants/planFeatures";


class usersService {
    constructor(){}

    addUsersByAdmin = async (req: Request, res: Response, next: NextFunction) => {
         const { email, password, phone, UserName , jobTitle , lawyerRegistrationNo , role ,department , salary ,leavingDate }: addUsersByAdminSchemaType = req.body;

         const officeId = req.user?.officeId;

         //// TEMP: during development, allow creating users without office
        
          const office = await OfficeModel.findById(officeId);
         if (!office) {
            throw new AppError("office not found", 404);
         }

         const usersCount = await UserModel.countDocuments({ officeId: officeId });

         assertFeatureLimitNotReached(office,
           PLAN_FEATURES.USERS_MAX,
            usersCount);
         

         if (await UserModel.findOne({ email })) {
           throw new AppError("email already exist", 409);
         }

         const hash = await HASH(password);

         let profilePhoto: { url: string; publicId: string } | undefined;

         if (req.file) {
           const result = await uploadBuffer(req.file.buffer, "lawyerSystem/profile");
           profilePhoto = { url: result.secure_url, publicId: result.public_id };
         }

         const user = new UserModel({
           email,
           password: hash,
           phone,
           UserName,
           jobTitle,
           lawyerRegistrationNo,
           role,
           department,
           salary,
           leavingDate,
           officeId: officeId,
           ...(profilePhoto ? { ProfilePhoto: profilePhoto } : {}),
         });

            await user.save();

            return res.status(201).json({ message: "done, user add success", user });
        };

    getUsers = async (req: Request, res: Response, next: NextFunction) => {
           const { role } = req.query as unknown as getUsersSchemaType ;

           const filter: any = {};

           if (role) {filter.role = role;}

          if (req.user?.officeId) {
            filter.officeId = req.user.officeId;
          }

          const users = await UserModel.find(filter).select("_id UserName email phone role jobTitle department salary employmentDate leavingDate ProfilePhoto lawyerRegistrationNo createdAt updatedAt isDeleted ");

           return res.status(200).json({ message: "done", users });
        };

    getUsersById = async (req: Request, res: Response, next: NextFunction) =>{
        const {userId} = req.params as unknown as getUserByIdParamsType

        const user = await UserModel.findOne({ _id: userId, officeId: req.user?.officeId }).select("_id UserName email phone role jobTitle department salary employmentDate leavingDate ProfilePhoto lawyerRegistrationNo createdAt updatedAt isDeleted ")

        if (!user) {
            throw new AppError("user not found" , 404)
        }

        const startOfDay = new Date();
        startOfDay.setHours(0, 0, 0, 0);
        const endOfWeek = new Date(startOfDay);
        endOfWeek.setDate(startOfDay.getDate() + 7);
        endOfWeek.setHours(23, 59, 59, 999);

        const caseFilter = {
            $or: [{ assignedTo: userId }, { team: userId }],
            isDeleted: false
        };

        const [totalCases, activeCases, completedCases, thisWeekSessions] = await Promise.all([
            LegalCaseModel.countDocuments(caseFilter),
            LegalCaseModel.countDocuments({ ...caseFilter, status: { $in: ["قيد التحضير", "قيد التنفيذ"] } }),
            LegalCaseModel.countDocuments({ ...caseFilter, status: "منتهية" }),
            SessionModel.countDocuments({
                $or: [{ assignedTo: userId }, { team: userId }],
                isDeleted: false,
                startAt: { $gte: startOfDay, $lte: endOfWeek }
            })
        ]);

        return res.status(200).json({ 
            message: "done", 
            user,
            stats: {
                thisWeekSessions,
                activeCases,
                completedCases,
                totalCases
            },
            officeId : req.user?.officeId
        });
        };

    getMyProfile = async (req: Request, res: Response, next: NextFunction) => {
        const userId = req.user?._id;

        const user = await UserModel.findOne({ _id: userId, officeId: req.user?.officeId })
            .select("_id UserName email phone role jobTitle department salary employmentDate leavingDate ProfilePhoto lawyerRegistrationNo isActiveEmployee createdAt updatedAt isDeleted");

        if (!user) throw new AppError("user not found", 404);

        const startOfDay = new Date();
        startOfDay.setHours(0, 0, 0, 0);
        const endOfWeek = new Date(startOfDay);
        endOfWeek.setDate(startOfDay.getDate() + 7);
        endOfWeek.setHours(23, 59, 59, 999);

        const caseFilter = {
            $or: [{ assignedTo: userId }, { team: userId }],
            isDeleted: false
        };

        const [totalCases, activeCases, completedCases, thisWeekSessions] = await Promise.all([
            LegalCaseModel.countDocuments(caseFilter),
            LegalCaseModel.countDocuments({ ...caseFilter, status: { $in: ["قيد التحضير", "قيد التنفيذ"] } }),
            LegalCaseModel.countDocuments({ ...caseFilter, status: "منتهية" }),
            SessionModel.countDocuments({
                $or: [{ assignedTo: userId }, { team: userId }],
                isDeleted: false,
                startAt: { $gte: startOfDay, $lte: endOfWeek }
            })
        ]);

        return res.status(200).json({ 
            message: "done", 
            user,
            stats: {
                thisWeekSessions,
                activeCases,
                completedCases,
                totalCases
            },
            officeId : req.user?.officeId
        });
    };

    updateUsersByAdmin = async (req: Request, res: Response, next: NextFunction) =>{
        const {userId} = req.params as unknown as updateUserParamsType
        const body : updateUserBodyType = req.body

        if (body.email) {
            const exist = await UserModel.findOne({email : body.email , _id : {$ne : userId}})
            if(exist) throw new AppError("email already exist" , 409)
        }

        if (body.password) {
            body.password = await HASH(body.password)
        }

        if (body.leavingDate) {
          body.isActiveEmployee = false
        }

        if (body.leavingDate === null) {
          ;(body as any).$unset = { leavingDate: 1 }
          delete body.leavingDate
          body.isActiveEmployee = true
        }

        const user = await UserModel.findOneAndUpdate(
            { _id: userId, officeId: req.user?.officeId },
            {$set : body},
            { new: true, runValidators: true }
        ).select("UserName email phone jobTitle department role lawyerRegistrationNo salary employmentDate leavingDate isActiveEmployee");

        if (!user) {
            throw new AppError("user not found", 404)
        }

        return res.status(200).json({ message: "done", user });
        };

    deleteUsersByAdmin = async (req: Request, res: Response, next: NextFunction) => {
        const { userId } = req.params as unknown as deleteUserParamsType;

        const user = await UserModel.findOneAndDelete({ _id: userId, officeId: req.user?.officeId }).select("_id UserName email role");

        if (!user) throw new AppError("user not found", 404);

        return res.status(200).json({ message: "done, user deleted", user });
        };

    hardDeleteUser = async (req: Request, res: Response, next: NextFunction) => {
        const { userId } = req.params as unknown as deleteUserParamsType;

        const user = await UserModel.findOneAndDelete({ _id: userId, officeId: req.user?.officeId }).select("_id UserName email role");

        if (!user) throw new AppError("user not found", 404);

        return res.status(200).json({ message: "done, user permanently deleted (Hard Delete)", user });
        };

    freezeUser = async (req: Request, res: Response, next: NextFunction) => {
       const { userId } = req.params as unknown as freezeUserParamsType;

       const result = await UserModel.updateOne(
        { _id: userId, officeId: req.user?.officeId, isDeleted: false },
        {
          $set: {
            isDeleted: true,
            deletedBy: req.user?._id,
            deletedAt: new Date(),
          },
          $inc: { __v: 1 },
      }  
      );

       if (!result.matchedCount) throw new AppError("user not found or already frozen", 404);

       return res.status(200).json({ message: "success" });
        };

    unfreezeUser = async (req: Request, res: Response, next: NextFunction) => {
       const { userId } = req.params as unknown as unfreezeUserParamsType;

       const result = await UserModel.updateOne(
         { _id: userId, officeId: req.user?.officeId, isDeleted: true },
         {
           $set: { isDeleted: false },
           $unset: { deletedBy: 1, deletedAt: 1 },
           $inc: { __v: 1 },
         }
       );

       if (!result.matchedCount) throw new AppError("user not found or not frozen", 404);

       return res.status(200).json({ message: "success" });
        };

    updateProfilePhoto = async (req: Request, res: Response, next: NextFunction) => {
      if (!req.file) throw new AppError("No file uploaded", 400);

      const user = await UserModel.findById(req.user?._id);
      if (!user) throw new AppError("User not found", 404);

      const oldPublicId = (user as any)?.ProfilePhoto?.publicId;

      const { secure_url, public_id } = await uploadBuffer(req.file.buffer, "lawyerSystem/profile");

      const updatedUser = await UserModel.findByIdAndUpdate(
        req.user?._id,
        { $set: { ProfilePhoto: { url: secure_url, publicId: public_id } } },
        { new: true }
      );

      if (oldPublicId) {
        await cloudinary.uploader.destroy(oldPublicId);
      }

      return res.status(200).json({
        message: "Profile photo updated",
        user: updatedUser,
      });
        };



}



export default new usersService()

