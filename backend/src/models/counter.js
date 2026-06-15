const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const schema = new Schema(
    {
        _id: { type: String, required: true },
        seq: { type: Number, default: 0 }
    }
);

schema.index({ _id: 1, seq: 1 }, { unique: true });

const counterModel = mongoose.model('counter', schema);

exports.counterModel = counterModel;

const getAutoIncrementId = async (modelName) => {
    const newSequence = await counterModel.findByIdAndUpdate(
        modelName,
        { $inc: { seq: 1 } },
        { new: true, upsert: true }
    );

    return newSequence.seq;
}

exports.getAutoIncrementId = getAutoIncrementId;;