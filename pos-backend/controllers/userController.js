const createHttpError = require("http-errors");
const User = require("../models/userModel");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const config = require("../config/config");

const isValidPin = (pin) => /^\d{4,6}$/.test(pin);

const issueAccessToken = (user) => jwt.sign(
    { _id: user._id },
    config.accessTokenSecret,
    { expiresIn: "1d" }
);

const sendLoginResponse = (res, user, message) => {
    const accessToken = issueAccessToken(user);
    const userData = user.toObject();
    delete userData.pin;

    res.cookie("accessToken", accessToken, {
        maxAge: 1000 * 60 * 60 * 24 * 30,
        httpOnly: true,
        sameSite: "lax",
        secure: false,
        path: "/",
    });

    res.status(200).json({ success: true, message, data: userData, token: accessToken });
};

const getPinStatus = async (req, res, next) => {
    try {
        const user = await User.findOne().select("+pin");
        res.status(200).json({ success: true, configured: Boolean(user?.pin) });
    } catch (error) {
        next(error);
    }
};

const setupPin = async (req, res, next) => {
    try {
        const { pin } = req.body;

        if (!isValidPin(pin)) {
            const error = createHttpError(400, "Your PIN must contain 4 to 6 digits.");
            return next(error);
        }

        let user = await User.findOne().select("+pin");
        if (user?.pin) {
            const error = createHttpError(409, "A PIN has already been configured.");
            return next(error);
        }

        const hashedPin = await bcrypt.hash(pin, 10);
        if (user) {
            user.pin = hashedPin;
            await user.save();
        } else {
            user = await User.create({ name: "Administrator", role: "Admin", pin: hashedPin });
        }

        sendLoginResponse(res, user, "PIN created successfully!");
    } catch (error) {
        next(error);
    }
};

const login = async (req, res, next) => {
    try {
        const { pin } = req.body;

        if (!isValidPin(pin)) {
            const error = createHttpError(400, "Enter a 4 to 6 digit PIN.");
            return next(error);
        }

        const user = await User.findOne().select("+pin");
        if (!user?.pin) {
            const error = createHttpError(403, "Set up your PIN before signing in.");
            return next(error);
        }

        const isMatch = await bcrypt.compare(pin, user.pin);
        if (!isMatch) {
            const error = createHttpError(401, "Incorrect PIN. Please try again.");
            return next(error);
        }

        sendLoginResponse(res, user, "Signed in successfully!");
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

module.exports = { getPinStatus, setupPin, login, getUserData, logout, kitchenAuth };
