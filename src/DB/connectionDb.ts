import mongoose from "mongoose";

export const connectionDB = ()=>{
    mongoose.connect(process.env.BD_URL_ONLINE as unknown as string)
    .then(()=>{
        console.log(`success to connect db ${process.env.BD_URL}...`);
    }).catch((error)=>{
        console.log("fail connect db...",error);
    })
}

export default connectionDB