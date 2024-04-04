import {User} from "../models/user.model.js";
import asyncHandler from "../utils/asyncHandler.js";
import apiError, { ApiError } from "../utils/ApiError.js";
import ApiResponse, { ApiResonse } from "../utils/ApiResponse.js"
import {uploadToCloudinary} from "../utils/cloudinary.js";
import jwt from "jsonwebtoken";


const options={
    httpOnly:true,
    secure:true,
}



const generateAccessAndRefreshToken=async (userId)=>{
    try{
        const user =await User.findById(userId);

        const refreshToken=user.generateRefreshToken();
        const accessToken=user.generateAccessToken();

        user.refreshToken=refreshToken;
        await user.save({validateBeforeSave:false});

        return {accessToken,refreshToken};       

    }
    catch(error){
        throw new apiError(500,"Error while generating access and refresh token");
    }
}


const registerUser=asyncHandler(async (req,res)=>{
    //importing file from req body
    const {password,fullName,email,username}=req.body;
    //importing image file 
    const avatarLocalPath=req.files?.avatar[0].path;
    let coverImageLocalPath;
    if(req.files && Array.isArray(req.files.coverImage) && req.files.coverImage.length>0){
        coverImageLocalPath=req.files?.coverImage[0].path;
    }

    //validation checks
    if([password,fullName,email,username,avatarLocalPath].some((field)=>field.trim()==="")){
        throw new apiError(400,"All fields are required");
    }

    //checking if user already registers
    const existedUser=await User.findOne({$or:[{email},{username}]});

    if(existedUser){
        throw new apiError(409,"User already registered,please Log In");
    }

    //uploading image to cloudinary
    const avatar=await uploadToCloudinary(avatarLocalPath);
    const coverImage=await uploadToCloudinary(coverImageLocalPath);

    if(!avatar){
        throw new apiError(400,"Error occured while uploading Avatar to cloudinary");
    }

    //now registering user
    const userCreated=await User.create({
        username:username.toLowerCase(),
        password,
        email,
        fullName,
        avatar:avatar.secure_url,
        coverImage:coverImage?.secure_url||""
    });

    const createdUser=await User.findById(userCreated._id).select("-password -refreshToken");

    if(!createdUser){
        throw new apiError(500,"Something went wrong while creating user");
    }

    return res.status(201).json(
        new ApiResponse(200,createdUser,"User registered successfully")
    )    

});


const loginUser=asyncHandler(async (req,res)=>{
    //fetching data
    const {userName,email,password}=req.body;

    //validating Data
    if(!(userName || email) || !password){
        throw new apiError(400,"Some fields are missing ");
    }

    //finding user in DB
    const existedUser=await User.findOne({$or:[{email},{userName}]});

    if(!existedUser){
        throw new ApiError(404,"User not found, Please create an account first");
    }

    //If user exists then comparing password with db password
    const isPasswordCorrect= existedUser.isPasswordCorrect(password);

    if(!isPasswordCorrect){
        throw new apiError(400,"Please Enter correct password");
    }
    
    //generating access and refresh token
    const {accessToken, refreshToken}=await generateAccessAndRefreshToken(existedUser._id);

    //removing existedUser password and refresh token
    existedUser.password=undefined;
    existedUser.accessToken=undefined;

    //now sending successful response and setting cookies
    return res.status(200)
    .cookie("accessToken",accessToken,options)
    .cookie("refreshToken",refreshToken,options)
    .json(
        new ApiResponse(
            201,
            {
                loggedInUser:existedUser,accessToken,refreshToken
            },
            "User logged in successfully"
        )
    );
});


const logoutUser=asyncHandler(async (req,res)=>{
    //removing refreshToken from User in db
    await User.findByIdAndUpdate(
        req.user._id,
        {
            $unset:{
                refreshToken:1
            }
        },
        {
            new:true
        }
    );

    //returning response 
    return res.status(200)
           .clearCookie("refreshToken",options)
           .clearCookie("accessToken",options)
           .json(
            new ApiResponse(201 ,{},"User Logged Out Successfully")
           )
});

const refreshAccessToken=asyncHandler(async (req,res)=>{
    const incomingRefreshToken=req.cookies.refreshToken || req.body.refreshToken;

    if(!incomingRefreshToken){
        throw new apiError(401,"Unauthorized request");
    }

    //if refresh token exist then decode it
    try{
        const decodedToken=jwt.verify(incomingRefreshToken,process.env.REFRESH_TOKEN_SECRET);

        if(!decodedToken){
            throw new apiError(400,"Invalid Refresh Token");
        }

        //generating new access and refresh token
        const user=await User.findById(decodedToken._id);
    
        if(!user){
            throw new apiError(400,"User not founf for given token");
        }
    
        const {accessToken,refreshToken}=await generateAccessAndRefreshToken(user._id);

        return res.status(200)
               .cookie("accessToken",accessToken,options)
               .cookie("refreshToken",refreshToken,options)
               .json(
                new ApiResonse(200,{refreshToken,accessToken},"Access Token Refreshed Successfully")
               );

    }catch(error){
        throw new ApiError(401, error?.message || "Invalid refresh token")   
    }
})




export {
    loginUser,
    registerUser,
    logoutUser,
    refreshAccessToken
    
}