import { NextFunction, Request, Response } from "express";
import UserModel from "../../DB/model/user.model";
import { HASH } from "../../utils/hash";
import { AppError } from "../../utils/classError";
import { addUsersByAdminSchemaType, deleteUserParamsType, freezeUserParamsType, getUserByIdParamsType, getUsersSchemaType, unfreezeUserParamsType, updateUserBodyType, updateUserParamsType } from "./users.validation";
import { uploadBuffer } from "../../utils/cloudinaryHelpers";
import cloudinary from "../../utils/cloudInary";


class usersService {
    constructor(){}

    addUsersByAdmin = async (req: Request, res: Response, next: NextFunction) => {
         const { email, password, phone, UserName , jobTitle , lawyerRegistrationNo , role ,department}: addUsersByAdminSchemaType = req.body;

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
           ...(profilePhoto ? { ProfilePhoto: profilePhoto } : {}),
         });

            await user.save();

            return res.status(201).json({ message: "done, user add success", user });
        };

    getUsers = async (req: Request, res: Response, next: NextFunction) => {
           const { role } = req.query as unknown as getUsersSchemaType ;

           const filter: any = {};

           if (role) {
             filter.role = role;
           }

           const users = await UserModel.find(filter).select("_id UserName email phone role jobTitle department ProfilePhoto createdAt updatedAt isDeleted ");

           return res.status(200).json({ message: "done", users });
        };

    getUsersById = async (req: Request, res: Response, next: NextFunction) =>{
        const {userId} = req.params as unknown as getUserByIdParamsType

        const user = await UserModel.findById(userId).select("_id UserName email phone role jobTitle department ProfilePhoto createdAt updatedAt isDeleted ")

        if (!user) {
            throw new AppError("user not found" , 404)
        }

        return res.status(200).json({ message: "done", user });
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

        const user = await UserModel.findByIdAndUpdate(
            userId,
            {$set : body},
            { returnDocument: "after", runValidators: true }
        ).select("UserName, email, phone, jobTitle, department, role, lawyerRegistrationNo, permissions, password");

        if (!user) {
            throw new AppError("user not found", 404)
        }

        return res.status(200).json({ message: "done", user });
        };

    deleteUsersByAdmin = async (req: Request, res: Response, next: NextFunction) => {
        const { userId } = req.params as unknown as deleteUserParamsType;

        const user = await UserModel.findByIdAndDelete(userId).select("_id UserName email role");

        if (!user) throw new AppError("user not found", 404);

        return res.status(200).json({ message: "done, user deleted", user });
        };

    freezeUser = async (req: Request, res: Response, next: NextFunction) => {
       const { userId } = req.params as unknown as freezeUserParamsType;

       const result = await UserModel.updateOne(
        { _id: userId, isDeleted: false },
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
         { _id: userId, isDeleted: true },
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

      (user as any).ProfilePhoto = { url: secure_url, publicId: public_id };
      await user.save();

      if (oldPublicId) {
        await cloudinary.uploader.destroy(oldPublicId);
      }

      return res.status(200).json({
        message: "Profile photo updated",
        user,
      });
        };



}



export default new usersService()

