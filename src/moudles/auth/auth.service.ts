import { NextFunction, Request, Response } from "express";
import UserModel from "../../DB/model/user.model";
import { AppError } from "../../utils/classError";
import { HASH } from "../../utils/hash";
import { compare } from "bcrypt";
import { v4 as uuidv4 } from "uuid"; 
import { generateToken, verifyToken } from "../../utils/token";
import RevokeToken from "../../DB/model/revokeToken.model ";




class authService {

    constructor () {}

    
    register = async (req:Request,res:Response,next:NextFunction)=>{
        const { email, password, phone, UserName } = req.body;

        if (await UserModel.findOne({email})){
            throw new AppError("email already exist" , 409)
        }

        const hash = await HASH(password)
        const user = new UserModel({email , password : hash , phone , UserName })
        await user.save()
        return res.status(201).json({message : "done, user add success", user})
    }


    signin = async (req:Request,res:Response,next:NextFunction)=>{
        const {email , password} = req.body

        const user = await UserModel.findOne({email})

        if(!user){
            throw new AppError("email not found" , 409)
        }

        const isMatch = await compare(password, user.password);
        if (!isMatch) {
            throw new AppError("invalid password", 401);
        }

        if (user.isDeleted) {
            throw new AppError("account is frozen", 403);
        }

        const jwtid = uuidv4();
        //access token
        const access_token = await generateToken({payload : {id:user._id ,role :user.role ,userName : user.UserName},
            signature : process.env.ACCESS_TOKEN!,
            options : {expiresIn : "1h" , jwtid }
        })

        //refresh token
        const refresh_token = await generateToken({payload : {id:user._id , email},
            signature : process.env.REFRESH_TOKEN!,
            options : {expiresIn : "1y", jwtid }
        })

        res.cookie("refresh_token", refresh_token, {
           httpOnly: true, 
           secure: process.env.NODE_ENV === "production", 
           sameSite: "lax", 
           maxAge: 1000 * 60 * 60 * 24 * 365, 
        });

    return res.status(200).json({ message: "success", access_token })

    }

    refreshToken = async (req: Request, res: Response, next: NextFunction) => {
    
        const refresh_token = req.cookies?.refresh_token;
        if (!refresh_token) throw new AppError("refresh token required", 401);

        const decoded = await verifyToken({
           token: refresh_token,
            signature: process.env.REFRESH_TOKEN!,
        });

        if (!decoded?.id) throw new AppError("invalid refresh token", 401);

        if (decoded?.jti && (await RevokeToken.findOne({ tokenId: decoded.jti }))) {
            throw new AppError("token has been revoked", 401);
        }

        const user = await UserModel.findById(decoded.id);
        if (!user) throw new AppError("user not exist", 401);

        if (user?.changCredentials?.getTime && decoded?.iat) {
            if (user.changCredentials.getTime() > decoded.iat * 1000) {
              throw new AppError("token has been revoked", 401);
            }
        }

        const accessJti = uuidv4();
        const access_token = await generateToken({
            payload: { id: user._id, role: user.role },
            signature: process.env.ACCESS_TOKEN!,
            options: { expiresIn: "1h", jwtid: accessJti },
        });

        const refreshJti = uuidv4();
        const new_refresh_token = await generateToken({
            payload: { id: user._id, email: user.email },
            signature: process.env.REFRESH_TOKEN!,
            options: { expiresIn: "1y", jwtid: refreshJti },
        });

        if (decoded?.jti) {
            await RevokeToken.create({
              userId: user._id,
              tokenId: decoded.jti,
              expireAt: new Date((decoded.exp as number) * 1000),
            });
          }

        res.cookie("refresh_token", new_refresh_token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "lax",
            maxAge: 1000 * 60 * 60 * 24 * 365,
        });

          return res.status(200).json({ message: "success", access_token });
 
};


    logout = async (req: Request, res: Response, next: NextFunction) => {
        const revokeToken = await RevokeToken.create({
            userId : req.user?._id ,
            tokenId : req.decoded?.jti!,
            expireAt : req.decoded?.exp!
        })

        res.clearCookie("refresh_token", {
           httpOnly: true,
           sameSite: "lax",
           secure: process.env.NODE_ENV === "production",
        });
        
        return res.status(200).json({ message: "done" , revokeToken})
    };

}   


export default new authService()