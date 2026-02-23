import { NextFunction, Request, Response } from "express";
import UserModel from "../../DB/model/user.model";
import { HASH } from "../../utils/hash";
import { AppError } from "../../utils/classError";
import { addUsersByAdminSchemaType, getUserByIdParamsType, getUsersSchemaType } from "./users.validation";


class usersService {
    constructor(){}

    addUsersByAdmin = async (req:Request,res:Response,next:NextFunction)=>{
            const { email, password, phone, UserName  } : addUsersByAdminSchemaType = req.body;
    
            if (await UserModel.findOne({email})){
                throw new AppError("email already exist" , 409)
            }
    
            const hash = await HASH(password)
            const user = new UserModel({email , password : hash , phone , UserName  })
            await user.save()
            return res.status(201).json({message : "done, user add success", user})
        }

    getUsers = async (req: Request, res: Response, next: NextFunction) => {
           const { role } = req.query as unknown as getUsersSchemaType ;

           const filter: any = {};

           if (role) {
             filter.role = role;
           }

           const users = await UserModel.find(filter).select("_id UserName role");

           return res.status(200).json({ message: "done", users });
        };

    getUsersById = async (req: Request, res: Response, next: NextFunction) =>{
        const {userId} = req.params as unknown as getUserByIdParamsType

        const user = await UserModel.findById(userId).select("_id UserName email phone role createdAt updatedAt")

        if (!user) {
            throw new AppError("user not found" , 404)
        }
    }
}



export default new usersService()

