import mongoose, { Types } from "mongoose";
export enum Role{
    ADMIN = "ADMIN",
    LAWYER = "LAWYER",
    STAFF = "STAFF"
}
export interface IUser extends mongoose.Document{
    _id:Types.ObjectId,
    UserName:string,
    email:string,
    password:string,
    jobTitle : string,
    ProfilePhoto?: {
        url: string,
        PublicId: string
    },
    lawyerRegistrationNo: string,
    permissions : [string]
    role:Role,
    phone:number,
    isDeleted:Boolean,
    deletedBy:Types.ObjectId,
    deletedAt:Date,
    createdAt : Date,
    updatedAt : Date
}
const UserSchema = new mongoose.Schema<IUser>({
    UserName : {type : String , required : true , minLength : 2 , maxLength : 50 ,trim : true},
    email : {type : String , required : true , unique : true , trim : true},
    password : {type : String , required : true},
    jobTitle: { type: String },
    lawyerRegistrationNo: { type: String ,  minLength : 7 , maxLength : 7  },
    ProfilePhoto: {
        url:{ type : String},
        PublicId: { type : String}
    },
    permissions: [{ type: String }],
    role : {type : String , default : Role.STAFF},
    phone : {type : Number , required : true},
    isDeleted: { type: Boolean, default: false },
    deletedBy: { type: mongoose.Types.ObjectId, ref: "User" },
    deletedAt: { type: Date },
},{timestamps : true,
    toObject : {virtuals : true},
    toJSON : {virtuals : true}})


    const UserModel = mongoose.models.User || mongoose.model<IUser>( "User" ,UserSchema ) 
    export default UserModel