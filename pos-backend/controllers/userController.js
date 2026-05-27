const createHttpError = require("http-errors");
const User = require("../models/userModel");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const config = require("../config/config");

const register = async (req, res, next) => {
    try {
        const { name, phone, email, password, role } = req.body;

        if (!name || !phone || !email || !password || !role) {
            const error = createHttpError(400, "All fields are required!");
            return next(error);
        }

        const isUserPresent = await User.findOne({ email });
        if (isUserPresent) {
            const error = createHttpError(400, "User already exist!");
            return next(error);
        }

        const user = { name, phone, email, password, role };
        const newUser = User(user);
        await newUser.save();

        res.status(201).json({ success: true, message: "New user created!", data: newUser });
    } catch (error) {
        next(error);
    }
};

const login = async (req, res, next) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            const error = createHttpError(400, "All fields are required!");
            return next(error);
        }

        const isUserPresent = await User.findOne({ email });
        if (!isUserPresent) {
            const error = createHttpError(401, "Invalid Credentials");
            return next(error);
        }

        const isMatch = await bcrypt.compare(password, isUserPresent.password);
        if (!isMatch) {
            const error = createHttpError(401, "Invalid Credentials");
            return next(error);
        }

        const accessToken = jwt.sign({ _id: isUserPresent._id }, config.accessTokenSecret, {
            expiresIn: "1d",
        });

        // FIXED COOKIE SETTINGS – allow HTTP in development
        res.cookie("accessToken", accessToken, {
            maxAge: 1000 * 60 * 60 * 24 * 30,
            httpOnly: true,
            sameSite: "lax",
            secure: false,
            path: "/",                  // 👈 Make cookie available to all routes
        });

        res.status(200).json({
            success: true,
            message: "User login successfully!",
            data: isUserPresent,
            token: accessToken,               // 👈 Send token to frontend
        });
    } catch (error) {
        next(error);
    }
};

const getUserData = async (req, res, next) => {
    try {
        const user = await User.findById(req.user._id);
        res.status(200).json({ success: true, data: user });
    } catch (error) {
        next(error);
    }
};

const logout = async (req, res, next) => {
    try {
        res.clearCookie("accessToken");
        res.status(200).json({ success: true, message: "User logout successfully!" });
    } catch (error) {
        next(error);
    }
};

// Kitchen authentication (generates token without cookie)
const kitchenAuth = async (req, res, next) => {
    try {
        const { secret } = req.body;
        if (!secret || secret !== process.env.KITCHEN_SECRET) {
            return res.status(401).json({ message: "Senha incorreta" });
        }

        const token = jwt.sign(
            { userId: "kitchen", role: "kitchen" },
            config.accessTokenSecret,
            { expiresIn: "30d" }
        );

        res.status(200).json({ token });
    } catch (error) {
        next(error);
    }
};

module.exports = { register, login, getUserData, logout, kitchenAuth };