import mongoose, { Types } from "mongoose";
export enum Role{
    ADMIN = "ADMIN",
    LAWYER = "LAWYER",
    STAFF = "STAFF",
    SUPER_ADMIN = "SUPER_ADMIN"
}
export interface IUser extends mongoose.Document{
    _id:Types.ObjectId,
    officeId: Types.ObjectId,
    UserName:string,
    email:string,
    password:string,
    jobTitle : string,
    ProfilePhoto?: {
        url: string,
        PublicId: string
    },
    lawyerRegistrationNo?: string,
    role:Role,
    phone:number,
    department : string,
    salary : number,
    employmentDate: Date
    leavingDate?: Date
    isActiveEmployee: boolean
    shift?: Types.ObjectId
    isDeleted:Boolean,
    deletedBy:Types.ObjectId,
    deletedAt:Date,
    createdAt : Date,
    updatedAt : Date
}
const UserSchema = new mongoose.Schema<IUser>({
    officeId: { type: Types.ObjectId, ref: "Office", required: false },
    UserName : {type : String , required : true , minLength : 2 , maxLength : 50 ,trim : true},
    email : {type : String , required : true , unique : true , trim : true},
    password : {type : String , required : true},
    jobTitle: { type: String },
    lawyerRegistrationNo: { type: String ,  minLength : 7 , maxLength : 7  },
    ProfilePhoto: {
        url:{ type : String},
        PublicId: { type : String}
    },
    role : {type : String , default : Role.STAFF},
    phone : {type : Number , required : true},
    department : { type : String},
    salary : { type : Number , default : 0},
    employmentDate: {type: Date, default: Date.now , required: true , immutable: true},
    leavingDate: {type: Date,},
    isActiveEmployee: {type: Boolean,default: true,},
    shift:  { type: Types.ObjectId, ref: "Shift" },
    isDeleted: { type: Boolean, default: false },
    deletedBy: { type: mongoose.Types.ObjectId, ref: "User" },
    deletedAt: { type: Date },
},{timestamps : true,
    toObject : {virtuals : true},
    toJSON : {virtuals : true}})

    UserSchema.pre("save", function () {
   if (this.leavingDate) {
    this.isActiveEmployee = false
   }
  })


    const UserModel = mongoose.models.User || mongoose.model<IUser>( "User" ,UserSchema ) 
    export default UserModel