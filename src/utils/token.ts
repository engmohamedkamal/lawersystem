import jwt, { JwtPayload } from "jsonwebtoken"
import UserModel from "../DB/model/user.model"
import { AppError } from "./classError"
import RevokeToken from "../DB/model/revokeToken.model "


export enum TokenType{
    access = "access",
    refresh = "refresh"
}

export const generateToken = async({payload , signature , options}: {
    payload : Object,
    signature : string, 
    options? : jwt.SignOptions
}) : Promise<string> =>{
    return jwt.sign(payload , signature , options)
}

export const verifyToken = async({token , signature }:{
    token : string,
    signature : string, 
}):Promise <JwtPayload>=>{
    return jwt.verify(token , signature) as JwtPayload
}


export const getSignature = async(tokenType: TokenType) => {
  switch (tokenType) {
    case TokenType.access:
      return process.env.ACCESS_TOKEN!;
    case TokenType.refresh:
      return process.env.REFRESH_TOKEN!;
    default:
      throw new AppError("Invalid token" , 400);
  }
};

export const decodedTokenAndFetchUser = async (token : string , signature : string)=>{
        const decoded = await verifyToken({token , signature })

        if (!decoded) {
            throw new AppError("Invalid token type" , 400);
        }

        const user = await UserModel.findOne({ _id : decoded.id } )

        if (!user) {
            throw new AppError("user not exist" , 400);
        }

        if(await RevokeToken.findOne({tokenId : decoded?.jti! })){
            throw new AppError("token has been revoke" , 401);
        }

        if(user?.changCredentials?.getTime()! > decoded?.iat! * 1000){
            throw new AppError("token has been revoke" , 401);
        }

        return { decoded , user }
}