const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const schema = new Schema(
    {
        organization: { type: String },

        code: { type: String },
        code_f: { type: String },
        title: { type: String },
        description: { type: String },
        shortDesc: { type: String },
        clos: [
            {
                code: { type: String },
                text: { type: String },
            },
        ],

        active: { type: Boolean },
        deleted: { type: Boolean },
    },
    {
        collection: "course",
        timestamps: {
            createdAt: "createdAt",
        },
    }
);

exports.ModelCourse = mongoose.model("course", schema);
