const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const schema = new Schema(
    {
        instAid: { type: Number },
        organization: { type: String },

        firstname: { type: String },
        surname: { type: String },
        emailaddress: { type: String },

        active: { type: Boolean, default: true },
        deleted: { type: Boolean, default: false },
    },
    {
        collection: 'instructor',
        timestamps: {
            createdAt: 'createdAt',
            updatedAt: 'updatedAt',
        },
    },
);

exports.ModelInstructor = mongoose.model('instructor', schema);