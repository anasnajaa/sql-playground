const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const schema = new Schema(
    {
        shortCode: { type: String },
        code: { type: String },
        title: { type: String },
        startDate: { type: Date },
        endDate: { type: Date },

        active: { type: Boolean },
        deleted: { type: Boolean },

        startYearWeek: { type: Number },
        endYearWeek: { type: Number },

        isCurrent: { type: Boolean },
    },
    {
        collection: "semester",
        timestamps: {
            createdAt: "createdAt",
        },
    }
);

exports.ModelSemester = mongoose.model("semester", schema);
