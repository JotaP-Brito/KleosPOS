const Addition = require("../models/Addition");
const createHttpError = require("http-errors");

const getAdditions = async (req, res, next) => {
  try {
    const additions = await Addition.find({}).lean();
    res.status(200).json({ success: true, data: additions });
  } catch (error) {
    next(error);
  }
};

const createAddition = async (req, res, next) => {
  try {
    const addition = await Addition.create(req.body);
    res.status(201).json({ success: true, data: addition });
  } catch (error) {
    next(error);
  }
};

const updateAddition = async (req, res, next) => {
  try {
    const { id } = req.params;
    const addition = await Addition.findByIdAndUpdate(id, req.body, {
      new: true,
      runValidators: true,
    });
    if (!addition) {
      return next(createHttpError(404, "Adicional não encontrado"));
    }
    res.status(200).json({ success: true, data: addition });
  } catch (error) {
    next(error);
  }
};

const deleteAddition = async (req, res, next) => {
  try {
    const { id } = req.params;
    const addition = await Addition.findByIdAndDelete(id);
    if (!addition) {
      return next(createHttpError(404, "Adicional não encontrado"));
    }
    res.status(200).json({ success: true, message: "Adicional removido" });
  } catch (error) {
    next(error);
  }
};

module.exports = { getAdditions, createAddition, updateAddition, deleteAddition };
