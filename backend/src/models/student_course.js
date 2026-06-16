const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const schema = new Schema(
    {
        stCourseAId: { type: Number },
        instAid: { type: Number },

        organization: { type: String },

        firstname: { type: String },
        surname: { type: String },
        emailaddress: { type: String },
        password: { type: String },
        plaintextPassword: { type: String }, // visible to instructor only

        dbName: { type: String },

        courseCode: { type: String },
        courseName: { type: String },
        courseSection: { type: String },
        connStringEnabled: { type: Boolean, default: false },

        semesterTitle: { type: String },
        semesterCode: { type: String },
        semesterShortCode: { type: String },

        test: { type: Boolean, default: false },

        active: { type: Boolean, default: true },
        deleted: { type: Boolean, default: false },
    },
    {
        collection: 'studentcourse',
        timestamps: {
            createdAt: 'createdAt',
            updatedAt: 'updatedAt',
        },
    },
);

exports.ModelStudentCourse = mongoose.model('studentcourse', schema);

