import mongoose from "mongoose";
import mongooseAggregatePaginate from "mongoose-aggregate-paginate-v2";

const commentSchema=new mongoose.Schema({
    owner:{
        type:mongoose.Schema.Types.ObjectId,
        ref:"User",
        require:true,
    },
    video:{
        type:mongoose.Schema.Types.ObjectId,
        ref:"Video",
        require:true,
    },
    content:{
        type:String,
        require:true,
        trim:true
    }
},{timestamps:true});

commentSchema.plugin(mongooseAggregatePaginate)

export const Comment=mongoose.model("Comment",commentSchema);