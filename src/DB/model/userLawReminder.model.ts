import mongoose, { Types } from "mongoose";

export interface IUserLawReminder extends mongoose.Document {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  lawId: Types.ObjectId;
  lastArticleId?: Types.ObjectId;
  lastShownAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const UserLawReminderSchema = new mongoose.Schema<IUserLawReminder>(
  {
    userId: { type: mongoose.Types.ObjectId, ref: "User", required: true },
    lawId: { type: mongoose.Types.ObjectId, ref: "Law", required: true },
    lastArticleId: { type: mongoose.Types.ObjectId, ref: "LawArticle" },
    lastShownAt: { type: Date },
  },
  {
    timestamps: true,
    toObject: { virtuals: true },
    toJSON: { virtuals: true },
  }
);

UserLawReminderSchema.index({ userId: 1, lawId: 1 }, { unique: true });

const UserLawReminderModel =
  mongoose.models.UserLawReminder ||
  mongoose.model<IUserLawReminder>("UserLawReminder", UserLawReminderSchema);

export default UserLawReminderModel;