const createHttpError = require("http-errors");
const jwt = require("jsonwebtoken");
const config = require("../config/config");
const User = require("../models/userModel");

const isVerifiedUser = async (req, res, next) => {
    try {
        // 1. Tenta obter o token do cookie
        let token = req.cookies.accessToken;

        // 2. Se não existir, tenta extrair do cabeçalho Authorization
        if (!token && req.headers.authorization?.startsWith("Bearer ")) {
            token = req.headers.authorization.split(" ")[1];
        }

        if (!token) {
            return next(createHttpError(401, "Please provide token!"));
        }

        const decoded = jwt.verify(token, config.accessTokenSecret);

        // 3. Caso especial – token da cozinha (gerado com userId = "kitchen")
        if (decoded.userId === "kitchen") {
            req.user = { _id: "kitchen", role: "kitchen" };
            return next();
        }

        // 4. Caso normal – utilizador registado
        const user = await User.findById(decoded._id);
        if (!user) {
            return next(createHttpError(401, "User not exist!"));
        }

        req.user = user;
        next();
    } catch (error) {
        return next(createHttpError(401, "Invalid Token!"));
    }
};

module.exports = { isVerifiedUser };