import mongoose, { Types } from "mongoose";

export interface IClient extends mongoose.Document{
    _id : Types.ObjectId,
    fullName : string,
    phone : string,
    email : string,
}

const ClientSchema = new mongoose.Schema<IClient>({
    fullName : {type : String , required : true , minLength : 2 , maxLength : 50 ,trim : true},
    phone : {type : String , required : true},
    email : {type : String , unique : true , trim : true}
},{timestamps : true,
    toObject : {virtuals : true},
    toJSON : {virtuals : true}})


const ClientModel = mongoose.models.Client || mongoose.model<IClient>("Client" , ClientSchema )

export default ClientModel